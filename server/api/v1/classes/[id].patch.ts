// PATCH /api/v1/classes/:id — 重命名班级 / 调整所属年级
//
// scope: structure:write
// 请求体：{ name?, gradeId? }
//
// 【为什么改 gradeId 要求 school 范围】把班级挪到别的年级，等价于让该班级脱离原年级的
// 管辖，同时进入新年级的管辖。grade 范围凭证若能做这件事，就能把自己名下的班级
// "送出去"或从别处"拉进来" —— 那是跨范围写操作。因此转年级仅限校级凭证。

import { and, eq, ne } from 'drizzle-orm'
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

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    apiError(400, API_CODE.INVALID_PARAM, '班级 id 不合法')
  }
  if (!ctx.scope.isClassAllowed(id)) {
    apiError(403, API_CODE.OUT_OF_RANGE, '无权限修改该班级')
  }

  const existing = await ctx.db.select().from(classes).where(eq(classes.id, id)).get()
  if (!existing) apiError(404, API_CODE.NOT_FOUND, '班级不存在')

  const body = (await readBody(event)) as any
  const setData: Record<string, any> = {}

  let targetGradeId = Number(existing.gradeId)
  if (body?.gradeId !== undefined && body.gradeId !== null && body.gradeId !== '') {
    const gid = Number(body.gradeId)
    if (!Number.isInteger(gid) || gid <= 0) {
      apiError(400, API_CODE.INVALID_PARAM, 'gradeId 不合法')
    }
    if (gid !== targetGradeId) {
      if (ctx.token.scopeType !== 'school') {
        apiError(403, API_CODE.OUT_OF_RANGE, '仅校级范围（scopeType=school）的凭证可调整班级所属年级')
      }
      const grade = await ctx.db.select({ id: grades.id }).from(grades).where(eq(grades.id, gid)).get()
      if (!grade) apiError(404, API_CODE.NOT_FOUND, '目标年级不存在')
      targetGradeId = gid
      setData.gradeId = gid
    }
  }

  if (body?.name !== undefined) {
    const name = String(body.name ?? '').trim()
    if (!name) apiError(400, API_CODE.MISSING_PARAM, 'name 不能为空')
    if (name.length > MAX_NAME_LEN) {
      apiError(400, API_CODE.INVALID_PARAM, `name 长度不得超过 ${MAX_NAME_LEN}`)
    }
    setData.name = name
  }

  if (Object.keys(setData).length === 0) {
    apiError(400, API_CODE.MISSING_PARAM, '请至少指定 name 或 gradeId')
  }

  // 重名判定必须以「最终的年级 + 最终的名字」为准，否则转年级时会漏检
  const finalName = setData.name ?? existing.name
  const dup = await ctx.db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.gradeId, targetGradeId), eq(classes.name, finalName), ne(classes.id, id)))
    .get()
  if (dup) apiError(409, API_CODE.CONFLICT, '目标年级下已存在同名班级')

  await ctx.db.update(classes).set(setData).where(eq(classes.id, id))

  return apiOk(
    event,
    { id, name: finalName, gradeId: targetGradeId, createdAt: existing.createdAt },
    '班级已更新',
  )
})
