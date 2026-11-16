<script setup lang="ts">
// WorkTop 桌面「能量球」：原创可爱圆形形象，无任何第三方素材。
// 圆润玻璃球身 + 两只表情眼 + 微笑 + 天线 + 轨道卫星 + 圆内扫描光带，纯 CSS 驱动。
// 交互：可拖动；拖到屏幕边缘松手 = 折叠一半（再点展开）；
//       未折叠显示当天待办数角标；单击弹出环形菜单，双击唤起工作台。
import { computed, onMounted, onUnmounted, ref } from "vue"
import { invoke } from "@tauri-apps/api/core"
import { call } from "../lib/api"
import { parseTodos } from "../lib/todo"
import { today } from "../lib/date"
import { accentVars, readAccent, type Accent } from "../lib/accent"

/* ---------- 状态 ---------- */
const folded = ref(false)
const edge = ref<"left" | "right">("right")
const todoCount = ref(0)
const dragging = ref(false)

/* ---------- 跟随工作台主题色 ---------- */
const accent = ref<Accent>(readAccent())
const vars = computed(() => accentVars(accent.value))
function onAccentStorage(e: StorageEvent) {
  if (e.key === "pwb_accent") accent.value = readAccent()
}

/* ---------- 当天待办角标 ---------- */
async function refreshTodos() {
  try {
    const doc = await call<{ content: string }>("todo_get")
    const t0 = today()
    todoCount.value = parseTodos(doc.content).filter((x) => !x.done && x.due === t0).length
  } catch {
    /* 数据目录尚无待办文件时静默 */
  }
}
let todoTimer: ReturnType<typeof setInterval> | null = null

/* ---------- 定位工具 ---------- */
/** 配置落盘的 x/y/mascotY 已升级为物理像素（Rust 侧负责坐标换算），前端只透传数值。 */
async function saveCfg(patch: Record<string, unknown>) {
  await invoke("desktop_save", { patch }).catch(() => {})
}

/* ---------- 折叠 / 展开 ---------- */
/** 展开回到折叠前的物理坐标；落点由 Rust 钳制进所在屏工作区。 */
async function unfold() {
  try {
    const pos = await invoke<[number, number]>("mascot_unfold")
    folded.value = false
    await saveCfg({ mascotFolded: false, x: pos[0], y: pos[1], mascotPhysical: true })
  } catch { /* Rust 侧已兜底为默认位置 */ }
}

/* ---------- 拖动：全部走 Rust 物理像素，跨显示器自由移动 ---------- */
let drag: { sx: number; sy: number; moved: boolean } | null = null
let pending = false
let committing = false
async function flushDrag() {
  committing = true
  try {
    while (pending) {
      pending = false
      await invoke("mascot_drag_update").catch(() => {})
    }
  } finally {
    committing = false
  }
}

async function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  if (folded.value) {
    // 折叠态：点击展开（不做拖拽）
    void unfold()
    return
  }
  await invoke("mascot_drag_begin").catch(() => null)
  drag = { sx: e.screenX, sy: e.screenY, moved: false }
  window.addEventListener("pointermove", onDragMove)
  window.addEventListener("pointerup", onDragUp)
}
function onDragMove(e: PointerEvent) {
  if (!drag) return
  if (!drag.moved && Math.hypot(e.screenX - drag.sx, e.screenY - drag.sy) < 3) return
  drag.moved = true
  dragging.value = true
  // 位置计算在 Rust（真实光标位置 + 物理像素）：混合 DPI 下 JS 的逻辑坐标
  // 会在跨屏瞬间跳变，这里只负责把「有拖动增量」合并成尽量少的 IPC。
  pending = true
  if (!committing) void flushDrag()
}
async function onDragUp(e: PointerEvent) {
  window.removeEventListener("pointermove", onDragMove)
  window.removeEventListener("pointerup", onDragUp)
  const d = drag
  drag = null
  dragging.value = false
  if (!d) return
  if (!d.moved) {
    // 单击：弹环形菜单（错误不再静默——菜单窗创建失败会显示在 dev 日志里）
    await invoke("mascot_menu_open").catch((e) => console.warn("mascot_menu_open failed", e))
    return
  }
  // 结束：Rust 判定是否靠边折叠并搬过去，回传最终状态存配置
  const end = await invoke<{ x: number; y: number; folded: boolean; edge: string; foldY: number }>(
    "mascot_drag_end",
  ).catch(() => null)
  if (!end) return
  if (end.folded) {
    folded.value = true
    edge.value = end.edge === "left" ? "left" : "right"
    await saveCfg({
      x: end.x,
      y: end.y,
      mascotFolded: true,
      mascotEdge: end.edge,
      mascotY: end.foldY,
      mascotPhysical: true,
    })
  } else {
    await saveCfg({ x: end.x, y: end.y, mascotFolded: false, mascotPhysical: true })
  }
  void e
}

/* ---------- 右键：原生菜单（仅「退出程序」） ---------- */
function onContextMenu(e: MouseEvent) {
  e.preventDefault()
  void invoke("mascot_context_menu").catch(() => {})
}

/* ---------- 生命周期 ---------- */
onMounted(async () => {
  window.addEventListener("storage", onAccentStorage)
  // 按配置恢复折叠位置（Rust 建窗时已定位，这里只同步状态标记）
  try {
    const st = await invoke<{ config: Record<string, unknown> }>("desktop_state")
    folded.value = Boolean(st.config.mascotFolded)
    if (st.config.mascotEdge === "left" || st.config.mascotEdge === "right") edge.value = st.config.mascotEdge
  } catch {}
  void refreshTodos()
  todoTimer = setInterval(() => void refreshTodos(), 60_000)
})
onUnmounted(() => {
  window.removeEventListener("storage", onAccentStorage)
  if (todoTimer) clearInterval(todoTimer)
})

const badgeShown = computed(() => !folded.value && todoCount.value > 0)
</script>

<template>
  <div class="mascot-wrap" :class="{ folded, dragging }" :style="vars" @pointerdown="onPointerDown"
    @contextmenu="onContextMenu">
    <!-- 折叠提示小箭头 -->
    <span v-if="folded" class="unfold-hint" :class="edge">›</span>

    <!-- 圆润能量球：两只表情眼 + 微笑 + 天线 + 环形轨道，圆形轮廓，无任何方形底板 -->
    <div class="pet" aria-label="WorkTop 桌面能量球">
      <div class="orbit"><i class="sat"></i></div>

      <span class="antenna"><i class="bulb"></i></span>

      <div class="body">
        <span class="gloss"></span>
        <span class="scan"></span>
        <div class="face">
          <i class="eye el"></i>
          <i class="eye er"></i>
          <i class="cheek cl"></i>
          <i class="cheek cr"></i>
          <i class="mouth"></i>
        </div>
      </div>

      <span class="spark s1"></span>
      <span class="spark s2"></span>
    </div>

    <!-- 当天待办角标 -->
    <span v-if="badgeShown" class="badge">{{ todoCount > 99 ? "99+" : todoCount }}</span>
  </div>
</template>

<style scoped>
.mascot-wrap {
  position: fixed;
  inset: 0;
  background: transparent;
  cursor: grab;
  user-select: none;
  -webkit-app-region: no-drag;
}
.mascot-wrap.dragging {
  cursor: grabbing;
}

/* ---------- 圆润能量球：圆形轮廓 + 表情 + 轨道，无方形底板 ---------- */
.pet {
  position: absolute;
  inset: 0;
  background: transparent;
  animation: pet-bob 3.6s ease-in-out infinite;
}

/* 环形轨道 + 卫星点：让圆球有科技感但不遮挡表情 */
.orbit {
  position: absolute;
  left: 50%;
  top: 29px;
  width: 44px;
  height: 44px;
  margin: -22px 0 0 -22px;
  border-radius: 50%;
  border: 1px dashed color-mix(in srgb, var(--m-accent) 36%, transparent);
  animation: spin 9s linear infinite;
}
.sat {
  position: absolute;
  top: -2px;
  left: 50%;
  width: 4px;
  height: 4px;
  margin-left: -2px;
  border-radius: 50%;
  background: var(--m-spark);
  box-shadow: 0 0 5px var(--m-accent);
}

/* 小天线 */
.antenna {
  position: absolute;
  left: 50%;
  top: 2px;
  width: 1.5px;
  height: 9px;
  margin-left: -0.75px;
  border-radius: 2px;
  background: linear-gradient(to top, color-mix(in srgb, var(--m-accent) 10%, transparent), var(--m-accent-2));
}
.bulb {
  position: absolute;
  top: -2px;
  left: 50%;
  width: 5px;
  height: 5px;
  margin-left: -2.5px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #ffffff, var(--m-light) 55%, var(--m-accent));
  box-shadow: 0 0 4px var(--m-light), 0 0 8px color-mix(in srgb, var(--m-accent) 80%, transparent);
  animation: bulb 2.2s ease-in-out infinite;
}

/* 圆形身体：玻璃球质感，表情全部在圆内 */
.body {
  position: absolute;
  left: 50%;
  top: 29px;
  width: 38px;
  height: 38px;
  margin: -19px 0 0 -19px;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--m-accent) 30%, rgba(255, 255, 255, 0.75));
  overflow: hidden;
  background:
    radial-gradient(circle at 32% 24%, #ffffff 0%, rgba(255, 255, 255, 0.9) 18%, transparent 44%),
    radial-gradient(
      circle at 50% 80%,
      color-mix(in srgb, var(--m-accent) 18%, #ffffff) 0%,
      color-mix(in srgb, var(--m-accent-2) 35%, #ffffff) 55%,
      var(--m-deep2) 100%
    );
  box-shadow:
    inset 0 -4px 8px color-mix(in srgb, var(--m-accent) 14%, transparent),
    inset 0 2px 4px rgba(255, 255, 255, 0.9),
    0 0 8px color-mix(in srgb, var(--m-accent) 26%, transparent),
    0 2px 8px rgba(30, 40, 70, 0.18);
  transition: transform 0.15s ease;
}
.mascot-wrap:not(.dragging):hover .body {
  transform: scale(1.06);
}
.mascot-wrap:active .body {
  transform: scale(0.95);
}

.gloss {
  position: absolute;
  left: 7px;
  top: 5px;
  width: 13px;
  height: 8px;
  border-radius: 50%;
  background: linear-gradient(140deg, rgba(255, 255, 255, 0.75), rgba(255, 255, 255, 0.05));
  transform: rotate(-18deg);
}

/* 全息扫描带：只在圆内扫过 */
.scan {
  position: absolute;
  left: -20%;
  top: 0;
  width: 140%;
  height: 2px;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--m-accent) 38%, transparent), transparent);
  animation: scan 3s ease-in-out infinite;
}

/* 表情：两只圆眼 + 腮红 + 微笑 */
.eye {
  position: absolute;
  top: 13px;
  width: 4.5px;
  height: 5.5px;
  border-radius: 50%;
  background: radial-gradient(
    circle at 35% 28%,
    #ffffff 0 16%,
    var(--m-deep) 55%,
    color-mix(in srgb, var(--m-deep) 78%, #000000) 100%
  );
  box-shadow: 0 0 3px color-mix(in srgb, var(--m-deep) 30%, transparent);
  transform-origin: center;
  animation: blink 4.8s infinite;
}
.el { left: 10px; }
.er { right: 10px; }
.cheek {
  position: absolute;
  top: 19px;
  width: 4px;
  height: 2.5px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--m-accent) 32%, #ff9ac5);
  opacity: 0.45;
}
.cl { left: 5px; }
.cr { right: 5px; }
.mouth {
  position: absolute;
  top: 19px;
  left: 50%;
  width: 6px;
  height: 4px;
  margin-left: -3px;
  border-bottom: 1.5px solid color-mix(in srgb, var(--m-deep) 78%, transparent);
  border-radius: 0 0 6px 6px;
}

/* 环绕小光点 */
.spark {
  position: absolute;
  width: 2px;
  height: 2px;
  border-radius: 50%;
  background: var(--m-spark);
  box-shadow: 0 0 4px var(--m-accent);
  pointer-events: none;
}
.s1 { left: 6px; top: 12px; animation: spark 2.8s ease-in-out infinite; }
.s2 { right: 7px; top: 18px; animation: spark 3.4s ease-in-out 0.6s infinite; }

/* 悬停：轨道加速、天线更亮 */
.mascot-wrap:hover .orbit { animation-duration: 3.5s; }
.mascot-wrap:hover .bulb { animation-duration: 1s; }
.mascot-wrap.folded .pet,
.mascot-wrap.folded .orbit,
.mascot-wrap.folded .bulb,
.mascot-wrap.folded .scan,
.mascot-wrap.folded .eye,
.mascot-wrap.folded .spark {
  animation-play-state: paused;
}

.unfold-hint {
  position: absolute;
  top: 50%;
  font-size: 15px;
  font-weight: 700;
  color: #eaf6ff;
  text-shadow: 0 1px 4px rgba(10, 40, 90, 0.6);
  transform: translateY(-50%);
  animation: hint 1.8s ease-in-out infinite;
  pointer-events: none;
}
.unfold-hint.left {
  right: 6px;
}
.unfold-hint.right {
  left: 6px;
  transform: translateY(-50%) scaleX(-1);
}
@keyframes hint {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
}

@keyframes pet-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-1.5px); }
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes scan {
  0% { transform: translateY(0); opacity: 0; }
  20% { opacity: 0.65; }
  80% { opacity: 0.4; }
  100% { transform: translateY(38px); opacity: 0; }
}
@keyframes blink {
  0%, 90%, 100% { transform: scaleY(1); }
  94% { transform: scaleY(0.1); }
}
@keyframes bulb {
  0%, 100% { opacity: 0.7; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.15); }
}
@keyframes spark {
  0%, 100% { opacity: 0.15; transform: scale(0.7); }
  50% { opacity: 0.95; transform: scale(1.25); }
}
@media (prefers-reduced-motion: reduce) {
  .pet,
  .pet * {
    animation: none !important;
  }
}
@keyframes badge-pop {
  from { transform: scale(0.4); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

/* 待办角标 */
.badge {
  position: absolute;
  top: 1px;
  right: 1px;
  min-width: 13px;
  height: 13px;
  padding: 0 3px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  font-weight: 700;
  color: #fff;
  background: #ff5d5d;
  border: 1.5px solid #ffffffcc;
  box-shadow: 0 1px 5px rgba(200, 40, 40, 0.4);
  pointer-events: none;
  animation: badge-pop 0.3s ease;
}
</style>
