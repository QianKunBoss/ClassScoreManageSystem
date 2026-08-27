import { requireSuperAdmin } from '../../utils/auth'
import { mailTemplates } from '../../database/schema.main'
import { useMainDb } from '../../database/db'
import { eq } from 'drizzle-orm'

// PATCH /api/mail-templates/:id — 更新邮件模板
export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: 'ID 必填' })

  const body = await readBody(event)
  const db = useMainDb()
  const existing = await db.select().from(mailTemplates).where(eq(mailTemplates.id, id)).get()
  if (!existing) throw createError({ statusCode: 404, message: '模板不存在' })

  const patch: Record<string, any> = { updatedAt: new Date().toISOString() }
  if (body.name !== undefined) {
    const v = (body.name || '').toString().trim()
    if (!v) throw createError({ statusCode: 400, message: '模板名称不能为空' })
    patch.name = v
  }
  if (body.subject !== undefined) patch.subject = (body.subject || '').toString()
  if (body.bodyHtml !== undefined) patch.bodyHtml = (body.bodyHtml || '').toString()
  if (body.variables !== undefined) {
    patch.variables = Array.isArray(body.variables) ? JSON.stringify(body.variables) : (body.variables || '[]')
  }

  const result = await db.update(mailTemplates).set(patch).where(eq(mailTemplates.id, id)).returning().get()
  return { success: true, data: result, message: '已保存' }
})
