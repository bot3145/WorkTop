<script setup lang="ts">
// 桌面级 Dock 悬浮窗：完全透明的图标条 + 鱼眼放大 + 运行指示点 + 自动隐藏 + 右键菜单。
// 独立 OS 窗口（透明/无边框/置顶/不进任务栏），由主窗口通过 dock_open 创建。
import { computed, onMounted, onUnmounted, ref, watch } from "vue"
import { currentMonitor, getCurrentWindow, PhysicalPosition, PhysicalSize } from "@tauri-apps/api/window"
import { listen, emit, TauriEvent } from "@tauri-apps/api/event"
import { convertFileSrc, invoke } from "@tauri-apps/api/core"
import { open as openFileDialog } from "@tauri-apps/plugin-dialog"
import {
  autoPick,
  dockWindowSize,
  mergeCustomApps,
  readCustomApps,
  readDockConfig,
  readScanCache,
  writeCustomApps,
  writeDockConfig,
  writeScanCache,
  type DockAppInfo,
  type DockConfig,
} from "../lib/dock"
import { BUILTIN_FEATURES, builtinDef } from "../lib/apps"
import { makeT, type Lang } from "../i18n"
import Icon from "../components/Icon.vue"
import ContextMenu, { type CtxItem } from "../components/ContextMenu.vue"
import { createClickSplitter } from "../lib/click"

const cfg = ref<DockConfig>(readDockConfig())
const scanApps = ref<DockAppInfo[]>(readScanCache())
const customApps = ref<DockAppInfo[]>(readCustomApps())
const allApps = computed(() => mergeCustomApps(scanApps.value, customApps.value))
const running = ref<Set<string>>(new Set())
const hidden = ref(false)
const dragging = ref(false)

const win = getCurrentWindow()

/* ---------- 主题（跟随主窗口的外观设置；auto 走系统） ---------- */
const mql = window.matchMedia("(prefers-color-scheme: dark)")
const readTheme = () => {
  let mode = "auto"
  try {
    mode = localStorage.getItem("pwb_theme") ?? "auto"
  } catch {}
  return mode === "dark" || (mode === "auto" && mql.matches)
}
const dark = ref(readTheme())
const applyTheme = () => (dark.value = readTheme())
mql.addEventListener("change", applyTheme)
window.addEventListener("storage", applyTheme)

/* ---------- 语言（跟随主窗口设置，storage 事件实时同步） ---------- */
const readLang = (): Lang => {
  try {
    return localStorage.getItem("pwb_lang") === "en" ? "en" : "zh"
  } catch {
    return "zh"
  }
}
const lang = ref<Lang>(readLang())
const t = computed(() => makeT(lang.value))
const applyLang = () => (lang.value = readLang())
window.addEventListener("storage", (e) => {
  if (e.key === "pwb_lang") applyLang()
})

/* ---------- 内置功能快捷入口（排在应用图标右侧、分隔条隔开） ---------- */
const builtinList = computed(() =>
  (cfg.value.builtin ?? []).map((id) => builtinDef(id)).filter((b): b is NonNullable<typeof b> => Boolean(b)),
)
/** 内置功能磁贴的渐变底色（与主窗启动台同款；工作台 = 极光浅色玻璃，不再是灰暗色块） */
const GLOSS: Record<string, string> = {
  pad: "linear-gradient(160deg,#ffffff 0%,#e9f0ff 55%,#d5e3ff 100%)",
  ai: "linear-gradient(150deg,#b79cff,#6d4be0)",
  apps: "linear-gradient(150deg,#7fc0ff,#2f7fdc)",
  todo: "linear-gradient(150deg,#6fe08c,#22a04c)",
  nav: "linear-gradient(150deg,#6ec0f0,#1f7fb8)",
  note: "linear-gradient(150deg,#ffc266,#f08516)",
  keys: "linear-gradient(150deg,#a8abb4,#5b6068)",
  assets: "linear-gradient(150deg,#63d3c2,#159181)",
  settings: "linear-gradient(150deg,#adb4c2,#666e7d)",
}
const glossOf = (id: string) => GLOSS[id] ?? GLOSS.pad

/* ---------- 文件管理器：Dock 最左侧固定图标（不可移除、不参与排序，类 macOS Finder） ---------- */
const explorer = computed(() => allApps.value.find((a) => /explorer\.exe$/i.test(a.path)))

const pinned = computed<DockAppInfo[]>(() => {
  const byId = new Map(allApps.value.map((a) => [a.id, a]))
  const list = cfg.value.apps.length
    ? cfg.value.apps.map((id) => byId.get(id)).filter((a): a is DockAppInfo => Boolean(a))
    : autoPick(allApps.value, 10)
  // 固定的文件管理器已在最左侧单独渲染，这里去重避免出现两个
  const exp = explorer.value
  return exp ? list.filter((a) => a.id !== exp.id) : list
})

const size = computed(() => cfg.value.size)
const dims = computed(() => dockWindowSize(cfg.value, pinned.value.length + (explorer.value ? 1 : 0)))

const iconSrc = (app: DockAppInfo) => (app.icon ? convertFileSrc(app.icon) : "")

const baseName = (p: string) => {
  const file = p.split(/[\\/]/).pop() ?? ""
  return file.replace(/\.(exe|lnk|url|app)$/i, "").toLowerCase()
}
const isRunning = (app: DockAppInfo) => {
  const candidates = [baseName(app.target ?? ""), baseName(app.path), app.name.toLowerCase()]
  return candidates.some((c) => c && running.value.has(c))
}

async function refreshScan(force = false) {
  try {
    // 缓存里没有文件管理器 = 旧版扫描结果（合成条目是后来加的），补扫一次
    const stale = !scanApps.value.some((a) => /explorer\.exe$/i.test(a.path))
    if (force || !scanApps.value.length || stale) {
      const list = await invoke<DockAppInfo[]>("dock_scan")
      scanApps.value = list
      writeScanCache(list)
    }
  } catch (e) {
    console.warn("dock_scan failed", e)
  }
}

async function refreshRunning() {
  try {
    const list = await invoke<string[]>("dock_running")
    running.value = new Set(list)
  } catch {}
}

/* ---------- 几何与自动隐藏（按工作区定位，避开 Windows 任务栏/Dock 区） ---------- */
interface PhysRect { x: number; y: number; width: number; height: number }
let baseGeo: PhysRect | null = null

/** Dock 本体在 cross 轴上的厚度（= 图标尺寸 + 两侧内边距，逻辑像素） */
const barCross = () => cfg.value.size + 20

/**
 * Dock 窗口比 Dock 本体大一圈（留出悬停放大 1.42× 的余量），本体在窗口里居中。
 * 因此定位不能直接对齐窗口边缘，要按「本体」算，再换算回窗口坐标——
 * 否则会左右/下上偏出一截（历史上底部横置时左右留白不均就是这个原因）。
 * barX/barY 是本体左上角的物理像素坐标。
 */
function windowFromBar(barX: number, barY: number, w: number, h: number, scale: number) {
  const barCrossPhys = Math.round(barCross() * scale)
  const crossWin = cfg.value.position === "bottom" ? h : w
  const off = Math.round((crossWin - barCrossPhys) / 2)
  return cfg.value.position === "bottom" ? { x: barX, y: barY - off } : { x: barX - off, y: barY }
}

/** 用显示器工作区（workArea，已扣除任务栏）计算 Dock 位置；否则会被任务栏压住下半截 */
async function placeByWorkArea() {
  try {
    const mon = await currentMonitor()
    if (!mon) return false
    const scale = mon.scaleFactor
    // 替代任务栏：整块屏幕（Dock 占住任务栏那条位置）；否则退回工作区（放在任务栏上方）
    const replacing = cfg.value.replaceTaskbar && (await ensureTaskbarHidden())
    const areaPos = replacing ? mon.position : mon.workArea.position
    const areaSize = replacing ? mon.size : mon.workArea.size
    // 先 setSize：图标数量/横竖切换都会改变尺寸，只 setPosition 会让内容溢出或左右留空
    const w = Math.round(dims.value.width * scale)
    const h = Math.round(dims.value.height * scale)
    await win.setSize(new PhysicalSize(w, h))
    const margin = replacing ? 0 : Math.round(8 * scale)
    const cross = Math.round(barCross() * scale)
    const ax = areaPos.x
    const ay = areaPos.y
    const aw = areaSize.width
    const ah = areaSize.height
    let barX: number
    let barY: number
    if (cfg.value.position === "left") {
      barX = ax + margin
      barY = ay + Math.round((ah - h) / 2)
    } else if (cfg.value.position === "right") {
      barX = ax + aw - margin - cross
      barY = ay + Math.round((ah - h) / 2)
    } else {
      barX = ax + Math.round((aw - w) / 2)
      barY = ay + ah - margin - cross
    }
    const winPos = windowFromBar(barX, barY, w, h, scale)
    baseGeo = { x: winPos.x, y: winPos.y, width: w, height: h }
    await win.setPosition(new PhysicalPosition(winPos.x, winPos.y))
    hidden.value = false
    await win.setAlwaysOnTop(true)
    // 重摆后窗口回到基准几何；弹层还开着的话要把扩出量重放回去
    appliedGrow = 0
    if (popGrow.value > 0) await applyGrow(popGrow.value)
    return true
  } catch {
    return false
  }
}

/** 隐藏 Windows 任务栏；失败返回 false（调用方退回"放任务栏上方"） */
async function ensureTaskbarHidden(): Promise<boolean> {
  try {
    if (!(await invoke<boolean>("taskbar_visible"))) return true
    return await invoke<boolean>("taskbar_hide")
  } catch {
    return false
  }
}
/** 恢复 Windows 任务栏（退出 Dock / 关掉开关时调用） */
async function restoreTaskbar() {
  await invoke("taskbar_show").catch(() => {})
}

async function syncGeometry(reposition = true) {
  const ok = await placeByWorkArea()
  if (!ok && reposition && !hidden.value && baseGeo) await placeVisible()
}

// 图标增减 / 位置切换 / 尺寸调整都会改变窗口尺寸，必须重新量一遍
watch(
  () => [dims.value.width, dims.value.height, cfg.value.position] as const,
  () => void syncGeometry(),
)

let edgePoll: ReturnType<typeof setInterval> | null = null

async function placeVisible() {
  if (!baseGeo) return
  stopEdgePoll()
  await win.setIgnoreCursorEvents(false).catch(() => {})
  await win.setPosition(new PhysicalPosition(baseGeo.x, baseGeo.y))
  hidden.value = false
  await win.setAlwaysOnTop(true)
  // 位置回到基准；弹层若还开着，扩出量重放（正常路径下隐藏态不会有弹层，兜底而已）
  appliedGrow = 0
  if (popGrow.value > 0) await applyGrow(popGrow.value)
}

/** 隐藏态：鼠标穿透（不挡任务栏点击），改用系统光标轮询探测屏幕边缘 */
function startEdgePoll() {
  if (edgePoll) return
  let scaleCache = 0
  edgePoll = setInterval(async () => {
    if (!baseGeo) return
    const p = await invoke<{ x: number; y: number } | null>("cursor_pos").catch(() => null)
    if (!p) return
    if (!scaleCache) scaleCache = await win.scaleFactor().catch(() => 1)
    const scale = scaleCache
    const show = Math.round(4 * scale)
    const cross = Math.round(barCross() * scale)
    const { x, y, width: w, height: h } = baseGeo
    // Dock 本体在屏幕上的矩形（可见态）
    const barLeft = cfg.value.position === "bottom" ? x : x + Math.round((w - cross) / 2)
    const barTop = cfg.value.position === "bottom" ? y + Math.round((h - cross) / 2) : y
    const barW = cfg.value.position === "bottom" ? w : cross
    const barH = cfg.value.position === "bottom" ? cross : h
    const pad = Math.round(60 * scale) // 热区左右各放宽一点，贴边斜着划过来也能触发
    const onEdge =
      cfg.value.position === "bottom"
        ? p.y >= barTop + barH - show && p.x >= barLeft - pad && p.x <= barLeft + barW + pad
        : cfg.value.position === "left"
          ? p.x <= barLeft + show && p.y >= barTop - pad && p.y <= barTop + barH + pad
          : p.x >= barLeft + barW - show && p.y >= barTop - pad && p.y <= barTop + barH + pad
    if (onEdge) await placeVisible()
  }, 120)
}
function stopEdgePoll() {
  if (edgePoll) {
    clearInterval(edgePoll)
    edgePoll = null
  }
}

async function placeHidden() {
  if (!baseGeo) return
  await win.setIgnoreCursorEvents(true).catch(() => {})
  const scale = await win.scaleFactor().catch(() => 1)
  const show = Math.round(4 * scale)
  const cross = Math.round(barCross() * scale)
  const { width: w, height: h } = baseGeo
  // 以「本体」的边缘为基准滑出：窗口比本体大一圈，直接按窗口尺寸滑会露出空白
  let barX = baseGeo.x
  let barY = baseGeo.y
  if (cfg.value.position === "bottom") {
    // 本体顶边滑到距工作区底 show 像素处：只露出顶部一条
    barY = baseGeo.y + Math.round((h - cross) / 2) + cross - show
  } else if (cfg.value.position === "left") {
    barX = baseGeo.x + Math.round((w - cross) / 2) + cross - show
  } else {
    barX = baseGeo.x + Math.round((w - cross) / 2) - cross + show
  }
  const pos = windowFromBar(barX, barY, w, h, scale)
  await win.setPosition(new PhysicalPosition(Math.round(pos.x), Math.round(pos.y)))
  hidden.value = true
  startEdgePoll()
}

let hideTimer: ReturnType<typeof setTimeout> | null = null
function onEnter() {
  if (hideTimer) clearTimeout(hideTimer)
  if (hidden.value) void placeVisible()
}
function onLeave() {
  // 弹层展开期间（窗口已向屏幕内侧扩出一块）不自动收起
  if (!cfg.value.autohide || dragging.value || popGrow.value > 0) return
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => void placeHidden(), 450)
}

/* ---------- 悬停放大（只放大指针下的那个图标，由 CSS :hover 完成） ---------- */
function onBarLeave() {
  onLeave()
}

/* ---------- 图标拖动排序（按住拖动超过 8px 进入；邻位平移让位预览；松手固化顺序） ---------- */
/* 两个独立排序区：应用图标区与内置功能区（分隔条两侧，互不越区）。 */
const dragSort = ref<{
  from: number
  to: number
  x0: number
  y0: number
  active: boolean
  horizontal: boolean
  zone: "apps" | "builtin" // 拖动落位只在本区内计算
  origin: number // 图标带起点（相对视口）
  lead: number // 起点到首个图标前缘的偏移（两个区都是独立容器，无前导）
  gap: number
} | null>(null)
let suppressClick = false

function zoneLen(zone: "apps" | "builtin") {
  return zone === "apps" ? pinned.value.length : builtinList.value.length
}

function onIconDown(e: PointerEvent, idx: number, zone: "apps" | "builtin") {
  if (e.button !== 0) return
  const band = (e.currentTarget as HTMLElement).parentElement
  if (!band) return
  const rect = band.getBoundingClientRect()
  const horizontal = cfg.value.position === "bottom"
  dragSort.value = {
    from: idx,
    to: idx,
    x0: e.clientX,
    y0: e.clientY,
    active: false,
    horizontal,
    zone,
    origin: horizontal ? rect.left : rect.top,
    lead: 0,
    gap: dims.value.gap,
  }
  window.addEventListener("pointermove", onIconMove)
  window.addEventListener("pointerup", onIconUp)
}

function onIconMove(e: PointerEvent) {
  const d = dragSort.value
  if (!d) return
  if (!d.active) {
    if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 8) return
    d.active = true
    dragging.value = true // 拖动期间不触发自动隐藏收起
  }
  // 落点 = 指针在图标带上的位置四舍五入到最近格位（只在本区内）
  const s = size.value
  const p = (d.horizontal ? e.clientX : e.clientY) - d.origin - d.lead
  const raw = Math.round((p - s / 2) / (s + d.gap))
  d.to = Math.min(zoneLen(d.zone) - 1, Math.max(0, raw))
}

function onIconUp() {
  window.removeEventListener("pointermove", onIconMove)
  window.removeEventListener("pointerup", onIconUp)
  const d = dragSort.value
  dragSort.value = null
  dragging.value = false
  if (!d?.active) return
  suppressClick = true // 拖动松手会跟一次 click，必须吞掉（否则拖完图标就把应用启动了）
  setTimeout(() => (suppressClick = false), 80)
  if (d.to === d.from) return
  if (d.zone === "builtin") {
    const current = [...(cfg.value.builtin ?? [])]
    const [moved] = current.splice(d.from, 1)
    current.splice(d.to, 0, moved)
    persistCfg({ ...cfg.value, builtin: current })
    return
  }
  // 首次拖动 = 把自动推荐固化为固定列表，再按拖动落位重排
  const current = cfg.value.apps.length ? [...cfg.value.apps] : pinned.value.map((a) => a.id)
  const [moved] = current.splice(d.from, 1)
  current.splice(d.to, 0, moved)
  persistCfg({ ...cfg.value, apps: current })
}

/** 配置落盘并广播（设置页 / 主窗口同步）+ 重新量窗口尺寸 */
async function persistCfg(next: DockConfig) {
  cfg.value = next
  writeDockConfig(next)
  await emit("pwb-dock-config", next)
  void syncGeometry()
}

/** 拖动预览：同区内 from 与 to 之间的图标整体平移一格让位 */
function iconShift(i: number, zone: "apps" | "builtin"): { transform?: string } {
  const d = dragSort.value
  if (!d?.active || d.zone !== zone || d.from === d.to) return {}
  const step = size.value + d.gap
  const dir = d.horizontal ? "translateX" : "translateY"
  const between =
    (d.to < d.from && i >= d.to && i < d.from) || (d.to > d.from && i > d.from && i <= d.to)
  if (!between) return {}
  const offset = d.to < d.from ? step : -step
  return { transform: `${dir}(${offset}px)` }
}

/* ---------- 操作 ---------- */
/** 点击图标：未运行 → 启动；运行中 → 最小化/恢复切换（后端直启 exe，不经 explorer） */
async function launch(app: DockAppInfo, maximized = false) {
  if (suppressClick) return
  try {
    await invoke("dock_toggle", { path: app.path, maximized })
    await refreshRunning()
  } catch (e) {
    console.warn(e)
  }
}

/** 打开内置功能：pad = 全屏工作台；其余 = 独立功能窗口（pane_open） */
async function openBuiltin(id: string, maximized = false) {
  if (suppressClick) return
  const def = builtinDef(id)
  if (!def) return
  if (id === "pad") {
    await invoke("workbench_open").catch((e) => console.warn(e))
    return
  }
  await invoke("pane_open", { id, width: def.w, height: def.h, maximized }).catch((e) => console.warn(e))
}

/** 单击 = 打开；双击 = 全屏打开（外部应用则启动/前置后最大化，内置功能则最大化窗口） */
const clickSplit = createClickSplitter()

/* ---------- 右键菜单（应用 / 内置功能 / 固定图标 三类） ---------- */
type CtxState =
  | { kind: "app"; x: number; y: number; app: DockAppInfo; items: CtxItem[] }
  | { kind: "fixed"; x: number; y: number; app: DockAppInfo; items: CtxItem[] }
  | { kind: "builtin"; x: number; y: number; id: string; items: CtxItem[] }
const ctx = ref<CtxState | null>(null)

const clampNum = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
/** 右键菜单尺寸（解析式估算，与 ContextMenu 的实际渲染一致） */
const CTX_W = 190
const ctxH = (n: number) => n * 31 + 12

/**
 * 在「基准系」（窗口未扩时的视口坐标）里给右键菜单定位，方向跟随 Dock 朝向：
 * bottom 向上展开；left 向右展开；right 向左展开——与扩窗方向一致，越界部分由弹层扩窗补齐。
 * 捕获的指针坐标若来自已扩窗口的视口，要先换算回基准系（toBaseX/toBaseY）。
 */
function placeCtx(cx: number, cy: number, n: number): { x: number; y: number } {
  const pos = cfg.value.position
  const h = ctxH(n)
  if (pos === "bottom") {
    return {
      x: Math.round(clampNum(toBaseX(cx) - 14, 6, Math.max(6, dims.value.width - CTX_W - 6))),
      y: Math.round(toBaseY(cy) - h - 8),
    }
  }
  const y = Math.round(clampNum(toBaseY(cy) - 12, 6, Math.max(6, dims.value.height - h - 6)))
  return pos === "left"
    ? { x: Math.round(toBaseX(cx) + 14), y }
    : { x: Math.round(toBaseX(cx) - CTX_W - 14), y }
}

function onContext(e: MouseEvent, app: DockAppInfo) {
  e.preventDefault()
  const items: CtxItem[] = [
    { key: "open", label: "打开" },
    { key: "reveal", label: "在文件夹中显示" },
    { key: "remove", label: "从 Dock 移除", danger: true },
    { key: "settings", label: "Dock 设置…" },
  ]
  ctx.value = { kind: "app", ...placeCtx(e.clientX, e.clientY, items.length), app, items }
}

/** 固定图标（文件管理器）：没有「从 Dock 移除」 */
function onFixedContext(e: MouseEvent, app: DockAppInfo) {
  e.preventDefault()
  const items: CtxItem[] = [
    { key: "open", label: "打开" },
    { key: "reveal", label: "在文件夹中显示" },
    { key: "settings", label: "Dock 设置…" },
  ]
  ctx.value = { kind: "fixed", ...placeCtx(e.clientX, e.clientY, items.length), app, items }
}

function onBuiltinContext(e: MouseEvent, id: string) {
  e.preventDefault()
  const items: CtxItem[] = [
    { key: "open", label: "打开" },
    { key: "remove", label: "从 Dock 移除", danger: true },
    { key: "settings", label: "Dock 设置…" },
  ]
  ctx.value = { kind: "builtin", ...placeCtx(e.clientX, e.clientY, items.length), id, items }
}

async function onCtxSelect(key: string) {
  const target = ctx.value
  if (!target) return
  if (target.kind === "builtin") {
    if (key === "open") await openBuiltin(target.id)
    else if (key === "remove") {
      await persistCfg({ ...cfg.value, builtin: (cfg.value.builtin ?? []).filter((id) => id !== target.id) })
    } else if (key === "settings") await openSettings()
    return
  }
  const app = target.app
  if (key === "open") await launch(app)
  else if (key === "reveal") await invoke("dock_reveal", { path: app.path }).catch(() => {})
  else if (key === "remove" && target.kind === "app") {
    const current = cfg.value.apps.length ? [...cfg.value.apps] : pinned.value.map((a) => a.id)
    await persistCfg({ ...cfg.value, apps: current.filter((id) => id !== app.id) })
  } else if (key === "settings") {
    await openSettings()
  }
}

/** Dock 设置：直接开独立设置窗并定位到「桌面 Dock」标签（不依赖工作台主窗） */
async function openSettings() {
  await invoke("pane_open", { id: "settings", width: 720, height: 540, tab: "dock" }).catch(() => {})
}

/* 「＋」= 添加快捷方式（不是打开设置） */
async function addShortcut() {
  const picked = await openFileDialog({
    multiple: false,
    title: "选择要添加到 Dock 的程序或快捷方式",
    filters: [{ name: "程序与快捷方式", extensions: ["exe", "lnk", "url", "app"] }],
  })
  if (!picked || typeof picked !== "string") return
  try {
    const app = await invoke<DockAppInfo>("dock_add_shortcut", { path: picked })
    if (!customApps.value.some((a) => a.id === app.id)) {
      customApps.value = [...customApps.value, app]
      writeCustomApps(customApps.value)
    }
    const current = cfg.value.apps.length ? cfg.value.apps : pinned.value.map((a) => a.id)
    if (!current.includes(app.id)) {
      const next = { ...cfg.value, apps: [...current, app.id] }
      cfg.value = next
      writeDockConfig(next)
      await emit("pwb-dock-config", next)
    }
    await syncGeometry()
  } catch (e) {
    console.warn(e)
  }
}

const plusMenu = ref<{ x: number; y: number } | null>(null)
/** ＋按钮锚点（选择器面板定位用；基准系坐标） */
let plusAnchor = { x: 12, y: 12 }
function onPlusClick(e: MouseEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  plusAnchor = { x: Math.round(toBaseX(rect.left)), y: Math.round(toBaseY(rect.top)) }
  plusMenu.value = placeCtx(e.clientX, e.clientY, 3)
}
async function onPlusSelect(key: string) {
  if (key === "pick-file") await addShortcut()
  else if (key === "from-installed") await openSettings()
  else if (key === "add-builtin") openBuiltinPicker()
}

/* ---------- 内置功能选择器（＋ 菜单第三项）：勾选式小面板，可多选增删 ---------- */
const biPicker = ref<{ x: number; y: number } | null>(null)
const PICKABLE = BUILTIN_FEATURES.filter((b) => b.id !== "pad") // 工作台是固定按钮，不进选择器
const PICK_W = 240
const PICK_H = PICKABLE.length * 36 + 56 // 行高 + 标题/内边距（解析式估算）
/**
 * 在基准系里给选择器定位：贴着 ＋按钮向屏幕内侧展开（bottom 向上 / left 向右 / right 向左），
 * 越界部分交给弹层扩窗；纵向在竖向 Dock 里做常规钳制（窗口本来就长）。
 */
function openBuiltinPicker() {
  if (biPicker.value) return
  const pos = cfg.value.position
  if (pos === "bottom") {
    const x = Math.round(clampNum(plusAnchor.x - 110, 6, Math.max(6, dims.value.width - PICK_W - 6)))
    biPicker.value = { x, y: Math.round(plusAnchor.y - PICK_H - 10) }
  } else if (pos === "left") {
    const y = Math.round(clampNum(plusAnchor.y - 30, 6, Math.max(6, dims.value.height - PICK_H - 6)))
    biPicker.value = { x: Math.round(plusAnchor.x + cfg.value.size + 30), y }
  } else {
    const y = Math.round(clampNum(plusAnchor.y - 30, 6, Math.max(6, dims.value.height - PICK_H - 6)))
    biPicker.value = { x: Math.round(plusAnchor.x - PICK_W - cfg.value.size - 30), y }
  }
}
let biOutside: ((e: PointerEvent) => void) | null = null
watch(biPicker, (v) => {
  if (v && !biOutside) {
    biOutside = (e: PointerEvent) => {
      const el = e.target as HTMLElement
      if (!el.closest(".bi-picker") && !el.closest(".dock-btn.add")) biPicker.value = null
    }
    window.addEventListener("pointerdown", biOutside, true)
  } else if (!v && biOutside) {
    window.removeEventListener("pointerdown", biOutside, true)
    biOutside = null
  }
})
/** 勾选/取消一个内置功能入口 */
async function toggleBuiltin(id: string) {
  const list = cfg.value.builtin ?? []
  const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
  await persistCfg({ ...cfg.value, builtin: next })
}

/* Dock 条空白处右键：设置 / 关闭 */
const barCtx = ref<{ x: number; y: number } | null>(null)
function onBarContext(e: MouseEvent) {
  if ((e.target as HTMLElement).closest(".dock-btn")) return
  e.preventDefault()
  barCtx.value = placeCtx(e.clientX, e.clientY, 5)
}
async function onBarCtxSelect(key: string) {
  if (key === "settings") await openSettings()
  else if (key === "snip") {
    // WorkTop 原生截图：不再启动外部截图程序
    await invoke("snip_capture").catch(() => {})
  } else if (key === "restore-taskbar") {
    await restoreTaskbar()
    const next = { ...cfg.value, replaceTaskbar: false }
    cfg.value = next
    writeDockConfig(next)
    await syncGeometry()
  } else if (key === "hide") {
    const next = { ...cfg.value, enabled: false }
    cfg.value = next
    writeDockConfig(next)
    await restoreTaskbar()
    await invoke("dock_close").catch(() => {})
  } else if (key === "quit") {
    await restoreTaskbar()
    await invoke("app_quit").catch(() => {})
  }
}

/* ---------- 弹层空间：Dock 是贴身小窗，弹层（菜单/选择器）会被窗口边界裁掉。
 * 弹层打开时临时把窗口向屏幕内侧扩一块透明区（屏幕侧边缘不动、图标条钉在原位），
 * 弹层完整显示；「扩大出来的空白」属于本窗口——点它即可关闭弹层（ctx-bg 全屏捕获），
 * 点击窗口之外的程序则由 onBlur 兜底关闭；关闭后窗口收回。
 *
 * 坐标系约定：弹层坐标一律存「基准系」= 窗口未扩时的视口坐标。bottom/right 扩窗会让
 * 视口原点向屏幕内侧平移，捕获指针坐标时用 toBaseX/toBaseY 减去当前扩出量换算回基准系；
 * 渲染时 pop-layer 的补偿变换（translateY/X(popGrow)）把弹层送回屏幕原位。 */
const popGrow = ref(0) // 当前向屏幕内侧扩出的逻辑像素数；0 = 未扩
const barOff = computed(() => (dims.value.height - (cfg.value.size + 20)) / 2) // 本体在 cross 轴上的居中偏移
/** 视口坐标 → 基准系坐标（只有 bottom 的 y 轴与 right 的 x 轴会因扩窗而平移） */
const toBaseX = (x: number) => (cfg.value.position === "right" ? x - popGrow.value : x)
const toBaseY = (y: number) => (cfg.value.position === "bottom" ? y - popGrow.value : y)

/** dock-root 内联样式：扩窗期间给 CSS 传 --pg（弹层补偿量）；bottom 朝向同时把图标条钉回原位 */
const rootStyle = computed<Record<string, string> | undefined>(() => {
  if (popGrow.value <= 0) return undefined
  const s: Record<string, string> = { "--pg": `${popGrow.value}px` }
  if (cfg.value.position === "bottom") s["padding-bottom"] = `${Math.round(barOff.value)}px`
  return s
})

/** 实际已施加到窗口上的扩出量（与 popGrow 分离：syncGeometry 重摆后窗口回到基准几何，需要重放） */
let appliedGrow = 0

async function applyGrow(grow: number) {
  const g = Math.max(0, Math.round(grow))
  popGrow.value = g // CSS 补偿量同步更新（先于窗口实际完成 resize，避免视觉跳动）
  if (!baseGeo || g === appliedGrow) return
  appliedGrow = g
  const scale = await win.scaleFactor().catch(() => 1)
  const gp = Math.round(g * scale)
  if (gp === 0) {
    // 收回：恢复基准几何
    await win.setSize(new PhysicalSize(baseGeo.width, baseGeo.height)).catch(() => {})
    await win.setPosition(new PhysicalPosition(baseGeo.x, baseGeo.y)).catch(() => {})
    return
  }
  if (cfg.value.position === "bottom") {
    // 向上扩：窗口底边不动
    await win.setSize(new PhysicalSize(baseGeo.width, baseGeo.height + gp)).catch(() => {})
    await win.setPosition(new PhysicalPosition(baseGeo.x, baseGeo.y - gp)).catch(() => {})
  } else if (cfg.value.position === "left") {
    // 向右扩：左缘不动
    await win.setSize(new PhysicalSize(baseGeo.width + gp, baseGeo.height)).catch(() => {})
    await win.setPosition(new PhysicalPosition(baseGeo.x, baseGeo.y)).catch(() => {})
  } else {
    // 向左扩：右缘不动
    await win.setSize(new PhysicalSize(baseGeo.width + gp, baseGeo.height)).catch(() => {})
    await win.setPosition(new PhysicalPosition(baseGeo.x - gp, baseGeo.y)).catch(() => {})
  }
}

/**
 * 当前打开的弹层需要的扩出量（解析式计算，不做 DOM 量测）：
 * 弹层在基准系里的矩形，按 Dock 朝向只看「向屏幕内侧那侧」的越界深度——
 * bottom 只可能上缘越界（弹层一律向上展开）、left 只可能右缘越界、right 只可能左缘越界。
 */
function popupGrowFor(): number {
  const pos = cfg.value.position
  const baseW = dims.value.width
  let need = 0
  const add = (x: number, y: number, w: number) => {
    if (pos === "bottom") need = Math.max(need, 8 - y)
    else if (pos === "left") need = Math.max(need, x + w + 8 - baseW)
    else need = Math.max(need, 8 - x)
  }
  if (ctx.value) add(ctx.value.x, ctx.value.y, CTX_W)
  if (plusMenu.value) add(plusMenu.value.x, plusMenu.value.y, CTX_W)
  if (barCtx.value) add(barCtx.value.x, barCtx.value.y, CTX_W)
  if (biPicker.value) add(biPicker.value.x, biPicker.value.y, PICK_W)
  return Math.max(0, Math.ceil(need))
}

watch([ctx, plusMenu, barCtx, biPicker], () => void applyGrow(popupGrowFor()))

/* 弹层统一 Esc 关闭（ContextMenu 自带 Esc，这里兜底选择器） */
function onPopupKey(e: KeyboardEvent) {
  if (e.key === "Escape" && (ctx.value || plusMenu.value || barCtx.value || biPicker.value)) closePopups()
}
function closePopups() {
  ctx.value = null
  plusMenu.value = null
  barCtx.value = null
  biPicker.value = null
}

/* ---------- 生命周期 ---------- */
let poll: ReturnType<typeof setInterval> | null = null
let unlisten: (() => void) | null = null
let unBlur: (() => void) | null = null

onMounted(async () => {
  window.addEventListener("keydown", onPopupKey)
  // 焦点落到别的窗口（点桌面/别的程序）时收起弹层——贴身小窗外点的兜底
  unBlur = await win
    .listen(TauriEvent.WINDOW_BLUR, () => closePopups())
    .catch(() => null)
  await refreshScan()
  await refreshRunning()
  await syncGeometry()
  // 不替代任务栏时确保系统任务栏是显示的（防止上次异常退出留下的隐藏状态）
  if (!cfg.value.replaceTaskbar) await restoreTaskbar()
  // 开了自动隐藏：启动即收起到屏幕边缘（与 macOS 一致），鼠标碰到底边再出来
  if (cfg.value.autohide) await placeHidden()
  poll = setInterval(async () => {
    await refreshRunning()
    // 资源管理器重启会把任务栏放回来：开关仍开着就再藏一次
    if (cfg.value.replaceTaskbar) {
      const vis = await invoke<boolean>("taskbar_visible").catch(() => false)
      if (vis) await ensureTaskbarHidden()
    }
  }, 6000)
  unlisten = await listen<DockConfig>("pwb-dock-config", async (e) => {
    const prev = cfg.value
    cfg.value = e.payload
    await syncGeometry() // 重摆后弹层扩窗量会被 placeByWorkArea 重放，不必关掉选择器
    await refreshScan(false)
    // 刚打开自动隐藏：立刻收起，不必等鼠标离开
    if (!prev.autohide && cfg.value.autohide) await placeHidden()
    // 替代任务栏开关切换
    if (prev.replaceTaskbar && !cfg.value.replaceTaskbar) {
      await restoreTaskbar()
      await syncGeometry()
    } else if (!prev.replaceTaskbar && cfg.value.replaceTaskbar) {
      await syncGeometry()
    }
  })
})

onUnmounted(() => {
  window.removeEventListener("keydown", onPopupKey)
  if (poll) clearInterval(poll)
  stopEdgePoll()
  if (unlisten) unlisten()
  unBlur?.()
  clickSplit.dispose()
})
</script>

<template>
  <div class="dock-root"
    :class="[hidden ? 'is-hidden' : '', cfg.position, dark ? 'dock-dark' : 'dock-light', { pop: popGrow > 0 }]"
    :style="rootStyle" @mouseenter="onEnter" @mouseleave="onLeave">
    <div class="dockbar" @pointerleave="onBarLeave"
      @contextmenu="onBarContext">
      <!-- 隐藏态热区提示线：贴在本体边缘（窗口比本人大一圈，贴窗口边会飘空） -->
      <span class="hot-handle" />

      <!-- 文件管理器：Dock 最左固定图标（不可移除、不参与排序，类 macOS Finder） -->
      <button v-if="explorer" class="dock-btn" :style="{ width: size + 'px', height: size + 'px' }"
        :title="explorer.name" @click="clickSplit.single(() => explorer && launch(explorer))"
        @dblclick.stop="clickSplit.double(() => explorer && launch(explorer, true))"
        @contextmenu="onFixedContext($event, explorer)">
        <img v-if="iconSrc(explorer)" class="dock-img" :src="iconSrc(explorer)" :alt="explorer.name" draggable="false"
          @error="($event.target as HTMLImageElement).style.display = 'none'">
        <span v-else class="dock-fallback">{{ explorer.name.slice(0, 1).toUpperCase() }}</span>
        <span class="dock-dot" :class="{ on: isRunning(explorer) }" />
      </button>

      <!-- 应用图标区（独立拖动带；固定图标不参与排序） -->
      <div class="dock-apps">
        <button v-for="(app, i) in pinned" :key="app.id" class="dock-btn"
          :class="{ dragging: dragSort?.active && dragSort.zone === 'apps' && dragSort.from === i }"
          :style="[{ width: size + 'px', height: size + 'px' }, iconShift(i, 'apps')]"
          :title="app.name" @click="clickSplit.single(() => launch(app))"
          @dblclick.stop="clickSplit.double(() => launch(app, true))"
          @contextmenu="onContext($event, app)" @pointerdown="onIconDown($event, i, 'apps')">
          <img v-if="iconSrc(app)" class="dock-img" :src="iconSrc(app)" :alt="app.name" draggable="false"
            @error="($event.target as HTMLImageElement).style.display = 'none'">
          <span v-else class="dock-fallback">{{ app.name.slice(0, 1).toUpperCase() }}</span>
          <span class="dock-dot" :class="{ on: isRunning(app) }" />
        </button>
      </div>

      <!-- 内置功能快捷入口：分隔条 + 渐变磁贴，排在应用图标右侧 -->
      <span v-if="builtinList.length" class="dock-sep" />
      <div v-if="builtinList.length" class="dock-builtin">
        <button v-for="(b, i) in builtinList" :key="b.id" class="dock-btn bi"
          :class="{ dragging: dragSort?.active && dragSort.zone === 'builtin' && dragSort.from === i }"
          :style="[{ width: size + 'px', height: size + 'px' }, iconShift(i, 'builtin')]"
          :title="t(b.titleKey)" @click="clickSplit.single(() => openBuiltin(b.id))"
          @dblclick.stop="clickSplit.double(() => openBuiltin(b.id, true))"
          @contextmenu="onBuiltinContext($event, b.id)" @pointerdown="onIconDown($event, i, 'builtin')">
          <span class="bi-tile" :style="{ background: glossOf(b.id) }">
            <Icon :name="b.icon" :size="Math.round(size * 0.52)" />
          </span>
        </button>
      </div>

      <!-- 固定的「工作台」入口：全屏展示本机应用与全部内置功能 -->
      <button class="dock-btn bi" :style="{ width: size + 'px', height: size + 'px' }"
        :title="t('dock_workbench')" @click="openBuiltin('pad')">
        <span class="bi-tile pad-tile" :style="{ background: glossOf('pad') }">
          <Icon name="grid" :size="Math.round(size * 0.52)" />
        </span>
      </button>

      <button class="dock-btn add" :style="{ width: size + 'px', height: size + 'px' }"
        title="添加快捷方式" @click="onPlusClick">
        <span class="add-glyph">+</span>
      </button>
    </div>

    <!-- 弹层专用层：坐标为基准系，由 CSS 补偿变换送回屏幕原位；透明区域可点击关闭弹层 -->
    <div v-if="ctx || plusMenu || barCtx || biPicker" class="pop-layer" :class="cfg.position">
      <ContextMenu v-if="ctx" :x="ctx.x" :y="ctx.y" :items="ctx.items" no-clamp
        @select="onCtxSelect" @close="ctx = null" />
      <ContextMenu v-if="plusMenu" :x="plusMenu.x" :y="plusMenu.y" no-clamp
        :items="[
          { key: 'pick-file', label: '添加本地快捷方式…' },
          { key: 'from-installed', label: '从已安装应用选择…' },
          { key: 'add-builtin', label: t('dock_add_builtin') },
        ]"
        @select="onPlusSelect" @close="plusMenu = null" />

      <!-- 内置功能选择器：勾选即增删，点外部关闭 -->
      <div v-if="biPicker" class="bi-picker" :class="{ 'bi-dark': dark }"
        :style="{ left: biPicker.x + 'px', top: biPicker.y + 'px' }"
        @contextmenu.prevent>
        <div class="bi-picker-title">{{ t("dock_builtin_title") }}</div>
        <button v-for="b in PICKABLE" :key="b.id" class="bi-row" :class="{ on: (cfg.builtin ?? []).includes(b.id) }"
          @click="toggleBuiltin(b.id)">
          <span class="bi-mini" :style="{ background: glossOf(b.id) }"><Icon :name="b.icon" :size="13" /></span>
          <span class="bi-name">{{ t(b.titleKey) }}</span>
          <span class="bi-check" :class="{ on: (cfg.builtin ?? []).includes(b.id) }">
            <Icon name="check" :size="12" />
          </span>
        </button>
      </div>

      <ContextMenu v-if="barCtx" :x="barCtx.x" :y="barCtx.y" no-clamp
        :items="[
          { key: 'settings', label: 'Dock 设置…' },
          { key: 'snip', label: '截图并复制' },
          { key: 'restore-taskbar', label: '恢复 Windows 任务栏' },
          { key: 'hide', label: '关闭 Dock' },
          { key: 'quit', label: '退出 Worktop', danger: true },
        ]"
        @select="onBarCtxSelect" @close="barCtx = null" />
    </div>
  </div>
</template>

<style scoped>
.dock-root { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
  background: transparent; user-select: none; }
.dock-root.left, .dock-root.right { align-items: center; }
.dock-root.left { justify-content: flex-start; }
.dock-root.right { justify-content: flex-end; }
.dock-root.left .dockbar, .dock-root.right .dockbar { flex-direction: column; }
/* 弹层扩窗期间：bottom 向上扩（底边不动）→ 图标条钉到底边（padding-bottom 由内联样式给）；
 * left/right 朝向本来就以屏幕侧边缘对齐（flex-start / flex-end），扩窗不影响图标条位置 */
.dock-root.bottom.pop { align-items: flex-end; }

.hot-handle { position: absolute; left: 50%; top: -6px; transform: translateX(-50%); width: 64px; height: 3px;
  border-radius: 999px; background: rgba(255,255,255,.75); box-shadow: 0 0 6px rgba(0,0,0,.35);
  opacity: 0; transition: opacity .18s; pointer-events: none; }
.dock-root.is-hidden .hot-handle { opacity: 1; }
.dock-root.left .hot-handle { top: 50%; left: auto; right: -6px; transform: translateY(-50%); width: 3px; height: 64px; }
.dock-root.right .hot-handle { top: 50%; left: -6px; transform: translateY(-50%); width: 3px; height: 64px; }

.dockbar { position: relative; display: flex; align-items: flex-end; gap: 8px; padding: 10px; border-radius: 22px;
  background: transparent;
  transition: transform .18s cubic-bezier(.3,.8,.4,1), opacity .18s; }
/* 浅色 / 深色：完全透明，图标直接浮在壁纸上 */
.dock-light .dockbar { background: transparent; box-shadow: none; }
.dock-dark .dockbar { background: transparent; box-shadow: none; }
/* 隐藏态：只隐藏图标，保留贴边的热区提示条——否则用户既看不见 Dock 也没处唤醒 */
.dock-root.is-hidden .dock-btn,
.dock-root.is-hidden .add { opacity: 0; pointer-events: none; }

.dock-btn { position: relative; border: none; padding: 0; background: transparent; cursor: pointer;
  display: flex; align-items: center; justify-content: center; border-radius: 12px;
  transition: transform .16s cubic-bezier(.3,.7,.4,1.2), filter .16s; transform-origin: bottom center;
  will-change: transform; }
/* 只放大指针下的图标；抬升一点让它浮出 Dock 线 */
.dock-btn:hover { transform: scale(1.4) translateY(-6px); z-index: 5; filter: brightness(1.04); }
/* 拖动排序：被拖图标原位半透明浮起（inline 的让位平移只作用于邻居，不覆盖本图标） */
.dock-btn.dragging { opacity: .5; z-index: 6; cursor: grabbing; }
.dock-btn.dragging:hover { transform: none; }
.dock-root.left .dock-btn { transform-origin: center left; }
.dock-root.right .dock-btn { transform-origin: center right; }
.dock-root.left .dock-btn:hover { transform: scale(1.4) translateX(6px); }
.dock-root.right .dock-btn:hover { transform: scale(1.4) translateX(-6px); }
/* 图标本身不再带投影：透明 Dock 上阴影会和放大后的邻居叠成"重影" */
.dock-img { width: 100%; height: 100%; object-fit: contain; border-radius: 11px; pointer-events: none; }
.dock-fallback { width: 100%; height: 100%; border-radius: 11px; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #4a90e2, #2563c9); color: #fff; font-weight: 700; font-size: 18px; }
.dock-dot { position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%); width: 4px; height: 4px;
  border-radius: 50%; background: #6e6e73; opacity: 0; transition: opacity .15s; }
.dock-dark .dock-dot { background: #fff; }
.dock-dot.on { opacity: .92; }
.add { border: 1.5px dashed rgba(0,0,0,.22); color: rgba(0,0,0,.5); background: rgba(255,255,255,.35); }
.add:hover { background: rgba(255,255,255,.7); color: rgba(0,0,0,.7); }
.dock-dark .add { border-color: rgba(255,255,255,.35); color: rgba(255,255,255,.8); background: rgba(255,255,255,.06); }
.dock-dark .add:hover { background: rgba(255,255,255,.14); }
.add-glyph { font-size: 22px; font-weight: 300; line-height: 1; }

/* 内置功能入口：应用图标 | 分隔条 | 渐变磁贴（+ 工作台按钮） */
.dock-sep { flex: none; align-self: center; width: 8px; height: 2px; border-radius: 999px;
  background: rgba(0,0,0,.18); margin: 0 4px; }
.dock-dark .dock-sep { background: rgba(255,255,255,.28); }
.dock-root.left .dock-sep, .dock-root.right .dock-sep { width: 2px; height: 8px; margin: 4px 0; }
/* 应用图标区：独立拖动带（固定图标在容器外，不参与排序） */
.dock-apps { display: flex; align-items: flex-end; gap: 8px; }
.dock-root.left .dock-apps, .dock-root.right .dock-apps { flex-direction: column; align-items: center; }
.dock-builtin { display: flex; align-items: flex-end; gap: 8px; }
.dock-root.left .dock-builtin, .dock-root.right .dock-builtin { flex-direction: column; align-items: center; }
.bi-tile { width: 100%; height: 100%; border-radius: 11px; display: flex; align-items: center; justify-content: center;
  color: #fff; box-shadow: 0 4px 10px rgba(30,55,90,.2), inset 0 1px 1px rgba(255,255,255,.4);
  pointer-events: none; }
/* 工作台磁贴：浅色玻璃底上图标用深色，玻璃高光更亮 */
.bi-tile.pad-tile { color: #54688f;
  box-shadow: 0 4px 12px rgba(60,90,150,.26), inset 0 1px 1px rgba(255,255,255,.95); }

/* 弹层专用层：坐标是「基准系」，窗口扩出后视口原点平移了 popGrow，
 * 用补偿变换把弹层送回屏幕原位（left 朝向原点不动，无需补偿）。
 * 层本身 pointer-events:none，只有真实弹层可交互——扩出来的透明空白落到 ctx-bg 上即关闭。 */
.pop-layer { position: fixed; inset: 0; z-index: 48; pointer-events: none; }
.pop-layer > * { pointer-events: auto; }
.pop-layer.bottom :deep(.ctx-menu), .pop-layer.bottom > .bi-picker { transform: translateY(var(--pg, 0px)); }
.pop-layer.right :deep(.ctx-menu), .pop-layer.right > .bi-picker { transform: translateX(var(--pg, 0px)); }

/* 内置功能选择器（＋ 菜单弹出，向屏幕内侧展开，越界由扩窗补齐） */
.bi-picker { position: fixed; z-index: 60; box-sizing: border-box; width: 240px; padding: 10px 8px 8px; border-radius: 14px;
  display: flex; flex-direction: column; gap: 2px;
  background: rgba(255,255,255,.92); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(0,0,0,.08); box-shadow: 0 14px 40px rgba(20,40,70,.25);
  animation: pwbFade .14s ease; }
.bi-dark.bi-picker { background: rgba(36,41,50,.92); border-color: rgba(255,255,255,.1);
  box-shadow: 0 14px 40px rgba(0,0,0,.5); }
.bi-picker-title { font-size: 11px; font-weight: 600; color: rgba(0,0,0,.45); padding: 2px 8px 6px; }
.bi-dark .bi-picker-title { color: rgba(255,255,255,.45); }
.bi-row { display: flex; align-items: center; gap: 9px; height: 34px; padding: 0 8px 0 6px; border: none;
  border-radius: 9px; background: transparent; cursor: pointer; text-align: left; }
.bi-row:hover { background: rgba(0,0,0,.06); }
.bi-dark .bi-row:hover { background: rgba(255,255,255,.08); }
.bi-mini { flex: none; width: 22px; height: 22px; border-radius: 6px; display: flex; align-items: center;
  justify-content: center; color: #fff; box-shadow: inset 0 1px 1px rgba(255,255,255,.35); }
.bi-name { flex: 1; font-size: 12.5px; color: #1d1d1f; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bi-dark .bi-name { color: #eef1f6; }
.bi-check { flex: none; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center;
  color: transparent; }
.bi-check.on { color: #2e8b57; }
.bi-dark .bi-check.on { color: #6fe08c; }
</style>
