import { scoreTemplates } from '../../database/schema'
import { useSchoolDb } from '../../database/db'
import { requireAdmin, getSchoolIdFromRequest } from '../../utils/auth'
import { eq } from 'drizzle-orm'

// GET /api/templates — 获取积分模板列表（学校库）
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)

  const query = getQuery(event) as { classId?: string }

  if (query.classId) {
    const classId = Number(query.classId)
    const rows = await db
      .select()
      .from(scoreTemplates)
      .where(eq(scoreTemplates.classId, classId))
      .orderBy(scoreTemplates.id)
    return { data: rows }
  }

  const rows = await db.select().from(scoreTemplates).orderBy(scoreTemplates.id)
  return { data: rows }
})
