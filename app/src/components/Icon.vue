<script setup lang="ts">
// SF Symbols 风格线性图标：1.7px 圆头描边，currentColor（从 pwb-lite 移植的子集 + 面板所需）。
import { computed } from "vue"

const props = withDefaults(defineProps<{ name: string; size?: number; filled?: boolean }>(), { size: 16, filled: false })

const PATHS: Record<string, string> = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9.5"/><path d="m8.4 12.3 2.5 2.5 4.7-5.2"/>',
  compass: '<circle cx="12" cy="12" r="9.5"/><path d="m15.7 8.3-1.95 5.45L8.3 15.7l1.95-5.45z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  moon: '<path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/>',
  contrast: '<circle cx="12" cy="12" r="9.5"/><path d="M12 2.5v19a9.5 9.5 0 0 0 0-19z" fill="currentColor" stroke="none"/>',
  sliders: '<path d="M4 6h7M17 6h3M4 12h3M13 12h7M4 18h7M17 18h3"/><circle cx="14" cy="6" r="2.2"/><circle cx="10" cy="12" r="2.2"/><circle cx="14" cy="18" r="2.2"/>',
  trash: '<path d="M4 6.5h16"/><path d="M18.5 6.5v12a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-12"/><path d="M9 6.5v-2A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5v2"/><path d="M10 11v6M14 11v6"/>',
  edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
  crop: '<path d="M6 2v16h16"/><path d="M2 6h16v16"/>',
  square: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/>',
  arrow: '<path d="M5 19 19 5"/><path d="M12.5 5H19v6.5"/>',
  pencil: '<path d="M15.5 3.5 20.5 8.5 8 21H3v-5Z"/><path d="m13 6 5 5"/>',
  undo: '<path d="M9.5 14.5 4.5 9.5l5-5"/><path d="M4.5 9.5h9a6 6 0 0 1 0 12h-3"/>',
  redo: '<path d="M14.5 14.5 19.5 9.5l-5-5"/><path d="M19.5 9.5h-9a6 6 0 0 0 0 12h3"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="9" ry="6.8"/>',
  marker: '<path d="M15 3.5 20.5 9 12 17.5H8.5L4 13V9.5Z"/><path d="M9.5 9.5 14.5 14.5"/>',
  download: '<path d="M12 3v12"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M4 20h16"/>',
  copy: '<rect x="8.5" y="8.5" width="12.5" height="12.5" rx="2.5"/><path d="M15.5 5.2A2.5 2.5 0 0 0 13 3H5.5A2.5 2.5 0 0 0 3 5.5V13a2.5 2.5 0 0 0 2.2 2.5"/>',
  expand: '<path d="M8.5 3H3v5.5"/><path d="M15.5 3H21v5.5"/><path d="M21 15.5V21h-5.5"/><path d="M3 15.5V21h5.5"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M15 2v6h6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  x: '<path d="M17 7 7 17M7 7l10 10"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.6-4.6"/>',
  link: '<path d="M9.6 13.4a4.1 4.1 0 0 0 6.14.44l2.55-2.55a4.1 4.1 0 0 0-5.8-5.8l-1.47 1.46"/><path d="M14.4 10.6a4.1 4.1 0 0 0-6.14-.44l-2.55 2.55a4.1 4.1 0 0 0 5.8 5.8l1.46-1.46"/>',
  chevronLeft: '<path d="m14.5 18-6-6 6-6"/>',
  chevronRight: '<path d="m9.5 18 6-6-6-6"/>',
  clock: '<circle cx="12" cy="12" r="9.5"/><path d="M12 7v5l3.2 1.9"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10.5h17"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  lock: '<rect x="4" y="10.5" width="16" height="10.5" rx="2.5"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  unlock: '<rect x="4" y="10.5" width="16" height="10.5" rx="2.5"/><path d="M8 10.5V7a4 4 0 0 1 7.6-1.7"/>',
  alert: '<circle cx="12" cy="12" r="9.5"/><path d="M12 7.5V13M12 16.5h.01"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 20 20H4a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 4 8Z"/><circle cx="12" cy="14" r="3.5"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  dot: '<circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none"/>',
  server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
  spark: '<path d="M12 3.5 13.9 9.1 19.5 11l-5.6 1.9L12 18.5l-1.9-5.6L4.5 11l5.6-1.9z"/><path d="M18.6 16.4 19.3 18.2 21 19l-1.7.7-.7 1.8-.7-1.8L16 19l1.8-.8z"/>',
  rocket: '<path d="M12 2.8c2.9 1.9 4.4 4.9 4.4 8.4 0 2-.55 3.8-1.6 5.4H9.2c-1.05-1.6-1.6-3.4-1.6-5.4 0-3.5 1.5-6.5 4.4-8.4Z"/><circle cx="12" cy="9.2" r="1.7"/><path d="M9.6 16.6 6.4 19v2.4l3.2-1.6"/><path d="M14.4 16.6 17.6 19v2.4l-3.2-1.6"/>',
  star: '<path d="m12 3 2.65 5.9 6.35.6-4.8 4.25 1.4 6.25L12 16.7 6.4 20l1.4-6.25L3 9.5l6.35-.6z"/>',
  grid: '<rect x="3.5" y="3.5" width="7.4" height="7.4" rx="1.8"/><rect x="13.1" y="3.5" width="7.4" height="7.4" rx="1.8"/><rect x="3.5" y="13.1" width="7.4" height="7.4" rx="1.8"/><rect x="13.1" y="13.1" width="7.4" height="7.4" rx="1.8"/>',
  text: '<path d="M9 6.5V4.5h6v2"/><path d="M12 4.5v15"/><path d="M9.5 19.5h5"/>',
  mosaic: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M3.5 9.2h4.6v4.6H3.5zM8.1 13.8h4.6v4.6H8.1zM12.7 9.2h4.6v4.6h-4.6z" fill="currentColor" stroke="none" opacity=".55"/>',
  pin: '<path d="M9.2 3h5.6"/><path d="M10.6 3v5.9l-2.9 3.4a1.5 1.5 0 0 0 1.14 2.47h6.32a1.5 1.5 0 0 0 1.14-2.47l-2.9-3.4V3"/><path d="M12 15.8V21"/>',
  scan: '<path d="M4 8.6V6.2A2.2 2.2 0 0 1 6.2 4h2.4"/><path d="M15.4 4h2.4A2.2 2.2 0 0 1 20 6.2v2.4"/><path d="M20 15.4v2.4a2.2 2.2 0 0 1-2.2 2.2h-2.4"/><path d="M8.6 20H6.2A2.2 2.2 0 0 1 4 17.8v-2.4"/><path d="M9.2 9.8h5.6"/><path d="M12 9.8v5"/>',
  longShot: '<rect x="6" y="2.6" width="12" height="18.8" rx="2.4"/><path d="M12 6.4v8.6"/><path d="m9.6 12.6 2.4 2.4 2.4-2.4"/>',
  pause: '<path d="M8.5 5v14M15.5 5v14"/>',
  play: '<path d="M7.5 5.2v13.6L18.5 12z"/>',
}

const body = computed(() => PATHS[props.name] ?? PATHS.dot)
</script>

<template>
  <svg class="pwb-ic" :width="size" :height="size" viewBox="0 0 24 24"
    :fill="filled ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" v-html="body" />
</template>
