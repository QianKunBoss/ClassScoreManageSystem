import { verifyPasswordBcrypt } from '../../../utils/auth'
import { useSchoolDb } from '../../../database/db'
import { users } from '../../../database/schema'
import { eq } from 'drizzle-orm'

// POST /api/auth/student/login — 学生登录（写入学校库）
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { schoolId, username, password } = body

  if (!schoolId || !username || !password) {
    setResponseStatus(event, 400)
    return { success: false, message: '请填写学校、用户名和密码' }
  }

  // 支持使用已绑定邮箱登录：含 @ 视为邮箱，否则视为用户名
  const identifier = String(username).trim()
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)

  const db = await useSchoolDb(event, Number(schoolId))

  const user = await db
    .select({
      id: users.id,
      username: users.username,
      actualName: users.actualName,
      classId: users.classId,
      totalScore: users.totalScore,
      email: users.email,
      disabled: users.disabled,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(isEmail ? eq(users.email, identifier) : eq(users.username, identifier))
    .get()

  if (!user) {
    setResponseStatus(event, 401)
    return { success: false, message: '用户名或密码错误' }
  }

  if (!verifyPasswordBcrypt(password, user.passwordHash)) {
    setResponseStatus(event, 401)
    return { success: false, message: '用户名或密码错误' }
  }

  // 账号被禁用无法登录
  if (user.disabled === 1) {
    setResponseStatus(event, 403)
    return { success: false, message: '账号已被禁用，请联系管理员' }
  }

  // 写入 session（与管理员登录保持一致的格式）
  const session = await getUserSession(event)
  await setUserSession(event, {
    ...session,
    data: {
      studentId: user.id,
      studentUsername: user.username,
      studentActualName: user.actualName,
      schoolId: Number(schoolId),
      classId: user.classId,
      role: 'student',
    },
  })

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      actualName: user.actualName,
      classId: user.classId,
      totalScore: user.totalScore,
      email: user.email,
    },
  }
})
