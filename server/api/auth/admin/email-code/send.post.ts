import { eq } from 'drizzle-orm'
import { admins } from '../../../../database/schema.main'
import { useMainDb } from '../../../../database/db'
import { EMAIL_RE, issueVerificationCode, sendMail, renderTemplate } from '../../../../utils/mail'

// POST /api/auth/admin/email-code/send — 管理员邮箱验证码登录：发送验证码（无需登录）
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

  // 不存在则不发送，明确提示（不泄露邮箱是否注册以外更多信息）
  if (!admin) {
    setResponseStatus(event, 400)
    return { success: false, message: '该邮箱未注册，请检查邮箱或改用账号登录' }
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
    return { success: true, message: '验证码已发送至您的邮箱，请查收' }
  } catch (e: any) {
    if (e?.message === 'NO_ENABLED_MAIL_SERVICE') {
      console.warn(`[DEV] 未配置邮件服务，管理员邮箱验证码为：${code}`)
      return { success: true, dev: true, message: '当前未配置邮件服务（开发模式）：验证码已输出到服务器控制台。' }
    }
    setResponseStatus(event, 500)
    return { success: false, message: '邮件发送失败，请稍后重试。' }
  }
})
