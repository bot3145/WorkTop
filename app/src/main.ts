import { createApp } from "vue"
import App from "./App.vue"
import DockWindow from "./windows/DockWindow.vue"
import MascotWindow from "./windows/MascotWindow.vue"
import MascotMenuWindow from "./windows/MascotMenuWindow.vue"
import CardWindow from "./windows/CardWindow.vue"
import PaneWindow from "./windows/PaneWindow.vue"
import SnipWindow from "./windows/SnipWindow.vue"
import PinWindow from "./windows/PinWindow.vue"
import ScrollHud from "./windows/ScrollHud.vue"
import WorkbenchWindow from "./windows/WorkbenchWindow.vue"
import "./styles/theme.css"

// 同一个前端产物承载多种窗口：
//   （无参数）主窗口桌面壳 / ?win=dock 桌面级 Dock / ?win=mascot 吉祥物 / ?win=mascotmenu 吉祥物菜单
//   ?win=pane&app=… 独立功能窗口 / ?win=card&card=clock|todo|… 单张桌面卡片
//   ?win=workbench 全屏工作台（类 Launchpad）
const win = new URLSearchParams(location.search).get("win")
if (win === "dock") {
  document.documentElement.classList.add("dock-win")
  createApp(DockWindow).mount("#app")
} else if (win === "mascot") {
  // 透明悬浮窗：color-scheme 必须 normal，dark 会把透明画布填成黑方块
  document.documentElement.classList.add("dock-win", "mascot-win")
  createApp(MascotWindow).mount("#app")
} else if (win === "mascotmenu") {
  document.documentElement.classList.add("dock-win", "mascot-menu-win")
  createApp(MascotMenuWindow).mount("#app")
} else if (win === "pane") {
  document.documentElement.classList.add("dock-win")
  createApp(PaneWindow).mount("#app")
} else if (win === "card") {
  document.documentElement.classList.add("dock-win")
  createApp(CardWindow).mount("#app")
} else if (win === "snip") {
  document.documentElement.classList.add("snip-win")
  createApp(SnipWindow).mount("#app")
} else if (win === "pin") {
  // 贴图：透明悬浮窗，同 mascot 的透明约定
  document.documentElement.classList.add("dock-win", "pin-win")
  createApp(PinWindow).mount("#app")
} else if (win === "scrollhud") {
  // 长截图 HUD：透明悬浮窗（会话期间由 Rust 建于选区附近、结束时统一关闭）
  document.documentElement.classList.add("dock-win", "scrollhud-win")
  createApp(ScrollHud).mount("#app")
} else if (win === "workbench") {
  // 全屏透明工作台：同 Dock 的透明窗口约定（dock-win 负责透明画布）
  document.documentElement.classList.add("dock-win", "workbench-win")
  createApp(WorkbenchWindow).mount("#app")
} else {
  createApp(App).mount("#app")
}
