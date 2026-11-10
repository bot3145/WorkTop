<script setup lang="ts">
// 吉祥物菜单：透明窗口以人物中心为锚，5 个烟玻璃圆钮沿人物**左侧半弧（12 点 → 9 点 → 6 点方向）**
// 45° 等分排列（待办在正上，依次速记/AI/截图/设置到正下），弧形扫出动画 + 单层轨道虚线环；
// 失焦/Esc/点空白优雅收起。
// 窗口由启动时预热并常驻（点开只 show，不重建），因此「打开」由 mascot-menu:show 事件驱动重播。
// 样式遵守 2026-11-02 定稿：浅色磨砂玻璃、主题色 8%–18% 淡着色、--m-* 变量、storage 实时换色。
import { computed, onMounted, onUnmounted, ref } from "vue"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"
import Icon from "../components/Icon.vue"
import { accentVars, readAccent, type Accent } from "../lib/accent"

const win = getCurrentWindow()

/** 菜单几何：窗 300×260，锚点（=吉祥物中心）由 Rust 经 URL 传入（默认窗右侧 254,130）。
 * 扇形：按钮 40px、轨道半径 72，左半弧 45° 等分。
 * 注意 CSS rotate 语义：顺时针、fa=0 指向正上、fa=-90 正左、fa=-180 正下——
 * 左半弧（12点→9点→6点）= 0 / -45 / -90 / -135 / -180。 */
const R = 72

const q = new URLSearchParams(location.search)
const fx = Number(q.get("fx") ?? 254)
const fy = Number(q.get("fy") ?? 130)
/** 预览用：qa.html?win=mascotmenu&auto=1 直接展开（浏览器里跑不出 Tauri 事件） */
const autoOpen = q.get("auto") === "1"

const ITEMS = [
  { id: "todo", icon: "checkCircle", label: "待办", angle: 0 },
  { id: "note", icon: "edit", label: "速记", angle: -45 },
  { id: "ai", icon: "star", label: "AI", angle: -90 },
  { id: "snip", icon: "camera", label: "截图", angle: -135 },
  { id: "settings", icon: "sliders", label: "设置", angle: -180 },
] as const

const opened = ref(false)
const closing = ref(false)
const settled = ref(false)
let settleTimer: ReturnType<typeof setTimeout> | null = null

/** 扫出动画总时长（最后一颗按钮 = 4×16ms 延迟 + 200ms）——用于结束态与关闭时机 */
const ANIM_MS = 300
/** 收起动画总时长（倒序 4×12ms 延迟 + 160ms）+ 一点余量，动画播完才真正隐藏 */
const CLOSE_MS = 240

/* 跟随工作台主题色：与吉祥物共用同一套调色板 */
const accent = ref<Accent>(readAccent())
const vars = computed(() => accentVars(accent.value))
function onAccentStorage(e: StorageEvent) {
  if (e.key === "pwb_accent") accent.value = readAccent()
}

/** 弧形定位完全交给 CSS 链式变换（rotate → translateY(-R) → rotate 反转）。 */
const items = computed(() => ITEMS.map((it, i) => ({ ...it, fa: it.angle, i })))

async function open(id: string) {
  try {
    if (id === "snip") {
      // 统一截图入口：装了 AirSnip 转发其 F1，否则自带拖选截图
      await invoke("snip_capture").catch(() => {})
    } else {
      await invoke("pane_open", { id, width: id === "settings" ? 760 : 680, height: id === "settings" ? 560 : 520 })
    }
  } finally {
    void close()
  }
}

/** 优雅收起：先播收回动画再关窗（失焦/Esc/点空白共用） */
function close() {
  if (closing.value) return
  closing.value = true
  settled.value = false
  if (settleTimer) clearTimeout(settleTimer)
  window.setTimeout(() => void invoke("mascot_menu_close").catch(() => {}), CLOSE_MS)
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") close()
}

/** 重播扫出动画：复用同一个窗口，每次打开都要把状态推回初值再触发。 */
// 初值必须是「很久以前」：页面刚加载时 performance.now() 可能还不到 220ms，
// 若用 0 初值，首次（也是预热后很可能紧接着的第一次）展开会被去抖吞掉，出现空菜单。
let lastOpenAt = -1e9
function playOpen() {
  const now = performance.now()
  if (now - lastOpenAt < 220) return
  lastOpenAt = now
  closing.value = false
  settled.value = false
  opened.value = false
  if (settleTimer) clearTimeout(settleTimer)
  requestAnimationFrame(() => {
    opened.value = true
    settleTimer = setTimeout(() => (settled.value = true), ANIM_MS)
  })
}

let hadFocus = false
let closeTimer: ReturnType<typeof setTimeout> | null = null
let unlistenBlur: (() => void) | null = null
let unlistenShow: (() => void) | null = null
onMounted(async () => {
  window.addEventListener("keydown", onKey)
  window.addEventListener("storage", onAccentStorage)
  unlistenBlur = await win.onFocusChanged(({ payload }) => {
    if (payload) {
      hadFocus = true
      if (closeTimer) {
        clearTimeout(closeTimer)
        closeTimer = null
      }
      // 兜底：窗口被 show 出来就会拿到焦点，若此刻还没展开就补播（事件丢失也不会出现「空菜单」）
      if (!opened.value && !closing.value) playOpen()
    } else if (hadFocus) {
      closeTimer = setTimeout(close, 150)
    }
  })
  // 主路径：Rust 每次展开都会 emit 一次，收到就重播动画
  unlistenShow = await listen("mascot-menu:show", () => playOpen())
  // 兜底 1：窗口是「现建现显」（预热失败）时事件早于监听，按可见性补播一次
  try {
    if (await win.isVisible()) playOpen()
  } catch {}
  // 兜底 2：浏览器预览（qa.html）没有 Tauri 事件通道，按参数直接展开
  if (autoOpen) playOpen()
})
onUnmounted(() => {
  window.removeEventListener("keydown", onKey)
  window.removeEventListener("storage", onAccentStorage)
  if (settleTimer) clearTimeout(settleTimer)
  unlistenBlur?.()
  unlistenShow?.()
})
</script>

<template>
  <div class="arc-wrap" :class="{ closing }" :style="vars" @pointerdown.self="close">
    <!-- 单层轨道虚线环：以锚点（吉祥物）为心，直径 = 2R，扇形的轨道语义。 -->
    <div class="orbit-ring" :class="{ on: opened && !closing }" :style="{ left: fx + 'px', top: fy + 'px' }"></div>

    <!-- 按钮以吉祥物圆心为定位基点，极坐标交给 CSS 链式变换（--fa/--r）。 -->
    <button v-for="it in items" :key="it.id" class="arc-btn"
      :class="{ on: opened && !closing, closing, settled: settled && opened && !closing }"
      :style="{ left: fx + 'px', top: fy + 'px', '--fa': it.fa + 'deg', '--r': R + 'px', '--i': it.i, '--n': items.length }"
      :aria-label="it.label" @click.stop="open(it.id)">
      <Icon :name="it.icon" :size="16" />
      <span class="lbl">{{ it.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.arc-wrap {
  position: fixed;
  inset: 0;
  overflow: visible;
}

/* 单层轨道虚线环（扇形按钮的轨道）：直径 2R=144，以锚点为心，主题色 18% 淡着色。 */
.orbit-ring {
  position: absolute;
  width: 144px;
  height: 144px;
  margin: -72px 0 0 -72px;
  border-radius: 50%;
  border: 1px dashed color-mix(in srgb, var(--m-accent) 18%, transparent);
  pointer-events: none;
  opacity: 0;
  transform: scale(0.7);
}
.orbit-ring.on {
  animation: ring-in 0.22s ease-out both;
}
.arc-wrap.closing .orbit-ring {
  opacity: 0;
  transition: opacity 0.2s ease;
}
@keyframes ring-in {
  from { opacity: 0; transform: scale(0.7); }
  to { opacity: 1; transform: scale(1); }
}

/* 烟玻璃圆钮：40px（扇形紧凑档），配色与阴影沿用定稿。 */
.arc-btn {
  position: absolute;
  width: 40px;
  height: 40px;
  margin: -20px 0 0 -20px;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--m-accent) 30%, rgba(255, 255, 255, 0.65));
  background: linear-gradient(
    160deg,
    color-mix(in srgb, var(--m-accent) 8%, rgba(255, 255, 255, 0.92)),
    color-mix(in srgb, var(--m-accent) 18%, rgba(255, 255, 255, 0.72))
  );
  color: var(--m-deep);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  cursor: pointer;
  padding: 0;
  opacity: 0;
  pointer-events: none;
  box-shadow:
    0 5px 14px rgba(30, 40, 70, 0.16),
    inset 0 1px 1px rgba(255, 255, 255, 0.9);
  transform: rotate(var(--fa)) translateY(calc(-1 * var(--r))) rotate(calc(-1 * var(--fa)));
  transition:
    transform 0.15s ease,
    box-shadow 0.14s ease,
    border-color 0.14s ease,
    color 0.14s ease;
}
.arc-btn.on {
  pointer-events: auto;
  animation: fb-sweep 0.2s cubic-bezier(0.3, 1.4, 0.45, 1) both;
  animation-delay: calc(var(--i) * 16ms);
}
.arc-btn.settled {
  animation: none;
  opacity: 1;
}
.arc-btn.on:hover {
  transform: rotate(var(--fa)) translateY(calc(-1 * var(--r))) rotate(calc(-1 * var(--fa))) scale(1.16);
  border-color: color-mix(in srgb, var(--m-accent) 60%, #ffffff);
  background: linear-gradient(
    160deg,
    color-mix(in srgb, var(--m-accent) 16%, #ffffff),
    color-mix(in srgb, var(--m-accent) 30%, #ffffff)
  );
  box-shadow:
    0 6px 18px rgba(30, 40, 70, 0.22),
    0 0 14px color-mix(in srgb, var(--m-accent) 28%, transparent);
  color: color-mix(in srgb, var(--m-accent) 55%, #1d2735);
}
.arc-btn.closing {
  pointer-events: none;
  animation: fb-retreat 0.16s cubic-bezier(0.5, 0, 0.75, 0.4) both;
  animation-delay: calc((var(--n) - 1 - var(--i)) * 12ms);
}
.lbl {
  font-size: 8px;
  line-height: 1;
  color: color-mix(in srgb, var(--m-deep) 82%, transparent);
  white-space: nowrap;
  transition: color 0.14s ease;
}
.arc-btn:hover .lbl {
  color: color-mix(in srgb, var(--m-accent) 60%, #1d2735);
}
/* 扇形扫出：从锚点方向小半径旋入到位；收回反向。 */
@keyframes fb-sweep {
  0% {
    opacity: 0;
    transform: rotate(calc(var(--fa) - 100deg)) translateY(calc(var(--r) * -0.35))
      rotate(calc(-1 * (var(--fa) - 100deg))) scale(0.4);
  }
  55% { opacity: 1; }
  100% {
    opacity: 1;
    transform: rotate(var(--fa)) translateY(calc(-1 * var(--r)))
      rotate(calc(-1 * var(--fa))) scale(1);
  }
}
@keyframes fb-retreat {
  0% {
    opacity: 1;
    transform: rotate(var(--fa)) translateY(calc(-1 * var(--r)))
      rotate(calc(-1 * var(--fa))) scale(1);
  }
  45% { opacity: 1; }
  100% {
    opacity: 0;
    transform: rotate(calc(var(--fa) - 100deg)) translateY(calc(var(--r) * -0.35))
      rotate(calc(-1 * (var(--fa) - 100deg))) scale(0.4);
  }
}
</style>
