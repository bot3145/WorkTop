<script setup lang="ts">
// 桌面壳：顶部工具栏（应用按钮）+ 壁纸桌面 + 小组件 + 窗口体系（四面板零功能改动搬入窗口）+ 启动台 + 右键菜单。
// 主题三维度（外观/主题色/语言）沿用原有 localStorage 约定，护眼绿等调色板继续生效。
import { computed, onMounted, onUnmounted, provide, ref, watch, watchEffect, type ComputedRef, type Ref } from "vue"
import { makeT, type Lang, type T } from "./i18n"
import { ui, closeDlg, toast } from "./lib/ui"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { getCurrentWindow, currentMonitor } from "@tauri-apps/api/window"
import { autoPick, dockWindowSize, readDockConfig, readScanCache } from "./lib/dock"
import { CARD_KEYS, mergeConfig, resolveLayout, type AppConfig } from "./lib/config"
import { APPS, appDef } from "./lib/apps"
import { AI_PROMPTS, askAi } from "./lib/ai"
import { useWindows } from "./composables/useWindows"
import MenuBar from "./components/MenuBar.vue"
import Launchpad from "./components/Launchpad.vue"
import ContextMenu from "./components/ContextMenu.vue"
import WindowFrame from "./components/WindowFrame.vue"
import SettingsApp from "./components/SettingsApp.vue"
import ClockWidget from "./components/widgets/ClockWidget.vue"
import TodoWidget from "./components/widgets/TodoWidget.vue"
import CalendarWidget from "./components/widgets/CalendarWidget.vue"
import NotesWidget from "./components/widgets/NotesWidget.vue"
import AppsPane from "./panes/AppsPane.vue"
import TodoPane from "./panes/TodoPane.vue"
import NavPane from "./panes/NavPane.vue"
import NotesPane from "./panes/NotesPane.vue"
import KeysPane from "./panes/KeysPane.vue"
import AssetsPane from "./panes/AssetsPane.vue"
import AiPane from "./panes/AiPane.vue"
import Icon from "./components/Icon.vue"

const readLS = (key: string, fallback: string) => {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

/* ---------- 主题（沿用三维度：外观/主题色/语言） ---------- */
const mode = ref(readLS("pwb_theme", "auto"))
const ACCENTS = ["blue", "pink", "green"] as const
type Accent = (typeof ACCENTS)[number]
const accent = ref<Accent>(ACCENTS.includes(readLS("pwb_accent", "blue") as Accent) ? (readLS("pwb_accent", "blue") as Accent) : "blue")
const lang = ref<Lang>(readLS("pwb_lang", "zh") === "en" ? "en" : "zh")
const tc = computed(() => makeT(lang.value))
provide<ComputedRef<T>>("t", tc)
provide<Ref<Lang>>("lang", lang)

const dark = ref(false)
const media = window.matchMedia("(prefers-color-scheme: dark)")
const computeDark = () => {
  if (mode.value === "dark") dark.value = true
  else if (mode.value === "light") dark.value = false
  else dark.value = media.matches
}
computeDark()
media.addEventListener("change", computeDark)
onUnmounted(() => media.removeEventListener("change", computeDark))
const setMode = (m: string) => {
  mode.value = m
  computeDark()
  try {
    localStorage.setItem("pwb_theme", m)
  } catch {}
}
const toggleTheme = () => setMode(dark.value ? "light" : "dark")
const setAccent = (a: string) => {
  accent.value = a as Accent
  try {
    localStorage.setItem("pwb_accent", a)
  } catch {}
}
const setLang = (l: Lang) => {
  lang.value = l
  try {
    localStorage.setItem("pwb_lang", l)
  } catch {}
}
watchEffect(() => {
  document.title = tc.value("app_name")
})

/* ---------- 窗口体系 ---------- */
const { wins, openIds, activeId, open, closeAll } = useWindows()
const visibleWins = computed(() => wins.value.filter((w) => w.state !== "min"))
const padOpen = ref(false)
// 桌面壳模式：极简模式下主窗口隐藏，桌面只留卡片、Dock 与吉祥物
const deskCfg = ref<AppConfig>(mergeConfig({}))

async function loadCfg() {
  try {
    const st = await invoke<{ config: Record<string, unknown> }>("desktop_state")
    deskCfg.value = mergeConfig(st.config)
  } catch {
    /* 配置读取失败时用默认值 */
  }
}

// 设置里切换「桌面壳模式」时主窗即时显隐（开启=隐藏回桌面，关闭=回到传统工作台窗口）
watch(
  () => deskCfg.value.enabled,
  async (on) => {
    const win = getCurrentWindow()
    if (on) await win.hide().catch(() => {})
    else {
      await win.show().catch(() => {})
      await win.setFocus().catch(() => {})
    }
  },
)

/* ---------- 桌面卡片窗口编排 ---------- */
// v3.0 及之前由桌宠窗口兼任；桌宠移除后改由主窗口负责：按配置把 9 种卡片
// 同步成独立桌面层窗口（cards_sync 负责创建/移动/关闭，卡片自己管拖动与磁吸）。
async function syncCards() {
  if (!deskCfg.value.enabled) return
  try {
    const mon = await currentMonitor().catch(() => null)
    const sf = mon?.scaleFactor ?? window.devicePixelRatio ?? 1
    const wa = mon?.workArea
    const area = wa
      ? {
          left: wa.position.x / sf,
          top: wa.position.y / sf,
          right: (wa.position.x + wa.size.width) / sf,
          bottom: (wa.position.y + wa.size.height) / sf,
        }
      : { left: 0, top: 0, right: window.screen.availWidth, bottom: window.screen.availHeight }
    const layout = resolveLayout(deskCfg.value, area)
    const cards = CARD_KEYS.filter((k) => deskCfg.value.cards[k]).map((k) => ({
      key: k,
      x: layout[k].x,
      y: layout[k].y,
      width: layout[k].w,
      height: layout[k].h,
    }))
    await invoke("cards_sync", { cards })
  } catch (e) {
    console.warn("cards_sync failed", e)
  }
}
  const settingsTab = ref<"appearance" | "dock" | "desktop" | "about">("appearance")

const COMPONENTS = { apps: AppsPane, todo: TodoPane, nav: NavPane, note: NotesPane, keys: KeysPane, assets: AssetsPane, settings: SettingsApp, ai: AiPane } as const
const componentOf = (id: string) => COMPONENTS[id as keyof typeof COMPONENTS] ?? TodoPane

function launch(id: string) {
  const def = appDef(id)
  if (!def) return
  if (id === "settings") settingsTab.value = "appearance"
  open(id, { w: def.w, h: def.h })
  padOpen.value = false
}

/** 窗口标题栏的「问 AI」：带上该板块的默认提问，打开/聚焦 AI 窗口 */
function askAiFor(id: string) {
  askAi(AI_PROMPTS[id] ?? AI_PROMPTS.default)
  launch("ai")
}

/* ---------- 桌面右键菜单 ---------- */
interface Ctx { x: number; y: number; items: { key: string; label: string; danger?: boolean }[] }
const ctx = ref<Ctx | null>(null)
function onDesktopCtx(e: MouseEvent) {
  ctx.value = {
    x: e.clientX,
    y: e.clientY,
    items: [
      { key: "launchpad", label: tc.value("ctx_launchpad") },
      { key: "snip", label: tc.value("snip_copy") },
      { key: "settings", label: tc.value("ctx_settings") },
      { key: "closeall", label: tc.value("ctx_close_all"), danger: true },
    ],
  }
}
function onCtxSelect(key: string) {
  if (key === "launchpad") padOpen.value = true
  else if (key === "settings") launch("settings")
  else if (key === "snip") void invoke("snip_capture").catch(() => {})
  else if (key === "closeall") closeAll()
}

/* ---------- 全局快捷键：Esc 关启动台/菜单 ---------- */
function onKey(e: KeyboardEvent) {
  if (e.key === "Escape" && padOpen.value) padOpen.value = false
}
let unlistenResize: (() => void) | null = null
onMounted(async () => {
  window.addEventListener("keydown", onKey)
  void restoreDock()
  await loadCfg()
  await listen("pwb-desktop-config", async () => {
    await loadCfg()
    void syncCards()
  })
  // 极简模式：启用桌面壳时隐藏主窗口，桌面只留卡片、Dock 与吉祥物
  if (deskCfg.value.enabled) {
    try {
      await invoke("mascot_open")
      await invoke("main_hide")
    } catch (e) {
      toast("吉祥物启动失败：" + String((e as Error).message ?? e), true)
    }
  }
  void syncCards()
  unlistenResize = await getCurrentWindow().onResized(() => void syncCards()).catch(() => null)
})
onUnmounted(() => {
  window.removeEventListener("keydown", onKey)
  unlistenResize?.()
})

/* ---------- 桌面 Dock：启动恢复 + 与 Dock 窗口联动 ---------- */
async function restoreDock() {
  const cfg = readDockConfig()
  if (!cfg.enabled) return
  const apps = readScanCache()
  const list = cfg.apps.length
    ? cfg.apps.map((id) => apps.find((a) => a.id === id)).filter(Boolean)
    : autoPick(apps, 10)
  const dims = dockWindowSize(cfg, list.length)
  try {
    await invoke("dock_open", { width: dims.width, height: dims.height, position: cfg.position, margin: 8 })
  } catch {}
}

/* ---------- 对话框宿主（Promise 风格，面板共用） ---------- */
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
</script>

<template>
  <div class="pwb desktop-root" :class="{ 'pwb-dark': dark, 'pwb-pink': accent === 'pink', 'pwb-green': accent === 'green' }">
    <MenuBar v-if="deskCfg.toolbar || !deskCfg.enabled" :apps="APPS" :open-ids="openIds" :active-id="activeId"
      @launch="launch"
      @settings="launch('settings')" @toggle-theme="toggleTheme" />

    <div class="desktop-area" @contextmenu.prevent="onDesktopCtx">
      <!-- 桌面小组件 -->
      <div class="widgets-layer">
        <ClockWidget v-if="deskCfg.cards.clock" />
        <CalendarWidget v-if="deskCfg.cards.calendar" />
        <TodoWidget v-if="deskCfg.cards.todo" @open-app="launch" />
        <NotesWidget v-if="deskCfg.cards.notes" @open-app="launch" />
      </div>

      <!-- 窗口 -->
      <WindowFrame v-for="win in visibleWins" :key="win.id" :win="win"
        :title="tc(appDef(win.id)?.titleKey ?? 'app_name')" :icon="appDef(win.id)?.icon ?? 'file'"
        @ask-ai="askAiFor(win.id)">
        <component :is="componentOf(win.id)"
          v-bind="win.id === 'settings' ? { mode, accent, initialTab: settingsTab } : {}"
          @set-mode="setMode" @set-accent="setAccent" @set-lang="setLang" @open-app="launch" />
      </WindowFrame>

      <!-- 启动台 / 右键菜单 -->
      <Launchpad v-if="padOpen" @open="launch" @close="padOpen = false" />
      <ContextMenu v-if="ctx" :x="ctx.x" :y="ctx.y" :items="ctx.items" @select="onCtxSelect" @close="ctx = null" />
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
.desktop-root { display: flex; flex-direction: column; overflow: hidden; height: 100vh; }
.fade-enter-active, .fade-leave-active { transition: opacity .2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
