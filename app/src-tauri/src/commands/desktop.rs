// 桌面层：吉祥物小窗 + 桌面卡片窗口系统。
// 吉祥物为本项目原创 SVG 形象（见前端 windows/MascotWindow.vue），不使用任何第三方素材。
use super::{read_settings, write_settings, AppState};
use crate::error::{AppError, AppResult};
use serde_json::{json, Value};
use std::sync::Mutex;
use tauri::Manager;
use tauri::State;

/// 菜单展开前吉祥物的左上角（逻辑 px）。展开时把形象移到菜单正中心，
/// 收起后原样放回——与 x-hub「展开以球心为锚、收起恢复吸附点」同语义。
static PRE_MENU_MASCOT_POS: Mutex<Option<(f64, f64)>> = Mutex::new(None);

/* ---------- 配置读写（设置.json 的 desktop 键；旧版键名 pet 自动迁移） ---------- */

fn cfg_of(state: &AppState) -> Value {
    let settings = read_settings(state);
    settings
        .get("desktop")
        .or_else(|| settings.get("pet"))
        .cloned()
        .unwrap_or_else(|| json!({}))
}

fn save_cfg(state: &AppState, cfg: &Value) -> AppResult<()> {
    let mut settings = read_settings(state);
    let obj = settings
        .as_object_mut()
        .ok_or_else(|| AppError::new("internal", "设置文件结构异常"))?;
    obj.insert("desktop".into(), cfg.clone());
    write_settings(state, &settings)
}

/// 当前桌面层配置（卡片开关/布局/工具栏/吉祥物位置等）
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopStatePayload {
    config: Value,
}

#[tauri::command]
pub fn desktop_state(state: State<AppState>) -> AppResult<DesktopStatePayload> {
    Ok(DesktopStatePayload { config: cfg_of(&state) })
}

/// 局部更新配置（浅合并），并广播给各窗口刷新
#[tauri::command]
pub fn desktop_save(
    app: tauri::AppHandle,
    state: State<AppState>,
    patch: Value,
) -> AppResult<Value> {
    use tauri::Emitter;
    let mut cfg = cfg_of(&state);
    if let (Some(target), Some(src)) = (cfg.as_object_mut(), patch.as_object()) {
        for (k, v) in src {
            target.insert(k.clone(), v.clone());
        }
    }
    save_cfg(&state, &cfg)?;
    let _ = app.emit("pwb-desktop-config", &cfg);
    Ok(cfg)
}

/* ---------- 吉祥物（原创星球形象：拖到屏幕边缘折叠一半，点击弹弧形菜单） ---------- */

/// 创建/显示吉祥物窗（透明、无边框、置顶、跳过任务栏）。
/// 折叠状态（mascotFolded/mascotEdge/mascotY）下窗口中心越出屏幕边缘，只露半个星球。
pub fn show_mascot(app: &tauri::AppHandle) -> AppResult<()> {
    // 吉祥物窗口 52×52 逻辑像素（x-hub 球体 48px 视觉档；构图见前端 MascotWindow.vue；改尺寸需同步）
    if let Some(win) = app.get_webview_window("mascot") {
        let _ = win.show();
        let _ = win.set_always_on_top(true);
        return Ok(());
    }
    let monitor = app
        .primary_monitor()
        .map_err(|e| AppError::new("internal", format!("读取显示器失败：{e}")))?
        .ok_or_else(|| AppError::new("internal", "未检测到显示器"))?;
    let ms = monitor.scale_factor();
    let area = monitor.work_area();
    let sw = area.size.width as f64 / ms;
    let sh = area.size.height as f64 / ms;
    let ax = area.position.x as f64 / ms;
    let ay = area.position.y as f64 / ms;

    let state = app.state::<AppState>();
    let cfg = cfg_of(&state);
    let width = 52.0;
    let height = 52.0;
    let def_x = ax + sw - width - 16.0;
    let def_y = ay + sh - height - 16.0;
    let folded = cfg.get("mascotFolded").and_then(|v| v.as_bool()).unwrap_or(false);
    let edge = cfg.get("mascotEdge").and_then(|v| v.as_str()).unwrap_or("right");
    let my = cfg.get("mascotY").and_then(|v| v.as_f64());
    let (x, y) = if folded {
        let fx = if edge == "left" { ax - width * 0.5 } else { ax + sw - width * 0.5 };
        (fx, my.unwrap_or(def_y).clamp(ay, ay + sh - height * 0.5))
    } else {
        (
            cfg.get("x").and_then(|v| v.as_f64()).unwrap_or(def_x).clamp(ax, ax + sw - width * 0.5),
            cfg.get("y").and_then(|v| v.as_f64()).unwrap_or(def_y).clamp(ay, ay + sh - height * 0.5),
        )
    };

    let v = now_ms();
    let win = tauri::WebviewWindowBuilder::new(
        app,
        "mascot",
        tauri::WebviewUrl::App(format!("index.html?win=mascot&v={v}").into()),
    )
    .title("WorkTop")
    .inner_size(width, height)
    .position(x, y)
    .transparent(true)
    .decorations(false)
    .resizable(false)
    .shadow(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .focused(false)
    .visible(false)
    .background_color(tauri::window::Color(0, 0, 0, 0))
    .build()
    .map_err(|e| {
        eprintln!("[mascot] build failed: {e}");
        AppError::new("internal", format!("创建吉祥物窗口失败：{e}"))
    })?;
    let _ = win.show();
    Ok(())
}

#[tauri::command]
pub async fn mascot_open(app: tauri::AppHandle) -> AppResult<()> {
    show_mascot(&app)
}

#[tauri::command]
pub fn mascot_close(app: tauri::AppHandle) -> AppResult<()> {
    if let Some(win) = app.get_webview_window("mascot") {
        let _ = win.close();
    }
    Ok(())
}

/// 弹出弧形菜单窗：贴着吉祥物星球展开（折叠在哪侧就朝另一侧弹）。
#[tauri::command]
pub async fn mascot_menu_open(app: tauri::AppHandle) -> AppResult<()> {
    if let Some(win) = app.get_webview_window("mascot-menu") {
        let _ = win.show();
        let _ = win.set_focus();
        return Ok(());
    }
    let m = app
        .get_webview_window("mascot")
        .ok_or_else(|| AppError::new("internal", "吉祥物窗口不存在"))?;
    let pos = m.outer_position().map_err(|e| AppError::new("internal", format!("读取窗口位置失败：{e}")))?;
    let size = m.outer_size().map_err(|e| AppError::new("internal", format!("读取窗口尺寸失败：{e}")))?;
    let mon = m.current_monitor().map_err(|e| AppError::new("internal", format!("读取显示器失败：{e}")))?
        .ok_or_else(|| AppError::new("internal", "未检测到显示器"))?;
    let ms = mon.scale_factor();
    let area = mon.work_area();
    let sw = area.size.width as f64 / ms;
    let ax = area.position.x as f64 / ms;
    let ay = area.position.y as f64 / ms;
    let sh = area.size.height as f64 / ms;
    let mw = size.width as f64 / ms;
    let mh = size.height as f64 / ms;
    let mx = pos.x as f64 / ms;
    let myp = pos.y as f64 / ms;

    // 菜单窗以人物中心为锚展开：5 个按钮沿人物**左侧半弧**排布（正上→左→正下）。
    // 几何：窗 300×260，锚点（弧心=人物中心）在窗右侧 (254,130)，轨道半径 90、按钮 52px。
    let planet_cx = mx + mw * 0.5;
    let planet_cy = myp + mh * 0.5;
    let (menu_w, menu_h) = (300.0, 260.0);
    let (anchor_x, anchor_y) = (254.0, 130.0);
    // 小屏保护：先保证 clamp 的上下界合法，避免 min > max 时 panic。
    let max_x = (ax + sw - menu_w - 4.0).max(ax + 4.0);
    let max_y = (ay + sh - menu_h - 4.0).max(ay + 4.0);
    let x = (planet_cx - anchor_x).clamp(ax + 4.0, max_x);
    let y = (planet_cy - anchor_y).clamp(ay + 4.0, max_y);
    // 菜单贴边被夹住时，锚点会随窗偏移；直接把形象窗口搬到「窗内锚点」处，
    // 保证任何屏幕位置下形象都严格压在弧心上（收起时再放回原位）。
    let target_mx = x + anchor_x - mw * 0.5;
    let target_my = y + anchor_y - mh * 0.5;

    let v = now_ms();
    let win = tauri::WebviewWindowBuilder::new(
        &app,
        "mascot-menu",
        tauri::WebviewUrl::App(format!(
            "index.html?win=mascotmenu&v={v}&fx={anchor_x}&fy={anchor_y}"
        ).into()),
    )
    .title("WorkTop Menu")
    .inner_size(menu_w, menu_h)
    .position(x, y)
    .transparent(true)
    .decorations(false)
    .resizable(false)
    .shadow(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .focused(true)
    .visible(false)
    .background_color(tauri::window::Color(0, 0, 0, 0))
    .build()
    .map_err(|e| AppError::new("internal", format!("创建菜单窗口失败：{e}")))?;

    // 菜单窗创建成功后再搬形象，避免建窗失败把形象留在错位处。
    if let Ok(mut pre) = PRE_MENU_MASCOT_POS.lock() {
        *pre = Some((mx, myp));
    }
    let _ = m.set_position(tauri::LogicalPosition::new(target_mx, target_my));

    let _ = win.show();
    let _ = win.set_focus();
    Ok(())
}

#[tauri::command]
pub fn mascot_menu_close(app: tauri::AppHandle) -> AppResult<()> {
    if let Some(win) = app.get_webview_window("mascot-menu") {
        let _ = win.close();
    }
    // 收起后把形象放回展开前的吸附位置。
    if let Ok(mut pre) = PRE_MENU_MASCOT_POS.lock() {
        if let Some((x, y)) = pre.take() {
            if let Some(m) = app.get_webview_window("mascot") {
                let _ = m.set_position(tauri::LogicalPosition::new(x, y));
            }
        }
    }
    Ok(())
}

/// 吉祥物右键菜单：仅「退出程序」。
#[tauri::command]
pub fn mascot_context_menu(app: tauri::AppHandle) -> AppResult<()> {
    use tauri::menu::{ContextMenu, Menu, MenuItem};
    let quit = MenuItem::with_id(&app, "mascot-quit", "退出程序", true, None::<&str>)
        .map_err(|e| AppError::new("internal", format!("创建菜单项失败：{e}")))?;
    let menu = Menu::with_items(&app, &[&quit])
        .map_err(|e| AppError::new("internal", format!("创建菜单失败：{e}")))?;
    if let Some(win) = app.get_webview_window("mascot") {
        menu.popup(win.as_ref().window().clone())
            .map_err(|e| AppError::new("internal", format!("弹出菜单失败：{e}")))?;
    }
    Ok(())
}

/// 隐藏主窗口（极简模式：桌面只留卡片与吉祥物）
#[tauri::command]
pub fn main_hide(app: tauri::AppHandle) -> AppResult<()> {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.hide();
    }
    Ok(())
}

/* ---------- 桌面卡片窗口（每张卡片一个独立透明窗口，可单独拖动/缩放） ---------- */

/// 卡片窗口的键（与前端 CARD_KEYS 一致）
const CARD_KEYS: [&str; 9] = ["clock", "calendar", "todo", "notes", "apps", "nav", "assets", "keys", "ai"];

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CardSpec {
    pub key: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

fn now_ms() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

/// 同步卡片窗口集合：缺失的创建、已有的移动/缩放、名单外关闭。
/// 位置尺寸一律逻辑像素（与前端 CSS 坐标一致）。
#[tauri::command]
pub async fn cards_sync(app: tauri::AppHandle, cards: Vec<CardSpec>) -> AppResult<()> {
    let specs: Vec<CardSpec> = cards
        .into_iter()
        .filter(|c| CARD_KEYS.contains(&c.key.as_str()))
        .map(|mut c| {
            c.width = c.width.clamp(150.0, 1200.0);
            c.height = c.height.clamp(80.0, 1200.0);
            c
        })
        .collect();

    for spec in &specs {
        let label = format!("card-{}", spec.key);
        if let Some(win) = app.get_webview_window(&label) {
            let _ = win.set_size(tauri::LogicalSize::new(spec.width, spec.height));
            let _ = win.set_position(tauri::LogicalPosition::new(spec.x, spec.y));
            let _ = win.set_always_on_top(false);
            let _ = win.show();
            apply_desktop_layer(&format!("WorkTop Card {}", spec.key));
            continue;
        }
        let url = format!("index.html?win=card&card={}&v={}", spec.key, now_ms());
        let win = tauri::WebviewWindowBuilder::new(&app, &label, tauri::WebviewUrl::App(url.into()))
            .title(format!("WorkTop Card {}", spec.key))
            .inner_size(spec.width, spec.height)
            .position(spec.x, spec.y)
            .transparent(true)
            .decorations(false)
            .resizable(false)
            .shadow(false)
            .always_on_top(false)
            .skip_taskbar(true)
            .focused(false)
            .visible(false)
            .background_color(tauri::window::Color(0, 0, 0, 0))
            .build()
            .map_err(|e| AppError::new("internal", format!("创建卡片窗口失败：{e}")))?;
        let _ = win.show();
        apply_desktop_layer(&format!("WorkTop Card {}", spec.key));
    }

    for key in CARD_KEYS {
        if specs.iter().any(|s| s.key == key) {
            continue;
        }
        if let Some(win) = app.get_webview_window(&format!("card-{key}")) {
            let _ = win.close();
        }
    }
    // 旧版单窗口卡片（v2 前）一并清掉
    if let Some(win) = app.get_webview_window("cards") {
        let _ = win.close();
    }
    Ok(())
}

#[tauri::command]
pub fn cards_close(app: tauri::AppHandle) -> AppResult<()> {
    for key in CARD_KEYS {
        if let Some(win) = app.get_webview_window(&format!("card-{key}")) {
            let _ = win.close();
        }
    }
    if let Some(win) = app.get_webview_window("cards") {
        let _ = win.close();
    }
    Ok(())
}

/// 保存单张卡片的位置与尺寸（窗口拖动/缩放结束时调用）
#[tauri::command]
pub fn card_save_rect(
    state: State<AppState>,
    key: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> AppResult<()> {
    if !CARD_KEYS.contains(&key.as_str()) {
        return Err(AppError::validation("未知卡片"));
    }
    let mut cfg = cfg_of(&state);
    let Some(obj) = cfg.as_object_mut() else {
        return Err(AppError::new("internal", "设置文件结构异常"));
    };
    let layout = obj
        .entry("cardLayout".to_string())
        .or_insert_with(|| json!({}));
    if !layout.is_object() {
        *layout = json!({});
    }
    if let Some(map) = layout.as_object_mut() {
        map.insert(key, json!({ "x": x, "y": y, "w": width, "h": height }));
    }
    save_cfg(&state, &cfg)
}

/* ---------- 桌面层窗口（卡片）：不置顶、不抢焦点、沉底 ---------- */

#[cfg(windows)]
mod win32_layer {
    #[link(name = "user32")]
    extern "system" {
        pub fn FindWindowW(class: *const u16, title: *const u16) -> isize;
        pub fn GetWindowLongPtrW(hwnd: isize, index: i32) -> isize;
        pub fn SetWindowLongPtrW(hwnd: isize, index: i32, value: isize) -> isize;
        pub fn SetWindowPos(hwnd: isize, after: isize, x: i32, y: i32, cx: i32, cy: i32, flags: u32) -> i32;
    }
}

#[cfg(windows)]
fn utf16_of(s: &str) -> Vec<u16> {
    use std::os::windows::ffi::OsStrExt;
    std::ffi::OsStr::new(s).encode_wide().chain(Some(0)).collect()
}

/// 卡片 = 桌面小部件语义：
/// 1) 不置顶——普通窗口可以盖住它；
/// 2) WS_EX_NOACTIVATE——点击不抬升 Z 序、不抢焦点（内容按钮仍可点）；
/// 3) SetWindowPos(HWND_BOTTOM)——沉到 Z 序底部（壁纸/图标之上、所有普通窗口之下）。
/// 仅 Windows；macOS 以普通非置顶窗口运行（桌面层需要 kCGDesktopWindowLevel，待验证）。
#[cfg(windows)]
fn apply_desktop_layer(title: &str) {
    const GWL_EXSTYLE: i32 = -20;
    const WS_EX_NOACTIVATE: isize = 0x0800_0000;
    const HWND_BOTTOM: isize = 1;
    const SWP_NOSIZE: u32 = 0x0001;
    const SWP_NOMOVE: u32 = 0x0002;
    const SWP_NOACTIVATE: u32 = 0x0010;
    let title_w = utf16_of(title);
    unsafe {
        let hwnd = win32_layer::FindWindowW(std::ptr::null(), title_w.as_ptr());
        if hwnd == 0 {
            return;
        }
        let style = win32_layer::GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        win32_layer::SetWindowLongPtrW(hwnd, GWL_EXSTYLE, style | WS_EX_NOACTIVATE);
        win32_layer::SetWindowPos(hwnd, HWND_BOTTOM, 0, 0, 0, 0, SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE);
    }
}

#[cfg(not(windows))]
fn apply_desktop_layer(_title: &str) {}

/// 卡片窗口自检：还原显示、去掉置顶、压回桌面层（卡片 webview 每 30s 调一次）
#[tauri::command]
pub fn card_to_bottom(window: tauri::Window) -> AppResult<()> {
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_always_on_top(false);
    #[cfg(windows)]
    {
        if let Ok(title) = window.title() {
            apply_desktop_layer(&title);
        }
    }
    Ok(())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CardPos {
    pub key: String,
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

/// 其它卡片的当前矩形（物理像素 / 调用方 scale → 逻辑像素；同屏假设，跨屏会有偏差）
#[tauri::command]
pub fn card_positions(app: tauri::AppHandle, exclude: String, scale: f64) -> Vec<CardPos> {
    let s = if scale > 0.05 { scale } else { 1.0 };
    let mut out = Vec::new();
    for key in CARD_KEYS {
        if key == exclude {
            continue;
        }
        let Some(win) = app.get_webview_window(&format!("card-{key}")) else { continue };
        let (Ok(pos), Ok(size), Ok(vis)) = (win.outer_position(), win.outer_size(), win.is_visible()) else { continue };
        if !vis {
            continue;
        }
        out.push(CardPos {
            key: key.to_string(),
            x: pos.x as f64 / s,
            y: pos.y as f64 / s,
            w: size.width as f64 / s,
            h: size.height as f64 / s,
        });
    }
    out
}
