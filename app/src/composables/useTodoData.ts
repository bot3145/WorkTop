// 共享待办数据（小组件用）：模块级缓存，60s 轮询 + 手动刷新，避免多个组件重复拉取。
import { ref } from "vue"
import { call, type TextDoc } from "../lib/api"
import { parseTodos, type TodoItem } from "../lib/todo"

const raw = ref("")
const items = ref<TodoItem[]>(parseTodos(""))
let loaded = false
let timer: ReturnType<typeof setInterval> | null = null

export function useTodoData() {
  const refresh = async () => {
    try {
      const d = await call<TextDoc>("todo_get")
      raw.value = d.text
      items.value = parseTodos(d.text)
      loaded = true
    } catch {}
  }
  const ensure = () => {
    if (!loaded) void refresh()
    if (!timer) timer = setInterval(refresh, 60_000)
  }
  return { raw, items, refresh, ensure }
}
