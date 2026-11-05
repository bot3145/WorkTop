<script setup lang="ts">
// 桌面窗口框架：标题栏拖拽、右下角缩放、双击标题栏最大化。
// 平台差异：Windows 控制按钮在右上角（— □ ✕，Windows 习惯），macOS 在左上角（红绿灯，mac 习惯）。
import { inject, ref, type ComputedRef } from "vue"
import { useWindows, type WinRect } from "../composables/useWindows"
import type { T } from "../i18n"
import Icon from "./Icon.vue"

const props = defineProps<{ win: WinRect; title: string; icon: string }>()
const emit = defineEmits<{ "ask-ai": [] }>()
const t = inject<ComputedRef<T>>("t")!
const { setRect, flush, close, minimize, toggleMax, focus } = useWindows()

const isWindows = /Windows/i.test(navigator.userAgent)
const dragActive = ref(false)

function onTitlebarDown(e: PointerEvent) {
  if (e.button !== 0) return
  if ((e.target as HTMLElement).closest(".win-actions")) return
  if (props.win.state === "max") return
  focus(props.win.id)
  const startX = e.clientX
  const startY = e.clientY
  const { x, y } = props.win
  dragActive.value = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  const move = (ev: PointerEvent) => setRect(props.win.id, x + ev.clientX - startX, y + ev.clientY - startY, undefined, undefined, false)
  const up = () => {
    dragActive.value = false
    window.removeEventListener("pointermove", move)
    window.removeEventListener("pointerup", up)
    flush()
  }
  window.addEventListener("pointermove", move)
  window.addEventListener("pointerup", up)
}

function onResizeDown(e: PointerEvent) {
  if (e.button !== 0 || props.win.state !== "normal") return
  e.stopPropagation()
  focus(props.win.id)
  const startX = e.clientX
  const startY = e.clientY
  const { w, h } = props.win
  const move = (ev: PointerEvent) => setRect(props.win.id, props.win.x, props.win.y, w + ev.clientX - startX, h + ev.clientY - startY, false)
  const up = () => {
    window.removeEventListener("pointermove", move)
    window.removeEventListener("pointerup", up)
    flush()
  }
  window.addEventListener("pointermove", move)
  window.addEventListener("pointerup", up)
}
</script>

<template>
  <section class="win" :class="[{ active: win.state !== 'min' }, isWindows ? 'is-win' : 'is-mac']" :style="{
      left: win.x + 'px', top: win.y + 'px', width: win.w + 'px', height: win.h + 'px', zIndex: win.z,
    }" @pointerdown="focus(win.id)">
    <header class="win-titlebar" :class="{ dragging: dragActive }"
      @pointerdown="onTitlebarDown" @dblclick="toggleMax(win.id)">
      <!-- macOS：左上角红绿灯 -->
      <div v-if="!isWindows" class="traffic win-actions">
        <button class="tl red" :title="t('win_close')" @click.stop="close(win.id)"><Icon name="x" :size="9" /></button>
        <button class="tl yellow" :title="t('win_min')" @click.stop="minimize(win.id)"><span class="glyph-min" /></button>
        <button class="tl green" :title="win.state === 'max' ? t('win_restore') : t('win_max')" @click.stop="toggleMax(win.id)"><Icon name="plus" :size="8" /></button>
      </div>

      <div class="win-title"><Icon :name="icon" :size="12" /><span>{{ title }}</span></div>
      <button v-if="win.id !== 'ai'" class="wf-ai" :title="t('tab_ai')" @click.stop="emit('ask-ai')">
        <Icon name="spark" :size="12" />
      </button>
      <div class="spacer" />

      <!-- Windows：右上角控制按钮 -->
      <div v-if="isWindows" class="winbtns win-actions">
        <button class="wb" :title="t('win_min')" @click.stop="minimize(win.id)"><span class="wb-min" /></button>
        <button class="wb" :title="win.state === 'max' ? t('win_restore') : t('win_max')" @click.stop="toggleMax(win.id)">
          <span class="wb-max" :class="{ restore: win.state === 'max' }" />
        </button>
        <button class="wb wbclose" :title="t('win_close')" @click.stop="close(win.id)"><Icon name="x" :size="11" /></button>
      </div>
    </header>
    <div class="win-body">
      <slot />
    </div>
    <span v-if="win.state === 'normal'" class="win-resize" @pointerdown="onResizeDown" />
  </section>
</template>

<style scoped>
.win { position: absolute; display: flex; flex-direction: column; min-width: 0; min-height: 0;
  background: #ffffff; border: 1px solid rgba(0,0,0,.1); border-radius: 12px; overflow: hidden;
  box-shadow: var(--pwb-shadow-md); transition: box-shadow .2s; }
.win.active { box-shadow: var(--pwb-shadow-pop); }
.win-titlebar { display: flex; align-items: center; gap: 10px; height: 36px; padding: 0 12px; flex-shrink: 0;
  background: rgba(246,246,248,.96); border-bottom: 1px solid rgba(0,0,0,.07); user-select: none; touch-action: none; }
.win.is-win .win-titlebar { padding: 0 0 0 14px; gap: 8px; height: 34px; }
.win-titlebar.dragging { cursor: grabbing; }
.win-titlebar:hover { cursor: grab; }
.spacer { flex: 1; min-width: 8px; }

/* macOS 红绿灯 */
.traffic { display: flex; gap: 7px; }
.tl { width: 12px; height: 12px; border-radius: 50%; padding: 0; border: none; display: inline-flex; align-items: center; justify-content: center;
  color: rgba(0,0,0,.55); cursor: pointer; box-shadow: inset 0 0 0 1px rgba(0,0,0,.06); }
.tl svg, .tl .glyph-min { opacity: 0; transition: opacity .12s; }
.traffic:hover .tl svg, .traffic:hover .glyph-min { opacity: 1; }
.tl.red { background: #ff5f57; }
.tl.yellow { background: #febc2e; }
.tl.green { background: #28c840; }
.tl:hover { filter: brightness(.92); }
.glyph-min { display: block; width: 7px; height: 1.5px; background: currentColor; border-radius: 1px; }

/* Windows 右上角控制按钮 */
.winbtns { display: flex; align-items: stretch; align-self: stretch; margin-left: auto; }
.winbtns .wb { width: 44px; height: auto; align-self: stretch; padding: 0; border: none; border-radius: 0; background: transparent;
  color: #5f5f66; display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
  transition: background .12s, color .12s; }
.winbtns .wb:hover { background: rgba(0,0,0,.06); color: #1d1d1f; }
.winbtns .wbclose:hover { background: #e81123; color: #fff; }
.winbtns .wbclose:hover .pwb-ic { color: #fff; }
.wb-min { display: block; width: 10px; height: 1px; background: currentColor; }
.wb-max { display: block; width: 9px; height: 9px; border: 1px solid currentColor; border-radius: 1.5px; }
.wb-max.restore { box-shadow: 2px -2px 0 -1px currentColor; border-radius: 1px; }

.win-title { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: #6e6e73;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: -.01em; }
.win-body { flex: 1; min-height: 0; overflow: auto; background: #f6f6f8; padding: 12px 14px 16px; }
.wf-ai { width: 22px; height: 22px; margin-left: 6px; border: none; border-radius: 7px; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; padding: 0;
  background: transparent; color: var(--pwb-text-dim); opacity: .55; transition: opacity .15s, background .15s; }
.win-titlebar:hover .wf-ai { opacity: 1; }
.wf-ai:hover { background: rgba(0,0,0,.07); color: var(--pwb-accent); }

.win-resize { position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize;
  background: linear-gradient(135deg, transparent 50%, var(--pwb-border-strong) 50%); border-bottom-right-radius: 12px; }

/* 深色 */
:global(.pwb-dark) .win { background: #1f1f22; border-color: rgba(255,255,255,.12); }
:global(.pwb-dark) .win-titlebar { background: rgba(44,44,48,.98); border-bottom-color: rgba(255,255,255,.08); }
:global(.pwb-dark) .win-title { color: #a1a1a6; }
:global(.pwb-dark) .win-body { background: #1b1b1e; }
:global(.pwb-dark) .win-resize { background: linear-gradient(135deg, transparent 50%, rgba(255,255,255,.2) 50%); }
:global(.pwb-dark) .winbtns .wb { color: #b8b8bf; }
:global(.pwb-dark) .winbtns .wb:hover { background: rgba(255,255,255,.12); color: #fff; }
:global(.pwb-dark) .winbtns .wbclose:hover { background: #e81123; color: #fff; }
</style>
