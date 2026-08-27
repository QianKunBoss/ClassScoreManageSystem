import { requireSuperAdmin } from '../../utils/auth'
import { mailServices } from '../../database/schema.main'
import { useMainDb } from '../../database/db'
import { eq } from 'drizzle-orm'
import { EMAIL_RE } from '../../utils/mail'

// PATCH /api/mail-services/:id — 更新邮件服务
// 注意：password 传空字符串表示「保留原密码」，不更新
export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: 'ID 必填' })

  const body = await readBody(event)
  const db = useMainDb()

  const existing = await db.select().from(mailServices).where(eq(mailServices.id, id)).get()
  if (!existing) throw createError({ statusCode: 404, message: '邮件服务不存在' })

  const patch: Record<string, any> = { updatedAt: new Date().toISOString() }
  if (body.name !== undefined) {
    const v = (body.name || '').toString().trim()
    if (!v) throw createError({ statusCode: 400, message: '服务名称不能为空' })
    patch.name = v
  }
  if (body.provider !== undefined) patch.provider = (body.provider || 'custom').toString()
  if (body.host !== undefined) {
    const v = (body.host || '').toString().trim()
    if (!v) throw createError({ statusCode: 400, message: 'SMTP 服务器地址不能为空' })
    patch.host = v
  }
  if (body.port !== undefined) patch.port = Number(body.port) || 587
  if (body.secure !== undefined) patch.secure = ['none', 'ssl', 'tls'].includes(body.secure) ? body.secure : 'tls'
  if (body.username !== undefined) patch.username = (body.username || '').toString()
  if (body.password !== undefined && (body.password || '').toString() !== '') {
    patch.password = (body.password || '').toString()
  }
  if (body.fromName !== undefined) patch.fromName = (body.fromName || '').toString()
  if (body.fromAddress !== undefined) {
    const v = (body.fromAddress || '').toString().trim()
    if (v && !EMAIL_RE.test(v)) throw createError({ statusCode: 400, message: '发件人邮箱格式不正确' })
    patch.fromAddress = v
  }
  if (body.priority !== undefined && Number.isFinite(Number(body.priority))) patch.priority = Number(body.priority)
  if (body.enabled !== undefined) patch.enabled = body.enabled === 0 || body.enabled === '0' ? 0 : 1

  const result = await db.update(mailServices).set(patch).where(eq(mailServices.id, id)).returning().get()
  return { success: true, data: result, message: '已保存' }
})
