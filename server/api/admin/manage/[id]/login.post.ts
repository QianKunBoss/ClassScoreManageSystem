import { eq } from 'drizzle-orm'
import { admins, schools } from '../../../../database/schema.main'
import { useMainDb } from '../../../../database/db'
import { requireSuperAdmin } from '../../../../utils/auth'
import { writeImpersonationLog, sessionDataOf } from '../../../../utils/impersonation'

// 超级管理员免密登录任意管理员账号（与「进入组织」共用审计与退出机制）
export default defineEventHandler(async (event) => {
  const actor = await requireSuperAdmin(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!id) {
    throw createError({ statusCode: 400, message: '无效的管理员 ID' })
  }

  const db = useMainDb()
  const admin = await db.select().from(admins).where(eq(admins.id, id)).get()

  if (!admin) {
    throw createError({ statusCode: 404, message: '管理员不存在' })
  }
  if (admin.disabled === 1) {
    throw createError({ statusCode: 403, message: '该账号已被封禁' })
  }

  let schoolName: string | null = null
  if (admin.schoolId) {
    const school = await db.select().from(schools).where(eq(schools.id, admin.schoolId)).get()
    schoolName = school?.name ?? null
  }

  // 审计先落库；写不进去则不放行（fail-closed）
  await writeImpersonationLog(event, {
    action: 'enter',
    actorId: actor.id,
    actorName: actor.username,
    targetId: admin.id,
    targetName: admin.username,
    schoolId: admin.schoolId,
    schoolName,
    bypassedSecurity: !!admin.mustChangePassword || !admin.email,
  })

  // 不更新 target.lastLogin：冒充不是一次真实登录
  await replaceUserSession(event, {
    data: sessionDataOf(admin, { adminId: actor.id, username: actor.username }),
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
