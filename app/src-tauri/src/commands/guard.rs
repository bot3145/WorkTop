// 命令层·模块锁（门禁，不是加密）。
//
// 设计取向：文档一律保持明文落盘（便于 Obsidian 直接编辑、便于 AI 工具读写），
// 口令只拦「界面上直接查看」——打开受保护模块要先输入口令，退出程序后自动重新上锁。
// 因此这里**不碰任何文件内容**，只在 设置.json 里存一份口令校验值，外加进程内的解锁集合。
//
// 口令派生复用 store::vault 的 scrypt 参数；校验值用 HMAC-SHA256(key, GUARD_MSG)，
// 与 vault 的 check 同构但用不同消息，避免与凭据库口令互相顶替。
use super::{read_settings, write_settings, AppState};
use crate::error::{AppError, AppResult};
use crate::store::vault;
use base64::Engine;
use hmac::{Hmac, Mac};
use serde::Serialize;
use sha2::Sha256;
use std::collections::BTreeSet;
use std::sync::MutexGuard;
use tauri::State;

const GUARD_MSG: &[u8] = b"pwb-guard-check";

/// 允许上锁的模块（与前端 pane id 对齐）。设置、应用启动器这类不锁，否则会把自己关在门外。
pub const GUARD_MODULES: [&str; 3] = ["keys", "assets", "note"];

#[derive(Debug, Serialize)]
pub struct GuardState {
    pub enabled: bool,
    pub modules: Vec<String>,
    pub unlocked: Vec<String>,
}

#[derive(Debug, Clone)]
struct GuardCfg {
    salt_b64: String,
    check_b64: String,
    modules: Vec<String>,
}

fn guard_cfg(state: &AppState) -> Option<GuardCfg> {
    let settings = read_settings(state);
    let guard = settings.get("guard")?;
    let modules = guard
        .get("modules")
        .and_then(|m| m.as_array())
        .map(|list| sanitize_modules(list.iter().filter_map(|v| v.as_str())))
        .unwrap_or_default();
    Some(GuardCfg {
        salt_b64: guard.get("salt")?.as_str()?.to_string(),
        check_b64: guard.get("check")?.as_str()?.to_string(),
        modules,
    })
}

/// 只保留已知模块名，去重并按固定顺序排列（避免设置文件里出现垃圾值）。
fn sanitize_modules(raw: impl IntoIterator<Item = impl AsRef<str>>) -> Vec<String> {
    let set: BTreeSet<&str> = raw.into_iter().filter_map(|s| {
        let name = s.as_ref();
        GUARD_MODULES.iter().copied().find(|m| *m == name)
    }).collect();
    GUARD_MODULES.iter().filter(|m| set.contains(*m)).map(|m| (*m).to_string()).collect()
}

fn check_hex(key: &[u8; 32]) -> String {
    let mut mac = Hmac::<Sha256>::new_from_slice(key).expect("hmac key");
    mac.update(GUARD_MSG);
    base64::engine::general_purpose::STANDARD.encode(mac.finalize().into_bytes())
}

fn open_set(state: &AppState) -> MutexGuard<'_, BTreeSet<String>> {
    state.guard_open.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn verify(state: &AppState, password: &str) -> AppResult<[u8; 32]> {
    let cfg = guard_cfg(state).ok_or_else(|| AppError::validation("还没有设置模块锁口令。"))?;
    let salt = base64::engine::general_purpose::STANDARD
        .decode(&cfg.salt_b64)
        .map_err(|e| AppError::new("internal", format!("口令盐值损坏：{e}")))?;
    let key = vault::derive_key(password, &salt)?;
    if check_hex(&key) != cfg.check_b64 {
        return Err(AppError::new("unauthorized", "口令不对。"));
    }
    Ok(key)
}

fn state_of(state: &AppState) -> GuardState {
    let Some(cfg) = guard_cfg(state) else {
        return GuardState { enabled: false, modules: Vec::new(), unlocked: Vec::new() };
    };
    let open = open_set(state);
    GuardState {
        enabled: true,
        unlocked: cfg.modules.iter().filter(|m| open.contains(*m)).cloned().collect(),
        modules: cfg.modules,
    }
}

fn save_guard(state: &AppState, cfg: Option<(&str, &str, &[String])>) -> AppResult<()> {
    let mut settings = read_settings(state);
    let Some(obj) = settings.as_object_mut() else {
        return Err(AppError::new("internal", "设置文件不是 JSON 对象。"));
    };
    match cfg {
        Some((salt, check, modules)) => {
            obj.insert("guard".into(), serde_json::json!({ "salt": salt, "check": check, "modules": modules }));
        }
        None => {
            obj.remove("guard");
        }
    }
    write_settings(state, &settings)
}

/* ---------- 命令 ---------- */

#[tauri::command]
pub fn guard_state_get(state: State<AppState>) -> GuardState {
    state_of(&state)
}

/// 首次设置口令（current 为空）或修改口令（current 必须是现有口令）。
/// 改口令不清空解锁状态——用户刚证明过身份，没必要立刻再锁一次。
#[tauri::command]
pub fn guard_password_set(state: State<AppState>, current: Option<String>, next: String) -> AppResult<GuardState> {
    if next.chars().count() < 4 {
        return Err(AppError::validation("口令至少 4 位。"));
    }
    let (salt_b64, check_b64, modules) = match guard_cfg(&state) {
        Some(cfg) => {
            let raw = current.filter(|c| !c.is_empty()).ok_or_else(|| AppError::new("unauthorized", "请输入当前口令。"))?;
            verify(&state, &raw)?;
            let salt = base64::engine::general_purpose::STANDARD
                .decode(&cfg.salt_b64)
                .map_err(|e| AppError::new("internal", format!("口令盐值损坏：{e}")))?;
            let key = vault::derive_key(&next, &salt)?;
            (cfg.salt_b64, check_hex(&key), cfg.modules)
        }
        None => {
            let salt: [u8; 16] = {
                let mut buf = [0u8; 16];
                use aes_gcm::aead::rand_core::RngCore;
                aes_gcm::aead::OsRng.fill_bytes(&mut buf);
                buf
            };
            let salt_b64 = base64::engine::general_purpose::STANDARD.encode(salt);
            let key = vault::derive_key(&next, &salt)?;
            (salt_b64, check_hex(&key), Vec::new())
        }
    };
    save_guard(&state, Some((&salt_b64, &check_b64, &modules)))?;
    Ok(state_of(&state))
}

/// 关闭模块锁：清掉口令与模块清单，所有模块恢复可直接访问。
#[tauri::command]
pub fn guard_password_clear(state: State<AppState>, password: String) -> AppResult<GuardState> {
    verify(&state, &password)?;
    save_guard(&state, None)?;
    open_set(&state).clear();
    Ok(state_of(&state))
}

/// 设置哪些模块需要口令。必须先有口令——否则一锁就打不开了。
#[tauri::command]
pub fn guard_modules_set(state: State<AppState>, modules: Vec<String>) -> AppResult<GuardState> {
    let cfg = guard_cfg(&state).ok_or_else(|| AppError::validation("请先设置模块锁口令。"))?;
    let next = sanitize_modules(&modules);
    save_guard(&state, Some((&cfg.salt_b64, &cfg.check_b64, &next)))?;
    // 从清单里移除的模块顺手清掉解锁态，避免内存里留着无效项
    open_set(&state).retain(|m| next.contains(m));
    Ok(state_of(&state))
}

#[tauri::command]
pub fn guard_unlock(state: State<AppState>, module: String, password: String) -> AppResult<GuardState> {
    if !GUARD_MODULES.contains(&module.as_str()) {
        return Err(AppError::validation("未知模块。"));
    }
    let cfg = guard_cfg(&state).ok_or_else(|| AppError::validation("还没有设置模块锁口令。"))?;
    if !cfg.modules.contains(&module) {
        return Ok(state_of(&state));
    }
    verify(&state, &password)?;
    open_set(&state).insert(module);
    Ok(state_of(&state))
}

/// 上锁：给 module 就锁单个，不给就全部上锁。
#[tauri::command]
pub fn guard_lock(state: State<AppState>, module: Option<String>) -> GuardState {
    let mut open = open_set(&state);
    match module {
        Some(name) => {
            open.remove(&name);
        }
        None => open.clear(),
    }
    drop(open);
    state_of(&state)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_keeps_only_known_modules_in_order() {
        assert_eq!(sanitize_modules(["note", "keys"]), vec!["keys", "note"]);
        assert_eq!(sanitize_modules(["keys", "keys", "settings", "ai"]), vec!["keys"]);
        assert!(sanitize_modules(Vec::<String>::new()).is_empty());
        assert_eq!(sanitize_modules([""]), Vec::<String>::new(), "空串丢弃");
    }

    #[test]
    fn check_hex_is_stable_and_key_dependent() {
        let a = vault::derive_key("口令abcd", b"0123456789abcdef").unwrap();
        let b = vault::derive_key("口令abce", b"0123456789abcdef").unwrap();
        assert_eq!(check_hex(&a), check_hex(&a), "同口令同盐 → 校验值稳定");
        assert_ne!(check_hex(&a), check_hex(&b), "不同口令 → 校验值不同");
        assert_ne!(check_hex(&a), check_hex(&a).to_lowercase(), "base64 大小写敏感，不会退化成小写比对");
    }
}
