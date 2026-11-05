# Worktop — 个人工作台

[English](README.md) | 简体中文

四个模块，三个 Markdown 文档做数据真源，无数据库、无运行时依赖：

| 模块 | 说明 | 数据 |
|---|---|---|
| 应用 | 快捷方式目录一页启动（.lnk / .url），☆ 置顶 / ★ 取消置顶 | 真源是你自己的快捷方式文件夹 |
| 待办 | Markdown 清单（`- [ ] 事项 #标签 @2026-10-26`）：看板 / **日历**（月/周视图、条目拖到其他日期即改期、逾期标红、今天高亮、今天/本周/本月/全部筛选、选中日明细与加待办）/ 标签跟踪 | `data/待办.md` |
| 导航 | 分类链接 + 「全部」视图按分类分组展示、一键全量死链检查、书签 HTML 导入导出（兼容 Edge/Chrome/Firefox 书签格式，导入为追加合并、按 URL 去重） | `data/导航.md` |
| 资产 | 固定尺寸服务器卡片（TCP 探测，长名称省略号），点击弹**详情弹窗**：凭据查看/复制/编辑/删除（密码/私钥/令牌分类，令牌=选择本地文件、统一保存到 data/tokens/<资产名>/ 并记录路径）、相关链接、编辑资产/分组重命名；凭据独立存放、可主口令加密 | `data/资产.md` + `data/凭据.md` |
| 速记 | flomo 式速记：速捕框回车即存（自动时间戳）、卡片流搜索/编辑/删除、整篇 MD 编辑 | `data/速记.md` |
| 密钥文档 | Token/API 密钥文档管理：原样存放 `data/密钥/*.md / *.txt`（一份文档一个文件）、固定尺寸卡片点击弹窗查看/编辑（CAS 防冲突）、搜索/新建/删除、可导入本地 .md / .txt 文件；初始导入两份既有文档，Obsidian 外部改动有冲突提示（隐私面，勿同步） | `data/密钥/` |
| AI 对话 | 左侧会话列表 + 右侧对话（ZCode 式双栏）；按月归档的速记支持 ?tab= 深链。AI 对话 | 流式对话 + Work 工具——只读（查待办/速记/资产/探测/导航/密钥文档名）与**写入（加待办/加速记/新增资产/SSH 执行，全部需确认卡批准）**，每厂家可配多个模型并在对话顶部切换，7 家供应商预置 + 自定义中转，OpenAI 兼容/Claude 原生双接入，测试连接，审计日志；资产卡片有 AI 对话入口（携带资产上下文）；**会话服务端持久化**——新建即存、流结束保存，资产会话按资产分别存放，支持归档/恢复，删除才清除 | `data/对话/` + `设置.json#ai` |

界面为苹果设计语言：毛玻璃顶栏 + 分段控件 + 系统字体栈；外观（自动跟随系统/浅色/深色）与主题色（经典蓝/樱花粉）两个维度独立切换，右上角 ⚙ 设置弹层里选，存 localStorage；所有确认与输入均为应用内对话框（Esc 取消 / Enter 确认）。

## 运行

```bash
npm i          # 仅构建期依赖（esbuild + react）
npm run build  # 产出 public/app.js
npm start      # node server.mjs，界面 http://127.0.0.1:8791/
```

参数与环境变量：`--root <数据目录>`（默认 `./data`）、`--port`（默认 8791）、`--host`（默认 127.0.0.1）、`--open`（用系统默认浏览器打开界面）、`--apps-dir <快捷方式目录>`；`PWB_ROOT / PWB_PORT / PWB_HOST / PWB_OPEN / PWB_APPS_DIR` 亦可。要求 Node ≥ 18，只用水内置模块。

双击启动（项目根与桌面各一份）：

- **启动工作台.lnk** — 完整版界面；服务没起则后台拉起，已在跑则直接开窗口。常用可钉到任务栏（Win+数字键直达）

没了或换目录后重新生成：

```bash
node scripts/make-shortcut.mjs desktop   # 项目根 + 桌面各一份
node scripts/make-icon.mjs               # 重新出图标（icon/icon.svg → public/favicon.ico）
node scripts/install-autostart.mjs      # 注册/注销开机自启（remove 注销、status 查看状态）
```

图标设计源文件在 `icon/icon.svg`（蓝渐变 squircle 底 + macOS 窗口红绿灯意象 + 列表条），与界面内品牌标同源；Edge 无头渲染 → System.Drawing 缩放 → PNG 直嵌 ICO（7 尺寸）。调试时想看服务日志，直接 `npm start` 或 `node server.mjs` 跑在前台即可。

**为什么不做成桌面宠物/悬浮球**：主流桌面宠物（Shimeji / VRM / Live2D 类）没有对外插件口；透明置顶悬浮窗需要 Electron/Tauri/WPF 原生壳，违背零依赖精简路线。常驻速启直接钉任务栏即可。

## 数据格式（Obsidian 可直接编辑同一份文件）

`导航.md`：`## 分类` 小节 + `- [标题](https://url)` 列表。
`资产.md`：`## 资产名` 小节 + `- 主机:` / `- 端口:` / `- 分组:` / `- 项目:` / `- 备注:` / `- 状态:` 字段行与 `- 链接: [名](url)`（**不含任何机密**，可放心同步/入 git）。
`凭据.md`：与资产同构（`## 资产名` 小节 + `- 凭据: {JSON}` 行），按类型区分 `password`（密码）/ `private-key`（私钥，可带 passphrase）/ `token`（令牌）；**隐私面独立**——默认不同步、不入 git。可在资产页「🔐 启用凭据加密」：设主口令后 secret/passphrase 字段以 `ENC:v1:scrypt盐:iv:密文`（AES-256-GCM）加密落盘，条目结构仍可读；锁定后查看需解锁。忘口令 = 解不开（重录凭据），请牢记口令。
`设置.json`：应用启动器目录、置顶与凭据库、AI 接入配置（几百字节，不值得上 MD）。
`data/对话/`：AI 对话记录与工具调用审计日志（隐私面，勿同步）。

共写防冲突：待办与导航每次保存带内容哈希，外部（Obsidian）改过就 409 并自动加载最新内容；资产是字段级操作，服务端每次读最新文件再改写。原子写（临时文件 + rename），绝不会写一半。

`data/cache/` 是图标缓存，可再生，可随时删除。

## 自检与迁移

```bash
npm test                   # 数据层单测（MD 往返幂等 / 主口令加密 / 凭据拆分迁移 / 保险库全流程）
npm run smoke              # 拉起服务走全链路 API（读校验 + 哈希回写/CAS + 凭据库往返）
node scripts/verify-migration.mjs [旧数据路径]   # 旧 SQLite 数据 ↔ 新 MD 逐项比对（旧仓库已删，需传备份路径）
node scripts/migrate.mjs [旧仓库路径]            # 一次性迁移（已执行过）
```

## API（`/api/pwb-lite/*`）

`GET health` · `GET/PUT todo`（PUT 带 `baseHash`，409 附最新内容）· `GET/PUT nav`（同上）· `POST nav/check`（死链探测，不传 category 即全量）· `GET/POST assets` · `DELETE assets/:id` · `POST assets/:id/check` · `POST assets/:id/credentials` · `PUT credentials/:id` · `GET credentials/:id/secret` · `POST/DELETE assets/:id/links` · `GET apps` · `PUT apps/prefs` · `POST apps/launch` · `POST apps/open-folder` · `GET icon?host=` · `GET appicon?file=`

安全边界：默认只监听 127.0.0.1 并校验 Host 头；快捷方式启动经文件名白名单（explorer.exe 解析，无 cmd 元字符面）；图标提取走 PowerShell 关联图标并缓存。**凭据是明文，请勿把 `data/` 提交 git 或同步到不可信位置**（`.gitignore` 已排除 `data/`）。


## 打包 Windows 安装器（可选）

安装器脚本在 `installer/worktop-lite.nsi`（NSIS / MUI2，用户级安装、目录可选、数据固定写 `%APPDATA%/WorkTopLite/data`）。**未检测到 Node.js 时自动安装内置运行时**（v24.9.0，runtime
ode.exe），装完完全自包含；命令行 `/WITHNODE` 可强制安装运行时：

```bash
# 使用 Tauri 附带的 NSIS 编译（路径按本机调整）
"$LOCALAPPDATA/tauri/NSIS/makensis.exe" installer/worktop-lite.nsi
# 产物：../release/WorkTop-Lite_2.6.3_x64-setup.exe
```

