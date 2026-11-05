<script setup lang="ts">
// 列表末尾的「＋ 新增」虚线卡（从 pwb-lite 移植）
import Icon from "./Icon.vue"
withDefaults(defineProps<{ label: string; disabled?: boolean }>(), { disabled: false })
defineEmits<{ click: [] }>()
</script>

<template>
  <button type="button" class="addcard" :disabled="disabled" :title="label" @click="$emit('click')">
    <Icon name="plus" :size="20" />
    <span>{{ label }}</span>
  </button>
</template>
