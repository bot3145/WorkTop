// 桌面窗口管理器（壳内模拟窗口）：打开/关闭/最小化/最大化/焦点层叠/拖拽矩形，
// 布局持久化 localStorage，重启恢复上次会话打开的窗口。窗口内容是现有四面板（零功能改动）。
import { computed, ref } from "vue"

export type WinState = "normal" | "min" | "max"

export interface WinRect {
  id: string
  x: number
  y: number
  w: number
  h: number
  z: number
  state: WinState
  /** 最小化前的状态：从最大化直接最小化时，恢复要还原成最大化而不是"巨小的普通窗" */
  prevState?: WinState
  prev?: { x: number; y: number; w: number; h: number }
}

const MIN_W = 560
const MIN_H = 400

const readLS = (): WinRect[] => {
  try {
    const raw = localStorage.getItem("pwb_desktop")
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.filter((w) => w && typeof w.id === "string")
    }
  } catch {}
  return []
}

const wins = ref<WinRect[]>(readLS())
let topZ = wins.value.reduce((m, w) => Math.max(m, w.z), 10)
let cascade = 0

function persist() {
  try {
    localStorage.setItem("pwb_desktop", JSON.stringify(wins.value))
  } catch {}
}

export function useWindows() {
  const openIds = computed(() => new Set(wins.value.map((w) => w.id)))
  const activeId = computed(() => {
    const visible = wins.value.filter((w) => w.state !== "min")
    if (!visible.length) return null
    return visible.reduce((top, w) => (w.z > top.z ? w : top)).id
  })

  const focus = (id: string) => {
    const win = wins.value.find((w) => w.id === id)
    if (!win) return
    if (win.z !== topZ) {
      topZ += 1
      win.z = topZ
    }
  }

  const open = (id: string, def: { w: number; h: number }) => {
    const existing = wins.value.find((w) => w.id === id)
    if (existing) {
      if (existing.state === "min") existing.state = existing.prevState ?? "normal"
      existing.prevState = undefined
      focus(id)
      persist()
      return
    }
    const area = document.querySelector<HTMLElement>(".desktop-area")
    const areaW = area?.clientWidth ?? window.innerWidth
    const areaH = area?.clientHeight ?? window.innerHeight
    const w = Math.min(def.w, areaW - 40)
    const h = Math.min(def.h, areaH - 40)
    const step = (cascade++ % 5) * 28
    const rect: WinRect = {
      id,
      w,
      h,
      x: Math.max(12, Math.round((areaW - w) / 2) - 60 + step),
      y: Math.max(8, Math.round((areaH - h) / 2) - 50 + step),
      z: 0,
      state: "normal",
    }
    wins.value.push(rect)
    focus(id)
    persist()
  }

  const close = (id: string) => {
    wins.value = wins.value.filter((w) => w.id !== id)
    persist()
  }

  const closeAll = () => {
    wins.value = []
    persist()
  }

  const minimize = (id: string) => {
    const win = wins.value.find((w) => w.id === id)
    if (win && win.state !== "min") {
      win.prevState = win.state
      win.state = "min"
      persist()
    }
  }

  const toggleMax = (id: string, areaEl?: HTMLElement | null) => {
    const win = wins.value.find((w) => w.id === id)
    if (!win) return
    if (win.state === "max") {
      if (win.prev) Object.assign(win, win.prev, { state: "normal" as const })
      win.prev = undefined
      win.state = "normal"
    } else {
      const area = areaEl ?? document.querySelector<HTMLElement>(".desktop-area")
      win.prev = { x: win.x, y: win.y, w: win.w, h: win.h }
      win.x = 0
      win.y = 0
      win.w = area?.clientWidth ?? window.innerWidth
      win.h = area?.clientHeight ?? window.innerHeight
      win.state = "max"
    }
    focus(id)
    persist()
  }

  const setRect = (id: string, x: number, y: number, w?: number, h?: number, persistNow = true) => {
    const win = wins.value.find((r) => r.id === id)
    if (!win) return
    const area = document.querySelector<HTMLElement>(".desktop-area")
    const areaW = area?.clientWidth ?? window.innerWidth
    const areaH = area?.clientHeight ?? window.innerHeight
    win.x = Math.min(Math.max(-win.w + 120, x), areaW - 120)
    win.y = Math.min(Math.max(0, y), areaH - 44)
    if (w !== undefined) win.w = Math.max(MIN_W, Math.min(w, areaW))
    if (h !== undefined) win.h = Math.max(MIN_H, Math.min(h, areaH))
    if (persistNow) persist()
  }

  const restoreFromDock = (id: string) => {
    const win = wins.value.find((w) => w.id === id)
    if (!win) return
    if (win.state === "min") win.state = win.prevState ?? "normal"
    win.prevState = undefined
    focus(id)
    persist()
  }

  const flush = () => persist()
  return { wins, openIds, activeId, open, close, closeAll, minimize, toggleMax, focus, setRect, restoreFromDock, flush }
}
