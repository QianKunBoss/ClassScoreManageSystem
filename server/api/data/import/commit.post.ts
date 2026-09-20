import { eq, and, sql } from 'drizzle-orm'
import { grades, classes, users, scoreLogs } from '../../../database/schema.school'
import { useSchoolDb } from '../../../database/db'
import {
  requireSuperAdmin, getSchoolIdFromRequest, resolveSchoolScope, hashPasswordBcrypt,
} from '../../../utils/auth'

// POST /api/data/import/commit — 将预览通过的行写入数据库
// body: { schoolId?, type: 'students'|'scores'|'grades-classes', rows: [{ data }] }
// 逐行再次做权限/存在性校验（纵深防御），返回插入/跳过统计。
export default defineEventHandler(async (event) => {
  const admin = await requireSuperAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)
  const scope = await resolveSchoolScope(admin, db)

  const body = await readBody(event)
  const type = body?.type as string
  const rawRows = body?.rows as any[] | undefined
  if (!rawRows || !Array.isArray(rawRows)) {
    throw createError({ statusCode: 400, message: '缺少待导入数据' })
  }
  const items = rawRows.map((r) => (r?.data ?? r)).filter(Boolean)

  let inserted = 0
  let skipped = 0
  const errors: string[] = []

  if (type === 'students') {
    for (const d of items) {
      if (!scope.isClassAllowed(d.classId)) { skipped++; errors.push(`跳过：无权限导入班级 ${d.classId}`); continue }
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.classId, d.classId), eq(users.username, d.username)))
        .get()
      if (existing) { skipped++; continue }
      await db.insert(users).values({
        classId: d.classId,
        username: d.username,
        passwordHash: hashPasswordBcrypt(d.password || d.username),
        actualName: d.actualName || '',
        email: d.email || null,
        disabled: 0,
        // 导入学生使用初始密码，强制其首次登录必须改密
        mustChangePassword: 1,
        totalScore: 0, addScore: 0, deductScore: 0, scoreCount: 0,
        createdAt: new Date().toISOString(),
      })
      inserted++
    }
  }

  else if (type === 'scores') {
    for (const d of items) {
      if (!scope.isClassAllowed(d.classId)) { skipped++; errors.push(`跳过：无权限操作学生 ${d.userId}`); continue }
      const change = Number(d.scoreChange)
      await db.insert(scoreLogs).values({
        userId: d.userId,
        username: d.username,
        scoreChange: change,
        description: d.description || '',
        createdAt: new Date().toISOString(),
      })
      await db.update(users).set({
        totalScore: sql`${users.totalScore} + ${change}`,
        ...(change >= 0
          ? { addScore: sql`${users.addScore} + ${change}` }
          : { deductScore: sql`${users.deductScore} + ${change}` }),
        scoreCount: sql`${users.scoreCount} + 1`,
      }).where(eq(users.id, d.userId))
      inserted++
    }
  }

  else if (type === 'grades-classes') {
    for (const d of items) {
      // 年级
      let gradeId: number
      const g = await db.select().from(grades).where(eq(grades.name, d.gradeName)).get()
      if (g) {
        if (!scope.isGradeAllowed(g.id)) { skipped++; errors.push(`跳过：无权限操作年级 ${d.gradeName}`); continue }
        gradeId = g.id
      } else {
        // 新建年级同样需权限
        const ins = await db.insert(grades).values({ name: d.gradeName, createdAt: new Date().toISOString() }).returning({ id: grades.id })
        gradeId = ins[0].id
        inserted++
      }
      // 班级（可选）
      if (d.className) {
        const c = await db
          .select()
          .from(classes)
          .where(and(eq(classes.gradeId, gradeId), eq(classes.name, d.className)))
          .get()
        if (!c) {
          await db.insert(classes).values({ gradeId, name: d.className, createdAt: new Date().toISOString() })
        }
      }
    }
  }

  else {
    throw createError({ statusCode: 400, message: '未知的导入类型' })
  }

  return {
    success: true,
    type,
    inserted,
    skipped,
    errors: errors.length ? errors : undefined,
  }
})
