// 桌面应用注册表：id → 标题键/图标/默认窗口尺寸。组件映射放 App.vue（避免循环依赖）。
export interface AppDef {
  id: string
  titleKey: string
  icon: string
  w: number
  h: number
}

export const APPS: AppDef[] = [
  { id: "ai", titleKey: "tab_ai", icon: "spark", w: 780, h: 660 },
  { id: "apps", titleKey: "tab_apps", icon: "rocket", w: 960, h: 620 },
  { id: "todo", titleKey: "tab_todo", icon: "checkCircle", w: 940, h: 640 },
  { id: "nav", titleKey: "tab_nav", icon: "compass", w: 900, h: 580 },
  { id: "note", titleKey: "tab_note", icon: "edit", w: 960, h: 640 },
  { id: "keys", titleKey: "tab_keys", icon: "lock", w: 980, h: 620 },
  { id: "assets", titleKey: "tab_assets", icon: "server", w: 980, h: 640 },
  { id: "settings", titleKey: "tab_settings", icon: "sliders", w: 720, h: 540 },
]

export const appDef = (id: string) => APPS.find((a) => a.id === id)

/* ---------- 内置功能快捷入口（Dock / 全屏工作台共用） ---------- */
// id "pad" 是特殊项：打开全屏工作台（不对应任何功能窗口）。
export interface BuiltinDef {
  id: string
  titleKey: string
  icon: string
  w: number
  h: number
}

export const BUILTIN_FEATURES: BuiltinDef[] = [
  { id: "pad", titleKey: "dock_workbench", icon: "grid", w: 0, h: 0 },
  ...APPS.map((a) => ({ ...a })),
]

export const builtinDef = (id: string) => BUILTIN_FEATURES.find((b) => b.id === id)

export const BUILTIN_IDS: string[] = BUILTIN_FEATURES.map((b) => b.id)
