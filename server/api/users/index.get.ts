import { users, scoreLogs } from '../../database/schema'
import { useSchoolDb, getSchoolRawClient } from '../../database/db'
import { requireAdmin, getSchoolIdFromRequest } from '../../utils/auth'
import { eq, like, or } from 'drizzle-orm'

// GET /api/users — 获取学生列表（从学校库读取）
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)
  const client = await getSchoolRawClient(event, schoolId)

  const query = getQuery(event) as {
    search?: string
    page?: string
    limit?: string
    classId?: string
    gradeId?: string
  }

  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 50))
  const offset = (page - 1) * limit
  const search = (query.search || '').trim()

  // 构建 WHERE 子句（libsql client.execute 用 ? 占位符）
  const whereParts: string[] = []
  const args: any[] = []
  if (search) {
    whereParts.push(`(u.username LIKE ? OR u.actual_name LIKE ?)`)
    const pattern = `%${search.replace(/'/g, "''")}%`
    args.push(pattern, pattern)
  }
  if (query.classId) {
    whereParts.push(`u.class_id = ?`)
    args.push(Number(query.classId))
  }
  if (query.gradeId) {
    whereParts.push(`c.grade_id = ?`)
    args.push(Number(query.gradeId))
  }
  const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : ''

  // 查询列表（含积分汇总 + 班级名称 + 年级名称）
  const listResult = await client.execute({
    sql: `SELECT
      u.id,
      u.username,
      u.actual_name,
      u.class_id,
      c.name AS class_name,
      g.name AS grade_name,
      u.created_at,
      COALESCE(sum(sl.score_change), 0) AS total_score,
      COALESCE(sum(CASE WHEN sl.score_change > 0 THEN sl.score_change ELSE 0 END), 0) AS add_score,
      COALESCE(sum(CASE WHEN sl.score_change < 0 THEN sl.score_change ELSE 0 END), 0) AS deduct_score,
      count(sl.id) AS score_count
    FROM users u
    LEFT JOIN classes c ON u.class_id = c.id
    LEFT JOIN grades g ON c.grade_id = g.id
    LEFT JOIN score_logs sl ON u.id = sl.user_id
    ${whereSql}
    GROUP BY u.id
    ORDER BY total_score DESC, u.id ASC
    LIMIT ? OFFSET ?`,
    args: [...args, limit, offset],
  })

  // 查询总数（需要 JOIN classes 以支持 gradeId 过滤）
  const fromSql = query.gradeId ? `FROM users u LEFT JOIN classes c ON u.class_id = c.id` : `FROM users u`
  const countResult = await client.execute({
    sql: `SELECT count(*) as cnt ${fromSql} ${whereSql}`,
    args,
  })
  const total = (countResult.rows[0] as any).cnt || 0

  const rows = listResult.rows as any[]

  return {
    data: rows.map((r: any) => ({
      id: r.id,
      username: r.username,
      actualName: r.actual_name || '',
      classId: r.class_id || null,
      className: r.class_name || '',
      gradeName: r.grade_name || '',
      totalScore: r.total_score,
      addScore: r.add_score,
      deductScore: r.deduct_score,
      scoreCount: r.score_count,
      createdAt: r.created_at,
    })),
    total,
    page,
    limit,
  }
})
