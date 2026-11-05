<script setup lang="ts">
// 时钟：直接写在壁纸上的大号白字（对齐参考商品），整面可拖拽，位置持久化。
import { computed, inject, onMounted, onUnmounted, ref, type ComputedRef } from "vue"
import { useWidgets } from "../../composables/useWidgets"
import type { Lang, T } from "../../i18n"

const t = inject<ComputedRef<T>>("t")!
const lang = inject<ComputedRef<Lang>>("lang")!
const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => (timer = setInterval(() => (now.value = new Date()), 1000)))
onUnmounted(() => timer && clearInterval(timer))

const pad = (n: number) => String(n).padStart(2, "0")
const time = computed(() => `${pad(now.value.getHours())}:${pad(now.value.getMinutes())}`)
const second = computed(() => pad(now.value.getSeconds()))
const date = computed(() => {
  const d = now.value
  const wd = t.value("weekdays").split(",")[(d.getDay() + 6) % 7]
  return lang.value === "en"
    ? `${t.value("months").split(",")[d.getMonth()]} ${d.getDate()}, ${wd}`
    : `${d.getMonth() + 1}月${d.getDate()}日 周${wd}`
})

const { posOf, setPos, flush } = useWidgets()
const pos = () => posOf("clock")
// 嵌入桌面卡片窗口：铺满窗口、字号随容器缩放（玻璃底，浅色壁纸也看得清）
const embedded = inject<boolean>("card-embed", false)
const dragging = ref(false)
function onDown(e: PointerEvent) {
  if (e.button !== 0 || embedded) return
  dragging.value = true
  const startX = e.clientX
  const startY = e.clientY
  const { x, y } = pos()
  const el = document.querySelector<HTMLElement>(".desktop-area")
  const maxX = (el?.clientWidth ?? window.innerWidth) - 320
  const maxY = (el?.clientHeight ?? window.innerHeight) - 140
  const move = (ev: PointerEvent) => {
    setPos("clock", Math.min(x + ev.clientX - startX, maxX), Math.min(y + ev.clientY - startY, maxY))
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
</script>

<template>
  <div
    class="desk-clock"
    :class="{ dragging, embedded }"
    :style="embedded ? undefined : { left: pos().x + 'px', top: pos().y + 'px' }"
    @pointerdown="onDown"
  >
    <div class="dc-time">{{ time }}<span class="dc-sec">{{ second }}</span></div>
    <div class="dc-date">{{ date }}</div>
  </div>
</template>

<style scoped>
.desk-clock { position: absolute; z-index: 5; cursor: grab; user-select: none; color: #fff;
  text-shadow: 0 2px 12px rgba(0,0,0,.30); }
.desk-clock.dragging { cursor: grabbing; }
.dc-time { font-size: 64px; font-weight: 300; letter-spacing: -.01em; line-height: 1; font-variant-numeric: tabular-nums; }
.dc-sec { font-size: 24px; font-weight: 400; opacity: .85; margin-left: 8px; }
.dc-date { font-size: 15px; font-weight: 500; margin-top: 6px; opacity: .95; }

.desk-clock.embedded { position: relative; width: 100%; height: 100%; box-sizing: border-box;
  display: flex; flex-direction: column; align-items: flex-start; justify-content: center;
  padding: 10px 14px; border-radius: 16px; overflow: hidden; container-type: size;
  background: transparent;
  color: #fff;
  text-shadow: 0 2px 12px rgba(0,0,0,.45);
  cursor: grab; }
.desk-clock.embedded .dc-time { font-size: clamp(26px, 21cqw, 84px); }
.desk-clock.embedded .dc-sec { font-size: clamp(11px, 6cqw, 26px); margin-left: 5px; }
.desk-clock.embedded .dc-date { font-size: clamp(11px, 5.4cqw, 17px); margin-top: 3px; }
</style>
