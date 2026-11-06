// 命令层·基础：全局状态、数据目录、设置.json、四个纯文档（待办/导航/速记/密钥）的 CAS 读写。
pub mod apps;
pub mod assets;
pub mod desktop;
pub mod dock;

use crate::error::{AppError, AppResult};
use crate::store::{self, nav::NavDoc, read_doc, write_doc};
use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::State;

pub struct AppState {
    /// 数据根目录（迁移后会变，用锁保护；读取一律走 root()/file() 等方法）
    pub root: Mutex<PathBuf>,
    pub vault_key: Mutex<Option<[u8; 32]>>,
    /// AI 写入的撤销快照（内存，保留最近 80 条）
    pub ai_undo: crate::ai::tools::UndoMap,
}

impl AppState {
    pub fn root(&self) -> PathBuf {
        self.root.lock().map(|r| r.clone()).unwrap_or_default()
    }
    pub fn file(&self, name: &str) -> PathBuf {
        self.root().join(name)
    }
    pub fn ai_dir(&self) -> PathBuf {
        self.root().join("AI")
    }
    pub fn keys_dir(&self) -> PathBuf {
        self.root().join("密钥")
    }
}

/// 数据目录解析：环境变量 PWB_DATA_DIR（开发期指向测试数据）> 用户自定义路径
/// （设置里改过数据目录时记录在 <app-data>/data-path.txt，文件本身固定不动）> 应用数据目录 <app-data>/data。
pub fn resolve_root(app_data_dir: PathBuf) -> PathBuf {
    if let Ok(dir) = std::env::var("PWB_DATA_DIR") {
        if !dir.trim().is_empty() {
            return PathBuf::from(dir);
        }
    }
    let marker = app_data_dir.join("data-path.txt");
    if let Ok(txt) = fs::read_to_string(&marker) {
        let p = txt.trim();
        if !p.is_empty() && PathBuf::from(p).is_dir() {
            return PathBuf::from(p);
        }
    }
    app_data_dir.join("data")
}

pub fn ensure_layout(root: &PathBuf) {
    for dir in ["cache/icons", "cache/appicons", "tokens", "密钥", "对话"] {
        let _ = fs::create_dir_all(root.join(dir));
    }
    for name in ["待办.md", "导航.md", "资产.md", "凭据.md", "速记.md"] {
        let path = root.join(name);
        if !path.exists() {
            let _ = write_doc(&path, &format!("# {}\n", name.trim_end_matches(".md")));
        }
    }
}

/* ---------- 设置.json ---------- */

pub fn read_settings(state: &AppState) -> Value {
    match fs::read_to_string(state.file("设置.json")) {
        Ok(text) => serde_json::from_str(&text).ok().filter(Value::is_object).unwrap_or(Value::Object(Default::default())),
        Err(_) => Value::Object(Default::default()),
    }
}

pub fn write_settings(state: &AppState, value: &Value) -> AppResult<()> {
    write_doc(&state.file("设置.json"), &format!("{}\n", serde_json::to_string_pretty(value).unwrap_or_default()))?;
    Ok(())
}

/* ---------- CAS 校验助手：baseHash 过期则返回 conflict（附最新内容） ---------- */

pub fn check_cas(path: &PathBuf, base_hash: &Option<String>) -> AppResult<()> {
    let Some(expected) = base_hash else { return Ok(()) };
    if expected.is_empty() {
        return Ok(());
    }
    if let Some(doc) = read_doc(path)? {
        if doc.hash != *expected {
            return Err(AppError::conflict("文件已被外部修改（如 Obsidian），已附最新内容，请基于最新内容重试。", &doc.text, &doc.hash));
        }
    }
    Ok(())
}

/* ---------- 待办 ---------- */

#[derive(Serialize)]
pub struct TextDoc {
    pub text: String,
    pub hash: String,
    pub path: String,
}

fn read_text_doc(path: &PathBuf, empty: &str) -> AppResult<TextDoc> {
    match read_doc(path)? {
        Some(doc) => Ok(TextDoc { text: doc.text, hash: doc.hash, path: path.to_string_lossy().into_owned() }),
        None => Ok(TextDoc { text: empty.to_string(), hash: store::sha256_hex(empty), path: path.to_string_lossy().into_owned() }),
    }
}

#[tauri::command]
pub fn todo_get(state: State<AppState>) -> AppResult<TextDoc> {
    read_text_doc(&state.file("待办.md"), "# 待办\n")
}

#[tauri::command]
pub fn todo_put(state: State<AppState>, text: String, base_hash: Option<String>) -> AppResult<String> {
    if text.len() > 512 * 1024 {
        return Err(AppError::new("validation", "待办内容超过 512 KiB 上限。"));
    }
    check_cas(&state.file("待办.md"), &base_hash)?;
    write_doc(&state.file("待办.md"), &text)
}

/* ---------- 导航 ---------- */

#[derive(Serialize)]
pub struct NavPayload {
    pub nav: NavDoc,
    pub hash: String,
}

#[tauri::command]
pub fn nav_get(state: State<AppState>) -> AppResult<NavPayload> {
    let doc = read_doc(&state.file("导航.md"))?;
    let text = doc.as_ref().map(|d| d.text.as_str()).unwrap_or("# 导航\n");
    Ok(NavPayload { nav: store::nav::parse_nav(text), hash: doc.as_ref().map(|d| d.hash.clone()).unwrap_or_else(|| store::sha256_hex(text)) })
}

#[tauri::command]
pub fn nav_put(state: State<AppState>, nav: NavDoc, base_hash: Option<String>) -> AppResult<String> {
    let path = state.file("导航.md");
    if let Some(expected) = base_hash.filter(|h| !h.is_empty()) {
        if let Some(doc) = read_doc(&path)? {
            if doc.hash != expected {
                let current_nav = store::nav::parse_nav(&doc.text);
                return Err(AppError::conflict("导航文件已被外部修改（如 Obsidian），已附最新内容，请基于最新内容重试。", &doc.text, &doc.hash)
                    .with("currentNav", &current_nav));
            }
        }
    }
    let text = store::nav::serialize_nav(&nav);
    write_doc(&path, &text)
}

/* ---------- 速记 ---------- */

#[tauri::command]
pub fn note_get(state: State<AppState>) -> AppResult<TextDoc> {
    read_text_doc(&state.file("速记.md"), "")
}

#[tauri::command]
pub fn note_put(state: State<AppState>, text: String, base_hash: Option<String>) -> AppResult<String> {
    if text.len() > 1024 * 1024 {
        return Err(AppError::new("validation", "速记内容超过 1 MiB 上限。"));
    }
    check_cas(&state.file("速记.md"), &base_hash)?;
    write_doc(&state.file("速记.md"), &text)
}

/* ---------- 密钥文档（.md / .txt） ---------- */

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyDocInfo {
    pub name: String,
    pub ext: String,
    pub text: String,
    pub hash: String,
    pub chars: usize,
    pub mtime_ms: u64,
}

#[tauri::command]
pub fn keysdocs_list(state: State<AppState>) -> AppResult<Vec<KeyDocInfo>> {
    let mut docs = Vec::new();
    let entries = fs::read_dir(state.keys_dir()).map_err(|e| AppError::new("io", format!("读取密钥目录失败：{e}")))?;
    for entry in entries.flatten() {
        let file_name = entry.file_name().to_string_lossy().into_owned();
        let lower = file_name.to_lowercase();
        let ext = if lower.ends_with(".md") { "md" } else if lower.ends_with(".txt") { "txt" } else { continue };
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Ok(text) = fs::read_to_string(&path) else { continue };
        let mtime_ms = entry
            .metadata()
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        let name_len = file_name.len() - ext.len() - 1;
        docs.push(KeyDocInfo {
            name: file_name[..name_len].to_string(),
            ext: ext.to_string(),
            chars: text.chars().count(),
            hash: store::sha256_hex(&text),
            mtime_ms,
            text,
        });
    }
    docs.sort_by(|a, b| (a.name.clone() + &a.ext).cmp(&(b.name.clone() + &b.ext)));
    Ok(docs)
}

/// 路径段清洗：拒绝路径穿越与 Windows 非法/保留名，保留中文（对齐 pwb-lite cleanPathSeg）。
pub fn clean_path_seg(raw: &str, label: &str) -> AppResult<String> {
    let mut value = String::with_capacity(raw.len());
    for ch in raw.chars() {
        let illegal = matches!(ch, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|') || (ch as u32) <= 0x1f;
        value.push(if illegal { '_' } else { ch });
    }
    let trimmed = value.trim_start_matches('.').trim();
    if trimmed.is_empty() || trimmed.contains("..") {
        return Err(AppError::validation(format!("{label}含非法字符（不允许路径穿越片段）。")));
    }
    const RESERVED: [&str; 10] = ["con", "prn", "aux", "nul", "com1", "com2", "com3", "com4", "lpt1", "lpt2"];
    // 对齐 JS 的 /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/iu
    let lower = trimmed.to_lowercase();
    let base = lower.split('.').next().unwrap_or("");
    if RESERVED.contains(&base) {
        return Err(AppError::validation(format!("{label}是 Windows 保留名，请改名。")));
    }
    Ok(trimmed.chars().take(120).collect())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyDocMeta {
    pub name: String,
    pub ext: String,
    pub chars: usize,
    pub mtime_ms: u64,
}

/// 密钥文档元信息（不含正文）：桌面卡片/列表场景用，内容不进卡片窗口的 webview
#[tauri::command]
pub fn keysdocs_meta(state: State<AppState>) -> AppResult<Vec<KeyDocMeta>> {
    let mut out: Vec<KeyDocMeta> = Vec::new();
    let entries = fs::read_dir(state.keys_dir()).map_err(|e| AppError::new("io", format!("读取密钥目录失败：{e}")))?;
    for entry in entries.flatten() {
        let file_name = entry.file_name().to_string_lossy().into_owned();
        let lower = file_name.to_lowercase();
        let ext = if lower.ends_with(".md") { "md" } else if lower.ends_with(".txt") { "txt" } else { continue };
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let chars = fs::read_to_string(&path).map(|t| t.chars().count()).unwrap_or(0);
        let mtime_ms = entry
            .metadata()
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        out.push(KeyDocMeta {
            name: file_name[..file_name.len() - ext.len() - 1].to_string(),
            ext: ext.to_string(),
            chars,
            mtime_ms,
        });
    }
    out.sort_by(|a, b| b.mtime_ms.cmp(&a.mtime_ms));
    Ok(out)
}

#[tauri::command]
pub fn keysdoc_put(state: State<AppState>, name: String, ext: Option<String>, text: String, base_hash: Option<String>) -> AppResult<String> {
    let name = clean_path_seg(&name, "文档名")?;
    let ext = if ext.as_deref() == Some("txt") { "txt" } else { "md" };
    if text.len() > 1024 * 1024 {
        return Err(AppError::new("validation", "文档超过 1 MiB 上限。"));
    }
    let file = state.keys_dir().join(format!("{name}.{ext}"));
    check_cas(&file, &base_hash)?;
    fs::create_dir_all(state.keys_dir())?;
    write_doc(&file, &text)
}

#[tauri::command]
pub fn keysdoc_delete(state: State<AppState>, name: String, ext: Option<String>) -> AppResult<()> {
    let name = clean_path_seg(&name, "文档名")?;
    let ext = if ext.as_deref() == Some("txt") { "txt" } else { "md" };
    let file = state.keys_dir().join(format!("{name}.{ext}"));
    if !file.exists() {
        return Err(AppError::not_found("文档不存在。"));
    }
    fs::remove_file(&file).map_err(|e| AppError::new("io", format!("删除失败：{e}")))
}

/* ---------- 元信息 ---------- */

#[derive(Serialize)]
pub struct AppInfo {
    pub version: &'static str,
    pub root: String,
}

#[tauri::command]
pub fn app_info(state: State<AppState>) -> AppInfo {
    AppInfo { version: env!("CARGO_PKG_VERSION"), root: state.root().to_string_lossy().into_owned() }
}

/* ---------- 数据目录：查看与迁移 ---------- */

/// 查询当前数据目录与迁移历史备份（供设置页展示）。
#[derive(Serialize)]
pub struct DataPathInfo {
    pub root: String,
    pub custom: bool,
}

#[tauri::command]
pub fn data_path_get(app: tauri::AppHandle, state: State<AppState>) -> AppResult<DataPathInfo> {
    use tauri::Manager;
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::new("internal", format!("无法定位应用数据目录：{e}")))?;
    let custom = app_data.join("data-path.txt").exists();
    Ok(DataPathInfo { root: state.root().to_string_lossy().into_owned(), custom })
}

/// 更改数据目录并迁移现有数据（命令层：取路径 → 调核心 → 热切换运行时 root）。
#[tauri::command]
pub fn data_path_set(app: tauri::AppHandle, state: State<AppState>, new_path: String) -> AppResult<String> {
    use tauri::Manager;
    if let Ok(dir) = std::env::var("PWB_DATA_DIR") {
        if !dir.trim().is_empty() {
            return Err(AppError::validation("开发模式（PWB_DATA_DIR）下不允许迁移数据目录。"));
        }
    }
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::new("internal", format!("无法定位应用数据目录：{e}")))?;
    let new_root = PathBuf::from(new_path.trim());
    migrate_data_root(&state.root(), &new_root, &app_data.join("data-path.txt"), &app_data)?;
    // 热切换运行时 root（迁移已成功落盘）
    if let Ok(mut r) = state.root.lock() {
        *r = new_root.clone();
    }
    Ok(new_root.to_string_lossy().into_owned())
}

/// 数据目录迁移核心（纯文件系统操作，便于测试）：
/// 校验 → 完整拷贝到新位置 → 更新 data-path.txt（迁回默认位置时删除标记）→
/// 旧目录改名 data-backup-<时间戳>（保留，不删）。任何一步失败都不动原数据。
fn migrate_data_root(old_root: &Path, new_root: &Path, marker: &Path, backup_parent: &Path) -> AppResult<()> {
    if new_root.as_os_str().is_empty() {
        return Err(AppError::validation("路径不能为空。"));
    }
    if !new_root.is_absolute() {
        return Err(AppError::validation("请选择绝对路径（从文件夹选择器里选）。"));
    }
    let (Ok(n), Ok(o)) = (std::path::absolute(new_root), std::path::absolute(old_root)) else {
        return Err(AppError::validation("无法解析路径。"));
    };
    if n == o {
        return Err(AppError::validation("新目录与当前数据目录相同。"));
    }
    if n.starts_with(&o) || o.starts_with(&n) {
        return Err(AppError::validation("新旧目录不能互相包含。"));
    }
    // 目标已存在且非空 → 拒绝（避免混入/覆盖无关文件）
    if new_root.exists() {
        if !new_root.is_dir() {
            return Err(AppError::validation("目标不是文件夹。"));
        }
        let non_empty = fs::read_dir(new_root).map(|mut it| it.next().is_some()).unwrap_or(false);
        if non_empty {
            return Err(AppError::validation("目标文件夹不是空的，请换一个空目录。"));
        }
    } else if let Some(parent) = new_root.parent() {
        if !parent.is_dir() {
            return Err(AppError::validation("目标的上层目录不存在。"));
        }
        fs::create_dir_all(new_root)?;
    }
    // 1) 完整拷贝（失败则清理本次拷入内容，原目录不动）
    if let Err(e) = copy_dir_all(old_root, new_root) {
        let _ = fs::remove_dir_all(new_root);
        return Err(AppError::new("io", format!("拷贝数据失败（原目录未动）：{e}")));
    }
    // 2) 更新标记（迁回默认位置时删除标记，回落到默认解析）
    let default_root = backup_parent.join("data");
    if std::path::absolute(new_root).ok().as_deref() == std::path::absolute(&default_root).ok().as_deref() {
        let _ = fs::remove_file(marker);
    } else if let Err(e) = fs::write(marker, new_root.to_string_lossy().as_bytes()) {
        let _ = fs::remove_dir_all(new_root);
        return Err(AppError::new("io", format!("记录新路径失败（原目录未动）：{e}")));
    }
    // 3) 旧目录整体改名备份（保留可回退，不删除）；备份名放在应用数据目录下
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let backup = backup_parent.join(format!("data-backup-{}", stamp));
    if backup.exists() {
        let _ = fs::remove_dir_all(&backup);
    }
    if let Err(e) = fs::rename(old_root, &backup) {
        // rename 失败（如旧目录被占用）：数据已拷全——撤销标记，让下次仍用旧目录
        let _ = fs::remove_file(marker);
        let _ = fs::remove_dir_all(new_root);
        return Err(AppError::new("io", format!("备份旧目录失败（数据仍在原目录）：{e}")));
    }
    Ok(())
}

fn copy_dir_all(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let to = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_all(&entry.path(), &to)?;
        } else {
            fs::copy(entry.path(), &to)?;
        }
    }
    Ok(())
}

/* ---------- 壁纸导入 ---------- */

/// 用系统默认浏览器打开链接。
/// 只放行 http/https，拒绝控制字符与空白：避免被当成协议处理器（file:/ms-*: 等）
/// 或命令行参数滥用；子进程走参数数组，不经过 shell。
#[tauri::command]
pub fn open_external(url: String) -> AppResult<()> {
    let u = url.trim();
    if u.is_empty() || u.len() > 2048 {
        return Err(AppError::validation("链接长度不合法。"));
    }
    let lower = u.to_ascii_lowercase();
    if !(lower.starts_with("http://") || lower.starts_with("https://")) {
        return Err(AppError::validation("只允许打开 http/https 链接。"));
    }
    if u.chars().any(|c| c.is_control() || c.is_whitespace()) {
        return Err(AppError::validation("链接包含非法字符。"));
    }
    #[cfg(windows)]
    let program = "explorer.exe";
    #[cfg(target_os = "macos")]
    let program = "open";
    #[cfg(all(unix, not(target_os = "macos")))]
    let program = "xdg-open";
    let mut cmd = std::process::Command::new(program);
    cmd.arg(u)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let child = cmd
        .spawn()
        .map_err(|e| AppError::new("io", format!("打开链接失败：{e}")))?;
    std::mem::drop(child);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 数据目录迁移：正常迁移 / 校验拒绝 / 迁回默认位置
    #[test]
    fn migrate_data_root_moves_files_and_keeps_backup() {
        let base = std::env::temp_dir().join(format!("pwb-mig-{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        let app_data = base.join("appdata");
        let old_root = app_data.join("data");
        fs::create_dir_all(old_root.join("AI")).unwrap();
        fs::write(old_root.join("待办.md"), "- [x] 事项").unwrap();
        fs::write(old_root.join("AI").join("会话.jsonl"), "{}").unwrap();
        let marker = app_data.join("data-path.txt");
        let new_root = base.join("newdata");

        // 正常迁移：数据完整、标记指向新目录、旧目录整体变备份
        migrate_data_root(&old_root, &new_root, &marker, &app_data).unwrap();
        assert!(new_root.join("待办.md").exists());
        assert!(new_root.join("AI").join("会话.jsonl").exists());
        assert!(!old_root.exists(), "旧目录应已改名");
        assert_eq!(fs::read_to_string(&marker).unwrap(), new_root.to_string_lossy());
        assert!(fs::read_dir(&app_data).unwrap().any(|e| e.unwrap().file_name().to_string_lossy().starts_with("data-backup-")));

        // 迁回默认位置：标记删除，回落默认解析
        let default_root = app_data.join("data");
        migrate_data_root(&new_root, &default_root, &marker, &app_data).unwrap();
        assert!(default_root.join("待办.md").exists(), "数据迁回默认位置");
        assert!(!marker.exists(), "迁回默认位置后标记应删除");
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn migrate_data_root_rejects_bad_targets() {
        let base = std::env::temp_dir().join(format!("pwb-mig2-{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        let app_data = base.join("appdata");
        let old_root = app_data.join("data");
        fs::create_dir_all(&old_root).unwrap();
        fs::write(old_root.join("待办.md"), "x").unwrap();
        let marker = app_data.join("data-path.txt");

        // 相同目录
        assert!(migrate_data_root(&old_root, &old_root, &marker, &app_data).is_err());
        // 互相包含
        let inside = old_root.join("sub");
        assert!(migrate_data_root(&old_root, &inside, &marker, &app_data).is_err());
        // 目标非空
        let non_empty = base.join("occupied");
        fs::create_dir_all(&non_empty).unwrap();
        fs::write(non_empty.join("别的文件.txt"), "x").unwrap();
        assert!(migrate_data_root(&old_root, &non_empty, &marker, &app_data).is_err());
        // 相对路径
        assert!(migrate_data_root(&old_root, Path::new("relative/dir"), &marker, &app_data).is_err());
        // 全部拒绝后：原目录原样、无标记、无备份
        assert!(old_root.join("待办.md").exists());
        assert!(!marker.exists());
        assert!(!fs::read_dir(&app_data).unwrap().any(|e| e.unwrap().file_name().to_string_lossy().starts_with("data-backup-")));
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn clean_path_seg_matches_js_rules() {
        assert_eq!(clean_path_seg("云端API", "文档名").unwrap(), "云端API");
        assert_eq!(clean_path_seg("a/b\\c:d", "x").unwrap(), "a_b_c_d");
        assert!(clean_path_seg("..", "x").is_err());
        assert!(clean_path_seg("   ", "x").is_err());
        assert!(clean_path_seg(".hidden", "x").is_err() || clean_path_seg(".hidden", "x").unwrap() == "hidden");
        assert!(clean_path_seg("CON", "x").is_err(), "保留名拒绝");
        assert!(clean_path_seg("com3.txt", "x").is_err());
        assert!(clean_path_seg("commerce", "x").is_ok(), "com 开头但非保留名放行");
    }
}

/* ---------- 独立功能窗口：从卡片/Dock 打开某个板块时用，不唤起工作台主窗口 ---------- */

#[allow(clippy::too_many_lines)]

const PANE_APPS: [&str; 8] = ["apps", "todo", "nav", "note", "keys", "assets", "settings", "ai"];

#[tauri::command]
pub async fn pane_open(
    app: tauri::AppHandle,
    id: String,
    width: f64,
    height: f64,
    prompt: Option<String>,
    tab: Option<String>,
) -> AppResult<()> {
    use tauri::Manager;
    if !PANE_APPS.contains(&id.as_str()) {
        return Err(AppError::validation(format!("未知功能：{id}")));
    }
    let w = width.clamp(420.0, 1600.0);
    let h = height.clamp(320.0, 1200.0);
    let label = format!("pane-{id}");
    if let Some(win) = app.get_webview_window(&label) {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
        return Ok(());
    }
    let v = now_ms_v();
    // prompt 是 AI 面板的预填问题（URL 编码由前端完成）；tab 是设置面板的初始标签
    let q = prompt.filter(|p| !p.is_empty()).map(|p| format!("&q={p}")).unwrap_or_default();
    let t = tab.filter(|s| !s.is_empty()).map(|s| format!("&tab={s}")).unwrap_or_default();
    let url = format!("index.html?win=pane&app={id}&v={v}{q}{t}");
    let monitor = app
        .primary_monitor()
        .map_err(|e| AppError::new("internal", format!("读取显示器失败：{e}")))?
        .ok_or_else(|| AppError::new("internal", "未检测到显示器"))?;
    let area = monitor.work_area();
    let ms = monitor.scale_factor();
    let x = area.position.x as f64 / ms + (area.size.width as f64 / ms - w) / 2.0;
    let y = area.position.y as f64 / ms + (area.size.height as f64 / ms - h) / 2.0;
    let win = tauri::WebviewWindowBuilder::new(&app, &label, tauri::WebviewUrl::App(url.into()))
        .title(format!("Worktop · {id}"))
        .inner_size(w, h)
        .position(x, y)
        .min_inner_size(480.0, 360.0)
        .decorations(false)
        .transparent(true)
        .shadow(true)
        .resizable(true)
        .skip_taskbar(false)
        .focused(true)
        .visible(false)
        .background_color(tauri::window::Color(0, 0, 0, 0))
        .build()
        .map_err(|e| AppError::new("internal", format!("创建功能窗口失败：{e}")))?;
    let _ = win.show();
    let _ = win.set_focus();
    Ok(())
}

fn now_ms_v() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

/// 关闭功能窗口：不依赖窗口能力（前端 win.close() 被拒时的兜底）
#[tauri::command]
pub fn pane_close(app: tauri::AppHandle, id: String) -> AppResult<()> {
    use tauri::Manager;
    if let Some(win) = app.get_webview_window(&format!("pane-{id}")) {
        let _ = win.close();
    }
    Ok(())
}

/* ---------- 全局光标位置（Dock 隐藏态探测边缘热区用） ---------- */

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CursorPos {
    pub x: i32,
    pub y: i32,
}

#[cfg(windows)]
mod cursor_win {
    #[repr(C)]
    pub struct Point {
        pub x: i32,
        pub y: i32,
    }
    #[link(name = "user32")]
    extern "system" {
        pub fn GetCursorPos(p: *mut Point) -> i32;
    }
}

/// 全局光标（物理像素）。非 Windows 返回 None，前端退回 hover 探测。
#[tauri::command]
pub fn cursor_pos() -> Option<CursorPos> {
    #[cfg(windows)]
    {
        let mut p = cursor_win::Point { x: 0, y: 0 };
        if unsafe { cursor_win::GetCursorPos(&mut p) } != 0 {
            return Some(CursorPos { x: p.x, y: p.y });
        }
        None
    }
    #[cfg(not(windows))]
    {
        None
    }
}

/* ---------- Windows 任务栏（Dock 替代任务栏时隐藏；可逆） ---------- */
//
// 只改运行时窗口状态：不写注册表、不改系统设置。应用退出/资源管理器重启/重启电脑都会恢复。
// 隐藏后托盘图标也会一起不可见，因此托盘和 Dock 右键菜单都提供「恢复任务栏」。

#[cfg(windows)]
mod tray_win {
    #[repr(C)]
    pub struct Rect {
        pub left: i32,
        pub top: i32,
        pub right: i32,
        pub bottom: i32,
    }
    #[link(name = "user32")]
    extern "system" {
        pub fn FindWindowW(class: *const u16, title: *const u16) -> isize;
        pub fn ShowWindow(hwnd: isize, cmd: i32) -> i32;
        pub fn IsWindowVisible(hwnd: isize) -> i32;
        pub fn EnumWindows(cb: Option<extern "system" fn(isize, isize) -> i32>, lparam: isize) -> i32;
        pub fn GetClassNameW(hwnd: isize, buf: *mut u16, max: i32) -> i32;
    }
}

#[cfg(windows)]
fn wide(s: &str) -> Vec<u16> {
    use std::os::windows::ffi::OsStrExt;
    std::ffi::OsStr::new(s).encode_wide().chain(Some(0)).collect()
}

#[cfg(windows)]
fn class_of(hwnd: isize) -> String {
    let mut buf = [0u16; 128];
    let n = unsafe { tray_win::GetClassNameW(hwnd, buf.as_mut_ptr(), buf.len() as i32) };
    if n <= 0 {
        return String::new();
    }
    String::from_utf16_lossy(&buf[..n as usize])
}

/// 只取主屏任务栏（Shell_TrayWnd）。
/// 副屏的 Shell_SecondaryTrayWnd **故意不动**：隐藏后副屏那条位置会变成"死区"——
/// 鼠标移过去既没有任务栏可点、也没有窗口接管，表现为副屏鼠标失灵。
#[cfg(windows)]
fn taskbar_handles() -> Vec<isize> {
    let h = unsafe { tray_win::FindWindowW(wide("Shell_TrayWnd").as_ptr(), std::ptr::null()) };
    if h == 0 { Vec::new() } else { vec![h] }
}

#[cfg(windows)]
fn set_taskbar(hide: bool) -> bool {
    const SW_HIDE: i32 = 0;
    const SW_SHOW: i32 = 5;
    let targets = taskbar_handles();
    if targets.is_empty() {
        return false;
    }
    for hwnd in targets {
        unsafe {
            tray_win::ShowWindow(hwnd, if hide { SW_HIDE } else { SW_SHOW });
        }
    }
    true
}

/// 隐藏 Windows 任务栏；返回是否成功（失败时前端退回「放在任务栏上方」）
#[tauri::command]
pub fn taskbar_hide() -> bool {
    #[cfg(windows)]
    {
        set_taskbar(true)
    }
    #[cfg(not(windows))]
    {
        false
    }
}

/// 恢复 Windows 任务栏
#[tauri::command]
pub fn taskbar_show() -> bool {
    #[cfg(windows)]
    {
        set_taskbar(false)
    }
    #[cfg(not(windows))]
    {
        false
    }
}

/// 当前任务栏是否可见（用于资源管理器重启后重新隐藏）
#[tauri::command]
pub fn taskbar_visible() -> bool {
    #[cfg(windows)]
    {
        let list = taskbar_handles();
        if list.is_empty() {
            return true;
        }
        list.iter().any(|h| unsafe { tray_win::IsWindowVisible(*h) } != 0)
    }
    #[cfg(not(windows))]
    {
        true
    }
}

/// 退出前恢复（供 main 的 RunEvent::Exit 调用，避免用户丢失任务栏）
pub fn restore_taskbar_on_exit() {
    #[cfg(windows)]
    {
        let _ = set_taskbar(false);
    }
}

/// 退出应用（任务栏被隐藏时托盘也看不到，Dock 菜单需要一个退出入口）
#[tauri::command]
pub fn app_quit(app: tauri::AppHandle) -> AppResult<()> {
    restore_taskbar_on_exit();
    app.exit(0);
    Ok(())
}

/* ---------- 区域截图并复制到剪贴板 ---------- */
//
// 用随包的 PowerShell + WinForms 覆盖层实现（本机未安装 Windows「截图工具」，
// ms-screenclip: 只有空的协议注册）。零新依赖：不引入截图/剪贴板 crate。
// 脚本只做：截全屏 → 拖选矩形 → 裁剪 → Clipboard.SetImage，Esc 取消，点一下=<3px 视为取消。

#[tauri::command]
pub fn snip_region(app: tauri::AppHandle) -> AppResult<()> {
    snip_region_inner(&app)
}

fn snip_region_inner(app: &tauri::AppHandle) -> AppResult<()> {
    use tauri::Manager;
    #[cfg(windows)]
    {
        // 优先用安装目录里的脚本，开发态退回源码目录
        let resource = app.path().resource_dir().ok().map(|d| d.join("snip").join("snip.ps1"));
        let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("snip").join("snip.ps1");
        let script = resource.filter(|p| p.is_file()).unwrap_or(dev);
        if !script.is_file() {
            return Err(AppError::not_found("找不到截图脚本（snip/snip.ps1）。"));
        }
        let mut cmd = std::process::Command::new("powershell.exe");
        cmd.args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File"])
            .arg(&script)
            .args(["-DelayMs", "260"])
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null());
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }
        cmd.spawn()
            .map_err(|e| AppError::new("io", format!("启动截图失败：{e}")))?;
        return Ok(());
    }
    #[cfg(not(windows))]
    {
        let _ = app;
        Err(AppError::validation("区域截图目前只支持 Windows。"))
    }
}

/* ---------- 统一截图入口（全局 Ctrl+A / 桌宠菜单 / Dock 右键共用） ---------- */
//
// 优先接 AirSnip（github.com/bd-dxg/airsnip，GPL-3.0 的独立截图标注工具，Rust 单文件 1.2MB）：
// 以外部程序协作——检测已安装的 AirSnip → 不在跑就拉起（常驻托盘）→ 转发其截图热键 F1。
// GPL 独立进程不并入本仓库代码，MIT 边界不受影响；未安装则回落自带的 PowerShell 拖选截图。

#[tauri::command]
pub fn snip_capture(app: tauri::AppHandle) -> AppResult<String> {
    #[cfg(windows)]
    {
        if find_airsnip(&app).is_some() {
            if !ensure_airsnip_started(&app) {
                return Err(AppError::new("io", "AirSnip 拉起失败"));
            }
            send_f1();
            return Ok("airsnip".into());
        }
        snip_region_inner(&app)?;
        return Ok("builtin".into());
    }
    #[cfg(not(windows))]
    {
        let _ = app;
        Err(AppError::validation("截图目前只支持 Windows。"))
    }
}

/// 随应用启动调用：静默拉起 AirSnip 常驻托盘（不转发热键、不弹截图），
/// 之后用户按 F1 即截图；snip_capture 也复用本函数保证在跑。
#[tauri::command]
pub fn snip_ensure(app: tauri::AppHandle) -> AppResult<bool> {
    #[cfg(windows)]
    {
        let _ = &app;
        Ok(ensure_airsnip_started(&app))
    }
    #[cfg(not(windows))]
    {
        let _ = app;
        Ok(false)
    }
}

/// 确保 AirSnip 在跑：未运行则 spawn（常驻托盘）。返回是否在运行。
#[cfg(windows)]
pub fn ensure_airsnip_started(app: &tauri::AppHandle) -> bool {
    let Some(exe) = find_airsnip(app) else { return false };
    if process_running("airsnip.exe") {
        return true;
    }
    let mut cmd = std::process::Command::new(&exe);
    cmd.stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    match cmd.spawn() {
        Ok(_) => {}
        Err(e) if e.raw_os_error() == Some(740) => {
            // AirSnip 带 UAC 提权要求：CreateProcess 报 740，经 explorer 转发走 ShellExecute
            let fwd = std::process::Command::new("explorer.exe").arg(&exe).spawn();
            if fwd.is_err() {
                eprintln!("[ensure_airsnip] explorer fallback failed: {fwd:?}");
                return false;
            }
        }
        Err(e) => {
            eprintln!("[ensure_airsnip] spawn failed: {e} (os={:?})", e.raw_os_error());
            return false;
        }
    }
    // 首次拉起需要注册热键并预热覆盖层
    std::thread::sleep(std::time::Duration::from_millis(1200));
    true
}

/// 找 AirSnip 可执行文件：安装目录随包副本 > 环境变量 AIRSNIP_EXE > PATH > 常见安装位置。
/// （src-tauri/sidecar/airsnip/AirSnip.exe 由 `npm run airsnip:fetch` 拉取、随安装包分发；
/// GPL-3.0 独立程序，聚合分发不改变本项目 MIT 许可，分发时保留上游源码地址。）
#[cfg(windows)]
fn find_airsnip(app: &tauri::AppHandle) -> Option<PathBuf> {
    use tauri::Manager;
    // 1. 安装目录里的随包副本（合并安装：开箱即用完整截图体验）
    if let Ok(dir) = app.path().resource_dir() {
        let p = dir.join("airsnip").join("AirSnip.exe");
        if p.is_file() {
            return Some(p);
        }
    }
    // 开发态：resource_dir 不含 bundle 资源，直接用源码 sidecar 目录（编译期路径）
    let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("sidecar").join("airsnip").join("AirSnip.exe");
    if dev.is_file() {
        return Some(dev);
    }
    if let Ok(p) = std::env::var("AIRSNIP_EXE") {
        let p = PathBuf::from(p.trim());
        if p.is_file() {
            return Some(p);
        }
    }
    let names = ["AirSnip.exe", "airsnip.exe"];
    if let Ok(path) = std::env::var("PATH") {
        for dir in path.split(';').filter(|s| !s.is_empty()) {
            for n in names {
                let p = Path::new(dir).join(n);
                if p.is_file() {
                    return Some(p);
                }
            }
        }
    }
    let roots = [
        std::env::var("LOCALAPPDATA").ok().map(|d| PathBuf::from(d).join(r"Programs\AirSnip")),
        std::env::var("LOCALAPPDATA").ok().map(|d| PathBuf::from(d).join("AirSnip")),
        std::env::var("ProgramFiles").ok().map(|d| PathBuf::from(d).join("AirSnip")),
        std::env::var("ProgramFiles(x86)").ok().map(|d| PathBuf::from(d).join("AirSnip")),
        Some(PathBuf::from(r"D:\Program Files\AirSnip")),
        Some(PathBuf::from(r"D:\app\AirSnip")),
    ];
    for base in roots.into_iter().flatten() {
        for n in names {
            let p = base.join(n);
            if p.is_file() {
                return Some(p);
            }
        }
    }
    None
}

/// 判断进程名（小写，含 .exe）是否在运行。tasklist 一次 ~80ms，触发频率低，可接受。
#[cfg(windows)]
fn process_running(image_lc: &str) -> bool {
    let out = std::process::Command::new("tasklist.exe")
        .args(["/FI", &format!("IMAGENAME eq {image_lc}"), "/FO", "CSV", "/NH"])
        .output();
    let Ok(out) = out else { return false };
    String::from_utf8_lossy(&out.stdout).to_lowercase().contains(image_lc)
}

/// 转发 AirSnip 的默认截图热键 F1（它的全局热键钩子会接住，无论前台是谁）。
#[cfg(windows)]
fn send_f1() {
    #[link(name = "user32")]
    extern "system" {
        fn keybd_event(vk: u8, scan: u8, flags: u32, extra: usize) -> i32;
    }
    const VK_F1: u8 = 0x70;
    const KEYUP: u32 = 0x0002;
    unsafe {
        keybd_event(VK_F1, 0, 0, 0);
        keybd_event(VK_F1, 0, KEYUP, 0);
    }
}
