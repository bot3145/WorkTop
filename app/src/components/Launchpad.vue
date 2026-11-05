<script setup lang="ts">
// 启动台：全屏模糊遮罩 + 白色半透明面板 + 彩色应用图标网格（对齐参考商品图2）。
import { inject, type ComputedRef } from "vue"
import { APPS } from "../lib/apps"
import type { T } from "../i18n"
import Icon from "./Icon.vue"

const emit = defineEmits<{ open: [id: string]; close: [] }>()
const t = inject<ComputedRef<T>>("t")!

const GLOSS: Record<string, string> = {
  todo: "linear-gradient(135deg,#3ddc68,#1e9e46)",
  nav: "linear-gradient(135deg,#41a4ff,#0a63d4)",
  note: "linear-gradient(135deg,#ffb340,#ff7a00)",
  keys: "linear-gradient(135deg,#9a9aa2,#55555c)",
  settings: "linear-gradient(135deg,#c2c2c8,#7c7c84)",
}
</script>

<template>
  <div class="pad-bg" @mousedown.self="emit('close')">
    <div class="pad-panel" @keydown.esc="emit('close')">
      <div class="pad-grid">
        <button v-for="app in APPS" :key="app.id" class="pad-app" @click="emit('open', app.id)">
          <span class="pad-ic" :style="{ background: GLOSS[app.id] }"><Icon :name="app.icon" :size="30" /></span>
          <span class="pad-name">{{ t(app.titleKey) }}</span>
        </button>
      </div>
      <div class="pad-tip">{{ t("launchpad") }} · Esc 关闭</div>
    </div>
  </div>
</template>

<style scoped>
.pad-bg { position: absolute; inset: 0; z-index: 42; background: rgba(0,0,0,.18);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); animation: pwbFade .16s ease;
  display: flex; align-items: center; justify-content: center; }
.pad-panel { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 28px 34px;
  background: rgba(255,255,255,.55); backdrop-filter: blur(30px) saturate(1.8); -webkit-backdrop-filter: blur(30px) saturate(1.8);
  border-radius: 24px; box-shadow: 0 20px 60px rgba(0,0,0,.28), inset 0 0 0 1px rgba(255,255,255,.4);
  animation: pwbPop .18s cubic-bezier(.32,.72,.35,1); }
.pad-grid { display: grid; grid-template-columns: repeat(3, 104px); gap: 20px 12px; }
.pad-app { display: flex; flex-direction: column; align-items: center; gap: 8px; border: none; background: transparent;
  cursor: pointer; padding: 8px 0; border-radius: 12px; }
.pad-app:hover { background: rgba(255,255,255,.45); }
.pad-ic { width: 62px; height: 62px; border-radius: 17px; display: inline-flex; align-items: center; justify-content: center;
  color: #fff; box-shadow: 0 6px 14px rgba(0,0,0,.22), inset 0 1px 1px rgba(255,255,255,.35); }
.pad-name { font-size: 12.5px; font-weight: 600; color: #1d1d1f; }
.pad-tip { font-size: 11px; color: rgba(255,255,255,.9); text-shadow: 0 1px 3px rgba(0,0,0,.25); }
</style>
