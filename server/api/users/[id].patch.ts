import { eq } from 'drizzle-orm'
import { users } from '../../database/schema'
import { useSchoolDb } from '../../database/db'
import { requireAdmin, getSchoolIdFromRequest } from '../../utils/auth'

// PATCH /api/users/[id] — 更新学生用户名（学校库）
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)

  const id = Number(getRouterParam(event, 'id'))
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: '缺少用户 ID' })
  }

  const body = await readBody(event)
  const { username } = body

  if (!username) {
    throw createError({ statusCode: 400, statusMessage: '请输入用户名' })
  }

  // 检查用户是否存在
  const existing = await db.select().from(users).where(eq(users.id, id)).get()
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: '用户不存在' })
  }

  // 检查新用户名是否与其他用户重复（同一学校库内）
  const duplicate = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .get()
  if (duplicate && duplicate.id !== id) {
    throw createError({ statusCode: 409, statusMessage: '用户名已存在' })
  }

  await db.update(users).set({ username }).where(eq(users.id, id))

  const updated = await db.select().from(users).where(eq(users.id, id)).get()

  return { success: true, message: '更新成功', data: updated }
})
