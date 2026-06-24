import { users } from '../../database/schema'
import { useSchoolDb } from '../../database/db'
import { requireAdmin, hashPasswordBcrypt, getSchoolIdFromRequest } from '../../utils/auth'
import { eq } from 'drizzle-orm'

// POST /api/users — 创建学生账号（写入学校库）
// 支持单个创建：{ username, password, actualName, classId }
// 支持批量创建：{ batch: [{ username, actualName, classId }], defaultPassword }
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)

  const body = await readBody(event)

  // 批量创建
  if (body.batch && Array.isArray(body.batch)) {
    const defaultPassword = body.defaultPassword || '123456'
    const results = { success: 0, failed: 0, errors: [] as string[] }
    const created: any[] = []

    for (const item of body.batch) {
      const username = (item.username || '').trim()
      if (!username) {
        results.failed++
        results.errors.push(`空用户名已跳过`)
        continue
      }

      // 检查是否已存在
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, username))
        .get()

      if (existing) {
        results.failed++
        results.errors.push(`「${username}」已存在`)
        continue
      }

      const classId = item.classId || admin.classId
      if (!classId) {
        results.failed++
        results.errors.push(`「${username}」缺少班级信息`)
        continue
      }

      try {
        const passwordHash = hashPasswordBcrypt(defaultPassword)
        const [newUser] = await db.insert(users).values({
          username,
          passwordHash,
          actualName: item.actualName || null,
          classId,
        }).returning().all()
        created.push(newUser)
        results.success++
      } catch (e: any) {
        results.failed++
        results.errors.push(`「${username}」创建失败: ${e.message}`)
      }
    }

    return {
      success: true,
      message: `成功创建 ${results.success} 个用户${results.failed > 0 ? `，${results.failed} 个失败` : ''}`,
      results,
      data: created,
    }
  }

  // 单个创建
  const { username, password, actualName, classId: bodyClassId } = body

  if (!username) {
    throw createError({ statusCode: 400, statusMessage: '请输入用户名' })
  }
  if (!password) {
    throw createError({ statusCode: 400, statusMessage: '请输入密码' })
  }

  // classId：超级管理员可从 body 传递，普通管理员从 session 中取
  const classId = bodyClassId || admin.classId
  if (!classId) {
    throw createError({ statusCode: 400, statusMessage: '缺少班级信息，无法创建用户' })
  }
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .get()

  if (existing) {
    throw createError({ statusCode: 409, statusMessage: '用户名已存在' })
  }

  const passwordHash = hashPasswordBcrypt(password)

  const [newUser] = await db.insert(users).values({
    username,
    passwordHash,
    actualName: actualName || null,
    classId,
  }).returning().all()

  return {
    success: true,
    message: '用户创建成功',
    data: newUser,
  }
})
