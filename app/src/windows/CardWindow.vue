<script setup lang="ts">
// 单张桌面卡片（独立透明窗口）：整卡拖动换位置、右下角拖动改大小，松手即持久化。
// 组件沿用主界面的小组件（嵌入模式），功能不变。
import { computed, onMounted, onUnmounted, provide, ref, watch, nextTick, type Component } from "vue"
import { currentMonitor, getCurrentWindow, LogicalSize, type Monitor } from "@tauri-apps/api/window"
import { invoke } from "@tauri-apps/api/core"
import { emit, listen } from "@tauri-apps/api/event"
import { CARD_MIN, makeT, mergeConfig, snapRect, type CardKey, type Lang, type AppConfig, type T } from "../lib/config"
import { appDef } from "../lib/apps"
import ClockWidget from "../components/widgets/ClockWidget.vue"
import TodoWidget from "../components/widgets/TodoWidget.vue"
import NotesWidget from "../components/widgets/NotesWidget.vue"
import AppsWidget from "../components/widgets/AppsWidget.vue"
import NavWidget from "../components/widgets/NavWidget.vue"
import AssetsWidget from "../components/widgets/AssetsWidget.vue"
import KeysWidget from "../components/widgets/KeysWidget.vue"
import AiWidget from "../components/widgets/AiWidget.vue"
import Icon from "../components/Icon.vue"
import { ACCENTS, readAccent, type Accent } from "../lib/accent"

const win = getCurrentWindow()
const key = (new URLSearchParams(location.search).get("card") ?? "clock") as CardKey | "ai"
const WIDGETS: Record<CardKey, Component> = {
  clock: ClockWidget,
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

/** 锁定：锁住后不响应整卡拖动与右下角缩放（内容里的按钮/输入框照常可用），状态存进桌面配置 */
const locked = computed(() => cfg.value.cardLocked.includes(key))
// 锁定态用主题色标出来（灰白 chip 里看不出状态），跟随设置页切换
const accent = ref<Accent>(readAccent())
const accentColor = computed(() => ACCENTS[accent.value].accent)
function syncAccent() {
  accent.value = readAccent()
}
async function toggleLock(e: MouseEvent) {
  e.stopPropagation()
  const next = locked.value ? cfg.value.cardLocked.filter((k) => k !== key) : [...cfg.value.cardLocked, key]
  // 先本地更新（点击即时生效），再落盘；desktop_save 会把合并后的配置广播回来
  cfg.value = { ...cfg.value, cardLocked: next }
  await invoke("desktop_save", { patch: { cardLocked: next } }).catch(() => {})
}

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

/** 卡片 → 对应功能窗口（clock 是时间+日历组合卡，没有对应板块） */
const CARD_APP: Partial<Record<CardKey, string>> = {
  todo: "todo",
  notes: "note",
  apps: "apps",
  nav: "nav",
  assets: "assets",
  keys: "keys",
  ai: "ai",
}

/** 双击卡片：把这张卡对应的板块开到全屏（最大化），再点标题栏「还原」回到普通窗口 */
function onDblClick(e: MouseEvent) {
  const el = e.target as HTMLElement
  // 卡片里的按钮/输入框自己有点击语义，双击不抢
  if (el.closest("button, a, input, textarea, select, .no-drag, .rs-grip")) return
  const id = CARD_APP[key]
  if (!id) return
  const def = appDef(id)
  if (!def) return
  void invoke("pane_open", { id, width: def.w, height: def.h, maximized: true }).catch(() => {})
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
  if (locked.value) return
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
  if (e.button !== 0 || locked.value) return
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

/* ---------- 缩放手柄位置：跟到「内容展示区域」的右下角 ----------
 * 透明卡片内容直写壁纸、靠左上排布，手柄钉在窗口角落会和内容脱节（内容很短时尤其明显）。
 * 做法：取卡片内容里全部文本与叶子元素（按钮/图标/输入框）的视觉包围盒，
 * 手柄贴在包围盒右下角；内容为空或超出窗口时兜底贴内容盒右下角（内边距 13/12）。
 * 内容盒带 CSS zoom（cardFontScale），包围盒是视觉坐标，换算回布局坐标要除以 zoom。 */
const host = ref<HTMLElement | null>(null)
const grip = ref<HTMLElement | null>(null)
const lockBtn = ref<HTMLElement | null>(null)
let mo: MutationObserver | null = null
let rafPending = false

function scheduleGrip() {
  if (rafPending) return
  rafPending = true
  requestAnimationFrame(() => {
    rafPending = false
    layoutGrip()
  })
}

/** 卡片实际渲染内容的视觉包围盒（文本节点 + 交互/替换元素；跳过空白与不可见项） */
function inkExtent(root: HTMLElement) {
  let l = Infinity
  let t = Infinity
  let r = -Infinity
  let b = -Infinity
  const add = (x: number, y: number, w: number, h: number) => {
    if (w <= 0.5 || h <= 0.5) return
    if (x < l) l = x
    if (y < t) t = y
    if (x + w > r) r = x + w
    if (y + h > b) b = y + h
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node: Node | null
  while ((node = walker.nextNode())) {
    if (!(node.textContent ?? "").trim()) continue
    const range = document.createRange()
    range.selectNodeContents(node)
    for (const rect of range.getClientRects()) add(rect.left, rect.top, rect.width, rect.height)
  }
  for (const el of root.querySelectorAll<HTMLElement>("button, img, input, textarea, svg, canvas")) {
    if (!el.offsetParent && el.tagName !== "svg" && el.tagName !== "CANVAS") continue
    const rect = el.getBoundingClientRect()
    add(rect.left, rect.top, rect.width, rect.height)
  }
  if (r < l || b < t) return null
  return { left: l, top: t, right: r, bottom: b }
}

function layoutGrip() {
  const h = host.value
  const g = grip.value
  if (!h || !g) return
  const zoom = cfg.value.cardFontScale || 1
  const hostRect = h.getBoundingClientRect()
  const pad = 13 // 内容盒右/下内边距（WidgetShell 嵌入态 13/12）
  const GRIP = 16
  const ink = inkExtent(h)
  // 手柄右缘贴内容右缘外 6px，底缘与内容底缘对齐；越界时收进内容盒右下角
  let vx: number
  let vy: number
  if (ink) {
    vx = ink.right + 6
    vy = ink.bottom - GRIP
  } else {
    vx = hostRect.right - GRIP - pad
    vy = hostRect.bottom - GRIP - 12
  }
  const maxX = hostRect.right - GRIP - 2
  const maxY = hostRect.bottom - GRIP - 2
  if (vx > maxX) vx = Math.max(hostRect.left + 2, maxX)
  if (vy > maxY) vy = Math.max(hostRect.top + 2, maxY)
  if (vx < hostRect.left) vx = hostRect.left + 2
  if (vy < hostRect.top) vy = hostRect.top + 2
  // 视觉坐标 → 卡片窗口布局坐标（zoom 换算）
  const x = Math.round((vx - hostRect.left) / zoom)
  const y = Math.round((vy - hostRect.top) / zoom)
  g.style.transform = `translate(${x}px, ${y}px)`
  // 锁按钮贴在手柄左侧、底边对齐（手柄 18 高 vs 手柄 16 高，往上让 2px）
  const l = lockBtn.value
  if (l) {
    const LOCK = 18
    const GAP = 4
    let lvx = vx - LOCK - GAP
    let lvy = vy + GRIP - LOCK
    if (lvx < hostRect.left + 2) lvx = hostRect.left + 2
    if (lvy < hostRect.top + 2) lvy = hostRect.top + 2
    l.style.transform = `translate(${Math.round((lvx - hostRect.left) / zoom)}px, ${Math.round((lvy - hostRect.top) / zoom)}px)`
  }
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
  // 缩放手柄跟内容：内容是异步加载的，DOM 一变就重排（rAF 节流）
  mo = new MutationObserver(scheduleGrip)
  if (host.value) mo.observe(host.value, { childList: true, subtree: true, characterData: true })
  window.addEventListener("resize", scheduleGrip)
  window.addEventListener("storage", syncAccent)
  await nextTick()
  scheduleGrip()
})

watch(
  () => cfg.value.cardFontScale,
  () => scheduleGrip(),
)

onUnmounted(() => {
  for (const off of unlistenFns) off()
  unlistenFns = []
  if (topTimer) clearInterval(topTimer)
  mo?.disconnect()
  mo = null
  window.removeEventListener("resize", scheduleGrip)
  window.removeEventListener("storage", syncAccent)
})
</script>

<template>
  <div class="card-win" :class="{ dragging, resizing, locked }" :style="{ zoom: cfg.cardFontScale }"
    @pointerdown="onPointerDown" @dblclick="onDblClick">
    <div ref="host" class="card-content">
      <component :is="widget" :key="key" @open-app="onOpenApp" @ask="onAskAi" />
    </div>
    <span ref="grip" v-show="!locked" class="rs-grip" title="拖动缩放" @pointerdown="onResizeDown" />
    <!-- 锁：右下角，贴缩放手柄左侧；锁住后卡片不能拖动、不能改大小（内容照常可用） -->
    <button ref="lockBtn" type="button" class="card-lock no-drag" :class="{ on: locked }"
      :title="locked ? tc('card_unlock') : tc('card_lock')"
      :style="{ '--lock-accent': accentColor }"
      @pointerdown.stop @click.stop="toggleLock">
      <Icon :name="locked ? 'lock' : 'unlock'" :size="12" />
    </button>
  </div>
</template>

<style scoped>
.card-win { position: fixed; inset: 0; padding: 1px; box-sizing: border-box; background: transparent;
  user-select: none; }
.card-win.dragging { cursor: grabbing; }
.card-content { position: relative; width: 100%; height: 100%; }

/* 缩放手柄：位置由 JS 计算（跟内容右下角），translate 为卡片窗口布局坐标 */
.rs-grip { position: absolute; left: 0; top: 0; width: 16px; height: 16px; cursor: nwse-resize;
  opacity: 0; transition: opacity .15s; z-index: 9; will-change: transform; }
.rs-grip::after { content: ""; position: absolute; right: 3px; bottom: 3px; width: 8px; height: 8px;
  border-right: 2px solid rgba(0,0,0,.35); border-bottom: 2px solid rgba(0,0,0,.35); border-bottom-right-radius: 3px; }
.card-win:hover .rs-grip { opacity: 1; }

/* 锁定按钮：与手柄同一锚点，位置同样由 JS 写入 translate（布局坐标） */
.card-lock { position: absolute; left: 0; top: 0; width: 18px; height: 18px; padding: 0; margin: 0;
  display: flex; align-items: center; justify-content: center; border: 0; border-radius: 6px;
  color: rgba(0,0,0,.42); background: rgba(255,255,255,.62); backdrop-filter: blur(8px);
  box-shadow: 0 1px 4px rgba(0,0,0,.10); cursor: pointer; opacity: 0; z-index: 10;
  transition: opacity .15s, color .15s, background .15s; will-change: transform; }
.card-win:hover .card-lock { opacity: 1; }
.card-lock:hover { color: rgba(0,0,0,.72); background: rgba(255,255,255,.86); }
/* 已锁定：常显 + 主题色（灰白 chip 看不出状态，颜色是最快的信号） */
.card-lock.on { opacity: 1; color: var(--lock-accent, #409cff);
  background: color-mix(in srgb, var(--lock-accent, #409cff) 14%, #fff);
  box-shadow: 0 1px 5px rgba(0,0,0,.12),
    inset 0 0 0 1px color-mix(in srgb, var(--lock-accent, #409cff) 38%, transparent); }
</style>
