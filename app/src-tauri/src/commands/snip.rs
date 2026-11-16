// WorkTop 原生截图：不启动外部程序，不依赖 PowerShell。
// Rust 负责抓屏、PNG 编解码、系统剪贴板、全局 F1 与**原生光标/窗口几何**；
// 前端 SnipWindow 负责选区、标注和导出预览。
//
// 架构参照 ShareX / Flameshot：先抓屏成内存位图，再弹一个置顶无边框覆盖窗，
// 覆盖层的十字光标与鼠标语义由自己掌管，而不是交给浏览器控件。
// WebView2 有个已知缺陷：点击内容后会把系统光标标记为隐藏，随后出现的浮层
// 又挡住 PointerLeave，光标就再也不回来。因此这里对主窗与 WebView2 子窗做
// WndProc 子类化，在 WM_SETCURSOR 里由 Rust 统一 SetCursor 并修复显示计数。
use crate::error::{AppError, AppResult};
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU8, Ordering};
use std::sync::{Mutex, OnceLock};

const MAX_PIXELS: u64 = 100_000_000;
const MAX_PNG_BASE64: usize = 160 * 1024 * 1024;

/// 光标语义由前端告知、由 Rust 在 WM_SETCURSOR 里呈现。
/// 0 crosshair / 1 arrow / 2 move / 3 nwse / 4 nesw / 5 ns / 6 we
static CURSOR_KIND: AtomicU8 = AtomicU8::new(0);
/// 一次截图只做一次「激活 + 装钩子 + 起守护」，前端 ready 竞态重入也不会起多余线程。
static FOCUS_READY: AtomicBool = AtomicBool::new(false);
/// 被子类化的 HWND → 原 WndProc。窗口销毁时由 WM_NCDESTROY 自行还原。
static WND_HOOKS: OnceLock<Mutex<HashMap<isize, isize>>> = OnceLock::new();
fn hooks() -> &'static Mutex<HashMap<isize, isize>> {
    WND_HOOKS.get_or_init(|| Mutex::new(HashMap::new()))
}

struct Capture {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    preview_base64: String,
    /// 原始 RGBA 像素。双击全屏时直接写剪贴板，省掉前端重新编码 PNG 的往返。
    rgba: Vec<u8>,
}

static CAPTURE: Mutex<Option<Capture>> = Mutex::new(None);
static ACTIVE: AtomicBool = AtomicBool::new(false);

#[derive(Serialize)]
pub struct SnipPreview {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub png_base64: String,
}

fn reset_capture() {
    if let Ok(mut slot) = CAPTURE.lock() {
        *slot = None;
    }
    ACTIVE.store(false, Ordering::SeqCst);
    CURSOR_KIND.store(0, Ordering::Relaxed);
    FOCUS_READY.store(false, Ordering::SeqCst);
}

/// 一步直达：发射器（吉祥物弧形菜单 / Dock 右键菜单）由 Rust 同步收起，
/// 不再等 280ms 的收起动画，点「截图」即刻进入覆盖层。
#[tauri::command]
pub fn snip_capture(app: tauri::AppHandle) -> AppResult<String> {
    // 24ms ≈ 一帧，只留给前端把 DOM 右键菜单从画面上撤掉。
    start_snip(app, 24)?;
    Ok("native".into())
}

/// 截图前把所有自发浮层收掉，避免被拍进截图里，也让入口真正「一步」。
#[cfg(windows)]
fn dismiss_launchers(app: &tauri::AppHandle) {
    // 复用既有命令：隐藏菜单窗并把吉祥物弹回展开前的吸附位置。
    let _ = crate::commands::desktop::mascot_menu_close(app.clone());
}

#[cfg(not(windows))]
fn dismiss_launchers(_app: &tauri::AppHandle) {}

#[cfg(windows)]
fn start_snip(app: tauri::AppHandle, settle_ms: u64) -> AppResult<()> {
    use tauri::Emitter;
    if ACTIVE.swap(true, Ordering::SeqCst) {
        return Ok(());
    }
    dismiss_launchers(&app);
    std::thread::spawn(move || {
        // 先把隐藏的截图窗加载起来，再等菜单收起后抓屏：窗口初始化和抓屏并行，
        // 前端拿到图片并完成首帧后才显示，避免原先先弹一整屏黑色加载层。
        let initial = win32::active_monitor_geometry().ok();
        if let Some(geometry) = initial {
            let handle = app.clone();
            let _ = app.run_on_main_thread(move || {
                if let Err(e) = prepare_snip_window(&handle, geometry) {
                    eprintln!("[snip] prepare window failed: {e}");
                }
            });
        }
        // 菜单/右键入口需要一点收起时间；F1 直达时不需要等，少一次白等。
        if settle_ms > 0 {
            std::thread::sleep(std::time::Duration::from_millis(settle_ms));
        }
        let result = win32::capture_active_monitor().and_then(|capture| {
            let geometry = (capture.x, capture.y, capture.width, capture.height);
            if let Ok(mut slot) = CAPTURE.lock() {
                *slot = Some(capture);
            } else {
                return Err(AppError::new("internal", "截图状态锁已损坏。"));
            }
            // 仅在抓屏期间显示设置真的变了才重新摆放，避免与前端 show 抢时序。
            if initial != Some(geometry) {
                let handle = app.clone();
                let _ = app.run_on_main_thread(move || {
                    if let Err(e) = prepare_snip_window(&handle, geometry) {
                        eprintln!("[snip] resize window failed: {e}");
                    }
                });
            }
            // 窗口比抓屏先建，页面可能已挂载完毕；由前端载入图片、解压完成后再显示。
            let _ = app.emit("snip:capture-ready", ());
            Ok(())
        });
        if let Err(e) = result {
            eprintln!("[snip] capture failed: {e}");
            reset_capture();
            let _ = app.emit("snip:failed", e.to_string());
        }
    });
    Ok(())
}

#[cfg(not(windows))]
fn start_snip(_app: tauri::AppHandle, _settle_ms: u64) -> AppResult<()> {
    Err(AppError::validation("原生截图目前只支持 Windows。"))
}

#[cfg(windows)]
fn prepare_snip_window(app: &tauri::AppHandle, geometry: (i32, i32, u32, u32)) -> AppResult<()> {
    use tauri::Manager;
    let (x, y, width, height) = geometry;
    if let Some(win) = app.get_webview_window("snip") {
        let _ = win.set_size(tauri::PhysicalSize::new(width, height));
        let _ = win.set_position(tauri::PhysicalPosition::new(x, y));
        // 最后一步用 Win32 以物理像素定死矩形，避免 DPI 换算把它挪走。
        if let Ok(hwnd) = win.hwnd() {
            win32::place_physical(hwnd.0 as isize, x, y, width as i32, height as i32);
        }
        // 已经显示出来的窗口绝不能再 hide：那会在用户正在框选时把覆盖层抽走。
        if !win.is_visible().unwrap_or(false) {
            let _ = win.hide();
        }
        return Ok(());
    }
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let win = tauri::WebviewWindowBuilder::new(
        app,
        "snip",
        tauri::WebviewUrl::App(format!("index.html?win=snip&v={stamp}").into()),
    )
    .title("WorkTop 截图")
    // 先建一个小隐藏窗：Tauri 的 inner_size 是逻辑像素，若直接传 4K 物理值，
    // 在 150% 缩放下会先造出 1.5 倍大的 WebView，既有放大错觉也很吃内存。
    .inner_size(80.0, 80.0)
    .position(0.0, 0.0)
    .decorations(false)
    .resizable(false)
    .shadow(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .focused(false)
    .visible(false)
    .background_color(tauri::window::Color(0, 0, 0, 255))
    .build()
    .map_err(|e| AppError::new("internal", format!("创建截图窗口失败：{e}")))?;

    // 抓屏是物理像素；用 Win32 直接设置物理像素，绕过 Tauri 的逻辑像素换算。
    // 多显示器混合 DPI 下这一步必须精确，否则窗口和截图会各自缩放一次。
    let _ = win.set_size(tauri::PhysicalSize::new(width, height));
    let _ = win.set_position(tauri::PhysicalPosition::new(x, y));
    if let Ok(hwnd) = win.hwnd() {
        win32::place_physical(hwnd.0 as isize, x, y, width as i32, height as i32);
    }
    win.on_window_event(|event| {
        if matches!(event, tauri::WindowEvent::CloseRequested { .. }) {
            reset_capture();
        }
    });
    // 保持隐藏：等前端把 PNG 解码并完成首帧，再由 SnipWindow 自己 show。
    Ok(())
}

/* ---------- 多显示器 ---------- */

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorOut {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub primary: bool,
}

/// 全部显示器的物理矩形。前端据此显示「显示器 2/3」并支持切换。
#[tauri::command]
pub fn snip_monitors() -> Vec<MonitorOut> {
    #[cfg(windows)]
    {
        win32::monitors()
            .into_iter()
            .map(|(x, y, width, height, primary)| MonitorOut { x, y, width, height, primary })
            .collect()
    }
    #[cfg(not(windows))]
    {
        Vec::new()
    }
}

/// 换一块屏继续截：抓目标屏 → 摆好覆盖窗 → 通知前端重新载入。
///
/// 覆盖窗始终只覆盖**一块**屏幕：跨屏窗口会被 Windows 强制统一缩放比例，
/// 混合 DPI（比如主屏 150% + 副屏 100%）下副屏画面会整体放大、框选错位。
/// 所以「支持扩展屏」的做法是逐屏切换，而不是把整个虚拟桌面塞进一个窗口。
#[tauri::command]
pub async fn snip_switch_monitor(app: tauri::AppHandle, index: usize) -> AppResult<usize> {
    #[cfg(windows)]
    {
        use tauri::Emitter;
        use tauri::Manager;
        if app.get_webview_window("snip").is_none() {
            return Err(AppError::not_found("截图窗口已关闭。"));
        }
        let list = win32::monitors();
        if list.is_empty() {
            return Err(AppError::new("internal", "未检测到显示器。"));
        }
        let i = index % list.len();
        let (x, y, width, height) = (list[i].0, list[i].1, list[i].2, list[i].3);
        capture_monitor((x, y, width, height))?;
        // 光标跟着搬到新屏中央：否则鼠标还停在原来那块屏，十字线根本对不上
        win32::set_cursor_pos(x + width as i32 / 2, y + height as i32 / 2);
        // 窗口已存在，这里只做尺寸/位置与 Win32 物理矩形校正，不会重新建窗
        prepare_snip_window(&app, (x, y, width, height))?;
        // 跨屏移动会触发 WM_DPICHANGED，系统/tao 可能按 DPI 比例重新缩放窗口；
        // 这里补几次物理矩形校正（幂等，只有真的漂移了才 SetWindowPos）。
        if let Some(win) = app.get_webview_window("snip") {
            if let Ok(hwnd) = win.hwnd() {
                let handle = hwnd.0 as isize;
                for delay in [40u64, 160, 400] {
                    let outer = app.clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_millis(delay));
                        let _ = outer.run_on_main_thread(move || {
                            win32::pin_geometry(handle, x, y, width as i32, height as i32);
                            win32::install_cursor_hooks(handle);
                        });
                    });
                }
            }
        }
        let _ = app.emit("snip:capture-ready", ());
        Ok(i)
    }
    #[cfg(not(windows))]
    {
        let _ = (app, index);
        Err(AppError::validation("截图目前只支持 Windows。"))
    }
}

#[cfg(windows)]
fn capture_monitor(rect: (i32, i32, u32, u32)) -> AppResult<()> {
    let (x, y, width, height) = rect;
    if width == 0 || height == 0 || u64::from(width) * u64::from(height) > MAX_PIXELS {
        return Err(AppError::validation("显示器尺寸不合法，无法截图。"));
    }
    let rgba = win32::capture_rect(x, y, width, height)?;
    let png = win32::encode_png(width, height, &rgba)?;
    let mut slot = CAPTURE.lock().map_err(|_| AppError::new("internal", "截图状态锁已损坏。"))?;
    *slot = Some(Capture { x, y, width, height, preview_base64: B64.encode(png), rgba });
    Ok(())
}

#[tauri::command]
pub fn snip_preview() -> AppResult<SnipPreview> {
    let slot = CAPTURE.lock().map_err(|_| AppError::new("internal", "截图状态锁已损坏。"))?;
    let cap = slot.as_ref().ok_or_else(|| AppError::not_found("没有进行中的截图。"))?;
    Ok(SnipPreview {
        x: cap.x,
        y: cap.y,
        width: cap.width,
        height: cap.height,
        png_base64: cap.preview_base64.clone(),
    })
}

/// 导出前端合成后的 PNG。复制走系统 DIB 剪贴板；保存直接写用户选择的 PNG 文件。
#[tauri::command]
pub fn snip_export(action: String, png_base64: String, path: Option<String>) -> AppResult<String> {
    if png_base64.len() > MAX_PNG_BASE64 {
        return Err(AppError::validation("图片过大，请缩小选区后重试。"));
    }
    let bytes = B64
        .decode(png_base64.trim())
        .map_err(|e| AppError::validation(format!("PNG 数据无法解码：{e}")))?;
    match action.as_str() {
        "copy" => {
            let (width, height, rgba) = decode_png_rgba(&bytes)?;
            platform::copy_rgba_to_clipboard(width, height, &rgba)?;
            Ok("copied".into())
        }
        "save" => {
            let raw = path.unwrap_or_default();
            if raw.trim().is_empty() {
                return Err(AppError::validation("请选择保存位置。"));
            }
            let mut target = std::path::PathBuf::from(raw.trim());
            if target.extension().is_none() {
                target.set_extension("png");
            }
            if let Some(parent) = target.parent() {
                if !parent.is_dir() {
                    return Err(AppError::validation("保存目录不存在。"));
                }
            }
            std::fs::write(&target, &bytes).map_err(|e| AppError::new("io", format!("保存截图失败：{e}")))?;
            Ok(target.to_string_lossy().into_owned())
        }
        _ => Err(AppError::validation("未知的截图导出方式。")),
    }
}

/// 双击全屏：直接复制原始截图，不经过前端合成、PNG 编码与再解码。
#[tauri::command]
pub fn snip_copy_full() -> AppResult<String> {
    let mut slot = CAPTURE.lock().map_err(|_| AppError::new("internal", "截图状态锁已损坏。"))?;
    let cap = slot.as_ref().ok_or_else(|| AppError::not_found("没有进行中的截图。"))?;
    platform::copy_rgba_to_clipboard(cap.width, cap.height, &cap.rgba)?;
    // 复制成功后立即释放整屏像素，窗口关闭前不再占十几 MB。
    *slot = None;
    Ok("copied".into())
}

/* ---------- 供长截图（commands/scroll.rs）复用的 Win32 帮手 ---------- */

/// 当前截图的物理几何（覆盖层要按它复原位置）。
pub(crate) fn capture_geometry() -> Option<(i32, i32, u32, u32)> {
    CAPTURE
        .lock()
        .ok()
        .and_then(|slot| slot.as_ref().map(|c| (c.x, c.y, c.width, c.height)))
}

#[cfg(windows)]
pub(crate) fn capture_rect_pub(x: i32, y: i32, width: u32, height: u32) -> AppResult<Vec<u8>> {
    win32::capture_rect(x, y, width, height)
}

#[cfg(windows)]
pub(crate) fn capture_rect_layered_pub(x: i32, y: i32, width: u32, height: u32, layered: bool) -> AppResult<Vec<u8>> {
    win32::capture_rect_layered(x, y, width, height, layered)
}

#[cfg(windows)]
pub(crate) fn keep_display_awake_pub() {
    win32::keep_display_awake();
}

#[cfg(windows)]
pub(crate) fn cursor_pos_pub() -> AppResult<(i32, i32)> {
    win32::cursor_pos()
}

#[cfg(windows)]
pub(crate) fn work_area_of_point_pub(x: i32, y: i32) -> (i32, i32, i32, i32) {
    win32::work_area_of_point(x, y)
}

#[cfg(windows)]
pub(crate) fn cursor_state_probe_pub() -> String {
    win32::cursor_state_probe()
}

/// 抓屏诊断：对指定矩形连续抓屏，先带 CAPTUREBLT、失败则无 CAPTUREBLT 重试。
/// 排查「BitBlt gle=5 拒绝访问」这类环境性抓屏失败时，用它区分区域/尺寸/层叠窗因素。
#[tauri::command]
pub fn snip_diag_capture(x: i32, y: i32, width: u32, height: u32, rounds: Option<u32>) -> AppResult<Vec<String>> {
    #[cfg(windows)]
    {
        let n = rounds.unwrap_or(2).clamp(1, 10);
        let mut out = Vec::new();
        for i in 0..n {
            let entry = match capture_rect_layered_pub(x, y, width, height, true) {
                Ok(_) => format!("{i}: layered=ok"),
                Err(e) => match capture_rect_layered_pub(x, y, width, height, false) {
                    Ok(_) => format!("{i}: layered=FAIL({e}) plain=ok"),
                    Err(e2) => format!("{i}: layered=FAIL({e}) plain=FAIL({e2})"),
                },
            };
            out.push(entry);
            std::thread::sleep(std::time::Duration::from_millis(120));
        }
        Ok(out)
    }
    #[cfg(not(windows))]
    {
        let _ = (x, y, width, height, rounds);
        Err(AppError::validation("仅支持 Windows。"))
    }
}

#[cfg(windows)]
pub(crate) fn wheel_down_pub(notches: i32) {
    win32::wheel_down(notches)
}

#[cfg(windows)]
pub(crate) fn set_cursor_pos_pub(x: i32, y: i32) {
    win32::set_cursor_pos(x, y)
}

#[cfg(windows)]
pub(crate) fn monitors_pub() -> Vec<(i32, i32, u32, u32, bool)> {
    win32::monitors()
}

#[cfg(windows)]
pub(crate) fn pin_geometry_pub(hwnd: isize, x: i32, y: i32, width: i32, height: i32) {
    win32::pin_geometry(hwnd, x, y, width, height)
}

#[cfg(windows)]
pub(crate) fn encode_png_pub(width: u32, height: u32, rgba: &[u8]) -> AppResult<Vec<u8>> {
    win32::encode_png(width, height, rgba)
}

#[tauri::command]
pub fn snip_close(app: tauri::AppHandle) -> AppResult<()> {
    use tauri::Manager;
    // ACTIVE 先落 false：光标守护线程随即退出，WndProc 由 WM_NCDESTROY 自行还原。
    reset_capture();
    if let Some(win) = app.get_webview_window("snip") {
        let _ = win.close();
    }
    Ok(())
}

/// 前端切换光标语义（悬停工具条 / 手柄 / 选区内）时通知 Rust。
/// 系统光标由 WM_SETCURSOR 统一呈现，这里只改一个原子值，不做 IPC 往返渲染。
#[tauri::command]
pub fn snip_cursor(app: tauri::AppHandle, kind: String) -> AppResult<()> {
    let code = match kind.as_str() {
        "arrow" => 1,
        "move" => 2,
        "nwse" => 3,
        "nesw" => 4,
        "ns" => 5,
        "we" => 6,
        "text" => 7,
        _ => 0,
    };
    CURSOR_KIND.store(code, Ordering::Relaxed);
    #[cfg(windows)]
    {
        // 切换语义时主动修一次光标显示计数，避免 WebView2 的隐藏状态残留。
        let _ = app.run_on_main_thread(|| win32::ensure_cursor_visible());
    }
    #[cfg(not(windows))]
    let _ = app;
    Ok(())
}

/// 覆盖窗显示后的收尾，只做三件不碰输入队列的事：
/// 1) 把窗口钉回目标物理矩形；2) 激活一次；3) 给主窗与 WebView2 子窗装光标钩子。
///
/// 混合 DPI（本机主屏 150%、副屏 100%）下窗口一旦跨屏会收到 WM_DPICHANGED，
/// Windows/tao 可能按 DPI 比例改小矩形，鼠标就会「各走各的」，所以要先钉死。
/// 这里刻意**不再反复** SetForegroundWindow / SetFocus：tao 抢不到前台时会
/// SendInput 模拟 Alt，是光标被隐藏、位置乱跳的外部诱因之一。
#[tauri::command]
pub fn snip_focus(app: tauri::AppHandle) -> AppResult<()> {
    #[cfg(windows)]
    {
        use tauri::Manager;
        if FOCUS_READY.swap(true, Ordering::SeqCst) {
            return Ok(());
        }
        let geometry = CAPTURE
            .lock()
            .ok()
            .and_then(|slot| slot.as_ref().map(|c| (c.x, c.y, c.width as i32, c.height as i32)));
        let Some((gx, gy, gw, gh)) = geometry else { return Ok(()) };
        let Some(win) = app.get_webview_window("snip") else { return Ok(()) };
        let Ok(hwnd) = win.hwnd() else { return Ok(()) };
        let handle = hwnd.0 as isize;
        // 同步激活一次：此时进程本身就是前台（F1 热键 / 自家菜单点击），
        // SetForegroundWindow 会成功。前端不再调 tao 的 setFocus()，
        // 避免它在抢不到前台时 SendInput 模拟 Alt。
        win32::activate_once(handle);
        win32::pin_geometry(handle, gx, gy, gw, gh);
        // 子类化必须在创建窗口的 UI 线程上做。
        let _ = app.run_on_main_thread(move || {
            // UI 线程上再激活一次：Win32 对跨线程 SetForegroundWindow 有限制。
            win32::activate_once(handle);
            win32::install_cursor_hooks(handle);
            win32::ensure_cursor_visible();
        });
        // WebView2 子窗是异步创建的，晚一点幂等补装；全程不再抢焦点。
        for delay in [80u64, 260, 600] {
            let outer = app.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(delay));
                let _ = outer.run_on_main_thread(move || {
                    win32::pin_geometry(handle, gx, gy, gw, gh);
                    win32::install_cursor_hooks(handle);
                });
            });
        }
        start_cursor_guardian(app);
    }
    #[cfg(not(windows))]
    let _ = app;
    Ok(())
}

/// 光标守护：覆盖层存活期间，低频把光标钩子补装到新建的 WebView2 子窗，
/// 并在系统光标被外部（WebView2 / 触摸抑制 / 远程输入软件）藏掉时修回可见。
/// 只在 ACTIVE 期间运行，退出截图立即结束，不留后台轮询。
#[cfg(windows)]
fn start_cursor_guardian(app: tauri::AppHandle) {
    use tauri::Manager;
    std::thread::spawn(move || {
        let handle = match app.get_webview_window("snip").and_then(|w| w.hwnd().ok()) {
            Some(h) => h.0 as isize,
            None => return,
        };
        while ACTIVE.load(Ordering::SeqCst) {
            std::thread::sleep(std::time::Duration::from_millis(400));
            let outer = app.clone();
            let _ = outer.run_on_main_thread(move || {
                win32::install_cursor_hooks(handle);
                win32::ensure_cursor_visible();
            });
        }
    });
}

/// 供贴图窗口复用：以物理像素摆放窗口（不经过 Tauri 的逻辑像素换算）。
#[cfg(windows)]
pub(crate) fn place_physical(hwnd: isize, x: i32, y: i32, width: i32, height: i32) {
    win32::place_physical(hwnd, x, y, width, height);
}

/// 供 `cargo test --ignored` 的 OCR 冒烟测试用：抓一张当前屏幕（PNG base64）。
#[cfg(all(windows, test))]
pub fn capture_for_test() -> AppResult<String> {
    win32::capture_active_monitor().map(|c| c.preview_base64)
}

fn decode_png_rgba(bytes: &[u8]) -> AppResult<(u32, u32, Vec<u8>)> {
    let decoder = png::Decoder::new(std::io::Cursor::new(bytes));
    let mut reader = decoder.read_info().map_err(|e| AppError::validation(format!("PNG 读取失败：{e}")))?;
    let buffer_size = reader.output_buffer_size().ok_or_else(|| AppError::validation("PNG 缺少有效的输出尺寸。"))?;
    let mut buf = vec![0; buffer_size];
    let info = reader.next_frame(&mut buf).map_err(|e| AppError::validation(format!("PNG 解码失败：{e}")))?;
    if info.bit_depth != png::BitDepth::Eight {
        return Err(AppError::validation("仅支持 8 位 PNG 图像。"));
    }
    let pixels = u64::from(info.width) * u64::from(info.height);
    if pixels == 0 || pixels > MAX_PIXELS {
        return Err(AppError::validation("图片尺寸不合法或过大。"));
    }
    buf.truncate(info.buffer_size());
    let rgba = match info.color_type {
        png::ColorType::Rgba => buf,
        png::ColorType::Rgb => {
            let mut out = Vec::with_capacity(pixels as usize * 4);
            for px in buf.chunks_exact(3) {
                out.extend_from_slice(&[px[0], px[1], px[2], 255]);
            }
            out
        }
        _ => return Err(AppError::validation("仅支持 RGB / RGBA PNG 图像。")),
    };
    Ok((info.width, info.height, rgba))
}

/// 在独立线程注册 F1。热键消息线程随进程退出，不需要伪造按键，也不依赖外部截图程序。
#[cfg(windows)]
pub fn register_hotkey(app: tauri::AppHandle) {
    std::thread::spawn(move || unsafe {
        use win32::{GetMessageW, RegisterHotKey, MSG, MOD_NOREPEAT, VK_F1, WM_HOTKEY};
        const HOTKEY_ID: i32 = 0x5754;
        if RegisterHotKey(0, HOTKEY_ID, MOD_NOREPEAT, VK_F1) == 0 {
            eprintln!("[snip] RegisterHotKey(F1) failed: 可能被其他程序占用");
            return;
        }
        let mut msg = MSG::default();
        loop {
            let code = GetMessageW(&mut msg, 0, 0, 0);
            if code <= 0 {
                break;
            }
            if msg.message == WM_HOTKEY && msg.w_param as i32 == HOTKEY_ID {
                if let Err(e) = start_snip(app.clone(), 0) {
                    eprintln!("[snip] hotkey failed: {e}");
                }
            }
        }
    });
}

#[cfg(not(windows))]
pub fn register_hotkey(_app: tauri::AppHandle) {}

#[cfg(test)]
mod tests {
    use super::*;

    fn rgba_png(width: u32, height: u32, pixels: &[u8]) -> Vec<u8> {
        let mut out = Vec::new();
        {
            let mut encoder = png::Encoder::new(&mut out, width, height);
            encoder.set_color(png::ColorType::Rgba);
            encoder.set_depth(png::BitDepth::Eight);
            let mut writer = encoder.write_header().unwrap();
            writer.write_image_data(pixels).unwrap();
        }
        out
    }

    #[test]
    fn decode_png_rgba_preserves_dimensions_and_pixels() {
        let pixels = vec![
            255, 0, 0, 255, 0, 255, 0, 128,
            0, 0, 255, 255, 255, 255, 255, 0,
        ];
        let png = rgba_png(2, 2, &pixels);
        let (w, h, decoded) = decode_png_rgba(&png).unwrap();
        assert_eq!((w, h), (2, 2));
        assert_eq!(decoded, pixels);
    }

    #[test]
    fn decode_png_rgba_rejects_invalid_data() {
        assert!(decode_png_rgba(b"not a png").is_err());
        assert!(decode_png_rgba(&[]).is_err());
    }

    #[test]
    fn export_save_writes_the_exact_png() {
        let png = rgba_png(1, 1, &[10, 20, 30, 255]);
        let dir = std::env::temp_dir().join(format!("pwb-snip-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let target = dir.join("out.png");
        let returned = snip_export("save".into(), B64.encode(&png), Some(target.to_string_lossy().into_owned())).unwrap();
        assert_eq!(returned, target.to_string_lossy());
        assert_eq!(std::fs::read(&target).unwrap(), png);
        assert!(snip_export("unknown".into(), B64.encode(&png), None).is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// 需要真实 Windows 桌面，默认忽略；发布前可显式运行：
    /// cargo test --bins snip_capture_smoke -- --ignored
    #[cfg(windows)]
    #[test]
    #[ignore]
    fn snip_capture_smoke() {
        win32::enable_per_monitor_dpi();
        let started = std::time::Instant::now();
        let expected = win32::active_monitor_geometry().unwrap();
        let cap = win32::capture_active_monitor().unwrap();
        assert_eq!((cap.x, cap.y, cap.width, cap.height), expected);
        assert!(cap.width > 0 && cap.height > 0);
        assert!(cap.preview_base64.len() > 100);
        let bytes = B64.decode(&cap.preview_base64).unwrap();
        println!(
            "captured {}x{} in {:?}; PNG {} bytes; base64 {} bytes",
            cap.width,
            cap.height,
            started.elapsed(),
            bytes.len(),
            cap.preview_base64.len()
        );
        let (w, h, rgba) = decode_png_rgba(&bytes).unwrap();
        assert_eq!((w, h), (cap.width, cap.height));
        assert_eq!(rgba.len(), cap.width as usize * cap.height as usize * 4);
    }
}

#[cfg(windows)]
mod platform {
    use super::*;
    pub(super) use win32::copy_rgba_to_clipboard;
}

#[cfg(not(windows))]
mod platform {
    use super::*;
    pub(super) fn copy_rgba_to_clipboard(_width: u32, _height: u32, _rgba: &[u8]) -> AppResult<()> {
        Err(AppError::validation("复制截图目前只支持 Windows。"))
    }
}

#[cfg(windows)]
mod win32 {
    use super::*;

    pub const MOD_NOREPEAT: u32 = 0x4000;
    pub const VK_F1: u32 = 0x70;
    pub const WM_HOTKEY: u32 = 0x0312;

    #[repr(C)]
    #[derive(Default)]
    pub struct MSG {
        pub hwnd: isize,
        pub message: u32,
        pub w_param: usize,
        pub l_param: isize,
        pub time: u32,
        pub pt_x: i32,
        pub pt_y: i32,
        pub l_private: u32,
    }

    #[repr(C)]
    #[derive(Default)]
    struct Point {
        x: i32,
        y: i32,
    }

    type POINT = Point;

    #[repr(C)]
    #[derive(Default)]
    struct WinRect {
        left: i32,
        top: i32,
        right: i32,
        bottom: i32,
    }

    #[repr(C)]
    #[derive(Default)]
    struct MonitorInfo {
        cb_size: u32,
        monitor: WinRect,
        work: WinRect,
        flags: u32,
    }

    #[repr(C)]
    struct CursorInfo {
        cb_size: u32,
        flags: u32,
        handle: isize,
        x: i32,
        y: i32,
    }

    #[repr(C)]
    #[derive(Default)]
    struct BitmapInfoHeader {
        size: u32,
        width: i32,
        height: i32,
        planes: u16,
        bit_count: u16,
        compression: u32,
        size_image: u32,
        x_pels_per_meter: i32,
        y_pels_per_meter: i32,
        clr_used: u32,
        clr_important: u32,
    }

    #[repr(C)]
    struct BitmapInfo {
        header: BitmapInfoHeader,
        colors: [u32; 1],
    }

    const WM_SETCURSOR: u32 = 0x0020;
    const WM_NCDESTROY: u32 = 0x0082;
    const WM_MOUSEMOVE: u32 = 0x0200;
    const WM_LBUTTONDOWN: u32 = 0x0201;
    const WM_LBUTTONUP: u32 = 0x0202;
    const WM_MOUSEHOVER: u32 = 0x02A1;
    const WM_NCMOUSEMOVE: u32 = 0x00A0;
    const GWLP_WNDPROC: i32 = -4;
    const CURSOR_SHOWING: u32 = 0x1;
    const CURSOR_SUPPRESSED: u32 = 0x2;

    #[link(name = "user32")]
    extern "system" {
        pub fn RegisterHotKey(hwnd: isize, id: i32, modifiers: u32, vk: u32) -> i32;
        pub fn GetMessageW(msg: *mut MSG, hwnd: isize, min: u32, max: u32) -> i32;
        fn GetCursorPos(point: *mut POINT) -> i32;
        fn MonitorFromPoint(point: POINT, flags: u32) -> isize;
        fn GetMonitorInfoW(monitor: isize, info: *mut MonitorInfo) -> i32;
        fn SetWindowPos(hwnd: isize, after: isize, x: i32, y: i32, width: i32, height: i32, flags: u32) -> i32;
        fn SetForegroundWindow(hwnd: isize) -> i32;
        fn GetForegroundWindow() -> isize;
        fn GetWindowRect(hwnd: isize, rect: *mut WinRect) -> i32;
        #[cfg(test)]
        fn SetProcessDpiAwarenessContext(context: isize) -> i32;
        fn GetDC(hwnd: isize) -> isize;
        fn ReleaseDC(hwnd: isize, dc: isize) -> i32;
        fn OpenClipboard(hwnd: isize) -> i32;
        fn EmptyClipboard() -> i32;
        fn SetClipboardData(format: u32, mem: isize) -> isize;
        fn CloseClipboard() -> i32;
        // 原生光标所有权：子类化主窗 + WebView2 子窗的 WndProc。
        fn GetCursorInfo(info: *mut CursorInfo) -> i32;
        fn IsWindow(hwnd: isize) -> i32;
        fn ShowCursor(show: i32) -> i32;
        fn SetCursor(cursor: isize) -> isize;
        fn SetCursorPos(x: i32, y: i32) -> i32;
        fn mouse_event(flags: u32, dx: i32, dy: i32, data: u32, extra: usize);
        fn LoadCursorW(instance: isize, name: *const u16) -> isize;
        fn SetWindowLongPtrW(hwnd: isize, index: i32, new_long: isize) -> isize;
        fn CallWindowProcW(prev: isize, hwnd: isize, msg: u32, wparam: usize, lparam: isize) -> isize;
        fn EnumDisplayMonitors(
            dc: isize,
            clip: *const WinRect,
            callback: Option<unsafe extern "system" fn(isize, isize, *mut WinRect, isize) -> i32>,
            data: isize,
        ) -> i32;
        fn GetSystemMetrics(index: i32) -> i32;
        fn EnumChildWindows(
            parent: isize,
            callback: Option<unsafe extern "system" fn(isize, isize) -> i32>,
            param: isize,
        ) -> i32;
    }

    #[link(name = "gdi32")]
    extern "system" {
        fn CreateCompatibleDC(dc: isize) -> isize;
        fn CreateCompatibleBitmap(dc: isize, width: i32, height: i32) -> isize;
        fn SelectObject(dc: isize, obj: isize) -> isize;
        fn BitBlt(dst: isize, x: i32, y: i32, w: i32, h: i32, src: isize, sx: i32, sy: i32, rop: u32) -> i32;
        fn GetDIBits(dc: isize, bmp: isize, start: u32, lines: u32, bits: *mut core::ffi::c_void, info: *mut BitmapInfo, usage: u32) -> i32;
        fn DeleteObject(obj: isize) -> i32;
        fn DeleteDC(dc: isize) -> i32;
    }

    #[link(name = "kernel32")]
    extern "system" {
        fn GlobalAlloc(flags: u32, bytes: usize) -> isize;
        fn GlobalLock(mem: isize) -> *mut u8;
        fn GlobalUnlock(mem: isize) -> i32;
        fn GlobalFree(mem: isize) -> isize;
        fn GetLastError() -> i32;
        fn SetThreadExecutionState(flags: u32) -> u32;
    }

    /// 会话期间强制显示器保持点亮（ES_CONTINUOUS|ES_DISPLAY_REQUIRED）。
    /// 长截图要连续抓屏十几秒：用户只是看着屏幕不动鼠标时，空闲调暗/存在感应调暗
    /// 会让 BitBlt 被系统拒绝（gle=5 拒绝访问，实测复现）。线程结束时系统自动复位。
    pub(crate) fn keep_display_awake() {
        const ES_CONTINUOUS: u32 = 0x8000_0000;
        const ES_DISPLAY_REQUIRED: u32 = 0x0000_0002;
        unsafe {
            SetThreadExecutionState(ES_CONTINUOUS | ES_DISPLAY_REQUIRED);
        }
    }

    /// 现场取证：光标可见性与位置（抓屏被拒时的诊断输出用）。
    pub(crate) fn cursor_state_probe() -> String {
        unsafe {
            let mut info = CursorInfo { cb_size: std::mem::size_of::<CursorInfo>() as u32, flags: 0, handle: 0, x: 0, y: 0 };
            if GetCursorInfo(&mut info) != 0 {
                format!("flags={} pos=({}, {})", info.flags, info.x, info.y)
            } else {
                format!("GetCursorInfo failed gle={}", GetLastError())
            }
        }
    }

    /// 把覆盖窗钉回目标物理矩形。只在真的漂移时才 SetWindowPos，避免和 tao 互相打架。
    /// 刻意不做任何焦点/输入队列操作：AttachThreadInput、反复 SetFocus 都会扰乱鼠标状态。
    pub fn pin_geometry(hwnd: isize, x: i32, y: i32, width: i32, height: i32) {
        if hwnd == 0 {
            return;
        }
        const SWP_NOZORDER: u32 = 0x0004;
        const SWP_NOACTIVATE: u32 = 0x0010;
        unsafe {
            let mut rect = WinRect::default();
            let drifted = GetWindowRect(hwnd, &mut rect) == 0
                || rect.left != x
                || rect.top != y
                || rect.right - rect.left != width
                || rect.bottom - rect.top != height;
            if drifted {
                SetWindowPos(hwnd, 0, x, y, width, height, SWP_NOZORDER | SWP_NOACTIVATE);
            }
        }
    }

    /// 只在还不是前台时激活一次。成功之后 tao 的 setFocus 会直接跳过，
    /// 不会再 SendInput 模拟 Alt（那正是「隐藏指针」设置被触发的入口）。
    pub fn activate_once(hwnd: isize) {
        if hwnd == 0 {
            return;
        }
        unsafe {
            if GetForegroundWindow() != hwnd {
                SetForegroundWindow(hwnd);
            }
        }
    }

    /// 系统光标句柄表，加载一次后缓存。IDC_* 以 MAKEINTRESOURCE 形式传入。
    fn cursor_handle(kind: u8) -> isize {
        static CACHE: OnceLock<[isize; 8]> = OnceLock::new();
        let ids = CACHE.get_or_init(|| unsafe {
            [
                LoadCursorW(0, 32515usize as *const u16), // IDC_CROSS
                LoadCursorW(0, 32512usize as *const u16), // IDC_ARROW
                LoadCursorW(0, 32646usize as *const u16), // IDC_SIZEALL
                LoadCursorW(0, 32642usize as *const u16), // IDC_SIZENWSE
                LoadCursorW(0, 32643usize as *const u16), // IDC_SIZENESW
                LoadCursorW(0, 32645usize as *const u16), // IDC_SIZENS
                LoadCursorW(0, 32644usize as *const u16), // IDC_SIZEWE
                LoadCursorW(0, 32513usize as *const u16), // IDC_IBEAM（OCR 文字层划词）
            ]
        });
        ids[kind.min(7) as usize]
    }

    /// WebView2 已知缺陷：点击内容后会把光标显示计数减到隐藏，随后出现的浮层
    /// 挡住 PointerLeave，光标再也不会自动恢复；另外切换 DOM 元素的 CSS cursor 时，
    /// 它会直接 SetCursor(NULL) 而不发 WM_SETCURSOR —— 这正是「选好区域后移到
    /// 工具条上鼠标就看不见」的路径。这里把显示计数修回可见。
    /// suppressed（触摸/笔/远程输入抑制）无法用 ShowCursor 解除，那种情况由前端的
    /// 十字定位线与工具条定位圈兜底，用户仍能定位指针。
    pub fn ensure_cursor_visible() {
        unsafe {
            let mut info = CursorInfo {
                cb_size: std::mem::size_of::<CursorInfo>() as u32,
                flags: 0,
                handle: 0,
                x: 0,
                y: 0,
            };
            if GetCursorInfo(&mut info) == 0 {
                return;
            }
            if info.flags & (CURSOR_SHOWING | CURSOR_SUPPRESSED) != 0 {
                return;
            }
            for _ in 0..8 {
                if ShowCursor(1) >= 0 {
                    break;
                }
            }
        }
    }

    /// 覆盖窗专用 WndProc。
    ///
    /// 关键点：**先让 WebView2 的原过程把消息处理完，再覆盖光标**。上一版在
    /// WM_SETCURSOR 里直接 return 1 跳过原过程，反而让它的光标状态机卡住；而且
    /// 工具条只是 DOM 元素，切换 CSS cursor 时 WebView2 在 WM_MOUSEMOVE 里直接
    /// SetCursor(NULL)，根本不发 WM_SETCURSOR，旧钩子完全拦不到。
    /// 现在所有鼠标消息都先正常派发，随后由我们最后写一次 SetCursor，
    /// 无论 WebView2 中途做了什么都会被覆盖。
    unsafe extern "system" fn snip_wnd_proc(
        hwnd: isize,
        msg: u32,
        wparam: usize,
        lparam: isize,
    ) -> isize {
        let prev = hooks()
            .lock()
            .ok()
            .and_then(|map| map.get(&hwnd).copied())
            .unwrap_or(0);
        if msg == WM_NCDESTROY {
            if let Ok(mut map) = hooks().lock() {
                map.remove(&hwnd);
            }
            if prev == 0 {
                return 0;
            }
            SetWindowLongPtrW(hwnd, GWLP_WNDPROC, prev);
            return CallWindowProcW(prev, hwnd, msg, wparam, lparam);
        }
        if prev == 0 {
            return 0;
        }
        let result = CallWindowProcW(prev, hwnd, msg, wparam, lparam);
        if matches!(
            msg,
            WM_SETCURSOR | WM_MOUSEMOVE | WM_NCMOUSEMOVE | WM_LBUTTONDOWN | WM_LBUTTONUP | WM_MOUSEHOVER
        ) {
            SetCursor(cursor_handle(CURSOR_KIND.load(Ordering::Relaxed)));
            ensure_cursor_visible();
        }
        if msg == WM_SETCURSOR {
            return 1; // 告诉系统「光标已处理」，不要再回退到窗口类光标
        }
        result
    }

    unsafe fn install_one(hwnd: isize) {
        if hwnd == 0 {
            return;
        }
        if hooks().lock().map(|m| m.contains_key(&hwnd)).unwrap_or(true) {
            return;
        }
        let hook = snip_wnd_proc as *const () as isize;
        let prev = SetWindowLongPtrW(hwnd, GWLP_WNDPROC, hook);
        if prev == 0 || prev == hook {
            return;
        }
        if let Ok(mut map) = hooks().lock() {
            map.insert(hwnd, prev);
        }
    }

    unsafe extern "system" fn hook_child(hwnd: isize, _param: isize) -> i32 {
        install_one(hwnd);
        1
    }

    /// 幂等：主窗 + 所有 WebView2 子窗都装上光标钩子。
    /// WebView2 在窗口显示后才异步建出 Chrome_WidgetWin 子窗，所以需要重复调用。
    pub fn install_cursor_hooks(parent: isize) {
        if parent == 0 {
            return;
        }
        unsafe {
            // 清掉已销毁窗口的残留记录：HWND 会被系统复用，留着会让新窗口漏装钩子。
            if let Ok(mut map) = hooks().lock() {
                map.retain(|hwnd, _| IsWindow(*hwnd) != 0);
            }
            install_one(parent);
            EnumChildWindows(parent, Some(hook_child), 0);
        }
    }

    /// 以物理像素直接摆放窗口，确保截图与覆盖窗在混合 DPI 下严格 1:1。
    pub fn place_physical(hwnd: isize, x: i32, y: i32, width: i32, height: i32) {
        const SWP_NOZORDER: u32 = 0x0004;
        const SWP_NOACTIVATE: u32 = 0x0010;
        unsafe {
            SetWindowPos(hwnd, 0, x, y, width, height, SWP_NOZORDER | SWP_NOACTIVATE);
        }
    }

    /// 鼠标所在显示器的物理边界。
    ///
    /// 不能把整个虚拟桌面塞进一个窗口：主副屏 DPI 不同（例如 150% + 100%）时，
    /// Windows 会让跨屏窗口使用同一个缩放比例，副屏会出现「截图被放大」；
    /// 同时整张虚拟桌面截图也更大、更卡。F1 只截当前显示器，窗口与该屏 1:1。
    pub fn active_monitor_geometry() -> AppResult<(i32, i32, u32, u32)> {
        const MONITOR_DEFAULTTONEAREST: u32 = 2;
        unsafe {
            let mut cursor = POINT::default();
            if GetCursorPos(&mut cursor) == 0 {
                return Err(AppError::new("io", "读取鼠标位置失败。"));
            }
            let monitor = MonitorFromPoint(cursor, MONITOR_DEFAULTTONEAREST);
            if monitor == 0 {
                return Err(AppError::new("io", "未找到鼠标所在的显示器。"));
            }
            let mut info = MonitorInfo {
                cb_size: std::mem::size_of::<MonitorInfo>() as u32,
                ..Default::default()
            };
            if GetMonitorInfoW(monitor, &mut info) == 0 {
                return Err(AppError::new("io", "读取显示器尺寸失败。"));
            }
            let width = info.monitor.right - info.monitor.left;
            let height = info.monitor.bottom - info.monitor.top;
            if width <= 0 || height <= 0 {
                return Err(AppError::new("io", "显示器尺寸不合法。"));
            }
            if width as u64 * height as u64 > MAX_PIXELS {
                return Err(AppError::validation("显示器尺寸过大，无法截图。"));
            }
            Ok((info.monitor.left, info.monitor.top, width as u32, height as u32))
        }
    }

    /// 当前光标位置（物理像素）。
    pub fn cursor_pos() -> AppResult<(i32, i32)> {
        unsafe {
            let mut p = POINT::default();
            if GetCursorPos(&mut p) == 0 {
                return Err(AppError::new("io", "读取鼠标位置失败。"));
            }
            Ok((p.x, p.y))
        }
    }

    /// 指定点所在显示器的工作区（物理像素）。查不到时退回主屏全屏。
    pub fn work_area_of_point(x: i32, y: i32) -> (i32, i32, i32, i32) {
        const MONITOR_DEFAULTTONEAREST: u32 = 2;
        unsafe {
            let mon = MonitorFromPoint(POINT { x, y }, MONITOR_DEFAULTTONEAREST);
            if mon != 0 {
                let mut info = MonitorInfo {
                    cb_size: std::mem::size_of::<MonitorInfo>() as u32,
                    ..Default::default()
                };
                if GetMonitorInfoW(mon, &mut info) != 0 {
                    let r = info.work;
                    return (r.left, r.top, r.right - r.left, r.bottom - r.top);
                }
            }
            let w = GetSystemMetrics(0).max(0);
            let h = GetSystemMetrics(1).max(0);
            (0, 0, w, h)
        }
    }

    /// 枚举所有显示器（物理像素矩形，按左上角排序，顺序稳定）。
    ///
    /// 多屏截图必须能「任选一块屏」：只截鼠标所在屏在扩展屏场景下等于没法用——
    /// 从 Dock / 托盘点「截图」时，鼠标往往还在主屏。
    pub fn monitors() -> Vec<(i32, i32, u32, u32, bool)> {
        unsafe extern "system" fn collect(hmon: isize, _hdc: isize, rect: *mut WinRect, data: isize) -> i32 {
            if rect.is_null() || data == 0 {
                return 1;
            }
            let list = &mut *(data as *mut Vec<(i32, i32, u32, u32, bool)>);
            let mut info = MonitorInfo {
                cb_size: std::mem::size_of::<MonitorInfo>() as u32,
                ..Default::default()
            };
            if GetMonitorInfoW(hmon, &mut info) == 0 {
                return 1;
            }
            let r = &*rect;
            let primary = info.flags & 1 != 0; // MONITORINFOF_PRIMARY
            list.push((r.left, r.top, (r.right - r.left).max(0) as u32, (r.bottom - r.top).max(0) as u32, primary));
            1
        }
        let mut list: Vec<(i32, i32, u32, u32, bool)> = Vec::new();
        unsafe {
            EnumDisplayMonitors(0, std::ptr::null(), Some(collect), &mut list as *mut _ as isize);
        }
        if list.is_empty() {
            // 极端兜底：EnumDisplayMonitors 失败时至少给出主屏
            let w = unsafe { GetSystemMetrics(0) }.max(0) as u32;
            let h = unsafe { GetSystemMetrics(1) }.max(0) as u32;
            if w > 0 && h > 0 {
                list.push((0, 0, w, h, true));
            }
        }
        // 主屏排最前，其余按 x/y 排序：切换顺序稳定，用户按 Tab 走一遍不会乱跳
        list.sort_by_key(|m| (!m.4, m.0, m.1));
        list
    }

    /// 鼠标所在显示器在 `monitors()` 里的下标（找不到就退回第一个）。
    pub fn active_monitor_index() -> usize {
        let list = monitors();
        unsafe {
            let mut cursor = POINT::default();
            if GetCursorPos(&mut cursor) == 0 {
                return 0;
            }
            const MONITOR_DEFAULTTONEAREST: u32 = 2;
            let mon = MonitorFromPoint(cursor, MONITOR_DEFAULTTONEAREST);
            if mon == 0 {
                return 0;
            }
            let mut info = MonitorInfo {
                cb_size: std::mem::size_of::<MonitorInfo>() as u32,
                ..Default::default()
            };
            if GetMonitorInfoW(mon, &mut info) == 0 {
                return 0;
            }
            list.iter()
                .position(|m| m.0 == info.monitor.left && m.1 == info.monitor.top)
                .unwrap_or(0)
        }
    }

    /// 测试二进制默认可能不是 Per-Monitor DPI 感知；正式 exe 由 Tauri manifest 设置。
    #[cfg(test)]
    pub fn enable_per_monitor_dpi() {
        const DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2: isize = -4;
        unsafe {
            SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
        }
    }

    /// 抓屏幕任意矩形（物理像素），返回 RGBA。抓屏主流程与长截图共用这一条。
    /// layered=false 不带 CAPTUREBLT（不合成层叠窗），供诊断与长截图规避抓取失败用。
    pub fn capture_rect_layered(x: i32, y: i32, width: u32, height: u32, layered: bool) -> AppResult<Vec<u8>> {
        const SRCCOPY: u32 = 0x00CC_0020;
        const CAPTUREBLT: u32 = 0x4000_0000;
        if width == 0 || height == 0 {
            return Err(AppError::validation("截图尺寸不合法。"));
        }
        let w = width as i32;
        let h = height as i32;
        let rop = SRCCOPY | if layered { CAPTUREBLT } else { 0 };
        unsafe {
            let screen = GetDC(0);
            if screen == 0 {
                return Err(AppError::new("io", "获取屏幕 DC 失败。"));
            }
            let memory = CreateCompatibleDC(screen);
            if memory == 0 {
                ReleaseDC(0, screen);
                return Err(AppError::new("io", "创建截图 DC 失败。"));
            }
            let bitmap = CreateCompatibleBitmap(screen, w, h);
            if bitmap == 0 {
                ReleaseDC(0, screen);
                return Err(AppError::new("io", "创建截图位图失败。"));
            }
            let old = SelectObject(memory, bitmap);
            let copied = BitBlt(memory, 0, 0, w, h, screen, x, y, rop);
            SelectObject(memory, old);
            if copied == 0 {
                let gle = GetLastError();
                eprintln!("[snip] BitBlt failed at ({x},{y} {w}x{h}) layered={layered} gle={gle}");
                DeleteObject(bitmap);
                DeleteDC(memory);
                ReleaseDC(0, screen);
                return Err(AppError::new("io", "抓取屏幕像素失败。"));
            }
            let mut bgra = vec![0u8; width as usize * height as usize * 4];
            let mut info = BitmapInfo {
                header: BitmapInfoHeader {
                    size: std::mem::size_of::<BitmapInfoHeader>() as u32,
                    width: w,
                    height: -h, // 负高度 = 顶向下，和前端 canvas 坐标一致
                    planes: 1,
                    bit_count: 32,
                    compression: 0,
                    size_image: bgra.len() as u32,
                    ..Default::default()
                },
                colors: [0],
            };
            let lines = GetDIBits(screen, bitmap, 0, height, bgra.as_mut_ptr().cast(), &mut info, 0);
            DeleteObject(bitmap);
            DeleteDC(memory);
            ReleaseDC(0, screen);
            if lines != h {
                return Err(AppError::new("io", "读取截图像素失败。"));
            }
            for px in bgra.chunks_exact_mut(4) {
                px.swap(0, 2); // GDI BGRA → PNG/canvas RGBA
                px[3] = 255;
            }
            Ok(bgra)
        }
    }

    /// 带 CAPTUREBLT 的常规抓屏（合成层叠窗：贴图/吉祥物等）。
    pub fn capture_rect(x: i32, y: i32, width: u32, height: u32) -> AppResult<Vec<u8>> {
        capture_rect_layered(x, y, width, height, true)
    }

    pub fn capture_active_monitor() -> AppResult<Capture> {
        let (x, y, width, height) = active_monitor_geometry()?;
        let rgba = capture_rect(x, y, width, height)?;
        let png = encode_png(width, height, &rgba)?;
        Ok(Capture { x, y, width, height, preview_base64: B64.encode(png), rgba })
    }

    /// 把光标挪到选区中心：滚轮事件只会发给光标下的窗口。
    pub fn set_cursor_pos(x: i32, y: i32) {
        unsafe {
            SetCursorPos(x, y);
        }
    }

    /// 向下滚 wheel 格（一格 = 120）。用 mouse_event 而不是 PostMessage：
    /// 浏览器/Electron 只认真实输入队列里的滚轮消息，PostMessage 直接被丢掉。
    pub fn wheel_down(notches: i32) {
        const MOUSEEVENTF_WHEEL: u32 = 0x0800;
        unsafe {
            mouse_event(MOUSEEVENTF_WHEEL, 0, 0, (-120 * notches) as u32, 0);
        }
    }

    pub fn encode_png(width: u32, height: u32, rgba: &[u8]) -> AppResult<Vec<u8>> {
        let mut out = Vec::new();
        {
            let mut encoder = png::Encoder::new(&mut out, width, height);
            encoder.set_color(png::ColorType::Rgba);
            encoder.set_depth(png::BitDepth::Eight);
            // 屏幕预览优先速度：Fastest 配合 Up 行过滤，编码明显快于默认压缩，
            // 且仍是无损 PNG；真正导出的是用户框选后的合成图，不受这里影响。
            encoder.set_compression(png::Compression::Fastest);
            encoder.set_filter(png::Filter::Up);
            let mut writer = encoder.write_header().map_err(|e| AppError::new("io", format!("PNG 编码失败：{e}")))?;
            writer.write_image_data(rgba).map_err(|e| AppError::new("io", format!("PNG 写入失败：{e}")))?;
        }
        Ok(out)
    }

    /// Win32 图片剪贴板使用 CF_DIB：底向上 BGRA 像素，Office/聊天软件都能直接粘贴。
    pub fn copy_rgba_to_clipboard(width: u32, height: u32, rgba: &[u8]) -> AppResult<()> {
        const GMEM_MOVEABLE: u32 = 0x0002;
        const CF_DIB: u32 = 8;
        let expected = width as usize * height as usize * 4;
        if width == 0 || height == 0 || rgba.len() != expected {
            return Err(AppError::validation("剪贴板图像尺寸不合法。"));
        }
        let header_size = std::mem::size_of::<BitmapInfoHeader>();
        let total = header_size + expected;
        unsafe {
            let mem = GlobalAlloc(GMEM_MOVEABLE, total);
            if mem == 0 {
                return Err(AppError::new("io", "分配剪贴板图像内存失败。"));
            }
            let ptr = GlobalLock(mem);
            if ptr.is_null() {
                GlobalFree(mem);
                return Err(AppError::new("io", "锁定剪贴板图像内存失败。"));
            }
            let header = BitmapInfoHeader {
                size: header_size as u32,
                width: width as i32,
                height: height as i32, // CF_DIB 使用正高度（底向上）
                planes: 1,
                bit_count: 32,
                compression: 0,
                size_image: expected as u32,
                ..Default::default()
            };
            std::ptr::write(ptr.cast::<BitmapInfoHeader>(), header);
            let dst = ptr.add(header_size);
            let row = width as usize * 4;
            for y in 0..height as usize {
                let src_row = (height as usize - 1 - y) * row;
                for x in 0..width as usize {
                    let s = src_row + x * 4;
                    let d = y * row + x * 4;
                    std::ptr::write(dst.add(d), rgba[s + 2]);
                    std::ptr::write(dst.add(d + 1), rgba[s + 1]);
                    std::ptr::write(dst.add(d + 2), rgba[s]);
                    std::ptr::write(dst.add(d + 3), 255);
                }
            }
            GlobalUnlock(mem);

            let mut opened = false;
            for _ in 0..12 {
                if OpenClipboard(0) != 0 {
                    opened = true;
                    break;
                }
                std::thread::sleep(std::time::Duration::from_millis(60));
            }
            if !opened {
                GlobalFree(mem);
                return Err(AppError::new("io", "剪贴板正被其他程序占用，请稍后重试。"));
            }
            if EmptyClipboard() == 0 {
                CloseClipboard();
                GlobalFree(mem);
                return Err(AppError::new("io", "清空剪贴板失败。"));
            }
            let result = SetClipboardData(CF_DIB, mem);
            CloseClipboard();
            if result == 0 {
                GlobalFree(mem);
                return Err(AppError::new("io", "写入图片剪贴板失败。"));
            }
            // 成功后 HGLOBAL 归系统剪贴板所有，不能再 GlobalFree。
            Ok(())
        }
    }
}
