import { eq } from 'drizzle-orm'
import { requireSuperAdmin } from '../../../utils/auth'
import { pickSchoolAdmin, writeImpersonationLog, sessionDataOf } from '../../../utils/impersonation'
import { useMainDb } from '../../../database/db'
import { schools } from '../../../database/schema.main'

/**
 * POST /api/admin/impersonation/enter
 * 超级管理员免密「进入组织」：按策略 B 选一名该校学校管理员并替换会话。
 * body: { schoolId: number }
 */
export default defineEventHandler(async (event) => {
  const actor = await requireSuperAdmin(event)

  const body = await readBody(event).catch(() => ({} as any))
  const schoolId = Number(body?.schoolId)
  if (!Number.isInteger(schoolId) || schoolId <= 0) {
    throw createError({ statusCode: 400, message: 'schoolId 不合法' })
  }

  const db = useMainDb()
  const school = await db.select().from(schools).where(eq(schools.id, schoolId)).get()
  if (!school) {
    throw createError({ statusCode: 404, message: '学校不存在' })
  }
  if (school.disabled === 1) {
    throw createError({ statusCode: 403, message: '该校已被封禁，无法进入组织' })
  }

  const { admin: target, bypassedSecurity, candidates } = await pickSchoolAdmin(schoolId)
  if (!target) {
    throw createError({
      statusCode: 404,
      message: '该学校暂无可用的学校管理员，请先在「管理员账号」中创建',
    })
  }

  // 审计先落库；写不进去则不放行（fail-closed）
  await writeImpersonationLog(event, {
    action: 'enter',
    actorId: actor.id,
    actorName: actor.username,
    targetId: target.id,
    targetName: target.username,
    schoolId: school.id,
    schoolName: school.name,
    bypassedSecurity,
  })

  // 不更新 target.lastLogin：冒充不是一次真实登录
  await replaceUserSession(event, {
    data: sessionDataOf(target, { adminId: actor.id, username: actor.username }),
  })

  return {
    success: true,
    admin: {
      id: target.id,
      username: target.username,
      role: target.role,
      schoolId: target.schoolId,
      schoolName: school.name,
    },
    bypassedSecurity,
    candidates,
  }
})
