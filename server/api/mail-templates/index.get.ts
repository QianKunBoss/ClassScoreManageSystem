import { requireSuperAdmin } from '../../utils/auth'
import { mailTemplates } from '../../database/schema.main'
import { useMainDb } from '../../database/db'

// GET /api/mail-templates — 列出全部邮件模板
export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const db = useMainDb()
  const list = await db.select().from(mailTemplates).all()
  return { success: true, data: list }
})
