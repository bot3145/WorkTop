<script setup lang="ts">
// 密钥文档面板：小卡片网格 + 点击预览（只读，不含编辑/删除入口）+ 新建/导入 .md|.txt。
import { computed, inject, onMounted, ref, watch, type ComputedRef } from "vue"
import { call, type KeyDoc } from "../lib/api"
import { toast } from "../lib/ui"
import { guardReady, isLocked, refreshGuard } from "../lib/guard"
import type { T } from "../i18n"
import Icon from "../components/Icon.vue"
import AddCard from "../components/AddCard.vue"
import GuardGate from "../components/GuardGate.vue"

const t = inject<ComputedRef<T>>("t")!

const docs = ref<KeyDoc[] | null>(null)
const q = ref("")
const detail = ref<{ name: string; ext: string } | null>(null)
const adding = ref(false)
const newName = ref("")

const locked = computed(() => isLocked("keys"))
onMounted(async () => {
  await refreshGuard()
  if (!locked.value) await load()
})
// 在别处上锁后立刻清空已加载内容（含弹窗），不把明文留在窗口里；解锁则重新拉一次
watch(locked, (v) => {
  if (!v) {
    void load()
    return
  }
  docs.value = null
  detail.value = null
  adding.value = false
})
async function load() {
  try {
    const d = await call<KeyDoc[]>("keysdocs_list")
    docs.value = d
  } catch (e) {
    toast(String((e as Error).message), true)
  }
}

const doc = computed(() =>
  detail.value ? (docs.value ?? []).find((d) => d.name === detail.value!.name && d.ext === detail.value!.ext) ?? null : null,
)
const docTitle = (d: KeyDoc) => d.name + (d.ext === "txt" ? ".txt" : "")
const fmtTime = (ms: number) => {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const createDoc = async () => {
  const name = newName.value.trim()
  if (!name) return
  if ((docs.value ?? []).some((d) => d.name === name && d.ext === "md")) return toast(t.value("kd_name_exists"), true)
  try {
    await call("keysdoc_put", { name, ext: "md", text: "" })
    await load()
    detail.value = { name, ext: "md" }
    adding.value = false
    newName.value = ""
    toast(t.value("kd_created"))
  } catch (e) {
    toast(String((e as Error).message), true)
  }
}

// 导入本地 .md / .txt：内容原样落成密钥目录下的同名文档
const importFile = () => {
  const inp = document.createElement("input")
  inp.type = "file"
  inp.accept = ".md,.txt,text/markdown,text/plain"
  inp.onchange = async () => {
    const file = inp.files?.[0]
    if (!file) return
    const hit = file.name.toLowerCase().match(/^(.+)(\.md|\.txt)$/)
    if (!hit) return toast(t.value("kd_bad_file"), true)
    const ext = hit[2] === ".txt" ? "txt" : "md"
    const name = file.name.slice(0, -hit[2].length).trim()
    if (!name) return toast(t.value("kd_bad_file"), true)
    if ((docs.value ?? []).some((d) => d.name === name && d.ext === ext)) return toast(t.value("kd_name_exists"), true)
    if (file.size > 1024 * 1024) return toast(t.value("kd_too_big"), true)
    try {
      const text = await file.text()
      await call("keysdoc_put", { name, ext, text })
      await load()
      detail.value = { name, ext }
      adding.value = false
      toast(t.value("kd_import_done", { name: name + hit[2] }))
    } catch (e) {
      toast(String((e as Error).message), true)
    }
  }
  inp.click()
}

const kw = computed(() => q.value.trim().toLowerCase())
const filtered = computed(() => (docs.value ?? []).filter((d) => !kw.value || (d.name + "\n" + d.text).toLowerCase().includes(kw.value)))
const openView = (d: KeyDoc) => {
  detail.value = { name: d.name, ext: d.ext }
}
const closeDetail = () => {
  detail.value = null
}
</script>

<template>
  <div>
    <GuardGate v-if="guardReady && locked" module="keys" @unlocked="load" />
    <div v-else-if="!guardReady" style="height: 58vh" />
    <template v-else>
    <div class="row" style="flex-wrap: wrap">
      <div class="pwb-search">
        <Icon name="search" :size="14" />
        <input v-model="q" :placeholder="t('kd_search')">
        <button v-if="q" class="ibtn sm pwb-search-clear" @click="q = ''"><Icon name="x" :size="11" /></button>
      </div>
    </div>

    <div style="margin-top: 12px">
      <div v-if="filtered.length" class="note-grid kdoc-grid">
        <div v-for="d in filtered" :key="d.name + '.' + d.ext" class="card kdoc-card" :title="t('kd_open_tip')" @click="openView(d)">
          <div class="row">
            <b class="note-title"><Icon name="file" :size="12" />{{ d.name }}<span v-if="d.ext === 'txt'" class="muted">.txt</span></b>
          </div>
          <div class="muted" style="margin-top: 3px; font-size: 10.5px; font-variant-numeric: tabular-nums">
            {{ t("kd_chars", { chars: d.chars }) }} · {{ fmtTime(d.mtimeMs) }}
          </div>
          <div v-if="d.text.trim()" class="kdoc-preview">{{ d.text.split("\n").filter((l) => l.trim()).slice(0, 2).join("\n") }}</div>
        </div>
        <AddCard :label="t('kd_new')" @click="newName = ''; adding = true" />
      </div>
      <template v-else-if="(docs ?? []).length">
        <div class="empty"><Icon name="lock" :size="22" /><span>{{ t("key_none_match") }}</span></div>
      </template>
      <template v-else>
        <div class="empty"><Icon name="lock" :size="22" /><span>{{ t("kd_empty_list") }}</span></div>
        <div class="note-grid kdoc-grid"><AddCard :label="t('kd_new')" @click="newName = ''; adding = true" /></div>
      </template>
    </div>

    <!-- 详情弹窗：仅预览（只读） -->
    <div v-if="detail && doc" class="pwb-modal-bg" @mousedown.self="closeDetail">
      <div class="pwb-modal wide kdoc-modal" role="dialog" aria-modal="true" :aria-label="docTitle(doc)"
        @keydown.esc="closeDetail">
        <div class="pwb-modal-head"><h3>{{ docTitle(doc) }}</h3>
          <button class="ibtn" @click="closeDetail"><Icon name="x" :size="14" /></button>
        </div>
        <div class="row muted" style="gap: 10px; margin-bottom: 8px; font-size: 12px; font-variant-numeric: tabular-nums">
          <span>{{ t("kd_chars", { chars: doc.chars }) }}</span>
          <span>{{ fmtTime(doc.mtimeMs) }}</span>
        </div>
        <div v-if="doc.text.trim()" class="kdoc-view">{{ doc.text }}</div>
        <div v-else class="empty"><Icon name="file" :size="22" /><span>{{ t("kd_empty_doc") }}</span></div>
      </div>
    </div>

    <!-- 添加（新建 / 导入）弹窗 -->
    <div v-if="adding" class="pwb-modal-bg" @mousedown.self="adding = false">
      <div class="pwb-modal" role="dialog" aria-modal="true" :aria-label="t('kd_add_title')" @keydown.esc="adding = false">
        <div class="pwb-modal-head"><h3>{{ t("kd_add_title") }}</h3>
          <button class="ibtn" @click="adding = false"><Icon name="x" :size="14" /></button>
        </div>
        <div class="row">
          <input v-model="newName" style="flex: 1" :placeholder="t('kd_name_ph')" autofocus @keydown.enter="createDoc">
          <button class="primary" @click="createDoc"><Icon name="plus" :size="13" />{{ t("kd_new") }}</button>
        </div>
        <div class="kd-or">{{ t("kd_or") }}</div>
        <button style="width: 100%" @click="importFile"><Icon name="folder" :size="14" />{{ t("kd_import_file") }}</button>
        <div class="muted" style="margin-top: 8px">{{ t("kd_import_hint") }}</div>
      </div>
    </div>
    </template>
  </div>
</template>

<style scoped>
.kd-or { display: flex; align-items: center; gap: 10px; margin: 14px 0; color: var(--pwb-faint); font-size: 12px; }
.kd-or::before, .kd-or::after { content: ""; flex: 1; height: 1px; background: var(--pwb-border); }
</style>
