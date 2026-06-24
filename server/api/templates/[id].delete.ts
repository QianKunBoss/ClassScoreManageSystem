import { eq } from 'drizzle-orm'
import { scoreTemplates } from '../../database/schema'
import { useSchoolDb } from '../../database/db'
import { requireAdmin, getSchoolIdFromRequest } from '../../utils/auth'

// DELETE /api/templates/[id] — 删除积分模板（学校库）
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)

  const id = Number(getRouterParam(event, 'id'))
  if (isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: '无效的模板ID' })
  }

  await db.delete(scoreTemplates).where(eq(scoreTemplates.id, id))
  return { success: true }
})
