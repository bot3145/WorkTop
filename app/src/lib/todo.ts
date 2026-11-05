// 待办解析/序列化（TS 版）：与 pwb-lite core/todo.mjs 及 Rust store/todo.rs 三方一致。
// 客户端解析、整篇 PUT + baseHash CAS。
import type { TodoItem } from "./api"
export type { TodoItem }

export function parseTodos(md: string): TodoItem[] {
  const items: TodoItem[] = []
  md.split(/\r?\n/u).forEach((line, idx) => {
    const match = line.match(/^(\s*)- \[( |x|X)\] (.+)$/u)
    if (!match) return
    let rest = match[3]
    const due = (rest.match(/@(\d{4}-\d{2}-\d{2})/u) || [])[1] || null
    const tags = [...rest.matchAll(/#([^\s#@]+)/gu)].map((hit) => hit[1])
    rest = rest.replace(/@(\d{4}-\d{2}-\d{2})/gu, "").replace(/#([^\s#@]+)/gu, "").trim()
    items.push({ line: idx, done: match[2].toLowerCase() === "x", text: rest, tags, due })
  })
  return items
}

export function serializeTodos(items: TodoItem[], original: string): string {
  const lines = original.split(/\r?\n/u)
  const byLine = new Map(items.filter((item) => item.line >= 0).map((item) => [item.line, item]))
  const fresh = items.filter((item) => item.line < 0)
  const meta = (item: TodoItem) => {
    const tags = item.tags.map((tag) => `#${tag}`).join(" ")
    return (tags ? ` ${tags}` : "") + (item.due ? ` @${item.due}` : "")
  }
  const out = lines.map((line, index) => {
    const item = byLine.get(index)
    return item ? `- [${item.done ? "x" : " "}] ${item.text}${meta(item)}` : line
  })
  // 先去掉原文尾部空行，再追加新项；否则新增项前面会多出空行并逐次累积
  while (out.length && out[out.length - 1] === "") out.pop()
  for (const item of fresh) out.push(`- [ ] ${item.text}${meta(item)}`)
  return `${out.join("\n")}\n`
}
