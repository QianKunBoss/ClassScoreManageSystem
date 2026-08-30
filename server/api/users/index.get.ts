import { users, scoreLogs } from '../../database/schema'
import { useSchoolDb, getSchoolRawClient } from '../../database/db'
import { requireAdmin, getSchoolIdFromRequest, resolveSchoolScope } from '../../utils/auth'
import { eq, like, or } from 'drizzle-orm'

// GET /api/users — 获取学生列表（从学校库读取）
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)
  const client = await getSchoolRawClient(event, schoolId)

  // 【安全】不能只依赖前端传入的 classId/gradeId 过滤：
  // 不传参数时原本会返回全校学生名单，班级管理员即可越权拉全校数据。
  const scope = await resolveSchoolScope(admin, db)

  const query = getQuery(event) as {
    search?: string
    page?: string
    limit?: string
    classId?: string
    gradeId?: string
    status?: string
  }

  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 50))
  const offset = (page - 1) * limit
  const search = (query.search || '').trim()

  // 构建 WHERE 子句（libsql client.execute 用 ? 占位符）
  const whereParts: string[] = []
  const args: any[] = []

  // 强制注入管理范围：非全校管理员只能看到自己可管理班级的学生
  // （用 u.class_id IN (...) 实现，不依赖 classes 表 JOIN，count 查询也能复用）
  if (!scope.schoolWide) {
    const allowedClassIds = Array.from(scope.classIdSet || [])
    if (allowedClassIds.length === 0) {
      return { data: [], total: 0, page, limit }
    }
    whereParts.push(`u.class_id IN (${allowedClassIds.map(() => '?').join(',')})`)
    args.push(...allowedClassIds)
  }

  if (search) {
    whereParts.push(`(u.username LIKE ? OR u.actual_name LIKE ? OR u.email LIKE ?)`)
    const pattern = `%${search.replace(/'/g, "''")}%`
    args.push(pattern, pattern, pattern)
  }
  if (query.classId) {
    whereParts.push(`u.class_id = ?`)
    args.push(Number(query.classId))
  }
  if (query.gradeId) {
    whereParts.push(`c.grade_id = ?`)
    args.push(Number(query.gradeId))
  }
  if (query.status === 'disabled') {
    whereParts.push(`u.disabled = 1`)
  } else if (query.status === 'active') {
    whereParts.push(`(u.disabled IS NULL OR u.disabled = 0)`)
  }
  const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : ''

  // 查询列表（含积分汇总 + 班级名称 + 年级名称）
  const listResult = await client.execute({
    sql: `SELECT
      u.id,
      u.username,
      u.actual_name,
      u.class_id,
      u.email,
      u.disabled,
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
      email: r.email || '',
      disabled: r.disabled ?? 0,
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
