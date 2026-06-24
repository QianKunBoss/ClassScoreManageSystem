import { eq, desc } from 'drizzle-orm'
import { announcements } from '../../database/schema.main'
import { useMainDb } from '../../database/db'

// GET /api/announcements — 获取启用的公告列表（公开，首页使用）
export default defineEventHandler(async (event) => {
  const db = useMainDb()

  const rows = await db
    .select({
      id: announcements.id,
      title: announcements.title,
      content: announcements.content,
      type: announcements.type,
      createdAt: announcements.createdAt,
    })
    .from(announcements)
    .where(eq(announcements.active, 1))
    .orderBy(desc(announcements.createdAt))
    .all()

  return { success: true, data: rows }
})
