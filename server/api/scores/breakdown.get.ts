import { eq } from 'drizzle-orm'
import { classes as classTable } from '../../database/schema'
import { useSchoolDb, getSchoolRawClient } from '../../database/db'
import { requireAdmin, getSchoolIdFromRequest, resolveSchoolScope } from '../../utils/auth'

/**
 * GET /api/scores/breakdown — 按作用域返回各维度（年级/班级）的总体加扣分汇总
 *
 * 供管理员总体图表的「加扣分条形图」使用。口径与排行榜 addScore/deductScore 一致：
 * 从 score_logs 实时汇总（全量，非窗口），加分=正变化合计，扣分=负变化合计（取正值）。
 *
 * 查询参数：
 *  - scope: 'school'（全校→按年级）| 'grade'（年级→按班级）| 'class'（班级→所属年级各班）
 *  - gradeId / classId：配合 scope 使用
 *
 * 返回：{ data: [{ label, add, deduct }] }，label 为年级或班级名。
 *
 * 安全：基于当前管理员真实身份解析可管理范围，不信任前端传入的 gradeId/classId。
 */
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)
  const client = await getSchoolRawClient(event, schoolId)

  const query = getQuery(event) as { scope?: string; gradeId?: string; classId?: string }
  const scope = query.scope || 'class'

  const adminScope = await resolveSchoolScope(admin, db)

  const AGG = `COALESCE(sum(CASE WHEN sl.score_change > 0 THEN sl.score_change ELSE 0 END), 0) AS add_score,
    COALESCE(sum(CASE WHEN sl.score_change < 0 THEN -sl.score_change ELSE 0 END), 0) AS deduct_score`

  let sqlText: string
  let args: any[]

  if (scope === 'school') {
    // 全校 → 按年级分组（仅学校/超级管理员）
    if (!adminScope.schoolWide) {
      throw createError({ statusCode: 403, message: '无权限查看全校统计' })
    }
    sqlText = `SELECT g.id, g.name AS label, ${AGG}
      FROM grades g
      LEFT JOIN classes c ON c.grade_id = g.id
      LEFT JOIN users u ON u.class_id = c.id
      LEFT JOIN score_logs sl ON sl.user_id = u.id
      GROUP BY g.id
      ORDER BY g.id ASC`
    args = []
  } else if (scope === 'grade') {
    // 年级 → 按班级分组
    let gid = query.gradeId ? Number(query.gradeId) : null
    if (gid == null && admin.role === 'grade_admin') gid = (admin as any).gradeId
    if (gid == null || !adminScope.isGradeAllowed(gid)) {
      throw createError({ statusCode: 403, message: '无权限查看该年级统计' })
    }
    sqlText = `SELECT c.id, c.name AS label, ${AGG}
      FROM classes c
      LEFT JOIN users u ON u.class_id = c.id
      LEFT JOIN score_logs sl ON sl.user_id = u.id
      WHERE c.grade_id = ?
      GROUP BY c.id
      ORDER BY c.id ASC`
    args = [gid]
  } else {
    // 班级 → 所属年级的各个班级分组
    let cid = query.classId ? Number(query.classId) : null
    if (cid == null && admin.role === 'class_admin') cid = (admin as any).classId
    if (cid == null || !adminScope.isClassAllowed(cid)) {
      throw createError({ statusCode: 403, message: '无权限查看该班级统计' })
    }
    const cls = await db
      .select({ gradeId: classTable.gradeId })
      .from(classTable)
      .where(eq(classTable.id, cid))
      .get()
    if (!cls || cls.gradeId == null) {
      return { data: [] }
    }
    sqlText = `SELECT c.id, c.name AS label, ${AGG}
      FROM classes c
      LEFT JOIN users u ON u.class_id = c.id
      LEFT JOIN score_logs sl ON sl.user_id = u.id
      WHERE c.grade_id = ?
      GROUP BY c.id
      ORDER BY c.id ASC`
    args = [cls.gradeId]
  }

  const res = await client.execute({ sql: sqlText, args })
  const rows = res.rows as any[]

  return {
    data: rows.map((r: any) => ({
      label: r.label || '',
      add: Number(r.add_score || 0),
      deduct: Number(r.deduct_score || 0),
    })),
  }
})
