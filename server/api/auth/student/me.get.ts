import { getStudentFromSession } from '../../../utils/auth'
import { useSchoolDb } from '../../../database/db'
import { users, classes, grades } from '../../../database/schema'
import { eq } from 'drizzle-orm'

// GET /api/auth/student/me — 获取当前登录学生信息（从数据库读取最新数据）
export default defineEventHandler(async (event) => {
  const student = await getStudentFromSession(event)

  if (!student) {
    return { success: false, student: null }
  }

  // 从数据库读取最新数据，并 JOIN 班级名、年级名
  const db = await useSchoolDb(event, student.schoolId)
  const dbUser = await db
    .select({
      id: users.id,
      username: users.username,
      actualName: users.actualName,
      classId: users.classId,
      totalScore: users.totalScore,
      className: classes.name,
      gradeName: grades.name,
    })
    .from(users)
    .leftJoin(classes, eq(users.classId, classes.id))
    .leftJoin(grades, eq(classes.gradeId, grades.id))
    .where(eq(users.id, student.id))
    .get()

  if (!dbUser) {
    return { success: false, student: null }
  }

  return {
    success: true,
    student: dbUser,
  }
})
