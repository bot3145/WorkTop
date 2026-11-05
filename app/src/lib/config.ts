// 桌面层共享配置与卡片布局（含磁吸算法）。
// （i18n 类型从这里转发，避免多窗口循环依赖）
export { makeT } from "../i18n"
export type { Lang, T } from "../i18n"

export interface PetCards {
  clock: boolean
  calendar: boolean
  todo: boolean
  notes: boolean
  apps: boolean
  nav: boolean
  assets: boolean
  keys: boolean
  ai: boolean
}

export interface CardRect {
  x: number
  y: number
  w: number
  h: number
}

export type CardLayout = Record<string, CardRect>

export interface AppConfig {
  /** 桌面壳模式：启用时主窗口隐藏，桌面只留卡片、Dock 与吉祥物 */
  enabled: boolean
  /** 桌面卡片的字号倍率（0.8–1.6，整卡内容一起缩放） */
  cardFontScale: number
  /** 吉祥物未折叠位置（逻辑像素） */
  x?: number
  y?: number
  /** 吉祥物是否折叠在屏幕边缘（露出半个星球） */
  mascotFolded?: boolean
  /** 折叠在哪一侧屏幕边缘 */
  mascotEdge?: "left" | "right"
  /** 折叠时的纵向位置（逻辑像素） */
  mascotY?: number
  cards: PetCards
  cardLayout: CardLayout
  toolbar: boolean
  dock: boolean
}

export const CONFIG_DEFAULTS: AppConfig = {
  enabled: true,
  cardFontScale: 1,
  mascotFolded: false,
  mascotEdge: "right",
  cards: { clock: true, calendar: true, todo: true, notes: true, apps: false, nav: false, assets: false, keys: false, ai: false },
  cardLayout: {},
  toolbar: false,
  dock: false,
}

export function mergeConfig(raw: Record<string, unknown> | undefined | null): AppConfig {
  const cfg: AppConfig = {
    ...CONFIG_DEFAULTS,
    cards: { ...CONFIG_DEFAULTS.cards },
    cardLayout: {},
  }
  if (!raw || typeof raw !== "object") return cfg
  const r = raw as Record<string, unknown>
  if (typeof r.enabled === "boolean") cfg.enabled = r.enabled
  if (typeof r.cardFontScale === "number") cfg.cardFontScale = Math.min(1.6, Math.max(0.8, r.cardFontScale))
  if (typeof r.x === "number") cfg.x = r.x
  if (typeof r.y === "number") cfg.y = r.y
  if (typeof r.mascotFolded === "boolean") cfg.mascotFolded = r.mascotFolded
  if (r.mascotEdge === "left" || r.mascotEdge === "right") cfg.mascotEdge = r.mascotEdge
  if (typeof r.mascotY === "number") cfg.mascotY = r.mascotY
  if (typeof r.toolbar === "boolean") cfg.toolbar = r.toolbar
  if (typeof r.dock === "boolean") cfg.dock = r.dock
  if (r.cards && typeof r.cards === "object") {
    const c = r.cards as Record<string, unknown>
    for (const k of CARD_KEYS) {
      if (typeof c[k] === "boolean") cfg.cards[k] = c[k] as boolean
    }
  }
  if (r.cardLayout && typeof r.cardLayout === "object") {
    for (const k of CARD_KEYS) {
      const item = (r.cardLayout as Record<string, unknown>)[k]
      if (!item || typeof item !== "object") continue
      const it = item as Record<string, unknown>
      const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null)
      const x = num(it.x)
      const y = num(it.y)
      const w = num(it.w)
      const h = num(it.h)
      if (x === null || y === null || w === null || h === null) continue
      cfg.cardLayout[k] = {
        x,
        y,
        w: Math.min(1200, Math.max(CARD_MIN[k].w, w)),
        h: Math.min(1200, Math.max(CARD_MIN[k].h, h)),
      }
    }
  }
  return cfg
}

/* ============================== 卡片布局 ============================== */

export const CARD_KEYS = [
  "clock",
  "calendar",
  "todo",
  "notes",
  "apps",
  "nav",
  "assets",
  "keys",
  "ai",
] as const
export type CardKey = (typeof CARD_KEYS)[number]

/** 卡片默认尺寸（也可被用户拖动缩放覆盖） */
export const CARD_SIZE: Record<CardKey, { w: number; h: number }> = {
  clock: { w: 220, h: 140 },
  calendar: { w: 320, h: 330 },
  todo: { w: 300, h: 240 },
  notes: { w: 290, h: 220 },
  apps: { w: 300, h: 280 },
  nav: { w: 330, h: 250 },
  assets: { w: 320, h: 250 },
  keys: { w: 290, h: 230 },
  ai: { w: 300, h: 240 },
}

/** 卡片最小尺寸（缩放下限） */
export const CARD_MIN: Record<CardKey, { w: number; h: number }> = {
  clock: { w: 160, h: 96 },
  calendar: { w: 260, h: 260 },
  todo: { w: 220, h: 140 },
  notes: { w: 220, h: 130 },
  apps: { w: 230, h: 180 },
  nav: { w: 250, h: 170 },
  assets: { w: 240, h: 160 },
  keys: { w: 220, h: 140 },
  ai: { w: 240, h: 170 },
}

export interface Area {
  left: number
  top: number
  right: number
  bottom: number
}

/** 默认排布：从工作区右上角向下堆叠，放不下就另起一列 */
export function defaultCardLayout(area: Area): CardLayout {
  const out: CardLayout = {}
  const pad = 22
  const gap = 14
  let colRight = area.right - pad
  let y = area.top + pad
  let colWidth = 0
  for (const key of CARD_KEYS) {
    const { w, h } = CARD_SIZE[key]
    if (y + h > area.bottom - pad && y > area.top + pad) {
      colRight -= colWidth + gap
      y = area.top + pad
      colWidth = 0
    }
    out[key] = { x: Math.round(colRight - w), y: Math.round(y), w, h }
    y += h + gap
    colWidth = Math.max(colWidth, w)
  }
  return out
}

/** 合并已保存布局与默认布局，并按工作区夹取（防止换分辨率后卡片跑到屏幕外） */
export function resolveLayout(cfg: AppConfig, area: Area): CardLayout {
  const base = defaultCardLayout(area)
  const out: CardLayout = {}
  for (const key of CARD_KEYS) {
    const saved = cfg.cardLayout[key]
    const def = base[key]
    const size = {
      w: Math.min(1200, Math.max(CARD_MIN[key].w, saved?.w ?? def.w)),
      h: Math.min(1200, Math.max(CARD_MIN[key].h, saved?.h ?? def.h)),
    }
    const x = Math.min(Math.max(area.left - size.w / 2, saved?.x ?? def.x), area.right - size.w / 2)
    const y = Math.min(Math.max(area.top, saved?.y ?? def.y), area.bottom - 40)
    out[key] = { x: Math.round(x), y: Math.round(y), w: Math.round(size.w), h: Math.round(size.h) }
  }
  return out
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** 磁吸判定距离（逻辑像素） */
export const SNAP_THRESHOLD = 14

/**
 * 磁吸对齐：把拖动中的卡片吸附到其它卡片与屏幕可用区的边缘。
 * 候选位置：贴住对方右缘 / 左缘（并排）、与对方左对齐 / 右对齐（纵列），
 * 屏幕四边同理；x/y 两轴独立，各取位移最小且 ≤ SNAP_THRESHOLD 的那个。
 */
export function snapRect(
  r: Rect,
  peers: Rect[],
  area?: { left: number; top: number; right: number; bottom: number },
): { x: number; y: number; snapped: boolean } {
  // 屏幕缘只给“贴内缘”候选（卡片左/右缘贴屏幕左/右缘），不构造几何线——
  // 否则会出现“卡片左缘贴到屏幕右边线外”这种屏幕外的错误吸附
  const xs: number[] = []
  const ys: number[] = []
  for (const p of peers) {
    xs.push(p.x + p.w, p.x - r.w, p.x, p.x + p.w - r.w)
    ys.push(p.y + p.h, p.y - r.h, p.y, p.y + p.h - r.h)
  }
  if (area) {
    xs.push(area.left, area.right - r.w)
    ys.push(area.top, area.bottom - r.h)
  }
  let x = r.x
  let y = r.y
  let bestDx = Infinity
  let bestDy = Infinity
  for (const v of xs) {
    const d = Math.abs(v - r.x)
    if (d <= SNAP_THRESHOLD && d < bestDx) {
      bestDx = d
      x = v
    }
  }
  for (const v of ys) {
    const d = Math.abs(v - r.y)
    if (d <= SNAP_THRESHOLD && d < bestDy) {
      bestDy = d
      y = v
    }
  }
  return { x, y, snapped: bestDx < Infinity || bestDy < Infinity }
}
