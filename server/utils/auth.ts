import { eq } from 'drizzle-orm'
import { admins } from '../database/schema.main'
import { useMainDb } from '../database/db'
import bcrypt from 'bcryptjs'

/**
 * 获取当前登录的管理员信息（含角色）
 * 从 session 中读取，如果没有登录返回 null
 */
export async function getAdminFromSession(event: any) {
  const session = await getUserSession(event)

  if (!(session.data as any)?.adminId) {
    return null
  }

  const db = useMainDb()
  const admin = await db
    .select()
    .from(admins)
    .where(eq(admins.id, (session.data as any).adminId as number))
    .get()

  return admin
}

/**
 * 要求管理员已登录，否则返回 401
 */
export async function requireAdmin(event: any) {
  const admin = await getAdminFromSession(event)

  if (!admin) {
    throw createError({
      statusCode: 401,
      statusMessage: '未登录，请先登录',
    })
  }

  return admin
}

/**
 * 要求超级管理员，否则返回 403
 * 用于敏感操作：用户删除、管理员管理、系统设置等
 */
export async function requireSuperAdmin(event: any) {
  const admin = await requireAdmin(event)

  if (admin.role !== 'super_admin') {
    throw createError({
      statusCode: 403,
      statusMessage: '权限不足，仅超级管理员可操作',
    })
  }

  return admin
}

/**
 * 密码哈希（bcrypt，同步）
 */
export function hashPasswordBcrypt(password: string): string {
  return bcrypt.hashSync(password, 10)
}

/**
 * 验证密码（bcrypt）
 */
export function verifyPasswordBcrypt(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash)
}

/**
 * 验证管理员密码
 */
export async function verifyAdminPassword(adminId: number, password: string): Promise<boolean> {
  const db = useMainDb()

  const admin = await db
    .select({ passwordHash: admins.passwordHash })
    .from(admins)
    .where(eq(admins.id, adminId))
    .get()

  if (!admin) return false

  return bcrypt.compareSync(password, admin.passwordHash)
}

/**
 * 从请求中获取 schoolId
 * - 普通管理员：从 session 中取 admin.schoolId
 * - 超级管理员：从 query 参数中取 ?schoolId=
 * 都没取到则抛 400
 */
export async function getSchoolIdFromRequest(event: any): Promise<number> {
  const query = getQuery(event)

  // 超级管理员可以通过 query 参数指定学校
  if (query.schoolId) {
    return Number(query.schoolId)
  }

  // 从 session 中取（登录时存进去的）
  const session = await getUserSession(event)
  if ((session as any)?.data?.schoolId) {
    return (session as any).data.schoolId
  }

  throw createError({
    statusCode: 400,
    statusMessage: '缺少 schoolId（普通管理员请从登录页正常登录，超级管理员请传递 ?schoolId= 参数）',
  })
}

// ========== 学生鉴权 ==========

/**
 * 获取当前登录的学生信息（从 session 中读取）
 * 未登录返回 null
 */
export async function getStudentFromSession(event: any) {
  const session = await getUserSession(event)
  const data = (session as any)?.data

  if (!data?.studentId) {
    return null
  }

  return {
    id: data.studentId,
    username: data.studentUsername,
    actualName: data.studentActualName,
    schoolId: data.schoolId,
    classId: data.classId,
    role: 'student' as const,
  }
}

/**
 * 要求学生已登录，否则返回 401
 */
export async function requireStudent(event: any) {
  const student = await getStudentFromSession(event)

  if (!student) {
    throw createError({
      statusCode: 401,
      statusMessage: '请先登录',
    })
  }

  return student
}

/**
 * 学生退出登录（清除 session 中的学生信息）
 */
export async function logoutStudent(event: any) {
  const session = await getUserSession(event)
  await setUserSession(event, {
    ...session,
    data: {
      ...((session as any)?.data || {}),
      studentId: undefined,
      studentUsername: undefined,
      studentActualName: undefined,
      classId: undefined,
      role: undefined,
    },
  })
}

/**
 * 刷新 session 中的学生信息（用于学生修改个人信息后同步 session）
 */
export async function setStudentSession(event: any, student: any) {
  const session = await getUserSession(event)
  await setUserSession(event, {
    ...session,
    data: {
      ...((session as any)?.data || {}),
      studentId: student.id,
      studentUsername: student.username,
      studentActualName: student.actualName,
      schoolId: student.schoolId,
      classId: student.classId,
      role: 'student',
    },
  })
}
