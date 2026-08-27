import { requireSuperAdmin } from '../../utils/auth'
import { mailTemplates } from '../../database/schema.main'
import { useMainDb } from '../../database/db'
import { eq } from 'drizzle-orm'

// DELETE /api/mail-templates/:id — 删除邮件模板
export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: 'ID 必填' })

  const db = useMainDb()
  const existing = await db.select().from(mailTemplates).where(eq(mailTemplates.id, id)).get()
  if (!existing) throw createError({ statusCode: 404, message: '模板不存在' })

  await db.delete(mailTemplates).where(eq(mailTemplates.id, id))
  return { success: true, message: '模板已删除' }
})
