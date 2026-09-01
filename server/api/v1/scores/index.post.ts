// POST /api/v1/scores — 批量加/减分
//
// scope: scores:write
// 支持 `Idempotency-Key` 请求头（强烈建议带上，见 docs/API.md）
//
// 请求体（两种写法，二选一）：
//   单条：{ userId | username, scoreChange, description? }
//   批量：{ items: [{ userId | username, scoreChange?, description? }], scoreChange?, description? }
//   模板：{ templateId, items: [...] } —— 模板提供 scoreChange / description 的默认值
//
// 实际写入走 server/utils/score-service.ts，与内部 /api/scores/add 共用同一份实现，
// 保证两条入口的积分口径（total/add/deduct/count 四列）永远一致。

import { eq } from 'drizzle-orm'
import { scoreTemplates } from '../../../database/schema.school'
import {
  API_CODE,
  apiError,
  apiOk,
  defineApiV1Handler,
} from '../../../utils/api-response'
import { assertScope } from '../../../utils/api-token'
import { useApiContext } from '../../../utils/api-context'
import { withIdempotency } from '../../../utils/api-idempotency'
import { applyScoreChanges, type ScoreChangeItem } from '../../../utils/score-service'

/** 单次请求最多处理的条目数。上限存在的意义是防止一次请求把库锁死 */
const MAX_ITEMS = 200

export default defineApiV1Handler(async (event) => {
  const ctx = await useApiContext(event)
  assertScope(ctx.token, 'scores:write')

  const body = (await readBody(event)) as any
  if (!body || typeof body !== 'object') {
    apiError(400, API_CODE.BAD_REQUEST, '请求体必须是 JSON 对象')
  }

  // ===== 模板：仅提供默认值，不改变范围约束 =====
  let defaultScore: number | null =
    body.scoreChange === undefined || body.scoreChange === null ? null : Number(body.scoreChange)
  let defaultDescription = String(body.description ?? '')

  if (body.templateId !== undefined && body.templateId !== null && body.templateId !== '') {
    const templateId = Number(body.templateId)
    if (!Number.isInteger(templateId) || templateId <= 0) {
      apiError(400, API_CODE.INVALID_PARAM, 'templateId 不合法')
    }
    const template = await ctx.db
      .select()
      .from(scoreTemplates)
      .where(eq(scoreTemplates.id, templateId))
      .get()
    if (!template) {
      apiError(404, API_CODE.NOT_FOUND, '积分模板不存在')
    }
    // classId 为 null 是全校通用模板；绑定班级的模板必须在 token 范围内
    if (template.classId != null && !ctx.scope.isClassAllowed(Number(template.classId))) {
      apiError(403, API_CODE.OUT_OF_RANGE, '无权限使用该班级的积分模板')
    }
    if (defaultScore === null) defaultScore = Number(template.scoreChange)
    if (!defaultDescription) defaultDescription = template.description || ''
  }

  // ===== 归一化条目 =====
  const rawItems: any[] = Array.isArray(body.items)
    ? body.items
    : body.userId !== undefined || body.username !== undefined
      ? [{ userId: body.userId, username: body.username, scoreChange: body.scoreChange, description: body.description }]
      : []

  if (rawItems.length === 0) {
    apiError(400, API_CODE.MISSING_PARAM, '请通过 items 或 userId / username 指定目标学生')
  }
  if (rawItems.length > MAX_ITEMS) {
    apiError(400, API_CODE.INVALID_PARAM, `单次最多处理 ${MAX_ITEMS} 条，当前 ${rawItems.length} 条`)
  }

  const items: ScoreChangeItem[] = rawItems.map((it: any) => {
    const raw = it?.scoreChange
    const delta = raw === undefined || raw === null || raw === '' ? defaultScore : Number(raw)
    return {
      userId: it?.userId === undefined || it?.userId === null || it?.userId === '' ? undefined : Number(it.userId),
      username: it?.username === undefined || it?.username === null ? undefined : String(it.username),
      // NaN 会被 score-service 逐条拦截并写入 details，无需在此抛错中断整批
      scoreChange: delta === null ? NaN : delta,
      description: it?.description === undefined ? undefined : String(it.description),
    }
  })

  if (items.some((i) => i.userId === undefined && !i.username)) {
    apiError(400, API_CODE.MISSING_PARAM, '每个条目都需提供 userId 或 username')
  }

  // ===== 执行（幂等包裹）=====
  const data = await withIdempotency({
    event,
    db: ctx.db,
    tokenId: ctx.token.id,
    endpoint: 'POST /api/v1/scores',
    run: async () => {
      const result = await applyScoreChanges({
        db: ctx.db,
        scope: ctx.scope,
        items,
        defaultDescription,
      })
      return {
        successCount: result.successCount,
        failedCount: result.failedCount,
        totalCount: result.totalCount,
        details: result.details,
      }
    },
  })

  return apiOk(
    event,
    data,
    `操作完成：成功 ${data.successCount} 条，失败 ${data.failedCount} 条`,
  )
})
