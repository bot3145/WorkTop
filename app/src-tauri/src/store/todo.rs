// 待办 Markdown 解析/序列化：对齐 pwb-lite core/todo.mjs。
// 语法：`- [ ] 文本 #标签 @2026-10-23`；与 Obsidian 任务清单兼容；行内缩进被忽略。
use super::split_lines;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TodoItem {
    pub line: i32, // 原文件行号；-1 = 新增（序列化时追加到末尾）
    pub done: bool,
    pub text: String,
    pub tags: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub due: Option<String>,
}

/// 解析行体：抽出全部 #标签 与第一个 @日期（其余 @日期仅移除），剩余为正文。
/// 与 JS 正则逐点对齐：#名 至少 1 字符（裸 # 保留原样）；@日期是子串匹配。
fn parse_body(rest: &str) -> (String, Vec<String>, Option<String>) {
    let chars: Vec<char> = rest.chars().collect();
    let mut text = String::with_capacity(rest.len());
    let mut tags: Vec<String> = Vec::new();
    let mut due: Option<String> = None;
    let is_date = |c: &[char], at: usize| -> bool {
        if at + 10 > c.len() {
            return false;
        }
        (0..4).all(|k| c[at + k].is_ascii_digit())
            && c[at + 4] == '-'
            && c[at + 5].is_ascii_digit()
            && c[at + 6].is_ascii_digit()
            && c[at + 7] == '-'
            && c[at + 8].is_ascii_digit()
            && c[at + 9].is_ascii_digit()
    };
    let mut i = 0;
    while i < chars.len() {
        let ch = chars[i];
        if ch == '#' {
            let mut j = i + 1;
            let mut name = String::new();
            while j < chars.len() && !chars[j].is_whitespace() && chars[j] != '#' && chars[j] != '@' {
                name.push(chars[j]);
                j += 1;
            }
            if name.is_empty() {
                text.push('#'); // 裸 # 不是标签，原样保留
                i += 1;
            } else {
                tags.push(name);
                i = j;
            }
            continue;
        }
        if ch == '@' && is_date(&chars, i + 1) {
            if due.is_none() {
                let date: String = chars[i + 1..i + 11].iter().collect();
                due = Some(date);
            }
            i += 11;
            continue;
        }
        text.push(ch);
        i += 1;
    }
    (text.trim().to_string(), tags, due)
}

pub fn parse_todos(md: &str) -> Vec<TodoItem> {
    let mut items = Vec::new();
    for (idx, raw) in split_lines(md).iter().enumerate() {
        let t = raw.trim_start();
        let Some(after) = t.strip_prefix("- [") else { continue };
        let mark = after.chars().next();
        let done = match mark {
            Some(' ') => false,
            Some('x') | Some('X') => true,
            _ => continue,
        };
        // mark 是单字节 ASCII，直接跳过 1 字节再接 "] "
        let Some(body) = after.get(1..).and_then(|r| r.strip_prefix("] ")) else { continue };
        if body.is_empty() {
            continue; // (.+) 要求至少 1 字符
        }
        let (text, tags, due) = parse_body(body);
        items.push(TodoItem { line: idx as i32, done, text, tags, due });
    }
    items
}

fn item_line(item: &TodoItem) -> String {
    let mut meta = String::new();
    for tag in &item.tags {
        meta.push(' ');
        meta.push('#');
        meta.push_str(tag);
    }
    if let Some(due) = &item.due {
        meta.push_str(" @");
        meta.push_str(due);
    }
    format!("- [{}] {}{}", if item.done { "x" } else { " " }, item.text, meta)
}

/// 在原文上就地更新（按行号），新增项追加到末尾；去掉尾部空行，单个换行收尾。
pub fn serialize_todos(items: &[TodoItem], original: &str) -> String {
    let mut lines = split_lines(original);
    let fresh: Vec<&TodoItem> = items.iter().filter(|i| i.line < 0).collect();
    for item in items.iter().filter(|i| i.line >= 0) {
        let idx = item.line as usize;
        if idx < lines.len() {
            lines[idx] = item_line(item);
        }
    }
    // 先去掉尾部空行再追加：否则新增项前面会多出空行，且每次「加一条→删一条」都会多留一行
    while lines.last().is_some_and(|l| l.is_empty()) {
        lines.pop();
    }
    for item in fresh {
        lines.push(item_line(item));
    }
    let mut out = lines.join("\n");
    out.push('\n');
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = "# 待办\n\n- [ ] 带标签 #运维 @2026-10-23\n- [x] 已完成 事项\n- 普通行\n  - [ ] 缩进事项 #a\n- [ ] 裸#号 保留\n- [ ] 双日期 @2026-01-01 @2026-02-02\n";

    #[test]
    fn parse_extracts_tags_due_and_ignores_indent() {
        let items = parse_todos(SAMPLE);
        assert_eq!(items.len(), 5, "SAMPLE 含 5 条待办（普通行除外）");
        assert_eq!(items[0].text, "带标签");
        assert_eq!(items[0].tags, vec!["运维"]);
        assert_eq!(items[0].due.as_deref(), Some("2026-10-23"));
        assert_eq!(items[0].line, 2);
        assert!(items[1].done);
        assert_eq!(items[2].text, "缩进事项", "行首缩进被忽略");
        // JS 真相：#号 是合法标签（[^\s#@]+ 只要求非空白），裸 # 后跟非空白即成标签
        assert_eq!(items[3].text, "裸 保留");
        assert_eq!(items[3].tags, vec!["号"]);
        assert_eq!(items[4].due.as_deref(), Some("2026-01-01"), "双日期行取第一个");
    }

    #[test]
    fn serialize_updates_in_place_and_appends_fresh() {
        let mut items = parse_todos(SAMPLE);
        items[0].done = true;
        items[1].done = false;
        items.push(TodoItem { line: -1, done: false, text: "新事项".into(), tags: vec!["新".into()], due: Some("2026-12-31".into()) });
        let out = serialize_todos(&items, SAMPLE);
        assert!(out.contains("- [x] 带标签 #运维 @2026-10-23"));
        assert!(out.contains("- [ ] 已完成 事项"));
        assert!(out.ends_with("- [ ] 新事项 #新 @2026-12-31\n"), "新增追加且仅一个收尾换行");
        assert!(out.contains("- 普通行"), "无关行原样保留");
        // 幂等：再解析再序列化（无新增）结果不变
        let again = parse_todos(&out);
        assert_eq!(serialize_todos(&again, &out), out);
    }

    #[test]
    fn append_never_adds_blank_line_before_new_item() {
        // 原文件以换行结尾（常态）：新增项必须紧跟在最后一条之后，不能多出空行
        let original = "# 待办

- [ ] 甲
- [x] 乙
";
        let mut items = parse_todos(original);
        items.push(TodoItem { line: -1, done: false, text: "丙".into(), tags: vec![], due: None });
        let out = serialize_todos(&items, original);
        assert_eq!(out, "# 待办

- [ ] 甲
- [x] 乙
- [ ] 丙
");
        // 再追加一条：仍然紧跟上一行，不累积空行
        let mut items2 = parse_todos(&out);
        items2.push(TodoItem { line: -1, done: false, text: "丁".into(), tags: vec![], due: None });
        let out2 = serialize_todos(&items2, &out);
        assert_eq!(out2, "# 待办

- [ ] 甲
- [x] 乙
- [ ] 丙
- [ ] 丁
");
    }

    #[test]
    fn roundtrip_over_realistic_doc() {
        let md = "- [ ] 修复登录 #dev @2026-11-01\n- [x] 写周报\n\n- [ ] 复查 #qa\n";
        let items = parse_todos(md);
        assert_eq!(serialize_todos(&items, md), md);
    }
}
