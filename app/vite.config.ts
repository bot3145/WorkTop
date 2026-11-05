import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"

// Tauri 开发期约定：固定端口 + 严格 host，避免 dev server 换端口时 Tauri 窗口连不上
export default defineConfig({
  plugins: [vue()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: "127.0.0.1",
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target: "chrome105", // WebView2 (Evergreen) / macOS WKWebView 均覆盖
    sourcemap: false,
  },
})
