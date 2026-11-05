// pwb-lite 数据层：三个 Markdown 文档（待办/导航/资产）+ 一个小设置 JSON + 可再生图标缓存。
//
// 约定：
//   - 人类可读可编（Obsidian 可直接改同一份文件），程序侧原子写（临时文件 + rename）；
//   - 整文档读改写走哈希 CAS：PUT 带 baseHash 时外部改过就 409 并附最新内容，绝不盲目覆盖；
//   - 资产是字段级操作（服务端每次读最新文件→内存修改→写回），不做客户端 CAS；
//   - 单行字段（名称/备注等）写入前压成一行，防止内容里混入换行伪造字段行。

import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto"
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

export const sha256 = (text) => createHash("sha256").update(text).digest("hex")

export class StorageError extends Error {
  constructor(message, status = 500, details) {
    super(message)
    this.name = "StorageError"
    this.status = status
    this.details = details
  }
}

/** 单行化：字段值不允许换行（会破坏逐行解析），压成空格。 */
export const oneLine = (value) => String(value ?? "").replace(/\s*\r?\n\s*/gu, " ").trim()

export function readDoc(file) {
  let text
  try {
    text = readFileSync(file, "utf8")
  } catch (error) {
    if (error?.code === "ENOENT") return null
    throw error
  }
  return { text, hash: sha256(text) }
}

export function writeDoc(file, text) {
  mkdirSync(dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`
  try {
    writeFileSync(temporary, text, "utf8")
    renameSync(temporary, file)
  } finally {
    try {
      unlinkSync(temporary)
    } catch {}
  }
  return { hash: sha256(text) }
}

/* ============================== 导航.md ============================== */
// 形态：
//   # 导航
//
//   ## 分类名
//   - [标题](https://example.com)
//
// 解析容错：忽略其它行；只认 http(s) 链接；标题里的方括号/URL 里的圆括号不受支持（Markdown 语法边界）。

export function parseNav(text) {
  const categories = []
  let current = null
  for (const raw of String(text ?? "").split(/\r?\n/u)) {
    const heading = raw.match(/^##\s+(.+?)\s*$/u)
    if (heading) {
      current = { name: heading[1], links: [] }
      categories.push(current)
      continue
    }
    const link = raw.match(/^[-*]\s+\[(.+?)\]\(\s*(\S+?)\s*\)\s*$/u)
    if (link && current && /^https?:\/\//iu.test(link[2])) {
      current.links.push({ title: link[1], url: link[2] })
    }
  }
  return { categories }
}

export function serializeNav(nav) {
  const lines = ["# 导航", ""]
  for (const category of nav?.categories ?? []) {
    lines.push(`## ${oneLine(category.name)}`, "")
    for (const link of category.links ?? []) {
      lines.push(`- [${oneLine(link.title)}](${oneLine(link.url)})`)
    }
    lines.push("")
  }
  return lines.join("\n")
}

/* ============================== 资产.md ============================== */
// 形态（每个资产一节，字段行 "- 字段: 值"；凭据一行一条 JSON，明文存储）：
//   # 资产
//
//   ## 资产名
//   - 主机: 1.2.3.4
//   - 端口: 22
//   - 分组: 生产
//   - 项目: 某系统
//   - 备注: 备注文本
//   - 状态: up · 2026-10-26T01:23:45.678Z
//   - 链接: [控制台](https://...)
//   - 凭据: {"type":"password","label":"密码","username":"root","expires":"2027-01-01","secret":"..."}

const ASSET_FIELDS = { 主机: "host", 端口: "port", 分组: "grp", 项目: "project", 备注: "note" }

export function parseAssets(text) {
  const assets = []
  let current = null
  for (const raw of String(text ?? "").split(/\r?\n/u)) {
    const heading = raw.match(/^##\s+(.+?)\s*$/u)
    if (heading) {
      current = {
        name: heading[1], host: "", port: "", grp: "", project: "", note: "",
        links: [], credentials: [], last_status: "", last_check: "",
      }
      assets.push(current)
      continue
    }
    if (!current) continue
    const field = raw.match(/^[-*]\s+(主机|端口|分组|项目|备注|状态)\s*[:：]\s*(.*)$/u)
    if (field) {
      const [, key, value] = field
      if (key === "状态") {
        const [status, ...rest] = value.split("·")
        current.last_status = status.trim()
        current.last_check = rest.join("·").trim()
      } else {
        current[ASSET_FIELDS[key]] = value.trim()
      }
      continue
    }
    const link = raw.match(/^[-*]\s+链接\s*[:：]\s*\[(.+?)\]\(\s*(\S+?)\s*\)\s*$/u)
    if (link) {
      current.links.push({ label: link[1], url: link[2] })
      continue
    }
    const credential = raw.match(/^[-*]\s+凭据\s*[:：]\s*(\{.*\})\s*$/u)
    if (credential) {
      try {
        const parsed = JSON.parse(credential[1])
        if (parsed && typeof parsed === "object") current.credentials.push(parsed)
      } catch {}
    }
  }
  return assets
}

export function serializeAssets(assets) {
  const lines = ["# 资产", ""]
  for (const asset of assets) {
    lines.push(`## ${oneLine(asset.name)}`, "")
    if (asset.host) lines.push(`- 主机: ${oneLine(asset.host)}`)
    if (asset.port) lines.push(`- 端口: ${oneLine(asset.port)}`)
    if (asset.grp) lines.push(`- 分组: ${oneLine(asset.grp)}`)
    if (asset.project) lines.push(`- 项目: ${oneLine(asset.project)}`)
    if (asset.note) lines.push(`- 备注: ${oneLine(asset.note)}`)
    if (asset.last_status) lines.push(`- 状态: ${oneLine(asset.last_status)}${asset.last_check ? ` · ${oneLine(asset.last_check)}` : ""}`)
    for (const link of asset.links ?? []) {
      lines.push(`- 链接: [${oneLine(link.label)}](${oneLine(link.url)})`)
    }
    for (const credential of asset.credentials ?? []) {
      lines.push(`- 凭据: ${JSON.stringify(credential)}`)
    }
    lines.push("")
  }
  return lines.join("\n")
}

/* ============================== 凭据.md ============================== */
// 与 资产.md 同构：`## 资产名` 小节 + `- 凭据: {JSON}` 行；凭据集中存放，便于整文件差异化保护
// （不进同步/备份时 资产.md 仍可用）。凭据值可以是明文 JSON，或整段 `ENC:v1:salt:iv:ct` 密文。

export function parseCredDoc(text) {
  const byAsset = new Map()
  let current = null
  for (const raw of String(text ?? "").split(/\r?\n/u)) {
    const heading = raw.match(/^##\s+(.+?)\s*$/u)
    if (heading) {
      current = heading[1]
      if (!byAsset.has(current)) byAsset.set(current, [])
      continue
    }
    const credential = raw.match(/^[-*]\s+凭据\s*[:：]\s*(.+?)\s*$/u)
    if (credential && current) byAsset.get(current).push(credential[1])
  }
  return byAsset
}

export function serializeCredDoc(byAsset) {
  const lines = ["# 凭据", ""]
  for (const [asset, list] of byAsset) {
    if (!list.length) continue
    lines.push(`## ${oneLine(asset)}`, "")
    for (const entry of list) lines.push(`- 凭据: ${typeof entry === "string" ? entry : JSON.stringify(entry)}`)
    lines.push("")
  }
  return lines.join("\n")
}

/* ============================== 主口令加密（可选） ============================== */
// 学 HexHub 的"口令派生密钥"思路但纯本地：scrypt(主口令, salt) 派生一次 key（deriveKey），
// 加解密直接用这把 key（AES-256-GCM）。行级格式：ENC:v1:<saltB64>:<ivB64>:<ctB64>（ct 含 GCM tag）。
// 无恢复密钥：忘口令 = 解不开，重录凭据。

export const ENC_PREFIX = "ENC:v1:"

/** key 必须来自 deriveKey(主口令, salt)；不要把口令字符串直接传进来（会二次派生对不上）。 */
export function encryptSecret(plain, key, saltB64) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const ct = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final(), cipher.getAuthTag()])
  return `${ENC_PREFIX}${saltB64}:${iv.toString("base64")}:${ct.toString("base64")}`
}

export function decryptSecret(encoded, key) {
  if (!String(encoded).startsWith(ENC_PREFIX)) return encoded
  const [, , saltB64, ivB64, ctB64] = String(encoded).split(":")
  const data = Buffer.from(ctB64, "base64")
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"))
  decipher.setAuthTag(data.subarray(data.length - 16))
  return Buffer.concat([decipher.update(data.subarray(0, data.length - 16)), decipher.final()]).toString("utf8")
}

export function deriveKey(passphrase, salt) {
  // N=2^15 在普通机器上 ~100ms：一次性解锁可接受，暴力破解成本显著抬高
  return scryptSync(String(passphrase), salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 })
}

export const isEncrypted = (value) => String(value ?? "").startsWith(ENC_PREFIX)
// 应用启动器偏好（目录 + 置顶）。几百字节，不值得为其上 Markdown。

export function readSettings(file) {
  try {
    const value = JSON.parse(readFileSync(file, "utf8"))
    return value && typeof value === "object" && !Array.isArray(value) ? value : {}
  } catch {
    return {}
  }
}

export function writeSettings(file, value) {
  return writeDoc(file, `${JSON.stringify(value, null, 2)}\n`)
}
