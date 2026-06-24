import { announcements } from '../../database/schema.main'
import { useMainDb } from '../../database/db'
import { requireAdmin } from '../../utils/auth'

// POST /api/announcements — 创建公告（需管理员权限）
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const body = await readBody(event)
  const { title, content, type, active } = body

  if (!title || !content) {
    setResponseStatus(event, 400)
    return { success: false, message: '标题和内容为必填项' }
  }

  const db = useMainDb()

  const result = await db.insert(announcements).values({
    title,
    content,
    type: type || 'info',
    active: active !== undefined ? Number(active) : 1,
    createdBy: admin.id,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  }).returning().all()

  return { success: true, data: result[0] }
})
