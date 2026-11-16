# SnipLite 调研：功能清单与可借鉴的样式

> 目的：为 WorkTop 现有截图窗口（`app/src/windows/SnipWindow.vue` + `src-tauri/src/commands/snip.rs`）找可直接抄的交互与视觉。
> 调研时间：2026-11-16。仓库同名有 5 个，逐个看过，只有两个值得跟。

---

## 0. 先说结论

| 仓库 | 语言 | ★ | 定位 | 值得看吗 |
| --- | --- | --- | --- | --- |
| [GxDongV/SnipLite](https://github.com/GxDongV/SnipLite) | C# / WinForms (.NET 10) | 80 | Snipaste 式全家桶：截图 + 标注 + OCR + 二维码 + 翻译 + 贴图 | **重点看**，功能面最全，工具条设计最讲究 |
| [MrTangLuyao/sniplite](https://github.com/MrTangLuyao/sniplite) | x86-64 汇编 + C，无 CRT | 49 | 280 KB 极简截图/贴图，主打快 | **重点看**，体感与长截图/OCR 面板设计值得抄 |
| [M-H-Jim/SnipLite](https://github.com/M-H-Jim/SnipLite) | C++ / FLTK | 1 | 代码片段管理器，不是截图工具 | 跳过 |
| [JoonHoFeng/SnipLite](https://github.com/JoonHoFeng/SnipLite) | C# | 0 | Windows 截图，功能远少于上面两个 | 跳过 |
| [lushengyin/SnipLite](https://github.com/lushengyin/SnipLite) | Swift | 0 | macOS 低内存截图 | 跳过（非 Windows 生态） |

一句话：**功能面抄 GxDongV，速度与「轻」抄 MrTangLuyao。**

---

## 1. GxDongV/SnipLite（.NET 10 + WinForms）

### 1.1 功能清单

**选区**
- 全局热键 `F1` 起截；鼠标悬停自动框选「窗口 / 可访问控件」，滚轮切换层级
- 全屏十字辅助线 + 像素放大镜 + RGB/HEX 取色（`Alt` 显示放大镜，`C` 复制指针色）
- 拖动随时自定义选区，选区可移动、八向缩放

**标注**
- 矩形、椭圆、箭头（多种箭头样式）、铅笔、马克笔（半透明）、像素马赛克、文字、橡皮擦（**只擦标注，不动原图**）
- 线宽 / 笔刷大小、填充开关、马克笔不透明度滑杆、马赛克强度滑杆
- 文字标注**可反复编辑**：单击已有文字继续改，拖动选框移动文字，右下角手柄缩放，支持字体、字号、粗体、斜体，工字形光标随字号变
- 撤销 / 重做（`Ctrl+Z` / `Ctrl+Y`）

**识别与翻译**
- OCR：框选后拖动**在原图上划词**，支持 `Ctrl+A` 全选、`Ctrl+C` 复制；本地 SimdPaddleOCR（PP-OCRv6 Small，中英自动），可切 Windows 系统引擎，异常自动降级
- 二维码 / 条码：识别结果就地显示在工具条下方一行，长结果省略 + 悬停查看，右侧「复制」按钮
- 翻译：点「译」后**译文按文字块原位覆盖原文**，可一键切原文/译文；语言记忆、双向互换、源语言可自动检测；服务可选必应网页 / Google / MyMemory / Azure，切服务复用已识别文字，不重复识别

**贴图（pin）**
- 截图或剪贴板图片贴到桌面：置顶、拖动、滚轮缩放、`Ctrl+滚轮` 调透明度、`Ctrl+0` 复原
- 贴图分组、缩略图、鼠标穿透、隐藏与恢复（`F3` 恢复隐藏贴图）
- 剪贴板文字可转成图片贴出

**其它**
- 首选项：侧边导航 + 圆角设置卡 + 矢量线性图标，跟随系统深浅色（运行中切换不重启）
- 可设：主题色、界面字体、放大镜、自动选区、截图动作、贴图行为、保存路径、文件名模板、快捷键与**冲突提示**
- 托盘图标单独跟随任务栏明暗，可选彩色/自定义
- 8 语言本地化，日志分应用/异常两处

### 1.2 工具条怎么排的（`src/SnipLite/AnnotationBar.cs`）

这是最值得抄的部分。**两行 + 一条状态行**，全部手绘并手工命中测试：

```
┌─ 第一行（工具 / 动作）────────────────────────────────────────────┐
│ 矩形 椭圆 箭头 铅笔 马克笔 马赛克 文字 橡皮 │ 撤销 重做 │ OCR 译 二维码 │ 关 贴 存 复制 │
└──────────────────────────────────────────────────────────────┘
┌─ 第二行（当前工具的选项，随工具变）────────────────────────────┐
│ 线宽 ▏笔刷/框选模式 ▏不透明度滑杆 ▏填充 ▏当前色 + 11×2 色板       │
└──────────────────────────────────────────────────────────────┘
┌─ 状态行（可选，32px；OCR 模式 44px）─── 文案……        ┌ 复制 ┐─┐
```

硬指标（`AnnotationBar` 里的常量，物理像素 × DPI 缩放）：

| 项 | 值 | 说明 |
| --- | --- | --- |
| 按钮尺寸 | `Button = 34` | 正方形 |
| 按钮间距 | `Gap = 2` | 极紧，靠分组线分隔语义 |
| 条内边距 | `Pad = 5` | 上下都是 5，条高 = 34 + 10 = 44 |
| 分组间距 | `Group = 9` | 分隔线前后各留 9 |
| 色板小格 | `Swatch = 17` | 22 色 = 11 列 × 2 行（上排饱和、下排浅色） |
| 圆角 | 条 8px、选中块 5px | |
| 选中态 | 底 `AccentSoft`（+2px 内缩）+ **底部 2px 主题色短线** | 比整块高饱和更克制 |
| 状态行 | 32px（OCR 44px），右侧放「复制/复制文字」实心按钮 | 走马灯式单行 + 省略号 |
| 定位 | 选区下方居中、相距 10px；放不下翻到上方；再夹到屏幕内 2px | 拖选区时不跳 |

每个按钮都带 `Hint()`：中文文案里直接嵌热键，例如「马赛克（M）」「取消截图（Esc）」「复制选中文字，未选字时复制全部识别结果」。

工具热键：`R` 矩形 / `E` 椭圆 / `A` 箭头 / `P` 铅笔 / `H` 马克笔 / `T` 文字 / `M` 马赛克 / `X` 橡皮；`Ctrl+S` 另存、`Ctrl+T` 贴图、`Ctrl+C` 复制、`Esc` 取消。

### 1.3 工程组织（值得对的思路）

- 一个工具类一个文件：`CaptureForm`（覆盖层）、`CaptureRegionForm`（选区）、`CaptureCrosshair`、`MagnifierReticle`、`AnnotationBar`、`Annotation`、`OcrSelection`、`TextEditLayout`、`TextIBeamCursor`、`PinForm`、`PinShadowWindow`、`Toast`、`SnipMenu`
- 主题单独 `AppTheme`（`Card` / `Text` / `Border` / `AccentSoft` / `OnAccent`），所有绘制只取这几个 token —— 深浅色只改一处
- 托盘常驻、无主窗口；托盘右键 = 首选项 / 帮助 / 更新 / 退出
- 发布三种形态：单文件 exe、安装包、便携 zip；设置 `%APPDATA%\SnipLite\settings.json`

---

## 2. MrTangLuyao/sniplite（汇编 + C）

### 2.1 功能清单

- **快**：`F1` 到可截 12ms；抓屏走显卡并交给 Windows 在 GPU 上合成，而不是常规 GDI 抓屏
- **小**：约 280 KB，空闲内存 11 MB，不写注册表、不需要管理员
- **贴图**：`F3` 贴剪贴板图/文字（文字自动转图）、`Shift+F3` 全部隐藏/显示、滚轮缩放、双击关闭
- **标注**：箭头、文字、序号、马赛克（README 只列了这些，克制）
- **OCR**：`Ctrl+O` 选区内识别，**结果面板开在选区旁边**（不是满屏弹窗）；表格**保留列**，可直接粘成单元格或 Markdown；首次使用才引导下载 12 MB 模型（PaddleOCR PP-OCRv6 + ONNX Runtime），全本地
- **长截图**：`Ctrl+L` 后自己滚页面，程序边滚边拼，**选区旁一条窄条实时预览已拼结果**；`Enter` 复制、`Esc` 取消，也能保存/贴图/识别
- **低内存模式**：设置里开启后降到约 2 MB，代价是截屏变慢 —— 把「性能 vs 内存」交给用户
- 8 语言跟随系统；每天查一次 GitHub 更新（只比版本号）

### 2.2 性能对照（作者自测，仅供参考）

| 工具 | 下载 | 空闲内存 | 热键到可截 |
| --- | --- | --- | --- |
| sniplite | 0.4 MB | 11 MB | **12 ms** |
| Snipaste 2.11.3 | 19 MB | 50 MB | 121 ms |
| PixPin 3.6.6 | 66 MB | 31 MB | 142 ms |
| Greenshot 1.3.328 | 4 MB | 16 MB | 252 ms |
| ShareX 22.4.0 | 139 MB | 58 MB | 未测 |

差距来源不是算法，是**架构**：覆盖层窗口常驻、抓屏一次拿整屏并缓存、标注走 GPU 合成。WorkTop 现在是「按热键 → 建窗 → 抓全屏 → 前端 ready → 再画」，链路上多了两次窗口创建。

---

## 3. WorkTop 现状对照

`SnipWindow.vue` + `snip.rs` 已有：全屏覆盖层、软件光标圈、选区八向缩放与移动、矩形/箭头/画笔、7 色板、线宽、撤销、复制/另存、DPI 与多屏换算、`snip_focus` 抢前台、预览失败兜底。

| 能力 | WorkTop | GxDongV | MrTangLuyao |
| --- | --- | --- | --- |
| 矩形 / 箭头 / 画笔 | ✅ | ✅ | ✅ |
| 椭圆 / 文字 / 马赛克 / 马克笔 / 橡皮 | ❌ | ✅ | 部分 |
| 撤销 | ✅ | ✅ + 重做 | ❌ |
| 窗口自动框选 / 放大镜 / 取色 | ❌ | ✅ | ✅ |
| OCR | ❌ | ✅（就地划词） | ✅（侧边面板 + 表格保列） |
| 二维码 | ❌ | ✅ | ❌ |
| 翻译 | ❌ | ✅ | ❌ |
| 贴图 pin | ❌ | ✅ | ✅ |
| 长截图 | ❌ | ❌ | ✅ |
| 工具选项第二行 | ❌（色板平铺） | ✅ | ❌ |

---

## 4. 值得借鉴的 8 条（按性价比排序）

### 4.1 工具条改「主行 + 选项行」（收益最大）

现在 `SnipWindow.vue` 是 4 个工具 + 7 个色点 + 线宽 + 撤销 + 复制/保存挤成一行，工具一多就挤爆（`toolbarW` 还写死 760 兜底）。

照抄它的结构：

- 第一行：`矩形 椭圆 箭头 铅笔 马克笔 马赛克 文字 橡皮 │ 撤销 重做 │ OCR 译 二维码 │ 关闭 贴图 另存 复制`
- 第二行：只显示当前工具的选项（线宽 / 填充 / 不透明度 / 字号 / 当前色 + 色板）
- 度量直接抄：按钮 34、间距 2、内边距 5、分组 9、圆角条 8 / 选中块 5
- 定位：选区下 10px 居中，放不下翻上方，最后夹进屏幕 2px

实现落点：`SnipWindow.vue` 的 `TOOLS` 扩成「工具数组 + 选项数组」，`toolbarStyle` 改成网格；`toolbarW` 由内容实测（`offsetWidth`）而不是常量。

### 4.2 选中态用「淡底 + 底部短线」

`AppTheme` 的套路：选中按钮 `AccentSoft` 底（2px 内缩）+ 底部 2px 主题色短线。WorkTop 的主题色在 `--snip-accent`，可以直接：

```css
.snip-toolbar button.on { background: color-mix(in srgb, var(--snip-accent) 18%, transparent); }
.snip-toolbar button.on::after { content:""; position:absolute; left:50%; bottom:2px; width:10px; height:2px;
  margin-left:-5px; border-radius:2px; background: var(--snip-accent); }
```

### 4.3 分组线，别用间距表达语义

`Gap` 只有 2px，语义全靠 1px 分隔线 + 前后各 9px。工具条看着密但不乱。现在 WorkTop 靠 `gap` 分区，工具一多就分不清「绘制 / 识别 / 输出」。

### 4.4 状态行做成独立横条

32px（OCR/识别模式 44px）单行、末尾省略、右对齐一个实心按钮（「复制」/「复制文字」/「已复制」）。它替代 toast：**回执、进度、划词提示都在这条里**，不遮画面。WorkTop 现在是 `notice` / `done` 小 toast 浮层，可以并到工具条下沿。

### 4.5 OCR 就地划词 + 表格保列

- 拖动在原图上选字、`Ctrl+A` / `Ctrl+C`、`Esc` 退出回标注；识别模式下工具条主行照常可用
- 表格结果**保留列**，可直接粘成单元格或 Markdown —— 对我们「AI 读屏」场景价值很高（截表格 → 直接进 AI 对话）
- 引擎可切换 + 异常自动降级，符合 WorkTop 现有「可选下载依赖」的习惯（模型按需下，不塞进安装包）

### 4.6 长截图带侧边实时预览条

滚动时在选区旁一条窄条实时显示已拼结果，`Enter` 复制 / `Esc` 取消。这个「边滚边看」比滚完再弹预览的体感好很多，而且实现成本低（把已拼高度画到一条 canvas 上）。

### 4.7 贴图 pin 是最缺的一块

WorkTop 目前完全没有「贴图」。GxDongV 的行为集合已经是最小可用集，建议照搬：置顶、拖动、滚轮缩放、`Ctrl+滚轮` 透明度、`Ctrl+0` 复原、双击关闭、`Shift+F3` 全部隐藏、右键菜单（复制/保存/识别/管理）。技术上就是新建一类 `?win=pin` 透明窗口 + 一份图片文件句柄，和我们已有的 card/pane 窗口体系同构。

### 4.8 体感：覆盖层常驻 + 抓屏缓存

`F1 → 12ms 可截` 的差距来自常驻覆盖层。WorkTop 现在每次 `snip_open` 建窗 + 抓全屏，冷启动会明显慢。可行做法：应用启动时预建隐藏的 snip 窗口并预抓一帧屏幕；热键只做「显示 + 换图」。若嫌一直占内存，可给「低内存模式」开关（MrTangLuyao 就是这么做的，2 MB vs 50 MB）。

---

## 5. 不建议照抄

| 项 | 原因 |
| --- | --- |
| 22 色板（11×2） | 对 WorkTop「浅色低饱和」的调性太重；7–8 色 + 自定义取色足够 |
| 手绘工具栏 + 手工命中测试 | 我们是 DOM，用 CSS 更省；只需抄度量与分组逻辑 |
| 翻译原位覆盖原文 | 信息有丢失风险，且依赖外部翻译服务；WorkTop 更适合「译文放侧栏 / 交给 AI」 |
| 云母（Mica）材质 | WinForms 里要靠 DWM 私有接口；WebView2 透明 + 磨砂已经够用，且跨平台一致 |
| 把 OCR 模型塞进安装包 | 12 MB 起步；保持「按需下载 + 本地推理」 |
| 汇编级抓屏 | 投入产出比不适合我们；但「预建窗口 + 帧缓存」的思路可以借 |

---

## 6. 参考资料

- GxDongV/SnipLite：<https://github.com/GxDongV/SnipLite>（重点文件 `src/SnipLite/AnnotationBar.cs`、`AppTheme.cs`、`CaptureRegionForm.cs`、`MagnifierReticle.cs`、`PinForm.cs`、`OcrSelection.cs`、`TextEditLayout.cs`、`Toast.cs`）
- MrTangLuyao/sniplite：<https://github.com/MrTangLuyao/sniplite>（`src/*.S` 抓屏与绘制核心，`src/*.c` 其余；README 有性能对照表与热键表）
- 本地现状：`app/src/windows/SnipWindow.vue`（929 行）、`app/src-tauri/src/commands/snip.rs`
