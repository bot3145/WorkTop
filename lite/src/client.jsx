// pwb-lite 客户端：应用启动器 / 待办 / 导航 / 资产 四模块面板（独立运行，public/app.js 构建产物）。
// 主题：苹果设计语言。外观（自动/浅色/深色）与主题色（经典蓝/樱花粉）、语言（中文/English）
// 三个独立维度；四套调色板 = 外观 × 主题色；设置存 localStorage，语言默认中文。
import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { createPortal } from "react-dom"
import { parseTodos, serializeTodos } from "../core/todo.mjs"

const API = "/api/pwb-lite"
async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { "Content-Type": "application/json" },
    ...opts
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.ok === false) {
    const err = new Error(data.error || `HTTP ${res.status}`)
    err.status = res.status
    if (res.status === 409 && data.currentText !== undefined) {
      err.currentText = data.currentText
      err.currentHash = data.currentHash
    }
    if (res.status === 409 && data.currentNav !== undefined) {
      err.currentNav = data.currentNav
      err.currentHash = data.currentHash
    }
    throw err
  }
  return data
}
const rid = () => Math.random().toString(36).slice(2, 9)
const esc = (s) => String(s ?? "")
// 本地时区日期工具（日历/待办共用；用 UTC 的 toISOString 会在东八区晚上错位一天）
const pad2 = (n) => String(n).padStart(2, "0")
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` }
const fromISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d) }
const isoOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const mondayOf = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x }
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

/* ============ 图标：SF Symbols 风格线性图标（1.7px 圆头描边，currentColor） ============ */
const ICON_PATHS = {
  rocket: (<><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" /></>),
  check: <path d="M20 6 9 17l-5-5" />,
  checkCircle: (<><circle cx="12" cy="12" r="9.5" /><path d="m8.4 12.3 2.5 2.5 4.7-5.2" /></>),
  compass: (<><circle cx="12" cy="12" r="9.5" /><path d="m15.7 8.3-1.95 5.45L8.3 15.7l1.95-5.45z" /></>),
  server: (<><rect x="2.5" y="3" width="19" height="7.5" rx="2" /><rect x="2.5" y="13.5" width="19" height="7.5" rx="2" /><path d="M6.3 6.75h.01M6.3 17.25h.01" /></>),
  sun: (<><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></>),
  moon: <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" />,
  contrast: (<><circle cx="12" cy="12" r="9.5" /><path d="M12 2.5v19a9.5 9.5 0 0 0 0-19z" fill="currentColor" stroke="none" /></>),
  sliders: (<><path d="M4 6h7M17 6h3M4 12h3M13 12h7M4 18h7M17 18h3" /><circle cx="14" cy="6" r="2.2" /><circle cx="10" cy="12" r="2.2" /><circle cx="14" cy="18" r="2.2" /></>),
  star: <path d="m12 3 2.65 5.9 6.35.6-4.8 4.25 1.4 6.25L12 16.7 6.4 20l1.4-6.25L3 9.5l6.35-.6z" />,
  trash: (<><path d="M4 6.5h16" /><path d="M18.5 6.5v12a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-12" /><path d="M9 6.5v-2A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5v2" /><path d="M10 11v6M14 11v6" /></>),
  edit: (<><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></>),
  copy: (<><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>),
  eye: (<><path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>),
  file: (<><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M15 2v6h6" /></>),
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M17 7 7 17M7 7l10 10" />,
  search: (<><circle cx="11" cy="11" r="7" /><path d="m20.5 20.5-4.6-4.6" /></>),
  link: (<><path d="M9.6 13.4a4.1 4.1 0 0 0 6.14.44l2.55-2.55a4.1 4.1 0 0 0-5.8-5.8l-1.47 1.46" /><path d="M14.4 10.6a4.1 4.1 0 0 0-6.14-.44l-2.55 2.55a4.1 4.1 0 0 0 5.8 5.8l1.46-1.46" /></>),
  chevronLeft: <path d="m14.5 18-6-6 6-6" />,
  chevronRight: <path d="m9.5 18 6-6-6-6" />,
  clock: (<><circle cx="12" cy="12" r="9.5" /><path d="M12 7v5l3.2 1.9" /></>),
  calendar: (<><rect x="3.5" y="5" width="17" height="16" rx="2.5" /><path d="M8 3v4M16 3v4M3.5 10.5h17" /></>),
  refresh: (<><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></>),
  folder: <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />,
  lock: (<><rect x="4" y="10.5" width="16" height="10.5" rx="2.5" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></>),
  unlock: (<><rect x="4" y="10.5" width="16" height="10.5" rx="2.5" /><path d="M8 10.5V7a4 4 0 0 1 7.83-1.32" /></>),
  alert: (<><circle cx="12" cy="12" r="9.5" /><path d="M12 7.5V13M12 16.5h.01" /></>),
  flame: <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />,
  dot: <circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none" />,
  archive: (<><rect x="3" y="4" width="18" height="4.5" rx="1.2" /><path d="M5 8.5V19a1.6 1.6 0 0 0 1.6 1.6h10.8A1.6 1.6 0 0 0 19 19V8.5" /><path d="M10 12.5h4" /></>),
}
function Icon({ name, size = 16, filled = false, className = "" }) {
  return (
    <svg className={"pwb-ic " + className} width={size} height={size} viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[name]}
    </svg>
  )
}

// 首字母图标兜底：苹果风渐变圆角块。导航与应用两个面板共用一份实现。
const letterAvatar = (name) => {
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  const ch = (name[0] || "?").toUpperCase()
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(${hue},72%,60%)'/><stop offset='1' stop-color='hsl(${(hue + 46) % 360},68%,44%)'/></linearGradient></defs><rect width='32' height='32' rx='8' fill='url(#g)'/><text x='16' y='22' font-size='15' font-family='sans-serif' font-weight='600' fill='white' text-anchor='middle'>${ch}</text></svg>`
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg)
}

// 品牌小标：macOS 窗口意象（渐变 squircle + 红绿灯圆点）
const BrandMark = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
    <defs>
      <linearGradient id="pwb-brand-g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#4da3ff" /><stop offset="1" stopColor="#0053b8" />
      </linearGradient>
    </defs>
    <rect x="1.5" y="1.5" width="21" height="21" rx="6.3" fill="url(#pwb-brand-g)" />
    <rect x="5" y="6" width="14" height="12" rx="2.5" fill="rgba(255,255,255,.96)" />
    <circle cx="7.7" cy="8.6" r="0.95" fill="#ff5f57" /><circle cx="10.3" cy="8.6" r="0.95" fill="#febc2e" /><circle cx="12.9" cy="8.6" r="0.95" fill="#28c840" />
    <rect x="7" y="11.2" width="10" height="1.6" rx="0.8" fill="#c8cdd5" />
    <rect x="7" y="14.2" width="6.5" height="1.6" rx="0.8" fill="#dde2e9" />
  </svg>
)

/* ============ 多语言：默认中文，可切 English（存 localStorage） ============ */
const I18N = {
  zh: {
    app_name: "个人工作台",
    tab_apps: "应用", tab_todo: "待办", tab_nav: "导航", tab_assets: "资产",
    appearance: "外观", auto: "自动", light: "浅色", dark: "深色",
    theme_color: "主题色", blue: "经典蓝", pink: "樱花粉", language: "语言",
    autostart: "开机自启", autostart_tip: "登录 Windows 后自动在后台拉起服务（不打开页面）；仅当前用户，写 HKCU Run 键",
    conn_lost: "服务连接断开，自动重连中…", conn_restored: "服务已恢复，正在刷新",
    vault_remember: "在本机记住，重启后自动解锁",
    tab_note: "速记", tab_keys: "密钥文档",
    kd_new: "新建文档", kd_name_ph: "文档名称", kd_del: "删除文档",
    kd_del_msg: "删除「{name}」？文件将永久移除。", kd_back: "返回列表",
    kd_conflict: "文档已被外部修改，已加载最新内容，请重试", kd_saved: "已保存",
    kd_created: "已创建", kd_deleted: "已删除", kd_search: "搜索文档…",
    kd_chars: "{chars} 字", kd_empty_list: "还没有密钥文档", kd_empty_doc: "空文档，点「编辑」开始记录",
    kd_open_tip: "点击打开文档", kd_name_exists: "同名文档已存在",
    kd_add_title: "添加密钥文档", kd_or: "或",
    kd_import_file: "导入 .md / .txt 文件", kd_import_hint: "选择本地的 Markdown 或纯文本文件，内容原样保存为密钥文档",
    kd_import_done: "已导入：{name}", kd_bad_file: "仅支持 .md / .txt 文件", kd_too_big: "文件超过 1 MB 上限",
    note_earlier: "更早",
    tab_ai: "AI", ai_title: "AI 助手", ai_ph: "输入消息，Enter 发送 / Shift+Enter 换行", ai_send: "发送",
    ai_config: "AI 设置", ai_provider: "供应商", ai_mode: "接入方式", ai_baseurl: "接口地址", ai_key: "API 密钥", ai_model: "模型",
    ai_test: "测试连接", ai_testing: "测试中…", ai_test_ok: "✅ 连接正常 · {ms}ms", ai_test_fail: "❌ 连接失败：",
    ai_models: "模型列表（逗号分隔，可配多个）", ai_model_ph: "输入模型 ID 后回车添加", add_model: "添加",
    ai_cfg_saved: "AI 配置已保存", ai_key_keep: "已保存（留空不修改）", ai_need_cfg_first: "请先点右上角 ⚙ 配置模型接口",
    ai_new_session: "新会话", ai_new_session_msg: "清空当前会话并开始新对话？", ai_welcome: "我是工作台 AI 助手：可查询你的待办、速记、服务器资产与导航。先在右上角 ⚙ 配置模型接口，然后直接提问。",
    ai_ready_hint: "已就绪", ai_asset_btn: "AI 对话",
  ai_new_chat: "新建对话", ai_no_sessions: "暂无会话", ai_del_session: "删除会话",
    ai_sessions_view: "会话", ai_archived_view: "已归档", ai_archive: "归档", ai_unarchive: "恢复", ai_persist_fail: "会话保存失败：",
    ai_del_session_msg: "删除会话「{name}」？聊天记录将一并清除。", ai_sessions: "会话",
    ai_ctx_label: "对话对象", ai_ctx_clear: "退出资产对话",
    confirm_approve: "批准", confirm_reject: "拒绝", confirm_title: "需要你确认才能执行",
    ai_tool_read_todo: "读取待办", ai_tool_read_note: "读取速记", ai_tool_list_assets: "读取资产清单",
    ai_tool_probe_asset: "探测服务器", ai_tool_search_nav: "搜索导航", ai_tool_list_keydocs: "列出密钥文档",
    note_new: "新建卡片", note_ph: "想到什么记什么，回车即存", note_add: "记一笔",
    note_raw: "整篇编辑", note_raw_save: "保存整篇", note_raw_cancel: "放弃",
    note_search: "搜索笔记…", note_empty: "还没有笔记，先记一条", note_none_match: "没有匹配的笔记",
    note_del: "删除", note_edit: "编辑", note_save: "保存", note_cancel: "取消",
    note_stats: "{entries} 条 · {chars} 字", note_conflict: "速记已被外部修改（如 Obsidian），已加载最新内容，请重试",
    key_search: "搜索名称、地址、密钥…", key_add: "添加条目", key_import: "导入文本",
    key_import_title: "导入已有密钥文本", key_import_ph: "粘贴现有密钥文档（支持 # / ## 标题作为条目名，自动按标题切分）",
    key_import_apply: "导入", key_imported: "已导入 {n} 条", key_export: "导出",
    key_empty: "还没有条目，点「添加条目」或「导入文本」开始", key_none_match: "没有匹配的文档",
    key_del_title: "删除条目", key_del_msg: "删除「{name}」？此操作不可撤销。",
    key_add_title: "添加条目", key_edit_title: "编辑条目", key_f_name: "名称", key_add_field: "加字段",
    key_raw: "原文行（可选，原样保留）", key_conflict: "密钥.md 已被外部修改（如 Obsidian），已加载最新内容，请重试",
    key_all: "全部",
    search_apps: "搜索 {n} 个应用…", open_folder: "打开目录", refresh: "刷新", set_folder: "设置目录",
    dir_line: "目录 {dir} · 单击启动，☆ 置顶 / ★ 取消置顶",
    dir_missing: "应用目录不存在：{dir}，点「设置目录」修改",
    dir_unset: "未配置应用目录，点「设置目录」指定存放快捷方式的文件夹",
    pinned: "置顶", all_apps: "全部应用", missing_tag: "已失效",
    pin_title: "置顶", unpin_title: "取消置顶",
    card_title: "{file} · 单击启动",
    missing_title: "{file} · 文件不存在（可能已改名或移动），点 ★ 取消置顶",
    empty_apps: "目录里还没有 .lnk / .url 快捷方式。把桌面或开始菜单的快捷方式复制进目录即可在这里一键启动。",
    no_match: "没有匹配「{q}」的应用",
    launched: "已启动：{name}", dir_updated: "应用目录已更新",
    set_dir_title: "应用目录", set_dir_msg: "存放 .lnk / .url 快捷方式的文件夹（绝对路径，留空恢复默认）",
    todo_ph: "新待办：可带 #标签 与 @2026-10-27 截止日，回车添加",
    cal_add_tip: "在这天添加待办",
    add: "添加", view_board: "看板", view_cal: "日历", view_track: "跟踪",
    stored_at: "存储于 {path}（Markdown 清单，Obsidian 可编辑同一份文件）",
    overdue: "逾期", inprog: "进行中", done: "已完成",
    no_overdue: "暂无逾期", no_inprog: "暂无进行中", no_done: "还没有完成的待办",
    scope_today: "今天", scope_week: "本周", scope_month: "本月", all: "全部",
    seg_week: "周", seg_month: "月",
    show_done: "看已完成", none_in_range: "这个范围里没有待办",
    legend_open: "未完成", legend_drag: " 拖到其他日期可改期",
    legend_overdue: "逾期", legend_done: "✓ 已完成", legend_done_note: " 仍落在截止日",
    del: "删除", click_select: "点击选中",
    chip_title: "{text}（拖到其他日期可改期，点击勾选完成）",
    chip_title_done: "{text}（已完成）（拖到其他日期可改期，点击勾选完成）",
    n_items: "{n} 条", add_todo: "加待办", none_this_day: "这天没有待办",
    add_todo_title: "添加待办", falls_on: "将落在 {due}", todo_ph_short: "内容，可带 #标签",
    untagged: "未分类", n_overdue: "逾期 {n}", all_done: "全部完成",
    no_todos_yet: "还没有待办，先在上面添加一条",
    prev: "上一页", next: "下一页",
    conflict_todo: "待办已被外部修改（如 Obsidian），已加载最新内容，请重试操作",
    weekdays: "一,二,三,四,五,六,日",
    months: "一月,二月,三月,四月,五月,六月,七月,八月,九月,十月,十一月,十二月",
    add_link: "添加链接", add_cat: "分类", del_cat: "删除当前分类",
    check_links: "检查死链", check_all: "检查全部死链", checking: "检测中…",
    export_btn: "导出", import_btn: "导入",
    export_t: "导出为书签 HTML（Edge / Chrome / Firefox 书签管理器可直接导入）",
    import_t: "导入书签 HTML（浏览器导出的书签文件；追加合并、按 URL 去重，不覆盖现有数据）",
    no_cats: "还没有分类，点「分类」创建",
    no_links_cat: "这个分类还没有链接",
    no_links_all: "还没有任何链接，点「添加链接」或「导入」开始",
    all_tip: "查看所有分类的链接", dbl_del_cat: "双击删除分类",
    add_link_title: "添加链接", name: "名称", url_label: "网址", category: "分类", save: "保存",
    new_cat_title: "新建分类", cat_ph: "分类名称",
    del_cat_title: "删除分类", del_cat_msg: "将删除「{name}」及其 {n} 条链接，此操作不可撤销。", ok_del: "删除",
    imported: "已导入", import_fail: "导入失败：",
    err_no_dl: "不是书签 HTML：未找到书签列表",
    err_no_links: "未在文件中找到书签链接（请确认是浏览器导出的书签 HTML）",
    check_result: "检测 {total} 条：{ok} 正常 · {bad} 异常",
    exported: "已导出 {cats} 个分类、{links} 条链接（浏览器书签管理器可直接导入）",
    conflict_nav: "导航.md 已被外部修改（如 Obsidian），已加载最新内容，请重试操作",
    add_asset: "添加资产",
    ad_summary: "{c} 条凭据 · {l} 个链接", ad_links: "相关链接", ad_no_cred: "还没有凭据，点「编辑资产」添加",
    enc_enable: "启用凭据加密", enc_enable_tip: "凭据当前为明文。启用后凭据以主口令派生密钥加密落盘（结构可读，机密可护）",
    enc_unlock: "凭据已加密（点解锁）", enc_lock: "凭据已解锁（点锁定）",
    enc_lock_tip: "点击锁定凭据库", enc_unlock_tip: "凭据已加密，点击解锁",
    enc_disable: "关闭加密", enc_disable_tip: "关闭加密：全部凭据解密为明文",
    all_n: "全部 {n}",
    online: "在线", offline: "离线", unknown: "未检",
    probe: "探测", link_add: "链接", reveal: "查看", hide: "隐藏", copy: "复制",
    probe_toast: "探测中…", probe_up: "在线 · TCP 可达", probe_down: "离线 · 连接失败",
    copied: "已复制", copy_fail: "复制失败", name_required: "名称必填", added: "已添加",
    enc_enabled_toast: "已启用凭据加密（当前会话已解锁）", unlocked_toast: "已解锁", locked_toast: "已锁定",
    enc_disabled_toast: "已关闭加密，凭据为明文", decrypt_fail: "解密失败：",
    no_assets: "没有资产，点下方 ＋ 录入第一台服务器",
    expired: "已过期", days: "天", exp_tip: "点击修改到期日",
    edit: "编辑", manage: "管理", edit_asset_title: "编辑资产", asset_updated: "资产已更新",
    cred_edit_title: "编辑凭据", f_new_secret: "新机密", new_secret_ph: "留空保持不变",
    cred_delete: "删除凭据", cred_delete_msg: "删除这条凭据？此操作不可撤销。", cred_updated: "凭据已更新",
    grp_rename_title: "重命名分组", grp_dbl_rename: "双击重命名分组", grp_renamed: "分组已重命名",
    token_path_note: "保存后此处显示令牌文件路径",
    cred_pw: "密码", cred_pk: "私钥", cred_tok: "令牌",
    f_token_file: "令牌文件", token_pick: "选择文件…", token_hint: "将统一保存到 data/tokens/<资产名>/ 下",
    token_pick_first: "令牌类型需要先选择文件", token_too_big: "文件超过 5 MB 上限", token_saved_to: "令牌文件已保存到：",
    token_hint_edit: "未选择新文件则保留原令牌", multi_cred_hint: "此资产有 {n} 条凭据，此处编辑第一条，其余用卡片上的齿轮按钮管理",
    cred_section_edit: "凭据",
    dlg_del_asset: "删除资产", dlg_del_asset_msg: "将删除资产「{name}」及其全部凭据，此操作不可撤销。",
    add_asset_title: "添加资产", f_name: "名称", f_host: "主机", f_port: "端口", f_group: "分组",
    f_project: "项目", f_notes: "备注", cred_optional: "凭据（可选）", f_type: "类型", f_label: "标签",
    f_user: "用户名", f_secret: "机密", f_pk: "私钥内容", f_pp: "私钥口令", f_exp: "到期日",
    host_ph: "IP 或域名", pp_ph: "无则留空",
    add_rel_title: "追加相关链接", rel_name_ph: "留空则显示网址",
    vault_enable_t: "启用凭据加密", vault_unlock_t: "解锁凭据库", vault_disable_t: "关闭凭据加密",
    vault_enable_msg: "设置凭据库主口令（至少 4 位）。启用后凭据密文落盘，重启后需解锁才能查看。\n忘记口令 = 无法解密，需重录凭据，请牢记！",
    vault_unlock_msg: "输入凭据库主口令解锁",
    vault_disable_msg: "输入主口令以关闭加密（全部凭据将解密为明文）",
    vault_ph: "主口令",
    exp_title: "到期日", exp_msg: "格式 YYYY-MM-DD，留空清除",
    ungrouped: "未分组", cancel: "取消", ok: "确定",
  },
  en: {
    app_name: "Personal Workbench",
    tab_apps: "Apps", tab_todo: "To-Do", tab_nav: "Nav", tab_assets: "Assets",
    appearance: "Appearance", auto: "Auto", light: "Light", dark: "Dark",
    theme_color: "Theme", blue: "Classic Blue", pink: "Sakura Pink", language: "Language",
    autostart: "Start at login", autostart_tip: "Start the background service silently at login (no page opened); current user only, stored in the HKCU Run key",
    conn_lost: "Service connection lost — reconnecting…", conn_restored: "Service restored — refreshing",
    vault_remember: "Remember on this machine — auto-unlock after restart",
    tab_note: "Notes", tab_keys: "Key Docs",
    kd_new: "New doc", kd_name_ph: "Document name", kd_del: "Delete doc",
    kd_del_msg: "Delete \"{name}\"? The file will be removed permanently.", kd_back: "Back to list",
    kd_conflict: "The document changed outside — latest content loaded, please retry", kd_saved: "Saved",
    kd_created: "Created", kd_deleted: "Deleted", kd_search: "Search docs…",
    kd_chars: "{chars} chars", kd_empty_list: "No key documents yet", kd_empty_doc: "Empty doc — click \"Edit\" to start",
    kd_add_title: "Add key document", kd_or: "or",
    kd_import_file: "Import .md / .txt file", kd_import_hint: "Pick a local Markdown or plain-text file; its content is saved as a key document as-is",
    kd_import_done: "Imported: {name}", kd_bad_file: "Only .md / .txt files are supported", kd_too_big: "File exceeds the 1 MB limit",
    note_earlier: "Earlier",
    tab_ai: "AI", ai_title: "AI Assistant", ai_ph: "Type a message — Enter to send, Shift+Enter for newline", ai_send: "Send",
    ai_config: "AI Settings", ai_provider: "Provider", ai_mode: "Access mode", ai_baseurl: "Base URL", ai_key: "API Key", ai_model: "Model",
    ai_test: "Test connection", ai_testing: "Testing…", ai_test_ok: "✅ OK · {ms}ms", ai_test_fail: "❌ Failed: ",
    ai_models: "Models (comma-separated, multiple allowed)", ai_model_ph: "Model ID, press Enter to add", add_model: "Add",
    ai_cfg_saved: "AI config saved", ai_key_keep: "Saved (leave empty to keep)", ai_need_cfg_first: "Configure the AI endpoint first (gear icon)",
    ai_new_session: "New session", ai_new_session_msg: "Clear this conversation and start a new one?", ai_welcome: "Workbench AI assistant: query to-dos, notes, server assets and nav links. Configure the endpoint via the gear icon first.",
    ai_ready_hint: "Ready", ai_asset_btn: "AI chat",
  ai_new_chat: "New chat", ai_no_sessions: "No sessions yet", ai_del_session: "Delete session",
    ai_sessions_view: "Sessions", ai_archived_view: "Archived", ai_archive: "Archive", ai_unarchive: "Restore", ai_persist_fail: "Failed to save session: ",
    ai_del_session_msg: "Delete session \"{name}\"? The chat history will be removed too.", ai_sessions: "Sessions",
    ai_ctx_label: "Context", ai_ctx_clear: "Exit asset chat",
    confirm_approve: "Approve", confirm_reject: "Reject", confirm_title: "Needs your approval to run",
    ai_tool_read_todo: "Read to-dos", ai_tool_read_note: "Read notes", ai_tool_list_assets: "List assets",
    ai_tool_probe_asset: "Probe server", ai_tool_search_nav: "Search nav", ai_tool_list_keydocs: "List key docs",
    note_raw: "Edit raw", note_raw_save: "Save all", note_raw_cancel: "Discard",
    note_search: "Search notes…", note_empty: "No notes yet — write your first one", note_none_match: "No matching notes",
    note_del: "Delete", note_edit: "Edit", note_save: "Save", note_cancel: "Cancel",
    note_stats: "{entries} entries · {chars} chars", note_conflict: "The notes file changed outside (e.g. Obsidian). Latest content loaded — please retry.",
    key_search: "Search name, URL, key…", key_add: "Add entry", key_import: "Import text",
    key_import_title: "Import existing keys text", key_import_ph: "Paste your existing key document (# / ## headings become entry names)",
    key_import_apply: "Import", key_imported: "Imported {n} entries", key_export: "Export",
    key_empty: "No entries yet — click \"Add entry\" or \"Import text\" to begin", key_none_match: "No matching entries",
    key_del_title: "Delete entry", key_del_msg: "Delete \"{name}\"? This cannot be undone.",
    key_add_title: "Add entry", key_edit_title: "Edit entry", key_f_name: "Name", key_add_field: "Add field",
    key_raw: "Raw lines (optional, kept as-is)", key_conflict: "密钥.md changed outside (e.g. Obsidian). Latest content loaded — please retry.",
    key_all: "All",
    search_apps: "Search {n} apps…", open_folder: "Open folder", refresh: "Refresh", set_folder: "Set folder",
    dir_line: "Folder {dir} · Click to launch, ☆ pin / ★ unpin",
    dir_missing: "App folder not found: {dir} — click \"Set folder\" to fix",
    dir_unset: "No app folder configured — click \"Set folder\" to choose where shortcuts live",
    pinned: "Pinned", all_apps: "All apps", missing_tag: "Missing",
    pin_title: "Pin", unpin_title: "Unpin",
    card_title: "{file} · click to launch",
    missing_title: "{file} · file not found (moved or renamed?) — click the star to unpin",
    empty_apps: "No .lnk / .url shortcuts in the folder yet. Copy shortcuts from your Desktop or Start menu into the folder to launch them here.",
    no_match: "No apps matching \"{q}\"",
    launched: "Launched: {name}", dir_updated: "App folder updated",
    set_dir_title: "App folder", set_dir_msg: "Folder holding .lnk / .url shortcuts (absolute path; leave empty to reset)",
    todo_ph: "New to-do — #tag and @2026-10-27 due date supported; Enter to add",
    cal_add_tip: "Add a to-do on this day",
    add: "Add", view_board: "Board", view_cal: "Calendar", view_track: "Track",
    stored_at: "Stored at {path} (Markdown list — Obsidian edits the same file)",
    overdue: "Overdue", inprog: "In progress", done: "Done",
    no_overdue: "Nothing overdue", no_inprog: "Nothing in progress", no_done: "No completed to-dos yet",
    scope_today: "Today", scope_week: "This week", scope_month: "This month", all: "All",
    seg_week: "Week", seg_month: "Month",
    show_done: "Show completed", none_in_range: "No to-dos in this range",
    legend_open: "Open", legend_drag: " — drag to another day to reschedule",
    legend_overdue: "Overdue", legend_done: "✓ Done", legend_done_note: " — stays on its due date",
    del: "Delete", click_select: "click to select",
    chip_title: "{text} — drag to another day to reschedule; click to check",
    chip_title_done: "{text} (done) — drag to another day to reschedule; click to uncheck",
    n_items: "{n} item(s)", add_todo: "Add to-do", none_this_day: "No to-dos on this day",
    add_todo_title: "Add to-do", falls_on: "Will be due on {due}", todo_ph_short: "Text, #tag supported",
    untagged: "Untagged", n_overdue: "{n} overdue", all_done: "All done",
    no_todos_yet: "No to-dos yet — add one above",
    prev: "Previous", next: "Next",
    conflict_todo: "The to-do list changed outside (e.g. Obsidian). Latest content loaded — please retry.",
    weekdays: "Mo,Tu,We,Th,Fr,Sa,Su",
    months: "January,February,March,April,May,June,July,August,September,October,November,December",
    add_link: "Add link", add_cat: "Category", del_cat: "Delete category",
    check_links: "Check dead links", check_all: "Check all links", checking: "Checking…",
    export_btn: "Export", import_btn: "Import",
    export_t: "Export as bookmarks HTML (importable via Edge / Chrome / Firefox bookmark managers)",
    import_t: "Import bookmarks HTML (from a browser export; merged in, deduped by URL, never overwrites)",
    no_cats: "No categories yet — click \"Category\" to create one",
    no_links_cat: "No links in this category",
    no_links_all: "No links yet — click \"Add link\" or \"Import\" to begin",
    all_tip: "Show links from all categories", dbl_del_cat: "Double-click to delete",
    add_link_title: "Add link", name: "Name", url_label: "URL", category: "Category", save: "Save",
    new_cat_title: "New category", cat_ph: "Category name",
    del_cat_title: "Delete category", del_cat_msg: "Delete \"{name}\" and its {n} link(s)? This cannot be undone.", ok_del: "Delete",
    imported: "Imported", import_fail: "Import failed: ",
    err_no_dl: "Not a bookmarks HTML: no bookmark list found",
    err_no_links: "No bookmark links found in the file (export bookmarks from your browser first)",
    check_result: "Checked {total} links: {ok} ok · {bad} failed",
    exported: "Exported {cats} categories, {links} links (importable in your browser's bookmark manager)",
    conflict_nav: "导航.md changed outside (e.g. Obsidian). Latest content loaded — please retry.",
    add_asset: "Add asset",
    ad_summary: "{c} credential(s) · {l} link(s)", ad_links: "Related links", ad_no_cred: "No credentials yet — click \"Edit asset\" to add",
    enc_enable: "Enable encryption", enc_enable_tip: "Credentials are plain text now. Enable to encrypt them on disk with a master passphrase (structure stays readable)",
    enc_unlock: "Encrypted (click to unlock)", enc_lock: "Unlocked (click to lock)",
    enc_lock_tip: "Click to lock the vault", enc_unlock_tip: "Credentials encrypted — click to unlock",
    enc_disable: "Disable encryption", enc_disable_tip: "Turn off encryption: all credentials return to plain text",
    all_n: "All {n}",
    online: "Online", offline: "Offline", unknown: "Not checked",
    probe: "Probe", link_add: "Link", reveal: "Reveal", hide: "Hide", copy: "Copy",
    probe_toast: "Probing…", probe_up: "Online · TCP reachable", probe_down: "Offline · connection failed",
    copied: "Copied", copy_fail: "Copy failed", name_required: "Name is required", added: "Added",
    enc_enabled_toast: "Encryption enabled (unlocked for this session)", unlocked_toast: "Unlocked", locked_toast: "Locked",
    enc_disabled_toast: "Encryption off — credentials are plain text now", decrypt_fail: "Decryption failed: ",
    no_assets: "No assets yet — click the + below to add your first server",
    expired: "expired", days: "d", exp_tip: "Click to edit the expiry date",
    edit: "Edit", manage: "Manage", edit_asset_title: "Edit asset", asset_updated: "Asset updated",
    cred_edit_title: "Edit credential", f_new_secret: "New secret", new_secret_ph: "Leave empty to keep current",
    cred_delete: "Delete credential", cred_delete_msg: "Delete this credential? This cannot be undone.", cred_updated: "Credential updated",
    grp_rename_title: "Rename group", grp_dbl_rename: "Double-click to rename group", grp_renamed: "Group renamed",
    token_path_note: "The token file path is shown here after saving",
    cred_pw: "Password", cred_pk: "Private key", cred_tok: "Token",
    f_token_file: "Token file", token_pick: "Choose file…", token_hint: "Saved uniformly under data/tokens/<asset>/",
    token_pick_first: "Choose a token file first", token_too_big: "File exceeds the 5 MB limit", token_saved_to: "Token file saved to:",
    token_hint_edit: "No new file chosen — keep the current token", multi_cred_hint: "This asset has {n} credentials — editing the first one; manage the rest via the gear icon on the card",
    cred_section_edit: "Credentials",
    dlg_del_asset: "Delete asset", dlg_del_asset_msg: "Delete asset \"{name}\" and all its credentials? This cannot be undone.",
    add_asset_title: "Add asset", f_name: "Name", f_host: "Host", f_port: "Port", f_group: "Group",
    f_project: "Project", f_notes: "Notes", cred_optional: "Credentials (optional)", f_type: "Type", f_label: "Label",
    f_user: "Username", f_secret: "Secret", f_pk: "Private key content", f_pp: "Passphrase", f_exp: "Expires",
    host_ph: "IP or domain", pp_ph: "Leave empty if none",
    add_rel_title: "Add related link", rel_name_ph: "Leave empty to show the URL",
    vault_enable_t: "Enable credential encryption", vault_unlock_t: "Unlock vault", vault_disable_t: "Disable encryption",
    vault_enable_msg: "Set a master passphrase (4+ chars). Secrets are stored encrypted; unlocking is required after a restart.\nForgot the passphrase = cannot decrypt; credentials must be re-entered. Keep it safe!",
    vault_unlock_msg: "Enter the vault master passphrase to unlock",
    vault_disable_msg: "Enter the master passphrase to disable encryption (all credentials return to plain text)",
    vault_ph: "Master passphrase",
    exp_title: "Expiry date", exp_msg: "Format YYYY-MM-DD; leave empty to clear",
    ungrouped: "Ungrouped", cancel: "Cancel", ok: "OK",
  },
}
const makeT = (lang) => (key, vars) => {
  let s = (I18N[lang] && I18N[lang][key]) ?? I18N.zh[key] ?? key
  if (vars) for (const k in vars) s = s.split("{" + k + "}").join(String(vars[k]))
  return s
}

/* ============ 主题：跟随宿主，可手动覆盖；主题色独立切换 ============ */
function useTheme() {
  const [mode, setMode] = useState(() => localStorage.getItem("pwb_theme") || "auto")
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const compute = () => {
      if (mode === "dark") return setDark(true)
      if (mode === "light") return setDark(false)
      let cs = "light"
      try { cs = getComputedStyle(document.documentElement).colorScheme } catch {}
      const mq = matchMedia("(prefers-color-scheme: dark)")
      setDark(cs === "dark" || (cs !== "light" && mq.matches))
    }
    compute()
    const mq = matchMedia("(prefers-color-scheme: dark)")
    const mo = new MutationObserver(compute)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-ds-theme-source", "data-theme"] })
    mq.addEventListener("change", compute)
    return () => { mo.disconnect(); mq.removeEventListener("change", compute) }
  }, [mode])
  const set = useCallback((m) => { setMode(m); try { localStorage.setItem("pwb_theme", m) } catch {} }, [])
  return { mode, dark, set }
}

/* ============ 样式：苹果设计语言（外观 × 主题色 四套调色板） ============ */
const CSS = `
.pwb {
  --pwb-font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI Variable Text", "Segoe UI", "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif;
  --pwb-radius-sm: 8px; --pwb-radius-md: 12px; --pwb-radius-lg: 16px;
  /* 经典蓝 · 浅色 */
  --pwb-bg: #f5f5f7; --pwb-panel: #eceef2; --pwb-card: #ffffff;
  --pwb-border: #e4e5e9; --pwb-border-strong: #d3d4d9;
  --pwb-input-bg: #ffffff; --pwb-text: #1d1d1f; --pwb-muted: #6e6e73; --pwb-faint: #a5a5aa;
  --pwb-chip: #e9e9ee; --pwb-hover: #e7e8ee;
  --pwb-accent: #0066cc; --pwb-accent-hover: #0a70d8; --pwb-on-accent: #ffffff;
  --pwb-ring: rgba(0,102,204,.22);
  --pwb-tag-bg: #e2eefc; --pwb-tag-fg: #0a56b0;
  --pwb-ok-fg: #1c6b3c; --pwb-ok-bg: #dcf3e6;
  --pwb-bad-fg: #c0362c; --pwb-bad-bg: #fbe5e3;
  --pwb-danger: #d70015; --pwb-warn: #9a6a00;
  --pwb-topbar: rgba(245,245,247,.82);
  --pwb-overlay: rgba(15,17,20,.38);
  --pwb-seg-active: #ffffff;
  --pwb-switch-off: #d6d6db;
  --pwb-scrollbar: rgba(0,0,0,.24);
  --pwb-shadow-sm: 0 1px 2px rgba(0,0,0,.06);
  --pwb-shadow-md: 0 10px 28px rgba(0,0,0,.14);
  --pwb-shadow-pop: 0 16px 48px rgba(0,0,0,.2), 0 3px 10px rgba(0,0,0,.08);
  font: 13px/1.55 var(--pwb-font);
  color: var(--pwb-text);
  background: var(--pwb-bg);
  color-scheme: light;
  height: 100%;
  overflow: auto;
  -webkit-font-smoothing: antialiased;
}
/* 经典蓝 · 深色 */
.pwb.pwb-dark {
  --pwb-bg: #111113; --pwb-panel: #19191c; --pwb-card: #1f1f22;
  --pwb-border: #2c2c30; --pwb-border-strong: #3c3c41;
  --pwb-input-bg: #27272b; --pwb-text: #f5f5f7; --pwb-muted: #a1a1a6; --pwb-faint: #78787e;
  --pwb-chip: #28282c; --pwb-hover: #303036;
  --pwb-accent: #409cff; --pwb-accent-hover: #63aeff; --pwb-on-accent: #ffffff;
  --pwb-ring: rgba(64,156,255,.3);
  --pwb-tag-bg: #20344a; --pwb-tag-fg: #7db8ff;
  --pwb-ok-fg: #6fdd8b; --pwb-ok-bg: #17301f;
  --pwb-bad-fg: #ff8a80; --pwb-bad-bg: #3a1b1c;
  --pwb-danger: #ff453a; --pwb-warn: #ffb86b;
  --pwb-topbar: rgba(17,17,19,.75);
  --pwb-overlay: rgba(0,0,0,.52);
  --pwb-seg-active: #5a5a61;
  --pwb-switch-off: #48484e;
  --pwb-scrollbar: rgba(255,255,255,.22);
  --pwb-shadow-sm: 0 1px 2px rgba(0,0,0,.4);
  --pwb-shadow-md: 0 10px 28px rgba(0,0,0,.5);
  --pwb-shadow-pop: 0 16px 48px rgba(0,0,0,.6), 0 3px 10px rgba(0,0,0,.4);
  color-scheme: dark;
}
/* 樱花粉 · 浅色 */
.pwb.pwb-pink {
  --pwb-bg: #faf5f7; --pwb-panel: #f4e9ee; --pwb-card: #ffffff;
  --pwb-border: #f0dce5; --pwb-border-strong: #e3c6d3;
  --pwb-input-bg: #ffffff; --pwb-text: #3b2531; --pwb-muted: #8a6b78; --pwb-faint: #bb9faa;
  --pwb-chip: #f5eaef; --pwb-hover: #f4e6ec;
  --pwb-accent: #cc3572; --pwb-accent-hover: #dd4a85; --pwb-on-accent: #ffffff;
  --pwb-ring: rgba(204,53,114,.22);
  --pwb-tag-bg: #fbe2ec; --pwb-tag-fg: #ab2157;
  --pwb-ok-fg: #1c6b3c; --pwb-ok-bg: #ddf3e6;
  --pwb-bad-fg: #c0362c; --pwb-bad-bg: #fbe5e3;
  --pwb-danger: #d70015; --pwb-warn: #9a6a00;
  --pwb-topbar: rgba(250,245,247,.85);
  --pwb-overlay: rgba(59,37,49,.35);
  --pwb-seg-active: #ffffff;
  --pwb-switch-off: #e6ccd8;
  --pwb-scrollbar: rgba(120,50,80,.25);
  --pwb-shadow-sm: 0 1px 2px rgba(120,50,80,.08);
  --pwb-shadow-md: 0 10px 28px rgba(150,60,95,.18);
  --pwb-shadow-pop: 0 16px 48px rgba(150,60,95,.24), 0 3px 10px rgba(150,60,95,.1);
}
/* 樱花粉 · 深色 */
.pwb.pwb-dark.pwb-pink {
  --pwb-bg: #161013; --pwb-panel: #1f1519; --pwb-card: #261a20;
  --pwb-border: #3a2932; --pwb-border-strong: #4c3742;
  --pwb-input-bg: #2d1f26; --pwb-text: #f6ebf0; --pwb-muted: #b59cab; --pwb-faint: #8a6e7c;
  --pwb-chip: #2f222a; --pwb-hover: #372730;
  --pwb-accent: #ff5c97; --pwb-accent-hover: #ff79ab; --pwb-on-accent: #ffffff;
  --pwb-ring: rgba(255,92,151,.3);
  --pwb-tag-bg: #432230; --pwb-tag-fg: #ff9cc0;
  --pwb-ok-fg: #6fdd8b; --pwb-ok-bg: #17301f;
  --pwb-bad-fg: #ff8a80; --pwb-bad-bg: #3a1b1c;
  --pwb-danger: #ff453a; --pwb-warn: #ffb86b;
  --pwb-topbar: rgba(22,16,19,.78);
  --pwb-overlay: rgba(0,0,0,.52);
  --pwb-seg-active: #55404b;
  --pwb-switch-off: #4c3742;
  --pwb-scrollbar: rgba(255,255,255,.22);
}
.pwb * { box-sizing: border-box; }
.pwb ::selection { background: var(--pwb-ring); }
.pwb ::-webkit-scrollbar { width: 11px; height: 11px; }
.pwb ::-webkit-scrollbar-thumb { background: var(--pwb-scrollbar); border-radius: 999px; border: 3px solid transparent; background-clip: content-box; }
.pwb ::-webkit-scrollbar-track { background: transparent; }

/* ---------- 顶栏（毛玻璃）与品牌 ---------- */
.pwb-topbar { display: flex; gap: 12px; align-items: center; padding: 9px 16px; position: sticky; top: 0; z-index: 20;
  background: var(--pwb-topbar); backdrop-filter: blur(20px) saturate(1.8); -webkit-backdrop-filter: blur(20px) saturate(1.8);
  border-bottom: 1px solid var(--pwb-border); }
.pwb-brand { display: flex; align-items: center; gap: 8px; font-size: 13px; letter-spacing: -.01em; white-space: nowrap; }
.pwb-brand b { font-weight: 600; }
@media (max-width: 620px) { .pwb-brand b { display: none; } }

/* ---------- 分段控件 ---------- */
.pwb-seg { display: inline-flex; gap: 2px; background: var(--pwb-chip); border-radius: 9px; padding: 2px; flex-shrink: 0; }
.pwb .pwb-seg-item { display: inline-flex; align-items: center; gap: 6px; border: none; background: transparent; color: var(--pwb-muted);
  height: 26px; padding: 0 12px; border-radius: 7px; font-size: 12.5px; font-weight: 500; cursor: pointer;
  transition: color .15s, background .15s, box-shadow .15s; }
.pwb .pwb-seg-item:hover { color: var(--pwb-text); background: transparent; }
.pwb .pwb-seg-item.on { background: var(--pwb-seg-active); color: var(--pwb-text); box-shadow: 0 1px 3px rgba(0,0,0,.14), 0 0 0 .5px rgba(0,0,0,.04); }
.pwb .pwb-seg.mini .pwb-seg-item { height: 22px; padding: 0 9px; font-size: 12px; }

/* ---------- 弹出设置 ---------- */
.pwb-pop-overlay { position: fixed; inset: 0; z-index: 44; }
.pwb-pop { position: fixed; top: 50px; right: 14px; z-index: 45; width: 224px; background: var(--pwb-topbar);
  backdrop-filter: blur(24px) saturate(1.8); -webkit-backdrop-filter: blur(24px) saturate(1.8);
  border: 1px solid var(--pwb-border); border-radius: 14px; padding: 12px; box-shadow: var(--pwb-shadow-pop);
  animation: pwbPop .18s cubic-bezier(.32,.72,.35,1); }
.pwb-pop-title { font-size: 11.5px; font-weight: 600; color: var(--pwb-faint); margin: 2px 2px 6px; }
.pwb-pop-row + .pwb-pop-row { margin-top: 12px; }
.pwb-swatches { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.pwb .pwb-swatch { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px 6px 8px; border-radius: 10px;
  background: var(--pwb-chip); border: 1px solid transparent; cursor: pointer; font-size: 12px; color: var(--pwb-muted); font-weight: 500; height: auto; }
.pwb .pwb-swatch i { width: 26px; height: 26px; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(0,0,0,.08); }
.pwb .pwb-swatch.on { border-color: var(--pwb-accent); color: var(--pwb-text); background: var(--pwb-tag-bg); }
.pwb .pwb-swatch .pwb-ic { color: var(--pwb-accent); }

/* ---------- 控件 ---------- */
.pwb button { appearance: none; display: inline-flex; align-items: center; justify-content: center; gap: 5px; flex-shrink: 0;
  font: inherit; font-weight: 500; color: var(--pwb-text); background: var(--pwb-chip); border: none; border-radius: 8px;
  padding: 0 12px; height: 30px; cursor: pointer; transition: background .15s, transform .1s, box-shadow .15s, color .15s; }
.pwb button:hover { background: var(--pwb-hover); }
.pwb button:active { transform: scale(.97); }
.pwb button:disabled { opacity: .45; cursor: default; transform: none; }
.pwb button.primary { background: var(--pwb-accent); color: var(--pwb-on-accent); }
.pwb button.primary:hover { background: var(--pwb-accent-hover); }
.pwb button.danger { background: var(--pwb-danger); color: #fff; }
.pwb button.ghost { background: transparent; color: var(--pwb-muted); }
.pwb button.ghost:hover { background: var(--pwb-hover); color: var(--pwb-text); }
.pwb button.mini { height: 24px; padding: 0 9px; font-size: 12px; border-radius: 7px; }
.pwb .ibtn { width: 28px; height: 28px; padding: 0; border-radius: 8px; background: transparent; color: var(--pwb-muted); }
.pwb .ibtn:hover { background: var(--pwb-hover); color: var(--pwb-text); }
.pwb .ibtn.on { background: var(--pwb-hover); color: var(--pwb-text); }
.pwb .ibtn.sm { width: 22px; height: 22px; border-radius: 6px; }
.pwb .ibtn.red { color: var(--pwb-bad-fg); }
.pwb .ibtn.red:hover { background: var(--pwb-bad-bg); color: var(--pwb-bad-fg); }
.pwb input, .pwb select, .pwb textarea { font: inherit; color: var(--pwb-text); background: var(--pwb-input-bg);
  border: 1px solid var(--pwb-border-strong); border-radius: 8px; padding: 5px 10px; min-height: 30px; outline: none;
  transition: border-color .15s, box-shadow .15s; }
.pwb textarea { height: auto; padding: 8px 10px; line-height: 1.5; }
.pwb input:focus, .pwb select:focus, .pwb textarea:focus { border-color: var(--pwb-accent); box-shadow: 0 0 0 3px var(--pwb-ring); }
.pwb input::placeholder, .pwb textarea::placeholder { color: var(--pwb-faint); }
.pwb input[type="checkbox"] { min-height: 0; width: 15px; height: 15px; padding: 0; margin: 0; accent-color: var(--pwb-accent); cursor: pointer; }
.pwb input[type="date"] { font-variant-numeric: tabular-nums; }
.pwb-search { position: relative; flex: 1; min-width: 180px; display: flex; }
.pwb-search > .pwb-ic { position: absolute; left: 9px; top: 50%; transform: translateY(-50%); color: var(--pwb-faint); pointer-events: none; }
.pwb-search input { width: 100%; padding-left: 29px; padding-right: 28px; }
.pwb-search-clear { position: absolute; right: 5px; top: 50%; transform: translateY(-50%); }
.pwb .pwb-switch { position: relative; width: 34px; height: 20px; border-radius: 999px; background: var(--pwb-switch-off);
  border: none; padding: 0; cursor: pointer; flex-shrink: 0; transition: background .2s; }
.pwb .pwb-switch:hover { background: var(--pwb-switch-off); }
.pwb .pwb-switch.on, .pwb .pwb-switch.on:hover { background: var(--pwb-accent); }
.pwb .pwb-switch .pwb-switch-knob { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%;
  background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.25); transition: transform .2s cubic-bezier(.3,.7,.4,1.15); }
.pwb .pwb-switch.on .pwb-switch-knob { transform: translateX(14px); }

/* ---------- 布局基件 ---------- */
.pwb-body { padding: 4px 16px 18px; animation: pwbBodyIn .22s ease; }
.pwb .row { display: flex; gap: 8px; align-items: center; min-width: 0; }
.pwb .muted { color: var(--pwb-muted); font-size: 12px; }
.pwb .spacer { flex: 1; }
.pwb .card { background: var(--pwb-card); border: 1px solid var(--pwb-border); border-radius: var(--pwb-radius-lg); padding: 13px 14px; }
.pwb h3 { margin: 2px 0 10px; font-size: 14.5px; font-weight: 600; letter-spacing: -.01em; }
.pwb .pwb-ic { flex-shrink: 0; }
.pwb .empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 26px 10px; color: var(--pwb-muted); font-size: 12.5px; text-align: center; }
.pwb .empty .pwb-ic { color: var(--pwb-faint); }

/* ---------- 待办 ---------- */
.pwb .kanban { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-top: 12px; align-items: start; }
.pwb .kcol { background: var(--pwb-panel); border-radius: var(--pwb-radius-lg); padding: 12px; min-width: 0; }
.pwb .kcol h4 { display: flex; align-items: center; gap: 6px; margin: 2px 2px 10px; font-size: 12.5px; font-weight: 600; }
.pwb .kcol h4 .count { font-weight: 600; opacity: .75; font-variant-numeric: tabular-nums; }
.pwb .kcol h4.c-overdue { color: var(--pwb-bad-fg); }
.pwb .kcol h4.c-active { color: var(--pwb-accent); }
.pwb .kcol h4.c-done { color: var(--pwb-ok-fg); }
.pwb .kitem { display: flex; gap: 9px; align-items: flex-start; background: var(--pwb-card); border: 1px solid var(--pwb-border);
  border-radius: 10px; padding: 9px 11px; margin-bottom: 7px; transition: box-shadow .18s; }
.pwb .kitem:hover { box-shadow: var(--pwb-shadow-sm); }
.pwb .kitem input[type="checkbox"] { margin-top: 2px; }
.pwb .kitem .txt { flex: 1; word-break: break-all; min-width: 0; }
.pwb .kitem.done .txt { color: var(--pwb-muted); text-decoration: line-through; }
.pwb .tag { display: inline-flex; background: var(--pwb-tag-bg); color: var(--pwb-tag-fg); border-radius: 5px; padding: 0 6px;
  margin-left: 5px; font-size: 11px; font-weight: 500; line-height: 17px; white-space: nowrap; }
.pwb .due { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; color: var(--pwb-muted); margin-left: 7px;
  font-variant-numeric: tabular-nums; white-space: nowrap; }
.pwb .due.overdue { color: var(--pwb-bad-fg); font-weight: 500; }
.pwb .due.today { color: var(--pwb-warn); font-weight: 500; }
.pwb .bar { height: 6px; background: var(--pwb-chip); border-radius: 999px; overflow: hidden; margin-top: 8px; }
.pwb .bar i { display: block; height: 100%; background: var(--pwb-accent); border-radius: 999px; transition: width .3s ease; }
.pwb .track-item { display: flex; align-items: center; gap: 7px; padding: 3px 0; font-size: 12.5px; min-width: 0; }
.pwb .track-item .t { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pwb .tdot { width: 5px; height: 5px; border-radius: 50%; background: var(--pwb-faint); flex-shrink: 0; }

/* ---------- 日历 ---------- */
.pwb .calwrap { display: grid; grid-template-columns: 290px 1fr; gap: 12px; margin-top: 12px; align-items: start; }
@media (max-width: 900px) { .pwb .calwrap { grid-template-columns: 1fr; } }
.pwb .calhead { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; }
.pwb .calhead b { font-size: 14px; font-weight: 600; letter-spacing: -.01em; font-variant-numeric: tabular-nums; }
.pwb .calnav { border: none; background: transparent; color: var(--pwb-muted); padding: 0; width: 26px; height: 26px;
  border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.pwb .calnav:hover { background: var(--pwb-hover); color: var(--pwb-text); }
.pwb .calgrid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.pwb .calwd { text-align: center; color: var(--pwb-faint); font-size: 11.5px; padding: 2px 0 6px; }
.pwb .calcell { position: relative; min-height: 80px; background: var(--pwb-card); border: 1px solid var(--pwb-border); border-radius: 10px;
  padding: 5px 6px; cursor: pointer; display: flex; flex-direction: column; gap: 3px; overflow: hidden;
  transition: border-color .15s, box-shadow .15s; }
.pwb .calcell:hover { border-color: var(--pwb-border-strong); }
.pwb .calcell .cal-add { position: absolute; top: 4px; right: 4px; width: 17px; height: 17px; padding: 0; border-radius: 5px;
  border: none; background: var(--pwb-chip); color: var(--pwb-muted); display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer; opacity: .4; transition: opacity .15s, background .15s, color .15s; }
.pwb .calcell:hover .cal-add, .pwb .calcell .cal-add:focus { opacity: 1; }
.pwb .calcell .cal-add:hover { background: var(--pwb-accent); color: var(--pwb-on-accent); }
.pwb .calcell.dragover { border-color: var(--pwb-accent); box-shadow: 0 0 0 2px var(--pwb-ring); }
.pwb .calcell.dim { opacity: .45; }
.pwb .calcell.sel { border-color: var(--pwb-accent); box-shadow: 0 0 0 2px var(--pwb-ring); }
.pwb .calnum { font-size: 12px; color: var(--pwb-muted); width: 20px; height: 20px; display: inline-flex; align-items: center;
  justify-content: center; font-variant-numeric: tabular-nums; border-radius: 999px; }
.pwb .calcell.today .calnum { background: var(--pwb-accent); color: var(--pwb-on-accent); font-weight: 600; }
.pwb .calchip { font-size: 11px; font-weight: 500; border-radius: 6px; padding: 1px 6px; background: var(--pwb-tag-bg);
  color: var(--pwb-tag-fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: grab; }
.pwb .calchip.done { opacity: .5; text-decoration: line-through; cursor: default; }
.pwb .calchip.overdue { background: var(--pwb-bad-bg); color: var(--pwb-bad-fg); }
.pwb .callegend { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin: 0 0 8px; color: var(--pwb-muted); font-size: 12px; }
.pwb .caldetail { margin-top: 10px; border-top: 1px solid var(--pwb-border); padding-top: 9px; }

/* ---------- 芯片 / 徽章 ---------- */
.pwb .chip, .pwb .nav-chip { display: inline-flex; align-items: center; gap: 4px; padding: 0 11px; height: 26px; border-radius: 999px;
  background: var(--pwb-chip); border: 1px solid transparent; cursor: pointer; font-size: 12px; font-weight: 500;
  color: var(--pwb-muted); transition: background .15s, color .15s; white-space: nowrap; flex-shrink: 0; }
.pwb .chip:hover, .pwb .nav-chip:hover { color: var(--pwb-text); background: var(--pwb-hover); }
.pwb .chip.on, .pwb .nav-chip.on { background: var(--pwb-tag-bg); color: var(--pwb-accent); }
.pwb .nav-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.pwb .badge { display: inline-flex; align-items: center; font-size: 11px; font-weight: 500; border-radius: 999px; padding: 1px 8px;
  margin-left: 6px; background: var(--pwb-chip); color: var(--pwb-muted); white-space: nowrap; flex-shrink: 0;
  font-variant-numeric: tabular-nums; }
.pwb .badge.up { background: var(--pwb-ok-bg); color: var(--pwb-ok-fg); }
.pwb .badge.down { background: var(--pwb-bad-bg); color: var(--pwb-bad-fg); }
.pwb .badge.exp { cursor: pointer; }

/* ---------- 导航 / 应用卡片 ---------- */
.pwb .linkgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(158px, 1fr)); gap: 8px; }
.pwb .linkcard { display: flex; align-items: center; gap: 8px; background: var(--pwb-card); border: 1px solid var(--pwb-border);
  border-radius: var(--pwb-radius-md); padding: 8px 10px; cursor: pointer; min-width: 0;
  transition: box-shadow .18s, transform .18s, border-color .18s; }
.pwb .linkcard:hover { border-color: var(--pwb-border-strong); box-shadow: var(--pwb-shadow-sm); transform: translateY(-1px); }
.pwb .linkcard:active { transform: translateY(0) scale(.985); }
.pwb .linkcard .ico { width: 20px; height: 20px; border-radius: 6px; flex-shrink: 0; background: var(--pwb-chip); }
.pwb .linkcard .t { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; font-weight: 500; }
.pwb .linkcard .badge { flex-shrink: 0; margin-left: 4px; }
.pwb .linkcard .x { visibility: hidden; }
.pwb .linkcard:hover .x { visibility: visible; }
.pwb .linkcard.dead { border-color: var(--pwb-bad-fg); }
.pwb .appsec { margin: 16px 2px 8px; font-size: 12.5px; font-weight: 600; display: flex; align-items: center; gap: 5px; }
.pwb .appsec:first-child { margin-top: 4px; }
.pwb .appsec .muted { font-weight: 400; font-variant-numeric: tabular-nums; }
.pwb .appsec .pwb-ic { color: var(--pwb-accent); }
.pwb .appsec + .assetgrid, .pwb .appsec + .linkgrid, .pwb .appsec + .appgrid { margin-top: 2px; }
.pwb .appgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(168px, 1fr)); gap: 8px; }
.pwb .appcard { display: flex; align-items: center; gap: 10px; background: var(--pwb-card); border: 1px solid var(--pwb-border);
  border-radius: var(--pwb-radius-md); padding: 9px 10px; cursor: pointer; min-width: 0; user-select: none;
  transition: box-shadow .18s, transform .18s, border-color .18s; }
.pwb .appcard:hover { border-color: var(--pwb-border-strong); box-shadow: var(--pwb-shadow-sm); transform: translateY(-1px); }
.pwb .appcard:active { transform: translateY(0) scale(.985); }
.pwb .appcard .ico { width: 28px; height: 28px; border-radius: 7px; flex-shrink: 0; background: var(--pwb-chip); object-fit: contain; }
.pwb .appcard .t { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; font-weight: 500; }
.pwb .appcard .pin { visibility: hidden; border: none; background: transparent; padding: 2px; color: var(--pwb-faint);
  border-radius: 6px; display: inline-flex; cursor: pointer; }
.pwb .appcard .pin:hover { color: var(--pwb-accent); background: var(--pwb-hover); }
.pwb .appcard:hover .pin, .pwb .appcard.pinned .pin { visibility: visible; }
.pwb .appcard.pinned .pin { color: var(--pwb-accent); }
.pwb .appcard.missing { opacity: .6; }
.pwb .appcard.missing .t { text-decoration: line-through; }
.pwb .appcard.busy { opacity: .55; pointer-events: none; }

/* ---------- 资产 ---------- */
.pwb .assetgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(258px, 1fr)); gap: 10px; margin-top: 12px; }
/* 资产卡固定尺寸：长名称省略号截断，详情（凭据/链接/备注）点击卡片弹窗查看 */
.pwb .acard { display: flex; flex-direction: column; background: var(--pwb-card); border: 1px solid var(--pwb-border); border-radius: var(--pwb-radius-lg);
  padding: 12px 13px; position: relative; height: 96px; overflow: hidden; cursor: pointer; transition: box-shadow .18s, border-color .18s; }
.pwb .acard:hover { border-color: var(--pwb-border-strong); box-shadow: var(--pwb-shadow-sm); }
.pwb .appsec .ibtn { visibility: hidden; margin-left: auto; }
.pwb .appsec:hover .ibtn { visibility: visible; }
.pwb .acard .name { flex: 1; min-width: 0; font-weight: 600; letter-spacing: -.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pwb .acard .card-actions { position: absolute; right: 7px; bottom: 7px; display: flex; gap: 2px; opacity: 0; transition: opacity .15s;
  background: var(--pwb-card); border-radius: 8px; padding: 2px; z-index: 2; }
.pwb .acard:hover .card-actions { opacity: 1; }
.pwb .a-line { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: var(--pwb-muted); font-variant-numeric: tabular-nums; }
.pwb .alink { display: inline-flex; align-items: center; gap: 4px; max-width: 100%; font-size: 12px; font-weight: 500;
  height: 24px; padding: 0 10px; border-radius: 999px; cursor: pointer; background: var(--pwb-tag-bg); color: var(--pwb-accent);
  border: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-decoration: none;
  transition: box-shadow .15s; }
.pwb .alink:hover { box-shadow: var(--pwb-shadow-sm); }
.pwb .cred { margin-top: 9px; border-top: 1px solid var(--pwb-border); padding-top: 9px; font-size: 12px; display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
.pwb .cred .sec { font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; font-size: 11.5px; background: var(--pwb-chip);
  border-radius: 6px; padding: 2px 7px; word-break: break-all; color: var(--pwb-text); user-select: all; }
.pwb .field { display: grid; grid-template-columns: 64px 1fr; gap: 10px; align-items: center; margin-bottom: 10px; }
.pwb .field label { color: var(--pwb-muted); font-size: 12.5px; text-align: right; }
.pwb .field input, .pwb .field select, .pwb .field textarea { width: 100%; }

/* ---------- 弹层 / 提示 ---------- */
.pwb-conn { position: fixed; top: 52px; left: 50%; transform: translateX(-50%); z-index: 30; display: flex; align-items: center; gap: 7px;
  background: var(--pwb-bad-bg); color: var(--pwb-bad-fg); border: 1px solid var(--pwb-bad-fg); border-radius: 999px;
  padding: 5px 14px; font-size: 12.5px; font-weight: 500; box-shadow: var(--pwb-shadow-md); animation: pwbFade .2s ease; }
.pwb-conn .pwb-ic { animation: pwbSpin 1.2s linear infinite; }
.pwb-modal-bg { position: fixed; inset: 0; background: var(--pwb-overlay); z-index: 50; display: flex; align-items: center;
  justify-content: center; backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); animation: pwbFade .18s ease; }
.pwb-modal { width: min(440px, 92%); background: var(--pwb-card); border: 1px solid var(--pwb-border); border-radius: 16px;
  padding: 16px 18px; box-shadow: var(--pwb-shadow-pop); animation: pwbPop .22s cubic-bezier(.32,.72,.35,1); max-height: 86vh; overflow: auto; }
.pwb-modal.wide { width: min(500px, 94%); }
.pwb-modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.pwb-modal-head h3 { margin: 0; }
.pwb-dlg-msg { color: var(--pwb-muted); margin-bottom: 10px; white-space: pre-line; }
.pwb-toast { position: fixed; right: 20px; bottom: 20px; display: flex; align-items: center; gap: 8px;
  background: var(--pwb-topbar); backdrop-filter: blur(20px) saturate(1.8); -webkit-backdrop-filter: blur(20px) saturate(1.8);
  border: 1px solid var(--pwb-border); color: var(--pwb-text); border-radius: 12px; padding: 10px 14px; z-index: 60;
  max-width: 380px; box-shadow: var(--pwb-shadow-md); font-weight: 500; animation: pwbToastIn .25s cubic-bezier(.3,.8,.35,1); }
.pwb-toast > .pwb-ic { color: var(--pwb-ok-fg); }
.pwb-toast.err { border-color: var(--pwb-bad-fg); }
.pwb-toast.err > .pwb-ic { color: var(--pwb-bad-fg); }

/* ---------- 速记 / 密钥 ---------- */
.pwb .note-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 10px; margin-top: 12px; align-items: start; }
.pwb .note-card { position: relative; height: 172px; display: flex; flex-direction: column; }
.pwb .note-card.editing { height: auto; min-height: 172px; }
.pwb .note-time { font-size: 11px; color: var(--pwb-faint); font-variant-numeric: tabular-nums; flex-shrink: 0; }
.pwb .note-body { flex: 1; overflow: hidden; margin-top: 4px; }
.pwb .note-card:hover { box-shadow: var(--pwb-shadow-sm); }
.pwb .note-card .card-actions { position: absolute; top: 8px; right: 8px; display: flex; gap: 2px; opacity: 0; transition: opacity .15s;
  background: var(--pwb-card); border-radius: 8px; padding: 2px; z-index: 2; }
.pwb .note-card:hover .card-actions { opacity: 1; }
.pwb .note-card.editing .card-actions { position: static; opacity: 1; margin-top: 8px; justify-content: flex-end; }
.pwb .note-title { font-weight: 600; font-size: 12.5px; letter-spacing: -.01em; font-variant-numeric: tabular-nums; }
.pwb .note-body { white-space: pre-wrap; word-break: break-word; font-size: 12.5px; }
.pwb .keylist { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
.pwb .kgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 10px; margin-top: 12px; align-items: start; }
.pwb .kcard { background: var(--pwb-card); border: 1px solid var(--pwb-border); border-radius: var(--pwb-radius-lg); padding: 12px 13px; min-width: 0; }
.pwb .kname { font-weight: 600; letter-spacing: -.01em; font-size: 13px; }
.pwb .kfield { display: flex; align-items: center; gap: 6px; padding: 3px 0; min-width: 0; font-size: 12.5px; }
.pwb .kfield .k { color: var(--pwb-muted); flex-shrink: 0; min-width: 56px; }
.pwb .kfield .v { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; font-size: 12px; }
.pwb .kfield .v.masked { letter-spacing: .06em; }
.pwb .kdoc-view { white-space: pre-wrap; word-break: break-word; font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; font-size: 12.5px; line-height: 1.6;
  background: var(--pwb-card); border: 1px solid var(--pwb-border); border-radius: var(--pwb-radius-lg); padding: 14px; min-height: 320px; }
.pwb .kraw { white-space: pre-wrap; word-break: break-word; font-size: 12px; color: var(--pwb-muted); background: var(--pwb-panel); border-radius: 8px; padding: 6px 9px; margin-top: 6px; }
/* 密钥文档卡固定尺寸（与速记卡同高），内容点开弹窗查看 */
.pwb .kdoc-card { position: relative; height: 172px; overflow: hidden; cursor: pointer; display: flex; flex-direction: column; }
.pwb .kdoc-card:hover { box-shadow: var(--pwb-shadow-sm); }
.pwb .kdoc-card .note-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pwb .kdoc-card .card-actions { position: absolute; top: 8px; right: 8px; display: flex; gap: 2px; opacity: 0; transition: opacity .15s;
  background: var(--pwb-card); border-radius: 8px; padding: 2px; z-index: 2; }
.pwb .kdoc-card:hover .card-actions { opacity: 1; }
.pwb .kdoc-preview { flex: 1; overflow: hidden; margin-top: 6px; color: var(--pwb-muted); font-size: 12.5px; line-height: 1.5;
  white-space: pre-wrap; word-break: break-word; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; }

/* ---------- 详情弹窗（资产 / 密钥文档卡片点开） ---------- */
.pwb .detail-kv { display: grid; grid-template-columns: auto 1fr; gap: 5px 14px; margin: 8px 0 2px; font-size: 12.5px; align-items: baseline; }
.pwb .detail-kv .k { color: var(--pwb-muted); white-space: nowrap; }
.pwb .detail-kv .v { min-width: 0; word-break: break-all; }
.pwb .detail-sec { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--pwb-border); }
.pwb .sec-title { display: flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 600; margin-bottom: 8px; }
.pwb .sec-title .pwb-ic { color: var(--pwb-accent); }
.pwb .cred-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 3px 0; min-width: 0; }

/* ---------- 新增卡片（资产/速记/密钥文档列表末尾的 ＋ 虚线卡） ---------- */
.pwb .addcard { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px;
  height: 108px; padding: 0; background: transparent; border: 1.5px dashed var(--pwb-border-strong);
  border-radius: var(--pwb-radius-lg); color: var(--pwb-faint); font-size: 12.5px; font-weight: 500; min-width: 0;
  cursor: pointer; transition: border-color .15s, color .15s, background .15s, transform .15s; }
.pwb .addcard:hover { border-color: var(--pwb-accent); color: var(--pwb-accent); background: var(--pwb-card); transform: translateY(-1px); }
.pwb .addcard:active { transform: none; }
.pwb .note-grid .addcard { height: 172px; }
/* 添加文档弹窗：「或」分隔线 */
.pwb .kd-or { display: flex; align-items: center; gap: 10px; margin: 14px 0; color: var(--pwb-faint); font-size: 12px; }
.pwb .kd-or::before, .pwb .kd-or::after { content: ""; flex: 1; height: 1px; background: var(--pwb-border); }

/* ---------- AI 双栏布局 ---------- */
.pwb.ai-page { display: flex; flex-direction: column; overflow: hidden; }
.pwb.ai-page .pwb-topbar { flex-shrink: 0; }
.pwb.ai-page .pwb-body { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; padding: 12px 16px 0; }
.pwb .ai-layout { flex: 1; min-height: 0; display: grid; grid-template-columns: 250px 1fr; gap: 14px; }
.pwb .ai-side { background: var(--pwb-card); border: 1px solid var(--pwb-border); border-radius: var(--pwb-radius-lg); padding: 10px; display: flex; flex-direction: column; gap: 6px; overflow-y: auto; }
.pwb .ai-sessions { display: flex; flex-direction: column; gap: 2px; overflow-y: auto; }
.pwb .ai-new { width: 100%; }
.pwb .ai-main { min-width: 0; display: flex; flex-direction: column; background: var(--pwb-card); border: 1px solid var(--pwb-border); border-radius: var(--pwb-radius-lg); overflow: hidden; }
.pwb .ai-msgs { flex: 1; min-height: 0; overflow-y: auto; padding: 16px 16px 8px; }
.pwb .ai-msgs-inner, .pwb .ai-input-inner { max-width: 780px; margin: 0 auto; width: 100%; }
.pwb .ai-input { flex-shrink: 0; border-top: 1px solid var(--pwb-border); background: var(--pwb-card); padding: 10px 16px 12px; }
.pwb .ai-input-box { max-width: 780px; margin: 0 auto; display: flex; flex-direction: column; gap: 6px; background: var(--pwb-panel); border: 1px solid var(--pwb-border); border-radius: 14px; padding: 10px 12px 8px; }
.pwb .ai-input-box:focus-within { border-color: var(--pwb-accent); }
.pwb .ai-input-box textarea { background: transparent; border: none; padding: 4px 6px; min-height: 72px; max-height: 180px; resize: none; }
.pwb .ai-input-actions { display: flex; justify-content: flex-end; align-items: center; gap: 6px; }
.pwb .ai-input-actions .ai-model-sel { max-width: 190px; font-size: 12px; background: transparent; border: none; padding: 0 2px; color: var(--pwb-muted); }
.pwb .ai-models-edit { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.pwb .ai-model-chip { display: inline-flex; align-items: center; gap: 4px; background: var(--pwb-chip); border-radius: 999px; padding: 2px 6px 2px 10px; font-size: 12px; }
.pwb .ai-model-add { flex: 1; min-width: 120px; font-size: 12px; }
.pwb .ai-send { padding: 0 14px; }
@media (max-width: 900px) { .pwb .ai-layout { grid-template-columns: 1fr; } .pwb .ai-side { max-height: 200px; } }
.pwb .ai-sessions { display: flex; flex-direction: column; gap: 2px; overflow-y: auto; max-height: 60vh; }
.pwb .ai-session { border-radius: 10px; padding: 8px 10px; cursor: pointer; display: flex; flex-direction: column; gap: 2px; border: 1px solid transparent; }
.pwb .ai-session:hover { background: var(--pwb-hover); }
.pwb .ai-session.on { background: var(--pwb-tag-bg); border-color: var(--pwb-border); }
.pwb .ai-session-title { display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pwb .ai-session-meta { display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: var(--pwb-faint); }
.pwb .ai-main { min-width: 0; }
.pwb .ai-cur-title { font-weight: 600; font-size: 13.5px; }
@media (max-width: 900px) { .pwb .ai-layout { grid-template-columns: 1fr; } .pwb .ai-sessions { max-height: 180px; } }

/* ---------- AI 确认卡 / 资产上下文 ---------- */
.pwb .ai-confirm { background: var(--pwb-bad-bg); border: 1px solid var(--pwb-bad-fg); border-radius: 10px; padding: 8px 10px; margin: 6px 0 4px; }
.pwb .ai-confirm-title { display: flex; align-items: center; gap: 5px; font-weight: 600; font-size: 12px; color: var(--pwb-bad-fg); margin-bottom: 4px; }
.pwb .ai-confirm-body { font-size: 12.5px; word-break: break-all; }
.pwb .ai-ctx { display: flex; align-items: center; gap: 7px; background: var(--pwb-tag-bg); color: var(--pwb-tag-fg); border-radius: 999px; padding: 4px 6px 4px 10px; font-size: 12px; font-weight: 500; margin-bottom: 10px; width: fit-content; max-width: 100%; }

/* ---------- 动效 ---------- */
@keyframes pwbFade { from { opacity: 0; } }
@keyframes pwbSpin { to { transform: rotate(360deg); } }
@keyframes pwbPop { from { opacity: 0; transform: scale(.96) translateY(4px); } }
@keyframes pwbToastIn { from { opacity: 0; transform: translateY(12px) scale(.97); } }
@keyframes pwbBodyIn { from { opacity: 0; transform: translateY(6px); } }
@media (prefers-reduced-motion: reduce) {
  .pwb *, .pwb *::before, .pwb *::after { animation: none !important; transition: none !important; }
}
`

/* ============ 通用组件 ============ */
// 弹层挂载点：portal 到 .pwb 根。顶栏的 backdrop-filter 会为 fixed 后代创建包含块，
// 弹层若留在顶栏内，全屏遮罩会被压缩成顶栏大小、点击穿透到下层卡片；挂到根节点同时保住 CSS 变量继承。
const portalTarget = () => document.querySelector(".pwb") || document.body

const Switch = ({ on, onChange }) => (
  <button type="button" role="switch" aria-checked={on} className={"pwb-switch" + (on ? " on" : "")}
    onClick={() => onChange(!on)}><span className="pwb-switch-knob" /></button>
)

const Empty = ({ icon = "dot", text, small }) => (
  <div className={"empty" + (small ? " small" : "")} style={small ? { flexDirection: "row", padding: "8px 4px", gap: 6, justifyContent: "flex-start" } : null}>
    <Icon name={icon} size={small ? 13 : 22} />
    <span>{esc(text)}</span>
  </div>
)

// 列表末尾的「＋ 新增」虚线卡：资产 / 速记 / 密钥文档三个面板共用，替代顶栏的大按钮
const AddCard = ({ label, onClick, disabled }) => (
  <button type="button" className="addcard" onClick={onClick} disabled={disabled} title={label}>
    <Icon name="plus" size={20} />
    <span>{esc(label)}</span>
  </button>
)

// 弹窗层叠登记：Esc 只关最上层（详情弹窗之上还会开确认框/编辑窗）
const MODAL_STACK = []
function Modal({ title, onClose, children, wide }) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const tok = Symbol()
    MODAL_STACK.push(tok)
    const h = (e) => { if (e.key === "Escape" && MODAL_STACK[MODAL_STACK.length - 1] === tok) closeRef.current() }
    window.addEventListener("keydown", h)
    return () => { const i = MODAL_STACK.indexOf(tok); if (i >= 0) MODAL_STACK.splice(i, 1); window.removeEventListener("keydown", h) }
  }, [])
  return createPortal(
    // 延迟到 click 派发后再卸载遮罩，避免 mousedown 关闭、click 落到下层元素造成误触
    <div className="pwb-modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) setTimeout(onClose, 0) }}>
      <div className={"pwb-modal" + (wide ? " wide" : "")} role="dialog" aria-modal="true" aria-label={title}>
        <div className="pwb-modal-head">
          <h3>{esc(title)}</h3>
          <button className="ibtn" aria-label="Close" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        {children}
      </div>
    </div>,
    portalTarget()
  )
}

// 替代原生 prompt/confirm 的对话框：Promise 风格，Esc 取消、Enter 确认。
// checkboxLabel 存在时渲染一个复选框，结果变为 { text, checked } 对象。
function Dialog({ dlg, onDone, t }) {
  const [val, setVal] = useState(dlg.initial ?? "")
  const [checked, setChecked] = useState(false)
  const inputRef = useRef(null)
  const okRef = useRef(null)
  useEffect(() => {
    const timer = setTimeout(() => {
      const el = dlg.kind === "prompt" ? inputRef.current : okRef.current
      if (el) { el.focus(); if (el === inputRef.current) el.select() }
    }, 40)
    return () => clearTimeout(timer)
  }, [dlg])
  const cancel = () => onDone(null)
  const submit = () => onDone(dlg.checkboxLabel ? { text: val, checked } : dlg.kind === "prompt" ? val : true)
  return (
    <Modal title={dlg.title} onClose={cancel}>
      {dlg.message ? <div className="pwb-dlg-msg">{esc(dlg.message)}</div> : null}
      {dlg.kind === "prompt" ? (
        <input ref={inputRef} style={{ width: "100%" }} type={dlg.inputType || "text"} value={val} placeholder={dlg.placeholder || ""}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit() }} />
      ) : null}
      {dlg.checkboxLabel ? (
        <label className="row" style={{ gap: 7, marginTop: 10, cursor: "pointer", fontSize: 12.5 }}>
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>{esc(dlg.checkboxLabel)}</span>
        </label>
      ) : null}
      <div className="row" style={{ justifyContent: "flex-end", marginTop: 14 }}>
        <button onClick={cancel}>{t("cancel")}</button>
        <button ref={okRef} className={dlg.danger ? "danger" : "primary"} onClick={submit}>{dlg.okText || t("ok")}</button>
      </div>
    </Modal>
  )
}

/* ============ 待办面板（默认日历视图） ============ */
function TodoPane({ toast, ask, t, lang }) {
  const [raw, setRaw] = useState("")
  const [hash, setHash] = useState("")
  const [path, setPath] = useState("")
  const [input, setInput] = useState("")
  const [view, setView] = useState("cal")
  const [calMode, setCalMode] = useState("month")
  const [calAnchor, setCalAnchor] = useState(() => today())
  const [selDate, setSelDate] = useState(() => today())
  const [scope, setScope] = useState("month")
  // 钉钉习惯：已完成任务默认保留在日历上（划线标记），可用开关隐藏
  const [showDone, setShowDone] = useState(() => { try { return localStorage.getItem("pwb_todo_done") !== "0" } catch { return true } })
  const setShowDoneKeep = (v) => { setShowDone(v); try { localStorage.setItem("pwb_todo_done", v ? "1" : "0") } catch {} }
  const MONTHS = t("months").split(",")
  const load = useCallback(async () => {
    const d = await api("/todo")
    setRaw(d.text); setPath(d.path); setHash(d.hash)
  }, [])
  useEffect(() => { load().catch((e) => toast(e.message, true)) }, [load, toast])
  const items = useMemo(() => parseTodos(raw), [raw])
  // 与 Obsidian 共写一份 Markdown：每次保存带上加载时的哈希，外部改动过就 409 并自动加载最新内容。
  const putTodo = async (text) => {
    try {
      const d = await api("/todo", { method: "PUT", body: JSON.stringify({ text, baseHash: hash }) })
      setHash(d.hash)
      return true
    } catch (e) {
      if (e.currentText !== undefined) {
        setRaw(e.currentText); setHash(e.currentHash)
        toast(t("conflict_todo"), true)
      } else toast(e.message, true)
      return false
    }
  }
  const save = async (next) => {
    const text = serializeTodos(next, raw)
    setRaw(text)
    await putTodo(text)
  }
  const add = () => {
    const v = input.trim()
    if (!v) return
    const due = (v.match(/@(\d{4}-\d{2}-\d{2})/) || [])[1] || null
    const tags = [...v.matchAll(/#([^\s#@]+)/g)].map((x) => x[1])
    const text = v.replace(/@(\d{4}-\d{2}-\d{2})/g, "").replace(/#([^\s#@]+)/g, "").trim()
    save([...items, { line: -1, done: false, text, tags, due }])
    setInput("")
  }
  const toggle = (line, done) => save(items.map((it) => (it.line === line ? { ...it, done } : it)))
  const del = (line) => {
    const lines = raw.split(/\r?\n/)
    lines.splice(line, 1)
    const text = lines.join("\n")
    setRaw(text)
    putTodo(text)
  }
  const open = items.filter((x) => !x.done)
  const overdue = open.filter((x) => x.due && x.due < today())
  const active = open.filter((x) => !(x.due && x.due < today()))
  const done = items.filter((x) => x.done)
  const byTag = new Map()
  for (const x of items) for (const tg of x.tags.length ? x.tags : [t("untagged")]) {
    if (!byTag.has(tg)) byTag.set(tg, [])
    byTag.get(tg).push(x)
  }
  const dueCls = (d) => (d ? (d < today() ? " overdue" : d === today() ? " today" : "") : "")
  /* ---------- 日历视图（月/周、拖拽改期、范围筛选、选中日明细） ---------- */
  const t0 = today()
  const wk0 = isoOf(mondayOf(new Date()))
  const wk1 = isoOf(addDays(fromISO(wk0), 6))
  const monPrefix = t0.slice(0, 7)
  const scopeMatch = (x, key) =>
    key === "all" ? true : Boolean(x.due) && (key === "today" ? x.due === t0 : key === "week" ? x.due >= wk0 && x.due <= wk1 : x.due.startsWith(monPrefix))
  const scopeCount = (key) => items.filter((x) => !x.done && scopeMatch(x, key)).length
  const scopeList = items.filter((x) => scopeMatch(x, scope) && (showDone || !x.done))
  const anchor = fromISO(calAnchor)
  let calTitle, calCells
  if (calMode === "month") {
    calTitle = lang === "en" ? `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}` : `${anchor.getFullYear()} 年 ${anchor.getMonth() + 1} 月`
    const start = mondayOf(new Date(anchor.getFullYear(), anchor.getMonth(), 1))
    calCells = Array.from({ length: 42 }, (_, i) => addDays(start, i))
  } else {
    const start = mondayOf(anchor)
    calCells = Array.from({ length: 7 }, (_, i) => addDays(start, i))
    calTitle = `${isoOf(start)} ~ ${isoOf(addDays(start, 6))}`
  }
  const navCal = (dir) => {
    const a = fromISO(calAnchor)
    if (calMode === "month") setCalAnchor(isoOf(new Date(a.getFullYear(), a.getMonth() + dir, 1)))
    else setCalAnchor(isoOf(addDays(a, dir * 7)))
  }
  const reschedule = (line, due) => save(items.map((it) => (it.line === line ? { ...it, due } : it)))
  const addOn = async (due) => {
    const v = await ask.prompt({ title: t("add_todo_title"), message: t("falls_on", { due }), placeholder: t("todo_ph_short") })
    if (!v || !v.trim()) return
    const tags = [...v.matchAll(/#([^\s#@]+)/g)].map((x) => x[1])
    save([...items, { line: -1, done: false, text: v.replace(/#([^\s#@]+)/g, "").trim(), tags, due }])
  }
  const selItems = items.filter((x) => x.due === selDate && (showDone || !x.done))
  const selTitle = (() => {
    const [y, m, d] = selDate.split("-")
    return lang === "en" ? `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}` : `${y} 年 ${Number(m)} 月 ${Number(d)} 日`
  })()
  const item = (x) => (
    <div key={x.line} className={"kitem" + (x.done ? " done" : "")}>
      <input type="checkbox" checked={x.done} onChange={(e) => toggle(x.line, e.target.checked)} />
      <div className="txt">
        {esc(x.text)}
        {x.tags.map((tg) => <span key={tg} className="tag">#{esc(tg)}</span>)}
        {x.due ? <span className={"due" + dueCls(x.due)}><Icon name="clock" size={11} />{x.due}</span> : null}
      </div>
      <button className="ibtn sm" title={t("del")} onClick={() => del(x.line)}><Icon name="x" size={12} /></button>
    </div>
  )
  return (
    <div>
      <div className="card">
        <div className="row" style={{ flexWrap: "wrap" }}>
          <input style={{ flex: 1, minWidth: 200 }} placeholder={t("todo_ph")}
            value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add() }} />
          <button className="primary" onClick={add}><Icon name="plus" size={14} />{t("add")}</button>
          <div className="pwb-seg mini">
            {[["board", t("view_board")], ["cal", t("view_cal")], ["track", t("view_track")]].map(([v, l]) => (
              <button key={v} className={view === v ? "on" : ""} onClick={() => setView(v)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="muted" style={{ marginTop: 7, display: "flex", alignItems: "center", gap: 5 }}>
          <Icon name="folder" size={12} />{t("stored_at", { path })}
        </div>
      </div>
      {view === "board" ? (
        <div className="kanban">
          <div className="kcol">
            <h4 className="c-overdue"><Icon name="clock" size={13} />{t("overdue")} <span className="count">{overdue.length}</span></h4>
            {overdue.length ? overdue.map(item) : <Empty small icon="checkCircle" text={t("no_overdue")} />}
          </div>
          <div className="kcol">
            <h4 className="c-active"><Icon name="flame" size={13} />{t("inprog")} <span className="count">{active.length}</span></h4>
            {active.length ? active.map(item) : <Empty small icon="dot" text={t("no_inprog")} />}
          </div>
          <div className="kcol">
            <h4 className="c-done"><Icon name="checkCircle" size={13} />{t("done")} <span className="count">{done.length}</span></h4>
            {done.length ? done.slice(-30).reverse().map(item) : <Empty small icon="dot" text={t("no_done")} />}
          </div>
        </div>
      ) : view === "cal" ? (
        <div className="calwrap">
          <div className="card">
            <div className="nav-chips">
              {[["today", t("scope_today")], ["week", t("scope_week")], ["month", t("scope_month")], ["all", t("all")]].map(([key, label]) => (
                <span key={key} className={"chip" + (scope === key ? " on" : "")} onClick={() => setScope(key)}>
                  {label} {scopeCount(key)}
                </span>
              ))}
            </div>
            <div className="row" style={{ margin: "2px 0 10px", gap: 8 }}>
              <Switch on={showDone} onChange={setShowDoneKeep} />
              <span className="muted">{t("show_done")}</span>
            </div>
            {scopeList.length ? scopeList.map(item) : <Empty icon="calendar" text={t("none_in_range")} />}
          </div>
          <div className="card">
            <div className="calhead">
              <button className="calnav" title={t("prev")} onClick={() => navCal(-1)}><Icon name="chevronLeft" size={15} /></button>
              <b>{calTitle}</b>
              <button className="calnav" title={t("next")} onClick={() => navCal(1)}><Icon name="chevronRight" size={15} /></button>
              <button className="mini" onClick={() => { setCalAnchor(today()); setSelDate(today()) }}>{t("scope_today")}</button>
              <div className="spacer" />
              <div className="pwb-seg mini">
                <button className={calMode === "month" ? "on" : ""} onClick={() => setCalMode("month")}>{t("seg_month")}</button>
                <button className={calMode === "week" ? "on" : ""} onClick={() => setCalMode("week")}>{t("seg_week")}</button>
              </div>
            </div>
            <div className="callegend">
              <span className="calchip">{t("legend_open")}</span>{t("legend_drag")}
              <span className="calchip overdue">{t("legend_overdue")}</span>
              <span className="calchip done">{t("legend_done")}</span>{t("legend_done_note")}
            </div>
            <div className="calgrid">
              {t("weekdays").split(",").map((w) => <div key={w} className="calwd">{w}</div>)}
              {calCells.map((d) => {
                const iso = isoOf(d)
                const dayItems = items.filter((x) => x.due === iso && (showDone || !x.done))
                const cls = "calcell" + (iso === t0 ? " today" : "") + (calMode === "month" && iso.slice(0, 7) !== calAnchor.slice(0, 7) ? " dim" : "") + (iso === selDate ? " sel" : "")
                return (
                  <div key={iso} className={cls} title={`${iso} · ${t("click_select")}`}
                    onClick={() => setSelDate(iso)}
                    onDragOver={(e) => e.preventDefault()}
                    onDragEnter={(e) => e.currentTarget.classList.add("dragover")}
                    onDragLeave={(e) => e.currentTarget.classList.remove("dragover")}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.currentTarget.classList.remove("dragover")
                      const line = Number(e.dataTransfer.getData("text/pwb-line"))
                      if (line >= 0) reschedule(line, iso)
                    }}>
                    <span className="calnum">{d.getDate()}</span>
                    <button className="cal-add" title={t("cal_add_tip")}
                      onClick={(e) => { e.stopPropagation(); addOn(iso) }}>
                      <Icon name="plus" size={11} />
                    </button>
                    {dayItems.map((x) => (
                      <span key={x.line} className={"calchip" + (x.done ? " done" : x.due < t0 ? " overdue" : "")}
                        draggable={!x.done}
                        title={t(x.done ? "chip_title_done" : "chip_title", { text: x.text })}
                        onDragStart={(e) => e.dataTransfer.setData("text/pwb-line", String(x.line))}
                        onClick={(e) => { e.stopPropagation(); toggle(x.line, !x.done) }}>
                        {x.done ? "✓ " : ""}{esc(x.text)}
                      </span>
                    ))}
                  </div>
                )
              })}
            </div>
            <div className="caldetail">
              <div className="row">
                <b>{selTitle}</b>
                <span className="muted">{t("n_items", { n: selItems.length })}</span>
                <div className="spacer" />
                <button className="mini" onClick={() => addOn(selDate)}><Icon name="plus" size={12} />{t("add_todo")}</button>
              </div>
              {selItems.length ? selItems.map(item) : <Empty small icon="dot" text={t("none_this_day")} />}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 12, alignItems: "start" }}>
          {[...byTag.entries()].map(([tag, list]) => {
            const dn = list.filter((x) => x.done).length
            const pct = list.length ? Math.round((dn / list.length) * 100) : 0
            const od = list.filter((x) => !x.done && x.due && x.due < today()).length
            const open5 = list.filter((x) => !x.done).slice(0, 5)
            return (
              <div key={tag} className="card">
                <div className="row">
                  <b>{esc(tag)}</b> <span className="muted">{dn}/{list.length}</span>
                  {od ? <span className="due overdue">{t("n_overdue", { n: od })}</span> : null}
                </div>
                <div className="bar"><i style={{ width: pct + "%" }} /></div>
                <div style={{ marginTop: 8 }}>
                  {open5.map((x) => (
                    <div key={x.line} className="track-item">
                      <span className="tdot" />
                      <span className="t">{esc(x.text)}{x.due ? <span className={"due" + dueCls(x.due)}>{x.due}</span> : null}</span>
                    </div>
                  ))}
                  {!open5.length ? (
                    <div className="row" style={{ gap: 5, color: "var(--pwb-ok-fg)", fontSize: 12.5 }}>
                      <Icon name="check" size={13} />{t("all_done")}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
          {!byTag.size ? <Empty icon="calendar" text={t("no_todos_yet")} /> : null}
        </div>
      )}
    </div>
  )
}

/* ============ 导航面板 ============ */
function NavPane({ toast, ask, t }) {
  const [nav, setNav] = useState(null)
  const [navHash, setNavHash] = useState("")
  const [cur, setCur] = useState(-1)
  const [adding, setAdding] = useState(false)
  const [checking, setChecking] = useState(false)
  const [linkCheck, setLinkCheck] = useState(null)
  const [form, setForm] = useState({ title: "", url: "", cat: 0 })
  const load = useCallback(async () => {
    const d = await api("/nav")
    setNavHash(d.hash)
    setNav(d.nav?.categories?.length ? d.nav : { categories: [] })
  }, [])
  useEffect(() => { load().catch((e) => toast(e.message, true)) }, [load, toast])
  // 与 Obsidian 共写 导航.md：保存带哈希，外部改动过就 409 并自动加载最新内容。
  const persist = async (next) => {
    setNav(next)
    try {
      const d = await api("/nav", { method: "PUT", body: JSON.stringify({ nav: next, baseHash: navHash }) })
      setNavHash(d.hash)
    } catch (e) {
      if (e.currentNav !== undefined) {
        setNavHash(e.currentHash)
        setNav(e.currentNav?.categories?.length ? e.currentNav : { categories: [] })
        toast(t("conflict_nav"), true)
      } else toast(e.message, true)
    }
  }
  if (!nav) return <div className="muted">…</div>
  const cats = nav.categories
  const viewingAll = cur === -1
  const active = cats[cur] ?? null
  // 「全部」视图：按分类分组平铺（组头带计数）；删除按各自所属分类定位
  const allCount = cats.reduce((n, c) => n + (c.links?.length ?? 0), 0)
  const openLink = (url) => { try { window.open(url, "_blank", "noopener") } catch { location.href = url } }
  const addCat = async () => {
    const name = await ask.prompt({ title: t("new_cat_title"), placeholder: t("cat_ph") })
    if (!name || !name.trim()) return
    persist({ categories: [...cats, { id: rid(), name: name.trim(), links: [] }] })
  }
  const delCat = async (i) => {
    const ok = await ask.confirm({
      title: t("del_cat_title"), danger: true, okText: t("ok_del"),
      message: t("del_cat_msg", { name: cats[i].name, n: cats[i].links?.length ?? 0 })
    })
    if (!ok) return
    const next = { categories: cats.filter((_, j) => j !== i) }
    setCur(0)
    persist(next)
  }
  const addLink = () => {
    if (!form.title.trim() || !form.url.trim()) return
    let url = form.url.trim()
    if (!/^https?:\/\//i.test(url)) url = "https://" + url
    const next = { categories: cats.map((c, i) => i === form.cat ? { ...c, links: [...(c.links ?? []), { id: rid(), title: form.title.trim(), url }] } : c) }
    setAdding(false)
    setForm({ title: "", url: "", cat: form.cat })
    persist(next)
  }
  const delLink = (ci, li) => {
    persist({ categories: cats.map((c, i) => i === ci ? { ...c, links: (c.links ?? []).filter((_, j) => j !== li) } : c) })
  }
  // 导出为 Netscape 书签 HTML：Edge / Chrome / Firefox 的书签管理器可直接导入（分类 = 文件夹）
  const exportHtml = () => {
    const escH = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    const now = Math.floor(Date.now() / 1000)
    let body = ""
    for (const c of cats) {
      body += `\t<DT><H3 ADD_DATE="${now}" LAST_MODIFIED="${now}">${escH(c.name)}</H3>\n\t<DL><p>\n`
      for (const l of c.links ?? []) body += `\t\t<DT><A HREF="${escH(l.url)}" ADD_DATE="${now}">${escH(l.title || l.url)}</A>\n`
      body += `\t</DL><p>\n`
    }
    const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<!-- This is an automatically generated file.\n     It will be read and overwritten.\n     DO NOT EDIT! -->\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n${body}</DL><p>\n`
    const blob = new Blob([html], { type: "text/html;charset=utf-8" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `书签导出_${today()}.html`
    a.click()
    URL.revokeObjectURL(a.href)
    toast(t("exported", { cats: cats.length, links: allCount }))
  }

  // 导入 Netscape 书签 HTML（浏览器导出的书签文件）：追加合并——重名分类归并、按 URL 去重，
  // 不覆盖现有数据；书签栏/其他书签等容器文件夹自动下钻，深层子文件夹以「父/子」命名为分类。
  const importHtml = () => {
    const inp = document.createElement("input")
    inp.type = "file"
    inp.accept = ".html,.htm,text/html"
    inp.onchange = async () => {
      try {
        const text = await inp.files[0].text()
        const doc = new DOMParser().parseFromString(text, "text/html")
        const rootDl = doc.querySelector("body dl") || doc.querySelector("dl")
        if (!rootDl) throw new Error(t("err_no_dl"))
        // 浏览器导出结构里的容器层（书签栏/其他书签等），导入时自动下钻、不单独成为分类
        const TRANSPARENT = /^(书签栏|书签菜单|收藏夹栏|其他书签|其他收藏夹|移动设备书签|bookmarks?( bar)?|favorites( bar)?|mobile bookmarks|imported.*|已导入.*)$/i
        const out = { cats: new Map(), order: [] }
        // Netscape HTML 的嵌套 DL 可能写在 <DT><H3> 的下个兄弟节点，也可能在 DT 内部，两种都要认
        const walk = (dl, bucket, childPrefix, depth) => {
          if (!out.cats.has(bucket)) { out.cats.set(bucket, []); out.order.push(bucket) }
          const curBucket = out.cats.get(bucket)
          const children = [...dl.children]
          for (let i = 0; i < children.length; i++) {
            const el = children[i]
            if (el.tagName !== "DT") continue
            const h3 = el.querySelector(":scope > h3")
            const a = el.querySelector(":scope > a")
            let nested = el.querySelector(":scope > dl")
            if (!nested) {
              for (let j = i + 1; j < children.length; j++) {
                if (children[j].tagName === "DL") { nested = children[j]; i = j; break }
                if (children[j].tagName === "DT") break
              }
            }
            if (h3 && nested) {
              const name = (h3.textContent || "").trim() || "Untitled"
              if (depth === 0 && TRANSPARENT.test(name)) walk(nested, name, childPrefix, depth)
              else { const full = childPrefix + name; walk(nested, full, full + "/", depth + 1) }
            } else if (a) {
              const url = a.getAttribute("href") || ""
              if (/^https?:/i.test(url)) curBucket.push({ url, title: ((a.textContent || "").trim() || url).slice(0, 200) })
            }
          }
        }
        walk(rootDl, "导入书签", "", 0)
        const imported = out.order.map((name) => ({ name, links: out.cats.get(name) })).filter((c) => c.links.length)
        if (!imported.length) throw new Error(t("err_no_links"))
        const urlKey = (u) => u.replace(/\/+$/, "").replace(/^https?:\/\//i, "").toLowerCase()
        const next = { categories: cats.map((c) => ({ ...c, links: [...(c.links ?? [])] })) }
        let newCats = 0, newLinks = 0, dup = 0
        for (const c of imported) {
          let cat = next.categories.find((x) => x.name === c.name)
          if (!cat) { cat = { id: rid(), name: c.name, links: [] }; next.categories.push(cat); newCats++ }
          const have = new Set(cat.links.map((l) => urlKey(l.url)))
          for (const l of c.links) {
            const k = urlKey(l.url)
            if (have.has(k)) { dup++; continue }
            cat.links.push({ id: rid(), title: l.title, url: l.url })
            have.add(k); newLinks++
          }
        }
        persist(next)
        toast(t("imported") + ` +${newCats} +${newLinks}` + (dup ? ` (-${dup})` : ""))
      } catch (e) { toast(t("import_fail") + e.message, true) }
    }
    inp.click()
  }
  const host = (u) => { try { return new URL(u).hostname } catch { return "" } }
  const onIcoErr = (e, h) => {
    e.currentTarget.onerror = null
    e.currentTarget.src = letterAvatar(h)
  }
  // 死链探测：默认当前分类；结果按 URL 标红，摘要走 toast。
  const checkLinks = async () => {
    if (checking || !nav) return
    setChecking(true)
    try {
      const d = await api("/nav/check", { method: "POST", body: JSON.stringify(viewingAll ? {} : { category: cur }) })
      const map = {}
      for (const r of d.results) map[r.url] = r
      setLinkCheck(map)
      toast(t("check_result", { total: d.summary.total, ok: d.summary.ok, bad: d.summary.dead + d.summary.error }))
    } catch (e) { toast(e.message, true) } finally { setChecking(false) }
  }
  // 单张链接卡片（ci/li 用于删除定位）；「全部」视图按分类分组展示，组头已标名，卡片不再带分类徽章
  const navCard = (l, ci, li) => {
    const h = host(l.url)
    const hit = linkCheck?.[l.url]
    const dead = hit && !hit.ok
    return (
      <div key={l.id} className={"linkcard" + (dead ? " dead" : "")}
        onClick={() => openLink(l.url)} title={l.url + (dead ? `（${hit.status || "ERR"}）` : "")}>
        <img className="ico" src={`${API}/icon?host=${encodeURIComponent(h)}`} alt=""
          onError={(e) => onIcoErr(e, h)} />
        <span className="t">{esc(l.title)}</span>
        {dead ? <span className="due overdue" style={{ marginLeft: 4 }}>{hit.status || "ERR"}</span> : null}
        <button className="ibtn sm x" title={t("del")} onClick={(e) => { e.stopPropagation(); delLink(ci, li) }}><Icon name="x" size={11} /></button>
      </div>
    )
  }
  return (
    <div>
      <div className="row" style={{ marginBottom: 10, flexWrap: "wrap" }}>
        <button className="primary" onClick={() => { setForm({ ...form, cat: viewingAll ? 0 : cur }); setAdding(true) }}>
          <Icon name="plus" size={14} />{t("add_link")}
        </button>
        <button onClick={addCat}><Icon name="plus" size={14} />{t("add_cat")}</button>
        <button className="mini" onClick={() => active && delCat(cur)} disabled={viewingAll || !active}>{t("del_cat")}</button>
        <button className="mini" onClick={checkLinks} disabled={checking || (!viewingAll && !active)}
          title={viewingAll ? t("check_all") : t("check_links")}>
          <Icon name="refresh" size={12} />{checking ? t("checking") : viewingAll ? t("check_all") : t("check_links")}
        </button>
        <div className="spacer" />
        <button className="ghost mini" title={t("export_t")} onClick={exportHtml}>{t("export_btn")}</button>
        <button className="ghost mini" title={t("import_t")} onClick={importHtml}>{t("import_btn")}</button>
      </div>
      <div className="nav-chips">
        <span className={"nav-chip" + (viewingAll ? " on" : "")} onClick={() => setCur(-1)} title={t("all_tip")}>
          {t("all")} <span className="muted">{allCount}</span>
        </span>
        {cats.map((c, i) => (
          <span key={c.id} className={"nav-chip" + (i === cur ? " on" : "")} onClick={() => setCur(i)} onDoubleClick={() => delCat(i)} title={t("dbl_del_cat")}>
            {esc(c.name)} <span className="muted">{c.links?.length ?? 0}</span>
          </span>
        ))}
        {!cats.length ? <span className="muted">{t("no_cats")}</span> : null}
      </div>
      {viewingAll ? (
        cats.length ? cats.map((c, ci) => (
          <div key={c.id}>
            <div className="appsec"><Icon name="folder" size={13} />{esc(c.name)} <span className="muted">{c.links?.length ?? 0}</span></div>
            {(c.links ?? []).length
              ? <div className="linkgrid">{c.links.map((l, li) => navCard(l, ci, li))}</div>
              : <Empty small icon="compass" text={t("no_links_cat")} />}
          </div>
        )) : <Empty icon="compass" text={t("no_links_all")} />
      ) : active ? (
        (active.links ?? []).length
          ? <div className="linkgrid">{active.links.map((l, li) => navCard(l, cur, li))}</div>
          : <Empty icon="compass" text={t("no_links_cat")} />
      ) : null}
      {adding ? (
        <Modal title={t("add_link_title")} onClose={() => setAdding(false)}>
          <div className="field"><label>{t("name")}</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="field"><label>{t("url_label")}</label><input placeholder="https://…" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></div>
          <div className="field"><label>{t("category")}</label>
            <select value={form.cat} onChange={(e) => setForm({ ...form, cat: Number(e.target.value) })}>
              {cats.map((c, i) => <option key={c.id} value={i}>{esc(c.name)}</option>)}
            </select>
          </div>
          <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
            <button onClick={() => setAdding(false)}>{t("cancel")}</button>
            <button className="primary" onClick={addLink}>{t("save")}</button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

/* ============ 应用面板：快捷方式目录一页启动 ============ */
function AppsPane({ toast, ask, t }) {
  const [data, setData] = useState(null)
  const [q, setQ] = useState("")
  const [busy, setBusy] = useState("")
  const load = useCallback(async () => {
    const d = await api("/apps")
    setData(d)
  }, [])
  useEffect(() => { load().catch((e) => toast(e.message, true)) }, [load, toast])
  if (!data) return <div className="muted">…</div>
  // 置顶列表原样渲染：文件还在的是普通置顶卡；已失效的（改名/移动/删除）也显示出来，
  // 标灰禁启动、只留「取消置顶」——避免僵尸置顶看不见也取消不掉。
  const pinnedList = (data.pinned || []).map(
    (f) => data.apps.find((a) => a.file === f) ?? { file: f, name: f.replace(/\.(lnk|url)$/iu, ""), missing: true },
  )
  const restList = data.apps.filter((a) => !(data.pinned || []).includes(a.file))
  const kw = q.trim().toLowerCase()
  const matches = data.apps.filter((a) => !kw || a.name.toLowerCase().includes(kw) || a.file.toLowerCase().includes(kw))
  const launch = async (a) => {
    if (busy) return
    setBusy(a.file)
    try {
      await api("/apps/launch", { method: "POST", body: JSON.stringify({ file: a.file }) })
      toast(t("launched", { name: a.name }))
    } catch (e) { toast(e.message, true) }
    finally { setBusy("") }
  }
  const togglePin = async (a) => {
    const cur = data.pinned || []
    const next = cur.includes(a.file) ? cur.filter((f) => f !== a.file) : [...cur, a.file]
    try {
      await api("/apps/prefs", { method: "PUT", body: JSON.stringify({ pinned: next }) })
      load()
    } catch (e) { toast(e.message, true) }
  }
  const setDir = async () => {
    const dir = await ask.prompt({
      title: t("set_dir_title"), initial: data.dir || "",
      message: t("set_dir_msg")
    })
    if (dir === null) return
    try {
      await api("/apps/prefs", { method: "PUT", body: JSON.stringify({ dir }) })
      await load()
      toast(t("dir_updated"))
    } catch (e) { toast(e.message, true) }
  }
  const openFolder = async () => {
    try { await api("/apps/open-folder", { method: "POST", body: "{}" }) }
    catch (e) { toast(e.message, true) }
  }
  const card = (a) => {
    const isPinned = (data.pinned || []).includes(a.file)
    if (a.missing) {
      return (
        <div key={"missing:" + a.file} className="appcard missing pinned" title={t("missing_title", { file: a.file })}>
          <img className="ico" src={letterAvatar(a.name)} alt="" />
          <span className="t">{esc(a.name)}</span>
          <span className="badge down">{t("missing_tag")}</span>
          <button className="pin" title={t("unpin_title")} onClick={() => togglePin(a)}><Icon name="star" size={14} filled /></button>
        </div>
      )
    }
    return (
      <div key={a.file} className={"appcard" + (isPinned ? " pinned" : "") + (busy === a.file ? " busy" : "")}
        onClick={() => launch(a)} title={t("card_title", { file: a.file })}>
        <img className="ico" src={`${API}/appicon?file=${encodeURIComponent(a.file)}`} alt="" loading="lazy"
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = letterAvatar(a.name) }} />
        <span className="t">{esc(a.name)}</span>
        <button className="pin" title={isPinned ? t("unpin_title") : t("pin_title")}
          onClick={(e) => { e.stopPropagation(); togglePin(a) }}>
          <Icon name="star" size={14} filled={isPinned} />
        </button>
      </div>
    )
  }
  const grid = (list) => <div className="appgrid">{list.map(card)}</div>
  return (
    <div>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <div className="pwb-search">
          <Icon name="search" size={14} />
          <input placeholder={t("search_apps", { n: data.apps.length })} value={q} onChange={(e) => setQ(e.target.value)} />
          {q ? <button className="ibtn sm pwb-search-clear" title={t("del")} onClick={() => setQ("")}><Icon name="x" size={11} /></button> : null}
        </div>
        <button className="ibtn" title={t("open_folder")} disabled={!data.dir || !data.dirExists} onClick={openFolder}><Icon name="folder" size={16} /></button>
        <button className="ibtn" title={t("refresh")} onClick={load}><Icon name="refresh" size={15} /></button>
        <button className="mini" onClick={setDir}>{t("set_folder")}</button>
      </div>
      <div className="muted" style={{ margin: "7px 2px 0" }}>
        {data.dir
          ? data.dirExists
            ? t("dir_line", { dir: data.dir })
            : <span style={{ color: "var(--pwb-bad-fg)" }}>{t("dir_missing", { dir: data.dir })}</span>
          : t("dir_unset")}
      </div>
      {kw ? (
        matches.length
          ? grid(matches)
          : <Empty icon="search" text={t("no_match", { q })} />
      ) : (pinnedList.length || restList.length) ? (
        <>
          {pinnedList.length ? <div className="appsec"><Icon name="star" size={13} filled />{t("pinned")} <span className="muted">{pinnedList.length}</span></div> : null}
          {pinnedList.length ? grid(pinnedList) : null}
          {restList.length ? <div className="appsec"><Icon name="server" size={13} />{t("all_apps")} <span className="muted">{restList.length}</span></div> : null}
          {restList.length ? grid(restList) : null}
        </>
      ) : (
        <Empty icon="folder" text={t("empty_apps")} />
      )}
    </div>
  )
}

/* ============ 资产面板 ============ */
const CRED_TYPES = [["password", "cred_pw"], ["private-key", "cred_pk"], ["token", "cred_tok"]]
function AssetsPane({ toast, ask, t, onAiChat }) {
  const [data, setData] = useState(null)
  const [grp, setGrp] = useState("")
  const [adding, setAdding] = useState(false)
  const [detail, setDetail] = useState(null) // 资产 id：点卡片弹出的详情
  const [revealed, setRevealed] = useState({})
  const [linkTarget, setLinkTarget] = useState(null)
  const [linkForm, setLinkForm] = useState({ label: "", url: "" })
  const [vault, setVault] = useState({ enabled: false, unlocked: false })
  const [form, setForm] = useState({ name: "", host: "", port: "", grp: "", project: "", note: "", credType: "password", credLabel: "", credUser: "", credSecret: "", credPass: "", credExpires: "", tokenFile: null })
  const [editingId, setEditingId] = useState(null)
  const [editingCredId, setEditingCredId] = useState(null)
  const [editCredCount, setEditCredCount] = useState(0)
  const [credMgmt, setCredMgmt] = useState(null)
  const [credForm, setCredForm] = useState({ label: "", username: "", secret: "", passphrase: "", expires: "" })
  const credTypeLabel = (type) => { const hit = CRED_TYPES.find(([v]) => v === type); return hit ? t(hit[1]) : String(type ?? "") }
  const loadVault = useCallback(async () => {
    try { setVault(await api("/vault")) } catch {}
  }, [])
  const load = useCallback(async () => {
    const d = await api("/assets")
    setData(d)
  }, [])
  useEffect(() => {
    load().catch((e) => toast(e.message, true))
    loadVault()
  }, [load, loadVault, toast])
  const vaultAction = async (action) => {
    const conf = {
      enable: { title: t("vault_enable_t"), message: t("vault_enable_msg") },
      unlock: { title: t("vault_unlock_t"), message: t("vault_unlock_msg") },
      disable: { title: t("vault_disable_t"), message: t("vault_disable_msg") },
    }[action] ?? {}
    const res = await ask.prompt({
      title: conf.title, message: conf.message, inputType: "password", placeholder: t("vault_ph"),
      checkboxLabel: action === "unlock" ? t("vault_remember") : undefined
    })
    const passphrase = typeof res === "string" ? res : String(res?.text ?? "")
    const remember = typeof res === "object" && Boolean(res?.checked)
    if (action !== "lock" && !passphrase) return
    try {
      const d = await api(`/vault/${action}`, { method: "POST", body: JSON.stringify({ passphrase, remember }) })
      setVault({ enabled: d.enabled, unlocked: d.unlocked })
      toast(action === "enable" ? t("enc_enabled_toast") : action === "unlock" ? t("unlocked_toast") : action === "lock" ? t("locked_toast") : t("enc_disabled_toast"))
      load()
    } catch (e) { toast(e.message, true) }
  }
  if (!data) return <div className="muted">…</div>
  const groups = data.groups
  const ungrouped = data.assets.filter((a) => !a.grp)
  const shown = grp ? data.assets.filter((a) => a.grp === grp) : data.assets
  const detailAsset = detail ? (data.assets.find((x) => x.id === detail) ?? null) : null
  const check = async (id) => {
    toast(t("probe_toast"))
    try {
      const d = await api(`/assets/${id}/check`, { method: "POST", body: "{}" })
      toast(d.ok ? t("probe_up") : t("probe_down"))
      load()
    } catch (e) { toast(e.message, true) }
  }
  const reveal = async (cid) => {
    if (revealed[cid]) { setRevealed({ ...revealed, [cid]: null }); return }
    try {
      const d = await api(`/credentials/${cid}/secret`)
      setRevealed({ ...revealed, [cid]: d })
    } catch (e) { toast(t("decrypt_fail") + e.message, true) }
  }
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); toast(t("copied")) }
    catch { toast(t("copy_fail"), true) }
  }
  const del = async (a) => {
    const ok = await ask.confirm({ title: t("dlg_del_asset"), danger: true, okText: t("ok_del"), message: t("dlg_del_asset_msg", { name: a.name }) })
    if (!ok) return
    await api(`/assets/${a.id}`, { method: "DELETE" })
    setDetail((d) => (d === a.id ? null : d))
    load()
  }
  const openUrl = (url) => { try { window.open(url, "_blank", "noopener") } catch { location.href = url } }
  const addLink = async () => {
    let url = linkForm.url.trim()
    if (!url) return
    if (!/^https?:\/\//i.test(url)) url = "https://" + url
    try {
      await api(`/assets/${linkTarget}/links`, { method: "POST", body: JSON.stringify({ label: linkForm.label.trim() || url, url }) })
      setLinkTarget(null)
      setLinkForm({ label: "", url: "" })
      load()
    } catch (e) { toast(e.message, true) }
  }
  const delLink = async (a, idx) => {
    try {
      await api(`/assets/${a.id}/links/${idx}`, { method: "DELETE" })
      load()
    } catch (e) { toast(e.message, true) }
  }
  // 管理功能：编辑资产 / 编辑与删除凭据 / 分组重命名
  const openEdit = (a) => {
    const firstCred = (a.credentials ?? [])[0] ?? null
    setEditingId(a.id)
    setEditingCredId(firstCred?.id ?? null)
    setEditCredCount((a.credentials ?? []).length)
    setForm({
      name: a.name, host: a.host, port: a.port, grp: a.grp, project: a.project, note: a.note,
      credType: firstCred?.type ?? "password", credLabel: firstCred?.label ?? "",
      credUser: firstCred?.username ?? "", credSecret: "", credPass: "",
      credExpires: firstCred?.expires ?? "", tokenFile: null,
    })
    setAdding(true)
  }
  const openCredMgmt = (a, c) => {
    setCredMgmt({ asset: a, cred: c })
    setCredForm({ label: c.label ?? "", username: c.username ?? "", secret: "", passphrase: "", expires: c.expires ?? "" })
  }
  const saveCred = async () => {
    const { cred } = credMgmt
    const body = { label: credForm.label, username: credForm.username, expires: credForm.expires }
    if (credForm.secret) body.secret = credForm.secret
    if (cred.type === "private-key") body.passphrase = credForm.passphrase
    try {
      await api(`/credentials/${cred.id}`, { method: "PUT", body: JSON.stringify(body) })
      setCredMgmt(null)
      toast(t("cred_updated"))
      load()
    } catch (e) { toast(e.message, true) }
  }
  const deleteCred = async () => {
    const ok = await ask.confirm({ title: t("cred_delete"), danger: true, okText: t("ok_del"), message: t("cred_delete_msg") })
    if (!ok) return
    try {
      await api(`/credentials/${credMgmt.cred.id}`, { method: "DELETE" })
      setCredMgmt(null)
      toast(t("cred_updated"))
      load()
    } catch (e) { toast(e.message, true) }
  }
  const renameGroup = async (g) => {
    const to = await ask.prompt({ title: t("grp_rename_title"), initial: g, placeholder: g })
    if (!to || !to.trim() || to.trim() === g) return
    try {
      await api("/groups/rename", { method: "PUT", body: JSON.stringify({ from: g, to: to.trim() }) })
      if (grp === g) setGrp(to.trim())
      toast(t("grp_renamed"))
      load()
    } catch (e) { toast(e.message, true) }
  }
  const create = async () => {
    if (!form.name.trim()) return toast(t("name_required"), true)
    if (!editingId && form.credType === "token" && !form.tokenFile) return toast(t("token_pick_first"), true)
    try {
      if (editingId) {
        // 令牌选了新文件 → 先上传并替换凭据里的路径
        let tokenPath = null
        if (form.credType === "token" && form.tokenFile) {
          const up = await api("/uploads/token", {
            method: "POST",
            body: JSON.stringify({ assetName: form.name.trim(), name: form.tokenFile.name, contentBase64: form.tokenFile.base64 })
          })
          tokenPath = up.path
          toast(t("token_saved_to") + " " + up.path)
        }
        await api(`/assets/${editingId}`, {
          method: "PUT",
          body: JSON.stringify({ name: form.name.trim(), host: form.host.trim(), port: form.port.trim(), grp: form.grp.trim(), project: form.project.trim(), note: form.note.trim() })
        })
        // 凭据同步：已有凭据 → PUT（类型可换、机密留空不变）；原本没有凭据且填了内容 → 新建
        if (editingCredId) {
          const credBody = { type: form.credType, label: form.credLabel, username: form.credUser, expires: form.credExpires }
          if (tokenPath) credBody.secret = tokenPath
          else if (form.credSecret.trim()) credBody.secret = form.credSecret.trim()
          if (form.credType === "private-key" && form.credPass) credBody.passphrase = form.credPass
          await api(`/credentials/${editingCredId}`, { method: "PUT", body: JSON.stringify(credBody) })
        } else if (form.credSecret.trim() || tokenPath) {
          await api(`/assets/${editingId}/credentials`, {
            method: "POST",
            body: JSON.stringify({
              type: form.credType, label: form.credLabel || (form.credType === "token" ? form.tokenFile.name : ""),
              username: form.credUser, secret: tokenPath || form.credSecret.trim(),
              passphrase: form.credType === "private-key" ? form.credPass || undefined : undefined,
              expires: form.credExpires || undefined
            })
          })
        }
        setAdding(false)
        setEditingId(null)
        setEditingCredId(null)
        setForm({ name: "", host: "", port: "", grp: "", project: "", note: "", credType: "password", credLabel: "", credUser: "", credSecret: "", credPass: "", credExpires: "", tokenFile: null })
        toast(t("asset_updated"))
        load()
        return
      }
      // 令牌：先把文件上传到统一目录（data/tokens/<资产名>/），凭据里保存返回的统一路径
      let tokenPath = null
      if (form.credType === "token") {
        const up = await api("/uploads/token", {
          method: "POST",
          body: JSON.stringify({ assetName: form.name.trim(), name: form.tokenFile.name, contentBase64: form.tokenFile.base64 })
        })
        tokenPath = up.path
        toast(t("token_saved_to") + " " + up.path)
      }
      const secretValue = form.credType === "token" ? tokenPath : form.credSecret.trim()
      const body = {
        name: form.name.trim(), host: form.host.trim(), port: form.port.trim(),
        grp: form.grp.trim(), project: form.project.trim(), note: form.note.trim(),
        credentials: secretValue ? [{
          type: form.credType, label: form.credLabel || (form.credType === "token" ? form.tokenFile.name : ""), username: form.credUser, secret: secretValue,
          passphrase: form.credType === "private-key" ? form.credPass || undefined : undefined,
          expires: form.credExpires || undefined
        }] : []
      }
      await api("/assets", { method: "POST", body: JSON.stringify(body) })
      setAdding(false)
      setForm({ name: "", host: "", port: "", grp: "", project: "", note: "", credType: "password", credLabel: "", credUser: "", credSecret: "", credPass: "", credExpires: "", tokenFile: null })
      toast(t("added"))
      load()
    } catch (e) { toast(e.message, true) }
  }
  // 点击到期徽章即可修改/清除到期日（YYYY-MM-DD，留空清除）
  const editExpires = async (c) => {
    const next = await ask.prompt({ title: t("exp_title"), message: t("exp_msg"), initial: c.expires || "" })
    if (next === null) return
    try {
      await api(`/credentials/${c.id}`, { method: "PUT", body: JSON.stringify({ expires: next }) })
      load()
    } catch (e) { toast(e.message, true) }
  }
  // 令牌文件：选择本地文件（base64 暂存表单，保存时上传到服务端统一目录 data/tokens/<资产名>/）
  const fmtSize = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB")
  const pickTokenFile = () => {
    const inp = document.createElement("input")
    inp.type = "file"
    inp.onchange = () => {
      const file = inp.files?.[0]
      if (!file) return
      if (file.size > 5 * 1024 * 1024) return toast(t("token_too_big"), true)
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = String(reader.result || "").split(",")[1] || ""
        setForm((f) => ({ ...f, tokenFile: { name: file.name, size: file.size, base64 } }))
      }
      reader.readAsDataURL(file)
    }
    inp.click()
  }
  // 资产卡固定 96px 三行：名称（省略号）/ 主机·项目·检查时间 / 备注或凭据链接摘要；详情点卡片弹窗
  const assetCard = (a) => (
    <div key={a.id} className="acard" title={a.name} onClick={() => setDetail(a.id)}>
      <div className="row">
        <span className="name">{esc(a.name)}</span>
        <span className={"badge " + (a.last_status === "up" ? "up" : a.last_status === "down" ? "down" : "")}>
          {a.last_status === "up" ? t("online") : a.last_status === "down" ? t("offline") : t("unknown")}
        </span>
      </div>
      <div className="a-line" style={{ marginTop: 3 }}>
        {esc(a.host)}{a.port ? ":" + esc(a.port) : ""}{a.project ? " · " + esc(a.project) : ""}
        {a.last_check ? " · " + esc(a.last_check.slice(0, 16)).replace("T", " ") : ""}
      </div>
      <div className="a-line" style={{ marginTop: 2 }}>
        {a.note
          ? esc(a.note)
          : (a.credentials || []).length || (a.links || []).length
            ? t("ad_summary", { c: (a.credentials || []).length, l: (a.links || []).length })
            : ""}
      </div>
      <div className="card-actions">
        <button className="ibtn sm" title={t("ai_asset_btn")} onClick={(e) => { e.stopPropagation(); onAiChat(a) }}><Icon name="flame" size={13} /></button>
        <button className="ibtn sm" title={t("edit")} onClick={(e) => { e.stopPropagation(); openEdit(a) }}><Icon name="edit" size={13} /></button>
        <button className="ibtn sm red" title={t("del")} onClick={(e) => { e.stopPropagation(); del(a) }}><Icon name="trash" size={13} /></button>
      </div>
    </div>
  )
  // 新增入口在卡片流末尾的 ＋ 卡上：从分组视图点开时预填当前分组
  const openAdd = () => {
    setEditingId(null)
    setEditingCredId(null)
    setForm({ name: "", host: "", port: "", grp, project: "", note: "", credType: "password", credLabel: "", credUser: "", credSecret: "", credPass: "", credExpires: "", tokenFile: null })
    setAdding(true)
  }
  const addCard = <AddCard label={t("add_asset")} onClick={openAdd} />
  return (
    <div>
      <div className="row" style={{ flexWrap: "wrap" }}>
        {vault.enabled ? (
          <>
            <button className={vault.unlocked ? "" : "mini"} title={vault.unlocked ? t("enc_lock_tip") : t("enc_unlock_tip")}
              onClick={() => vaultAction(vault.unlocked ? "lock" : "unlock")}>
              <Icon name={vault.unlocked ? "unlock" : "lock"} size={13} />
              {vault.unlocked ? t("enc_lock") : t("enc_unlock")}
            </button>
            <button className="ghost mini" title={t("enc_disable_tip")} onClick={() => vaultAction("disable")}>{t("enc_disable")}</button>
          </>
        ) : (
          <button className="mini" title={t("enc_enable_tip")} onClick={() => vaultAction("enable")}><Icon name="lock" size={13} />{t("enc_enable")}</button>
        )}
        <div className="spacer" />
      </div>
      <div className="nav-chips" style={{ marginTop: 10 }}>
        <span className={"chip" + (!grp ? " on" : "")} onClick={() => setGrp("")}>{t("all_n", { n: data.assets.length })}</span>
        {groups.map((g) => (
          <span key={g} className={"chip" + (grp === g ? " on" : "")} onClick={() => setGrp(grp === g ? "" : g)}>{esc(g)}</span>
        ))}
      </div>
      {grp ? (
        <>
          {!shown.length ? <Empty icon="server" text={t("no_assets")} /> : null}
          <div className="assetgrid" style={{ marginTop: shown.length ? 4 : 12 }}>{shown.map(assetCard)}{addCard}</div>
        </>
      ) : data.assets.length ? (
        <div style={{ marginTop: 2 }}>
          {[
            ...groups.map((g) => ({ label: g, list: data.assets.filter((a) => a.grp === g) })),
            { label: t("ungrouped"), list: ungrouped },
          ].filter((s) => s.list.length).map((s, i, all) => (
            <div key={s.label}>
              <div className="appsec">
                <Icon name="folder" size={13} />{esc(s.label)} <span className="muted">{s.list.length}</span>
                <button className="ibtn sm" title={t("grp_dbl_rename")} onClick={() => renameGroup(s.label)}><Icon name="edit" size={12} /></button>
              </div>
              <div className="assetgrid">{s.list.map(assetCard)}{i === all.length - 1 ? addCard : null}</div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <Empty icon="server" text={t("no_assets")} />
          <div className="assetgrid">{addCard}</div>
        </>
      )}
      {/* 资产详情弹窗：卡片固定尺寸后，凭据/链接/备注/操作全部收进这里 */}
      {detailAsset ? (
        <Modal title={detailAsset.name} wide onClose={() => setDetail(null)}>
          <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
            <span className={"badge " + (detailAsset.last_status === "up" ? "up" : detailAsset.last_status === "down" ? "down" : "")}>
              {detailAsset.last_status === "up" ? t("online") : detailAsset.last_status === "down" ? t("offline") : t("unknown")}
            </span>
            {detailAsset.grp ? <span className="badge">{esc(detailAsset.grp)}</span> : null}
            {detailAsset.last_check ? (
              <span className="muted" style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}>{esc(detailAsset.last_check.slice(0, 16)).replace("T", " ")}</span>
            ) : null}
          </div>
          <div className="detail-kv">
            <span className="k">{t("f_host")}</span>
            <span className="v">{esc(detailAsset.host)}{detailAsset.port ? ":" + esc(detailAsset.port) : ""}</span>
            {detailAsset.project ? (<><span className="k">{t("f_project")}</span><span className="v">{esc(detailAsset.project)}</span></>) : null}
            {detailAsset.note ? (<><span className="k">{t("f_notes")}</span><span className="v">{esc(detailAsset.note)}</span></>) : null}
          </div>
          <div className="detail-sec">
            <div className="sec-title"><Icon name="link" size={13} />{t("ad_links")}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
              {(detailAsset.links || []).map((l, li) => (
                <span key={li} style={{ position: "relative", display: "inline-flex" }}>
                  <button className="alink" title={l.url} onClick={() => openUrl(l.url)}><Icon name="link" size={11} />{esc(l.label || l.url)}</button>
                  <button className="ibtn sm" title={t("del")} style={{ marginLeft: -3, width: 18, height: 18, borderRadius: 999 }}
                    onClick={() => delLink(detailAsset, li)}><Icon name="x" size={10} /></button>
                </span>
              ))}
              <button className="mini" onClick={() => { setLinkTarget(detailAsset.id); setLinkForm({ label: "", url: "" }) }}><Icon name="plus" size={12} />{t("link_add")}</button>
            </div>
          </div>
          <div className="detail-sec">
            <div className="sec-title"><Icon name="lock" size={13} />{t("cred_section_edit")}</div>
            {(detailAsset.credentials || []).length ? (detailAsset.credentials || []).map((c) => (
              <div key={c.id}>
                <div className="cred-row">
                  {c.expires ? (
                    <span className={"badge exp" + (c.expiresInDays < 0 ? " down" : "")} title={t("exp_tip")} onClick={() => editExpires(c)}>
                      <Icon name="clock" size={10} /> {esc(c.expires)}{typeof c.expiresInDays === "number" ? (c.expiresInDays < 0 ? `（${t("expired")}）` : `（${c.expiresInDays}${t("days")}）`) : ""}
                    </span>
                  ) : null}
                  <button className="mini" onClick={() => reveal(c.id)}>{revealed[c.id] ? t("hide") : t("reveal")} {esc(c.label || credTypeLabel(c.type))}</button>
                  {revealed[c.id] ? <button className="mini" onClick={() => copy(revealed[c.id].secret)}><Icon name="copy" size={11} />{t("copy")}</button> : null}
                  <button className="ibtn sm" title={t("manage")} onClick={() => openCredMgmt(detailAsset, c)}><Icon name="sliders" size={12} /></button>
                </div>
                {revealed[c.id] ? (
                  <div className="cred">
                    <span className="muted">{esc(c.username ? c.username + " · " : "")}{esc(c.label || credTypeLabel(c.type))}</span>
                    <span className="sec">{esc(revealed[c.id].secret)}</span>
                    {revealed[c.id].passphrase ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                        <span className="muted">{t("f_pp")}</span>
                        <span className="sec">{esc(revealed[c.id].passphrase)}</span>
                        <button className="mini" onClick={() => copy(revealed[c.id].passphrase)}><Icon name="copy" size={11} />{t("copy")}</button>
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )) : <div className="muted">{t("ad_no_cred")}</div>}
          </div>
          <div className="row" style={{ justifyContent: "space-between", marginTop: 14, flexWrap: "wrap", gap: 8 }}>
            <div className="row">
              <button className="mini" onClick={() => check(detailAsset.id)}><Icon name="refresh" size={12} />{t("probe")}</button>
              <button className="mini" onClick={() => onAiChat(detailAsset)}><Icon name="flame" size={12} />{t("ai_asset_btn")}</button>
            </div>
            <div className="row">
              <button className="danger mini" onClick={() => del(detailAsset)}><Icon name="trash" size={12} />{t("del")}</button>
              <button className="primary mini" onClick={() => openEdit(detailAsset)}><Icon name="edit" size={12} />{t("edit")}</button>
            </div>
          </div>
        </Modal>
      ) : null}
      {adding ? (
        <Modal title={editingId ? t("edit_asset_title") : t("add_asset_title")} wide onClose={() => { setAdding(false); setEditingId(null) }}>
          <div className="field"><label>{t("f_name")}</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="field"><label>{t("f_host")}</label><input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder={t("host_ph")} /></div>
          <div className="field"><label>{t("f_port")}</label><input value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} placeholder="22" /></div>
          <div className="field"><label>{t("f_group")}</label><input value={form.grp} onChange={(e) => setForm({ ...form, grp: e.target.value })} list="pwb-groups" />
            <datalist id="pwb-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist></div>
          <div className="field"><label>{t("f_project")}</label><input value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} /></div>
          <div className="field"><label>{t("f_notes")}</label><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
          <h3 style={{ marginTop: 14 }}>{editingId ? t("cred_section_edit") : t("cred_optional")}</h3>
          {editingId && editCredCount > 1 ? (
            <div className="muted" style={{ margin: "-4px 0 10px" }}>{t("multi_cred_hint", { n: editCredCount })}</div>
          ) : null}
          <div className="field"><label>{t("f_type")}</label>
            <select value={form.credType} onChange={(e) => setForm({ ...form, credType: e.target.value, credPass: "" })}>
              {CRED_TYPES.map(([v, key]) => <option key={v} value={v}>{t(key)}</option>)}
            </select></div>
          <div className="field"><label>{t("f_label")}</label><input value={form.credLabel} onChange={(e) => setForm({ ...form, credLabel: e.target.value })} /></div>
          <div className="field"><label>{t("f_user")}</label><input value={form.credUser} onChange={(e) => setForm({ ...form, credUser: e.target.value })} /></div>
          {form.credType === "token" ? (
            <div className="field"><label>{t("f_token_file")}</label>
              <div className="row" style={{ flexWrap: "wrap" }}>
                <button className="mini" onClick={pickTokenFile}><Icon name="folder" size={12} />{t("token_pick")}</button>
                {form.tokenFile
                  ? <span className="muted">{esc(form.tokenFile.name)}（{fmtSize(form.tokenFile.size)}）</span>
                  : <span className="muted">{editingId && editingCredId ? t("token_hint_edit") : t("token_hint")}</span>}
              </div>
            </div>
          ) : (
          <div className="field"><label>{form.credType === "private-key" ? t("f_pk") : t("f_secret")}</label>
            {form.credType === "private-key" ? (
              <textarea rows={4} style={{ fontFamily: "ui-monospace, Consolas, monospace", resize: "vertical" }}
                placeholder={"-----BEGIN OPENSSH PRIVATE KEY-----"}
                value={form.credSecret} onChange={(e) => setForm({ ...form, credSecret: e.target.value })} />
            ) : (
              <input type="password" placeholder={editingId && editingCredId ? t("new_secret_ph") : ""} value={form.credSecret} onChange={(e) => setForm({ ...form, credSecret: e.target.value })} />
            )}</div>
          )}
          {form.credType === "private-key" ? (
            <div className="field"><label>{t("f_pp")}</label><input type="password" placeholder={t("pp_ph")} value={form.credPass} onChange={(e) => setForm({ ...form, credPass: e.target.value })} /></div>
          ) : null}
          <div className="field"><label>{t("f_exp")}</label><input type="date" value={form.credExpires} onChange={(e) => setForm({ ...form, credExpires: e.target.value })} /></div>
          <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
            <button onClick={() => { setAdding(false); setEditingId(null) }}>{t("cancel")}</button>
            <button className="primary" onClick={create}>{editingId ? t("save") : t("add")}</button>
          </div>
        </Modal>
      ) : null}
      {credMgmt ? (
        <Modal title={t("cred_edit_title")} onClose={() => setCredMgmt(null)}>
          <div className="field"><label>{t("f_label")}</label><input value={credForm.label} onChange={(e) => setCredForm({ ...credForm, label: e.target.value })} /></div>
          <div className="field"><label>{t("f_user")}</label><input value={credForm.username} onChange={(e) => setCredForm({ ...credForm, username: e.target.value })} /></div>
          <div className="field"><label>{t("f_new_secret")}</label>
            <input type="password" placeholder={t("new_secret_ph")} value={credForm.secret} onChange={(e) => setCredForm({ ...credForm, secret: e.target.value })} /></div>
          {credMgmt.cred.type === "private-key" ? (
            <div className="field"><label>{t("f_pp")}</label><input type="password" value={credForm.passphrase} onChange={(e) => setCredForm({ ...credForm, passphrase: e.target.value })} /></div>
          ) : null}
          <div className="field"><label>{t("f_exp")}</label><input type="date" value={credForm.expires} onChange={(e) => setCredForm({ ...credForm, expires: e.target.value })} /></div>
          <div className="row" style={{ justifyContent: "space-between", marginTop: 12 }}>
            <button className="danger" onClick={deleteCred}>{t("cred_delete")}</button>
            <div className="row">
              <button onClick={() => setCredMgmt(null)}>{t("cancel")}</button>
              <button className="primary" onClick={saveCred}>{t("save")}</button>
            </div>
          </div>
        </Modal>
      ) : null}
      {linkTarget ? (
        <Modal title={t("add_rel_title")} onClose={() => setLinkTarget(null)}>
          <div className="field"><label>{t("name")}</label><input placeholder={t("rel_name_ph")} value={linkForm.label} onChange={(e) => setLinkForm({ ...linkForm, label: e.target.value })} /></div>
          <div className="field"><label>{t("url_label")}</label><input placeholder="https://…" value={linkForm.url} onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })} /></div>
          <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
            <button onClick={() => setLinkTarget(null)}>{t("cancel")}</button>
            <button className="primary" onClick={addLink}>{t("save")}</button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

/* ============ 速记面板（速记.md，纯卡片流：按月归档、卡片统一尺寸） ============ */
function NotesPane({ toast, t, lang }) {
  const [raw, setRaw] = useState(null)
  const [hash, setHash] = useState("")
  const [q, setQ] = useState("")
  const [rawMode, setRawMode] = useState(false)
  const [rawDraft, setRawDraft] = useState("")
  const [editing, setEditing] = useState(null) // { idx, text }
  const MONTHS = t("months").split(",")
  const load = useCallback(async () => {
    const d = await api("/note")
    setRaw(d.text); setHash(d.hash)
  }, [])
  useEffect(() => { load().catch((e) => toast(e.message, true)) }, [load, toast])
  const put = async (text) => {
    try {
      const d = await api("/note", { method: "PUT", body: JSON.stringify({ text, baseHash: hash }) })
      setHash(d.hash); setRaw(text)
      return true
    } catch (e) {
      if (e.currentText !== undefined) {
        setRaw(e.currentText); setHash(e.currentHash)
        toast(t("note_conflict"), true)
      } else toast(e.message, true)
      return false
    }
  }
  // 解析 "## " 小节为卡片；标题即时间（新格式含年份用于按月归档，旧格式归入当前年）
  const entries = useMemo(() => {
    if (raw == null) return []
    const sections = []
    let cur = null
    const year = new Date().getFullYear()
    raw.split(/\r?\n/).forEach((line) => {
      const h = line.match(/^##\s+(.+)$/)
      if (h) { cur = { title: h[1].trim(), lines: [] }; sections.push(cur); return }
      if (!cur) {
        if (line.trim()) { cur = { title: line.trim().slice(0, 40), lines: [] }; sections.push(cur) }
        return
      }
      cur.lines.push(line)
    })
    return sections.map((s, i) => {
      const full = s.title.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}:\d{2})$/)
      const short = s.title.match(/^(\d{2})-(\d{2})\s+(\d{2}:\d{2})$/)
      let time = s.title, monthKey = null
      if (full) { time = `${full[2]}-${full[3]} ${full[4]}`; monthKey = `${full[1]}-${full[2]}` }
      else if (short) { time = `${short[1]}-${short[2]} ${short[3]}`; monthKey = `${year}-${short[1]}` }
      return { idx: i, title: s.title, time, monthKey, body: s.lines.join("\n").trim() }
    })
  }, [raw])
  const sectionSpans = (text) => {
    const lines = text.split(/\r?\n/)
    const marks = []
    let cur = null
    lines.forEach((line, i) => {
      if (/^##\s+/.test(line)) { if (cur) cur.end = i; cur = { start: i, end: lines.length }; marks.push(cur) }
    })
    return { lines, marks }
  }
  const delEntry = async (idx) => {
    if (raw == null) return
    const { lines, marks } = sectionSpans(raw)
    const m = marks[idx]
    if (!m) return
    lines.splice(m.start, m.end - m.start)
    await put(lines.join("\n").replace(/^\n+/, ""))
  }
  const newCard = async () => {
    if (raw == null || editing) return
    const d = new Date()
    const stamp = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
    const base = raw.trimEnd()
    const ok = await put((base ? base + "\n\n" : "") + `## ${stamp}\n`)
    if (ok) setEditing({ idx: entries.length, text: "" })
  }
  const saveCard = async () => {
    if (!editing || raw == null) return
    const body = editing.text.trim()
    if (!body) return delEntry(editing.idx)
    const { lines, marks } = sectionSpans(raw)
    const m = marks[editing.idx]
    if (!m) return
    lines.splice(m.start + 1, m.end - m.start - 1, body)
    const ok = await put(lines.join("\n"))
    if (ok) setEditing(null)
  }
  const cancelCard = () => {
    if (!editing) return
    if (!editing.text.trim()) delEntry(editing.idx)
    else setEditing(null)
  }
  const saveRaw = async () => {
    const ok = await put(rawDraft)
    if (ok) { setRawMode(false); setRawDraft("") }
  }
  const kw = q.trim().toLowerCase()
  const visible = entries.filter((e) => {
    const isEditingThis = editing && editing.idx === e.idx
    if (!e.body.trim() && !isEditingThis) return false
    if (!kw) return true
    return (e.title + "\n" + e.body).toLowerCase().includes(kw)
  })
  // 按月归档：月份降序，组内新在前；无时间戳的旧条目归入"更早"
  const monthKeys = [...new Set(visible.map((e) => e.monthKey).filter(Boolean))].sort().reverse()
  const earlier = visible.filter((e) => !e.monthKey)
  const monthLabel = (key) => {
    const [y, m] = key.split("-")
    return lang === "en" ? `${MONTHS[Number(m) - 1]} ${y}` : `${y} 年 ${Number(m)} 月`
  }
  return (
    <div>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <button className="mini" disabled={!!editing} onClick={() => { if (!rawMode) setRawDraft(raw ?? ""); setRawMode(!rawMode) }}>{t("note_raw")}</button>
        <div className="spacer" />
        <div className="pwb-search" style={{ maxWidth: 260 }}>
          <Icon name="search" size={14} />
          <input placeholder={t("note_search")} value={q} onChange={(e) => setQ(e.target.value)} />
          {q ? <button className="ibtn sm pwb-search-clear" onClick={() => setQ("")}><Icon name="x" size={11} /></button> : null}
        </div>
        <span className="muted">{t("note_stats", { entries: visible.filter((e) => e.body.trim()).length, chars: (raw ?? "").length })}</span>
      </div>
      {rawMode ? (
        <div className="card" style={{ marginTop: 12 }}>
          <textarea rows={16} style={{ width: "100%", fontFamily: "ui-monospace, Consolas, monospace", resize: "vertical" }}
            value={rawDraft} onChange={(e) => setRawDraft(e.target.value)} />
          <div className="row" style={{ justifyContent: "flex-end", marginTop: 10 }}>
            <button onClick={() => setRawMode(false)}>{t("note_raw_cancel")}</button>
            <button className="primary" onClick={saveRaw}>{t("note_raw_save")}</button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          {[
            ...monthKeys.map((key) => ({ key, early: false, label: monthLabel(key), items: visible.filter((e) => e.monthKey === key) })),
            ...(earlier.length ? [{ key: "_early", early: true, label: t("note_earlier"), items: earlier }] : []),
          ].map((s, si, all) => {
            if (!s.items.length) return null
            return (
              <div key={s.key}>
                <div className="appsec"><Icon name="calendar" size={13} />{esc(s.label)} <span className="muted">{s.items.length}</span></div>
                <div className="note-grid">
                  {[...s.items].reverse().map((e) => {
                    const isEditing = editing && editing.idx === e.idx
                    return (
                      <div key={e.idx} className={"card note-card" + (isEditing ? " editing" : "")} style={{ minWidth: 0 }}>
                        <div className="card-actions">
                          {isEditing ? null : (
                            <>
                              <button className="ibtn sm" title={t("note_edit")} onClick={() => setEditing({ idx: e.idx, text: e.body })}><Icon name="edit" size={12} /></button>
                              <button className="ibtn sm red" title={t("note_del")} onClick={() => delEntry(e.idx)}><Icon name="trash" size={12} /></button>
                            </>
                          )}
                        </div>
                        <div className="note-time">{esc(s.early ? e.title : e.time)}</div>
                        {isEditing ? (
                          <>
                            <textarea rows={6} style={{ width: "100%", border: "none", background: "transparent", padding: 0, outline: "none", resize: "none", font: "inherit", color: "var(--pwb-text)", display: "block", flex: 1 }}
                              value={editing.text} autoFocus
                              onChange={(ev) => setEditing({ ...editing, text: ev.target.value })}
                              onKeyDown={(ev) => { if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) saveCard() }} />
                            <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
                              <button className="mini" onClick={cancelCard}>{t("note_cancel")}</button>
                              <button className="mini primary" onClick={saveCard}>{t("note_save")}</button>
                            </div>
                          </>
                        ) : (
                          <div className="note-body">{esc(e.body)}</div>
                        )}
                      </div>
                    )
                  })}
                  {si === all.length - 1 ? <AddCard label={t("note_new")} onClick={newCard} disabled={!!editing} /> : null}
                </div>
              </div>
            )
          })}
          {!visible.length ? (
            <>
              <Empty icon="edit" text={entries.length ? t("note_none_match") : t("note_empty")} />
              {kw ? null : <div className="note-grid"><AddCard label={t("note_new")} onClick={newCard} disabled={!!editing} /></div>}
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}

/* ============ 密钥文档面板（密钥/*.md|*.txt，固定卡片 + 弹窗查看/编辑，可导入本地文件） ============ */
function KeysPane({ toast, ask, t }) {
  const [docs, setDocs] = useState(null)
  const [q, setQ] = useState("")
  const [detail, setDetail] = useState(null) // { name, ext }：弹窗查看的文档
  const [draft, setDraft] = useState(null) // null = 阅读模式；string = 编辑模式
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState("")
  const load = useCallback(async () => {
    const d = await api("/keysdocs")
    setDocs(d.docs)
  }, [])
  useEffect(() => { load().catch((e) => toast(e.message, true)) }, [load, toast])
  const doc = detail ? (docs ?? []).find((d) => d.name === detail.name && d.ext === detail.ext) : null
  const docTitle = (d) => d.name + (d.ext === "txt" ? ".txt" : "")
  const save = async () => {
    try {
      const d = await api(`/keysdoc/${encodeURIComponent(detail.name)}`, { method: "PUT", body: JSON.stringify({ text: draft, baseHash: doc.hash, ext: detail.ext }) })
      setDocs((list) => list.map((x) => x.name === detail.name && x.ext === detail.ext ? { ...x, text: draft, hash: d.hash, chars: d.chars, mtime: new Date().toISOString() } : x))
      setDraft(null)
      toast(t("kd_saved"))
    } catch (e) {
      if (e.currentText !== undefined) {
        setDraft(e.currentText)
        setDocs((list) => list.map((x) => x.name === detail.name && x.ext === detail.ext ? { ...x, text: e.currentText, hash: e.currentHash } : x))
        toast(t("kd_conflict"), true)
      } else toast(e.message, true)
    }
  }
  const removeDoc = async (d) => {
    const ok = await ask.confirm({ title: t("kd_del"), danger: true, okText: t("ok_del"), message: t("kd_del_msg", { name: docTitle(d) }) })
    if (!ok) return
    try {
      await api(`/keysdoc/${encodeURIComponent(d.name)}?ext=${d.ext}`, { method: "DELETE" })
      if (detail && detail.name === d.name && detail.ext === d.ext) { setDetail(null); setDraft(null) }
      await load()
      toast(t("kd_deleted"))
    } catch (e) { toast(e.message, true) }
  }
  const createDoc = async () => {
    const name = newName.trim()
    if (!name) return
    if ((docs ?? []).some((d) => d.name === name && d.ext === "md")) return toast(t("kd_name_exists"), true)
    try {
      await api(`/keysdoc/${encodeURIComponent(name)}`, { method: "PUT", body: JSON.stringify({ text: "", ext: "md" }) })
      await load()
      setDetail({ name, ext: "md" })
      setDraft("")
      setAdding(false)
      setNewName("")
      toast(t("kd_created"))
    } catch (e) { toast(e.message, true) }
  }
  // 导入本地 .md / .txt：内容原样落成密钥目录下的同名文档
  const importFile = () => {
    const inp = document.createElement("input")
    inp.type = "file"
    inp.accept = ".md,.txt,text/markdown,text/plain"
    inp.onchange = async () => {
      const file = inp.files?.[0]
      if (!file) return
      const hit = file.name.toLowerCase().match(/^(.+)(\.md|\.txt)$/)
      if (!hit) return toast(t("kd_bad_file"), true)
      const ext = hit[2] === ".txt" ? "txt" : "md"
      const name = file.name.slice(0, -hit[2].length).trim()
      if (!name) return toast(t("kd_bad_file"), true)
      if ((docs ?? []).some((d) => d.name === name && d.ext === ext)) return toast(t("kd_name_exists"), true)
      if (file.size > 1024 * 1024) return toast(t("kd_too_big"), true)
      try {
        const text = await file.text()
        await api(`/keysdoc/${encodeURIComponent(name)}`, { method: "PUT", body: JSON.stringify({ text, ext }) })
        await load()
        setDetail({ name, ext })
        setDraft(null)
        setAdding(false)
        toast(t("kd_import_done", { name: name + hit[2] }))
      } catch (e) { toast(e.message, true) }
    }
    inp.click()
  }
  const kw = q.trim().toLowerCase()
  const filtered = (docs ?? []).filter((d) => !kw || (d.name + "\n" + d.text).toLowerCase().includes(kw))
  const openView = (d, edit = false) => { setDetail({ name: d.name, ext: d.ext }); setDraft(edit ? d.text : null) }
  const addCard = <AddCard label={t("kd_new")} onClick={() => { setNewName(""); setAdding(true) }} />
  // 列表视图：固定尺寸文档卡，点卡片弹详情
  return (
    <div>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <div className="pwb-search">
          <Icon name="search" size={14} />
          <input placeholder={t("kd_search")} value={q} onChange={(e) => setQ(e.target.value)} />
          {q ? <button className="ibtn sm pwb-search-clear" onClick={() => setQ("")}><Icon name="x" size={11} /></button> : null}
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        {filtered.length ? (
          <div className="note-grid">
            {filtered.map((d) => (
              <div key={d.name + "." + d.ext} className="card kdoc-card" title={t("kd_open_tip")}
                onClick={() => openView(d)}>
                <div className="card-actions">
                  <button className="ibtn sm" title={t("edit")} onClick={(ev) => { ev.stopPropagation(); openView(d, true) }}><Icon name="edit" size={12} /></button>
                  <button className="ibtn sm red" title={t("kd_del")} onClick={(ev) => { ev.stopPropagation(); removeDoc(d) }}><Icon name="trash" size={12} /></button>
                </div>
                <div className="row">
                  <b className="note-title"><Icon name="file" size={13} />{esc(d.name)}{d.ext === "txt" ? <span className="muted">.txt</span> : null}</b>
                </div>
                <div className="muted" style={{ marginTop: 4, fontSize: 11.5, fontVariantNumeric: "tabular-nums" }}>
                  {t("kd_chars", { chars: d.chars })} · {esc(d.mtime.slice(0, 16).replace("T", " "))}
                </div>
                {d.text.trim() ? (
                  <div className="kdoc-preview">{esc(d.text.split("\n").filter((l) => l.trim()).slice(0, 4).join("\n"))}</div>
                ) : null}
              </div>
            ))}
            {addCard}
          </div>
        ) : (docs ?? []).length ? (
          <Empty icon="lock" text={t("key_none_match")} />
        ) : (
          <>
            <Empty icon="lock" text={t("kd_empty_list")} />
            <div className="note-grid">{addCard}</div>
          </>
        )}
      </div>
      {/* 文档详情弹窗：查看 / 编辑 / 删除 */}
      {detail && doc ? (
        <Modal title={docTitle(doc)} wide onClose={() => { if (draft === null) setDetail(null); else setDraft(null) }}>
          {draft === null ? (
            <>
              <div className="row muted" style={{ gap: 10, marginBottom: 8, fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                <span>{t("kd_chars", { chars: doc.chars })}</span>
                <span>{esc(doc.mtime.slice(0, 16).replace("T", " "))}</span>
              </div>
              {doc.text.trim() ? (
                <div className="kdoc-view" style={{ minHeight: 180, maxHeight: "52vh", overflow: "auto" }}>{esc(doc.text)}</div>
              ) : (
                <Empty icon="edit" text={t("kd_empty_doc")} />
              )}
              <div className="row" style={{ justifyContent: "space-between", marginTop: 12 }}>
                <button className="danger mini" onClick={() => removeDoc(doc)}><Icon name="trash" size={12} />{t("kd_del")}</button>
                <button className="primary mini" onClick={() => setDraft(doc.text)}><Icon name="edit" size={12} />{t("edit")}</button>
              </div>
            </>
          ) : (
            <>
              <textarea rows={18} style={{ width: "100%", border: "1px solid var(--pwb-border-strong)", borderRadius: 8,
                background: "var(--pwb-input-bg)", color: "var(--pwb-text)", fontFamily: "ui-monospace, Consolas, monospace",
                fontSize: 12.5, lineHeight: 1.6, resize: "vertical", padding: "10px 12px", outline: "none", display: "block" }}
                value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
              <div className="row" style={{ justifyContent: "flex-end", marginTop: 10 }}>
                <button className="mini" onClick={() => setDraft(null)}>{t("cancel")}</button>
                <button className="primary mini" onClick={save}>{t("save")}</button>
              </div>
            </>
          )}
        </Modal>
      ) : null}
      {adding ? (
        <Modal title={t("kd_add_title")} onClose={() => setAdding(false)}>
          <div className="row">
            <input style={{ flex: 1 }} placeholder={t("kd_name_ph")} value={newName} autoFocus
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createDoc() }} />
            <button className="primary" onClick={createDoc}><Icon name="plus" size={13} />{t("kd_new")}</button>
          </div>
          <div className="kd-or">{t("kd_or")}</div>
          <button style={{ width: "100%" }} onClick={importFile}><Icon name="folder" size={14} />{t("kd_import_file")}</button>
          <div className="muted" style={{ marginTop: 8 }}>{t("kd_import_hint")}</div>
        </Modal>
      ) : null}
    </div>
  )
}

/* ============ AI 对话面板（ZCode 式双栏：左会话列表 / 右对话；会话存 localStorage） ============ */
const TOOL_LABELS = {
  read_todo: "ai_tool_read_todo",
  read_note: "ai_tool_read_note",
  list_assets: "ai_tool_list_assets",
  probe_asset: "ai_tool_probe_asset",
  search_nav: "ai_tool_search_nav",
  list_keydocs: "ai_tool_list_keydocs",
  add_todo: "ai_tool_add_todo",
  add_note: "ai_tool_add_note",
  add_asset: "ai_tool_add_asset",
  ssh_exec: "ai_tool_ssh_exec",
}
// 迷你 MD 渲染：转义后支持 代码块/行内代码/粗体/标题/列表（不引依赖）
const mdLite = (src) => {
  const codes = []
  let s = esc(src)
  s = s.replace(/```([\s\S]*?)```/g, (_, c) => { codes.push(c.replace(/^[a-z]*\n/i, "")); return "\u0000" + (codes.length - 1) + "\u0000" })
  s = s.replace(/`([^`\n]+)`/g, "<code class='md-ic'>$1</code>")
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>")
  s = s.replace(/^#{1,4}\s+(.+)$/gm, "<div class='md-h'>$1</div>")
  s = s.replace(/^[-*]\s+(.+)$/gm, "<div class='md-li'>• $1</div>")
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => "<pre class='md-code'>" + codes[Number(i)] + "</pre>")
  return s
}
const aiUid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
const relTime = (ts) => {
  if (typeof ts === "string" && /^\d+$/.test(ts)) ts = Number(ts) // 旧数据里被存成字符串的时间戳
  const d = new Date(ts)
  const now = new Date()
  const hm = pad2(d.getHours()) + ":" + pad2(d.getMinutes())
  if (d.toDateString() === now.toDateString()) return hm
  const md = (d.getMonth() + 1) + "-" + d.getDate()
  return d.getFullYear() === now.getFullYear() ? md : d.getFullYear() + "-" + md
}
// 会话内对单条消息应用一个 SSE 事件（纯函数）
const applyEv = (msgs, ev) => {
  const cp = [...msgs]
  const last = cp[cp.length - 1]
  if (!last || last.role !== "assistant") return cp
  if (ev.type === "delta") last.content += ev.text
  if (ev.type === "tool") last.tools = [...(last.tools ?? []), { name: ev.name, args: ev.args, done: false }]
  if (ev.type === "tool_result") {
    const tl = [...(last.tools ?? [])]
    if (tl.length) tl[tl.length - 1] = { ...tl[tl.length - 1], done: true, rejected: Boolean(ev.rejected) }
    last.tools = tl
  }
  if (ev.type === "error") { last.error = ev.error; last.streaming = false }
  if (ev.type === "done") last.streaming = false
  return cp
}
function AIPane({ toast, ask, t, lang, aiCtx, onClearCtx }) {
  // 会话真源在服务端 data/对话/（普通会话与资产会话分开存）；localStorage 只留激活 id 与模型选择
  const [sessions, setSessions] = useState([])
  const [activeId, setActiveId] = useState(() => {
    try { return localStorage.getItem("pwb_ai_active") ?? null } catch { return null }
  })
  const [archView, setArchView] = useState(false)
  const [listLoaded, setListLoaded] = useState(false)
  const migratedRef = useRef(false)
  // 相对时间戳（如"刚刚/5分钟前"）随空闲时间过期：30s 心跳强制刷新列表显示
  const [, setListTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setListTick((x) => x + 1), 30000)
    return () => clearInterval(id)
  }, [])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [cfg, setCfg] = useState(null)
  const [cfgOpen, setCfgOpen] = useState(false)
  const [cfgForm, setCfgForm] = useState(null)
  const [testState, setTestState] = useState(null)
  const [modelSel, setModelSel] = useState(() => {
    try { return localStorage.getItem("pwb_ai_model") ?? "" } catch { return "" }
  })
  const providerName = (cfg?.providers ?? []).find((p) => p.id === cfg?.provider)?.name ?? cfg?.provider ?? ""
  const scrollRef = useRef(null)
  const taRef = useRef(null)
  const autoGrowTa = () => { const el = taRef.current; if (!el) return; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 180) + "px" }
  const sessionsRef = useRef(sessions)
  sessionsRef.current = sessions
  const active = sessions.find((x) => x.id === activeId) ?? null
  const msgs = active?.msgs ?? []
  const persist = (list, id) => {
    setSessions(list)
    sessionsRef.current = list
    if (id !== undefined) { setActiveId(id); try { localStorage.setItem("pwb_ai_active", id ?? "") } catch {} }
  }
  useEffect(() => { api("/ai/config").then((d) => setCfg(d)).catch(() => setCfg({ supported: true })) }, [])
  // localStorage 旧会话一次性迁到服务端
  const migrateLocalSessions = async () => {
    if (migratedRef.current) return
    migratedRef.current = true
    let old = []
    try { old = JSON.parse(localStorage.getItem("pwb_ai_sessions_v1") ?? "[]") } catch {}
    if (!Array.isArray(old) || !old.length) return
    for (const s of old.slice(-80)) {
      if (!s?.id) continue
      try {
        await api(`/ai/sessions/${s.id}`, { method: "PUT", body: JSON.stringify({ title: s.title, asset: s.asset ?? null, created: s.created ?? s.updated, updated: s.updated ?? Date.now(), msgs: s.msgs ?? [] }) })
      } catch {}
    }
    try { localStorage.removeItem("pwb_ai_sessions_v1") } catch {}
    loadSessions(false)
  }
  const loadSessions = useCallback(async (view = archView) => {
    try {
      const d = await api(`/ai/sessions${view ? "?archived=1" : ""}`)
      setSessions(d.sessions)
      sessionsRef.current = d.sessions
      setListLoaded(true)
      if (!view) {
        setActiveId((cur) => (cur && d.sessions.some((x) => x.id === cur) ? cur : (d.sessions[0]?.id ?? null)))
        migrateLocalSessions()
      }
    } catch (e) { setListLoaded(true); toast(e.message, true) }
  }, [archView, toast])
  useEffect(() => { loadSessions() }, [loadSessions])
  const saveSession = async (session) => {
    if (!session) return
    try {
      await api(`/ai/sessions/${session.id}`, { method: "PUT", body: JSON.stringify({
        title: session.title, asset: session.asset ?? null,
        created: session.created ?? new Date().toISOString(), updated: Date.now(),
        msgs: session.msgs ?? [],
      }) })
    } catch (e) { toast(t("ai_persist_fail") + e.message, true) }
  }
  const archiveSession = async (id, unarchive) => {
    try {
      await api(`/ai/sessions/${id}/${unarchive ? "unarchive" : "archive"}`, { method: "POST", body: "{}" })
    } catch (e) { toast(e.message, true); return }
    if (unarchive) setArchView(false)
    else loadSessions(true)
  }
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight }, [msgs, streaming])
  // 模型选择兜底：配置加载后，未选择则用 activeModel/首个
  useEffect(() => {
    if (!modelSel && cfg?.models?.length) {
      const m = cfg.activeModel && cfg.models.includes(cfg.activeModel) ? cfg.activeModel : cfg.models[0]
      setModelSel(m)
      try { localStorage.setItem("pwb_ai_model", m) } catch {}
    }
  }, [cfg, modelSel])
  // 资产上下文：每次从资产发起都开一条**全新**会话（同资产的多次发起互不混串；
  // 旧会话留在侧栏，仍按资产分目录存放，点侧栏可回看）
  useEffect(() => {
    if (!aiCtx) return
    const s = { id: aiUid(), title: aiCtx.name, asset: { ...aiCtx }, msgs: [], updated: Date.now(), created: Date.now() }
    const list = sessionsRef.current
    setSessions([...list, s])
    setActiveId(s.id)
    try { localStorage.setItem("pwb_ai_active", s.id) } catch {}
    saveSession(s)
  }, [aiCtx])
  // 首次进入：没有选中会话则选最近更新的一个
  useEffect(() => {
    if (activeId || !sessions.length) return
    const latest = [...sessions].sort((a, b) => b.updated - a.updated)[0]
    if (latest) setActiveId(latest.id)
  }, [sessions, activeId])
  const toolLabel = (name) => (TOOL_LABELS[name] ? t(TOOL_LABELS[name]) : name)
  const saveCfg = async () => {
    try {
      const d = await api("/ai/config", { method: "PUT", body: JSON.stringify(cfgForm) })
      setCfg(d); setCfgOpen(false)
      toast(t("ai_cfg_saved"))
    } catch (e) { toast(e.message, true) }
  }
  const runTest = async () => {
    setTestState({ ok: null, text: t("ai_testing") })
    try {
      const d = await api("/ai/test", { method: "POST", body: JSON.stringify({ ...cfgForm, model: modelSel }) })
      setTestState(d.ok ? { ok: true, text: t("ai_test_ok", { ms: d.ms }) + (d.reply ? " · " + d.reply : "") } : { ok: false, text: t("ai_test_fail") + " " + (d.error ?? "") })
    } catch (e) { setTestState({ ok: false, text: e.message }) }
  }
  const openCfg = () => {
    setCfgForm({
      provider: cfg?.provider ?? "deepseek", mode: cfg?.mode ?? "openai",
      baseURL: cfg?.baseURL ?? "", key: "", models: cfg?.models ?? [], activeModel: cfg?.activeModel ?? "",
      hasKey: cfg?.hasKey ?? false,
    })
    setTestState(null)
    setCfgOpen(true)
  }
  const pickProvider = (id) => {
    const p = (cfg?.providers ?? []).find((x) => x.id === id)
    setCfgForm((f) => ({ ...f, provider: id, mode: p?.mode ?? f.mode,
      baseURL: p?.baseURL ?? "",
      models: p?.models ?? [],
      activeModel: p?.models?.[0] ?? "",
      key: f.key }))
  }
  const newSession = () => {
    if (streaming) return
    const s = { id: aiUid(), title: t("ai_new_chat"), msgs: [], updated: Date.now(), created: Date.now() }
    persist([...sessionsRef.current, s], s.id)
    saveSession(s) // 新建对话也要保存，除非删除或归档
  }
  const delSession = async (id) => {
    const s = sessionsRef.current.find((x) => x.id === id)
    const ok = await ask.confirm({ title: t("ai_del_session"), danger: true, okText: t("ok_del"), message: t("ai_del_session_msg", { name: s?.title ?? "" }) })
    if (!ok) return
    try { await api(`/ai/sessions/${id}`, { method: "DELETE" }) } catch (e) { toast(e.message, true); return }
    const next = sessionsRef.current.filter((x) => x.id !== id)
    const fallback = next.sort((a, b) => b.updated - a.updated)[0]
    persist(next, fallback ? fallback.id : null)
  }
  const answerConfirm = async (id, approved) => {
    try { await api("/ai/confirm", { method: "POST", body: JSON.stringify({ id, approved }) }) } catch (e) { toast(e.message, true); return }
    setSessions((list) => list.map((x) => x.id === activeId ? { ...x, msgs: x.msgs.map((m) => (m.confirm && m.confirm.id === id ? { ...m, confirm: { ...m.confirm, state: approved ? "approved" : "rejected" } } : m)) } : x))
  }
  const send = async () => {
    const text = input.trim()
    if (!text || streaming) return
    if (!cfg?.hasKey) { openCfg(); return }
    let sid = activeId
    if (!sid || !sessionsRef.current.some((x) => x.id === sid)) {
      const s = { id: aiUid(), title: text.slice(0, 24), msgs: [], updated: Date.now() }
      setSessions([...sessionsRef.current, s]); sid = s.id; setActiveId(s.id)
    }
    const userMsg = { role: "user", content: text }
    // 必须先落一条 assistant 占位：流式 delta/tool/error 事件都打在"最后一条消息必须是 assistant"上，
    // 没有占位时 applyEv 会全部丢弃——这正是"对话没有任何回应"的根因
    const placeholder = { role: "assistant", content: "", streaming: true }
    setSessions((list) => list.map((x) => x.id === sid ? { ...x, msgs: [...x.msgs, userMsg, placeholder], title: x.msgs.length ? x.title : text.slice(0, 24), updated: Date.now() } : x))
    setInput("")
    requestAnimationFrame(() => { const el = taRef.current; if (el) el.style.height = "auto" })
    setStreaming(true)
    try {
      const res = await fetch(API + "/ai/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: [...historyOf(sid), userMsg], asset: active?.asset ?? undefined, model: modelSel ?? undefined }) })
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ""
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        let i
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).trim()
          buf = buf.slice(i + 1)
          if (!line.startsWith("data:")) continue
          let ev
          try { ev = JSON.parse(line.slice(5)) } catch { continue }
          setSessions((list) => list.map((x) => x.id === sid ? { ...x, msgs: applyEv(x.msgs, ev), updated: Date.now() } : x))
          if (ev.type === "confirm") {
            fetch(API + "/ai/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: ev.id, approved: true }) }).catch(() => {})
          }
        }
      }
    } catch (e) {
      setSessions((list) => list.map((x) => x.id === sid ? { ...x, msgs: applyEv(x.msgs, { type: "error", error: String(e.message ?? e) }) } : x))
    } finally {
      setStreaming(false)
      const cur = sessionsRef.current.find((x) => x.id === sid)
      if (cur) saveSession(cur)
    }
  }
  const historyOf = (sid) => (sessionsRef.current.find((x) => x.id === sid)?.msgs ?? [])
  return (
    <div className="ai-layout">
      <div className="ai-side">
        <button className="primary ai-new" onClick={newSession} disabled={streaming}><Icon name="plus" size={14} />{t("ai_new_chat")}</button>
        <div className="row" style={{ padding: "0 2px 4px" }}>
          <span className={"chip" + (!archView ? " on" : "")} style={{ margin: 0 }} onClick={() => setArchView(false)}>{t("ai_sessions_view")}</span>
          <span className={"chip" + (archView ? " on" : "")} style={{ margin: 0 }} onClick={() => setArchView(true)}>{t("ai_archived_view")}</span>
        </div>
        {sessions.length ? (
          <div className="ai-sessions">
            {[...sessions].sort((a, b) => b.updated - a.updated).map((s) => (
              <div key={s.id} className={"ai-session" + (s.id === activeId && !archView ? " on" : "")}
                onClick={() => { if (archView) return; setActiveId(s.id); try { localStorage.setItem("pwb_ai_active", s.id) } catch {} }}>
                <div className="ai-session-title">{s.asset ? <Icon name="server" size={12} /> : <Icon name="edit" size={12} />}{esc(s.title)}</div>
                <div className="ai-session-meta">
                  <span>{relTime(s.updated)}</span>
                  <button className="ibtn sm" title={archView ? t("ai_unarchive") : t("ai_archive")}
                    onClick={(ev) => { ev.stopPropagation(); archiveSession(s.id, archView) }}><Icon name="archive" size={11} /></button>
                  <button className="ibtn sm red" title={t("ai_del_session")} onClick={(ev) => { ev.stopPropagation(); delSession(s.id) }}><Icon name="trash" size={11} /></button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted" style={{ padding: "8px 4px" }}>{listLoaded ? (archView ? t("ai_archived_view") : t("ai_no_sessions")) : "…"}</div>
        )}
      </div>
      <div className="ai-main">
        {active ? (
          <>
            <div className="row" style={{ marginBottom: 8 }}>
              <b className="ai-cur-title">{esc(active.title)}</b>
              {active.asset ? <span className="badge">{esc(active.asset.host ? active.asset.name + " · " + active.asset.host : active.asset.name)}</span> : null}
            </div>
          </>
        ) : null}
        <div className="ai-msgs" ref={scrollRef}>
          <div className="ai-msgs-inner">
          {msgs.length ? msgs.map((m, mi) => (
            <div key={mi} className={"ai-msg " + m.role}>
              <div className="ai-avatar">{m.role === "user" ? <Icon name="dot" size={12} /> : <Icon name="flame" size={14} />}</div>
              <div className="ai-bubble">
                {(m.tools ?? []).length ? (
                  <div className="ai-tools">
                    {m.tools.map((tl, ti) => (
                      <div key={ti} className={"ai-tool" + (tl.done ? " done" : "")}>
                        <Icon name={tl.done ? "check" : "refresh"} size={11} />
                        <span>{toolLabel(tl.name)}{tl.done ? " ✓" : "…"}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {m.role === "assistant" ? <div className="ai-md" dangerouslySetInnerHTML={{ __html: mdLite(m.content || (m.streaming ? "…" : "")) }} /> : <div className="ai-utext">{esc(m.content)}</div>}
                {m.confirm ? (
                  <div className="ai-confirm">
                    <div className="ai-confirm-title"><Icon name="alert" size={13} />{t("confirm_title")}</div>
                    <div className="ai-confirm-body">{esc(m.confirm.summary)}</div>
                    {m.confirm.state === "pending" ? (
                      <div className="row" style={{ justifyContent: "flex-end", gap: 6, marginTop: 8 }}>
                        <button className="mini" onClick={() => answerConfirm(m.confirm.id, false)}>{t("confirm_reject")}</button>
                        <button className="mini primary" onClick={() => answerConfirm(m.confirm.id, true)}>{t("confirm_approve")}</button>
                      </div>
                    ) : (
                      <div className="muted" style={{ marginTop: 6 }}>{m.confirm.state === "approved" ? "✓ 已批准" : "✕ 已拒绝"}</div>
                    )}
                  </div>
                ) : null}
                {m.error ? <div className="ai-err">{esc(m.error)}</div> : null}
              </div>
              {m.streaming && m.role === "assistant" ? <span className="ai-cursor" /> : null}
            </div>
          )) : (
            <Empty icon="flame" text={t("ai_welcome")} />
          )}
          </div>
        </div>
        <div className="ai-input">
          <div className="ai-input-box">
            <textarea ref={taRef} rows={3} className="ai-ta" placeholder={cfg && !cfg.hasKey ? t("ai_need_cfg_first") : t("ai_ph")} value={input} disabled={streaming}
              onChange={(e) => { setInput(e.target.value); autoGrowTa() }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }} />
            <div className="ai-input-actions">
              {providerName ? <span className="muted" style={{ marginRight: 2, whiteSpace: "nowrap" }} title={t("ai_provider")}>{esc(providerName)}</span> : null}
              <select className="ai-model-sel" value={modelSel} title={t("ai_model")}
                onChange={(e) => { setModelSel(e.target.value); try { localStorage.setItem("pwb_ai_model", e.target.value) } catch {} }}>
                {(cfg?.models ?? []).map((m) => <option key={m} value={m}>{esc(m)}</option>)}
                {modelSel && !(cfg?.models ?? []).includes(modelSel) ? <option value={modelSel}>{esc(modelSel)}</option> : null}
              </select>
              <button className="ibtn sm" title={t("ai_config")} onClick={openCfg}><Icon name="sliders" size={14} /></button>
              <button className="primary ai-send" title={t("ai_send")} disabled={streaming || !input.trim()} onClick={send}>{t("ai_send")}</button>
            </div>
          </div>
        </div>
      </div>
      {cfgOpen && cfgForm ? (
        <Modal title={t("ai_config")} wide onClose={() => setCfgOpen(false)}>
          <div className="field"><label>{t("ai_provider")}</label>
            <select value={cfgForm.provider} onChange={(e) => pickProvider(e.target.value)}>
              {(cfg?.providers ?? []).map((p) => <option key={p.id} value={p.id}>{esc(p.name)}</option>)}
            </select></div>
          <div className="field"><label>{t("ai_mode")}</label>
            <select value={cfgForm.mode} onChange={(e) => setCfgForm({ ...cfgForm, mode: e.target.value })}>
              <option value="openai">OpenAI 兼容</option>
              <option value="anthropic">Claude 原生</option>
            </select></div>
          <div className="field"><label>{t("ai_baseurl")}</label><input value={cfgForm.baseURL} placeholder="https://…" onChange={(e) => setCfgForm({ ...cfgForm, baseURL: e.target.value })} /></div>
          <div className="field"><label>{t("ai_key")}</label><input type="password" placeholder={cfgForm.hasKey ? t("ai_key_keep") : ""} value={cfgForm.key} onChange={(e) => setCfgForm({ ...cfgForm, key: e.target.value })} /></div>
          <div className="field"><label>{t("ai_models")}</label>
            <div className="ai-models-edit">
              {cfgForm.models.map((m) => (
                <span key={m} className="ai-model-chip">{esc(m)}
                  <button className="ibtn sm" title={t("del")} onClick={() => setCfgForm({ ...cfgForm, models: cfgForm.models.filter((x) => x !== m) })}><Icon name="x" size={10} /></button>
                </span>
              ))}
              <input className="ai-model-add" placeholder={t("ai_model_ph")} value={cfgForm.newModel ?? ""}
                onChange={(e) => setCfgForm({ ...cfgForm, newModel: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter" && e.target.value.trim()) { const v = e.target.value.trim(); if (!cfgForm.models.includes(v)) setCfgForm({ ...cfgForm, models: [...cfgForm.models, v], newModel: "" }); e.target.value = "" } }} />
              <button className="mini" onClick={() => { const v = (cfgForm.newModel ?? "").trim(); if (v && !cfgForm.models.includes(v)) setCfgForm({ ...cfgForm, models: [...cfgForm.models, v], newModel: "" }) }}>{t("add_model")}</button>
            </div>
          </div>
          <div className="row" style={{ justifyContent: "space-between", marginTop: 4 }}>
            <button className="mini" onClick={runTest} disabled={!cfgForm.baseURL || !cfgForm.key || !cfgForm.models.length}><Icon name="refresh" size={12} />{t("ai_test")}</button>
            {testState ? <span className="muted" style={{ color: testState.ok === false ? "var(--pwb-bad-fg)" : testState.ok ? "var(--pwb-ok-fg)" : "var(--pwb-muted)" }}>{esc(testState.text ?? "")}</span> : null}
          </div>
          <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
            <button onClick={() => setCfgOpen(false)}>{t("cancel")}</button>
            <button className="primary" onClick={saveCfg}>{t("save")}</button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

/* ============ 主面板 ============ */
const TABS = [
  { id: "apps", labelKey: "tab_apps", icon: "rocket" },
  { id: "todo", labelKey: "tab_todo", icon: "checkCircle" },
  { id: "nav", labelKey: "tab_nav", icon: "compass" },
  { id: "assets", labelKey: "tab_assets", icon: "server" },
  { id: "note", labelKey: "tab_note", icon: "edit" },
  { id: "keys", labelKey: "tab_keys", icon: "lock" },
  { id: "ai", labelKey: "tab_ai", icon: "flame" },
]

export function WorkbenchPanel() {
  const [tab, setTab] = useState(() => {
    try {
      const fromUrl = new URLSearchParams(location.search).get("tab")
      return localStorage.getItem("pwb_tab") || (fromUrl && ["apps", "todo", "nav", "assets", "note", "keys", "ai"].includes(fromUrl) ? fromUrl : "apps")
    } catch { return "apps" }
  })
  const [toast, setToast] = useState(null)
  const [dlg, setDlg] = useState(null)
  const [pref, setPref] = useState(false)
  const { mode, dark, set } = useTheme()
  const [accent, setAccent] = useState(() => {
    try { return localStorage.getItem("pwb_accent") === "pink" ? "pink" : "blue" } catch { return "blue" }
  })
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem("pwb_lang") === "en" ? "en" : "zh" } catch { return "zh" }
  })
  const t = useMemo(() => makeT(lang), [lang])
  useEffect(() => { document.title = t("app_name") }, [t])
  const show = useCallback((msg, err) => {
    setToast({ msg, err })
    setTimeout(() => setToast(null), err ? 4200 : 2200)
  }, [])
  const [autostart, setAutostart] = useState(null)
  useEffect(() => { api("/autostart").then((d) => setAutostart(d)).catch(() => setAutostart({ supported: false })) }, [])
  const toggleAutostart = async (on) => {
    try { setAutostart(await api("/autostart", { method: "PUT", body: JSON.stringify({ enabled: on }) })) }
    catch (e) { show(e.message, true) }
  }
  // 断线看门狗：连续 2 次健康检查失败 → 横幅提示；恢复后 toast 并整页刷新（离线期间操作本就无法保存）。
  const [connLost, setConnLost] = useState(false)
  const connFails = useRef(0)
  useEffect(() => {
    let alive = true
    let timer = null
    const ping = async () => {
      if (!alive) return
      try {
        const r = await fetch(API + "/health", { signal: AbortSignal.timeout(3000) })
        if (!r.ok) throw new Error("bad status")
        const recovered = connFails.current >= 2
        connFails.current = 0
        if (recovered) {
          setConnLost(false)
          show(t("conn_restored"))
          setTimeout(() => { if (alive) location.reload() }, 900)
          return
        }
        timer = setTimeout(ping, 8000)
      } catch {
        connFails.current++
        if (connFails.current >= 2) setConnLost(true)
        timer = setTimeout(ping, 3000)
      }
    }
    timer = setTimeout(ping, 8000)
    return () => { alive = false; clearTimeout(timer) }
  }, [t, show])
  const go = (next) => {
    setTab(next)
    try { localStorage.setItem("pwb_tab", next) } catch {}
  }
  // Promise 风格对话框：await ask.confirm({...}) / await ask.prompt({...})
  const ask = useMemo(() => ({
    confirm: (o) => new Promise((res) => setDlg({ kind: "confirm", id: rid(), ...o, resolve: res })),
    prompt: (o) => new Promise((res) => setDlg({ kind: "prompt", id: rid(), ...o, resolve: res })),
  }), [])
  const closeDlg = useCallback((v) => {
    setDlg((d) => { if (d) d.resolve(v); return null })
  }, [])
  const pickAccent = (a) => {
    setAccent(a)
    try { localStorage.setItem("pwb_accent", a) } catch {}
  }
  const pickLang = (l) => {
    setLang(l)
    try { localStorage.setItem("pwb_lang", l) } catch {}
  }
  // 资产卡片的 AI 对话入口：携带资产上下文切到 AI 页
  const [aiCtx, setAiCtx] = useState(null)
  const openAssetChat = (a) => {
    setAiCtx({ name: a.name, host: a.host, port: a.port, grp: a.grp, note: a.note, status: a.last_status || "未检" })
    go("ai")
  }
  const cls = "pwb" + (dark ? " pwb-dark" : "") + (accent === "pink" ? " pwb-pink" : "") + (tab === "ai" ? " ai-page" : "")
  return (
    <div className={cls}>
      <style>{CSS}</style>
      <div className="pwb-topbar">
        <div className="pwb-brand"><BrandMark /><b>{t("app_name")}</b></div>
        <div className="pwb-seg" role="tablist">
          {TABS.map((x) => (
            <button key={x.id} role="tab" aria-selected={tab === x.id} title={t(x.labelKey)}
              className={"pwb-seg-item" + (tab === x.id ? " on" : "")} onClick={() => go(x.id)}>
              <Icon name={x.icon} size={15} /><span>{t(x.labelKey)}</span>
            </button>
          ))}
        </div>
        <div className="spacer" />
        <button className={"ibtn" + (pref ? " on" : "")} title={t("appearance")} onClick={() => setPref((v) => !v)}>
          <Icon name="sliders" size={16} />
        </button>
        {pref ? createPortal(
          <>
            <div className="pwb-pop-overlay" onMouseDown={() => setTimeout(() => setPref(false), 0)} />
            <div className="pwb-pop">
              <div className="pwb-pop-row">
                <div className="pwb-pop-title">{t("appearance")}</div>
                <div className="pwb-seg mini" style={{ display: "flex" }}>
                  {[["auto", t("auto"), "contrast"], ["light", t("light"), "sun"], ["dark", t("dark"), "moon"]].map(([m, label, ic]) => (
                    <button key={m} style={{ flex: 1 }} className={"pwb-seg-item" + (mode === m ? " on" : "")} onClick={() => set(m)}>
                      <Icon name={ic} size={12} /><span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="pwb-pop-row">
                <div className="pwb-pop-title">{t("theme_color")}</div>
                <div className="pwb-swatches">
                  <button className={"pwb-swatch" + (accent === "blue" ? " on" : "")} onClick={() => pickAccent("blue")}>
                    <i style={{ background: "linear-gradient(135deg,#4da3ff,#0053b8)" }} />
                    <span>{t("blue")}</span>
                    {accent === "blue" ? <Icon name="check" size={13} /> : null}
                  </button>
                  <button className={"pwb-swatch" + (accent === "pink" ? " on" : "")} onClick={() => pickAccent("pink")}>
                    <i style={{ background: "linear-gradient(135deg,#ff8ab5,#cc3572)" }} />
                    <span>{t("pink")}</span>
                    {accent === "pink" ? <Icon name="check" size={13} /> : null}
                  </button>
                </div>
              </div>
              <div className="pwb-pop-row">
                <div className="pwb-pop-title">{t("language")}</div>
                <div className="pwb-seg mini" style={{ display: "flex" }}>
                  {[["zh", "中文"], ["en", "English"]].map(([l, label]) => (
                    <button key={l} style={{ flex: 1 }} className={"pwb-seg-item" + (lang === l ? " on" : "")} onClick={() => pickLang(l)}>{label}</button>
                  ))}
                </div>
              </div>
              {autostart?.supported !== false ? (
                <div className="pwb-pop-row">
                  <div className="row" style={{ justifyContent: "space-between", gap: 8 }} title={t("autostart_tip")}>
                    <span className="muted" style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{t("autostart")}</span>
                    <Switch on={!!autostart?.enabled} onChange={toggleAutostart} />
                  </div>
                </div>
              ) : null}
            </div>
          </>,
          portalTarget()
        ) : null}
      </div>
      <div className="pwb-body" key={tab}>
        {tab === "apps" ? <AppsPane toast={show} ask={ask} t={t} /> : tab === "todo" ? <TodoPane toast={show} ask={ask} t={t} lang={lang} /> : tab === "nav" ? <NavPane toast={show} ask={ask} t={t} /> : tab === "assets" ? <AssetsPane toast={show} ask={ask} t={t} onAiChat={openAssetChat} /> : tab === "note" ? <NotesPane toast={show} t={t} lang={lang} /> : tab === "keys" ? <KeysPane toast={show} ask={ask} t={t} /> : <AIPane toast={show} ask={ask} t={t} lang={lang} aiCtx={aiCtx} onClearCtx={() => setAiCtx(null)} />}
      </div>
      {connLost ? <div className="pwb-conn"><Icon name="refresh" size={13} /><span>{t("conn_lost")}</span></div> : null}
      {toast ? <div className={"pwb-toast" + (toast.err ? " err" : "")}><Icon name={toast.err ? "alert" : "checkCircle"} size={15} /><span>{esc(toast.msg)}</span></div> : null}
      {dlg ? <Dialog key={dlg.id} dlg={dlg} onDone={closeDlg} t={t} /> : null}
    </div>
  )
}
