// 本地文字识别（OCR）：直接用 Windows 自带的 Windows.Media.Ocr。
//
// 选它而不是 Tesseract/PaddleOCR sidecar 的理由：
//   · 零下载、零模型文件、零额外进程，exe 体积不变（WinRT 在系统里）；
//   · 中英混排和竖排由系统语言包处理，识别率对截图场景足够；
//   · 结果是**带坐标的行与词**，正好满足「就地划词 + 表格保列」。
// 代价：只支持 Windows，且识别语言取决于系统已安装的 OCR 语言包；
// 没有可用引擎时明确报错，由前端提示，而不是静默返回空结果。
use crate::error::{AppError, AppResult};
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use serde::Serialize;

#[derive(Serialize)]
pub struct OcrWord {
    pub text: String,
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
}

#[derive(Serialize)]
pub struct OcrLine {
    pub text: String,
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
    pub words: Vec<OcrWord>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrResult {
    pub width: u32,
    pub height: u32,
    /// 纯文本（表格列之间用成组空格对齐）
    pub text: String,
    pub lines: Vec<OcrLine>,
    /// 实际使用的识别语言（如 zh-Hans-CN），状态行里给用户看
    pub lang: String,
}

const MAX_OCR_BASE64: usize = 64 * 1024 * 1024;

/// 识别一张 PNG 里的文字。
///
/// async + spawn_blocking：WinRT 的 `.get()` 是阻塞等待，
/// 绝不能占住主线程（那会让覆盖窗在识别期间整个卡住）。
#[tauri::command]
pub async fn snip_ocr(png_base64: String) -> AppResult<OcrResult> {
    if png_base64.trim().is_empty() {
        return Err(AppError::validation("没有可识别的图像。"));
    }
    if png_base64.len() > MAX_OCR_BASE64 {
        return Err(AppError::validation("图像过大，请缩小选区后再识别。"));
    }
    tauri::async_runtime::spawn_blocking(move || run(&png_base64))
        .await
        .map_err(|e| AppError::new("internal", format!("识别任务异常：{e}")))?
}

#[cfg(windows)]
fn run(png_base64: &str) -> AppResult<OcrResult> {
    let bytes = B64
        .decode(png_base64.trim())
        .map_err(|e| AppError::validation(format!("图像数据无法解码：{e}")))?;
    winrt::recognize(&bytes)
}

#[cfg(not(windows))]
fn run(_png_base64: &str) -> AppResult<OcrResult> {
    Err(AppError::validation("文字识别目前只支持 Windows。"))
}

/// 把 WinRT 的浮点矩形换算成整数像素，并裁掉负值（个别词会略微越界）。
fn rect_of(r: &windows::Foundation::Rect) -> (i32, i32, i32, i32) {
    let x = r.X.max(0.0).round() as i32;
    let y = r.Y.max(0.0).round() as i32;
    (x, y, r.Width.max(1.0).round() as i32, r.Height.max(1.0).round() as i32)
}

/// 把一行里的词拼成文本，并尽量保住表格列：
/// 词间空隙超过「约两个字符宽」时插入成组空格，列与列之间就不会糊成一串。
fn line_text(words: &[OcrWord]) -> String {
    let mut out = String::new();
    let mut prev_right: Option<i32> = None;
    let mut prev_h = 12i32;
    for w in words {
        if let Some(right) = prev_right {
            let gap = w.x - right;
            let unit = (prev_h as f32 * 0.42).max(4.0);
            let spaces = if gap > unit as i32 { ((gap as f32 / unit).round() as usize).clamp(1, 12) } else { 1 };
            // 中日韩字符之间不需要空格；只有真正的水平间隙（大于 1.2 个字符宽）才补空格
            let need = gap as f32 > unit * 1.2;
            if need || !is_cjk_edge(&out, &w.text) {
                for _ in 0..spaces {
                    out.push(' ');
                }
            }
        }
        out.push_str(&w.text);
        prev_right = Some(w.x + w.w);
        prev_h = w.h.max(prev_h);
    }
    out.trim_end().to_string()
}

/// 判断拼接处两侧是否都是 CJK：中文词之间硬塞空格反而破坏可读性。
fn is_cjk_edge(left: &str, right: &str) -> bool {
    let l = left.chars().last();
    let r = right.chars().next();
    let cjk = |c: Option<char>| matches!(c, Some(c) if ('\u{4e00}'..='\u{9fff}').contains(&c) || ('\u{3000}'..='\u{303f}').contains(&c) || ('\u{ff00}'..='\u{ffef}').contains(&c));
    cjk(l) && cjk(r)
}

#[cfg(windows)]
mod winrt {
    use super::*;
    use windows::Graphics::Imaging::BitmapDecoder;
    use windows::Media::Ocr::OcrEngine;
    use windows::Storage::Streams::{DataWriter, InMemoryRandomAccessStream};

    fn init_apartment() {
        use windows::Win32::System::WinRT::{RoInitialize, RO_INIT_MULTITHREADED};
        unsafe {
            let _ = RoInitialize(RO_INIT_MULTITHREADED);
        }
    }

    fn err(what: &str, e: windows::core::Error) -> AppError {
        AppError::new("ocr", format!("{what}：{e}"))
    }

    /// 优先用用户配置语言；没有可用识别包时退回系统第一个可用语言。
    pub fn engine() -> AppResult<(OcrEngine, String)> {
        if let Ok(engine) = OcrEngine::TryCreateFromUserProfileLanguages() {
            let lang = engine
                .RecognizerLanguage()
                .and_then(|l| l.LanguageTag())
                .map(|t| t.to_string())
                .unwrap_or_else(|_| "自动".into());
            return Ok((engine, lang));
        }
        let langs = OcrEngine::AvailableRecognizerLanguages().map_err(|e| err("枚举识别语言失败", e))?;
        let count = langs.Size().unwrap_or(0);
        for i in 0..count {
            let Ok(lang) = langs.GetAt(i) else { continue };
            if let Ok(engine) = OcrEngine::TryCreateFromLanguage(&lang) {
                let tag = lang.LanguageTag().map(|t| t.to_string()).unwrap_or_else(|_| "自动".into());
                return Ok((engine, tag));
            }
        }
        Err(AppError::new(
            "ocr",
            "系统没有安装文字识别语言包。到「设置 → 时间和语言 → 语言」里给中文或英文添加「可选功能 → 光学字符识别」后重试。",
        ))
    }

    pub fn recognize(png: &[u8]) -> AppResult<OcrResult> {
        // WinRT 要求线程先有 COM 套间。tokio 的阻塞线程池会复用线程，
        // 重复初始化只会返回 S_FALSE，忽略即可；已处于 STA 时返回 RPC_E_CHANGED_MODE，
        // 同样可以继续用（识别是同步阻塞调用，不需要消息泵）。
        init_apartment();

        let stream = InMemoryRandomAccessStream::new().map_err(|e| err("创建内存流失败", e))?;
        let writer = DataWriter::CreateDataWriter(&stream).map_err(|e| err("创建写入器失败", e))?;
        writer.WriteBytes(png).map_err(|e| err("写入图像失败", e))?;
        writer.StoreAsync().map_err(|e| err("写入图像失败", e))?.join().map_err(|e| err("写入图像失败", e))?;
        writer.FlushAsync().map_err(|e| err("写入图像失败", e))?.join().map_err(|e| err("写入图像失败", e))?;
        let _ = writer.DetachStream();
        stream.Seek(0).map_err(|e| err("定位图像流失败", e))?;

        let decoder = BitmapDecoder::CreateAsync(&stream).map_err(|e| err("解码图像失败", e))?.join().map_err(|e| err("解码图像失败", e))?;
        let bitmap = decoder.GetSoftwareBitmapAsync().map_err(|e| err("转换位图失败", e))?.join().map_err(|e| err("转换位图失败", e))?;
        let (width, height) = (bitmap.PixelWidth().unwrap_or(0) as u32, bitmap.PixelHeight().unwrap_or(0) as u32);

        let (engine, lang) = engine()?;
        let result = engine.RecognizeAsync(&bitmap).map_err(|e| err("识别失败", e))?.join().map_err(|e| err("识别失败", e))?;

        let lines_vec = result.Lines().map_err(|e| err("读取识别结果失败", e))?;
        let count = lines_vec.Size().unwrap_or(0);
        let mut lines = Vec::with_capacity(count as usize);
        let mut plain: Vec<String> = Vec::with_capacity(count as usize);
        for i in 0..count {
            let Ok(line) = lines_vec.GetAt(i) else { continue };
            let text = line.Text().map(|t| t.to_string()).unwrap_or_default();
            if text.trim().is_empty() {
                continue;
            }
            let mut words = Vec::new();
            let mut min_x = i32::MAX;
            let mut min_y = i32::MAX;
            let mut max_x = i32::MIN;
            let mut max_y = i32::MIN;
            if let Ok(list) = line.Words() {
                for k in 0..list.Size().unwrap_or(0) {
                    let Ok(word) = list.GetAt(k) else { continue };
                    let Ok(r) = word.BoundingRect() else { continue };
                    let (x, y, w, h) = rect_of(&r);
                    let wt = word.Text().map(|t| t.to_string()).unwrap_or_default();
                    if wt.is_empty() {
                        continue;
                    }
                    min_x = min_x.min(x);
                    min_y = min_y.min(y);
                    max_x = max_x.max(x + w);
                    max_y = max_y.max(y + h);
                    words.push(OcrWord { text: wt, x, y, w, h });
                }
            }
            if words.is_empty() {
                continue;
            }
            let (x, y, w, h) = if min_x == i32::MAX {
                (0, 0, 0, 0)
            } else {
                (min_x, min_y, max_x - min_x, max_y - min_y)
            };
            plain.push(line_text(&words));
            lines.push(OcrLine { text, x, y, w, h, words });
        }
        if lines.is_empty() {
            return Err(AppError::new("ocr", "没有识别到文字，试试只框住文字区域或放大后再识别。"));
        }
        Ok(OcrResult { width, height, text: plain.join("\n"), lines, lang })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn word(text: &str, x: i32, w: i32) -> OcrWord {
        OcrWord { text: text.into(), x, y: 10, w, h: 20 }
    }

    /// 真机验证：现抓一张屏幕来识别（OCR_TEST_PNG 可指定现成图片）。
    ///   cargo test --bins ocr_smoke -- --ignored --nocapture
    /// 主要验证两件事：本机有可用的识别引擎；WinRT 全链路（解码 → 识别 → 取坐标）跑得通。
    #[cfg(windows)]
    #[test]
    #[ignore]
    fn ocr_smoke_on_file() {
        let (_, lang) = super::winrt::engine().expect("本机没有可用的 OCR 引擎");
        println!("engine lang = {lang}");
        let bytes = match std::env::var("OCR_TEST_PNG") {
            Ok(p) => std::fs::read(&p).expect("读取测试图片失败"),
            Err(_) => {
                let cap = super::super::snip::capture_for_test().expect("抓屏失败");
                B64.decode(&cap).expect("解码抓屏结果失败")
            }
        };
        match super::winrt::recognize(&bytes) {
            Ok(res) => {
                println!("{}x{} lines={}", res.width, res.height, res.lines.len());
                for line in res.lines.iter().take(8) {
                    println!("[{},{} {}x{}] {}", line.x, line.y, line.w, line.h, line.text);
                }
            }
            Err(e) => println!("识别未得到文字（抓到的屏幕可能没有文本）：{e}"),
        }
    }

    #[test]
    fn line_text_keeps_table_gaps() {
        // 两个词紧邻：一个空格
        assert_eq!(line_text(&[word("Hello", 0, 40), word("world", 44, 40)]), "Hello world");
        // 中间留出两三个字符的空隙：补成组空格，表格列不至于糊在一起
        let spaced = line_text(&[word("姓名", 0, 40), word("年龄", 160, 40)]);
        assert!(spaced.starts_with("姓名"), "{spaced}");
        assert!(spaced.len() > 5, "列间距应被保留：{spaced}");
        // 中文紧邻不加空格
        assert_eq!(line_text(&[word("工作", 0, 40), word("台面", 42, 40)]), "工作台面");
    }
}
