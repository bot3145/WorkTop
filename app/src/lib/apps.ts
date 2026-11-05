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
