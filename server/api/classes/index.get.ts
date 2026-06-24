import { classes, grades } from '../../database/schema'
import { useSchoolDb, getSchoolRawClient } from '../../database/db'
import { requireAdmin, getSchoolIdFromRequest } from '../../utils/auth'
import { eq } from 'drizzle-orm'

// GET /api/classes — 获取班级列表（学校库）
// 支持 ?gradeId= 筛选
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)
  const client = await getSchoolRawClient(event, schoolId)

  const query = getQuery(event) as { gradeId?: string }

  if (query.gradeId) {
    // 指定年级：用 Drizzle ORM 查
    const gradeId = Number(query.gradeId)
    const rows = await db
      .select()
      .from(classes)
      .where(eq(classes.gradeId, gradeId))
      .orderBy(classes.id)

    // 同时查年级名
    const grade = await db.select({ name: grades.name }).from(grades).where(eq(grades.id, gradeId)).get()

    return {
      success: true,
      data: rows.map((c: any) => ({
        id: c.id,
        name: c.name,
        gradeId: c.gradeId,
        gradeName: grade?.name || '',
      })),
    }
  }

  // 查所有班级（含年级名，raw SQL JOIN）
  // 注意：raw SQL 返回 snake_case，需要手动转为 camelCase 保持接口一致
  const result = await client.execute({
    sql: `SELECT c.id, c.name, c.grade_id, g.name AS grade_name
          FROM classes c
          LEFT JOIN grades g ON c.grade_id = g.id
          ORDER BY c.id`,
    args: [],
  })

  const data = (result.rows as any[]).map((row: any) => ({
    id: row.id,
    name: row.name,
    gradeId: row.grade_id,
    gradeName: row.grade_name || '',
  }))

  return { success: true, data }
})
