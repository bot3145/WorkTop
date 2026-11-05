// 主口令加密：scrypt(口令, salt) 派生 key + AES-256-GCM。
// 行级密文格式与 pwb-lite 完全一致：ENC:v1:<saltB64>:<ivB64>:<ctB64>（ct 含 GCM tag，标准带填充 base64）。
// 两端（Node 版 / Rust 版）可互相加解密同一份 凭据.md。
use crate::error::{AppError, AppResult};
use aes_gcm::aead::{Aead, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, Nonce};
use aes_gcm::aead::rand_core::RngCore;
use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use scrypt::scrypt as scrypt_kdf;
use scrypt::Params;

pub const ENC_PREFIX: &str = "ENC:v1:";

/// 与 Node 版同参：N=2^15, r=8, p=1，输出 32 字节密钥。
pub fn derive_key(passphrase: &str, salt: &[u8]) -> AppResult<[u8; 32]> {
    let params = Params::new(15, 8, 1, 32).map_err(|e| AppError::validation(format!("scrypt 参数不合法：{e}")))?;
    let mut key = [0u8; 32];
    scrypt_kdf(passphrase.as_bytes(), salt, &params, &mut key)
        .map_err(|e| AppError::new("internal", format!("密钥派生失败：{e}")))?;
    Ok(key)
}

pub fn encrypt_secret(plain: &str, key: &[u8; 32], salt_b64: &str) -> AppResult<String> {
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| AppError::new("internal", format!("密钥长度异常：{e}")))?;
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ct = cipher
        .encrypt(nonce, plain.as_bytes())
        .map_err(|e| AppError::new("internal", format!("加密失败：{e}")))?;
    Ok(format!("{ENC_PREFIX}{salt_b64}:{}:{}", B64.encode(nonce_bytes), B64.encode(&ct)))
}

/// 非密文原样返回；密文被篡改/口令不对 → Err（GCM 认证失败）。
pub fn decrypt_secret(encoded: &str, key: &[u8; 32]) -> AppResult<String> {
    if !encoded.starts_with(ENC_PREFIX) {
        return Ok(encoded.to_string());
    }
    let parts: Vec<&str> = encoded.split(':').collect();
    if parts.len() != 5 {
        return Err(AppError::validation("密文格式不合法。"));
    }
    let iv = B64.decode(parts[3]).map_err(|e| AppError::validation(format!("密文 iv 不合法：{e}")))?;
    let ct = B64.decode(parts[4]).map_err(|e| AppError::validation(format!("密文内容不合法：{e}")))?;
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| AppError::new("internal", format!("密钥长度异常：{e}")))?;
    let plain = cipher
        .decrypt(Nonce::from_slice(&iv), ct.as_slice())
        .map_err(|_| AppError::new("decrypt_failed", "解密失败：口令不对或密文已损坏。"))?;
    String::from_utf8(plain).map_err(|e| AppError::new("decrypt_failed", format!("解密后不是合法文本：{e}")))
}

pub fn is_encrypted(value: &str) -> bool {
    value.starts_with(ENC_PREFIX)
}

#[cfg(test)]
mod tests {
    use super::*;

    // 由 pwb-lite 的 Node 实现生成的跨实现向量（口令=口令abcd，salt=0123456789abcdef，
    // 明文=跨实现秘密）：保证 Rust 版能解开 Node 版加密的存量数据，双向兼容。
    const NODE_VECTOR: &str = "ENC:v1:MDEyMzQ1Njc4OWFiY2RlZg==:/OBkZfhA4J1iaflY:NGh4t3g4hbzsOqZEASImY00ub6cppPg3UBM1McaEhQ==";

    fn salt() -> Vec<u8> {
        b"0123456789abcdef".to_vec()
    }

    #[test]
    fn encrypt_decrypt_roundtrip() {
        let key = derive_key("口令abcd", &salt()).unwrap();
        let enc = encrypt_secret("秘密文本", &key, "MDEyMzQ1Njc4OWFiY2RlZg==").unwrap();
        assert!(is_encrypted(&enc));
        assert_eq!(decrypt_secret(&enc, &key).unwrap(), "秘密文本");
    }

    #[test]
    fn wrong_passphrase_or_tamper_fails() {
        let key = derive_key("口令abcd", &salt()).unwrap();
        let wrong = derive_key("错误口令", &salt()).unwrap();
        let enc = encrypt_secret("秘密文本", &key, "c2FsdA==").unwrap();
        assert!(decrypt_secret(&enc, &wrong).is_err(), "错口令必失败");
        let mut tampered = enc.clone();
        let last = tampered.pop().unwrap();
        tampered.push(if last == 'A' { 'B' } else { 'A' });
        assert!(decrypt_secret(&tampered, &key).is_err(), "密文被篡改必失败");
    }

    #[test]
    fn plaintext_passthrough() {
        let key = derive_key("口令abcd", &salt()).unwrap();
        assert_eq!(decrypt_secret("明文", &key).unwrap(), "明文");
    }

    #[test]
    fn decrypts_node_generated_ciphertext() {
        let key = derive_key("口令abcd", &salt()).unwrap();
        assert_eq!(decrypt_secret(NODE_VECTOR, &key).unwrap(), "跨实现秘密");
    }
}
