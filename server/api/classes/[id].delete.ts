import { eq } from 'drizzle-orm'
import { classes } from '../../database/schema'
import { useSchoolDb } from '../../database/db'
import { requireAdmin, getSchoolIdFromRequest } from '../../utils/auth'

// DELETE /api/classes/[id] — 删除班级（学校库，需二次密码确认）
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)

  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) {
    throw createError({ statusCode: 400, statusMessage: '无效的班级ID' })
  }
  const classId = Number(id)

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

  // 检查班级是否存在
  const classInfo = await db
    .select({ id: classes.id, gradeId: classes.gradeId })
    .from(classes)
    .where(eq(classes.id, classId))
    .get()

  if (!classInfo) {
    throw createError({ statusCode: 404, statusMessage: '班级不存在' })
  }

  // 权限检查
  if (admin.role === 'class_admin') {
    throw createError({ statusCode: 403, statusMessage: '权限不足' })
  }
  if (admin.role === 'grade_admin' && admin.gradeId !== classInfo.gradeId) {
    throw createError({ statusCode: 403, statusMessage: '只能删除自己年级的班级' })
  }

  // 删除班级（CASCADE 自动删除关联学生、积分记录等）
  await db.delete(classes).where(eq(classes.id, classId))

  return { success: true, message: '班级已删除' }
})
