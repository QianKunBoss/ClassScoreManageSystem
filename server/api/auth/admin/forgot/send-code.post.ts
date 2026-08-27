import { eq } from 'drizzle-orm'
import { admins } from '../../../../database/schema.main'
import { useMainDb } from '../../../../database/db'
import { EMAIL_RE, issueVerificationCode, sendMail, renderTemplate } from '../../../../utils/mail'

// POST /api/auth/admin/forgot/send-code — 管理员找回密码：向已绑定邮箱发送验证码（无需登录）
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const email = (body.email || '').toString().trim()

  if (!email || !EMAIL_RE.test(email)) {
    setResponseStatus(event, 400)
    return { success: false, message: '请输入有效的邮箱地址' }
  }

  const db = useMainDb()
  const admin = await db
    .select({ id: admins.id, email: admins.email })
    .from(admins)
    .where(eq(admins.email, email))
    .get()

  if (!admin || !admin.email) {
    setResponseStatus(event, 404)
    return { success: false, message: '该邮箱未注册或未绑定邮箱，请联系超级管理员重置密码' }
  }

  const issued = issueVerificationCode(email)
  if (!issued.ok) {
    const secs = Math.ceil((issued.remainingMs || 0) / 1000)
    setResponseStatus(event, 429)
    return { success: false, message: `发送过于频繁，请 ${secs} 秒后重试`, remainingMs: issued.remainingMs }
  }

  const code = issued.code!
  try {
    const { subject, html } = await renderTemplate('verification_code', {
      code,
      email,
      expiresMinutes: '10',
    })
    await sendMail({ to: email, subject, html })
    return { success: true, message: '验证码已发送至您的绑定邮箱，请查收' }
  } catch (e: any) {
    if (e?.message === 'NO_ENABLED_MAIL_SERVICE') {
      console.warn(`[DEV] 未配置邮件服务，管理员找回密码验证码为：${code}`)
      return { success: true, dev: true, message: '当前未配置邮件服务（开发模式）：验证码已输出到服务器控制台。' }
    }
    setResponseStatus(event, 500)
    return { success: false, message: '邮件发送失败，请稍后重试。' }
  }
})
