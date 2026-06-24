import { eq, and, isNull } from 'drizzle-orm'
import { admins } from '../../database/schema'
import { useMainDb } from '../../database/db'
import { verifyPasswordBcrypt } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { username, password, schoolId } = body

  if (!username || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: '请输入账号和密码',
    })
  }

  const db = useMainDb()

  // 根据是否提供 schoolId 决定查询方式
  // - 提供 schoolId：查该学校下的管理员 (username + schoolId)
  // - 未提供 schoolId：查超级管理员 (username + schoolId IS NULL)
  let admin

  if (schoolId != null && schoolId !== '' && schoolId !== 'null') {
    const sid = Number(schoolId)
    admin = await db
      .select()
      .from(admins)
      .where(and(
        eq(admins.username, username),
        eq(admins.schoolId, sid),
      ))
      .get()
  } else {
    // 超级管理员登录（schoolId 为 NULL）
    admin = await db
      .select()
      .from(admins)
      .where(and(
        eq(admins.username, username),
        isNull(admins.schoolId),
      ))
      .get()
  }

  if (!admin || !verifyPasswordBcrypt(password, admin.passwordHash)) {
    throw createError({
      statusCode: 401,
      statusMessage: '账号或密码错误',
    })
  }

  // 检查账号是否被封禁
  if (admin.disabled === 1) {
    throw createError({
      statusCode: 403,
      statusMessage: '账号已被封禁，请联系超级管理员',
    })
  }

  // 更新最后登录时间
  await db.update(admins)
    .set({ lastLogin: new Date().toISOString() })
    .where(eq(admins.id, admin.id))

  // 设置 session（把 schoolId 存进去）
  const session = await getUserSession(event)
  await setUserSession(event, {
    ...session,
    data: {
      adminId: admin.id,
      username: admin.username,
      role: admin.role,
      schoolId: admin.schoolId,
      gradeId: admin.gradeId,
      classId: admin.classId,
    },
  })

  return {
    success: true,
    admin: {
      id: admin.id,
      username: admin.username,
      role: admin.role,
      schoolId: admin.schoolId,
      gradeId: admin.gradeId,
      classId: admin.classId,
      mustChangePassword: !!admin.mustChangePassword,
    },
  }
})
