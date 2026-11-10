// 模块锁（门禁）状态：受保护模块要先输入口令才能查看。
// 文件本身**不加密**——保持 Markdown 明文，Obsidian 可直接编辑、AI 工具可直接读写；
// 口令只拦界面访问，进程退出后由 Rust 端自动全部重新上锁。
import { ref } from "vue"
import { call } from "./api"

export type GuardModule = "keys" | "assets" | "note"

export interface GuardState {
  enabled: boolean
  modules: string[]
  unlocked: string[]
}

export const GUARD_MODULES: GuardModule[] = ["keys", "assets", "note"]

export const guard = ref<GuardState>({ enabled: false, modules: [], unlocked: [] })
/** 首次查询完成前不要急着渲染内容，避免闪一下明文 */
export const guardReady = ref(false)

const PING = "pwb_guard_ping"

/** 通知其它窗口（每个面板都是独立 webview）重新拉一次锁定状态 */
function ping() {
  try {
    localStorage.setItem(PING, String(Date.now()))
  } catch {}
}

export async function refreshGuard(): Promise<void> {
  try {
    guard.value = await call<GuardState>("guard_state_get")
  } catch {
    // 非 Tauri 环境（如 qa.html 预览）没有命令，静默按「未启用」处理
    guard.value = { enabled: false, modules: [], unlocked: [] }
  }
  guardReady.value = true
}

export function isLocked(module: GuardModule): boolean {
  const s = guard.value
  return s.enabled && s.modules.includes(module) && !s.unlocked.includes(module)
}

export async function unlockGuard(module: GuardModule, password: string): Promise<void> {
  guard.value = await call<GuardState>("guard_unlock", { module, password })
  ping()
}

export async function lockGuard(module?: GuardModule): Promise<void> {
  guard.value = await call<GuardState>("guard_lock", { module: module ?? null })
  ping()
}

export async function setGuardPassword(current: string | null, next: string): Promise<void> {
  guard.value = await call<GuardState>("guard_password_set", { current, next })
  ping()
}

export async function clearGuardPassword(password: string): Promise<void> {
  guard.value = await call<GuardState>("guard_password_clear", { password })
  ping()
}

export async function setGuardModules(modules: GuardModule[]): Promise<void> {
  guard.value = await call<GuardState>("guard_modules_set", { modules })
  ping()
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === PING) void refreshGuard()
  })
}
