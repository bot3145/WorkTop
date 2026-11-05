<script setup lang="ts">
// 桌面小组件：白色圆角卡片（浅色）/深色卡片（深色）+ 卡片下方壁纸上的名称标签（对齐参考商品样式）。
// 悬停出现拖拽手柄（手柄拖动，避免与内容点击冲突）。
// 嵌入模式（桌面卡片窗口里）由外层窗口负责拖动，这里铺满可用空间、不渲染手柄与标签。
import { inject, ref } from "vue"
import { useWidgets } from "../composables/useWidgets"

const props = defineProps<{ id: string; caption: string; width: number }>()
const embedded = inject<boolean>("card-embed", false)
const { posOf, setPos, flush } = useWidgets()
const dragging = ref(false)

function onGripDown(e: PointerEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  dragging.value = true
  const startX = e.clientX
  const startY = e.clientY
  const { x, y } = posOf(props.id)
  const el = document.querySelector<HTMLElement>(".desktop-area")
  const maxX = (el?.clientWidth ?? window.innerWidth) - props.width - 8
  const maxY = (el?.clientHeight ?? window.innerHeight) - 90
  const move = (ev: PointerEvent) => {
    setPos(props.id, Math.min(x + ev.clientX - startX, maxX), Math.min(y + ev.clientY - startY, maxY))
  }
  const up = () => {
    dragging.value = false
    window.removeEventListener("pointermove", move)
    window.removeEventListener("pointerup", up)
    flush()
  }
  window.addEventListener("pointermove", move)
  window.addEventListener("pointerup", up)
}

const pos = () => posOf(props.id)
</script>

<template>
  <div
    class="widget-item"
    :class="{ dragging, embedded }"
    :style="embedded ? undefined : { left: pos().x + 'px', top: pos().y + 'px', width: width + 'px' }"
  >
    <section class="widget-card">
      <span v-if="!embedded" class="widget-grip" @pointerdown="onGripDown" />
      <div class="widget-body">
        <slot />
      </div>
    </section>
    <div v-if="!embedded" class="widget-caption">{{ caption }}</div>
  </div>
</template>

<style scoped>
.widget-item { position: absolute; z-index: 5; }
.widget-card { position: relative; border-radius: 16px; overflow: hidden;
  background: rgba(255,255,255,.94); box-shadow: 0 10px 30px rgba(0,0,0,.16);
  color: #1d1d1f; transition: box-shadow .18s, transform .18s; }
.widget-card:hover { box-shadow: 0 14px 38px rgba(0,0,0,.22); }
.widget-item.dragging .widget-card { box-shadow: 0 18px 44px rgba(0,0,0,.28); transform: scale(1.015); }
.widget-grip { position: absolute; top: 6px; right: 6px; width: 18px; height: 18px; border-radius: 6px;
  cursor: grab; color: #a5a5aa; display: inline-flex; align-items: center; justify-content: center;
  opacity: 0; transition: opacity .15s, background .15s; z-index: 2; }
.widget-card:hover .widget-grip { opacity: 1; }
.widget-grip:hover { background: rgba(0,0,0,.06); }
.widget-grip:active { cursor: grabbing; }
.widget-body { padding: 12px 14px 13px; }
.widget-caption { margin-top: 7px; text-align: center; font-size: 12px; font-weight: 600;
  color: rgba(255,255,255,.92); text-shadow: 0 1px 4px rgba(0,0,0,.35); letter-spacing: .02em; }

/* 嵌入模式：铺满卡片窗口；完全透明——无卡身、无描边、无阴影，内容直写壁纸。
   文字换白色 + 投影保证任意壁纸可读（覆盖子组件里写死的深色）。 */
.widget-item.embedded { position: relative; width: 100%; height: 100%; display: flex; }
.widget-item.embedded .widget-card {
  flex: 1;
  display: flex;
  min-height: 0;
  background: transparent;
  border: none;
  box-shadow: none;
  overflow: hidden;
  border-radius: 16px;
}
.widget-item.embedded .widget-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 11px 13px 12px;
  color: #fff;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6), 0 0 12px rgba(0, 0, 0, 0.25);
  /* 透明卡片上出现滚动条很丑：保留滚动能力，但不显示滚动条 */
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.widget-item.embedded .widget-body::-webkit-scrollbar { width: 0; height: 0; display: none; }
.widget-item.embedded :deep(.muted),
.widget-item.embedded :deep(.tw-empty),
.widget-item.embedded :deep(.aw-empty),
.widget-item.embedded :deep(.nv-empty),
.widget-item.embedded :deep(.as-empty),
.widget-item.embedded :deep(.kd-empty),
.widget-item.embedded :deep(.nv-none),
.widget-item.embedded :deep(.as-rest) { color: rgba(255, 255, 255, 0.82) !important; text-shadow: inherit; }
.widget-item.embedded :deep(.tw-text),
.widget-item.embedded :deep(.aw-name),
.widget-item.embedded :deep(.as-name),
.widget-item.embedded :deep(.kd-name),
.widget-item.embedded :deep(.nv-cat-name) { color: #fff !important; text-shadow: inherit; }
.widget-item.embedded :deep(.tw-due),
.widget-item.embedded :deep(.as-host),
.widget-item.embedded :deep(.as-grp),
.widget-item.embedded :deep(.kd-chars),
.widget-item.embedded :deep(.kd-ext) { color: rgba(255, 255, 255, 0.78) !important; text-shadow: inherit; }
.widget-item.embedded :deep(.tw-chip),
.widget-item.embedded :deep(.nv-pill) {
  background: rgba(0, 0, 0, 0.32) !important;
  color: #fff !important;
  text-shadow: none;
}
.widget-item.embedded :deep(.tw-chip b),
.widget-item.embedded :deep(.nv-dot) { color: #fff; }
.widget-item.embedded :deep(.tw-chip.warn) { background: rgba(192, 54, 44, 0.75) !important; }
.widget-item.embedded :deep(.tw-chip.ok) { background: rgba(31, 122, 61, 0.75) !important; }
.widget-item.embedded :deep(.tw-more),
.widget-item.embedded :deep(.kd-more),
.widget-item.embedded :deep(.aw-more),
.widget-item.embedded :deep(.nv-more) {
  color: #8fe6ae !important;
  text-shadow: inherit;
}
.widget-item.embedded :deep(.kitem) { border-bottom-color: rgba(255, 255, 255, 0.16); }
.widget-item.embedded :deep(.aq-hint) { color: rgba(255, 255, 255, 0.85) !important; text-shadow: inherit; }
.widget-item.embedded :deep(input:not([type="checkbox"]):not([type="radio"])),
.widget-item.embedded :deep(textarea) {
  background: rgba(0, 0, 0, 0.34);
  border: 1px solid rgba(255, 255, 255, 0.28);
  color: #fff;
  text-shadow: none;
}
.widget-item.embedded :deep(input)::placeholder,
.widget-item.embedded :deep(textarea)::placeholder { color: rgba(255, 255, 255, 0.6); }
.widget-item.embedded :deep(.aq-chip) {
  background: rgba(0, 0, 0, 0.32) !important;
  color: #fff !important;
}
.widget-item.embedded :deep(.aw-app:hover),
.widget-item.embedded :deep(.kd-row:hover),
.widget-item.embedded :deep(.nv-pill:hover) { background: rgba(255, 255, 255, 0.14) !important; }

/* 深色模式：深色卡片 */
:global(.pwb-dark) .widget-card { background: rgba(32,32,36,.92); color: #f2f2f4; }
</style>
