// 注册/注销 pwb-lite 后台服务开机自启（用户级 HKCU Run 键，仅当前用户，无需管理员）。
// 用法：node scripts/install-autostart.mjs [install|remove|status]（默认 install）
// 登录 Windows 后静默拉起后台服务（node server.mjs，不打开页面）；重复执行为幂等覆盖。
// 与界面设置弹层的「开机自启」开关等价（同一注册表值）。
import { autostartStatus, setAutostart } from "../core/autostart.mjs"

const action = (process.argv[2] ?? "install").toLowerCase()

if (action === "status") {
  console.log(JSON.stringify(autostartStatus(), null, 2))
} else if (action === "remove") {
  const st = setAutostart(false)
  console.log("已注销开机自启（enabled=" + st.enabled + "）")
} else {
  const st = setAutostart(true)
  console.log("已注册开机自启：登录 Windows 后自动在后台拉起服务（不打开页面）")
  console.log("位置：HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run /v pwb-lite")
  console.log("命令：" + st.command)
  console.log("注销方式：node scripts/install-autostart.mjs remove，或界面设置弹层关闭「开机自启」")
}
