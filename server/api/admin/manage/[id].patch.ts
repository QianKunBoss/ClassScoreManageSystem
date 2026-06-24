import { eq, and } from 'drizzle-orm'
import { admins } from '../../../database/schema.main'
import { useMainDb } from '../../../database/db'
import { requireAdmin } from '../../../utils/auth'

// PATCH: 更新管理员（角色 / 密码）
// 权限规则：
// - 超级管理员：可以修改所有管理员
// - 学校管理员：可以修改本校的所有管理员
// - 年级管理员：可以修改本年级的班级管理员
// - 班级管理员：无权修改其他管理员（只能改自己，通过 /api/auth/me PATCH）
export default defineEventHandler(async (event) => {
  const currentAdmin = await requireAdmin(event)
  const db = useMainDb()
  const id = parseInt(event.context.params?.id || '')

  if (isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: '无效的管理员ID' })
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

  // 检查权限：当前管理员能否操作目标管理员
  if (!canManageAdmin(currentAdmin, targetAdmin)) {
    throw createError({ statusCode: 403, statusMessage: '无权操作此管理员' })
  }

  const body = await readBody(event) as {
    role?: string
    password?: string
    disabled?: number
  }
  
  if (!body.role && !body.password && body.disabled === undefined) {
    throw createError({ statusCode: 400, statusMessage: '请指定要修改的字段' })
  }

  const setData: Record<string, any> = {}

  if (body.role) {
    // 修改角色也需要权限检查
    // 学校管理员不能把别人改成学校管理员或超级管理员
    if (currentAdmin.role === 'school_admin') {
      if (body.role === 'school_admin' || body.role === 'super_admin') {
        throw createError({ statusCode: 403, statusMessage: '无权设置此角色' })
      }
    }
    // 年级管理员不能修改角色
    if (currentAdmin.role === 'grade_admin') {
      throw createError({ statusCode: 403, statusMessage: '无权修改角色' })
    }
    setData.role = body.role
  }

  if (body.password) {
    if (body.password.length < 6) {
      throw createError({ statusCode: 400, statusMessage: '密码长度至少6位' })
    }
    const { hashPasswordBcrypt } = await import('../../../utils/auth')
    setData.passwordHash = hashPasswordBcrypt(body.password)
  }

  if (body.disabled !== undefined) {
    // 只有超级管理员可以封禁/启用管理员
    if (currentAdmin.role !== 'super_admin') {
      throw createError({ statusCode: 403, statusMessage: '无权执行此操作' })
    }
    setData.disabled = body.disabled ? 1 : 0
  }

  await db.update(admins)
    .set(setData)
    .where(eq(admins.id, id))

  return { success: true }
})

// 检查当前管理员是否能管理目标管理员
function canManageAdmin(current: any, target: any): boolean {
  // 超级管理员可以管理所有
  if (current.role === 'super_admin') return true

  // 不能管理自己（自己改自己通过 /api/auth/me PATCH）
  if (current.id === target.id) return false

  // 学校管理员可以管理本校的所有管理员
  if (current.role === 'school_admin') {
    return current.schoolId === target.schoolId
  }

  // 年级管理员可以管理本年级的班级管理员
  if (current.role === 'grade_admin') {
    return (
      current.schoolId === target.schoolId &&
      current.gradeId === target.gradeId &&
      target.role === 'class_admin'
    )
  }

  // 班级管理员无权管理其他管理员
  return false
}
