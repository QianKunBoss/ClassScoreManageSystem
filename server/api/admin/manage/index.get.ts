import { eq, and, isNull, inArray } from 'drizzle-orm'
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
export default defineEventHandler(async (event) => {
  const currentAdmin = await requireAdmin(event)
  const mainDb = useMainDb()

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
      createdAt: admins.createdAt,
      lastLogin: admins.lastLogin,
      schoolName: schools.name,
    })
    .from(admins)
    .leftJoin(schools, eq(admins.schoolId, schools.id))

  // 2. 根据当前管理员角色过滤列表
  let filteredList = rawList
  if (currentAdmin.role === 'school_admin') {
    // 学校管理员：只能看到本校的管理员（学校管理员、年级管理员、班级管理员）
    filteredList = rawList.filter(a => a.schoolId === currentAdmin.schoolId)
  } else if (currentAdmin.role === 'grade_admin') {
    // 年级管理员：只能看到本年级的班级管理员
    filteredList = rawList.filter(a =>
      a.schoolId === currentAdmin.schoolId && a.gradeId === currentAdmin.gradeId
    )
  } else if (currentAdmin.role === 'class_admin') {
    // 班级管理员：无权查看其他管理员
    filteredList = []
  }
  // super_admin: 不过滤，看到所有

  // 3. 收集需要查学校库的管理员，按 schoolId 分组
  const needLookup = filteredList.filter(
    (a: any) => a.schoolId != null && (a.gradeId != null || a.classId != null)
  )
  const schoolIdSet = new Set(needLookup.map((a: any) => a.schoolId!))

  // 4. 批量查各学校库的 grades / classes
  const gradeNameMap = new Map<number, string>()
  const classNameMap = new Map<number, string>()

  for (const sid of schoolIdSet) {
    try {
      const schoolDb = await useSchoolDb(event, sid)
      const schoolGrades = await schoolDb.select().from(grades).all()
      for (const g of schoolGrades) gradeNameMap.set(g.id, g.name)

      const schoolClasses = await schoolDb.select().from(classes).all()
      for (const c of schoolClasses) classNameMap.set(c.id, c.name)
    } catch {
      // 学校库不存在则跳过
    }
  }

  // 5. 组装返回数据
  const data = filteredList.map((a: any) => ({
    id: a.id,
    username: a.username,
    role: a.role,
    schoolId: a.schoolId,
    schoolName: a.schoolName || '',
    gradeId: a.gradeId,
    gradeName: a.gradeId ? gradeNameMap.get(a.gradeId) || '' : '',
    classId: a.classId,
    className: a.classId ? classNameMap.get(a.classId) || '' : '',
    disabled: a.disabled ?? 0,
    createdAt: a.createdAt,
    lastLogin: a.lastLogin,
  }))

  return { data }
})
