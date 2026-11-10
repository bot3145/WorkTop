<script setup lang="ts">
// 设置应用（窗口内容）：外观（明暗/主题色/语言）+ 桌面 Dock（真 OS 悬浮窗）+ 数据目录迁移 + 关于。
import { computed, inject, onMounted, ref, type ComputedRef } from "vue"
import { call } from "../lib/api"
import { open as openFileDialog } from "@tauri-apps/plugin-dialog"
import { convertFileSrc, invoke } from "@tauri-apps/api/core"
import { emit as emitTauri } from "@tauri-apps/api/event"
import { askConfirm, askPrompt } from "../lib/ui"
import {
  autoPick,
  dockWindowSize,
  mergeCustomApps,
  readCustomApps,
  readDockConfig,
  readScanCache,
  sortForPicker,
  writeDockConfig,
  writeScanCache,
  type DockAppInfo,
  type DockConfig,
  type DockPosition,
} from "../lib/dock"
import { toast } from "../lib/ui"
import {
  clearGuardPassword,
  guard,
  GUARD_MODULES,
  lockGuard,
  refreshGuard,
  setGuardModules,
  setGuardPassword,
  type GuardModule,
} from "../lib/guard"
import { CARD_KEYS, mergeConfig, type AppConfig, type CardKey } from "../lib/config"
import type { Lang, T } from "../i18n"
import { check as updaterCheck, type Update } from "@tauri-apps/plugin-updater"
import { relaunch as updaterRelaunch } from "@tauri-apps/plugin-process"
import {
  disable as autoStartOff,
  enable as autoStartOn,
  isEnabled as autoStartIsOn,
} from "@tauri-apps/plugin-autostart"
import Icon from "../components/Icon.vue"
import ToggleSwitch from "../components/ToggleSwitch.vue"

const t = inject<ComputedRef<T>>("t")!
const lang = inject<ComputedRef<Lang>>("lang")!
const emit = defineEmits<{ "set-mode": [m: string]; "set-accent": [a: string]; "set-lang": [l: Lang] }>()
const props = defineProps<{
  mode: string
  accent: string
  initialTab?: "appearance" | "dock" | "desktop" | "guard" | "about"
}>()

const tab = ref<"appearance" | "dock" | "desktop" | "guard" | "about">(props.initialTab ?? "appearance")

/* ---------- 模块锁（门禁） ---------- */
const pwCurrent = ref("")
const pwNew = ref("")
const pwConfirm = ref("")
const guardBusy = ref(false)

onMounted(() => {
  void refreshGuard()
})

async function toggleGuardModule(m: GuardModule) {
  const next = guard.value.modules.includes(m)
    ? guard.value.modules.filter((x) => x !== m)
    : [...guard.value.modules, m]
  try {
    await setGuardModules(next as GuardModule[])
    toast(t.value("guard_saved"))
  } catch (e) {
    toast(String((e as Error).message), true)
  }
}

async function saveGuardPassword() {
  if (pwNew.value.length < 4) return toast(t.value("guard_pw_short"), true)
  if (pwNew.value !== pwConfirm.value) return toast(t.value("guard_pw_mismatch"), true)
  guardBusy.value = true
  try {
    await setGuardPassword(guard.value.enabled ? pwCurrent.value : null, pwNew.value)
    pwCurrent.value = ""
    pwNew.value = ""
    pwConfirm.value = ""
    toast(t.value("guard_saved"))
  } catch (e) {
    toast(String((e as Error).message), true)
  } finally {
    guardBusy.value = false
  }
}

async function lockAll() {
  try {
    await lockGuard()
    toast(t.value("guard_locked_toast"))
  } catch (e) {
    toast(String((e as Error).message), true)
  }
}

async function disableGuard() {
  const pw = await askPrompt({
    title: t.value("guard_disable"),
    message: t.value("guard_current"),
    inputType: "password",
    danger: true,
    okText: t.value("guard_disable"),
  })
  if (typeof pw !== "string" || !pw) return
  guardBusy.value = true
  try {
    await clearGuardPassword(pw)
    pwCurrent.value = ""
    toast(t.value("guard_disabled_toast"))
  } catch (e) {
    toast(String((e as Error).message), true)
  } finally {
    guardBusy.value = false
  }
}

/* ---------- 桌面 Dock ---------- */
const dockCfg = ref<DockConfig>(readDockConfig())
const scanList = ref<DockAppInfo[]>(readScanCache())
const customApps = ref<DockAppInfo[]>(readCustomApps())
const dockApps = computed(() => mergeCustomApps(scanList.value, customApps.value))
const dockQuery = ref("")
const scanning = ref(false)

const filteredApps = computed(() => {
  const sorted = sortForPicker(dockApps.value)
  const kw = dockQuery.value.trim().toLowerCase()
  if (!kw) return sorted
  return sorted.filter((a) => a.name.toLowerCase().includes(kw) || (a.group ?? "").toLowerCase().includes(kw))
})
const pinnedIds = computed(
  () => new Set(dockCfg.value.apps.length ? dockCfg.value.apps : autoPick(dockApps.value, 10).map((a) => a.id)),
)
const selectedCount = computed(() => pinnedIds.value.size)

async function scanApps(notify = true) {
  if (scanning.value) return
  scanning.value = true
  try {
    const list = await invoke<DockAppInfo[]>("dock_scan")
    scanList.value = list
    writeScanCache(list)
    customApps.value = readCustomApps()
    if (notify) toast(`已扫描 ${list.length} 个应用`)
  } catch (e) {
    toast(String((e as Error).message ?? e), true)
  } finally {
    scanning.value = false
  }
}

function persistDock(next: DockConfig) {
  dockCfg.value = next
  writeDockConfig(next)
  void syncDockWindow(next)
}

async function syncDockWindow(cfg: DockConfig) {
  if (!cfg.enabled) {
    // 先广播配置让 Dock 窗口自行收尾，再关窗（关 Dock 时任务栏还原由 Rust 端兜底）
    await emitTauri("pwb-dock-config", cfg)
    await invoke("dock_close").catch(() => {})
    return
  }
  const list = cfg.apps.length
    ? cfg.apps.map((id) => dockApps.value.find((a) => a.id === id)).filter(Boolean)
    : autoPick(dockApps.value, 10)
  const dims = dockWindowSize(cfg, list.length)
  try {
    await invoke("dock_open", { width: dims.width, height: dims.height, position: cfg.position, margin: 8 })
  } catch (e) {
    toast(String((e as Error).message ?? e), true)
  }
  await emitTauri("pwb-dock-config", cfg)
}

function toggleApp(app: DockAppInfo) {
  const base = dockCfg.value.apps.length ? [...dockCfg.value.apps] : autoPick(dockApps.value, 10).map((a) => a.id)
  const idx = base.indexOf(app.id)
  if (idx >= 0) base.splice(idx, 1)
  else base.push(app.id)
  persistDock({ ...dockCfg.value, apps: base })
}
const setSize = (v: number) => persistDock({ ...dockCfg.value, size: v })
const setPosition = (p: DockPosition) => persistDock({ ...dockCfg.value, position: p })
const setAutohide = (v: boolean) => persistDock({ ...dockCfg.value, autohide: v })
const setReplaceTaskbar = (v: boolean) => persistDock({ ...dockCfg.value, replaceTaskbar: v })
const setEnabled = (v: boolean) => persistDock({ ...dockCfg.value, enabled: v })
const resetPinned = () => persistDock({ ...dockCfg.value, apps: [] })

/* ---------- 数据目录（查看 / 更改并迁移） ---------- */

/* ---------- 桌面卡片（settings.json 的 desktop 键，经 Rust 广播给各窗口） ---------- */
const CARD_LABELS: Record<CardKey, string> = {
  clock: "时钟",
  calendar: "日历",
  todo: "待办",
  notes: "便签",
  apps: "应用",
  nav: "导航",
  assets: "资产",
  keys: "密钥",
  ai: "AI 快问",
}
const deskCfg = ref<AppConfig>(mergeConfig({}))
async function saveDesk(patch: Record<string, unknown>) {
  try {
    const cfg = await invoke<Record<string, unknown>>("desktop_save", { patch })
    deskCfg.value = mergeConfig(cfg)
  } catch (e) {
    toast(String((e as Error).message ?? e), true)
  }
}
const setDeskEnabled = (v: boolean) => saveDesk({ enabled: v })

/* ---------- 开机启动（Windows 登录项） ---------- */
const autoStart = ref(false)
const autoStartBusy = ref(false)
async function loadAutoStart() {
  try {
    autoStart.value = await autoStartIsOn()
  } catch {
    /* 非 Tauri 环境（qa 预览）静默跳过 */
  }
}
async function setAutoStart(v: boolean) {
  if (autoStartBusy.value) return
  autoStartBusy.value = true
  try {
    if (v) await autoStartOn()
    else await autoStartOff()
    autoStart.value = await autoStartIsOn()
    toast(autoStart.value ? "已开启开机启动" : "已关闭开机启动")
  } catch (e) {
    toast(String((e as Error)?.message ?? e), true)
    autoStart.value = await autoStartIsOn().catch(() => false)
  } finally {
    autoStartBusy.value = false
  }
}
const setCard = (k: CardKey, v: boolean) => saveDesk({ cards: { ...deskCfg.value.cards, [k]: v } })
const setCardFont = (v: number) => saveDesk({ cardFontScale: v })

/* ---------- 在线更新（GitHub Releases） ---------- */
type UpdState = "idle" | "checking" | "latest" | "available" | "downloading" | "ready" | "error"
const updState = ref<UpdState>("idle")
const updPct = ref(0)
const updNewVer = ref("")
const updNotes = ref("")
const updErr = ref("")
let updPending: Update | null = null

const updBusy = computed(() => updState.value === "checking" || updState.value === "downloading")
const updBadge = computed(() => {
  switch (updState.value) {
    case "checking": return t.value("upd_checking")
    case "latest": return t.value("upd_latest")
    case "available": return `${t.value("upd_available")} v${updNewVer.value}`
    case "downloading": return `${t.value("upd_downloading")} ${updPct.value}%`
    case "ready": return `${t.value("upd_ready")} v${updNewVer.value}`
    case "error": return t.value("upd_fail")
    default: return `v${version.value}`
  }
})

async function checkUpdate() {
  if (updBusy.value) return
  updState.value = "checking"
  updErr.value = ""
  try {
    const u = await updaterCheck()
    if (!u) {
      updPending = null
      updState.value = "latest"
      return
    }
    updPending = u
    updNewVer.value = u.version
    updNotes.value = (u.body ?? "").trim()
    updState.value = "available"
  } catch (e) {
    const raw = String((e as Error)?.message ?? e)
    const low = raw.toLowerCase()
    // 仓库还没发布过带 latest.json 的 Release 时，插件只会给一句 fetch 错误——换成能看懂的说明
    const noFeed = low.includes("valid release json") || low.includes("404") || low.includes("not found")
    updErr.value = noFeed ? t.value("upd_nofeed") : raw
    updState.value = "error"
  }
}

async function installUpdate() {
  if (!updPending || updBusy.value) return
  updState.value = "downloading"
  updPct.value = 0
  let total = 0
  let got = 0
  try {
    await updPending.downloadAndInstall((ev) => {
      if (ev.event === "Started") total = ev.data.contentLength ?? 0
      else if (ev.event === "Progress") {
        got += ev.data.chunkLength
        if (total > 0) updPct.value = Math.min(100, Math.round((got / total) * 100))
      } else if (ev.event === "Finished") updPct.value = 100
    })
    updState.value = "ready"
  } catch (e) {
    updErr.value = String((e as Error)?.message ?? e)
    updState.value = "error"
  }
}

async function restartForUpdate() {
  try {
    await updaterRelaunch()
  } catch (e) {
    toast(String((e as Error)?.message ?? e), true)
  }
}

const dataRoot = ref("")
const version = ref("")
onMounted(async () => {
  try {
    const info = await call<{ root: string; version: string }>("app_info")
    dataRoot.value = info.root
    version.value = info.version
  } catch {}
  if (!dockApps.value.length) void scanApps(false)
  void loadAutoStart()
  try {
    const st = await invoke<{ config: Record<string, unknown> }>("desktop_state")
    deskCfg.value = mergeConfig(st.config)
  } catch {}
})

// 更改数据目录：选空文件夹 → Rust 拷贝全部数据 → 旧目录改名备份 → 热切换
const migrating = ref(false)
async function changeDataRoot() {
  if (migrating.value) return
  const picked = await openFileDialog({
    multiple: false,
    directory: true,
    title: "选择新的数据目录（必须为空文件夹）",
  })
  if (!picked || typeof picked !== "string") return
  const ok = await askConfirm({
    title: "迁移数据目录",
    message: `将把全部数据迁移到：\n${picked}\n\n原目录会整体备份保留（data-backup-时间戳），不会删除。`,
    okText: "开始迁移",
  })
  if (!ok) return
  migrating.value = true
  try {
    const newRoot = await invoke<string>("data_path_set", { newPath: picked })
    dataRoot.value = newRoot
    toast(`数据目录已迁移：${newRoot}`)
  } catch (e) {
    toast(String((e as Error).message ?? e), true)
  } finally {
    migrating.value = false
  }
}
</script>

<template>
  <div class="settings">
    <div class="pwb-seg mini" style="display: flex; margin-bottom: 14px">
      <button class="pwb-seg-item" :class="{ on: tab === 'appearance' }" @click="tab = 'appearance'">{{ t("set_tab_appearance") }}</button>
      <button class="pwb-seg-item" :class="{ on: tab === 'dock' }" @click="tab = 'dock'">桌面 Dock</button>
      <button class="pwb-seg-item" :class="{ on: tab === 'desktop' }" @click="tab = 'desktop'">桌面卡片</button>
      <button class="pwb-seg-item" :class="{ on: tab === 'guard' }" @click="tab = 'guard'">{{ t("guard_tab") }}</button>
      <button class="pwb-seg-item" :class="{ on: tab === 'about' }" @click="tab = 'about'">{{ t("set_tab_about") }}</button>
    </div>

    <!-- 外观 -->
    <div v-if="tab === 'appearance'">
      <div class="pwb-pop-title">{{ t("appearance") }}</div>
      <div class="pwb-seg mini" style="display: flex; margin: 4px 0 14px">
        <button v-for="[m, label, ic] in [['auto', t('auto'), 'contrast'], ['light', t('light'), 'sun'], ['dark', t('dark'), 'moon']] as const"
          :key="m" style="flex: 1" class="pwb-seg-item" :class="{ on: mode === m }" @click="emit('set-mode', m)">
          <Icon :name="ic" :size="12" /><span>{{ label }}</span>
        </button>
      </div>
      <div class="pwb-pop-title">{{ t("theme_color") }}</div>
      <div class="swatch-row">
        <button class="pwb-swatch" :class="{ on: accent === 'blue' }" @click="emit('set-accent', 'blue')">
          <i style="background: linear-gradient(135deg,#4da3ff,#0053b8)" /><span>{{ t("blue") }}</span>
          <Icon v-if="accent === 'blue'" name="check" :size="13" />
        </button>
        <button class="pwb-swatch" :class="{ on: accent === 'pink' }" @click="emit('set-accent', 'pink')">
          <i style="background: linear-gradient(135deg,#ff8ab5,#cc3572)" /><span>{{ t("pink") }}</span>
          <Icon v-if="accent === 'pink'" name="check" :size="13" />
        </button>
        <button class="pwb-swatch" :class="{ on: accent === 'green' }" @click="emit('set-accent', 'green')">
          <i style="background: linear-gradient(135deg,#5cb96f,#1f7a3d)" /><span>{{ t("green") }}</span>
          <Icon v-if="accent === 'green'" name="check" :size="13" />
        </button>
      </div>
      <div class="pwb-pop-title" style="margin-top: 14px">{{ t("language") }}</div>
      <div class="pwb-seg mini" style="display: flex">
        <button v-for="[l, label] in [['zh', '中文'], ['en', 'English']] as const" :key="l" style="flex: 1"
          class="pwb-seg-item" :class="{ on: lang === l }" @click="emit('set-lang', l as Lang)">{{ label }}</button>
      </div>
    </div>

    <!-- 桌面卡片 -->
    <div v-else-if="tab === 'desktop'">
      <div class="dock-hero">
        <div>
          <div class="dock-hero-title">桌面卡片</div>
          <div class="muted" style="font-size: 11.5px; margin-top: 3px">
            独立小窗口浮在桌面上，可拖动、缩放、磁吸对齐；桌面壳模式下常驻桌面层
          </div>
        </div>
        <ToggleSwitch :model-value="deskCfg.enabled" label="桌面壳模式"
          @update:model-value="setDeskEnabled" />
      </div>
      <div class="muted" style="font-size: 11.5px; margin: -4px 0 10px">
        桌面壳模式开启时主窗口隐藏，桌面只留卡片、Dock 与吉祥物；关闭后回到传统工作台窗口
      </div>

      <div class="desk-row">
        <div class="desk-row-main">
          <div class="desk-row-title">开机自动启动</div>
          <div class="muted" style="font-size: 11.5px; margin-top: 3px">
            登录 Windows 后在后台静默启动（桌面壳模式下不弹工作台窗口）{{ autoStart ? "，当前已加入登录项" : "" }}
          </div>
        </div>
        <ToggleSwitch :model-value="autoStart" label="开机启动" @update:model-value="setAutoStart" />
      </div>

      <div class="dock-row">
        <span class="dock-label">卡片字号</span>
        <input type="range" min="0.8" max="1.6" step="0.05" :value="deskCfg.cardFontScale"
          style="flex: 1; accent-color: var(--pwb-accent)"
          @input="setCardFont(Number(($event.target as HTMLInputElement).value))">
        <span class="muted" style="font-size: 11.5px; width: 52px; text-align: right">×{{ deskCfg.cardFontScale.toFixed(2) }}</span>
      </div>

      <div class="dock-apps-head">
        <span class="dock-label">显示的卡片</span>
      </div>
      <div class="desk-card-grid">
        <button v-for="k in CARD_KEYS" :key="k" class="desk-card-item" :class="{ on: deskCfg.cards[k] }"
          @click="setCard(k, !deskCfg.cards[k])">
          <Icon :name="deskCfg.cards[k] ? 'check' : 'plus'" :size="13" />
          <span>{{ CARD_LABELS[k] }}</span>
        </button>
      </div>
    </div>

    <!-- 安全：模块锁（门禁，不改动文件内容） -->
    <div v-else-if="tab === 'guard'">
      <div class="dock-hero">
        <div>
          <div class="dock-hero-title">{{ t("guard_title") }}</div>
          <div class="muted" style="font-size: 11.5px; margin-top: 3px">{{ t("guard_desc") }}</div>
        </div>
        <span class="guard-state" :class="{ on: guard.enabled }">
          {{ guard.enabled ? t("guard_on") : t("guard_off") }}
        </span>
      </div>

      <template v-if="!guard.enabled">
        <div class="muted" style="font-size: 11.5px; margin: 10px 0">{{ t("guard_no_pw_desc") }}</div>
        <div class="guard-form">
          <input v-model="pwNew" type="password" :placeholder="t('guard_new')" autocomplete="new-password">
          <input v-model="pwConfirm" type="password" :placeholder="t('guard_confirm')" autocomplete="new-password"
            @keydown.enter="saveGuardPassword">
          <button class="primary" :disabled="guardBusy" @click="saveGuardPassword">{{ t("guard_set") }}</button>
        </div>
      </template>

      <template v-else>
        <div class="dock-apps-head"><span class="dock-label">{{ t("guard_modules") }}</span></div>
        <div class="muted" style="font-size: 11.5px; margin: -2px 0 8px">{{ t("guard_modules_desc") }}</div>
        <div class="desk-card-grid">
          <button v-for="m in GUARD_MODULES" :key="m" class="desk-card-item"
            :class="{ on: guard.modules.includes(m) }" @click="toggleGuardModule(m)">
            <Icon :name="guard.modules.includes(m) ? 'check' : 'plus'" :size="13" />
            <span>{{ t(`guard_mod_${m}`) }}</span>
          </button>
        </div>

        <div class="dock-apps-head" style="margin-top: 16px"><span class="dock-label">{{ t("guard_change") }}</span></div>
        <div class="guard-form">
          <input v-model="pwCurrent" type="password" :placeholder="t('guard_current')" autocomplete="current-password">
          <input v-model="pwNew" type="password" :placeholder="t('guard_new')" autocomplete="new-password">
          <input v-model="pwConfirm" type="password" :placeholder="t('guard_confirm')" autocomplete="new-password"
            @keydown.enter="saveGuardPassword">
          <div class="row" style="gap: 8px; margin-top: 2px; flex-wrap: wrap">
            <button class="primary" :disabled="guardBusy" @click="saveGuardPassword">{{ t("save") }}</button>
            <button :disabled="guardBusy" @click="lockAll"><Icon name="lock" :size="12" />{{ t("guard_lock_now") }}</button>
            <button class="ghost mini" :disabled="guardBusy" @click="disableGuard">{{ t("guard_disable") }}</button>
          </div>
        </div>
      </template>

      <div class="muted guard-hint">{{ t("guard_plain_hint") }}</div>
    </div>

    <!-- 桌面 Dock -->
    <div v-else-if="tab === 'dock'">
      <div class="dock-hero">
        <div>
          <div class="dock-hero-title">桌面 Dock</div>
          <div class="muted" style="font-size: 11.5px; margin-top: 3px">
            独立悬浮窗，常驻屏幕边缘；不占任务栏、不打断当前窗口
          </div>
        </div>
        <ToggleSwitch :model-value="dockCfg.enabled" label="启用桌面 Dock"
          @update:model-value="setEnabled" />
      </div>

      <div class="dock-row">
        <span class="dock-label">自动隐藏</span>
        <ToggleSwitch :model-value="dockCfg.autohide" label="自动隐藏"
          @update:model-value="setAutohide" />
        <span class="muted" style="font-size: 11.5px; margin-left: 6px">鼠标移开后收到屏幕边缘</span>
      </div>

      <div class="dock-row">
        <span class="dock-label">替代任务栏</span>
        <ToggleSwitch :model-value="dockCfg.replaceTaskbar" label="隐藏 Windows 任务栏"
          @update:model-value="setReplaceTaskbar" />
        <span class="muted" style="font-size: 11.5px; margin-left: 6px">
          Dock 占用任务栏位置；退出应用或关掉此开关会自动恢复（重启电脑也会恢复）
        </span>
      </div>

      <div class="dock-row">
        <span class="dock-label">位置</span>
        <div class="pwb-seg mini">
          <button v-for="[p, label] in [['bottom', '底部'], ['left', '左侧'], ['right', '右侧']] as const" :key="p"
            class="pwb-seg-item" :class="{ on: dockCfg.position === p }" @click="setPosition(p)">{{ label }}</button>
        </div>
      </div>

      <div class="dock-row">
        <span class="dock-label">图标大小</span>
        <input type="range" min="36" max="58" step="2" :value="dockCfg.size"
          style="flex: 1; accent-color: var(--pwb-accent)"
          @input="setSize(Number(($event.target as HTMLInputElement).value))">
        <span class="muted" style="font-size: 11.5px; width: 52px; text-align: right">{{ dockCfg.size }} px</span>
      </div>

      <div class="dock-apps-head">
        <span class="dock-label">固定应用（{{ selectedCount }}）</span>
        <div class="row" style="gap: 6px">
          <button class="mini ghost" @click="resetPinned">恢复推荐</button>
          <button class="mini" :disabled="scanning" @click="scanApps(true)">
            <Icon name="refresh" :size="12" />{{ scanning ? "扫描中…" : "重新扫描" }}
          </button>
        </div>
      </div>
      <div class="pwb-search" style="margin: 6px 0 8px">
        <Icon name="search" :size="14" />
        <input v-model="dockQuery" placeholder="搜索应用…">
      </div>
      <div class="dock-app-list">
        <button v-for="app in filteredApps" :key="app.id" class="dock-app-item" :class="{ on: pinnedIds.has(app.id) }"
          @click="toggleApp(app)">
          <img v-if="app.icon" class="dock-app-ic" :src="convertFileSrc(app.icon)" alt="">
          <span v-else class="dock-app-ic fallback">{{ app.name.slice(0, 1).toUpperCase() }}</span>
          <span class="dock-app-name">{{ app.name }}</span>
          <span v-if="app.group" class="muted dock-app-group">{{ app.group }}</span>
          <Icon :name="pinnedIds.has(app.id) ? 'check' : 'plus'" :size="13" />
        </button>
        <div v-if="!filteredApps.length" class="muted" style="padding: 10px 2px">
          {{ scanning ? "正在扫描开始菜单…" : "没有匹配的应用" }}
        </div>
      </div>
    </div>

    <!-- 关于 -->
    <div v-else>
      <div class="about-card">
        <div class="about-name">{{ t("app_name") }} <span class="muted">v{{ version }}</span></div>
        <div class="muted" style="margin-top: 6px">{{ t("about_desc") }}</div>
      </div>
      <div class="detail-kv" style="margin-top: 12px">
        <span class="k">{{ t("about_version") }}</span><span class="v">{{ version }}</span>
        <span class="k">{{ t("about_data") }}</span>
        <span class="v" style="word-break: break-all">
          {{ dataRoot }}
          <div class="row" style="gap: 8px; margin-top: 6px">
            <button class="mini" :disabled="migrating" @click="changeDataRoot">
              <Icon name="folder" :size="12" />{{ migrating ? "迁移中…" : "更改数据目录…" }}
            </button>
          </div>
        </span>
      </div>
      <div class="muted" style="margin-top: 8px; font-size: 11.5px">
        更改会把全部数据（待办/导航/速记/密钥/资产/AI 会话）迁移到新目录；原目录整体备份保留，不会删除。
      </div>

      <div class="upd-card">
        <div class="upd-head">
          <div class="upd-title">{{ t("upd_title") }}</div>
          <button class="mini" :disabled="updBusy" @click="checkUpdate">
            <Icon name="refresh" :size="12" />{{ updState === "checking" ? t("upd_checking") : t("upd_check") }}
          </button>
        </div>
        <div class="upd-line">
          <span class="upd-badge" :class="updState">{{ updBadge }}</span>
          <span v-if="updState === 'idle'" class="muted upd-note">{{ t("upd_idle") }}</span>
          <span v-else-if="updState === 'error'" class="upd-note err">{{ updErr }}</span>
        </div>

        <div v-if="updState === 'available'" class="upd-body">
          <div v-if="updNotes" class="upd-notes">{{ updNotes }}</div>
          <button class="primary mini" @click="installUpdate">{{ t("upd_install") }}</button>
        </div>

        <div v-if="updState === 'downloading'" class="upd-bar"><i :style="{ width: updPct + '%' }" /></div>

        <div v-if="updState === 'ready'" class="upd-body">
          <button class="primary mini" @click="restartForUpdate">
            <Icon name="refresh" :size="12" />{{ t("upd_restart") }}
          </button>
        </div>

        <div class="muted upd-hint">{{ t("upd_hint") }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings { padding: 2px; }
.swatch-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.about-card { background: var(--pwb-panel); border-radius: 12px; padding: 14px; }
.desk-row { display: flex; align-items: center; justify-content: space-between; gap: 12px;
  background: var(--pwb-panel); border-radius: 12px; padding: 12px 14px; margin-bottom: 12px; }
.desk-row-main { min-width: 0; }
.desk-row-title { font-size: 13px; font-weight: 600; }
/* 在线更新 */
.upd-card { margin-top: 14px; background: var(--pwb-panel); border-radius: 12px; padding: 12px 14px; }
.upd-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.upd-title { font-size: 13px; font-weight: 600; }
.upd-line { display: flex; align-items: center; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
.upd-badge { font-size: 11.5px; padding: 2px 9px; border-radius: 999px; background: var(--pwb-chip); color: var(--pwb-muted); }
.upd-badge.available,
.upd-badge.ready { background: var(--pwb-tag-bg); color: var(--pwb-accent); font-weight: 600; }
.upd-badge.error { background: var(--pwb-bad-bg); color: var(--pwb-bad-fg); }
.upd-badge.checking,
.upd-badge.downloading { background: var(--pwb-tag-bg); color: var(--pwb-accent); }
.upd-note { font-size: 11.5px; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.upd-note.err { color: var(--pwb-bad-fg); white-space: normal; word-break: break-all; }
.upd-body { margin-top: 10px; display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
.upd-notes { font-size: 11.5px; line-height: 1.7; color: var(--pwb-muted); white-space: pre-wrap;
  max-height: 120px; overflow: auto; width: 100%; }
.upd-bar { margin-top: 10px; height: 4px; border-radius: 999px; background: var(--pwb-chip); overflow: hidden; }
.upd-bar i { display: block; height: 100%; border-radius: 999px; background: var(--pwb-accent); transition: width 0.2s; }
.upd-hint { font-size: 11px; line-height: 1.6; margin-top: 10px; }
.about-name { font-size: 14px; font-weight: 600; }

.dock-hero { display: flex; align-items: center; justify-content: space-between; gap: 12px;
  background: var(--pwb-panel); border-radius: 12px; padding: 12px 14px; margin-bottom: 12px; }
.dock-hero-title { font-size: 13.5px; font-weight: 600; }
.dock-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.dock-label { font-size: 12.5px; color: var(--pwb-muted); min-width: 76px; }
.dock-apps-head { display: flex; align-items: center; justify-content: space-between; margin-top: 16px; }
.dock-app-list { max-height: 250px; overflow: auto; border: 1px solid var(--pwb-border); border-radius: 10px; padding: 4px; }
.dock-app-item { display: flex; align-items: center; gap: 8px; width: 100%; height: auto; padding: 5px 8px;
  border: none; background: transparent; border-radius: 8px; cursor: pointer; text-align: left; }
.dock-app-item:hover { background: var(--pwb-hover); }
.dock-app-item.on { background: var(--pwb-tag-bg); }
.dock-app-ic { width: 22px; height: 22px; border-radius: 6px; object-fit: contain; flex-shrink: 0; }
.dock-app-ic.fallback { display: inline-flex; align-items: center; justify-content: center; background: var(--pwb-chip);
  font-size: 11px; font-weight: 600; color: var(--pwb-muted); }
.dock-app-name { flex: 1; font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dock-app-group { font-size: 11px; max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.desk-card-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 6px; }
.desk-card-item { display: flex; align-items: center; gap: 6px; padding: 7px 10px; border: none;
  background: transparent; border-radius: 8px; cursor: pointer; font-size: 12.5px; color: inherit; text-align: left; }
.desk-card-item:hover { background: var(--pwb-hover); }
.desk-card-item.on { background: var(--pwb-tag-bg); font-weight: 600; }
/* 模块锁 */
.guard-state { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--pwb-chip); color: var(--pwb-muted); }
.guard-state.on { background: var(--pwb-tag-bg); color: var(--pwb-accent); }
.guard-form { display: flex; flex-direction: column; gap: 8px; max-width: 320px; }
.guard-form input { width: 100%; }
.guard-hint { font-size: 11.5px; line-height: 1.65; margin-top: 14px; }

</style>
