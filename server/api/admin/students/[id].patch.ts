import { eq } from 'drizzle-orm'
import fs from 'fs'
import path from 'path'
import { users } from '../../../database/schema.school'
import { useSchoolDb } from '../../../database/db'
import { requireSuperAdmin } from '../../../utils/auth'
import { EMAIL_RE } from '../../../utils/mail'

// PATCH /api/admin/students/[id]?schoolId= — 超级管理员跨校更新学生（邮箱 / 启用禁用）
export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const query = getQuery(event) as { schoolId?: string }
  const schoolId = query.schoolId ? Number(query.schoolId) : ''
  if (!schoolId) {
    throw createError({ statusCode: 400, message: '缺少 schoolId 参数' })
  }

  const dbPath = path.join(process.cwd(), 'data', 'schools', `${schoolId}.db`)
  if (!fs.existsSync(dbPath)) {
    throw createError({ statusCode: 404, message: '学校库不存在' })
  }

  const db = await useSchoolDb(event, schoolId)
  const id = Number(getRouterParam(event, 'id'))
  if (!id) {
    throw createError({ statusCode: 400, message: '缺少用户 ID' })
  }

  const body = await readBody(event) as {
    email?: string
    disabled?: number
  }

  if (body.email === undefined && body.disabled === undefined) {
    throw createError({ statusCode: 400, message: '请指定要修改的字段' })
  }

  const existing = await db.select().from(users).where(eq(users.id, id)).get()
  if (!existing) {
    throw createError({ statusCode: 404, message: '用户不存在' })
  }

  const setData: Record<string, any> = {}

  // 邮箱（修改登录凭证；可空表示解绑）。需全校唯一（排除自身）
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
      setData.email = null
      setData.emailBoundAt = null
    }
  }

  // 启用 / 禁用
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
