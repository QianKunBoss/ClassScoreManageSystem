import { scoreLogs } from '../../database/schema'
import { useSchoolDb } from '../../database/db'
import { requireAdmin, getSchoolIdFromRequest } from '../../utils/auth'
import { eq } from 'drizzle-orm'

// DELETE /api/score-logs/[id] — 删除积分记录（学校库）
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)

  const id = Number(getRouterParam(event, 'id'))

  await db.delete(scoreLogs).where(eq(scoreLogs.id, id))

  return { success: true, message: '记录已删除' }
})
