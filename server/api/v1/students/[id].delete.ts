// DELETE /api/v1/students/:id?confirm=true — 删除学生
//
// scope: students:delete（破坏性，签发 token 时默认不勾选）
//
// 【必须显式确认】删除会级联带走该学生的全部积分流水与座位数据，不可恢复。
// 内部管理端用"二次输入密码"防误触，外部 API 没有交互界面，改用强制 confirm=true ——
// 目的相同：让删除无法因为一次手误的 DELETE 请求而发生。

import { eq } from 'drizzle-orm'
import { users } from '../../../database/schema.school'
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
  assertScope(ctx.token, 'students:delete')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    apiError(400, API_CODE.INVALID_PARAM, '学生 id 不合法')
  }

  const query = getQuery(event) as Record<string, any>
  if (String(query.confirm ?? '') !== 'true') {
    apiError(400, API_CODE.CONFIRM_REQUIRED, '删除操作需显式携带 confirm=true')
  }

  const existing = await ctx.db.select().from(users).where(eq(users.id, id)).get()
  if (!existing) {
    apiError(404, API_CODE.NOT_FOUND, '学生不存在')
  }
  if (!ctx.scope.isClassAllowed(Number(existing.classId))) {
    apiError(403, API_CODE.OUT_OF_RANGE, '无权限删除该学生')
  }

  await ctx.db.delete(users).where(eq(users.id, id))

  return apiOk(
    event,
    { id, username: existing.username, classId: existing.classId },
    '学生已删除',
  )
})
