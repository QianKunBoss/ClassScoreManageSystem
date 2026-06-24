import { scoreTemplates } from '../../database/schema'
import { useSchoolDb } from '../../database/db'
import { requireAdmin, getSchoolIdFromRequest } from '../../utils/auth'

// GET /api/scores/templates — 获取所有积分模板（学校库）
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)

  const templates = await db.select().from(scoreTemplates)
  return { data: templates }
})
