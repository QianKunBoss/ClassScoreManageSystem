// POST /api/v1/grades — 创建年级
//
// scope: structure:write
// 请求体：{ name }
//
// 【范围约束】年级属于校级组织结构，只有 school 范围的 token 能新建。
// grade / class 范围的 token 新建年级等于自我扩权 —— 它会立刻拥有一个
// 范围之外的新年级，因此必须拒绝。这条约束在端点内硬编码，不依赖 scope 列表。

import { eq } from 'drizzle-orm'
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

  if (ctx.token.scopeType !== 'school') {
    apiError(403, API_CODE.OUT_OF_RANGE, '仅校级范围（scopeType=school）的凭证可创建年级')
  }

  const body = (await readBody(event)) as any
  const name = String(body?.name ?? '').trim()
  if (!name) apiError(400, API_CODE.MISSING_PARAM, 'name 不能为空')
  if (name.length > MAX_NAME_LEN) {
    apiError(400, API_CODE.INVALID_PARAM, `name 长度不得超过 ${MAX_NAME_LEN}`)
  }

  const dup = await ctx.db.select({ id: grades.id }).from(grades).where(eq(grades.name, name)).get()
  if (dup) apiError(409, API_CODE.CONFLICT, '该年级已存在')

  const [created] = await ctx.db.insert(grades).values({ name }).returning().all()

  return apiOk(
    event,
    { id: Number(created.id), name: created.name, createdAt: created.createdAt },
    '年级创建成功',
  )
})
