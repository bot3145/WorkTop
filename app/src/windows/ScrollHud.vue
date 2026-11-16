<script setup lang="ts">
// 长截图 HUD：实时预览 + 滚动控制小窗（300×380 物理像素，由 Rust 摆到选区附近的空档里）。
//
// 一切由事件驱动：拼接线程通过 snip:scroll-progress 推缩略预览与进度，
// 会话结束（完成/取消/到底/上限）时 Rust 直接关掉本窗口（finish_up），
// 所以前端永远不「自己关自己」——按钮只负责调命令，关窗留给后端统一收尾。
//
// 键盘：Esc = 取消。窗口建好时 focused(true)，用户不动鼠标就能 Esc。
import { onMounted, onUnmounted, ref } from "vue"
import { invoke } from "@tauri-apps/api/core"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { listen } from "@tauri-apps/api/event"
import Icon from "../components/Icon.vue"

const win = getCurrentWindow()

const preview = ref("")
const height = ref(0)
const pages = ref(0)
const auto = ref(true)
const note = ref("")
/** 命令在途：防止「完成」连点触发两次状态切换 */
const busy = ref(false)

let unProgress: (() => void) | null = null

function toggleAuto() {
  if (busy.value) return
  const next = !auto.value
  auto.value = next // 先乐观更新，progress 事件会再纠正
  busy.value = true
  invoke("snip_scroll_set_auto", { auto: next })
    .catch(() => { auto.value = !next })
    .finally(() => { busy.value = false })
}

function finish() {
  if (busy.value) return
  busy.value = true
  void invoke("snip_scroll_finish").catch(() => { busy.value = false })
}

function cancel() {
  if (busy.value) return
  busy.value = true
  void invoke("snip_scroll_cancel").catch(() => {
    // 会话已不在（比如刚好自动收尾）：窗口由后端关，这里兜底自关
    busy.value = false
    void win.close().catch(() => {})
  })
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault()
    cancel()
  }
}

/** 头部拖动：HUD 挡住内容时用户可以自己挪走（挪进选区会被拍进长图，属用户选择） */
function onDrag(e: PointerEvent) {
  if (e.button !== 0) return
  void win.startDragging()
}

onMounted(async () => {
  window.addEventListener("keydown", onKey)
  unProgress = await listen<{ height: number; pages: number; preview: string; auto: boolean; note: string }>(
    "snip:scroll-progress",
    (event) => {
      const p = event.payload
      height.value = p.height
      pages.value = p.pages
      auto.value = p.auto
      note.value = p.note
      if (p.preview) preview.value = `data:image/png;base64,${p.preview}`
    },
  ).catch(() => null)
})
onUnmounted(() => {
  window.removeEventListener("keydown", onKey)
  unProgress?.()
})
</script>

<template>
  <main class="hud-root">
    <header class="hud-head" @pointerdown="onDrag">
      <Icon name="longShot" :size="14" />
      <span class="hud-title">长截图</span>
      <span class="hud-hint">Esc 取消 · 拖动挪开</span>
    </header>
    <div class="hud-view">
      <!-- 预览图钉在容器底部：长图越来越高时，用户看到的是最新拼上的内容 -->
      <img v-if="preview" :src="preview" alt="" draggable="false" />
      <div v-else class="hud-wait"><span class="hud-spin" />正在准备首屏…</div>
    </div>
    <div class="hud-meta">
      <span class="hud-num">{{ pages }} 屏</span>
      <span class="hud-num">{{ height }} px</span>
      <span v-if="note" class="hud-note">{{ note }}</span>
    </div>
    <div class="hud-mode" :class="{ manual: !auto }">
      {{ auto ? "自动滚动中，请勿移动光标" : "手动模式：在目标窗口里自己滚" }}
    </div>
    <div class="hud-actions">
      <button class="hud-btn" :disabled="busy" @click="toggleAuto">
        <Icon :name="auto ? 'pause' : 'play'" :size="14" />
        <span>{{ auto ? "暂停自动滚" : "继续自动滚" }}</span>
      </button>
      <button class="hud-btn primary" :disabled="busy" @click="finish">
        <Icon name="check" :size="14" /><span>完成</span>
      </button>
      <button class="hud-btn ghost" :disabled="busy" @click="cancel">
        <Icon name="x" :size="14" /><span>取消</span>
      </button>
    </div>
  </main>
</template>

<style scoped>
/* 透明悬浮窗：同 mascot/pin 的约定，color-scheme 必须 normal，否则透明画布被渲染成黑块 */
:global(.scrollhud-win), :global(.scrollhud-win body), :global(.scrollhud-win #app) {
  width: 100%; height: 100%; margin: 0; overflow: hidden; background: transparent;
  color-scheme: normal; user-select: none;
}
.hud-root {
  --hud-surface: rgba(28, 29, 34, .94);
  --hud-line: rgba(255, 255, 255, .14);
  --hud-text: #f5f5f7;
  --hud-muted: rgba(245, 245, 247, .62);
  --hud-accent: #409cff;
  --hud-font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI Variable Text",
    "Segoe UI", "PingFang SC", "Microsoft YaHei UI", sans-serif;
  position: fixed; inset: 8px; display: flex; flex-direction: column;
  padding: 0 12px 12px; border-radius: 12px;
  background: var(--hud-surface); border: 1px solid var(--hud-line);
  box-shadow: 0 16px 48px rgba(0, 0, 0, .36), 0 3px 10px rgba(0, 0, 0, .22);
  font: 12.5px/1.45 var(--hud-font); color: var(--hud-text);
  -webkit-font-smoothing: antialiased;
}
.hud-head {
  display: flex; align-items: center; gap: 7px; height: 36px; flex: none;
  cursor: default; touch-action: none;
}
.hud-title { font-weight: 600; }
.hud-hint { margin-left: auto; color: var(--hud-muted); font-size: 11px; white-space: nowrap; }
.hud-view {
  position: relative; flex: 1; min-height: 0; overflow: hidden;
  border-radius: 8px; background:
    repeating-conic-gradient(rgba(255, 255, 255, .05) 0 25%, rgba(255, 255, 255, .02) 0 50%) 0 0 / 16px 16px;
  outline: 1px solid rgba(255, 255, 255, .08);
}
.hud-view img { position: absolute; left: 0; bottom: 0; width: 100%; height: auto; -webkit-user-drag: none; }
.hud-wait {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 8px;
  color: var(--hud-muted);
}
.hud-spin {
  width: 13px; height: 13px; border-radius: 50%; flex: none;
  border: 2px solid rgba(255, 255, 255, .18); border-top-color: var(--hud-accent);
  animation: hud-rot .8s linear infinite;
}
@keyframes hud-rot { to { transform: rotate(360deg) } }
.hud-meta {
  display: flex; align-items: center; gap: 6px; flex: none; margin-top: 9px;
  font-variant-numeric: tabular-nums;
}
.hud-num {
  padding: 2px 8px; border-radius: 999px; white-space: nowrap;
  background: rgba(255, 255, 255, .08); font-size: 11.5px;
}
.hud-note {
  min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--hud-muted); font-size: 11.5px;
}
.hud-mode { flex: none; margin-top: 7px; color: var(--hud-muted); font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hud-mode.manual { color: #ffb45c; }
.hud-actions { display: flex; gap: 8px; flex: none; margin-top: 10px; }
.hud-btn {
  display: flex; align-items: center; justify-content: center; gap: 5px;
  height: auto; flex: 1; min-width: 0; padding: 8px 0; border-radius: 8px;
  border: 1px solid var(--hud-line); background: rgba(255, 255, 255, .06);
  color: var(--hud-text); font: inherit; font-size: 12px; cursor: pointer; white-space: nowrap;
}
.hud-btn:disabled { opacity: .55; cursor: default; }
.hud-btn:not(:disabled):hover { background: rgba(255, 255, 255, .11); }
.hud-btn.primary { background: rgba(64, 156, 255, .9); border-color: transparent; color: #fff; }
.hud-btn.primary:not(:disabled):hover { background: #63aeff; }
.hud-btn.ghost { flex: .8; }
.hud-btn.ghost:not(:disabled):hover { background: rgba(255, 69, 58, .22); color: #ff9a92; }
</style>
