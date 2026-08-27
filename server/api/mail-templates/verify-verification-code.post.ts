import { requireSuperAdmin } from '../../utils/auth'
import { verifyEmailCode } from '../../utils/mail'

// POST /api/mail-templates/verify-verification-code — （superadmin）校验测试验证码
export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)

  const body = await readBody(event)
  const email = (body.email || '').toString().trim().toLowerCase()
  const code = (body.code || '').toString().trim()
  if (!email || !code) {
    setResponseStatus(event, 400)
    return { ok: false, message: '邮箱和验证码均为必填' }
  }

  const ok = verifyEmailCode(email, code)
  return { ok, message: ok ? '验证码校验通过' : '验证码错误或已失效' }
})
