import { requireSuperAdmin } from '../../utils/auth'
import { mailServices } from '../../database/schema.main'
import { useMainDb } from '../../database/db'
import { eq } from 'drizzle-orm'

// DELETE /api/mail-services/:id — 删除邮件服务
export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: 'ID 必填' })

  const db = useMainDb()
  const existing = await db.select().from(mailServices).where(eq(mailServices.id, id)).get()
  if (!existing) throw createError({ statusCode: 404, message: '邮件服务不存在' })

  await db.delete(mailServices).where(eq(mailServices.id, id))
  return { success: true, message: '邮件服务已删除' }
})
