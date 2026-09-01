// GET /api/v1/students — 学生列表（分页）
//
// scope: students:read
// 参数：page / limit / sortBy / order / classId / gradeId / keyword / disabled
//
// 积分字段一律由 score_logs 实时聚合，而不是读 users.total_score 那几列。
// 原因：历史数据里 add_score / deduct_score / score_count 长期为 0（旧实现只累加
// total_score），聚合口径才是唯一可信来源，也与管理端页面显示保持一致。

import {
  apiOk,
  defineApiV1Handler,
  parsePageParams,
  parseSortParams,
  pageResult,
} from '../../../utils/api-response'
import { assertScope } from '../../../utils/api-token'
import { useApiContext, classScopeClause } from '../../../utils/api-context'

/** 排序白名单：key → SQL 表达式。绝不把请求里的字符串直接拼进 ORDER BY */
const SORT_MAP: Record<string, string> = {
  id: 'u.id',
  username: 'u.username',
  actualName: 'u.actual_name',
  totalScore: 'total_score',
  scoreCount: 'score_count',
  createdAt: 'u.created_at',
}

export default defineApiV1Handler(async (event) => {
  const ctx = await useApiContext(event)
  assertScope(ctx.token, 'students:read')

  const query = getQuery(event) as Record<string, any>
  const p = parsePageParams(query)
  const { sortBy, desc } = parseSortParams(query, Object.keys(SORT_MAP), 'totalScore')

  const where: string[] = []
  const args: any[] = []

  // 范围上限（先加，保证任何筛选都只能在其内部收窄）
  const sc = classScopeClause(ctx.scope, 'u.class_id')
  if (sc.empty) return apiOk(event, pageResult([], 0, p))
  if (sc.sql) {
    where.push(sc.sql)
    args.push(...sc.args)
  }

  if (query.classId !== undefined && query.classId !== '') {
    where.push('u.class_id = ?')
    args.push(Number(query.classId))
  }
  if (query.gradeId !== undefined && query.gradeId !== '') {
    where.push('c.grade_id = ?')
    args.push(Number(query.gradeId))
  }

  const keyword = String(query.keyword ?? '').trim()
  if (keyword) {
    where.push('(u.username LIKE ? OR u.actual_name LIKE ?)')
    const pattern = `%${keyword}%`
    args.push(pattern, pattern)
  }

  if (query.disabled !== undefined && query.disabled !== '') {
    const flag = String(query.disabled).toLowerCase()
    if (flag === 'true' || flag === '1') where.push('u.disabled = 1')
    else if (flag === 'false' || flag === '0') where.push('(u.disabled IS NULL OR u.disabled = 0)')
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const listRes = await ctx.client.execute({
    sql: `SELECT
        u.id,
        u.username,
        u.actual_name,
        u.class_id,
        u.disabled,
        u.created_at,
        c.name AS class_name,
        c.grade_id,
        g.name AS grade_name,
        COALESCE(SUM(sl.score_change), 0) AS total_score,
        COALESCE(SUM(CASE WHEN sl.score_change > 0 THEN sl.score_change ELSE 0 END), 0) AS add_score,
        COALESCE(SUM(CASE WHEN sl.score_change < 0 THEN -sl.score_change ELSE 0 END), 0) AS deduct_score,
        COUNT(sl.id) AS score_count
      FROM users u
      LEFT JOIN classes c ON u.class_id = c.id
      LEFT JOIN grades g ON c.grade_id = g.id
      LEFT JOIN score_logs sl ON u.id = sl.user_id
      ${whereSql}
      GROUP BY u.id
      ORDER BY ${SORT_MAP[sortBy]} ${desc ? 'DESC' : 'ASC'}, u.id ASC
      LIMIT ? OFFSET ?`,
    args: [...args, p.limit, p.offset],
  })

  const countRes = await ctx.client.execute({
    sql: `SELECT COUNT(*) AS cnt
      FROM users u
      LEFT JOIN classes c ON u.class_id = c.id
      ${whereSql}`,
    args,
  })

  const list = (listRes.rows as any[]).map((r) => ({
    id: Number(r.id),
    username: r.username,
    actualName: r.actual_name || '',
    classId: r.class_id == null ? null : Number(r.class_id),
    className: r.class_name || '',
    gradeId: r.grade_id == null ? null : Number(r.grade_id),
    gradeName: r.grade_name || '',
    disabled: Number(r.disabled ?? 0) === 1,
    totalScore: Number(r.total_score),
    addScore: Number(r.add_score),
    deductScore: Number(r.deduct_score),
    scoreCount: Number(r.score_count),
    createdAt: r.created_at,
  }))

  return apiOk(event, pageResult(list, Number((countRes.rows[0] as any)?.cnt || 0), p))
})
