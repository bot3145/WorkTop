<script setup lang="ts">
// 导航卡片：分类 + 链接胶囊，点击走系统浏览器（open_external）。
import { computed, onMounted, ref } from "vue"
import { call } from "../../lib/api"
import type { NavPayload } from "../../lib/api"
import WidgetShell from "../WidgetShell.vue"

const emit = defineEmits<{ "open-app": [id: string] }>()

const nav = ref<NavPayload["nav"] | null>(null)

onMounted(async () => {
  try {
    const d = await call<NavPayload>("nav_get")
    nav.value = d.nav
  } catch {}
})

const cats = computed(() =>
  (nav.value?.categories ?? []).map((c) => {
    const seen = new Set<string>()
    return { ...c, links: (c.links ?? []).filter((l) => (seen.has(l.url) ? false : (seen.add(l.url), true))) }
  }),
)
const total = computed(() => (nav.value?.categories ?? []).reduce((n, c) => n + (c.links?.length ?? 0), 0))

const hue = (s: string) => {
  const h = [...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  return `hsl(${h},72%,52%)`
}

async function open(url: string) {
  const target = /^https?:\/\//i.test(url) ? url : `https://${url}`
  try {
    await call("open_external", { url: target })
  } catch (e) {
    console.warn("open_external", e)
  }
}
</script>

<template>
  <WidgetShell id="nav" caption="导航" :width="330">
    <template v-if="cats.length">
      <div v-for="c in cats" :key="c.name" class="nv-cat">
        <div class="nv-cat-name">{{ c.name }}</div>
        <div class="nv-pills">
          <button v-for="l in c.links ?? []" :key="l.url" class="nv-pill" :title="l.url" @click="open(l.url)">
            <span class="nv-dot" :style="{ background: hue(l.title) }" />{{ l.title }}
          </button>
          <span v-if="!(c.links ?? []).length" class="nv-none">空</span>
        </div>
      </div>
    </template>
    <div v-else class="nv-empty">还没有导航链接</div>
    <button class="nv-more" @click="emit('open-app', 'nav')">{{ total }} 条链接 →</button>
  </WidgetShell>
</template>

<style scoped>
.nv-cat { margin-bottom: 7px; min-width: 0; }
.nv-cat-name { font-size: 10.5px; font-weight: 600; color: #a5a5aa; margin-bottom: 4px; letter-spacing: .02em; }
.nv-pills { display: flex; flex-wrap: wrap; gap: 4px; }
.nv-pill { display: inline-flex; align-items: center; gap: 5px; border: none; background: rgba(0,0,0,.05);
  border-radius: 999px; padding: 3px 9px; font: inherit; font-size: 11.5px; color: #1d1d1f; cursor: pointer;
  max-width: 100%; }
.nv-pill:hover { background: rgba(0,0,0,.09); }
.nv-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.nv-none { font-size: 11px; color: #a5a5aa; }
.nv-empty { font-size: 12px; color: #6e6e73; padding: 4px 0; }
.nv-more { border: none; background: transparent; color: #1f7a3d; font: inherit; font-size: 11.5px; font-weight: 500;
  cursor: pointer; padding: 4px 0 0; height: auto; }
.nv-more:hover { text-decoration: underline; }
</style>
