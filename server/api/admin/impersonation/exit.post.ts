import { eq } from 'drizzle-orm'
import { admins, schools } from '../../../database/schema.main'
import { useMainDb } from '../../../database/db'
import { getImpersonator, writeImpersonationLog, sessionDataOf } from '../../../utils/impersonation'

/**
 * POST /api/admin/impersonation/exit
 * 退出「进入组织」：用会话里保存的 impersonator 恢复原超管身份。
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const imp = getImpersonator(session)
  if (!imp) {
    throw createError({ statusCode: 400, message: '当前不处于「进入组织」状态' })
  }

  const db = useMainDb()
  const actor = await db.select().from(admins).where(eq(admins.id, imp.adminId)).get()
  if (!actor || actor.role !== 'super_admin' || actor.disabled === 1) {
    throw createError({ statusCode: 401, message: '原超级管理员账号已不可用，请重新登录' })
  }

  const currentId = Number((session.data as any)?.adminId)
  const current = Number.isFinite(currentId)
    ? await db.select().from(admins).where(eq(admins.id, currentId)).get()
    : null

  let schoolName: string | null = null
  if (current?.schoolId) {
    const school = await db.select().from(schools).where(eq(schools.id, current.schoolId)).get()
    schoolName = school?.name ?? null
  }

  await writeImpersonationLog(event, {
    action: 'exit',
    actorId: actor.id,
    actorName: actor.username,
    targetId: current?.id ?? null,
    targetName: current?.username ?? null,
    schoolId: current?.schoolId ?? null,
    schoolName,
  })

  await replaceUserSession(event, { data: sessionDataOf(actor) })

  return {
    success: true,
    admin: { id: actor.id, username: actor.username, role: actor.role },
  }
})
