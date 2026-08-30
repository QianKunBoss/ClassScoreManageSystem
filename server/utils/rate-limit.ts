/**
 * 登录失败限流（进程内存实现）
 * ------------------------------------------------------------------
 * 【解决的问题】
 * 登录接口原本对失败次数没有任何约束，攻击者可对单个账号做无限次密码猜测
 * （学生默认口令 123456、管理员 6 位弱口令都能在很短时间内被爆破出来）。
 *
 * 【双桶策略】
 *  1) 账号桶（identifier）：针对「定向爆破某个账号」——阈值收紧
 *  2) IP 桶：针对「同一来源撞库多个账号」——阈值放宽
 *     ⚠️ 学校网络普遍走 NAT 共享出口，全校师生对外只有一个 IP。
 *        如果 IP 桶阈值定得和账号桶一样严，一个人输错密码就会把整校锁死。
 *        因此 IP 桶阈值显著放宽，只用来拦住明显的自动化撞库。
 *
 * 【实现说明】
 *  - 状态存在进程内存中，重启即清空；PM2 cluster 多 worker 时各自独立计数，
 *    实际阈值约等于「阈值 × worker 数」。当前部署规模（单机 node-server）足够，
 *    若将来横向扩容需换成 Redis 等共享存储。
 *  - 与 server/utils/mail.ts 的验证码限流保持同一设计风格。
 */

interface Bucket {
  /** 窗口内累计失败次数 */
  fails: number
  /** 窗口起始时间戳 */
  windowStart: number
  /** 锁定截止时间戳（0 表示未锁定） */
  lockedUntil: number
}

interface Policy {
  /** 统计窗口内允许的失败次数 */
  maxFails: number
  /** 统计窗口长度（ms） */
  windowMs: number
  /** 超限后的锁定时长（ms） */
  lockMs: number
  /** 面向用户的主体描述（用于错误提示） */
  label: string
}

/** 账号维度：定向爆破防护（严） */
const IDENTITY_POLICY: Policy = {
  maxFails: 5,
  windowMs: 10 * 60 * 1000,
  lockMs: 15 * 60 * 1000,
  label: '该账号',
}

/** IP 维度：撞库防护（宽，兼容学校 NAT 共享出口） */
const IP_POLICY: Policy = {
  maxFails: 40,
  windowMs: 10 * 60 * 1000,
  lockMs: 10 * 60 * 1000,
  label: '当前网络',
}

/** 限流作用域：不同登录入口独立计数（学生与管理员可能同名） */
export type LoginScope = 'admin-password' | 'admin-email-code' | 'student-password'

const buckets = new Map<string, Bucket>()

/** 上次清理时间，避免 Map 无限增长 */
let lastSweep = Date.now()
const SWEEP_INTERVAL = 5 * 60 * 1000

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL && buckets.size < 5000) return
  lastSweep = now
  for (const [key, b] of buckets) {
    const expired = b.lockedUntil <= now && now - b.windowStart > IDENTITY_POLICY.windowMs
    if (expired) buckets.delete(key)
  }
}

/** 取客户端 IP（兼容反向代理） */
function getClientIp(event: any): string {
  const headers = getRequestHeaders(event)
  const forwarded = headers['x-forwarded-for']
  if (forwarded) {
    // x-forwarded-for 可能是 "client, proxy1, proxy2"，取第一个
    const first = String(forwarded).split(',')[0]?.trim()
    if (first) return first
  }
  return String(
    headers['x-real-ip']
    || event.node?.req?.socket?.remoteAddress
    || 'unknown',
  )
}

/** 归一化标识符：避免大小写/空格绕过计数 */
function normalizeIdentifier(identifier: string): string {
  return String(identifier || '').trim().toLowerCase() || 'anonymous'
}

/** 构造两个维度的 key + 对应策略 */
function resolveTargets(event: any, scope: LoginScope, identifier: string) {
  return [
    { key: `id:${scope}:${normalizeIdentifier(identifier)}`, policy: IDENTITY_POLICY },
    { key: `ip:${scope}:${getClientIp(event)}`, policy: IP_POLICY },
  ]
}

function humanizeSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒`
  return `${Math.ceil(seconds / 60)} 分钟`
}

/**
 * 登录前置校验：若已被锁定则抛出 429（带 Retry-After 响应头）
 * 必须在任何密码/验证码比对之前调用。
 */
export function assertLoginAllowed(event: any, scope: LoginScope, identifier: string): void {
  const now = Date.now()
  sweep(now)

  for (const { key, policy } of resolveTargets(event, scope, identifier)) {
    const bucket = buckets.get(key)
    if (!bucket || bucket.lockedUntil <= now) continue

    const retryAfter = Math.ceil((bucket.lockedUntil - now) / 1000)
    setResponseHeader(event, 'Retry-After', String(retryAfter))
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message: `登录失败次数过多，${policy.label}已被临时锁定，请在 ${humanizeSeconds(retryAfter)} 后重试`,
      data: { retryAfter },
    })
  }
}

/**
 * 记录一次登录失败。达到阈值后进入锁定期。
 * 注意：账号不存在、密码错误、验证码错误都应调用，避免通过响应差异枚举账号。
 */
export function recordLoginFailure(event: any, scope: LoginScope, identifier: string): void {
  const now = Date.now()

  for (const { key, policy } of resolveTargets(event, scope, identifier)) {
    const bucket = buckets.get(key)

    // 新窗口：不存在 / 上个窗口已过期 / 上次锁定已解除
    if (!bucket || now - bucket.windowStart > policy.windowMs || (bucket.lockedUntil > 0 && bucket.lockedUntil <= now)) {
      buckets.set(key, { fails: 1, windowStart: now, lockedUntil: 0 })
      continue
    }

    bucket.fails += 1
    if (bucket.fails >= policy.maxFails) {
      bucket.lockedUntil = now + policy.lockMs
    }
  }
}

/** 登录成功后清除该账号与该 IP 的失败计数 */
export function clearLoginFailures(event: any, scope: LoginScope, identifier: string): void {
  for (const { key } of resolveTargets(event, scope, identifier)) {
    buckets.delete(key)
  }
}

/** 仅供测试/诊断：清空全部计数 */
export function __resetAllLoginBuckets(): void {
  buckets.clear()
}
