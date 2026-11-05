// 开机自启（用户级）：写 HKCU\Software\Microsoft\Windows\CurrentVersion\Run 的 pwb-lite 值。
// 仅在当前用户登录时静默拉起后台服务（不打开页面）；不写 HKLM、不建计划任务，删值即完全卸载。
// Run 值会被 explorer 直接当命令行执行：项目路径不含空格，内层用单引号（powershell 字面量），避免双层引号转义。
import { execFileSync } from "node:child_process"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { StorageError } from "./store.mjs"

const RUN_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run"
export const AUTOSTART_VALUE_NAME = "pwb-lite"

export const autostartTarget = () => {
  const projectRoot = dirname(dirname(fileURLToPath(import.meta.url))) // core/ 的上一级
  return {
    valueName: AUTOSTART_VALUE_NAME,
    command: `powershell.exe -NoProfile -WindowStyle Hidden -Command Start-Process -FilePath '${process.execPath}' -ArgumentList 'server.mjs' -WorkingDirectory '${projectRoot}' -WindowStyle Hidden`,
    projectRoot,
  }
}

const regQueryValue = () => {
  try {
    const out = execFileSync("reg", ["query", RUN_KEY, "/v", AUTOSTART_VALUE_NAME], {
      encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "ignore"],
    })
    const m = out.match(/REG_SZ\s+(.*)/)
    return m ? m[1].trim() : ""
  } catch {
    return ""
  }
}

export const autostartStatus = () => {
  if (process.platform !== "win32") return { supported: false, enabled: false, upToDate: false, command: "" }
  const { command } = autostartTarget()
  const current = regQueryValue()
  return { supported: true, enabled: Boolean(current), upToDate: current === command, command: current || command }
}

export const setAutostart = (enabled) => {
  if (process.platform !== "win32") throw new StorageError("开机自启仅支持 Windows。", 501)
  const { command } = autostartTarget()
  if (enabled) {
    execFileSync("reg", ["add", RUN_KEY, "/v", AUTOSTART_VALUE_NAME, "/t", "REG_SZ", "/d", command, "/f"], { windowsHide: true, stdio: "ignore" })
  } else {
    execFileSync("reg", ["delete", RUN_KEY, "/v", AUTOSTART_VALUE_NAME, "/f"], { windowsHide: true, stdio: "ignore" })
  }
  return autostartStatus()
}
