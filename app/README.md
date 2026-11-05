# WorkTop
### 本地优先的个人工作台桌面应用 · Local-first personal workbench for Windows & macOS

待办、导航、资产、凭据、速记、密钥文档，用 **Markdown 明文**存在你自己电脑上；外面套一层类 macOS 的桌面壳（顶部工具栏 / 启动台 / Dock / 可拖动卡片），再加一只会眨眼、会晃悠的**原创吉祥物「托托」**（纯 CSS 能量球，点击弹出快捷菜单）。

整个应用**纯本地运行**：没有账号、没有云同步、不上传任何数据。数据就是一个文件夹，Obsidian 可以直接打开同一份文件一起编辑。

技术栈：**Tauri 2 + Rust + Vue 3.5 + Vite 8**。安装包约 3 MB（不含任何第三方素材），主程序 10.4 MB，前端产物 235 kB（gzip 80 kB）。

---

## 功能

### 工作台
| 模块 | 能力 |
|---|---|
| 待办 | `待办.md` 三视图（今天 / 全部 / 已完成），标签与截止日期；语法与 Obsidian 任务清单兼容 |
| 导航 | `导航.md` 分类 + 链接，死链检查 |
| 资产 | `资产.md` 主机/端口/分组/链接/凭据关联，TCP 探活与到期提醒 |
| 凭据 | `凭据.md` 密码 / SSH 私钥 / Token，可整体做主口令加密 |
| 速记 | `速记.md` 按时间分节的随手记 |
| 密钥文档 | `密钥/*.md`、`密钥/*.txt` 新建，或直接导入本地文件 |

### 桌面层
- 菜单栏时钟、右键菜单、启动台（桌面背景跟随明暗主题）
- 壳内窗口管理器（红绿灯 / 拖动 / 缩放 / 最小化 / 布局记忆）
- **桌面级 Dock**：扫描开始菜单、批量提取图标、悬停放大、自动隐藏、运行状态点；**点击直启目标程序**（不经 explorer，冷启动更快）；运行中**再点一下最小化 / 恢复**；**按住拖动排序**；文件管理器等系统入口开箱即有
- **应用启动器**：指定一个文件夹，列出其中全部 `.lnk/.url/.exe` 快捷方式
- **截图（AirSnip）**：热键 `F1` 或吉祥物菜单 / Dock 右键「截图」——拖框、标注（矩形/箭头/文本/荧光笔/模糊/聚光灯）、长截图、贴图（见[致谢](../README.md#许可与致谢)）；未拉取 AirSnip 组件时自动回落内置轻量拖选
- **数据目录可迁移**：设置 → 关于 → 「更改数据目录」，全部数据完整搬迁，原目录自动备份
- **吉祥物「托托」**：本项目**原创小圆形卡通形象**（能量球：两只表情眼 + 微笑 + 天线 + 轨道卫星），常驻桌面，**可拖动**；拖到屏幕边缘自动**折叠一半**（点击展开）；未折叠时显示**当天待办数量**角标；**点击弹出左侧扇形菜单**（待办 / 速记 / AI / 设置 / 截图，12 点 → 9 点 → 6 点方向排列）。纯 CSS 绘制，不使用任何第三方素材，无授权风险
- **桌面卡片（9 种）**：时钟 / 日历 / 待办 / 便签 / 应用 / 导航 / 资产 / 密钥文档 / AI 快问，每张是独立窗口，可拖到桌面任意位置、可缩放，布局持久化到 `设置.json`；卡片内容随尺寸自适应（变宽多列、变高多行，间距固定），字号可在设置里整体调大调小。
  - 卡片在**桌面层**：不置顶、点击不抢焦点，普通窗口会盖住它们——像真实桌面小组件（Windows 用 `WS_EX_NOACTIVATE` + `HWND_BOTTOM` 实现）；只有吉祥物始终在最上层。
  - 卡身与 Dock **完全透明**：无底板、无描边、无模糊，内容直接浮在桌面上（文字为白色 + 投影保证可读）；拖动时与其它卡片**磁吸对齐**（并排贴合 / 边缘对齐 / 贴屏幕边，阈值 14px）。
  - 卡片上的「打开」会开出**独立功能窗口**（待办/导航/速记/密钥/应用/AI/设置），不唤起工作台主窗口；桌面壳模式下工作台主窗口保持隐藏，桌面只留卡片、Dock 与吉祥物。
  - 资产卡只读展示状态点（凭据不进卡片）；密钥卡只显示名称与字数（内容不进卡片窗口）；AI 卡是一句话快问，提交即唤起 AI 窗口。

## AI 助手（远端算力，可选）

工作台的每个板块都能被 AI 直接读写，而不只是「旁边放个聊天框」：

- 接任意 **OpenAI 兼容**接口（DeepSeek / OpenAI / Kimi / 自建 vLLM 都行）：填 base URL、模型名、API Key 即可用。
- **API Key 只进系统钥匙串**（Windows Credential Manager / macOS Keychain），不写文件、不进日志、不进前端存储。
- 模型通过 **22 个工具**操作真实数据：待办增/改/删、导航分类与链接、速记、密钥文档、资产（**凭据不暴露**）、长期记忆。写入走同一套原子写与 Markdown 格式，等于「另一个编辑入口」。
- **每条写入都能撤销**：工具卡片带「撤销」，按哈希校验回滚；文件期间被别人改过就拒绝撤销，不会覆盖你的手改。
- 关掉「允许修改数据」后只剩只读工具；写工具在只读模式下由**后端**拒绝（不只靠提示词）。
- 每个窗口标题栏都有 ✨ 按钮，带着该板块的上下文直接开问。
- 会话逐条落 `AI/会话/<id>.jsonl`，长期记忆在 `AI/记忆.md`，都可以用 Obsidian 直接编辑。

数据流向：**只有对话内容与工具返回的文本**会发给你配置的服务商；不经过任何中转，也不上传到别处。凭据（密码/私钥）永远不进模型上下文。

## 快速开始

前置：Node.js ≥ 20.19、Rust ≥ 1.77、Windows 10/11（WebView2）或 macOS 11+。

```bash
npm ci
npm run tauri:dev                 # 开发
npm run tauri:build               # 打包（Windows 出 NSIS 安装包）
cargo test --manifest-path src-tauri/Cargo.toml   # Rust 单元测试
npm run typecheck                 # 前端类型检查
```

注意：**不要用 `cargo build --release` 直接出包**——那样编出来的二进制仍指向开发服务器（白屏）。请走 `npm run tauri:build` 或 `npx tauri build --no-bundle`。

## 数据与隐私

数据目录优先级：`PWB_DATA_DIR` 环境变量 > `%APPDATA%\com.bert.worktop\data`（macOS 为 `~/Library/Application Support/com.bert.worktop/data`）。

```text
data/
├── 待办.md  导航.md  资产.md  速记.md      # 全部是普通 Markdown
├── 凭据.md                                # 可整体加密（ENC:v1 行格式）
├── 密钥/<文档>.md | .txt
└── 设置.json                              # 应用偏好（不含秘密）
```

- 写入一律「临时文件 + rename」原子写；整文档编辑带 SHA-256 CAS，外部改过不覆盖而是回读。
- 凭据可用主口令加密：`scrypt(N=2^15, r=8, p=1)` 派生密钥 + `AES-256-GCM`；主口令可选择托管到系统钥匙串（Windows Credential Manager / macOS Keychain）。
- **忘记主口令 = 解不开**，没有后门也没有恢复密钥——这是有意的设计。
- 应用不做后台网络请求；唯一的对外连接是你在资产里主动点击的 TCP 探活。

## 安全设计

- 严格 CSP（`default-src 'self'`、`object-src 'none'`、`base-uri 'self'`、`frame-src 'none'`），开启 `freezePrototype`。
- Tauri **capabilities 最小权限**：只授予窗口几何/置顶与文件选择对话框；未使用的插件（外部链接打开、通知）不注册、不授权。
- 启动器与 Dock 只接受 `.lnk/.url/.exe/.app`，路径经 `canonicalize` 校验必须落在配置目录内；子进程一律参数数组 + `CREATE_NO_WINDOW`，不经过 shell 拼接。
- 外部程序协作（AirSnip 截图）只做「启动进程 + 键盘热键转发」，不并入任何第三方代码；仓库不含 GPL 二进制（构建期拉取）。
- 仓库内不含任何密钥、证书、真实数据；`dev-data/` 是合成测试数据且已被忽略。

报告安全问题请先看 [SECURITY.md](SECURITY.md)，不要直接开公开 issue。

## 项目结构

```text
src/                     Vue 前端
├── components/          桌面壳组件 + 小组件 + 通用控件
├── panes/               待办/导航/资产/凭据/速记/密钥 面板
├── windows/             Dock / 吉祥物 / 单张卡片（各自独立窗口）
├── lib/                 API 封装、数据格式、卡片布局与磁吸
└── composables/         窗口、组件位置、待办数据
src-tauri/src/
├── commands/            Tauri 命令（文档/资产/凭据/桌面层/Dock/启动器）
├── store/               Markdown 解析序列化、CAS 原子写、凭据加密
└── main.rs              窗口、托盘、命令注册
```

## 状态

可用：工作台各面板与密钥文档、桌面壳、Dock（直启/最小化切换/拖动排序）、应用启动器、吉祥物与桌面卡片、凭据加密与钥匙串、AI 助手（BYOK）、截图（AirSnip 聚合分发 / 内置回落）、数据目录迁移。
未完成：资产/凭据面板的部分交互、后台轮询通知、macOS 打包签名。

细节与决策记录见 [PLAN.md](PLAN.md)，变更见 [CHANGELOG.md](CHANGELOG.md)。

## 许可

代码以 [MIT](LICENSE) 发布。第三方依赖与其许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
吉祥物「托托」为本项目原创形象，随项目以 MIT 发布，无第三方素材授权问题。

---

## English (short)

Worktop is a local-first personal workbench for Windows and macOS built with Tauri 2, Rust and Vue 3. Todos, bookmarks, assets, credentials, notes and key documents are plain Markdown files on your disk — Obsidian can edit the same files. Credentials can be encrypted with a master passphrase (scrypt + AES-256-GCM) optionally kept in the OS keychain. A macOS-like desktop shell, a real desktop-level Dock, a folder-based app launcher, draggable/resizable desktop cards and an original SVG mascot sit on top of it. No accounts, no telemetry, no uploads.

Licensed under MIT. Third-party notices are documented in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
