import { sql } from 'drizzle-orm'
import { useMainDb, useSchoolDb, getSchoolRawClient } from '../../database/db'
import { schools } from '../../database/schema.main'
import { classes, users } from '../../database/schema.school'
import { requireSuperAdmin, getSchoolIdFromRequest } from '../../utils/auth'

// GET /api/data/activity — 明细记录：跨校（或本校）最近的积分记录 + 新注册学生
export default defineEventHandler(async (event) => {
  const admin = await requireSuperAdmin(event)
  const isSuper = admin.role === 'super_admin'
  const mainDb = useMainDb()
  const query = getQuery(event)
  const limit = Math.min(Number(query.limit) || 15, 50)

  let schoolList: { id: number; name: string }[]
  if (isSuper) {
    schoolList = (await mainDb.select({ id: schools.id, name: schools.name }).from(schools)) as any
  } else {
    const sid = await getSchoolIdFromRequest(event)
    const s = await mainDb
      .select({ id: schools.id, name: schools.name })
      .from(schools)
      .where(sql`${schools.id} = ${sid}`)
      .get()
    schoolList = s ? [s as any] : []
  }

  const scoreLogs: any[] = []
  const newStudents: any[] = []

  for (const sc of schoolList) {
    const db = await useSchoolDb(event, sc.id)
    const client = await getSchoolRawClient(event, sc.id)

    const logs = await client.execute(
      `SELECT id, user_id as userId, username, score_change as scoreChange,
              description, created_at as createdAt
       FROM score_logs ORDER BY created_at DESC LIMIT ?`,
      [limit],
    )
    for (const l of logs.rows as any[]) {
      scoreLogs.push({ ...l, schoolName: sc.name, schoolId: sc.id })
    }

    const stu = await db
      .select({
        id: users.id,
        actualName: users.actualName,
        username: users.username,
        createdAt: users.createdAt,
        className: classes.name,
      })
      .from(users)
      .leftJoin(classes, sql`${users.classId} = ${classes.id}`)
      .orderBy(sql`${users.createdAt} DESC`)
      .limit(limit)
    for (const u of stu) {
      newStudents.push({ ...u, schoolName: sc.name, schoolId: sc.id })
    }
  }

  scoreLogs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  newStudents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return {
    scoreLogs: scoreLogs.slice(0, limit),
    newStudents: newStudents.slice(0, limit),
  }
})
