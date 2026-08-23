import { eq, inArray } from 'drizzle-orm'
import { grades, classes, users, scoreLogs } from '../../database/schema.school'
import { useSchoolDb } from '../../database/db'
import { requireAdmin, getSchoolIdFromRequest } from '../../utils/auth'

// GET /api/admin/export — 按指定范围导出数据（备份，JSON）
// query: scope=all|grade|class, gradeId, classId
// 范围能力：
//   class_admin  → 仅本班
//   grade_admin  → 本年级，或本年级下的某个班级
//   school_admin / super_admin → 全校 / 某年级 / 某班级
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)

  const role = admin.role
  const query = getQuery(event)
  const scopeParam = (query.scope as string) || ''
  const gradeIdParam = query.gradeId ? Number(query.gradeId) : null
  const classIdParam = query.classId ? Number(query.classId) : null

  // ===== 1. 确定范围（含权限校验） =====
  let gradeIds: number[] | null = null
  let classIds: number[] | null = null
  let scopeLabel: 'school' | 'grade' | 'class' = 'school'
  let scopeGradeId: number | null = null
  let scopeClassId: number | null = null

  if (role === 'class_admin') {
    classIds = admin.classId != null ? [admin.classId] : null
    scopeLabel = 'class'
    scopeClassId = admin.classId ?? null
  } else if (role === 'grade_admin') {
    if (scopeParam === 'class' && classIdParam != null) {
      const cls = await db.select().from(classes).where(eq(classes.id, classIdParam)).get()
      if (!cls || cls.gradeId !== admin.gradeId) {
        throw createError({ statusCode: 403, statusMessage: '只能导出本年级下的班级' })
      }
      classIds = [classIdParam]
      scopeLabel = 'class'
      scopeClassId = classIdParam
    } else {
      gradeIds = admin.gradeId != null ? [admin.gradeId] : null
      scopeLabel = 'grade'
      scopeGradeId = admin.gradeId ?? null
    }
  } else {
    // school_admin / super_admin
    if (scopeParam === 'class' && classIdParam != null) {
      const cls = await db.select().from(classes).where(eq(classes.id, classIdParam)).get()
      if (!cls) throw createError({ statusCode: 404, statusMessage: '班级不存在' })
      classIds = [classIdParam]
      scopeLabel = 'class'
      scopeClassId = classIdParam
    } else if (scopeParam === 'grade' && gradeIdParam != null) {
      const g = await db.select().from(grades).where(eq(grades.id, gradeIdParam)).get()
      if (!g) throw createError({ statusCode: 404, statusMessage: '年级不存在' })
      gradeIds = [gradeIdParam]
      scopeLabel = 'grade'
      scopeGradeId = gradeIdParam
    } else {
      scopeLabel = 'school'
    }
  }

  // ===== 2. 查询 grades =====
  let gradesData: any[] = []
  if (gradeIds) {
    gradesData = await db.select().from(grades).where(inArray(grades.id, gradeIds))
  } else if (classIds) {
    const cls = await db.select({ gradeId: classes.gradeId }).from(classes).where(inArray(classes.id, classIds))
    const gids = [...new Set(cls.map(c => c.gradeId))]
    if (gids.length) gradesData = await db.select().from(grades).where(inArray(grades.id, gids))
  } else {
    gradesData = await db.select().from(grades)
  }

  // ===== 3. 查询 classes =====
  let classesData: any[] = []
  if (classIds) {
    classesData = await db.select().from(classes).where(inArray(classes.id, classIds))
  } else if (gradeIds) {
    classesData = await db.select().from(classes).where(inArray(classes.gradeId, gradeIds))
  } else {
    classesData = await db.select().from(classes)
  }

  // ===== 4. 查询 users（范围内班级） =====
  let userClassIds: number[] | null = null
  if (classIds) {
    userClassIds = classIds
  } else if (gradeIds) {
    userClassIds = classesData.map(c => c.id)
  }

  let usersData: any[] = []
  if (userClassIds && userClassIds.length) {
    usersData = await db.select().from(users).where(inArray(users.classId, userClassIds))
  } else if (!userClassIds) {
    usersData = await db.select().from(users)
  }

  // ===== 5. 查询 score_logs（范围内用户） =====
  const userIds = usersData.map(u => u.id)
  let logsData: any[] = []
  if (userIds.length) {
    logsData = await db.select().from(scoreLogs).where(inArray(scoreLogs.userId, userIds))
  }

  // ===== 6. 统计摘要（派生，仅供查看；导入时忽略） =====
  const scores = usersData.map(u => u.totalScore ?? 0)
  const totalScore = scores.reduce((s, v) => s + v, 0)
  const summary = {
    userCount: usersData.length,
    logCount: logsData.length,
    totalScore,
    avgScore: scores.length ? Math.round(totalScore / scores.length) : 0,
    maxScore: scores.length ? Math.max(...scores) : 0,
    minScore: scores.length ? Math.min(...scores) : 0,
  }

  return {
    meta: {
      version: 1,
      exportedAt: new Date().toISOString(),
      schoolId,
      scope: scopeLabel,
      gradeId: scopeGradeId,
      classId: scopeClassId,
    },
    grades: gradesData,
    classes: classesData,
    users: usersData,
    scoreLogs: logsData,
    summary,
  }
})
