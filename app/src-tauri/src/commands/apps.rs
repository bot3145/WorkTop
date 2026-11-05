// 应用启动器：用户指定一个装满快捷方式的文件夹，列出全部 .lnk/.url/.exe 一键启动。
// 偏好（目录 + 置顶）存 设置.json#apps，与 pwb-lite 的字段保持一致，数据可互换。
use super::dock::extract_icons_batch;
use super::{read_settings, write_settings, AppState};
use crate::error::{AppError, AppResult};
use crate::store::sha256_hex;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;
use tauri::State;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppEntry {
    pub file: String,
    pub name: String,
    pub ext: String,
    #[serde(default)]
    pub icon: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppsPayload {
    pub dir: Option<String>,
    pub dir_exists: bool,
    pub apps: Vec<AppEntry>,
    pub pinned: Vec<String>,
}

fn apps_prefs(state: &AppState) -> (Option<String>, Vec<String>) {
    let settings = read_settings(state);
    let Some(apps) = settings.get("apps").and_then(|v| v.as_object()) else {
        return (None, Vec::new());
    };
    let dir = apps
        .get("dir")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    let pinned = apps
        .get("pinned")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();
    (dir, pinned)
}

fn write_apps_prefs(state: &AppState, dir: &Option<String>, pinned: &[String]) -> AppResult<()> {
    let mut settings = read_settings(state);
    let obj = settings
        .as_object_mut()
        .ok_or_else(|| AppError::new("internal", "设置文件结构异常"))?;
    let mut apps = serde_json::Map::new();
    if let Some(dir) = dir.clone() {
        apps.insert("dir".into(), serde_json::Value::String(dir));
    }
    apps.insert(
        "pinned".into(),
        serde_json::Value::Array(pinned.iter().map(|s| serde_json::Value::String(s.clone())).collect()),
    );
    obj.insert("apps".into(), serde_json::Value::Object(apps));
    write_settings(state, &settings)
}

fn app_kind(ext: &str) -> bool {
    matches!(ext, "lnk" | "url" | "exe" | "app")
}

/// 只接受目录内的普通文件名（禁止路径分隔符与 Windows 非法字符），再按真实路径校验一遍。
/// 各平台的"打开文件/目录"命令
fn opener() -> &'static str {
    #[cfg(windows)]
    {
        "explorer.exe"
    }
    #[cfg(target_os = "macos")]
    {
        "open"
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        "xdg-open"
    }
}

fn safe_child(dir: &Path, file: &str) -> AppResult<PathBuf> {
    let name = file.trim();
    if name.is_empty()
        || name.len() > 200
        || name.contains('/')
        || name.contains('\\')
        || name.contains("..")
        || name.chars().any(|c| matches!(c, ':' | '*' | '?' | '"' | '<' | '>' | '|') || (c as u32) < 0x20)
    {
        return Err(AppError::validation("文件名不合法。"));
    }
    let full = dir.join(name);
    let canon_dir = fs::canonicalize(dir).map_err(|e| AppError::new("io", format!("目录不可读：{e}")))?;
    let canon = fs::canonicalize(&full).map_err(|_| AppError::not_found(format!("快捷方式不存在：{name}")))?;
    if !canon.starts_with(&canon_dir) || !canon.is_file() {
        return Err(AppError::validation("目标不在应用目录内。"));
    }
    Ok(canon)
}

#[tauri::command]
pub fn apps_list(app: tauri::AppHandle, state: State<AppState>) -> AppResult<AppsPayload> {
    let (dir, pinned) = apps_prefs(&state);
    let Some(dir) = dir else {
        return Ok(AppsPayload { dir: None, dir_exists: false, apps: Vec::new(), pinned });
    };
    let dir_path = PathBuf::from(&dir);
    if !dir_path.is_dir() {
        return Ok(AppsPayload { dir: Some(dir), dir_exists: false, apps: Vec::new(), pinned });
    }

    let mut files: Vec<PathBuf> = Vec::new();
    for entry in fs::read_dir(&dir_path).map_err(|e| AppError::new("io", format!("读取目录失败：{e}")))?.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .unwrap_or_default();
        if app_kind(&ext) {
            files.push(path);
        }
    }

    // 图标：按路径哈希缓存到 <appdata>/app-icons/，缺失的批量提取一次
    let icon_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::new("internal", format!("无法定位应用数据目录：{e}")))?
        .join("app-icons");
    fs::create_dir_all(&icon_dir)?;

    let mut need: Vec<(String, String)> = Vec::new();
    let mut icon_of: std::collections::HashMap<String, Option<String>> = std::collections::HashMap::new();
    for path in &files {
        let key = path.to_string_lossy().to_string();
        let out = icon_dir.join(format!("{}.png", &sha256_hex(&key)[..16]));
        if out.exists() {
            icon_of.insert(key, Some(out.to_string_lossy().into_owned()));
        } else {
            need.push((key, out.to_string_lossy().into_owned()));
        }
    }
    if !need.is_empty() {
        let results = extract_icons_batch(&need);
        for (path, _, _, _, icon) in results {
            icon_of.insert(path, icon);
        }
    }

    let mut apps: Vec<AppEntry> = files
        .into_iter()
        .map(|path| {
            let file = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| e.to_lowercase())
                .unwrap_or_default();
            let key = path.to_string_lossy().to_string();
            AppEntry {
                name: path.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or(file.clone()),
                ext,
                icon: icon_of.get(&key).cloned().flatten(),
                file,
            }
        })
        .collect();
    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    Ok(AppsPayload { dir: Some(dir), dir_exists: true, apps, pinned })
}

/// 设置应用目录（传空串清除）
#[tauri::command]
pub fn apps_set_dir(state: State<AppState>, dir: String) -> AppResult<AppsPayload> {
    let trimmed = dir.trim().to_string();
    if !trimmed.is_empty() {
        let p = PathBuf::from(&trimmed);
        if !p.is_absolute() {
            return Err(AppError::validation("应用目录必须是绝对路径。"));
        }
        if trimmed.chars().count() > 300 {
            return Err(AppError::validation("路径过长（上限 300 字符）。"));
        }
        if !p.is_dir() {
            return Err(AppError::not_found(format!("目录不存在：{trimmed}")));
        }
    }
    let (_, pinned) = apps_prefs(&state);
    let next = if trimmed.is_empty() { None } else { Some(trimmed) };
    write_apps_prefs(&state, &next, &pinned)?;
    Ok(AppsPayload { dir: next, dir_exists: true, apps: Vec::new(), pinned })
}

/// 置顶列表（文件名为键）
#[tauri::command]
pub fn apps_set_pinned(state: State<AppState>, pinned: Vec<String>) -> AppResult<()> {
    let (dir, _) = apps_prefs(&state);
    let list: Vec<String> = pinned
        .into_iter()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .take(500)
        .collect();
    write_apps_prefs(&state, &dir, &list)
}

/// 启动器允许的文件类型（与 apps_list 的收录口径一致）
fn launchable(path: &Path) -> bool {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();
    matches!(ext.as_str(), "lnk" | "url" | "exe" | "app")
}

#[tauri::command]
pub fn apps_launch(state: State<AppState>, file: String) -> AppResult<()> {
    let (dir, _) = apps_prefs(&state);
    let dir = dir.ok_or_else(|| AppError::validation("尚未配置应用目录。"))?;
    let full = safe_child(Path::new(&dir), &file)?;
    if !launchable(&full) {
        return Err(AppError::validation("只能启动快捷方式或可执行文件（.lnk/.url/.exe/.app）。"));
    }
    let target = full.to_string_lossy().into_owned();
    let child = std::process::Command::new(opener())
    .arg(&target)
    .stdin(std::process::Stdio::null())
    .stdout(std::process::Stdio::null())
    .stderr(std::process::Stdio::null())
    .spawn()
    .map_err(|e| AppError::new("io", format!("启动失败：{e}")))?;
    std::mem::drop(child);
    Ok(())
}

#[tauri::command]
pub fn apps_open_folder(state: State<AppState>) -> AppResult<()> {
    let (dir, _) = apps_prefs(&state);
    let dir = dir.ok_or_else(|| AppError::validation("尚未配置应用目录。"))?;
    if !Path::new(&dir).is_dir() {
        return Err(AppError::not_found(format!("目录不存在：{dir}")));
    }
    let child = std::process::Command::new(opener())
    .arg(&dir)
    .stdin(std::process::Stdio::null())
    .stdout(std::process::Stdio::null())
    .stderr(std::process::Stdio::null())
    .spawn()
    .map_err(|e| AppError::new("io", format!("打开目录失败：{e}")))?;
    std::mem::drop(child);
    Ok(())
}

/// 自动探测常见快捷方式目录（首次使用时的默认值）
#[tauri::command]
pub fn apps_suggest_dir() -> Option<String> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(home) = std::env::var("USERPROFILE") {
        candidates.push(PathBuf::from(home).join("Desktop"));
    }
    if let Ok(home) = std::env::var("HOME") {
        let base = PathBuf::from(home);
        candidates.push(base.join("Desktop"));
        candidates.push(base.join("Applications"));
    }
    candidates.push(PathBuf::from("/Applications"));
    candidates
        .into_iter()
        .find(|p| p.is_dir())
        .map(|p| p.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn launchable_allows_shortcuts_and_binaries_only() {
        for ok in ["a.lnk", "b.URL", "c.exe", "D.app"] {
            assert!(launchable(Path::new(ok)), "{ok} 应放行");
        }
        for bad in ["notes.txt", "run.bat", "script.ps1", "noext", "x.js"] {
            assert!(!launchable(Path::new(bad)), "{bad} 不应放行");
        }
    }

    #[test]
    fn safe_child_rejects_traversal() {
        let dir = std::env::temp_dir();
        assert!(safe_child(&dir, "../evil.lnk").is_err());
        assert!(safe_child(&dir, "a/b.lnk").is_err());
        assert!(safe_child(&dir, "").is_err());
    }
}
