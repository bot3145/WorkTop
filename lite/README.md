# WorkTop Lite

[English](README.md) | [简体中文](README.zh-CN.md)

**A local-first personal workbench made of your own Markdown files.**

App launcher, todo board & calendar, bookmarks with dead-link checking, server assets & credentials (optional passphrase encryption), quick notes, key documents, and a built-in AI assistant — all backed by plain Markdown you can open and edit in Obsidian, VS Code, or any text editor. No database, no vendor lock-in, zero runtime dependencies.

MIT Licensed · Node ≥ 18 · Windows first (macOS/Linux for the web parts)

## Why

Most personal dashboards lock your data in a database or a proprietary cloud. WorkTop takes the opposite path: **the data layer *is* your file system**. Every module reads and writes a plain Markdown document, so your workbench is versionable with git, searchable from anywhere, editable by hand, and never held hostage.

## Modules

| Module | What it does | Data file |
|---|---|---|
| **Apps** | One-page launcher for a folder of `.lnk` / `.url` shortcuts — click to start, pin favorites | Your own shortcuts folder |
| **Todo** | Markdown checklist (`- [ ] item #tag @2026-01-31`): kanban board + **calendar** (month/week views, drag an item to another day to reschedule, overdue in red, today highlighted, today/this-week/this-month/all filters, day details) + tag tracking | `data/待办.md` |
| **Nav** | Categorized bookmarks with an all-links grouped view, one-click dead-link checking, and browser bookmark HTML import/export (Edge/Chrome/Firefox compatible, append-merge with URL dedup) | `data/导航.md` |
| **Assets** | Fixed-size server cards (TCP probing, long names ellipsized) — click one to open a **detail modal** with credentials (password / private key / token: view, copy, edit, delete), related links, group rename and asset editing. Credentials live in a separate file and can be **encrypted with a master passphrase** | `data/资产.md` + `data/凭据.md` |
| **Notes** | flomo-style quick capture (type & Enter, auto timestamp), searchable card stream, whole-file Markdown editing | `data/速记.md` |
| **Key docs** | Token/API-key documents stored as-is under `data/密钥/*.md / *.txt` (one file per doc); fixed-size cards open a detail modal for viewing/editing with conflict detection; search, create, delete, import local .md/.txt files | `data/密钥/` |
| **AI chat** | Streaming chat with Work tools — read-only (query todos, notes, assets + TCP probe, bookmarks, key-doc names) and **write actions (add todo / note / asset, SSH exec — each gated by an approval card)**. Presets for 7 providers plus a custom relay, multiple models per provider with an in-chat model switcher, OpenAI-compatible and native Claude APIs, connection test, tool-call audit log. Asset cards have an AI-chat entry carrying the asset context. **Sessions persist server-side** — saved on creation and after every stream, per-asset sessions stored separately, archive/restore supported, removed only on delete | `data/对话/` + `设置.json` (`ai` key) |

**Built-in AI assistant** — bring your own key (OpenAI-compatible or Anthropic mode). Streaming chat with tool use over your local data: read your todos and notes, list and probe server assets, search your bookmarks, list your key docs. Every tool call is written to an audit log.

**Apple-inspired UI** — frosted-glass top bar, segmented controls, system font stack. Appearance (auto / light / dark) and accent color are independent settings; all confirmations and inputs are in-app dialogs (Esc cancels, Enter confirms).

## Quick start

```bash
npm i          # build-time deps only (esbuild + react)
npm run build  # produces public/app.js
npm start      # node server.mjs → http://127.0.0.1:8791/
```

Options & environment: `--root <data dir>` (default `./data`), `--port` (default `8791`), `--host` (default `127.0.0.1`), `--open` (open the UI in your browser), `--apps-dir <shortcuts folder>`; equivalently `PWB_ROOT / PWB_PORT / PWB_HOST / PWB_OPEN / PWB_APPS_DIR`. Requires Node ≥ 18 and uses only Node built-ins at runtime.

### Windows conveniences

```bash
node scripts/make-shortcut.mjs desktop   # Start Menu-style .lnk + a direct URL shortcut (for taskbar pinning)
node scripts/make-icon.mjs               # regenerate the icon (icon/icon.svg → public/favicon.ico)
node scripts/install-autostart.mjs       # register/unregister launch-at-login (HKCU Run)
```

`启动工作台.lnk` starts the hidden server if it isn't running (or just opens a window if it is). The app icon is generated from `icon/icon.svg` (blue squircle + macOS window motif): headless Edge render → multi-size scale → PNG-compressed ICO.

## Data format (Obsidian can edit the same files)

- `导航.md` — `## Category` sections + `- [Title](https://url)` lists
- `资产.md` — `## Asset` sections with `- Host:` / `- Port:` / `- Group:` / `- Project:` / `- Note:` / `- Status:` field lines and `- Link: [name](url)`; **contains no secrets**, safe to sync or commit
- `凭据.md` — same section layout, `- Credential: {JSON}` lines, typed as `password` / `private-key` (optional passphrase) / `token`. This is the privacy file: keep it out of sync and out of git. Optional master-passphrase encryption seals `secret`/`passphrase` fields as `ENC:v1:<scrypt salt>:<iv>:<ciphertext>` (AES-256-GCM) while keeping the structure readable. **Forgot the passphrase = unrecoverable** (re-enter your credentials), so choose one you won't lose
- `设置.json` — small JSON for launcher prefs, vault and AI config

**Co-editing without conflicts:** todo and nav saves carry a content hash; if the file changed outside (e.g. Obsidian), you get a 409 with the latest content instead of a blind overwrite. All writes are atomic (temp file + rename).

`data/cache/` holds regenerable icon caches and can be deleted anytime.

## AI assistant

1. Open the AI page and pick a provider: presets for 7 major providers (DeepSeek, Moonshot, OpenRouter, Ollama, …), or **custom relay**, with **OpenAI-compatible** and **native Claude** API modes
2. Fill in base URL, API key and model — a connection test verifies the setup; the key is stored locally in `设置.json` and never leaves your machine except to call the provider you configured
3. Chat streams over SSE; the assistant can call read-only tools against your workbench data, and every tool call is appended to the audit log under `data/对话/`

## Security boundaries

- Listens on `127.0.0.1` only and validates the `Host` header (anti DNS-rebinding)
- Shortcut launching uses a filename whitelist resolved via `explorer.exe` (no cmd metacharacter surface)
- Credential vault: scrypt-derived key + AES-256-GCM; no recovery key by design — it's local, a lost passphrase just means re-entering the credentials
- Don't commit or cloud-sync `data/` (`.gitignore` already excludes it)

## Development

```bash
npm test        # data-layer unit tests (MD round-trips, vault crypto, credential-split migration)
npm run smoke   # boots the real server against the real data: full-chain API checks
```

## License

[MIT](LICENSE) © 2026 bot3145
