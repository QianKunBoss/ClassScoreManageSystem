import { requireSuperAdmin } from '../../utils/auth'
import { verifyWithConfig } from '../../utils/mail'

// POST /api/mail-services/test-connection — 按给定配置验证 SMTP 连接（不发邮件）
export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const body = await readBody(event)
  const res = await verifyWithConfig({
    host: body.host,
    port: body.port,
    secure: body.secure,
    username: body.username,
    password: body.password,
    fromAddress: body.fromAddress,
  })
  if (!res.ok) {
    setResponseStatus(event, 400)
    return { success: false, message: res.message }
  }
  return { success: true, message: res.message }
})
