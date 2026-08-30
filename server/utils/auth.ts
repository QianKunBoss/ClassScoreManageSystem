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
      message: '未登录，请先登录',
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
      message: '权限不足，仅超级管理员可操作',
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
 * 密码强度校验（统一规则，供重置/修改密码复用）
 * 当前规则：至少 6 位（与现有设置/修改密码规则一致）
 * 返回 { ok, message }
 */
export function validatePasswordStrength(pw: string): { ok: boolean; message: string } {
  if (!pw || pw.length < 6) {
    return { ok: false, message: '密码长度至少 6 位' }
  }
  return { ok: true, message: '' }
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
 * 从请求中解析目标 schoolId（多租户物理分库的库选择依据）
 *
 * 【安全约束】schoolId 决定打开哪个学校的 .db 文件，等价于租户边界：
 *  - 超级管理员（不隶属任何学校）：允许通过 ?schoolId= 跨校指定
 *  - 校/级/班管理员、学生：强制绑定自身所属学校，
 *    传入的 ?schoolId= 只允许等于自身学校，否则 403（防止跨租户读写）
 *
 * 身份以主库中的真实记录为准，不信任 session 里的 role 字段
 * （同浏览器同时登录学生会覆盖 session.role，且角色可能已被后台变更）。
 */
export async function getSchoolIdFromRequest(event: any): Promise<number> {
  const query = getQuery(event)
  const raw = query.schoolId

  const hasRequested = raw != null && raw !== '' && raw !== 'null' && raw !== 'undefined'
  const requested = hasRequested ? Number(raw) : null

  if (requested != null && (!Number.isFinite(requested) || requested <= 0)) {
    throw createError({
      statusCode: 400,
      message: 'schoolId 参数不合法',
    })
  }

  const admin = await getAdminFromSession(event)

  // 超级管理员：可跨校
  if (admin?.role === 'super_admin') {
    if (requested != null) return requested
    if (admin.schoolId != null) return Number(admin.schoolId)
    throw createError({
      statusCode: 400,
      message: '缺少 schoolId（超级管理员请通过 ?schoolId= 指定目标学校）',
    })
  }

  // 其余身份：只能操作自己学校
  const session = await getUserSession(event)
  const ownSchoolId = admin?.schoolId ?? (session as any)?.data?.schoolId ?? null

  if (ownSchoolId == null) {
    throw createError({
      statusCode: 400,
      message: '缺少 schoolId（请重新登录后再试）',
    })
  }

  if (requested != null && requested !== Number(ownSchoolId)) {
    throw createError({
      statusCode: 403,
      message: '无权限访问其他学校的数据',
    })
  }

  return Number(ownSchoolId)
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
      message: '请先登录',
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

// ========== 班级数据导入/导出的层级权限 ==========
// 鉴权一律基于【当前登录管理员的真实身份】解析出的管理范围，绝不信任前端传入的
// scope/gradeId/classId 参数，也不信任备份文件里的 meta（防止越权导入/导出）。

import { grades as gradesT, classes as classesT, users as usersT } from '../database/schema.school'

/**
 * 解析当前管理员在学校库内的可管理范围。
 * 返回：
 *  - role
 *  - schoolWide: 是否全校范围（school_admin / super_admin）
 *  - gradeIdSet: 可管理的年级 id 集合（schoolWide 时为 null 表示全部）
 *  - classIdSet: 可管理的班级 id 集合（schoolWide 时为 null 表示全部）
 *  - isGradeAllowed(gid): 能否管理该年级
 *  - isClassAllowed(cid): 能否管理该班级
 */
export async function resolveSchoolScope(admin: any, db: any) {
  const role = admin.role

  // super_admin / school_admin：全校（gradeId/classId 为 null 表示全部）
  if (role === 'super_admin' || role === 'school_admin') {
    return {
      role,
      schoolWide: true,
      gradeIdSet: null as Set<number> | null,
      classIdSet: null as Set<number> | null,
      isGradeAllowed: () => true,
      isClassAllowed: () => true,
    }
  }

  // grade_admin：本年级全部班级
  if (role === 'grade_admin') {
    const myGradeId = admin.gradeId
    const cls = await db.select({ id: classesT.id }).from(classesT).where(eq(classesT.gradeId, myGradeId))
    const classIdSet = new Set<number>(cls.map((c: any) => c.id))
    return {
      role,
      schoolWide: false,
      gradeIdSet: new Set<number>(myGradeId != null ? [myGradeId] : []),
      classIdSet,
      isGradeAllowed: (gid: number) => gid === myGradeId,
      isClassAllowed: (cid: number) => classIdSet.has(cid),
    }
  }

  // class_admin：仅本班
  if (role === 'class_admin') {
    const myClassId = admin.classId
    return {
      role,
      schoolWide: false,
      gradeIdSet: null,
      classIdSet: new Set<number>(myClassId != null ? [myClassId] : []),
      isGradeAllowed: () => false,
      isClassAllowed: (cid: number) => cid === myClassId,
    }
  }

  // 未知角色：无任何权限
  return {
    role,
    schoolWide: false,
    gradeIdSet: new Set<number>(),
    classIdSet: new Set<number>(),
    isGradeAllowed: () => false,
    isClassAllowed: () => false,
  }
}

/**
 * 校验当前管理员是否可管理指定班级，越权抛 403。
 */
export async function assertClassManagement(admin: any, db: any, classId: number | null | undefined) {
  if (classId == null) return
  const scope = await resolveSchoolScope(admin, db)
  if (!scope.isClassAllowed(classId)) {
    throw createError({
      statusCode: 403,
      message: '无权限操作该班级的数据',
    })
  }
}

/**
 * 校验当前管理员是否可管理指定年级，越权抛 403。
 */
export async function assertGradeManagement(admin: any, db: any, gradeId: number | null | undefined) {
  if (gradeId == null) return
  const scope = await resolveSchoolScope(admin, db)
  if (!scope.isGradeAllowed(gradeId)) {
    throw createError({
      statusCode: 403,
      message: '无权限操作该年级的数据',
    })
  }
}
