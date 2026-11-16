<script setup lang="ts">
// 贴图窗口：把截图钉在屏幕最上层。
// 窗口是透明的、无边框的，图片按物理像素 1:1 摆放（尺寸由 Rust 用 Win32 定死），
// 所以这里一律用 CSS 相对尺寸，不做任何 DPI 换算。
//
// 交互（对齐 Snipaste）：
//   拖动       移动贴图（原生拖动，不自己算位置）
//   滚轮       以原始像素为基准缩放
//   Ctrl+滚轮  调透明度
//   双击/右键   关闭 / 菜单
//   Esc        关闭
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue"
import { invoke } from "@tauri-apps/api/core"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { save } from "@tauri-apps/plugin-dialog"
import Icon from "../components/Icon.vue"

const params = new URLSearchParams(location.search)
const id = Number(params.get("id") ?? 0)
const win = getCurrentWindow()

const src = ref("")
const failed = ref("")
const zoom = ref(1)
/** 初始透明度由 Rust 在建窗时写进 URL（启动恢复场景） */
const opacity = ref(Number(params.get("op") ?? "1") || 1)
const menu = ref<{ x: number; y: number } | null>(null)
const hint = ref(true)
const toast = ref("")

let pngBase64 = ""
/** 缩放入口只记目标值，真正下发给 Rust 放到下一帧：滚轮连发时不会一次 IPC 一个 */
let zoomRaf = 0
let pendingZoom = 1
let moveTimer: ReturnType<typeof setTimeout> | null = null
let toastTimer: ReturnType<typeof setTimeout> | null = null
let hintTimer: ReturnType<typeof setTimeout> | null = null
let unMoved: (() => void) | null = null

const rootStyle = computed(() => ({ opacity: String(opacity.value) }))

function say(text: string) {
  toast.value = text
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ""), 1400)
}

function close() {
  void invoke("pin_close", { id }).catch(() => {})
}

async function copyImage() {
  menu.value = null
  try {
    await invoke("snip_export", { action: "copy", pngBase64, path: null })
    say("已复制到剪贴板")
  } catch (e) {
    say(String((e as Error)?.message ?? e))
  }
}

async function saveImage() {
  menu.value = null
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15)
  try {
    const path = await save({
      title: "保存贴图",
      defaultPath: `WorkTop-${stamp}.png`,
      filters: [{ name: "PNG 图片", extensions: ["png"] }],
    })
    if (!path) return
    await invoke("snip_export", { action: "save", pngBase64, path })
    say("已保存")
  } catch (e) {
    say(String((e as Error)?.message ?? e))
  }
}

function applyZoom(next: number) {
  const clamped = Math.min(6, Math.max(0.1, Number(next.toFixed(3))))
  if (Math.abs(clamped - zoom.value) < 0.005) return
  zoom.value = clamped
  pendingZoom = clamped
  if (zoomRaf) return
  zoomRaf = requestAnimationFrame(() => {
    zoomRaf = 0
    void invoke("pin_zoom", { id, zoom: pendingZoom }).catch(() => {})
  })
  say(`缩放 ${Math.round(clamped * 100)}%`)
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  const step = e.deltaY > 0 ? -0.1 : 0.1
  if (e.ctrlKey || e.metaKey) {
    opacity.value = Math.min(1, Math.max(0.15, Number((opacity.value + step).toFixed(2))))
    say(`透明度 ${Math.round(opacity.value * 100)}%`)
    syncOpacity()
    return
  }
  applyZoom(zoom.value + step)
}

/** 透明度是纯 CSS，但要落到 pins.json 才能重启还原；停手 400ms 再写，滚轮连发不刷盘 */
let opacityTimer: ReturnType<typeof setTimeout> | null = null
function syncOpacity() {
  if (opacityTimer) clearTimeout(opacityTimer)
  opacityTimer = setTimeout(() => {
    void invoke("pin_set_opacity", { id, opacity: opacity.value }).catch(() => {})
  }, 400)
}

/** 原生拖动：位置由系统改，这里只在停下来之后把新位置回写给 Rust（缩放要以它为锚）。 */
function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  menu.value = null
  void win.startDragging()
}

function rememberPosition() {
  if (moveTimer) clearTimeout(moveTimer)
  if (opacityTimer) clearTimeout(opacityTimer)
  moveTimer = setTimeout(async () => {
    try {
      const pos = await win.outerPosition()
      const scale = await win.scaleFactor()
      await invoke("pin_move", { id, x: Math.round(pos.x), y: Math.round(pos.y) })
      void scale
    } catch { /* 窗口可能已关闭 */ }
  }, 260)
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault()
    if (menu.value) {
      menu.value = null
      return
    }
    close()
  } else if ((e.ctrlKey || e.metaKey) && e.key === "0") {
    e.preventDefault()
    applyZoom(1)
    opacity.value = 1
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
    e.preventDefault()
    void copyImage()
  }
}

function onContextMenu(e: MouseEvent) {
  e.preventDefault()
  menu.value = {
    x: Math.min(e.clientX, Math.max(0, innerWidth - 132)),
    y: Math.min(e.clientY, Math.max(0, innerHeight - 132)),
  }
}

onMounted(async () => {
  window.addEventListener("wheel", onWheel, { passive: false })
  window.addEventListener("keydown", onKey)
  try {
    pngBase64 = await invoke<string>("pin_image", { id })
    if (!pngBase64) throw new Error("贴图数据为空")
    src.value = `data:image/png;base64,${pngBase64}`
    // 等图片解码完再让窗口出现（窗口由 Rust 建好但保持隐藏）
    await new Promise<void>((resolve) => {
      const img = new Image()
      img.onload = () => resolve()
      img.onerror = () => resolve()
      img.src = src.value
    })
    await nextTick()
    await win.show().catch(() => {})
  } catch (e) {
    failed.value = String((e as Error)?.message ?? e)
    return
  }
  // 移动事件只在拖动时用得上，节流到停手后写一次
  unMoved = await win.onMoved(() => rememberPosition()).catch(() => null)
  hintTimer = setTimeout(() => (hint.value = false), 2200)
})

onUnmounted(() => {
  window.removeEventListener("wheel", onWheel)
  window.removeEventListener("keydown", onKey)
  unMoved?.()
  if (zoomRaf) cancelAnimationFrame(zoomRaf)
  if (moveTimer) clearTimeout(moveTimer)
  if (opacityTimer) clearTimeout(opacityTimer)
  if (toastTimer) clearTimeout(toastTimer)
  if (hintTimer) clearTimeout(hintTimer)
})
</script>

<template>
  <main class="pin-root" :style="rootStyle" @contextmenu="onContextMenu">
    <img v-if="src" class="pin-img" :src="src" alt="" draggable="false" @pointerdown="onPointerDown" @dblclick="close" />
    <div v-if="failed" class="pin-error">{{ failed }}</div>
    <div v-if="hint && !failed" class="pin-hint">
      <span>滚轮缩放</span><i /><span>Ctrl+滚轮透明</span><i /><span>双击关闭</span>
    </div>
    <div v-if="toast" class="pin-toast">{{ toast }}</div>

    <div v-if="menu" class="pin-menu" :style="{ left: `${menu.x}px`, top: `${menu.y}px` }" @pointerdown.stop>
      <button @click="copyImage"><Icon name="copy" :size="14" />复制</button>
      <button @click="saveImage"><Icon name="download" :size="14" />保存为 PNG</button>
      <button @click="applyZoom(1); opacity = 1; menu = null"><Icon name="expand" :size="14" />还原 100%</button>
      <span class="pin-menu-sep" />
      <button class="danger" @click="close"><Icon name="x" :size="14" />关闭</button>
    </div>
  </main>
</template>

<style scoped>
/* 透明悬浮窗：同 mascot，必须 color-scheme: normal，否则 dark 会把透明画布填成黑块 */
:global(.pin-win), :global(.pin-win body), :global(.pin-win #app) {
  width: 100%; height: 100%; margin: 0; overflow: hidden; background: transparent;
  color-scheme: normal; user-select: none;
}
.pin-root {
  position: fixed; inset: 0; display: block;
  font: 12px/1.4 "Segoe UI", "Microsoft YaHei UI", system-ui, sans-serif;
  color: #f5f5f7;
  -webkit-font-smoothing: antialiased;
  transition: opacity .12s ease;
}
.pin-img {
  display: block; width: 100%; height: 100%;
  border-radius: 6px;
  cursor: move;
  /* 透明窗口没有系统投影，用一层极淡描边把边缘勾出来，深色图上也不至于糊掉 */
  outline: 1px solid rgba(255, 255, 255, .16);
  outline-offset: -1px;
  box-shadow: 0 6px 22px rgba(0, 0, 0, .28);
  -webkit-user-drag: none;
}
.pin-img:hover { outline-color: rgba(64, 156, 255, .7); }
.pin-error { display: grid; place-items: center; height: 100%; background: rgba(20, 22, 28, .92); font-size: 12px; }

.pin-hint {
  position: absolute; left: 50%; bottom: 8px; transform: translateX(-50%);
  display: flex; align-items: center; gap: 6px;
  padding: 4px 9px; border-radius: 999px; white-space: nowrap;
  background: rgba(22, 24, 30, .82); color: rgba(245, 245, 247, .8);
  font-size: 11px; pointer-events: none; backdrop-filter: blur(8px);
}
.pin-hint i { width: 1px; height: 9px; background: rgba(255, 255, 255, .22); }
.pin-toast {
  position: absolute; left: 50%; top: 8px; transform: translateX(-50%);
  padding: 3px 10px; border-radius: 999px; white-space: nowrap;
  background: rgba(22, 24, 30, .9); font-size: 11px; pointer-events: none;
}

.pin-menu {
  position: absolute; z-index: 9; min-width: 128px; padding: 5px;
  display: flex; flex-direction: column; gap: 1px;
  background: rgba(28, 29, 34, .96); border: 1px solid rgba(255, 255, 255, .12);
  border-radius: 10px; box-shadow: 0 14px 36px rgba(0, 0, 0, .42);
  backdrop-filter: blur(18px);
}
.pin-menu button {
  display: flex; align-items: center; gap: 7px; width: 100%; height: auto;
  padding: 6px 8px; border: 0; border-radius: 7px; background: none;
  color: inherit; font: inherit; text-align: left; cursor: pointer;
}
.pin-menu button:hover { background: rgba(255, 255, 255, .1); }
.pin-menu button.danger:hover { background: rgba(255, 69, 58, .22); color: #ff9a92; }
.pin-menu-sep { height: 1px; margin: 4px 6px; background: rgba(255, 255, 255, .1); }
</style>
