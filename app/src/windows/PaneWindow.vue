<script setup lang="ts">
// 独立功能窗口：从桌面卡片 / Dock 打开某个板块时使用。
// 与工作台主窗口互不依赖——主窗口保持隐藏（桌面壳模式），不再提供唤起入口。
// 根节点挂 .pwb，让面板组件复用工作台的全套主题样式（按钮/输入框/卡片）。
import { computed, onMounted, onUnmounted, provide, ref, watchEffect, type ComputedRef, type Ref } from "vue"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { invoke } from "@tauri-apps/api/core"
import { emit } from "@tauri-apps/api/event"
import { ui, closeDlg } from "../lib/ui"
import { makeT, type Lang, type T } from "../i18n"
import { appDef } from "../lib/apps"
import { aiPending } from "../lib/ai"
import TodoPane from "../panes/TodoPane.vue"
import NavPane from "../panes/NavPane.vue"
import NotesPane from "../panes/NotesPane.vue"
import KeysPane from "../panes/KeysPane.vue"
import AssetsPane from "../panes/AssetsPane.vue"
import AppsPane from "../panes/AppsPane.vue"
import SettingsApp from "../components/SettingsApp.vue"
import AiPane from "../panes/AiPane.vue"
import Icon from "../components/Icon.vue"

const win = getCurrentWindow()
const params = new URLSearchParams(location.search)
const appId = params.get("app") ?? "todo"

// 设置面板初始标签：?tab=dock|appearance|desktop|about（Dock 的设置入口直达 Dock 标签）
const SETTINGS_TABS = ["appearance", "dock", "desktop", "about"] as const
type SettingsTab = (typeof SETTINGS_TABS)[number]
const settingsTab: SettingsTab = SETTINGS_TABS.includes(params.get("tab") as SettingsTab)
  ? (params.get("tab") as SettingsTab)
  : "appearance"

const COMPONENTS = {
  todo: TodoPane,
  nav: NavPane,
  note: NotesPane,
  keys: KeysPane,
  assets: AssetsPane,
  apps: AppsPane,
  settings: SettingsApp,
  ai: AiPane,
} as const
const component = computed(() => COMPONENTS[appId as keyof typeof COMPONENTS] ?? TodoPane)

// AI 面板：?q= 里的预填问题要在组件挂载前放好
const presetQ = params.get("q")
if (presetQ && appId === "ai" && !aiPending.value) aiPending.value = presetQ

/* ---------- i18n / 主题（面板组件的注入依赖） ---------- */
const readLS = (key: string, fallback: string) => {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}
const lang = ref<Lang>(readLS("pwb_lang", "zh") === "en" ? "en" : "zh")
const tc = computed(() => makeT(lang.value))
provide<ComputedRef<T>>("t", tc)
provide<Ref<Lang>>("lang", lang)

const mode = ref(readLS("pwb_theme", "auto"))
const accent = ref(readLS("pwb_accent", "blue"))
const dark = ref(false)
const media = window.matchMedia("(prefers-color-scheme: dark)")
const computeDark = () => {
  dark.value = mode.value === "dark" || (mode.value === "auto" && media.matches)
}
computeDark()
media.addEventListener("change", computeDark)

/* ---------- 面板事件 ---------- */
const setMode = (m: string) => {
  mode.value = m
  computeDark()
  try {
    localStorage.setItem("pwb_theme", m)
  } catch {}
  void emit("pwb-theme")
}
const setAccent = (a: string) => {
  accent.value = a
  try {
    localStorage.setItem("pwb_accent", a)
  } catch {}
  void emit("pwb-theme")
}
const setLang = (l: Lang) => {
  lang.value = l
  try {
    localStorage.setItem("pwb_lang", l)
  } catch {}
  void emit("pwb-theme")
}
/** 面板里点「打开其它板块」：同样开独立窗口，不唤起工作台 */
async function openPane(id: string) {
  const def = appDef(id)
  if (!def) return
  await invoke("pane_open", { id, width: def.w, height: def.h }).catch(() => {})
}
async function close() {
  // 三级兜底：窗口 API → destroy → 让 Rust 直接关（不依赖窗口能力），绝不静默失败
  try {
    await win.close()
    return
  } catch {}
  try {
    await win.destroy()
    return
  } catch {}
  await invoke("pane_close", { id: appId }).catch(() => {})
}
async function minimize() {
  await win.minimize().catch(() => {})
}

/** Esc 关闭（弹窗打开时让面板自己先处理，见各面板的 keydown 冒泡） */
function onKey(e: KeyboardEvent) {
  if (e.key !== "Escape") return
  if (document.querySelector(".pwb-modal")) return
  void close()
}

const title = computed(() => tc.value(appDef(appId)?.titleKey ?? "app_name"))

/* ---------- 标题栏拖动 ---------- */
function onBarDown(e: PointerEvent) {
  if (e.button !== 0) return
  if ((e.target as HTMLElement).closest("button")) return
  void win.startDragging().catch(() => {})
}

/* ---------- Toast / Promise 对话框宿主（面板共用） ---------- */
const dlgText = ref("")
const dlgChecked = ref(false)
watchEffect(() => {
  if (ui.dlg) {
    dlgText.value = ui.dlg.initial ?? ""
    dlgChecked.value = false
  }
})
const submitDlg = () => {
  const dlg = ui.dlg
  if (!dlg) return
  closeDlg(dlg.checkboxLabel ? { text: dlgText.value, checked: dlgChecked.value } : dlg.kind === "prompt" ? dlgText.value : true)
}

onMounted(() => {
  document.title = title.value
  // 任务栏/Alt-Tab 里显示本地化标题（builder 里只能给 ASCII 兜底名）
  void win.setTitle(title.value).catch(() => {})
  window.addEventListener("keydown", onKey)
})
onUnmounted(() => {
  media.removeEventListener("change", computeDark)
  window.removeEventListener("keydown", onKey)
})
watchEffect(() => {
  document.title = title.value
  void win.setTitle(title.value).catch(() => {})
})
</script>

<template>
  <div class="pwb pane-root" :class="{ 'pwb-dark': dark, 'pwb-pink': accent === 'pink', 'pwb-green': accent === 'green' }">
    <header class="pane-bar" @pointerdown="onBarDown">
      <div class="pane-title"><Icon :name="appDef(appId)?.icon ?? 'file'" :size="13" /><span>{{ title }}</span></div>
      <div class="spacer" />
      <button class="pane-btn" :title="tc('win_min')" @click="minimize"><Icon name="minus" :size="12" /></button>
      <button class="pane-btn pane-close" :title="tc('win_close')" @click="close"><Icon name="x" :size="13" /></button>
    </header>
    <div class="pane-body">
      <component
        :is="component"
        v-bind="appId === 'settings' ? { mode, accent, initialTab: settingsTab } : {}"
        @set-mode="setMode"
        @set-accent="setAccent"
        @set-lang="setLang"
        @open-app="openPane"
      />
    </div>

    <!-- Toast 宿主 -->
    <Transition name="fade">
      <div v-if="ui.toast" class="pwb-toast" :class="{ err: ui.toast.err }">
        <Icon :name="ui.toast.err ? 'alert' : 'checkCircle'" :size="15" /><span>{{ ui.toast.msg }}</span>
      </div>
    </Transition>

    <!-- Promise 对话框宿主 -->
    <div v-if="ui.dlg" class="pwb-modal-bg" style="z-index: 70" @mousedown.self="closeDlg(null)">
      <div class="pwb-modal" role="dialog" aria-modal="true" :aria-label="ui.dlg.title" @keydown.esc="closeDlg(null)">
        <div class="pwb-modal-head">
          <h3>{{ ui.dlg.title }}</h3>
          <button class="ibtn" aria-label="Close" @click="closeDlg(null)"><Icon name="x" :size="14" /></button>
        </div>
        <div v-if="ui.dlg.message" class="pwb-dlg-msg">{{ ui.dlg.message }}</div>
        <input v-if="ui.dlg.kind === 'prompt'" v-model="dlgText" style="width: 100%" :type="ui.dlg.inputType || 'text'"
          :placeholder="ui.dlg.placeholder || ''" autofocus @keydown.enter="submitDlg">
        <label v-if="ui.dlg.checkboxLabel" class="row" style="gap: 7px; margin-top: 10px; cursor: pointer; font-size: 12.5px">
          <input v-model="dlgChecked" type="checkbox">
          <span>{{ ui.dlg.checkboxLabel }}</span>
        </label>
        <div class="row" style="justify-content: flex-end; margin-top: 14px">
          <button @click="closeDlg(null)">{{ tc("cancel") }}</button>
          <button :class="ui.dlg.danger ? 'danger' : 'primary'" @click="submitDlg">{{ ui.dlg.okText || tc("ok") }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pane-root { display: flex; flex-direction: column; height: 100vh; overflow: hidden;
  background: var(--pwb-bg, #f5f5f7); border-radius: 12px; }
:global(.pwb-dark) .pane-root { background: var(--pwb-bg-dark, #1b1b1e); }
.pane-bar { display: flex; align-items: center; gap: 8px; padding: 8px 10px 8px 14px;
  background: var(--pwb-topbar, rgba(255,255,255,.75)); backdrop-filter: blur(20px) saturate(1.8);
  border-bottom: 1px solid var(--pwb-border, rgba(0,0,0,.08)); cursor: default; user-select: none; }
:global(.pwb-dark) .pane-bar { background: rgba(28,28,32,.8); border-bottom-color: rgba(255,255,255,.1); }
.pane-title { display: flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 600; }
.pane-btn { width: 28px; height: 26px; border: none; border-radius: 8px; background: transparent;
  color: var(--pwb-text, #1d1d1f); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.pane-btn:hover { background: rgba(0,0,0,.08); }
.pane-close:hover { background: #e81123; color: #fff; }
.pane-body { flex: 1; min-height: 0; overflow: auto; padding: 14px 16px; }
.fade-enter-active, .fade-leave-active { transition: opacity .2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
