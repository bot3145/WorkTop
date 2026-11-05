<script setup lang="ts">
// 待办小组件：白卡，今天/逾期/进行中计数 + 最近事项；点击底部打开待办窗口。
import { computed, inject, onMounted, type ComputedRef } from "vue"
import { useTodoData } from "../../composables/useTodoData"
import { today } from "../../lib/date"
import type { T } from "../../i18n"
import WidgetShell from "../WidgetShell.vue"

const emit = defineEmits<{ "open-app": [id: string] }>()
const t = inject<ComputedRef<T>>("t")!
const { items, ensure } = useTodoData()
onMounted(ensure)

const t0 = today()
const openItems = computed(() => items.value.filter((x) => !x.done))
const dueToday = computed(() => openItems.value.filter((x) => x.due === t0).length)
const overdue = computed(() => openItems.value.filter((x) => x.due && x.due < t0).length)
const preview = computed(() => {
  const sorted = [...openItems.value].sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"))
  return sorted
})
</script>

<template>
  <WidgetShell id="todo" caption="待办" :width="300">
    <div class="tw-stats">
      <span class="tw-chip"><b>{{ dueToday }}</b> {{ t("scope_today") }}</span>
      <span class="tw-chip warn" v-if="overdue"><b>{{ overdue }}</b> {{ t("overdue") }}</span>
      <span class="tw-chip ok"><b>{{ openItems.length }}</b> {{ t("inprog") }}</span>
    </div>
    <div v-for="x in preview" :key="x.line" class="tw-item">
      <span class="tdot" />
      <span class="tw-text">{{ x.text }}</span>
      <span v-if="x.due" class="tw-due" :class="{ overdue: x.due < t0 }">{{ x.due.slice(5) }}</span>
    </div>
    <div v-if="!preview.length" class="tw-empty">{{ t("no_todo_widget") }}</div>
    <button class="tw-more" @click="emit('open-app', 'todo')">{{ t("n_items", { n: openItems.length }) }} →</button>
  </WidgetShell>
</template>

<style scoped>
.tw-stats { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 7px; }
.tw-chip { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 500; color: #6e6e73;
  background: rgba(0,0,0,.05); border-radius: 999px; padding: 1px 8px; }
.tw-chip b { font-variant-numeric: tabular-nums; }
.tw-chip.warn { background: #ffe8e6; color: #c0362c; }
.tw-chip.ok { background: #e2f3e6; color: #1c6b38; }
.tw-item { display: flex; align-items: center; gap: 6px; padding: 3px 0; font-size: 12px; min-width: 0; }
.tdot { width: 4px; height: 4px; border-radius: 50%; background: #c7c7cc; flex-shrink: 0; }
.tw-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #1d1d1f; }
.tw-due { font-size: 11px; color: #6e6e73; font-variant-numeric: tabular-nums; flex-shrink: 0; }
.tw-due.overdue { color: #c0362c; font-weight: 500; }
.tw-empty { font-size: 12px; color: #6e6e73; padding: 4px 0; }
.tw-more { border: none; background: transparent; color: #1f7a3d; font: inherit; font-size: 11.5px; font-weight: 500;
  cursor: pointer; padding: 4px 0 0; height: auto; }
.tw-more:hover { text-decoration: underline; }
</style>
