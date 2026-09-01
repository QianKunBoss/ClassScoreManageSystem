// GET /api/v1/grades — 年级列表
//
// scope: structure:read
// 不分页：一所学校的年级数量是个位数，强行分页只是给调用方添麻烦。

import { apiOk, defineApiV1Handler } from '../../../utils/api-response'
import { assertScope } from '../../../utils/api-token'
import { useApiContext, allowedGradeIds, inClause, scopeClassIds } from '../../../utils/api-context'

export default defineApiV1Handler(async (event) => {
  const ctx = await useApiContext(event)
  assertScope(ctx.token, 'structure:read')

  const gradeIds = await allowedGradeIds(ctx)
  if (gradeIds !== null && gradeIds.length === 0) {
    return apiOk(event, { list: [], total: 0 })
  }

  const gradeIn = gradeIds === null ? null : inClause('g.id', gradeIds)
  const where = gradeIn ? `WHERE ${gradeIn.sql}` : ''
  const args = gradeIn ? gradeIn.args : []

  // class 范围的 token 能看到所属年级，但年级下的班级/学生计数只应覆盖其可见班级，
  // 否则会从计数里推算出别班的学生数量 —— 因此计数同样受 class 范围约束。
  //
  // 这里必须走 inClause：年级凭证名下暂无班级时，手拼会得到 `IN ()` —— SQLite 语法错误。
  const visibleClassIds = scopeClassIds(ctx.scope)
  const classIn = visibleClassIds === null ? null : inClause('c.id', visibleClassIds)
  const classFilter = classIn ? `AND ${classIn.sql}` : ''
  const classFilterArgs = classIn ? classIn.args : []

  const res = await ctx.client.execute({
    sql: `SELECT
        g.id, g.name, g.created_at,
        (SELECT COUNT(*) FROM classes c WHERE c.grade_id = g.id ${classFilter}) AS class_count,
        (SELECT COUNT(*) FROM users u JOIN classes c ON u.class_id = c.id
           WHERE c.grade_id = g.id ${classFilter}) AS student_count
      FROM grades g
      ${where}
      ORDER BY g.id ASC`,
    args: [...classFilterArgs, ...classFilterArgs, ...args],
  })

  const list = (res.rows as any[]).map((r) => ({
    id: Number(r.id),
    name: r.name,
    classCount: Number(r.class_count),
    studentCount: Number(r.student_count),
    createdAt: r.created_at,
  }))

  return apiOk(event, { list, total: list.length })
})
