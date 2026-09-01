// POST /api/v1/templates — 创建积分模板
//
// scope: templates:write
// 请求体：{ name, scoreChange, description?, classId? }
//
// classId 省略时创建"全校通用模板"（class_id = NULL）—— 但这只允许 school 范围的凭证做，
// 因为全校通用模板会出现在每个班级的可选项里，影响范围超出了年级/班级凭证的管辖边界。

import { and, eq, isNull } from 'drizzle-orm'
import { classes, scoreTemplates } from '../../../database/schema.school'
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

  const body = (await readBody(event)) as any

  const name = String(body?.name ?? '').trim()
  if (!name) apiError(400, API_CODE.MISSING_PARAM, 'name 不能为空')
  if (name.length > MAX_NAME_LEN) {
    apiError(400, API_CODE.INVALID_PARAM, `name 长度不得超过 ${MAX_NAME_LEN}`)
  }

  const scoreChange = Number(body?.scoreChange)
  if (!Number.isInteger(scoreChange) || Math.abs(scoreChange) > MAX_SCORE_DELTA) {
    apiError(400, API_CODE.INVALID_PARAM, `scoreChange 需为 ±${MAX_SCORE_DELTA} 内的整数`)
  }
  if (scoreChange === 0) {
    apiError(400, API_CODE.INVALID_PARAM, 'scoreChange 不能为 0')
  }

  const description = body?.description === undefined ? null : String(body.description).slice(0, MAX_DESC_LEN)

  // ===== 归属班级 =====
  let classId: number | null = null
  if (body?.classId === undefined || body.classId === null || body.classId === '') {
    if (ctx.token.scopeType !== 'school') {
      apiError(
        403,
        API_CODE.OUT_OF_RANGE,
        '仅校级范围（scopeType=school）的凭证可创建全校通用模板，请指定 classId',
      )
    }
  } else {
    const cid = Number(body.classId)
    if (!Number.isInteger(cid) || cid <= 0) {
      apiError(400, API_CODE.INVALID_PARAM, 'classId 不合法')
    }
    if (!ctx.scope.isClassAllowed(cid)) {
      apiError(403, API_CODE.OUT_OF_RANGE, `无权限为班级 ${cid} 创建模板`)
    }
    const cls = await ctx.db.select({ id: classes.id }).from(classes).where(eq(classes.id, cid)).get()
    if (!cls) apiError(404, API_CODE.NOT_FOUND, '班级不存在')
    classId = cid
  }

  // 同归属下模板重名拦截（NULL 需用 isNull，eq(col, null) 在 SQL 里永不成立）
  const dup = await ctx.db
    .select({ id: scoreTemplates.id })
    .from(scoreTemplates)
    .where(
      and(
        eq(scoreTemplates.name, name),
        classId == null ? isNull(scoreTemplates.classId) : eq(scoreTemplates.classId, classId),
      ),
    )
    .get()
  if (dup) apiError(409, API_CODE.CONFLICT, '同一归属下已存在同名模板')

  const [created] = await ctx.db
    .insert(scoreTemplates)
    .values({ classId, name, scoreChange, description })
    .returning()
    .all()

  return apiOk(
    event,
    {
      id: Number(created.id),
      classId,
      global: classId == null,
      name: created.name,
      scoreChange: Number(created.scoreChange),
      description: created.description || '',
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    },
    '模板创建成功',
  )
})
