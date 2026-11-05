// 构建前拉取 AirSnip（GPL-3.0 开源截图工具，https://github.com/bd-dxg/airsnip）：
// 下载官方单文件 exe 放入 src-tauri/sidecar/airsnip/，随安装包分发（独立进程运行，聚合分发不改变双方许可；
// 源码获取见上游仓库）。产物不进 git（.gitignore 排除），仓库保持纯 MIT。
// 用法：npm run airsnip:fetch
import { mkdir, writeFile, rm } from "node:fs/promises"
import { join } from "node:path"

const TAG = "v0.7.0"
const URL = `https://github.com/bd-dxg/airsnip/releases/download/${TAG}/airsnip-${TAG}-win-x64.exe`
const OUT_DIR = join(process.cwd(), "src-tauri", "sidecar", "airsnip")
const OUT = join(OUT_DIR, "AirSnip.exe")

async function main() {
  const res = await fetch(URL, { redirect: "follow" })
  if (!res.ok) throw new Error(`下载失败 HTTP ${res.status}：${URL}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await mkdir(OUT_DIR, { recursive: true })
  await rm(OUT, { force: true })
  await writeFile(OUT, buf)
  console.log(`AirSnip ${TAG} 已下载：${OUT}（${(buf.length / 1024 / 1024).toFixed(2)} MB）`)
  console.log("注意：该二进制为 GPL-3.0 程序，随安装包聚合分发；分发时须保留上游源码地址（THIRD_PARTY_NOTICES 已注明）。")
}

main().catch((e) => {
  console.error(String(e))
  process.exit(1)
})
