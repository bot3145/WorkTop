<script setup lang="ts">
// 待办面板：看板 / 日历（月/周、拖拽改期、范围筛选、选中日明细）/ 标签跟踪。
// 行为与 pwb-lite 对齐：整篇 Markdown + baseHash CAS，外部（Obsidian）改动冲突自动回读。
import { computed, inject, onMounted, ref, type ComputedRef } from "vue"
import { call, ApiError, type TextDoc, type TodoItem } from "../lib/api"
import { parseTodos, serializeTodos } from "../lib/todo"
import { addDays, fromISO, isoOf, mondayOf, today } from "../lib/date"
import { toast, askPrompt } from "../lib/ui"
import type { Lang, T } from "../i18n"
import Icon from "../components/Icon.vue"

const t = inject<ComputedRef<T>>("t")!
const lang = inject<ComputedRef<Lang>>("lang")!
const MONTHS = computed(() => t.value("months").split(","))

const raw = ref("")
const hash = ref("")
const path = ref("")
const input = ref("")
const view = ref<"board" | "cal" | "track">("cal")
const calMode = ref<"month" | "week">("month")
const calAnchor = ref(today())
const selDate = ref(today())
const scope = ref<"today" | "week" | "month" | "all">("month")
const showDone = ref((() => {
  try {
    return localStorage.getItem("pwb_todo_done") !== "0"
  } catch {
    return true
  }
})())
const setShowDone = (v: boolean) => {
  showDone.value = v
  try {
    localStorage.setItem("pwb_todo_done", v ? "1" : "0")
  } catch {}
}

onMounted(async () => {
  try {
    const d = await call<TextDoc>("todo_get")
    raw.value = d.text
    hash.value = d.hash
    path.value = d.path
  } catch (e) {
    toast(String((e as Error).message), true)
  }
})

const items = computed(() => parseTodos(raw.value))

const putTodo = async (text: string) => {
  try {
    const d = await call<{ hash: string }>("todo_put", { text, baseHash: hash.value })
    hash.value = d.hash
    return true
  } catch (e) {
    const err = e as ApiError
    if (err.currentText !== undefined) {
      raw.value = err.currentText
      hash.value = err.currentHash ?? ""
      toast(t.value("conflict_todo"), true)
    } else toast(err.message, true)
    return false
  }
}

const save = async (next: TodoItem[]) => {
  const text = serializeTodos(next, raw.value)
  raw.value = text
  await putTodo(text)
}

const add = () => {
  const v = input.value.trim()
  if (!v) return
  // 顶部快捷添加未指定日期时，默认归到当天，避免待办不出现在日历/今日范围里
  const due = (v.match(/@(\d{4}-\d{2}-\d{2})/) || [])[1] || today()
  const tags = [...v.matchAll(/#([^\s#@]+)/g)].map((x) => x[1])
  const text = v.replace(/@(\d{4}-\d{2}-\d{2})/g, "").replace(/#([^\s#@]+)/g, "").trim()
  save([...items.value, { line: -1, done: false, text, tags, due }])
  input.value = ""
}

const toggle = (line: number, done: boolean) =>
  save(items.value.map((it) => (it.line === line ? { ...it, done } : it)))

const del = (line: number) => {
  const lines = raw.value.split(/\r?\n/)
  lines.splice(line, 1)
  const text = lines.join("\n")
  raw.value = text
  putTodo(text)
}

const reschedule = (line: number, due: string) =>
  save(items.value.map((it) => (it.line === line ? { ...it, due } : it)))

const addOn = async (due: string) => {
  const v = await askPrompt({ title: t.value("add_todo_title"), message: t.value("falls_on", { due }), placeholder: t.value("todo_ph_short") })
  if (typeof v !== "string" || !v.trim()) return
  const tags = [...v.matchAll(/#([^\s#@]+)/g)].map((x) => x[1])
  save([...items.value, { line: -1, done: false, text: v.replace(/#([^\s#@]+)/g, "").trim(), tags, due }])
}

/* ---------- 派生视图 ---------- */
const open = computed(() => items.value.filter((x) => !x.done))
const overdue = computed(() => open.value.filter((x) => x.due && x.due < today()))
const active = computed(() => open.value.filter((x) => !(x.due && x.due < today())))
const done = computed(() => items.value.filter((x) => x.done))
const byTag = computed(() => {
  const map = new Map<string, TodoItem[]>()
  for (const x of items.value) {
    for (const tg of x.tags.length ? x.tags : [t.value("untagged")]) {
      if (!map.has(tg)) map.set(tg, [])
      map.get(tg)!.push(x)
    }
  }
  return map
})
const dueCls = (d?: string | null) => (d ? (d < today() ? " overdue" : d === today() ? " today" : "") : "")

/* ---------- 日历 ---------- */
const t0 = today()
const wk0 = isoOf(mondayOf(new Date()))
const wk1 = isoOf(addDays(fromISO(wk0), 6))
const monPrefix = t0.slice(0, 7)
const scopeMatch = (x: TodoItem, key: string) =>
  key === "all" ? true : Boolean(x.due) && (key === "today" ? x.due === t0 : key === "week" ? x.due! >= wk0 && x.due! <= wk1 : x.due!.startsWith(monPrefix))
const scopeCount = (key: string) => items.value.filter((x) => !x.done && scopeMatch(x, key)).length
const scopeList = computed(() => items.value.filter((x) => scopeMatch(x, scope.value) && (showDone.value || !x.done)))

const anchorDate = computed(() => fromISO(calAnchor.value))
const calTitle = computed(() =>
  calMode.value === "month"
    ? lang.value === "en"
      ? `${MONTHS.value[anchorDate.value.getMonth()]} ${anchorDate.value.getFullYear()}`
      : `${anchorDate.value.getFullYear()} 年 ${anchorDate.value.getMonth() + 1} 月`
    : `${isoOf(mondayOf(anchorDate.value))} ~ ${isoOf(addDays(mondayOf(anchorDate.value), 6))}`,
)
const calCells = computed(() => {
  if (calMode.value === "month") {
    const start = mondayOf(new Date(anchorDate.value.getFullYear(), anchorDate.value.getMonth(), 1))
    return Array.from({ length: 42 }, (_, i) => addDays(start, i))
  }
  const start = mondayOf(anchorDate.value)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
})
const navCal = (dir: number) => {
  const a = fromISO(calAnchor.value)
  if (calMode.value === "month") calAnchor.value = isoOf(new Date(a.getFullYear(), a.getMonth() + dir, 1))
  else calAnchor.value = isoOf(addDays(a, dir * 7))
}
const dayItems = (iso: string) => items.value.filter((x) => x.due === iso && (showDone.value || !x.done))
const selItems = computed(() => items.value.filter((x) => x.due === selDate.value && (showDone.value || !x.done)))
const selTitle = computed(() => {
  const [y, m, d] = selDate.value.split("-")
  return lang.value === "en" ? `${MONTHS.value[Number(m) - 1]} ${Number(d)}, ${y}` : `${y} 年 ${Number(m)} 月 ${Number(d)} 日`
})

const onDrop = (iso: string, ev: DragEvent) => {
  ;(ev.currentTarget as HTMLElement).classList.remove("dragover")
  const line = Number(ev.dataTransfer?.getData("text/pwb-line"))
  if (line >= 0) reschedule(line, iso)
}
</script>

<template>
  <div>
    <div class="card">
      <div class="row" style="flex-wrap: wrap">
        <input v-model="input" style="flex: 1; min-width: 200px" :placeholder="t('todo_ph')"
          @keydown.enter="add()">
        <button class="primary" @click="add"><Icon name="plus" :size="14" />{{ t("add") }}</button>
        <div class="pwb-seg mini">
          <button v-for="[v, l] in [['board', t('view_board')], ['cal', t('view_cal')], ['track', t('view_track')]] as const"
            :key="v" :class="{ on: view === v }" @click="view = v">{{ l }}</button>
        </div>
      </div>
      <div class="muted" style="margin-top: 7px; display: flex; align-items: center; gap: 5px">
        <Icon name="folder" :size="12" />{{ t("stored_at", { path }) }}
      </div>
    </div>

    <!-- 看板 -->
    <div v-if="view === 'board'" class="kanban">
      <div class="kcol">
        <h4 class="c-overdue"><Icon name="clock" :size="13" />{{ t("overdue") }} <span class="count">{{ overdue.length }}</span></h4>
        <div v-for="x in overdue" :key="x.line" class="kitem">
          <input type="checkbox" :checked="x.done" @change="toggle(x.line, ($event.target as HTMLInputElement).checked)">
          <div class="txt">
            {{ x.text }}
            <span v-for="tg in x.tags" :key="tg" class="tag">#{{ tg }}</span>
            <span v-if="x.due" class="due" :class="dueCls(x.due)"><Icon name="clock" :size="11" />{{ x.due }}</span>
          </div>
          <button class="ibtn sm" :title="t('del')" @click="del(x.line)"><Icon name="x" :size="12" /></button>
        </div>
        <div v-if="!overdue.length" class="empty small"><Icon name="checkCircle" :size="13" /><span>{{ t("no_overdue") }}</span></div>
      </div>
      <div class="kcol">
        <h4 class="c-active"><Icon name="flame" :size="13" />{{ t("inprog") }} <span class="count">{{ active.length }}</span></h4>
        <div v-for="x in active" :key="x.line" class="kitem">
          <input type="checkbox" :checked="x.done" @change="toggle(x.line, ($event.target as HTMLInputElement).checked)">
          <div class="txt">
            {{ x.text }}
            <span v-for="tg in x.tags" :key="tg" class="tag">#{{ tg }}</span>
            <span v-if="x.due" class="due" :class="dueCls(x.due)"><Icon name="clock" :size="11" />{{ x.due }}</span>
          </div>
          <button class="ibtn sm" :title="t('del')" @click="del(x.line)"><Icon name="x" :size="12" /></button>
        </div>
        <div v-if="!active.length" class="empty small"><Icon name="dot" :size="13" /><span>{{ t("no_inprog") }}</span></div>
      </div>
      <div class="kcol">
        <h4 class="c-done"><Icon name="checkCircle" :size="13" />{{ t("done") }} <span class="count">{{ done.length }}</span></h4>
        <div v-for="x in done.slice(-30).reverse()" :key="x.line" class="kitem done">
          <input type="checkbox" :checked="x.done" @change="toggle(x.line, ($event.target as HTMLInputElement).checked)">
          <div class="txt">
            {{ x.text }}
            <span v-for="tg in x.tags" :key="tg" class="tag">#{{ tg }}</span>
          </div>
          <button class="ibtn sm" :title="t('del')" @click="del(x.line)"><Icon name="x" :size="12" /></button>
        </div>
        <div v-if="!done.length" class="empty small"><Icon name="dot" :size="13" /><span>{{ t("no_done") }}</span></div>
      </div>
    </div>

    <!-- 日历 -->
    <div v-else-if="view === 'cal'" class="calwrap">
      <div class="card">
        <div class="nav-chips">
          <span v-for="[key, label] in [['today', t('scope_today')], ['week', t('scope_week')], ['month', t('scope_month')], ['all', t('all')]] as const"
            :key="key" class="chip" :class="{ on: scope === key }" @click="scope = key">
            {{ label }} {{ scopeCount(key) }}
          </span>
        </div>
        <div class="row" style="margin: 2px 0 10px; gap: 8px">
          <label class="row" style="gap: 6px; cursor: pointer">
            <input type="checkbox" :checked="showDone" @change="setShowDone(($event.target as HTMLInputElement).checked)">
            <span class="muted">{{ t("show_done") }}</span>
          </label>
        </div>
        <div v-for="x in scopeList" :key="x.line" class="kitem" :class="{ done: x.done }">
          <input type="checkbox" :checked="x.done" @change="toggle(x.line, ($event.target as HTMLInputElement).checked)">
          <div class="txt">
            {{ x.text }}
            <span v-for="tg in x.tags" :key="tg" class="tag">#{{ tg }}</span>
            <span v-if="x.due" class="due" :class="dueCls(x.due)"><Icon name="clock" :size="11" />{{ x.due }}</span>
          </div>
          <button class="ibtn sm" :title="t('del')" @click="del(x.line)"><Icon name="x" :size="12" /></button>
        </div>
        <div v-if="!scopeList.length" class="empty"><Icon name="calendar" :size="22" /><span>{{ t("none_in_range") }}</span></div>
      </div>

      <div class="card">
        <div class="calhead">
          <button class="ibtn ghost mini" :title="t('prev')" @click="navCal(-1)"><Icon name="chevronLeft" :size="15" /></button>
          <b>{{ calTitle }}</b>
          <button class="ibtn ghost mini" :title="t('next')" @click="navCal(1)"><Icon name="chevronRight" :size="15" /></button>
          <button class="mini" @click="calAnchor = today(); selDate = today()">{{ t("scope_today") }}</button>
          <div class="spacer" />
          <div class="pwb-seg mini">
            <button :class="{ on: calMode === 'month' }" @click="calMode = 'month'">{{ t("seg_month") }}</button>
            <button :class="{ on: calMode === 'week' }" @click="calMode = 'week'">{{ t("seg_week") }}</button>
          </div>
        </div>
        <div class="callegend">
          <span class="calchip">{{ t("legend_open") }}</span>{{ t("legend_drag") }}
          <span class="calchip overdue">{{ t("legend_overdue") }}</span>
          <span class="calchip done">{{ t("legend_done") }}</span>{{ t("legend_done_note") }}
        </div>
        <div class="calgrid">
          <div v-for="w in t('weekdays').split(',')" :key="w" class="calwd">{{ w }}</div>
          <div v-for="d in calCells" :key="isoOf(d)" class="calcell"
            :class="{ today: isoOf(d) === t0, dim: calMode === 'month' && isoOf(d).slice(0, 7) !== calAnchor.slice(0, 7), sel: isoOf(d) === selDate }"
            :title="`${isoOf(d)} · ${t('click_select')}`"
            @click="selDate = isoOf(d)"
            @dragover.prevent
            @dragenter="($event.currentTarget as HTMLElement).classList.add('dragover')"
            @dragleave="($event.currentTarget as HTMLElement).classList.remove('dragover')"
            @drop.prevent="onDrop(isoOf(d), $event)">
            <span class="calnum">{{ d.getDate() }}</span>
            <button class="cal-add" :title="t('cal_add_tip')" @click.stop="addOn(isoOf(d))">
              <Icon name="plus" :size="11" />
            </button>
            <span v-for="x in dayItems(isoOf(d))" :key="x.line"
              class="calchip" :class="{ done: x.done, overdue: !x.done && x.due! < t0 }"
              :draggable="!x.done"
              :title="`${x.text}（拖到其他日期可改期，点击勾选完成）`"
              @dragstart="$event.dataTransfer?.setData('text/pwb-line', String(x.line))"
              @click.stop="toggle(x.line, !x.done)">
              {{ x.done ? "✓ " : "" }}{{ x.text }}
            </span>
          </div>
        </div>
        <div class="caldetail">
          <div class="row">
            <b>{{ selTitle }}</b>
            <span class="muted">{{ t("n_items", { n: selItems.length }) }}</span>
            <div class="spacer" />
            <button class="mini" @click="addOn(selDate)"><Icon name="plus" :size="12" />{{ t("add_todo") }}</button>
          </div>
          <div v-for="x in selItems" :key="x.line" class="kitem" :class="{ done: x.done }">
            <input type="checkbox" :checked="x.done" @change="toggle(x.line, ($event.target as HTMLInputElement).checked)">
            <div class="txt">{{ x.text }}<span v-for="tg in x.tags" :key="tg" class="tag">#{{ tg }}</span></div>
            <button class="ibtn sm" :title="t('del')" @click="del(x.line)"><Icon name="x" :size="12" /></button>
          </div>
          <div v-if="!selItems.length" class="empty small"><Icon name="dot" :size="13" /><span>{{ t("none_this_day") }}</span></div>
        </div>
      </div>
    </div>

    <!-- 标签跟踪 -->
    <div v-else style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; margin-top: 12px; align-items: start">
      <div v-for="[tag, list] in byTag" :key="tag" class="card">
        <div class="row">
          <b>{{ tag }}</b> <span class="muted">{{ list.filter((x) => x.done).length }}/{{ list.length }}</span>
          <span v-if="list.filter((x) => !x.done && x.due && x.due < today()).length" class="due overdue">
            {{ t("n_overdue", { n: list.filter((x) => !x.done && x.due && x.due < today()).length }) }}
          </span>
        </div>
        <div class="bar"><i :style="{ width: (list.length ? Math.round((list.filter((x) => x.done).length / list.length) * 100) : 0) + '%' }" /></div>
        <div style="margin-top: 8px">
          <div v-for="x in list.filter((x) => !x.done).slice(0, 5)" :key="x.line" class="track-item">
            <span class="tdot" />
            <span class="t">{{ x.text }}<span v-if="x.due" class="due" :class="dueCls(x.due)">{{ x.due }}</span></span>
          </div>
          <div v-if="!list.filter((x) => !x.done).length" class="row" style="gap: 5px; color: var(--pwb-ok-fg); font-size: 12.5px">
            <Icon name="check" :size="13" />{{ t("all_done") }}
          </div>
        </div>
      </div>
      <div v-if="!byTag.size" class="empty" style="grid-column: 1 / -1"><Icon name="calendar" :size="22" /><span>{{ t("no_todos_yet") }}</span></div>
    </div>
  </div>
</template>
