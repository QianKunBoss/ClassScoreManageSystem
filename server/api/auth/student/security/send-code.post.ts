import { requireStudent } from '../../../../utils/auth'
import { useSchoolDb } from '../../../../database/db'
import { users } from '../../../../database/schema'
import { eq } from 'drizzle-orm'
import { issueVerificationCode, sendMail, renderTemplate } from '../../../../utils/mail'

// POST /api/auth/student/security/send-code — 改密验证：向已绑定邮箱发送验证码（需登录且已绑定邮箱）
export default defineEventHandler(async (event) => {
  const student = await requireStudent(event)
  const db = await useSchoolDb(event, student.schoolId)

  const user = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, student.id))
    .get()

  const email = user?.email
  if (!email) {
    setResponseStatus(event, 400)
    return { success: false, message: '尚未绑定邮箱，无法发送验证码' }
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
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[DEV] 未配置邮件服务，邮箱 ${email} 的改密验证码为：${code}`)
        return { success: true, dev: true, message: '当前未配置邮件服务（开发模式）：验证码已输出到服务器控制台，请查看运行日志。' }
      }
      setResponseStatus(event, 400)
      return { success: false, code: 'MAIL_NOT_CONFIGURED', message: '系统尚未配置邮件服务，无法发送验证码，请联系管理员配置邮件服务后再试。' }
    }
    setResponseStatus(event, 500)
    return { success: false, message: '邮件发送失败，请检查邮件服务配置或稍后重试。' }
  }
})
