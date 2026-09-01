// GET /api/api-tokens — 列出当前管理员可见的外部 API 凭证
//
// 这是内部管理接口，走 session 鉴权，**不接受 api_token** ——
// 否则外部凭证就能自己列出/管理其他凭证，权限模型立刻塌掉。
//
// 可见性规则见 api-token.ts 的 isTokenVisibleTo：每个管理员只看得到
// 自己管辖范围内的凭证，班级管理员看不到年级/校级凭证。

import { desc, eq } from 'drizzle-orm'
import { useMainDb, useSchoolDb } from '../../database/db'
import { apiTokens, admins } from '../../database/schema.main'
import { classes, grades } from '../../database/schema.school'
import { requireAdmin, getSchoolIdFromRequest } from '../../utils/auth'
import { isTokenVisibleTo, parseScopes, type ApiTokenRow } from '../../utils/api-token'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const schoolDb = await useSchoolDb(event, schoolId)

  const rows = (await useMainDb()
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.schoolId, schoolId))
    .orderBy(desc(apiTokens.id))) as unknown as ApiTokenRow[]

  // 范围名称需要查分库，先批量取回避免 N+1
  const gradeRows = await schoolDb.select({ id: grades.id, name: grades.name }).from(grades)
  const classRows = await schoolDb
    .select({ id: classes.id, name: classes.name, gradeId: classes.gradeId })
    .from(classes)
  const gradeMap = new Map(gradeRows.map((g: any) => [Number(g.id), g.name]))
  const classMap = new Map(classRows.map((c: any) => [Number(c.id), c]))

  // 签发人用户名（createdByAdminId 可能因管理员被删而为 null）
  const issuerIds = [...new Set(rows.map((r) => r.createdByAdminId).filter((v): v is number => v != null))]
  const issuerMap = new Map<number, string>()
  for (const iid of issuerIds) {
    const a = await useMainDb().select({ username: admins.username }).from(admins).where(eq(admins.id, iid)).get()
    if (a) issuerMap.set(iid, a.username)
  }

  const now = Date.now()
  const list: any[] = []

  for (const t of rows) {
    if (!(await isTokenVisibleTo(admin, t, schoolDb))) continue

    let scopeLabel = '全校'
    if (t.scopeType === 'grade') {
      scopeLabel = `${gradeMap.get(Number(t.scopeGradeId)) || `年级#${t.scopeGradeId}`}（全年级）`
    } else if (t.scopeType === 'class') {
      const c: any = classMap.get(Number(t.scopeClassId))
      scopeLabel = c
        ? `${gradeMap.get(Number(c.gradeId)) || ''}${c.name}`
        : `班级#${t.scopeClassId}`
    }

    list.push({
      id: t.id,
      name: t.name,
      tokenPrefix: t.tokenPrefix,
      scopeType: t.scopeType,
      scopeGradeId: t.scopeGradeId,
      scopeClassId: t.scopeClassId,
      scopeLabel,
      scopes: parseScopes(t),
      disabled: Number(t.disabled) === 1,
      expiresAt: t.expiresAt,
      // 过期是"事实"而非"状态"，由服务端算好，免得前端各处重复实现时区判断
      expired: !!t.expiresAt && new Date(t.expiresAt).getTime() < now,
      lastUsedAt: t.lastUsedAt,
      lastUsedIp: t.lastUsedIp,
      callCount: t.callCount,
      createdByRole: t.createdByRole,
      createdByAdmin: t.createdByAdminId == null ? null : issuerMap.get(t.createdByAdminId) || null,
      createdAt: t.createdAt,
    })
  }

  return { success: true, data: list, total: list.length }
})
