import { seatData, users } from '../../../database/schema'
import { useSchoolDb, getSchoolRawClient } from '../../../database/db'
import { requireAdmin, getSchoolIdFromRequest } from '../../../utils/auth'
import { eq } from 'drizzle-orm'

// GET /api/seats/data — 获取座位数据（学校库，含学生姓名）
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)
  const client = await getSchoolRawClient(event, schoolId)

  // 支持按 classId 过滤
  const query = getQuery(event)
  let classId = query.classId ? Number(query.classId) : null

  // 班级管理员：自动使用自己管理的班级，且只能查看自己的班级
  if (admin.role === 'class_admin') {
    if (!classId) {
      classId = admin.classId
    } else if (classId !== admin.classId) {
      throw createError({ statusCode: 403, statusMessage: '只能查看自己班级的座位表' })
    }
  }

  if (!classId) {
    throw createError({ statusCode: 400, statusMessage: '缺少 classId 参数' })
  }

  let sql = `SELECT sd.id, sd.class_id, sd.group_index, sd.row_index, sd.col_index,
            sd.user_id, sd.is_aisle, u.username, u.actual_name
          FROM seat_data sd
          LEFT JOIN users u ON sd.user_id = u.id`
  const args: any[] = []

  if (classId) {
    sql += ` WHERE sd.class_id = ?`
    args.push(classId)
  }

  sql += ` ORDER BY sd.id`

  const result = await client.execute({ sql, args })

  // 将 snake_case 映射为 camelCase
  const data = (result.rows as any[]).map((row: any) => ({
    id: row.id,
    classId: row.class_id,
    groupIndex: row.group_index,
    rowIndex: row.row_index,
    colIndex: row.col_index,
    userId: row.user_id,
    username: row.username || null,
    actualName: row.actual_name || null,
    isAisle: row.is_aisle,
  }))

  return { data }
})
