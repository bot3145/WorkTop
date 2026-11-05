<script setup lang="ts">
// 开关：iOS 风格（44×26），带滑动动画与深浅色适配。设置页统一用它。
withDefaults(defineProps<{ modelValue: boolean; disabled?: boolean; label?: string }>(), {
  disabled: false,
  label: "",
})
const emit = defineEmits<{ "update:modelValue": [v: boolean] }>()
</script>

<template>
  <button type="button" role="switch" :aria-checked="modelValue" :aria-label="label || undefined"
    :disabled="disabled" class="tg" :class="{ on: modelValue, dis: disabled }"
    @click="emit('update:modelValue', !modelValue)">
    <span class="tg-knob" />
  </button>
</template>

<style scoped>
/* scoped 会编译成 .tg[data-v-xxx]，特异性高于主题里的 .pwb button 基础样式 */
.tg { position: relative; width: 44px; height: 26px; min-height: 0; border: none; border-radius: 999px;
  padding: 0; background: #d9d9df; cursor: pointer; flex-shrink: 0;
  transition: background .2s ease; box-shadow: inset 0 0 0 1px rgba(0,0,0,.06); }
.tg.on { background: #34c759; box-shadow: inset 0 0 0 1px rgba(0,0,0,.04); }
.tg:hover { background: #cfcfd6; }
.tg.on:hover { background: #2fb852; }
.tg.dis { opacity: .45; cursor: default; }
.tg-knob { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%;
  background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.32), 0 0 0 .5px rgba(0,0,0,.04);
  transition: transform .22s cubic-bezier(.32,.72,.35,1.2); }
.tg.on .tg-knob { transform: translateX(18px); }
:global(.pwb-dark) .tg { background: #4a4a52; box-shadow: inset 0 0 0 1px rgba(255,255,255,.06); }
:global(.pwb-dark) .tg:hover { background: #54545d; }
:global(.pwb-dark) .tg.on { background: #30d158; }
</style>
