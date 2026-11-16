<script setup lang="ts">
// WorkTop 原生截图覆盖窗：Rust 负责抓屏 / 剪贴板，这里负责框选、标注与导出。
// 坐标约定：selection、annotations 一律使用截图的物理像素；DOM 样式只使用 CSS 逻辑像素，
// 两者通过 viewW/imageW 换算，绝不混用 devicePixelRatio（覆盖窗已按显示器物理尺寸建立）。
//
// 指针全部在 window 上以捕获阶段监听：覆盖窗由隐藏态 show 出来，某些情况下 WebView
// 未必拿到前台焦点，若只把监听挂在 canvas 上，一旦命中被上层元素接管就会整段丢事件，
// 表现为「选区不跟手 / 看不到鼠标」。挂在 window 上则与命中的元素无关。
//
// 光标与几何的「所有权」参考 ShareX / Flameshot：系统光标由 Rust 在 WM_SETCURSOR
// 里统一呈现（见 snip.rs），页面不依赖 WebView2 决定指针形状；另外自绘一组十字
// 定位线，即便系统光标被触摸/远程输入抑制，用户仍能看清指针落在哪里。
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { save } from "@tauri-apps/plugin-dialog"
import Icon from "../components/Icon.vue"

type Tool = "select" | "rect" | "ellipse" | "arrow" | "pen" | "marker" | "text" | "mosaic"
type DrawTool = Exclude<Tool, "select">
type Point = { x: number; y: number }
type Rect = { x: number; y: number; w: number; h: number }
type Annotation = { tool: DrawTool; color: string; size: number; points: Point[]; fill?: boolean; text?: string }
type Preview = { x: number; y: number; width: number; height: number; png_base64: string }
type DragState =
  | { kind: "new"; start: Point }
  | { kind: "move"; start: Point; original: Rect }
  | { kind: "resize"; start: Point; original: Rect; handle: string }
  | { kind: "draw"; draft: Annotation }

const COLORS = ["#ff453a", "#ff9f0a", "#ffd60a", "#30d158", "#409cff", "#f5f5f7"]
/** 线宽档位（截图原始像素；渲染时再乘屏幕缩放） */
const WIDTHS = [2, 3, 5, 8]
const TOOLS: { id: Tool; icon: string; label: string; key: string }[] = [
  { id: "select", icon: "crop", label: "选区", key: "V" },
  { id: "rect", icon: "square", label: "矩形", key: "R" },
  { id: "ellipse", icon: "ellipse", label: "椭圆", key: "E" },
  { id: "arrow", icon: "arrow", label: "箭头", key: "A" },
  { id: "pen", icon: "pencil", label: "画笔", key: "P" },
  { id: "marker", icon: "marker", label: "马克笔", key: "H" },
  { id: "text", icon: "text", label: "文字", key: "T" },
  { id: "mosaic", icon: "mosaic", label: "马赛克", key: "M" },
]
const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"]

const board = ref<HTMLCanvasElement | null>(null)
const toolbar = ref<HTMLElement | null>(null)
const guideH = ref<HTMLElement | null>(null)
const guideV = ref<HTMLElement | null>(null)
/** 工具条区域的软件定位圈：系统光标被抑制时，仍能看清指针落在哪个按钮上。 */
const uiCursor = ref<HTMLElement | null>(null)
const ready = ref(false)
const previewUrl = ref("")
const fatal = ref("")
const notice = ref("")
const busy = ref(false)
const done = ref("")
const tool = ref<Tool>("select")
const color = ref(COLORS[4])
/** 当前工具的选项：线宽 + 是否填充（矩形/椭圆） */
const size = ref(3)
const fill = ref(false)
const redoStack = ref<Annotation[]>([])
/** 正在输入的文字标注（image 坐标）；Enter 提交、Esc 放弃、失焦提交 */
const textEdit = ref<{ x: number; y: number; value: string } | null>(null)
const textInput = ref<HTMLInputElement | null>(null)
const selection = ref<Rect | null>(null)
const annotations = ref<Annotation[]>([])
const viewW = ref(0)
const viewH = ref(0)
const cursor = ref("crosshair")
/** 工具条的水平锚点（CSS 坐标）：取按下的那一下与松开的那一下，拖动过程中不动，避免每帧重排。 */
const anchor = ref({ x: 0, y: 0 })
const toolbarW = ref(760)
const toolbarH = ref(46)
/** 是否正在拖动（新建 / 移动 / 缩放 / 标注都算），拖动期间收起工具条，减少每帧的重排与背景模糊。 */
const dragging = ref(false)
const creating = ref(false)

/** 工具条尺寸观测：选项行/状态行出现时会改高度，位置依赖高度才能决定「下方还是上方」 */
let toolbarRo: ResizeObserver | null = null
watch(toolbar, (el) => {
  toolbarRo?.disconnect()
  toolbarRo = null
  if (!el) return
  toolbarRo = new ResizeObserver(() => void measureToolbar())
  toolbarRo.observe(el)
})

const image = new Image()
let imageW = 0
let imageH = 0
/** 截图在虚拟桌面中的物理原点：贴图要按屏幕坐标摆放，不能只用选区内的相对坐标 */
const shotOrigin = { x: 0, y: 0 }
let drag: DragState | null = null
let closeTimer: ReturnType<typeof setTimeout> | null = null
let waitTimer: ReturnType<typeof setTimeout> | null = null
let inkRaf = 0
let loading = false
let readyNotified = false
let lastCursorKind = ""
/**
 * 十字定位线 + 工具条定位圈，全部用直接 DOM 写入：
 * 避免每帧触发 Vue 响应式更新与虚拟 DOM diff。
 * showGuides：全屏十字线只在框选区显示；showUiCursor：定位圈只在工具条等 UI 上显示。
 * 两者互斥，所以任何时刻画面上只有一套指示，不会和系统光标挤成两个箭头。
 */
let guidesShown = false
let uiCursorShown = false
function moveGuides(x: number, y: number, showGuides: boolean, showUiCursor: boolean) {
  const h = guideH.value
  const v = guideV.value
  const dot = uiCursor.value
  if (!h || !v || !dot) return
  h.style.transform = `translate3d(0, ${y}px, 0)`
  v.style.transform = `translate3d(${x}px, 0, 0)`
  dot.style.transform = `translate3d(${x}px, ${y}px, 0)`
  if (showGuides !== guidesShown) {
    h.style.opacity = showGuides ? "1" : "0"
    v.style.opacity = showGuides ? "1" : "0"
    guidesShown = showGuides
  }
  if (showUiCursor !== uiCursorShown) {
    dot.style.opacity = showUiCursor ? "1" : "0"
    uiCursorShown = showUiCursor
  }
}

const unit = computed(() => Math.max(1, imageW / Math.max(1, viewW.value)))
const selLabel = computed(() => {
  const s = selection.value
  if (!s) return ""
  return `${Math.round(s.w)} × ${Math.round(s.h)}`
})
/** 选区框交给 DOM：只在尺寸变化时更新一次 transform 级别的小盒子，不再整屏重画画布。 */
const selBox = computed(() => {
  const s = selection.value
  if (!s || !imageW) return null
  const sx = viewW.value / imageW
  const sy = viewH.value / imageH
  return {
    left: `${s.x * sx}px`,
    top: `${s.y * sy}px`,
    width: `${Math.max(0, s.w * sx)}px`,
    height: `${Math.max(0, s.h * sy)}px`,
  }
})
/**
 * 四周暗区用 4 块普通定位元素拼出来。
 * 原来那句 `box-shadow: 0 0 0 100vmax` 会在 2560×1600 上生成一张约 5000×5000 的
 * 阴影层，选区每动一帧就要整层重新栅格化——这才是拖框「发飘、不跟手」的主因。
 * 4 个小矩形只改自身宽高，且都是静态纯色，不触发大图层重绘。
 */
const dim = computed(() => {
  const s = selection.value
  if (!s || !imageW) return null
  const sx = viewW.value / imageW
  const sy = viewH.value / imageH
  const l = s.x * sx
  const t = s.y * sy
  const r = (s.x + s.w) * sx
  const b = (s.y + s.h) * sy
  const band = Math.max(0, b - t)
  return {
    top: { left: "0px", top: "0px", width: "100%", height: `${Math.max(0, t)}px` },
    bottom: { left: "0px", top: `${b}px`, width: "100%", height: `${Math.max(0, viewH.value - b)}px` },
    left: { left: "0px", top: `${t}px`, width: `${Math.max(0, l)}px`, height: `${band}px` },
    right: { left: `${r}px`, top: `${t}px`, width: `${Math.max(0, viewW.value - r)}px`, height: `${band}px` },
  }
})
const sizeStyle = computed(() => {
  const s = selection.value
  if (!s || !imageW) return { display: "none" }
  const sx = viewW.value / imageW
  const sy = viewH.value / imageH
  const left = Math.min(Math.max(0, viewW.value - 132), Math.max(0, s.x * sx))
  const above = s.y * sy - 28
  return { left: `${left}px`, top: `${above >= 6 ? above : s.y * sy + 6}px` }
})
const showToolbar = computed(() => {
  const s = selection.value
  return !!s && s.w >= 5 && s.h >= 5 && !dragging.value
})
/** 工具条底部状态行：进度 / 回执 / 错误都在这一条里，不再用居中浮层遮住截图 */
const statusText = computed(() => done.value || notice.value || (busy.value ? "正在处理…" : ""))
const statusErr = computed(() => !done.value && !!notice.value)
/** 工具条跟随鼠标横向锚点，并始终优先落在选区下方；下方放不下再翻到上方。 */
const toolbarStyle = computed(() => {
  const s = selection.value
  if (!s || !showToolbar.value) return { display: "none" }
  const sy = viewH.value / imageH
  const tw = Math.min(toolbarW.value || 760, Math.max(240, viewW.value - 16))
  const th = toolbarH.value || 46
  const gap = 12
  const edge = 10
  const topEdge = s.y * sy
  const bottomEdge = (s.y + s.h) * sy
  const left = clamp(anchor.value.x - tw / 2, edge, Math.max(edge, viewW.value - tw - edge))
  let top = bottomEdge + gap
  if (top + th > viewH.value - edge) {
    const above = topEdge - th - gap
    top = above >= edge ? above : clamp(bottomEdge - th - 10, edge, Math.max(edge, viewH.value - th - edge))
  }
  return { left: `${Math.round(left)}px`, top: `${Math.round(top)}px` }
})

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v))
}
/** 工具条等 UI 上的按下不参与框选。 */
function isUi(target: EventTarget | null) {
  // 文字层也要算 UI：那一层是可选中的 DOM 文本，指针落在上面要交给浏览器做划词。
  return target instanceof Element && (!!target.closest(".snip-ui") || !!target.closest(".snip-ocr"))
}
/** 同一套光标语义同时喂给 CSS（浏览器预览兜底）和 Rust（原生 WM_SETCURSOR）。 */
function applyCursor(next: string) {
  if (cursor.value !== next) cursor.value = next
  const native =
    next === "crosshair" ? "crosshair"
    : next === "text" ? "text"
    : next === "move" ? "move"
    : next === "nwse-resize" ? "nwse"
    : next === "nesw-resize" ? "nesw"
    : next === "ns-resize" ? "ns"
    : next === "ew-resize" ? "we"
    : "arrow"
  if (native !== lastCursorKind) {
    lastCursorKind = native
    void invoke("snip_cursor", { kind: native }).catch(() => {})
  }
}
async function measureToolbar() {
  await nextTick()
  const el = toolbar.value
  if (!el) return
  // 只在真的变了才写回：写回会触发 toolbarStyle 重算，值没变就不该再走一轮
  const w = el.offsetWidth
  const h = el.offsetHeight
  if (w && Math.abs(w - toolbarW.value) > 0.5) toolbarW.value = w
  if (h && Math.abs(h - toolbarH.value) > 0.5) toolbarH.value = h
}
function normalize(a: Point, b: Point): Rect {
  const x = clamp(Math.round(Math.min(a.x, b.x)), 0, imageW)
  const y = clamp(Math.round(Math.min(a.y, b.y)), 0, imageH)
  const right = clamp(Math.round(Math.max(a.x, b.x)), 0, imageW)
  const bottom = clamp(Math.round(Math.max(a.y, b.y)), 0, imageH)
  return { x, y, w: right - x, h: bottom - y }
}
function inside(p: Point, r: Rect) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h
}
function pointFromEvent(e: PointerEvent): Point {
  // 覆盖窗从 (0,0) 铺满整屏，board 的 CSS 尺寸恒等于 innerWidth/Height。
  // 每次 pointermove 都读 getBoundingClientRect 会强制同步布局；直接用缓存的视口尺寸，
  // 拖动时每帧少一次 layout flush。
  return {
    x: clamp((e.clientX * imageW) / Math.max(1, viewW.value), 0, imageW),
    y: clamp((e.clientY * imageH) / Math.max(1, viewH.value), 0, imageH),
  }
}
function handlePoints(r: Rect): Record<string, Point> {
  const xm = r.x + r.w / 2
  const ym = r.y + r.h / 2
  return {
    nw: { x: r.x, y: r.y }, n: { x: xm, y: r.y }, ne: { x: r.x + r.w, y: r.y },
    e: { x: r.x + r.w, y: ym }, se: { x: r.x + r.w, y: r.y + r.h },
    s: { x: xm, y: r.y + r.h }, sw: { x: r.x, y: r.y + r.h }, w: { x: r.x, y: ym },
  }
}
function hitHandle(p: Point): string | null {
  const s = selection.value
  if (!s) return null
  const radius = 11 * unit.value
  for (const [name, hp] of Object.entries(handlePoints(s))) {
    if (Math.abs(p.x - hp.x) <= radius && Math.abs(p.y - hp.y) <= radius) return name
  }
  return null
}
function cursorForHandle(handle: string | null) {
  if (!handle) return "crosshair"
  if (handle === "n" || handle === "s") return "ns-resize"
  if (handle === "e" || handle === "w") return "ew-resize"
  if (handle === "nw" || handle === "se") return "nwse-resize"
  return "nesw-resize"
}

/** 马赛克采样缓存：同一块区域反复重绘（拖动时每帧）不必每次重新降采样 */
const mosaicCache = new WeakMap<Annotation, { sig: string; canvas: HTMLCanvasElement }>()

function drawAnnotations(ctx: CanvasRenderingContext2D, items: Annotation[]) {
  const u = unit.value
  for (const ann of items) {
    // 文字标注只有一个锚点，先处理
    if (ann.tool === "text") {
      const p = ann.points[0]
      const t = (ann.text ?? "").trim()
      if (!p || !t) continue
      const px = Math.max(10, ann.size * 6)
      ctx.fillStyle = ann.color
      ctx.textBaseline = "top"
      ctx.font = `600 ${px}px "Segoe UI", "Microsoft YaHei UI", system-ui, sans-serif`
      t.split("\n").forEach((line, i) => ctx.fillText(line, p.x, p.y + i * px * 1.28))
      continue
    }
    if (ann.points.length < 2) continue
    ctx.strokeStyle = ann.color
    ctx.fillStyle = ann.color
    ctx.lineWidth = Math.max(1, (ann.tool === "marker" ? ann.size * 3 : ann.size) * u)
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    const a = ann.points[0]
    const b = ann.points[ann.points.length - 1]
    if (ann.tool === "pen" || ann.tool === "marker") {
      ctx.globalAlpha = ann.tool === "marker" ? 0.34 : 1
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      for (const p of ann.points.slice(1)) ctx.lineTo(p.x, p.y)
      ctx.stroke()
      ctx.globalAlpha = 1
    } else if (ann.tool === "rect") {
      const r = normalize(a, b)
      if (ann.fill) ctx.fillRect(r.x, r.y, r.w, r.h)
      else ctx.strokeRect(r.x, r.y, r.w, r.h)
    } else if (ann.tool === "mosaic") {
      // 降采样再放大 = 像素化；采样源是原截图（image），不是已经画过标注的画布
      const r = normalize(a, b)
      if (r.w < 3 || r.h < 3) continue
      const block = Math.max(6, Math.round(9 * u))
      const sig = `${r.x}|${r.y}|${r.w}|${r.h}|${block}`
      let hit = mosaicCache.get(ann)
      if (!hit || hit.sig !== sig) {
        const sw = Math.max(1, Math.round(r.w / block))
        const sh = Math.max(1, Math.round(r.h / block))
        const off = document.createElement("canvas")
        off.width = sw
        off.height = sh
        const octx = off.getContext("2d")
        if (!octx) continue
        octx.imageSmoothingEnabled = true
        octx.drawImage(image, r.x, r.y, r.w, r.h, 0, 0, sw, sh)
        hit = { sig, canvas: off }
        mosaicCache.set(ann, hit)
      }
      const prev = ctx.imageSmoothingEnabled
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(hit.canvas, r.x, r.y, r.w, r.h)
      ctx.imageSmoothingEnabled = prev
    } else if (ann.tool === "ellipse") {
      const r = normalize(a, b)
      ctx.beginPath()
      ctx.ellipse(r.x + r.w / 2, r.y + r.h / 2, Math.max(0.5, r.w / 2), Math.max(0.5, r.h / 2), 0, 0, Math.PI * 2)
      if (ann.fill) ctx.fill()
      else ctx.stroke()
    } else {
      const angle = Math.atan2(b.y - a.y, b.x - a.x)
      const head = Math.max(10 * u, ann.size * 4 * u)
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.moveTo(b.x, b.y)
      ctx.lineTo(b.x - head * Math.cos(angle - Math.PI / 6), b.y - head * Math.sin(angle - Math.PI / 6))
      ctx.moveTo(b.x, b.y)
      ctx.lineTo(b.x - head * Math.cos(angle + Math.PI / 6), b.y - head * Math.sin(angle + Math.PI / 6))
      ctx.stroke()
    }
  }
}

/** 画布只画标注（按截图像素直接变换），选区边框与手柄由 DOM 负责。 */
let inkDirty = false
function render() {
  const canvas = board.value
  if (!canvas) return
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  const s = selection.value
  const items = drag?.kind === "draw" ? [...annotations.value, drag.draft] : annotations.value
  if (!s || s.w <= 0 || s.h <= 0 || !items.length) {
    // 没有标注就不要每帧清整张画布：2560×1600 的 clearRect 一次是十几 MB 写入，
    // 框选时每帧清一次正是「鼠标发飘 / 跟不上」的主因。只在确实脏过之后清一次。
    if (inkDirty) {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      inkDirty = false
    }
    return
  }
  const kx = canvas.width / Math.max(1, imageW)
  const ky = canvas.height / Math.max(1, imageH)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  inkDirty = true
  ctx.setTransform(kx, 0, 0, ky, 0, 0)
  ctx.save()
  ctx.beginPath()
  ctx.rect(s.x, s.y, s.w, s.h)
  ctx.clip()
  drawAnnotations(ctx, items)
  ctx.restore()
}
/** 每帧最多重绘一次：高速拖动时 pointermove 可能一帧来好几次，重绘一次就够。 */
function scheduleRender() {
  if (inkRaf) return
  inkRaf = requestAnimationFrame(() => {
    inkRaf = 0
    render()
  })
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0 || busy.value || done.value || !ready.value) return
  if (isUi(e.target)) return
  e.preventDefault()
  // 第二次按下瞬间即判定为双击：直接全屏复制，比等浏览器 dblclick 快一拍。
  if (isDoubleTap(e)) {
    void captureFullScreen()
    return
  }
  const p = pointFromEvent(e)
  anchor.value = { x: e.clientX, y: e.clientY }
  dragging.value = true
  notice.value = ""
  // 选区一动，识别结果就对不上位置了：直接撤掉文字层，重新识别比错位显示更诚实。
  if (ocr.value) ocr.value = null

  if (tool.value === "text" && selection.value && inside(p, selection.value)) {
    dragging.value = false
    void openTextEditor(p)
    return
  }
  if (tool.value !== "select" && selection.value && inside(p, selection.value)) {
    drag = { kind: "draw", draft: { tool: tool.value, color: color.value, size: size.value, points: [p], fill: fill.value } }
    scheduleRender()
    return
  }
  if (tool.value === "select" && selection.value) {
    const handle = hitHandle(p)
    if (handle) {
      drag = { kind: "resize", start: p, original: { ...selection.value }, handle }
      return
    }
    if (inside(p, selection.value)) {
      drag = { kind: "move", start: p, original: { ...selection.value } }
      applyCursor("move")
      return
    }
  }
  // 新选区与旧标注绑定，重新框选时清空旧标注。
  annotations.value = []
  redoStack.value = []
  selection.value = { x: Math.round(p.x), y: Math.round(p.y), w: 0, h: 0 }
  drag = { kind: "new", start: p }
  creating.value = true
  render()
}

function resizeSelection(original: Rect, handle: string, p: Point): Rect {
  let left = original.x
  let right = original.x + original.w
  let top = original.y
  let bottom = original.y + original.h
  if (handle.includes("w")) left = p.x
  if (handle.includes("e")) right = p.x
  if (handle.includes("n")) top = p.y
  if (handle.includes("s")) bottom = p.y
  return normalize({ x: left, y: top }, { x: right, y: bottom })
}

function onPointerMove(e: PointerEvent) {
  if (!ready.value || fatal.value) return
  const ui = isUi(e.target)
  // 框选区显示全屏十字线；工具条上换成定位圈。两者都不依赖系统光标，
  // 即便 WebView2 把光标设成 NULL、或系统因触摸/远程输入抑制光标，位置依然可见。
  const active = !done.value && !busy.value
  moveGuides(e.clientX, e.clientY, !ui && active, ui && active)
  if (ui) {
    // 文字层上用 I 形光标，其它 UI 上是箭头
    const overText = e.target instanceof Element && !!e.target.closest(".snip-ocr")
    if (!drag) applyCursor(overText ? "text" : "arrow")
    return
  }
  const p = pointFromEvent(e)
  if (!drag) {
    if (tool.value === "select" && selection.value) {
      const handle = hitHandle(p)
      applyCursor(handle ? cursorForHandle(handle) : inside(p, selection.value) ? "move" : "crosshair")
    } else applyCursor("crosshair")
    return
  }
  const current = drag
  if (current.kind === "new") {
    selection.value = normalize(current.start, p)
  } else if (current.kind === "move") {
    const r = current.original
    const dx = p.x - current.start.x
    const dy = p.y - current.start.y
    selection.value = {
      x: Math.round(clamp(r.x + dx, 0, imageW - r.w)),
      y: Math.round(clamp(r.y + dy, 0, imageH - r.h)),
      w: r.w,
      h: r.h,
    }
  } else if (current.kind === "resize") {
    selection.value = resizeSelection(current.original, current.handle, p)
  } else {
    const points = current.draft.points
    if (current.draft.tool === "pen") {
      const last = points[points.length - 1]
      if (Math.hypot(p.x - last.x, p.y - last.y) >= Math.max(1, unit.value)) points.push(p)
    } else {
      if (points.length === 1) points.push(p)
      else points[points.length - 1] = p
    }
    scheduleRender()
    return
  }
  render()
}

function onPointerUp(e: PointerEvent) {
  if (!drag) return
  const current = drag
  drag = null
  dragging.value = false
  creating.value = false
  anchor.value = { x: e.clientX, y: e.clientY }
  if (current.kind === "new") {
    if (!selection.value || selection.value.w < 5 || selection.value.h < 5) selection.value = null
  } else if (current.kind === "draw") {
    const d = current.draft
    const a = d.points[0]
    const b = d.points[d.points.length - 1]
    const stroked = d.tool === "pen" || d.tool === "marker"
    if (stroked ? d.points.length > 1 : Math.hypot(b.x - a.x, b.y - a.y) > 3) {
      annotations.value.push(d)
      redoStack.value = []
    }
  }
  applyCursor("crosshair")
  render()
  void measureToolbar()
}

function clearAnnotations() {
  annotations.value = []
  redoStack.value = []
  render()
}
function undo() {
  const last = annotations.value.pop()
  if (last) redoStack.value.push(last)
  render()
}
function redo() {
  const last = redoStack.value.pop()
  if (last) annotations.value.push(last)
  render()
}
function selectAll() {
  selection.value = { x: 0, y: 0, w: imageW, h: imageH }
  annotations.value = []
  tool.value = "select"
  anchor.value = { x: viewW.value / 2, y: viewH.value - 24 }
  render()
  void measureToolbar()
}
/** 双击屏幕：后端直接复制原始全屏像素，跳过前端合成 PNG 与再次解码。 */
async function captureFullScreen() {
  if (!ready.value || busy.value || done.value) return
  busy.value = true
  moveGuides(0, 0, false, false)
  notice.value = ""
  try {
    await invoke("snip_copy_full")
    await closeSnip()
  } catch (e) {
    notice.value = String((e as Error)?.message ?? e)
    busy.value = false
  }
}

/**
 * 双击判定自己做：浏览器 dblclick 要等第二次「松开」才派发，慢半拍；
 * 直接在第二次按下的瞬间触发全屏复制，才是「双击即截全屏」。
 */
const DOUBLE_MS = 400
const DOUBLE_DIST = 10
let lastTap = { t: 0, x: -9999, y: -9999 }
function isDoubleTap(e: PointerEvent) {
  const now = performance.now()
  const hit = now - lastTap.t < DOUBLE_MS && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < DOUBLE_DIST
  lastTap = { t: now, x: e.clientX, y: e.clientY }
  return hit
}
/** 文字输入框的位置：image 坐标 → 视口坐标（跟随鼠标那一下的锚点） */
const textStyle = computed(() => {
  const t = textEdit.value
  if (!t || !imageW) return { display: "none" }
  const sx = viewW.value / imageW
  const sy = viewH.value / imageH
  const px = Math.max(10, size.value * 6) * sx
  return {
    left: `${Math.round(t.x * sx)}px`,
    top: `${Math.round(t.y * sy)}px`,
    fontSize: `${Math.round(px)}px`,
    color: color.value,
  }
})
async function openTextEditor(p: Point) {
  // 已有未提交的文字先落盘，避免切换点时丢掉
  commitText()
  textEdit.value = { x: p.x, y: p.y, value: "" }
  await nextTick()
  textInput.value?.focus()
}
function commitText() {
  const t = textEdit.value
  textEdit.value = null
  const text = t?.value.trim()
  if (!t || !text) return
  annotations.value.push({ tool: "text", color: color.value, size: size.value, points: [{ x: t.x, y: t.y }], text })
  redoStack.value = []
  render()
}

/* ---------- 文字识别（系统 OCR）：结果就地铺一层可选中的文字 ---------- */

type OcrWordBox = { text: string; x: number; y: number; w: number; h: number }
type OcrLineBox = { text: string; x: number; y: number; w: number; h: number; words: OcrWordBox[] }
type OcrPayload = { width: number; height: number; text: string; lines: OcrLineBox[]; lang: string }

const ocr = ref<{ text: string; lang: string; lines: OcrLineBox[] } | null>(null)
const ocrVisible = ref(true)
const ocrBusy = ref(false)

/** 一闪而过的提示：复制成功这类，1.6s 后自动从状态行撤掉 */
let flashTimer: ReturnType<typeof setTimeout> | null = null
function flash(text: string, ms = 1600) {
  notice.value = text
  if (flashTimer) clearTimeout(flashTimer)
  flashTimer = setTimeout(() => {
    if (notice.value === text) notice.value = ""
  }, ms)
}

/**
 * 识别用的图：**不带标注**（标注会挡住文字），长边控制在 2400 以内
 * （系统 OCR 对大图有上限，缩小后也更快）。返回缩放比，用来把结果坐标换算回物理像素。
 */
function composeForOcr(): { png: string; scale: number } {
  const s = selection.value
  if (!s || s.w < 2 || s.h < 2) throw new Error("请先拖选一个识别区域")
  const scale = Math.min(1, 2400 / Math.max(s.w, s.h))
  const out = document.createElement("canvas")
  out.width = Math.max(1, Math.round(s.w * scale))
  out.height = Math.max(1, Math.round(s.h * scale))
  const ctx = out.getContext("2d")
  if (!ctx) throw new Error("无法创建识别画布")
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(image, s.x, s.y, s.w, s.h, 0, 0, out.width, out.height)
  return { png: out.toDataURL("image/png").split(",")[1], scale }
}

async function recognize() {
  const s = selection.value
  if (!s || ocrBusy.value || busy.value || done.value) return
  ocrBusy.value = true
  notice.value = "正在识别文字…"
  ocr.value = null
  try {
    const { png, scale } = composeForOcr()
    const res = await invoke<OcrPayload>("snip_ocr", { pngBase64: png })
    const k = scale || 1
    const back = (b: OcrWordBox): OcrWordBox => ({
      text: b.text,
      x: s.x + b.x / k,
      y: s.y + b.y / k,
      w: b.w / k,
      h: b.h / k,
    })
    ocr.value = {
      text: res.text,
      lang: res.lang,
      lines: res.lines.map((line) => ({ ...back(line), text: line.text, words: line.words.map(back) })),
    }
    ocrVisible.value = true
    notice.value = ""
  } catch (e) {
    notice.value = String((e as Error)?.message ?? e)
  } finally {
    ocrBusy.value = false
  }
}

async function copyOcrText() {
  const text = ocr.value?.text ?? ""
  if (!text) return
  let ok = true
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // WebView 偶尔不给 clipboard 权限，退回老路子
    const ta = document.createElement("textarea")
    ta.value = text
    ta.style.cssText = "position:fixed;opacity:0;pointer-events:none"
    document.body.appendChild(ta)
    ta.select()
    try {
      ok = document.execCommand("copy")
    } catch {
      ok = false
    }
    ta.remove()
  }
  flash(ok ? `已复制 ${ocr.value?.lines.length ?? 0} 行文字` : "复制失败，请在文字层里手动选中后 Ctrl+C")
}

/** 文字层的容器矩形（CSS 坐标），位置跟随选区 */
const ocrBoxStyle = computed(() => {
  const s = selection.value
  if (!s || !ocr.value) return { display: "none" }
  const sx = viewW.value / imageW
  const sy = viewH.value / imageH
  return {
    left: `${Math.round(s.x * sx)}px`,
    top: `${Math.round(s.y * sy)}px`,
    width: `${Math.round(s.w * sx)}px`,
    height: `${Math.round(s.h * sy)}px`,
  }
})

/** 每行一条深色底：比「每个词一个胶囊」干净，小字号下也不会互相压叠 */
function backStyle(l: OcrLineBox) {
  const s = selection.value
  if (!s) return { display: "none" }
  const sx = viewW.value / imageW
  const sy = viewH.value / imageH
  return {
    left: `${Math.round((l.x - s.x) * sx) - 1}px`,
    top: `${Math.round((l.y - s.y) * sy) - 1}px`,
    width: `${Math.max(2, Math.round(l.w * sx) + 2)}px`,
    height: `${Math.max(6, Math.round(l.h * sy) + 2)}px`,
  }
}

/** 每个词一个 span，落在它原来的位置上：天然保住表格列，也就能就地划词 */
function wordStyle(b: OcrWordBox) {
  const s = selection.value
  if (!s) return {}
  const sx = viewW.value / imageW
  const sy = viewH.value / imageH
  const px = Math.max(7.5, b.h * sy * 0.92)
  return {
    left: `${Math.round((b.x - s.x) * sx)}px`,
    top: `${Math.round((b.y - s.y) * sy)}px`,
    fontSize: `${px.toFixed(1)}px`,
    lineHeight: `${Math.max(px, b.h * sy).toFixed(1)}px`,
  }
}

/* ---------- 长截图：Rust 边滚边拼，这里只负责发起与预览 ---------- */

type ScrollPayload = { pngBase64: string; width: number; height: number; pages: number; note: string }

const longShot = ref<{ url: string; width: number; height: number; pages: number; note: string } | null>(null)
const longPng = ref("")
const longBusy = ref(false)
const longScroll = ref<HTMLElement | null>(null)
const stripView = ref({ top: "0%", height: "100%" })

async function scrollCapture() {
  const s = selection.value
  if (!s || longBusy.value || busy.value || done.value) return
  longBusy.value = true
  notice.value = "长截图中：小窗可暂停自动滚/手动滚，随时完成或取消"
  ocr.value = null
  try {
    // 会话式：start 立即返回，滚动/拼接进度走 snip:scroll-progress（HUD 消费），
    // 结束由 snip:scroll-done / cancelled / failed 事件收尾。
    await invoke("snip_scroll_start", {
      x: shotOrigin.x + Math.round(s.x),
      y: shotOrigin.y + Math.round(s.y),
      width: Math.max(1, Math.round(s.w)),
      height: Math.max(1, Math.round(s.h)),
      maxPages: 24,
    })
  } catch (e) {
    longBusy.value = false
    notice.value = String((e as Error)?.message ?? e)
  }
}

/** 侧边预览条上的视口指示：滚动位置 / 总高度 */
function onLongScroll() {
  const box = longScroll.value
  if (!box || !longShot.value) return
  const total = box.scrollHeight || 1
  const h = Math.max(4, (box.clientHeight / total) * 100)
  stripView.value = { top: `${(box.scrollTop / total) * 100}%`, height: `${h}%` }
}

async function copyLong() {
  if (!longPng.value) return
  try {
    await invoke("snip_export", { action: "copy", pngBase64: longPng.value, path: null })
    flash(`已复制长图 ${longShot.value?.width ?? 0}×${longShot.value?.height ?? 0}`)
  } catch (e) {
    notice.value = String((e as Error)?.message ?? e)
  }
}

async function saveLong() {
  if (!longPng.value) return
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15)
  const path = await save({
    title: "保存长截图",
    defaultPath: `WorkTop-long-${stamp}.png`,
    filters: [{ name: "PNG 图片", extensions: ["png"] }],
  })
  if (!path) return
  try {
    await invoke("snip_export", { action: "save", pngBase64: longPng.value, path })
    flash("已保存长图")
  } catch (e) {
    notice.value = String((e as Error)?.message ?? e)
  }
}

/* ---------- 多显示器：逐屏切换（跨屏窗口会被系统统一缩放，混合 DPI 下必然错位） ---------- */

type MonitorBox = { x: number; y: number; width: number; height: number; primary: boolean }

const monitors = ref<MonitorBox[]>([])
const monitorIdx = ref(0)
const switching = ref(false)

const monitorLabel = computed(() =>
  monitors.value.length > 1 ? `显示器 ${monitorIdx.value + 1}/${monitors.value.length}` : "",
)

/** 用截图原点反推当前是哪块屏（后端按显示器物理矩形裁的图） */
function syncMonitorIndex() {
  const i = monitors.value.findIndex((m) => m.x === shotOrigin.x && m.y === shotOrigin.y)
  if (i >= 0) monitorIdx.value = i
}

async function loadMonitors() {
  try {
    monitors.value = await invoke<MonitorBox[]>("snip_monitors")
    syncMonitorIndex()
  } catch {
    monitors.value = []
  }
}

/** 切到下一块屏继续截：重新抓图 + 覆盖窗整体搬过去 */
async function switchMonitor() {
  if (monitors.value.length < 2 || switching.value || busy.value) return
  switching.value = true
  notice.value = `正在切到显示器 ${((monitorIdx.value + 1) % monitors.value.length) + 1}…`
  try {
    const next = ((monitorIdx.value + 1) % monitors.value.length) | 0
    const applied = await invoke<number>("snip_switch_monitor", { index: next })
    monitorIdx.value = applied
    await loadPreview(true)
    notice.value = ""
  } catch (e) {
    notice.value = String((e as Error)?.message ?? e)
  } finally {
    switching.value = false
  }
}

function setTool(next: Tool) {
  tool.value = next
  applyCursor("crosshair")
  render()
  // 选项行（线宽/填充/色板）随工具显隐，工具条高度会变，位置要重算
  void measureToolbar()
}

/** 导出只包含原始图像与标注，不包含暗色蒙层、选区边框、手柄等编辑器 UI。 */
function composePng(): string {
  const s = selection.value
  if (!s || s.w < 2 || s.h < 2) throw new Error("请先拖选一个截图区域")
  const out = document.createElement("canvas")
  out.width = Math.round(s.w)
  out.height = Math.round(s.h)
  const ctx = out.getContext("2d")
  if (!ctx) throw new Error("无法创建图片画布")
  ctx.drawImage(image, s.x, s.y, s.w, s.h, 0, 0, out.width, out.height)
  ctx.save()
  ctx.translate(-s.x, -s.y)
  ctx.beginPath()
  ctx.rect(s.x, s.y, s.w, s.h)
  ctx.clip()
  drawAnnotations(ctx, annotations.value)
  ctx.restore()
  return out.toDataURL("image/png").split(",")[1]
}

async function finish(action: "copy" | "save", path?: string) {
  if (busy.value || done.value) return
  busy.value = true
  notice.value = ""
  try {
    const pngBase64 = composePng()
    const result = await invoke<string>("snip_export", { action, pngBase64, path: path ?? null })
    done.value = action === "copy" ? "已复制到剪贴板" : `已保存：${result}`
    moveGuides(0, 0, false, false)
    closeTimer = setTimeout(() => void closeSnip(), action === "copy" ? 340 : 700)
  } catch (e) {
    notice.value = String((e as Error)?.message ?? e)
  } finally {
    busy.value = false
  }
}
/**
 * 贴图：把当前选区（含标注）钉在屏幕上。
 * 位置用「截图原点 + 选区内坐标」换算成物理像素，尺寸直接用选区物理尺寸，
 * Rust 侧按物理像素摆窗，所以贴图与框选区域严格重合、1:1 显示。
 */
async function pinSelection() {
  const s = selection.value
  if (!s || busy.value || done.value) return
  busy.value = true
  notice.value = ""
  try {
    const pngBase64 = composePng()
    await invoke<number>("pin_open", {
      pngBase64,
      x: shotOrigin.x + Math.round(s.x),
      y: shotOrigin.y + Math.round(s.y),
      width: Math.max(1, Math.round(s.w)),
      height: Math.max(1, Math.round(s.h)),
    })
    await closeSnip()
  } catch (e) {
    notice.value = String((e as Error)?.message ?? e)
    busy.value = false
  }
}

async function savePng() {
  if (!selection.value || busy.value) return
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15)
  const path = await save({
    title: "保存截图",
    defaultPath: `WorkTop-${stamp}.png`,
    filters: [{ name: "PNG 图片", extensions: ["png"] }],
  })
  if (path) await finish("save", path)
}
async function closeSnip() {
  if (closeTimer) clearTimeout(closeTimer)
  if (waitTimer) clearTimeout(waitTimer)
  try { await invoke("snip_close") } catch { /* 窗口可能已被系统关闭 */ }
}
function onPointerOut(e: PointerEvent) {
  if (!e.relatedTarget) moveGuides(0, 0, false, false)
}
function onKey(e: KeyboardEvent) {
  // 文字标注输入框里打字：所有快捷键都让位（Esc / Enter 由输入框自己处理）。
  const t = e.target as HTMLElement | null
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return
  // 文字层里已经选中了文字：Ctrl+C 交还给浏览器做文本复制，不要抢着去复制图片。
  const picked = window.getSelection()?.toString() ?? ""
  // 长图面板打开时，快捷键全部指向长图本身
  if (longShot.value) {
    if (e.key === "Escape") {
      e.preventDefault()
      longShot.value = null
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
      e.preventDefault(); void copyLong()
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault(); void saveLong()
    }
    return
  }
  if (e.key === "Escape") {
    e.preventDefault()
    if (textEdit.value) {
      textEdit.value = null
      return
    }
    // 长截图会话进行中：Esc = 取消会话（HUD 没建出来的兜底退出路径）
    if (longBusy.value) {
      void invoke("snip_scroll_cancel").catch(() => {})
      return
    }
    // 文字层在场时，Esc 先撤文字层（还想看原图），再按一次才退出截图。
    if (ocr.value) {
      ocr.value = null
      return
    }
    void closeSnip()
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault(); undo()
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
    e.preventDefault(); redo()
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault(); void savePng()
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
    // 有文本选区就让浏览器走原生复制
    if (picked) return
    e.preventDefault(); if (selection.value) void finish("copy")
  } else if (e.key === "Enter" && selection.value) {
    e.preventDefault(); void finish("copy")
  } else if (e.key === "Tab" && monitors.value.length > 1) {
    e.preventDefault(); void switchMonitor()
  } else if (e.key === "F3") {
    e.preventDefault(); if (selection.value) void pinSelection()
  } else if (e.key.toLowerCase() === "o" && !e.ctrlKey && !e.metaKey) {
    if (selection.value) void recognize()
  } else if (e.key.toLowerCase() === "v") setTool("select")
  else if (e.key.toLowerCase() === "r") setTool("rect")
  else if (e.key.toLowerCase() === "e") setTool("ellipse")
  else if (e.key.toLowerCase() === "a") setTool("arrow")
  else if (e.key.toLowerCase() === "p") setTool("pen")
  else if (e.key.toLowerCase() === "h") setTool("marker")
  else if (e.key.toLowerCase() === "t") setTool("text")
  else if (e.key.toLowerCase() === "m") setTool("mosaic")
  else if (e.key.toLowerCase() === "l" && selection.value) void scrollCapture()
}
function syncViewport() {
  // 窗口是从 80px 的隐藏预热尺寸改成整屏物理尺寸的，必须以最终 innerWidth 为准。
  viewW.value = window.innerWidth
  viewH.value = window.innerHeight
  const canvas = board.value
  if (canvas) {
    // 按 devicePixelRatio 放大画布后备尺寸，标注线条才不会在大屏高缩放下发虚。
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2)
    canvas.width = Math.max(1, Math.round(viewW.value * dpr))
    canvas.height = Math.max(1, Math.round(viewH.value * dpr))
    inkDirty = false
  }
  render()
}
function onResize() {
  syncViewport()
  void measureToolbar()
}

/** 首帧真正绘制完成后再显示覆盖窗，避免捕获/解码期间先闪一整屏黑色。 */
let revealed = false
async function revealWindow() {
  // mount 时查一次 preview、capture-ready 事件再查一次是正常竞态，但显示/激活/装钩子
  // 只能做一次：重复 snip_focus 会起多条守护线程并多次抢前台。
  if (revealed) return
  revealed = true
  await nextTick()
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  const win = getCurrentWindow()
  await win.show().catch(() => {})
  // 前台激活与原生光标接管都交给 Rust。这里刻意不再调 tao 的 setFocus()：
  // 它抢不到前台时会 SendInput 模拟 Alt，既可能触发「打字时隐藏指针」，
  // 也是「光标乱跳」的外部诱因；Rust 直接用 SetForegroundWindow 就够了。
  await invoke("snip_focus").catch(() => {})
}

async function showFailure(message: string) {
  fatal.value = message
  await revealWindow()
}

async function loadPreview(force = false) {
  if (loading || (ready.value && !force)) return
  loading = true
  try {
    const preview = await invoke<Preview>("snip_preview")
    imageW = preview.width
    imageH = preview.height
    shotOrigin.x = preview.x
    shotOrigin.y = preview.y
    selection.value = null
    annotations.value = []
    ocr.value = null
    longShot.value = null
    done.value = ""
    syncMonitorIndex()
    const url = `data:image/png;base64,${preview.png_base64}`
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error("截图预览加载失败"))
      image.src = url
    })
    await image.decode().catch(() => {})
    previewUrl.value = url
    ready.value = true
    await nextTick()
    syncViewport()
    // 仅开发预览：qa.html?win=snip&rect=140,120,640,420 直接展示选区与工具条。
    if (location.hostname === "127.0.0.1" || location.hostname === "localhost") {
      const raw = new URLSearchParams(location.search).get("rect")
      const parts = raw?.split(",").map(Number)
      if (parts?.length === 4 && parts.every(Number.isFinite)) {
        selection.value = { x: parts[0], y: parts[1], w: parts[2], h: parts[3] }
        const sx = viewW.value / imageW
        const sy = viewH.value / imageH
        anchor.value = { x: (parts[0] + parts[2] / 2) * sx, y: (parts[1] + parts[3]) * sy }
      }
    }
    render()
    void measureToolbar()
    if (waitTimer) clearTimeout(waitTimer)
    await revealWindow()
  } catch (e) {
    const message = String((e as Error)?.message ?? e)
    // 窗口通常比抓屏先建好，第一次查询不到截图是正常竞态，等后端 ready 事件即可。
    if (!message.includes("没有进行中的截图")) await showFailure(message)
  } finally {
    loading = false
    // ready 事件若恰好落在上一次查询与释放 loading 之间，补一次查询，避免丢信号。
    if (readyNotified && !ready.value && !fatal.value) void loadPreview()
  }
}

let unlistenReady: (() => void) | null = null
let unlistenFailed: (() => void) | null = null
let unlistenScrollDone: (() => void) | null = null
let unlistenScrollCancelled: (() => void) | null = null
let unlistenScrollFailed: (() => void) | null = null
onMounted(async () => {
  window.addEventListener("keydown", onKey)
  window.addEventListener("resize", onResize)
  // 捕获阶段监听：工具条、提示条等任何元素都挡不住框选。
  window.addEventListener("pointerdown", onPointerDown, true)
  window.addEventListener("pointermove", onPointerMove, true)
  window.addEventListener("pointerup", onPointerUp, true)
  window.addEventListener("pointercancel", onPointerUp, true)
  window.addEventListener("pointerout", onPointerOut, true)
  unlistenReady = await listen("snip:capture-ready", () => {
    readyNotified = true
    // ready 已为 true 只可能是「换了一块屏」的重抓，需要强制重新载入
    void loadPreview(ready.value)
  }).catch(() => null)
  unlistenFailed = await listen<string>("snip:failed", (event) => {
    void showFailure(String(event.payload || "截图失败"))
  }).catch(() => null)
  // 长截图会话收尾：done → 取结果开面板；cancelled → 静默复位；failed → 报错复位
  unlistenScrollDone = await listen("snip:scroll-done", async () => {
    try {
      const res = await invoke<ScrollPayload>("snip_scroll_take")
      longPng.value = res.pngBase64
      longShot.value = {
        url: `data:image/png;base64,${res.pngBase64}`,
        width: res.width,
        height: res.height,
        pages: res.pages,
        note: res.note,
      }
      notice.value = ""
      // 面板刚挂载时算一次视口指示，否则侧条上看不到当前位置
      await nextTick()
      onLongScroll()
    } catch (e) {
      notice.value = String((e as Error)?.message ?? e)
    } finally {
      longBusy.value = false
    }
  }).catch(() => null)
  unlistenScrollCancelled = await listen("snip:scroll-cancelled", () => {
    longBusy.value = false
    notice.value = ""
  }).catch(() => null)
  unlistenScrollFailed = await listen<string>("snip:scroll-failed", (event) => {
    longBusy.value = false
    notice.value = String(event.payload || "长截图失败")
  }).catch(() => null)
  syncViewport()
  void loadMonitors()
  void loadPreview()
  waitTimer = setTimeout(() => {
    if (!ready.value && !fatal.value) void showFailure("截图准备超时，请按 Esc 关闭后重试")
  }, 6000)
})
onUnmounted(() => {
  window.removeEventListener("keydown", onKey)
  window.removeEventListener("resize", onResize)
  window.removeEventListener("pointerdown", onPointerDown, true)
  window.removeEventListener("pointermove", onPointerMove, true)
  window.removeEventListener("pointerup", onPointerUp, true)
  window.removeEventListener("pointercancel", onPointerUp, true)
  window.removeEventListener("pointerout", onPointerOut, true)
  unlistenReady?.()
  unlistenFailed?.()
  unlistenScrollDone?.()
  unlistenScrollCancelled?.()
  unlistenScrollFailed?.()
  if (closeTimer) clearTimeout(closeTimer)
  if (waitTimer) clearTimeout(waitTimer)
  if (inkRaf) cancelAnimationFrame(inkRaf)
  if (flashTimer) clearTimeout(flashTimer)
  toolbarRo?.disconnect()
  toolbarRo = null
})
</script>

<template>
  <main class="snip-root" :style="{ cursor }" @contextmenu.prevent>
    <img v-if="previewUrl" class="snip-shot" :src="previewUrl" alt="" draggable="false" />
    <canvas ref="board" class="snip-ink" />
    <div v-if="!selection" class="snip-curtain" />
    <template v-if="dim">
      <div class="snip-dim" :style="dim.top" />
      <div class="snip-dim" :style="dim.bottom" />
      <div class="snip-dim" :style="dim.left" />
      <div class="snip-dim" :style="dim.right" />
    </template>

    <!-- 软件定位指示：框选区用全屏十字线，工具条上用小定位圈。
         只改 transform，走合成层不触发布局；系统光标被隐藏时它们承担「看得见鼠标」。 -->
    <span ref="guideH" class="snip-guide h" aria-hidden="true" />
    <span ref="guideV" class="snip-guide v" aria-hidden="true" />
    <span ref="uiCursor" class="snip-ui-cursor" aria-hidden="true"><i /></span>

    <div v-if="selBox" class="snip-sel" :style="selBox">
      <span v-for="h in HANDLES" :key="h" class="snip-handle" :class="`h-${h}`" v-show="tool === 'select' && !creating" />
    </div>
    <div v-if="selection" class="snip-size" :style="sizeStyle">{{ selLabel }}</div>

    <!-- 文字识别结果：每个词落在它原来的位置上，直接可以用鼠标划词、Ctrl+C 复制 -->
    <div v-if="ocr && ocrVisible" class="snip-ocr" :style="ocrBoxStyle">
      <span v-for="(l, li) in ocr.lines" :key="'b' + li" class="ocr-back" :style="backStyle(l)" />
      <span v-for="(l, li) in ocr.lines" :key="li">
        <span v-for="(w, wi) in l.words" :key="wi" class="ocr-word" :style="wordStyle(w)">{{ w.text }}</span>
      </span>
    </div>

    <div v-if="ready && !selection && !done && !fatal" class="snip-hint snip-ui">
      <Icon name="crop" :size="14" />
      <span class="hint-strong">拖动框选截图区域</span>
      <span class="hint-sep" />
      <span class="hint-kb"><kbd>双击</kbd>全屏复制</span>
      <template v-if="monitorLabel">
        <span class="hint-sep" />
        <span class="hint-kb"><kbd>Tab</kbd>切换显示器</span>
      </template>
      <span class="hint-kb"><kbd>Esc</kbd>退出</span>
    </div>

    <!-- 文字标注输入框：点一下即输入，Enter 落版、Esc 放弃 -->
    <input
      v-if="textEdit"
      ref="textInput"
      v-model="textEdit.value"
      class="snip-text-in snip-ui"
      :style="textStyle"
      spellcheck="false"
      placeholder="输入文字，Enter 确认"
      @keydown.enter.prevent="commitText"
      @keydown.esc.prevent.stop="textEdit = null"
      @blur="commitText"
      @pointerdown.stop
    />

    <!-- 工具条：主行（工具 / 撤销重做 / 输出）+ 选项行（当前工具的线宽·填充·颜色）+ 状态行。
         布局按 SnipLite 的 AnnotationBar：按钮 34、间距 2、内边距 5、分组前留 9，语义靠分隔线而不是间距。 -->
    <div v-if="showToolbar" ref="toolbar" class="snip-toolbar snip-ui" :style="toolbarStyle" @pointerdown.stop>
      <div class="tb-row">
        <button
          v-for="t in TOOLS"
          :key="t.id"
          class="tb-tool"
          :class="{ on: tool === t.id }"
          :title="`${t.label} (${t.key})`"
          @click="setTool(t.id)"
        >
          <Icon :name="t.icon" :size="17" />
        </button>
        <span class="tb-div" />
        <button class="tb-tool" :disabled="!annotations.length" title="撤销 (Ctrl+Z)" @click="undo">
          <Icon name="undo" :size="17" />
        </button>
        <button class="tb-tool" :disabled="!redoStack.length" title="重做 (Ctrl+Y)" @click="redo">
          <Icon name="redo" :size="17" />
        </button>
        <button class="tb-tool" :disabled="!annotations.length" title="清空标注" @click="clearAnnotations">
          <Icon name="trash" :size="17" />
        </button>
        <span class="tb-div" />
        <button class="tb-tool" title="整屏全选" @click="selectAll">
          <Icon name="expand" :size="17" />
        </button>
        <button
          v-if="monitorLabel"
          class="tb-chip tb-monitor"
          :disabled="switching"
          :title="`当前 ${monitorLabel}，点击或按 Tab 切到下一块屏`"
          @click="switchMonitor"
        >
          <Icon name="server" :size="13" />{{ monitorLabel }}
        </button>
        <button class="tb-tool" :disabled="!selection || busy" title="贴到屏幕上 (F3)" @click="pinSelection">
          <Icon name="pin" :size="17" />
        </button>
        <button class="tb-tool" :disabled="!selection || ocrBusy || busy" title="识别文字 (O)" @click="recognize">
          <Icon name="scan" :size="17" />
        </button>
        <button class="tb-tool" :disabled="!selection || longBusy || busy" title="长截图：边滚边拼 (L)" @click="scrollCapture">
          <Icon name="longShot" :size="17" />
        </button>
        <span class="tb-div" />
        <button class="tb-tool" title="取消 (Esc)" @click="closeSnip"><Icon name="x" :size="17" /></button>
        <button class="tb-btn" :disabled="busy" title="保存为 PNG (Ctrl+S)" @click="savePng">
          <Icon name="download" :size="15" /><span class="lbl">保存</span>
        </button>
        <button class="tb-btn primary" :disabled="busy" title="复制到剪贴板 (Enter)" @click="finish('copy')">
          <Icon name="copy" :size="15" /><span class="lbl">复制</span>
        </button>
      </div>

      <!-- 选项行：只显示当前工具用得上的东西 -->
      <div v-if="tool !== 'select'" class="tb-row tb-opts">
        <span class="tb-cap">粗细</span>
        <button
          v-for="w in WIDTHS"
          :key="w"
          class="tb-width"
          :class="{ on: size === w }"
          :title="`线宽 ${w}px`"
          @click="size = w"
        >
          <i :style="{ width: 2 + w * 1.6 + 'px', height: 2 + w * 1.6 + 'px' }" />
        </button>
        <template v-if="tool === 'rect' || tool === 'ellipse'">
          <span class="tb-div" />
          <button class="tb-chip" :class="{ on: fill }" title="填充图形（R / E）" @click="fill = !fill">
            填充
          </button>
        </template>
        <span class="tb-div" />
        <span class="tb-cap">颜色</span>
        <div class="tb-colors">
          <button
            v-for="c in COLORS"
            :key="c"
            class="dot"
            :class="{ on: color === c }"
            :style="{ background: c }"
            :title="`标注颜色 ${c}`"
            @click="color = c"
          />
        </div>
      </div>

      <!-- 识别结果行：只放「能点的动作」，文字本身就地铺在选区上（可划词） -->
      <div v-if="ocr" class="tb-row tb-status tb-ocr">
        <Icon name="scan" :size="14" />
        <span class="tb-status-text">{{ ocr.lines.length }} 行 · {{ ocr.lang }}</span>
        <span class="tb-div" />
        <button class="tb-chip" @click="copyOcrText">复制全文</button>
        <button class="tb-chip" :class="{ on: ocrVisible }" @click="ocrVisible = !ocrVisible">
          {{ ocrVisible ? "隐藏文字" : "显示文字" }}
        </button>
        <button class="tb-chip" @click="ocr = null">关闭</button>
      </div>

      <!-- 状态行：32px 单行，右对齐图标；替代原来居中的 toast 弹层 -->
      <div v-if="statusText" class="tb-row tb-status" :class="{ err: statusErr }">
        <Icon :name="statusErr ? 'alert' : done ? 'checkCircle' : 'clock'" :size="14" />
        <span class="tb-status-text">{{ statusText }}</span>
      </div>
    </div>
    <!-- 长截图结果：左边整幅长图（可滚动），右边一条缩略预览条 + 视口指示 -->
    <div v-if="longShot" class="snip-long snip-ui" @pointerdown.stop>
      <div class="long-head">
        <Icon name="longShot" :size="15" />
        <span class="long-title">长截图</span>
        <span class="long-meta">{{ longShot.width }}×{{ longShot.height }} · {{ longShot.note }}</span>
      </div>
      <div class="long-body">
        <div ref="longScroll" class="long-scroll" @scroll.passive="onLongScroll">
          <img :src="longShot.url" alt="" draggable="false" />
        </div>
        <div class="long-strip">
          <img :src="longShot.url" alt="" draggable="false" />
          <span class="long-view" :style="stripView" />
        </div>
      </div>
      <div class="long-foot">
        <button class="lb" @click="saveLong"><Icon name="download" :size="15" />保存</button>
        <button class="lb primary" @click="copyLong"><Icon name="copy" :size="15" />复制</button>
        <button class="lb ghost" @click="longShot = null"><Icon name="x" :size="15" />关闭</button>
      </div>
    </div>

    <div v-if="!ready && !fatal" class="snip-loading">
      <span class="snip-spin" />正在捕获屏幕…
    </div>
    <div v-if="fatal" class="snip-fatal">
      <Icon name="alert" :size="26" />
      <div>{{ fatal }}</div>
      <button class="snip-btn primary" @click="closeSnip">关闭</button>
    </div>
  </main>
</template>

<style scoped>
/* 覆盖窗永远是「截图 + 深色玻璃条」，所以这里用的是主题的深色侧调色板，
   几何/字号/动效严格对齐 theme.css：30px 按钮、10px 圆角、12.5px 字号、pwbPop 入场。 */
:global(.snip-win), :global(.snip-win body), :global(.snip-win #app) {
  width: 100%; height: 100%; margin: 0; overflow: hidden; background: #05080d;
  color-scheme: dark; user-select: none; cursor: crosshair;
}
.snip-root {
  --snip-surface: rgba(28,29,34,.94);
  --snip-surface-hi: rgba(255,255,255,.1);
  --snip-line: rgba(255,255,255,.14);
  --snip-text: #f5f5f7;
  --snip-muted: rgba(245,245,247,.62);
  --snip-accent: #409cff;
  --snip-accent-hi: #63aeff;
  --snip-shadow: 0 16px 48px rgba(0,0,0,.36), 0 3px 10px rgba(0,0,0,.22);
  --snip-font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI Variable Text", "Segoe UI", "PingFang SC", "Microsoft YaHei UI", sans-serif;
  position: fixed; inset: 0; overflow: hidden; cursor: crosshair;
  font: 12.5px/1.45 var(--snip-font); color: var(--snip-text);
  -webkit-font-smoothing: antialiased;
}
.snip-shot { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: fill; pointer-events: none; }
.snip-ink { position: absolute; inset: 0; z-index: 2; width: 100%; height: 100%; pointer-events: none; }
.snip-curtain { position: absolute; inset: 0; z-index: 1; background: rgba(6,9,14,.44); pointer-events: none; }

/* 四周暗区交给 4 块静态纯色矩形；只改宽高，不再生成 5000×5000 的阴影图层。 */
.snip-dim { position: absolute; z-index: 1; background: rgba(6,9,14,.46); pointer-events: none; }
/* 选区框只留描边，暗区不再由它负责。 */
.snip-sel { position: absolute; z-index: 3; box-sizing: border-box; pointer-events: none;
  border: 1px solid rgba(255,255,255,.92); outline: 1px solid rgba(0,0,0,.3); }
/* ShareX / Flameshot 式十字定位线：合成层平移，每帧零布局。 */
.snip-guide { position: absolute; z-index: 5; pointer-events: none; opacity: 0; will-change: transform; }
.snip-guide.h { left: 0; top: 0; width: 100%; height: 1px;
  background: rgba(255,255,255,.34); box-shadow: 0 1px 0 rgba(0,0,0,.32); }
.snip-guide.v { left: 0; top: 0; width: 1px; height: 100%;
  background: rgba(255,255,255,.34); box-shadow: 1px 0 0 rgba(0,0,0,.32); }
/* 工具条定位圈：不画成第二个箭头（避免与系统箭头重影），只用一个高亮环 + 中心点
   指示指针落点。系统光标可见时像鼠标高亮，被隐藏时就是唯一可见的指针位置。 */
.snip-ui-cursor { position: absolute; z-index: 7; left: 0; top: 0; width: 0; height: 0;
  pointer-events: none; opacity: 0; will-change: transform; }
/* 比 16px 的颜色点大一圈，落在按钮上也不会和「已选中」的白色描边混淆。 */
.snip-ui-cursor i { position: absolute; left: -12px; top: -12px; display: block; width: 24px; height: 24px;
  border-radius: 50%; border: 1.5px solid rgba(255,255,255,.96);
  box-shadow: 0 0 0 1.5px rgba(0,0,0,.6), 0 2px 9px rgba(0,0,0,.45), 0 0 14px rgba(64,156,255,.55);
  background: rgba(64,156,255,.14); }
.snip-ui-cursor i::after { content: ""; position: absolute; left: 9px; top: 9px; width: 4px; height: 4px;
  border-radius: 50%; background: #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.55); }
.snip-handle { position: absolute; width: 9px; height: 9px; margin: -5px 0 0 -5px; border-radius: 2.5px;
  background: #fff; border: 1px solid rgba(22,120,58,.9); box-shadow: 0 1px 3px rgba(0,0,0,.35); }
.h-nw { left: 0; top: 0 } .h-n { left: 50%; top: 0 } .h-ne { left: 100%; top: 0 }
.h-e { left: 100%; top: 50% } .h-se { left: 100%; top: 100% } .h-s { left: 50%; top: 100% }
.h-sw { left: 0; top: 100% } .h-w { left: 0; top: 50% }

/* 尺寸胶囊：贴在选区左上角外侧，压不住框内内容。 */
.snip-size { position: absolute; z-index: 4; padding: 2px 7px; border-radius: 6px;
  background: rgba(20,21,25,.88); box-shadow: 0 2px 8px rgba(0,0,0,.3);
  color: var(--snip-text); font-size: 11.5px; font-variant-numeric: tabular-nums; white-space: nowrap; pointer-events: none; }

/* 顶部提示：深色玻璃胶囊，几何与 MenuBar 一致。
   刻意不用 backdrop-filter：全屏 2560×1600 截图上做实时模糊是纯开销，换更实的底色。 */
.snip-hint { position: absolute; z-index: 4; top: 20px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 10px; max-width: calc(100vw - 32px); padding: 7px 13px;
  border-radius: 999px; background: rgba(30,31,36,.88);
  box-shadow: 0 8px 28px rgba(0,0,0,.28), inset 0 0 0 .5px rgba(255,255,255,.16);
  color: var(--snip-muted); white-space: nowrap; pointer-events: none; animation: snipFade .2s ease; }
.snip-hint svg { color: var(--snip-accent); }
.hint-strong { color: var(--snip-text); font-weight: 600; }
.hint-sep { width: 1px; height: 14px; background: rgba(255,255,255,.16); }
.hint-kb { display: inline-flex; align-items: center; gap: 5px; }
kbd { display: inline-flex; align-items: center; height: 18px; padding: 0 5px; border-radius: 5px;
  background: rgba(255,255,255,.14); box-shadow: inset 0 0 0 .5px rgba(255,255,255,.2);
  color: var(--snip-text); font: 500 11px/1 var(--snip-font); }

/* 工具条：深色磨砂，两行（工具 / 选项）+ 一条状态行。
   度量沿用 SnipLite AnnotationBar：按钮 34、间距 2、内边距 5、分组前后各留 9、
   选中态 = 淡底 + 底部 2px 主题色短线（比整块高饱和克制，也能和悬停区分）。 */
.snip-toolbar { position: absolute; z-index: 6; display: flex; flex-direction: column; gap: 2px;
  padding: 5px; max-width: calc(100vw - 16px); border-radius: 12px;
  background: var(--snip-surface); box-shadow: var(--snip-shadow), inset 0 0 0 .5px rgba(255,255,255,.16);
  animation: snipPop .18s cubic-bezier(.32,.72,.35,1); }
.tb-row { display: flex; align-items: center; gap: 2px; }
.snip-toolbar button { appearance: none; display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  flex-shrink: 0; border: 0; background: transparent; color: var(--snip-muted);
  font: inherit; font-weight: 500; cursor: pointer; white-space: nowrap;
  transition: background .15s, color .15s, transform .1s; }
.snip-toolbar button:hover:not(:disabled) { background: var(--snip-surface-hi); color: var(--snip-text); }
.snip-toolbar button:active:not(:disabled) { transform: scale(.96); }
.snip-toolbar button:disabled { opacity: .38; cursor: default; }
.snip-toolbar svg { flex-shrink: 0; }

/* 主行按钮 34×34；保存/复制带文字，稍宽 */
.snip-toolbar .tb-tool { position: relative; width: 34px; height: 34px; border-radius: 8px; }
.snip-toolbar .tb-tool.on { background: color-mix(in srgb, var(--snip-accent) 22%, transparent); color: #fff; }
.snip-toolbar .tb-tool.on::after { content: ""; position: absolute; left: 50%; bottom: 3px; width: 10px; height: 2px;
  margin-left: -5px; border-radius: 2px; background: var(--snip-accent); }
.snip-toolbar .tb-btn { height: 34px; padding: 0 12px; border-radius: 8px; }
.snip-toolbar .tb-btn.primary { background: var(--snip-accent); color: #fff; font-weight: 600; }
.snip-toolbar .tb-btn.primary:hover:not(:disabled) { background: var(--snip-accent-hi); color: #fff; }

/* 分组线：前后留 9px（gap 2 + margin 7），只表达语义、不靠空白硬撑 */
.tb-div { width: 1px; height: 18px; margin: 0 7px; background: rgba(255,255,255,.14); flex-shrink: 0; }

/* 选项行 */
.tb-opts { height: 34px; padding: 0 2px; }
.tb-cap { padding: 0 6px 0 2px; font-size: 11px; color: rgba(245,245,247,.46); flex-shrink: 0; }
.snip-toolbar .tb-width { width: 26px; height: 26px; border-radius: 7px; }
.snip-toolbar .tb-width i { display: block; border-radius: 50%; background: currentColor; }
.snip-toolbar .tb-width.on { background: color-mix(in srgb, var(--snip-accent) 24%, transparent); color: #fff; }
.snip-toolbar .tb-chip { height: 24px; padding: 0 9px; border-radius: 7px; font-size: 11.5px;
  background: rgba(255,255,255,.07); }
.snip-toolbar .tb-chip.on { background: color-mix(in srgb, var(--snip-accent) 26%, transparent); color: #fff; }
.tb-colors { display: inline-flex; align-items: center; gap: 7px; padding: 0 4px; }
.snip-toolbar .dot { width: 16px; height: 16px; padding: 0; border-radius: 50%; flex-shrink: 0;
  box-shadow: inset 0 0 0 .5px rgba(255,255,255,.55); }
.snip-toolbar .dot:hover { transform: scale(1.12); }
.snip-toolbar .dot.on { box-shadow: inset 0 0 0 .5px rgba(0,0,0,.2), 0 0 0 1.5px #fff, 0 0 0 2.5px rgba(0,0,0,.45); }

/* 文字标注输入框：跟随点击位置，透明底 + 主题色描边，和标注同字号 */
.snip-text-in { position: absolute; z-index: 7; min-width: 120px; max-width: min(560px, 40vw); padding: 1px 4px;
  border: 1px dashed color-mix(in srgb, var(--snip-accent) 70%, transparent); border-radius: 5px;
  background: rgba(10,12,16,.55); font-family: "Segoe UI", "Microsoft YaHei UI", system-ui, sans-serif;
  font-weight: 600; line-height: 1.28; outline: none; }
.snip-text-in::placeholder { color: rgba(245,245,247,.42); font-weight: 400; font-size: 12px; }

/* OCR 文字层：词按原坐标铺在选区上，白字压在深色胶囊上，可以直接用鼠标划词。
   z-index 低于工具条、高于标注画布；容器裁掉越界部分，不污染选区外。 */
.snip-ocr { position: absolute; z-index: 4; overflow: hidden; pointer-events: none; }
.ocr-back { position: absolute; border-radius: 3px; background: rgba(9, 12, 17, .64); pointer-events: none; }
.ocr-word { position: absolute; white-space: pre; color: #fff; cursor: text; pointer-events: auto;
  /* 覆盖窗整页是 user-select:none，这里必须显式打开，否则「就地划词」选不中 */
  user-select: text; -webkit-user-select: text;
  padding: 0; text-shadow: 0 1px 2px rgba(0, 0, 0, .55);
  font-family: "Segoe UI", "Microsoft YaHei UI", system-ui, sans-serif; }
/* 选中态用主题色压住白底，深色文字，避免高亮反白后看不清 */
.snip-ocr :deep(::selection) { background: color-mix(in srgb, var(--snip-accent) 78%, #fff); color: #0b0e13; }

/* 显示器切换 chip：图标 + 文字，和工具按钮同高 */
.snip-toolbar .tb-monitor { display: inline-flex; align-items: center; gap: 5px; flex: none; height: 28px; padding: 0 9px; }
.snip-toolbar .tb-monitor svg { opacity: .8; }
.tb-ocr { color: var(--snip-text); }
.tb-ocr.tb-status svg { color: var(--snip-accent-hi); }
.tb-ocr .tb-chip { flex: none; }

/* 长截图结果面板：整块压住覆盖层，左边长图可滚，右边缩略预览条跟进视口 */
.snip-long { position: absolute; inset: 0; z-index: 30; display: flex; flex-direction: column; gap: 10px;
  padding: 16px; background: rgba(6, 9, 14, .86); backdrop-filter: blur(16px); }
.long-head { display: flex; align-items: center; gap: 8px; flex: none; }
.long-head svg { color: var(--snip-accent-hi); }
.long-title { font-weight: 600; font-size: 13px; }
.long-meta { color: var(--snip-muted); font-size: 12px; }
.long-body { flex: 1; min-height: 0; display: flex; gap: 10px; }
.long-scroll { flex: 1; min-width: 0; overflow: auto; border-radius: 10px;
  background: rgba(255, 255, 255, .04); border: 1px solid var(--snip-line); }
.long-scroll img { display: block; width: 100%; height: auto; }
.long-strip { position: relative; flex: none; width: 52px; border-radius: 8px; overflow: hidden;
  background: rgba(255, 255, 255, .05); border: 1px solid var(--snip-line); }
.long-strip img { display: block; width: 100%; height: 100%; object-fit: contain; object-position: top; opacity: .85; }
.long-view { position: absolute; left: 0; right: 0; border: 1px solid var(--snip-accent-hi);
  background: color-mix(in srgb, var(--snip-accent) 20%, transparent); pointer-events: none; }
.long-foot { display: flex; justify-content: flex-end; gap: 8px; flex: none; }
.long-foot .lb { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 14px;
  border: 1px solid var(--snip-line); border-radius: 9px; background: rgba(255, 255, 255, .07);
  color: var(--snip-text); font: inherit; cursor: pointer; }
.long-foot .lb:hover { background: rgba(255, 255, 255, .13); }
.long-foot .lb.primary { background: var(--snip-accent); border-color: transparent; color: #fff; font-weight: 600; }
.long-foot .lb.primary:hover { background: var(--snip-accent-hi); }
.long-foot .lb.ghost { background: none; color: var(--snip-muted); }

/* 状态行：32px 单行 + 顶部细线，长文本省略 */
.tb-status { height: 32px; gap: 7px; padding: 0 8px; margin-top: 1px;
  border-top: 1px solid rgba(255,255,255,.1); color: var(--snip-muted); }
.tb-status svg { color: #30d158; }
.tb-status.err { color: #ff8d85; }
.tb-status.err svg { color: #ff453a; }
.tb-status-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 12px; }

.snip-loading, .snip-fatal { position: absolute; z-index: 20; inset: 0; display: flex; align-items: center; justify-content: center;
  gap: 10px; background: #0d1117; color: var(--snip-muted); font-size: 13px; }
.snip-fatal { flex-direction: column; gap: 14px; text-align: center; padding: 24px; }
.snip-fatal svg { color: #ff9f0a; }
.snip-fatal .snip-btn { height: 30px; padding: 0 16px; border: 0; border-radius: 9px; background: var(--snip-accent);
  color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
.snip-spin { width: 14px; height: 14px; border-radius: 50%; border: 1.6px solid rgba(255,255,255,.18);
  border-top-color: var(--snip-accent); animation: snipSpin .8s linear infinite; }

@keyframes snipSpin { to { transform: rotate(360deg); } }
@keyframes snipPop { from { opacity: 0; transform: translateY(4px) scale(.97); } }
@keyframes snipFade { from { opacity: 0; } }

@media (max-width: 1180px) {
  .snip-toolbar .lbl { display: none; }
  .snip-toolbar button { padding: 0 8px; }
}
@media (max-width: 900px) {
  .snip-hint .hint-kb:nth-of-type(2) { display: none; }
}
/* 系统开启「减少动态效果」时不播放入场动画：既尊重系统设置，也让截图工具的反馈绝对立即。 */
@media (prefers-reduced-motion: reduce) {
  .snip-hint, .snip-toolbar { animation: none !important; }
  .snip-toolbar button, .snip-toolbar .dot { transition: none !important; }
  .snip-spin { animation-duration: 1.6s; }
}
</style>
