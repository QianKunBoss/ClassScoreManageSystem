/**
 * 外部开放 API 调用审计
 * ------------------------------------------------------------------
 * 挂在 nitro 的 afterResponse 钩子上，只处理 /api/v1/** 前缀。
 * 由于 v1 链路已保证「任何异常都在 middleware / defineApiV1Handler 内收敛为正常返回」，
 * 这个钩子必定会被触发 —— 包括鉴权失败、限流拒绝这类最需要留痕的请求。
 *
 * 【审计写失败不影响业务】整段吞异常只打日志。
 * 审计是旁路能力，不能因为主库抖动就把第三方的正常对接打挂。
 */

import { sql } from 'drizzle-orm'
import { useMainDb } from '../database/db'
import { apiAuditLogs, apiTokens } from '../database/schema.main'
import { getClientIp } from '../utils/rate-limit'
import { eq } from 'drizzle-orm'

/** 审计日志保留天数 */
const RETENTION_DAYS = 30
/** 清理触发概率（约每 500 次调用清一次，避免额外引入定时任务） */
const CLEANUP_PROBABILITY = 1 / 500

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('afterResponse', async (event: any) => {
    if (!event?.context?.isApiV1) return

    try {
      const db = useMainDb()
      const token = event.context.apiToken
      const startedAt = Number(event.context.apiStartedAt) || Date.now()
      const statusCode = Number(event.node?.res?.statusCode) || 200
      const headers = getRequestHeaders(event)

      await db.insert(apiAuditLogs).values({
        tokenId: token?.id ?? null,
        tokenPrefix: token?.tokenPrefix ?? null,
        schoolId: token?.schoolId ?? null,
        method: String(event.node?.req?.method || event.method || 'GET').toUpperCase(),
        path: String(event.path || ''),
        statusCode,
        latencyMs: Math.max(0, Date.now() - startedAt),
        ip: getClientIp(event),
        userAgent: String(headers['user-agent'] || '').slice(0, 300) || null,
        requestId: String(event.context.apiRequestId || ''),
        errorMessage: event.context.apiErrorMessage ? String(event.context.apiErrorMessage).slice(0, 500) : null,
        createdAt: new Date().toISOString(),
      })

      // 调用统计只在鉴权通过时累加，被拒的请求不该计入 token 的使用量
      if (token?.id) {
        await db.update(apiTokens).set({
          callCount: sql`call_count + 1`,
          lastUsedAt: new Date().toISOString(),
          lastUsedIp: getClientIp(event),
        }).where(eq(apiTokens.id, token.id))
      }

      if (Math.random() < CLEANUP_PROBABILITY) {
        const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400_000).toISOString()
        // created_at 存 ISO 8601 字符串，字典序与时间序一致，可直接比较
        await db.delete(apiAuditLogs).where(sql`created_at < ${cutoff}`)
      }
    } catch (e: any) {
      console.error('[CSMS][api-audit] 审计写入失败（已忽略，不影响业务）:', e?.message || e)
    }
  })
})
