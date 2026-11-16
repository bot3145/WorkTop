// 贴图窗口（Pin）：把截图钉在屏幕最上层，可拖动、缩放、调透明度。
//
// 图像数据留两份：内存（id → PNG base64，窗口取图快）+ 磁盘 `<root>/cache/pins/<id>.png`。
// 磁盘那份配合 `<root>/pins.json`（几何清单）做**持久化**：应用重启后自动恢复所有贴图，
// 位置/缩放/透明度都还原。关闭贴图时同步删掉文件与清单条目，不留垃圾。
//
// 窗口尺寸一律用 Win32 物理像素摆放，保证贴图与原始像素 1:1，不受 DPI 换算影响。
use crate::commands::AppState;
use crate::error::{AppError, AppResult};
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use tauri::State;

struct Pin {
    png_base64: String,
    /// 贴图原始物理位置与尺寸（未缩放基准）：缩放时以它为基准重新摆窗，避免累计误差
    x: i32,
    y: i32,
    w: u32,
    h: u32,
    zoom: f64,
    opacity: f64,
}

/// 持久化清单里的一条（不含图像数据，图像在 cache/pins/<id>.png）
#[derive(Serialize, Deserialize, Clone)]
struct PinRecord {
    id: u32,
    x: i32,
    y: i32,
    w: u32,
    h: u32,
    #[serde(default = "one")]
    zoom: f64,
    #[serde(default = "one")]
    opacity: f64,
}
fn one() -> f64 {
    1.0
}

static PINS: Mutex<Option<HashMap<u32, Pin>>> = Mutex::new(None);
static NEXT_ID: AtomicU32 = AtomicU32::new(1);
/// 单张贴图上上限：贴着「剪贴板能装下」的量级，再大也没意义
const MAX_PIN_BASE64: usize = 48 * 1024 * 1024;
/// 同时存在的贴图数量上限：每个都是一整个 webview 进程，别让用户堆到爆内存
const MAX_PINS: usize = 24;

fn with_pins<T>(f: impl FnOnce(&mut HashMap<u32, Pin>) -> T) -> AppResult<T> {
    let mut guard = PINS.lock().map_err(|_| AppError::new("internal", "贴图状态锁已损坏。"))?;
    Ok(f(guard.get_or_insert_with(HashMap::new)))
}

fn pin_of(id: u32) -> AppResult<(i32, i32, u32, u32)> {
    with_pins(|map| map.get(&id).map(|p| (p.x, p.y, p.w, p.h)))?
        .ok_or_else(|| AppError::not_found("贴图已关闭。"))
}

/* ---------- 持久化 ---------- */

fn manifest_path(state: &AppState) -> PathBuf {
    state.file("pins.json")
}

fn pins_dir(state: &AppState) -> PathBuf {
    state.root().join("cache").join("pins")
}

/// 清单只存几何，几十字节一条；每次改动都全量重写，写放大可以忽略
fn save_manifest(state: &AppState) -> AppResult<()> {
    let records: Vec<PinRecord> = with_pins(|map| {
        let mut list: Vec<PinRecord> = map
            .iter()
            .map(|(id, p)| PinRecord {
                id: *id,
                x: p.x,
                y: p.y,
                w: p.w,
                h: p.h,
                zoom: p.zoom,
                opacity: p.opacity,
            })
            .collect();
        list.sort_by_key(|r| r.id);
        list
    })?;
    let dir = pins_dir(state);
    let _ = std::fs::create_dir_all(&dir);
    let text = serde_json::to_string_pretty(&records).map_err(|e| AppError::new("io", format!("序列化贴图清单失败：{e}")))?;
    std::fs::write(manifest_path(state), format!("{text}\n"))
        .map_err(|e| AppError::new("io", format!("写入贴图清单失败：{e}")))
}

/// 顺带删掉磁盘上的 PNG；清单由调用方统一重写
fn remove_pin_files(state: &AppState, id: u32) {
    let _ = std::fs::remove_file(pins_dir(state).join(format!("{id}.png")));
}

/* ---------- 建窗 ---------- */

/// 建窗核心（新贴图与启动恢复共用）。
///
/// 必须是 async：同步命令跑在主线程，而 `WebviewWindowBuilder::build()` 需要事件循环
/// 配合完成建窗，主线程里同步建窗会死锁（同 pane_open / workbench_open）。
async fn open_pin_window(app: &tauri::AppHandle, id: u32, rec: PinRecord) -> AppResult<()> {
    let label = format!("pin-{id}");
    let opacity = rec.opacity.clamp(0.15, 1.0);
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let url = format!("index.html?win=pin&id={id}&op={opacity}&v={stamp}");
    let zoom = if rec.zoom.is_finite() { rec.zoom.clamp(0.05, 8.0) } else { 1.0 };
    let win = tauri::WebviewWindowBuilder::new(app, &label, tauri::WebviewUrl::App(url.into()))
        .title("Worktop Pin")
        // 先给个极小尺寸：真实矩形下面用 Win32 物理像素定死，
        // 避免 Tauri 的逻辑像素换算在混合 DPI 下把贴图缩放一次。
        .inner_size(40.0, 40.0)
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
        .map_err(|e| AppError::new("internal", format!("创建贴图窗口失败：{e}")))?;
    let w = ((rec.w as f64 * zoom).round() as i64).clamp(8, 12000) as i32;
    let h = ((rec.h as f64 * zoom).round() as i64).clamp(8, 12000) as i32;
    #[cfg(windows)]
    if let Ok(hwnd) = win.hwnd() {
        crate::commands::snip::place_physical(hwnd.0 as isize, rec.x, rec.y, w, h);
    }
    #[cfg(not(windows))]
    {
        let _ = win.set_size(tauri::LogicalSize::new(f64::from(w), f64::from(h)));
        let _ = win.set_position(tauri::PhysicalPosition::new(rec.x, rec.y));
    }
    // 先不显示：等前端把图解码好再自己 show，避免屏幕上先出现一个透明空洞。
    // 窗口真销毁时只回收内存；**磁盘文件不动**——应用退出时所有窗口也会 Destroyed，
    // 那时不能把持久化数据删掉。删文件只走 pin_close（用户主动关）。
    // 只监听 Destroyed 而不是 CloseRequested —— 后者里再 close() 会自递归。
    win.on_window_event(move |event| {
        if matches!(event, tauri::WindowEvent::Destroyed) {
            let _ = with_pins(|map| map.remove(&id));
        }
    });
    let _ = win.show();
    Ok(())
}

/// 新建贴图窗口（截图工具条「贴图」入口）。
#[tauri::command]
pub async fn pin_open(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    png_base64: String,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
) -> AppResult<u32> {
    if png_base64.len() > MAX_PIN_BASE64 {
        return Err(AppError::validation("截图过大，无法贴图。"));
    }
    if width == 0 || height == 0 {
        return Err(AppError::validation("贴图尺寸不合法。"));
    }
    if with_pins(|map| map.len())? >= MAX_PINS {
        return Err(AppError::validation(format!("同时最多 {MAX_PINS} 张贴图，请先关掉几张。")));
    }
    let id = NEXT_ID.fetch_add(1, Ordering::SeqCst);
    with_pins(|map| {
        map.insert(
            id,
            Pin {
                png_base64: png_base64.clone(),
                x,
                y,
                w: width,
                h: height,
                zoom: 1.0,
                opacity: 1.0,
            },
        )
    })?;
    // 持久化：PNG 落盘 + 清单
    let bytes = B64
        .decode(png_base64.trim())
        .map_err(|e| AppError::validation(format!("截图数据无法解码：{e}")))?;
    let dir = pins_dir(&state);
    std::fs::create_dir_all(&dir).map_err(|e| AppError::new("io", format!("创建贴图缓存目录失败：{e}")))?;
    std::fs::write(dir.join(format!("{id}.png")), &bytes)
        .map_err(|e| AppError::new("io", format!("写入贴图文件失败：{e}")))?;
    save_manifest(&state)?;

    open_pin_window(&app, id, PinRecord { id, x, y, w: width, h: height, zoom: 1.0, opacity: 1.0 }).await?;
    Ok(id)
}

/// 启动恢复：读清单 → 逐个建窗（图还在就恢复，丢了就跳过并清理）。
pub fn restore_pins(app: tauri::AppHandle, root: std::path::PathBuf) {
    use tauri::Manager;
    tauri::async_runtime::spawn(async move {
        let text = match std::fs::read_to_string(root.join("pins.json")) {
            Ok(t) => t,
            Err(_) => return, // 没有清单 = 没有贴图，正常
        };
        let records: Vec<PinRecord> = match serde_json::from_str(&text) {
            Ok(r) => r,
            Err(_) => {
                let _ = std::fs::remove_file(root.join("pins.json"));
                return;
            }
        };
        let mut max_id = 0u32;
        let mut restored = 0usize;
        for rec in records.into_iter().take(MAX_PINS) {
            let path = root.join("cache").join("pins").join(format!("{}.png", rec.id));
            let Ok(bytes) = std::fs::read(&path) else {
                // 图没了：清掉这条幽灵记录
                let _ = std::fs::remove_file(&path);
                continue;
            };
            max_id = max_id.max(rec.id);
            // 窗口是靠 pin_image(id) 从内存取图的：先把内存态建好再开窗
            let png_base64 = B64.encode(bytes);
            let _ = with_pins(|map| {
                map.insert(
                    rec.id,
                    Pin {
                        png_base64,
                        x: rec.x,
                        y: rec.y,
                        w: rec.w,
                        h: rec.h,
                        zoom: rec.zoom,
                        opacity: rec.opacity,
                    },
                )
            });
            let app = app.clone();
            let r = rec.clone();
            if open_pin_window(&app, rec.id, r).await.is_ok() {
                restored += 1;
            }
        }
        if restored > 0 {
            // 内存态与磁盘清单对齐：NEXT_ID 跳过已用编号
            NEXT_ID.fetch_max(max_id + 1, Ordering::SeqCst);
        }
        // 顺手把清单收紧到实际恢复的窗口
        if let Some(state) = app.try_state::<AppState>() {
            let _ = save_manifest(&state);
        }
    });
}

/// 取贴图数据（前端解码成 data URL 显示）。
#[tauri::command]
pub fn pin_image(id: u32) -> AppResult<String> {
    with_pins(|map| map.get(&id).map(|p| p.png_base64.clone()))?
        .ok_or_else(|| AppError::not_found("贴图数据已释放。"))
}

/// 缩放：以原始尺寸为基准重算物理矩形，左上角锚定不动。
#[tauri::command]
pub fn pin_zoom(app: tauri::AppHandle, state: State<'_, AppState>, id: u32, zoom: f64) -> AppResult<()> {
    use tauri::Manager;
    let z = if zoom.is_finite() { zoom.clamp(0.05, 8.0) } else { 1.0 };
    let (x, y, w, h) = pin_of(id)?;
    with_pins(|map| {
        if let Some(p) = map.get_mut(&id) {
            p.zoom = z;
        }
    })?;
    let nw = ((f64::from(w) * z).round() as i64).clamp(8, 12000) as i32;
    let nh = ((f64::from(h) * z).round() as i64).clamp(8, 12000) as i32;
    let win = app
        .get_webview_window(&format!("pin-{id}"))
        .ok_or_else(|| AppError::not_found("贴图已关闭。"))?;
    #[cfg(windows)]
    if let Ok(hwnd) = win.hwnd() {
        crate::commands::snip::place_physical(hwnd.0 as isize, x, y, nw, nh);
    }
    #[cfg(not(windows))]
    {
        let _ = win.set_size(tauri::LogicalSize::new(f64::from(nw), f64::from(nh)));
    }
    save_manifest(&state)
}

/// 记下贴图被拖到的新位置：缩放时以当前位置为锚，而不是弹回原处。
#[tauri::command]
pub fn pin_move(state: State<'_, AppState>, id: u32, x: i32, y: i32) -> AppResult<()> {
    with_pins(|map| {
        if let Some(pin) = map.get_mut(&id) {
            pin.x = x;
            pin.y = y;
        }
    })?;
    save_manifest(&state)
}

/// 透明度是纯前端 CSS，但为了重启后还原，也要落到清单里。
#[tauri::command]
pub fn pin_set_opacity(state: State<'_, AppState>, id: u32, opacity: f64) -> AppResult<()> {
    let op = if opacity.is_finite() { opacity.clamp(0.05, 1.0) } else { 1.0 };
    with_pins(|map| {
        if let Some(pin) = map.get_mut(&id) {
            pin.opacity = op;
        }
    })?;
    save_manifest(&state)
}

#[tauri::command]
pub fn pin_close(app: tauri::AppHandle, state: State<'_, AppState>, id: u32) -> AppResult<()> {
    use tauri::Manager;
    if let Some(win) = app.get_webview_window(&format!("pin-{id}")) {
        let _ = win.close();
    }
    let _ = with_pins(|map| map.remove(&id));
    remove_pin_files(&state, id);
    save_manifest(&state)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pin_registry_keeps_geometry_and_releases() {
        let id = 999_001;
        with_pins(|map| {
            map.insert(
                id,
                Pin { png_base64: "x".into(), x: 10, y: 20, w: 100, h: 50, zoom: 1.0, opacity: 0.8 },
            )
        })
        .unwrap();
        assert_eq!(pin_of(id).unwrap(), (10, 20, 100, 50));
        with_pins(|map| {
            if let Some(p) = map.get_mut(&id) {
                p.x = 33;
                p.zoom = 2.0;
            }
        })
        .unwrap();
        assert_eq!(pin_of(id).unwrap().0, 33);
        assert_eq!(
            with_pins(|map| map.get(&id).map(|p| (p.zoom, p.opacity))).unwrap().unwrap(),
            (2.0, 0.8)
        );
        with_pins(|map| map.remove(&id));
        assert!(pin_of(id).is_err());
    }

    /// 清单序列化要能容忍旧版本没有 zoom/opacity 字段
    #[test]
    fn pin_records_parse_without_optional_fields() {
        let rec: PinRecord = serde_json::from_str(r#"{"id":7,"x":1,"y":2,"w":3,"h":4}"#).unwrap();
        assert_eq!((rec.id, rec.x, rec.w), (7, 1, 3));
        assert_eq!((rec.zoom, rec.opacity), (1.0, 1.0));
    }
}
