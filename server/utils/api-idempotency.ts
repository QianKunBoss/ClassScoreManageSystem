// ===== 外部开放 API：写操作幂等 =====
//
// 为什么需要：外部调用方的网络重试是常态。一次「全班每人 +5 分」的请求超时后重试，
// 如果没有幂等保护，学生就会被加 10 分 —— 而调用方从未收到成功响应，根本不知道
// 该不该重试。把判断责任交给调用方是不负责任的设计。
//
// 用法：调用方在写请求上带 `Idempotency-Key: <自定义唯一串>`。
// 同一 token + 同一 key 重复提交时，直接回放首次的响应体，不再执行业务逻辑。
// 不带该头则退化为普通请求（不做任何保护），保持简单场景的易用性。

import { and, eq } from 'drizzle-orm'
import { apiIdempotency } from '../database/schema.school'
import { API_CODE, apiError } from './api-response'

/** key 最大长度：足够容纳 UUID / 雪花 ID，又不至于让人往里塞整个请求体 */
const MAX_KEY_LEN = 128

/** 处理中的占位标记。空串不行 —— 无法与「响应体恰好是空」区分 */
const PROCESSING = '\u0000processing'

export function getIdempotencyKey(event: any): string | null {
  const raw = getHeader(event, 'idempotency-key') || getHeader(event, 'x-idempotency-key')
  const key = String(raw ?? '').trim()
  if (!key) return null
  if (key.length > MAX_KEY_LEN) {
    apiError(400, API_CODE.INVALID_PARAM, `Idempotency-Key 长度不得超过 ${MAX_KEY_LEN}`)
  }
  return key
}

/**
 * 包裹一次写操作，提供「同 key 只执行一次」保证。
 *
 * 【并发】先抢占式插入占位行（唯一索引 (token_id, key) 保证只有一个赢家），
 * 再执行业务、回填响应。抢占失败说明另一个请求正在处理或已完成：
 *   - 已完成 → 回放响应；
 *   - 仍在处理 → 返回 409，让调用方稍后重试（而不是并发执行两次写入）。
 * 这比「先查后写」可靠：后者在两个并发请求间存在竞态窗口。
 */
export async function withIdempotency<T>(opts: {
  event: any
  db: any
  tokenId: number
  endpoint: string
  run: () => Promise<T>
}): Promise<T> {
  const { event, db, tokenId, endpoint, run } = opts
  const key = getIdempotencyKey(event)
  if (!key) return await run()

  const where = and(eq(apiIdempotency.tokenId, tokenId), eq(apiIdempotency.key, key))

  // 1) 抢占
  let claimed = false
  try {
    await db.insert(apiIdempotency).values({
      tokenId,
      key,
      endpoint,
      responseJson: PROCESSING,
    })
    claimed = true
  } catch {
    // 唯一索引冲突 —— 说明别人先到了
    claimed = false
  }

  if (!claimed) {
    const prev = await db.select().from(apiIdempotency).where(where).get()

    // 极端情况：抢占失败但记录已被清理，退化为直接执行（总比拒绝服务好）
    if (!prev) return await run()

    if (prev.responseJson === PROCESSING) {
      apiError(409, API_CODE.CONFLICT, '相同 Idempotency-Key 的请求正在处理中，请稍后重试')
    }
    if (prev.endpoint !== endpoint) {
      apiError(
        409,
        API_CODE.CONFLICT,
        `该 Idempotency-Key 已用于 ${prev.endpoint}，不可复用于其他端点`,
      )
    }

    setResponseHeader(event, 'Idempotency-Replayed', 'true')
    try {
      return JSON.parse(prev.responseJson) as T
    } catch {
      // 存档损坏时不能静默返回错误数据，宁可让调用方换个 key 重试
      apiError(409, API_CODE.CONFLICT, '幂等记录已损坏，请使用新的 Idempotency-Key 重试')
    }
  }

  // 2) 执行业务
  let result: T
  try {
    result = await run()
  } catch (err) {
    // 失败不应被幂等锁住：删掉占位行，让调用方可以用同一 key 正常重试
    try {
      await db.delete(apiIdempotency).where(where)
    } catch {
      /* 清理失败不掩盖原始错误 */
    }
    throw err
  }

  // 3) 回填
  try {
    await db.update(apiIdempotency).set({ responseJson: JSON.stringify(result) }).where(where)
  } catch (e: any) {
    // 业务已成功，回填失败只影响后续回放能力，不能因此报错给调用方
    console.error('[api-idempotency] 回填响应失败:', e?.message || e)
  }

  return result
}
