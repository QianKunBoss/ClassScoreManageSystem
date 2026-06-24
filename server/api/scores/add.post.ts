import { eq, sql } from 'drizzle-orm'
import { users, scoreLogs, scoreTemplates } from '../../database/schema'
import { useSchoolDb } from '../../database/db'
import { requireAdmin, getSchoolIdFromRequest } from '../../utils/auth'

// POST /api/scores/add — 批量加/减分（学校库）
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)

  // 批量加/减分
  const body = await readBody(event) as {
    users?: { username: string; score_change: number }[]
    username?: string
    score_change?: number
    description?: string
    templateId?: number
  }

  // 如果使用模板，先获取模板数据
  let scoreChange = body.score_change || 0
  let description = body.description || ''

  if (body.templateId) {
    const template = await db.select().from(scoreTemplates).where(eq(scoreTemplates.id, body.templateId)).get()
    if (template) {
      scoreChange = template.scoreChange
      description = template.description || description
    }
  }

  // 支持单个用户和批量用户两种格式
  let userEntries: { username: string; score_change: number }[] = []

  if (body.users && Array.isArray(body.users)) {
    userEntries = body.users.map(u => ({
      username: u.username,
      score_change: u.score_change || scoreChange,
    }))
  } else if (body.username) {
    userEntries = [{ username: body.username, score_change: scoreChange }]
  }

  if (userEntries.length === 0) {
    throw createError({ statusCode: 400, statusMessage: '请指定用户' })
  }

  const results: any[] = []
  let successCount = 0
  let failedCount = 0

  for (const entry of userEntries) {
    const userData = await db.select().from(users).where(eq(users.username, entry.username)).get()

    if (!userData) {
      failedCount++
      results.push({ username: entry.username, success: false, error: '用户不存在' })
      continue
    }

    await db.insert(scoreLogs).values({
      userId: userData.id,
      username: userData.username,
      scoreChange: entry.score_change,
      description,
      createdAt: new Date().toISOString(),
    })

    // 同步更新 users.totalScore（原子操作，用 SQL 模板直接操作数据库字段）
    await db
      .update(users)
      .set({ totalScore: sql`total_score + ${entry.score_change}` })
      .where(eq(users.id, userData.id))

    successCount++
    results.push({
      username: userData.username,
      userId: userData.id,
      scoreChange: entry.score_change,
      success: true,
    })
  }

  return {
    success: true,
    message: `操作完成：成功 ${successCount} 条，失败 ${failedCount} 条`,
    summary: { successCount, failedCount, totalCount: userEntries.length },
    details: results,
  }
})
