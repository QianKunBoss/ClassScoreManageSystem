import { eq, and, isNull } from 'drizzle-orm'
import { admins, schools } from '../../../database/schema.main'
import { grades, classes } from '../../../database/schema'
import { useMainDb } from '../../../database/db'
import { useSchoolDb } from '../../../database/db'
import { requireAdmin } from '../../../utils/auth'

// GET: 列出管理员（含所属学校/年级/班级名称）
// - 超级管理员：返回所有管理员
// - 学校管理员：返回本校的年级管理员和班级管理员
// - 年级管理员：返回本年级的班级管理员
// - 班级管理员：返回空列表
// 支持：分页(page/limit)、关键词搜索(search: 用户名/邮箱)、角色筛选(role)、状态筛选(status: active|disabled)、学校筛选(schoolId)
export default defineEventHandler(async (event) => {
  const currentAdmin = await requireAdmin(event)
  const mainDb = useMainDb()
  const query = getQuery(event) as {
    page?: string
    limit?: string
    search?: string
    role?: string
    status?: string
    schoolId?: string
    gradeId?: string
    classId?: string
  }

  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20))
  const offset = (page - 1) * limit
  const search = (query.search || '').trim().toLowerCase()
  const roleFilter = (query.role || '').trim()
  const statusFilter = (query.status || '').trim()
  const schoolFilter = query.schoolId ? Number(query.schoolId) : ''
  const gradeFilter = query.gradeId ? Number(query.gradeId) : ''
  const classFilter = query.classId ? Number(query.classId) : ''

  // 1. 查出所有管理员，同时 LEFT JOIN 学校名称
  const rawList = await mainDb
    .select({
      id: admins.id,
      username: admins.username,
      role: admins.role,
      schoolId: admins.schoolId,
      gradeId: admins.gradeId,
      classId: admins.classId,
      disabled: admins.disabled,
      email: admins.email,
      emailBoundAt: admins.emailBoundAt,
      createdAt: admins.createdAt,
      lastLogin: admins.lastLogin,
      schoolName: schools.name,
    })
    .from(admins)
    .leftJoin(schools, eq(admins.schoolId, schools.id))

  // 2. 根据当前管理员角色过滤列表
  let filteredList = rawList
  if (currentAdmin.role === 'school_admin') {
    filteredList = rawList.filter(a => a.schoolId === currentAdmin.schoolId)
  } else if (currentAdmin.role === 'grade_admin') {
    filteredList = rawList.filter(a =>
      a.schoolId === currentAdmin.schoolId && a.gradeId === currentAdmin.gradeId
    )
  } else if (currentAdmin.role === 'class_admin') {
    filteredList = []
  }
  // super_admin: 不过滤

  // 3. 关键词 / 角色 / 状态 / 学校 筛选
  if (search) {
    filteredList = filteredList.filter(a =>
      (a.username || '').toLowerCase().includes(search) ||
      (a.email || '').toLowerCase().includes(search)
    )
  }
  if (roleFilter) {
    filteredList = filteredList.filter(a => a.role === roleFilter)
  }
  if (statusFilter === 'disabled') {
    filteredList = filteredList.filter(a => a.disabled === 1)
  } else if (statusFilter === 'active') {
    filteredList = filteredList.filter(a => a.disabled !== 1)
  }
  if (schoolFilter) {
    filteredList = filteredList.filter(a => a.schoolId === schoolFilter)
  }
  if (gradeFilter) {
    filteredList = filteredList.filter(a => a.gradeId === gradeFilter)
  }
  if (classFilter) {
    filteredList = filteredList.filter(a => a.classId === classFilter)
  }

  // 4. 收集需要查学校库的管理员，按 schoolId 分组，批量查年级/班级名称
  const needLookup = filteredList.filter(
    (a: any) => a.schoolId != null && (a.gradeId != null || a.classId != null)
  )
  const schoolIdSet = new Set(needLookup.map((a: any) => a.schoolId!))

  // 注意：年级/班级 id 在每个学校库内独立自增，必须用 `${schoolId}:${id}` 复合 key，
  // 否则不同学校的同名 id 会互相覆盖，导致列表显示的年级/班级名称错乱（与详情页不一致）。
  const gradeNameMap = new Map<string, string>()
  const classNameMap = new Map<string, string>()

  for (const sid of schoolIdSet) {
    try {
      const schoolDb = await useSchoolDb(event, sid)
      const schoolGrades = await schoolDb.select().from(grades).all()
      for (const g of schoolGrades) gradeNameMap.set(`${sid}:${g.id}`, g.name)

      const schoolClasses = await schoolDb.select().from(classes).all()
      for (const c of schoolClasses) classNameMap.set(`${sid}:${c.id}`, c.name)
    } catch {
      // 学校库不存在则跳过
    }
  }

  // 5. 组装返回数据
  const enriched = filteredList.map((a: any) => ({
    id: a.id,
    username: a.username,
    role: a.role,
    schoolId: a.schoolId,
    schoolName: a.schoolName || '',
    gradeId: a.gradeId,
    gradeName: a.gradeId ? gradeNameMap.get(`${a.schoolId}:${a.gradeId}`) || '' : '',
    classId: a.classId,
    className: a.classId ? classNameMap.get(`${a.schoolId}:${a.classId}`) || '' : '',
    disabled: a.disabled ?? 0,
    email: a.email || null,
    emailBoundAt: a.emailBoundAt || null,
    createdAt: a.createdAt,
    lastLogin: a.lastLogin,
  }))

  // 6. 排序 + 分页
  enriched.sort((a: any, b: any) => a.id - b.id)
  const total = enriched.length
  const data = enriched.slice(offset, offset + limit)

  return { data, total, page, limit }
})
