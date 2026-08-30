import { useSchoolDb } from '../../database/db'
import { grades } from '../../database/schema'
import { requireAdmin } from '../../utils/auth'
import { getSchoolIdFromRequest } from '../../utils/auth'
import { eq } from 'drizzle-orm'

// POST /api/grades — 创建年级（学校库）
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)
  const body = await readBody(event)
  const { name } = body

  // 【安全】年级属于校级组织结构，只有校级/超级管理员可新建。
  // 与 POST /api/classes 的权限模型保持一致（此前缺失校验，任何管理员都能建年级）。
  if (admin.role !== 'super_admin' && admin.role !== 'school_admin') {
    throw createError({ statusCode: 403, message: '权限不足，仅校级及以上管理员可创建年级' })
  }

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw createError({ statusCode: 400, message: '年级名称不能为空' })
  }

  const gradeName = name.trim()

  // 同校年级重名拦截
  const existing = await db
    .select({ id: grades.id })
    .from(grades)
    .where(eq(grades.name, gradeName))
    .get()

  if (existing) {
    throw createError({ statusCode: 409, message: '该年级已存在' })
  }

  const [newGrade] = await db
    .insert(grades)
    .values({ name: gradeName })
    .returning()
    .all()

  return { success: true, data: newGrade }
})
