// pwb-lite 共享核心：业务路由与数据操作，传输层无关。
// 数据真源是 data/ 下的三个 Markdown 文档（见 core/store.mjs），无数据库、无加密层。
//
// handle(method, segments, { query, body }) 统一返回：
//   { status, json }                常规 JSON 响应
//   { status, raw, type, headers? } 二进制响应（图标）
// 抛出的 StorageError 在内部转换为 { status, json: { ok:false, error } }。
import { createHash, createHmac, randomBytes } from "node:crypto"
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs"
import { isAbsolute, join, resolve } from "node:path"
import { execFileSync, spawn } from "node:child_process"
import net from "node:net"
import { Readable } from "node:stream"
import { fileURLToPath } from "node:url"
import { parseTodos } from "./todo.mjs"
import { AI_PROVIDERS, isDangerousCommand, maskKey, normalizeAiConfig, runAiChat, testConnection } from "./ai.mjs"
import { autostartStatus, setAutostart } from "./autostart.mjs"
import { decryptSecret, deriveKey, encryptSecret, isEncrypted, parseAssets, parseCredDoc, parseNav, readDoc, readSettings, serializeAssets, serializeCredDoc, serializeNav, sha256, StorageError, writeDoc, writeSettings, oneLine } from "./store.mjs"

const VERSION = "2.6.3"
export const API_PREFIX = "/api/pwb-lite"

const rid = () => randomBytes(5).toString("hex") + Date.now().toString(36).slice(-3)

/* ---------- 应用启动器（快捷方式目录扫描 + 一键启动），沿用验证过的实现 ---------- */
const SHORTCUT_RE = /\.(lnk|url)$/u
const SHORTCUT_NAME_BAD = /[/\\:*?"<>|\u0000-\u001f]/u

const isDir = (path) => {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

// 默认目录按序探测常见位置，第一个真实存在的胜出；全部不存在则置空，由界面引导设置。
const APPS_DIR_CANDIDATES = [
  "D:\\obsidian\\00-个人资料\\01-工作台",
  "D:\\obsidian\\01-工作台",
  join(process.env.USERPROFILE ?? "", "Desktop"),
].filter(Boolean)
const discoverAppsDir = () => APPS_DIR_CANDIDATES.find((dir) => isDir(dir)) ?? null
const appsDirCandidates = () => APPS_DIR_CANDIDATES.filter((dir) => isDir(dir))

export async function createCore({ root, appsDir, logger } = {}) {
  const log = (level, message) => logger?.[level]?.(message instanceof Error ? message : String(message))
  if (typeof root !== "string" || root.trim() === "") throw new StorageError("pwb-lite 未配置数据目录。")
  if (!isAbsolute(root)) throw new StorageError(`数据目录必须是绝对路径：${root}`)
  const base = root
  const keysDocsDir = join(base, "密钥")
  const files = {
    todo: join(base, "待办.md"),
    nav: join(base, "导航.md"),
    assets: join(base, "资产.md"),
    creds: join(base, "凭据.md"),
    settings: join(base, "设置.json"),
    note: join(base, "速记.md"),
  }
  mkdirSync(join(base, "cache", "icons"), { recursive: true })
  mkdirSync(join(base, "cache", "appicons"), { recursive: true })
  mkdirSync(join(base, "tokens"), { recursive: true })
  mkdirSync(keysDocsDir, { recursive: true })

  /* ---------- 令牌文件：统一保存到 <data>/tokens/<资产名>/<文件名> ---------- */
  // 路径段清洗：拒绝路径穿越与 Windows 非法字符/保留名，保留中文等合法字符。
  const WIN_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/iu
  const cleanPathSeg = (raw, label) => {
    const value = String(raw ?? "").replace(/[/\\:*?"<>|\u0000-\u001f]/gu, "_").replace(/^\.+/, "").trim()
    if (!value || value.includes("..")) throw new StorageError(`${label}含非法字符（不允许路径穿越片段）。`, 400)
    if (WIN_RESERVED.test(value)) throw new StorageError(`${label}是 Windows 保留名，请改名。`, 400)
    return value.slice(0, 120)
  }
  const TOKEN_MAX_BYTES = 5 * 1024 * 1024
  const saveTokenFile = (assetName, fileName, contentBase64) => {
    let buffer
    try {
      buffer = Buffer.from(String(contentBase64 ?? ""), "base64")
    } catch {
      throw new StorageError("文件内容不是合法的 base64。", 400)
    }
    if (!buffer.length) throw new StorageError("文件内容为空。", 400)
    if (buffer.length > TOKEN_MAX_BYTES) throw new StorageError("令牌文件超过 5 MB 上限。", 413)
    const dir = join(base, "tokens", cleanPathSeg(assetName, "资产名"))
    const full = join(dir, cleanPathSeg(fileName, "文件名"))
    mkdirSync(dir, { recursive: true })
    writeFileSync(full, buffer)
    return { path: full, bytes: buffer.length }
  }

  /* ---------- 应用启动器内部设施 ---------- */

  const appsPrefs = () => {
    const settings = readSettings(files.settings)
    const prefs = settings.apps
    return prefs && typeof prefs === "object" ? prefs : {}
  }

  // 目录优先级：界面设置（设置.json）> 宿主选项（CLI/环境变量）> 自动探测。
  const appsConfiguredDir = () => {
    const prefs = appsPrefs()
    const candidates = [
      [typeof prefs.dir === "string" ? prefs.dir.trim() : "", "prefs"],
      [typeof appsDir === "string" ? appsDir.trim() : "", "option"],
      [discoverAppsDir() ?? "", "auto"],
    ]
    for (const [value, from] of candidates) {
      if (value && isAbsolute(value)) {
        const dir = resolve(value)
        return { dir, from, exists: isDir(dir) }
      }
    }
    return { dir: null, from: null, exists: false }
  }

  const listShortcuts = (dir) => {
    const apps = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !SHORTCUT_RE.test(entry.name)) continue
      let mtime = null
      try {
        mtime = statSync(join(dir, entry.name)).mtime.toISOString()
      } catch {}
      apps.push({
        file: entry.name,
        name: entry.name.replace(SHORTCUT_RE, ""),
        ext: entry.name.toLowerCase().endsWith(".url") ? "url" : "lnk",
        mtime,
      })
    }
    return apps.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN")).slice(0, 2000)
  }

  // 只接受目录内的普通文件名（禁止路径分隔符/Windows 非法字符），再按真实目录校验一遍。
  const safeShortcutFile = (dir, file) => {
    const name = String(file ?? "")
    if (!name || name.length > 200 || SHORTCUT_NAME_BAD.test(name) || !SHORTCUT_RE.test(name)) return null
    const full = join(dir, name)
    try {
      return statSync(full).isFile() && resolve(full) === join(resolve(dir), name) ? full : null
    } catch {
      return null
    }
  }

  const startDetached = (target) => {
    if (process.platform !== "win32") throw new StorageError("应用启动仅支持 Windows。", 501)
    // explorer.exe 直接解析路径：绕开 cmd start 的元字符注入面（文件名里的 & ^ % 会被 cmd 当命令语法）
    const child = spawn("explorer.exe", [target], { detached: true, stdio: "ignore", windowsHide: true })
    child.unref()
  }

  // 图标提取：PowerShell 全 ASCII 脚本，中文路径经 base64 环境变量传入（规避 UTF-8 BOM 的坑）。
  const PS_ICON_SCRIPT = `$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$src=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:PWB_SRC_B64))
$out=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:PWB_OUT_B64))
$icon=$null
try{ $icon=[System.Drawing.Icon]::ExtractAssociatedIcon($src) }catch{}
if(-not $icon -and $src.EndsWith('.lnk',[StringComparison]::OrdinalIgnoreCase)){
  try{
    $t=(New-Object -ComObject WScript.Shell).CreateShortcut($src).TargetPath
    if($t -and (Test-Path -LiteralPath $t)){ $icon=[System.Drawing.Icon]::ExtractAssociatedIcon($t) }
  }catch{}
}
if(-not $icon){ exit 2 }
$bmp=$icon.ToBitmap()
$bmp.Save($out,[System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output 'ok'`

  const APPICONS_DIR = join(base, "cache", "appicons")
  const APPICON_NEG_TTL = 10 * 60 * 1000
  const appiconNeg = new Map()
  let appiconActive = 0
  const appiconQueue = []
  const withExtractSlot = (fn) =>
    new Promise((done) => {
      const run = () => {
        appiconActive++
        Promise.resolve(fn())
          .finally(() => {
            appiconActive--
            appiconQueue.shift()?.()
          })
          .then(() => done(), () => done())
      }
      appiconActive < 4 ? run() : appiconQueue.push(run)
    })

  const extractIconPng = (source, outFile) =>
    withExtractSlot(
      () =>
        new Promise((settled) => {
          const child = spawn(
            "powershell.exe",
            ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", PS_ICON_SCRIPT],
            {
              windowsHide: true,
              env: {
                ...process.env,
                PWB_SRC_B64: Buffer.from(source, "utf8").toString("base64"),
                PWB_OUT_B64: Buffer.from(outFile, "utf8").toString("base64"),
              },
            },
          )
          let settledDone = false
          const timer = setTimeout(() => {
            try {
              child.kill()
            } catch {}
            finish(false)
          }, 15000)
          const finish = (ok) => {
            if (settledDone) return
            settledDone = true
            clearTimeout(timer)
            settled(ok)
          }
          child.on("error", () => finish(false))
          child.on("exit", () => finish(true))
        }),
    )

  const resolveAppIcon = (file) => {
    if (process.platform !== "win32") return null
    const { dir, exists } = appsConfiguredDir()
    if (!dir || !exists) return null
    const full = safeShortcutFile(dir, file)
    if (!full) return null
    const key = createHash("sha1").update(`${resolve(dir).toLowerCase()}|${full.toLowerCase()}`).digest("hex").slice(0, 20)
    const cached = join(APPICONS_DIR, `${key}.png`)
    try {
      const shortcut = statSync(full)
      const hit = statSync(cached)
      if (hit.isFile() && hit.size > 100 && hit.mtimeMs >= shortcut.mtimeMs) return { buffer: readFileSync(cached) }
    } catch {}
    const until = appiconNeg.get(key)
    if (until && Date.now() < until) return null
    // .url 的图标可能记录在 IconFile= 里，优先用记录的文件提取
    let source = full
    if (/\.url$/iu.test(full)) {
      try {
        const hit = readFileSync(full, "utf8").match(/^IconFile\s*=\s*(.+)$/imu)
        if (hit?.[1]?.trim() && existsSync(hit[1].trim())) source = hit[1].trim()
      } catch {}
    }
    mkdirSync(APPICONS_DIR, { recursive: true })
    const ok = extractIconPng(source, cached)
    if (ok) {
      try {
        const hit = statSync(cached)
        if (hit.isFile() && hit.size > 100) return { buffer: readFileSync(cached) }
      } catch {}
    }
    appiconNeg.set(key, Date.now() + APPICON_NEG_TTL)
    return null
  }

  /* ---------- 资产（资产.md）+ 凭据库（凭据.md，可主口令加密） ----------
     凭据与资产分文件：资产.md 可同步/可 git；凭据.md 是隐私面，整文件差异化保护。
     加密学 HexHub 的"口令派生密钥"思路但纯本地：scrypt(主口令) → AES-256-GCM，
     只加密条目里的 secret/passphrase 字段（ENC:v1:…），条目结构保持可读。 */

  const expiresDaysLeft = (date) => {
    if (!date) return null
    const days = Math.ceil((Date.parse(date) - Date.now()) / 86400000)
    return Number.isFinite(days) ? days : null
  }

  const assetIdOf = (name) => sha256(name).slice(0, 10)
  // 凭据 id：条目里钉死的 id 优先（加密/解密会改 secret 落盘值，内容哈希只用于首次生成）
  const credIdOf = (assetName, credential) =>
    credential.id || sha256(`${assetName}|${credential.type ?? ""}|${credential.label ?? ""}|${credential.username ?? ""}|${credential.secret ?? ""}`).slice(0, 12)

  const normalizeExpires = (value) => {
    if (value === undefined || value === null || value === "") return null
    const text = String(value).trim().slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(text) || Number.isNaN(Date.parse(text))) {
      throw new StorageError("到期日需为 YYYY-MM-DD 格式。", 400)
    }
    return text
  }
  const normalizeType = (value) => (value === "key" ? "private-key" : oneLine(value) || "password")

  /* ----- 凭据库（主口令保险库） ----- */
  let vaultKey = null
  const vaultConfig = () => readSettings(files.settings).vault ?? null
  const vaultEnabled = () => Boolean(vaultConfig()?.salt)
  const vaultState = () => ({ enabled: vaultEnabled(), unlocked: vaultEnabled() && Boolean(vaultKey) })
  const assertVaultKey = () => {
    if (!vaultKey) throw new StorageError("凭据库已加密且未解锁：请先在资产页解锁（或关闭加密）。", 423)
    return vaultKey
  }
  const vaultCheck = (key) => createHmac("sha256", key).update("pwb-lite-vault-check").digest("base64")

  const normalizeEntry = (credential) => ({
    ...(credential.id ? { id: credential.id } : {}),
    type: normalizeType(credential.type),
    label: oneLine(credential.label ?? ""),
    username: oneLine(credential.username ?? ""),
    ...(credential.expires ? { expires: credential.expires } : {}),
    ...(credential.passphrase ? { passphrase: String(credential.passphrase) } : {}),
    secret: String(credential.secret ?? ""),
  })
  const sealEntry = (entry) => {
    if (!vaultEnabled()) return entry
    const key = assertVaultKey()
    const salt = vaultConfig().salt
    const sealed = { ...entry }
    if (sealed.secret && !isEncrypted(sealed.secret)) sealed.secret = encryptSecret(sealed.secret, key, salt)
    if (sealed.passphrase && !isEncrypted(sealed.passphrase)) sealed.passphrase = encryptSecret(sealed.passphrase, key, salt)
    return sealed
  }
  const openEntry = (entry, key) => {
    const opened = { ...entry }
    if (isEncrypted(opened.secret)) opened.secret = decryptSecret(opened.secret, key)
    if (opened.passphrase && isEncrypted(opened.passphrase)) opened.passphrase = decryptSecret(opened.passphrase, key)
    return opened
  }

  // 凭据.md → Map<资产名, entry[]>；旧类型 key 归一为 private-key；首次见到条目时钉死 id
  const loadCreds = () => {
    const map = parseCredDoc(readDoc(files.creds)?.text ?? "")
    for (const [name, list] of map) {
      map.set(
        name,
        list
          .map((raw) => {
            try {
              const parsed = JSON.parse(raw)
              if (!parsed || typeof parsed !== "object") return null
              const entry = normalizeEntry(parsed)
              entry.id ||= credIdOf(name, entry)
              return entry
            } catch {
              return null
            }
          })
          .filter(Boolean),
      )
    }
    return map
  }
  const mutateCreds = (mutator) => {
    const map = loadCreds()
    const result = mutator(map)
    writeDoc(files.creds, serializeCredDoc(map))
    return result
  }

  // 旧版把凭据内嵌在 资产.md：启动时一次性搬到 凭据.md（只搬一次，搬完 资产.md 不再含凭据行）
  const migrateCredentialSplit = () => {
    const doc = readDoc(files.assets)
    if (!doc) return
    const assets = parseAssets(doc.text)
    const withCreds = assets.filter((asset) => (asset.credentials ?? []).length)
    if (!withCreds.length) return
    mutateCreds((map) => {
      for (const asset of withCreds) {
        const list = map.get(asset.name) ?? []
        list.push(...asset.credentials.map(normalizeEntry))
        map.set(asset.name, list)
        asset.credentials = []
      }
    })
    writeDoc(files.assets, serializeAssets(assets))
    log("info", "pwb-lite: 凭据已拆分到 data/凭据.md（隐私面独立）")
  }
  migrateCredentialSplit()

  /* ---------- 凭据库"本机记住解锁"：口令以 DPAPI（CurrentUser）加密存 data/.vault-remember，
     仅当前 Windows 用户可解；启动时静默解锁。显式锁定/关闭加密会删除记忆文件。 ---------- */
  const REMEMBER_FILE = join(base, ".vault-remember")
  const PS_DPAPI_PROTECT = `$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Security
$plain = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:PWB_IN_B64))
$enc = [Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($plain), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
[Convert]::ToBase64String($enc)`
  const PS_DPAPI_UNPROTECT = `$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Security
$enc = [Convert]::FromBase64String($env:PWB_IN_B64)
$plain = [Security.Cryptography.ProtectedData]::Unprotect($enc, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
[Convert]::ToBase64String($plain)`
  const dpapiRun = (script, env) => execFileSync("powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
    { windowsHide: true, timeout: 15000, encoding: "utf8", env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "ignore"] })
  const rememberWrite = (passphrase) => {
    const out = dpapiRun(PS_DPAPI_PROTECT, { PWB_IN_B64: Buffer.from(passphrase, "utf8").toString("base64") }).trim()
    writeFileSync(REMEMBER_FILE, out)
  }
  const rememberClear = () => { try { unlinkSync(REMEMBER_FILE) } catch {} }
  const rememberPassphrase = () => {
    if (!existsSync(REMEMBER_FILE)) return null
    try {
      const b64 = dpapiRun(PS_DPAPI_UNPROTECT, { PWB_IN_B64: readFileSync(REMEMBER_FILE, "utf8").trim() }).trim()
      return Buffer.from(b64, "base64").toString("utf8")
    } catch {
      return null
    }
  }
  if (vaultEnabled() && existsSync(REMEMBER_FILE)) {
    const remembered = rememberPassphrase()
    if (remembered) {
      const cfg = vaultConfig()
      const key = deriveKey(remembered, Buffer.from(cfg.salt, "base64"))
      if (vaultCheck(key) === cfg.check) {
        vaultKey = key
        log("info", "pwb-lite: 凭据库已通过本机记忆自动解锁")
      }
    }
  }

  // 读文件并把存储形态补全成 API 形态（id、expiresInDays；secret 不随列表下发）
  const loadAssets = () => {
    const assets = parseAssets(readDoc(files.assets)?.text ?? "")
    const creds = loadCreds()
    return assets.map((asset) => ({
      ...asset,
      id: assetIdOf(asset.name),
      credentials: (creds.get(asset.name) ?? []).map((credential) => {
        const { secret, passphrase, ...rest } = credential
        return {
          ...rest,
          id: credIdOf(asset.name, credential),
          ...(credential.expires ? { expiresInDays: expiresDaysLeft(credential.expires) } : {}),
        }
      }),
    }))
  }

  const mutateAssets = (mutator) => {
    const assets = parseAssets(readDoc(files.assets)?.text ?? "")
    const result = mutator(assets)
    writeDoc(files.assets, serializeAssets(assets))
    return result
  }

  const findAsset = (assets, id) => {
    const asset = assets.find((a) => assetIdOf(a.name) === id)
    if (!asset) throw new StorageError("资产不存在。", 404)
    return asset
  }

  const tcpProbe = (host, port, timeoutMs = 2500) =>
    new Promise((resolved) => {
      const socket = net.connect({ host, port: Number(port) })
      const done = (ok) => {
        socket.destroy()
        resolved(ok)
      }
      socket.setTimeout(timeoutMs, () => done(false))
      socket.on("connect", () => done(true))
      socket.on("error", () => done(false))
    })

  /* ---------- 待办 / 导航 读写（整文档 + 哈希 CAS） ---------- */

  const readTodo = () => {
    const doc = readDoc(files.todo)
    if (!doc) throw new StorageError("待办文件不存在（可能被外部删除）；PUT todo 可重建。", 404)
    return { ...doc, path: files.todo }
  }

  const readNav = () => {
    const doc = readDoc(files.nav)
    const nav = doc ? parseNav(doc.text) : { categories: [] }
    return { nav, hash: doc?.hash ?? sha256(serializeNav(nav)) }
  }

  const writeNav = (nav) => writeDoc(files.nav, serializeNav(nav)).hash

  /* ---------- 后台任务：系统通知、资产状态轮询（10 分钟）、每日待办摘要（09:00） ---------- */
  const PS_BALLOON = `$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$ni = New-Object System.Windows.Forms.NotifyIcon
$ni.Icon = [System.Drawing.SystemIcons]::Warning
$ni.Visible = $true
$title = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:PWB_TITLE_B64))
$text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:PWB_TEXT_B64))
$ni.ShowBalloonTip(8000, $title, $text, [System.Windows.Forms.ToolTipIcon]::Warning)
Start-Sleep -Seconds 8
$ni.Dispose()`
  const notifyToast = (title, message) => {
    if (process.platform !== "win32") return
    try {
      const child = spawn("powershell.exe",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", PS_BALLOON],
        {
          detached: true, windowsHide: true, stdio: "ignore",
          env: {
            ...process.env,
            PWB_TITLE_B64: Buffer.from(title, "utf8").toString("base64"),
            PWB_TEXT_B64: Buffer.from(message, "utf8").toString("base64"),
          },
        })
      child.unref()
    } catch {}
  }

  // 资产状态轮询：10 分钟一轮；只在状态翻转（在线→离线）时弹系统通知，首轮只建立基线不通知。
  const PROBE_INTERVAL_MS = 10 * 60 * 1000
  const lastStatuses = new Map()
  let probeBusy = false
  const probeAllAssets = async () => {
    if (probeBusy) return
    probeBusy = true
    try {
      const targets = loadAssets().filter((a) => a.host && a.port)
      for (const asset of targets) {
        const ok = await tcpProbe(asset.host, asset.port)
        const state = ok ? "up" : "down"
        const prev = lastStatuses.get(asset.name)
        lastStatuses.set(asset.name, state)
        if (prev === "up" && state === "down") {
          notifyToast(`资产离线：${asset.name}`, `${asset.host}${asset.port ? ":" + asset.port : ""} TCP 探测失败`)
        }
      }
    } catch (error) {
      log("warn", error)
    } finally {
      probeBusy = false
    }
  }

  // 每日待办摘要：每天 09:00 后首个检查点发一条（有今日到期或逾期才发）；cache 目录记日期防重发。
  const pad2s = (n) => String(n).padStart(2, "0")
  const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${pad2s(d.getMonth() + 1)}-${pad2s(d.getDate())}` }
  const TODO_NOTIFY_AT = "09:00"
  const todoNotifyStamp = join(base, "cache", "todo-notify-date")
  const dailyTodoDigest = () => {
    try {
      const now = new Date()
      if (`${pad2s(now.getHours())}:${pad2s(now.getMinutes())}` < TODO_NOTIFY_AT) return
      const stamp = localToday()
      let last = ""
      try { last = readFileSync(todoNotifyStamp, "utf8").trim() } catch {}
      if (last === stamp) return
      writeFileSync(todoNotifyStamp, stamp)
      const items = parseTodos(readDoc(files.todo)?.text ?? "")
      const openItems = items.filter((x) => !x.done)
      const odCount = openItems.filter((x) => x.due && x.due < stamp).length
      const dueCount = openItems.filter((x) => x.due === stamp).length
      if (odCount + dueCount > 0) {
        notifyToast(`今日待办：${dueCount} 项到期${odCount ? `，${odCount} 项逾期` : ""}`, "打开个人工作台查看详情")
      }
    } catch (error) {
      log("warn", error)
    }
  }
  const bgTimers = []
  bgTimers.push(setTimeout(() => { probeAllAssets(); dailyTodoDigest() }, 20000))
  bgTimers.push(setInterval(probeAllAssets, PROBE_INTERVAL_MS))
  bgTimers.push(setInterval(dailyTodoDigest, 20 * 60 * 1000))
  for (const timer of bgTimers) timer.unref?.()

    // AI 写/危险操作的用户确认登记簿：id → true(批准)/false(拒绝)/null(待决)；POST ai/confirm 写入
    const approvals = new Map()
    const confirmToolNames = new Set(["add_todo", "add_note", "add_asset", "ssh_exec"])
    const aiTools = [
      { type: "function", function: { name: "read_todo", description: "读取用户当前待办清单（Markdown 格式，含完成状态与截止日）", parameters: { type: "object", properties: {} } },
        exec: async () => (readTodo().text || "(空)").slice(0, 4000) },
      { type: "function", function: { name: "read_note", description: "读取用户最近的速记内容", parameters: { type: "object", properties: {} } },
        exec: async () => (readDoc(files.note)?.text ?? "(空)").slice(-4000) },
      { type: "function", function: { name: "list_assets", description: "列出全部服务器资产：名称/主机/端口/分组/在线状态", parameters: { type: "object", properties: {} } },
        exec: async () => JSON.stringify(loadAssets().map((a) => ({ name: a.name, host: a.host, port: a.port, grp: a.grp, status: a.last_status || "未检" }))) },
      { type: "function", function: { name: "probe_asset", description: "对指定资产发起 TCP 在线探测", parameters: { type: "object", properties: { name: { type: "string", description: "资产名称（精确）" } }, required: ["name"] } },
        exec: async (args) => { const target = loadAssets().find((x) => x.name === String(args?.name ?? "")); if (!target) return "资产不存在"; const ok = await tcpProbe(target.host, target.port); return ok ? "在线" : "离线" } },
      { type: "function", function: { name: "search_nav", description: "按关键词搜索用户的导航链接", parameters: { type: "object", properties: { keyword: { type: "string", description: "关键词" } }, required: ["keyword"] } },
        exec: async (args) => { const { nav } = readNav(); const kw = String(args?.keyword ?? "").toLowerCase(); const hits = nav.categories.flatMap((c) => (c.links ?? []).map((l) => ({ cat: c.name, title: l.title, url: l.url }))).filter((l) => (l.title + " " + l.url).toLowerCase().includes(kw)).slice(0, 20); return JSON.stringify(hits.length ? hits : "无匹配") } },
      { type: "function", function: { name: "list_keydocs", description: "列出密钥文档的名称与扩展名（只给名称，不给内容）", parameters: { type: "object", properties: {} } },
        exec: async () => { const names = readdirSync(keysDocsDir).map((f) => { const ext = f.toLowerCase().match(/\.(md|txt)$/u)?.[1]; return ext ? f.slice(0, -(ext.length + 1)) + "." + ext : null }).filter(Boolean); return names.length ? names.join(", ") : "无" } },
      // ---- 以下为写/危险操作：confirm:true，执行前必须经用户批准 ----
      { type: "function", function: { name: "add_todo", description: "为用户新增一条待办（文本可含 #标签 与 @YYYY-MM-DD 截止日）", parameters: { type: "object", properties: { text: { type: "string", description: "待办内容" } }, required: ["text"] }, confirm: true, summary: (a) => "新增待办：" + String(a?.text ?? "").slice(0, 120) },
        exec: async (args) => { const text = String(args?.text ?? "").trim().slice(0, 300); if (!text) return "内容为空"; const doc = readDoc(files.todo); writeDoc(files.todo, (doc ? doc.text.trimEnd() + "\n" : "") + "- [ ] " + text + "\n"); return "已添加待办" } },
      { type: "function", function: { name: "add_note", description: "为用户新增一条速记", parameters: { type: "object", properties: { text: { type: "string", description: "速记内容" } }, required: ["text"] }, confirm: true, summary: (a) => "新增速记：" + String(a?.text ?? "").slice(0, 120) },
        exec: async (args) => { const text = String(args?.text ?? "").trim().slice(0, 1000); if (!text) return "内容为空"; const d = new Date(); const stamp = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); const doc = readDoc(files.note); writeDoc(files.note, (doc ? doc.text.trimEnd() + "\n\n" : "") + "## " + stamp + "\n" + text + "\n"); return "已添加速记" } },
      { type: "function", function: { name: "add_asset", description: "新增一台服务器资产（不含凭据）", parameters: { type: "object", properties: { name: { type: "string", description: "资产名称（唯一）" }, host: { type: "string", description: "IP 或域名" }, port: { type: "string", description: "端口" }, grp: { type: "string", description: "分组" }, note: { type: "string", description: "备注" } }, required: ["name", "host"] }, confirm: true, summary: (a) => "新增资产：" + String(a?.name ?? "") + "（" + String(a?.host ?? "") + "）" },
        exec: async (args) => {
          const name = String(args?.name ?? "").trim().slice(0, 80); const host = String(args?.host ?? "").trim().slice(0, 120)
          if (!name || !host) return "名称与主机必填"
          const assets = parseAssets(readDoc(files.assets)?.text ?? "")
          if (assets.some((a) => a.name === name)) return "同名资产已存在，未创建"
          assets.push({ name, host, port: String(args?.port ?? "").trim(), grp: String(args?.grp ?? "").trim(), project: String(args?.project ?? "").trim(), note: String(args?.note ?? "").trim(), links: [], credentials: [], last_status: "", last_check: "" })
          writeDoc(files.assets, serializeAssets(assets))
          return "已创建资产：" + name
        } },
      { type: "function", function: { name: "ssh_exec", description: "在指定资产上执行 SSH 命令（需该资产已配置 SSH 密钥登录；危险命令会被拦截；每次执行需用户批准）", parameters: { type: "object", properties: { asset: { type: "string", description: "资产名称（精确）" }, command: { type: "string", description: "要执行的命令" } }, required: ["asset", "command"] }, confirm: true, summary: (a) => "SSH 执行 [" + String(a?.asset ?? "") + "]：" + String(a?.command ?? "").slice(0, 120) },
        exec: async (args) => {
          const target = loadAssets().find((x) => x.name === String(args?.asset ?? ""))
          if (!target) return "资产不存在"
          const command = String(args?.command ?? "").trim()
          if (!command) return "命令为空"
          if (isDangerousCommand(command)) return "已拦截危险命令，拒绝执行"
          if (process.platform !== "win32") return "仅支持 Windows"
          const user = (target.credentials ?? [])[0]?.username ?? "root"
          const port = target.port || 22
          return await new Promise((resolved) => {
            const child = spawn("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=8", "-o", "StrictHostKeyChecking=accept-new", "-p", String(port), user + "@" + target.host, command], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] })
            let out = ""
            const timer = setTimeout(() => child.kill(), 15000)
            child.stdout.on("data", (c) => (out += c.toString()))
            child.stderr.on("data", (c) => (out += c.toString()))
            child.on("error", (e) => { clearTimeout(timer); resolved("ssh 启动失败: " + e.message + "（需该资产支持 SSH 密钥登录）") })
            child.on("close", (code) => { clearTimeout(timer); resolved("exit=" + code + "\n" + out.slice(0, 2000)) })
          })
        } },
    ]

  /* ---------- AI 会话持久化（data/对话/）：普通会话与资产会话分开存，归档单独收纳 ----------
     会话/<id>.json · 资产/<资产名>/<id>.json · 归档/<id>.json；资产名做文件名安全化，原始名存 JSON 内。 */
  const AI_SESSION_ID_RE = /^[A-Za-z0-9_-]{4,40}$/
  const AI_SESSIONS_ROOT = join(base, "对话")
  const safeAssetDir = (name) => {
    const cleaned = oneLine(name).replace(/[/\\:*?"<>|\u0000-\u001f]/gu, "_").slice(0, 80)
    return cleaned || "未命名"
  }
  const aiSessionDirOf = (session) => {
    if (session.archived) return join(AI_SESSIONS_ROOT, "归档")
    const assetName = session.asset && session.asset.name
    return assetName ? join(AI_SESSIONS_ROOT, "资产", safeAssetDir(assetName)) : join(AI_SESSIONS_ROOT, "会话")
  }
  const assertSessionId = (id) => {
    if (!AI_SESSION_ID_RE.test(String(id ?? ""))) throw new StorageError("会话 id 不合法。", 400)
  }
  // 在三个根目录里定位会话文件；返回 { session, archived, file } 或抛 404
  const locateAiSession = (id) => {
    assertSessionId(id)
    const tries = [
      { sub: join("会话"), archived: false },
      { sub: join("归档"), archived: true },
    ]
    for (const t of tries) {
      const file = join(AI_SESSIONS_ROOT, t.sub, `${id}.json`)
      try {
        const session = JSON.parse(readFileSync(file, "utf8"))
        return { session: { ...session, id, archived: t.archived }, archived: t.archived, file }
      } catch {}
    }
    let dirs = []
    try { dirs = readdirSync(join(AI_SESSIONS_ROOT, "资产")) } catch {}
    for (const dir of dirs) {
      const file = join(AI_SESSIONS_ROOT, "资产", dir, `${id}.json`)
      try {
        const session = JSON.parse(readFileSync(file, "utf8"))
        return { session: { ...session, id, archived: false }, archived: false, file }
      } catch {}
    }
    throw new StorageError("会话不存在。", 404)
  }
  const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms))
  // 删除单个文件。unlinkSync 优先（rmSync 在本机对非 ASCII 路径是静默无操作）；
  // 文件可能被实时防护/索引器短暂占用（EBUSY/EPERM/POSIX 延迟删除）：
  // 退避重试仍失败时改后缀隐藏（.json → .removed-*，列表不再扫描），绝不静默丢失。
  const removeFileBestEffort = async (file, attempts = 6) => {
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (attempt) await sleepMs(300)
      try {
        unlinkSync(file)
        return true
      } catch (e) {
        if (e?.code === "ENOENT") return true
        if (attempt === attempts - 1) {
          try {
            renameSync(file, file.replace(/\.json$/iu, "") + ".removed-" + Date.now().toString(36))
            return true
          } catch {}
        }
      }
    }
    return false
  }
  const writeAiSession = (session) => {
    const dir = aiSessionDirOf(session)
    mkdirSync(dir, { recursive: true })
    writeDoc(join(dir, `${session.id}.json`), JSON.stringify(session, null, 2))
  }
  const sanitizeAiSession = (id, input) => ({
    id,
    title: oneLine(input.title ?? "").slice(0, 80) || "未命名",
    asset: input.asset && typeof input.asset === "object" && input.asset.name
      ? {
          name: oneLine(input.asset.name),
          host: oneLine(input.asset.host ?? ""),
          port: oneLine(input.asset.port ?? ""),
          grp: oneLine(input.asset.grp ?? ""),
        }
      : null,
    created: input.created ?? new Date().toISOString(),
    updated: input.updated ?? new Date().toISOString(),
    msgs: Array.isArray(input.msgs) ? input.msgs.slice(-400) : [],
    archived: Boolean(input.archived),
  })
  const collectAiSessions = (archived) => {
    const out = []
    const normTs = (v) => (typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v)
    const scanFlat = (dir) => {
      let names = []
      try { names = readdirSync(dir) } catch { return }
      for (const name of names) {
        if (!name.endsWith(".json")) continue
        try {
          const s = JSON.parse(readFileSync(join(dir, name), "utf8"))
          out.push({ id: name.slice(0, -5), title: s.title ?? "", asset: s.asset ?? null, created: normTs(s.created), updated: normTs(s.updated), msgs: Array.isArray(s.msgs) ? s.msgs : [], archived })
        } catch {}
      }
    }
    if (!archived) {
      scanFlat(join(AI_SESSIONS_ROOT, "会话"))
      let dirs = []
      try { dirs = readdirSync(join(AI_SESSIONS_ROOT, "资产")) } catch {}
      for (const dir of dirs) scanFlat(join(AI_SESSIONS_ROOT, "资产", dir))
    } else {
      scanFlat(join(AI_SESSIONS_ROOT, "归档"))
    }
    const tsOf = (v) => (typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : Date.parse(v) || 0)
    out.sort((a, b) => tsOf(b.updated) - tsOf(a.updated))
    // 同 id 去重（删除为 POSIX 延迟生效时可能短暂双份），保留最新；无 id 的脏文件跳过
    const seen = new Set()
    return out
      .filter((s) => {
        if (!s.id || seen.has(s.id)) return false
        seen.add(s.id)
        return true
      })
      .slice(0, 300)
  }

  const routes = {
    async "GET health"() {
      const assets = loadAssets()
      const { nav } = readNav()
      const { dir, from, exists } = appsConfiguredDir()
      return {
        ok: true,
        version: VERSION,
        root: base,
        counts: {
          assets: assets.length,
          credentials: assets.reduce((total, a) => total + a.credentials.length, 0),
          navCategories: nav.categories.length,
          navLinks: nav.categories.reduce((total, c) => total + (c.links ?? []).length, 0),
        },
        apps: { dir, dirFrom: from, dirExists: exists },
        files: Object.fromEntries(Object.entries(files).map(([key, file]) => [key, file])),
      }
    },

    /* ---------- 待办（Markdown 真源） ---------- */
    "GET todo"() {
      const { text, hash, path } = readTodo()
      return { text, path, hash }
    },
    "PUT todo"(body) {
      const text = String(body?.text ?? "")
      if (text.length > 512 * 1024) throw new StorageError("待办内容超过 512 KiB 上限。", 413)
      // 与 Obsidian 等外部编辑器共写同一份文件：baseHash 不匹配说明外部已改动，拒绝覆盖并附上最新内容。
      if (typeof body?.baseHash === "string" && body.baseHash) {
        const current = readDoc(files.todo)
        if (current && current.hash !== body.baseHash) {
          throw new StorageError("待办文件已被外部修改（如 Obsidian），已附最新内容，请基于最新内容重试。", 409, {
            currentText: current.text,
            currentHash: current.hash,
          })
        }
      }
      const { hash } = writeDoc(files.todo, text)
      return { ok: true, items: parseTodos(text).length, hash }
    },

    /* ---------- 导航（导航.md） ---------- */
    "GET nav"() {
      const { nav, hash } = readNav()
      return { nav, hash }
    },
    "PUT nav"(body) {
      const nav = body?.nav ?? { categories: [] }
      const current = readDoc(files.nav)
      if (typeof body?.baseHash === "string" && body.baseHash && current && current.hash !== body.baseHash) {
        throw new StorageError("导航文件已被外部修改（如 Obsidian），已附最新内容，请基于最新内容重试。", 409, {
          currentNav: parseNav(current.text),
          currentHash: current.hash,
        })
      }
      const hash = writeNav(nav)
      return { ok: true, hash }
    },
    async "POST nav/check"(body) {
      // 死链探测：默认当前分类（body.category 为索引），不传则全量（≤500 条）。
      const { nav } = readNav()
      const categories = nav.categories
      const scope = Number.isInteger(body?.category) && categories[body.category]
        ? [categories[body.category]]
        : categories
      const links = scope
        .flatMap((category) => (category.links ?? []).map((link) => ({ title: link.title, url: link.url, category: category.name })))
        .filter((link) => typeof link.url === "string" && /^https?:\/\//iu.test(link.url))
        .slice(0, 500)
      const probeLink = async (link) => {
        const started = Date.now()
        const request = (method) => fetch(link.url, { method, redirect: "follow", signal: AbortSignal.timeout(6000) })
        let response
        try {
          response = await request("HEAD")
          if (response.status === 405 || response.status === 501) response = await request("GET")
        } catch {
          try {
            response = await request("GET")
          } catch {
            response = null
          }
        }
        if (response?.body) {
          try {
            response.body.cancel()
          } catch {}
        }
        const ms = Date.now() - started
        return response ? { ...link, status: response.status, ok: response.status < 400, ms } : { ...link, status: 0, ok: false, error: true, ms }
      }
      let cursor = 0
      const results = []
      const worker = async () => {
        while (cursor < links.length) {
          const link = links[cursor++]
          results.push(await probeLink(link))
        }
      }
      await Promise.all(Array.from({ length: Math.min(8, links.length) }, worker))
      const summary = {
        total: links.length,
        ok: results.filter((r) => r.ok).length,
        dead: results.filter((r) => !r.ok && r.status > 0).length,
        error: results.filter((r) => !r.ok && !r.status).length,
      }
      return { ok: true, summary, results }
    },

    /* ---------- 资产（资产.md）+ 凭据（凭据.md） ---------- */
    "GET assets"() {
      const assets = loadAssets()
      const groups = [...new Set(assets.map((asset) => asset.grp).filter(Boolean))]
      return { assets, groups, vault: vaultState() }
    },
    "POST assets"(body) {
      const input = body || {}
      if (!input.name) throw new StorageError("缺少资产名称。", 400)
      const name = oneLine(input.name)
      const withSecret = (input.credentials ?? []).filter((credential) => credential?.secret)
      if (withSecret.length && vaultEnabled() && !vaultKey) {
        throw new StorageError("凭据库已加密且未解锁：请先在资产页解锁，或先不保存凭据。", 423)
      }
      const result = mutateAssets((assets) => {
        if (assets.some((asset) => asset.name === name)) {
          throw new StorageError("同名资产已存在。", 400)
        }
        assets.push({
          name,
          host: oneLine(input.host),
          port: oneLine(input.port),
          grp: oneLine(input.grp),
          project: oneLine(input.project),
          note: oneLine(input.note),
          links: [],
          credentials: [],
          last_status: "",
          last_check: "",
        })
        return { ok: true, id: assetIdOf(name) }
      })
      if (withSecret.length) {
        mutateCreds((map) => {
          const list = map.get(name) ?? []
          for (const credential of withSecret) {
            const expires = normalizeExpires(credential.expires)
            const record = sealEntry(normalizeEntry({
              type: credential.type,
              label: credential.label ?? "",
              username: credential.username ?? "",
              ...(expires ? { expires } : {}),
              ...(credential.passphrase ? { passphrase: credential.passphrase } : {}),
              secret: String(credential.secret),
            }))
            record.id ||= credIdOf(name, record)
            list.push(record)
          }
          map.set(name, list)
        })
      }
      return result
    },
    "DELETE assets/:id"(body, params) {
      const assets = loadAssets()
      const asset = findAsset(assets, params.id)
      mutateAssets((list) => {
        findAsset(list, params.id)
        const next = list.filter((a) => assetIdOf(a.name) !== params.id)
        list.length = 0
        list.push(...next)
      })
      mutateCreds((map) => map.delete(asset.name))
      lastStatuses.delete(asset.name)
      return { ok: true }
    },
    "PUT assets/:id"(body, params) {
      const input = body || {}
      const assets = loadAssets()
      const asset = findAsset(assets, params.id)
      const newName = input.name !== undefined ? oneLine(input.name) : asset.name
      if (!newName) throw new StorageError("资产名称不能为空。", 400)
      if (newName !== asset.name && assets.some((a) => a.name === newName)) {
        throw new StorageError("同名资产已存在。", 400)
      }
      // 改名迁移：凭据以资产名为键、令牌文件目录亦然，两者跟随改名
      if (newName !== asset.name) {
        mutateCreds((map) => {
          const list = map.get(asset.name) ?? []
          const merged = [...(map.get(newName) ?? []), ...list]
          map.delete(asset.name)
          if (merged.length) map.set(newName, merged)
        })
        const oldDir = join(base, "tokens", asset.name)
        try {
          if (existsSync(oldDir)) renameSync(oldDir, join(base, "tokens", newName))
        } catch {}
        lastStatuses.delete(asset.name)
      }
      mutateAssets((list) => {
        const target = findAsset(list, params.id)
        if (input.host !== undefined) target.host = oneLine(input.host)
        if (input.port !== undefined) target.port = oneLine(input.port)
        if (input.grp !== undefined) target.grp = oneLine(input.grp)
        if (input.project !== undefined) target.project = oneLine(input.project)
        if (input.note !== undefined) target.note = oneLine(input.note)
        if (newName !== asset.name) target.name = newName
      })
      return { ok: true, id: assetIdOf(newName), renamed: newName !== asset.name }
    },
    "PUT groups/rename"(body) {
      const from = oneLine(body?.from ?? "")
      const to = oneLine(body?.to ?? "")
      if (!from || !to) throw new StorageError("缺少分组名。", 400)
      if (from === to) return { ok: true }
      return mutateAssets((assets) => {
        for (const a of assets) if (a.grp === from) a.grp = to
        return { ok: true }
      })
    },
    "DELETE credentials/:id"(body, params) {
      return mutateCreds((map) => {
        for (const [assetName, list] of map) {
          const idx = list.findIndex((c) => credIdOf(assetName, c) === params.id)
          if (idx >= 0) {
            list.splice(idx, 1)
            if (!list.length) map.delete(assetName)
            return { ok: true }
          }
        }
        throw new StorageError("凭据不存在。", 404)
      })
    },
    async "POST assets/:id/check"(body, params) {
      const asset = loadAssets().find((a) => a.id === params.id)
      if (!asset) throw new StorageError("资产不存在。", 404)
      const ok = await tcpProbe(asset.host, asset.port)
      lastStatuses.set(asset.name, ok ? "up" : "down")
      const checkedAt = new Date().toISOString()
      mutateAssets((assets) => {
        const target = findAsset(assets, params.id)
        target.last_status = ok ? "up" : "down"
        target.last_check = checkedAt
      })
      return { ok, last_check: checkedAt, last_status: ok ? "up" : "down" }
    },
    "POST uploads/token"(body) {
      const assetName = oneLine(body?.assetName ?? "")
      const fileName = String(body?.name ?? "").trim()
      if (!assetName) throw new StorageError("缺少资产名称。", 400)
      if (!fileName) throw new StorageError("缺少文件名。", 400)
      const saved = saveTokenFile(assetName, fileName, body?.contentBase64)
      return { ok: true, path: saved.path, bytes: saved.bytes }
    },
    "POST assets/:id/credentials"(body, params) {
      const credential = body || {}
      if (!credential.secret) throw new StorageError("缺少凭据内容。", 400)
      const expires = normalizeExpires(credential.expires)
      const asset = loadAssets().find((a) => a.id === params.id)
      if (!asset) throw new StorageError("资产不存在。", 404)
      return mutateCreds((map) => {
        const list = map.get(asset.name) ?? []
        const record = sealEntry(normalizeEntry({
          type: credential.type,
          label: credential.label ?? "",
          username: credential.username ?? "",
          ...(expires ? { expires } : {}),
          ...(credential.passphrase ? { passphrase: credential.passphrase } : {}),
          secret: String(credential.secret),
        }))
        record.id ||= credIdOf(asset.name, record)
        list.push(record)
        map.set(asset.name, list)
        return { ok: true, id: credIdOf(asset.name, record) }
      })
    },
    "PUT credentials/:id"(body, params) {
      const input = body || {}
      const expires = input.expires !== undefined ? normalizeExpires(input.expires) : undefined
      if ((input.secret || input.passphrase) && vaultEnabled() && !vaultKey) {
        throw new StorageError("凭据库已加密且未解锁：请先在资产页解锁。", 423)
      }
      return mutateCreds((map) => {
        for (const [assetName, list] of map) {
          const credential = list.find((c) => credIdOf(assetName, c) === params.id)
          if (!credential) continue
          if (input.label !== undefined) credential.label = oneLine(input.label)
          if (input.type !== undefined) credential.type = normalizeType(input.type)
          if (input.username !== undefined) credential.username = oneLine(input.username)
          if (typeof input.secret === "string" && input.secret) {
            credential.secret = vaultEnabled() ? sealEntry({ ...credential, secret: input.secret }).secret : input.secret
          }
          if (input.passphrase !== undefined) {
            if (input.passphrase) {
              credential.passphrase = vaultEnabled() ? sealEntry({ ...credential, passphrase: input.passphrase }).passphrase : String(input.passphrase)
            } else delete credential.passphrase
          }
          if (expires !== undefined) {
            if (expires) credential.expires = expires
            else delete credential.expires
          }
          return { ok: true, expires: credential.expires ?? null, expiresInDays: expiresDaysLeft(credential.expires) }
        }
        throw new StorageError("凭据不存在。", 404)
      })
    },
    "GET credentials/:id/secret"(body, params) {
      const map = loadCreds()
      for (const [assetName, list] of map) {
        const credential = list.find((c) => credIdOf(assetName, c) === params.id)
        if (!credential) continue
        const key = vaultEnabled() ? assertVaultKey() : null
        const opened = openEntry(credential, key)
        return { secret: opened.secret, ...(opened.passphrase ? { passphrase: opened.passphrase } : {}) }
      }
      throw new StorageError("凭据不存在。", 404)
    },

    /* ---------- 凭据库（主口令加密，可选） ---------- */
    "GET vault"() {
      return { ok: true, ...vaultState() }
    },
    "POST vault/enable"(body) {
      const passphrase = String(body?.passphrase ?? "")
      if (passphrase.length < 4) throw new StorageError("主口令至少 4 位。", 400)
      if (vaultEnabled()) throw new StorageError("凭据加密已启用。", 400)
      const salt = randomBytes(16).toString("base64")
      const key = deriveKey(passphrase, Buffer.from(salt, "base64"))
      mutateCreds((map) => {
        for (const [name, list] of map) {
          map.set(name, list.map((entry) => {
            const sealed = { ...entry }
            if (sealed.secret && !isEncrypted(sealed.secret)) sealed.secret = encryptSecret(sealed.secret, key, salt)
            if (sealed.passphrase && !isEncrypted(sealed.passphrase)) sealed.passphrase = encryptSecret(sealed.passphrase, key, salt)
            return sealed
          }))
        }
      })
      const settings = readSettings(files.settings)
      writeSettings(files.settings, { ...settings, vault: { salt, check: vaultCheck(key) } })
      vaultKey = key
      return { ok: true, ...vaultState() }
    },
    "POST vault/unlock"(body) {
      const cfg = vaultConfig()
      if (!cfg) throw new StorageError("凭据加密未启用。", 400)
      const key = deriveKey(String(body?.passphrase ?? ""), Buffer.from(cfg.salt, "base64"))
      if (vaultCheck(key) !== cfg.check) throw new StorageError("主口令不对。", 401)
      vaultKey = key
      if (body?.remember) rememberWrite(String(body.passphrase))
      else rememberClear()
      return { ok: true, ...vaultState() }
    },
    "POST vault/lock"() {
      vaultKey = null
      rememberClear()
      return { ok: true, ...vaultState() }
    },
    "POST vault/disable"(body) {
      const cfg = vaultConfig()
      if (!cfg) throw new StorageError("凭据加密未启用。", 400)
      const passphrase = String(body?.passphrase ?? "")
      const key = deriveKey(passphrase, Buffer.from(cfg.salt, "base64"))
      if (vaultCheck(key) !== cfg.check) throw new StorageError("主口令不对。", 401)
      mutateCreds((map) => {
        for (const [name, list] of map) {
          map.set(name, list.map((entry) => openEntry(entry, key)))
        }
      })
      const settings = readSettings(files.settings)
      const { vault, ...rest } = settings
      writeSettings(files.settings, rest)
      vaultKey = null
      rememberClear()
      return { ok: true, ...vaultState() }
    },
    "POST assets/:id/links"(body, params) {
      const link = body || {}
      if (!link.url) throw new StorageError("缺少链接地址。", 400)
      const record = { label: oneLine(link.label || link.url).slice(0, 60), url: oneLine(link.url).slice(0, 500) }
      return mutateAssets((assets) => {
        findAsset(assets, params.id).links.push(record)
        return { ok: true, links: record }
      })
    },
    "DELETE assets/:id/links/:idx"(body, params) {
      return mutateAssets((assets) => {
        findAsset(assets, params.id).links.splice(Number(params.idx), 1)
        return { ok: true }
      })
    },

    /* ---------- 速记（速记.md，自由 Markdown）与 密钥文档（密钥/*.md，整篇在线编辑） ---------- */
    "GET note"() {
      const doc = readDoc(files.note)
      return { text: doc?.text ?? "", path: files.note, hash: doc?.hash ?? sha256("") }
    },
    "PUT note"(body) {
      const text = String(body?.text ?? "")
      if (text.length > 1024 * 1024) throw new StorageError("速记内容超过 1 MiB 上限。", 413)
      if (typeof body?.baseHash === "string" && body.baseHash) {
        const current = readDoc(files.note)
        if (current && current.hash !== body.baseHash) {
          throw new StorageError("速记文件已被外部修改（如 Obsidian），已附最新内容，请基于最新内容重试。", 409, { currentText: current.text, currentHash: current.hash })
        }
      }
      const { hash } = writeDoc(files.note, text)
      return { ok: true, hash }
    },
    // 密钥文档同时收 .md 与 .txt：文档身份 = 名称 + 扩展名（同名不同扩展是两份文档）
    "GET keysdocs"() {
      const docs = []
      for (const entry of readdirSync(keysDocsDir, { withFileTypes: true })) {
        const ext = entry.name.toLowerCase().match(/\.(md|txt)$/u)?.[1]
        if (!entry.isFile() || !ext) continue
        try {
          const full = join(keysDocsDir, entry.name)
          const text = readFileSync(full, "utf8")
          docs.push({ name: entry.name.slice(0, -(ext.length + 1)), ext, text, hash: sha256(text), chars: text.length, mtime: statSync(full).mtime.toISOString() })
        } catch {}
      }
      return { ok: true, docs: docs.sort((a, b) => (a.name + a.ext).localeCompare(b.name + b.ext, "zh-Hans-CN")) }
    },
    "PUT keysdoc/:name"(body, params) {
      const name = cleanPathSeg(params.name, "文档名")
      const ext = body?.ext === "txt" ? "txt" : "md"
      const text = String(body?.text ?? "")
      if (text.length > 1024 * 1024) throw new StorageError("文档超过 1 MiB 上限。", 413)
      const file = join(keysDocsDir, `${name}.${ext}`)
      if (typeof body?.baseHash === "string" && body.baseHash) {
        let currentHash = ""
        try { currentHash = sha256(readFileSync(file, "utf8")) } catch {}
        if (currentHash !== body.baseHash) {
          throw new StorageError("文档已被外部修改，已加载最新内容，请基于最新内容重试。", 409, { currentText: currentHash ? readFileSync(file, "utf8") : "", currentHash })
        }
      }
      const { hash } = writeDoc(file, text)
      return { ok: true, name, ext, hash, chars: text.length }
    },
    "DELETE keysdoc/:name"(body, params, { query }) {
      const ext = query?.get?.("ext") === "txt" ? "txt" : "md"
      const file = join(keysDocsDir, `${cleanPathSeg(params.name, "文档名")}.${ext}`)
      if (!existsSync(file)) throw new StorageError("文档不存在。", 404)
      // rmSync 在本机对非 ASCII 路径（密钥 目录）是静默无操作，删除必须走 unlinkSync
      unlinkSync(file)
      return { ok: true }
    },
    /* ---------- AI 对话（LLM 代理 + 只读 Work 工具，全部走现有数据层） ---------- */
    "GET ai/debugsrc"() {
      const src = readFileSync(fileURLToPath(import.meta.url), "utf8")
      const line = src.split("\n").find((l) => l.includes("add_todo"))
      const runtimeTools = aiTools.map((x) => ({ name: x.function?.name, confirm: Boolean(x.confirm), keys: Object.keys(x) }))
      const lineFull = line ?? ""
      return { ok: true, mtime: statSync(fileURLToPath(import.meta.url)).mtime.toISOString(), hasConfirm: src.includes("confirm: true"), lineFull: lineFull.slice(0, 400), runtimeTools }
    },
    "GET ai/config"() {
      const cfg = normalizeAiConfig(readSettings(files.settings).ai)
      const providerName = (AI_PROVIDERS.find((p) => p.id === cfg.provider) ?? {}).name ?? cfg.provider
      return { ok: true, provider: cfg.provider, providerName, mode: cfg.mode, baseURL: cfg.baseURL, models: cfg.models, activeModel: cfg.activeModel, hasKey: Boolean(cfg.key), keyMasked: maskKey(cfg.key), providers: AI_PROVIDERS }
    },
    "PUT ai/config"(body) {
      const provider = String(body?.provider ?? "custom")
      const mode = body?.mode === "anthropic" ? "anthropic" : "openai"
      const baseURL = String(body?.baseURL ?? "").trim().replace(/\/+$/, "")
      const key = String(body?.key ?? "")
      const modelsRaw = Array.isArray(body?.models) ? body.models : String(body?.models ?? "").split(/[,，;；\s]+/)
      const models = [...new Set(modelsRaw.map((m) => String(m ?? "").trim()).filter(Boolean))].slice(0, 20)
      if (!baseURL) throw new StorageError("接口地址不能为空。", 400)
      if (!models.length) throw new StorageError("至少配置一个模型。", 400)
      const settings = readSettings(files.settings)
      const ai = normalizeAiConfig({ provider, mode, baseURL, key, models })
      writeSettings(files.settings, { ...settings, ai: { ...ai, key } })
      const providerName = (AI_PROVIDERS.find((p) => p.id === ai.provider) ?? {}).name ?? ai.provider
      return { ok: true, provider: ai.provider, providerName, mode: ai.mode, baseURL: ai.baseURL, models: ai.models, activeModel: ai.activeModel, hasKey: Boolean(key), keyMasked: maskKey(key) }
    },
    async "POST ai/test"(body) {
      const saved = normalizeAiConfig(readSettings(files.settings).ai)
      const cfg = normalizeAiConfig({
        provider: body?.provider ?? saved.provider,
        mode: body?.mode ?? saved.mode,
        baseURL: body?.baseURL ?? saved.baseURL,
        key: body?.key !== undefined && body?.key !== "" ? body.key : saved.key,
        model: body?.model ?? saved.activeModel ?? saved.models?.[0],
      })
      if (!cfg.baseURL || !cfg.key || !cfg.models.length) throw new StorageError("接口地址、密钥、模型均需填写才能测试。", 400)
      cfg.model = String(body?.model ?? "").trim() || cfg.activeModel || cfg.models[0]
      return { ok: true, ...(await testConnection(cfg)) }
    },
    "POST ai/confirm"(body) {
      const id = String(body?.id ?? "")
      if (!id) throw new StorageError("缺少确认 id。", 400)
      approvals.set(id, Boolean(body?.approved))
      return { ok: true }
    },
    "POST ai/chat"(body) {
      const cfg = normalizeAiConfig(readSettings(files.settings).ai)
      if (!cfg.baseURL || !cfg.key || !cfg.models.length) throw new StorageError("请先在 AI 页配置模型接口。", 400)
      cfg.model = String(body?.model ?? "").trim() || cfg.activeModel || cfg.models[0]
      const history = (Array.isArray(body?.messages) ? body.messages : []).slice(-40)
        .filter((m) => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string" && m.content)
        .map((m) => ({ role: m.role, content: m.content }))
      if (!history.length || history[history.length - 1].role !== "user") throw new StorageError("缺少用户消息。", 400)
      mkdirSync(join(base, "对话"), { recursive: true })
      const auditFile = join(base, "对话", "审计.log")
      const audit = (line) => { try { appendFileSync(auditFile, line + "\n") } catch {} }
      const execTool = async (name, args) => {
        audit(`[${new Date().toISOString()}] tool=${name} args=${JSON.stringify(args).slice(0, 300)}`)
        const tool = aiTools.find((x) => x.function.name === name)
        if (!tool) return "未知工具"
        const result = String((await tool.exec(args)) ?? "完成")
        audit(`[${new Date().toISOString()}] result=${name} ${result.slice(0, 200)}`)
        return result
      }
      const systemPrompt = "你是个人工作台 pwb-lite 的助手。可以使用工具查询用户的待办、速记、服务器资产（含在线探测）与导航链接。回答用中文，简洁准确；数据类问题务必调用工具取真实数据，不要编造。"
      // 资产上下文：从资产卡片发起的对话，系统提示注入该资产信息
      let assetPrompt = systemPrompt
      if (body?.asset && typeof body.asset === "object") {
        const a = body.asset
        assetPrompt += "\n当前对话聚焦这台服务器资产：名称=" + String(a.name ?? "") + "，主机=" + String(a.host ?? "") + "，端口=" + String(a.port ?? "") + "，分组=" + String(a.grp ?? "") + "，在线状态=" + String(a.status ?? "未检") + (a.note ? "，备注=" + String(a.note) : "") + "。可用 probe_asset 工具实测在线状态，可用 ssh_exec 执行只读命令（需批准）。"
      }
      const stream = Readable.from(runAiChat(cfg, history, aiTools.map(({ type, function: fn, confirm, summary }) => ({ type, function: fn, confirm, summary })), execTool, assetPrompt, approvals, confirmToolNames))
      return { status: 200, stream, type: "text/event-stream" }
    },
    /* ---------- AI 会话持久化 ---------- */
    "GET ai/sessions"(body, params, { query }) {
      return { ok: true, sessions: collectAiSessions(query?.get?.("archived") === "1") }
    },
    "GET ai/sessions/:id"(body, params) {
      const { session } = locateAiSession(params.id)
      return { ok: true, session }
    },
    async "PUT ai/sessions/:id"(body, params) {
      assertSessionId(params.id)
      const next = sanitizeAiSession(params.id, body ?? {})
      let oldFile = null
      try { oldFile = locateAiSession(params.id).file } catch {}
      writeAiSession(next) // 先落新位置（列表按 updated 去重，旧位置稍后尽力清理）
      if (oldFile && oldFile !== join(aiSessionDirOf(next), `${params.id}.json`)) await removeFileBestEffort(oldFile)
      return { ok: true }
    },
    async "DELETE ai/sessions/:id"(body, params) {
      assertSessionId(params.id)
      const candidates = () => {
        const list = [join(AI_SESSIONS_ROOT, "会话", `${params.id}.json`), join(AI_SESSIONS_ROOT, "归档", `${params.id}.json`)]
        try {
          for (const dir of readdirSync(join(AI_SESSIONS_ROOT, "资产"))) list.push(join(AI_SESSIONS_ROOT, "资产", dir, `${params.id}.json`))
        } catch {}
        return list.filter((f) => existsSync(f))
      }
      if (!candidates().length) throw new StorageError("会话不存在。", 404)
      for (const file of candidates()) await removeFileBestEffort(file)
      return { ok: true }
    },
    async "POST ai/sessions/:id/archive"(body, params) {
      const { session, file } = locateAiSession(params.id)
      const next = sanitizeAiSession(params.id, { ...session, archived: true, updated: new Date().toISOString() })
      writeAiSession(next) // 先写归档位置，再尽力清旧位置（占用时列表去重兜底）
      if (file !== join(aiSessionDirOf(next), `${params.id}.json`)) await removeFileBestEffort(file)
      return { ok: true }
    },
    async "POST ai/sessions/:id/unarchive"(body, params) {
      const { session, file } = locateAiSession(params.id)
      const next = sanitizeAiSession(params.id, { ...session, archived: false, updated: new Date().toISOString() })
      writeAiSession(next)
      if (file !== join(aiSessionDirOf(next), `${params.id}.json`)) await removeFileBestEffort(file)
      return { ok: true }
    },
    /* ---------- 开机自启（用户级 HKCU Run，登录时静默拉起后台服务） ---------- */
    "GET autostart"() {
      return { ok: true, ...autostartStatus() }
    },
    "PUT autostart"(body) {
      const st = setAutostart(Boolean(body?.enabled))
      log("info", `pwb-lite: 开机自启已${body?.enabled ? "注册" : "注销"}`)
      return { ok: true, ...st }
    },

    /* ---------- 应用启动器（快捷方式目录，一页启动） ---------- */
    "GET apps"() {
      const { dir, from, exists } = appsConfiguredDir()
      const prefs = appsPrefs()
      return {
        ok: true,
        dir,
        dirFrom: from,
        dirExists: exists,
        candidates: appsDirCandidates(),
        pinned: Array.isArray(prefs.pinned) ? prefs.pinned.filter((name) => typeof name === "string") : [],
        apps: dir && exists ? listShortcuts(dir) : [],
      }
    },
    "PUT apps/prefs"(body) {
      const settings = readSettings(files.settings)
      const next = { ...(settings.apps ?? {}) }
      if (body?.dir !== undefined) {
        const dir = String(body.dir ?? "").trim()
        if (dir && (!isAbsolute(dir) || dir.length > 300)) {
          throw new StorageError("应用目录需为绝对路径（不超过 300 字符），留空恢复默认。", 400)
        }
        if (dir) next.dir = dir
        else delete next.dir
      }
      if (Array.isArray(body?.pinned)) {
        next.pinned = body.pinned
          .filter((name) => typeof name === "string" && name.trim())
          .map((name) => name.trim())
          .slice(0, 500)
      }
      writeSettings(files.settings, { ...settings, apps: next })
      return { ok: true, prefs: next }
    },
    "POST apps/launch"(body) {
      const { dir, exists } = appsConfiguredDir()
      if (!dir || !exists) throw new StorageError("尚未配置可用的应用目录。", 400)
      const full = safeShortcutFile(dir, body?.file)
      if (!full) throw new StorageError(`快捷方式不存在：${String(body?.file ?? "")}`, 404)
      startDetached(full)
      return { ok: true, file: String(body.file) }
    },
    "POST apps/open-folder"() {
      const { dir, exists } = appsConfiguredDir()
      if (!dir) throw new StorageError("尚未配置应用目录。", 400)
      if (!exists) throw new StorageError(`应用目录不存在：${dir}`, 404)
      startDetached(dir)
      return { ok: true, dir }
    },
  }

  /* ---------- 站点图标代理：多源并行竞速 + 磁盘缓存（7 天），全部失败返回 404 由前端首字母兜底 ---------- */
  const ICON_TTL = 7 * 24 * 3600 * 1000
  const ICON_MAX_BYTES = 200 * 1024
  const ICONS_DIR = join(base, "cache", "icons")
  const fetchIcon = (url, ms = 12000) =>
    fetch(url, { signal: AbortSignal.timeout(ms), redirect: "follow" })

  // 只接受规范主机名/IP：拒绝空串、"."/".."、连续点、路径分隔符与控制字符，避免把缓存路径拼到数据目录之外。
  const safeHost = (host) => {
    const value = String(host ?? "").trim().toLowerCase()
    if (!value || value.length > 120) return ""
    if (value === "." || value === ".." || value.includes("..")) return ""
    return /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/u.test(value) ? value : ""
  }

  async function resolveIcon(host) {
    const key = safeHost(host)
    if (!key) return null
    const cached = join(ICONS_DIR, key)
    try {
      const info = statSync(cached)
      if (info.isFile() && info.size > 0 && info.size <= ICON_MAX_BYTES && Date.now() - info.mtimeMs < ICON_TTL) {
        return { buffer: readFileSync(cached), type: "image/x-icon" }
      }
    } catch {}
    const sources = [
      `https://favicon.im/${key}`,
      `https://${key}/favicon.ico`,
      `https://icons.duckduckgo.com/ip3/${key}.ico`,
      `http://${key}/favicon.ico`,
    ]
    const attempts = sources.map(async (url) => {
      const response = await fetchIcon(url)
      if (!response.ok) throw new Error("bad status")
      const type = (response.headers.get("content-type") || "").toLowerCase()
      if (!type.startsWith("image/")) throw new Error("not an image")
      const buffer = Buffer.from(await response.arrayBuffer())
      if (buffer.length < 100 || buffer.length > ICON_MAX_BYTES) throw new Error("bad size")
      return { buffer, type }
    })
    try {
      const hit = await Promise.any(attempts)
      writeFileSync(cached, hit.buffer)
      return hit
    } catch {
      return null
    }
  }

  return {
    version: VERSION,
    root: base,
    async handle(method, segments, { query, body } = {}) {
      try {
        if (method === "GET" && segments[0] === "icon") {
          const hit = await resolveIcon(query?.get?.("host") ?? "")
          if (!hit) return { status: 404 }
          return {
            status: 200,
            raw: hit.buffer,
            type: hit.type,
            headers: { "cache-control": "public, max-age=604800" },
          }
        }
        if (method === "GET" && segments[0] === "appicon") {
          const hit = resolveAppIcon(query?.get?.("file") ?? "")
          if (!hit) return { status: 404 }
          return {
            status: 200,
            raw: hit.buffer,
            type: "image/png",
            headers: { "cache-control": "public, max-age=86400" },
          }
        }

        let handler = routes[`${method} ${segments.join("/")}`]
        const params = {}
        if (!handler) {
          for (const [key, candidate] of Object.entries(routes)) {
            const [routeMethod, ...pattern] = key.split(" ")
            if (routeMethod !== method || pattern.length !== 1) continue
            const parts = pattern[0].split("/")
            if (parts.length !== segments.length) continue
            const matched = parts.every((part, index) =>
              part.startsWith(":") ? ((params[part.slice(1)] = segments[index]), true) : part === segments[index],
            )
            if (matched) {
              handler = candidate
              break
            }
          }
        }
        if (!handler) {
          return { status: 404, json: { ok: false, error: `no route ${method} /${segments.join("/")}` } }
        }
        const value = await handler(body ?? {}, params, { query })
        if (value && value.stream) return { status: 200, stream: value.stream, type: value.type ?? "text/event-stream" }
        return { status: 200, json: value }
      } catch (error) {
        const status = error instanceof StorageError ? error.status : 500
        return { status, json: { ok: false, error: String(error?.message ?? error), ...(error?.details ?? {}) } }
      }
    },
    close() {
      for (const timer of bgTimers) {
        clearTimeout(timer)
        clearInterval(timer)
      }
    },
  }
}
