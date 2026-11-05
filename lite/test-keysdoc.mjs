// 临时验证：密钥文档 .md/.txt 双扩展链路（独立临时数据目录，跑完即删）
import { spawn } from "node:child_process"
import { mkdtempSync, rmSync, readdirSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { setTimeout as sleep } from "node:timers/promises"

const root = mkdtempSync(join(tmpdir(), "pwb-keysdoc-"))
const port = 9300 + (process.pid % 300)
const child = spawn(process.execPath, [resolve(process.argv[2] ?? "server.mjs"), "--root", root, "--port", String(port)], { stdio: "ignore" })
const base = `http://127.0.0.1:${port}`
const api = async (path, opts) => {
  const res = await fetch(base + "/api/pwb-lite" + path, { headers: { "content-type": "application/json" }, ...opts })
  return { status: res.status, json: await res.json().catch(() => ({})) }
}
let fails = 0
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`)
  if (!ok) fails++
}
try {
  let up = false
  for (let i = 0; i < 40 && !up; i++) {
    await sleep(500)
    try { up = (await fetch(`${base}/healthz`)).ok } catch {}
  }
  if (!up) throw new Error("服务未就绪")

  // 1. 新建 md（不带 ext，兼容旧客户端）
  const c1 = await api("/keysdoc/云端API", { method: "PUT", body: JSON.stringify({ text: "# 云端\nAK=xxx" }) })
  check("新建 md（默认扩展）", c1.status === 200 && c1.json.ext === "md")

  // 2. 导入 txt（同名不同扩展可共存）
  const c2 = await api("/keysdoc/%E4%BA%91%E7%AB%AFAPI", { method: "PUT", body: JSON.stringify({ text: "plain token list", ext: "txt" }) })
  check("新建同名 txt", c2.status === 200 && c2.json.ext === "txt")

  // 3. 列表：两份文档、ext 正确
  const list = await api("/keysdocs")
  const md = list.json.docs.find((d) => d.name === "云端API" && d.ext === "md")
  const txt = list.json.docs.find((d) => d.name === "云端API" && d.ext === "txt")
  check("列表含 md+txt 两份", Boolean(md && txt) && txt.text === "plain token list", JSON.stringify(list.json.docs.map((d) => d.name + "." + d.ext)))

  // 4. txt 哈希回写（CAS）+ 旧哈希 409
  const w = await api("/keysdoc/%E4%BA%91%E7%AB%AFAPI", { method: "PUT", body: JSON.stringify({ text: "updated", baseHash: txt.hash, ext: "txt" }) })
  check("txt 哈希回写", w.status === 200 && w.json.hash !== txt.hash)
  const stale = await api("/keysdoc/%E4%BA%91%E7%AB%AFAPI", { method: "PUT", body: JSON.stringify({ text: "x", baseHash: txt.hash, ext: "txt" }) })
  check("txt CAS 拒旧哈希", stale.status === 409 && stale.json.currentText === "updated")
  const mdAfter = await api("/keysdocs")
  const mdKeep = mdAfter.json.docs.find((d) => d.name === "云端API" && d.ext === "md")
  check("md 未被 txt 写覆盖", mdKeep.text === "# 云端\nAK=xxx")

  // 5. 按 ext 删除：只删 txt
  const del = await api("/keysdoc/%E4%BA%91%E7%AB%AFAPI?ext=txt", { method: "DELETE" })
  const after = await api("/keysdocs")
  check("按 ext 删除 txt", del.status === 200 && after.json.docs.length === 1 && after.json.docs[0].ext === "md")
  check("磁盘文件后缀正确", readdirSync(join(root, "密钥")).join(",") === "云端API.md")

  // 6. 不带 ext 的 DELETE 仍走 md（旧客户端兼容）
  const del2 = await api("/keysdoc/%E4%BA%91%E7%81%BF%E7%AB%AFAPI", { method: "DELETE" })
  const del3 = await api("/keysdoc/" + encodeURIComponent("云端API"), { method: "DELETE" })
  check("默认 DELETE 走 md", del2.status === 404 && del3.status === 200 && (await api("/keysdocs")).json.docs.length === 0)
} catch (e) {
  check("流程", false, String(e?.message ?? e))
} finally {
  child.kill()
  await sleep(400)
  try { rmSync(root, { recursive: true, force: true }) } catch {}
}
console.log(fails ? "KEYSDOC SMOKE FAILED" : "KEYSDOC SMOKE PASSED")
process.exit(fails ? 1 : 0)
