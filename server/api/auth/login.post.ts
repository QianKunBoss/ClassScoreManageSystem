import { eq, and, isNull } from 'drizzle-orm'
import { admins } from '../../database/schema'
import { useMainDb } from '../../database/db'
import { verifyPasswordBcrypt } from '../../utils/auth'
import { EMAIL_RE } from '../../utils/mail'
import { assertLoginAllowed, recordLoginFailure, clearLoginFailures } from '../../utils/rate-limit'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { username, password, schoolId } = body

  if (!username || !password) {
    throw createError({
      statusCode: 400,
      message: '请输入账号和密码',
    })
  }

  const db = useMainDb()

  // 兼容邮箱登录：标识符含 @ 视为邮箱（全局唯一，直接按 email 查询）
  const identifier = String(username).trim()
  const isEmail = EMAIL_RE.test(identifier)
  const hasSchool = schoolId != null && schoolId !== '' && schoolId !== 'null'
  const sid = hasSchool ? Number(schoolId) : null

  // 【安全】登录限流：必须在任何密码比对之前拦截，否则接口可被无限次爆破。
  // 限流标识：邮箱全局唯一；用户名需按学校区分（不同学校允许同名管理员）。
  const rateIdentifier = isEmail ? identifier : `${sid ?? 'super'}#${identifier}`
  assertLoginAllowed(event, 'admin-password', rateIdentifier)

  // 根据标识符类型决定查询方式
  // - 邮箱：按 email 全局唯一查询（忽略 schoolId）
  // - 用户名 + 提供 schoolId：查该学校下的管理员
  // - 用户名 + 未提供 schoolId：查超级管理员 (schoolId IS NULL)
  let admin

  if (isEmail) {
    admin = await db
      .select()
      .from(admins)
      .where(eq(admins.email, identifier))
      .get()
  } else if (sid != null) {
    admin = await db
      .select()
      .from(admins)
      .where(and(
        eq(admins.username, identifier),
        eq(admins.schoolId, sid),
      ))
      .get()
  } else {
    // 超级管理员登录（schoolId 为 NULL）
    admin = await db
      .select()
      .from(admins)
      .where(and(
        eq(admins.username, identifier),
        isNull(admins.schoolId),
      ))
      .get()
  }

  if (!admin || !verifyPasswordBcrypt(password, admin.passwordHash)) {
    // 账号不存在与密码错误都计入失败，避免通过响应差异枚举账号
    recordLoginFailure(event, 'admin-password', rateIdentifier)
    throw createError({
      statusCode: 401,
      message: '账号或密码错误',
    })
  }

  // 凭证正确，清除失败计数
  clearLoginFailures(event, 'admin-password', rateIdentifier)

  // 检查账号是否被封禁
  if (admin.disabled === 1) {
    throw createError({
      statusCode: 403,
      message: '账号已被封禁，请联系超级管理员',
    })
  }

  // 更新最后登录时间
  await db.update(admins)
    .set({ lastLogin: new Date().toISOString() })
    .where(eq(admins.id, admin.id))

  // 设置 session（把 schoolId 存进去）
  const session = await getUserSession(event)
  await setUserSession(event, {
    ...session,
    data: {
      adminId: admin.id,
      username: admin.username,
      role: admin.role,
      schoolId: admin.schoolId,
      gradeId: admin.gradeId,
      classId: admin.classId,
    },
  })

  return {
    success: true,
    admin: {
      id: admin.id,
      username: admin.username,
      role: admin.role,
      schoolId: admin.schoolId,
      gradeId: admin.gradeId,
      classId: admin.classId,
      mustChangePassword: !!admin.mustChangePassword,
    },
  }
})
