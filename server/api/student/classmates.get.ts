import { getStudentFromSession } from '../../utils/auth'
import { users, classes, grades } from '../../database/schema'
import { useSchoolDb, getSchoolRawClient } from '../../database/db'
import { eq } from 'drizzle-orm'

// GET /api/student/classmates — 获取同班同学（按积分排序，学生端专用）
export default defineEventHandler(async (event) => {
  const student = await getStudentFromSession(event)
  if (!student) {
    setResponseStatus(event, 401)
    return { success: false, message: '请先登录' }
  }

  const db = await useSchoolDb(event, student.schoolId)

  const list = await db
    .select({
      id: users.id,
      username: users.username,
      actualName: users.actualName,
      totalScore: users.totalScore,
      className: classes.name,
      gradeName: grades.name,
    })
    .from(users)
    .leftJoin(classes, eq(users.classId, classes.id))
    .leftJoin(grades, eq(classes.gradeId, grades.id))
    .where(eq(users.classId, student.classId))

  // 加分 / 减分（全量汇总，与管理员排行榜口径一致）
  let addMap = new Map<number, number>()
  let deductMap = new Map<number, number>()
  if (student.classId != null) {
    const client = await getSchoolRawClient(event, student.schoolId)
    const agg = await client.execute({
      sql: `SELECT u.id,
              COALESCE(sum(CASE WHEN sl.score_change > 0 THEN sl.score_change ELSE 0 END), 0) AS add_score,
              COALESCE(sum(CASE WHEN sl.score_change < 0 THEN sl.score_change ELSE 0 END), 0) AS deduct_score
            FROM users u
            LEFT JOIN score_logs sl ON u.id = sl.user_id
            WHERE u.class_id = ?
            GROUP BY u.id`,
      args: [student.classId],
    })
    for (const r of agg.rows as any[]) {
      const id = Number(r.id)
      addMap.set(id, Number(r.add_score || 0))
      deductMap.set(id, Number(r.deduct_score || 0))
    }
  }

  // 前端排序（Drizzle ORM 子查询兼容性差，用 JS 排序更简单可靠）
  list.sort((a: any, b: any) => (b.totalScore ?? 0) - (a.totalScore ?? 0))

  // 加上排名与加分/减分
  const data = list.map((u: any, idx: number) => ({
    ...u,
    rank: idx + 1,
    addScore: addMap.get(u.id) ?? 0,
    deductScore: deductMap.get(u.id) ?? 0,
  }))

  return { success: true, data }
})
