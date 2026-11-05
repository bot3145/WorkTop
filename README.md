# WorkTop

**本地优先的个人工作台 · Local-first personal workbench**

待办、导航、资产、凭据、速记、密钥文档，全部用 **Markdown 明文**存在你自己的电脑上（Obsidian / VS Code 可直接共编），外面包一层类 macOS 的桌面壳与一只原创吉祥物。**没有账号、没有云同步、不上传任何数据。**

```text
WorkTop/
├── app/    桌面版（Windows）— Tauri 2 + Rust + Vue 3：桌面壳 + Dock + 桌面卡片 + 吉祥物 + AI + 截图
└── lite/   网页版（Node ≥18）— 零依赖本地服务，浏览器打开即用：同一套 Markdown 数据
```

## 两个版本，一份数据

| | **Lite** | **APP（桌面版）** |
|---|---|---|
| 形态 | 本地 Web 服务（localhost:8791） | 桌面应用（桌面壳 / Dock / 卡片 / 吉祥物） |
| 适合 | 服务器 / 远程场景、轻量尝鲜 | 日常主力，完整桌面体验 |
| 数据 | `data/*.md` 明文 | 同一套格式（应用数据目录） |

两边共享同一数据格式；APP 支持在「设置 → 关于」**一键迁移数据目录**（含完整数据搬迁与备份）。

## APP 功能速览

- **桌面卡片（9 种）**：时钟 / 日历 / 待办 / 便签 / 应用 / 导航 / 资产 / 密钥 / AI 快问——独立透明窗口浮在桌面层，可拖动、缩放、磁吸对齐，布局持久化
- **桌面级 Dock**：扫描开始菜单自动出图标；**点击直启**（不经 explorer，冷启动更快）；**再点一下最小化 / 恢复**运行中的窗口；**拖动排序**；自动隐藏、可替代任务栏
- **吉祥物「托托」**：原创小圆形卡通（纯 CSS，无第三方素材），可拖动、贴边折叠、待办角标；点击弹出**左侧扇形快捷菜单**（待办 / 速记 / AI / 设置 / 截图）
- **截图（AirSnip）**：内置 [AirSnip（轻截）](https://github.com/bd-dxg/airsnip)——热键 `F1` 即截，支持标注 / 长截图 / 贴图 / 聚光灯（见下方致谢）
- **AI 助手（BYOK，可选）**：接 OpenAI 兼容接口，模型通过 22 个工具直接读写你的待办 / 导航 / 速记 / 资产 / 记忆，每次写入可撤销；密钥只进系统钥匙串
- **凭据保险库**：scrypt + AES-256-GCM 主口令加密；数据按文件哈希 CAS 防冲突，与 Obsidian 双向编辑安全共存

## 快速开始（APP）

```bash
cd app
npm install
npm run airsnip:fetch     # 可选：拉取 AirSnip 截图组件（约 1.2 MB，见致谢）
npm run tauri:dev         # 开发运行（需 Node ≥20 与 Rust 工具链）
```

构建安装包：`npm run tauri:build`（NSIS，Win10/11 x64，约 3 MB + 可选截图组件 1.2 MB）。

不执行 `airsnip:fetch` 也能构建——截图自动回落到内置的轻量拖选实现。

## 快速开始（Lite）

```bash
cd lite
node server.mjs --open    # 浏览器自动打开 http://127.0.0.1:8791
```

## 数据与隐私

- 数据 = 一个文件夹里的 Markdown / TXT 明文：`待办.md`、`导航.md`、`资产.md`、`凭据.md`、`速记.md`、`密钥/`
- AI 与网络功能全部可选；不配置 API Key 时完全离线
- 不写注册表、无开机自启、无遥测

## 许可与致谢

本项目代码以 **[MIT](app/LICENSE)** 发布。

**特别感谢 [AirSnip（轻截）](https://github.com/bd-dxg/airsnip)**（[GPL-3.0](https://www.gnu.org/licenses/gpl-3.0.html)，by [bd-dxg](https://github.com/bd-dxg)）——1.2 MB 的 Rust 截图标注工具，为 WorkTop 提供截图能力：F1 热键截图、矩形 / 箭头 / 文本 / 荧光笔 / 高斯模糊 / 聚光灯标注、长截图、贴图。它以**独立程序**随安装包聚合分发（不并入本项目代码，双方许可不受影响，详见 [THIRD_PARTY_NOTICES](app/THIRD_PARTY_NOTICES.md)）；构建前由 `npm run airsnip:fetch` 从上游 release 拉取，不进入本仓库。不需要它时，删掉 `src-tauri/sidecar/` 再构建即得纯 MIT 安装包。

同时感谢 [Tauri](https://tauri.app)、[Vue](https://vuejs.org) 与众多开源依赖，完整清单见 [app/THIRD_PARTY_NOTICES.md](app/THIRD_PARTY_NOTICES.md)。

## 定制

WorkTop 的卡片 / 面板 / Dock 均为独立组件，适合定制成你的团队工作台（业务看板卡、企业导航壳、私有部署）。**欢迎带着需求提 [Issue](https://github.com/bot3145/WorkTop/issues) 聊定制。**

## 相关文档

- [app/README.md](app/README.md) — 桌面版功能、安全设计、项目结构
- [app/CHANGELOG.md](app/CHANGELOG.md) — 变更记录
- [lite/README.md](lite/README.md) — 网页版模块与数据格式
