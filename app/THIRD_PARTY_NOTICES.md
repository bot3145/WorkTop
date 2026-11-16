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
| png | MIT OR Apache-2.0 | 原生截图的 PNG 编解码 |
| keyring | MIT OR Apache-2.0 | 系统钥匙串 |
| tokio（仅 net/time） | MIT | 资产探活的异步运行时 |
| thiserror | MIT OR Apache-2.0 | 错误类型 |

其余间接依赖见 `src-tauri/Cargo.lock`，许可在其各自 crate 的 `license` 字段中声明。

## 素材与设计资源

### 图标与字体

- 界面图标为项目内自绘 SVG（与代码同许可）。
- 不内置任何字体文件，使用系统字体栈（Windows: Segoe UI / macOS: SF Pro）。

### 参考设计

早期版本参考过一个商业付费模板的截图做视觉对齐。**那些截图不在本仓库内**，也不包含该模板的任何代码或素材；
当前界面为本项目自行实现。发布前已把截图移出仓库，后续提交请勿再引入。
