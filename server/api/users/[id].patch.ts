import { eq } from 'drizzle-orm'
import { users } from '../../database/schema'
import { useSchoolDb } from '../../database/db'
import { requireAdmin, getSchoolIdFromRequest } from '../../utils/auth'
import { EMAIL_RE } from '../../utils/mail'

// PATCH /api/users/[id] — 更新学生（用户名 / 邮箱 / 启用禁用）
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)

  const id = Number(getRouterParam(event, 'id'))
  if (!id) {
    throw createError({ statusCode: 400, message: '缺少用户 ID' })
  }

  const body = await readBody(event) as {
    username?: string
    email?: string
    disabled?: number
  }

  if (body.username === undefined && body.email === undefined && body.disabled === undefined) {
    throw createError({ statusCode: 400, message: '请指定要修改的字段' })
  }

  // 检查用户是否存在
  const existing = await db.select().from(users).where(eq(users.id, id)).get()
  if (!existing) {
    throw createError({ statusCode: 404, message: '用户不存在' })
  }

  const setData: Record<string, any> = {}

  // ===== 用户名 =====
  if (body.username !== undefined) {
    const username = (body.username || '').trim()
    if (!username) {
      throw createError({ statusCode: 400, message: '用户名不能为空' })
    }
    if (username !== existing.username) {
      const duplicate = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, username))
        .get()
      if (duplicate && duplicate.id !== id) {
        throw createError({ statusCode: 409, message: '用户名已存在' })
      }
    }
    setData.username = username
  }

  // ===== 邮箱（修改登录凭证；可空表示解绑）=====
  if (body.email !== undefined) {
    const email = (body.email || '').trim()
    if (email) {
      if (!EMAIL_RE.test(email)) {
        throw createError({ statusCode: 400, message: '邮箱格式不正确' })
      }
      if (email !== existing.email) {
        const dup = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, email))
          .get()
        if (dup && dup.id !== id) {
          throw createError({ statusCode: 409, message: '该邮箱已被其他账号绑定' })
        }
      }
      setData.email = email
      setData.emailBoundAt = email ? new Date().toISOString() : null
    } else {
      // 清空邮箱（解绑）
      setData.email = null
      setData.emailBoundAt = null
    }
  }

  // ===== 启用 / 禁用 =====
  if (body.disabled !== undefined) {
    setData.disabled = body.disabled ? 1 : 0
  }

  if (Object.keys(setData).length === 0) {
    return { success: true, message: '无变更', data: existing }
  }

  await db.update(users).set(setData).where(eq(users.id, id))

  const updated = await db.select().from(users).where(eq(users.id, id)).get()

  return { success: true, message: '更新成功', data: updated }
})
