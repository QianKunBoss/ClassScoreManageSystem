import { requireSuperAdmin } from '../../utils/auth'
import { mailServices } from '../../database/schema.main'
import { useMainDb } from '../../database/db'
import { EMAIL_RE } from '../../utils/mail'

// POST /api/mail-services — 创建邮件服务
export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const body = await readBody(event)
  const name = (body.name || '').toString().trim()
  const host = (body.host || '').toString().trim()
  const fromAddress = (body.fromAddress || '').toString().trim()

  if (!name) throw createError({ statusCode: 400, message: '请填写服务名称' })
  if (!host) throw createError({ statusCode: 400, message: '请填写 SMTP 服务器地址' })
  if (fromAddress && !EMAIL_RE.test(fromAddress)) {
    throw createError({ statusCode: 400, message: '发件人邮箱格式不正确' })
  }

  const db = useMainDb()
  const result = await db.insert(mailServices).values({
    name,
    provider: (body.provider || 'custom').toString(),
    host,
    port: Number(body.port) || 587,
    secure: ['none', 'ssl', 'tls'].includes(body.secure) ? body.secure : 'tls',
    username: (body.username || '').toString(),
    password: (body.password || '').toString(),
    fromName: (body.fromName || '').toString(),
    fromAddress,
    priority: Number.isFinite(Number(body.priority)) ? Number(body.priority) : 0,
    enabled: body.enabled === 0 || body.enabled === '0' ? 0 : 1,
    updatedAt: new Date().toISOString(),
  }).returning().get()

  return { success: true, data: result, message: '邮件服务已创建' }
})
