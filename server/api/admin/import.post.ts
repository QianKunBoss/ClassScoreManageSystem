import { eq, inArray, sql } from 'drizzle-orm'
import { grades, classes, users, scoreLogs } from '../../database/schema.school'
import { useSchoolDb } from '../../database/db'
import { requireAdmin, getSchoolIdFromRequest } from '../../utils/auth'

// POST /api/admin/import — 从 JSON 备份恢复数据
// body: { data: BackupJson, mode?: 'overwrite' | 'merge' }
// 当范围内已有数据且未指定 mode 时，返回 { needConfirm: true, existing }，由前端弹窗确认后再带 mode 重试
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)

  const body = await readBody(event)
  const data = body?.data ?? body
  const mode = (body?.mode as string) || ''

  if (!data || !Array.isArray(data.users) || !Array.isArray(data.scoreLogs)) {
    throw createError({ statusCode: 400, statusMessage: '无效的备份文件：缺少 users 或 scoreLogs 数据' })
  }

  const backupGrades = (data.grades || []) as any[]
  const backupClasses = (data.classes || []) as any[]
  const backupUsers = data.users as any[]
  const backupLogs = data.scoreLogs as any[]

  const role = admin.role

  // ===== 确定恢复范围：以备份 meta 为准（含权限校验） =====
  const meta = data.meta || {}
  const metaScope = meta.scope as 'school' | 'grade' | 'class' | undefined
  const metaGradeId = meta.gradeId != null ? Number(meta.gradeId) : null
  const metaClassId = meta.classId != null ? Number(meta.classId) : null

  let gradeIds: number[] | null = null
  let classIds: number[] | null = null

  if (role === 'class_admin') {
    // 只能恢复本班
    classIds = admin.classId != null ? [admin.classId] : null
  } else if (role === 'grade_admin') {
    // 只能恢复本年级，或本年级下的某个班级（以备份 meta 为准）
    if (metaScope === 'class' && metaClassId != null) {
      const cls = await db.select().from(classes).where(eq(classes.id, metaClassId)).get()
      if (!cls || cls.gradeId !== admin.gradeId) {
        throw createError({ statusCode: 403, statusMessage: '备份文件中的班级不属于你的年级' })
      }
      classIds = [metaClassId]
    } else {
      gradeIds = admin.gradeId != null ? [admin.gradeId] : null
    }
  } else {
    // school_admin / super_admin：以备份 meta 为准
    if (metaScope === 'class' && metaClassId != null) {
      classIds = [metaClassId]
    } else if (metaScope === 'grade' && metaGradeId != null) {
      gradeIds = [metaGradeId]
    }
    // 否则 null = 全校
  }

  // 范围内班级 id 列表
  let scopeClassIds: number[] | null = null
  if (classIds) {
    scopeClassIds = classIds
  } else if (gradeIds) {
    const cls = await db.select({ id: classes.id }).from(classes).where(inArray(classes.gradeId, gradeIds))
    scopeClassIds = cls.map(c => c.id)
  } else {
    const cls = await db.select({ id: classes.id }).from(classes)
    scopeClassIds = cls.map(c => c.id)
  }

  // ===== 统计范围内现有数据量 =====
  let existingUsers = 0
  let existingLogs = 0
  if (scopeClassIds && scopeClassIds.length) {
    existingUsers = (await db
      .select({ c: sql<number>`count(*)` })
      .from(users)
      .where(inArray(users.classId, scopeClassIds))
      .get())?.c || 0
  }
  if (scopeClassIds && scopeClassIds.length) {
    const uids = (await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.classId, scopeClassIds))).map(u => u.id)
    if (uids.length) {
      existingLogs = (await db
        .select({ c: sql<number>`count(*)` })
        .from(scoreLogs)
        .where(inArray(scoreLogs.userId, uids))
        .get())?.c || 0
    }
  }

  // 范围内非空且未指定 mode → 让前端确认
  if (!mode && (existingUsers > 0 || existingLogs > 0)) {
    return { needConfirm: true, existing: { users: existingUsers, logs: existingLogs } }
  }

  const effectiveMode = mode || 'overwrite'

  if (effectiveMode === 'overwrite') {
    await doOverwrite(db, gradeIds, classIds, backupGrades, backupClasses, backupUsers, backupLogs)
  } else {
    await doMerge(db, backupGrades, backupClasses, backupUsers, backupLogs)
  }

  return {
    success: true,
    mode: effectiveMode,
    imported: { grades: backupGrades.length, classes: backupClasses.length, users: backupUsers.length, logs: backupLogs.length },
  }
})

// ===== overwrite：清空范围内数据，用备份重建 =====
async function doOverwrite(db: any, gradeIds: number[] | null, classIds: number[] | null, bg: any[], bc: any[], bu: any[], bl: any[]) {
  // 1. 清空（范围由 gradeIds/classIds 决定）
  if (classIds) {
    await db.delete(users).where(inArray(users.classId, classIds))
  } else if (gradeIds) {
    await db.delete(classes).where(inArray(classes.gradeId, gradeIds))
  } else {
    await db.delete(grades)
  }

  // 2. 重建（保留原 ID，保证外键引用一致）
  if (bg.length) {
    await db.insert(grades).values(bg.map(g => pick(g, ['id', 'name', 'createdAt'])))
  }
  if (bc.length) {
    await db.insert(classes).values(bc.map(c => pick(c, ['id', 'gradeId', 'name', 'createdAt'])))
  }
  if (bu.length) {
    await db.insert(users).values(bu.map(u => pick(u, ['id', 'classId', 'username', 'passwordHash', 'actualName', 'totalScore', 'addScore', 'deductScore', 'scoreCount', 'createdAt'])))
  }
  if (bl.length) {
    await db.insert(scoreLogs).values(bl.map(l => pick(l, ['id', 'userId', 'username', 'scoreChange', 'description', 'createdAt'])))
  }
}

// ===== merge：按业务键查重，跳过已存在，插入缺失 =====
async function doMerge(db: any, bg: any[], bc: any[], bu: any[], bl: any[]) {
  // 现有 grades / classes / users（全校范围内，供查重）
  const existingGrades = await db.select().from(grades)
  const existingClasses = await db.select().from(classes)
  const existingUsers = await db.select().from(users)

  const gradeNameSet = new Set(existingGrades.map(g => g.name))
  const classKeySet = new Set(existingClasses.map(c => `${c.gradeId}:${c.name}`))
  const userKeySet = new Set(existingUsers.map(u => `${u.classId}:${u.username}`))

  // id 映射：备份 id → 实际 id
  const gradeIdMap = new Map<number, number>()
  const classIdMap = new Map<number, number>()
  const userIdMap = new Map<number, number>()

  // 1. grades
  for (const g of bg) {
    if (gradeNameSet.has(g.name)) {
      const existing = existingGrades.find(e => e.name === g.name)
      if (existing) gradeIdMap.set(g.id, existing.id)
      continue
    }
    const inserted = await db.insert(grades).values(pick(g, ['name', 'createdAt'])).returning({ id: grades.id })
    const newId = inserted[0]?.id
    gradeIdMap.set(g.id, newId)
    gradeNameSet.add(g.name)
  }

  // 2. classes（gradeId 用映射）
  for (const c of bc) {
    const gid = gradeIdMap.get(c.gradeId) ?? c.gradeId
    const key = `${gid}:${c.name}`
    if (classKeySet.has(key)) {
      const existing = existingClasses.find(e => e.gradeId === gid && e.name === c.name)
      if (existing) classIdMap.set(c.id, existing.id)
      continue
    }
    const inserted = await db.insert(classes).values({ gradeId: gid, name: c.name, createdAt: c.createdAt }).returning({ id: classes.id })
    const newId = inserted[0]?.id
    classIdMap.set(c.id, newId)
    classKeySet.add(key)
  }

  // 3. users（classId 用映射）
  for (const u of bu) {
    const cid = classIdMap.get(u.classId) ?? u.classId
    const key = `${cid}:${u.username}`
    if (userKeySet.has(key)) {
      const existing = existingUsers.find(e => e.classId === cid && e.username === u.username)
      if (existing) userIdMap.set(u.id, existing.id)
      continue
    }
    const inserted = await db.insert(users).values({
      classId: cid,
      username: u.username,
      passwordHash: u.passwordHash,
      actualName: u.actualName,
      totalScore: u.totalScore ?? 0,
      addScore: u.addScore ?? 0,
      deductScore: u.deductScore ?? 0,
      scoreCount: u.scoreCount ?? 0,
      createdAt: u.createdAt,
    }).returning({ id: users.id })
    const newId = inserted[0]?.id
    userIdMap.set(u.id, newId)
    userKeySet.add(key)
  }

  // 4. score_logs（userId 用映射；按 (userId, scoreChange, description, createdAt) 近似查重）
  const existingLogs = await db.select().from(scoreLogs)
  const logKeySet = new Set(existingLogs.map(l => `${l.userId}|${l.scoreChange}|${l.description ?? ''}|${l.createdAt}`))
  const logsToInsert: any[] = []
  for (const l of bl) {
    const uid = userIdMap.get(l.userId) ?? l.userId
    const key = `${uid}|${l.scoreChange}|${l.description ?? ''}|${l.createdAt}`
    if (logKeySet.has(key)) continue
    logsToInsert.push({
      userId: uid,
      username: l.username,
      scoreChange: l.scoreChange,
      description: l.description,
      createdAt: l.createdAt,
    })
    logKeySet.add(key)
  }
  if (logsToInsert.length) {
    await db.insert(scoreLogs).values(logsToInsert)
  }
}

// 从对象中挑出指定字段
function pick(obj: any, keys: string[]) {
  const out: any = {}
  for (const k of keys) {
    if (obj && obj[k] !== undefined) out[k] = obj[k]
  }
  return out
}
