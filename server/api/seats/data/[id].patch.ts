import { seatData } from '../../../database/schema'
import { useSchoolDb, getSchoolRawClient } from '../../../database/db'
import { requireAdmin, getSchoolIdFromRequest } from '../../../utils/auth'
import { eq } from 'drizzle-orm'

// PATCH /api/seats/data/[id] — 分配/清空座位（学校库）
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)
  const client = await getSchoolRawClient(event, schoolId)

  const id = Number(getRouterParam(event, 'id'))
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: '缺少座位 ID' })
  }

  // 班级管理员权限校验：只能操作自己班级的座位
  if (admin.role === 'class_admin') {
    const seatRes = await client.execute({
      sql: 'SELECT class_id FROM seat_data WHERE id = ? LIMIT 1',
      args: [id],
    })
    const seatRows = seatRes.rows as any[]
    if (seatRows.length === 0) {
      throw createError({ statusCode: 404, statusMessage: '座位不存在' })
    }
    if (seatRows[0].class_id !== admin.classId) {
      throw createError({ statusCode: 403, statusMessage: '只能管理自己班级的座位' })
    }
  }

  const body = await readBody(event) as { userId?: number | null }

  if (body.userId != null) {
    // 分配座位：先检查该学生是否已被分配到其他座位
    const existing = await client.execute({
      sql: `SELECT id FROM seat_data WHERE user_id = ? AND id != ? LIMIT 1`,
      args: [body.userId, id],
    })
    if ((existing.rows as any[]).length > 0) {
      throw createError({ statusCode: 400, statusMessage: '该学生已分配座位' })
    }
  }

  await client.execute({
    sql: `UPDATE seat_data SET user_id = ?, updated_at = ? WHERE id = ?`,
    args: [body.userId ?? null, new Date().toISOString(), id],
  })

  return { success: true }
})
