import { useSchoolDb } from '../../../../database/db'
import { users } from '../../../../database/schema'
import { eq } from 'drizzle-orm'
import { issueVerificationCode, sendMail, renderTemplate } from '../../../../utils/mail'

// POST /api/auth/student/forgot/send-code — 学生找回密码：向已绑定邮箱发送验证码（无需登录）
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const schoolId = Number(body.schoolId)
  const username = (body.username || '').toString().trim()

  if (!schoolId || !username) {
    setResponseStatus(event, 400)
    return { success: false, message: '请填写学校与用户名或邮箱' }
  }

  const db = await useSchoolDb(event, schoolId)

  // 支持使用已绑定邮箱定位账号：含 @ 视为邮箱，否则视为用户名
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)
  const user = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(isEmail ? eq(users.email, username) : eq(users.username, username))
    .get()

  if (!user) {
    setResponseStatus(event, 404)
    return { success: false, message: '账号不存在' }
  }

  // 未绑定邮箱：明确提示并引导联系管理员
  if (!user.email) {
    setResponseStatus(event, 400)
    return { success: false, message: '该账号未绑定邮箱，无法使用邮箱找回密码。请联系管理员重置密码。' }
  }

  const issued = issueVerificationCode(user.email)
  if (!issued.ok) {
    const secs = Math.ceil((issued.remainingMs || 0) / 1000)
    setResponseStatus(event, 429)
    return { success: false, message: `发送过于频繁，请 ${secs} 秒后重试`, remainingMs: issued.remainingMs }
  }

  const code = issued.code!
  try {
    const { subject, html } = await renderTemplate('verification_code', {
      code,
      email: user.email,
      expiresMinutes: '10',
    })
    await sendMail({ to: user.email, subject, html })
    return { success: true, message: '验证码已发送至您的绑定邮箱，请查收' }
  } catch (e: any) {
    if (e?.message === 'NO_ENABLED_MAIL_SERVICE') {
      console.warn(`[DEV] 未配置邮件服务，找回密码验证码为：${code}`)
      return { success: true, dev: true, message: '当前未配置邮件服务（开发模式）：验证码已输出到服务器控制台。' }
    }
    setResponseStatus(event, 500)
    return { success: false, message: '邮件发送失败，请稍后重试。' }
  }
})
