<script setup lang="ts">
// 桌面右键菜单：定位跟随触发点，点击其他处/Esc 关闭。
import { computed, onMounted, onUnmounted } from "vue"

export interface CtxItem {
  key: string
  label: string
  danger?: boolean
}
const props = defineProps<{ x: number; y: number; items: CtxItem[] }>()
const emit = defineEmits<{ select: [key: string]; close: [] }>()

const pos = computed(() => ({
  left: Math.min(props.x, window.innerWidth - 190) + "px",
  top: Math.min(props.y, window.innerHeight - 40 - props.items.length * 30) + "px",
}))
function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") emit("close")
}
onMounted(() => window.addEventListener("keydown", onKey))
onUnmounted(() => window.removeEventListener("keydown", onKey))
</script>

<template>
  <div class="ctx-bg" @mousedown.self="emit('close')" @contextmenu.prevent="emit('close')">
    <div class="ctx-menu" :style="pos">
      <button v-for="item in items" :key="item.key" class="ctx-item" :class="{ danger: item.danger }"
        @click="emit('select', item.key); emit('close')">
        {{ item.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.ctx-bg { position: fixed; inset: 0; z-index: 48; }
.ctx-menu { position: fixed; min-width: 170px; padding: 5px; border-radius: 10px;
  background: var(--pwb-topbar); backdrop-filter: blur(24px) saturate(1.8); -webkit-backdrop-filter: blur(24px) saturate(1.8);
  border: 1px solid var(--pwb-border); box-shadow: var(--pwb-shadow-pop); animation: pwbPop .14s cubic-bezier(.32,.72,.35,1); }
.ctx-item { display: block; width: 100%; text-align: left; border: none; background: transparent; cursor: pointer;
  font: inherit; font-size: 12.5px; font-weight: 500; color: var(--pwb-text); padding: 6px 10px; border-radius: 7px; height: auto; }
.ctx-item:hover { background: var(--pwb-accent); color: var(--pwb-on-accent); }
.ctx-item.danger { color: var(--pwb-bad-fg); }
.ctx-item.danger:hover { background: var(--pwb-danger); color: #fff; }
</style>
