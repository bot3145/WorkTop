// 迁移校验：旧 SQLite/state 与新 Markdown 逐项比对（资产字段、凭据明文、导航链接、待办）。
// 全部一致退出 0，任何差异退出 1。用法：node scripts/verify-migration.mjs [旧仓库路径]
import { DatabaseSync } from "node:sqlite"
import { createDecipheriv, createHmac } from "node:crypto"
import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { dirname } from "node:path"
import { parseAssets, parseCredDoc, parseNav } from "../core/store.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, "..")
const oldRepo = resolve(process.argv[2] ?? join(projectRoot, "..", "pwb-workbench"))
const oldData = join(oldRepo, "data")
const newData = join(projectRoot, "data")

if (!existsSync(join(oldData, "db", "workbench.db"))) {
  console.error(`旧数据不存在：${oldData}`)
  console.error("（旧仓库已删除——当年迁移已逐项校验通过；如需再次核对，传入旧数据备份路径：node scripts/verify-migration.mjs <旧仓库路径>）")
  process.exit(1)
}

let failures = 0
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`)
  if (!ok) failures++
}

function decryptOld(token, keyB64) {
  const key = Buffer.from(keyB64, "base64")
  const data = Buffer.from(String(token).trim(), "base64url")
  if (data[0] !== 0x80 || data.length < 58) throw new Error("bad token")
  const body = data.subarray(0, data.length - 32)
  const mac = data.subarray(data.length - 32)
  const expect = createHmac("sha256", key.subarray(0, 16)).update(body).digest()
  if (!mac.equals(expect)) throw new Error("HMAC mismatch")
  const iv = body.subarray(9, 25)
  const decipher = createDecipheriv("aes-128-cbc", key.subarray(16, 32), iv)
  return Buffer.concat([decipher.update(body.subarray(25)), decipher.final()]).toString("utf8")
}

/* ---------- 资产 + 凭据 ---------- */
const db = new DatabaseSync(join(oldData, "db", "workbench.db"), { readOnly: true })
const oldRows = db.prepare("SELECT * FROM assets ORDER BY ord, name").all()
const oldCreds = db.prepare("SELECT * FROM credentials ORDER BY ord").all()
db.close()
const keyB64 = readFileSync(join(oldData, "secrets", "secret.key"), "utf8").trim()
const extraOf = (row) => {
  try { return { ...JSON.parse(row.extra ?? "{}"), ...row } } catch { return { ...row } }
}
const oldAssets = oldRows.map((row) => {
  const { links = [] } = extraOf(row)
  return {
    name: row.name, host: row.host ?? "", port: row.port ?? "", grp: row.grp ?? "",
    project: row.project ?? "", note: row.note ?? "", links,
    credentials: oldCreds.filter((c) => c.asset_id === row.id).map((c) => {
      const { expires } = extraOf(c)
      return {
        type: c.type ?? "password", label: c.label ?? "", username: c.username ?? "",
        ...(expires ? { expires } : {}),
        secret: decryptOld(c.secret_enc, keyB64),
      }
    }),
  }
})

const newAssets = parseAssets(readFileSync(join(newData, "资产.md"), "utf8"))
// 凭据已拆分到 凭据.md（## 资产名 小节），比对前按资产名合并回来
const credMap = parseCredDoc(readFileSync(join(newData, "凭据.md"), "utf8"))
for (const asset of newAssets) {
  const list = credMap.get(asset.name) ?? []
  asset.credentials = list
    .map((raw) => { try { return JSON.parse(raw) } catch { return null } })
    .filter(Boolean)
    .map((c) => ({ ...c, type: c.type === "key" ? "private-key" : c.type }))
}
check(`资产数量 ${oldAssets.length} → ${newAssets.length}`, oldAssets.length === newAssets.length)

for (const oldAsset of oldAssets) {
  const newAsset = newAssets.find((a) => a.name === oldAsset.name)
  if (!newAsset) { check(`资产「${oldAsset.name}」存在`, false); continue }
  const fieldsOk = ["host", "port", "grp", "project", "note"].every((f) => (newAsset[f] ?? "") === (oldAsset[f] ?? ""))
  check(`资产「${oldAsset.name}」字段`, fieldsOk,
    fieldsOk ? "" : JSON.stringify({ old: oldAsset, new: newAsset }).slice(0, 300))
  check(`资产「${oldAsset.name}」链接 ${oldAsset.links.length} → ${newAsset.links.length}`,
    oldAsset.links.length === newAsset.links.length &&
    oldAsset.links.every((l, i) => newAsset.links[i]?.url === l.url && newAsset.links[i]?.label === l.label))
  check(`资产「${oldAsset.name}」凭据 ${oldAsset.credentials.length} → ${newAsset.credentials.length}`,
    oldAsset.credentials.length === newAsset.credentials.length)
  for (const oldCred of oldAsset.credentials) {
    const newCred = newAsset.credentials.find((c) => c.label === oldCred.label && c.username === oldCred.username)
    if (!newCred) { check(`凭据「${oldCred.label}」存在`, false); continue }
    check(`凭据「${oldAsset.name}/${oldCred.label || oldCred.type}」明文一致`,
      newCred.secret === oldCred.secret && (newCred.expires ?? "") === (oldCred.expires ?? ""))
  }
}

/* ---------- 导航 ---------- */
const oldNav = JSON.parse(readFileSync(join(oldData, "state", "state.json"), "utf8")).state.nav
const newNav = parseNav(readFileSync(join(newData, "导航.md"), "utf8"))
check(`导航分类 ${oldNav.categories.length} → ${newNav.categories.length}`,
  oldNav.categories.length === newNav.categories.length)
for (const oldCat of oldNav.categories) {
  const newCat = newNav.categories.find((c) => c.name === oldCat.name)
  if (!newCat) { check(`分类「${oldCat.name}」存在`, false); continue }
  check(`分类「${oldCat.name}」链接逐一一致`,
    (oldCat.links ?? []).length === newCat.links.length &&
    (oldCat.links ?? []).every((l, i) => newCat.links[i]?.title === l.title && newCat.links[i]?.url === l.url),
    `${(oldCat.links ?? []).length} 条`)
}

/* ---------- 待办 ---------- */
const oldTodo = readFileSync(join(oldData, "待办.md"), "utf8")
const newTodo = readFileSync(join(newData, "待办.md"), "utf8")
check("待办字节一致", oldTodo === newTodo)

/* ---------- 设置 ---------- */
const oldPrefs = JSON.parse(readFileSync(join(oldData, "state", "state.json"), "utf8")).state.records?.["apps.prefs"]?.value ?? {}
const newSettings = JSON.parse(readFileSync(join(newData, "设置.json"), "utf8")).apps ?? {}
check("应用目录偏好一致", (newSettings.dir ?? "") === (oldPrefs.dir ?? ""))
check("置顶偏好一致", JSON.stringify(newSettings.pinned ?? []) === JSON.stringify(oldPrefs.pinned ?? []))

console.log(failures ? `校验失败：${failures} 项` : "校验全部通过")
process.exit(failures ? 1 : 0)
