import { useSchoolDb, useMainDb } from '../../database/db'
import { schools } from '../../database/schema.main'
import { users, scoreLogs } from '../../database/schema'
import { eq } from 'drizzle-orm'

// POST /api/admin/recalculate-scores — 重新计算所有学生的 totalScore
// 普通管理员：仅处理自己管理的学校
// 超级管理员：不传 schoolId 则处理所有学校，传则处理指定学校
export default defineEventHandler(async (event) => {
  const { requireAdmin, getAdminFromSession } = await import('../../utils/auth')
  const admin = await requireAdmin(event)

  const query = getQuery(event)

  // 确定要处理的学校
  let targetSchoolIds: number[]

  if (admin.role === 'super_admin' && !query.schoolId) {
    // 超级管理员，不指定学校：处理所有学校
    const mainDb = useMainDb()
    const allSchools = await mainDb.select({ id: schools.id }).from(schools)
    targetSchoolIds = allSchools.map(s => s.id)
  } else {
    // 普通管理员：用自己的 schoolId
    // 超级管理员指定了 schoolId：用指定的
    const schoolId = query.schoolId ? Number(query.schoolId) : admin.schoolId
    if (!schoolId) {
      throw createError({
        statusCode: 400,
        statusMessage: '缺少 schoolId，超级管理员请传递 ?schoolId= 参数',
      })
    }
    targetSchoolIds = [schoolId]
  }

  let totalUpdated = 0
  let totalSchools = 0

  // 处理每个学校
  for (const schoolId of targetSchoolIds) {
    const db = await useSchoolDb(event, schoolId)

    // 获取所有积分记录
    const logs = await db.select({
      userId: scoreLogs.userId,
      scoreChange: scoreLogs.scoreChange,
    }).from(scoreLogs)

    // JS 汇总每个用户的积分
    const scoreMap: Record<number, number> = {}
    for (const log of logs) {
      scoreMap[log.userId] = (scoreMap[log.userId] || 0) + log.scoreChange
    }

    // 更新有积分记录的用户
    for (const [userIdStr, total] of Object.entries(scoreMap)) {
      const userId = Number(userIdStr)
      await db
        .update(users)
        .set({ totalScore: total })
        .where(eq(users.id, userId))
      totalUpdated++
    }

    // 没有积分记录的用户，totalScore 设为 0
    const allUsers = await db.select({ id: users.id }).from(users)
    for (const u of allUsers) {
      if (!(u.id in scoreMap)) {
        await db
          .update(users)
          .set({ totalScore: 0 })
          .where(eq(users.id, u.id))
      }
    }

    totalSchools++
  }

  return {
    success: true,
    message: `已重新计算 ${totalSchools} 所学校、${totalUpdated} 名学生的积分`,
  }
})
