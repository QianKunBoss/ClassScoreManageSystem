// DELETE /api/v1/templates/:id — 删除积分模板
//
// scope: templates:write
//
// 【为何不需要 confirm】删除模板不影响任何已产生的积分流水（模板只是录入时的快捷方式），
// 也不会级联删除任何数据，属于可低成本重建的配置项。因此不叠加确认门槛，
// 与 students / structure 的删除刻意区别对待 —— 门槛应当与破坏力匹配，
// 到处加确认只会让调用方养成无脑带 confirm 的习惯，反而削弱真正危险操作的防护。

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
      apiError(403, API_CODE.OUT_OF_RANGE, '仅校级范围（scopeType=school）的凭证可删除全校通用模板')
    }
  } else if (!ctx.scope.isClassAllowed(Number(existing.classId))) {
    apiError(403, API_CODE.OUT_OF_RANGE, '无权限删除该班级的模板')
  }

  await ctx.db.delete(scoreTemplates).where(eq(scoreTemplates.id, id))

  return apiOk(event, { id, name: existing.name }, '模板已删除')
})
