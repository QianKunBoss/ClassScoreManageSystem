import { eq } from 'drizzle-orm'
import { users } from '../../database/schema'
import { useSchoolDb } from '../../database/db'
import { requireAdmin, getSchoolIdFromRequest } from '../../utils/auth'

// DELETE /api/users/[id] — 删除学生（学校库）
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)

  const id = Number(getRouterParam(event, 'id'))
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: '缺少用户 ID' })
  }

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).get()
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: '用户不存在' })
  }

  await db.delete(users).where(eq(users.id, id))

  return { success: true, message: '删除成功' }
})
