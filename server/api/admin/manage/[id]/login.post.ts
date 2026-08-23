import { eq } from 'drizzle-orm'
import { admins } from '../../../../database/schema'
import { useMainDb } from '../../../../database/db'
import { requireSuperAdmin } from '../../../../utils/auth'

// 超级管理员免密登录任意管理员账号
export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: '无效的管理员 ID' })
  }

  const db = useMainDb()
  const admin = await db.select().from(admins).where(eq(admins.id, id)).get()

  if (!admin) {
    throw createError({ statusCode: 404, statusMessage: '管理员不存在' })
  }
  if (admin.disabled === 1) {
    throw createError({ statusCode: 403, statusMessage: '该账号已被封禁' })
  }

  await db.update(admins)
    .set({ lastLogin: new Date().toISOString() })
    .where(eq(admins.id, admin.id))

  await replaceUserSession(event, {
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
