<script setup lang="ts">
// 桌面级 Dock 悬浮窗：完全透明的图标条 + 鱼眼放大 + 运行指示点 + 自动隐藏 + 右键菜单。
// 独立 OS 窗口（透明/无边框/置顶/不进任务栏），由主窗口通过 dock_open 创建。
import { computed, onMounted, onUnmounted, ref, watch } from "vue"
import { currentMonitor, getCurrentWindow, PhysicalPosition, PhysicalSize } from "@tauri-apps/api/window"
import { listen, emit } from "@tauri-apps/api/event"
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
import ContextMenu, { type CtxItem } from "../components/ContextMenu.vue"

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

const pinned = computed<DockAppInfo[]>(() => {
  const byId = new Map(allApps.value.map((a) => [a.id, a]))
  if (cfg.value.apps.length) {
    return cfg.value.apps.map((id) => byId.get(id)).filter((a): a is DockAppInfo => Boolean(a))
  }
  return autoPick(allApps.value, 10)
})

const size = computed(() => cfg.value.size)
const dims = computed(() => dockWindowSize(cfg.value, pinned.value.length))

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
  if (!cfg.value.autohide || dragging.value) return
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => void placeHidden(), 450)
}

/* ---------- 悬停放大（只放大指针下的那个图标，由 CSS :hover 完成） ---------- */
function onBarLeave() {
  onLeave()
}

/* ---------- 图标拖动排序（按住拖动超过 8px 进入；邻位平移让位预览；松手固化顺序） ---------- */
const dragSort = ref<{
  from: number
  to: number
  x0: number
  y0: number
  active: boolean
  horizontal: boolean
  origin: number // 图标带起点（相对视口）
  gap: number
} | null>(null)
let suppressClick = false

function onIconDown(e: PointerEvent, idx: number) {
  if (e.button !== 0) return
  const bar = (e.currentTarget as HTMLElement).parentElement
  if (!bar) return
  const rect = bar.getBoundingClientRect()
  const horizontal = cfg.value.position === "bottom"
  dragSort.value = {
    from: idx,
    to: idx,
    x0: e.clientX,
    y0: e.clientY,
    active: false,
    horizontal,
    origin: horizontal ? rect.left : rect.top,
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
  // 落点 = 指针在图标带上的位置四舍五入到最近格位
  const s = size.value
  const p = (d.horizontal ? e.clientX : e.clientY) - d.origin - dims.value.padding
  const raw = Math.round((p - s / 2) / (s + d.gap))
  d.to = Math.min(pinned.value.length - 1, Math.max(0, raw))
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
  // 首次拖动 = 把自动推荐固化为固定列表，再按拖动落位重排
  const current = cfg.value.apps.length ? [...cfg.value.apps] : pinned.value.map((a) => a.id)
  const [moved] = current.splice(d.from, 1)
  current.splice(d.to, 0, moved)
  const next = { ...cfg.value, apps: current }
  cfg.value = next
  writeDockConfig(next)
  void emit("pwb-dock-config", next)
  void syncGeometry()
}

/** 拖动预览：from 与 to 之间的图标整体平移一格让位 */
function iconShift(i: number): { transform?: string } {
  const d = dragSort.value
  if (!d?.active || d.from === d.to) return {}
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
async function launch(app: DockAppInfo) {
  if (suppressClick) return
  try {
    await invoke("dock_toggle", { path: app.path })
    await refreshRunning()
  } catch (e) {
    console.warn(e)
  }
}

const ctx = ref<{ x: number; y: number; app: DockAppInfo; items: CtxItem[] } | null>(null)
function onContext(e: MouseEvent, app: DockAppInfo) {
  e.preventDefault()
  ctx.value = {
    x: e.clientX,
    y: e.clientY,
    app,
    items: [
      { key: "open", label: "打开" },
      { key: "reveal", label: "在文件夹中显示" },
      { key: "remove", label: "从 Dock 移除", danger: true },
      { key: "settings", label: "Dock 设置…" },
    ],
  }
}
async function onCtxSelect(key: string) {
  const target = ctx.value?.app
  if (!target) return
  if (key === "open") await launch(target)
  else if (key === "reveal") await invoke("dock_reveal", { path: target.path }).catch(() => {})
  else if (key === "remove") {
    const current = cfg.value.apps.length ? cfg.value.apps : pinned.value.map((a) => a.id)
    const next = { ...cfg.value, apps: current.filter((id) => id !== target.id) }
    cfg.value = next
    writeDockConfig(next)
    await emit("pwb-dock-config", next)
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
function onPlusClick(e: MouseEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  plusMenu.value = { x: Math.round(rect.left), y: Math.round(rect.top) - 6 }
}
async function onPlusSelect(key: string) {
  if (key === "pick-file") await addShortcut()
  else if (key === "from-installed") await openSettings()
}

/* Dock 条空白处右键：设置 / 关闭 */
const barCtx = ref<{ x: number; y: number } | null>(null)
function onBarContext(e: MouseEvent) {
  if ((e.target as HTMLElement).closest(".dock-btn")) return
  e.preventDefault()
  barCtx.value = { x: e.clientX, y: e.clientY }
}
async function onBarCtxSelect(key: string) {
  if (key === "settings") await openSettings()
  else if (key === "snip") {
    // 统一截图入口：装了 AirSnip 用它（转发 F1），否则自带拖选截图
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

/* ---------- 生命周期 ---------- */
let poll: ReturnType<typeof setInterval> | null = null
let unlisten: (() => void) | null = null

onMounted(async () => {
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
    await syncGeometry()
    await refreshScan(false)
    // 尺寸变化后重新对齐
    const cur = win
    try {
      await cur.setSize(new (await import("@tauri-apps/api/window")).LogicalSize(dims.value.width, dims.value.height))
    } catch {}
    await syncGeometry()
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
  if (poll) clearInterval(poll)
  stopEdgePoll()
  if (unlisten) unlisten()
})
</script>

<template>
  <div class="dock-root" :class="[hidden ? 'is-hidden' : '', cfg.position, dark ? 'dock-dark' : 'dock-light']"
    @mouseenter="onEnter" @mouseleave="onLeave">
    <div class="dockbar" @pointerleave="onBarLeave"
      @contextmenu="onBarContext">
      <!-- 隐藏态热区提示线：贴在本体边缘（窗口比本人大一圈，贴窗口边会飘空） -->
      <span class="hot-handle" />
      <button v-for="(app, i) in pinned" :key="app.id" class="dock-btn"
        :class="{ dragging: dragSort?.active && dragSort.from === i }"
        :style="[{ width: size + 'px', height: size + 'px' }, iconShift(i)]"
        :title="app.name" @click="launch(app)" @contextmenu="onContext($event, app)"
        @pointerdown="onIconDown($event, i)">
        <img v-if="iconSrc(app)" class="dock-img" :src="iconSrc(app)" :alt="app.name" draggable="false"
          @error="($event.target as HTMLImageElement).style.display = 'none'">
        <span v-else class="dock-fallback">{{ app.name.slice(0, 1).toUpperCase() }}</span>
        <span class="dock-dot" :class="{ on: isRunning(app) }" />
      </button>

      <button class="dock-btn add" :style="{ width: size + 'px', height: size + 'px' }"
        title="添加快捷方式" @click="onPlusClick">
        <span class="add-glyph">+</span>
      </button>
    </div>

    <ContextMenu v-if="ctx" :x="ctx.x" :y="ctx.y" :items="ctx.items"
      @select="onCtxSelect" @close="ctx = null" />
    <ContextMenu v-if="plusMenu" :x="plusMenu.x" :y="plusMenu.y"
      :items="[
        { key: 'pick-file', label: '添加本地快捷方式…' },
        { key: 'from-installed', label: '从已安装应用选择…' },
      ]"
      @select="onPlusSelect" @close="plusMenu = null" />
    <ContextMenu v-if="barCtx" :x="barCtx.x" :y="barCtx.y"
      :items="[
        { key: 'settings', label: 'Dock 设置…' },
        { key: 'snip', label: '截图并复制' },
        { key: 'restore-taskbar', label: '恢复 Windows 任务栏' },
        { key: 'hide', label: '关闭 Dock' },
        { key: 'quit', label: '退出 Worktop', danger: true },
      ]"
      @select="onBarCtxSelect" @close="barCtx = null" />
  </div>
</template>

<style scoped>
.dock-root { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
  background: transparent; user-select: none; }
.dock-root.left, .dock-root.right { align-items: center; }
.dock-root.left { justify-content: flex-start; }
.dock-root.right { justify-content: flex-end; }
.dock-root.left .dockbar, .dock-root.right .dockbar { flex-direction: column; }

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


</style>
