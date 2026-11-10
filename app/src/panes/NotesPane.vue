<script setup lang="ts">
// 速记面板：flomo 式卡片流（按月归档、统一卡高、编辑/删除、整篇编辑、搜索、＋ 新建卡）。
import { computed, inject, onMounted, ref, watch, type ComputedRef } from "vue"
import { call, ApiError, type TextDoc } from "../lib/api"
import { toast } from "../lib/ui"
import { pad2 } from "../lib/date"
import { guardReady, isLocked, refreshGuard } from "../lib/guard"
import type { Lang, T } from "../i18n"
import Icon from "../components/Icon.vue"
import AddCard from "../components/AddCard.vue"
import GuardGate from "../components/GuardGate.vue"

const t = inject<ComputedRef<T>>("t")!
const lang = inject<ComputedRef<Lang>>("lang")!

const raw = ref<string | null>(null)
const hash = ref("")
const q = ref("")
const rawMode = ref(false)
const rawDraft = ref("")
const editing = ref<{ idx: number; text: string } | null>(null)

const locked = computed(() => isLocked("note"))
onMounted(async () => {
  await refreshGuard()
  if (!locked.value) await load()
})
// 上锁后清空正文与编辑态，不在窗口里留明文；解锁则重新拉一次
watch(locked, (v) => {
  if (!v) {
    void load()
    return
  }
  raw.value = null
  hash.value = ""
  rawMode.value = false
  rawDraft.value = ""
  editing.value = null
})
async function load() {
  try {
    const d = await call<TextDoc>("note_get")
    raw.value = d.text
    hash.value = d.hash
  } catch (e) {
    toast(String((e as Error).message), true)
  }
}

const put = async (text: string) => {
  try {
    const d = await call<{ hash: string }>("note_put", { text, baseHash: hash.value })
    hash.value = d.hash
    raw.value = text
    return true
  } catch (e) {
    const err = e as ApiError
    if (err.currentText !== undefined) {
      raw.value = err.currentText
      hash.value = err.currentHash ?? ""
      toast(t.value("note_conflict"), true)
    } else toast(err.message, true)
    return false
  }
}

// 解析 "## " 小节为卡片；标题即时间戳（新格式含年份按月归档，旧格式归当前年）
interface Entry { idx: number; title: string; time: string; monthKey: string | null; body: string }
const entries = computed<Entry[]>(() => {
  if (raw.value == null) return []
  const sections: { title: string; lines: string[] }[] = []
  let cur: { title: string; lines: string[] } | null = null
  const year = new Date().getFullYear()
  for (const line of raw.value.split(/\r?\n/)) {
    const h = line.match(/^##\s+(.+)$/)
    if (h) {
      cur = { title: h[1].trim(), lines: [] }
      sections.push(cur)
      continue
    }
    if (!cur) {
      if (line.trim()) {
        cur = { title: line.trim().slice(0, 40), lines: [] }
        sections.push(cur)
      }
      continue
    }
    cur.lines.push(line)
  }
  return sections.map((s, i) => {
    const full = s.title.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}:\d{2})$/)
    const short = s.title.match(/^(\d{2})-(\d{2})\s+(\d{2}:\d{2})$/)
    let time = s.title
    let monthKey: string | null = null
    if (full) {
      time = `${full[2]}-${full[3]} ${full[4]}`
      monthKey = `${full[1]}-${full[2]}`
    } else if (short) {
      time = `${short[1]}-${short[2]} ${short[3]}`
      monthKey = `${year}-${short[1]}`
    }
    return { idx: i, title: s.title, time, monthKey, body: s.lines.join("\n").trim() }
  })
})

// 小节在原文中的行区间（删除/保存按区间回写）。
// 注意：首个 ## 之前的前导内容（如「# 速记」标题头）也算第 0 段——entries 把它计入
// _early 段，marks 必须同样对齐，否则 saveCard/delEntry 按 entries 索引回写会错位/越界
// （症状：点保存毫无反应——marks[idx] 取不到直接 return）。
const sectionSpans = (text: string) => {
  const lines = text.split(/\r?\n/)
  const marks: { start: number; end: number }[] = []
  let cur: { start: number; end: number } | null = null
  lines.forEach((line, i) => {
    if (/^##\s+/.test(line)) {
      if (cur) cur.end = i
      cur = { start: i, end: lines.length }
      marks.push(cur)
    }
  })
  const first = marks[0]?.start ?? lines.length
  if (lines.slice(0, first).some(l => l.trim())) {
    marks.unshift({ start: 0, end: first })
  }
  return { lines, marks }
}

const delEntry = async (idx: number) => {
  if (raw.value == null) return
  const { lines, marks } = sectionSpans(raw.value)
  const m = marks[idx]
  // 第 0 段是文件头（如「# 速记」标题 + 前导内容），删掉会破坏文档结构，拒绝
  if (!m || (idx === 0 && marks[0].start === 0 && lines[0]?.startsWith("# "))) {
    if (!m) toast("该条目在文件中找不到对应小节，请刷新后重试", true)
    return
  }
  lines.splice(m.start, m.end - m.start)
  await put(lines.join("\n").replace(/^\n+/, ""))
}

const newCard = async () => {
  if (raw.value == null || editing.value) return
  const d = new Date()
  const stamp = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  const base = raw.value.trimEnd()
  const ok = await put((base ? base + "\n\n" : "") + `## ${stamp}\n`)
  // put() 已把新小节写进原文，entries 会多出一节；下标要取新增那条（length - 1）
  if (ok) editing.value = { idx: entries.value.length - 1, text: "" }
}

const saveCard = async () => {
  if (!editing.value || raw.value == null) return
  const body = editing.value.text.trim()
  if (!body) return delEntry(editing.value.idx)
  const { lines, marks } = sectionSpans(raw.value)
  const m = marks[editing.value.idx]
  if (!m) {
    // 不再静默：索引对不上时明确告知（内容仍在编辑框中，不会丢）
    toast("保存失败：条目与文件小节对不上，请复制内容后刷新页面重试", true)
    return
  }
  lines.splice(m.start + 1, m.end - m.start - 1, body)
  const ok = await put(lines.join("\n"))
  if (ok) editing.value = null
}

const cancelCard = () => {
  if (!editing.value) return
  if (!editing.value.text.trim()) delEntry(editing.value.idx)
  else editing.value = null
}

const saveRaw = async () => {
  const ok = await put(rawDraft.value)
  if (ok) {
    rawMode.value = false
    rawDraft.value = ""
  }
}

const kw = computed(() => q.value.trim().toLowerCase())
const visible = computed(() => entries.value.filter((e) => {
  const isEditingThis = editing.value && editing.value.idx === e.idx
  if (!e.body.trim() && !isEditingThis) return false
  if (!kw.value) return true
  return (e.title + "\n" + e.body).toLowerCase().includes(kw.value)
}))

const sections = computed(() => {
  const monthKeys = [...new Set(visible.value.map((e) => e.monthKey).filter(Boolean))].sort().reverse()
  const earlier = visible.value.filter((e) => !e.monthKey)
  const out: { key: string; label: string; items: Entry[] }[] = monthKeys.map((key) => ({
    key: key!,
    label: monthLabel(key!),
    items: visible.value.filter((e) => e.monthKey === key),
  }))
  if (earlier.length) out.push({ key: "_early", label: t.value("note_earlier"), items: earlier })
  return out
})

function monthLabel(key: string) {
  const [y, m] = key.split("-")
  return lang.value === "en" ? `${MONTHS()[Number(m) - 1]} ${y}` : `${y} 年 ${Number(m)} 月`
}
const MONTHS = () => t.value("months").split(",")
</script>

<template>
  <div>
    <GuardGate v-if="guardReady && locked" module="note" @unlocked="load" />
    <div v-else-if="!guardReady" style="height: 58vh" />
    <template v-else>
    <div class="row" style="flex-wrap: wrap">
      <button class="mini" :disabled="!!editing" @click="rawMode ? (rawMode = false) : ((rawDraft = raw ?? ''), (rawMode = true))">
        {{ t("note_raw") }}
      </button>
      <div class="spacer" />
      <div class="pwb-search" style="max-width: 260px">
        <Icon name="search" :size="14" />
        <input v-model="q" :placeholder="t('note_search')">
        <button v-if="q" class="ibtn sm pwb-search-clear" @click="q = ''"><Icon name="x" :size="11" /></button>
      </div>
      <span class="muted">{{ t("note_stats", { entries: visible.filter((e) => e.body.trim()).length, chars: (raw ?? "").length }) }}</span>
    </div>

    <div v-if="rawMode" class="card" style="margin-top: 12px">
      <textarea v-model="rawDraft" rows="16" style="width: 100%; font-family: ui-monospace, Consolas, monospace; resize: vertical" />
      <div class="row" style="justify-content: flex-end; margin-top: 10px">
        <button @click="rawMode = false">{{ t("note_raw_cancel") }}</button>
        <button class="primary" @click="saveRaw">{{ t("note_raw_save") }}</button>
      </div>
    </div>

    <div v-else style="margin-top: 12px">
      <div v-for="(s, si) in sections" :key="s.key">
        <div class="appsec"><Icon name="calendar" :size="13" />{{ s.label }} <span class="muted">{{ s.items.length }}</span></div>
        <div class="note-grid">
          <div v-for="e in [...s.items].reverse()" :key="e.idx" class="card note-card" :class="{ editing: editing && editing.idx === e.idx }" style="min-width: 0">
            <div v-if="!(editing && editing.idx === e.idx)" class="card-actions">
              <button class="ibtn sm" :title="t('note_edit')" @click="editing = { idx: e.idx, text: e.body }"><Icon name="edit" :size="12" /></button>
              <button class="ibtn sm red" :title="t('note_del')" @click="delEntry(e.idx)"><Icon name="trash" :size="12" /></button>
            </div>
            <div class="note-time">{{ s.key === "_early" ? e.title : e.time }}</div>
            <template v-if="editing && editing.idx === e.idx">
              <textarea v-model="editing.text" rows="6" autofocus
                style="width: 100%; border: none; background: transparent; padding: 0; outline: none; resize: none; font: inherit; color: var(--pwb-text); display: block; flex: 1"
                @keydown.ctrl.enter.prevent="saveCard()" @keydown.meta.enter.prevent="saveCard()" />
              <div class="row" style="justify-content: flex-end; gap: 6px">
                <button class="mini" @click="cancelCard">{{ t("note_cancel") }}</button>
                <button class="mini primary" @click="saveCard">{{ t("note_save") }}</button>
              </div>
            </template>
            <div v-else class="note-body">{{ e.body }}</div>
          </div>
          <AddCard v-if="si === sections.length - 1" :label="t('note_new')" :disabled="!!editing" @click="newCard" />
        </div>
      </div>
      <template v-if="!visible.length">
        <div class="empty"><Icon name="edit" :size="22" /><span>{{ entries.length ? t("note_none_match") : t("note_empty") }}</span></div>
        <div v-if="!kw" class="note-grid"><AddCard :label="t('note_new')" :disabled="!!editing" @click="newCard" /></div>
      </template>
    </div>
    </template>
  </div>
</template>
