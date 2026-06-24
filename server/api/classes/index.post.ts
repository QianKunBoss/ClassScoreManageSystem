import { classes, grades } from '../../database/schema'
import { useSchoolDb } from '../../database/db'
import { requireAdmin, getSchoolIdFromRequest } from '../../utils/auth'
import { eq, and } from 'drizzle-orm'

// POST /api/classes — 创建班级（学校库）
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)

  const body = await readBody(event)
  const { gradeId, name } = body

  if (!gradeId || isNaN(Number(gradeId))) {
    throw createError({ statusCode: 400, statusMessage: '年级ID无效' })
  }

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw createError({ statusCode: 400, statusMessage: '班级名称不能为空' })
  }

  const gradeIdNum = Number(gradeId)

  // 检查年级是否存在（在学校库内）
  const grade = await db.select().from(grades).where(eq(grades.id, gradeIdNum)).get()
  if (!grade) {
    throw createError({ statusCode: 404, statusMessage: '年级不存在' })
  }

  // 权限检查
  if (admin.role === 'class_admin') {
    throw createError({ statusCode: 403, statusMessage: '权限不足' })
  }
  if (admin.role === 'grade_admin' && admin.gradeId !== gradeIdNum) {
    throw createError({ statusCode: 403, statusMessage: '只能为自己年级创建班级' })
  }

  // 检查同年级班级重名（必须用 and() 合并条件，链式 .where() 会覆盖前一个）
  const existing = await db
    .select()
    .from(classes)
    .where(and(eq(classes.gradeId, gradeIdNum), eq(classes.name, name.trim())))
    .get()

  if (existing) {
    throw createError({ statusCode: 400, statusMessage: '该年级下已存在同名班级' })
  }

  const [result] = await db
    .insert(classes)
    .values({ gradeId: gradeIdNum, name: name.trim() })
    .returning()
    .all()

  return { success: true, data: result }
})
