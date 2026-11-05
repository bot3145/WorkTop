// 应用级 UI 服务：toast 与 Promise 风格对话框（Esc 取消 / Enter 确认）。
// 状态放在模块级 reactive，App.vue 统一渲染宿主。
import { reactive } from "vue"

export interface ConfirmOptions {
  title: string
  message?: string
  danger?: boolean
  okText?: string
}
export interface PromptOptions extends ConfirmOptions {
  placeholder?: string
  initial?: string
  inputType?: string
  checkboxLabel?: string
}

interface DlgState {
  kind: "confirm" | "prompt"
  title: string
  message?: string
  placeholder?: string
  initial?: string
  inputType?: string
  checkboxLabel?: string
  danger?: boolean
  okText?: string
  resolve: (value: unknown) => void
}

export const ui = reactive<{ toast: { msg: string; err?: boolean } | null; dlg: DlgState | null }>({
  toast: null,
  dlg: null,
})

let toastTimer: ReturnType<typeof setTimeout> | null = null
export function toast(msg: string, err = false) {
  ui.toast = { msg, err }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (ui.toast = null), err ? 4200 : 2200)
}

export function askConfirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    ui.dlg = { kind: "confirm", ...options, resolve: (v) => resolve(v === true) }
  })
}

export function askPrompt(options: PromptOptions): Promise<string | { text: string; checked: boolean } | null> {
  return new Promise((resolve) => {
    ui.dlg = { kind: "prompt", ...options, resolve: resolve as (value: unknown) => void }
  })
}

export function closeDlg(value: unknown) {
  const dlg = ui.dlg
  ui.dlg = null
  dlg?.resolve(value)
}
