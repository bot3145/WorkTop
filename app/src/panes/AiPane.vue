<script setup lang="ts">
// AI 助手面板：远端模型 + 本地工具调用。
// 模型只能通过 Rust 侧的工具改数据（同一套原子写），每次写入都带撤销 id；
// 对话逐条落盘（AI/会话/*.jsonl），长期记忆在 AI/记忆.md，均可被 Obsidian 直接编辑。
import { computed, inject, nextTick, onMounted, onUnmounted, ref, watch, type ComputedRef } from "vue"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { toast } from "../lib/ui"
import { aiPending, type AiChatMessage, type AiConfig, type AiConfigView, type AiSessionInfo, type AiToolEvent } from "../lib/ai"
import type { T } from "../i18n"
import Icon from "../components/Icon.vue"

const t = inject<ComputedRef<T>>("t")!

interface ToolCard {
  callId: string
  name: string
  summary: string
  result: string
  ok: boolean
  undoId?: string | null
  undone?: boolean
}
interface Block {
  role: "user" | "assistant" | "error"
  text: string
  tools?: ToolCard[]
}

const blocks = ref<Block[]>([])
const input = ref("")
const streaming = ref(false)
const sessionId = ref("")
const sessions = ref<AiSessionInfo[]>([])
const cfg = ref<AiConfig | null>(null)
const hasKey = ref(false)
const keyHint = ref<string | null>(null)
const showSettings = ref(false)
const keyDraft = ref("")
const memory = ref("")
const logEl = ref<HTMLElement | null>(null)

const TOOL_LABELS: Record<string, string> = {
  todo_list: "读取待办",
  todo_add: "新增待办",
  todo_update: "修改待办",
  todo_delete: "删除待办",
  nav_list: "读取导航",
  nav_add_link: "新增链接",
  nav_add_category: "新增分类",
  nav_delete_link: "删除链接",
  nav_delete_category: "删除分类",
  note_list: "读取速记",
  note_add: "新增速记",
  note_update: "改写速记",
  note_delete: "删除速记",
  keys_list: "列出密钥文档",
  keys_read: "读取密钥文档",
  keys_write: "写入密钥文档",
  keys_delete: "删除密钥文档",
  assets_list: "读取资产",
  asset_add: "新增资产",
  asset_update: "修改资产",
  asset_delete: "删除资产",
  memory_add: "写入记忆",
}

const scrollDown = async () => {
  await nextTick()
  if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight
}

async function loadConfig() {
  try {
    const view = await invoke<AiConfigView>("ai_config_get")
    cfg.value = view.config
    hasKey.value = view.hasKey
    keyHint.value = view.keyHint ?? null
  } catch (e) {
    toast(String((e as Error).message ?? e), true)
  }
}

async function loadSessions() {
  try {
    sessions.value = await invoke<AiSessionInfo[]>("ai_sessions")
  } catch {
    sessions.value = []
  }
}

function toBlocks(msgs: AiChatMessage[]): Block[] {
  const out: Block[] = []
  for (const m of msgs) {
    if (m.role === "user") {
      out.push({ role: "user", text: m.content ?? "" })
    } else if (m.role === "assistant") {
      const text = m.content ?? ""
      const hasCalls = Array.isArray(m.toolCalls) && (m.toolCalls as unknown[]).length > 0
      if (text || hasCalls) out.push({ role: "assistant", text, tools: [] })
    } else if (m.role === "tool") {
      const last = [...out].reverse().find((b) => b.role === "assistant")
      if (last) {
        last.tools = last.tools ?? []
        last.tools.push({
          callId: m.toolCallId ?? "",
          name: "",
          summary: "工具结果",
          result: m.content ?? "",
          ok: true,
        })
      }
    }
  }
  return out
}

async function loadHistory(id: string) {
  if (!id) return
  try {
    const msgs = await invoke<AiChatMessage[]>("ai_history", { sessionId: id })
    blocks.value = toBlocks(msgs)
    await scrollDown()
  } catch {
    blocks.value = []
  }
}

async function newSession() {
  if (streaming.value) return
  sessionId.value = await invoke<string>("ai_new_session")
  blocks.value = []
  sessions.value = []
  await loadSessions()
  await scrollDown()
}

async function switchSession(id: string) {
  if (streaming.value || !id || id === sessionId.value) return
  sessionId.value = id
  await loadHistory(id)
}

async function delSession() {
  if (!sessionId.value || streaming.value) return
  try {
    await invoke("ai_delete_session", { sessionId: sessionId.value })
    toast(t.value("ai_saved"))
    await newSession()
  } catch (e) {
    toast(String((e as Error).message ?? e), true)
  }
}

function currentAssistant(): Block {
  const last = blocks.value[blocks.value.length - 1]
  if (last && last.role === "assistant") return last
  const block: Block = { role: "assistant", text: "", tools: [] }
  blocks.value.push(block)
  return block
}

async function send() {
  const text = input.value.trim()
  if (!text || streaming.value || !sessionId.value) return
  if (!hasKey.value) {
    showSettings.value = true
    toast(t.value("ai_no_key"), true)
    return
  }
  blocks.value.push({ role: "user", text })
  input.value = ""
  streaming.value = true
  await scrollDown()
  const target = sessionId.value
  try {
    await invoke("ai_send", { sessionId: target, text })
  } catch (e) {
    const err = e as { message?: string }
    blocks.value.push({ role: "error", text: err.message ?? String(e) })
    streaming.value = false
    await scrollDown()
  }
}

async function stop() {
  await invoke("ai_stop").catch(() => {})
  toast(t.value("ai_stopped"))
}

async function undo(tool: ToolCard) {
  if (!tool.undoId) return
  try {
    const msg = await invoke<string>("ai_undo", { id: tool.undoId })
    tool.undone = true
    toast(msg)
  } catch (e) {
    toast(String((e as Error).message ?? e), true)
  }
}

async function saveSettings() {
  if (!cfg.value) return
  try {
    const view = await invoke<AiConfigView>("ai_config_set", { patch: cfg.value })
    cfg.value = view.config
    hasKey.value = view.hasKey
    keyHint.value = view.keyHint ?? null
    toast(t.value("ai_saved"))
  } catch (e) {
    toast(String((e as Error).message ?? e), true)
  }
}

async function saveKey() {
  const key = keyDraft.value.trim()
  if (!key) return
  try {
    await invoke("ai_key_set", { key })
    keyDraft.value = ""
    await loadConfig()
    toast(t.value("ai_key_saved"))
  } catch (e) {
    toast(String((e as Error).message ?? e), true)
  }
}

async function clearKey() {
  await invoke("ai_key_clear").catch(() => {})
  await loadConfig()
}

async function openSettings() {
  showSettings.value = !showSettings.value
  if (showSettings.value && cfg.value) {
    try {
      memory.value = await invoke<string>("ai_memory_get")
    } catch {
      memory.value = ""
    }
  }
}

async function saveMemory() {
  try {
    await invoke("ai_memory_set", { text: memory.value })
    toast(t.value("ai_saved"))
  } catch (e) {
    toast(String((e as Error).message ?? e), true)
  }
}

let offs: Array<() => void> = []

onMounted(async () => {
  await loadConfig()
  await loadSessions()
  if (sessions.value.length) {
    sessionId.value = sessions.value[0].id
    await loadHistory(sessionId.value)
  } else {
    sessionId.value = await invoke<string>("ai_new_session")
  }
  if (aiPending.value) {
    input.value = aiPending.value
    aiPending.value = ""
  }
  offs = [
    await listen<{ sessionId: string; text: string }>("ai:delta", (e) => {
      if (e.payload.sessionId !== sessionId.value) return
      const block = currentAssistant()
      block.text += e.payload.text
      void scrollDown()
    }),
    await listen<AiToolEvent>("ai:tool", (e) => {
      const p = e.payload
      if (p.sessionId !== sessionId.value) return
      const block = currentAssistant()
      block.tools = block.tools ?? []
      if (p.phase === "start") {
        block.tools.push({
          callId: p.callId,
          name: p.name,
          summary: t.value("ai_tool_running"),
          result: JSON.stringify(p.args ?? {}, null, 2),
          ok: true,
        })
      } else {
        const card = block.tools.find((x) => x.callId === p.callId)
        if (card) {
          card.ok = p.ok !== false
          card.summary = p.ok === false ? t.value("ai_tool_failed") : "完成"
          card.result = p.result ?? ""
          card.undoId = p.undoId ?? null
        }
      }
      void scrollDown()
    }),
    await listen<{ sessionId: string; content: string }>("ai:done", (e) => {
      if (e.payload.sessionId !== sessionId.value) return
      const block = currentAssistant()
      if (!block.text) block.text = t.value("ai_empty_reply")
      streaming.value = false
      void loadSessions()
      void scrollDown()
    }),
    await listen<{ sessionId: string; message: string }>("ai:error", (e) => {
      if (e.payload.sessionId !== sessionId.value) return
      blocks.value.push({ role: "error", text: e.payload.message })
      streaming.value = false
      void scrollDown()
    }),
  ]
  watch(aiPending, (v) => {
    if (v) {
      input.value = v
      aiPending.value = ""
    }
  })
})

onUnmounted(() => {
  for (const off of offs) off()
  offs = []
})

const sessionOptions = computed(() => sessions.value.map((s) => ({ id: s.id, title: s.title || s.id })))
</script>

<template>
  <div class="ai-pane" :data-sid="sessionId" :data-streaming="streaming ? 1 : 0">
    <div class="row ai-head">
      <select v-if="sessionOptions.length" :value="sessionId" class="ai-sel" @change="switchSession(($event.target as HTMLSelectElement).value)">
        <option v-for="s in sessionOptions" :key="s.id" :value="s.id">{{ s.title }}</option>
      </select>
      <button class="mini" :disabled="streaming" @click="newSession"><Icon name="plus" :size="12" />{{ t("ai_new_session") }}</button>
      <button class="mini" :disabled="streaming" @click="delSession"><Icon name="trash" :size="12" /></button>
      <span class="spacer" />
      <button class="mini" :class="{ on: showSettings }" @click="openSettings"><Icon name="sliders" :size="12" />{{ t("ai_settings") }}</button>
    </div>

    <div v-if="showSettings" class="card ai-settings">
      <div v-if="cfg" class="ai-form">
        <label>{{ t("ai_base_url") }}<input v-model="cfg.baseUrl" placeholder="https://api.deepseek.com/v1" /></label>
        <label>{{ t("ai_model") }}<input v-model="cfg.model" placeholder="deepseek-chat" /></label>
        <div class="row" style="gap: 10px">
          <label style="flex: 1">{{ t("ai_temperature") }}
            <input v-model.number="cfg.temperature" type="number" min="0" max="2" step="0.1" /></label>
          <label style="flex: 1">{{ t("ai_max_rounds") }}
            <input v-model.number="cfg.maxRounds" type="number" min="1" max="12" /></label>
        </div>
        <label style="flex-direction: row; align-items: center; gap: 8px">
          <input v-model="cfg.allowWrite" type="checkbox" style="width: auto" />
          <span>{{ t("ai_allow_write") }}<span class="muted">（{{ t("ai_allow_write_desc") }}）</span></span>
        </label>
        <label>{{ t("ai_system_extra") }}
          <input v-model="cfg.systemExtra" :placeholder="t('ai_system_extra_ph')" /></label>
        <div class="row" style="gap: 8px; align-items: flex-end">
          <label style="flex: 1">{{ t("ai_key") }}
            <input v-model="keyDraft" type="password" :placeholder="hasKey ? keyHint ?? '' : t('ai_no_key_desc')" /></label>
          <button class="primary" @click="saveKey">{{ t("ai_key_save") }}</button>
          <button v-if="hasKey" class="mini" @click="clearKey">{{ t("ai_key_clear") }}</button>
        </div>
        <div class="row" style="justify-content: flex-end">
          <button class="primary" @click="saveSettings">{{ t("save") }}</button>
        </div>
        <div class="ai-sep" />
        <label>{{ t("ai_memory") }}<span class="muted">（{{ t("ai_memory_desc") }}）</span>
          <textarea v-model="memory" rows="5" style="font-family: ui-monospace, Consolas, monospace" /></label>
        <div class="row" style="justify-content: flex-end">
          <button class="mini" @click="saveMemory">{{ t("save") }}</button>
        </div>
      </div>
    </div>

    <div ref="logEl" class="ai-log">
      <div v-if="!blocks.length" class="ai-empty">
        <Icon name="spark" :size="26" />
        <p>{{ t("ai_welcome") }}</p>
        <p v-if="!hasKey" class="warn">{{ t("ai_no_key") }} — {{ t("ai_no_key_desc") }}</p>
        <button v-if="!hasKey" class="primary" @click="openSettings">{{ t("ai_settings") }}</button>
      </div>
      <div v-for="(b, i) in blocks" :key="i" class="ai-msg" :class="b.role">
        <div class="ai-bubble">
          <div v-if="b.text" class="ai-text">{{ b.text }}</div>
          <div v-for="tool in b.tools ?? []" :key="tool.callId + tool.name" class="ai-tool" :class="{ err: !tool.ok, undone: tool.undone }">
            <div class="ai-tool-head">
              <Icon :name="tool.ok ? 'checkCircle' : 'alert'" :size="12" />
              <b>{{ TOOL_LABELS[tool.name] ?? (tool.name || "工具") }}</b>
              <span class="muted">{{ tool.summary }}</span>
              <span class="spacer" />
              <button v-if="tool.undoId && !tool.undone" class="mini" @click="undo(tool)">{{ t("ai_undo") }}</button>
              <span v-if="tool.undone" class="muted">{{ t("ai_undone") }}</span>
            </div>
            <pre class="ai-tool-body">{{ tool.result }}</pre>
          </div>
        </div>
      </div>
      <div v-if="streaming" class="ai-thinking"><Icon name="dot" :size="8" />{{ t("ai_thinking") }}</div>
    </div>

    <div class="ai-composer">
      <textarea v-model="input" rows="2" :placeholder="t('ai_placeholder')" :disabled="streaming"
        @keydown.enter.exact.prevent="send" />
      <button v-if="!streaming" class="primary ai-send" :disabled="!input.trim()" @click="send">{{ t("ai_send") }}</button>
      <button v-else class="ai-send danger" @click="stop">{{ t("ai_stop") }}</button>
    </div>
  </div>
</template>

<style scoped>
.ai-pane { display: flex; flex-direction: column; height: 100%; min-height: 0; gap: 8px; }
.ai-head { gap: 6px; align-items: center; }
.ai-sel { max-width: 260px; height: 26px; font-size: 12px; }
.ai-settings { max-height: 46%; overflow: auto; }
.ai-form { display: flex; flex-direction: column; gap: 8px; }
.ai-form label { display: flex; flex-direction: column; gap: 3px; font-size: 12px; color: var(--pwb-text-dim); }
.ai-form input:not([type="checkbox"]), .ai-form textarea { font-size: 12.5px; }
.ai-sep { height: 1px; background: var(--pwb-border); margin: 2px 0; }

.ai-log { flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 10px; padding: 2px; }
.ai-empty { margin: auto; text-align: center; color: var(--pwb-text-dim); max-width: 420px; display: flex; flex-direction: column;
  align-items: center; gap: 8px; font-size: 12.5px; line-height: 1.6; }
.ai-empty .warn { color: #c0362c; }
.ai-msg { display: flex; }
.ai-msg.user { justify-content: flex-end; }
.ai-msg.assistant { justify-content: flex-start; }
.ai-msg.error { justify-content: flex-start; }
.ai-bubble { max-width: 88%; border-radius: 14px; padding: 8px 11px; font-size: 13px; line-height: 1.6; }
.ai-msg.user .ai-bubble { background: var(--pwb-accent); color: #fff; }
.ai-msg.assistant .ai-bubble { background: var(--pwb-card); border: 1px solid var(--pwb-border); }
.ai-msg.error .ai-bubble { background: #fdecea; color: #8c2f27; border: 1px solid #f3c7c2; }
.ai-text { white-space: pre-wrap; word-break: break-word; }
.ai-tool { margin-top: 7px; border: 1px solid var(--pwb-border); border-radius: 10px; overflow: hidden; background: rgba(0,0,0,.02); }
.ai-tool.err { border-color: #f3c7c2; }
.ai-tool.undone { opacity: .6; }
.ai-tool-head { display: flex; align-items: center; gap: 6px; padding: 5px 8px; font-size: 11.5px;
  background: rgba(0,0,0,.03); }
.ai-tool-body { margin: 0; padding: 6px 9px; font-size: 11.5px; font-family: ui-monospace, Consolas, monospace;
  white-space: pre-wrap; word-break: break-word; max-height: 140px; overflow: auto; color: var(--pwb-text-dim); }
.ai-thinking { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--pwb-text-dim); padding-left: 4px; }
.ai-composer { display: flex; gap: 8px; align-items: flex-end; }
.ai-composer textarea { flex: 1; resize: none; font-size: 13px; line-height: 1.5; }
.ai-send { height: 34px; min-width: 68px; }
.ai-send.danger { background: #c0362c; color: #fff; border-color: #c0362c; }
</style>
