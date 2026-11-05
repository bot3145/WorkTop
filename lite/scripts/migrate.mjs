// 一次性迁移：旧仓库（pwb-workbench）的 SQLite + state.json → 本项目 data/ 的三个 Markdown。
// 用法：node scripts/migrate.mjs <旧仓库路径>（默认 ../pwb-workbench）
// 只读旧数据、只写本项目 data/；旧图标缓存一并复制预热（可再生）。
import { DatabaseSync } from "node:sqlite"
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { dirname } from "node:path"
import { serializeAssets, serializeNav, writeDoc } from "../core/store.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, "..")
const oldRepo = resolve(process.argv[2] ?? join(projectRoot, "..", "pwb-workbench"))
const oldData = join(oldRepo, "data")
const outDir = join(projectRoot, "data")

for (const required of [join(oldData, "db", "workbench.db"), join(oldData, "state", "state.json")]) {
  if (!existsSync(required)) throw new Error(`旧数据缺失：${required}`)
}
mkdirSync(outDir, { recursive: true })

/* ---------- 待办：原样复制（格式本来就是同一个） ---------- */
const todoText = readFileSync(join(oldData, "待办.md"), "utf8")
writeFileSync(join(outDir, "待办.md"), todoText, "utf8")

/* ---------- 导航：state.json → 导航.md ---------- */
const state = JSON.parse(readFileSync(join(oldData, "state", "state.json"), "utf8")).state
const nav = state.nav ?? { categories: [] }
writeDoc(join(outDir, "导航.md"), serializeNav(nav))

/* ---------- 资产：SQLite → 资产.md（凭据按约定明文） ---------- */
const db = new DatabaseSync(join(oldData, "db", "workbench.db"), { readOnly: true })
const rows = db.prepare("SELECT * FROM assets ORDER BY ord, name").all()
const credRows = db.prepare("SELECT * FROM credentials ORDER BY ord").all()
db.close()

const extraOf = (row) => {
  try {
    return { ...JSON.parse(row.extra ?? "{}"), ...row }
  } catch {
    return { ...row }
  }
}
const assets = rows.map((row) => {
  const { links = [], ...restExtra } = extraOf(row)
  return {
    name: row.name ?? "",
    host: row.host ?? "",
    port: row.port ?? "",
    grp: row.grp ?? "",
    project: row.project ?? "",
    note: row.note ?? "",
    last_status: row.last_status ?? "",
    last_check: row.last_check ?? "",
    links,
    credentials: credRows
      .filter((cred) => cred.asset_id === row.id)
      .map((cred) => {
        const { expires } = extraOf(cred)
        return {
          type: cred.type ?? "password",
          label: cred.label ?? "",
          username: cred.username ?? "",
          ...(expires ? { expires } : {}),
          // Fernet 解密：旧库密文用其密钥解开（key: 0..16 HMAC, 16..32 AES），复刻 core/storage.mjs 的实现
          secret: decryptOld(cred.secret_enc, readFileSync(join(oldData, "secrets", "secret.key"), "utf8").trim()),
        }
      }),
    ...restExtra,
  }
})

import { createDecipheriv, createHmac } from "node:crypto"
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

writeDoc(join(outDir, "资产.md"), serializeAssets(assets))

/* ---------- 设置.json：apps.prefs（目录 + 置顶） ---------- */
const appsPrefs = state.records?.["apps.prefs"]?.value ?? {}
writeFileSync(
  join(outDir, "设置.json"),
  `${JSON.stringify({ apps: { ...(appsPrefs.dir ? { dir: appsPrefs.dir } : {}), ...(appsPrefs.pinned ? { pinned: appsPrefs.pinned } : {}) } }, null, 2)}\n`,
  "utf8",
)

/* ---------- 图标缓存预热（可再生，复制只为省首轮提取） ---------- */
if (existsSync(join(oldData, "cache", "icons"))) {
  mkdirSync(join(outDir, "cache"), { recursive: true })
  cpSync(join(oldData, "cache", "icons"), join(outDir, "cache", "icons"), { recursive: true })
}

const navLinks = nav.categories.reduce((total, c) => total + (c.links ?? []).length, 0)
const credCount = assets.reduce((total, a) => total + a.credentials.length, 0)
console.log(`迁移完成 → ${outDir}`)
console.log(`  待办.md   原样复制（${todoText.length} 字节）`)
console.log(`  导航.md   ${nav.categories.length} 分类 / ${navLinks} 链接`)
console.log(`  资产.md   ${assets.length} 资产 / ${credCount} 凭据（已解密为明文）`)
console.log(`  设置.json 应用目录与置顶偏好`)
