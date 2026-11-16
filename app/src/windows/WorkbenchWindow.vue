<script setup lang="ts">
// 全屏工作台（类 macOS 启动台）：独立 OS 窗口，视觉沿用主窗「启动台」的极光玻璃面板。
// 内置功能一屏放下；本机应用分页展示（无滚动条），左右箭头 / 圆点 / 滚轮 / 键盘 ←→ 切换；
// 搜索即时过滤、键盘 ↑↓←→ + Enter 操作、Esc / 点击面板外关闭。
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue"
import { invoke, convertFileSrc } from "@tauri-apps/api/core"
import { BUILTIN_FEATURES, type BuiltinDef } from "../lib/apps"
import { readScanCache, writeScanCache, type DockAppInfo } from "../lib/dock"
import { makeT, type Lang } from "../i18n"
import { createClickSplitter } from "../lib/click"
import Icon from "../components/Icon.vue"

/* ---------- 主题 / 语言（跟随主窗口的 localStorage 设置） ---------- */
const mql = window.matchMedia("(prefers-color-scheme: dark)")
const readTheme = () => {
  let mode = "auto"
  try {
    mode = localStorage.getItem("pwb_theme") ?? "auto"
  } catch {}
  return mode === "dark" || (mode === "auto" && mql.matches)
}
const dark = ref(readTheme())
const applyTheme = () => (dark.value = readTheme())
mql.addEventListener("change", applyTheme)
window.addEventListener("storage", applyTheme)

const readLang = (): Lang => {
  try {
    return localStorage.getItem("pwb_lang") === "en" ? "en" : "zh"
  } catch {
    return "zh"
  }
}
const lang = ref<Lang>(readLang())
const t = computed(() => makeT(lang.value))

/* ---------- 面板尺寸：默认铺满全屏；拖动右下角手柄可缩小，尺寸本地记住 ---------- */
const SIZE_KEY = "pwb_wb_size"
const MIN_W = 640
const MIN_H = 480
const vw = ref(window.innerWidth)
const vh = ref(window.innerHeight)

/** 读取上次调整后的尺寸；无效/超出当前屏幕时按无效处理（回落铺满全屏） */
function readSavedSize(): { w: number; h: number } | null {
  try {
    const raw = localStorage.getItem(SIZE_KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as { w?: unknown; h?: unknown }
    const w = Number(o?.w)
    const h = Number(o?.h)
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < MIN_W || h < MIN_H) return null
    return { w: Math.round(w), h: Math.round(h) }
  } catch {
    return null
  }
}
const custom = ref(readSavedSize())
/** 非全屏（用户调过大小）时面板才带圆角/描边/投影 */
const floating = computed(() => custom.value !== null)
const panelEl = ref<HTMLElement | null>(null)

const panelStyle = computed<Record<string, string> | undefined>(() => {
  const s = custom.value
  if (!s) return undefined
  return {
    width: Math.min(s.w, Math.max(MIN_W, vw.value - 24)) + "px",
    height: Math.min(s.h, Math.max(MIN_H, vh.value - 24)) + "px",
  }
})

const resizing = ref(false)
/** 右下角手柄拖动缩放：面板居中，所以宽高按位移的 2 倍变化 */
function onGripDown(e: PointerEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  e.stopPropagation()
  const el = panelEl.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const sx = e.clientX
  const sy = e.clientY
  const w0 = rect.width
  const h0 = rect.height
  resizing.value = true
  const move = (ev: PointerEvent) => {
    const w = Math.round(Math.min(Math.max(MIN_W, w0 + (ev.clientX - sx) * 2), Math.max(MIN_W, vw.value - 24)))
    const h = Math.round(Math.min(Math.max(MIN_H, h0 + (ev.clientY - sy) * 2), Math.max(MIN_H, vh.value - 24)))
    custom.value = { w, h }
  }
  const up = () => {
    window.removeEventListener("pointermove", move)
    window.removeEventListener("pointerup", up)
    resizing.value = false
    if (custom.value) {
      try {
        localStorage.setItem(SIZE_KEY, JSON.stringify(custom.value))
      } catch {}
    }
    void nextTick(measure)
  }
  window.addEventListener("pointermove", move)
  window.addEventListener("pointerup", up)
}

/** 双击手柄：清掉记忆尺寸，恢复铺满全屏 */
function onGripReset() {
  custom.value = null
  try {
    localStorage.removeItem(SIZE_KEY)
  } catch {}
  void nextTick(measure)
}

/* 双击面板空白 = 全屏 ⇄ 浮动小窗。全屏时手柄在屏幕角上不好抓，这一步就是「一键缩小」的入口。 */
const FLOAT_W = 1080
const FLOAT_H = 760

function togglePanelSize() {
  if (custom.value) {
    // 已经是浮窗 → 回全屏
    custom.value = null
    try {
      localStorage.removeItem(SIZE_KEY)
    } catch {}
  } else {
    // 全屏 → 缩到记忆过的尺寸（没有就给一个舒服的默认值，按屏幕比例夹住）
    const w = Math.round(Math.min(FLOAT_W, Math.max(MIN_W, vw.value - 160)))
    const h = Math.round(Math.min(FLOAT_H, Math.max(MIN_H, vh.value - 140)))
    custom.value = { w, h }
    try {
      localStorage.setItem(SIZE_KEY, JSON.stringify(custom.value))
    } catch {}
  }
  void nextTick(measure)
}

/** 双击面板空白处触发；图标、按钮、输入框、空白以外的交互元素不抢 */
function onPanelDblClick(e: MouseEvent) {
  const el = e.target as HTMLElement
  if (el.closest("button, a, input, textarea, select, .wb-grip, .no-dbl")) return
  togglePanelSize()
}

/* ---------- 数据 ---------- */
const apps = ref<DockAppInfo[]>(readScanCache()) // 先渲染缓存，再后台刷新
const query = ref("")
const busy = ref(false)

async function refreshApps() {
  if (busy.value) return
  busy.value = true
  try {
    const list = await invoke<DockAppInfo[]>("dock_scan")
    apps.value = list
    writeScanCache(list)
  } catch (e) {
    console.warn("dock_scan failed", e)
  } finally {
    busy.value = false
  }
}

/* ---------- 过滤 ---------- */
const kw = computed(() => query.value.trim().toLowerCase())
const featureList = computed(() => {
  const items = [...BUILTIN_FEATURES]
  if (!kw.value) return items
  return items.filter((b) => t.value(b.titleKey).toLowerCase().includes(kw.value))
})
const appList = computed(() => {
  if (!kw.value) return apps.value
  return apps.value.filter(
    (a) => a.name.toLowerCase().includes(kw.value) || (a.group ?? "").toLowerCase().includes(kw.value),
  )
})

const iconSrc = (app: DockAppInfo) => (app.icon ? convertFileSrc(app.icon) : "")
const glossOf = (id: string) => GLOSS[id] ?? GLOSS.pad

const GLOSS: Record<string, string> = {
  // 工作台磁贴比 Dock 上略深一档：面板本身是白色系，太浅会融进背景
  pad: "linear-gradient(160deg,#ffffff 0%,#dce8ff 55%,#b9d3ff 100%)",
  ai: "linear-gradient(150deg,#b79cff,#6d4be0)",
  apps: "linear-gradient(150deg,#7fc0ff,#2f7fdc)",
  todo: "linear-gradient(150deg,#6fe08c,#22a04c)",
  nav: "linear-gradient(150deg,#6ec0f0,#1f7fb8)",
  note: "linear-gradient(150deg,#ffc266,#f08516)",
  keys: "linear-gradient(150deg,#a8abb4,#5b6068)",
  assets: "linear-gradient(150deg,#63d3c2,#159181)",
  settings: "linear-gradient(150deg,#adb4c2,#666e7d)",
}

/* ---------- 分页（应用太多左右切换，不出滚动条） ---------- */
const CELL_W = 96 // 与 .wb-cell 宽一致
const CELL_H = 91 // 图标 56 + 名称 17 + 内边距
const GAP_X = 10
const GAP_Y = 14
const appsEl = ref<HTMLElement | null>(null)
const headEl = ref<HTMLElement | null>(null)
const dotsEl = ref<HTMLElement | null>(null)
const cols = ref(7)
const rows = ref(3)
const page = ref(0)
const perPage = computed(() => Math.max(1, cols.value * rows.value))
const pages = computed(() => {
  const out: DockAppInfo[][] = []
  for (let i = 0; i < appList.value.length; i += perPage.value) {
    out.push(appList.value.slice(i, i + perPage.value))
  }
  return out
})
/** 分页容器高度：按实际需要的行数收（内容少时不空出一大块），仍显式固定避免量测震荡 */
const pagesH = computed(() => {
  const perRow = Math.max(1, cols.value)
  const need = pages.value.reduce((m, p) => Math.max(m, Math.ceil(p.length / perRow)), 1)
  const r = Math.max(1, Math.min(rows.value, need))
  return r * CELL_H + (r - 1) * GAP_Y
})

/**
 * 实测容量（列数/行数）：量「应用区」整块（高度由面板 flex 决定，不受内容影响），
 * 再扣掉小标题与圆点占位——这样分页块可以按内容高度居中，不会互相牵着震荡。
 */
function measure() {
  const el = appsEl.value
  if (!el) return
  const headH = headEl.value?.offsetHeight ?? 30
  const dotsH = dotsEl.value?.offsetHeight ?? 22
  const avail = Math.max(CELL_H, el.clientHeight - headH - dotsH)
  cols.value = Math.max(4, Math.floor((el.clientWidth + GAP_X) / (CELL_W + GAP_X)))
  rows.value = Math.max(1, Math.floor((avail + GAP_Y) / (CELL_H + GAP_Y)))
}
watch([featureList, appList], () => {
  page.value = 0
  void nextTick(measure)
})
watch(pages, () => {
  if (page.value >= pages.value.length) page.value = Math.max(0, pages.value.length - 1)
})
function goPage(p: number) {
  page.value = Math.min(Math.max(0, p), Math.max(0, pages.value.length - 1))
}
function onWheel(e: WheelEvent) {
  if (pages.value.length <= 1) return
  const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
  if (d > 0) goPage(page.value + 1)
  else if (d < 0) goPage(page.value - 1)
}

/* ---------- 操作 ---------- */
async function openFeature(b: BuiltinDef, maximized = false) {
  if (b.id === "pad") {
    await close()
    return // 工作台自己：仅关闭
  }
  // 先开功能窗口再关自己：本窗关闭后 WebView 销毁，就发不出后续 IPC 了
  await invoke("pane_open", { id: b.id, width: b.w, height: b.h, maximized }).catch((e) => console.warn(e))
  close()
}

async function openApp(app: DockAppInfo, maximized = false) {
  await invoke("dock_toggle", { path: app.path, maximized }).catch((e) => console.warn(e))
  close()
}

/** 单击 = 打开（关面板）；双击 = 全屏打开。单击延后 220ms，等双击判定，避免「先开小窗再最大化」 */
const clickSplit = createClickSplitter()

async function close() {
  await invoke("workbench_close").catch(() => {})
}

/* ---------- 键盘导航（扁平序 = 内置功能 + 本机应用；应用区跨页时自动翻页） ---------- */
const searchEl = ref<HTMLInputElement | null>(null)
const sel = ref(-1)
const flat = computed(() => [
  ...featureList.value.map((b) => ({ kind: "feature" as const, b })),
  ...appList.value.map((a) => ({ kind: "app" as const, a })),
])
watch(flat, () => {
  sel.value = flat.value.length ? 0 : -1
})

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    void close()
    return
  }
  const n = flat.value.length
  if (!n) return
  let i = sel.value
  if (e.key === "ArrowRight") i = Math.min(n - 1, Math.max(0, i) + 1)
  else if (e.key === "ArrowLeft") i = Math.max(0, (i < 0 ? 0 : i) - 1)
  else if (e.key === "ArrowDown") i = Math.min(n - 1, (i < 0 ? 0 : i) + cols.value)
  else if (e.key === "ArrowUp") i = Math.max(0, (i < 0 ? 0 : i) - cols.value)
  else if (e.key === "Enter") {
    const item = flat.value[Math.max(0, i)]
    if (item) item.kind === "feature" ? void openFeature(item.b) : void openApp(item.a)
    return
  } else return
  e.preventDefault()
  sel.value = i
}

// 选中项落在应用区某页时自动翻过去
watch(sel, (i) => {
  const n = featureList.value.length
  if (i >= n && i - n < appList.value.length) {
    const p = Math.floor((i - n) / perPage.value)
    if (p < pages.value.length) page.value = p
  }
})

function isSelected(flatIdx: number) {
  return sel.value === flatIdx
}

let onResize: (() => void) | null = null
let ro: ResizeObserver | null = null
onMounted(async () => {
  window.addEventListener("keydown", onKey)
  onResize = () => {
    vw.value = window.innerWidth
    vh.value = window.innerHeight
    measure()
  }
  window.addEventListener("resize", onResize)
  // 面板被手柄改尺寸时窗口尺寸不变，靠 ResizeObserver 重新量容量
  ro = new ResizeObserver(() => measure())
  if (panelEl.value) ro.observe(panelEl.value)
  void refreshApps()
  searchEl.value?.focus()
  await nextTick(measure)
})
onUnmounted(() => {
  window.removeEventListener("keydown", onKey)
  if (onResize) window.removeEventListener("resize", onResize)
  ro?.disconnect()
  ro = null
  mql.removeEventListener("change", applyTheme)
  window.removeEventListener("storage", applyTheme)
  clickSplit.dispose()
})
</script>

<template>
  <div class="wb-bg" :class="[dark ? 'wb-dark' : 'wb-light']" @mousedown.self="close">
    <div ref="panelEl" class="wb-panel" :class="{ floating, resizing }" :style="panelStyle"
      @dblclick="onPanelDblClick">
      <div class="wb-aura" aria-hidden="true" />

      <!-- 关闭：面板铺满屏幕后没有「外面」可点，这里给一个明确的出口（悬停显形） -->
      <button class="wb-close" :title="t('win_close')" @click.stop="close"><Icon name="x" :size="13" /></button>

      <!-- 搜索 -->
      <div class="wb-search-row">
        <span class="wb-search-ic"><Icon name="search" :size="15" /></span>
        <input ref="searchEl" v-model="query" class="wb-search" type="text" :placeholder="t('wb_search_ph')"
          spellcheck="false" autocomplete="off" />
      </div>

      <!-- 内置功能：一屏放下（wrap 居中） -->
      <section v-if="featureList.length">
        <h3 class="wb-sec">{{ t("wb_features") }}</h3>
        <div class="wb-feat-grid">
          <button v-for="(b, i) in featureList" :key="'f-' + b.id" class="wb-cell"
            :class="{ sel: isSelected(i) }"
            @click="clickSplit.single(() => openFeature(b))"
            @dblclick.stop="clickSplit.double(() => openFeature(b, true))">
            <span class="wb-ic" :class="{ 'pad-ic': b.id === 'pad' }" :style="{ background: glossOf(b.id) }">
              <Icon :name="b.icon" :size="26" />
            </span>
            <span class="wb-name">{{ t(b.titleKey) }}</span>
          </button>
        </div>
      </section>

      <!-- 本机应用：分页（无滚动条），左右箭头 / 圆点 / 滚轮 / 键盘切换 -->
      <section v-if="appList.length" ref="appsEl" class="wb-apps">
        <h3 ref="headEl" class="wb-sec">{{ t("wb_local_apps") }} · {{ appList.length }}</h3>
        <div class="wb-body" @wheel.prevent="onWheel">
          <button v-if="pages.length > 1 && page > 0" class="wb-arrow" @click="goPage(page - 1)">
            <Icon name="chevronLeft" :size="16" />
          </button>
          <button v-if="pages.length > 1 && page < pages.length - 1" class="wb-arrow right" @click="goPage(page + 1)">
            <Icon name="chevronRight" :size="16" />
          </button>
          <div class="wb-pages" :style="{ height: pagesH + 'px' }">
            <div class="wb-track" :style="{ transform: 'translateX(-' + page * 100 + '%)' }">
              <div v-for="(pg, pi) in pages" :key="pi" class="wb-page">
                <div class="wb-grid">
                  <button v-for="(a, ci) in pg" :key="'a-' + a.id" class="wb-cell"
                    :class="{ sel: isSelected(featureList.length + pi * perPage + ci) }"
                    @click="clickSplit.single(() => openApp(a))"
                    @dblclick.stop="clickSplit.double(() => openApp(a, true))">
                    <span class="wb-ic">
                      <img v-if="iconSrc(a)" :src="iconSrc(a)" :alt="a.name" draggable="false" />
                      <span v-else class="wb-fallback">{{ a.name.slice(0, 1).toUpperCase() }}</span>
                    </span>
                    <span class="wb-name">{{ a.name }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="pages.length > 1" ref="dotsEl" class="wb-dots">
          <button v-for="i in pages.length" :key="i" class="wb-dot" :class="{ on: page === i - 1 }"
            @click="goPage(i - 1)" />
        </div>
      </section>

      <div v-if="!flat.length" class="wb-empty">{{ t("wb_empty") }}</div>
      <div class="wb-tip">{{ t("wb_tip") }}</div>

      <!-- 缩放：拖动改面板大小并记住；双击恢复铺满全屏 -->
      <span class="wb-grip" :title="t('wb_resize_tip')" @pointerdown="onGripDown" @dblclick.stop="onGripReset" />
    </div>
  </div>
</template>

<style scoped>
/* 全屏遮罩（同主窗启动台的 pad-bg） */
.wb-bg { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(22, 28, 40, .26);
  backdrop-filter: blur(18px) saturate(1.2); -webkit-backdrop-filter: blur(18px) saturate(1.2);
  animation: pwbFade .16s ease; user-select: none; }
.wb-dark.wb-bg { background: rgba(8, 12, 20, .45); }

/* 极光玻璃面板：默认铺满整屏（类 macOS 启动台）；调过尺寸后变成带圆角的浮动面板 */
.wb-panel { position: relative; isolation: isolate; box-sizing: border-box;
  width: 100%; height: 100%;
  padding: 26px 38px 14px; border-radius: 0; overflow: hidden;
  display: flex; flex-direction: column;
  background: linear-gradient(170deg, #ffffff 0%, #f4f9ff 52%, #e7f1ff 100%);
  border: 1px solid transparent; box-shadow: none;
  animation: pwbPop .2s cubic-bezier(.32, .72, .35, 1); }
.wb-panel.floating { border-radius: 24px;
  border-color: rgba(255, 255, 255, .9);
  box-shadow: 0 26px 70px rgba(20, 40, 70, .3), inset 0 1px 1px rgba(255, 255, 255, .95); }
.wb-panel.resizing { user-select: none; }
.wb-aura { position: absolute; inset: 0; z-index: -1;
  background:
    radial-gradient(58% 44% at 14% 0%, rgba(255, 186, 216, .55), transparent 70%),
    radial-gradient(56% 42% at 88% 2%, rgba(150, 197, 255, .6), transparent 72%),
    radial-gradient(92% 54% at 50% 114%, rgba(120, 180, 255, .62), transparent 70%); }
.wb-dark .wb-panel { background: linear-gradient(170deg, #232830 0%, #1b2028 52%, #151a21 100%); }
.wb-dark .wb-panel.floating { border-color: rgba(255, 255, 255, .08); box-shadow: 0 26px 70px rgba(0, 0, 0, .55); }
.wb-dark .wb-aura { background:
  radial-gradient(58% 44% at 14% 0%, rgba(120, 80, 160, .5), transparent 70%),
  radial-gradient(56% 42% at 88% 2%, rgba(50, 110, 180, .55), transparent 72%),
  radial-gradient(92% 54% at 50% 114%, rgba(40, 100, 170, .5), transparent 70%); }

/* 搜索（融入面板：描边区分白色底） */
.wb-search-row { flex: none; display: flex; align-items: center; gap: 8px; width: 420px; max-width: 88%;
  margin: 0 auto 18px; padding: 0 14px; height: 40px; border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, .09); background: rgba(255, 255, 255, .8); }
.wb-dark .wb-search-row { border-color: rgba(255, 255, 255, .12); background: rgba(255, 255, 255, .08); }
.wb-search-ic { display: flex; color: rgba(0, 0, 0, .4); }
.wb-dark .wb-search-ic { color: rgba(255, 255, 255, .45); }
.wb-search { flex: 1; border: none; outline: none; background: transparent; font-size: 14px; color: #1d1d1f; }
.wb-search::placeholder { color: rgba(0, 0, 0, .35); }
.wb-dark .wb-search { color: #eef1f6; }
.wb-dark .wb-search::placeholder { color: rgba(255, 255, 255, .38); }

.wb-sec { flex: none; margin: 2px 0 10px; font-size: 12px; font-weight: 600; letter-spacing: .4px;
  color: rgba(0, 0, 0, .42); text-align: center; }
.wb-dark .wb-sec { color: rgba(255, 255, 255, .42); }

/* 内置功能：wrap 居中，一屏放下 */
.wb-feat-grid { flex: none; display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 10px; }

/* 应用分页区：占满剩余高度并把「标题 + 图标 + 圆点」整块垂直居中 */
.wb-apps { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column;
  justify-content: center; margin-top: 6px; }
.wb-body { position: relative; flex: 0 0 auto; }
.wb-pages { overflow: hidden; width: 100%; }
.wb-track { display: flex; height: 100%; transition: transform .26s cubic-bezier(.32, .72, .35, 1); }
.wb-page { flex: none; width: 100%; }

.wb-grid { display: flex; flex-wrap: wrap; justify-content: center; align-content: flex-start;
  gap: 14px 10px; }

.wb-cell { display: flex; flex-direction: column; align-items: center; gap: 8px;
  width: 96px; height: auto; padding: 5px 2px; border: none; border-radius: 14px; background: transparent;
  cursor: pointer; transition: background .15s; }
.wb-cell:hover, .wb-cell.sel { background: rgba(255, 255, 255, .55); }
.wb-dark .wb-cell:hover, .wb-dark .wb-cell.sel { background: rgba(255, 255, 255, .08); }

.wb-ic { width: 56px; height: 56px; border-radius: 16px; display: inline-flex; align-items: center;
  justify-content: center; color: #fff; overflow: hidden; flex: none;
  box-shadow: 0 6px 16px rgba(30, 55, 90, .22), inset 0 1px 1px rgba(255, 255, 255, .45);
  transition: transform .16s cubic-bezier(.32, .72, .35, 1), box-shadow .16s; }
.wb-cell:hover .wb-ic, .wb-cell.sel .wb-ic {
  transform: translateY(-3px) scale(1.05);
  box-shadow: 0 12px 24px rgba(30, 55, 90, .28), inset 0 1px 1px rgba(255, 255, 255, .55); }
/* 工作台磁贴：浅色玻璃底上图标用深色 */
.wb-ic.pad-ic { color: #54688f;
  box-shadow: 0 6px 16px rgba(60, 90, 150, .24), inset 0 1px 1px rgba(255, 255, 255, .95); }
.wb-ic img { width: 50px; height: 50px; object-fit: contain; }
.wb-fallback { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
  border-radius: 16px; background: linear-gradient(135deg, #4a90e2, #2563c9);
  color: #fff; font-weight: 700; font-size: 22px; }

.wb-name { max-width: 92px; font-size: 12px; font-weight: 600; color: #1d1d1f;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wb-dark .wb-name { color: #eef1f6; }

/* 左右翻页箭头 */
.wb-arrow { position: absolute; top: 50%; transform: translateY(-50%); z-index: 3;
  width: 34px; height: 34px; border: none; border-radius: 50%; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  left: -6px; background: rgba(255, 255, 255, .9); color: #54688f;
  box-shadow: 0 4px 14px rgba(30, 55, 90, .25); transition: background .15s, transform .15s; }
.wb-arrow.right { left: auto; right: -6px; }
.wb-arrow:hover { background: #fff; transform: translateY(-50%) scale(1.08); }
.wb-dark .wb-arrow { background: rgba(58, 66, 82, .92); color: #cfe0ff; }
.wb-dark .wb-arrow:hover { background: rgba(78, 88, 108, .95); }

/* 圆点指示器 */
.wb-dots { flex: none; display: flex; align-items: center; justify-content: center; gap: 7px;
  height: 20px; margin-top: 2px; }
.wb-dot { width: 7px; height: 7px; padding: 0; border: none; border-radius: 50%; cursor: pointer;
  background: rgba(0, 0, 0, .16); transition: background .15s, transform .15s; }
.wb-dot.on { background: #2f7fdc; transform: scale(1.25); }
.wb-dark .wb-dot { background: rgba(255, 255, 255, .22); }
.wb-dark .wb-dot.on { background: #9cc3ff; }

.wb-empty { flex: 1; display: flex; align-items: center; justify-content: center;
  font-size: 13px; color: rgba(0, 0, 0, .4); }
.wb-dark .wb-empty { color: rgba(255, 255, 255, .4); }

.wb-tip { flex: none; height: 26px; display: flex; align-items: center; justify-content: center;
  font-size: 11px; color: rgba(29, 29, 31, .42); }
.wb-dark .wb-tip { color: rgba(238, 241, 246, .42); }

/* 关闭按钮：右上角，面板悬停时显形（全屏态没有「点外面关闭」可用） */
.wb-close { position: absolute; top: 12px; right: 14px; z-index: 7; width: 26px; height: 26px; padding: 0;
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
  border: none; border-radius: 50%; color: #54688f; background: rgba(255, 255, 255, .72);
  box-shadow: 0 3px 10px rgba(30, 55, 90, .16); opacity: 0; transition: opacity .15s, background .15s; }
.wb-panel:hover .wb-close { opacity: .92; }
.wb-close:hover { opacity: 1; background: #fff; }
.wb-dark .wb-close { background: rgba(58, 66, 82, .92); color: #cfe0ff; }
.wb-dark .wb-close:hover { background: rgba(78, 88, 108, .96); }

/* 缩放柄：面板右下角，悬停可见；拖动改大小，双击回到铺满全屏 */
.wb-grip { position: absolute; right: 10px; bottom: 8px; z-index: 6; width: 20px; height: 20px;
  cursor: nwse-resize; opacity: 0; transition: opacity .15s; }
.wb-panel:hover .wb-grip { opacity: .6; }
.wb-grip:hover { opacity: 1; }
.wb-grip::after { content: ""; position: absolute; right: 5px; bottom: 5px; width: 9px; height: 9px;
  border-right: 2px solid rgba(0, 0, 0, .32); border-bottom: 2px solid rgba(0, 0, 0, .32);
  border-bottom-right-radius: 3px; }
.wb-dark .wb-grip::after { border-color: rgba(255, 255, 255, .42); }
</style>
