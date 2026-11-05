// Dock 配置与类型（localStorage 在同源窗口间共享，主窗口与 Dock 窗口读同一份）
export interface DockAppInfo {
  id: string
  name: string
  path: string
  kind: string
  target?: string
  icon?: string | null
  group?: string
}

export type DockPosition = "bottom" | "left" | "right"

export interface DockConfig {
  /** 配置版本：v2 自动隐藏默认开启；v3 起「替代任务栏」默认关闭 */
  v?: number
  enabled: boolean
  autohide: boolean
  /** 隐藏 Windows 任务栏，由 Dock 取而代之（默认**关**：Dock 落在任务栏上方） */
  replaceTaskbar: boolean
  size: number // 图标尺寸 px
  position: DockPosition
  apps: string[] // 固定到 Dock 的应用 id；空数组 = 自动挑选
}

const LS_KEY = "pwb_dock_cfg"
const LS_SCAN = "pwb_dock_scan"
const LS_CUSTOM = "pwb_dock_custom"

const DEFAULTS: DockConfig = {
  v: 3,
  enabled: false,
  autohide: true,
  replaceTaskbar: false,
  size: 46,
  position: "bottom",
  apps: [],
}

export function readDockConfig(): DockConfig {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DockConfig> | null
      if (parsed && typeof parsed === "object") {
        const cfg: DockConfig = { ...DEFAULTS, ...parsed }
        // v1 的默认值是「不隐藏」，多数人没主动选过；升到 v2 时统一改为默认隐藏，
        // 之后用户再关掉会以 v2 落盘，不再被迁移覆盖
        if ((parsed.v ?? 1) < 2) cfg.autohide = true
        // v3：不再默认隐藏系统任务栏（v2 及更早的配置一次性改回，之后用户手动开启才会生效）
        if ((parsed.v ?? 1) < 3) cfg.replaceTaskbar = false
        cfg.v = 3
        return cfg
      }
    }
  } catch {}
  return { ...DEFAULTS }
}

export function writeDockConfig(cfg: DockConfig) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(cfg))
  } catch {}
}

/** 应用扫描结果缓存（Dock 窗口启动时先渲染缓存，再后台刷新） */
export function readScanCache(): DockAppInfo[] {
  try {
    const raw = localStorage.getItem(LS_SCAN)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {}
  return []
}

export function writeScanCache(apps: DockAppInfo[]) {
  try {
    localStorage.setItem(LS_SCAN, JSON.stringify(apps))
  } catch {}
}

/* 自动挑选（默认推荐）：按"像不像日常应用"打分排序，而不是按字母序。
   加分：用户自装（不在"公共"分组）、常见日用/办公/开发工具名；
   减分：系统工具、管理控制台、卸载项、说明文档。 */
const SYSTEM_NOISE =
  /(^(run|control panel|services|system|settings|task manager|device manager|disk management|cmd|powershell)$|运行|控制面板|windows |microsoft visual studio|visual studio|sdk|kits|powershell|command prompt|developer |odbc|verifier|debuggable|documentation for|sample |wsl|hyper-v|registry editor|event viewer|performance monitor|task scheduler|task manager|disk cleanup|dfrgui|iscsi|memory diagnostics|magnify|narrator|voiceaccess|livecaptions|on-screen keyboard|steps recorder|computer management|component services|print management|recoverydrive|resource monitor|security configuration|system configuration|system information|administrative tools|system tools|accessibility|character map|install manager|application frame|install additional|tools for )/i
const UNINSTALL =
  /(uninstall|卸载|readme|说明|帮助|help|website|documentation|^docs?$|manual|license|许可|手册|changelog|changes|update|更新|修复|repair)/i
const POPULAR =
  /(微信|wechat|qq(?!音乐)|钉钉|dingtalk|飞书|lark|edge|chrome|firefox|notion|obsidian|typora|wps|office|word|excel|powerpoint|visual studio code|^code$|steam|spotify|网易云|qq音乐|bilibili|哔哩|百度网盘|阿里云盘|夸克|迅雷|everything|7-zip|winrar|bandizip|potplayer|vlc|clash|v2ray|telegram|discord|slack|zoom|teams|postman|navicat|dbeaver|git|python|node|utools|snipaste|pixpin|tim|foxmail|搜狗|百度|chrome|夸克|notepad|sublime|webstorm|idea|pycharm|docker|mobaxterm|xshell|finalshell|termius|tabby|warp|wezterm|alacritty|windowsterminal|terminal)/i

function scoreOf(app: DockAppInfo): number {
  let score = 0
  if (app.group && app.group !== "公共") score += 15
  if (!app.group) score += 8
  // 文件管理器是最常用的系统入口，保送进自动推荐前排
  if (/explorer\.exe$/i.test(app.path) || app.name === "文件管理器") score += 80
  if (POPULAR.test(app.name) && !UNINSTALL.test(app.name)) score += 40
  if (SYSTEM_NOISE.test(app.name)) score -= 100
  if (UNINSTALL.test(app.name)) score -= 200
  return score
}

export function autoPick(apps: DockAppInfo[], limit = 10): DockAppInfo[] {
  const ranked = [...apps].sort((a, b) => {
    const d = scoreOf(b) - scoreOf(a)
    return d !== 0 ? d : a.name.localeCompare(b.name, "zh-Hans-CN")
  })
  const positive = ranked.filter((a) => scoreOf(a) > 0)
  const pool = positive.length >= Math.min(limit, 4) ? positive : ranked.filter((a) => scoreOf(a) > -100)
  return pool.slice(0, limit)
}

/** 设置页列表排序：推荐分高的排前面，便于快速找到常用应用 */
export function sortForPicker(apps: DockAppInfo[]): DockAppInfo[] {
  return [...apps].sort((a, b) => {
    const d = scoreOf(b) - scoreOf(a)
    return d !== 0 ? d : a.name.localeCompare(b.name, "zh-Hans-CN")
  })
}

/** 计算 Dock 窗口尺寸（前端与 Rust 定位共用）；左/右侧为竖向 Dock */
export function dockWindowSize(cfg: DockConfig, iconCount: number) {
  const gap = 8
  const padding = 10
  const n = Math.max(1, iconCount) + 1 // +1 为「＋」按钮
  const length = padding * 2 + n * cfg.size + (n - 1) * gap
  // 悬停放大 1.42×，同时最多上移 ~10px：横/竖两个方向都要留出余量，否则图标被窗口裁掉
  const cross = Math.round(cfg.size * 1.55 + 34)
  if (cfg.position === "bottom") return { width: length, height: cross, gap, padding }
  return { width: cross, height: length, gap, padding }
}

/** 用户手动添加的快捷方式（+ 按钮） */
export function readCustomApps(): DockAppInfo[] {
  try {
    const raw = localStorage.getItem(LS_CUSTOM)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {}
  return []
}

export function writeCustomApps(apps: DockAppInfo[]) {
  try {
    localStorage.setItem(LS_CUSTOM, JSON.stringify(apps))
  } catch {}
}

/** 扫描结果 + 自定义短链合并（自定义排前面，同 id 去重） */
export function mergeCustomApps(scanned: DockAppInfo[], custom: DockAppInfo[]): DockAppInfo[] {
  const seen = new Set<string>()
  const out: DockAppInfo[] = []
  for (const app of [...custom, ...scanned]) {
    if (seen.has(app.id)) continue
    seen.add(app.id)
    out.push(app)
  }
  return out
}
