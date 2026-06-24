import { eq } from 'drizzle-orm'
import { scoreTemplates } from '../../database/schema'
import { useSchoolDb } from '../../database/db'
import { requireAdmin, getSchoolIdFromRequest } from '../../utils/auth'

// PATCH /api/templates/[id] — 更新积分模板（学校库）
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)

  const id = Number(getRouterParam(event, 'id'))
  if (isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: '无效的模板ID' })
  }

  const body = await readBody(event) as {
    name?: string
    score_change?: number
    description?: string
  }

  if (!body.name || body.score_change === undefined) {
    throw createError({ statusCode: 400, statusMessage: '请填写完整的模板信息' })
  }

  await db.update(scoreTemplates)
    .set({
      name: body.name,
      scoreChange: body.score_change,
      description: body.description || null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(scoreTemplates.id, id))

  return { success: true }
})
