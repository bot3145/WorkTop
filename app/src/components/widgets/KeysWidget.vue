<script setup lang="ts">
// 密钥文档卡片：只显示元信息（名称/字数），内容不进卡片窗口；点击打开工作台。
import { onMounted, ref } from "vue"
import { invoke } from "@tauri-apps/api/core"
import WidgetShell from "../WidgetShell.vue"
import Icon from "../Icon.vue"

const emit = defineEmits<{ "open-app": [id: string] }>()

interface KeyDocMeta {
  name: string
  ext: string
  chars: number
  mtimeMs: number
}

const docs = ref<KeyDocMeta[]>([])

onMounted(async () => {
  try {
    const list = await invoke<KeyDocMeta[]>("keysdocs_meta")
    const seen = new Set<string>()
    docs.value = list.filter((d) => {
      const k = `${d.name}.${d.ext}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  } catch {}
})
</script>

<template>
  <WidgetShell id="keys" caption="密钥文档" :width="290">
    <div v-if="docs.length" class="kd-list">
      <button v-for="d in docs" :key="d.name + d.ext" class="kd-row" @click="emit('open-app', 'keys')">
        <Icon name="file" :size="13" />
        <span class="kd-name">{{ d.name }}<span v-if="d.ext === 'txt'" class="kd-ext">.txt</span></span>
        <span class="kd-chars">{{ d.chars }} 字</span>
      </button>
    </div>
    <div v-else class="kd-empty">还没有密钥文档</div>
    <button class="kd-more" @click="emit('open-app', 'keys')">{{ docs.length }} 份文档 →</button>
  </WidgetShell>
</template>

<style scoped>
/* 变宽自动多列，间距固定 */
/* min() 夹住列下限，窄卡片不溢出 */
.kd-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(190px, 100%), 1fr)); gap: 1px 12px; }
.kd-row { display: flex; align-items: center; gap: 7px; padding: 4px 4px; border: none; background: transparent;
  border-radius: 8px; font: inherit; font-size: 12px; color: #1d1d1f; cursor: pointer; min-width: 0; text-align: left; }
.kd-row:hover { background: rgba(0,0,0,.05); }
.kd-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kd-ext { color: #a5a5aa; font-size: 10.5px; }
.kd-chars { margin-left: auto; font-size: 10.5px; color: #a5a5aa; font-variant-numeric: tabular-nums; flex-shrink: 0; }
.kd-empty { font-size: 12px; color: #6e6e73; padding: 4px 0; }
.kd-more { border: none; background: transparent; color: #1f7a3d; font: inherit; font-size: 11.5px; font-weight: 500;
  cursor: pointer; padding: 5px 0 0; height: auto; }
.kd-more:hover { text-decoration: underline; }
</style>
