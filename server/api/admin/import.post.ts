import { eq, inArray, sql } from 'drizzle-orm'
import { grades, classes, users, scoreLogs } from '../../database/schema.school'
import { useSchoolDb } from '../../database/db'
import { requireAdmin, getSchoolIdFromRequest, resolveSchoolScope } from '../../utils/auth'

// POST /api/admin/import — 从 JSON 备份恢复数据
// body: { data: BackupJson, mode?: 'overwrite' | 'merge' }
// 当范围内已有数据且未指定 mode 时，返回 { needConfirm: true, existing }，由前端弹窗确认后再带 mode 重试
//
// 鉴权原则（服务端强制，防前端绕过）：
//  - 可管理范围一律基于【当前登录管理员的真实身份】解析（resolveSchoolScope），绝不信任备份 meta。
//  - 对备份中每个实体逐条校验归属班级/年级：只有落在当前用户管理范围内的实体才会被写入；
//    越权实体（即使 classId 恰好指向其他班级）一律剔除，不产生任何新增/修改，并记审计日志。
//  - 若备份中没有任何当前用户可管理的实体，整体拒绝。
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)

  const body = await readBody(event)
  const data = body?.data ?? body
  const mode = (body?.mode as string) || ''

  if (!data || !Array.isArray(data.users) || !Array.isArray(data.scoreLogs)) {
    throw createError({ statusCode: 400, message: '无效的备份文件：缺少 users 或 scoreLogs 数据' })
  }

  const scope = await resolveSchoolScope(admin, db)

  // ===== 逐实体过滤：只保留当前用户可管理的实体，剔除越权实体 =====
  const { grades: bg, classes: bc, users: bu, logs: bl, rejected } = filterByScope(
    data, scope, { adminId: admin.id, schoolId },
  )

  // 若备份中没有任何可管理的实体 → 整体拒绝（防止空操作或越权试探）
  if (bc.length === 0 && bu.length === 0) {
    throw createError({
      statusCode: 403,
      message: '备份文件中的班级/学生均不在您的管理范围内，已拒绝导入',
    })
  }

  // ===== 统计「可管理范围内」现有数据量（用于覆盖确认提示） =====
  // scopeClassIds：本用户可管理的班级 id（schoolWide 时为 null=全部）
  const scopeClassIds = scope.schoolWide ? null : ([...scope.classIdSet!] as number[])

  let existingUsers = 0
  let existingLogs = 0
  if (scopeClassIds && scopeClassIds.length) {
    existingUsers = (await db
      .select({ c: sql<number>`count(*)` })
      .from(users)
      .where(inArray(users.classId, scopeClassIds))
      .get())?.c || 0
  } else if (scope.schoolWide) {
    existingUsers = (await db
      .select({ c: sql<number>`count(*)` })
      .from(users)
      .get())?.c || 0
  }
  if (scopeClassIds && scopeClassIds.length) {
    const uids = (await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.classId, scopeClassIds))).map((u: any) => u.id)
    if (uids.length) {
      existingLogs = (await db
        .select({ c: sql<number>`count(*)` })
        .from(scoreLogs)
        .where(inArray(scoreLogs.userId, uids))
        .get())?.c || 0
    }
  } else if (scope.schoolWide) {
    existingLogs = (await db
      .select({ c: sql<number>`count(*)` })
      .from(scoreLogs)
      .get())?.c || 0
  }

  // 范围内非空且未指定 mode → 让前端确认
  if (!mode && (existingUsers > 0 || existingLogs > 0)) {
    return { needConfirm: true, existing: { users: existingUsers, logs: existingLogs } }
  }

  const effectiveMode = mode || 'overwrite'

  if (effectiveMode === 'overwrite') {
    await doOverwrite(db, bg, bc, bu, bl)
  } else {
    await doMerge(db, bg, bc, bu, bl, scope)
  }

  return {
    success: true,
    mode: effectiveMode,
    imported: { grades: bg.length, classes: bc.length, users: bu.length, logs: bl.length },
    rejected: rejected.length ? { count: rejected.length, items: rejected } : undefined,
  }
})

/**
 * 基于当前用户管理范围，逐实体过滤备份数据。
 * 返回过滤后的实体数组 + 被拒绝（越权）的实体描述列表（用于审计日志）。
 */
function filterByScope(
  data: any,
  scope: any,
  ctx: { adminId: number; schoolId: number },
) {
  const backupGrades = (data.grades || []) as any[]
  const backupClasses = (data.classes || []) as any[]
  const backupUsers = (data.users || []) as any[]
  const backupLogs = (data.scoreLogs || []) as any[]

  const rejected: string[] = []
  const isGradeOk = (gid: number | null | undefined) =>
    scope.schoolWide || scope.gradeIdSet === null || gid == null || scope.gradeIdSet.has(gid)
  const isClassOk = (cid: number | null | undefined) =>
    scope.schoolWide || scope.classIdSet === null || cid == null || scope.classIdSet.has(cid)

  // grades：必须属于本用户可管理年级
  const bg = backupGrades.filter((g) => {
    if (isGradeOk(g.id)) return true
    rejected.push(`grade#${g.id}(${g.name ?? ''})`)
    return false
  })

  // classes：其 id 与所属 gradeId 都必须在范围内
  const bc = backupClasses.filter((c) => {
    if (isClassOk(c.id) && isGradeOk(c.gradeId)) return true
    rejected.push(`class#${c.id}(${c.name ?? ''},grade=${c.gradeId})`)
    return false
  })
  const allowedClassIds = new Set(bc.map((c) => c.id))

  // users：classId 必须在范围内
  const bu = backupUsers.filter((u) => {
    if (isClassOk(u.classId)) return true
    rejected.push(`user#${u.id}(${u.username ?? ''},class=${u.classId})`)
    return false
  })
  const allowedUserIds = new Set(bu.map((u) => u.id))

  // scoreLogs：其 userId 必须在「被保留的用户」集合内
  const bl = backupLogs.filter((l) => {
    if (allowedUserIds.has(l.userId)) return true
    rejected.push(`log#${l.id}(user=${l.userId})`)
    return false
  })

  if (rejected.length) {
    console.warn(
      `[CSMS-AUDIT] 导入越权拦截 admin=${ctx.adminId} school=${ctx.schoolId} role=${scope.role} ` +
      `拒绝 ${rejected.length} 个越权实体: ${rejected.slice(0, 20).join(', ')}${rejected.length > 20 ? '...' : ''}`,
    )
  }

  return { grades: bg, classes: bc, users: bu, logs: bl, rejected }
}

// ===== overwrite：用备份重建（按备份实际包含的 id 删除，避免 PK 冲突） =====
// 仅处理已通过 scope 过滤的实体；删除范围与导入数据对齐（只删备份出现的 id），
// 不影响本用户管理范围内但未被备份涵盖的现有数据。
async function doOverwrite(db: any, bg: any[], bc: any[], bu: any[], bl: any[]) {
  if (bg.length) {
    await db.delete(grades).where(inArray(grades.id, bg.map((g: any) => g.id)))
  }
  if (bc.length) {
    await db.delete(classes).where(inArray(classes.id, bc.map((c: any) => c.id)))
  }
  if (bu.length) {
    await db.delete(users).where(inArray(users.id, bu.map((u: any) => u.id)))
  }
  if (bl.length) {
    await db.delete(scoreLogs).where(inArray(scoreLogs.id, bl.map((l: any) => l.id)))
  }

  if (bg.length) {
    await db.insert(grades).values(bg.map((g: any) => pick(g, ['id', 'name', 'createdAt'])))
  }
  if (bc.length) {
    await db.insert(classes).values(bc.map((c: any) => pick(c, ['id', 'gradeId', 'name', 'createdAt'])))
  }
  if (bu.length) {
    await db.insert(users).values(bu.map((u: any) => pick(u, ['id', 'classId', 'username', 'passwordHash', 'actualName', 'mustChangePassword', 'totalScore', 'addScore', 'deductScore', 'scoreCount', 'createdAt'])))
  }
  if (bl.length) {
    await db.insert(scoreLogs).values(bl.map((l: any) => pick(l, ['id', 'userId', 'username', 'scoreChange', 'description', 'createdAt'])))
  }
}

// ===== merge：按业务键查重，跳过已存在，插入缺失 =====
// 仅在【当前用户可管理范围】内查重：越权同名班级不会被误判为「已存在」而跳过，
// 也不会被写入（它们已在 filterByScope 阶段被剔除）。
async function doMerge(db: any, bg: any[], bc: any[], bu: any[], bl: any[], scope: any) {
  const existingGrades = await db.select().from(grades)
  const existingClasses = await db.select().from(classes)
  const existingUsers = await db.select().from(users)

  const gradeNameSet = new Set(existingGrades.map((g: any) => g.name))
  const classKeySet = new Set(existingClasses.map((c: any) => `${c.gradeId}:${c.name}`))
  const userKeySet = new Set(existingUsers.map((u: any) => `${u.classId}:${u.username}`))

  const gradeIdMap = new Map<number, number>()
  const classIdMap = new Map<number, number>()
  const userIdMap = new Map<number, number>()

  // 1. grades
  for (const g of bg) {
    if (gradeNameSet.has(g.name)) {
      const existing = existingGrades.find((e: any) => e.name === g.name)
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
      const existing = existingClasses.find((e: any) => e.gradeId === gid && e.name === c.name)
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
      const existing = existingUsers.find((e: any) => e.classId === cid && e.username === u.username)
      if (existing) userIdMap.set(u.id, existing.id)
      continue
    }
    const inserted = await db.insert(users).values({
      classId: cid,
      username: u.username,
      passwordHash: u.passwordHash,
      actualName: u.actualName,
      // 还原时忠实保留原始 mustChangePassword（缺省按 0）
      mustChangePassword: u.mustChangePassword ?? 0,
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
  const logKeySet = new Set(existingLogs.map((l: any) => `${l.userId}|${l.scoreChange}|${l.description ?? ''}|${l.createdAt}`))
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
