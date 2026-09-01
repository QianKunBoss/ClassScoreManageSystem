// GET /api/api-tokens/logs — 外部 API 调用审计日志
//
// 参数：tokenId? / statusCode? / method? / onlyFailed? / page / limit
//
// 【为什么日志在主库】鉴权失败时根本拿不到 schoolId（token 无效，不知道属于谁），
// 这类记录必须有地方落；而超级管理员也需要跨校聚合查看。放主库两个问题一并解决。
// 代价是查询时要按 school_id 过滤，因此本接口强制注入当前学校条件。

import { and, desc, eq, sql } from 'drizzle-orm'
import { useMainDb, useSchoolDb } from '../../database/db'
import { apiAuditLogs, apiTokens } from '../../database/schema.main'
import { requireAdmin, getSchoolIdFromRequest } from '../../utils/auth'
import { isTokenVisibleTo, type ApiTokenRow } from '../../utils/api-token'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const schoolDb = await useSchoolDb(event, schoolId)

  const query = getQuery(event) as Record<string, any>
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20))
  const offset = (page - 1) * limit

  const conds: any[] = [eq(apiAuditLogs.schoolId, schoolId)]

  // 指定 tokenId 时，必须先确认该凭证对当前管理员可见 ——
  // 否则班级管理员可以通过枚举 tokenId 窥探全校凭证的调用情况。
  if (query.tokenId !== undefined && query.tokenId !== '') {
    const tid = Number(query.tokenId)
    if (!Number.isInteger(tid) || tid <= 0) {
      throw createError({ statusCode: 400, message: 'tokenId 不合法' })
    }
    const t = (await useMainDb()
      .select()
      .from(apiTokens)
      .where(eq(apiTokens.id, tid))
      .get()) as ApiTokenRow | undefined
    if (!t || Number(t.schoolId) !== schoolId) {
      throw createError({ statusCode: 404, message: '凭证不存在' })
    }
    if (!(await isTokenVisibleTo(admin, t, schoolDb))) {
      throw createError({ statusCode: 403, message: '无权限查看该凭证的日志' })
    }
    conds.push(eq(apiAuditLogs.tokenId, tid))
  } else if (admin.role === 'grade_admin' || admin.role === 'class_admin') {
    // 未指定 tokenId 时，非校级管理员只能看到自己可见凭证的日志。
    // 先把可见 token id 列出来，再用 IN 过滤（数量是个位数，不必担心 IN 过长）。
    const all = (await useMainDb()
      .select()
      .from(apiTokens)
      .where(eq(apiTokens.schoolId, schoolId))) as unknown as ApiTokenRow[]

    const visible: number[] = []
    for (const t of all) {
      if (await isTokenVisibleTo(admin, t, schoolDb)) visible.push(Number(t.id))
    }
    if (visible.length === 0) {
      return { success: true, data: [], total: 0, page, limit, totalPages: 0 }
    }
    conds.push(sql`${apiAuditLogs.tokenId} IN (${sql.join(visible.map((v) => sql`${v}`), sql`, `)})`)
  }

  if (query.method) {
    conds.push(eq(apiAuditLogs.method, String(query.method).toUpperCase()))
  }
  if (query.statusCode !== undefined && query.statusCode !== '') {
    conds.push(eq(apiAuditLogs.statusCode, Number(query.statusCode)))
  }
  if (String(query.onlyFailed ?? '') === 'true') {
    conds.push(sql`${apiAuditLogs.statusCode} >= 400`)
  }

  const whereExpr = conds.length === 1 ? conds[0] : and(...conds)

  const rows = await useMainDb()
    .select()
    .from(apiAuditLogs)
    .where(whereExpr)
    .orderBy(desc(apiAuditLogs.id))
    .limit(limit)
    .offset(offset)

  const countRow = await useMainDb()
    .select({ cnt: sql<number>`count(*)` })
    .from(apiAuditLogs)
    .where(whereExpr)
    .get()

  const total = Number(countRow?.cnt || 0)

  return {
    success: true,
    data: rows.map((r: any) => ({
      id: Number(r.id),
      tokenId: r.tokenId == null ? null : Number(r.tokenId),
      tokenPrefix: r.tokenPrefix || '',
      method: r.method,
      path: r.path,
      statusCode: Number(r.statusCode),
      latencyMs: Number(r.latencyMs || 0),
      ip: r.ip || '',
      userAgent: r.userAgent || '',
      requestId: r.requestId || '',
      errorMessage: r.errorMessage || '',
      createdAt: r.createdAt,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
})
