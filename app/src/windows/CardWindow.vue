<script setup lang="ts">
// 单张桌面卡片（独立透明窗口）：整卡拖动换位置、右下角拖动改大小，松手即持久化。
// 组件沿用主界面的小组件（嵌入模式），功能不变。
import { computed, onMounted, onUnmounted, provide, ref, type Component } from "vue"
import { currentMonitor, getCurrentWindow, LogicalSize, type Monitor } from "@tauri-apps/api/window"
import { invoke } from "@tauri-apps/api/core"
import { emit, listen } from "@tauri-apps/api/event"
import { CARD_MIN, makeT, mergeConfig, snapRect, type CardKey, type Lang, type AppConfig, type T } from "../lib/config"
import { appDef } from "../lib/apps"
import ClockWidget from "../components/widgets/ClockWidget.vue"
import CalendarWidget from "../components/widgets/CalendarWidget.vue"
import TodoWidget from "../components/widgets/TodoWidget.vue"
import NotesWidget from "../components/widgets/NotesWidget.vue"
import AppsWidget from "../components/widgets/AppsWidget.vue"
import NavWidget from "../components/widgets/NavWidget.vue"
import AssetsWidget from "../components/widgets/AssetsWidget.vue"
import KeysWidget from "../components/widgets/KeysWidget.vue"
import AiWidget from "../components/widgets/AiWidget.vue"

const win = getCurrentWindow()
const key = (new URLSearchParams(location.search).get("card") ?? "clock") as CardKey | "ai"
const WIDGETS: Record<CardKey, Component> = {
  clock: ClockWidget,
  calendar: CalendarWidget,
  todo: TodoWidget,
  notes: NotesWidget,
  apps: AppsWidget,
  nav: NavWidget,
  assets: AssetsWidget,
  keys: KeysWidget,
  ai: AiWidget,
}
const widget = computed(() => WIDGETS[key] ?? ClockWidget)
const cfg = ref<AppConfig>(mergeConfig({}))
const dragging = ref(false)
const resizing = ref(false)

// 小组件依赖注入的 i18n（主窗口由 App.vue 提供，这里补齐）
const lang = ref<Lang>(
  ((): Lang => {
    try {
      return localStorage.getItem("pwb_lang") === "en" ? "en" : "zh"
    } catch {
      return "zh"
    }
  })(),
)
const tc = computed(() => makeT(lang.value))
provide<import("vue").ComputedRef<T>>("t", tc)
provide<import("vue").Ref<Lang>>("lang", lang)
// 嵌入模式：小组件铺满窗口，不再自己管位置/标题/拖拽手柄
provide("card-embed", true)

/** 卡片上的「打开」= 独立功能窗口；不唤起工作台主窗口（要工作台去点面板里的「工作台」按钮） */
function onOpenApp(id: string) {
  const def = appDef(id)
  if (!def) return
  void invoke("pane_open", { id, width: def.w, height: def.h }).catch(() => {})
}

async function scaleOf(): Promise<number> {
  const mon: Monitor | null = await currentMonitor().catch(() => null)
  return mon?.scaleFactor ?? window.devicePixelRatio ?? 1
}

let pending: { x: number; y: number } | null = null
let committing = false
async function flushPos() {
  committing = true
  try {
    while (pending) {
      const p = pending
      pending = null
      await win.setPosition(new (await import("@tauri-apps/api/window")).LogicalPosition(Math.round(p.x), Math.round(p.y))).catch(() => {})
    }
  } finally {
    committing = false
  }
}
function moveWindow(x: number, y: number) {
  pending = { x, y }
  if (!committing) void flushPos()
}

/* ---------- 拖动整卡 = 移动窗口（带磁吸） ---------- */
let drag: {
  sx: number
  sy: number
  wx: number
  wy: number
  w: number
  h: number
  moved: boolean
  peers: { x: number; y: number; w: number; h: number }[]
} | null = null

async function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  if ((e.target as HTMLElement).closest("button, a, input, textarea, select, .no-drag, .rs-grip")) return
  const sf = await scaleOf()
  const pos = await win.outerPosition().catch(() => null)
  const size = await win.innerSize().catch(() => null)
  if (!pos || !size) return
  // 拖动开始时抓一次其它卡片的位置做磁吸参考（拖动中不再变）
  const peers = await invoke<Array<{ x: number; y: number; w: number; h: number }>>("card_positions", {
    exclude: key,
    scale: sf,
  }).catch(() => [])
  drag = {
    sx: e.screenX,
    sy: e.screenY,
    wx: pos.x / sf,
    wy: pos.y / sf,
    w: size.width / sf,
    h: size.height / sf,
    moved: false,
    peers,
  }
  window.addEventListener("pointermove", onDragMove)
  window.addEventListener("pointerup", onDragUp)
}

function onDragMove(e: PointerEvent) {
  if (!drag) return
  const dx = e.screenX - drag.sx
  const dy = e.screenY - drag.sy
  if (!drag.moved && Math.hypot(dx, dy) < 3) return
  drag.moved = true
  dragging.value = true
  const snapped = snapRect(
    { x: drag.wx + dx, y: drag.wy + dy, w: drag.w, h: drag.h },
    drag.peers,
    { left: 0, top: 0, right: window.screen.availWidth, bottom: window.screen.availHeight },
  )
  moveWindow(snapped.x, snapped.y)
}

async function onDragUp() {
  window.removeEventListener("pointermove", onDragMove)
  window.removeEventListener("pointerup", onDragUp)
  const state = drag
  drag = null
  dragging.value = false
  if (!state?.moved) return
  await saveRect()
}

/* ---------- 右下角缩放 ---------- */
let rz: { sx: number; sy: number; w: number; h: number } | null = null

async function onResizeDown(e: PointerEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  e.stopPropagation()
  const sf = await scaleOf()
  const size = await win.innerSize().catch(() => null)
  if (!size) return
  rz = { sx: e.screenX, sy: e.screenY, w: size.width / sf, h: size.height / sf }
  resizing.value = true
  window.addEventListener("pointermove", onResizeMove)
  window.addEventListener("pointerup", onResizeUp)
}

function onResizeMove(e: PointerEvent) {
  if (!rz) return
  const min = CARD_MIN[key]
  const w = Math.max(min.w, Math.min(1200, rz.w + e.screenX - rz.sx))
  const h = Math.max(min.h, Math.min(1200, rz.h + e.screenY - rz.sy))
  void win.setSize(new LogicalSize(Math.round(w), Math.round(h))).catch(() => {})
}

async function onResizeUp() {
  window.removeEventListener("pointermove", onResizeMove)
  window.removeEventListener("pointerup", onResizeUp)
  rz = null
  resizing.value = false
  await saveRect()
}

/** AI 快问卡：带预填问题唤起工作台 AI 窗口 */
/** AI 快问卡：带预填问题打开独立的 AI 窗口 */
async function onAskAi(prompt: string) {
  await invoke("pane_open", { id: "ai", width: 780, height: 660, prompt }).catch(() => {})
}

async function saveRect() {
  const sf = await scaleOf()
  const pos = await win.outerPosition().catch(() => null)
  const size = await win.innerSize().catch(() => null)
  if (!pos || !size) return
  await invoke("card_save_rect", {
    key,
    x: pos.x / sf,
    y: pos.y / sf,
    width: size.width / sf,
    height: size.height / sf,
  }).catch(() => {})
  await invoke("card_to_bottom").catch(() => {})
  await emit("pwb-card-moved", { key })
}

let unlistenFns: Array<() => void> = []
let topTimer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  try {
    const st = await invoke<{ config: Record<string, unknown> }>("desktop_state")
    cfg.value = mergeConfig(st.config)
  } catch {}
  unlistenFns.push(
    await listen<AppConfig>("pwb-desktop-config", (e) => {
      cfg.value = mergeConfig(e.payload as unknown as Record<string, unknown>)
    }),
  )
  // 桌面层自检：Win+D 之类把卡片最小化后 30s 内自动回来，并保持沉底、不置顶
  topTimer = setInterval(() => void invoke("card_to_bottom").catch(() => {}), 30000)
})

onUnmounted(() => {
  for (const off of unlistenFns) off()
  unlistenFns = []
  if (topTimer) clearInterval(topTimer)
})
</script>

<template>
  <div class="card-win" :class="{ dragging, resizing }" :style="{ zoom: cfg.cardFontScale }" @pointerdown="onPointerDown">
    <component :is="widget" :key="key" @open-app="onOpenApp" @ask="onAskAi" />
    <div class="rs-grip" title="拖动缩放" @pointerdown="onResizeDown" />
  </div>
</template>

<style scoped>
.card-win { position: fixed; inset: 0; padding: 1px; box-sizing: border-box; background: transparent;
  user-select: none; }
.card-win.dragging { cursor: grabbing; }

.rs-grip { position: absolute; right: 2px; bottom: 2px; width: 16px; height: 16px; cursor: nwse-resize;
  opacity: 0; transition: opacity .15s; z-index: 9; }
.rs-grip::after { content: ""; position: absolute; right: 3px; bottom: 3px; width: 8px; height: 8px;
  border-right: 2px solid rgba(0,0,0,.35); border-bottom: 2px solid rgba(0,0,0,.35); border-bottom-right-radius: 3px; }
.card-win:hover .rs-grip { opacity: 1; }
</style>
