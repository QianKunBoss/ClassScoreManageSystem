import { seatLayoutConfig, seatData } from '../../../database/schema'
import { useSchoolDb, getSchoolRawClient } from '../../../database/db'
import { requireAdmin, getSchoolIdFromRequest } from '../../../utils/auth'
import { eq } from 'drizzle-orm'

// POST /api/seats/data/generate — 重新生成座位表（学校库）
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)
  const client = await getSchoolRawClient(event, schoolId)
  const body = await readBody(event) as { classId?: number }

  const classId = body.classId
  if (!classId) {
    throw createError({ statusCode: 400, statusMessage: '请选择班级' })
  }

  // 班级管理员只能操作自己管理的班级
  if (admin.role === 'class_admin' && admin.classId !== classId) {
    throw createError({ statusCode: 403, statusMessage: '只能管理自己班级的座位表' })
  }

  const layout = await db.select().from(seatLayoutConfig)
    .where(eq(seatLayoutConfig.classId, classId)).get()
  if (!layout) {
    throw createError({ statusCode: 400, statusMessage: '请先配置该班级的座位布局' })
  }

  // 清除该班级的旧座位数据
  await client.execute({
    sql: 'DELETE FROM seat_data WHERE class_id = ?',
    args: [classId],
  })

  const now = new Date().toISOString()
  const seats: any[] = []

  for (let g = 0; g < layout.groupCount; g++) {
    for (let r = 0; r < layout.rowsPerGroup; r++) {
      for (let c = 0; c < layout.colsPerGroup; c++) {
        const isAisle = (layout.hasAisle === 1 && c === Math.floor(layout.colsPerGroup / 2)) ? 1 : 0
        seats.push([
          classId,
          g, r, c,
          null,  // userId
          isAisle,
          now, now,
        ])
      }
    }
  }

  // 批量插入
  for (const s of seats) {
    await client.execute({
      sql: `INSERT INTO seat_data (class_id, group_index, row_index, col_index, user_id, is_aisle, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: s,
    })
  }

  return { success: true, total: seats.length }
})
