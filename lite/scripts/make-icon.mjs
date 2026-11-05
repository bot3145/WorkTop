// 图标流水线：icon/icon.svg →（Edge 无头截图 256px）→（System.Drawing 缩放多尺寸）→ public/favicon.ico
// 用法：node scripts/make-icon.mjs（依赖：msedge.exe + PowerShell System.Drawing，无需 npm 依赖）
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const root = join(import.meta.dirname, "..")
const iconDir = join(root, "icon")
const png256 = join(iconDir, "icon-256.png")
const svg = join(iconDir, "icon.svg")

/* ---------- 1) Edge 无头渲染 SVG → 256px PNG ---------- */
const edgeCandidates = [
  join(process.env.LOCALAPPDATA ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(existsSync)
if (!edgeCandidates.length) throw new Error("找不到 msedge.exe")
rmSync(png256, { force: true })
execFileSync(edgeCandidates[0], [
  "--headless", "--disable-gpu",
  `--screenshot=${png256}`,
  "--window-size=256,256",
  "--default-background-color=00000000",
  `file:///${svg.replace(/\\/gu, "/")}`,
], { stdio: "ignore", timeout: 30000 })
if (!existsSync(png256)) throw new Error("渲染失败：icon-256.png 未生成")
console.log("rendered:", png256)

/* ---------- 2) System.Drawing 高质量缩放（256 用原图，避免 GDI+ 文件锁自覆盖） ---------- */
const sizes = [16, 24, 32, 48, 64, 128]
execFileSync(
  "powershell.exe",
  [
    "-NoProfile", "-Command",
    `Add-Type -AssemblyName System.Drawing; ` +
    `$src=[System.Drawing.Image]::FromFile('${png256}'); ` +
    sizes.map((s) =>
      `$b${s}=New-Object System.Drawing.Bitmap(${s},${s}); ` +
      `$g${s}=[System.Drawing.Graphics]::FromImage($b${s}); ` +
      `$g${s}.InterpolationMode='HighQualityBicubic'; ` +
      `$g${s}.SmoothingMode='HighQuality'; ` +
      `$g${s}.PixelOffsetMode='HighQuality'; ` +
      `$g${s}.DrawImage($src,0,0,${s},${s}); ` +
      `$b${s}.Save('${join(iconDir, `icon-${s}.png`)}',[System.Drawing.Imaging.ImageFormat]::Png)`,
    ).join("; ") +
    `; $src.Dispose()`,
  ],
  { stdio: "inherit" },
)
console.log("scaled:", sizes.map((s) => `${s}px`).join(" "))

/* ---------- 3) 打包 ICO（PNG 直嵌，Vista+ 全支持） ---------- */
const pngs = [...sizes, 256].map((size) => ({ size, data: readFileSync(join(iconDir, `icon-${size}.png`)) }))
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0) // reserved
header.writeUInt16LE(1, 2) // type: icon
header.writeUInt16LE(pngs.length, 4)
const entries = []
let offset = 6 + 16 * pngs.length
for (const { size, data } of pngs) {
  const entry = Buffer.alloc(16)
  entry.writeUInt8(size >= 256 ? 0 : size, 0) // 宽（0 = 256）
  entry.writeUInt8(size >= 256 ? 0 : size, 1)
  entry.writeUInt8(0, 2) // 调色板色数
  entry.writeUInt8(0, 3) // 保留
  entry.writeUInt16LE(1, 4) // 颜色平面
  entry.writeUInt16LE(32, 6) // 位深
  entry.writeUInt32LE(data.length, 8)
  entry.writeUInt32LE(offset, 12)
  entries.push(entry)
  offset += data.length
}
const ico = Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)])
writeFileSync(join(root, "public", "favicon.ico"), ico)
console.log(`packed: public/favicon.ico (${(ico.length / 1024).toFixed(1)} KiB, ${pngs.length} sizes)`)
