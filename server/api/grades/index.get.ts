import { useSchoolDb, useMainDb } from '../../database/db'
import { grades } from '../../database/schema'
import { schools } from '../../database/schema.main'
import { requireAdmin } from '../../utils/auth'
import { getSchoolIdFromRequest } from '../../utils/auth'
import { eq } from 'drizzle-orm'

// 列出年级
// - 学校管理员：只返回自己学校的年级，附上 schoolName
// - 超级管理员：需传 ?schoolId=，返回对应学校的年级
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)
  const mainDb = useMainDb()

  // 查学校名称
  const school = await mainDb
    .select({ name: schools.name })
    .from(schools)
    .where(eq(schools.id, schoolId))
    .get()

  const list = await db
    .select()
    .from(grades)
    .orderBy(grades.id)
    .all()

  // 附加 schoolName
  const data = (list as any[]).map((g: any) => ({
    ...g,
    schoolName: school?.name || '',
  }))

  return { success: true, data }
})
