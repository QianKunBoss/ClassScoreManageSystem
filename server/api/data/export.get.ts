import { eq, sql } from 'drizzle-orm'
import { useMainDb, getSchoolRawClient } from '../../database/db'
import { schools, admins, applications, announcements } from '../../database/schema.main'
import { requireSuperAdmin, getSchoolIdFromRequest } from '../../utils/auth'
import { toCsv } from '../../utils/csv'

// GET /api/data/export — 按需导出 CSV（超管可跨校 / 校管仅本校）
// query: type=students|scores|grades-classes|admins|applications|announcements|schools, schoolId?
const TYPES = ['students', 'scores', 'grades-classes', 'admins', 'applications', 'announcements', 'schools']

export default defineEventHandler(async (event) => {
  const admin = await requireSuperAdmin(event)
  const isSuper = admin.role === 'super_admin'
  const mainDb = useMainDb()
  const query = getQuery(event)
  const type = (query.type as string) || 'students'
  if (!TYPES.includes(type)) throw createError({ statusCode: 400, message: '未知导出类型' })

  const sid = await getSchoolIdFromRequest(event)
  let schoolList: { id: number; name: string }[] = []
  if (isSuper) {
    const q = query.schoolId ? eq(schools.id, Number(query.schoolId)) : undefined
    const sel = mainDb.select({ id: schools.id, name: schools.name }).from(schools)
    schoolList = (q ? await sel.where(q) : await sel) as any
  } else {
    const s = await mainDb.select({ id: schools.id, name: schools.name }).from(schools).where(eq(schools.id, sid)).get()
    if (s) schoolList = [s as any]
  }

  let headers: string[] = []
  let rows: unknown[][] = []

  if (type === 'students') {
    headers = ['学校', '年级', '班级', '账号', '姓名', '邮箱', '状态', '总分', '加分', '扣分', '积分次数', '注册时间']
    for (const sc of schoolList) {
      const client = await getSchoolRawClient(event, sc.id)
      const res = await client.execute(`SELECT g.name as gradeName, c.name as className, u.username, u.actual_name as actualName,
        u.email, u.disabled, u.total_score, u.add_score, u.deduct_score, u.score_count, u.created_at
        FROM users u LEFT JOIN classes c ON u.class_id=c.id LEFT JOIN grades g ON c.grade_id=g.id`)
      for (const r of res.rows as any[]) {
        rows.push([sc.name, r.gradeName || '', r.className || '', r.username, r.actualName || '', r.email || '',
          r.disabled === 1 ? '已封禁' : '正常', r.total_score, r.add_score, r.deduct_score, r.score_count, r.created_at])
      }
    }
  } else if (type === 'scores') {
    headers = ['学校', '账号', '分值', '说明', '时间']
    for (const sc of schoolList) {
      const client = await getSchoolRawClient(event, sc.id)
      const res = await client.execute(`SELECT username, score_change as scoreChange, description, created_at FROM score_logs ORDER BY created_at DESC`)
      for (const r of res.rows as any[]) rows.push([sc.name, r.username, r.scoreChange, r.description || '', r.created_at])
    }
  } else if (type === 'grades-classes') {
    headers = ['学校', '年级', '班级']
    for (const sc of schoolList) {
      const client = await getSchoolRawClient(event, sc.id)
      const res = await client.execute(`SELECT g.name as gradeName, c.name as className FROM classes c JOIN grades g ON c.grade_id=g.id ORDER BY g.name, c.name`)
      for (const r of res.rows as any[]) rows.push([sc.name, r.gradeName, r.className])
    }
  } else if (type === 'admins') {
    headers = ['账号', '角色', '学校ID', '状态', '邮箱', '创建时间', '最近登录']
    const sel = mainDb.select({
      username: admins.username, role: admins.role, schoolId: admins.schoolId, disabled: admins.disabled,
      email: admins.email, createdAt: admins.createdAt, lastLogin: admins.lastLogin,
    }).from(admins)
    const targetSchool = isSuper && query.schoolId ? Number(query.schoolId) : sid
    const list = (isSuper && !query.schoolId ? await sel : await sel.where(eq(admins.schoolId, targetSchool))) as any
    for (const a of list) rows.push([a.username, a.role, a.schoolId ?? '', a.disabled === 1 ? '已封禁' : '正常', a.email || '', a.createdAt, a.lastLogin || ''])
  } else if (type === 'applications') {
    headers = ['学校', '申请人', '年级', '班级', '联系电话', '状态', '创建时间']
    const sel = mainDb.select({
      schoolName: sql<string>`(SELECT name FROM schools WHERE id = ${applications.createdSchoolId})`,
      applicantName: applications.applicantName, gradeName: applications.gradeName, className: applications.className,
      contactPhone: applications.contactPhone, status: applications.status, createdAt: applications.createdAt,
    }).from(applications)
    const targetSchool = isSuper && query.schoolId ? Number(query.schoolId) : sid
    const list = (isSuper && !query.schoolId ? await sel : await sel.where(eq(applications.createdSchoolId, targetSchool))) as any
    for (const a of list) rows.push([a.schoolName || '', a.applicantName, a.gradeName || '', a.className || '', a.contactPhone || '', a.status, a.createdAt])
  } else if (type === 'announcements') {
    headers = ['标题', '类型', '状态', '创建时间', '更新时间']
    const list = await mainDb.select({
      title: announcements.title, type: announcements.type, active: announcements.active,
      createdAt: announcements.createdAt, updatedAt: announcements.updatedAt,
    }).from(announcements) as any
    for (const a of list) rows.push([a.title, a.type, a.active === 1 ? '启用' : '禁用', a.createdAt, a.updatedAt || ''])
  } else if (type === 'schools') {
    headers = ['ID', '名称', '状态', '创建时间']
    const list = (isSuper && !query.schoolId ? await mainDb.select().from(schools) : await mainDb.select().from(schools).where(eq(schools.id, sid))) as any
    for (const s of list) rows.push([s.id, s.name, s.disabled === 1 ? '已封禁' : '正常', s.createdAt])
  }

  const csv = toCsv(headers, rows)
  const date = new Date().toISOString().slice(0, 10)
  setResponseHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="classfire-export-${type}-${date}.csv"`)
  return csv
})
