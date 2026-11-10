<script setup lang="ts">
// 启动台：极光玻璃面板 + 模块图标网格（与应用启动台同一套视觉语言）。
// 只负责「打开某个板块」与 Esc 关闭，功能与数据未变。
import { inject, type ComputedRef } from "vue"
import { APPS } from "../lib/apps"
import type { T } from "../i18n"
import Icon from "./Icon.vue"

const emit = defineEmits<{ open: [id: string]; close: [] }>()
const t = inject<ComputedRef<T>>("t")!

const GLOSS: Record<string, string> = {
  ai: "linear-gradient(150deg,#b79cff,#6d4be0)",
  apps: "linear-gradient(150deg,#7fc0ff,#2f7fdc)",
  todo: "linear-gradient(150deg,#6fe08c,#22a04c)",
  nav: "linear-gradient(150deg,#6ec0f0,#1f7fb8)",
  note: "linear-gradient(150deg,#ffc266,#f08516)",
  keys: "linear-gradient(150deg,#a8abb4,#5b6068)",
  assets: "linear-gradient(150deg,#63d3c2,#159181)",
  settings: "linear-gradient(150deg,#adb4c2,#666e7d)",
}
</script>

<template>
  <div class="pad-bg" @mousedown.self="emit('close')">
    <div class="pad-panel" @keydown.esc="emit('close')">
      <div class="pad-aura" aria-hidden="true" />
      <div class="pad-grid">
        <button v-for="app in APPS" :key="app.id" class="pad-app" @click="emit('open', app.id)">
          <span class="pad-ic" :style="{ background: GLOSS[app.id] }"><Icon :name="app.icon" :size="26" /></span>
          <span class="pad-name">{{ t(app.titleKey) }}</span>
        </button>
      </div>
      <div class="pad-tip">{{ t("launchpad") }} · Esc</div>
    </div>
  </div>
</template>

<style scoped>
.pad-bg {
  position: absolute;
  inset: 0;
  z-index: 42;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(22, 28, 40, 0.26);
  backdrop-filter: blur(18px) saturate(1.2);
  -webkit-backdrop-filter: blur(18px) saturate(1.2);
  animation: pwbFade 0.16s ease;
}
.pad-panel {
  position: relative;
  isolation: isolate;
  padding: 26px 30px 18px;
  border-radius: 24px;
  overflow: hidden;
  background: linear-gradient(170deg, #ffffff 0%, #f4f9ff 52%, #e7f1ff 100%);
  border: 1px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 26px 70px rgba(20, 40, 70, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.95);
  animation: pwbPop 0.2s cubic-bezier(0.32, 0.72, 0.35, 1);
}
.pad-aura {
  position: absolute;
  inset: 0;
  z-index: -1;
  background:
    radial-gradient(58% 44% at 14% 0%, rgba(255, 186, 216, 0.55), transparent 70%),
    radial-gradient(56% 42% at 88% 2%, rgba(150, 197, 255, 0.6), transparent 72%),
    radial-gradient(92% 54% at 50% 114%, rgba(120, 180, 255, 0.62), transparent 70%);
}
.pad-grid {
  display: grid;
  grid-template-columns: repeat(4, 96px);
  gap: 18px 10px;
  justify-content: center;
}
.pad-app {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  height: auto;
  padding: 8px 2px;
  border: none;
  border-radius: 14px;
  background: transparent;
  cursor: pointer;
  transition: background 0.15s;
}
.pad-app:hover { background: rgba(255, 255, 255, 0.55); }
.pad-ic {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: 0 6px 16px rgba(30, 55, 90, 0.22), inset 0 1px 1px rgba(255, 255, 255, 0.45);
  transition: transform 0.16s cubic-bezier(0.32, 0.72, 0.35, 1), box-shadow 0.16s;
}
.pad-app:hover .pad-ic {
  transform: translateY(-3px) scale(1.05);
  box-shadow: 0 12px 24px rgba(30, 55, 90, 0.28), inset 0 1px 1px rgba(255, 255, 255, 0.55);
}
.pad-name { font-size: 12px; font-weight: 600; color: #1d1d1f; }
.pad-tip { margin-top: 12px; text-align: center; font-size: 11px; color: rgba(29, 29, 31, 0.42); }

.pwb-dark .pad-panel {
  background: linear-gradient(170deg, #232830 0%, #1b2028 52%, #151a21 100%);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 26px 70px rgba(0, 0, 0, 0.55);
}
.pwb-dark .pad-aura {
  background:
    radial-gradient(58% 44% at 14% 0%, rgba(120, 80, 160, 0.5), transparent 70%),
    radial-gradient(56% 42% at 88% 2%, rgba(50, 110, 180, 0.55), transparent 72%),
    radial-gradient(92% 54% at 50% 114%, rgba(40, 100, 170, 0.5), transparent 70%);
}
.pwb-dark .pad-app:hover { background: rgba(255, 255, 255, 0.08); }
.pwb-dark .pad-name { color: #eef1f6; }
.pwb-dark .pad-tip { color: rgba(238, 241, 246, 0.42); }
</style>
