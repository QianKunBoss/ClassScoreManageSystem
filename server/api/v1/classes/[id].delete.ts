// DELETE /api/v1/classes/:id?confirm=true — 删除班级
//
// scope: structure:delete（破坏性）
//
// 级联删除该班级下的全部学生、积分流水与座位数据。
// class 范围的凭证不允许删除自己所在的班级 —— 那会让凭证自身失去一切操作对象，
// 属于典型的"把梯子踢掉"操作，只应由更高层级的管理者执行。

import { eq } from 'drizzle-orm'
import { classes } from '../../../database/schema.school'
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
  assertScope(ctx.token, 'structure:delete')

  if (ctx.token.scopeType === 'class') {
    apiError(403, API_CODE.OUT_OF_RANGE, '班级范围（scopeType=class）的凭证不可删除班级')
  }

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    apiError(400, API_CODE.INVALID_PARAM, '班级 id 不合法')
  }
  if (!ctx.scope.isClassAllowed(id)) {
    apiError(403, API_CODE.OUT_OF_RANGE, '无权限删除该班级')
  }

  const query = getQuery(event) as Record<string, any>
  if (String(query.confirm ?? '') !== 'true') {
    apiError(400, API_CODE.CONFIRM_REQUIRED, '删除班级需显式携带 confirm=true')
  }

  const existing = await ctx.db.select().from(classes).where(eq(classes.id, id)).get()
  if (!existing) apiError(404, API_CODE.NOT_FOUND, '班级不存在')

  const impact = await ctx.client.execute({
    sql: 'SELECT COUNT(*) AS cnt FROM users WHERE class_id = ?',
    args: [id],
  })

  await ctx.db.delete(classes).where(eq(classes.id, id))

  return apiOk(
    event,
    {
      id,
      name: existing.name,
      gradeId: Number(existing.gradeId),
      cascadeDeleted: { students: Number((impact.rows[0] as any)?.cnt || 0) },
    },
    '班级已删除',
  )
})
