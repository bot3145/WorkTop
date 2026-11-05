<script setup lang="ts">
// 速记小组件：白卡，最新一条速记预览；点击打开速记窗口。
import { inject, onMounted, ref, type ComputedRef } from "vue"
import { call, type TextDoc } from "../../lib/api"
import type { T } from "../../i18n"
import WidgetShell from "../WidgetShell.vue"

const emit = defineEmits<{ "open-app": [id: string] }>()
const t = inject<ComputedRef<T>>("t")!
const latest = ref<{ time: string; body: string } | null>(null)

onMounted(async () => {
  try {
    const d = await call<TextDoc>("note_get")
    const sections: { title: string; lines: string[] }[] = []
    let cur: { title: string; lines: string[] } | null = null
    for (const line of d.text.split(/\r?\n/)) {
      const h = line.match(/^##\s+(.+)$/)
      if (h) {
        cur = { title: h[1].trim(), lines: [] }
        sections.push(cur)
        continue
      }
      if (cur) cur.lines.push(line)
    }
    const last = sections[sections.length - 1]
    if (last) {
      const time = last.title.match(/^(\d{4}-)?(\d{2}-\d{2} \d{2}:\d{2})$/)?.[2] ?? last.title.slice(0, 16)
      latest.value = { time, body: last.lines.join("\n").trim() }
    }
  } catch {}
})
</script>

<template>
  <WidgetShell id="notes" caption="便签" :width="286">
    <template v-if="latest">
      <div class="nw-time">{{ latest.time }}</div>
      <div class="nw-body">{{ latest.body || "…" }}</div>
    </template>
    <div v-else class="nw-empty">{{ t("note_empty") }}</div>
    <button class="nw-more" @click="emit('open-app', 'note')">{{ t("note_new") }} →</button>
  </WidgetShell>
</template>

<style scoped>
.nw-time { font-size: 11px; color: #a5a5aa; font-variant-numeric: tabular-nums; }
.nw-body { margin-top: 4px; font-size: 12px; color: #1d1d1f; line-height: 1.5; max-height: 88px; overflow: hidden;
  white-space: pre-wrap; word-break: break-word; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; }
.nw-empty { font-size: 12px; color: #6e6e73; padding: 6px 0; }
.nw-more { border: none; background: transparent; color: #1f7a3d; font: inherit; font-size: 11.5px; font-weight: 500;
  cursor: pointer; padding: 6px 0 0; height: auto; }
.nw-more:hover { text-decoration: underline; }
</style>
