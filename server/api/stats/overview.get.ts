import { sql } from 'drizzle-orm'
import { users, scoreLogs } from '../../database/schema'
import { useSchoolDb, getSchoolRawClient } from '../../database/db'
import { requireAdmin, getSchoolIdFromRequest } from '../../utils/auth'

// GET /api/stats/overview — 统计概览（学校库）
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)
  const client = await getSchoolRawClient(event, schoolId)

  // 平均分
  const avgResult = await client.execute(`
    SELECT coalesce(avg(total_score), 0) as avg_score
    FROM (
      SELECT u.id, coalesce(sum(sl.score_change), 0) AS total_score
      FROM users u
      LEFT JOIN score_logs sl ON u.id = sl.user_id
      GROUP BY u.id
    )`)
  const avgRow = avgResult.rows[0] as any

  // 最高分
  const maxResult = await client.execute(`
    SELECT coalesce(max(total_score), 0) as max_score
    FROM (
      SELECT u.id, coalesce(sum(sl.score_change), 0) AS total_score
      FROM users u
      LEFT JOIN score_logs sl ON u.id = sl.user_id
      GROUP BY u.id
    )`)
  const maxRow = maxResult.rows[0] as any

  // 最低分
  const minResult = await client.execute(`
    SELECT coalesce(min(total_score), 0) as min_score
    FROM (
      SELECT u.id, coalesce(sum(sl.score_change), 0) AS total_score
      FROM users u
      LEFT JOIN score_logs sl ON u.id = sl.user_id
      GROUP BY u.id
    )`)
  const minRow = minResult.rows[0] as any

  // TOP 20 排名（Drizzle ORM）
  const ranking = await db
    .select({
      id: users.id,
      username: users.username,
      totalScore: sql<number>`coalesce(sum(${scoreLogs.scoreChange}), 0)`,
      addScore: sql<number>`coalesce(sum(case when ${scoreLogs.scoreChange} > 0 then ${scoreLogs.scoreChange} else 0 end), 0)`,
      deductScore: sql<number>`coalesce(sum(case when ${scoreLogs.scoreChange} < 0 then ${scoreLogs.scoreChange} else 0 end), 0)`,
    })
    .from(users)
    .leftJoin(scoreLogs, sql`${users.id} = ${scoreLogs.userId}`)
    .groupBy(users.id)
    .orderBy(sql`coalesce(sum(${scoreLogs.scoreChange}), 0) desc`)
    .limit(20)

  return {
    avgScore: Math.round((avgRow?.avg_score || 0) * 10) / 10,
    maxScore: maxRow?.max_score || 0,
    minScore: minRow?.min_score || 0,
    ranking,
  }
})
