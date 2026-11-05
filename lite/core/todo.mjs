// 待办 Markdown 解析/序列化：服务端与客户端共用同一份实现（构建时打进浏览器包）。
// 语法：`- [ ] 文本 #标签 @2026-10-23`；与 Obsidian 任务清单兼容。
export function parseTodos(md) {
  const items = []
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

export function serializeTodos(items, original) {
  const lines = original.split(/\r?\n/u)
  const byLine = new Map(items.filter((item) => item.line >= 0).map((item) => [item.line, item]))
  const fresh = items.filter((item) => item.line < 0)
  const meta = (item) => {
    const tags = item.tags.map((tag) => `#${tag}`).join(" ")
    return (tags ? ` ${tags}` : "") + (item.due ? ` @${item.due}` : "")
  }
  const out = lines.map((line, index) => {
    const item = byLine.get(index)
    return item ? `- [${item.done ? "x" : " "}] ${item.text}${meta(item)}` : line
  })
  // 先去掉尾部空行再追加（与 Rust/TS 版同序）：否则新增项前会多出空行并逐次累积
  while (out.length && out[out.length - 1] === "") out.pop()
  for (const item of fresh) out.push(`- [ ] ${item.text}${meta(item)}`)
  return `${out.join("\n")}\n`
}
