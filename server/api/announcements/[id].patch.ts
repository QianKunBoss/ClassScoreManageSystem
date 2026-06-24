import { eq } from 'drizzle-orm'
import { announcements } from '../../database/schema.main'
import { useMainDb } from '../../database/db'
import { requireAdmin } from '../../utils/auth'

// PATCH /api/announcements/:id — 更新公告（需管理员权限）
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  const db = useMainDb()

  const updateData: Record<string, any> = {
    updatedAt: new Date().toISOString(),
  }

  if (body.title !== undefined) updateData.title = body.title
  if (body.content !== undefined) updateData.content = body.content
  if (body.type !== undefined) updateData.type = body.type
  if (body.active !== undefined) updateData.active = Number(body.active)

  await db
    .update(announcements)
    .set(updateData)
    .where(eq(announcements.id, parseInt(id!)))

  return { success: true, message: '已更新' }
})
