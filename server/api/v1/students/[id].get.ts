// GET /api/v1/students/:id — 学生详情
//
// scope: students:read
//
// 【设计】超出 token 范围的学生统一返回 404 而不是 403。
// 403 会告诉调用方"这个 id 存在但不属于你"，足以让班级级凭证遍历出全校学生规模。
// 对外接口宁可牺牲一点排障便利，也不提供枚举能力。写接口不同（调用方明确指名了目标），
// 仍返回"无权限操作该学生"。差异已写入 docs/API.md。

import { API_CODE, apiError, apiOk, defineApiV1Handler } from '../../../utils/api-response'
import { assertScope } from '../../../utils/api-token'
import { useApiContext } from '../../../utils/api-context'

export default defineApiV1Handler(async (event) => {
  const ctx = await useApiContext(event)
  assertScope(ctx.token, 'students:read')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    apiError(400, API_CODE.INVALID_PARAM, '学生 id 不合法')
  }

  const res = await ctx.client.execute({
    sql: `SELECT
        u.id, u.username, u.actual_name, u.class_id, u.disabled, u.created_at,
        u.email, u.email_bound_at,
        c.name AS class_name, c.grade_id, g.name AS grade_name,
        COALESCE(SUM(sl.score_change), 0) AS total_score,
        COALESCE(SUM(CASE WHEN sl.score_change > 0 THEN sl.score_change ELSE 0 END), 0) AS add_score,
        COALESCE(SUM(CASE WHEN sl.score_change < 0 THEN -sl.score_change ELSE 0 END), 0) AS deduct_score,
        COUNT(sl.id) AS score_count
      FROM users u
      LEFT JOIN classes c ON u.class_id = c.id
      LEFT JOIN grades g ON c.grade_id = g.id
      LEFT JOIN score_logs sl ON u.id = sl.user_id
      WHERE u.id = ?
      GROUP BY u.id`,
    args: [id],
  })

  const row = res.rows[0] as any
  if (!row) {
    apiError(404, API_CODE.NOT_FOUND, '学生不存在')
  }
  if (!ctx.scope.isClassAllowed(Number(row.class_id))) {
    apiError(404, API_CODE.NOT_FOUND, '学生不存在')
  }

  // 附带最近积分流水，省掉调用方再打一次 /scores 的往返
  const logsRes = await ctx.client.execute({
    sql: `SELECT id, score_change, description, created_at
      FROM score_logs WHERE user_id = ?
      ORDER BY created_at DESC, id DESC LIMIT 10`,
    args: [id],
  })

  return apiOk(event, {
    id: Number(row.id),
    username: row.username,
    actualName: row.actual_name || '',
    classId: row.class_id == null ? null : Number(row.class_id),
    className: row.class_name || '',
    gradeId: row.grade_id == null ? null : Number(row.grade_id),
    gradeName: row.grade_name || '',
    disabled: Number(row.disabled ?? 0) === 1,
    // 邮箱是否已绑定对外可见，但不返回邮箱明文 —— 那是学生个人信息，
    // 不属于"班级积分管理"这个业务场景需要开放的数据。
    emailBound: !!row.email,
    emailBoundAt: row.email_bound_at || null,
    totalScore: Number(row.total_score),
    addScore: Number(row.add_score),
    deductScore: Number(row.deduct_score),
    scoreCount: Number(row.score_count),
    createdAt: row.created_at,
    recentScores: (logsRes.rows as any[]).map((r) => ({
      id: Number(r.id),
      scoreChange: Number(r.score_change),
      description: r.description || '',
      createdAt: r.created_at,
    })),
  })
})
