import { eq } from 'drizzle-orm'
import { scoreTemplates } from '../../database/schema'
import { useSchoolDb } from '../../database/db'
import { requireAdmin, getSchoolIdFromRequest, resolveSchoolScope } from '../../utils/auth'
import { applyScoreChanges, type ScoreChangeItem } from '../../utils/score-service'

// POST /api/scores/add — 批量加/减分（学校库）
//
// 实际写入逻辑在 server/utils/score-service.ts，与外部开放 API /api/v1/scores 共用一份实现。
// 本文件只负责：session 鉴权 → 解析租户 → 展开模板 → 归一化请求体。
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)

  // 【安全】加/减分按 username 全校匹配，必须用管理员真实范围收窄，
  // 否则班级管理员只要知道别班学生用户名就能改对方积分。
  const scope = await resolveSchoolScope(admin, db)

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
      // 模板可绑定班级（classId 为 null 表示全校通用）：绑定班级的模板需在管理范围内
      if (template.classId != null && !scope.isClassAllowed(Number(template.classId))) {
        throw createError({ statusCode: 403, message: '无权限使用该班级的积分模板' })
      }
      scoreChange = template.scoreChange
      description = template.description || description
    }
  }

  // 支持单个用户和批量用户两种格式
  let items: ScoreChangeItem[] = []

  if (body.users && Array.isArray(body.users)) {
    items = body.users.map(u => ({
      username: u.username,
      scoreChange: u.score_change ?? scoreChange,
    }))
  } else if (body.username) {
    items = [{ username: body.username, scoreChange }]
  }

  if (items.length === 0) {
    throw createError({ statusCode: 400, message: '请指定用户' })
  }

  const result = await applyScoreChanges({ db, scope, items, defaultDescription: description })

  // 响应结构与历史版本保持一致，前端无需改动
  return {
    success: true,
    message: `操作完成：成功 ${result.successCount} 条，失败 ${result.failedCount} 条`,
    summary: {
      successCount: result.successCount,
      failedCount: result.failedCount,
      totalCount: result.totalCount,
    },
    details: result.details,
  }
})
