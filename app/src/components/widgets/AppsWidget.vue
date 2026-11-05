<script setup lang="ts">
// 应用卡片：桌面直接点开常用应用；目录未配置时给引导。
import { computed, onMounted, ref } from "vue"
import { invoke, convertFileSrc } from "@tauri-apps/api/core"
import { toast } from "../../lib/ui"
import WidgetShell from "../WidgetShell.vue"

const emit = defineEmits<{ "open-app": [id: string] }>()

interface AppEntry {
  file: string
  name: string
  ext: string
  icon?: string | null
}
interface Payload {
  dir: string | null
  dirExists: boolean
  apps: AppEntry[]
  pinned: string[]
}

const data = ref<Payload | null>(null)

async function load() {
  try {
    data.value = await invoke<Payload>("apps_list")
  } catch {}
}

onMounted(() => {
  void load()
  setInterval(load, 60_000)
})

/** 只显示「收藏」（在应用面板里点 ☆ 置顶）的快捷方式，按收藏顺序 */
const shown = computed(() => {
  const apps = data.value?.apps ?? []
  const pinned = data.value?.pinned ?? []
  if (!pinned.length) return []
  const byFile = new Map(apps.map((a) => [a.file, a]))
  const seen = new Set<string>()
  return pinned
    .map((f) => byFile.get(f))
    .filter((a): a is AppEntry => Boolean(a) && !seen.has(a!.file) && (seen.add(a!.file), true))
})
const dirOk = computed(() => !!data.value?.dir && data.value.dirExists)

const hue = (s: string) => {
  const h = [...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  return `linear-gradient(135deg, hsl(${h},72%,62%), hsl(${(h + 46) % 360},68%,46%))`
}
const src = (p: string) => {
  try {
    return convertFileSrc(p)
  } catch {
    return p
  }
}

const busy = ref("")
async function launch(a: AppEntry) {
  busy.value = a.file
  try {
    await invoke("apps_launch", { file: a.file })
  } catch (e) {
    toast(String((e as Error).message ?? e), true)
  } finally {
    busy.value = ""
  }
}
</script>

<template>
  <WidgetShell id="apps" caption="应用" :width="300">
    <div v-if="!dirOk" class="aw-empty">未配置应用目录，点下方按钮选择存放快捷方式的文件夹</div>
    <div v-else-if="!shown.length" class="aw-empty">
      还没有收藏的应用。打开应用面板，点应用右上角的 ☆ 即可收藏到这里。
    </div>
    <div v-else class="aw-grid">
      <button v-for="a in shown" :key="a.file" class="aw-app" :title="a.file" @click="launch(a)">
        <img v-if="a.icon" class="aw-ico" :src="src(a.icon)" alt="">
        <span v-else class="aw-ava" :style="{ background: hue(a.name) }">{{ (a.name[0] || "?").toUpperCase() }}</span>
        <span class="aw-name">{{ a.name }}</span>
      </button>
    </div>
    <button class="aw-more" @click="emit('open-app', 'apps')">全部 {{ (data?.apps ?? []).length }} 个应用 →</button>
  </WidgetShell>
</template>

<style scoped>
.aw-empty { font-size: 12px; color: #6e6e73; line-height: 1.5; padding: 4px 0; }
/* 列数跟着卡片宽度走：图标固定 34px、间距固定 → 变宽只会多出列，间距不变 */
.aw-grid { display: grid; grid-template-columns: repeat(auto-fill, 34px); gap: 10px 12px; justify-content: space-between; }
.aw-app { display: flex; flex-direction: column; align-items: center; gap: 4px; border: none; background: transparent;
  padding: 4px 2px; border-radius: 10px; cursor: pointer; min-width: 0; }
.aw-app:hover { background: rgba(0,0,0,.05); }
.aw-ico, .aw-ava { width: 34px; height: 34px; border-radius: 9px; object-fit: cover; box-shadow: 0 2px 6px rgba(0,0,0,.14); }
.aw-ava { display: inline-flex; align-items: center; justify-content: center; color: #fff; font-size: 15px; font-weight: 600; }
.aw-name { font-size: 10.5px; color: #1d1d1f; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aw-more { border: none; background: transparent; color: #1f7a3d; font: inherit; font-size: 11.5px; font-weight: 500;
  cursor: pointer; padding: 6px 0 0; height: auto; }
.aw-more:hover { text-decoration: underline; }
</style>
