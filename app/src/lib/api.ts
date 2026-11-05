// 类型化的 invoke 封装：错误归一为 AppError 形态（code/message/currentText?），
// conflict（CAS）冲突自动附最新内容，与 pwb-lite 的 409 语义一致。
import { invoke } from "@tauri-apps/api/core"

export class ApiError extends Error {
  code: string
  currentText?: string
  currentHash?: string
  currentNav?: unknown
  constructor(payload: { code?: string; message?: string; [key: string]: unknown }) {
    super(String(payload.message ?? "未知错误"))
    this.code = String(payload.code ?? "unknown")
    this.currentText = payload.currentText as string | undefined
    this.currentHash = payload.currentHash as string | undefined
    this.currentNav = payload.currentNav
  }
}

export async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args)
  } catch (raw) {
    if (raw && typeof raw === "object") throw new ApiError(raw as Record<string, string>)
    throw new ApiError({ message: String(raw) })
  }
}

/* ---------- 与 Rust 命令一一对应的类型 ---------- */

export interface TextDoc {
  text: string
  hash: string
  path: string
}

export interface TodoItem {
  line: number
  done: boolean
  text: string
  tags: string[]
  due?: string | null
}

export interface NavLink {
  title: string
  url: string
}
export interface NavCategory {
  name: string
  links: NavLink[]
}
export interface NavDoc {
  categories: NavCategory[]
}
export interface NavPayload {
  nav: NavDoc
  hash: string
}

export interface KeyDoc {
  name: string
  ext: string
  text: string
  hash: string
  chars: number
  mtimeMs: number
}
