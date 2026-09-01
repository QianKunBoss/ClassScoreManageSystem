// GET /api/v1/classes — 班级列表
//
// scope: structure:read
// 参数：gradeId?（可选筛选）、page / limit

import {
  apiOk,
  defineApiV1Handler,
  parsePageParams,
  pageResult,
} from '../../../utils/api-response'
import { assertScope } from '../../../utils/api-token'
import { useApiContext, classScopeClause } from '../../../utils/api-context'

export default defineApiV1Handler(async (event) => {
  const ctx = await useApiContext(event)
  assertScope(ctx.token, 'structure:read')

  const query = getQuery(event) as Record<string, any>
  const p = parsePageParams(query)

  const where: string[] = []
  const args: any[] = []

  const sc = classScopeClause(ctx.scope, 'c.id')
  if (sc.empty) return apiOk(event, pageResult([], 0, p))
  if (sc.sql) {
    where.push(sc.sql)
    args.push(...sc.args)
  }

  if (query.gradeId !== undefined && query.gradeId !== '') {
    where.push('c.grade_id = ?')
    args.push(Number(query.gradeId))
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const listRes = await ctx.client.execute({
    sql: `SELECT
        c.id, c.name, c.grade_id, c.created_at,
        g.name AS grade_name,
        (SELECT COUNT(*) FROM users u WHERE u.class_id = c.id) AS student_count,
        (SELECT COALESCE(SUM(sl.score_change), 0) FROM score_logs sl
           JOIN users u2 ON sl.user_id = u2.id WHERE u2.class_id = c.id) AS total_score
      FROM classes c
      LEFT JOIN grades g ON c.grade_id = g.id
      ${whereSql}
      ORDER BY c.grade_id ASC, c.id ASC
      LIMIT ? OFFSET ?`,
    args: [...args, p.limit, p.offset],
  })

  const countRes = await ctx.client.execute({
    sql: `SELECT COUNT(*) AS cnt FROM classes c ${whereSql}`,
    args,
  })

  const list = (listRes.rows as any[]).map((r) => ({
    id: Number(r.id),
    name: r.name,
    gradeId: r.grade_id == null ? null : Number(r.grade_id),
    gradeName: r.grade_name || '',
    studentCount: Number(r.student_count),
    totalScore: Number(r.total_score),
    createdAt: r.created_at,
  }))

  return apiOk(event, pageResult(list, Number((countRes.rows[0] as any)?.cnt || 0), p))
})
