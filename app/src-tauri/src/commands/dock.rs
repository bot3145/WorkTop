// 桌面 Dock：真实 OS 悬浮窗 + 应用发现/图标提取/启动/运行状态。
// 平台差异：Windows 扫开始菜单 .lnk/.url（explorer.exe 启动、PowerShell 批量提图标）；
// macOS 扫 /Applications（open 启动、sips 转 icns→png）；运行状态用系统进程表（tasklist / ps）。
use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DockApp {
    pub id: String,
    pub name: String,
    pub path: String,
    /// lnk | url | app | exe
    pub kind: String,
    /// 快捷方式解析出的目标（用于运行状态匹配）
    #[serde(default)]
    pub target: String,
    /// 缓存图标绝对路径（前端用 convertFileSrc 展示）
    #[serde(default)]
    pub icon: Option<String>,
    /// 开始菜单分组（首个目录层）
    #[serde(default)]
    pub group: String,
}

/* ---------- 图标缓存清单 ---------- */

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct IconManifest {
    /// shortcut 路径(小写) → { mtime, target, icon }
    entries: HashMap<String, IconEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct IconEntry {
    mtime: i64,
    target: String,
    icon: Option<String>,
    /// lnk 的参数与工作目录（扫描时一并解析，启动时免 COM 直启）
    #[serde(default, skip_serializing_if = "Option::is_none")]
    args: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    workdir: Option<String>,
}

fn manifest_path(dir: &Path) -> PathBuf {
    dir.join("manifest.json")
}

fn load_manifest(dir: &Path) -> IconManifest {
    fs::read_to_string(manifest_path(dir))
        .ok()
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_default()
}

fn save_manifest(dir: &Path, manifest: &IconManifest) {
    let _ = fs::write(manifest_path(dir), serde_json::to_string(manifest).unwrap_or_default());
}

fn sha16(text: &str) -> String {
    crate::store::sha256_hex(text)[..16].to_string()
}

/// 子进程统一入口：Windows 上必须带 CREATE_NO_WINDOW，
/// 否则从 GUI 进程 spawn 的控制台程序（tasklist/powershell 等）会闪出一个 CMD 窗口。
fn hidden_command(program: &str) -> std::process::Command {
    #[allow(unused_mut)]
    let mut cmd = std::process::Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

fn mtime_secs(path: &Path) -> i64 {
    fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/* ---------- 扫描 ---------- */

#[cfg(windows)]
fn scan_roots() -> Vec<(PathBuf, &'static str)> {
    let mut out = Vec::new();
    if let Ok(program_data) = std::env::var("ProgramData") {
        out.push((PathBuf::from(program_data).join(r"Microsoft\Windows\Start Menu\Programs"), "公共"));
    }
    if let Ok(appdata) = std::env::var("APPDATA") {
        out.push((PathBuf::from(appdata).join(r"Microsoft\Windows\Start Menu\Programs"), ""));
    }
    out
}

#[cfg(not(windows))]
fn scan_roots() -> Vec<(PathBuf, &'static str)> {
    // macOS / Linux：/Applications 与 ~/Applications
    let mut out = vec![(PathBuf::from("/Applications"), "")];
    if let Ok(home) = std::env::var("HOME") {
        out.push((PathBuf::from(home).join("Applications"), ""));
    }
    out
}

fn walk_collect(dir: &Path, depth: usize, group: &str, out: &mut Vec<(PathBuf, String)>) {
    if depth > 3 {
        return;
    }
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        if path.is_dir() {
            // macOS 的 .app 是目录，按应用收
            if path.extension().and_then(|e| e.to_str()) == Some("app") {
                out.push((path.clone(), group.to_string()));
                continue;
            }
            let next_group = if group.is_empty() { name.clone() } else { group.to_string() };
            walk_collect(&path, depth + 1, &next_group, out);
            continue;
        }
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .unwrap_or_default();
        if matches!(ext.as_str(), "lnk" | "url" | "app" | "exe") {
            out.push((path, group.to_string()));
        }
    }
}

/* ---------- Windows 图标批量提取（单次 PowerShell，走临时 JSON 文件） ---------- */

#[cfg(windows)]
const PS_DOCK_ICONS: &str = r#"$ErrorActionPreference='SilentlyContinue'
Add-Type -AssemblyName System.Drawing
$items = Get-Content -LiteralPath $env:DOCK_IN -Raw -Encoding UTF8 | ConvertFrom-Json
$sh = New-Object -ComObject WScript.Shell
$out = New-Object System.Collections.ArrayList
foreach ($it in $items) {
  $p = $it.path
  $target = $p
  $args = $null
  $workdir = $null
  if ($p -like '*.lnk') {
    try {
      $sc = $sh.CreateShortcut($p)
      $target = $sc.TargetPath
      $args = $sc.Arguments
      $workdir = $sc.WorkingDirectory
    } catch {}
  }
  $icon = $null
  $saved = $false
  try {
    $src = $target
    if (-not $src -or -not (Test-Path -LiteralPath $src)) { $src = $p }
    $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($src)
  } catch {}
  if (-not $icon) { try { $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($p) } catch {} }
  if ($icon) {
    try { $bmp = $icon.ToBitmap(); $bmp.Save($it.out, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose(); $saved = $true } catch {}
    $icon.Dispose()
  }
  [void]$out.Add([pscustomobject]@{ path = $p; target = $target; args = $args; workdir = $workdir; icon = $(if ($saved) { $it.out } else { $null }) })
}
$out | ConvertTo-Json -Compress"#;

#[cfg(windows)]
pub(crate) fn extract_icons_batch(
    items: &[(String, String)],
) -> Vec<(String, String, Option<String>, Option<String>, Option<String>)> {
    // items: (path, out_png_path)；返回 (path, target, args, workdir, icon)
    if items.is_empty() {
        return Vec::new();
    }
    let payload: Vec<serde_json::Value> = items
        .iter()
        .map(|(p, o)| serde_json::json!({ "path": p, "out": o }))
        .collect();
    let temp_dir = std::env::temp_dir();
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let in_file = temp_dir.join(format!("worktop-dock-in-{stamp}.json"));
    if fs::write(&in_file, serde_json::to_string(&payload).unwrap_or_default()).is_err() {
        return Vec::new();
    }
    let output = hidden_command("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", PS_DOCK_ICONS])
        .env("DOCK_IN", &in_file)
        .output();
    let _ = fs::remove_file(&in_file);
    let Ok(output) = output else { return Vec::new() };
    let text = String::from_utf8_lossy(&output.stdout);
    let trimmed = text.trim();
    let json: serde_json::Value = if trimmed.starts_with('[') {
        serde_json::from_str(trimmed).unwrap_or(serde_json::Value::Null)
    } else if trimmed.starts_with('{') {
        serde_json::from_str(trimmed).unwrap_or(serde_json::Value::Null)
    } else {
        serde_json::Value::Null
    };
    let rows = match json {
        serde_json::Value::Array(a) => a,
        serde_json::Value::Object(_) => vec![json],
        _ => return Vec::new(),
    };
    rows.iter()
        .filter_map(|row| {
            let path = row.get("path")?.as_str()?.to_string();
            let target = row.get("target").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let args = row.get("args").and_then(|v| v.as_str()).map(|s| s.to_string());
            let workdir = row.get("workdir").and_then(|v| v.as_str()).map(|s| s.to_string());
            let icon = row.get("icon").and_then(|v| v.as_str()).map(|s| s.to_string());
            Some((path, target, args, workdir, icon))
        })
        .collect()
}

#[cfg(not(windows))]
pub(crate) fn extract_icons_batch(items: &[(String, String)]) -> Vec<(String, String, Option<String>)> {
    // macOS：.icns → png（sips）；失败则无图标，前端回退首字母
    items
        .iter()
        .map(|(path, out)| {
            let mut target = String::new();
            let mut saved = None;
            if path.ends_with(".app") {
                let resources = Path::new(path).join("Contents/Resources");
                let icns = fs::read_dir(&resources).ok().and_then(|rd| {
                    rd.flatten()
                        .map(|e| e.path())
                        .find(|p| p.extension().and_then(|e| e.to_str()) == Some("icns"))
                });
                if let Some(icns) = icns {
                    let ok = hidden_command("sips")
                        .args(["-s", "format", "png", "-Z", "128", &icns.to_string_lossy(), "--out", out])
                        .output()
                        .map(|o| o.status.success())
                        .unwrap_or(false);
                    if ok {
                        saved = Some(out.clone());
                    }
                }
            }
            target = path.clone();
            (path.clone(), target, saved)
        })
        .collect()
}

/* ---------- 命令：扫描应用 ---------- */

#[tauri::command]
pub fn dock_scan(app: tauri::AppHandle) -> AppResult<Vec<DockApp>> {
    let icon_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::new("internal", format!("无法定位应用数据目录：{e}")))?
        .join("dock-icons");
    fs::create_dir_all(&icon_dir)?;
    let mut manifest = load_manifest(&icon_dir);

    let mut collected: Vec<(PathBuf, String)> = Vec::new();
    for (root, group) in scan_roots() {
        if root.exists() {
            walk_collect(&root, 0, group, &mut collected);
        }
    }
    // 系统内置：文件管理器没有开始菜单快捷方式，扫描永远抓不到，这里补一条（exe 可提取真实图标）
    #[cfg(windows)]
    if let Some(windir) = std::env::var_os("WINDIR") {
        let explorer = PathBuf::from(windir).join("explorer.exe");
        if explorer.exists() {
            collected.push((explorer, String::new()));
        }
    }
    // 去重（同一程序可能同时出现在公共/用户开始菜单）
    let mut seen = std::collections::HashSet::new();
    collected.retain(|(p, _)| seen.insert(p.to_string_lossy().to_lowercase()));

    let mut need: Vec<(String, String, String)> = Vec::new(); // (key, path, out)
    for (path, _) in &collected {
        let key = path.to_string_lossy().to_lowercase();
        let mtime = mtime_secs(path);
        let out = icon_dir.join(format!("{}.png", sha16(&key))).to_string_lossy().into_owned();
        let hit = manifest.entries.get(&key);
        let fresh = hit.map(|e| e.mtime == mtime && e.icon.as_deref().map(|i| Path::new(i).exists()).unwrap_or(false));
        if fresh != Some(true) && !Path::new(&out).exists() {
            need.push((key.clone(), path.to_string_lossy().into_owned(), out));
            continue;
        }
        if hit.is_none() {
            need.push((key, path.to_string_lossy().into_owned(), out));
        }
    }

    if !need.is_empty() {
        let batch: Vec<(String, String)> = need.iter().map(|(_, p, o)| (p.clone(), o.clone())).collect();
        let results = extract_icons_batch(&batch);
        let mut by_path: HashMap<String, (String, Option<String>, Option<String>, Option<String>)> = HashMap::new();
        for (path, target, args, workdir, icon) in results {
            by_path.insert(path.to_lowercase(), (target, args, workdir, icon));
        }
        for (key, path, out) in &need {
            let mtime = mtime_secs(Path::new(path));
            let (target, args, workdir, icon) = by_path
                .get(key)
                .cloned()
                .unwrap_or_else(|| (String::new(), None, None, None));
            let icon = icon.or_else(|| if Path::new(out).exists() { Some(out.clone()) } else { None });
            manifest.entries.insert(
                key.clone(),
                IconEntry { mtime, target, icon, args, workdir },
            );
        }
        save_manifest(&icon_dir, &manifest);
    }

    let mut apps: Vec<DockApp> = collected
        .into_iter()
        .map(|(path, group)| {
            let key = path.to_string_lossy().to_lowercase();
            let file_name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| e.to_lowercase())
                .unwrap_or_default();
            let kind = match ext.as_str() {
                "lnk" => "lnk",
                "url" => "url",
                "app" => "app",
                _ => "exe",
            };
            let name = if ext == "app" {
                file_name.trim_end_matches(".app").to_string()
            } else {
                path.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or(file_name.clone())
            };
            let entry = manifest.entries.get(&key);
            let target = entry.map(|e| e.target.clone()).unwrap_or_default();
            let icon = entry.and_then(|e| e.icon.clone()).filter(|i| Path::new(i).exists());
            DockApp {
                id: sha16(&key),
                name,
                path: path.to_string_lossy().into_owned(),
                kind: kind.to_string(),
                target,
                icon,
                group,
            }
        })
        .collect();
    // explorer 的文件名对用户不友好，统一叫「文件管理器」
    #[cfg(windows)]
    if let Some(app) = apps.iter_mut().find(|a| a.path.to_lowercase().ends_with("explorer.exe")) {
        app.name = "文件管理器".to_string();
    }
    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(apps)
}

/// 添加用户自选快捷方式到 Dock：解析目标 + 提取图标，返回 DockApp（前端存到自定义列表）。
#[tauri::command]
pub fn dock_add_shortcut(app: tauri::AppHandle, path: String) -> AppResult<DockApp> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err(AppError::not_found("快捷方式不存在。"));
    }
    let ext = p
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();
    if !matches!(ext.as_str(), "exe" | "lnk" | "url" | "app") {
        return Err(AppError::validation("仅支持 .exe / .lnk / .url 快捷方式（macOS 为 .app）。"));
    }
    let icon_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::new("internal", format!("无法定位应用数据目录：{e}")))?
        .join("dock-icons");
    fs::create_dir_all(&icon_dir)?;

    let key = path.to_lowercase();
    let out = icon_dir.join(format!("{}.png", sha16(&key)));
    let results = extract_icons_batch(&[(path.clone(), out.to_string_lossy().into_owned())]);
    let (target, args, workdir, icon) = results
        .first()
        .map(|(_, t, a, w, i)| (t.clone(), a.clone(), w.clone(), i.clone()))
        .unwrap_or_else(|| (String::new(), None, None, None));
    let icon = icon.or_else(|| {
        if out.exists() {
            Some(out.to_string_lossy().into_owned())
        } else {
            None
        }
    });
    // 手动添加的快捷方式同样进 manifest（dock_toggle 查它拿直启信息）
    let mut manifest = load_manifest(&icon_dir);
    manifest.entries.insert(
        key.clone(),
        IconEntry {
            mtime: mtime_secs(&p),
            target: target.clone(),
            icon: icon.clone(),
            args,
            workdir,
        },
    );
    save_manifest(&icon_dir, &manifest);

    let file_name = p.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    let name = if ext == "app" {
        file_name.trim_end_matches(".app").to_string()
    } else {
        p.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or(file_name.clone())
    };
    let kind = if ext.is_empty() { "exe" } else { ext.as_str() };
    Ok(DockApp {
        id: sha16(&key),
        name,
        path,
        kind: kind.to_string(),
        target,
        icon,
        group: "自定义".to_string(),
    })
}

/* ---------- 命令：启动 / 定位 / 运行状态 ---------- */

fn spawn_detached(program: &str, args: &[&str]) -> AppResult<()> {
    let child = hidden_command(program)
        .args(args)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| AppError::new("io", format!("启动失败：{e}")))?;
    // 不等待子进程（explorer/open 会立刻返回）
    std::mem::drop(child);
    Ok(())
}

#[tauri::command]
pub fn dock_launch(app: tauri::AppHandle, path: String) -> AppResult<()> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err(AppError::not_found(format!("应用不存在：{path}")));
    }
    let ext = p
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();
    if !matches!(ext.as_str(), "lnk" | "url" | "exe" | "app") {
        return Err(AppError::validation("只能启动快捷方式或可执行文件（.lnk/.url/.exe/.app）。"));
    }
    launch_app(&app, &path)
}

/// 启动应用（Windows 快速路径）：.exe / .lnk（用扫描时预解析的 target+args+workdir）
/// 直接 CreateProcess，跳过 explorer 与 ShellExecute/COM；.url 及解析失败时走系统打开。
/// 需要 UAC 提权的程序 CreateProcess 会报 740，此时回落 explorer（由系统弹 UAC）。
fn launch_app(app: &tauri::AppHandle, path: &str) -> AppResult<()> {
    #[cfg(windows)]
    {
        if let Some((exe, args, wd)) = launch_target(app, path) {
            let mut cmd = std::process::Command::new(&exe);
            cmd.args(&args)
                .stdin(std::process::Stdio::null())
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null());
            if let Some(wd) = wd.as_ref() {
                cmd.current_dir(wd);
            }
            match cmd.spawn() {
                Ok(child) => {
                    std::mem::drop(child);
                    return Ok(());
                }
                Err(e) if e.raw_os_error() == Some(740) => { /* 提权程序，回落 explorer */ }
                Err(e) => return Err(AppError::new("io", format!("启动失败：{e}"))),
            }
        }
        return spawn_detached("explorer.exe", &[path]);
    }
    #[cfg(target_os = "macos")]
    {
        let _ = app;
        return spawn_detached("open", &[path]);
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let _ = app;
        return spawn_detached("xdg-open", &[path]);
    }
}

/// 解析直启信息：(exe, 参数列表, 工作目录)。.exe 直接用；.lnk 查图标 manifest 的预解析结果。
#[cfg(windows)]
fn launch_target(
    app: &tauri::AppHandle,
    path: &str,
) -> Option<(PathBuf, Vec<String>, Option<PathBuf>)> {
    use tauri::Manager;
    let p = PathBuf::from(path);
    let ext = p.extension()?.to_str()?.to_ascii_lowercase();
    match ext.as_str() {
        "exe" => Some((p, Vec::new(), None)),
        "lnk" => {
            let icon_dir = app.path().app_data_dir().ok()?.join("dock-icons");
            let manifest = load_manifest(&icon_dir);
            let entry = manifest.entries.get(&path.to_lowercase())?;
            let target = PathBuf::from(entry.target.trim());
            let is_exe = target
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| e.eq_ignore_ascii_case("exe"))
                .unwrap_or(false);
            if is_exe && target.exists() {
                let args = entry.args.as_deref().map(split_args).unwrap_or_default();
                let wd = entry
                    .workdir
                    .as_deref()
                    .filter(|s| !s.trim().is_empty())
                    .map(PathBuf::from);
                Some((target, args, wd))
            } else {
                None
            }
        }
        _ => None,
    }
}

/// 极简命令行参数切分：空白分隔，支持双引号包裹的整段参数。
#[cfg(windows)]
fn split_args(s: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut cur = String::new();
    let mut in_quote = false;
    for c in s.chars() {
        match c {
            '"' => in_quote = !in_quote,
            c if c.is_whitespace() && !in_quote => {
                if !cur.is_empty() {
                    out.push(std::mem::take(&mut cur));
                }
            }
            c => cur.push(c),
        }
    }
    if !cur.is_empty() {
        out.push(cur);
    }
    out
}

/// 点击 Dock 图标的统一入口：未运行 → 启动；运行中已最小化 → 恢复并前置；运行中 → 最小化。
#[tauri::command]
pub fn dock_toggle(app: tauri::AppHandle, path: String) -> AppResult<String> {
    #[cfg(windows)]
    {
        let exe = launch_target(&app, &path)
            .map(|(e, _, _)| e)
            .unwrap_or_else(|| PathBuf::from(&path));
        let proc_name = exe
            .file_name()
            .map(|n| n.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        if proc_name.is_empty() {
            launch_app(&app, &path)?;
            return Ok("launched".into());
        }
        let windows = find_app_windows(&proc_name);
        if windows.is_empty() {
            launch_app(&app, &path)?;
            return Ok("launched".into());
        }
        unsafe {
            // 优先级：前台窗口 → 任一未最小化窗口（最小化它）；全部已最小化 → 恢复 Z 序最前（最近活跃）的那个。
            // 多窗口应用下避免「点一下最小化 A、再点又最小化 B」的错乱。
            let fg = win_toggle::GetForegroundWindow();
            let target = if windows.contains(&fg) {
                Some(fg)
            } else {
                windows.iter().copied().find(|h| win_toggle::IsIconic(*h) == 0)
            };
            match target {
                Some(h) => {
                    win_toggle::ShowWindow(h, win_toggle::SW_MINIMIZE);
                    Ok("minimized".into())
                }
                None => {
                    let h = windows[0];
                    win_toggle::ShowWindow(h, win_toggle::SW_RESTORE);
                    win_toggle::SetForegroundWindow(h);
                    Ok("restored".into())
                }
            }
        }
    }
    #[cfg(not(windows))]
    {
        launch_app(&app, &path)?;
        Ok("launched".into())
    }
}

/// 找进程名（小写含 .exe，如 "dingtalk.exe"）的全部可见顶层窗口，按 Z 序（最近活跃在前）返回。
#[cfg(windows)]
fn find_app_windows(proc_name_lc: &str) -> Vec<isize> {
    use std::cell::RefCell;
    thread_local! {
        static FOUND: RefCell<Vec<isize>> = const { RefCell::new(Vec::new()) };
        static PROC_NAME: RefCell<String> = RefCell::new(String::new());
    }
    FOUND.with(|f| f.borrow_mut().clear());
    PROC_NAME.with(|p| *p.borrow_mut() = proc_name_lc.to_string());
    extern "system" fn cb(hwnd: isize, _l: isize) -> i32 {
        use std::os::windows::ffi::OsStringExt;
        unsafe {
            // 只看可见的、非工具窗口的顶层窗口
            if win_toggle::IsWindowVisible(hwnd) == 0 {
                return 1;
            }
            if win_toggle::GetWindowLongW(hwnd, win_toggle::GWL_EXSTYLE) & win_toggle::WS_EX_TOOLWINDOW != 0 {
                return 1;
            }
            let mut pid = 0u32;
            win_toggle::GetWindowThreadProcessId(hwnd, &mut pid);
            if pid == 0 {
                return 1;
            }
            let process = win_toggle::OpenProcess(win_toggle::PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if process == 0 {
                return 1;
            }
            let mut buf = [0u16; 1024];
            let mut len = buf.len() as u32;
            let ok = win_toggle::QueryFullProcessImageNameW(process, 0, buf.as_mut_ptr(), &mut len);
            win_toggle::CloseHandle(process);
            if ok == 0 {
                return 1;
            }
            let image = std::ffi::OsString::from_wide(&buf[..len as usize])
                .to_string_lossy()
                .to_lowercase();
            let name = std::path::Path::new(&image)
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_default();
            if name == PROC_NAME.with(|p| p.borrow().clone()) {
                FOUND.with(|f| f.borrow_mut().push(hwnd));
            }
            1
        }
    }
    unsafe {
        win_toggle::EnumWindows(Some(cb), 0);
    }
    FOUND.with(|f| f.borrow().clone())
}

#[cfg(windows)]
mod win_toggle {
    pub const SW_MINIMIZE: i32 = 6;
    pub const SW_RESTORE: i32 = 9;
    pub const GWL_EXSTYLE: i32 = -20;
    pub const WS_EX_TOOLWINDOW: i32 = 0x0000_0080;
    pub const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;

    #[link(name = "user32")]
    extern "system" {
        pub fn EnumWindows(cb: Option<extern "system" fn(isize, isize) -> i32>, lparam: isize) -> i32;
        pub fn IsWindowVisible(hwnd: isize) -> i32;
        pub fn IsIconic(hwnd: isize) -> i32;
        pub fn ShowWindow(hwnd: isize, cmd: i32) -> i32;
        pub fn SetForegroundWindow(hwnd: isize) -> i32;
        pub fn GetForegroundWindow() -> isize;
        pub fn GetWindowLongW(hwnd: isize, index: i32) -> i32;
        pub fn GetWindowThreadProcessId(hwnd: isize, pid: *mut u32) -> u32;
    }
    #[link(name = "kernel32")]
    extern "system" {
        pub fn OpenProcess(access: u32, inherit: i32, pid: u32) -> isize;
        pub fn QueryFullProcessImageNameW(process: isize, flags: u32, buf: *mut u16, len: *mut u32) -> i32;
        pub fn CloseHandle(handle: isize) -> i32;
    }
}

#[tauri::command]
pub fn dock_reveal(path: String) -> AppResult<()> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(AppError::not_found("应用不存在。"));
    }
    #[cfg(windows)]
    {
        spawn_detached("explorer.exe", &[&format!("/select,{}", p.to_string_lossy())])
    }
    #[cfg(target_os = "macos")]
    {
        spawn_detached("open", &["-R", &p.to_string_lossy()])
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let dir = p.parent().map(|d| d.to_string_lossy().into_owned()).unwrap_or_default();
        spawn_detached("xdg-open", &[&dir])
    }
}

/// 运行中的应用进程名（小写、无 .exe 后缀），前端与 DockApp.target 比对显示指示点。
#[tauri::command]
pub fn dock_running() -> AppResult<Vec<String>> {
    #[cfg(windows)]
    {
        let output = hidden_command("tasklist")
            .args(["/FO", "CSV", "/NH"])
            .output()
            .map_err(|e| AppError::new("io", format!("读取进程列表失败：{e}")))?;
        let text = String::from_utf8_lossy(&output.stdout);
        let mut names = Vec::new();
        for line in text.lines() {
            if let Some(rest) = line.strip_prefix('"') {
                if let Some(end) = rest.find('"') {
                    let name = &rest[..end];
                    let lower = name.to_lowercase();
                    let base = lower.strip_suffix(".exe").unwrap_or(&lower).to_string();
                    if !names.contains(&base) {
                        names.push(base);
                    }
                }
            }
        }
        return Ok(names);
    }
    #[cfg(target_os = "macos")]
    {
        let output = hidden_command("ps")
            .args(["-axco", "comm"])
            .output()
            .map_err(|e| AppError::new("io", format!("读取进程列表失败：{e}")))?;
        let text = String::from_utf8_lossy(&output.stdout);
        let mut names: Vec<String> = Vec::new();
        for line in text.lines().skip(1) {
            let name = line.trim().to_lowercase();
            if !name.is_empty() && !names.contains(&name) {
                names.push(name);
            }
        }
        return Ok(names);
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Ok(Vec::new())
    }
}

/* ---------- 命令：Dock 悬浮窗 ---------- */

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DockGeometry {
    pub width: f64,
    pub height: f64,
    pub x: f64,
    pub y: f64,
    pub screen_width: f64,
    pub screen_height: f64,
}

fn dock_position(
    app: &tauri::AppHandle,
    width: f64,
    height: f64,
    position: &str,
    margin: f64,
) -> AppResult<DockGeometry> {
    let monitor = app
        .primary_monitor()
        .map_err(|e| AppError::new("internal", format!("读取显示器失败：{e}")))?
        .ok_or_else(|| AppError::new("internal", "未检测到显示器"))?;
    let size = monitor.size();
    let scale = monitor.scale_factor();
    let sw = size.width as f64 / scale;
    let sh = size.height as f64 / scale;
    let origin = monitor.position();
    let ox = origin.x as f64 / scale;
    let oy = origin.y as f64 / scale;
    let (x, y) = match position {
        "left" => (ox + margin, oy + (sh - height) / 2.0),
        "right" => (ox + sw - width - margin, oy + (sh - height) / 2.0),
        _ => (ox + (sw - width) / 2.0, oy + sh - height - margin),
    };
    Ok(DockGeometry { width, height, x, y, screen_width: sw, screen_height: sh })
}

#[tauri::command]
pub async fn dock_open(
    app: tauri::AppHandle,
    width: f64,
    height: f64,
    position: String,
    margin: f64,
) -> AppResult<DockGeometry> {
    let geo = dock_position(&app, width, height, &position, margin)?;
    if let Some(win) = app.get_webview_window("dock") {
        let _ = win.set_position(tauri::LogicalPosition::new(geo.x, geo.y));
        let _ = win.set_size(tauri::LogicalSize::new(geo.width, geo.height));
        let _ = win.show();
        return Ok(geo);
    }
    let v = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0);
    let win = tauri::WebviewWindowBuilder::new(
        &app,
        "dock",
        tauri::WebviewUrl::App(format!("index.html?win=dock&v={v}").into()),
    )
    .title("Worktop Dock")
    .inner_size(geo.width, geo.height)
    .position(geo.x, geo.y)
    .transparent(true)
    .decorations(false)
    .resizable(false)
    .shadow(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .focused(false)
    .visible(false)
    .build()
    .map_err(|e| AppError::new("internal", format!("创建 Dock 窗口失败：{e}")))?;
    let _ = win.show();
    Ok(geo)
}

#[tauri::command]
pub fn dock_close(app: tauri::AppHandle) -> AppResult<()> {
    if let Some(win) = app.get_webview_window("dock") {
        let _ = win.close();
    }
    Ok(())
}

#[tauri::command]
pub fn dock_is_open(app: tauri::AppHandle) -> bool {
    app.get_webview_window("dock").is_some()
}

#[tauri::command]
pub fn dock_geometry(
    app: tauri::AppHandle,
    width: f64,
    height: f64,
    position: String,
    margin: f64,
) -> AppResult<DockGeometry> {
    dock_position(&app, width, height, &position, margin)
}
