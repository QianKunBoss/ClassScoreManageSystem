import { requireStudent, setStudentSession } from '../../../../utils/auth'
import { useSchoolDb } from '../../../../database/db'
import { users } from '../../../../database/schema'
import { eq } from 'drizzle-orm'
import { verifyEmailCode } from '../../../../utils/mail'

// POST /api/auth/student/bind-email/verify — 学生绑定邮箱：校验验证码并完成绑定（需登录）
export default defineEventHandler(async (event) => {
  const student = await requireStudent(event)
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

  const db = await useSchoolDb(event, student.schoolId)

  // 二次校验邮箱未被占用（防止并发/竞态）
  const conflict = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .get()
  if (conflict && conflict.id !== student.id) {
    setResponseStatus(event, 409)
    return { success: false, message: '该邮箱已被其他账号绑定，请更换邮箱' }
  }

  await db
    .update(users)
    .set({ email, emailBoundAt: new Date().toISOString() })
    .where(eq(users.id, student.id))

  // 同步 session，避免中间件在下次导航时重复拦截
  await setStudentSession(event, { ...student, email })

  return { success: true, message: '邮箱绑定成功' }
})
