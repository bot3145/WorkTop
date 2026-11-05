<script setup lang="ts">
// AI 快问卡片：一句话直达助手；提交后唤起工作台的 AI 窗口（带预填问题）。
import { ref } from "vue"
import WidgetShell from "../WidgetShell.vue"
import Icon from "../Icon.vue"

const emit = defineEmits<{ ask: [prompt: string] }>()

const q = ref("")
const quick = ["帮我整理今天的待办", "把最近的速记提炼成要点", "核对资产清单缺什么"]

function ask(prompt?: string) {
  const text = (prompt ?? q.value).trim()
  if (!text) return
  q.value = ""
  emit("ask", text)
}
</script>

<template>
  <WidgetShell id="ai" caption="AI" :width="300">
    <div class="aq-hint">直接吩咐，AI 可以读写待办 / 导航 / 速记 / 密钥文档 / 资产，每条改动都能撤销。</div>
    <div class="aq-row">
      <input v-model="q" placeholder="例如：把明天的会改到周五" @keydown.enter="ask()">
      <button class="aq-go" title="发送" @click="ask()"><Icon name="spark" :size="13" /></button>
    </div>
    <div class="aq-chips">
      <button v-for="p in quick" :key="p" class="aq-chip" @click="ask(p)">{{ p }}</button>
    </div>
  </WidgetShell>
</template>

<style scoped>
.aq-hint { font-size: 11.5px; color: #6e6e73; line-height: 1.5; margin-bottom: 7px; }
.aq-row { display: flex; gap: 6px; }
.aq-row input { flex: 1; min-width: 0; font-size: 12.5px; }
.aq-go { width: 30px; height: 30px; flex-shrink: 0; border: none; border-radius: 9px; background: var(--pwb-accent, #1f7a3d);
  color: #fff; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.aq-go:hover { filter: brightness(1.08); }
.aq-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 7px; }
.aq-chip { border: none; background: rgba(0,0,0,.05); border-radius: 999px; padding: 3px 9px; font: inherit;
  font-size: 11px; color: #1d1d1f; cursor: pointer; }
.aq-chip:hover { background: rgba(0,0,0,.09); }
</style>
