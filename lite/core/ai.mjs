// AI 对话核心：供应商预置 + 两种接入方式（OpenAI 兼容 / 供应商原生 Claude）+ 工具循环 + 流式回答。
// 工具分两类：只读工具直接执行；confirm:true 的写/危险工具走"确认卡"——生成器 yield confirm 事件并
// 轮询 approvals 登记簿等待用户裁决（5 分钟超时视为拒绝）。密钥值不进 LLM 上下文。
export const AI_PROVIDERS = [
  { id: "deepseek", name: "DeepSeek", mode: "openai", baseURL: "https://api.deepseek.com/v1" },
  { id: "glm", name: "GLM 智谱", mode: "openai", baseURL: "https://open.bigmodel.cn/api/paas/v4" },
  { id: "kimi", name: "Kimi 月之暗面", mode: "openai", baseURL: "https://api.moonshot.cn/v1" },
  { id: "tencent", name: "腾讯混元/lkeap", mode: "openai", baseURL: "https://api.lkeap.cloud.tencent.com/v1" },
  { id: "claude", name: "Claude", mode: "anthropic", baseURL: "https://api.anthropic.com/v1" },
  { id: "gpt", name: "GPT OpenAI", mode: "openai", baseURL: "https://api.openai.com/v1" },
  { id: "custom", name: "自定义/中转", mode: "openai", baseURL: "" },
]

export const defaultAiConfig = () => ({ provider: "deepseek", mode: "openai", baseURL: AI_PROVIDERS[0].baseURL, key: "", models: [...AI_PROVIDERS[0].models], activeModel: AI_PROVIDERS[0].models[0] })

// 规范化：models 数组（兼容旧版单 model 字符串迁移），activeModel 必须在 models 内
export const normalizeAiConfig = (raw) => {
  const modelsRaw = Array.isArray(raw?.models) ? raw.models : (raw?.model ? [raw.model] : [])
  const models = [...new Set(modelsRaw.map((m) => String(m ?? "").trim()).filter(Boolean))].slice(0, 20)
  const activeModel = String(raw?.activeModel ?? "")
  return {
    provider: String(raw?.provider ?? "deepseek"),
    mode: raw?.mode === "anthropic" ? "anthropic" : "openai",
    baseURL: String(raw?.baseURL ?? "").replace(/\/+$/, ""),
    key: String(raw?.key ?? ""),
    models,
    activeModel: models.includes(activeModel) ? activeModel : (models[0] ?? activeModel),
  }
}

export const maskKey = (key) => {
  const k = String(key ?? "")
  return k.length > 12 ? k.slice(0, 6) + "••••" + k.slice(-4) : "••••••"
}

// 危险命令拦截（服务器操作工具的硬红线，AI 与用户都无法绕过）
const DANGEROUS_RE = /rm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)|mkfs|dd\s+if=|reboot|shutdown|init\s+[06]|:\(\)\s*\{|\bchmod\s+-R\s+777\s+\/|>\s*\/dev\/(sd|nvme|hd)|fdisk|wipefs/iu
export const isDangerousCommand = (cmd) => DANGEROUS_RE.test(String(cmd ?? ""))

// 统一请求构造：mode=openai → /chat/completions（Bearer）；mode=anthropic → /messages（x-api-key 原生协议）
export function buildChatRequest(cfg, messages, { stream = false, tools = null, maxTokens = 4096 } = {}) {
  const system = messages.find((m) => m.role === "system")
  if (cfg.mode === "anthropic") {
    const conv = messages.filter((m) => m.role !== "system").map((m) => {
      if (m.role === "assistant" && Array.isArray(m.tool_calls)) {
        return {
          role: "assistant",
          content: [
            ...(m.content ? [{ type: "text", text: m.content }] : []),
            ...m.tool_calls.map((c) => ({ type: "tool_use", id: c.id, name: c.function.name, input: safeParse(c.function.arguments) })),
          ],
        }
      }
      if (m.role === "tool") {
        return { role: "user", content: [{ type: "tool_result", tool_use_id: m.tool_call_id, content: String(m.content ?? "") }] }
      }
      return { role: m.role, content: String(m.content ?? "") }
    })
    return {
      url: cfg.baseURL + "/messages",
      headers: { "content-type": "application/json", "x-api-key": cfg.key, "anthropic-version": "2023-06-01" },
      body: {
        model: cfg.model, max_tokens: maxTokens, stream,
        ...(system ? { system: system.content } : {}),
        messages: conv,
        ...(tools ? { tools: tools.map((tl) => ({ name: tl.function.name, description: tl.function.description, input_schema: tl.function.parameters })) } : {}),
      },
    }
  }
  return {
    url: cfg.baseURL + "/chat/completions",
    headers: { "content-type": "application/json", authorization: "Bearer " + cfg.key },
    body: {
      model: cfg.model, messages, stream,
      ...(tools ? { tools } : {}),
      ...(stream ? {} : { max_tokens: maxTokens }),
    },
  }
}

const safeParse = (s) => { try { return JSON.parse(s ?? "{}") } catch { return {} } }

// 非流式请求（工具循环轮次）：统一返回 { content, toolCalls }
export async function callChatNonStream(cfg, messages, tools, systemPrompt) {
  const withSystem = systemPrompt ? [{ role: "system", content: systemPrompt }, ...messages] : messages
  const req = buildChatRequest(cfg, withSystem, { tools, maxTokens: 2048 })
  const res = await fetch(req.url, { method: "POST", headers: req.headers, body: JSON.stringify(req.body), signal: AbortSignal.timeout(60000) })
  if (!res.ok) throw new Error(`上游 ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  if (cfg.mode === "anthropic") {
    let content = ""
    const toolCalls = []
    for (const block of data.content ?? []) {
      if (block.type === "text") content += block.text
      if (block.type === "tool_use") toolCalls.push({ id: block.id, function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) } })
    }
    return { content, toolCalls }
  }
  const msg = data.choices?.[0]?.message ?? {}
  return { content: String(msg.content ?? ""), toolCalls: msg.tool_calls ?? [] }
}

// 流式回答：解析 SSE，逐段回调文本增量
export async function streamChatText(cfg, messages, systemPrompt, onDelta) {
  const req = buildChatRequest(cfg, messages, { stream: true, maxTokens: 4096 })
  const res = await fetch(req.url, { method: "POST", headers: req.headers, body: JSON.stringify(req.body), signal: AbortSignal.timeout(120000) })
  if (!res.ok || !res.body) throw new Error(`上游 ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const decoder = new TextDecoder()
  let buffer = ""
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true })
    let idx
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim()
      buffer = buffer.slice(idx + 1)
      if (!line.startsWith("data:")) continue
      const payload = line.slice(5).trim()
      if (payload === "[DONE]") return
      let data
      try { data = JSON.parse(payload) } catch { continue }
      if (cfg.mode === "anthropic") {
        if (data.type === "content_block_delta" && data.delta?.text) onDelta(data.delta.text)
        if (data.type === "message_stop") return
      } else {
        const delta = data.choices?.[0]?.delta?.content
        if (delta) onDelta(delta)
      }
    }
  }
}

// 连接测试：极小请求验证可达性与鉴权
export async function testConnection(cfg) {
  const started = Date.now()
  try {
    const req = buildChatRequest(cfg, [{ role: "user", content: "只回复两个字母: ok" }], { maxTokens: 16 })
    const res = await fetch(req.url, { method: "POST", headers: req.headers, body: JSON.stringify(req.body), signal: AbortSignal.timeout(20000) })
    const ms = Date.now() - started
    if (!res.ok) {
      let detail = ""
      try { detail = (await res.text()).slice(0, 200) } catch {}
      return { ok: false, ms, error: `HTTP ${res.status} ${detail}` }
    }
    const data = await res.json()
    const reply = cfg.mode === "anthropic"
      ? (data.content ?? []).map((b) => b.text ?? "").join("")
      : (data.choices?.[0]?.message?.content ?? "")
    return { ok: true, ms, reply: String(reply).slice(0, 60) }
  } catch (error) {
    return { ok: false, ms: Date.now() - started, error: String(error?.cause?.code ?? error?.message ?? error) }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const sse = (obj) => `data: ${JSON.stringify(obj)}\n\n`

// 对话主流程：非流式工具循环（≤4 轮）→ 流式最终回答；yield SSE 事件字符串。
// approvals：confirm 登记簿（Map<id, true|false|null>），由 POST ai/confirm 写入。
export async function* runAiChat(cfg, messages, tools, execTool, systemPrompt, approvals, confirmTools) {
  let working = messages.map((m) => ({ ...m }))
  try {
    for (let round = 0; round < 4; round++) {
      let content = ""
      let calls = []
      let attemptTools = tools
      try {
        ({ content, toolCalls: calls } = await callChatNonStream(cfg, working, attemptTools, systemPrompt))
      } catch (error) {
        // 部分中转接口不支持 tools 参数：去掉工具重试一次（该轮对话无 Work 能力）
        if (attemptTools && attemptTools.length) {
          try {
            ({ content, toolCalls: calls } = await callChatNonStream(cfg, working, null, systemPrompt))
          } catch (error2) {
            yield sse({ type: "error", error: String(error2?.cause?.code ?? error2?.message ?? error2) })
            return
          }
        } else {
          yield sse({ type: "error", error: String(error?.cause?.code ?? error?.message ?? error) })
          return
        }
      }
      if (!calls.length) break
      working.push(cfg.mode === "anthropic"
        ? {
            role: "assistant",
            content: [
              ...(content ? [{ type: "text", text: content }] : []),
              ...calls.map((c) => ({ type: "tool_use", id: c.id, name: c.function.name, input: safeParse(c.function.arguments) })),
            ],
          }
        : { role: "assistant", content: content || null, tool_calls: calls })
      for (const call of calls) {
        const tool = (tools ?? []).find((tl) => tl.function.name === call.function.name)
        const needConfirm = confirmTools ? confirmTools.has(call.function.name) : Boolean(tool?.confirm)
        const args = safeParse(call.function.arguments)
        yield sse({ type: "tool", name: call.function.name, args, debug: { toolFound: Boolean(tool), confirm: tool ? Boolean(tool.confirm) : null } })
        let result
        if (needConfirm) {
          // 写/危险操作：出确认事件并等待用户裁决（POST ai/confirm 写入登记簿）
          const cid = "cf_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
          const summary = tool.summary ? tool.summary(args) : JSON.stringify(args).slice(0, 300)
          approvals.set(cid, null)
          yield sse({ type: "confirm", id: cid, tool: call.function.name, summary })
          let verdict = null
          const deadline = Date.now() + 300000
          while (verdict === null && Date.now() < deadline) {
            await sleep(500)
            verdict = approvals.has(cid) ? approvals.get(cid) : null
          }
          approvals.delete(cid)
          if (verdict !== true) {
            result = "用户拒绝或未响应，该操作未执行"
            yield sse({ type: "tool_result", name: call.function.name, result, rejected: true })
            working.push(cfg.mode === "anthropic"
              ? { role: "user", content: [{ type: "tool_result", tool_use_id: call.id, content: result }] }
              : { role: "tool", tool_call_id: call.id, content: result })
            continue
          }
          yield sse({ type: "confirm_result", id: cid, approved: true })
        }
        try { result = String((await execTool(call.function.name, args)) ?? "完成") } catch (error) { result = "执行失败: " + String(error?.message ?? error) }
        result = result.slice(0, 4000)
        yield sse({ type: "tool_result", name: call.function.name, result: result.slice(0, 400) })
        working.push(cfg.mode === "anthropic"
          ? { role: "user", content: [{ type: "tool_result", tool_use_id: call.id, content: result }] }
          : { role: "tool", tool_call_id: call.id, content: result })
      }
    }
    for await (const delta of streamTextGen(cfg, working, systemPrompt)) {
      yield sse({ type: "delta", text: delta })
    }
  } catch (error) {
    yield sse({ type: "error", error: String(error?.message ?? error) })
  }
  yield sse({ type: "done" })
}

async function* streamTextGen(cfg, messages, systemPrompt) {
  const withSystem = systemPrompt ? [{ role: "system", content: systemPrompt }, ...messages] : messages
  const req = buildChatRequest(cfg, withSystem, { stream: true, maxTokens: 4096 })
  const res = await fetch(req.url, { method: "POST", headers: req.headers, body: JSON.stringify(req.body), signal: AbortSignal.timeout(120000) })
  if (!res.ok || !res.body) throw new Error(`上游流式请求失败 HTTP ${res.status}`)
  const decoder = new TextDecoder()
  let buffer = ""
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true })
    let idx
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim()
      buffer = buffer.slice(idx + 1)
      if (!line.startsWith("data:")) continue
      const payload = line.slice(5).trim()
      if (payload === "[DONE]") return
      let data
      try { data = JSON.parse(payload) } catch { continue }
      if (cfg.mode === "anthropic") {
        if (data.type === "content_block_delta" && data.delta?.text) yield data.delta.text
        if (data.type === "message_stop") return
      } else {
        const delta = data.choices?.[0]?.delta?.content
        if (delta) yield delta
      }
    }
  }
}
