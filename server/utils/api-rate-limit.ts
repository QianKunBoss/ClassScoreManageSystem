/**
 * 外部开放 API 限流（token 维度，进程内存实现）
 * ------------------------------------------------------------------
 * 与 server/utils/rate-limit.ts 分开实现，因为二者语义完全不同：
 * 那里是「登录失败计数 + 锁定期」，这里是「请求速率上限」，
 * 硬塞进同一份代码只会让两边都变难读。
 *
 * 【双桶策略】
 *  1) 全量桶：约束总调用速率，防止第三方轮询把库刷爆
 *  2) 写操作桶：POST / PATCH / DELETE 额外收紧 —— 写操作会产生不可逆的积分变动，
 *     即使读接口被打满也不该让写入跟着放开
 *
 * 【已知短板】
 * 状态在进程内存，PM2 cluster 多 worker 时各自独立计数，
 * 实际阈值约等于「阈值 × worker 数」。现有登录限流是同样的取舍，
 * 横向扩容时两处需一并迁到共享存储。
 */

import { getClientIp } from './rate-limit'
import { API_CODE, apiError } from './api-response'

interface Window {
  /** 当前窗口内请求数 */
  count: number
  /** 窗口起始时间戳 */
  start: number
}

interface Policy {
  max: number
  windowMs: number
  label: string
}

/** 全量：600 次/分钟。约合 10 QPS，正常教务系统对接远用不到 */
const TOTAL_POLICY: Policy = { max: 600, windowMs: 60 * 1000, label: '请求' }
/** 写操作：120 次/分钟。批量加分本身支持一次提交多个学生，无需高频写 */
const WRITE_POLICY: Policy = { max: 120, windowMs: 60 * 1000, label: '写操作' }

const windows = new Map<string, Window>()

let lastSweep = Date.now()
const SWEEP_INTERVAL = 5 * 60 * 1000

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL && windows.size < 5000) return
  lastSweep = now
  for (const [key, w] of windows) {
    if (now - w.start > TOTAL_POLICY.windowMs * 2) windows.delete(key)
  }
}

function hit(key: string, policy: Policy, now: number): number {
  const w = windows.get(key)
  if (!w || now - w.start >= policy.windowMs) {
    windows.set(key, { count: 1, start: now })
    return 0
  }
  w.count += 1
  if (w.count > policy.max) {
    // 返回距窗口结束的剩余秒数，作为 Retry-After
    return Math.max(1, Math.ceil((w.start + policy.windowMs - now) / 1000))
  }
  return 0
}

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * 外部 API 请求前置限流。超限抛 429 并带 Retry-After 头。
 * 必须在业务处理之前调用（由 server/middleware/api-v1-guard.ts 统一执行）。
 */
export function assertApiRateLimit(event: any, tokenId: number): void {
  const now = Date.now()
  sweep(now)

  const method = String(event.node?.req?.method || event.method || 'GET').toUpperCase()

  const checks: Array<{ key: string; policy: Policy }> = [
    { key: `t:${tokenId}`, policy: TOTAL_POLICY },
  ]
  if (WRITE_METHODS.has(method)) {
    checks.push({ key: `w:${tokenId}`, policy: WRITE_POLICY })
  }

  for (const { key, policy } of checks) {
    const retryAfter = hit(key, policy, now)
    if (retryAfter > 0) {
      setResponseHeader(event, 'Retry-After', String(retryAfter))
      setResponseHeader(event, 'X-RateLimit-Limit', String(policy.max))
      apiError(
        429,
        API_CODE.RATE_LIMITED,
        `${policy.label}频率超限（上限 ${policy.max} 次/分钟），请在 ${retryAfter} 秒后重试`,
      )
    }
  }
}

/** 仅供测试：清空全部计数 */
export function __resetApiRateLimit(): void {
  windows.clear()
}
