<script setup lang="ts">
// 日历小组件：白卡，左侧大号红色日期 + 右侧当月网格（对齐参考商品布局），有待办的日期带圆点。
import { computed, inject, onMounted, ref, type ComputedRef } from "vue"
import { useTodoData } from "../../composables/useTodoData"
import { isoOf, today } from "../../lib/date"
import type { Lang, T } from "../../i18n"
import WidgetShell from "../WidgetShell.vue"

const t = inject<ComputedRef<T>>("t")!
const lang = inject<ComputedRef<Lang>>("lang")!
const { items, ensure } = useTodoData()
onMounted(ensure)

const anchor = ref(new Date())
const t0 = today()
const MONTHS = computed(() => t.value("months").split(","))

const gridTitle = computed(() => {
  const d = anchor.value
  return lang.value === "en" ? `${MONTHS.value[d.getMonth()]} ${d.getFullYear()}` : `${d.getFullYear()}年${d.getMonth() + 1}月`
})
const bigDay = computed(() => new Date().getDate())
const bigSub = computed(() => {
  const d = new Date()
  const wd = t.value("weekdays").split(",")[(d.getDay() + 6) % 7]
  return lang.value === "en" ? `${MONTHS.value[d.getMonth()]} ${wd}` : `${d.getMonth() + 1}月 周${wd}`
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
</script>

<template>
  <WidgetShell id="calendar" caption="日历" :width="318">
    <div class="calx">
      <div class="calx-left">
        <div class="calx-day">{{ bigDay }}</div>
        <div class="calx-sub">{{ bigSub }}</div>
      </div>
      <div class="calx-right">
        <div class="cm-head">
          <button class="cm-nav" @click="prevMonth">‹</button>
          <b>{{ gridTitle }}</b>
          <button class="cm-nav" @click="nextMonth">›</button>
        </div>
        <div class="cm-grid">
          <span v-for="w in t('weekdays').split(',')" :key="w" class="cm-wd">{{ w }}</span>
          <span v-for="(d, i) in cells" :key="i" class="cm-cell"
            :class="{ today: d && isoOf(d) === t0, other: !d, due: d && hasDue(d) }">
            {{ d ? d.getDate() : "" }}
          </span>
        </div>
      </div>
    </div>
  </WidgetShell>
</template>

<style scoped>
.calx { display: flex; gap: 16px; align-items: center; }
.calx-left { text-align: center; padding: 0 4px 0 2px; }
.calx-day { font-size: 44px; font-weight: 700; line-height: 1; color: #ff3b30; font-variant-numeric: tabular-nums; }
.calx-sub { margin-top: 5px; font-size: 11.5px; color: #6e6e73; }
.calx-right { flex: 1; min-width: 0; }
.cm-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.cm-head b { font-size: 12px; font-weight: 600; color: #1d1d1f; }
.cm-nav { width: 20px; height: 20px; border: none; background: transparent; color: #6e6e73; cursor: pointer;
  border-radius: 6px; font-size: 13px; line-height: 1; padding: 0; }
.cm-nav:hover { background: rgba(0,0,0,.06); color: #1d1d1f; }
.cm-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px 0; }
.cm-wd { text-align: center; font-size: 10px; color: #a5a5aa; padding-bottom: 2px; }
.cm-cell { position: relative; text-align: center; font-size: 11px; line-height: 20px; height: 20px; color: #1d1d1f;
  font-variant-numeric: tabular-nums; }
.cm-cell.other { visibility: hidden; }
.cm-cell.today { background: #ff3b30; color: #fff; border-radius: 50%; font-weight: 600; }
.cm-cell.due::after { content: ""; position: absolute; left: 50%; bottom: 0; transform: translateX(-50%);
  width: 4px; height: 4px; border-radius: 50%; background: #ff9500; }
.cm-cell.today.due::after { background: #fff; }
</style>
