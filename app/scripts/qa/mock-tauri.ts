// QA 用的 Tauri IPC 模拟层（只在 /qa.html 里加载，不参与生产构建）。
// 目的：在没有 Rust 后端的情况下，用真实浏览器驱动真实界面做走查——
// 校验的是前端行为（交互、状态、布局、空态、错误提示），后端正确性由 cargo test 覆盖。
// 语义尽量贴近 Rust 侧：整文档编辑带 baseHash 校验，冲突返回 conflict + 最新内容。

type Listener = { event: string; handlerId: number }
type Callback = (payload: unknown) => void

interface TextDoc {
  text: string
  hash: string
  path: string
}

interface KeyDoc {
  name: string
  ext: string
  text: string
  hash: string
  chars: number
  mtimeMs: number
}

const enc = new TextEncoder()

function sha(text: string): string {
  // 简化哈希：只用于 QA 的 CAS 判断，不需要密码学强度
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0
    h2 = Math.imul(h2 + c, 2246822519) >>> 0
  }
  return (h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0")).repeat(2)
}

const docs: Record<string, string> = {
  todo: `# 待办\n\n- [ ] 整理季度复盘材料 #工作 @2026-10-31\n- [ ] 给 NAS 加一块备份盘 #家务\n- [x] 把桌面版跑通 #工作\n- [ ] 预约体检 @2026-11-05\n`,
  nav: `# 导航\n\n## 常用\n- [GitHub](https://github.com)\n- [MDN](https://developer.mozilla.org)\n\n## AI\n- [Claude](https://claude.ai)\n- [Kimi](https://kimi.moonshot.cn)\n`,
  note: `# 速记\n\n## 2026-10-30 06:20\n桌面版走查：先看空态，再看长文本换行。\n\n## 2026-10-29 21:05\n备份策略改成本地 + 阿里云盘双份。\n`,
}

const keyDocs: KeyDoc[] = [
  {
    name: "NAS-登录",
    ext: "md",
    text: "# NAS 登录\n\n- 账号: bert\n- 地址: 192.168.1.10\n",
    hash: "",
    chars: 0,
    mtimeMs: Date.now() - 3600_000,
  },
  {
    name: "交换机口令",
    ext: "txt",
    text: "admin / 不告诉你\n",
    hash: "",
    chars: 0,
    mtimeMs: Date.now() - 7200_000,
  },
]
for (const d of keyDocs) {
  d.hash = sha(d.text)
  d.chars = d.text.length
}

let settings: Record<string, unknown> = {
  pet: {
    enabled: false,
    characterId: "shenshen",
    scale: 0.6,
    opacity: 1,
    locked: false,
    autonomous: true,
    animationGap: 2,
    cards: { clock: true, calendar: true, todo: true, notes: true },
    cardLayout: {},
    toolbar: false,
    dock: false,
  },
  apps: { dir: "", pinned: [] },
}

const characters = [
  {
    id: "shenshen",
    name: "shenshen",
    root: "C:/qa/characters/shenshen",
    source: "auto",
    bodyBox: [212, 60, 428, 330],
    clips: [
      { category: "idle", name: "待机呼吸休闲", video: "shenshen/videos/idle/待机呼吸休闲.webm" },
      { category: "turn", name: "东张西望", video: "shenshen/videos/turn/东张西望.webm" },
      { category: "click", name: "点击回应-开心跃动", video: "shenshen/videos/click/点击回应-开心跃动.webm" },
      { category: "move", name: "螃蟹走路", video: "shenshen/videos/move/螃蟹走路.webm" },
      { category: "random", name: "哈欠连天", video: "shenshen/videos/random/哈欠连天.webm" },
      { category: "random", name: "原地小憩沉眠", video: "shenshen/videos/random/原地小憩沉眠.webm" },
      { category: "random", name: "打瞌睡被惊醒", video: "shenshen/videos/random/打瞌睡被惊醒.webm" },
      { category: "random", name: "收红包", video: "shenshen/videos/random/收红包.webm" },
    ],
  },
]

const dockApps = [
  { id: "a1", name: "记事本", path: "C:/Windows/notepad.exe", kind: "exe", target: "", icon: null, group: "系统" },
  { id: "a2", name: "计算器", path: "C:/Windows/System32/calc.exe", kind: "exe", target: "", icon: null, group: "系统" },
  { id: "a3", name: "Edge", path: "C:/Program Files/Edge/msedge.exe", kind: "exe", target: "", icon: null, group: "系统" },
]

const aiConfig = {
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-chat",
  temperature: 0.3,
  maxRounds: 6,
  historyLimit: 24,
  allowWrite: true,
  systemExtra: "",
}
let aiKey = "sk-qa-demo-abcd"
let aiMemory = "# AI 记忆\n\n- 用户偏好：回复简短\n"
const aiMsgs: Record<string, { role: string; content: string }[]> = {}

const callbacks = new Map<number, Callback>()
let nextCallbackId = 1
const listeners: Listener[] = []
const windows: Record<string, { x: number; y: number; w: number; h: number; visible: boolean; top: boolean }> = {}
const unknown: string[] = []
const calls: string[] = []
const errors: string[] = []

const emitted: string[] = []
const emittedSid: string[] = []
function emitTo(event: string, payload: unknown) {
  emitted.push(event)
  emittedSid.push(String((payload as { sessionId?: string })?.sessionId ?? ""))
  for (const l of listeners.filter((x) => x.event === event)) {
    const cb = callbacks.get(l.handlerId)
    if (cb) cb({ event, id: l.handlerId, payload })
  }
}

function docOf(key: string): TextDoc {
  const text = docs[key] ?? ""
  return { text, hash: sha(text), path: `C:/qa/${key}.md` }
}

function putDoc(key: string, args: Record<string, unknown>) {
  const text = String(args.text ?? "")
  const base = args.baseHash as string | undefined
  const current = docOf(key)
  if (base && base !== current.hash) {
    const err = {
      code: "conflict",
      message: "文件已被外部修改",
      currentText: current.text,
      currentHash: current.hash,
    }
    throw err
  }
  docs[key] = text
  return { hash: sha(text) }
}

function findKeyDoc(args: Record<string, unknown>): KeyDoc | undefined {
  const name = String(args.name ?? "")
  const ext = String(args.ext ?? "")
  return keyDocs.find((d) => d.name === name && (!ext || d.ext === ext))
}

function qaSnapshot() {
  return { docs, keyDocs, settings, windows: JSON.parse(JSON.stringify(windows)), unknown, calls: calls.slice(), errors: errors.slice(), emitted: emitted.slice(), emittedSid: emittedSid.slice(), listeners: listeners.map((l) => l.event), callbacks: callbacks.size }
}

const handlers: Record<string, (args: Record<string, unknown>) => unknown> = {
  /* ---------- 杂项 ---------- */
  app_info: () => ({ version: "3.0.0-qa", root: "C:/qa" }),
  open_external: (a) => { calls.push("open_external:" + String(a.url)); return null },
  "plugin:event|listen": (args) => {
    listeners.push({ event: String(args.event), handlerId: Number(args.handler) })
    return null
  },
  "plugin:event|unlisten": (args) => {
    const i = listeners.findIndex((l) => l.handlerId === Number(args.event))
    if (i >= 0) listeners.splice(i, 1)
    return null
  },
  "plugin:event|emit": (args) => {
    emitTo(String(args.event), args.payload)
    return null
  },
  "plugin:event|emit_to": (args) => {
    const payload = args.payload as { event?: string; payload?: unknown } | undefined
    if (payload?.event) emitTo(payload.event, payload.payload)
    return null
  },
  "plugin:dialog|open": () => "C:/qa/imported-notes.txt",
  "plugin:dialog|save": () => "C:/qa/out.md",
  wallpaper_import: (args) => `C:/qa/wallpapers/${String(args.sourcePath).split("/").pop()}`,

  /* ---------- 文档 ---------- */
  todo_get: () => docOf("todo"),
  todo_put: (a) => putDoc("todo", a),
  nav_get: () => ({ nav: parseNav(docs.nav), hash: sha(docs.nav) }),
  // 前端提交的是结构化 NavDoc（Rust 侧负责序列化），这里同样按 Markdown 落盘
  nav_put: (a) => {
    const nav = (a.nav ?? { categories: [] }) as {
      categories: { name: string; links: { title: string; url: string }[] }[]
    }
    const lines = ["# 导航", ""]
    for (const c of nav.categories) {
      lines.push("## " + c.name, "")
      for (const l of c.links ?? []) lines.push(`- [${l.title}](${l.url})`)
      lines.push("")
    }
    const text = lines.join("\n")
    const base = a.baseHash as string | undefined
    if (base && base !== sha(docs.nav)) {
      throw { code: "conflict", message: "文件已被外部修改", currentNav: parseNav(docs.nav), currentHash: sha(docs.nav) }
    }
    docs.nav = text
    return { hash: sha(text) }
  },
  note_get: () => docOf("note"),
  note_put: (a) => putDoc("note", a),

  /* ---------- 密钥文档 ---------- */
  keysdocs_list: () =>
    keyDocs
      .slice()
      .sort((x, y) => y.mtimeMs - x.mtimeMs)
      .map((d) => ({ ...d, id: `${d.name}.${d.ext}` })),
  keysdoc_put: (a) => {
    const name = String(a.name ?? "").trim()
    if (!name) throw { code: "validation", message: "文档名不能为空" }
    const ext = String(a.ext ?? "md")
    const text = String(a.text ?? "")
    const found = findKeyDoc({ name, ext })
    if (found) {
      const base = a.baseHash as string | undefined
      if (base && base !== found.hash) {
        throw { code: "conflict", message: "文档已被外部修改", currentText: found.text, currentHash: found.hash }
      }
      found.text = text
      found.hash = sha(text)
      found.chars = text.length
      found.mtimeMs = Date.now()
    } else {
      keyDocs.push({ name, ext, text, hash: sha(text), chars: text.length, mtimeMs: Date.now() })
    }
    return { hash: sha(text), chars: text.length }
  },
  keysdoc_delete: (a) => {
    const i = keyDocs.findIndex((d) => d.name === String(a.name) && d.ext === String(a.ext))
    if (i < 0) throw { code: "not_found", message: "文档不存在" }
    keyDocs.splice(i, 1)
    return null
  },

  assets_list: () => ({
    vault: { enabled: false, unlocked: false },
    assets: [
      { id: "a1", name: "Web 服务器", host: "10.0.0.11", port: "22", grp: "生产", project: "", note: "主力机", links: [], credentials: [{ id: "c1", type: "password", label: "登录", username: "root" }], last_status: "up", last_check: "" },
      { id: "a2", name: "NAS", host: "10.0.0.20", port: "5000", grp: "家庭", project: "", note: "", links: [], credentials: [], last_status: "down", last_check: "" },
      { id: "a3", name: "路由器", host: "192.168.1.1", port: "", grp: "", project: "", note: "", links: [], credentials: [], last_status: "", last_check: "" },
    ],
    groups: ["生产", "家庭"],
  }),
  asset_check: (a) => {
    const id = String(a.id)
    const hit = (handlers.assets_list() as { assets: { id: string; last_status: string }[] }).assets.find((x) => x.id === id)
    if (hit) hit.last_status = hit.last_status === "up" ? "down" : "up"
    return { ok: hit?.last_status === "up", ms: 12 }
  },
  asset_create: (a) => {
    const input = (a.input ?? {}) as Record<string, unknown>
    const list = handlers.assets_list() as { assets: Record<string, unknown>[] }
    list.assets.push({
      id: "n" + Date.now(),
      name: String(input.name ?? ""),
      host: String(input.host ?? ""),
      port: String(input.port ?? ""),
      grp: String(input.grp ?? ""),
      project: String(input.project ?? ""),
      note: String(input.note ?? ""),
      links: [],
      credentials: [],
      last_status: "",
      last_check: "",
    })
    return String(input.name ?? "")
  },
  asset_update: (a) => {
    const input = (a.input ?? {}) as Record<string, unknown>
    const list = handlers.assets_list() as { assets: Record<string, unknown>[] }
    const hit = list.assets.find((x) => x.id === String(a.id))
    if (hit) Object.assign(hit, input)
    return String(input.name ?? "")
  },
  asset_delete: (a) => {
    const list = handlers.assets_list() as { assets: Record<string, unknown>[] }
    const i = list.assets.findIndex((x) => x.id === String(a.id))
    if (i >= 0) list.assets.splice(i, 1)
    return null
  },
  keysdocs_meta: () =>
    keyDocs.map((d) => ({ name: d.name, ext: d.ext, chars: d.text.length, mtimeMs: d.mtimeMs })),
  open_external: (a) => {
    calls.push("open_external:" + String(a.url))
    return null
  },
  card_to_bottom: () => null,
  card_disable: (a) => {
    calls.push("card_disable:" + String(a.key))
    const pet = settings.pet as Record<string, unknown>
    const cards = { ...(pet.cards as Record<string, boolean>), [String(a.key)]: false }
    pet.cards = cards
    return pet
  },
  pane_open: (a) => {
    calls.push("pane_open:" + String(a.id) + (a.prompt ? "|" + String(a.prompt) : ""))
    return null
  },
  card_positions: (a) => {
    const all = ["clock", "calendar", "todo", "notes", "apps", "nav", "assets", "keys", "ai"]
    return all
      .filter((k) => k !== String(a.exclude))
      .map((k) => ({ key: k, x: 800, y: 300, w: 300, h: 240 }))
      .slice(0, 2)
  },

  /* ---------- AI（模拟一次带工具调用的完整回合） ---------- */
  ai_config_get: () => ({
    config: aiConfig,
    hasKey: !!aiKey,
    keyHint: aiKey ? "…" + aiKey.slice(-4) : null,
  }),
  ai_config_set: (a) => {
    Object.assign(aiConfig, (a.patch ?? {}) as Record<string, unknown>)
    return { config: aiConfig, hasKey: !!aiKey, keyHint: aiKey ? "…" + aiKey.slice(-4) : null }
  },
  ai_key_set: (a) => {
    aiKey = String(a.key ?? "")
    return null
  },
  ai_key_clear: () => {
    aiKey = ""
    return null
  },
  ai_new_session: () => "qa-" + Date.now(),
  ai_sessions: () =>
    Object.keys(aiMsgs)
      .map((id) => ({
        id,
        title: aiMsgs[id].find((m) => m.role === "user")?.content?.slice(0, 30) ?? id,
        mtimeMs: Date.now(),
        count: aiMsgs[id].length,
      }))
      .sort((x, y) => y.mtimeMs - x.mtimeMs),
  ai_history: (a) => aiMsgs[String(a.sessionId)] ?? [],
  ai_delete_session: (a) => {
    delete aiMsgs[String(a.sessionId)]
    return null
  },
  ai_memory_get: () => aiMemory,
  ai_memory_set: (a) => {
    aiMemory = String(a.text ?? "")
    return null
  },
  ai_stop: () => null,
  ai_undo: () => "已撤销（QA 模拟）",
  // 整段用微任务链推进：后台页面里 setTimeout 会被节流，流式会看起来卡死
  ai_send: (a) => {
    const sessionId = String(a.sessionId)
    const text = String(a.text ?? "")
    const list = (aiMsgs[sessionId] = aiMsgs[sessionId] ?? [])
    list.push({ role: "user", content: text })
    const callId = "qa-" + Date.now()
    const wantsTodo = /待办|todo/i.test(text)
    const wantsNote = /速记|笔记/.test(text)
    const tick = () => Promise.resolve()

    void (async () => {
      if (wantsTodo || wantsNote) {
        const name = wantsTodo ? "todo_add" : "note_add"
        const payload = wantsTodo ? "买牛奶" : "AI 写的一条速记"
        emitTo("ai:tool", { sessionId, phase: "start", callId, name, args: { text: payload } })
        await tick()
        let result = ""
        if (wantsTodo) {
          docs.todo = docs.todo.replace(/\n*$/, "\n") + `- [ ] ${payload} #ai\n`
          result = `已新增待办「${payload}」`
        } else {
          docs.note = docs.note.replace(/\n*$/, "\n") + `\n## 2026-10-30 07:00\n${payload}\n`
          result = "已新增"
        }
        emitTo("ai:tool", { sessionId, phase: "done", callId, name, ok: true, result, undoId: "u-qa-1" })
        const reply = wantsTodo ? "好了，已经加进待办，并打了 #ai 标签。" : "已经记到速记里了。"
        list.push({ role: "assistant", content: reply })
        for (let i = 0; i < reply.length; i += 4) {
          emitTo("ai:delta", { sessionId, text: reply.slice(i, i + 4) })
          await tick()
        }
        emitTo("ai:done", { sessionId, content: reply, elapsedMs: 600 })
        return
      }
      const reply = "（QA 模拟）我能读写待办、导航、速记、密钥文档和资产；试试说「帮我在待办里加一条买牛奶」。"
      list.push({ role: "assistant", content: reply })
      for (let i = 0; i < reply.length; i += 5) {
        emitTo("ai:delta", { sessionId, text: reply.slice(i, i + 5) })
        await tick()
      }
      emitTo("ai:done", { sessionId, content: reply, elapsedMs: 400 })
    })()
    return null
  },

  /* ---------- 桌宠 ---------- */
  pet_state: () => ({
    config: settings.pet,
    characters,
    activeRoot: "C:/qa/characters",
    motion: { strides: { 螃蟹走路: { stride: 220, curve: [0, 0.5, 1] } }, noMirror: [] },
  }),
  pet_save: (a) => {
    const patch = (a.patch ?? {}) as Record<string, unknown>
    settings.pet = { ...(settings.pet as Record<string, unknown>), ...patch }
    ;(window as unknown as { __QA_PET_SAVES__: unknown[] }).__QA_PET_SAVES__ =
      ((window as unknown as { __QA_PET_SAVES__?: unknown[] }).__QA_PET_SAVES__ ?? []).concat([patch])
    return settings.pet
  },
  pet_save_rect: (a) => {
    settings.pet = { ...(settings.pet as Record<string, unknown>), x: a.x, y: a.y }
    return null
  },
  pet_frames: () => [],
  pet_open: () => null,
  pet_close: () => null,
  pet_panel_open: () => null,
  pet_panel_close: () => null,
  cards_sync: (a) => {
    const cards = (a.cards ?? []) as { key: string; x: number; y: number; width: number; height: number }[]
    for (const k of Object.keys(windows)) if (k.startsWith("card-")) delete windows[k]
    for (const c of cards) windows[`card-${c.key}`] = { x: c.x, y: c.y, w: c.width, h: c.height, visible: true, top: true }
    return null
  },
  cards_close: () => {
    for (const k of Object.keys(windows)) if (k.startsWith("card-")) delete windows[k]
    return null
  },
  card_save_rect: (a) => {
    const key = String(a.key)
    const layout = ((settings.pet as Record<string, unknown>).cardLayout ?? {}) as Record<string, unknown>
    layout[key] = { x: a.x, y: a.y, w: a.width, h: a.height }
    ;(settings.pet as Record<string, unknown>).cardLayout = layout
    return null
  },

  /* ---------- 窗口 ---------- */
  main_show: () => {
    windows.main = { x: 0, y: 0, w: 1200, h: 800, visible: true, top: false }
    return null
  },
  main_hide: () => null,
  "plugin:window|set_position": () => null,
  "plugin:window|set_size": () => null,
  "plugin:window|set_always_on_top": () => null,
  "plugin:window|is_always_on_top": () => true,
  "plugin:window|show": () => null,
  "plugin:window|hide": () => null,
  "plugin:window|close": () => null,
  "plugin:window|minimize": () => null,
  "plugin:window|unminimize": () => null,
  "plugin:window|set_focus": () => null,
  "plugin:window|is_visible": () => true,
  "plugin:window|outer_position": () => ({ x: 0, y: 0 }),
  "plugin:window|outer_size": () => ({ width: 1200, height: 800 }),
  "plugin:window|inner_position": () => ({ x: 0, y: 0 }),
  "plugin:window|inner_size": () => ({ width: 1200, height: 800 }),
  "plugin:window|scale_factor": () => 1,
  "plugin:window|current_monitor": () => ({
    name: "QA",
    scaleFactor: 1,
    position: { x: 0, y: 0 },
    size: { width: 1707, height: 1067 },
    workArea: { position: { x: 0, y: 0 }, size: { width: 1707, height: 1030 } },
  }),
  "plugin:window|primary_monitor": () => null,
  "plugin:window|available_monitors": () => [],
  "plugin:window|start_dragging": () => null,

  /* ---------- Dock ---------- */
  dock_scan: () => dockApps,
  dock_open: () => null,
  dock_close: () => null,
  dock_is_open: () => false,
  dock_geometry: () => null,
  dock_running: () => ["C:/Windows/notepad.exe"],
  dock_launch: () => null,
  dock_reveal: () => null,
  dock_add_shortcut: (a) => ({ ...dockApps[0], path: String(a.path), name: "新应用" }),

  /* ---------- 应用启动器（与 Rust AppEntry 同构：file / name / ext / icon） ---------- */
  apps_list: () => ({
    dir: "C:/qa/apps",
    dirExists: true,
    pinned: ["C:/qa/apps/VS Code.lnk", "C:/qa/apps/intranet.url"],
    apps: [
      { file: "C:/qa/apps/VS Code.lnk", name: "Visual Studio Code", ext: "lnk", icon: null },
      { file: "C:/qa/apps/Obsidian.lnk", name: "Obsidian", ext: "lnk", icon: null },
      { file: "C:/qa/apps/intranet.url", name: "公司内网", ext: "url", icon: null },
      { file: "C:/qa/apps/notepad.exe", name: "记事本", ext: "exe", icon: null },
    ],
  }),
  apps_set_dir: (a) => ({ dir: String(a.dir), dirExists: true, apps: [], pinned: [] }),
  apps_set_pinned: () => null,
  apps_launch: () => null,
  apps_open_folder: () => null,
  apps_suggest_dir: () => "C:/qa/apps",
}

function parseNav(text: string) {
  const categories: { name: string; links: { title: string; url: string }[] }[] = []
  let cur: { name: string; links: { title: string; url: string }[] } | null = null
  for (const line of text.split(/\r?\n/)) {
    const h = line.match(/^##\s+(.+)$/)
    if (h) {
      cur = { name: h[1].trim(), links: [] }
      categories.push(cur)
      continue
    }
    const l = line.match(/^[-*]\s+\[(.+?)\]\((\S+?)\)/)
    if (l && cur) cur.links.push({ title: l[1], url: l[2] })
  }
  return { categories }
}

const internals = {
  metadata: {
    currentWindow: { label: "main" },
    currentWebview: { windowLabel: "main", label: "main" },
  },
  plugins: { path: { sep: "\\", delimiter: ";" } },
  convertFileSrc: (p: string) => p,
  transformCallback(cb: Callback, once = false) {
    const id = nextCallbackId++
    callbacks.set(id, (payload) => {
      cb(payload)
      if (once) callbacks.delete(id)
    })
    return id
  },
  unregisterCallback(id: number) {
    callbacks.delete(id)
  },
  async invoke(cmd: string, args?: Record<string, unknown>) {
    calls.push(cmd)
    const h = handlers[cmd]
    if (!h) {
      unknown.push(cmd)
      return null
    }
    let out: unknown
    try {
      out = h(args ?? {})
    } catch (e) {
      errors.push(cmd + ": " + String((e as { message?: string })?.message ?? e))
      throw e
    }
    // 不引入 setTimeout：后台页签里定时器会被节流到 1 次/分钟，会让整条异步链看起来卡死
    await Promise.resolve()
    return out
  },
}

;(window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = internals
;(window as unknown as { __TAURI_EVENT_PLUGIN_INTERNALS__: unknown }).__TAURI_EVENT_PLUGIN_INTERNALS__ = {
  unregisterListener: () => {},
}
;(window as unknown as { __QA__: unknown }).__QA__ = {
  snapshot: qaSnapshot,
  emit: emitTo,
  setDoc: (key: string, text: string) => {
    docs[key] = text
  },
  setPet: (patch: Record<string, unknown>) => {
    settings.pet = { ...(settings.pet as Record<string, unknown>), ...patch }
  },
  reset: () => {
    unknown.length = 0
  },
}

void enc
