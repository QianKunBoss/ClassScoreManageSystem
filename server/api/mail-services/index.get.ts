import { requireSuperAdmin } from '../../utils/auth'
import { mailServices } from '../../database/schema.main'
import { useMainDb } from '../../database/db'
import { asc } from 'drizzle-orm'

// GET /api/mail-services — 列出全部邮件服务（按优先级升序）
export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const db = useMainDb()
  const list = await db.select().from(mailServices).orderBy(asc(mailServices.priority)).all()
  return { success: true, data: list }
})
