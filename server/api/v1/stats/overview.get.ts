// GET /api/v1/stats/overview — 范围内统计概览
//
// scope: stats:read
// 参数：startDate? / endDate?（仅影响积分聚合与排行，不影响人数结构统计）
//
// 所有数字都严格限定在 token 范围内：班级级凭证看到的"总人数"是本班人数，
// 而不是全校人数 —— 否则统计接口就成了绕过范围限制的侧信道。

import {
  API_CODE,
  apiError,
  apiOk,
  defineApiV1Handler,
} from '../../../utils/api-response'
import { assertScope } from '../../../utils/api-token'
import {
  useApiContext,
  classScopeClause,
  allowedGradeIds,
  normalizeDateBound,
} from '../../../utils/api-context'

export default defineApiV1Handler(async (event) => {
  const ctx = await useApiContext(event)
  assertScope(ctx.token, 'stats:read')

  const query = getQuery(event) as Record<string, any>

  const userScope = classScopeClause(ctx.scope, 'u.class_id')
  const empty = userScope.empty

  // 时间区间（仅作用于积分维度）
  const dateWhere: string[] = []
  const dateArgs: any[] = []
  let fromBound: string | null = null
  let toBound: string | null = null
  if (query.startDate) {
    fromBound = normalizeDateBound(query.startDate, 'start')
    if (!fromBound) apiError(400, API_CODE.INVALID_PARAM, 'startDate 格式应为 YYYY-MM-DD 或 ISO 8601')
    dateWhere.push('sl.created_at >= ?')
    dateArgs.push(fromBound)
  }
  if (query.endDate) {
    toBound = normalizeDateBound(query.endDate, 'end')
    if (!toBound) apiError(400, API_CODE.INVALID_PARAM, 'endDate 格式应为 YYYY-MM-DD 或 ISO 8601')
    dateWhere.push('sl.created_at <= ?')
    dateArgs.push(toBound)
  }

  if (empty) {
    // 范围为空集（例如年级下暂无班级）：返回结构完整的零值，避免调用方做空值分支
    return apiOk(event, {
      scope: describeScope(ctx),
      range: { startDate: fromBound, endDate: toBound },
      structure: { gradeCount: 0, classCount: 0, studentCount: 0, disabledStudentCount: 0 },
      scores: { totalScore: 0, addScore: 0, deductScore: 0, recordCount: 0, todayRecordCount: 0 },
      topStudents: [],
    })
  }

  const scopeSql = userScope.sql ? `WHERE ${userScope.sql}` : ''
  const scopeArgs = userScope.args

  // ===== 结构统计 =====
  const structRes = await ctx.client.execute({
    sql: `SELECT
        COUNT(*) AS student_count,
        COALESCE(SUM(CASE WHEN u.disabled = 1 THEN 1 ELSE 0 END), 0) AS disabled_count
      FROM users u ${scopeSql}`,
    args: scopeArgs,
  })

  const classScope = classScopeClause(ctx.scope, 'c.id')
  const classCountRes = await ctx.client.execute({
    sql: `SELECT COUNT(*) AS cnt FROM classes c ${classScope.sql ? `WHERE ${classScope.sql}` : ''}`,
    args: classScope.args,
  })

  // 年级数不能用 classes 的 DISTINCT grade_id 推算：全校范围下会漏掉尚无班级的年级。
  // 受限范围下才退化为"班级归属的年级数"，此时空年级本就不在可见范围内。
  const gradeIds = await allowedGradeIds(ctx)
  let gradeCount: number
  if (gradeIds === null) {
    const gradeRes = await ctx.client.execute('SELECT COUNT(*) AS cnt FROM grades')
    gradeCount = Number((gradeRes.rows[0] as any)?.cnt || 0)
  } else {
    gradeCount = gradeIds.length
  }

  // ===== 积分聚合 =====
  const scoreWhere = [userScope.sql, ...dateWhere].filter(Boolean) as string[]
  const scoreRes = await ctx.client.execute({
    sql: `SELECT
        COALESCE(SUM(sl.score_change), 0) AS total_score,
        COALESCE(SUM(CASE WHEN sl.score_change > 0 THEN sl.score_change ELSE 0 END), 0) AS add_score,
        COALESCE(SUM(CASE WHEN sl.score_change < 0 THEN -sl.score_change ELSE 0 END), 0) AS deduct_score,
        COUNT(sl.id) AS record_count
      FROM score_logs sl
      JOIN users u ON sl.user_id = u.id
      ${scoreWhere.length ? `WHERE ${scoreWhere.join(' AND ')}` : ''}`,
    args: [...scopeArgs, ...dateArgs],
  })

  // 今日记录数不受 startDate/endDate 影响，它回答的是"系统现在还活着吗"
  const todayStart = new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z'
  const todayRes = await ctx.client.execute({
    sql: `SELECT COUNT(*) AS cnt
      FROM score_logs sl
      JOIN users u ON sl.user_id = u.id
      ${userScope.sql ? `WHERE ${userScope.sql} AND` : 'WHERE'} sl.created_at >= ?`,
    args: [...scopeArgs, todayStart],
  })

  // ===== 排行榜 TOP 10 =====
  const topRes = await ctx.client.execute({
    sql: `SELECT u.id, u.username, u.actual_name, u.class_id, c.name AS class_name,
        COALESCE(SUM(sl.score_change), 0) AS total_score,
        COUNT(sl.id) AS score_count
      FROM users u
      LEFT JOIN classes c ON u.class_id = c.id
      LEFT JOIN score_logs sl ON u.id = sl.user_id${dateWhere.length ? ` AND ${dateWhere.join(' AND ')}` : ''}
      ${scopeSql}
      GROUP BY u.id
      ORDER BY total_score DESC, u.username ASC
      LIMIT 10`,
    args: [...dateArgs, ...scopeArgs],
  })

  const struct = structRes.rows[0] as any
  const clsRow = classCountRes.rows[0] as any
  const score = scoreRes.rows[0] as any

  return apiOk(event, {
    scope: describeScope(ctx),
    range: { startDate: fromBound, endDate: toBound },
    structure: {
      gradeCount,
      classCount: Number(clsRow?.cnt || 0),
      studentCount: Number(struct?.student_count || 0),
      disabledStudentCount: Number(struct?.disabled_count || 0),
    },
    scores: {
      totalScore: Number(score?.total_score || 0),
      addScore: Number(score?.add_score || 0),
      deductScore: Number(score?.deduct_score || 0),
      recordCount: Number(score?.record_count || 0),
      todayRecordCount: Number((todayRes.rows[0] as any)?.cnt || 0),
    },
    topStudents: (topRes.rows as any[]).map((r, i) => ({
      rank: i + 1,
      id: Number(r.id),
      username: r.username,
      actualName: r.actual_name || '',
      classId: r.class_id == null ? null : Number(r.class_id),
      className: r.class_name || '',
      totalScore: Number(r.total_score),
      scoreCount: Number(r.score_count),
    })),
  })
})

function describeScope(ctx: any) {
  return {
    type: ctx.token.scopeType,
    gradeId: ctx.token.scopeGradeId,
    classId: ctx.token.scopeClassId,
  }
}
