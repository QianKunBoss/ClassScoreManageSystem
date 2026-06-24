import { eq, and, sql, desc, inArray } from 'drizzle-orm'
import { scoreLogs, users, classes as classTable } from '../../database/schema'
import { useSchoolDb } from '../../database/db'
import { requireAdmin, getSchoolIdFromRequest } from '../../utils/auth'

// GET /api/scores/logs — 获取积分记录（学校库，支持 userId / classId / gradeId / date 筛选）
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)

  const query = getQuery(event) as {
    userId?: string
    classId?: string    // 按班级过滤（通过 JOIN users）
    gradeId?: string    // 按年级过滤（通过 JOIN users → classes）
    date?: string       // 格式：YYYY-MM-DD
    page?: string
    limit?: string
  }

  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20))
  const offset = (page - 1) * limit
  const userId = query.userId ? Number(query.userId) : undefined
  const classId = query.classId ? Number(query.classId) : undefined
  const gradeId = query.gradeId ? Number(query.gradeId) : undefined
  const date = (query.date || '').trim()

  // 如果是 gradeId 筛选，先查出该年级的所有 classId
  let classIdsInGrade: number[] = []
  if (gradeId) {
    const gradeClasses = await db
      .select({ id: classTable.id })
      .from(classTable)
      .where(eq(classTable.gradeId, gradeId))
    classIdsInGrade = gradeClasses.map(c => c.id)
    // 如果年级下没有班级，直接返回空
    if (classIdsInGrade.length === 0) {
      return { data: [], total: 0, page, limit }
    }
  }

  // 构建 WHERE 条件
  const conditions = []
  if (userId) conditions.push(eq(scoreLogs.userId, userId))
  if (classId) conditions.push(eq(users.classId, classId))
  if (gradeId && classIdsInGrade.length > 0) {
    conditions.push(inArray(users.classId, classIdsInGrade))
  }
  if (date) {
    conditions.push(sql`date(${scoreLogs.createdAt}) = ${date}`)
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const selectFields = {
    id: scoreLogs.id,
    userId: scoreLogs.userId,
    username: users.username,
    actualName: users.actualName,
    scoreChange: scoreLogs.scoreChange,
    description: scoreLogs.description,
    createdAt: scoreLogs.createdAt,
  }

  let logs
  let total

  if (whereClause) {
    logs = await db
      .select(selectFields)
      .from(scoreLogs)
      .leftJoin(users, eq(scoreLogs.userId, users.id))
      .where(whereClause)
      .orderBy(desc(scoreLogs.createdAt))
      .limit(limit)
      .offset(offset)

    total = (await db
      .select({ count: sql<number>`count(*)` })
      .from(scoreLogs)
      .leftJoin(users, eq(scoreLogs.userId, users.id))
      .where(whereClause)
      .get())?.count || 0
  } else {
    logs = await db
      .select(selectFields)
      .from(scoreLogs)
      .leftJoin(users, eq(scoreLogs.userId, users.id))
      .orderBy(desc(scoreLogs.createdAt))
      .limit(limit)
      .offset(offset)

    total = (await db
      .select({ count: sql<number>`count(*)` })
      .from(scoreLogs)
      .get())?.count || 0
  }

  return {
    data: logs,
    total,
    page,
    limit,
  }
})
