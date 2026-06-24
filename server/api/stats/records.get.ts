import { sql } from 'drizzle-orm'
import { scoreLogs } from '../../database/schema'
import { useSchoolDb } from '../../database/db'
import { requireAdmin, getSchoolIdFromRequest } from '../../utils/auth'

// GET /api/stats/records — 按描述分组统计积分记录（学校库）
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)

  // 按描述分组统计
  const stats = await db
    .select({
      description: scoreLogs.description,
      recordCount: sql<number>`count(*)`,
      totalPositive: sql<number>`coalesce(sum(case when ${scoreLogs.scoreChange} > 0 then ${scoreLogs.scoreChange} else 0 end), 0)`,
      totalNegative: sql<number>`coalesce(sum(case when ${scoreLogs.scoreChange} < 0 then ${scoreLogs.scoreChange} else 0 end), 0)`,
      avgScore: sql<number>`coalesce(avg(${scoreLogs.scoreChange}), 0)`,
      lastUsed: sql<string>`max(${scoreLogs.createdAt})`,
      firstUsed: sql<string>`min(${scoreLogs.createdAt})`,
    })
    .from(scoreLogs)
    .where(sql`${scoreLogs.description} is not null and ${scoreLogs.description} != ''`)
    .groupBy(scoreLogs.description)
    .orderBy(sql`count(*) desc`)

  const totalRecords = stats.reduce((sum: number, s: any) => sum + s.recordCount, 0)

  const formattedStats = stats.map((s: any) => ({
    ...s,
    percentage: totalRecords > 0 ? Math.round((s.recordCount / totalRecords) * 10000) / 100 : 0,
    avgScore: Math.round(s.avgScore * 10) / 10,
  }))

  return {
    data: formattedStats,
    totalRecords,
  }
})
