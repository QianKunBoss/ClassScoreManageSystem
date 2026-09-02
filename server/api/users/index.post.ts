import { users } from '../../database/schema'
import { useSchoolDb } from '../../database/db'
import { requireAdmin, hashPasswordBcrypt, getSchoolIdFromRequest, resolveSchoolScope } from '../../utils/auth'
import { eq } from 'drizzle-orm'
import { EMAIL_RE } from '../../utils/mail'

// POST /api/users — 创建学生账号（写入学校库）
// 支持单个创建：{ username, password, actualName, classId }
// 支持批量创建：{ batch: [{ username, actualName, classId }], defaultPassword }
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)

  // 【安全】解析当前管理员的真实可管理范围：
  // 前端传来的 classId 完全不可信，班级管理员只能在本班建号，
  // 年级管理员只能在本年级班级建号，否则可跨班/跨年级注入账号。
  const scope = await resolveSchoolScope(admin, db)

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

      const classId = Number(item.classId || admin.classId)
      if (!classId || !Number.isFinite(classId)) {
        results.failed++
        results.errors.push(`「${username}」缺少班级信息`)
        continue
      }

      // 越权拦截：目标班级必须在当前管理员的管理范围内
      if (!scope.isClassAllowed(classId)) {
        results.failed++
        results.errors.push(`「${username}」无权限在该班级创建账号`)
        continue
      }

      try {
        const passwordHash = hashPasswordBcrypt(defaultPassword)
        const [newUser] = await db.insert(users).values({
          username,
          passwordHash,
          actualName: item.actualName || null,
          classId,
          mustChangePassword: 1,
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
  const { username, password, actualName, classId: bodyClassId, email } = body

  if (!username) {
    throw createError({ statusCode: 400, message: '请输入用户名' })
  }
  if (!password) {
    throw createError({ statusCode: 400, message: '请输入密码' })
  }

  // classId：超级/校级管理员可从 body 传递，班级管理员回落到自身班级
  const classId = Number(bodyClassId || admin.classId)
  if (!classId || !Number.isFinite(classId)) {
    throw createError({ statusCode: 400, message: '缺少班级信息，无法创建用户' })
  }

  // 越权拦截：目标班级必须在当前管理员的管理范围内
  if (!scope.isClassAllowed(classId)) {
    throw createError({ statusCode: 403, message: '无权限在该班级创建账号' })
  }
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .get()

  if (existing) {
    throw createError({ statusCode: 409, message: '用户名已存在' })
  }

  // 可选绑定邮箱（修改登录凭证）
  let bindEmail: string | null = null
  if (email) {
    const em = String(email).trim()
    if (!EMAIL_RE.test(em)) {
      throw createError({ statusCode: 400, message: '邮箱格式不正确' })
    }
    const dup = await db.select({ id: users.id }).from(users).where(eq(users.email, em)).get()
    if (dup) {
      throw createError({ statusCode: 409, message: '该邮箱已被其他账号绑定' })
    }
    bindEmail = em
  }

  const passwordHash = hashPasswordBcrypt(password)

  const [newUser] = await db.insert(users).values({
    username,
    passwordHash,
    actualName: actualName || null,
    classId,
    email: bindEmail,
    emailBoundAt: bindEmail ? new Date().toISOString() : null,
    mustChangePassword: 1,
  }).returning().all()

  return {
    success: true,
    message: '用户创建成功',
    data: newUser,
  }
})
