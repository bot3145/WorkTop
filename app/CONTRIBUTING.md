# 贡献指南

欢迎 issue 与 PR。请先读完这份约定，能省掉来回沟通。

## 开始之前

- 安全问题**不要**开公开 issue，见 [SECURITY.md](SECURITY.md)。
- 功能类改动建议先开 issue 说明场景，避免大改后方向不一致。
- 不要提交任何真实数据、密钥、证书、内网地址、个人路径；`dev-data/` 只放合成数据。

## 环境

| 需要 | 版本 |
|---|---|
| Node.js | ≥ 20.19 |
| Rust | ≥ 1.77（stable） |
| 系统 | Windows 10/11（WebView2）或 macOS 11+ |

```bash
npm ci
npm run tauri:dev                                 # 开发模式
cargo test --manifest-path src-tauri/Cargo.toml   # Rust 测试
npm run typecheck                                 # 前端类型检查
```

## 改动约定

1. **数据格式是契约**：`待办.md / 导航.md / 资产.md / 凭据.md / 速记.md` 与 `ENC:v1` 密文格式必须保持与 pwb-lite 双向兼容。改动解析/序列化必须补测试，并保证「解析 → 序列化 → 解析」幂等。
2. **写入必须原子**：走 `store::write_doc`（临时文件 + rename），不要直接 `fs::write` 覆盖数据文件。
3. **路径必须清洗**：新增文件名/目录名一律走 `clean_path_seg`；新增文件读取一律 `canonicalize` + 前缀校验。
4. **不新增网络请求**，除非是用户显式触发的功能（并需要在 README/SECURITY 里写明）。
5. **不引入未使用的 Tauri 插件或能力**：capabilities 只加真正需要的权限，删掉的就删干净（`Cargo.toml` / `package.json` / `main.rs` / capabilities 四处同步）。
6. **前端**：Vue 3 `<script setup>` + TypeScript，风格对齐现有文件；不要引入 UI 框架的新依赖。
7. **Rust**：如已安装 rustfmt（`rustup component add rustfmt`），请 `cargo fmt` 后提交；新增 `pub` 函数请顺手加一行说明它守的边界（例如"只读""必须在 root 内"）。
8. **提交信息**：一句话说清"改了什么 + 为什么"，中英文都可以。


## 界面自检（无需真机点击）

仓库带一个浏览器驱动器，用来在没有 Rust 后端时点真实组件：

```bash
npx vite --port 5199      # 然后打开 http://127.0.0.1:5199/qa.html
```

- `qa.html` 先加载 `scripts/qa/mock-tauri.ts`（模拟 30+ 个 IPC 命令、事件与窗口接口），再挂载真实 `src/main.ts`。
- 页面里可用 `window.__QA__.snapshot()` 读出当前"磁盘"内容、命令调用记录与异常，用来断言"点了之后文件里到底写了什么"。
- 它只验证前端行为；后端请以 `cargo test` 与 pwb-lite 的 `node --test` 为准。

## PR 自查清单

- [ ] `cargo test` 全绿（新逻辑有对应测试）
- [ ] `npm run typecheck` 与 `npm run build` 通过
- [ ] 手动跑过一次相关界面（桌面壳 / 桌宠 / 卡片 / 面板），说明验证方式
- [ ] 没有提交构建产物、日志、`.env`、密钥、真实数据
- [ ] 涉及用户可见行为时，同步更新 README / CHANGELOG / SECURITY（如果是安全相关）

## 许可

提交即表示你同意以项目的 MIT 许可发布你的贡献。请只提交你有权提交的代码与素材。
