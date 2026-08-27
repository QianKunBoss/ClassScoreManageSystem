import { requireSuperAdmin } from '../../utils/auth'
import { sendTestWithConfig } from '../../utils/mail'
import { EMAIL_RE } from '../../utils/mail'

// POST /api/mail-services/test-send — 用给定配置发送一封测试邮件
export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const body = await readBody(event)
  const to = (body.to || '').toString().trim()
  const fromAddress = (body.fromAddress || '').toString().trim()

  if (!fromAddress || !EMAIL_RE.test(fromAddress)) {
    setResponseStatus(event, 400)
    return { success: false, message: '发件人邮箱未配置或格式不正确' }
  }
  const recipient = to || fromAddress
  if (!EMAIL_RE.test(recipient)) {
    setResponseStatus(event, 400)
    return { success: false, message: '请提供有效的测试收件邮箱' }
  }

  try {
    await sendTestWithConfig(
      {
        host: body.host,
        port: body.port,
        secure: body.secure,
        username: body.username,
        password: body.password,
        fromName: body.fromName,
        fromAddress,
      },
      {
        to: recipient,
        subject: '【CSMS】邮件发送测试',
        html: `
          <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;background:#0b1220;padding:24px;border-radius:12px;max-width:440px;margin:0 auto">
            <h2 style="color:#4a7ab5;margin:0 0 16px">CSMS 班级积分管理系统</h2>
            <p style="margin:0 0 12px">这是一封<b>邮件发送测试</b>邮件。</p>
            <p style="margin:0 0 12px">如果您收到此邮件，说明该邮件服务配置正确，系统已可正常发送邮件。</p>
            <p style="margin:0;color:#94a3b8;font-size:13px">发送时间：${new Date().toLocaleString('zh-CN')}</p>
          </div>`,
      },
    )
    return { success: true, message: `测试邮件已发送至 ${recipient}，请查收` }
  } catch (e: any) {
    setResponseStatus(event, 500)
    return { success: false, message: `发送失败：${e?.message || '未知错误'}` }
  }
})
