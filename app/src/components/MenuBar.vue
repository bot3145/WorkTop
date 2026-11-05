<script setup lang="ts">
// 顶部菜单栏：品牌 + 应用按钮（大号，替代底部内嵌 Dock）+ 外观/设置 + 实时时钟。
import { computed, inject, onMounted, onUnmounted, ref, type ComputedRef } from "vue"
import type { T } from "../i18n"
import Icon from "./Icon.vue"

export interface BarApp {
  id: string
  titleKey: string
  icon: string
}

const props = defineProps<{
  apps: BarApp[]
  openIds: Set<string>
  activeId: string | null
}>()
const emit = defineEmits<{
  launch: [id: string]
  settings: []
  "toggle-theme": []
}>()

const t = inject<ComputedRef<T>>("t")!
const lang = inject<ComputedRef<string>>("lang")!

const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  timer = setInterval(() => (now.value = new Date()), 1000)
})
onUnmounted(() => timer && clearInterval(timer))

const pad = (n: number) => String(n).padStart(2, "0")
const timeText = computed(() => `${pad(now.value.getHours())}:${pad(now.value.getMinutes())}`)
const dateText = computed(() => {
  const d = now.value
  const wd = t.value("weekdays").split(",")[(d.getDay() + 6) % 7]
  return lang.value === "en"
    ? `${t.value("months").split(",")[d.getMonth()]} ${d.getDate()} ${wd}`
    : `${d.getMonth() + 1}月${d.getDate()}日 周${wd}`
})
const stateOf = (id: string) => {
  if (!props.openIds.has(id)) return ""
  return props.activeId === id ? " active" : " open"
}
</script>

<template>
  <header class="menubar">
    <div class="mb-brand">
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" style="flex-shrink: 0">
        <defs>
          <linearGradient id="bar-brand-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#4da3ff" /><stop offset="1" stop-color="#0053b8" />
          </linearGradient>
        </defs>
        <rect x="1.5" y="1.5" width="21" height="21" rx="6.3" fill="url(#bar-brand-g)" />
        <rect x="5" y="6" width="14" height="12" rx="2.5" fill="rgba(255,255,255,.96)" />
        <circle cx="7.7" cy="8.6" r="0.95" fill="#ff5f57" /><circle cx="10.3" cy="8.6" r="0.95" fill="#febc2e" /><circle cx="12.9" cy="8.6" r="0.95" fill="#28c840" />
        <rect x="7" y="11.2" width="10" height="1.6" rx="0.8" fill="#c8cdd5" />
        <rect x="7" y="14.2" width="6.5" height="1.6" rx="0.8" fill="#dde2e9" />
      </svg>
      <b>{{ t("app_name") }}</b>
    </div>

    <nav class="mb-apps">
      <button v-for="app in apps" :key="app.id" class="mb-app" :class="stateOf(app.id)"
        :title="t(app.titleKey)" @click="emit('launch', app.id)">
        <Icon :name="app.icon" :size="18" />
        <span>{{ t(app.titleKey) }}</span>
      </button>
    </nav>

    <div class="spacer" />

    <button class="mb-btn" :title="t('appearance')" @click="emit('toggle-theme')"><Icon name="contrast" :size="15" /></button>
    <button class="mb-btn" :title="t('tab_settings')" @click="emit('settings')"><Icon name="sliders" :size="15" /></button>
    <span class="mb-clock" :title="dateText"><span class="mb-date">{{ dateText }}</span><span class="mb-time">{{ timeText }}</span></span>
  </header>
</template>

<style scoped>
.menubar { display: flex; align-items: center; gap: 10px; height: 46px; padding: 0 12px 0 14px; flex-shrink: 0;
  background: rgba(0,0,0,.16); backdrop-filter: blur(24px) saturate(1.8); -webkit-backdrop-filter: blur(24px) saturate(1.8);
  position: relative; z-index: 40; user-select: none; color: #fff; text-shadow: 0 1px 4px rgba(0,0,0,.4); }

.mb-brand { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600;
  letter-spacing: -.01em; white-space: nowrap; flex-shrink: 0; margin-right: 6px; }

.mb-apps { display: flex; align-items: center; gap: 4px; min-width: 0; }
.mb-app { display: inline-flex; align-items: center; gap: 7px; height: 34px; padding: 0 13px; border: none;
  border-radius: 10px; background: rgba(255,255,255,.12); color: #fff; font-size: 12.5px; font-weight: 500;
  cursor: pointer; white-space: nowrap; transition: background .15s, transform .1s, box-shadow .15s; }
.mb-app:hover { background: rgba(255,255,255,.26); }
.mb-app:active { transform: scale(.97); }
.mb-app.open { background: rgba(255,255,255,.2); }
.mb-app.active { background: rgba(255,255,255,.92); color: #1d1d1f; text-shadow: none;
  box-shadow: 0 2px 10px rgba(0,0,0,.18); }
.spacer { flex: 1; min-width: 6px; }
.mb-btn { width: 30px; height: 30px; padding: 0; border: none; border-radius: 9px; background: transparent;
  color: #fff; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.mb-btn:hover { background: rgba(255,255,255,.24); }
.mb-clock { display: inline-flex; align-items: baseline; gap: 8px; margin-left: 6px; font-size: 12.5px;
  font-variant-numeric: tabular-nums; white-space: nowrap; }
.mb-date { opacity: .82; }
.mb-time { font-weight: 600; }

@media (max-width: 980px) {
  .mb-app span { display: none; }
  .mb-app { padding: 0 10px; }
  .mb-date { display: none; }
}
</style>
