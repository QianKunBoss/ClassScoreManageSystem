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

  const db = await useSchoolDb(event, Number(schoolId))

  const user = await db
    .select({
      id: users.id,
      username: users.username,
      actualName: users.actualName,
      classId: users.classId,
      totalScore: users.totalScore,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.username, username))
    .get()

  if (!user) {
    setResponseStatus(event, 401)
    return { success: false, message: '用户名或密码错误' }
  }

  if (!verifyPasswordBcrypt(password, user.passwordHash)) {
    setResponseStatus(event, 401)
    return { success: false, message: '用户名或密码错误' }
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
    },
  }
})
