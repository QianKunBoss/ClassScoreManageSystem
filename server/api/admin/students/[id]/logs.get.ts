import fs from 'fs'
import path from 'path'
import { eq, desc } from 'drizzle-orm'
import { scoreLogs } from '../../../../database/schema.school'
import { useSchoolDb } from '../../../../database/db'
import { requireSuperAdmin } from '../../../../utils/auth'

// GET /api/admin/students/[id]/logs?schoolId=&limit= — 超级管理员查看某学生的加减分记录（最新在前）
export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const query = getQuery(event) as { schoolId?: string; limit?: string }
  const schoolId = query.schoolId ? Number(query.schoolId) : ''
  if (!schoolId) {
    throw createError({ statusCode: 400, message: '缺少 schoolId 参数' })
  }

  const dbPath = path.join(process.cwd(), 'data', 'schools', `${schoolId}.db`)
  if (!fs.existsSync(dbPath)) {
    throw createError({ statusCode: 404, message: '学校库不存在' })
  }

  const db = await useSchoolDb(event, schoolId)
  const id = Number(getRouterParam(event, 'id'))
  if (!id) {
    throw createError({ statusCode: 400, message: '缺少用户 ID' })
  }

  const limit = Math.min(50, Math.max(1, Number(query.limit) || 10))
  const logs = await db
    .select()
    .from(scoreLogs)
    .where(eq(scoreLogs.userId, id))
    .orderBy(desc(scoreLogs.createdAt))
    .limit(limit)

  return { success: true, data: logs }
})
