// POST /api/v1/classes — 创建班级
//
// scope: structure:write
// 请求体：{ gradeId, name }
//
// 【范围约束】school 范围可在任意年级下建班；grade 范围只能在自己那个年级下建班；
// class 范围不可建班 —— 新班级不属于它，建了也用不上，只会污染结构。
//
// 注意：grade 范围凭证新建班级后，该班级会自动进入其可见范围
// （resolveTokenScope 每次请求实时查 classes，存的是 gradeId 而非班级快照）。
// 这是刻意设计：年级凭证的语义就是"这个年级的一切，包括以后新增的班级"。

import { and, eq } from 'drizzle-orm'
import { classes, grades } from '../../../database/schema.school'
import {
  API_CODE,
  apiError,
  apiOk,
  defineApiV1Handler,
} from '../../../utils/api-response'
import { assertScope } from '../../../utils/api-token'
import { useApiContext } from '../../../utils/api-context'

const MAX_NAME_LEN = 64

export default defineApiV1Handler(async (event) => {
  const ctx = await useApiContext(event)
  assertScope(ctx.token, 'structure:write')

  if (ctx.token.scopeType === 'class') {
    apiError(403, API_CODE.OUT_OF_RANGE, '班级范围（scopeType=class）的凭证不可创建班级')
  }

  const body = (await readBody(event)) as any

  const gradeId = Number(body?.gradeId)
  if (!Number.isInteger(gradeId) || gradeId <= 0) {
    apiError(400, API_CODE.INVALID_PARAM, 'gradeId 不合法')
  }
  if (!ctx.scope.schoolWide && !ctx.scope.isGradeAllowed(gradeId)) {
    apiError(403, API_CODE.OUT_OF_RANGE, `无权限在年级 ${gradeId} 下创建班级`)
  }

  const name = String(body?.name ?? '').trim()
  if (!name) apiError(400, API_CODE.MISSING_PARAM, 'name 不能为空')
  if (name.length > MAX_NAME_LEN) {
    apiError(400, API_CODE.INVALID_PARAM, `name 长度不得超过 ${MAX_NAME_LEN}`)
  }

  const grade = await ctx.db.select({ id: grades.id }).from(grades).where(eq(grades.id, gradeId)).get()
  if (!grade) apiError(404, API_CODE.NOT_FOUND, '年级不存在')

  const dup = await ctx.db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.gradeId, gradeId), eq(classes.name, name)))
    .get()
  if (dup) apiError(409, API_CODE.CONFLICT, '该年级下已存在同名班级')

  const [created] = await ctx.db.insert(classes).values({ gradeId, name }).returning().all()

  return apiOk(
    event,
    {
      id: Number(created.id),
      name: created.name,
      gradeId,
      createdAt: created.createdAt,
    },
    '班级创建成功',
  )
})
