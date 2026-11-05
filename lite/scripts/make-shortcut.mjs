// 生成快捷方式（含高科技图标）：
//   启动工作台.lnk — 完整版界面（服务没起则后台拉起，起了则直接开窗口）
// 用法：node scripts/make-shortcut.mjs [desktop]
//
// 实现说明：走"临时 .ps1 文件（UTF-8 带 BOM）+ powershell -File"而不是 -Command 传参——
// PowerShell 5.1 按 ANSI(GBK) 读无 BOM 文件，中文路径会把引号吃掉导致整段解析失败。
import { execFileSync } from "node:child_process"
import { copyFileSync, existsSync, rmSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const ico = join(projectRoot, "public", "favicon.ico")
if (!existsSync(ico)) throw new Error("缺 public/favicon.ico，先跑 node scripts/make-icon.mjs")

const ps1 = join(projectRoot, "scripts", ".make-shortcut.tmp.ps1")
const BOM = "\uFEFF"
const make = (name, body) => {
  const out = join(projectRoot, name)
  writeFileSync(
    ps1,
    BOM +
      `$ErrorActionPreference='Stop'\n` +
      `try {\n` +
      `  $s = (New-Object -ComObject WScript.Shell).CreateShortcut('${out}')\n` +
      body +
      `  $s.Save()\n` +
      `  $r = (New-Object -ComObject WScript.Shell).CreateShortcut('${out}')\n` +
      `  Write-Output ("selfcheck target={0} icon={1}" -f $r.TargetPath, $r.IconLocation)\n` +
      `} catch {\n` +
      `  Write-Output ("ERROR: {0}" -f $_.Exception.Message)\n` +
      `  exit 1\n` +
      `}\n`,
    "utf8",
  )
  const output = execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps1], { encoding: "utf8" })
  if (!output.includes("selfcheck target=C:") || output.includes("ERROR")) {
    throw new Error(`快捷方式生成失败：${output.trim()}`)
  }
  console.log("shortcut:", out, "→", output.trim().split("\n")[0])
  return out
}

/* ---------- 完整版：node server.mjs --open（端口已占则服务端打开既有窗口后退出） ---------- */
const full = make("启动工作台.lnk", `  $s.TargetPath = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
  $s.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "Start-Process -FilePath node -ArgumentList @(''server.mjs'',''--open'') -WorkingDirectory ''${projectRoot}'' -WindowStyle Hidden"'
  $s.WorkingDirectory = '${projectRoot}'
  $s.WindowStyle = 7
  $s.IconLocation = '${ico},0'
  $s.Description = 'pwb-lite 个人工作台'
`)

rmSync(ps1, { force: true })

/* ---------- 直达网址快捷方式（任务栏固定用）：服务开机自启后常驻，点击=默认浏览器瞬间直达页面，
   不经过 powershell→node 中转链。端口写死默认 8791；改过端口的话删掉本文件重新生成并改 URL。 ---------- */
const urlSh = join(projectRoot, "工作台.url")
writeFileSync(urlSh, "[InternetShortcut]\nURL=http://127.0.0.1:8791/\n", "utf8")
console.log("url-shortcut:", urlSh)

/* ---------- 桌面副本 ---------- */
if (process.argv[2] === "desktop") {
  // 桌面可能被重定向（OneDrive / 自定义位置），用系统 API 取真实路径；强制 UTF-8 输出规避控制台编码
  const desktop = execFileSync(
    "powershell.exe",
    ["-NoProfile", "-Command", "[Console]::OutputEncoding=[Text.Encoding]::UTF8; [Environment]::GetFolderPath('Desktop')"],
    { encoding: "utf8" },
  ).trim()
  if (!desktop || !existsSync(desktop)) throw new Error(`找不到桌面目录（得到：${desktop}）`)
  copyFileSync(full, join(desktop, full.split("\\").pop()))
  copyFileSync(urlSh, join(desktop, urlSh.split("\\").pop()))
  console.log("copied to desktop:", desktop, "（启动工作台.lnk + 工作台.url）")
}
