import { eq } from 'drizzle-orm'
import { grades } from '../../database/schema'
import { useSchoolDb } from '../../database/db'
import { requireAdmin, getSchoolIdFromRequest } from '../../utils/auth'

// DELETE /api/grades/[id] — 删除年级（学校库，需二次密码确认）
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)

  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) {
    throw createError({ statusCode: 400, statusMessage: '无效的年级ID' })
  }
  const gradeId = Number(id)

  // 二次确认密码
  const confirmPassword = getHeader(event, 'x-confirm-password')
  if (!confirmPassword) {
    throw createError({ statusCode: 400, statusMessage: '需要提供确认密码' })
  }
  const { verifyAdminPassword } = await import('../../utils/auth')
  const passwordValid = await verifyAdminPassword(admin.id, confirmPassword)
  if (!passwordValid) {
    throw createError({ statusCode: 403, statusMessage: '密码验证失败' })
  }

  // 检查年级是否存在
  const grade = await db.select().from(grades).where(eq(grades.id, gradeId)).get()
  if (!grade) {
    throw createError({ statusCode: 404, statusMessage: '年级不存在' })
  }

  // 权限检查
  if (admin.role === 'class_admin') {
    throw createError({ statusCode: 403, statusMessage: '权限不足' })
  }
  if (admin.role === 'grade_admin' && admin.gradeId !== gradeId) {
    throw createError({ statusCode: 403, statusMessage: '只能操作自己管理的年级' })
  }

  // 删除年级（CASCADE 自动删除关联班级和学生）
  await db.delete(grades).where(eq(grades.id, gradeId))

  return { success: true, message: '年级已删除' }
})
