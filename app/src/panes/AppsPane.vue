<script setup lang="ts">
// 应用启动器（启动台样式）：搜索条 + 日期时钟 + 分类 chips + 图标网格（分页）+ 底部 dock。
// 功能与数据完全沿用：apps_list / apps_set_dir / apps_launch / apps_set_pinned，
// 目录配置、刷新、置顶、搜索、启动一个都没少，只是换了壳。
import { computed, inject, nextTick, onMounted, onUnmounted, ref, watch, type ComputedRef } from "vue"
import { invoke } from "@tauri-apps/api/core"
import { convertFileSrc } from "@tauri-apps/api/core"
import { open as openFileDialog } from "@tauri-apps/plugin-dialog"
import { toast } from "../lib/ui"
import type { Lang, T } from "../i18n"
import Icon from "../components/Icon.vue"

interface AppEntry {
  file: string
  name: string
  ext: string
  icon?: string | null
}
interface Payload {
  dir: string | null
  dirExists: boolean
  apps: AppEntry[]
  pinned: string[]
}

const t = inject<ComputedRef<T>>("t")!
const lang = inject<ComputedRef<Lang>>("lang")!
const data = ref<Payload | null>(null)
const q = ref("")
const busy = ref("")
const filter = ref("all")

async function load() {
  try {
    data.value = await invoke<Payload>("apps_list")
  } catch (e) {
    toast(String((e as Error).message ?? e), true)
  }
}
onMounted(load)

/* ---------- 时钟 ---------- */
const now = ref(new Date())
const p2 = (n: number) => String(n).padStart(2, "0")
const hh = computed(() => p2(now.value.getHours()))
const mm = computed(() => p2(now.value.getMinutes()))
const ss = computed(() => p2(now.value.getSeconds()))
const dateLine = computed(() =>
  now.value.toLocaleDateString(lang.value === "en" ? "en-US" : "zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }),
)

/* ---------- 分组 / 过滤 ---------- */
const EXT_ORDER = ["lnk", "url", "exe", "app"]
const pinnedSet = computed(() => new Set(data.value?.pinned ?? []))
const isPinned = (a: AppEntry) => pinnedSet.value.has(a.file)

const chips = computed(() => {
  const apps = data.value?.apps ?? []
  const out: { key: string; label: string; n: number }[] = [{ key: "all", label: t.value("lp_all"), n: apps.length }]
  const counts = new Map<string, number>()
  for (const a of apps) counts.set(a.ext, (counts.get(a.ext) ?? 0) + 1)
  for (const e of EXT_ORDER) {
    const n = counts.get(e)
    if (n) out.push({ key: e, label: e.toUpperCase(), n })
  }
  return out
})

const kw = computed(() => q.value.trim().toLowerCase())
const matchesFilter = (a: AppEntry) => filter.value === "all" || a.ext === filter.value
const matchesQuery = (a: AppEntry) => !kw.value || a.name.toLowerCase().includes(kw.value)

/** 置顶单独成区：按置顶顺序，最多占 2 排（多出来的落到下面网格里，不丢） */
const pinnedList = computed(() => {
  const byFile = new Map((data.value?.apps ?? []).map((a) => [a.file, a]))
  return (data.value?.pinned ?? [])
    .map((f) => byFile.get(f))
    .filter((a): a is AppEntry => Boolean(a) && matchesQuery(a!) && matchesFilter(a!))
})

/** 其余应用：保持目录顺序（含超出置顶排数的置顶项，仍排在最前，不丢数据） */
const restItems = computed(() => {
  const pin = pinnedSet.value
  const rest = (data.value?.apps ?? []).filter((a) => !pin.has(a.file) && matchesQuery(a) && matchesFilter(a))
  const overflow = pinnedList.value.slice(pinnedCap.value)
  return [...overflow, ...rest]
})

/* ---------- 分页：按容器实测列/行数 ---------- */
const rootEl = ref<HTMLElement | null>(null)
const stageEl = ref<HTMLElement | null>(null)
const cols = ref(6)
const rows = ref(3)
const paneH = ref(600)
const page = ref(0)
const CELL_W = 92
const CELL_H = 92
const GAP_X = 10
const GAP_Y = 14

function measure() {
  if (rootEl.value) paneH.value = rootEl.value.clientHeight
  const el = stageEl.value
  if (!el) return
  cols.value = Math.max(1, Math.floor((el.clientWidth + GAP_X) / (CELL_W + GAP_X)))
  rows.value = Math.max(1, Math.floor((el.clientHeight + GAP_Y) / (CELL_H + GAP_Y)))
}
let ro: ResizeObserver | null = null
function observe() {
  ro?.disconnect()
  const el = stageEl.value
  if (!el) return
  ro = new ResizeObserver(() => measure())
  ro.observe(el)
  if (rootEl.value) ro.observe(rootEl.value)
  measure()
}
watch([stageEl, rootEl], () => observe())

/**
 * 置顶占几排：窗口高时给 2 排，矮时只给 1 排（多出来的回到主网格，仍带星标）。
 * 只按整窗高度判断，不看网格实测行数，避免「置顶挤网格 → 行数变小 → 又减少置顶」的循环抖动。
 */
const pinnedRowsCap = computed(() => (paneH.value >= 510 ? 2 : 1))
const pinnedCap = computed(() => Math.max(1, cols.value) * pinnedRowsCap.value)

const perPage = computed(() => Math.max(1, cols.value * rows.value))
const pages = computed(() => Math.max(1, Math.ceil(restItems.value.length / perPage.value)))
const pageItems = computed(() => restItems.value.slice(page.value * perPage.value, (page.value + 1) * perPage.value))
const pinnedShown = computed(() => pinnedList.value.slice(0, pinnedCap.value))
watch([perPage, restItems, filter], () => {
  page.value = Math.min(page.value, pages.value - 1)
})
function goPage(p: number) {
  page.value = Math.min(Math.max(0, p), pages.value - 1)
}
function onWheel(e: WheelEvent) {
  if (pages.value <= 1) return
  goPage(page.value + (e.deltaY > 0 ? 1 : -1))
}

/* ---------- 目录 / 启动 / 置顶 ---------- */
async function pickDir() {
  const picked = await openFileDialog({ directory: true, multiple: false, title: t.value("set_folder") })
  if (!picked || typeof picked !== "string") return
  try {
    await invoke("apps_set_dir", { dir: picked })
    await load()
    toast(t.value("dir_updated"))
  } catch (e) {
    toast(String((e as Error).message ?? e), true)
  }
}

async function clearDir() {
  try {
    await invoke("apps_set_dir", { dir: "" })
    await load()
  } catch (e) {
    toast(String((e as Error).message ?? e), true)
  }
}

async function openFolder() {
  try {
    await invoke("apps_open_folder")
  } catch (e) {
    toast(String((e as Error).message ?? e), true)
  }
}

async function launch(a: AppEntry) {
  if (busy.value) return
  busy.value = a.file
  try {
    await invoke("apps_launch", { file: a.file })
    toast(t.value("launched", { name: a.name }))
  } catch (e) {
    toast(String((e as Error).message ?? e), true)
  } finally {
    busy.value = ""
  }
}

async function togglePin(a: AppEntry) {
  const current = data.value?.pinned ?? []
  const next = current.includes(a.file) ? current.filter((f) => f !== a.file) : [...current, a.file]
  try {
    await invoke("apps_set_pinned", { pinned: next })
    await load()
  } catch (e) {
    toast(String((e as Error).message ?? e), true)
  }
}

const letter = (name: string) => (name.trim()[0] ?? "?").toUpperCase()
const iconOf = (a: AppEntry) => (a.icon ? convertFileSrc(a.icon) : "")

/* ---------- 生命周期 ---------- */
let timer: number | null = null
// 首次挂载时容器可能还没拿到最终尺寸（窗口刚建/字体未就绪），补两帧复测，避免少算一排一列
function remeasure() {
  void nextTick(() => {
    measure()
    requestAnimationFrame(() => measure())
  })
}
onMounted(() => {
  timer = window.setInterval(() => (now.value = new Date()), 1000)
  remeasure()
  window.addEventListener("resize", measure)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
  window.removeEventListener("resize", measure)
  ro?.disconnect()
})
watch(data, remeasure)
</script>

<template>
  <div ref="rootEl" class="lp">
    <div class="lp-aura" aria-hidden="true" />

    <div v-if="!data" class="lp-boot">…</div>

    <template v-else>
      <!-- 搜索（居中）+ 时间（右上角） -->
      <header class="lp-top">
        <span />
        <div class="lp-search">
          <Icon name="search" :size="15" />
          <input v-model="q" :placeholder="t('search_apps', { n: data.apps.length })">
          <button v-if="q" class="lp-clear" @click="q = ''"><Icon name="x" :size="11" /></button>
          <span v-else class="lp-count">{{ data.apps.length }}</span>
        </div>
        <div class="lp-clock" :title="dateLine">
          <span class="lp-date">{{ dateLine }}</span>
          <span class="lp-time">{{ hh }}<i>:</i>{{ mm }}<i>:</i>{{ ss }}</span>
        </div>
      </header>

      <!-- 置顶：单独 1–2 排，紧贴搜索下方 -->
      <div v-if="data.dir && pinnedShown.length" class="lp-pinned">
        <div class="lp-grid" :style="{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }">
          <button v-for="a in pinnedShown" :key="'pin-' + a.file" class="lp-app" :title="t('card_title', { file: a.file })"
            :disabled="busy === a.file" @click="launch(a)">
            <span class="lp-tile">
              <img v-if="iconOf(a)" :src="iconOf(a)" alt="" draggable="false"
                @error="($event.target as HTMLImageElement).style.visibility = 'hidden'">
              <span v-else class="lp-letter">{{ letter(a.name) }}</span>
              <span class="lp-pin on" :title="t('unpin_title')" @click.stop="togglePin(a)">
                <Icon name="star" :size="9" filled />
              </span>
            </span>
            <span class="lp-name">{{ a.name }}</span>
          </button>
        </div>
        <div class="lp-hair" />
      </div>

      <!-- 分类 -->
      <div v-if="data.dir" class="lp-chips">
        <button v-for="c in chips" :key="c.key" class="lp-chip" :class="{ on: filter === c.key }" @click="filter = c.key">
          {{ c.label }}<b>{{ c.n }}</b>
        </button>
        <button class="lp-chip plus" :title="t('set_folder')" @click="pickDir"><Icon name="plus" :size="12" /></button>
      </div>

      <div v-if="data.dir && !data.dirExists" class="lp-warn">
        <Icon name="alert" :size="12" /><span>{{ t("dir_missing", { dir: data.dir }) }}</span>
      </div>

      <!-- 未配置目录 -->
      <div v-if="!data.dir" class="lp-empty">
        <div class="lp-empty-ic"><Icon name="folder" :size="26" /></div>
        <div class="lp-empty-t">{{ t("dir_unset") }}</div>
        <button class="primary" @click="pickDir"><Icon name="plus" :size="13" />{{ t("set_folder") }}</button>
      </div>

      <!-- 图标网格 -->
      <div v-else ref="stageEl" class="lp-stage" @wheel.prevent="onWheel">
        <div v-if="pageItems.length" class="lp-grid" :style="{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }">
          <button v-for="a in pageItems" :key="a.file" class="lp-app" :title="t('card_title', { file: a.file })"
            :disabled="busy === a.file" @click="launch(a)">
            <span class="lp-tile">
              <img v-if="iconOf(a)" :src="iconOf(a)" alt="" draggable="false"
                @error="($event.target as HTMLImageElement).style.visibility = 'hidden'">
              <span v-else class="lp-letter">{{ letter(a.name) }}</span>
              <span class="lp-pin" :class="{ on: isPinned(a) }" :title="isPinned(a) ? t('unpin_title') : t('pin_title')"
                @click.stop="togglePin(a)"><Icon name="star" :size="9" :filled="isPinned(a)" /></span>
            </span>
            <span class="lp-name">{{ a.name }}</span>
          </button>
        </div>
        <div v-else class="lp-empty">
          <div class="lp-empty-ic"><Icon :name="kw ? 'search' : 'folder'" :size="24" /></div>
          <div class="lp-empty-t">{{ kw ? t("no_match", { q }) : t("empty_apps") }}</div>
        </div>
      </div>

      <!-- 分页点：容器常驻占位，避免「有点/无点」改变网格高度导致行数震荡 -->
      <div v-if="data.dir" class="lp-dots">
        <template v-if="pages > 1">
          <button v-for="p in pages" :key="p" class="lp-dot" :class="{ on: p - 1 === page }" @click="goPage(p - 1)" />
        </template>
      </div>

      <!-- 底部 dock -->
      <footer class="lp-dock">
        <button class="dk" :disabled="!data.dir || !data.dirExists" :title="t('open_folder')" @click="openFolder">
          <Icon name="folder" :size="15" />
        </button>
        <button class="dk" :title="t('refresh')" @click="load"><Icon name="refresh" :size="15" /></button>
        <button class="dk" :title="t('set_folder')" @click="pickDir"><Icon name="settings" :size="15" /></button>
        <button v-if="data.dir" class="dk del" :title="t('del')" @click="clearDir"><Icon name="x" :size="15" /></button>
        <span class="dk-sep" />
        <span class="lp-dir" :title="data.dir || t('dir_unset')">{{ data.dir || t("lp_no_dir") }}</span>
      </footer>
    </template>
  </div>
</template>

<style scoped>
/* ---------- 底：极光玻璃 ---------- */
.lp {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 420px;
  padding: 14px 16px 12px;
  border-radius: 16px;
  overflow: hidden;
  background: linear-gradient(180deg, #ffffff 0%, #f4f9ff 46%, #e6f1ff 100%);
  border: 1px solid rgba(255, 255, 255, 0.9);
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.9), 0 1px 2px rgba(40, 70, 110, 0.05);
  isolation: isolate;
}
.lp-aura {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(58% 42% at 16% 2%, rgba(255, 186, 216, 0.55), transparent 70%),
    radial-gradient(56% 40% at 88% 4%, rgba(150, 197, 255, 0.6), transparent 72%),
    radial-gradient(90% 52% at 50% 112%, rgba(120, 180, 255, 0.65), transparent 70%);
}
.lp > :not(.lp-aura) {
  position: relative;
  z-index: 1;
}

/* ---------- 顶部：搜索居中 + 时间右上 ---------- */
.lp-top { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 10px; }
.lp-search {
  justify-self: center;
  width: 100%;
  max-width: 400px;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.85);
  box-shadow: 0 2px 8px rgba(50, 80, 120, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(18px) saturate(1.6);
  -webkit-backdrop-filter: blur(18px) saturate(1.6);
  color: var(--pwb-muted);
}
.lp-search input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: none;
  outline: none;
  background: transparent;
  font: inherit;
  font-size: 12.5px;
  color: var(--pwb-text);
}
.lp-search input::placeholder { color: var(--pwb-faint); }
.lp-clear, .lp-count {
  flex-shrink: 0;
  border: none;
  background: transparent;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--pwb-faint);
  padding: 2px 4px;
  border-radius: 6px;
}
.lp-clear { cursor: pointer; display: inline-flex; }
.lp-clear:hover { background: rgba(0, 0, 0, 0.06); }

/* ---------- 时钟（右上角，无底板：日期小字 + 大号时间） ---------- */
.lp-clock {
  justify-self: end;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0;
  min-width: 0;
  max-width: 100%;
  padding: 0 4px 0 0;
  background: none;
  border: none;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
.lp-date {
  max-width: 100%;
  font-size: 11px;
  line-height: 1.3;
  color: var(--pwb-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.6);
}
.lp-time {
  display: flex;
  align-items: baseline;
  gap: 2px;
  font-size: 28px;
  line-height: 1.05;
  font-weight: 300;
  letter-spacing: 0.5px;
  font-variant-numeric: tabular-nums;
  color: var(--pwb-text);
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.55);
}
.lp-time i { font-style: normal; font-weight: 200; opacity: 0.35; transform: translateY(-1px); }

/* 窄窗口：先缩小时间，再收掉日期，避免和居中搜索条撞在一起 */
@media (max-width: 620px) {
  .lp-time { font-size: 22px; }
}
@media (max-width: 520px) {
  .lp-date { display: none; }
  .lp-time { font-size: 17px; letter-spacing: 0.2px; }
}

/* ---------- 置顶区（1–2 排，独立于分页） ---------- */
.lp-pinned { margin-top: 9px; }
/* 置顶用紧凑尺寸：占 1–2 排但不挤掉主网格的可视行数 */
.lp-pinned .lp-grid { gap: 6px 10px; }
.lp-pinned .lp-app { gap: 5px; padding: 3px 2px 1px; }
.lp-pinned .lp-tile { width: 46px; height: 46px; border-radius: 12px; }
.lp-pinned .lp-tile img, .lp-pinned .lp-letter { width: 32px; height: 32px; border-radius: 9px; font-size: 14px; }
.lp-pinned .lp-name { font-size: 10.5px; }
.lp-pinned .lp-pin { width: 14px; height: 14px; top: -3px; right: -3px; }
.lp-hair { height: 1px; margin: 8px 2px 0; background: linear-gradient(90deg, transparent, rgba(40, 70, 110, 0.16), transparent); }

/* ---------- 分类 chips ---------- */
.lp-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 12px auto 0;
  max-width: 100%;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}
.lp-chips::-webkit-scrollbar { display: none; }
.lp-chip {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 11px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.55);
  color: var(--pwb-muted);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, box-shadow 0.15s;
}
.lp-chip b { font-weight: 500; font-size: 10.5px; opacity: 0.55; font-variant-numeric: tabular-nums; }
.lp-chip:hover { background: rgba(255, 255, 255, 0.85); color: var(--pwb-text); }
.lp-chip.on {
  background: var(--pwb-text);
  border-color: transparent;
  color: var(--pwb-bg);
  box-shadow: 0 3px 10px rgba(40, 70, 110, 0.22);
}
.lp-chip.on b { opacity: 0.7; }
.lp-chip.plus { width: 26px; padding: 0; justify-content: center; }

.lp-warn {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 8px auto 0;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 11.5px;
  color: var(--pwb-bad-fg);
  background: var(--pwb-bad-bg);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---------- 网格 ---------- */
.lp-stage { flex: 1; min-height: 0; margin-top: 10px; overflow: hidden; }
.lp-grid {
  display: grid;
  gap: 14px 10px;
  align-content: start;
  justify-items: center;
}
.lp-app {
  width: 100%;
  height: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  padding: 6px 2px 4px;
  border: none;
  border-radius: 12px;
  background: transparent;
  cursor: pointer;
  min-width: 0;
  transition: background 0.15s;
}
.lp-app:hover { background: rgba(255, 255, 255, 0.42); }
.lp-app:disabled { opacity: 0.5; pointer-events: none; }

.lp-tile {
  position: relative;
  width: 58px;
  height: 58px;
  border-radius: 15px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 4px 12px rgba(45, 75, 115, 0.14), inset 0 1px 1px rgba(255, 255, 255, 0.95);
  transition: transform 0.16s cubic-bezier(0.32, 0.72, 0.35, 1), box-shadow 0.16s;
}
.lp-app:hover .lp-tile {
  transform: translateY(-3px) scale(1.05);
  box-shadow: 0 10px 22px rgba(45, 75, 115, 0.22), inset 0 1px 1px rgba(255, 255, 255, 1);
}
.lp-app:active .lp-tile { transform: translateY(0) scale(0.97); }
.lp-tile img { width: 40px; height: 40px; object-fit: contain; pointer-events: none; }
.lp-letter {
  width: 40px;
  height: 40px;
  border-radius: 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(150deg, #8fc0f0, #4d86c8);
}
.lp-pin {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--pwb-faint);
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(0, 0, 0, 0.06);
  opacity: 0;
  transform: scale(0.85);
  transition: opacity 0.14s, transform 0.14s, color 0.14s;
}
.lp-app:hover .lp-pin, .lp-pin.on { opacity: 1; transform: scale(1); }
.lp-pin.on { color: var(--pwb-accent); }
.lp-pin:hover { color: var(--pwb-accent); }

.lp-name {
  max-width: 100%;
  font-size: 11.5px;
  line-height: 1.3;
  color: var(--pwb-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}

/* ---------- 空态 ---------- */
.lp-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px 10px;
  text-align: center;
}
.lp-empty-ic {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--pwb-muted);
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 6px 18px rgba(45, 75, 115, 0.1);
}
.lp-empty-t { font-size: 12.5px; color: var(--pwb-muted); max-width: 360px; line-height: 1.6; }

/* ---------- 分页点 ---------- */
.lp-dots { display: flex; justify-content: center; align-items: center; gap: 6px; min-height: 22px; padding: 8px 0 0; }
.lp-dot {
  width: 6px;
  height: 6px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: rgba(40, 70, 110, 0.22);
  cursor: pointer;
  transition: width 0.2s, background 0.2s;
}
.lp-dot.on { width: 16px; background: var(--pwb-text); opacity: 0.75; }

/* ---------- dock ---------- */
.lp-dock {
  align-self: center;
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  padding: 5px 7px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 8px 24px rgba(45, 75, 115, 0.14), inset 0 1px 1px rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(22px) saturate(1.7);
  -webkit-backdrop-filter: blur(22px) saturate(1.7);
}
.dk {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--pwb-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.14s, color 0.14s;
}
.dk:hover { background: rgba(255, 255, 255, 0.95); color: var(--pwb-text); }
.dk:disabled { opacity: 0.35; pointer-events: none; }
.dk.del:hover { background: rgba(232, 17, 35, 0.1); color: #d32b3a; }
.dk-sep { width: 1px; height: 18px; margin: 0 4px; background: rgba(40, 70, 110, 0.14); }
.lp-dir {
  max-width: 210px;
  padding-right: 6px;
  font-size: 11px;
  color: var(--pwb-faint);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  direction: rtl;
  text-align: left;
}

/* ---------- 暗色 ---------- */
.pwb-dark .lp {
  background: linear-gradient(180deg, #20242c 0%, #1a1e26 46%, #141920 100%);
  border-color: rgba(255, 255, 255, 0.07);
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.06);
}
.pwb-dark .lp-aura {
  background:
    radial-gradient(58% 42% at 16% 2%, rgba(120, 80, 160, 0.5), transparent 70%),
    radial-gradient(56% 40% at 88% 4%, rgba(50, 110, 180, 0.55), transparent 72%),
    radial-gradient(90% 52% at 50% 112%, rgba(40, 100, 170, 0.5), transparent 70%);
}
.pwb-dark .lp-time { text-shadow: 0 1px 4px rgba(0, 0, 0, 0.55); }
.pwb-dark .lp-date { text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5); }
.pwb-dark .lp-search,
.pwb-dark .lp-chip,
.pwb-dark .lp-tile,
.pwb-dark .lp-dock {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
}
.pwb-dark .lp-tile { background: rgba(255, 255, 255, 0.1); }
.pwb-dark .lp-app:hover { background: rgba(255, 255, 255, 0.06); }
.pwb-dark .lp-chip:hover { background: rgba(255, 255, 255, 0.14); }
.pwb-dark .lp-chip.on { background: #f2f4f8; color: #1a1e26; }
.pwb-dark .dk:hover { background: rgba(255, 255, 255, 0.14); }
.pwb-dark .lp-empty-ic { background: rgba(255, 255, 255, 0.08); border-color: rgba(255, 255, 255, 0.1); }
.pwb-dark .lp-dot { background: rgba(255, 255, 255, 0.25); }
.pwb-dark .lp-dot.on { background: #e8ecf3; }
.pwb-dark .lp-hair { background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.14), transparent); }

.lp-boot { flex: 1; display: grid; place-items: center; color: var(--pwb-faint); }
</style>
