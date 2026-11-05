// 资产.md 解析/序列化：对齐 pwb-lite core/store.mjs。
// 形态：## 资产名 + `- 主机: 1.2.3.4` 字段行 + `- 链接: [名](url)` + `- 凭据: {JSON}`。
// 字段值一律单行化（防内容混入换行伪造字段行）；凭据行在迁移后归属 凭据.md。
use super::{one_line, split_lines};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AssetLink {
    pub label: String,
    pub url: String,
}

/// 凭据条目：落盘 JSON 的字段顺序与 pwb-lite normalizeEntry 一致（type/label/username 恒有）。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CredEntry {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(rename = "type", default = "default_type")]
    pub kind: String,
    #[serde(default)]
    pub label: String,
    #[serde(default)]
    pub username: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub passphrase: Option<String>,
    #[serde(default)]
    pub secret: String,
}

fn default_type() -> String {
    "password".into()
}

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
pub struct Asset {
    pub name: String,
    #[serde(default)]
    pub host: String,
    #[serde(default)]
    pub port: String,
    #[serde(default)]
    pub grp: String,
    #[serde(default)]
    pub project: String,
    #[serde(default)]
    pub note: String,
    #[serde(default)]
    pub links: Vec<AssetLink>,
    #[serde(default)]
    pub credentials: Vec<CredEntry>,
    #[serde(default)]
    pub last_status: String,
    #[serde(default)]
    pub last_check: String,
}

/// 行首 `- `/`* ` + 空白后的剩余内容（无标记返回 None）。
fn bullet_body(t: &str) -> Option<&str> {
    let rest = t.strip_prefix("- ").or_else(|| t.strip_prefix("* "))?;
    Some(rest.trim_start())
}

fn parse_link_tail(value: &str) -> Option<AssetLink> {
    let inner = value.strip_prefix('[')?;
    let close = inner.find("](")?;
    let label = &inner[..close];
    let tail = &inner[close + 2..];
    let inner_paren = tail.trim_end().strip_suffix(')')?;
    let url = inner_paren.trim();
    if url.is_empty() || url.chars().any(|c| c.is_whitespace()) {
        return None;
    }
    Some(AssetLink { label: label.to_string(), url: url.to_string() })
}

pub fn parse_assets(text: &str) -> Vec<Asset> {
    let mut assets: Vec<Asset> = Vec::new();
    for raw in split_lines(text) {
        if let Some(rest) = raw.strip_prefix("##") {
            let next = rest.chars().next();
            if next.is_some_and(char::is_whitespace) {
                let name = rest.trim();
                if !name.is_empty() {
                    assets.push(Asset { name: name.to_string(), ..Default::default() });
                    continue;
                }
            }
        }
        let Some(current) = assets.last_mut() else { continue };
        let Some(body) = bullet_body(&raw) else { continue };
        // 字段行：键 + 可选空白 + 半/全角冒号（全角是 3 字节，须按字符跳过）+ 值
        let colon = body.char_indices().find(|(_, ch)| *ch == ':' || *ch == '：').map(|(pos, ch)| (pos, ch.len_utf8()));
        let Some((pos, colon_len)) = colon else { continue };
        let key = body[..pos].trim();
        let value = body[pos + colon_len..].trim();
        match key {
            "主机" => current.host = value.to_string(),
            "端口" => current.port = value.to_string(),
            "分组" => current.grp = value.to_string(),
            "项目" => current.project = value.to_string(),
            "备注" => current.note = value.to_string(),
            "状态" => {
                let mut parts = value.split('·');
                current.last_status = parts.next().unwrap_or("").trim().to_string();
                current.last_check = parts.collect::<Vec<_>>().join("·").trim().to_string();
            }
            "链接" => {
                if let Some(link) = parse_link_tail(value) {
                    current.links.push(link);
                }
            }
            "凭据" => {
                if value.starts_with('{') && value.ends_with('}') {
                    if let Ok(entry) = serde_json::from_str::<CredEntry>(value) {
                        current.credentials.push(entry);
                    }
                }
            }
            _ => {}
        }
    }
    assets
}

pub fn serialize_assets(assets: &[Asset]) -> String {
    let mut lines: Vec<String> = vec!["# 资产".into(), String::new()];
    for asset in assets {
        lines.push(format!("## {}", one_line(&asset.name)));
        lines.push(String::new());
        if !asset.host.is_empty() {
            lines.push(format!("- 主机: {}", one_line(&asset.host)));
        }
        if !asset.port.is_empty() {
            lines.push(format!("- 端口: {}", one_line(&asset.port)));
        }
        if !asset.grp.is_empty() {
            lines.push(format!("- 分组: {}", one_line(&asset.grp)));
        }
        if !asset.project.is_empty() {
            lines.push(format!("- 项目: {}", one_line(&asset.project)));
        }
        if !asset.note.is_empty() {
            lines.push(format!("- 备注: {}", one_line(&asset.note)));
        }
        if !asset.last_status.is_empty() {
            let check = if asset.last_check.is_empty() {
                String::new()
            } else {
                format!(" · {}", one_line(&asset.last_check))
            };
            lines.push(format!("- 状态: {}{}", one_line(&asset.last_status), check));
        }
        for link in &asset.links {
            lines.push(format!("- 链接: [{}]({})", one_line(&link.label), one_line(&link.url)));
        }
        for credential in &asset.credentials {
            lines.push(format!("- 凭据: {}", serde_json::to_string(credential).unwrap_or_default()));
        }
        lines.push(String::new());
    }
    lines.join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    const PEM: &str = "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAA\n测试行==\n-----END OPENSSH PRIVATE KEY-----";

    #[test]
    fn roundtrip_idempotent_with_special_chars() {
        let assets = vec![Asset {
            name: "Web服务器(内网)".into(),
            host: "1.2.3.4".into(),
            port: "22".into(),
            grp: "生产".into(),
            project: "P|1".into(),
            note: "备注\n带换行".into(),
            links: vec![AssetLink { label: "控制台".into(), url: "https://a.b/c".into() }],
            credentials: vec![],
            last_status: "up".into(),
            last_check: "2026-10-26T00:00:00Z".into(),
        }];
        let text = serialize_assets(&assets);
        let back = parse_assets(&text);
        assert_eq!(back[0].name, "Web服务器(内网)");
        assert_eq!(back[0].note, "备注 带换行", "备注须单行化（防注入字段行）");
        assert_eq!(back[0].last_status, "up");
        assert_eq!(back[0].last_check, "2026-10-26T00:00:00Z");
        assert_eq!(serialize_assets(&back), text, "序列化须幂等");
    }

    #[test]
    fn credential_line_carries_multiline_secret_losslessly() {
        let entry = CredEntry {
            id: None,
            kind: "private-key".into(),
            label: "登录".into(),
            username: "root".into(),
            expires: Some("2027-01-01".into()),
            passphrase: None,
            secret: PEM.into(),
        };
        let text = serialize_assets(&[Asset { name: "主机A".into(), credentials: vec![entry.clone()], ..Default::default() }]);
        let back = parse_assets(&text);
        assert_eq!(back[0].credentials[0].secret, PEM, "多行私钥经 JSON 行落盘须无损");
        assert_eq!(back[0].credentials[0], entry);
    }

    #[test]
    fn full_width_colon_and_star_bullet_are_accepted() {
        let text = "# 资产\n\n## A\n* 主机：1.1.1.1\n- 状态：down · 2026-01-01T00:00:00Z\n";
        let back = parse_assets(text);
        assert_eq!(back[0].host, "1.1.1.1");
        assert_eq!(back[0].last_status, "down");
        assert_eq!(back[0].last_check, "2026-01-01T00:00:00Z");
    }
}
