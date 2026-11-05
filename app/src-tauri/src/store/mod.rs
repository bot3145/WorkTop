// 存储基础：与 pwb-lite core/store.mjs 逐条对齐的底座。
// 约定：人类可读可编（Obsidian 共写），程序侧原子写（临时文件 + rename）；
//       整文档读改写走哈希 CAS，绝不盲目覆盖外部修改。
pub mod assets;
pub mod creds;
pub mod nav;
pub mod todo;
pub mod vault;

use sha2::{Digest, Sha256};
use std::fs;
use std::io;
use std::path::Path;

pub fn sha256_hex(text: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(text.as_bytes());
    let digest = hasher.finalize();
    let mut out = String::with_capacity(64);
    for byte in digest {
        use std::fmt::Write;
        let _ = write!(out, "{byte:02x}");
    }
    out
}

/// 单行化：字段值不允许换行（会破坏逐行解析），含换行的空白串压成单个空格。
/// 对齐 JS：value.replace(/\s*\r?\n\s*/gu, " ").trim()——不含换行的空白原样保留。
pub fn one_line(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    let mut run = String::new();
    for ch in value.chars() {
        if ch.is_whitespace() {
            run.push(ch);
            continue;
        }
        if !run.is_empty() {
            if run.contains('\n') || run.contains('\r') {
                out.push(' ');
            } else {
                out.push_str(&run);
            }
            run.clear();
        }
        out.push(ch);
    }
    if run.contains('\n') || run.contains('\r') {
        out.push(' ');
    }
    out.trim().to_string()
}

/// 按 /\r?\n/ 切行（保留空行，行内不含行尾符）。
pub fn split_lines(text: &str) -> Vec<String> {
    text.split('\n').map(|l| l.strip_suffix('\r').unwrap_or(l).to_string()).collect()
}

pub struct Doc {
    pub text: String,
    pub hash: String,
}

pub fn read_doc(path: &Path) -> io::Result<Option<Doc>> {
    match fs::read_to_string(path) {
        Ok(text) => Ok(Some(Doc { hash: sha256_hex(&text), text })),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error),
    }
}

/// 原子写：临时文件 + rename（Windows 上 std::fs::rename 走 MOVEFILE_REPLACE_EXISTING）。
/// 临时名带 pid + 随机后缀，避免并发写互相踩；失败时尽力清理临时文件。
pub fn write_doc(path: &Path, text: &str) -> Result<String, crate::error::AppError> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }
    let temp = path.with_extension(format!(
        "{}.{:x}.tmp",
        std::process::id(),
        rand_suffix()
    ));
    let result = (|| -> io::Result<()> {
        fs::write(&temp, text)?;
        // Windows 上 rename 到已存在目标走替换语义；文件被外部短暂占用时退避重试
        let mut last_err = None;
        for _ in 0..6 {
            match fs::rename(&temp, path) {
                Ok(()) => return Ok(()),
                Err(error) => {
                    last_err = Some(error);
                    std::thread::sleep(std::time::Duration::from_millis(120));
                }
            }
        }
        Err(last_err.unwrap_or_else(|| io::Error::new(io::ErrorKind::Other, "rename failed")))
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result.map_err(crate::error::AppError::from)?;
    Ok(sha256_hex(text))
}

fn rand_suffix() -> u64 {
    use aes_gcm::aead::rand_core::RngCore;
    let mut buf = [0u8; 8];
    aes_gcm::aead::OsRng.fill_bytes(&mut buf);
    u64::from_be_bytes(buf)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn one_line_matches_js_semantics() {
        assert_eq!(one_line("备注\n带换行"), "备注 带换行");
        assert_eq!(one_line("  a \r\n b  "), "a b");
        assert_eq!(one_line("a  b"), "a  b", "不含换行的空白原样保留");
        assert_eq!(one_line("a"), "a");
        assert_eq!(one_line(""), "");
        assert_eq!(one_line(" \n \n "), "");
        assert_eq!(one_line("a\tb"), "a\tb");
    }

    #[test]
    fn write_doc_is_atomic_and_roundtrips() {
        let dir = std::env::temp_dir().join(format!("pwb-store-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let file = dir.join("测试文档.md");
        let hash = write_doc(&file, "# 中文内容\n- [ ] 事项\n").unwrap();
        assert_eq!(hash, sha256_hex("# 中文内容\n- [ ] 事项\n"));
        assert_eq!(read_doc(&file).unwrap().unwrap().text, "# 中文内容\n- [ ] 事项\n");
        // 覆盖写（rename 替换语义）
        write_doc(&file, "v2").unwrap();
        assert_eq!(read_doc(&file).unwrap().unwrap().text, "v2");
        let _ = fs::remove_file(&file);
        let _ = fs::remove_dir(&dir);
    }
}
