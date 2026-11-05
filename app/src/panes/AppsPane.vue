<script setup lang="ts">
// 应用启动器：选择文件夹 → 列出其中全部快捷方式（.lnk/.url/.exe/.app）→ 一键启动、可置顶。
import { computed, inject, onMounted, ref, type ComputedRef } from "vue"
import { invoke } from "@tauri-apps/api/core"
import { convertFileSrc } from "@tauri-apps/api/core"
import { open as openFileDialog } from "@tauri-apps/plugin-dialog"
import { toast } from "../lib/ui"
import type { T } from "../i18n"
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
const data = ref<Payload | null>(null)
const q = ref("")
const busy = ref("")

async function load() {
  try {
    data.value = await invoke<Payload>("apps_list")
  } catch (e) {
    toast(String((e as Error).message ?? e), true)
  }
}
onMounted(load)

const kw = computed(() => q.value.trim().toLowerCase())
const matched = computed(() => (data.value?.apps ?? []).filter((a) => !kw.value || a.name.toLowerCase().includes(kw.value)))
const pinnedList = computed(() => {
  const byFile = new Map((data.value?.apps ?? []).map((a) => [a.file, a]))
  return (data.value?.pinned ?? []).map((f) => byFile.get(f)).filter((a): a is AppEntry => Boolean(a))
})
const restList = computed(() => matched.value.filter((a) => !(data.value?.pinned ?? []).includes(a.file)))

async function pickDir() {
  const picked = await openFileDialog({ directory: true, multiple: false, title: "选择存放快捷方式的文件夹" })
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
</script>

<template>
  <div v-if="data">
    <!-- 目录行 -->
    <div class="card">
      <div class="row" style="flex-wrap: wrap">
        <div class="pwb-search">
          <Icon name="search" :size="14" />
          <input v-model="q" :placeholder="t('search_apps', { n: data.apps.length })">
          <button v-if="q" class="ibtn sm pwb-search-clear" @click="q = ''"><Icon name="x" :size="11" /></button>
        </div>
        <button class="mini" :disabled="!data.dir || !data.dirExists" :title="t('open_folder')" @click="openFolder">
          <Icon name="folder" :size="12" />{{ t("open_folder") }}
        </button>
        <button class="mini" @click="load"><Icon name="refresh" :size="12" />{{ t("refresh") }}</button>
        <button class="primary mini" @click="pickDir">{{ t("set_folder") }}</button>
      </div>
      <div class="muted dirline">
        <template v-if="data.dir">
          <span v-if="data.dirExists">{{ t("dir_line", { dir: data.dir }) }}</span>
          <span v-else class="bad">{{ t("dir_missing", { dir: data.dir }) }}</span>
          <button class="ibtn sm" :title="t('del')" @click="clearDir"><Icon name="x" :size="10" /></button>
        </template>
        <span v-else>{{ t("dir_unset") }}</span>
      </div>
    </div>

    <!-- 未配置目录 -->
    <div v-if="!data.dir" class="empty" style="padding: 40px 10px">
      <Icon name="folder" :size="30" />
      <div>{{ t("dir_unset") }}</div>
      <button class="primary" style="margin-top: 6px" @click="pickDir"><Icon name="plus" :size="14" />{{ t("set_folder") }}</button>
    </div>

    <!-- 置顶 -->
    <template v-else-if="pinnedList.length">
      <div class="appsec"><Icon name="star" :size="13" filled />{{ t("pinned") }} <span class="muted">{{ pinnedList.length }}</span></div>
      <div class="launch-grid">
        <button v-for="a in pinnedList" :key="'p' + a.file" class="lcard" :title="t('card_title', { file: a.file })"
          :disabled="busy === a.file" @click="launch(a)">
          <img v-if="iconOf(a)" class="lico" :src="iconOf(a)" alt="" draggable="false"
            @error="($event.target as HTMLImageElement).style.visibility = 'hidden'">
          <span v-else class="lico fallback">{{ letter(a.name) }}</span>
          <span class="lname">{{ a.name }}</span>
          <span class="ibtn sm star on" :title="t('unpin_title')" @click.stop="togglePin(a)"><Icon name="star" :size="12" filled /></span>
        </button>
      </div>
    </template>

    <!-- 全部应用 -->
    <template v-if="data.dir">
      <div class="appsec" style="margin-top: 14px">
        <Icon name="rocket" :size="13" />{{ t("all_apps") }}
        <span class="muted">{{ restList.length }}</span>
      </div>
      <div v-if="restList.length" class="launch-grid">
        <button v-for="a in restList" :key="a.file" class="lcard" :title="t('card_title', { file: a.file })"
          :disabled="busy === a.file" @click="launch(a)">
          <img v-if="iconOf(a)" class="lico" :src="iconOf(a)" alt="" draggable="false"
            @error="($event.target as HTMLImageElement).style.visibility = 'hidden'">
          <span v-else class="lico fallback">{{ letter(a.name) }}</span>
          <span class="lname">{{ a.name }}</span>
          <span class="ibtn sm star" :title="t('pin_title')" @click.stop="togglePin(a)"><Icon name="star" :size="12" /></span>
        </button>
      </div>
      <div v-else-if="kw" class="empty"><Icon name="search" :size="22" /><span>{{ t("no_match", { q }) }}</span></div>
      <div v-else-if="data.dirExists && !data.apps.length" class="empty">
        <Icon name="folder" :size="22" /><span>{{ t("empty_apps") }}</span>
      </div>
    </template>
  </div>
  <div v-else class="muted">…</div>
</template>

<style scoped>
.dirline { margin-top: 8px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; word-break: break-all; }
.dirline .bad { color: var(--pwb-bad-fg); }
.launch-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
.lcard { position: relative; display: flex; align-items: center; gap: 9px; height: 52px; padding: 0 10px;
  background: var(--pwb-card); border: 1px solid var(--pwb-border); border-radius: var(--pwb-radius-md);
  cursor: pointer; text-align: left; min-width: 0; transition: transform .14s, box-shadow .16s, border-color .16s; }
.lcard:hover { border-color: var(--pwb-border-strong); box-shadow: var(--pwb-shadow-sm); transform: translateY(-1px); }
.lcard:active { transform: translateY(0) scale(.985); }
.lcard:disabled { opacity: .55; pointer-events: none; }
.lico { width: 28px; height: 28px; border-radius: 7px; object-fit: contain; flex-shrink: 0; }
.lico.fallback { display: inline-flex; align-items: center; justify-content: center; background: var(--pwb-tag-bg);
  color: var(--pwb-tag-fg); font-weight: 700; font-size: 13px; }
.lname { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 12.5px; font-weight: 500; color: var(--pwb-text); }
.star { visibility: hidden; color: var(--pwb-faint); }
.star.on { visibility: visible; color: var(--pwb-accent); }
.lcard:hover .star { visibility: visible; }
.star:hover { color: var(--pwb-accent); }
</style>
