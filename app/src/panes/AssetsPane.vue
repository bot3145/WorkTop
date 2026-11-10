<script setup lang="ts">
// 资产面板：清单 + 分组筛选 + 搜索 + TCP 探活 + 增删改 + 打开资产链接。
// 凭据只显示标签/用户名/到期（不显示密文，也不在这里编辑）——密文只在凭据面板里解锁后可读。
import { computed, inject, onMounted, ref, watch, type ComputedRef } from "vue"
import { call } from "../lib/api"
import { askConfirm, toast } from "../lib/ui"
import { guardReady, isLocked, refreshGuard } from "../lib/guard"
import type { T } from "../i18n"
import Icon from "../components/Icon.vue"
import GuardGate from "../components/GuardGate.vue"

const t = inject<ComputedRef<T>>("t")!

interface AssetLink {
  label: string
  url: string
}
interface CredApi {
  id: string
  type: string
  label: string
  username: string
  expires?: string
  expiresInDays?: number
}
interface AssetApi {
  id: string
  name: string
  host: string
  port: string
  grp: string
  project: string
  note: string
  links: AssetLink[]
  credentials: CredApi[]
  lastStatus: string
  lastCheck: string
}

const assets = ref<AssetApi[]>([])
const groups = ref<string[]>([])
const q = ref("")
const curGrp = ref("")
const busy = ref("")
const loading = ref(true)

const locked = computed(() => isLocked("assets"))

async function load() {
  loading.value = true
  try {
    const d = await call<{ assets: AssetApi[]; groups: string[] }>("assets_list")
    assets.value = d.assets
    groups.value = d.groups
  } catch (e) {
    toast(String((e as Error).message ?? e), true)
  } finally {
    loading.value = false
  }
}
onMounted(async () => {
  await refreshGuard()
  if (locked.value) loading.value = false
  else await load()
})
// 上锁后清空清单，避免资产名/主机名残留在窗口里；解锁则重新拉一次
watch(locked, (v) => {
  if (!v) {
    void load()
    return
  }
  assets.value = []
  groups.value = []
  busy.value = ""
  loading.value = false
})

const filtered = computed(() => {
  const kw = q.value.trim().toLowerCase()
  return assets.value.filter((a) => {
    if (curGrp.value && a.grp !== curGrp.value) return false
    if (!kw) return true
    return [a.name, a.host, a.port, a.grp, a.project, a.note].join("\n").toLowerCase().includes(kw)
  })
})

const statusText = (s: string) => (s === "up" ? "在线" : s === "down" ? "离线" : "未检测")

/* ---------- 探活 ---------- */
async function check(a: AssetApi) {
  busy.value = a.id
  try {
    const r = await call<{ ok: boolean; ms?: number }>("asset_check", { id: a.id })
    a.lastStatus = r.ok ? "up" : "down"
    toast(`${a.name}：${r.ok ? "在线" : "离线"}${r.ms ? `（${r.ms}ms）` : ""}`, !r.ok)
  } catch (e) {
    toast(String((e as Error).message ?? e), true)
  } finally {
    busy.value = ""
  }
}
async function checkAll() {
  for (const a of filtered.value.filter((x) => x.host && x.port)) {
    await check(a).catch(() => {})
  }
}

/* ---------- 打开链接 ---------- */
async function openLink(url: string) {
  const target = /^https?:\/\//i.test(url) ? url : `https://${url}`
  try {
    await call("open_external", { url: target })
  } catch (e) {
    toast(String((e as Error).message ?? e), true)
  }
}

/* ---------- 新增 / 编辑 ---------- */
const editing = ref<null | { id: string; name: string; host: string; port: string; grp: string; project: string; note: string }>(null)
const saving = ref(false)

function addNew() {
  editing.value = { id: "", name: "", host: "", port: "", grp: curGrp.value, project: "", note: "" }
}
function edit(a: AssetApi) {
  editing.value = { id: a.id, name: a.name, host: a.host, port: a.port, grp: a.grp, project: a.project, note: a.note }
}

async function save() {
  const e = editing.value
  if (!e || saving.value) return
  if (!e.name.trim()) {
    toast("资产名称不能为空", true)
    return
  }
  saving.value = true
  try {
    if (e.id) {
      await call("asset_update", {
        id: e.id,
        input: { name: e.name, host: e.host, port: e.port, grp: e.grp, project: e.project, note: e.note },
      })
    } else {
      await call("asset_create", {
        input: {
          name: e.name,
          host: e.host,
          port: e.port,
          grp: e.grp,
          project: e.project,
          note: e.note,
          credentials: [],
        },
      })
    }
    editing.value = null
    await load()
    toast(t.value("saved"))
  } catch (err) {
    toast(String((err as Error).message ?? err), true)
  } finally {
    saving.value = false
  }
}

async function remove(a: AssetApi) {
  const ok = await askConfirm({
    title: t.value("del"),
    message: `删除资产「${a.name}」？它的凭据小节也会一起清掉。`,
    danger: true,
    okText: t.value("ok_del"),
  })
  if (!ok) return
  try {
    await call("asset_delete", { id: a.id })
    await load()
    toast("已删除")
  } catch (e) {
    toast(String((e as Error).message ?? e), true)
  }
}

const fmtTime = (iso: string) => {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getMonth() + 1}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
</script>

<template>
  <div>
    <GuardGate v-if="guardReady && locked" module="assets" @unlocked="load" />
    <div v-else-if="!guardReady" style="height: 58vh" />
    <template v-else>
    <div class="row" style="flex-wrap: wrap; margin-bottom: 10px">
      <button class="primary" @click="addNew"><Icon name="plus" :size="14" />新增资产</button>
      <button :disabled="!!busy || !filtered.length" @click="checkAll">全部检测</button>
      <button class="ghost mini" @click="load">刷新</button>
      <div class="spacer" />
      <div class="pwb-search" style="max-width: 260px">
        <Icon name="search" :size="14" />
        <input v-model="q" placeholder="搜索名称 / 主机 / 备注…">
        <button v-if="q" class="ibtn sm pwb-search-clear" @click="q = ''"><Icon name="x" :size="11" /></button>
      </div>
    </div>

    <div class="nav-chips" style="margin-bottom: 10px">
      <span class="nav-chip" :class="{ on: !curGrp }" @click="curGrp = ''">全部 {{ assets.length }}</span>
      <span v-for="g in groups" :key="g" class="nav-chip" :class="{ on: curGrp === g }" @click="curGrp = g">
        {{ g }} {{ assets.filter((a) => a.grp === g).length }}
      </span>
    </div>

    <div v-if="loading" class="muted" style="padding: 10px 0">读取中…</div>
    <div v-else-if="!filtered.length" class="empty">
      <Icon name="server" :size="22" />
      <span>{{ assets.length ? "没有匹配的资产" : "还没有资产，点「新增资产」开始记录" }}</span>
    </div>
    <div v-else class="asset-grid">
      <div v-for="a in filtered" :key="a.id" class="asset-card card">
        <div class="ac-head">
          <span class="ac-dot" :class="a.lastStatus" :title="statusText(a.lastStatus)" />
          <b class="ac-name" :title="a.name">{{ a.name }}</b>
          <span v-if="a.grp" class="ac-chip">{{ a.grp }}</span>
          <span class="spacer" />
          <button class="ibtn sm" :disabled="busy === a.id" :title="'检测连通性'" @click="check(a)">
            <Icon name="refresh" :size="12" />
          </button>
          <button class="ibtn sm" title="编辑" @click="edit(a)"><Icon name="edit" :size="12" /></button>
          <button class="ibtn sm red" title="删除" @click="remove(a)"><Icon name="trash" :size="12" /></button>
        </div>
        <div class="ac-body">
          <div v-if="a.host" class="ac-line">
            <span class="ac-label">地址</span>
            <span class="ac-val mono">{{ a.host }}<template v-if="a.port">:{{ a.port }}</template></span>
            <span v-if="a.lastCheck" class="muted" style="font-size: 10.5px">{{ fmtTime(a.lastCheck) }}</span>
          </div>
          <div v-if="a.project" class="ac-line"><span class="ac-label">项目</span><span class="ac-val">{{ a.project }}</span></div>
          <div v-if="a.note" class="ac-line"><span class="ac-label">备注</span><span class="ac-val">{{ a.note }}</span></div>
          <div v-if="a.links.length" class="ac-line">
            <span class="ac-label">链接</span>
            <span class="ac-val ac-links">
              <button v-for="l in a.links" :key="l.url" class="ac-link" :title="l.url" @click="openLink(l.url)">
                {{ l.label }}
              </button>
            </span>
          </div>
          <div v-if="a.credentials.length" class="ac-line">
            <span class="ac-label">凭据</span>
            <span class="ac-val ac-creds">
              <span v-for="c in a.credentials" :key="c.id" class="ac-cred" :title="`${c.label || c.type} · ${c.username || '—'}`">
                <Icon name="lock" :size="10" />{{ c.label || c.type }}
                <span v-if="c.expires" class="ac-exp" :class="{ soon: (c.expiresInDays ?? 999) <= 30 }">{{ c.expires }}</span>
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 新增 / 编辑 -->
    <div v-if="editing" class="pwb-modal-bg" @mousedown.self="editing = null">
      <div class="pwb-modal" role="dialog" aria-modal="true" @keydown.esc="editing = null">
        <div class="pwb-modal-head">
          <h3>{{ editing.id ? "编辑资产" : "新增资产" }}</h3>
          <button class="ibtn" @click="editing = null"><Icon name="x" :size="14" /></button>
        </div>
        <div class="ac-form">
          <label>名称<input v-model="editing.name" placeholder="例如：Web 服务器" @keydown.enter="save"></label>
          <div class="row" style="gap: 10px">
            <label style="flex: 2">主机<input v-model="editing.host" placeholder="192.168.1.10"></label>
            <label style="flex: 1">端口<input v-model="editing.port" placeholder="22"></label>
          </div>
          <div class="row" style="gap: 10px">
            <label style="flex: 1">分组<input v-model="editing.grp" placeholder="生产 / 家庭"></label>
            <label style="flex: 1">项目<input v-model="editing.project"></label>
          </div>
          <label>备注<input v-model="editing.note"></label>
        </div>
        <div class="row" style="justify-content: flex-end; margin-top: 12px">
          <button @click="editing = null">{{ t("cancel") }}</button>
          <button class="primary" :disabled="saving" @click="save">{{ t("save") }}</button>
        </div>
      </div>
    </div>
    </template>
  </div>
</template>

<style scoped>
.asset-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 10px; }
.asset-card { padding: 10px 12px; min-width: 0; }
.ac-head { display: flex; align-items: center; gap: 7px; }
.ac-dot { width: 8px; height: 8px; border-radius: 50%; background: #c7c7cc; flex-shrink: 0; }
.ac-dot.up { background: #34c759; }
.ac-dot.down { background: #ff3b30; }
.ac-name { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ac-chip { font-size: 10.5px; color: #6e6e73; background: rgba(0,0,0,.05); border-radius: 999px; padding: 1px 7px; flex-shrink: 0; }
.ac-body { margin-top: 6px; display: flex; flex-direction: column; gap: 3px; }
.ac-line { display: flex; align-items: baseline; gap: 7px; font-size: 12px; min-width: 0; }
.ac-label { color: #a5a5aa; font-size: 10.5px; flex-shrink: 0; width: 26px; }
.ac-val { color: #1d1d1f; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.ac-val.mono { font-family: ui-monospace, Consolas, monospace; font-size: 11.5px; }
.ac-links, .ac-creds { display: flex; flex-wrap: wrap; gap: 4px; white-space: normal; }
.ac-link { border: none; background: rgba(0,0,0,.05); border-radius: 999px; padding: 1px 8px; font: inherit;
  font-size: 11px; color: #1f7a3d; cursor: pointer; }
.ac-link:hover { background: rgba(0,0,0,.09); }
.ac-cred { display: inline-flex; align-items: center; gap: 3px; font-size: 10.5px; color: #6e6e73;
  background: rgba(0,0,0,.05); border-radius: 999px; padding: 1px 7px; }
.ac-exp { color: #a5a5aa; }
.ac-exp.soon { color: #c0362c; font-weight: 600; }
.ac-form { display: flex; flex-direction: column; gap: 9px; }
.ac-form label { display: flex; flex-direction: column; gap: 3px; font-size: 12px; color: var(--pwb-text-dim); }
</style>
