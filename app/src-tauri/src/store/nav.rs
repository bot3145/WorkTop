// 导航.md 解析/序列化：对齐 pwb-lite core/store.mjs。
// 形态：# 导航 / ## 分类名 / - [标题](https://example.com)；只认 http(s) 链接，忽略其它行。
use super::{one_line, split_lines};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct NavLink {
    pub title: String,
    pub url: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct NavCategory {
    pub name: String,
    #[serde(default)]
    pub links: Vec<NavLink>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct NavDoc {
    #[serde(default)]
    pub categories: Vec<NavCategory>,
}

/// 解析 `- [标题](url)`：标题取到第一个 `](`，URL 必须是单个无空白 token，行尾只许空白。
fn parse_link_line(t: &str) -> Option<NavLink> {
    let rest = t.strip_prefix("- ").or_else(|| t.strip_prefix("* "))?;
    let rest = rest.trim_start();
    let inner = rest.strip_prefix('[')?;
    let close = inner.find("](")?;
    let title = &inner[..close];
    let tail = &inner[close + 2..]; // "](" 之后
    let trimmed_end = tail.trim_end();
    let inner_paren = trimmed_end.strip_suffix(')')?;
    let url = inner_paren.trim();
    if url.is_empty() || url.chars().any(|c| c.is_whitespace()) {
        return None;
    }
    let lower = url.to_ascii_lowercase();
    if !(lower.starts_with("http://") || lower.starts_with("https://")) {
        return None;
    }
    Some(NavLink { title: title.to_string(), url: url.to_string() })
}

pub fn parse_nav(text: &str) -> NavDoc {
    let mut categories: Vec<NavCategory> = Vec::new();
    for raw in split_lines(text) {
        // ## 后必须至少 1 个空白，名字非空
        if let Some(rest) = raw.strip_prefix("##") {
            let next = rest.chars().next();
            if next.is_some_and(char::is_whitespace) {
                let name = rest.trim();
                if !name.is_empty() {
                    categories.push(NavCategory { name: name.to_string(), links: Vec::new() });
                    continue;
                }
            }
        }
        if let Some(link) = parse_link_line(raw.trim_start()) {
            if let Some(current) = categories.last_mut() {
                current.links.push(link);
            }
        }
    }
    NavDoc { categories }
}

pub fn serialize_nav(nav: &NavDoc) -> String {
    let mut lines: Vec<String> = vec!["# 导航".into(), String::new()];
    for category in &nav.categories {
        lines.push(format!("## {}", one_line(&category.name)));
        lines.push(String::new());
        for link in &category.links {
            lines.push(format!("- [{}]({})", one_line(&link.title), one_line(&link.url)));
        }
        lines.push(String::new());
    }
    lines.join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_idempotent() {
        let nav = NavDoc {
            categories: vec![
                NavCategory {
                    name: "AI".into(),
                    links: vec![
                        NavLink { title: "GPT".into(), url: "https://chat.openai.com".into() },
                        NavLink { title: "带 空格 标题".into(), url: "https://a.b/c?x=1".into() },
                    ],
                },
                NavCategory { name: "工具".into(), links: vec![] },
            ],
        };
        let text = serialize_nav(&nav);
        assert_eq!(text, "# 导航\n\n## AI\n\n- [GPT](https://chat.openai.com)\n- [带 空格 标题](https://a.b/c?x=1)\n\n## 工具\n\n");
        let back = parse_nav(&text);
        assert_eq!(back, nav, "往返无损");
        assert_eq!(serialize_nav(&back), text, "序列化幂等");
    }

    #[test]
    fn parse_tolerates_noise() {
        let text = "# 导航\n\n## AI\n一些说明文字\n- [GPT](https://x.y)\n- [非http](ftp://a.b)\n- [空](  )\n##无空格标题\n- [孤链接](https://orphan)\n";
        let nav = parse_nav(text);
        // JS 真相：##无空格 不算标题；孤链接归上一节；非 http / 空 URL 行被忽略
        assert_eq!(nav.categories.len(), 1);
        assert_eq!(nav.categories[0].name, "AI");
        assert_eq!(
            nav.categories[0].links,
            vec![NavLink { title: "GPT".into(), url: "https://x.y".into() }, NavLink { title: "孤链接".into(), url: "https://orphan".into() }]
        );
    }
}
