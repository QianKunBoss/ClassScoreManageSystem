import { useSchoolDb } from '../../database/db'
import { grades } from '../../database/schema'
import { requireAdmin } from '../../utils/auth'
import { getSchoolIdFromRequest } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)
  const body = await readBody(event)
  const { name } = body

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: '年级名称不能为空' })
  }

  const [newGrade] = await db
    .insert(grades)
    .values({ name })
    .returning()
    .all()

  return { success: true, data: newGrade }
})
