import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../utils/auth'
import { useMainDb, useSchoolDb } from '../../database/db'
import { schools } from '../../database/schema.main'
import { classes, grades } from '../../database/schema.school'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = admin.schoolId

  let className: string | null = null
  let gradeName: string | null = null
  let schoolName: string | null = null

  if (schoolId) {
    const schoolDb = await useSchoolDb(event, schoolId)

    if (admin.classId) {
      const cls = await schoolDb.select().from(classes).where(eq(classes.id, admin.classId)).get()
      if (cls) {
        className = cls.name
        const grade = await schoolDb.select().from(grades).where(eq(grades.id, cls.gradeId)).get()
        if (grade) gradeName = grade.name
      }
    } else if (admin.gradeId) {
      const grade = await schoolDb.select().from(grades).where(eq(grades.id, admin.gradeId)).get()
      if (grade) gradeName = grade.name
    }
  }

  if (schoolId) {
    const mainDb = useMainDb()
    const school = await mainDb.select().from(schools).where(eq(schools.id, schoolId)).get()
    if (school) schoolName = school.name
  }

  return {
    success: true,
    admin: {
      id: admin.id,
      username: admin.username,
      role: admin.role,
      schoolId: admin.schoolId,
      gradeId: admin.gradeId,
      classId: admin.classId,
      mustChangePassword: !!admin.mustChangePassword,
      className,
      gradeName,
      schoolName,
    },
  }
})
