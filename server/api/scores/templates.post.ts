import { eq } from 'drizzle-orm'
import { scoreTemplates } from '../../database/schema'
import { useSchoolDb } from '../../database/db'
import { requireAdmin, getSchoolIdFromRequest } from '../../utils/auth'

// POST /api/scores/templates — 创建积分模板（学校库）
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)

  const body = await readBody(event) as {
    name: string
    score_change: number
    description?: string
  }

  if (!body.name || !body.score_change) {
    throw createError({ statusCode: 400, statusMessage: '请填写模板名称和分值' })
  }

  const [newTemplate] = await db.insert(scoreTemplates).values({
    name: body.name,
    scoreChange: body.score_change,
    description: body.description || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }).returning()

  return { success: true, message: '模板创建成功', data: newTemplate }
})
