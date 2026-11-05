<script setup lang="ts">
// 密钥文档面板：固定尺寸卡片 + 弹窗查看/编辑（ESC 两步退出）+ 新建/导入 .md|.txt。
import { computed, inject, onMounted, ref, type ComputedRef } from "vue"
import { call, ApiError, type KeyDoc } from "../lib/api"
import { toast, askConfirm } from "../lib/ui"
import type { T } from "../i18n"
import Icon from "../components/Icon.vue"
import AddCard from "../components/AddCard.vue"

const t = inject<ComputedRef<T>>("t")!

const docs = ref<KeyDoc[] | null>(null)
const q = ref("")
const detail = ref<{ name: string; ext: string } | null>(null)
const draft = ref<string | null>(null)
const adding = ref(false)
const newName = ref("")

onMounted(load)
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

const save = async () => {
  if (!detail.value || !doc.value || draft.value === null) return
  try {
    const d = await call<{ hash: string; chars: number }>("keysdoc_put", {
      name: detail.value.name,
      ext: detail.value.ext,
      text: draft.value,
      baseHash: doc.value.hash,
    })
    docs.value = (docs.value ?? []).map((x) =>
      x.name === detail.value!.name && x.ext === detail.value!.ext
        ? { ...x, text: draft.value!, hash: d.hash, chars: d.chars, mtimeMs: Date.now() }
        : x,
    )
    draft.value = null
    toast(t.value("kd_saved"))
  } catch (e) {
    const err = e as ApiError
    if (err.currentText !== undefined) {
      draft.value = err.currentText
      docs.value = (docs.value ?? []).map((x) =>
        x.name === detail.value!.name && x.ext === detail.value!.ext ? { ...x, text: err.currentText!, hash: err.currentHash ?? "" } : x,
      )
      toast(t.value("kd_conflict"), true)
    } else toast(err.message, true)
  }
}

const removeDoc = async (d: KeyDoc) => {
  const ok = await askConfirm({ title: t.value("kd_del"), danger: true, okText: t.value("ok_del"), message: t.value("kd_del_msg", { name: docTitle(d) }) })
  if (!ok) return
  try {
    await call("keysdoc_delete", { name: d.name, ext: d.ext })
    if (detail.value && detail.value.name === d.name && detail.value.ext === d.ext) {
      detail.value = null
      draft.value = null
    }
    await load()
    toast(t.value("kd_deleted"))
  } catch (e) {
    toast(String((e as Error).message), true)
  }
}

const createDoc = async () => {
  const name = newName.value.trim()
  if (!name) return
  if ((docs.value ?? []).some((d) => d.name === name && d.ext === "md")) return toast(t.value("kd_name_exists"), true)
  try {
    await call("keysdoc_put", { name, ext: "md", text: "" })
    await load()
    detail.value = { name, ext: "md" }
    draft.value = ""
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
      draft.value = null
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
const openView = (d: KeyDoc, edit = false) => {
  detail.value = { name: d.name, ext: d.ext }
  draft.value = edit ? d.text : null
}
// 弹窗关闭：编辑态先退回查看态（两步退出），再关弹窗
const closeDetail = () => {
  if (draft.value === null) detail.value = null
  else draft.value = null
}
</script>

<template>
  <div>
    <div class="row" style="flex-wrap: wrap">
      <div class="pwb-search">
        <Icon name="search" :size="14" />
        <input v-model="q" :placeholder="t('kd_search')">
        <button v-if="q" class="ibtn sm pwb-search-clear" @click="q = ''"><Icon name="x" :size="11" /></button>
      </div>
    </div>

    <div style="margin-top: 12px">
      <div v-if="filtered.length" class="note-grid">
        <div v-for="d in filtered" :key="d.name + '.' + d.ext" class="card kdoc-card" :title="t('kd_open_tip')" @click="openView(d)">
          <div class="card-actions">
            <button class="ibtn sm" :title="t('note_edit')" @click.stop="openView(d, true)"><Icon name="edit" :size="12" /></button>
            <button class="ibtn sm red" :title="t('kd_del')" @click.stop="removeDoc(d)"><Icon name="trash" :size="12" /></button>
          </div>
          <div class="row">
            <b class="note-title"><Icon name="file" :size="13" />{{ d.name }}<span v-if="d.ext === 'txt'" class="muted">.txt</span></b>
          </div>
          <div class="muted" style="margin-top: 4px; font-size: 11.5px; font-variant-numeric: tabular-nums">
            {{ t("kd_chars", { chars: d.chars }) }} · {{ fmtTime(d.mtimeMs) }}
          </div>
          <div v-if="d.text.trim()" class="kdoc-preview">{{ d.text.split("\n").filter((l) => l.trim()).slice(0, 4).join("\n") }}</div>
        </div>
        <AddCard :label="t('kd_new')" @click="newName = ''; adding = true" />
      </div>
      <template v-else-if="(docs ?? []).length">
        <div class="empty"><Icon name="lock" :size="22" /><span>{{ t("key_none_match") }}</span></div>
      </template>
      <template v-else>
        <div class="empty"><Icon name="lock" :size="22" /><span>{{ t("kd_empty_list") }}</span></div>
        <div class="note-grid"><AddCard :label="t('kd_new')" @click="newName = ''; adding = true" /></div>
      </template>
    </div>

    <!-- 详情弹窗：查看 / 编辑 / 删除 -->
    <div v-if="detail && doc" class="pwb-modal-bg" @mousedown.self="closeDetail">
      <div class="pwb-modal wide" role="dialog" aria-modal="true" :aria-label="docTitle(doc)" @keydown.esc="closeDetail">
        <div class="pwb-modal-head"><h3>{{ docTitle(doc) }}</h3>
          <button class="ibtn" @click="closeDetail"><Icon name="x" :size="14" /></button>
        </div>
        <template v-if="draft === null">
          <div class="row muted" style="gap: 10px; margin-bottom: 8px; font-size: 12px; font-variant-numeric: tabular-nums">
            <span>{{ t("kd_chars", { chars: doc.chars }) }}</span>
            <span>{{ fmtTime(doc.mtimeMs) }}</span>
          </div>
          <div v-if="doc.text.trim()" class="kdoc-view" style="min-height: 180px; max-height: 52vh; overflow: auto">{{ doc.text }}</div>
          <div v-else class="empty"><Icon name="edit" :size="22" /><span>{{ t("kd_empty_doc") }}</span></div>
          <div class="row" style="justify-content: space-between; margin-top: 12px">
            <button class="danger mini" @click="removeDoc(doc)"><Icon name="trash" :size="12" />{{ t("kd_del") }}</button>
            <button class="primary mini" @click="draft = doc.text"><Icon name="edit" :size="12" />{{ t("note_edit") }}</button>
          </div>
        </template>
        <template v-else>
          <textarea v-model="draft" rows="18" autofocus
            style="width: 100%; border: 1px solid var(--pwb-border-strong); border-radius: 8px; background: var(--pwb-input-bg); color: var(--pwb-text); font-family: ui-monospace, Consolas, monospace; font-size: 12.5px; line-height: 1.6; resize: vertical; padding: 10px 12px; outline: none; display: block" />
          <div class="row" style="justify-content: flex-end; margin-top: 10px">
            <button class="mini" @click="draft = null">{{ t("cancel") }}</button>
            <button class="primary mini" @click="save">{{ t("save") }}</button>
          </div>
        </template>
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
  </div>
</template>

<style scoped>
.kd-or { display: flex; align-items: center; gap: 10px; margin: 14px 0; color: var(--pwb-faint); font-size: 12px; }
.kd-or::before, .kd-or::after { content: ""; flex: 1; height: 1px; background: var(--pwb-border); }
</style>
