import fs from 'fs'
import path from 'path'
import { schools } from '../../../database/schema.main'
import { useMainDb, getSchoolRawClient } from '../../../database/db'
import { requireSuperAdmin } from '../../../utils/auth'

// GET /api/admin/students — 超级管理员跨校学生列表（带学校 / 年级 / 班级筛选）
// 支持：分页(page/limit)、关键词搜索(search: 用户名/姓名/邮箱)、状态筛选(status: active|disabled)、
//       学校筛选(schoolId)、年级筛选(gradeId)、班级筛选(classId)
export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const mainDb = useMainDb()
  const query = getQuery(event) as {
    page?: string
    limit?: string
    search?: string
    status?: string
    schoolId?: string
    gradeId?: string
    classId?: string
  }

  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20))
  const offset = (page - 1) * limit
  const search = (query.search || '').trim().toLowerCase()
  const statusFilter = (query.status || '').trim()
  const schoolFilter = query.schoolId ? Number(query.schoolId) : ''
  const gradeFilter = query.gradeId ? Number(query.gradeId) : ''
  const classFilter = query.classId ? Number(query.classId) : ''

  const allSchools = await mainDb
    .select({ id: schools.id, name: schools.name })
    .from(schools)

  const schoolsDir = path.join(process.cwd(), 'data', 'schools')
  const rows: any[] = []

  for (const sc of allSchools) {
    if (schoolFilter && sc.id !== schoolFilter) continue
    const dbPath = path.join(schoolsDir, `${sc.id}.db`)
    if (!fs.existsSync(dbPath)) continue // 学校库不存在则跳过，避免误创建
    try {
      const client = await getSchoolRawClient(event, sc.id)
      let sql = `SELECT u.id, u.username, u.actual_name, u.email, u.email_bound_at, u.disabled,
                        u.class_id, u.created_at,
                        c.name AS class_name, c.grade_id AS grade_id,
                        g.name AS grade_name
                 FROM users u
                 LEFT JOIN classes c ON u.class_id = c.id
                 LEFT JOIN grades g ON c.grade_id = g.id`
      const where: string[] = []
      const args: any[] = []
      if (gradeFilter) { where.push('c.grade_id = ?'); args.push(gradeFilter) }
      if (classFilter) { where.push('u.class_id = ?'); args.push(classFilter) }
      if (where.length) sql += ' WHERE ' + where.join(' AND ')
      sql += ' ORDER BY u.username'
      const result = await client.execute({ sql, args })
      for (const r of result.rows) {
        rows.push({
          id: r.id,
          schoolId: sc.id,
          schoolName: sc.name,
          username: r.username,
          actualName: r.actual_name || '',
          email: r.email || '',
          emailBoundAt: r.email_bound_at || null,
          disabled: r.disabled ?? 0,
          classId: r.class_id || null,
          className: r.class_name || '',
          gradeId: r.grade_id || null,
          gradeName: r.grade_name || '',
          createdAt: r.created_at,
        })
      }
    } catch {
      // 学校库读取失败则跳过
    }
  }

  // 关键词过滤（用户名 / 姓名 / 邮箱）
  let filtered = rows
  if (search) {
    filtered = filtered.filter(u =>
      (u.username || '').toLowerCase().includes(search) ||
      (u.actualName || '').toLowerCase().includes(search) ||
      (u.email || '').toLowerCase().includes(search)
    )
  }
  if (statusFilter === 'disabled') {
    filtered = filtered.filter(u => u.disabled === 1)
  } else if (statusFilter === 'active') {
    filtered = filtered.filter(u => u.disabled !== 1)
  }

  // 排序：学校 -> 年级 -> 班级 -> 用户名
  filtered.sort((a: any, b: any) =>
    a.schoolId - b.schoolId ||
    (a.gradeName || '').localeCompare(b.gradeName || '') ||
    (a.className || '').localeCompare(b.className || '') ||
    (a.username || '').localeCompare(b.username || '')
  )

  const total = filtered.length
  const data = filtered.slice(offset, offset + limit)

  return { data, total, page, limit }
})
