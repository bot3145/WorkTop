// 长截图（滚动拼接）：会话式实现。
//
// 与旧版「一条命令闷头滚到底」的区别：
//   · 全程有一个**实时预览 HUD**（scrollhud 小窗）：缩略预览 + 页数/高度 + 三个按钮；
//   · 用户可以**暂停自动滚轮、自己滚**（有些页面自动滚会失灵，手动最稳）；
//   · 随时「完成」出图或「取消」丢弃，自动模式滚到底也会自动停；
//   · 到上限（14000px / maxPages）自动收尾。
//
// 架构：snip 覆盖层在会话期间隐藏（否则会被拍进去，滚轮也到不了目标窗口），
// HUD 建在选区附近的空档里；拼接线程在后台跑，通过 snip:scroll-progress 推预览，
// 结束时把整图放进 RESULT 槽，由 snip 覆盖层 invoke snip_scroll_take 取走打开长图面板。
use crate::error::{AppError, AppResult};
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

/// 单行采样哈希的步长：每 8 个像素取一个，够区分行、又足够快
const ROW_SAMPLE_STEP: usize = 32;
/// 拼接总高度上限（像素）：再高既有内存压力，也超出「一张长图」的实际用途
const MAX_LONG_HEIGHT: usize = 14_000;
/// 探测带高度：用新帧的这一段去旧图里找位置
const PROBE_ROWS: usize = 24;
/// 预览缩略图的目标宽度（物理像素）
const PREVIEW_WIDTH: usize = 240;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScrollResult {
    pub png_base64: String,
    pub width: u32,
    pub height: u32,
    pub pages: u32,
    /// 给用户看的收尾说明（到底了 / 没检测到重叠 等）
    pub note: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ScrollProgress {
    height: u32,
    pages: u32,
    /// 缩略预览 PNG（base64），HUD 直接当 <img> 用
    preview: String,
    /// 是否正在注入滚轮（false = 手动滚动模式）
    auto: bool,
    note: String,
}

/// 可变拼接态：只有会话线程写。放进 Mutex 是因为会话本体在 Arc 里共享。
struct StitchState {
    acc: Vec<u8>,
    rows: usize,
    hashes: Vec<u64>,
    pages: u32,
}

struct ScrollSession {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    max_pages: u32,
    stitch: Mutex<StitchState>,
    note: Mutex<String>,
    /// 注入滚轮（自动滚动）还是等用户自己滚
    auto: AtomicBool,
    /// 用户点了「完成」
    finish: AtomicBool,
    /// 用户点了「取消」
    cancel: AtomicBool,
}

static SESSION: Mutex<Option<Arc<ScrollSession>>> = Mutex::new(None);
static RESULT: Mutex<Option<ScrollResult>> = Mutex::new(None);

fn lock_stitch(session: &ScrollSession) -> std::sync::MutexGuard<'_, StitchState> {
    // 锁损坏只在进程级故障时发生；这里拿不到锁就只能放弃这一帧
    match session.stitch.lock() {
        Ok(g) => g,
        Err(poisoned) => poisoned.into_inner(),
    }
}

fn set_note(session: &ScrollSession, text: &str) {
    if let Ok(mut note) = session.note.lock() {
        *note = text.into();
    }
}
fn note_of(session: &ScrollSession) -> String {
    session.note.lock().map(|n| n.clone()).unwrap_or_default()
}

/* ---------- 拼接算法（原样保留自 snip.rs，带单测） ---------- */

/// 每行一个采样哈希（FNV-1a）。
fn row_hashes(buf: &[u8], width: usize, height: usize) -> Vec<u64> {
    let stride = width * 4;
    let mut out = Vec::with_capacity(height);
    if stride == 0 {
        return out;
    }
    for y in 0..height {
        let start = y * stride;
        let row = &buf[start..(start + stride).min(buf.len())];
        let mut h = 0xcbf2_9ce4_8422_2325u64;
        let mut i = 0;
        while i + 4 <= row.len() {
            h ^= u64::from(u32::from_le_bytes([row[i], row[i + 1], row[i + 2], row[i + 3]]));
            h = h.wrapping_mul(0x0000_0100_0000_01b3);
            i += ROW_SAMPLE_STEP;
        }
        out.push(h);
    }
    out
}

/// 在新帧里取一段「探测带」去旧图里找它的位置，返回新帧第 0 行对应旧图的第几行。
///
/// 从 1/4 高度取样而不是顶行：网页常见的固定顶栏（sticky header）永远不动，
/// 用顶行做匹配会永远对不上，表现为「检测不到重叠、整帧重复粘贴」。
fn find_shift(acc: &[u64], frame: &[u64]) -> Option<usize> {
    if acc.len() < PROBE_ROWS || frame.len() < PROBE_ROWS + 8 {
        return None;
    }
    let probe_start = (frame.len() / 4).min(frame.len() - PROBE_ROWS);
    let probe = &frame[probe_start..probe_start + PROBE_ROWS];
    let last = acc.len() - PROBE_ROWS;
    for p in (0..=last).rev() {
        if acc[p] == probe[0] && acc[p..p + PROBE_ROWS] == probe[..] {
            return Some(p.saturating_sub(probe_start));
        }
    }
    None
}

/// 盒式降采样（整块平均），给 HUD 生成缩略预览。宽度对齐 PREVIEW_WIDTH。
fn downscale_rgba(src: &[u8], width: usize, height: usize) -> Vec<u8> {
    if width == 0 || height == 0 || width <= PREVIEW_WIDTH {
        return src.to_vec();
    }
    let scale = width as f64 / PREVIEW_WIDTH as f64;
    let tw = PREVIEW_WIDTH;
    let th = ((height as f64) / scale).ceil() as usize;
    let bx = (width as f64 / tw as f64).ceil() as usize;
    let by = (height as f64 / th.max(1) as f64).ceil() as usize;
    let mut out = vec![0u8; tw * th * 4];
    for ty in 0..th {
        let y0 = (ty * by).min(height);
        let y1 = ((ty + 1) * by).min(height);
        for tx in 0..tw {
            let x0 = (tx * bx).min(width);
            let x1 = ((tx + 1) * bx).min(width);
            let (mut r, mut g, mut b, mut n) = (0u64, 0u64, 0u64, 0u64);
            for y in y0..y1 {
                let row = y * width * 4;
                for x in x0..x1 {
                    r += src[row + x * 4] as u64;
                    g += src[row + x * 4 + 1] as u64;
                    b += src[row + x * 4 + 2] as u64;
                    n += 1;
                }
            }
            if n == 0 {
                n = 1;
            }
            let d = (ty * tw + tx) * 4;
            out[d] = (r / n) as u8;
            out[d + 1] = (g / n) as u8;
            out[d + 2] = (b / n) as u8;
            out[d + 3] = 255;
        }
    }
    out
}

/* ---------- 会话 ---------- */

/// 会话内的容错抓屏：带 CAPTUREBLT 失败（系统偶发拒绝访问 gle=5，实测多与
/// 显示变暗/DWM 状态转换相关）→ 换无 CAPTUREBLT 再试 → 仍失败短暂等待后重试。
/// 层叠窗不在选区内时无 CAPTUREBLT 结果完全等价，长截图因此几乎不可能被卡死。
#[cfg(windows)]
fn capture_frame(session: &ScrollSession) -> Option<Vec<u8>> {
    for attempt in 0..3 {
        if attempt > 0 {
            std::thread::sleep(std::time::Duration::from_millis(250));
        }
        if let Ok(buf) = crate::commands::snip::capture_rect_pub(session.x, session.y, session.width, session.height) {
            return Some(buf);
        }
        if let Ok(buf) =
            crate::commands::snip::capture_rect_layered_pub(session.x, session.y, session.width, session.height, false)
        {
            return Some(buf);
        }
    }
    // 现场取证：区域被拒时看整屏是否也被拒 + 光标状态，用来区分环境问题与代码问题。
    let full = crate::commands::snip::monitors_pub().into_iter().find(|m| m.4);
    if let Some((mx, my, mw, mh, _)) = full {
        let full_ok = crate::commands::snip::capture_rect_pub(mx, my, mw, mh).is_ok();
        eprintln!(
            "[scroll] region denied; full-monitor capture ok={full_ok}; cursor={}",
            crate::commands::snip::cursor_state_probe_pub()
        );
    }
    None
}

/// 启动长截图会话（fire-and-forget）：建 HUD、隐藏覆盖层、开拼接线程。
///
/// 必须是 async 命令但**不等待会话**：整段流程 5–20 秒，由事件通知前端。
#[tauri::command]
pub async fn snip_scroll_start(
    app: tauri::AppHandle,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    max_pages: Option<u32>,
) -> AppResult<String> {
    #[cfg(windows)]
    {
        use tauri::Manager;
        if width < 24 || height < 24 {
            return Err(AppError::validation("选区太小，滚不出内容。"));
        }
        if u64::from(width) * u64::from(height) > 100_000_000 {
            return Err(AppError::validation("选区过大，无法滚动截图。"));
        }
        {
            let mut slot = SESSION.lock().map_err(|_| AppError::new("internal", "长截图状态锁已损坏。"))?;
            if slot.is_some() {
                return Err(AppError::validation("已有进行中的长截图。"));
            }
        }
        let app2 = app.clone();
        let _ = app.run_on_main_thread(move || {
            if let Err(e) = ensure_hud(&app2, (x, y, width, height)) {
                eprintln!("[scroll] hud failed: {e}");
            }
        });
        let session = Arc::new(ScrollSession {
            x,
            y,
            width,
            height,
            max_pages: max_pages.unwrap_or(24).clamp(2, 60),
            stitch: Mutex::new(StitchState { acc: Vec::new(), rows: 0, hashes: Vec::new(), pages: 0 }),
            note: Mutex::new(String::new()),
            auto: AtomicBool::new(true),
            finish: AtomicBool::new(false),
            cancel: AtomicBool::new(false),
        });
        {
            let mut slot = SESSION.lock().map_err(|_| AppError::new("internal", "长截图状态锁已损坏。"))?;
            *slot = Some(session.clone());
        }
        std::thread::spawn(move || run_session(app, session));
        Ok("started".into())
    }
    #[cfg(not(windows))]
    {
        let _ = (&app, x, y, width, height, max_pages);
        Err(AppError::validation("长截图目前只支持 Windows。"))
    }
}

/// 切换自动/手动滚动（HUD 的「暂停自动滚」按钮）。
#[tauri::command]
pub fn snip_scroll_set_auto(auto: bool) -> AppResult<()> {
    let slot = SESSION.lock().map_err(|_| AppError::new("internal", "长截图状态锁已损坏。"))?;
    let session = slot.as_ref().ok_or_else(|| AppError::not_found("没有进行中的长截图。"))?;
    session.auto.store(auto, Ordering::SeqCst);
    Ok(())
}

/// 完成：停住循环，把已拼好的内容编码出图。
#[tauri::command]
pub fn snip_scroll_finish() -> AppResult<String> {
    let slot = SESSION.lock().map_err(|_| AppError::new("internal", "长截图状态锁已损坏。"))?;
    let session = slot.as_ref().ok_or_else(|| AppError::not_found("没有进行中的长截图。"))?;
    session.finish.store(true, Ordering::SeqCst);
    Ok("finishing".into())
}

/// 取消：丢弃拼接结果。
#[tauri::command]
pub fn snip_scroll_cancel() -> AppResult<String> {
    let slot = SESSION.lock().map_err(|_| AppError::new("internal", "长截图状态锁已损坏。"))?;
    let session = slot.as_ref().ok_or_else(|| AppError::not_found("没有进行中的长截图。"))?;
    session.cancel.store(true, Ordering::SeqCst);
    Ok("cancelling".into())
}

/// 取走拼接结果（长图）。取完即清槽，防止同一个结果被重复复制。
#[tauri::command]
pub fn snip_scroll_take() -> AppResult<ScrollResult> {
    let mut slot = RESULT.lock().map_err(|_| AppError::new("internal", "长截图状态锁已损坏。"))?;
    slot.take().ok_or_else(|| AppError::not_found("长截图结果还没有生成。"))
}

/// 会话线程：滚 → 抓 → 拼 → 推预览，直到完成/取消/到底/到上限。
#[cfg(windows)]
fn run_session(app: tauri::AppHandle, session: Arc<ScrollSession>) {
    use tauri::Emitter;
    use tauri::Manager;
    let stride = session.width as usize * 4;
    let frame_rows = session.height as usize;
    eprintln!("[scroll] session thread start ({},{} {}x{})", session.x, session.y, session.width, session.height);
    // 会话期间保持显示器点亮：空闲/存在感应调暗会让 BitBlt 被拒（gle=5），长截图必开
    crate::commands::snip::keep_display_awake_pub();
    // 覆盖层先藏起来（否则会被拍进画面、滚轮也会被它截住）
    if let Some(win) = app.get_webview_window("snip") {
        let _ = win.hide();
    }
    std::thread::sleep(std::time::Duration::from_millis(180));
    crate::commands::snip::set_cursor_pos_pub(session.x + session.width as i32 / 2, session.y + session.height as i32 / 2);

    // 首帧：带重试 + 无 CAPTUREBLT 降级（见 capture_frame），基本不可能被一次抖动卡死。
    let first = match capture_frame(&session) {
        Some(buf) => buf,
        None => {
            let _ = app.emit("snip:scroll-failed", "抓取屏幕像素失败，请重试。");
            finish_up(&app);
            return;
        }
    };
    {
        let mut st = lock_stitch(&session);
        st.acc = first;
        st.rows = frame_rows;
        st.hashes = row_hashes(&st.acc, session.width as usize, st.rows);
        st.pages = 1;
    }
    // 给 HUD 一点挂载时间再开滚，用户能看着预览
    std::thread::sleep(std::time::Duration::from_millis(500));
    emit_progress(&app, &session);

    let mut idle_rounds = 0u32;
    loop {
        if session.cancel.load(Ordering::SeqCst) {
            let _ = app.emit("snip:scroll-cancelled", ());
            finish_up(&app);
            return;
        }
        if session.finish.load(Ordering::SeqCst) {
            break;
        }
        let auto = session.auto.load(Ordering::SeqCst);
        if auto {
            crate::commands::snip::wheel_down_pub(3);
            std::thread::sleep(std::time::Duration::from_millis(340));
        } else {
            std::thread::sleep(std::time::Duration::from_millis(320));
        }
        if session.cancel.load(Ordering::SeqCst) {
            let _ = app.emit("snip:scroll-cancelled", ());
            finish_up(&app);
            return;
        }
        if session.finish.load(Ordering::SeqCst) {
            break;
        }
        let Some(frame) = capture_frame(&session) else {
            // 连续多轮抓屏失败：提前收尾，把已拼好的内容出图并说明原因
            set_note(&session, "抓屏中途失败，已提前结束");
            break;
        };
        let frame_hashes = row_hashes(&frame, session.width as usize, frame_rows);
        let mut st = lock_stitch(&session);
        let grew = match find_shift(&st.hashes, &frame_hashes) {
            Some(shift) => {
                let fresh_from = st.rows.saturating_sub(shift);
                if fresh_from >= frame_rows {
                    false // 与已拼内容完全重合：这轮没滚出新东西
                } else {
                    st.acc.extend_from_slice(&frame[fresh_from * stride..]);
                    st.hashes.extend_from_slice(&frame_hashes[fresh_from..]);
                    st.rows += frame_rows - fresh_from;
                    st.pages += 1;
                    true
                }
            }
            None => {
                // 完全对不上（动画/异步加载/整页刷新）：整帧接上，至少不丢内容
                st.acc.extend_from_slice(&frame);
                st.hashes.extend_from_slice(&frame_hashes);
                st.rows += frame_rows;
                st.pages += 1;
                set_note(&session, "有一帧没检测到重叠，已直接拼接");
                true
            }
        };
        let rows = st.rows;
        let pages = st.pages;
        drop(st);
        idle_rounds = if grew { 0 } else { idle_rounds + 1 };

        emit_progress(&app, &session);

        if rows >= MAX_LONG_HEIGHT {
            set_note(&session, &format!("已拼接 {pages} 屏，达到 {MAX_LONG_HEIGHT}px 高度上限"));
            break;
        }
        if pages >= session.max_pages {
            set_note(&session, &format!("已拼接 {pages} 屏，达到页数上限"));
            break;
        }
        // 自动模式连续两轮没新内容 = 到底了；手动模式不打扰，等用户自己来
        if auto && idle_rounds >= 2 {
            set_note(&session, "已到底，没有更多内容");
            break;
        }
    }

    // 编码出图（线程里做，不占主线程）
    let (png_input, out_rows, pages) = {
        let mut st = lock_stitch(&session);
        let rows = st.rows.min(MAX_LONG_HEIGHT);
        st.acc.truncate(rows * stride);
        (std::mem::take(&mut st.acc), rows, st.pages)
    };
    match crate::commands::snip::encode_png_pub(session.width, out_rows as u32, &png_input) {
        Ok(png) => {
            let result = ScrollResult {
                png_base64: B64.encode(png),
                width: session.width,
                height: out_rows as u32,
                pages,
                note: note_of(&session),
            };
            if let Ok(mut slot) = RESULT.lock() {
                *slot = Some(result);
            }
            let _ = app.emit("snip:scroll-done", ());
        }
        Err(e) => {
            let _ = app.emit("snip:scroll-failed", e.to_string());
        }
    }
    finish_up(&app);
}

#[cfg(windows)]
fn emit_progress(app: &tauri::AppHandle, session: &ScrollSession) {
    use tauri::Emitter;
    let (preview, height, pages) = {
        let st = lock_stitch(session);
        let stride = session.width as usize * 4;
        let rows = st.rows.min(st.acc.len() / stride.max(1));
        let rgba = downscale_rgba(&st.acc, session.width as usize, rows);
        let preview_h = (rgba.len() / (PREVIEW_WIDTH * 4)).max(1) as u32;
        let png = crate::commands::snip::encode_png_pub(PREVIEW_WIDTH as u32, preview_h, &rgba)
            .map(|png| B64.encode(png))
            .unwrap_or_default();
        (png, st.rows as u32, st.pages)
    };
    let _ = app.emit(
        "snip:scroll-progress",
        ScrollProgress {
            height,
            pages,
            preview,
            auto: session.auto.load(Ordering::SeqCst),
            note: note_of(session),
        },
    );
}

/// 收尾：关 HUD、恢复 snip 覆盖层、清会话槽。cancel=true 时不动结果槽。
/// HUD 的 label 每次会话唯一（scrollhud-{stamp}），所以要关掉所有 scrollhud* 窗口。
#[cfg(windows)]
fn finish_up(app: &tauri::AppHandle) {
    use tauri::Manager;
    eprintln!("[scroll] finish_up");
    for (label, hud) in app.webview_windows() {
        if label.starts_with("scrollhud") {
            let _ = hud.close();
        }
    }
    if let Some(win) = app.get_webview_window("snip") {
        let _ = win.show();
        let _ = win.set_focus();
        if let (Ok(hwnd), Some((gx, gy, gw, gh))) = (win.hwnd(), crate::commands::snip::capture_geometry()) {
            crate::commands::snip::pin_geometry_pub(hwnd.0 as isize, gx, gy, gw as i32, gh as i32);
        }
    }
    let _ = SESSION.lock().map(|mut slot| *slot = None);
}

/* ---------- HUD 小窗 ---------- */

/// 把 HUD 摆到选区附近**不在选区里**的空档：下 > 上 > 右 > 左 > 显示器右下角。
/// HUD 若压进选区会被拍进长图，所以优先找屏内空隙。
/// HUD 尺寸按入参传（高 DPI 屏上物理尺寸 = 逻辑 300×380 × 缩放系数）。
fn hud_position(region: (i32, i32, u32, u32), monitor: (i32, i32, i32, i32), hud_w: i32, hud_h: i32) -> (i32, i32) {
    const GAP: i32 = 28;
    let (rx, ry, rw, rh) = (region.0, region.1, region.2 as i32, region.3 as i32);
    let (mx, my, mw, mh) = monitor;
    let bottom_free = my + mh - (ry + rh);
    let top_free = ry - my;
    let right_free = mx + mw - (rx + rw);
    let left_free = rx - mx;
    if bottom_free >= hud_h + GAP {
        return (rx + rw - hud_w, ry + rh + GAP / 2);
    }
    if top_free >= hud_h + GAP {
        return (rx + rw - hud_w, ry - hud_h - GAP / 2);
    }
    if right_free >= hud_w + GAP {
        return (rx + rw + GAP / 2, ry + (rh - hud_h) / 2);
    }
    if left_free >= hud_w + GAP {
        return (rx - hud_w - GAP / 2, ry + (rh - hud_h) / 2);
    }
    // 没空档：贴显示器右下角（整屏选区时 HUD 会被拍进去，属已知取舍）
    (mx + mw - hud_w - 16, my + mh - hud_h - 16)
}

/// 建 HUD 窗口。在主线程上建（run_on_main_thread 里调用，与吉祥物预热同路）。
///
/// · label 每次会话唯一（scrollhud-{stamp}）：上一个 HUD 正在异步销毁时立刻复用同一
///   label 会撞 Tauri 的窗口管理器（实测会造成建窗挂死/建不出来两种竞态），
///   收尾时统一按前缀关掉所有 scrollhud*。
/// · 高 DPI：窗口逻辑尺寸 300×380，物理尺寸 = 逻辑 × 显示器缩放（150% 屏上 450×570）。
///   必须放大物理尺寸，否则 150% 屏上 HUD 只有 200 CSS px 宽，按钮行会溢出。
/// · 先隐藏建窗 → 读缩放系数算物理尺寸 → place_physical 摆到位 → 再显示。
#[cfg(windows)]
fn ensure_hud(app: &tauri::AppHandle, region: (i32, i32, u32, u32)) -> AppResult<()> {
    use tauri::Manager;
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let win = tauri::WebviewWindowBuilder::new(
        app,
        format!("scrollhud-{stamp}"),
        tauri::WebviewUrl::App(format!("index.html?win=scrollhud&v={stamp}").into()),
    )
    .title("WorkTop 长截图")
    .inner_size(300.0, 380.0)
    .position(0.0, 0.0)
    .decorations(false)
    .transparent(true)
    .shadow(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(false)
    .focused(true)
    .visible(false)
    .background_color(tauri::window::Color(0, 0, 0, 0))
    .build()
    .map_err(|e| AppError::new("internal", format!("创建长截图预览窗失败：{e}")))?;
    eprintln!("[scroll] hud window built");
    let scale = win.scale_factor().unwrap_or(1.0);
    let hud_w = (300.0 * scale).round() as i32;
    let hud_h = (380.0 * scale).round() as i32;
    // 找选区所在的显示器
    let monitor = crate::commands::snip::monitors_pub()
        .into_iter()
        .map(|m| (m.0, m.1, m.2 as i32, m.3 as i32))
        .find(|m| region.0 >= m.0 && region.0 < m.0 + m.2 && region.1 >= m.1 && region.1 < m.1 + m.3)
        .unwrap_or((0, 0, 1920, 1080));
    let (hx, hy) = hud_position(region, monitor, hud_w, hud_h);
    if let Ok(hwnd) = win.hwnd() {
        crate::commands::snip::place_physical(hwnd.0 as isize, hx, hy, hud_w, hud_h);
    }
    let _ = win.show();
    Ok(())
}

/* ---------- 单测 ---------- */

#[cfg(test)]
mod tests {
    use super::*;

    /// 长截图的重叠检测：造两张「滚动了 N 行」的图，验证能算出正确位移。
    #[test]
    fn find_shift_detects_scroll_position() {
        let width = 4usize;
        let content: Vec<Vec<u8>> = (0..200u8)
            .map(|y| (0..width * 4).map(|i| if i % 4 == 0 { y } else { 128 }).collect())
            .collect();
        let flatten = |from: usize, rows: usize| -> Vec<u8> {
            let mut out = Vec::new();
            for row in content.iter().skip(from).take(rows) {
                out.extend_from_slice(row);
            }
            out
        };
        let first = flatten(0, 100);
        let acc = row_hashes(&first, width, 100);

        let second = flatten(30, 100);
        let frame = row_hashes(&second, width, 100);
        assert_eq!(find_shift(&acc, &frame), Some(30));
        assert_eq!(find_shift(&acc, &row_hashes(&first, width, 100)), Some(0));

        let fresh: Vec<u8> = (0..100 * width * 4).map(|i| (i % 251) as u8).collect();
        assert_eq!(find_shift(&acc, &row_hashes(&fresh, width, 100)), None);
    }

    #[test]
    fn row_hashes_are_stable_and_distinct() {
        let width = 64usize;
        let mut buf = vec![0u8; width * 4 * 3];
        for y in 0..3 {
            for x in 0..width {
                buf[(y * width + x) * 4] = (y * 10 + x) as u8;
            }
        }
        let h = row_hashes(&buf, width, 3);
        assert_eq!(h.len(), 3);
        assert_ne!(h[0], h[1]);
        assert_ne!(h[1], h[2]);
        assert_eq!(h, row_hashes(&buf, width, 3));
    }

    /// 盒式降采样：宽度收窄到目标、高度等比、内容大致保真
    #[test]
    fn downscale_shrinks_width_proportionally() {
        let width = 480usize;
        let height = 200usize;
        let src: Vec<u8> = (0..width * height * 4).map(|i| (i % 256) as u8).collect();
        let out = downscale_rgba(&src, width, height);
        assert_eq!(out.len(), PREVIEW_WIDTH * 100 * 4);
        // 已小于目标宽度的图原样返回
        let small = vec![1u8; 8 * 8 * 4];
        assert_eq!(downscale_rgba(&small, 8, 8).len(), small.len());
    }

    /// HUD 摆位：优先塞进选区下方的空档，绝不压进选区（尺寸入参化，适配高 DPI 放大）
    #[test]
    fn hud_position_prefers_gap_below_region() {
        // 选区在屏幕上半部 → HUD 放选区正下方
        let p = hud_position((100, 100, 600, 400), (0, 0, 1920, 1080), 300, 380);
        assert_eq!(p, (400, 514));
        // 选区贴着屏幕底 → 放右边
        let p = hud_position((100, 100, 600, 900), (0, 0, 1920, 1080), 300, 380);
        assert_eq!(p, (714, 360));
        // 整屏选区 → 右下角（已知取舍：会被拍进长图）
        let p = hud_position((0, 0, 1920, 1080), (0, 0, 1920, 1080), 300, 380);
        assert_eq!(p, (1604, 684));
        // 150% 缩放屏：HUD 物理尺寸放大到 450×570，同一选区仍不压进选区
        let p = hud_position((100, 100, 600, 400), (0, 0, 2560, 1600), 450, 570);
        assert_eq!(p, (250, 514));
        let p = hud_position((0, 0, 2560, 1600), (0, 0, 2560, 1600), 450, 570);
        assert_eq!(p, (2094, 1014));
    }
}
