import { desc } from 'drizzle-orm'
import { announcements } from '../../database/schema.main'
import { useMainDb } from '../../database/db'
import { requireAdmin } from '../../utils/auth'

// GET /api/announcements/admin — 获取全部公告（含已禁用的，需管理员权限）
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const db = useMainDb()

  const rows = await db
    .select()
    .from(announcements)
    .orderBy(desc(announcements.createdAt))
    .all()

  return { success: true, data: rows }
})
