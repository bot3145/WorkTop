// 命令层·资产/凭据/保险库：对齐 pwb-lite core/api.mjs 的语义。
// 资产.md = 结构面（可同步）；凭据.md = 隐私面（可整文件加密，行级 ENC:v1）。
// 与 pwb-lite 的一致性关键点：
//   - 资产 id = sha256(名)[0..10]，凭据 id 钉死在条目里（加密/解密改落盘值也不变）
//   - 旧类型 key 归一为 private-key；旧版内嵌凭据启动时一次性搬到 凭据.md
//   - 启用加密后 secret/passphrase 落盘为 ENC:v1:…；列表/接口绝不下发明文
use super::{read_settings, write_settings, AppState};
use crate::error::{AppError, AppResult};
use crate::store::{
    self,
    assets::{serialize_assets, Asset, AssetLink, CredEntry},
    creds::{parse_cred_doc, serialize_cred_doc, CredDoc},
    one_line, read_doc, sha256_hex, vault, write_doc,
};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::sync::MutexGuard;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

const VAULT_CHECK_MSG: &[u8] = b"pwb-lite-vault-check";
const KEYRING_SERVICE: &str = "com.bert.worktop";
const KEYRING_USER: &str = "vault-master";

/* ---------- id 与时间 ---------- */

pub fn asset_id(name: &str) -> String {
    sha256_hex(name)[..10].to_string()
}

pub fn cred_id(asset: &str, entry: &CredEntry) -> String {
    if let Some(id) = &entry.id {
        if !id.is_empty() {
            return id.clone();
        }
    }
    let material = format!("{}|{}|{}|{}|{}", asset, entry.kind, entry.label, entry.username, entry.secret);
    sha256_hex(&material)[..12].to_string()
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

/// 公历 → 自 1970-01-01 的天数（Howard Hinnant 算法），供到期日计算。
fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400;
    let mp = (m + 9) % 12;
    let doy = (153 * mp + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146097 + doe - 719468
}

fn is_leap(y: i64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}

fn parse_date(s: &str) -> Option<(i64, i64, i64)> {
    let bytes = s.as_bytes();
    if bytes.len() != 10 || bytes[4] != b'-' || bytes[7] != b'-' {
        return None;
    }
    let digit = |b: u8| (b as char).is_ascii_digit();
    if !bytes.iter().enumerate().all(|(i, b)| i == 4 || i == 7 || digit(*b)) {
        return None;
    }
    let y: i64 = s[0..4].parse().ok()?;
    let m: i64 = s[5..7].parse().ok()?;
    let d: i64 = s[8..10].parse().ok()?;
    let max_day = match m {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if is_leap(y) {
                29
            } else {
                28
            }
        }
        _ => return None,
    };
    if !(1..=12).contains(&m) || !(1..=max_day).contains(&d) {
        return None;
    }
    Some((y, m, d))
}

/// 到期日规范化：None/空 → None；非法格式或非真实日期 → 校验错误。
pub fn normalize_expires(value: &Option<String>) -> AppResult<Option<String>> {
    let Some(raw) = value else { return Ok(None) };
    let text = raw.trim();
    if text.is_empty() {
        return Ok(None);
    }
    let text = &text[..text.len().min(10)];
    match parse_date(text) {
        Some(_) => Ok(Some(text.to_string())),
        None => Err(AppError::validation("到期日需为 YYYY-MM-DD 格式。")),
    }
}

fn expires_days_left(date: &str) -> Option<i64> {
    let (y, m, d) = parse_date(date)?;
    let date_ms = days_from_civil(y, m, d) as f64 * 86400000.0;
    let diff = date_ms - now_ms() as f64;
    Some((diff / 86400000.0).ceil() as i64)
}

/* ---------- 凭据条目规范化 / 加解密 ---------- */

pub fn normalize_type(value: &str) -> String {
    if value == "key" {
        "private-key".into()
    } else {
        let v = one_line(value);
        if v.is_empty() {
            "password".into()
        } else {
            v
        }
    }
}

/// 入参 → 落盘条目：单行化文本字段；type/key 归一；id 透传（空视为无）。
pub fn normalize_entry(input: &CredEntryInput) -> CredEntry {
    CredEntry {
        id: input.id.as_deref().filter(|s| !s.is_empty()).map(String::from),
        kind: normalize_type(&input.kind),
        label: one_line(&input.label),
        username: one_line(&input.username),
        expires: input.expires.as_deref().filter(|s| !s.is_empty()).map(String::from),
        passphrase: input.passphrase.clone().filter(|s| !s.is_empty()),
        secret: input.secret.clone().unwrap_or_default(),
    }
}

/* ---------- 保险库 ---------- */

#[derive(Clone)]
struct VaultCfg {
    salt_b64: String,
    check_b64: String,
}

fn vault_config(state: &AppState) -> Option<VaultCfg> {
    let settings = read_settings(&state);
    let vault = settings.get("vault")?;
    Some(VaultCfg {
        salt_b64: vault.get("salt")?.as_str()?.to_string(),
        check_b64: vault.get("check")?.as_str()?.to_string(),
    })
}

pub fn vault_enabled(state: &AppState) -> bool {
    vault_config(state).is_some()
}

fn vault_check_hex(key: &[u8; 32]) -> String {
    use base64::Engine;
    let mut mac = Hmac::<Sha256>::new_from_slice(key).expect("hmac key");
    mac.update(VAULT_CHECK_MSG);
    base64::engine::general_purpose::STANDARD.encode(mac.finalize().into_bytes())
}

fn lock_guard(state: &AppState) -> MutexGuard<'_, Option<[u8; 32]>> {
    state.vault_key.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn vault_unlocked(state: &AppState) -> bool {
    lock_guard(state).is_some()
}

fn assert_vault_key(state: &AppState) -> AppResult<[u8; 32]> {
    match *lock_guard(state) {
        Some(key) => Ok(key),
        None => Err(AppError::locked("凭据库已加密且未解锁：请先解锁（或关闭加密）。")),
    }
}

fn seal_entry(entry: &CredEntry, key: &[u8; 32], cfg: &VaultCfg) -> AppResult<CredEntry> {
    let mut sealed = entry.clone();
    if !sealed.secret.is_empty() && !vault::is_encrypted(&sealed.secret) {
        sealed.secret = vault::encrypt_secret(&sealed.secret, key, &cfg.salt_b64)?;
    }
    if let Some(pass) = sealed.passphrase.clone().filter(|p| !vault::is_encrypted(p)) {
        sealed.passphrase = Some(vault::encrypt_secret(&pass, key, &cfg.salt_b64)?);
    }
    Ok(sealed)
}

fn open_entry(entry: &CredEntry, key: Option<&[u8; 32]>) -> AppResult<CredEntry> {
    let mut opened = entry.clone();
    if vault::is_encrypted(&opened.secret) {
        let key = key.ok_or_else(|| AppError::locked("凭据库已加密且未解锁：请先解锁。"))?;
        opened.secret = vault::decrypt_secret(&opened.secret, key)?;
    }
    if let Some(pass) = opened.passphrase.clone().filter(|p| vault::is_encrypted(p)) {
        let key = key.ok_or_else(|| AppError::locked("凭据库已加密且未解锁：请先解锁。"))?;
        opened.passphrase = Some(vault::decrypt_secret(&pass, key)?);
    }
    Ok(opened)
}

fn keyring_entry() -> AppResult<keyring::Entry> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|e| AppError::new("internal", format!("系统钥匙串不可用：{e}")))
}

fn keyring_clear() {
    if let Ok(entry) = keyring_entry() {
        let _ = entry.delete_credential();
    }
}

/// 启动时自动解锁：设置里启用了加密且系统钥匙串存有主口令 → 校验通过则静默解锁。
pub fn try_autounlock(state: &AppState) {
    let Some(cfg) = vault_config(state) else { return };
    let Ok(entry) = keyring_entry() else { return };
    let Ok(passphrase) = entry.get_password() else { return };
    let Ok(salt) = base64_decode(&cfg.salt_b64) else { return };
    let Ok(key) = vault::derive_key(&passphrase, &salt) else { return };
    if vault_check_hex(&key) == cfg.check_b64 {
        *lock_guard(state) = Some(key);
    }
}

fn base64_decode(text: &str) -> AppResult<Vec<u8>> {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD
        .decode(text)
        .map_err(|e| AppError::validation(format!("base64 不合法：{e}")))
}

/* ---------- 凭据.md 读写与迁移 ---------- */

fn load_cred_doc(state: &AppState) -> AppResult<CredDoc> {
    let text = read_doc(&state.file("凭据.md"))?.map(|d| d.text).unwrap_or_default();
    Ok(parse_cred_doc(&text))
}

fn save_cred_doc(state: &AppState, doc: &CredDoc) -> AppResult<()> {
    write_doc(&state.file("凭据.md"), &serialize_cred_doc(doc))?;
    Ok(())
}

/// 原始行 → 条目（含 id 钉死与类型归一）；解析失败的行跳过（与 Node 版一致）。
fn parse_cred_line(line: &str, asset: &str) -> Option<CredEntry> {
    let mut entry: CredEntry = serde_json::from_str(line).ok()?;
    entry.kind = normalize_type(&entry.kind);
    if entry.id.as_deref().unwrap_or("").is_empty() {
        entry.id = Some(cred_id(asset, &entry));
    }
    Some(entry)
}

fn entry_to_line(entry: &CredEntry) -> String {
    serde_json::to_string(entry).unwrap_or_default()
}

/// 旧版把凭据内嵌在 资产.md：启动时一次性搬到 凭据.md（搬完 资产.md 不再含凭据行）。
/// 已解锁时顺带密封；未解锁则按明文搬入（与 Node 版语义一致）。
pub fn migrate_credential_split(state: &AppState) -> bool {
    let result = (|| -> AppResult<bool> {
        let doc = read_doc(&state.file("资产.md"))?;
        let text = doc.map(|d| d.text).unwrap_or_default();
        let mut assets = store::assets::parse_assets(&text);
        if !assets.iter().any(|a| !a.credentials.is_empty()) {
            return Ok(false);
        }
        let mut cred_doc = load_cred_doc(&state)?;
        let cfg = vault_config(state);
        let key = if cfg.is_some() { assert_vault_key(state).ok() } else { None };
        for asset in &mut assets {
            if asset.credentials.is_empty() {
                continue;
            }
            let mut lines = Vec::new();
            for input in &asset.credentials {
                let mut entry = normalize_entry(&CredEntryInput::from_entry(input));
                if let (Some(cfg), Some(key)) = (&cfg, &key) {
                    if let Ok(sealed) = seal_entry(&entry, key, cfg) {
                        entry = sealed;
                    }
                }
                if entry.id.as_deref().unwrap_or("").is_empty() {
                    entry.id = Some(cred_id(&asset.name, &entry));
                }
                lines.push(entry_to_line(&entry));
            }
            let name = asset.name.clone();
            asset.credentials.clear();
            doc_append(&mut cred_doc, &name, lines);
        }
        save_cred_doc(state, &cred_doc)?;
        write_doc(&state.file("资产.md"), &serialize_assets(&assets))?;
        Ok(true)
    })();
    matches!(result, Ok(true))
}

fn doc_append(doc: &mut CredDoc, asset: &str, lines: Vec<String>) {
    let list = doc.get_mut(asset);
    list.extend(lines);
}

/* ---------- API 形态 ---------- */

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CredEntryInput {
    #[serde(default)]
    pub id: Option<String>,
    #[serde(default, rename = "type")]
    pub kind: String,
    #[serde(default)]
    pub label: String,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub expires: Option<String>,
    #[serde(default)]
    pub passphrase: Option<String>,
    #[serde(default)]
    pub secret: Option<String>,
}

impl CredEntryInput {
    fn from_entry(entry: &CredEntry) -> Self {
        Self {
            id: entry.id.clone(),
            kind: entry.kind.clone(),
            label: entry.label.clone(),
            username: entry.username.clone(),
            expires: entry.expires.clone(),
            passphrase: entry.passphrase.clone(),
            secret: Some(entry.secret.clone()),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CredApi {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub label: String,
    pub username: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_in_days: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetApi {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: String,
    pub grp: String,
    pub project: String,
    pub note: String,
    pub links: Vec<AssetLink>,
    pub credentials: Vec<CredApi>,
    pub last_status: String,
    pub last_check: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct VaultState {
    pub enabled: bool,
    pub unlocked: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetsPayload {
    pub assets: Vec<AssetApi>,
    pub groups: Vec<String>,
    pub vault: VaultState,
}

fn load_assets(state: &AppState) -> AppResult<Vec<AssetApi>> {
    let text = read_doc(&state.file("资产.md"))?.map(|d| d.text).unwrap_or_default();
    let assets = store::assets::parse_assets(&text);
    let cred_doc = load_cred_doc(&state)?;
    let mut out = Vec::with_capacity(assets.len());
    for asset in assets {
        let credentials = cred_doc
            .get(&asset.name)
            .map(|list| {
                list.iter()
                    .filter_map(|line| parse_cred_line(line, &asset.name))
                    .map(|entry| CredApi {
                        id: cred_id(&asset.name, &entry),
                        kind: entry.kind,
                        label: entry.label,
                        username: entry.username,
                        expires_in_days: entry.expires.as_deref().and_then(expires_days_left),
                        expires: entry.expires,
                    })
                    .collect()
            })
            .unwrap_or_default();
        out.push(AssetApi {
            id: asset_id(&asset.name),
            name: asset.name,
            host: asset.host,
            port: asset.port,
            grp: asset.grp,
            project: asset.project,
            note: asset.note,
            links: asset.links,
            credentials,
            last_status: asset.last_status,
            last_check: asset.last_check,
        });
    }
    Ok(out)
}

fn find_asset_api<'a>(assets: &'a [AssetApi], id: &str) -> AppResult<&'a AssetApi> {
    assets.iter().find(|a| a.id == id).ok_or_else(|| AppError::not_found("资产不存在。"))
}

/* ---------- 命令：资产 ---------- */


#[tauri::command]
pub fn assets_list(state: State<AppState>) -> AppResult<AssetsPayload> {
    let assets = load_assets(&state)?;
    // 载荷类型 CredApi 不含 secret/passphrase 字段（见下方回归测试），秘密只能经 cred_secret_get 单条取
    let mut groups: Vec<String> = assets.iter().filter(|a| !a.grp.is_empty()).map(|a| a.grp.clone()).collect();
    groups.sort();
    groups.dedup();
    Ok(AssetsPayload {
        vault: VaultState { enabled: vault_enabled(&state), unlocked: vault_unlocked(&state) },
        assets,
        groups,
    })
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetInput {
    pub name: String,
    #[serde(default)] pub host: String,
    #[serde(default)] pub port: String,
    #[serde(default)] pub grp: String,
    #[serde(default)] pub project: String,
    #[serde(default)] pub note: String,
    #[serde(default)] pub credentials: Vec<CredEntryInput>,
}

#[tauri::command]
pub fn asset_create(state: State<AppState>, input: AssetInput) -> AppResult<String> {
    let name = one_line(&input.name);
    if name.is_empty() {
        return Err(AppError::validation("缺少资产名称。"));
    }
    let with_secret: Vec<&CredEntryInput> = input.credentials.iter().filter(|c| c.secret.as_deref().unwrap_or("") != "").collect();
    if !with_secret.is_empty() && vault_enabled(&state) && !vault_unlocked(&state) {
        return Err(AppError::locked("凭据库已加密且未解锁：请先解锁，或先不保存凭据。"));
    }
    let text = read_doc(&state.file("资产.md"))?.map(|d| d.text).unwrap_or_default();
    let mut assets = store::assets::parse_assets(&text);
    if assets.iter().any(|a| a.name == name) {
        return Err(AppError::validation("同名资产已存在。"));
    }
    assets.push(Asset {
        name: name.clone(),
        host: one_line(&input.host),
        port: one_line(&input.port),
        grp: one_line(&input.grp),
        project: one_line(&input.project),
        note: one_line(&input.note),
        links: Vec::new(),
        credentials: Vec::new(),
        last_status: String::new(),
        last_check: String::new(),
    });
    write_doc(&state.file("资产.md"), &serialize_assets(&assets))?;
    if !with_secret.is_empty() {
        append_credentials(&state, &name, &with_secret)?;
    }
    Ok(asset_id(&name))
}

fn append_credentials(state: &AppState, asset: &str, inputs: &[&CredEntryInput]) -> AppResult<()> {
    let cfg = vault_config(state);
    let key = if cfg.is_some() { Some(assert_vault_key(state)?) } else { None };
    let mut doc = load_cred_doc(&state)?;
    let list = doc.get_mut(asset);
    for input in inputs {
        let expires = normalize_expires(&input.expires)?;
        let mut entry = normalize_entry(input);
        entry.expires = expires;
        if let (Some(cfg), Some(key)) = (&cfg, &key) {
            entry = seal_entry(&entry, key, cfg)?;
        }
        if entry.id.as_deref().unwrap_or("").is_empty() {
            entry.id = Some(cred_id(asset, &entry));
        }
        list.push(entry_to_line(&entry));
    }
    save_cred_doc(&state, &doc)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetUpdateInput {
    pub name: String,
    #[serde(default)] pub host: Option<String>,
    #[serde(default)] pub port: Option<String>,
    #[serde(default)] pub grp: Option<String>,
    #[serde(default)] pub project: Option<String>,
    #[serde(default)] pub note: Option<String>,
}

#[tauri::command]
pub fn asset_update(state: State<AppState>, id: String, input: AssetUpdateInput) -> AppResult<String> {
    let new_name = one_line(&input.name);
    if new_name.is_empty() {
        return Err(AppError::validation("资产名称不能为空。"));
    }
    let text = read_doc(&state.file("资产.md"))?.map(|d| d.text).unwrap_or_default();
    let mut assets = store::assets::parse_assets(&text);
    let target = assets.iter_mut().find(|a| asset_id(&a.name) == id).ok_or_else(|| AppError::not_found("资产不存在。"))?;
    let old_name = target.name.clone();
    if new_name != old_name {
        if assets.iter().any(|a| a.name == new_name) {
            return Err(AppError::validation("同名资产已存在。"));
        }
        // 改名迁移：凭据小节跟随（令牌目录 tokens/<名> 属于后续阶段）
        let mut doc = load_cred_doc(&state)?;
        if let Some(list) = doc.get(&old_name).cloned() {
            doc.remove(&old_name);
            let merged = doc.get_mut(&new_name);
            merged.extend(list);
            save_cred_doc(&state, &doc)?;
        }
    }
    let target = assets.iter_mut().find(|a| asset_id(&a.name) == id).unwrap();
    if let Some(host) = &input.host { target.host = one_line(host); }
    if let Some(port) = &input.port { target.port = one_line(port); }
    if let Some(grp) = &input.grp { target.grp = one_line(grp); }
    if let Some(project) = &input.project { target.project = one_line(project); }
    if let Some(note) = &input.note { target.note = one_line(note); }
    target.name = new_name.clone();
    write_doc(&state.file("资产.md"), &serialize_assets(&assets))?;
    Ok(asset_id(&new_name))
}

#[tauri::command]
pub fn asset_delete(state: State<AppState>, id: String) -> AppResult<()> {
    let text = read_doc(&state.file("资产.md"))?.map(|d| d.text).unwrap_or_default();
    let mut assets = store::assets::parse_assets(&text);
    let target = assets.iter().find(|a| asset_id(&a.name) == id).ok_or_else(|| AppError::not_found("资产不存在。"))?;
    let name = target.name.clone();
    let rest: Vec<Asset> = assets.iter().filter(|a| a.name != name).cloned().collect();
    write_doc(&state.file("资产.md"), &serialize_assets(&rest))?;
    let mut doc = load_cred_doc(&state)?;
    doc.remove(&name);
    save_cred_doc(&state, &doc)
}

#[tauri::command]
pub fn group_rename(state: State<AppState>, from: String, to: String) -> AppResult<()> {
    let from = one_line(&from);
    let to = one_line(&to);
    if from.is_empty() || to.is_empty() {
        return Err(AppError::validation("缺少分组名。"));
    }
    if from == to {
        return Ok(());
    }
    let text = read_doc(&state.file("资产.md"))?.map(|d| d.text).unwrap_or_default();
    let mut assets = store::assets::parse_assets(&text);
    for asset in &mut assets {
        if asset.grp == from {
            asset.grp = to.clone();
        }
    }
    write_doc(&state.file("资产.md"), &serialize_assets(&assets))?;
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct LinkInput {
    #[serde(default)] pub label: String,
    pub url: String,
}

#[tauri::command]
pub fn asset_link_add(state: State<AppState>, id: String, link: LinkInput) -> AppResult<()> {
    if link.url.is_empty() {
        return Err(AppError::validation("缺少链接地址。"));
    }
    let label = one_line(if link.label.is_empty() { &link.url } else { &link.label }).chars().take(60).collect::<String>();
    let url = one_line(&link.url).chars().take(500).collect::<String>();
    let text = read_doc(&state.file("资产.md"))?.map(|d| d.text).unwrap_or_default();
    let mut assets = store::assets::parse_assets(&text);
    let target = assets.iter_mut().find(|a| asset_id(&a.name) == id).ok_or_else(|| AppError::not_found("资产不存在。"))?;
    target.links.push(AssetLink { label, url });
    write_doc(&state.file("资产.md"), &serialize_assets(&assets))?;
    Ok(())
}

#[tauri::command]
pub fn asset_link_delete(state: State<AppState>, id: String, index: usize) -> AppResult<()> {
    let text = read_doc(&state.file("资产.md"))?.map(|d| d.text).unwrap_or_default();
    let mut assets = store::assets::parse_assets(&text);
    let target = assets.iter_mut().find(|a| asset_id(&a.name) == id).ok_or_else(|| AppError::not_found("资产不存在。"))?;
    if index >= target.links.len() {
        return Err(AppError::not_found("链接不存在。"));
    }
    target.links.remove(index);
    write_doc(&state.file("资产.md"), &serialize_assets(&assets))?;
    Ok(())
}

/* ---------- 命令：凭据 ---------- */

#[tauri::command]
pub fn asset_cred_add(state: State<AppState>, id: String, credential: CredEntryInput) -> AppResult<String> {
    if credential.secret.as_deref().unwrap_or("").is_empty() {
        return Err(AppError::validation("缺少凭据内容。"));
    }
    let assets = load_assets(&state)?;
    let asset = find_asset_api(&assets, &id)?;
    let asset_name = asset.name.clone();
    append_credentials(&state, &asset_name, &[&credential])?;
    Ok(cred_id(&asset_name, &normalize_entry(&credential)))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CredUpdateInput {
    #[serde(default, rename = "type")]
    pub kind: Option<String>,
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub secret: Option<String>,
    #[serde(default)]
    pub passphrase: Option<String>,
    #[serde(default)]
    pub expires: Option<String>,
}

/// 定位并更新凭据条目；secret/passphrase 仅在非空时替换，expires 空串表示清除。
#[tauri::command]
pub fn cred_update(state: State<AppState>, id: String, input: CredUpdateInput) -> AppResult<()> {
    let changing_secret = !input.secret.as_deref().unwrap_or("").is_empty() || !input.passphrase.as_deref().unwrap_or("").is_empty();
    if changing_secret && vault_enabled(&state) && !vault_unlocked(&state) {
        return Err(AppError::locked("凭据库已加密且未解锁：请先解锁。"));
    }
    let expires = normalize_expires(&input.expires)?;
    let mut doc = load_cred_doc(&state)?;
    let mut found = false;
    for (asset, list) in doc.sections.iter_mut() {
        for line in list.iter_mut() {
            let Some(mut entry) = parse_cred_line(line, asset) else { continue };
            if cred_id(asset, &entry) != id {
                continue;
            }
            if let Some(label) = &input.label { entry.label = one_line(label); }
            if let Some(kind) = &input.kind { entry.kind = normalize_type(kind); }
            if let Some(username) = &input.username { entry.username = one_line(username); }
            if let Some(secret) = &input.secret {
                if !secret.is_empty() {
                    if vault_enabled(&state) {
                        let key = assert_vault_key(&state)?;
                        let cfg = vault_config(&state).unwrap();
                        entry.secret = vault::encrypt_secret(secret, &key, &cfg.salt_b64)?;
                    } else {
                        entry.secret = secret.clone();
                    }
                }
            }
            match input.passphrase.as_deref() {
                Some("") => { entry.passphrase = None; }
                Some(pass) => {
                    if vault_enabled(&state) {
                        let key = assert_vault_key(&state)?;
                        let cfg = vault_config(&state).unwrap();
                        entry.passphrase = Some(vault::encrypt_secret(pass, &key, &cfg.salt_b64)?);
                    } else {
                        entry.passphrase = Some(pass.to_string());
                    }
                }
                None => {}
            }
            match &expires {
                Some(value) => entry.expires = Some(value.clone()),
                None => { if input.expires.is_some() { entry.expires = None; } }
            }
            *line = entry_to_line(&entry);
            found = true;
            break;
        }
        if found { break; }
    }
    if !found {
        return Err(AppError::not_found("凭据不存在。"));
    }
    save_cred_doc(&state, &doc)
}

#[tauri::command]
pub fn cred_delete(state: State<AppState>, id: String) -> AppResult<()> {
    let mut doc = load_cred_doc(&state)?;
    let mut found = false;
    for (asset, list) in doc.sections.iter_mut() {
        let before = list.len();
        let asset_name = asset.clone();
        list.retain(|line| parse_cred_line(line, &asset_name).map(|e| cred_id(&asset_name, &e) != id).unwrap_or(true));
        if list.len() != before {
            found = true;
            break;
        }
    }
    if !found {
        return Err(AppError::not_found("凭据不存在。"));
    }
    save_cred_doc(&state, &doc)
}

#[derive(Debug, Serialize)]
pub struct SecretPayload {
    pub secret: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub passphrase: Option<String>,
}

#[tauri::command]
pub fn cred_secret_get(state: State<AppState>, id: String) -> AppResult<SecretPayload> {
    let doc = load_cred_doc(&state)?;
    let key = if vault_enabled(&state) { Some(assert_vault_key(&state)?) } else { None };
    for (asset, list) in &doc.sections {
        for line in list {
            let Some(entry) = parse_cred_line(line, asset) else { continue };
            if cred_id(asset, &entry) != id {
                continue;
            }
            let opened = open_entry(&entry, key.as_ref())?;
            return Ok(SecretPayload { secret: opened.secret, passphrase: opened.passphrase.filter(|p| !p.is_empty()) });
        }
    }
    Err(AppError::not_found("凭据不存在。"))
}

/* ---------- 命令：保险库 ---------- */

#[tauri::command]
pub fn vault_state_get(state: State<AppState>) -> VaultState {
    VaultState { enabled: vault_enabled(&state), unlocked: vault_unlocked(&state) }
}

fn seal_all(state: &AppState, key: &[u8; 32], cfg: &VaultCfg) -> AppResult<()> {
    let mut doc = load_cred_doc(&state)?;
    for (asset, list) in doc.sections.iter_mut() {
        for line in list.iter_mut() {
            if let Some(entry) = parse_cred_line(line, asset) {
                let sealed = seal_entry(&entry, key, cfg)?;
                *line = entry_to_line(&sealed);
            }
        }
    }
    save_cred_doc(&state, &doc)
}

#[tauri::command]
pub fn vault_enable(state: State<AppState>, passphrase: String) -> AppResult<VaultState> {
    if passphrase.chars().count() < 4 {
        return Err(AppError::validation("主口令至少 4 位。"));
    }
    if vault_enabled(&state) {
        return Err(AppError::validation("凭据加密已启用。"));
    }
    use base64::Engine;
    let salt: [u8; 16] = {
        let mut buf = [0u8; 16];
        use aes_gcm::aead::rand_core::RngCore;
        aes_gcm::aead::OsRng.fill_bytes(&mut buf);
        buf
    };
    let salt_b64 = base64::engine::general_purpose::STANDARD.encode(salt);
    let key = vault::derive_key(&passphrase, &salt)?;
    seal_all(&state, &key, &VaultCfg { salt_b64: salt_b64.clone(), check_b64: vault_check_hex(&key) })?;
    let mut settings = read_settings(&state);
    if let Some(obj) = settings.as_object_mut() {
        obj.insert("vault".into(), serde_json::json!({ "salt": salt_b64, "check": vault_check_hex(&key) }));
    }
    write_settings(&state, &settings)?;
    *lock_guard(&state) = Some(key);
    Ok(VaultState { enabled: true, unlocked: true })
}

#[tauri::command]
pub fn vault_unlock(state: State<AppState>, passphrase: String, remember: Option<bool>) -> AppResult<VaultState> {
    let cfg = vault_config(&state).ok_or_else(|| AppError::validation("凭据加密未启用。"))?;
    let salt = base64_decode(&cfg.salt_b64)?;
    let key = vault::derive_key(&passphrase, &salt)?;
    if vault_check_hex(&key) != cfg.check_b64 {
        return Err(AppError::new("unauthorized", "主口令不对。"));
    }
    *lock_guard(&state) = Some(key);
    match remember {
        Some(true) => {
            let entry = keyring_entry()?;
            entry.set_password(&passphrase).map_err(|e| AppError::new("internal", format!("写入系统钥匙串失败：{e}")))?;
        }
        Some(false) => keyring_clear(),
        None => {}
    }
    Ok(VaultState { enabled: true, unlocked: true })
}

#[tauri::command]
pub fn vault_lock(state: State<AppState>) -> VaultState {
    *lock_guard(&state) = None;
    keyring_clear();
    VaultState { enabled: vault_enabled(&state), unlocked: false }
}

#[tauri::command]
pub fn vault_disable(state: State<AppState>, passphrase: String) -> AppResult<VaultState> {
    let cfg = vault_config(&state).ok_or_else(|| AppError::validation("凭据加密未启用。"))?;
    let salt = base64_decode(&cfg.salt_b64)?;
    let key = vault::derive_key(&passphrase, &salt)?;
    if vault_check_hex(&key) != cfg.check_b64 {
        return Err(AppError::new("unauthorized", "主口令不对。"));
    }
    // 全量解密回明文
    let mut doc = load_cred_doc(&state)?;
    for (asset, list) in doc.sections.iter_mut() {
        for line in list.iter_mut() {
            if let Some(entry) = parse_cred_line(line, asset) {
                let opened = open_entry(&entry, Some(&key))?;
                *line = entry_to_line(&opened);
            }
        }
    }
    save_cred_doc(&state, &doc)?;
    let mut settings = read_settings(&state);
    if let Some(obj) = settings.as_object_mut() {
        obj.remove("vault");
    }
    write_settings(&state, &settings)?;
    *lock_guard(&state) = None;
    keyring_clear();
    Ok(VaultState { enabled: false, unlocked: false })
}

/* ---------- 命令：TCP 探测 ---------- */

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProbeResult {
    pub ok: bool,
    pub last_check: String,
    pub last_status: String,
}

#[tauri::command]
pub async fn asset_check(state: State<'_, AppState>, id: String) -> AppResult<ProbeResult> {
    let assets = load_assets(&state)?;
    let asset = find_asset_api(&assets, &id)?.clone();
    if asset.host.is_empty() || asset.port.is_empty() {
        return Err(AppError::validation("该资产未配置主机/端口。"));
    }
    let host = asset.host.clone();
    let port: u16 = asset.port.parse().map_err(|_| AppError::validation("端口不合法。"))?;
    let ok = tokio::time::timeout(
        std::time::Duration::from_millis(2500),
        tokio::net::TcpStream::connect((host.as_str(), port)),
    )
    .await
    .map(|r| r.is_ok())
    .unwrap_or(false);
    // 时间戳由前端格式化展示，这里落盘 ISO8601（与 pwb-lite 一致，用无时区标记的本机表述）
    let checked_at = format!("{}Z", humantime_like_iso(now_ms()));
    let text = read_doc(&state.file("资产.md"))?.map(|d| d.text).unwrap_or_default();
    let mut disk_assets = store::assets::parse_assets(&text);
    if let Some(target) = disk_assets.iter_mut().find(|a| a.name == asset.name) {
        target.last_status = if ok { "up" } else { "down" }.into();
        target.last_check = checked_at.clone();
    }
    write_doc(&state.file("资产.md"), &serialize_assets(&disk_assets))?;
    Ok(ProbeResult {
        ok,
        last_check: checked_at,
        last_status: if ok { "up".into() } else { "down".into() },
    })
}

/// 无外部时间库的 ISO8601（UTC，毫秒）：2026-10-29T06:12:34.567Z。
fn humantime_like_iso(ms: u64) -> String {
    let secs = ms / 1000;
    let millis = ms % 1000;
    let days = (secs / 86400) as i64;
    let rem = secs % 86400;
    let (h, mi, s) = (rem / 3600, (rem % 3600) / 60, rem % 60);
    let (y, m, d) = civil_from_days(days);
    format!("{y:04}-{m:02}-{d:02}T{h:02}:{mi:02}:{s:02}.{millis:03}")
}

fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn expires_validation_and_days() {
        assert!(normalize_expires(&Some("2026-10-29".into())).is_ok());
        assert!(normalize_expires(&Some("2026-02-30".into())).is_err(), "非真实日期拒绝");
        assert!(normalize_expires(&Some("2026-13-01".into())).is_err());
        assert!(normalize_expires(&Some("".into())).unwrap().is_none());
        assert!(normalize_expires(&None).unwrap().is_none());
        let far = expires_days_left("2999-01-01").unwrap();
        assert!((350_000..400_000).contains(&far), "2999 年距今约 37 万天，实际 {far}");
        let past = expires_days_left("2000-01-01").unwrap();
        assert!(past < 0);
    }

    #[test]
    fn civil_roundtrip() {
        assert_eq!(civil_from_days(0), (1970, 1, 1));
        assert_eq!(days_from_civil(1970, 1, 1), 0);
        for (y, m, d) in [(2026, 10, 29), (2000, 2, 29), (1999, 12, 31)] {
            assert_eq!(civil_from_days(days_from_civil(y, m, d)), (y, m as u32, d as u32));
        }
    }

    #[test]
    fn iso_format() {
        assert_eq!(humantime_like_iso(0), "1970-01-01T00:00:00.000");
        // 2026-10-29T06:30:00Z 的毫秒值（与 Node Date.parse 对齐）
        assert_eq!(humantime_like_iso(1793255400000), "2026-10-29T06:30:00.000");
        assert_eq!(humantime_like_iso(1698551114567), "2023-10-29T03:45:14.567");
    }

    #[test]
    fn ids_match_pwb_lite_scheme() {
        assert_eq!(asset_id("主机A").len(), 10);
        let entry = CredEntry {
            id: None,
            kind: "password".into(),
            label: "l".into(),
            username: "u".into(),
            expires: None,
            passphrase: None,
            secret: "s".into(),
        };
        assert_eq!(cred_id("主机A", &entry).len(), 12);
    }
}

#[cfg(test)]
mod extra_tests {
    use super::*;

    /// 资产列表载荷的回归护栏：谁往 CredApi/AssetApi 里加回 secret 字段，测试立刻红
    #[test]
    fn assets_payload_never_carries_secrets() {
        let cred = CredApi {
            id: "x".into(),
            kind: "password".into(),
            label: "登录".into(),
            username: "root".into(),
            expires: None,
            expires_in_days: None,
        };
        let asset = AssetApi {
            id: "i".into(),
            name: "主机A".into(),
            host: "1.1.1.1".into(),
            port: "22".into(),
            grp: "".into(),
            project: "".into(),
            note: "".into(),
            links: vec![],
            credentials: vec![cred],
            last_status: "".into(),
            last_check: "".into(),
        };
        let text = serde_json::to_string(&asset).unwrap();
        assert!(!text.contains("secret"), "资产列表载荷不得出现 secret 字段：{text}");
        assert!(!text.contains("passphrase"), "资产列表载荷不得出现 passphrase 字段：{text}");
    }
}
