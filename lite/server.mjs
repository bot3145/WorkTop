// pwb-lite 独立服务：无第三方运行时依赖（Node >= 18），node server.mjs 即可运行。
// 数据真源是 data/ 下的三个 Markdown 文档（待办/导航/资产）+ 设置.json，Obsidian 可直接编辑。
//
// 用法：
//   node server.mjs [--root <数据目录>] [--port 8791] [--host 127.0.0.1] [--open] [--apps-dir <快捷方式目录>]
//   环境变量 PWB_ROOT / PWB_PORT / PWB_HOST / PWB_OPEN / PWB_APPS_DIR 亦可。
import http from "node:http"
import { spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { dirname, isAbsolute, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createCore, API_PREFIX } from "./core/api.mjs"
import { readJsonBody } from "./core/http-util.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const argOf = (name) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : undefined
}

const root = resolve(process.env.PWB_ROOT ?? argOf("--root") ?? join(here, "data"))
if (!isAbsolute(root)) throw new Error(`--root 需要绝对路径：${root}`)
const port = Number(process.env.PWB_PORT ?? argOf("--port") ?? 8791)
const host = process.env.PWB_HOST ?? argOf("--host") ?? "127.0.0.1"
const appsDir = process.env.PWB_APPS_DIR ?? argOf("--apps-dir")

let core

const PUBLIC = join(here, "public")
const STATIC = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/index.html": { file: "index.html", type: "text/html; charset=utf-8" },
  "/app.js": { file: "app.js", type: "text/javascript; charset=utf-8" },
  "/favicon.ico": { file: "favicon.ico", type: "image/x-icon" },
}

// 打开界面：优先 Edge --app 独立窗口（无地址栏/标签页、任务栏独立成项），找不到 Edge 回落默认浏览器。
function openInterface(url) {
  // 用系统默认浏览器打开（用户要求不指定具体浏览器）。Windows 走 cmd start，等价于双击 URL；
  // macOS/Linux 各自的默认打开命令。浏览器层的问题（窗口渲染等）交由用户默认浏览器自身处理。
  const opener = process.platform === "win32"
    ? spawn("cmd", ["/c", "start", "pwb", url], { detached: true, stdio: "ignore", windowsHide: true })
    : process.platform === "darwin"
      ? spawn("open", [url], { detached: true, stdio: "ignore" })
      : spawn("xdg-open", [url], { detached: true, stdio: "ignore" })
  opener.unref()
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`)
  const method = (req.method ?? "GET").toUpperCase()

  // 回环绑定时校验 Host 头，阻断 DNS rebinding（资产.md 是明文凭据，更不能当跳板）。
  const loopback = ["127.0.0.1", "localhost", "::1"]
  if (loopback.includes(host)) {
    const hostName = String(req.headers.host ?? "").replace(/:\d+$/u, "").replace(/^\[|\]$/gu, "")
    if (!loopback.includes(hostName)) {
      res.writeHead(403, { "content-type": "application/json; charset=utf-8" })
      res.end(JSON.stringify({ ok: false, error: "Host 头不是本机回环地址，已拒绝。" }))
      return
    }
  }

  try {
    if (url.pathname === "/healthz") {
      const result = await core.handle("GET", ["health"])
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" })
      res.end(JSON.stringify(result.json))
      return
    }

    if (url.pathname === API_PREFIX || url.pathname.startsWith(API_PREFIX + "/")) {
      const relative = url.pathname.slice(API_PREFIX.length)
      let segments
      try {
        segments = relative.split("/").filter(Boolean).map(decodeURIComponent)
      } catch {
        res.writeHead(400, { "content-type": "application/json; charset=utf-8" })
        res.end(JSON.stringify({ ok: false, error: "路径编码不合法。" }))
        return
      }
      let body
      try {
        if (method === "PUT" || method === "POST") body = await readJsonBody(req)
      } catch (error) {
        const status = error?.status ?? 400
        res.writeHead(status, { "content-type": "application/json; charset=utf-8" })
        res.end(JSON.stringify({ ok: false, error: String(error?.message ?? error) }))
        return
      }
      const result = await core.handle(method, segments, { query: url.searchParams, body })
      if (result.raw !== undefined) {
        if (result.status !== 200) {
          res.writeHead(result.status)
          res.end()
          return
        }
        res.writeHead(result.status, { "content-type": result.type, ...result.headers })
        res.end(result.raw)
        return
      }
      if (result.stream) {
        res.writeHead(result.status ?? 200, { "content-type": result.type ?? "text/event-stream", "cache-control": "no-store", ...result.headers })
        try {
          for await (const chunk of result.stream) res.write(chunk)
        } finally {
          res.end()
        }
        return
      }
      res.writeHead(result.status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" })
      res.end(JSON.stringify(result.json))
      return
    }

    const staticEntry = STATIC[url.pathname]
    if (method === "GET" && staticEntry) {
      let body
      try {
        body = readFileSync(join(PUBLIC, staticEntry.file))
      } catch {
        body = undefined
      }
      if (body !== undefined) {
        res.writeHead(200, { "content-type": staticEntry.type, "cache-control": "no-cache" })
        res.end(body)
        return
      }
    }

    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" })
    res.end("not found")
  } catch (error) {
    res.writeHead(500, { "content-type": "application/json; charset=utf-8" })
    res.end(JSON.stringify({ ok: false, error: String(error?.message ?? error) }))
  }
})

// 已有实例在跑（端口被占）时：带 --open 的启动直接打开既有窗口再退出（"再次双击没反应"的解法）；
// 驻停小窗等不带 --open 的启动静默退出，避免误弹完整版窗口。
const shouldOpen = process.env.PWB_OPEN === "1" || args.includes("--open")
server.on("error", (error) => {
  if (error?.code === "EADDRINUSE") {
    console.error(`[pwb-lite] 端口 ${port} 已被占用——工作台可能已在运行。`)
    if (shouldOpen) openInterface(`http://127.0.0.1:${port}/`)
    process.exit(0)
  }
  console.error("[pwb-lite] 服务启动失败：", error)
  process.exit(1)
})

async function main() {
  core = await createCore({ root, appsDir, logger: console })
  server.listen(port, host, () => {
    console.log(`[pwb-lite] 已启动`)
    console.log(`  界面   http://${host}:${port}/`)
    console.log(`  API    http://${host}:${port}${API_PREFIX}/health`)
    console.log(`  数据   ${root}（待办.md / 导航.md / 资产.md / 设置.json）`)
    if (shouldOpen) {
      const openHost = host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host
      openInterface(`http://${openHost}:${port}/`)
    }
  })
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    console.log("\n[pwb-lite] 正在关闭…")
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 1500).unref()
  })
}

main().catch((error) => {
  console.error("[pwb-lite] 启动失败：", error)
  process.exit(1)
})
