// 统一错误：Tauri 命令返回 Err 时序列化为 { code, message, ...details }，
// 前端按 code 分流（conflict 附最新内容与哈希，与 pwb-lite 的 409 语义一致）。
use serde::{ser::SerializeMap, Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
#[error("{message}")]
pub struct AppError {
    pub code: &'static str,
    pub message: String,
    pub details: Option<serde_json::Value>,
}

// 序列化为扁平对象：{ code, message, ...details }——前端按 code 分流，
// conflict 附 currentText/currentHash（与 pwb-lite 的 409 载荷一致）。
impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let n = 2 + self.details.as_ref().and_then(|d| d.as_object()).map(|o| o.len()).unwrap_or(0);
        let mut map = serializer.serialize_map(Some(n))?;
        map.serialize_entry("code", self.code)?;
        map.serialize_entry("message", &self.message)?;
        if let Some(obj) = self.details.as_ref().and_then(|d| d.as_object()) {
            for (key, value) in obj {
                map.serialize_entry(key, value)?;
            }
        }
        map.end()
    }
}

impl AppError {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self { code, message: message.into(), details: None }
    }
    pub fn with(mut self, key: &str, value: impl Serialize) -> Self {
        let mut map = self.details.take().unwrap_or_else(|| serde_json::json!({}));
        if let Some(obj) = map.as_object_mut() {
            obj.insert(key.to_string(), serde_json::to_value(value).unwrap_or_default());
        }
        self.details = Some(map);
        self
    }
    pub fn validation(message: impl Into<String>) -> Self {
        Self::new("validation", message)
    }
    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new("not_found", message)
    }
    pub fn locked(message: impl Into<String>) -> Self {
        Self::new("locked", message)
    }
    pub fn conflict(message: impl Into<String>, current_text: &str, current_hash: &str) -> Self {
        Self::new("conflict", message).with("currentText", current_text).with("currentHash", current_hash)
    }
}

impl From<std::io::Error> for AppError {
    fn from(error: std::io::Error) -> Self {
        AppError::new("io", format!("文件操作失败：{error}"))
    }
}

pub type AppResult<T> = Result<T, AppError>;
