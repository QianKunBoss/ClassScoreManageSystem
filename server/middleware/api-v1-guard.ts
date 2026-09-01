/**
 * 外部开放 API 前置守卫
 * ------------------------------------------------------------------
 * 只作用于 /api/v1/** 前缀。存在的意义是「兜底」：
 * 将来新增 v1 端点时即使忘了写鉴权，请求也进不来 —— 安全边界不依赖于每个作者的记性。
 *
 * 【关键】第一行的前缀判断必须先 return。
 * h3 中间件对**所有**请求执行，包括页面 SSR 和现有约 100 个内部 /api/** 端点，
 * 少了这个短路就会把整站拖进 token 鉴权。
 *
 * 本文件只做四件事：生成 requestId、起计时、鉴权、限流。不含任何业务逻辑。
 */

import { randomUUID } from 'node:crypto'
import { authenticateToken } from '../utils/api-token'
import { assertApiRateLimit } from '../utils/api-rate-limit'
import { respondApiError } from '../utils/api-response'

export default defineEventHandler(async (event) => {
  const path = String(event.path || '')
  if (!path.startsWith('/api/v1/') && path !== '/api/v1') return

  // requestId 会回写进响应体与 api_audit_logs，第三方报障时凭它定位单次调用
  event.context.apiRequestId = randomUUID()
  event.context.apiStartedAt = Date.now()
  event.context.isApiV1 = true
  setResponseHeader(event, 'X-Request-Id', event.context.apiRequestId)

  try {
    // 鉴权失败即短路，请求不会到达任何端点处理器
    const token = await authenticateToken(event)

    // 限流放在鉴权之后：未通过鉴权的请求不该消耗某个 token 的配额
    assertApiRateLimit(event, token.id)

    event.context.apiToken = token
    event.context.apiScope = null // 端点内首次 useApiScope() 时惰性解析
  } catch (err) {
    // h3 中间件返回非 undefined 即作为响应发出并终止后续处理。
    // 这里主动返回而不是抛出，是为了让失败响应同样走契约格式并被审计钩子记录。
    return respondApiError(event, err)
  }
})
