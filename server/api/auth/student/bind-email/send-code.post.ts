import { requireStudent } from '../../../../utils/auth'
import { useSchoolDb } from '../../../../database/db'
import { users } from '../../../../database/schema'
import { eq } from 'drizzle-orm'
import { EMAIL_RE, issueVerificationCode, sendMail, renderTemplate } from '../../../../utils/mail'

// POST /api/auth/student/bind-email/send-code — 学生绑定邮箱：发送验证码（需登录）
export default defineEventHandler(async (event) => {
  const student = await requireStudent(event)
  const body = await readBody(event)
  const email = (body.email || '').toString().trim().toLowerCase()

  if (!email || !EMAIL_RE.test(email)) {
    setResponseStatus(event, 400)
    return { success: false, message: '请输入有效的电子邮箱' }
  }

  const db = await useSchoolDb(event, student.schoolId)

  // 同一邮箱不可绑定多个账号
  const conflict = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .get()
  if (conflict && conflict.id !== student.id) {
    setResponseStatus(event, 409)
    return { success: false, message: '该邮箱已被其他账号绑定，请更换邮箱' }
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
      // 开发模式：未配置邮件服务时把验证码打到控制台，便于本地测试
      console.warn(`[DEV] 未配置邮件服务，邮箱 ${email} 的绑定验证码为：${code}`)
      return { success: true, dev: true, message: '当前未配置邮件服务（开发模式）：验证码已输出到服务器控制台，请查看运行日志。' }
    }
    setResponseStatus(event, 500)
    return { success: false, message: '邮件发送失败，请检查邮件服务配置或稍后重试。' }
  }
})
