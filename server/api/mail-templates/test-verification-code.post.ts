import { requireSuperAdmin } from '../../utils/auth'
import { EMAIL_RE, issueVerificationCode, sendMail, renderTemplate, renderString } from '../../utils/mail'

// POST /api/mail-templates/test-verification-code — （superadmin）发送验证码模板的测试邮件
export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)

  const body = await readBody(event)
  const to = (body.to || '').toString().trim().toLowerCase()
  if (!to || !EMAIL_RE.test(to)) {
    setResponseStatus(event, 400)
    return { success: false, message: '请输入有效的测试邮箱' }
  }

  const issued = issueVerificationCode(to)
  if (!issued.ok) {
    const secs = Math.ceil((issued.remainingMs || 0) / 1000)
    setResponseStatus(event, 429)
    return { success: false, message: `发送过于频繁，请 ${secs} 秒后重试` }
  }
  const code = issued.code!

  // 渲染变量与正式申请发送一致
  const vars = { code, email: to, expiresMinutes: '10' }
  let subject: string
  let html: string
  if (body.subject && body.bodyHtml) {
    // 使用编辑中的模板内容（无需先保存）
    subject = renderString(String(body.subject), vars)
    html = renderString(String(body.bodyHtml), vars)
  } else {
    const r = await renderTemplate('verification_code', vars)
    subject = r.subject
    html = r.html
  }

  try {
    await sendMail({ to, subject, html })
    return { success: true, message: `验证码已发送至 ${to}，请查收` }
  } catch (e: any) {
    if (e?.message === 'NO_ENABLED_MAIL_SERVICE') {
      console.warn(`[DEV] 未配置邮件服务，测试邮箱 ${to} 的验证码为：${code}`)
      return { success: true, dev: true, code, message: `开发模式未配置邮件服务：验证码已输出到服务器控制台（${code}）` }
    }
    setResponseStatus(event, 500)
    return { success: false, message: `邮件发送失败：${e?.message || '未知错误'}` }
  }
})
