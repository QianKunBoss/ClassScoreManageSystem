// PATCH /api/v1/templates/:id — 更新积分模板
//
// scope: templates:write
// 请求体：{ name?, scoreChange?, description? }
//
// 【不开放改 classId】把模板从 A 班挪到 B 班，语义上等于「删了再建」，
// 但会悄悄改变一个已被引用对象的归属。让调用方显式删除+新建，意图更清晰、审计更好读。
//
// 全校通用模板（class_id = NULL）只允许 school 范围凭证修改 ——
// 否则一个班级凭证就能改掉全校都在用的模板内容。

import { and, eq, isNull, ne } from 'drizzle-orm'
import { scoreTemplates } from '../../../database/schema.school'
import {
  API_CODE,
  apiError,
  apiOk,
  defineApiV1Handler,
} from '../../../utils/api-response'
import { assertScope } from '../../../utils/api-token'
import { useApiContext } from '../../../utils/api-context'
import { MAX_SCORE_DELTA } from '../../../utils/score-service'

const MAX_NAME_LEN = 64
const MAX_DESC_LEN = 200

export default defineApiV1Handler(async (event) => {
  const ctx = await useApiContext(event)
  assertScope(ctx.token, 'templates:write')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    apiError(400, API_CODE.INVALID_PARAM, '模板 id 不合法')
  }

  const existing = await ctx.db.select().from(scoreTemplates).where(eq(scoreTemplates.id, id)).get()
  if (!existing) apiError(404, API_CODE.NOT_FOUND, '模板不存在')

  if (existing.classId == null) {
    if (ctx.token.scopeType !== 'school') {
      apiError(403, API_CODE.OUT_OF_RANGE, '仅校级范围（scopeType=school）的凭证可修改全校通用模板')
    }
  } else if (!ctx.scope.isClassAllowed(Number(existing.classId))) {
    apiError(403, API_CODE.OUT_OF_RANGE, '无权限修改该班级的模板')
  }

  const body = (await readBody(event)) as any
  const setData: Record<string, any> = {}

  if (body?.name !== undefined) {
    const name = String(body.name ?? '').trim()
    if (!name) apiError(400, API_CODE.MISSING_PARAM, 'name 不能为空')
    if (name.length > MAX_NAME_LEN) {
      apiError(400, API_CODE.INVALID_PARAM, `name 长度不得超过 ${MAX_NAME_LEN}`)
    }
    if (name !== existing.name) {
      const dup = await ctx.db
        .select({ id: scoreTemplates.id })
        .from(scoreTemplates)
        .where(
          and(
            eq(scoreTemplates.name, name),
            existing.classId == null
              ? isNull(scoreTemplates.classId)
              : eq(scoreTemplates.classId, Number(existing.classId)),
            ne(scoreTemplates.id, id),
          ),
        )
        .get()
      if (dup) apiError(409, API_CODE.CONFLICT, '同一归属下已存在同名模板')
    }
    setData.name = name
  }

  if (body?.scoreChange !== undefined) {
    const sc = Number(body.scoreChange)
    if (!Number.isInteger(sc) || Math.abs(sc) > MAX_SCORE_DELTA) {
      apiError(400, API_CODE.INVALID_PARAM, `scoreChange 需为 ±${MAX_SCORE_DELTA} 内的整数`)
    }
    if (sc === 0) apiError(400, API_CODE.INVALID_PARAM, 'scoreChange 不能为 0')
    setData.scoreChange = sc
  }

  if (body?.description !== undefined) {
    const d = String(body.description ?? '').slice(0, MAX_DESC_LEN)
    setData.description = d || null
  }

  if (Object.keys(setData).length === 0) {
    apiError(400, API_CODE.MISSING_PARAM, '请至少指定一个要修改的字段')
  }

  setData.updatedAt = new Date().toISOString()
  await ctx.db.update(scoreTemplates).set(setData).where(eq(scoreTemplates.id, id))

  const updated = await ctx.db.select().from(scoreTemplates).where(eq(scoreTemplates.id, id)).get()

  return apiOk(
    event,
    {
      id,
      classId: updated.classId == null ? null : Number(updated.classId),
      global: updated.classId == null,
      name: updated.name,
      scoreChange: Number(updated.scoreChange),
      description: updated.description || '',
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    },
    '模板已更新',
  )
})
