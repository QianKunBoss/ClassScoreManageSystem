// GET /api/v1/scores — 积分流水查询（分页）
//
// scope: scores:read
// 参数：page / limit / sortBy / order / userId / username / classId / gradeId
//       / type=add|deduct / startDate / endDate
//
// startDate / endDate 支持 YYYY-MM-DD 或完整 ISO 串，按 UTC 解释（created_at 存的是 UTC）。

import {
  API_CODE,
  apiError,
  apiOk,
  defineApiV1Handler,
  parsePageParams,
  parseSortParams,
  pageResult,
} from '../../../utils/api-response'
import { assertScope } from '../../../utils/api-token'
import { useApiContext, classScopeClause, normalizeDateBound } from '../../../utils/api-context'

const SORT_MAP: Record<string, string> = {
  id: 'sl.id',
  createdAt: 'sl.created_at',
  scoreChange: 'sl.score_change',
}

export default defineApiV1Handler(async (event) => {
  const ctx = await useApiContext(event)
  assertScope(ctx.token, 'scores:read')

  const query = getQuery(event) as Record<string, any>
  const p = parsePageParams(query)
  const { sortBy, desc } = parseSortParams(query, Object.keys(SORT_MAP), 'createdAt')

  const where: string[] = []
  const args: any[] = []

  // 流水的归属通过 users.class_id 判定。注意这里用 JOIN 而非 LEFT JOIN：
  // 孤儿流水（学生已删除但记录残留）对非全校范围的调用方来说无法判定归属，不应返回。
  const sc = classScopeClause(ctx.scope, 'u.class_id')
  if (sc.empty) return apiOk(event, pageResult([], 0, p))
  if (sc.sql) {
    where.push(sc.sql)
    args.push(...sc.args)
  }

  if (query.userId !== undefined && query.userId !== '') {
    where.push('sl.user_id = ?')
    args.push(Number(query.userId))
  }
  if (query.username) {
    where.push('sl.username = ?')
    args.push(String(query.username))
  }
  if (query.classId !== undefined && query.classId !== '') {
    where.push('u.class_id = ?')
    args.push(Number(query.classId))
  }
  if (query.gradeId !== undefined && query.gradeId !== '') {
    where.push('c.grade_id = ?')
    args.push(Number(query.gradeId))
  }

  const type = String(query.type ?? '').trim()
  if (type === 'add') where.push('sl.score_change > 0')
  else if (type === 'deduct') where.push('sl.score_change < 0')
  else if (type) apiError(400, API_CODE.INVALID_PARAM, 'type 仅支持 add / deduct')

  if (query.startDate) {
    const from = normalizeDateBound(query.startDate, 'start')
    if (!from) apiError(400, API_CODE.INVALID_PARAM, 'startDate 格式应为 YYYY-MM-DD 或 ISO 8601')
    where.push('sl.created_at >= ?')
    args.push(from)
  }
  if (query.endDate) {
    const to = normalizeDateBound(query.endDate, 'end')
    if (!to) apiError(400, API_CODE.INVALID_PARAM, 'endDate 格式应为 YYYY-MM-DD 或 ISO 8601')
    where.push('sl.created_at <= ?')
    args.push(to)
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const fromSql = `FROM score_logs sl
      JOIN users u ON sl.user_id = u.id
      LEFT JOIN classes c ON u.class_id = c.id`

  const listRes = await ctx.client.execute({
    sql: `SELECT
        sl.id, sl.user_id, sl.username, sl.score_change, sl.description, sl.created_at,
        u.actual_name, u.class_id, c.name AS class_name, c.grade_id, g.name AS grade_name
      ${fromSql}
      LEFT JOIN grades g ON c.grade_id = g.id
      ${whereSql}
      ORDER BY ${SORT_MAP[sortBy]} ${desc ? 'DESC' : 'ASC'}, sl.id ${desc ? 'DESC' : 'ASC'}
      LIMIT ? OFFSET ?`,
    args: [...args, p.limit, p.offset],
  })

  const countRes = await ctx.client.execute({
    sql: `SELECT COUNT(*) AS cnt ${fromSql} ${whereSql}`,
    args,
  })

  const list = (listRes.rows as any[]).map((r) => ({
    id: Number(r.id),
    userId: Number(r.user_id),
    username: r.username,
    actualName: r.actual_name || '',
    classId: r.class_id == null ? null : Number(r.class_id),
    className: r.class_name || '',
    gradeId: r.grade_id == null ? null : Number(r.grade_id),
    gradeName: r.grade_name || '',
    scoreChange: Number(r.score_change),
    description: r.description || '',
    createdAt: r.created_at,
  }))

  return apiOk(event, pageResult(list, Number((countRes.rows[0] as any)?.cnt || 0), p))
})
