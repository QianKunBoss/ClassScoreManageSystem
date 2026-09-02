import { eq } from 'drizzle-orm'
import { admins } from '../../../../database/schema.main'
import { useMainDb } from '../../../../database/db'
import { EMAIL_RE, verifyEmailCode } from '../../../../utils/mail'
import { assertLoginAllowed, recordLoginFailure, clearLoginFailures } from '../../../../utils/rate-limit'

// POST /api/auth/admin/email-code/login — 管理员邮箱验证码登录（无需密码，无需登录态）
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const email = (body.email || '').toString().trim()
  const code = (body.code || '').toString().trim()

  if (!email || !EMAIL_RE.test(email) || !code) {
    setResponseStatus(event, 400)
    return { success: false, message: '请填写邮箱和验证码' }
  }

  // 【安全】登录限流：6 位数字验证码可被枚举，必须在校验前拦截
  assertLoginAllowed(event, 'admin-email-code', email)

  const db = useMainDb()
  const admin = await db
    .select()
    .from(admins)
    .where(eq(admins.email, email))
    .get()

  if (!admin) {
    recordLoginFailure(event, 'admin-email-code', email)
    setResponseStatus(event, 401)
    return { success: false, message: '该邮箱未注册' }
  }

  if (!verifyEmailCode(email, code)) {
    recordLoginFailure(event, 'admin-email-code', email)
    setResponseStatus(event, 400)
    return { success: false, message: '验证码无效或已过期，请重新获取' }
  }

  // 验证通过，清除失败计数
  clearLoginFailures(event, 'admin-email-code', email)

  // 账号被禁用无法登录
  if (admin.disabled === 1) {
    setResponseStatus(event, 403)
    return { success: false, message: '账号已被封禁，请联系超级管理员' }
  }

  // 更新最后登录时间
  await db.update(admins)
    .set({ lastLogin: new Date().toISOString() })
    .where(eq(admins.id, admin.id))

  // 设置 session（与账号密码登录保持一致）
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
      email: admin.email || null,
    },
  }
})
