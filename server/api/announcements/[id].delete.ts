import { eq } from 'drizzle-orm'
import { announcements } from '../../database/schema.main'
import { useMainDb } from '../../database/db'
import { requireAdmin } from '../../utils/auth'

// DELETE /api/announcements/:id — 删除公告（需管理员权限）
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    setResponseStatus(event, 400)
    return { success: false, message: '缺少公告 ID' }
  }

  const db = useMainDb()

  // 检查公告是否存在
  const existing = await db
    .select()
    .from(announcements)
    .where(eq(announcements.id, parseInt(id)))
    .get()

  if (!existing) {
    setResponseStatus(event, 404)
    return { success: false, message: '公告不存在' }
  }

  // 删除公告
  await db.delete(announcements).where(eq(announcements.id, parseInt(id)))

  return { success: true, message: '已删除' }
})