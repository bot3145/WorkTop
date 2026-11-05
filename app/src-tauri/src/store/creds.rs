// 凭据.md 解析/序列化：与 资产.md 同构（## 资产名 + `- 凭据: {JSON 或 ENC:v1:…}`）。
// 值保持原样字符串（密文行不解不开就不动）；同名小节合并到首见位置，保持文件行序。
use super::{one_line, split_lines};

/// 按资产名分组的原始凭据行（保持出现顺序）。
#[derive(Debug, Clone, Default, PartialEq)]
pub struct CredDoc {
    pub sections: Vec<(String, Vec<String>)>,
}

impl CredDoc {
    pub fn get(&self, asset: &str) -> Option<&Vec<String>> {
        self.sections.iter().find(|(name, _)| name == asset).map(|(_, list)| list)
    }
    pub fn get_mut(&mut self, asset: &str) -> &mut Vec<String> {
        if let Some(pos) = self.sections.iter().position(|(name, _)| name == asset) {
            return &mut self.sections[pos].1;
        }
        self.sections.push((asset.to_string(), Vec::new()));
        let last = self.sections.len() - 1;
        &mut self.sections[last].1
    }
    pub fn remove(&mut self, asset: &str) -> bool {
        let before = self.sections.len();
        self.sections.retain(|(name, _)| name != asset);
        self.sections.len() != before
    }
}

pub fn parse_cred_doc(text: &str) -> CredDoc {
    let mut doc = CredDoc::default();
    let mut current: Option<String> = None;
    for raw in split_lines(text) {
        if let Some(rest) = raw.strip_prefix("##") {
            let next = rest.chars().next();
            if next.is_some_and(char::is_whitespace) {
                let name = rest.trim();
                if !name.is_empty() {
                    doc.get_mut(name); // 确保小节存在（重名合并到首见）
                    current = Some(name.to_string());
                    continue;
                }
            }
        }
        let Some(asset) = &current else { continue };
        let Some(body) = raw.strip_prefix("- ").or_else(|| raw.strip_prefix("* ")) else { continue };
        let body = body.trim_start();
        let Some(value) = body.strip_prefix("凭据") else { continue };
        let value = value.trim_start();
        let value = value.strip_prefix(':').or_else(|| value.strip_prefix('：')).unwrap_or(value).trim();
        if !value.is_empty() {
            doc.get_mut(asset).push(value.to_string());
        }
    }
    doc
}

pub fn serialize_cred_doc(doc: &CredDoc) -> String {
    let mut lines: Vec<String> = vec!["# 凭据".into(), String::new()];
    for (asset, list) in &doc.sections {
        if list.is_empty() {
            continue;
        }
        lines.push(format!("## {}", one_line(asset)));
        lines.push(String::new());
        for entry in list {
            lines.push(format!("- 凭据: {entry}"));
        }
        lines.push(String::new());
    }
    lines.join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_preserves_raw_lines_and_order() {
        let enc = "ENC:v1:c2FsdA==:aXZpdg==:Y3QA";
        let text = format!("# 凭据\n\n## 主机A\n\n- 凭据: {{\"type\":\"password\",\"secret\":\"明文\"}}\n- 凭据: {enc}\n\n## 主机B\n\n- 凭据: {{\"type\":\"token\"}}\n");
        let doc = parse_cred_doc(&text);
        assert_eq!(doc.get("主机A").unwrap().len(), 2);
        assert_eq!(doc.get("主机A").unwrap()[1], enc, "密文行原样保留");
        assert_eq!(serialize_cred_doc(&doc), text, "往返无损");
    }

    #[test]
    fn duplicate_sections_merge_into_first() {
        let text = "# 凭据\n\n## A\n\n- 凭据: {\"a\":1}\n\n## A\n\n- 凭据: {\"b\":2}\n";
        let doc = parse_cred_doc(text);
        assert_eq!(doc.sections.len(), 1);
        assert_eq!(doc.get("A").unwrap().len(), 2);
    }

    #[test]
    fn remove_and_empty_sections() {
        let mut doc = parse_cred_doc("# 凭据\n\n## A\n\n- 凭据: {\"a\":1}\n\n## B\n\n- 凭据: {\"b\":2}\n");
        assert!(doc.remove("A"));
        assert!(!doc.remove("不存在"));
        let out = serialize_cred_doc(&doc);
        assert!(!out.contains("## A"));
        assert!(out.contains("## B"));
    }
}
