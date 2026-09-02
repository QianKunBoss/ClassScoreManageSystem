import { requireAdmin } from '../../../../utils/auth'
import { useMainDb } from '../../../../database/db'
import { admins } from '../../../../database/schema'
import { eq } from 'drizzle-orm'
import { verifyEmailCode } from '../../../../utils/mail'

// POST /api/auth/admin/bind-email/verify — 管理员绑定邮箱：校验验证码并完成绑定（需登录）
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const body = await readBody(event)
  const email = (body.email || '').toString().trim().toLowerCase()
  const code = (body.code || '').toString().trim()

  if (!email || !code) {
    setResponseStatus(event, 400)
    return { success: false, message: '请填写邮箱和验证码' }
  }

  if (!verifyEmailCode(email, code)) {
    setResponseStatus(event, 400)
    return { success: false, message: '验证码无效或已过期，请重新获取' }
  }

  const db = useMainDb()

  // 二次校验邮箱未被占用（防止并发/竞态）
  const conflict = await db
    .select({ id: admins.id })
    .from(admins)
    .where(eq(admins.email, email))
    .get()
  if (conflict && conflict.id !== admin.id) {
    setResponseStatus(event, 409)
    return { success: false, message: '该邮箱已被其他账号绑定，请更换邮箱' }
  }

  await db
    .update(admins)
    .set({ email, emailBoundAt: new Date().toISOString() })
    .where(eq(admins.id, admin.id))

  return { success: true, message: '邮箱绑定成功' }
})
