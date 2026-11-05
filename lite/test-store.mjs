// 数据层与凭据库自测：node --test test-store.mjs
// 覆盖：MD 往返幂等（多行私钥/特殊字符/单行化）、主口令加密（错口令/篡改必失败）、
//       凭据拆分迁移（启动自动搬）、保险库全流程（enable/lock 423/unlock 401/disable）、删资产清凭据。
import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createCore } from "./core/api.mjs"
import { parseTodos, serializeTodos } from "./core/todo.mjs"
import { ENC_PREFIX, decryptSecret, deriveKey, encryptSecret, isEncrypted, parseAssets, parseCredDoc, parseNav, serializeAssets, serializeCredDoc, serializeNav } from "./core/store.mjs"

const PEM = "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAA\n测试行==\n-----END OPENSSH PRIVATE KEY-----"

test("store: 资产/导航/凭据 Markdown 往返幂等（多行私钥、特殊字符、单行化）", () => {
  const assets = [{
    name: "Web服务器(内网)", host: "1.2.3.4", port: "22", grp: "生产", project: "P|1",
    note: "备注\n带换行", links: [{ label: "控制台", url: "https://a.b/c" }], credentials: [],
    last_status: "up", last_check: "2026-10-26T00:00:00Z",
  }]
  const text = serializeAssets(assets)
  const back = parseAssets(text)
  assert.equal(back[0].name, "Web服务器(内网)")
  assert.equal(back[0].note, "备注 带换行", "备注须单行化（防注入字段行）")
  assert.equal(serializeAssets(back), text, "序列化须幂等")

  const nav = { categories: [{ name: "AI", links: [{ title: "GPT", url: "https://chat.openai.com" }] }] }
  const navText = serializeNav(nav)
  assert.deepEqual(parseNav(navText).categories[0].links, nav.categories[0].links)
  assert.equal(serializeNav(parseNav(navText)), navText)

  const creds = new Map([["主机A", [{ type: "private-key", label: "l", username: "u", secret: PEM }]]])
  const credBack = parseCredDoc(serializeCredDoc(creds))
  assert.equal(JSON.parse(credBack.get("主机A")[0]).secret, PEM, "多行私钥经 JSON 行落盘须无损")
})

test("store: 主口令加密——错口令/篡改必失败；非密文原样返回", () => {
  const salt = Buffer.from("0123456789abcdef").toString("base64")
  const key = deriveKey("口令abcd", Buffer.from(salt, "base64"))
  const wrong = deriveKey("错误口令", Buffer.from(salt, "base64"))
  const enc = encryptSecret("秘密文本", key, salt)
  assert.ok(isEncrypted(enc) && enc.startsWith(ENC_PREFIX))
  assert.equal(decryptSecret(enc, key), "秘密文本")
  assert.throws(() => decryptSecret(enc, wrong))
  assert.throws(() => decryptSecret(enc.slice(0, -4) + "AAAA", key), "密文被篡改须失败")
  assert.equal(decryptSecret("明文", key), "明文")
})

test("core: 凭据拆分迁移 + 保险库全流程 + 删资产清凭据", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "pwb-vault-"))
  writeFileSync(join(root, "待办.md"), "# 待办\n\n", "utf8")
  writeFileSync(join(root, "资产.md"), serializeAssets([
    { name: "主机A", host: "1.1.1.1", port: "22", grp: "", project: "", note: "", links: [], credentials: [{ type: "key", label: "登录", username: "root", secret: "老密码" }], last_status: "", last_check: "" },
    { name: "主机B", host: "2.2.2.2", port: "22", grp: "", project: "", note: "", links: [], credentials: [], last_status: "", last_check: "" },
  ]), "utf8")
  const core = await createCore({ root, logger: null })
  t.after(() => {
    core.close()
    try { rmSync(root, { recursive: true, force: true }) } catch {}
  })
  const call = (method, segments, extra = {}) => core.handle(method, segments, extra)

  // 启动即迁移：资产.md 不再含凭据行；凭据.md 生成且旧类型 key 归一为 private-key
  assert.ok(!readFileSync(join(root, "资产.md"), "utf8").includes("- 凭据:"), "资产.md 不得再含凭据")
  assert.ok(existsSync(join(root, "凭据.md")))
  {
    const res = await call("GET", ["assets"])
    const a = res.json.assets.find((x) => x.name === "主机A")
    assert.equal(a.credentials.length, 1)
    assert.equal(a.credentials[0].type, "private-key")
    const credId = a.credentials[0].id
    assert.equal((await call("GET", ["credentials", credId, "secret"])).json.secret, "老密码")

    // 保险库：enable → lock(423) → unlock(401→200) → disable
    assert.deepEqual((await call("GET", ["vault"])).json, { ok: true, enabled: false, unlocked: false })
    assert.equal((await call("POST", ["vault", "enable"], { body: { passphrase: "口令1234" } })).json.enabled, true)
    assert.ok(readFileSync(join(root, "凭据.md"), "utf8").includes("ENC:v1:"), "启用后须为密文行")
    assert.equal((await call("POST", ["vault", "lock"], { body: {} })).json.unlocked, false)
    assert.equal((await call("GET", ["credentials", credId, "secret"])).status, 423, "锁定态拒绝读明文")
    assert.equal((await call("POST", ["vault", "unlock"], { body: { passphrase: "错口令" } })).status, 401)
    assert.equal((await call("POST", ["vault", "unlock"], { body: { passphrase: "口令1234" } })).json.unlocked, true)
    assert.equal((await call("GET", ["credentials", credId, "secret"])).json.secret, "老密码")
    await call("POST", ["vault", "lock"], { body: {} })
    assert.equal((await call("POST", ["assets"], { body: { name: "X", credentials: [{ secret: "s" }] } })).status, 423, "锁定态拒绝写入凭据")
    assert.equal((await call("POST", ["vault", "disable"], { body: { passphrase: "口令1234" } })).json.enabled, false)
    assert.ok(!readFileSync(join(root, "凭据.md"), "utf8").includes("ENC:v1:"), "关闭后须回到明文")

    // 删除资产连凭据小节一起清
    const again = (await call("GET", ["assets"])).json.assets.find((x) => x.name === "主机A")
    assert.equal(again.credentials[0].id, credId, "id 在加密/明文两种落盘态间保持稳定")
    await call("DELETE", ["assets", again.id], { body: {} })
    assert.ok(!readFileSync(join(root, "凭据.md"), "utf8").includes("主机A"))
  }
})

test("todo: 追加新项不留空行（与 Rust/TS 版同序）", () => {
  const original = "# 待办\n\n- [ ] 甲\n- [x] 乙\n"
  const items = parseTodos(original)
  items.push({ line: -1, done: false, text: "丙", tags: [], due: null })
  assert.equal(serializeTodos(items, original), "# 待办\n\n- [ ] 甲\n- [x] 乙\n- [ ] 丙\n")
  const again = parseTodos(serializeTodos(items, original))
  again.push({ line: -1, done: false, text: "丁", tags: ["x"], due: "2026-11-01" })
  assert.equal(
    serializeTodos(again, serializeTodos(items, original)),
    "# 待办\n\n- [ ] 甲\n- [x] 乙\n- [ ] 丙\n- [ ] 丁 #x @2026-11-01\n",
  )
})
