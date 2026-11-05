// 冒烟：拉起服务（真实数据目录，只做读校验 + 一次哈希回写），验证 API 与 Markdown 数据链路。
// 用法：npm run smoke
import { spawn } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { setTimeout as sleep } from "node:timers/promises"

const root = resolve(join(import.meta.dirname, "..", "data"))
const port = 8700 + (process.pid % 500)
const child = spawn(process.execPath, [join(import.meta.dirname, "..", "server.mjs"), "--port", String(port)], {
  stdio: "ignore",
})

const base = `http://127.0.0.1:${port}`
const api = async (path, opts) => {
  const res = await fetch(base + "/api/pwb-lite" + path, { headers: { "content-type": "application/json" }, ...opts })
  return { status: res.status, json: await res.json().catch(() => ({})) }
}

let failures = 0
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`)
  if (!ok) failures++
}

try {
  let up = false
  for (let i = 0; i < 40 && !up; i++) {
    await sleep(500)
    try {
      up = (await fetch(`${base}/healthz`)).ok
    } catch {}
  }
  if (!up) throw new Error("服务 20s 内未就绪")

  const health = await api("/health")
  check("health 可达", health.status === 200 && health.json.ok === true, `v${health.json.version}`)
  check(
    "数据量正确（17 资产 / 15 凭据 / 10 分类 / 235 链接）",
    JSON.stringify(health.json.counts) === JSON.stringify({ assets: 17, credentials: 15, navCategories: 10, navLinks: 235 }),
    JSON.stringify(health.json.counts),
  )

  const todo = await api("/todo")
  check("待办可读（含哈希）", todo.status === 200 && typeof todo.json.hash === "string")

  // 哈希回写：写回同样内容应成功且哈希不变；带旧哈希写应 409（CAS 生效）
  const put = await api("/todo", { method: "PUT", body: JSON.stringify({ text: todo.json.text, baseHash: todo.json.hash }) })
  check("待办哈希回写成功", put.status === 200 && put.json.hash === todo.json.hash)
  const conflict = await api("/todo", { method: "PUT", body: JSON.stringify({ text: "x", baseHash: "deadbeef" }) })
  check("待办 CAS 拒绝过期哈希", conflict.status === 409 && conflict.json.currentText !== undefined)

  const nav = await api("/nav")
  check("导航可读", nav.status === 200 && nav.json.nav.categories.length === 10)
  const navPut = await api("/nav", { method: "PUT", body: JSON.stringify({ nav: nav.json.nav, baseHash: nav.hash }) })
  check("导航哈希回写成功（MD 往返幂等）", navPut.status === 200)
  const navConflict = await api("/nav", { method: "PUT", body: JSON.stringify({ nav: nav.json.nav, baseHash: "deadbeef" }) })
  check("导航 CAS 拒绝并附最新内容", navConflict.status === 409 && navConflict.json.currentNav !== undefined)

  const assets = await api("/assets")
  const withCred = assets.json.assets.find((a) => a.credentials.length)
  check("资产列表可读", assets.status === 200 && assets.json.assets.length === 17)
  const secret = await api(`/credentials/${withCred.credentials[0].id}/secret`)
  check("凭据查看返回明文", secret.status === 200 && typeof secret.json.secret === "string" && secret.json.secret.length > 0)

  // 凭据库（主口令加密）全流程：enable → lock(423) → unlock → disable（结束回到明文，与初始状态一致）
  const v0 = await api("/vault")
  check("凭据库初始未启用", v0.json.enabled === false)
  check("凭据库启用", (await api("/vault/enable", { method: "POST", body: JSON.stringify({ passphrase: "smoke-口令1234" }) })).json.enabled === true)
  const credId = withCred.credentials[0].id
  await api("/vault/lock", { method: "POST", body: "{}" })
  check("锁定后凭据 423", (await api(`/credentials/${credId}/secret`)).status === 423)
  check("错口令 401", (await api("/vault/unlock", { method: "POST", body: JSON.stringify({ passphrase: "错的" }) })).status === 401)
  check("解锁后可读明文", (await api("/vault/unlock", { method: "POST", body: JSON.stringify({ passphrase: "smoke-口令1234" }) })).json.unlocked === true
    && (await api(`/credentials/${credId}/secret`)).json.secret === secret.json.secret)
  check("关闭加密回到明文", (await api("/vault/disable", { method: "POST", body: JSON.stringify({ passphrase: "smoke-口令1234" }) })).json.enabled === false)

  const apps = await api("/apps")
  check("应用清单可读", apps.status === 200 && Array.isArray(apps.json.apps))
} catch (error) {
  check("冒烟流程", false, String(error?.message ?? error))
} finally {
  child.kill()
  await sleep(500)
  try {
    rmSync(join(tmpdir(), "pwb-lite-smoke"), { recursive: true, force: true })
  } catch {}
}

console.log(failures ? `SMOKE FAILED: ${failures} 项` : "SMOKE PASSED")
process.exit(failures ? 1 : 0)
