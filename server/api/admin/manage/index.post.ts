import { eq, and, isNull, inArray } from 'drizzle-orm'
import { admins } from '../../../database/schema.main'
import { useMainDb } from '../../../database/db'
import { requireAdmin } from '../../../utils/auth'

// POST: 创建管理员
// 权限规则：
// - 超级管理员：可以创建任意类型管理员（需指定 schoolId）
// - 学校管理员：可以创建本校的年级管理员和班级管理员（自动填 schoolId）
// - 年级管理员：可以创建本年级的班级管理员（自动填 schoolId + gradeId）
// - 班级管理员：无权创建
export default defineEventHandler(async (event) => {
  const currentAdmin = await requireAdmin(event)
  const db = useMainDb()
  const body = await readBody(event) as {
    username: string
    password: string
    role?: string
    schoolId?: number | null
    gradeId?: number | null
    classId?: number | null
  }

  if (!body.username || !body.password) {
    throw createError({ statusCode: 400, statusMessage: '请填写用户名和密码' })
  }

  // 根据当前管理员角色，确定目标管理员的 schoolId/gradeId/classId
  let targetRole = body.role || 'school_admin'
  let targetSchoolId: number | null = null
  let targetGradeId: number | null = null
  let targetClassId: number | null = null

  if (currentAdmin.role === 'super_admin') {
    // 超级管理员：使用请求体中的值
    targetSchoolId = body.schoolId || null
    targetGradeId = body.gradeId || null
    targetClassId = body.classId || null
  } else if (currentAdmin.role === 'school_admin') {
    // 学校管理员：只能创建本校的管理员
    targetSchoolId = currentAdmin.schoolId
    if (targetRole === 'school_admin') {
      // 不能创建同级（学校管理员）账号，除非是超级管理员
      throw createError({ statusCode: 403, statusMessage: '无权创建学校管理员账号' })
    }
    if (targetRole === 'grade_admin') {
      // 创建年级管理员：需要指定 gradeId
      targetGradeId = body.gradeId || null
      if (!targetGradeId) {
        throw createError({ statusCode: 400, statusMessage: '创建年级管理员必须指定年级' })
      }
    } else if (targetRole === 'class_admin') {
      // 创建班级管理员：需要指定 gradeId + classId
      targetGradeId = body.gradeId || null
      targetClassId = body.classId || null
      if (!targetGradeId || !targetClassId) {
        throw createError({ statusCode: 400, statusMessage: '创建班级管理员必须指定年级和班级' })
      }
    }
  } else if (currentAdmin.role === 'grade_admin') {
    // 年级管理员：只能创建本年级的班级管理员
    if (targetRole !== 'class_admin') {
      throw createError({ statusCode: 403, statusMessage: '只能创建班级管理员账号' })
    }
    targetSchoolId = currentAdmin.schoolId
    targetGradeId = currentAdmin.gradeId
    targetClassId = body.classId || null
    if (!targetClassId) {
      throw createError({ statusCode: 400, statusMessage: '创建班级管理员必须指定班级' })
    }
  } else {
    // 班级管理员：无权创建
    throw createError({ statusCode: 403, statusMessage: '无权创建管理员账号' })
  }

  // 检查同一学校内用户名是否冲突
  const conflict = targetSchoolId
    ? await db.select({ id: admins.id }).from(admins)
        .where(and(
          eq(admins.username, body.username),
          eq(admins.schoolId, targetSchoolId),
        ))
        .get()
    : await db.select({ id: admins.id }).from(admins)
        .where(and(
          eq(admins.username, body.username),
          isNull(admins.schoolId),
        ))
        .get()

  if (conflict) {
    const scope = targetSchoolId ? '该学校内' : '超级管理员中'
    throw createError({ statusCode: 400, statusMessage: `${scope}用户名 "${body.username}" 已存在` })
  }

  const { hashPasswordBcrypt } = await import('../../../utils/auth')
  const passwordHash = hashPasswordBcrypt(body.password)

  const [newAdmin] = await db.insert(admins).values({
    username: body.username,
    passwordHash,
    role: targetRole,
    schoolId: targetSchoolId,
    gradeId: targetGradeId,
    classId: targetClassId,
    mustChangePassword: 1,
  }).returning().all()

  return {
    success: true,
    data: {
      id: newAdmin.id,
      username: newAdmin.username,
      role: newAdmin.role,
      schoolId: newAdmin.schoolId,
    },
  }
})
