import { eq } from 'drizzle-orm'
import { admins } from '../../../../database/schema.main'
import { useMainDb } from '../../../../database/db'
import { EMAIL_RE, verifyEmailCode } from '../../../../utils/mail'
import { validatePasswordStrength, hashPasswordBcrypt } from '../../../../utils/auth'
import bcrypt from 'bcryptjs'

// POST /api/auth/admin/forgot/reset — 管理员找回密码：校验验证码后重置密码（无需登录）
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const email = (body.email || '').toString().trim()
  const code = (body.code || '').toString().trim()
  const newPassword = body.newPassword || ''

  if (!email || !EMAIL_RE.test(email) || !code || !newPassword) {
    setResponseStatus(event, 400)
    return { success: false, message: '请填写完整的重置信息' }
  }

  const pw = validatePasswordStrength(newPassword)
  if (!pw.ok) {
    setResponseStatus(event, 400)
    return { success: false, message: pw.message }
  }

  const db = useMainDb()
  const admin = await db
    .select({ id: admins.id, email: admins.email, passwordHash: admins.passwordHash })
    .from(admins)
    .where(eq(admins.email, email))
    .get()

  if (!admin || !admin.email) {
    setResponseStatus(event, 404)
    return { success: false, message: '该邮箱未注册或未绑定邮箱' }
  }

  if (!verifyEmailCode(email, code)) {
    setResponseStatus(event, 400)
    return { success: false, message: '验证码无效或已过期，请重新获取' }
  }

  // 新密码不得与当前密码相同
  if (bcrypt.compareSync(newPassword, admin.passwordHash)) {
    setResponseStatus(event, 400)
    return { success: false, message: '新密码不能与当前密码相同' }
  }

  await db
    .update(admins)
    .set({ passwordHash: hashPasswordBcrypt(newPassword) })
    .where(eq(admins.id, admin.id))

  return { success: true, message: '密码重置成功，请使用新密码登录' }
})
