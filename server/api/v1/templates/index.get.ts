// GET /api/v1/templates — 积分模板列表
//
// scope: templates:read
// 参数：classId?（可选筛选）
//
// class_id 为 NULL 的模板是全校通用模板，对任何范围的 token 均可见 ——
// 它本就适用于全部班级，隐藏它反而会让调用方拿不到常用的加减分项。

import { apiOk, defineApiV1Handler } from '../../../utils/api-response'
import { assertScope } from '../../../utils/api-token'
import { useApiContext } from '../../../utils/api-context'

export default defineApiV1Handler(async (event) => {
  const ctx = await useApiContext(event)
  assertScope(ctx.token, 'templates:read')

  const query = getQuery(event) as Record<string, any>

  const where: string[] = []
  const args: any[] = []

  if (!ctx.scope.schoolWide) {
    const ids = Array.from((ctx.scope.classIdSet as Set<number>) || []).map(Number)
    if (ids.length === 0) {
      where.push('t.class_id IS NULL')
    } else {
      where.push(`(t.class_id IS NULL OR t.class_id IN (${ids.map(() => '?').join(',')}))`)
      args.push(...ids)
    }
  }

  if (query.classId !== undefined && query.classId !== '') {
    // 显式指定班级时同时带上通用模板，与管理端"某班可用模板"的语义一致
    where.push('(t.class_id = ? OR t.class_id IS NULL)')
    args.push(Number(query.classId))
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const res = await ctx.client.execute({
    sql: `SELECT t.id, t.class_id, t.name, t.score_change, t.description, t.created_at, t.updated_at,
        c.name AS class_name
      FROM score_templates t
      LEFT JOIN classes c ON t.class_id = c.id
      ${whereSql}
      ORDER BY t.class_id IS NULL DESC, t.id ASC`,
    args,
  })

  const list = (res.rows as any[]).map((r) => ({
    id: Number(r.id),
    classId: r.class_id == null ? null : Number(r.class_id),
    className: r.class_name || '',
    /** classId 为 null 时表示全校通用 */
    global: r.class_id == null,
    name: r.name,
    scoreChange: Number(r.score_change),
    description: r.description || '',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))

  return apiOk(event, { list, total: list.length })
})
