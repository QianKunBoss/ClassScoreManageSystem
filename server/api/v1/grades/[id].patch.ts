// PATCH /api/v1/grades/:id — 重命名年级
//
// scope: structure:write
// 请求体：{ name }
//
// 与创建不同，重命名不会扩大范围，因此 grade 范围的 token 也可以改自己那个年级的名字。
// class 范围的 token 不行 —— 年级不是它的管辖对象（isGradeAllowed 恒为 false）。

import { and, eq, ne } from 'drizzle-orm'
import { grades } from '../../../database/schema.school'
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
    apiError(400, API_CODE.INVALID_PARAM, '年级 id 不合法')
  }

  if (!ctx.scope.schoolWide && !ctx.scope.isGradeAllowed(id)) {
    apiError(403, API_CODE.OUT_OF_RANGE, '无权限修改该年级')
  }

  const body = (await readBody(event)) as any
  const name = String(body?.name ?? '').trim()
  if (!name) apiError(400, API_CODE.MISSING_PARAM, 'name 不能为空')
  if (name.length > MAX_NAME_LEN) {
    apiError(400, API_CODE.INVALID_PARAM, `name 长度不得超过 ${MAX_NAME_LEN}`)
  }

  const existing = await ctx.db.select().from(grades).where(eq(grades.id, id)).get()
  if (!existing) apiError(404, API_CODE.NOT_FOUND, '年级不存在')

  if (name !== existing.name) {
    const dup = await ctx.db
      .select({ id: grades.id })
      .from(grades)
      .where(and(eq(grades.name, name), ne(grades.id, id)))
      .get()
    if (dup) apiError(409, API_CODE.CONFLICT, '该年级名称已被占用')
  }

  await ctx.db.update(grades).set({ name }).where(eq(grades.id, id))

  return apiOk(event, { id, name, createdAt: existing.createdAt }, '年级已更新')
})
