import { useSchoolDb } from '../../../../database/db'
import { users } from '../../../../database/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { verifyEmailCode } from '../../../../utils/mail'
import { validatePasswordStrength } from '../../../../utils/auth'

// POST /api/auth/student/forgot/reset — 学生找回密码：校验验证码后重置密码（无需登录）
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const schoolId = Number(body.schoolId)
  const username = (body.username || '').toString().trim()
  const code = (body.code || '').toString().trim()
  const newPassword = body.newPassword || ''

  if (!schoolId || !username || !code || !newPassword) {
    setResponseStatus(event, 400)
    return { success: false, message: '请填写完整的重置信息' }
  }

  const pw = validatePasswordStrength(newPassword)
  if (!pw.ok) {
    setResponseStatus(event, 400)
    return { success: false, message: pw.message }
  }

  const db = await useSchoolDb(event, schoolId)
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)
  const user = await db
    .select({ id: users.id, email: users.email, passwordHash: users.passwordHash })
    .from(users)
    .where(isEmail ? eq(users.email, username) : eq(users.username, username))
    .get()

  if (!user) {
    setResponseStatus(event, 404)
    return { success: false, message: '账号不存在' }
  }
  if (!user.email) {
    setResponseStatus(event, 400)
    return { success: false, message: '该账号未绑定邮箱，无法重置密码。请联系管理员。' }
  }
  if (!verifyEmailCode(user.email, code)) {
    setResponseStatus(event, 400)
    return { success: false, message: '验证码无效或已过期，请重新获取' }
  }
  // 新密码不得与当前密码相同
  if (bcrypt.compareSync(newPassword, user.passwordHash)) {
    setResponseStatus(event, 400)
    return { success: false, message: '新密码不能与当前密码相同' }
  }

  await db
    .update(users)
    .set({ passwordHash: bcrypt.hashSync(newPassword, 10) })
    .where(eq(users.id, user.id))

  return { success: true, message: '密码重置成功，请使用新密码登录' }
})
