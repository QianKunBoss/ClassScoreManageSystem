// DELETE /api/v1/grades/:id?confirm=true — 删除年级
//
// scope: structure:delete（破坏性）
//
// 【影响范围】外键 ON DELETE CASCADE 会一并删除该年级下的全部班级、学生、
// 积分流水与座位数据。这是整个开放 API 里破坏力最大的一个操作，因此叠加三重门槛：
//   1. 独立的 structure:delete scope（签发时默认不勾选）；
//   2. 仅 school 范围凭证可调用；
//   3. 强制 confirm=true。
// 响应里回传将被级联删除的规模，便于调用方在日志中留证。

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

export default defineApiV1Handler(async (event) => {
  const ctx = await useApiContext(event)
  assertScope(ctx.token, 'structure:delete')

  if (ctx.token.scopeType !== 'school') {
    apiError(403, API_CODE.OUT_OF_RANGE, '仅校级范围（scopeType=school）的凭证可删除年级')
  }

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    apiError(400, API_CODE.INVALID_PARAM, '年级 id 不合法')
  }

  const query = getQuery(event) as Record<string, any>
  if (String(query.confirm ?? '') !== 'true') {
    apiError(400, API_CODE.CONFIRM_REQUIRED, '删除年级需显式携带 confirm=true')
  }

  const existing = await ctx.db.select().from(grades).where(eq(grades.id, id)).get()
  if (!existing) apiError(404, API_CODE.NOT_FOUND, '年级不存在')

  // 先统计级联影响，删除后就查不到了
  const impact = await ctx.client.execute({
    sql: `SELECT
        (SELECT COUNT(*) FROM classes WHERE grade_id = ?) AS class_count,
        (SELECT COUNT(*) FROM users u JOIN classes c ON u.class_id = c.id WHERE c.grade_id = ?) AS student_count`,
    args: [id, id],
  })
  const row = impact.rows[0] as any

  await ctx.db.delete(grades).where(eq(grades.id, id))

  return apiOk(
    event,
    {
      id,
      name: existing.name,
      cascadeDeleted: {
        classes: Number(row?.class_count || 0),
        students: Number(row?.student_count || 0),
      },
    },
    '年级已删除',
  )
})
