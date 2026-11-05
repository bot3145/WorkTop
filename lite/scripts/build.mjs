// 构建 UI：src/standalone.jsx → public/app.js（react 内联，单文件）。
// 服务在运行中时可能同时被请求，所以 app.js 用"临时文件 + rename"原子落盘：
// 请求方要么读到旧完整版、要么新完整版，绝无写一半被加载成白板的情况。
import { renameSync, writeFileSync } from "node:fs"
import { build } from "esbuild"

const outfile = "public/app.js"
const tmpfile = "public/app.js.tmp"

const result = await build({
  entryPoints: ["src/standalone.jsx"],
  bundle: true,
  format: "iife",
  target: "es2022",
  jsx: "automatic",
  write: false,
  logLevel: "warning",
  legalComments: "none",
  define: { "process.env.NODE_ENV": '"production"' },
})

writeFileSync(tmpfile, result.outputFiles[0].contents)
renameSync(tmpfile, outfile)
console.log("public/app.js written (atomic)")
