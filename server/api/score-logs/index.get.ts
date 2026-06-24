import { getSchoolRawClient } from '../../database/db'
import { requireAdmin, getSchoolIdFromRequest } from '../../utils/auth'

// GET /api/score-logs — 获取积分记录列表（学校库，raw SQL JOIN）
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const client = await getSchoolRawClient(event, schoolId)

  const query = getQuery(event) as {
    userId?: string
    page?: string
    limit?: string
  }

  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 50))
  const offset = (page - 1) * limit

  let whereSql = ''
  const args: any[] = []

  if (query.userId) {
    whereSql = 'WHERE sl.user_id = ?'
    args.push(Number(query.userId))
  }

  // 查询列表
  const listResult = await client.execute({
    sql: `SELECT
      sl.id,
      sl.user_id,
      sl.score_change,
      sl.description,
      sl.created_at,
      u.username
    FROM score_logs sl
    LEFT JOIN users u ON sl.user_id = u.id
    ${whereSql}
    ORDER BY sl.id DESC
    LIMIT ? OFFSET ?`,
    args: [...args, limit, offset],
  })

  // 查询总数
  const countResult = await client.execute({
    sql: `SELECT count(*) as cnt FROM score_logs sl ${whereSql}`,
    args,
  })
  const total = (countResult.rows[0] as any).cnt || 0

  return {
    data: listResult.rows as any[],
    total,
    page,
    limit,
  }
})
