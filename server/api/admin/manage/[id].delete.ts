import { eq } from 'drizzle-orm'
import { admins } from '../../../database/schema.main'
import { useMainDb } from '../../../database/db'
import { requireAdmin, verifyAdminPassword } from '../../../utils/auth'

// DELETE: 删除管理员
// 权限规则同 PATCH
export default defineEventHandler(async (event) => {
  const currentAdmin = await requireAdmin(event)
  const db = useMainDb()
  const id = parseInt(event.context.params?.id || '')

  if (isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: '无效的管理员ID' })
  }

  // 禁止删除自己
  if (currentAdmin.id === id) {
    throw createError({ statusCode: 400, statusMessage: '不能删除自己的账号' })
  }

  // 查出目标管理员
  const targetAdmin = await db
    .select()
    .from(admins)
    .where(eq(admins.id, id))
    .get()

  if (!targetAdmin) {
    throw createError({ statusCode: 404, statusMessage: '管理员不存在' })
  }

  // 检查权限
  if (!canManageAdmin(currentAdmin, targetAdmin)) {
    throw createError({ statusCode: 403, statusMessage: '无权操作此管理员' })
  }

  // 验证确认密码
  const confirmPassword = getHeader(event, 'x-confirm-password') || ''
  if (!confirmPassword) {
    throw createError({ statusCode: 400, statusMessage: '请提供确认密码' })
  }
  const passwordValid = await verifyAdminPassword(currentAdmin.id, confirmPassword)
  if (!passwordValid) {
    throw createError({ statusCode: 400, statusMessage: '确认密码错误' })
  }

  await db.delete(admins).where(eq(admins.id, id))
  return { success: true }
})

// 检查当前管理员是否能管理目标管理员（同 PATCH）
function canManageAdmin(current: any, target: any): boolean {
  if (current.role === 'super_admin') return true
  if (current.id === target.id) return false
  if (current.role === 'school_admin') {
    return current.schoolId === target.schoolId
  }
  if (current.role === 'grade_admin') {
    return (
      current.schoolId === target.schoolId &&
      current.gradeId === target.gradeId &&
      target.role === 'class_admin'
    )
  }
  return false
}
