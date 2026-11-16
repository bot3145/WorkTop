# Joplin 同步：功能全貌与实现原理

> 目的：给 WorkTop 做多端同步时当参考。文中「事实」部分来自 Joplin 官方开发文档
> （`joplinapp.org/help/dev/spec/sync`、`.../spec/e2ee`、`.../spec/conflict_auto_merge`）
> 与 `dev` 分支源码（`packages/lib/Synchronizer.ts`、`file-api.ts`、`LockHandler.ts`、
> `services/synchronizer/utils/*`），版本以 2026 年的 dev 分支为准；带「★」的是可以
> 直接搬过来的设计，带「⚠」的是 Joplin 自己踩过的坑。

---

## 0. 一句话概括

Joplin 的同步 = **离线优先的本地库 + 抽象成「类文件系统」的同步目标 + 条目级时间戳增量 +
单写者锁 + 冲突副本（新版再加三方自动合并）+ 可选端到端加密**。
它没有中心化的合并服务：每个客户端自己算"我该传什么、我该收什么、谁冲突了"。

---

## 1. 功能面：用户能用到什么

| 能力 | 说明 |
| --- | --- |
| 多同步目标 | Joplin Cloud / 自建 Joplin Server / Nextcloud·WebDAV / Dropbox / OneDrive / S3 / 本地文件夹 |
| 自动 + 手动 | 内容改动后几秒内后台同步；每隔几分钟轮询拉取远端变更；也可点「同步」或命令行 `joplin sync`（配合 cron） |
| 增量 | 只传变化的条目；普通文件目标也能"增量"（靠本地记录的上次同步时间/逐条元数据比对） |
| 端到端加密 | 可选。开启后本地仍明文，上传前加密；同步目标只见到密文 |
| 冲突副本 | 双端都改了同一条 → 本地版本另存为「 Conflicts 」笔记本里的副本，当前笔记被远端覆盖 |
| 冲突自动合并（较新版本） | 有 base 版本时按行做三方合并，只有真正重叠的修改才退回冲突副本 |
| 分享笔记本 | 按笔记本分发数据密钥（E2EE 下用公私钥对传密钥） |
| 历史版本 / 发布 | 依赖 Joplin Server/Cloud 的 revision service 与 publish 能力 |
| 移动端 partial sync | 只跑 `update_remote + delete_remote` 两步，省流量（`partialSyncSteps`） |
| 失败隔离 | 单条同步不了（超限、被目标拒）标 `sync_disabled`，不阻塞整轮 |
| 多设备互斥 | 目标上放锁文件，同一时刻只有一个客户端在写 |

---

## 2. 分层架构：为什么它能随便换后端

```
Synchronizer（同步主循环，与后端无关）
   └─ SyncTarget（每种后端一个入口，只负责产出 FileApi）
        └─ FileApi（统一接口：list / get / put / delete / delta / lock…）
             └─ file-api-driver-*（fs、WebDAV、S3、OneDrive…）
                  └─ *Api.ts（需要时再包一层底层 HTTP SDK）
```

配套的数据模型：

- **BaseModel**：数据库里的对象（笔记、笔记本、标签、资源、设置项…）。
- **BaseItem**（继承 BaseModel）：*可同步*的对象，负责 `itemsThatNeedSync()`、
  `serializeForSync()`（E2EE 就在这里加密）、`saveSyncTime()`、`systemPath()` 等。
- **sync_items 表**：每个「条目 × 同步目标」一行，记同步状态（见 §4）。

★ 借鉴点：把「传输」抽象到**只要求 list/read/write/delete** 的级别，新增后端只写一个
driver，同步算法一行不改。Joplin 能在 WebDAV、S3、OneDrive 上用同一套逻辑，全靠这条。

---

## 3. 一次完整同步的时序

触发方式：内容变更后延迟几秒的后台同步（"sync as you type"）、定时轮询、手动。

```
start()
 ├─ 前置：resourceService.indexNoteResources()（重建 笔记↔附件 引用）、ShareService 维护
 ├─ 读远端 info.json（不存在 → 当作新目标，先跑 migrationHandler().upgrade()）
 ├─ 合并 info.json（E2EE 开关、masterKeys、PPK、appMinVersion、syncVersion）
 │    └─ 取 **Exclusive 锁** → 上传合并后的 info.json → 释放
 ├─ 取 **Sync 锁**（TTL 3 分钟）并 startAutoLockRefresh（每 60s 续租；续租失败 = 立即取消本次同步）
 │
 ├─ ① delete_remote   （源码里先执行，虽然注释编号写的是 2）
 ├─ ② update_remote   （注释里的 1. UPLOAD）
 ├─ ③ delta           （注释里的 3. DELTA）
 │
 └─ 收尾：残留待传项再排下一轮、清 delta context 里的大缓存、停续租、释放 Sync 锁、广播 SyncComplete
```

默认步骤数组是 `['update_remote', 'delete_remote', 'delta']`，但 `start()` 里实际调用顺序
是 **delete_remote → update_remote → delta**（默认可全跑，移动端只跑前两步）。

这个顺序有理由：先删远端（本地已删的不再被传上去）→ 再推本地改动（此时能干净地判冲突）
→ 最后拉远端（"此时本地改动都已处理完，delta 阶段不可能再产生冲突"，源码注释原话）。

各步骤要点：

| 步骤 | 做什么 | 关键实现 |
| --- | --- | --- |
| delete_remote | 把本地删掉的条目从远端删掉 | `deleted_items` 表 → 逐条/批量 20 条 `multiDelete` → 成功后清记录 |
| update_remote | 推本地新增/修改 | `itemsThatNeedSync(target, 100)` 分页取；每条先 `stat` 远端；`remote.updated_time > local.sync_time` 判冲突；否则上传 + `saveSyncTime` |
| delta | 拉远端新增/修改/删除 | `api.delta({context})` 分页（`hasMore`）；决定哪些要下载 → `TaskQueue('syncDownload')` 并发下载；按 action 建/改/删本地 | 

★ 借鉴点：**一轮同步里只做一种写入方向的事，按「删→推→拉」排序**，能大幅减少需要判冲突的窗口。
⚠ 注意：`start()` 里的注释编号（1/2/3）和实际顺序不一致，读源码时别被误导。

---

## 4. 状态怎么存（这是全篇最该抄的部分）

### 4.1 sync_items（每条目 × 每同步目标一行）

| 字段 | 用途 |
| --- | --- |
| `item_id` / `item_type` | 条目 id 与类型（笔记/文件夹/标签/资源…） |
| `sync_target` | 同步目标编号；同一批笔记可以同步到多个目标，各自独立计时 |
| `sync_time` | **上次成功同步到该目标的时间**（决定"本地是否有未同步改动"） |
| `remote_item_updated_time` | 上次见到的远端 `updated_time`（增强增量模式逐条比对用） |
| `force_sync` | 强制重传（时钟异常、目标重置等场景的兜底） |
| `sync_disabled` / `sync_disabled_reason` | 该条无法同步（超限/被拒），避免无限重试 |
| `base_body` / `base_title` | **上次双方达成一致的版本**，三方合并的 base（见 §6） |
| `item_location` | 条目存在于本地/远端（1/2） |

判定规则就一条：`updated_time > sync_time` → 这条有本地改动需要上传。

### 4.2 deleted_items（墓碑表）

`{ item_type, item_id, deleted_time, sync_target }`。本地删除时写入（`trackDeleted`），
远端删除成功后再删掉这行。**没有墓碑就没法区分"远端没有"是"别人删了"还是"我还没传"。**

⚠ Joplin 自己承认的缺口（源码注释）：墓碑行在一次成功处理后就被删除，多目标场景下
先在目标 A 消费掉，之后同步目标 B 就不会再删那一条了。作者给的解法是
「在每个客户端永久保留删除清单」——如果你要做多目标，直接从"不删墓碑、只标记已处理"开始。

### 4.3 info.json（同步目标上的共享配置）

```ts
interface SyncTargetInfo {
  version: number                              // 同步协议版本，客户端据此决定能否同步/要不要迁移
  e2ee: { value: boolean; updatedTime: number }
  activeMasterKeyId: { value: string; updatedTime: number }
  masterKeys: Key[]                            // 多把主密钥（离线双端各自开启 E2EE 的产物）
  ppk: { value: { id; keySize; privateKey; publicKey; createdTime } }  // 共享笔记本传密钥用
  appMinVersion: string                        // 目标要求的最低客户端版本
}
```

带 `updatedTime` 的字段用于两端同时改同一配置时按启发式取一个（`syncInfoUtils.ts`）。

### 4.4 远端存储布局（文件类目标）

```
info.json                     # 共享配置
locks/1_1_<clientId>.json     # 同步锁：{LockType}_{LockClientType}_{clientId}.json
temp/                         # 临时/上传中转
<32位hex id>.md               # 每个条目一个文件（笔记/文件夹/标签/设置项都是）
resources/<id>                # 附件原文件（blob）
<id>.md                       # 附件元数据（另有一条 item 描述它）
```

条目文件名 = `systemPath()` = `{id}.{ext}`，默认 `.md`；校验规则是"最后一段正好一个点、
前缀 32 字符、扩展名 md"。★ 这个设计的好处：一个目录就能被任何网盘/WebDAV 承载，
不需要服务端语义。

---

## 5. 增量算法：两种实现，同一个接口

### 5.1 有服务端 delta（Joplin Server / OneDrive / Dropbox）

- `delta(path, {context})` 返回 `{ items, hasMore, context }`；客户端拿 `context`（游标）翻页。
- 每条远端记录带 `jop_updated_time`；若目标 `supportsAccurateTimestamp`（**只有 Joplin Server 可靠**），
  本地 `updated_time === remote.jop_updated_time` 就直接跳过下载。
- 若响应里带 `jopItem`（`supportsDeltaWithItems`），内容随 delta 一起回来，省掉每条的 `get`。

### 5.2 普通文件目标（WebDAV / Nextcloud / S3 / 本地目录）：basicDelta

没有服务端游标，只能「列全量 + 自己算差异」：

1. `getDirStatFn()` 拿远端全量 (path, updated_time)。
2. 与本地记录的**上次同步时间戳**比较：
   - `< timestamp` → 跳过（已同步过）
   - `> timestamp` → 收进结果，并推进新 timestamp
   - `== timestamp` → 靠 `filesAtTimestamp`（"恰好等于该时间戳的文件路径"列表）判断是不是本轮新产生的边界项
3. **增强模式**（文件系统目标、或 localhost 的 WebDAV）：不再假设时间戳单调，而是逐条比对
   `remote.updated_time` 与本地 `remote_item_updated_time`，相等才跳过。这解决了
   "第三方网盘客户端把文件搬来搬去、mtime 被改坏"导致的反复下载。
4. 分页：`outputLimit = 50`，`hasMore` 时复用 `statsCache` 继续，末页清缓存。
5. 远端删除的识别：**本地 id 全集 ∖ 远端 id 全集**（排序后二分），产出 `{path, isDeleted:true}`。
6. **90% 误删保护**：如果算出来的删除比例 ≥ 90%，且开启了 `sync.wipeOutFailSafe`，直接抛
   `failSafe` 终止同步——防止"网盘目录被挪走/挂载盘掉线返回空目录"把本地全删了。

★ 借鉴点：`timestamp + filesAtTimestamp` 这个双机制很值：只靠时间戳会在"同一毫秒内又改了一次"
时漏数据；只靠逐条哈希比对则要拉全量元数据。混合起来成本最低。
★ 借鉴点：删除用集合差 + 比例保护，比"逐条问服务端是否删除"便宜得多。

---

## 6. 冲突：判定、动作、副本、自动合并

### 6.1 判定（都发生在 update_remote 阶段）

| 场景 | 判定 | 结果 |
| --- | --- | --- |
| 远端已不存在，但本地改过（`sync_time` 非空） | 远端被别的端删了，我这又改了 | 冲突 |
| 远端存在，`remote.updated_time > local.sync_time` | 两端都改过 | 冲突 |
| 目标拒写（`IsReadOnly` / `rejectedByTarget`） | 只读共享/被限制 | 降级为冲突动作（否则会无限重试到 `processingPathTwice`） |

注意它判冲突前会**真去 `get` 远端内容**，不只看 metadata——因为 OneDrive/文件系统的
时间戳不可靠。

### 6.2 三种动作

- `NoteConflict`（笔记）：本地版本存成冲突副本 → 本地被远端覆盖 → 记录 base。
- `ResourceConflict`（附件）：生成"冲突资源笔记"，本地资源 `fetch_status` 重置以便重下。
- `ItemConflict`（文件夹/标签/关系）：直接用远端覆盖本地；若远端已删，软删除本地且
  **不级联删子项**（`deleteChildren: false`），防一次冲突带走一大片。

### 6.3 冲突副本长什么样

- 放到 `Conflicts` 笔记本；`is_conflict = 1`；`conflict_original_id` 指回原笔记
  （远端已不存在时置空，因为原笔记随后会被删）。
- `ConflictNoteState` 存 `note_id / base_body / base_title / remote_updated_time`，
  给后续"再同步一次能不能自动合"留依据。
- 冲突副本不继承 `share_id / is_shared`，避免把冲突扩散到共享笔记本。

### 6.4 自动三方合并（较新版本，`spec/conflict_auto_merge`）

- 三个版本：**base**（`sync_items.base_body/base_title`，上次双方一致的内容）、local、remote。
- 按**行**做 diff3：只有一侧改的行直接采用；两侧都改且改法相同时自动合并；否则算真冲突。
  同/相邻行都改 → 冲突（词级合并试过被放弃，会静默重复文本）。
- 全合并成功：合并结果写回本地、成为新 base，`updated_time` 推到远端之后以便上传，
  不产生冲突副本。
- 有真冲突：仍建冲突副本，但两边都已包含无冲突部分的合并结果。
- 跳过条件：`sync.autoMergeConflicts` 关了 / 没有 base / 任一侧只读或锁定 / 任一侧解不开密 /
  改在相同行 / diff 超过 `maxEditLength 5000` 或超时 1000ms。
- E2EE 下：远端密文只在内存里解密参与合并，不落盘。

★ 借鉴点：**先存 base，再谈合并**。没有 base 就没有三方合并，只能"留两份"。
★ 借鉴点：合并失败一律**留副本、不丢数据**，宁可多一个文件也不要静默覆盖。

---

## 7. 删除：为什么必须有墓碑 + 幂等

- 本地删除 → 写 `deleted_items`（`trackDeleted`）→ delete_remote 阶段删远端 → 成功则删墓碑行。
- 批量删除：每 20 条一次 `multiDelete`；**404 视为成功**（幂等）；其他错误逐条重试；
  `isReadOnly` 时反而把远端内容拉回本地（放弃这次删除，避免"删不掉还反复试"）。
- 远端删除 → delta 里 `isDeleted` → 本地删除。文件夹特殊：先收进待删集合，
  最后统一处理，且**先查是否还有笔记**，非空就转成冲突（`Folder.markNotesAsConflict`），
  不静默删掉用户内容。
- delta 末尾 `deleteOrphanSyncItems()` 清理"实体已不存在"的 sync_items 行。

---

## 8. E2EE：格式、密钥、时机

### 8.1 密文格式（JED）

```
"JED" + 版本(2 hex) + 长度(6 hex) + 算法(2 hex) + 主密钥ID(32 hex) + [分块: 长度(6 hex)+数据]
```

- 全部编码成 ASCII（为了跨 React Native / 桌面端兼容）。
- **分块**而不是整文件加密：移动端内存扛不住大文件一次加密。

### 8.2 密钥体系

| 密钥 | 作用 | 存放 |
| --- | --- | --- |
| 数据密钥（master key） | 加密笔记/笔记本/标签/资源 | 本地库 + 用**用户口令**加密后随 info.json 同步 |
| 分享用数据密钥 | 单个共享笔记本一把 | 用收件人公钥加密传递 |
| 公私钥对（PPK） | 共享时安全传密钥 | 只存 info.json；**第一次同步时生成**（避免双端各生成一把） |

- 支持**多把主密钥**（两个离线设备各自开了 E2EE 就会有两把），但**只有一把是 active**；
  解密时按密文头里的 keyId 找对应钥匙。
- 改主口令 = 只重新加密密钥本身，**不需要重传所有笔记**；忘口令 = 数据不可解，
  重置会废掉旧密钥（旧数据永久打不开）。

### 8.3 时机与开关的坑

- 加密只发生在**序列化给同步用时**（`serializeForSync`），本地始终明文 → 所以本地
  Obsidian/脚本能直接读，而远端是密文。
- 解密由后台 `DecryptionWorker` 逐步完成；未解密的条目在 UI 里可见但基本只读。
- ⚠ 开启/关闭 E2EE 只改变"表示"，**条目 `updated_time` 不变** → 其他设备不会重下。
  这意味着"关闭加密"不会让别的设备自动变明文，必须每台手动关。
- ⚠ 密钥无法删除；即使关了加密，新设备仍会要求输入主口令。

★ 借鉴点：**加密只作用于"上传副本"**，本地文件保持明文（和 WorkTop 现在的
「文档不加密 + 模块锁」思路一致，可以共存：模块锁管界面门禁，E2EE 管传输/落盘密文）。

---

## 9. 附件（资源）

- 每个附件 = 一条 item（元数据：标题、mime、大小、`source_url`…）+ 一个 blob 文件
  （远端 `resources/<id>`）。
- 上传：先传 blob，再传元数据；下载：由 `fetch_status` 状态机驱动
  （`IDLE → FETCHING → DONE/ERROR`），失败可重试，不阻塞其他条目。
- 笔记与附件的引用关系靠 `indexNoteResources()` 在同步前重建（Markdown 里只是
  `![](:/资源id)`，引用是解析出来的）。

---

## 10. 工程细节清单（防御性设计，值得整段抄走）

1. **锁**：`locks/{type}_{clientType}_{clientId}.json`，TTL 3 分钟，60s 自续；
   续租失败 → 立刻取消本次同步（"锁都保不住了，别继续写"）。
2. **抢排他锁**：先写锁文件 → `sleep(100ms)` → 重新读校验"确实是我的"，避免竞态。
3. **远端时钟偏移**：写临时文件再读 `stat` 估算 `remoteDateOffset`，缓存 10 分钟；
   所有比较都用远端时间，避免本机时钟跑偏导致"永远同步不完"。
4. **未来时间戳直接报错**：`remote.updated_time > now + 1 day` 抛异常，防死循环。
5. **同一路径处理两次** → `processingPathTwice` 错误（说明状态机出问题了）。
6. **每批 100 条**分页上传；下载走 `TaskQueue` 控制并发。
7. **结束前再查一次待同步项**，非空就自动排下一轮（避免"边同步边改"留下尾巴）。
8. **单条失败隔离**：`sync_disabled` 标记 + 通知，下一轮直接跳过。
9. **只读目标**：任何写失败都要能降级，不能卡在重试循环里。

---

## 11. 落到 WorkTop：具体怎么借鉴

WorkTop 的现状和 Joplin 的差异先说清：**WorkTop 的真源是磁盘上的 Markdown / JSON 文件**
（Obsidian 可直接编辑），没有 SQLite 条目表；Joplin 是"数据库 + 导出"。所以能抄的是
**协议与状态机**，不是代码结构。

### 11.1 建议的最小可用版本（MVP）

```
第 0 层：同步目标抽象 —— 先只实现「本地文件夹」和「WebDAV」两个 driver
        （list(prefix) / stat / get / put / delete，够用了）
第 1 层：状态目录 <数据目录>/.worktop-sync/
        ├─ info.json        # { version, deviceId, e2ee?, ... }
        ├─ sync_items.json  # { "<相对路径>": { hash, baseHash, syncTime, remoteHash } }
        └─ deleted.json     # 墓碑：[{ path, deletedAt, processed: { <target>: true } }]
第 2 层：一轮同步 = 删远端 → 推本地 → 拉远端（照 Joplin 的顺序）
第 3 层：冲突 = 三方合并（base = baseHash 对应的内容快照）→ 失败留 .conflict-<device>-<ts>.md
```

### 11.2 关键取舍（针对 WorkTop 的现实）

| 问题 | 建议 | 理由 |
| --- | --- | --- |
| 用什么判断"变了"？ | **内容哈希**（已有 sha256 基建），不要用 mtime | 云盘/编辑器/Obsidian 插件天天改 mtime；哈希才是内容真源 |
| 要不要存 base 快照？ | 要，但可以只在"冲突可能发生"时存（或存最近一次同步内容到 `.worktop-sync/base/`） | 没有 base 就只能留两份；base 让 Markdown 的行级 diff3 直接可用 |
| 删除怎么传播？ | 墓碑表 + 「已处理目标」位图 | 直接抄 Joplin，但**别学它消费即删**（多目标会漏删） |
| 锁要不要做？ | 要做，文件锁 + TTL 2–3 分钟 + 60s 续租 | 两台机器同时写同一个 WebDAV 目录是真实场景 |
| 增量传输怎么做？ | 先做「清单比对」：一次 list 拿到 (path,size,hash?)，用 `sync_items.hash` 比对；WebDAV 没有 hash 就退化成 size+mtime 预筛 + 拉取后算 hash | 服务端游标（Joplin Server 那种）是第二阶段的事 |
| 附件怎么办？ | 独立 blob 通道，按 hash 命名（内容寻址），>5MB 分块 | 避免每次改动都传整包；天然去重 |
| 冲突文件名 | `xxx (冲突 设备名 2026-11-16).md`，放进 `Conflicts/` 目录 | 和 Joplin 一致，用户一看就懂 |
| 加密要不要现在做？ | 先不做。真要做时按 JED 思路：**本地明文 + 上传前加密**，主密钥用口令加密后随 info.json 走 | 与现有「模块锁」职责不重叠，不要混成一个开关 |

### 11.3 不要照抄的地方

- ⚠ **`updated_time` 毫秒分辨率**：Joplin 自己承认"同一毫秒改两次"是无解的（长期方案是换 etag）。
  WorkTop 直接用内容哈希当版本标识，天然绕开这个问题。
- ⚠ **`deleted_items` 消费即删**：多目标必漏，见 §4.2。
- ⚠ **E2EE 开关的语义**：Joplin 关掉加密不会让别的设备自动变明文，配置状态全靠人工对齐。
  如果 WorkTop 要做，请把"加密与否"做成目标级别的显式状态，并在 info.json 里带版本号。
- ⚠ **冲突自愈的复杂度**：自动合并（diff3 + 边界条件 + 超时保护）是几千行的坑。
  先做"留副本"，观察真实冲突率，再决定要不要上自动合并。
- ⚠ **Joplin 的 `sync_items` 是数据库表**；WorkTop 若用 JSON 存，注意并发写（原子替换 +
  文件锁），否则一次崩溃就会写出半个 JSON。

### 11.4 如果只要一句话的行动建议

> 先实现「哈希清单 + 三步同步 + 墓碑 + 单写锁 + 冲突副本」这五件事，
> 就覆盖了 Joplin 同步 90% 的实用性；E2EE、自动合并、服务端游标都可以后置。

---

## 12. 参考

- 同步总览（用户向）：https://joplinapp.org/help/apps/sync
- 同步开发规范（架构 + info.json + sync_items）：https://joplinapp.org/help/dev/spec/sync
- E2EE 用户文档：https://joplinapp.org/help/apps/sync/e2ee
- E2EE 技术规范（JED 格式、密钥体系）：https://joplinapp.org/help/dev/spec/e2ee
- 冲突自动合并规范：https://joplinapp.org/help/dev/spec/conflict_auto_merge
- 源码入口：
  - `packages/lib/Synchronizer.ts`（主循环、三步顺序、冲突判定）
  - `packages/lib/file-api.ts`（basicDelta、分页、删除推断、fail-safe）
  - `packages/lib/services/synchronizer/LockHandler.ts`（锁 TTL/续租/抢锁）
  - `packages/lib/services/synchronizer/utils/syncDeleteStep.ts`（批量删除、只读降级）
  - `packages/lib/services/e2ee/EncryptionService.ts`（加密实现）
