import { getStudentFromSession } from '../../utils/auth'
import { users, classes, grades } from '../../database/schema'
import { useSchoolDb } from '../../database/db'
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

  // 前端排序（Drizzle ORM 子查询兼容性差，用 JS 排序更简单可靠）
  list.sort((a: any, b: any) => (b.totalScore ?? 0) - (a.totalScore ?? 0))

  // 加上排名
  const data = list.map((u: any, idx: number) => ({
    ...u,
    rank: idx + 1,
  }))

  return { success: true, data }
})
