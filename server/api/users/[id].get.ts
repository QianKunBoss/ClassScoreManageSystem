import { eq, desc } from 'drizzle-orm'
import { users, scoreLogs } from '../../database/schema'
import { useSchoolDb, getSchoolRawClient } from '../../database/db'
import { requireAdmin, getSchoolIdFromRequest } from '../../utils/auth'

// GET /api/users/[id] — 获取学生详情 + 积分记录（从学校库读取）
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)
  const client = await getSchoolRawClient(event, schoolId)

  const id = Number(getRouterParam(event, 'id'))
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: '缺少用户 ID' })
  }

  // 用户信息（带积分汇总，raw SQL）
  const result = await client.execute({
    sql: `SELECT
      u.id,
      u.username,
      u.actual_name,
      u.created_at,
      COALESCE(sum(sl.score_change), 0) AS total_score,
      COALESCE(sum(CASE WHEN sl.score_change > 0 THEN sl.score_change ELSE 0 END), 0) AS add_score,
      COALESCE(sum(CASE WHEN sl.score_change < 0 THEN sl.score_change ELSE 0 END), 0) AS deduct_score,
      count(sl.id) AS score_count
    FROM users u
    LEFT JOIN score_logs sl ON u.id = sl.user_id
    WHERE u.id = ?
    GROUP BY u.id`,
    args: [id],
  })
  const row = result.rows[0] as any

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: '用户不存在' })
  }

  // 积分记录（Drizzle ORM）
  const logs = await db
    .select()
    .from(scoreLogs)
    .where(eq(scoreLogs.userId, id))
    .orderBy(desc(scoreLogs.createdAt))

  return {
    data: {
      id: row.id,
      username: row.username,
      actualName: row.actual_name || '',
      totalScore: row.total_score,
      addScore: row.add_score,
      deductScore: row.deduct_score,
      scoreCount: row.score_count,
      createdAt: row.created_at,
    },
    logs,
  }
})
