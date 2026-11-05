// 桌面小组件位置管理：{id: {x,y}} 持久化 localStorage；首次出现用默认坐标，拖拽后更新。
import { reactive } from "vue"

export interface WidgetPos {
  x: number
  y: number
}

const DEFAULTS: Record<string, WidgetPos> = {
  clock: { x: 26, y: 22 },
  calendar: { x: 500, y: 48 },
  todo: { x: 26, y: 236 },
  notes: { x: 560, y: 332 },
}

const readLS = (): Record<string, WidgetPos> => {
  try {
    const raw = localStorage.getItem("pwb_widgets_v2")
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed
    }
  } catch {}
  return {}
}

const positions = reactive<Record<string, WidgetPos>>(readLS())

function persist() {
  try {
    localStorage.setItem("pwb_widgets_v2", JSON.stringify(positions))
  } catch {}
}

export function useWidgets() {
  const posOf = (id: string): WidgetPos => positions[id] ?? (positions[id] = { ...DEFAULTS[id] ?? { x: 24, y: 24 } })
  const setPos = (id: string, x: number, y: number) => {
    const cur = posOf(id)
    cur.x = Math.max(4, x)
    cur.y = Math.max(4, y)
    persist()
  }
  const flush = () => persist()
  return { posOf, setPos, flush }
}
