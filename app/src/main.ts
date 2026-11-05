import { createApp } from "vue"
import App from "./App.vue"
import DockWindow from "./windows/DockWindow.vue"
import MascotWindow from "./windows/MascotWindow.vue"
import MascotMenuWindow from "./windows/MascotMenuWindow.vue"
import CardWindow from "./windows/CardWindow.vue"
import PaneWindow from "./windows/PaneWindow.vue"
import "./styles/theme.css"

// 同一个前端产物承载多种窗口：
//   （无参数）主窗口桌面壳 / ?win=dock 桌面级 Dock / ?win=mascot 吉祥物 / ?win=mascotmenu 吉祥物菜单
//   ?win=pane&app=… 独立功能窗口 / ?win=card&card=clock|calendar|… 单张桌面卡片
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
} else {
  createApp(App).mount("#app")
}
