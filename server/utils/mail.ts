import { createTransport, type Transporter } from 'nodemailer'
import { mailServices, mailTemplates } from '../database/schema.main'
import { useMainDb } from '../database/db'
import { eq, asc } from 'drizzle-orm'

// 有效邮箱格式
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

type MailConfig = {
  host: string
  port: number
  secure: boolean
  requireTLS: boolean
  user: string
  pass: string
  fromName: string
  fromAddress: string
}

/** 从表单/配置对象构造发信配置（统一映射安全连接） */
function toConfig(input: {
  host: string
  port: number | string
  secure: string
  username: string
  password: string
  fromName?: string
  fromAddress: string
}): MailConfig {
  const secure = (input.secure || 'tls') === 'ssl'
  return {
    host: (input.host || '').trim(),
    port: Number(input.port) || (secure ? 465 : 587),
    secure,
    requireTLS: (input.secure || 'tls') === 'tls',
    user: (input.username || '').trim(),
    pass: (input.password || '').trim(),
    fromName: (input.fromName || '').trim(),
    fromAddress: (input.fromAddress || '').trim(),
  }
}

function getTransporter(cfg: MailConfig): Transporter {
  return createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    requireTLS: cfg.requireTLS,
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
  })
}

/**
 * 包装 transporter.verify / sendMail：使用 callback 形式并监听 transport 的 error 事件，
 * 避免连接期错误以未捕获异常形式逃逸、导致进程崩溃（promise 形式的 verify 在连接失败时存在此隐患）。
 */
function verifyTransport(transporter: Transporter): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (err: any) => reject(err)
    ;(transporter as any).on?.('error', onError)
    try {
      transporter.verify((err: any) => {
        ;(transporter as any).off?.('error', onError)
        if (err) return reject(err)
        resolve()
      })
    } catch (e) {
      ;(transporter as any).off?.('error', onError)
      reject(e)
    }
  })
}

function sendViaTransport(transporter: Transporter, opts: { from: string; to: string; subject: string; html: string }): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (err: any) => reject(err)
    ;(transporter as any).on?.('error', onError)
    try {
      transporter.sendMail(opts, (err: any) => {
        ;(transporter as any).off?.('error', onError)
        if (err) return reject(err)
        resolve()
      })
    } catch (e) {
      ;(transporter as any).off?.('error', onError)
      reject(e)
    }
  })
}

// ===== 多邮件服务（优先级故障转移）=====

/** 读取所有「启用」的邮件服务，按 priority 升序（0 最高） */
export async function loadMailServices(): Promise<MailConfigExt[]> {
  const db = useMainDb()
  const rows = await db
    .select()
    .from(mailServices)
    .where(eq(mailServices.enabled, 1))
    .orderBy(asc(mailServices.priority))
    .all()
  return rows.map(rowToService)
}

/** 按 id 读取单个服务（含禁用），用于编辑/测试 */
export async function getMailServiceById(id: number): Promise<MailConfigExt | null> {
  const db = useMainDb()
  const row = await db.select().from(mailServices).where(eq(mailServices.id, id)).get()
  return row ? rowToService(row) : null
}

type MailConfigExt = MailConfig & { id: number; name: string }

function rowToService(row: any): MailConfigExt {
  const cfg = toConfig({
    host: row.host,
    port: row.port,
    secure: row.secure,
    username: row.username,
    password: row.password,
    fromName: row.fromName,
    fromAddress: row.fromAddress,
  })
  return { ...cfg, id: row.id, name: row.name }
}

/**
 * 发送邮件：按优先级从高到低依次尝试启用的邮件服务，
 * 某个服务失败时自动降级到下一个，直到发送成功或所有服务均失败。
 */
export async function sendMail(opts: { to: string; subject: string; html: string }): Promise<void> {
  const services = await loadMailServices()
  if (!services.length) {
    throw new Error('NO_ENABLED_MAIL_SERVICE')
  }
  const errors: string[] = []
  for (const svc of services) {
    try {
      const transporter = getTransporter(svc)
      await sendViaTransport(transporter, {
        from: svc.fromName ? `${svc.fromName} <${svc.fromAddress}>` : svc.fromAddress,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      })
      return // 发送成功，结束
    } catch (e: any) {
      errors.push(`[${svc.name}] ${e?.message || '未知错误'}`)
    }
  }
  throw new Error(`所有邮件服务发送失败：${errors.join('；')}`)
}

/** 用指定配置发送测试邮件（不持久化，用于模态框实时测试） */
export async function sendTestWithConfig(
  cfgInput: Parameters<typeof toConfig>[0],
  opts: { to: string; subject: string; html: string },
): Promise<void> {
  const cfg = toConfig(cfgInput)
  if (!cfg.host || !cfg.fromAddress) throw new Error('SMTP_NOT_CONFIGURED')
  const transporter = getTransporter(cfg)
  await sendViaTransport(transporter, {
    from: cfg.fromName ? `${cfg.fromName} <${cfg.fromAddress}>` : cfg.fromAddress,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  })
}

/** 用指定配置验证 SMTP 连接（不发送邮件），返回结果对象 */
export async function verifyWithConfig(
  cfgInput: Parameters<typeof toConfig>[0],
): Promise<{ ok: boolean; message: string }> {
  const cfg = toConfig(cfgInput)
  if (!cfg.host) {
    return { ok: false, message: 'SMTP 服务器地址未填写' }
  }
  try {
    const transporter = getTransporter(cfg)
    await verifyTransport(transporter)
    return { ok: true, message: '连接成功，SMTP 凭据有效' }
  } catch (e: any) {
    return { ok: false, message: `连接失败：${e?.message || '未知错误'}` }
  }
}

// ===== 邮件模板渲染 =====

/** 将 {{var}} 占位符替换为变量值（自动转义，防注入） */
export function renderString(tpl: string, vars: Record<string, string>): string {
  if (!tpl) return ''
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key]
    return v === undefined || v === null ? '' : escapeHtml(String(v))
  })
}

/** 按 slug 渲染模板，返回 { subject, html } */
export async function renderTemplate(
  slug: string,
  vars: Record<string, string>,
): Promise<{ subject: string; html: string }> {
  const db = useMainDb()
  const tpl = await db.select().from(mailTemplates).where(eq(mailTemplates.slug, slug)).get()
  if (!tpl) throw new Error(`邮件模板不存在: ${slug}`)
  return {
    subject: renderString(tpl.subject, vars),
    html: renderString(tpl.bodyHtml, vars),
  }
}

// ===== 邮箱验证码（进程内存储，适合单实例部署）=====
const CODE_TTL = 10 * 60 * 1000 // 10 分钟有效
const COOLDOWN = 60 * 1000      // 60 秒重发冷却
const MAX_ATTEMPTS = 5          // 最多尝试次数

type CodeEntry = { code: string; expiresAt: number; lastSentAt: number; attempts: number }
const codeStore = new Map<string, CodeEntry>()

/** 为邮箱签发验证码；冷却期内返回 ok:false 与剩余毫秒 */
export function issueVerificationCode(email: string): { ok: boolean; code?: string; remainingMs?: number } {
  const now = Date.now()
  const existing = codeStore.get(email)
  if (existing && now - existing.lastSentAt < COOLDOWN) {
    return { ok: false, remainingMs: COOLDOWN - (now - existing.lastSentAt) }
  }
  const code = String(Math.floor(100000 + Math.random() * 900000))
  codeStore.set(email, { code, expiresAt: now + CODE_TTL, lastSentAt: now, attempts: 0 })
  return { ok: true, code }
}

/** 校验验证码；成功或失败均会消耗一次机会，超限/过期即失效 */
export function verifyEmailCode(email: string, code: string): boolean {
  const entry = codeStore.get(email)
  if (!entry) return false
  if (Date.now() > entry.expiresAt) { codeStore.delete(email); return false }
  if (entry.attempts >= MAX_ATTEMPTS) { codeStore.delete(email); return false }
  entry.attempts++
  if (entry.code !== code) return false
  codeStore.delete(email)
  return true
}
