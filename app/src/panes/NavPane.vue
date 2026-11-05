<script setup lang="ts">
// 导航面板：分类链接 + 全部分组视图 + 书签 HTML 导入导出。
// 死链检查：浏览器端 fetch（桌面 WebView 无 CORS 限制是误区——仍受限；此功能在下轮接 Rust 侧实现，先保留 UI）
import { computed, inject, onMounted, ref, type ComputedRef } from "vue"
import { call, ApiError, type NavPayload, type NavDoc } from "../lib/api"
import { toast, askConfirm, askPrompt } from "../lib/ui"
import { today } from "../lib/date"
import type { T } from "../i18n"
import Icon from "../components/Icon.vue"

const t = inject<ComputedRef<T>>("t")!

const nav = ref<NavDoc | null>(null)
const hash = ref("")
const cur = ref(-1)
const adding = ref(false)
const form = ref({ title: "", url: "", cat: 0 })

onMounted(load)
async function load() {
  try {
    const d = await call<NavPayload>("nav_get")
    hash.value = d.hash
    nav.value = d.nav?.categories?.length ? d.nav : { categories: [] }
  } catch (e) {
    toast(String((e as Error).message), true)
  }
}

// 与 Obsidian 共写 导航.md：保存带哈希，外部改动过就报冲突并自动回读
const persist = async (next: NavDoc) => {
  nav.value = next
  try {
    const d = await call<{ hash: string }>("nav_put", { nav: next, baseHash: hash.value })
    hash.value = d.hash
  } catch (e) {
    const err = e as ApiError
    if (err.currentNav !== undefined) {
      const current = err.currentNav as NavDoc
      hash.value = err.currentHash ?? ""
      nav.value = current?.categories?.length ? current : { categories: [] }
      toast(t.value("conflict_nav"), true)
    } else toast(err.message, true)
  }
}

const cats = computed(() => nav.value?.categories ?? [])
const viewingAll = computed(() => cur.value === -1)
const activeCat = computed(() => cats.value[cur.value] ?? null)
const allCount = computed(() => cats.value.reduce((n, c) => n + (c.links?.length ?? 0), 0))

// 在系统默认浏览器里打开：WebView 里 window.open 会被 Tauri 拦成新窗口/直接失效
const openLink = async (url: string) => {
  const target = /^https?:\/\//i.test(url) ? url : "https://" + url
  try {
    await call("open_external", { url: target })
  } catch (e) {
    toast(String((e as Error).message ?? e), true)
  }
}

const host = (u: string) => {
  try {
    return new URL(u).hostname
  } catch {
    return ""
  }
}

const addCat = async () => {
  const name = await askPrompt({ title: t.value("new_cat_title"), placeholder: t.value("cat_ph") })
  if (typeof name !== "string" || !name.trim()) return
  persist({ categories: [...cats.value, { name: name.trim(), links: [] }] })
}

const delCat = async (i: number) => {
  const ok = await askConfirm({
    title: t.value("del_cat_title"),
    danger: true,
    okText: t.value("ok_del"),
    message: t.value("del_cat_msg", { name: cats.value[i].name, n: cats.value[i].links?.length ?? 0 }),
  })
  if (!ok) return
  cur.value = 0
  persist({ categories: cats.value.filter((_, j) => j !== i) })
}

const addLink = () => {
  if (!form.value.title.trim() || !form.value.url.trim()) return
  let url = form.value.url.trim()
  if (!/^https?:\/\//i.test(url)) url = "https://" + url
  const next = { categories: cats.value.map((c, i) => (i === form.value.cat ? { ...c, links: [...(c.links ?? []), { title: form.value.title.trim(), url }] } : c)) }
  adding.value = false
  form.value = { title: "", url: "", cat: form.value.cat }
  persist(next)
}

const delLink = (ci: number, li: number) => {
  persist({ categories: cats.value.map((c, i) => (i === ci ? { ...c, links: (c.links ?? []).filter((_, j) => j !== li) } : c)) })
}

// 导出为 Netscape 书签 HTML
const exportHtml = () => {
  const escH = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  const now = Math.floor(Date.now() / 1000)
  let body = ""
  for (const c of cats.value) {
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
  toast(t.value("exported", { cats: cats.value.length, links: allCount.value }))
}

// 导入 Netscape 书签 HTML：追加合并（重名分类归并、按 URL 去重）
const importHtml = () => {
  const inp = document.createElement("input")
  inp.type = "file"
  inp.accept = ".html,.htm,text/html"
  inp.onchange = async () => {
    try {
      const text = await inp.files![0].text()
      const doc = new DOMParser().parseFromString(text, "text/html")
      const rootDl = doc.querySelector("body dl") || doc.querySelector("dl")
      if (!rootDl) throw new Error(t.value("err_no_dl"))
      const TRANSPARENT = /^(书签栏|书签菜单|收藏夹栏|其他书签|其他收藏夹|移动设备书签|bookmarks?( bar)?|favorites( bar)?|mobile bookmarks|imported.*|已导入.*)$/i
      const out = { cats: new Map<string, { url: string; title: string }[]>(), order: [] as string[] }
      const walk = (dl: Element, bucket: string, childPrefix: string, depth: number) => {
        if (!out.cats.has(bucket)) {
          out.cats.set(bucket, [])
          out.order.push(bucket)
        }
        const curBucket = out.cats.get(bucket)!
        const children = [...dl.children]
        for (let i = 0; i < children.length; i++) {
          const el = children[i]
          if (el.tagName !== "DT") continue
          const h3 = el.querySelector(":scope > h3")
          const a = el.querySelector(":scope > a")
          let nested = el.querySelector(":scope > dl")
          if (!nested) {
            for (let j = i + 1; j < children.length; j++) {
              if (children[j].tagName === "DL") {
                nested = children[j]
                i = j
                break
              }
              if (children[j].tagName === "DT") break
            }
          }
          if (h3 && nested) {
            const name = (h3.textContent || "").trim() || "Untitled"
            if (depth === 0 && TRANSPARENT.test(name)) walk(nested, name, childPrefix, depth)
            else {
              const full = childPrefix + name
              walk(nested, full, full + "/", depth + 1)
            }
          } else if (a) {
            const url = a.getAttribute("href") || ""
            if (/^https?:/i.test(url)) curBucket.push({ url, title: ((a.textContent || "").trim() || url).slice(0, 200) })
          }
        }
      }
      walk(rootDl, "导入书签", "", 0)
      const imported = out.order.map((name) => ({ name, links: out.cats.get(name)! })).filter((c) => c.links.length)
      if (!imported.length) throw new Error(t.value("err_no_links"))
      const urlKey = (u: string) => u.replace(/\/+$/, "").replace(/^https?:\/\//i, "").toLowerCase()
      const next = { categories: cats.value.map((c) => ({ ...c, links: [...(c.links ?? [])] })) }
      let newCats = 0, newLinks = 0, dup = 0
      for (const c of imported) {
        let cat = next.categories.find((x) => x.name === c.name)
        if (!cat) {
          cat = { name: c.name, links: [] }
          next.categories.push(cat)
          newCats++
        }
        const have = new Set(cat.links.map((l) => urlKey(l.url)))
        for (const l of c.links) {
          const k = urlKey(l.url)
          if (have.has(k)) {
            dup++
            continue
          }
          cat.links.push({ title: l.title, url: l.url })
          have.add(k)
          newLinks++
        }
      }
      persist(next)
      toast(t.value("imported") + ` +${newCats} +${newLinks}` + (dup ? ` (-${dup})` : ""))
    } catch (e) {
      toast(t.value("import_fail") + String((e as Error).message), true)
    }
  }
  inp.click()
}

const letterAvatar = (name: string) => {
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  const ch = (name[0] || "?").toUpperCase()
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(${hue},72%,60%)'/><stop offset='1' stop-color='hsl(${(hue + 46) % 360},68%,44%)'/></linearGradient></defs><rect width='32' height='32' rx='8' fill='url(#g)'/><text x='16' y='22' font-size='15' font-family='sans-serif' font-weight='600' fill='white' text-anchor='middle'>${ch}</text></svg>`
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg)
}

const onImgErr = (ev: Event) => {
  ;(ev.currentTarget as HTMLImageElement).src = letterAvatar("?")
}
</script>

<template>
  <div v-if="nav">
    <div class="row" style="margin-bottom: 10px; flex-wrap: wrap">
      <button class="primary" @click="form = { ...form, cat: viewingAll ? 0 : cur }; adding = true">
        <Icon name="plus" :size="14" />{{ t("add_link") }}
      </button>
      <button @click="addCat"><Icon name="plus" :size="14" />{{ t("add_cat") }}</button>
      <button class="mini" :disabled="viewingAll || !activeCat" @click="activeCat && delCat(cur)">{{ t("del_cat") }}</button>
      <div class="spacer" />
      <button class="ghost mini" :title="t('export_t')" @click="exportHtml">{{ t("export_btn") }}</button>
      <button class="ghost mini" :title="t('import_t')" @click="importHtml">{{ t("import_btn") }}</button>
    </div>
    <div class="nav-chips">
      <span class="nav-chip" :class="{ on: viewingAll }" :title="t('all_tip')" @click="cur = -1">
        {{ t("all") }} <span class="muted">{{ allCount }}</span>
      </span>
      <span v-for="(c, i) in cats" :key="c.name + i" class="nav-chip" :class="{ on: i === cur }"
        :title="t('dbl_del_cat')" @click="cur = i" @dblclick="delCat(i)">
        {{ c.name }} <span class="muted">{{ c.links?.length ?? 0 }}</span>
      </span>
      <span v-if="!cats.length" class="muted">{{ t("no_cats") }}</span>
    </div>

    <template v-if="viewingAll">
      <template v-if="cats.length">
        <div v-for="(c, ci) in cats" :key="c.name + ci">
          <div class="appsec"><Icon name="folder" :size="13" />{{ c.name }} <span class="muted">{{ c.links?.length ?? 0 }}</span></div>
          <div v-if="(c.links ?? []).length" class="linkgrid">
            <div v-for="(l, li) in c.links" :key="li" class="linkcard" @click="openLink(l.url)" :title="l.url">
              <img class="letter-ava" :src="letterAvatar(host(l.url))" alt="" @error="onImgErr">
              <span class="t">{{ l.title }}</span>
              <button class="ibtn sm x" :title="t('del')" @click.stop="delLink(ci, li)"><Icon name="x" :size="11" /></button>
            </div>
          </div>
          <div v-else class="empty small"><Icon name="compass" :size="13" /><span>{{ t("no_links_cat") }}</span></div>
        </div>
      </template>
      <div v-else class="empty"><Icon name="compass" :size="22" /><span>{{ t("no_links_all") }}</span></div>
    </template>
    <template v-else-if="activeCat">
      <div v-if="(activeCat.links ?? []).length" class="linkgrid">
        <div v-for="(l, li) in activeCat.links" :key="li" class="linkcard" @click="openLink(l.url)" :title="l.url">
          <img class="letter-ava" :src="letterAvatar(host(l.url))" alt="" @error="onImgErr">
          <span class="t">{{ l.title }}</span>
          <button class="ibtn sm x" :title="t('del')" @click.stop="delLink(cur, li)"><Icon name="x" :size="11" /></button>
        </div>
      </div>
      <div v-else class="empty"><Icon name="compass" :size="22" /><span>{{ t("no_links_cat") }}</span></div>
    </template>

    <div v-if="adding" class="pwb-modal-bg" @mousedown.self="adding = false">
      <div class="pwb-modal" @keydown.esc="adding = false">
        <div class="pwb-modal-head"><h3>{{ t("add_link_title") }}</h3>
          <button class="ibtn" @click="adding = false"><Icon name="x" :size="14" /></button>
        </div>
        <div class="row" style="margin-bottom: 10px"><label style="width: 42px; text-align: right" class="muted">{{ t("name") }}</label>
          <input v-model="form.title" style="flex: 1" @keydown.enter="addLink"></div>
        <div class="row" style="margin-bottom: 10px"><label style="width: 42px; text-align: right" class="muted">{{ t("url_label") }}</label>
          <input v-model="form.url" style="flex: 1" placeholder="https://…" @keydown.enter="addLink"></div>
        <div class="row" style="margin-bottom: 10px"><label style="width: 42px; text-align: right" class="muted">{{ t("category") }}</label>
          <select v-model.number="form.cat" style="flex: 1">
            <option v-for="(c, i) in cats" :key="c.name + i" :value="i">{{ c.name }}</option>
          </select></div>
        <div class="row" style="justify-content: flex-end">
          <button @click="adding = false">{{ t("cancel") }}</button>
          <button class="primary" @click="addLink">{{ t("save") }}</button>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="muted">…</div>
</template>
