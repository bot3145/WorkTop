// 工作台主题色 → 桌宠/环形菜单调色板。
// 设置页把选择写入 localStorage 的 pwb_accent（blue/pink/green），
// 独立悬浮窗直接读取，并通过 storage 事件跟随切换。
export type Accent = "blue" | "pink" | "green"

export interface AccentPalette {
  /** 主色（按钮描边/轨道/球体底光） */
  accent: string
  /** 辅助亮色（高光/扫描线） */
  accent2: string
  /** 深色底 1（球体暗部） */
  deep: string
  /** 深色底 2（球体中间调） */
  deep2: string
  /** 近白高光 */
  light: string
  /** 粒子/卫星光点 */
  spark: string
}

export const ACCENTS: Record<Accent, AccentPalette> = {
  blue: {
    accent: "#409cff",
    accent2: "#8fd4ff",
    deep: "#2b3a52",
    deep2: "#d9edff",
    light: "#ffffff",
    spark: "#5fb4ff",
  },
  pink: {
    accent: "#ff5c97",
    accent2: "#ff9dc0",
    deep: "#4a3040",
    deep2: "#ffe0ec",
    light: "#ffffff",
    spark: "#ff7fae",
  },
  green: {
    accent: "#4cc06d",
    accent2: "#8fd8a5",
    deep: "#2b4032",
    deep2: "#ddf5e3",
    light: "#ffffff",
    spark: "#62c982",
  },
}

const VALID: Accent[] = ["blue", "pink", "green"]

/** 读取当前工作台主题色；异常/旧值回落到经典蓝。 */
export function readAccent(): Accent {
  try {
    const v = localStorage.getItem("pwb_accent") as Accent | null
    return v && VALID.includes(v) ? v : "blue"
  } catch {
    return "blue"
  }
}

/** 转成 CSS 自定义属性，供两个悬浮窗共用。 */
export function accentVars(accent: Accent): Record<string, string> {
  const p = ACCENTS[accent]
  return {
    "--m-accent": p.accent,
    "--m-accent-2": p.accent2,
    "--m-deep": p.deep,
    "--m-deep-2": p.deep2,
    "--m-light": p.light,
    "--m-spark": p.spark,
  }
}
