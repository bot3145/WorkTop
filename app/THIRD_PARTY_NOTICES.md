# 第三方声明

本项目代码以 MIT 许可发布（见 [LICENSE](LICENSE)）。下面是运行时所依赖的第三方组件与素材及其许可。
完整依赖树以 `package-lock.json` 与 `src-tauri/Cargo.lock` 为准，这里列出直接依赖与需要特别说明的部分。

## 运行时依赖（JavaScript）

| 组件 | 许可 | 用途 |
|---|---|---|
| [Vue 3](https://github.com/vuejs/core) | MIT | 前端框架 |
| [@tauri-apps/api](https://github.com/tauri-apps/tauri) | MIT OR Apache-2.0 | 前端 IPC |
| [@tauri-apps/plugin-dialog](https://github.com/tauri-apps/plugins-workspace) | MIT OR Apache-2.0 | 文件/目录选择 |

## 构建期依赖（JavaScript，不打进产物）

Vite（MIT）、@vitejs/plugin-vue（MIT）、TypeScript（Apache-2.0）、vue-tsc（MIT）、@tauri-apps/cli（MIT OR Apache-2.0）。

## 运行时依赖（Rust）

| crate | 许可 | 用途 |
|---|---|---|
| tauri | MIT OR Apache-2.0 | 应用框架 |
| tauri-plugin-dialog | MIT OR Apache-2.0 | 文件选择对话框 |
| serde / serde_json | MIT OR Apache-2.0 | 序列化 |
| sha2 / hmac | MIT OR Apache-2.0 | 哈希 |
| scrypt | MIT OR Apache-2.0 | 主口令密钥派生 |
| aes-gcm | MIT OR Apache-2.0 | 凭据加密 |
| base64 | MIT OR Apache-2.0 | 编码 |
| keyring | MIT OR Apache-2.0 | 系统钥匙串 |
| tokio（仅 net/time） | MIT | 资产探活的异步运行时 |
| thiserror | MIT OR Apache-2.0 | 错误类型 |

其余间接依赖见 `src-tauri/Cargo.lock`，许可在其各自 crate 的 `license` 字段中声明。

## 随安装包分发的独立程序（聚合分发）

| 程序 | 许可 | 用途 |
|---|---|---|
| [AirSnip（轻截）](https://github.com/bd-dxg/airsnip) v0.7.0 | **GPL-3.0** | 截图/标注/长截图/贴图。以独立进程运行（本项目仅检测、拉起并转发其热键，不并入任何代码）；二进制由 `npm run airsnip:fetch` 构建前从上游 release 拉取、随安装包聚合分发，**不进 git**（`src-tauri/sidecar/` 已忽略） |

> GPL 合规说明：AirSnip 是独立程序，与本项目的 IPC 仅限「启动进程 + 键盘热键转发」，属于聚合（mere aggregation）而非衍生作品，本项目的 MIT 许可不受影响。分发包含 AirSnip 的安装包时，须保留本声明与上游源码地址（<https://github.com/bd-dxg/airsnip>）；若不希望分发 GPL 二进制，删除 `src-tauri/sidecar/` 后构建即可（截图功能自动回落到自带实现）。

## 素材与设计资源

### 图标与字体

- 界面图标为项目内自绘 SVG（与代码同许可）。
- 不内置任何字体文件，使用系统字体栈（Windows: Segoe UI / macOS: SF Pro）。

### 参考设计

早期版本参考过一个商业付费模板的截图做视觉对齐。**那些截图不在本仓库内**，也不包含该模板的任何代码或素材；
当前界面为本项目自行实现。发布前已把截图移出仓库，后续提交请勿再引入。
