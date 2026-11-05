// 独立运行入口：把 WorkbenchPanel 挂到普通网页上（react 内联打包，见 build.mjs）。
import { createRoot } from "react-dom/client"
import { WorkbenchPanel } from "./client.jsx"

createRoot(document.getElementById("root")).render(<WorkbenchPanel />)
