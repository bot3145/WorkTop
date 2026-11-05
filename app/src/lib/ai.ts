// AI 面板的共享状态与类型：面板、窗口标题栏的「问 AI」按钮都走这里。
import { ref } from "vue"

export interface AiConfig {
  baseUrl: string
  model: string
  temperature: number
  maxRounds: number
  historyLimit: number
  allowWrite: boolean
  systemExtra: string
}

export interface AiConfigView {
  config: AiConfig
  hasKey: boolean
  keyHint?: string | null
}

export interface AiToolEvent {
  sessionId: string
  phase: "start" | "done"
  callId: string
  name: string
  args?: Record<string, unknown>
  ok?: boolean
  result?: string
  undoId?: string | null
}

export interface AiChatMessage {
  role: "system" | "user" | "assistant" | "tool"
  content?: string | null
  toolCalls?: unknown
  toolCallId?: string | null
}

export interface AiSessionInfo {
  id: string
  title: string
  mtimeMs: number
  count: number
}

/** 「问 AI」预填：面板里点了按钮后，AI 窗口取走它 */
export const aiPending = ref("")

export function askAi(prompt: string) {
  aiPending.value = prompt
}

/** 各板块的默认提问（窗口标题栏的 AI 按钮用） */
export const AI_PROMPTS: Record<string, string> = {
  todo: "帮我看一下待办：哪些今天/本周该做、有没有该改期的，需要就直接改。",
  nav: "帮我整理导航：分类是否清晰、有没有重复或失效的链接（不要自己编造 URL）。",
  note: "帮我整理最近的速记：提炼成几条要点，必要的话新建一条汇总速记。",
  keys: "帮我检查密钥文档：命名是否清晰、有没有该合并或拆分的内容（不要复述密码内容）。",
  assets: "帮我核对资产清单：缺端口/分组的补上，备注写清楚用途。",
  apps: "帮我看看应用启动器里怎么分组更顺手。",
  settings: "这个工作台有哪些设置值得调整？",
  default: "帮我看一下当前工作台的数据，有什么值得整理的？",
}
