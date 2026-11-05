// HTTP 请求体读取（server.mjs 使用）。超限/非法 JSON 抛 StorageError（带状态码），由适配层转成 4xx 响应。
// 字节先累积再一次性按 UTF-8 解码：string += chunk 会在多字节字符跨 TCP 分块时静默损坏中文。
import { StorageError } from "./store.mjs"

const MAX_BODY_BYTES = 8 * 1024 * 1024

export function readJsonBody(req, limit = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let bytes = 0
    let tooLarge = false
    req.on("data", (chunk) => {
      if (tooLarge) return
      bytes += chunk.length
      if (bytes > limit) {
        tooLarge = true
        reject(new StorageError("请求体过大。", 413))
        req.destroy?.()
        return
      }
      chunks.push(chunk)
    })
    req.on("end", () => {
      if (tooLarge) return
      try {
        const body = Buffer.concat(chunks).toString("utf8")
        resolve(body ? JSON.parse(body) : {})
      } catch {
        reject(new StorageError("请求体不是合法 JSON。", 400))
      }
    })
    req.on("aborted", () => reject(new StorageError("请求已中止。", 400)))
    req.on("error", (error) => reject(error instanceof StorageError ? error : new StorageError(String(error?.message ?? error), 400)))
  })
}
