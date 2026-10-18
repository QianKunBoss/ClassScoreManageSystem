import { eq, and } from 'drizzle-orm'
import { requireSuperAdmin } from '../../../utils/auth'
import {
  pickOrgAdmin,
  writeImpersonationLog,
  sessionDataOf,
  type OrgScope,
} from '../../../utils/impersonation'
import { useMainDb, useSchoolDb } from '../../../database/db'
import { schools } from '../../../database/schema.main'
import { grades, classes } from '../../../database/schema.school'

/**
 * POST /api/admin/impersonation/enter
 * 超级管理员免密「进入组织」。
 * body: { schoolId: number, scope?: 'school'|'grade'|'class', gradeId?: number, classId?: number }
 *
 * 选人：目标层级优先（并优先已完成安全初始化的账号），该级无管理员时逐级向上回退。
 */
export default defineEventHandler(async (event) => {
  const actor = await requireSuperAdmin(event)

  const body = await readBody(event).catch(() => ({} as any))
  const schoolId = Number(body?.schoolId)
  const scope: OrgScope = ['school', 'grade', 'class'].includes(body?.scope) ? body.scope : 'school'
  const gradeId = body?.gradeId != null ? Number(body.gradeId) : undefined
  const classId = body?.classId != null ? Number(body.classId) : undefined

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

  // 校验目标年级/班级确实属于该校（防止伪造 gradeId/classId 指向其他学校的数据）
  let nodeName = school.name
  let gid = 0
  let cid = 0

  if (scope === 'grade' || scope === 'class') {
    gid = Number(gradeId ?? 0)
    if (!Number.isInteger(gid) || gid <= 0) {
      throw createError({ statusCode: 400, message: '缺少 gradeId' })
    }
    const schoolDb = await useSchoolDb(event, schoolId)
    const grade = await schoolDb.select().from(grades).where(eq(grades.id, gid)).get()
    if (!grade) {
      throw createError({ statusCode: 404, message: '年级不存在或不属于该学校' })
    }
    nodeName = grade.name

    if (scope === 'class') {
      cid = Number(classId ?? 0)
      if (!Number.isInteger(cid) || cid <= 0) {
        throw createError({ statusCode: 400, message: '缺少 classId' })
      }
      const cls = await schoolDb
        .select()
        .from(classes)
        .where(and(eq(classes.id, cid), eq(classes.gradeId, gid)))
        .get()
      if (!cls) {
        throw createError({ statusCode: 404, message: '班级不存在或不属于该年级' })
      }
      nodeName = cls.name
    }
  }

  const picked = await pickOrgAdmin(schoolId, scope, gid || undefined, cid || undefined)
  if (!picked.admin) {
    const label = scope === 'class' ? '班级' : scope === 'grade' ? '年级' : '学校'
    throw createError({
      statusCode: 404,
      message: `该${label}及其上级均无可用的管理员，请先在「管理员账号」中创建`,
    })
  }

  // 审计先落库；写不进去则不放行（fail-closed）
  await writeImpersonationLog(event, {
    action: 'enter',
    actorId: actor.id,
    actorName: actor.username,
    targetId: picked.admin.id,
    targetName: picked.admin.username,
    schoolId: school.id,
    schoolName: school.name,
    nodeKind: scope,
    nodeName,
    bypassedSecurity: picked.bypassedSecurity,
  })

  // 不更新 target.lastLogin：冒充不是一次真实登录
  await replaceUserSession(event, {
    data: sessionDataOf(picked.admin, { adminId: actor.id, username: actor.username }),
  })

  return {
    success: true,
    admin: {
      id: picked.admin.id,
      username: picked.admin.username,
      role: picked.admin.role,
      schoolId: picked.admin.schoolId,
      schoolName: school.name,
    },
    requestedScope: scope,
    matchedScope: picked.matchedScope,
    fallback: picked.fallback,
    nodeName,
    bypassedSecurity: picked.bypassedSecurity,
    candidates: picked.candidates,
  }
})
