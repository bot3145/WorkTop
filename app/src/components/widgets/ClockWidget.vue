<script setup lang="ts">
// 时间 + 日历组合卡（2026-11-13 起替代独立的时钟卡与日历卡，更紧凑）：
// 上部大号时间 + 月份翻页，中间日期行，下部紧凑月历（有待办圆点、今日高亮）。
// 嵌入桌面卡片窗口：铺满窗口、字号随容器缩放；主窗口桌面态：白字直写壁纸、整面可拖。
import { computed, inject, onMounted, onUnmounted, ref, type ComputedRef } from "vue"
import { useWidgets } from "../../composables/useWidgets"
import { useTodoData } from "../../composables/useTodoData"
import { isoOf, today } from "../../lib/date"
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

/* ---------- 紧凑月历 ---------- */
const { items, ensure } = useTodoData()
onMounted(ensure)
const anchor = ref(new Date())
const t0 = today()
const MONTHS = computed(() => t.value("months").split(","))

const gridTitle = computed(() => {
  const d = anchor.value
  return lang.value === "en" ? `${MONTHS.value[d.getMonth()]} ${d.getFullYear()}` : `${d.getFullYear()}年${d.getMonth() + 1}月`
})
const cells = computed(() => {
  const y = anchor.value.getFullYear()
  const m = anchor.value.getMonth()
  const lead = (new Date(y, m, 1).getDay() + 6) % 7
  const days = new Date(y, m + 1, 0).getDate()
  const out: (Date | null)[] = Array.from({ length: lead }, () => null)
  for (let d = 1; d <= days; d++) out.push(new Date(y, m, d))
  return out
})
const hasDue = (d: Date) => items.value.some((x) => !x.done && x.due === isoOf(d))
const prevMonth = () => (anchor.value = new Date(anchor.value.getFullYear(), anchor.value.getMonth() - 1, 1))
const nextMonth = () => (anchor.value = new Date(anchor.value.getFullYear(), anchor.value.getMonth() + 1, 1))

/* ---------- 主窗口桌面态的整面拖拽（嵌入卡片窗口时由外层窗口负责） ---------- */
const { posOf, setPos, flush } = useWidgets()
const pos = () => posOf("clock")
const embedded = inject<boolean>("card-embed", false)
const dragging = ref(false)
function onDown(e: PointerEvent) {
  if (e.button !== 0 || embedded) return
  if ((e.target as HTMLElement).closest("button")) return // 翻月按钮不触发拖拽
  dragging.value = true
  const startX = e.clientX
  const startY = e.clientY
  const { x, y } = pos()
  const el = document.querySelector<HTMLElement>(".desktop-area")
  const maxX = (el?.clientWidth ?? window.innerWidth) - 300
  const maxY = (el?.clientHeight ?? window.innerHeight) - 320
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
    <div class="dc-head">
      <div class="dc-time">{{ time }}<span class="dc-sec">{{ second }}</span></div>
      <div class="dc-month">
        <button class="dc-nav" aria-label="prev" @click="prevMonth">‹</button>
        <b>{{ gridTitle }}</b>
        <button class="dc-nav" aria-label="next" @click="nextMonth">›</button>
      </div>
    </div>
    <div class="dc-date">{{ date }}</div>
    <div class="dc-cal">
      <span v-for="w in t('weekdays').split(',')" :key="w" class="dc-wd">{{ w }}</span>
      <span v-for="(d, i) in cells" :key="i" class="dc-cell"
        :class="{ today: d && isoOf(d) === t0, other: !d, due: d && hasDue(d) }">
        {{ d ? d.getDate() : "" }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.desk-clock { position: absolute; z-index: 5; cursor: grab; user-select: none; color: #fff;
  text-shadow: 0 2px 12px rgba(0,0,0,.30); }
.desk-clock.dragging { cursor: grabbing; }

.dc-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }
.dc-time { font-size: 44px; font-weight: 300; letter-spacing: -.01em; line-height: 1; font-variant-numeric: tabular-nums; }
.dc-sec { font-size: 18px; font-weight: 400; opacity: .85; margin-left: 6px; }
.dc-month { display: flex; align-items: center; gap: 2px; padding-bottom: 2px; }
.dc-month b { font-size: 12px; font-weight: 600; opacity: .95; }
.dc-nav { width: 20px; height: 20px; border: none; background: rgba(0,0,0,.22); color: #fff; cursor: pointer;
  border-radius: 6px; font-size: 13px; line-height: 1; padding: 0; }
.dc-nav:hover { background: rgba(0,0,0,.4); }
.dc-date { font-size: 14px; font-weight: 500; margin-top: 6px; opacity: .95; }
.dc-cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px 0; margin-top: 9px; }
.dc-wd { text-align: center; font-size: 10px; opacity: .75; padding-bottom: 2px; }
.dc-cell { position: relative; text-align: center; font-size: 11.5px; line-height: 21px; height: 21px;
  font-variant-numeric: tabular-nums; opacity: .95; }
.dc-cell.other { visibility: hidden; }
.dc-cell.today { background: #ff3b30; color: #fff; border-radius: 50%; font-weight: 600; }
.dc-cell.due::after { content: ""; position: absolute; left: 50%; bottom: 1px; transform: translateX(-50%);
  width: 4px; height: 4px; border-radius: 50%; background: #ff9500; }
.dc-cell.today.due::after { background: #fff; }

/* 嵌入桌面卡片窗口：铺满、字号随容器缩放（玻璃底，浅色壁纸也看得清） */
.desk-clock.embedded { position: relative; width: 100%; height: 100%; box-sizing: border-box;
  display: flex; flex-direction: column; justify-content: center;
  padding: 10px 14px; border-radius: 16px; overflow: hidden; container-type: size;
  background: transparent; color: #fff; text-shadow: 0 2px 12px rgba(0,0,0,.45); cursor: grab; }
.desk-clock.embedded .dc-time { font-size: clamp(24px, 15cqw, 52px); }
.desk-clock.embedded .dc-sec { font-size: clamp(10px, 5.5cqw, 20px); margin-left: 5px; }
.desk-clock.embedded .dc-month b { font-size: clamp(10px, 4.6cqw, 13px); }
.desk-clock.embedded .dc-nav { width: 18px; height: 18px; font-size: 12px; }
.desk-clock.embedded .dc-date { font-size: clamp(11px, 5cqw, 15px); margin-top: 3px; }
.desk-clock.embedded .dc-cal { margin-top: 7px; }
.desk-clock.embedded .dc-wd { font-size: clamp(9px, 4cqw, 10.5px); }
.desk-clock.embedded .dc-cell { font-size: clamp(10px, 4.4cqw, 12px); line-height: clamp(17px, 8cqh, 21px); height: clamp(17px, 8cqh, 21px); }
</style>
