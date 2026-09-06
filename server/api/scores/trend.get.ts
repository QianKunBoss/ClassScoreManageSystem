import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { scoreLogs, users, classes as classTable } from '../../database/schema'
import { useSchoolDb } from '../../database/db'
import { requireAdmin, getSchoolIdFromRequest } from '../../utils/auth'

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function dayKeyOf(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/**
 * GET /api/scores/trend — 最近 N 天积分趋势聚合
 *
 * 供排行榜的两张图使用：
 *  - 折线图：每日净积分变化（net）
 *  - K 线图：累计积分的 OHLC（open/close/high/low）
 *
 * 查询参数：
 *  - days：天数，默认 30，范围 2~90
 *  - classId / gradeId / userId：作用域筛选（与 /api/scores/logs 一致）
 *
 * 基线说明：以「当前总积分」反推窗口起始值，
 * baseline = 当前总积分 - 窗口内全部变化量，从而得到窗口内的真实绝对值序列。
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)

  const query = getQuery(event) as {
    days?: string
    classId?: string
    gradeId?: string
    userId?: string
  }

  const days = Math.min(90, Math.max(2, Number(query.days) || 30))
  const classId = query.classId ? Number(query.classId) : undefined
  const gradeId = query.gradeId ? Number(query.gradeId) : undefined
  const userId = query.userId ? Number(query.userId) : undefined

  // ===== 1. 年级作用域：先解析出该年级下的班级 =====
  let classIdsInGrade: number[] = []
  if (gradeId) {
    const rows = await db
      .select({ id: classTable.id })
      .from(classTable)
      .where(eq(classTable.gradeId, gradeId))
    classIdsInGrade = rows.map((r) => r.id)
    // 年级下没有班级，直接返回空序列
    if (classIdsInGrade.length === 0) {
      return { days: [], currentTotal: 0, baseline: 0, range: { start: '', end: '' } }
    }
  }

  // ===== 2. 作用域条件（users 侧） =====
  const userConditions: any[] = []
  if (userId) userConditions.push(eq(users.id, userId))
  if (classId) userConditions.push(eq(users.classId, classId))
  if (gradeId && classIdsInGrade.length > 0) {
    userConditions.push(inArray(users.classId, classIdsInGrade))
  }
  const userWhere = userConditions.length > 0 ? and(...userConditions) : undefined

  // ===== 3. 当前总积分（作用域内 users.totalScore 之和） =====
  const totalSelect = { v: sql<number>`coalesce(sum(${users.totalScore}), 0)` }
  const totalRow = userWhere
    ? await db.select(totalSelect).from(users).where(userWhere).get()
    : await db.select(totalSelect).from(users).get()
  const currentTotal = Number(totalRow?.v || 0)

  // ===== 4. 时间窗口（本地时区，含今天） =====
  const now = new Date()
  const start = new Date(now)
  start.setDate(start.getDate() - (days - 1))
  start.setHours(0, 0, 0, 0)
  const startStr = `${dayKeyOf(start)} 00:00:00`

  const dayKeys: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    dayKeys.push(dayKeyOf(d))
  }

  // ===== 5. 拉取窗口内全部日志（时间升序） =====
  const logConditions: any[] = [sql`datetime(${scoreLogs.createdAt}) >= ${startStr}`]
  if (userId) logConditions.push(eq(scoreLogs.userId, userId))
  if (classId) logConditions.push(eq(users.classId, classId))
  if (gradeId && classIdsInGrade.length > 0) {
    logConditions.push(inArray(users.classId, classIdsInGrade))
  }

  const logs = await db
    .select({
      id: scoreLogs.id,
      scoreChange: scoreLogs.scoreChange,
      createdAt: scoreLogs.createdAt,
    })
    .from(scoreLogs)
    .leftJoin(users, eq(scoreLogs.userId, users.id))
    .where(and(...logConditions))
    .orderBy(asc(scoreLogs.createdAt))

  // ===== 6. 按天分桶，同时统计窗口内净变化 =====
  const buckets = new Map<string, { scoreChange: number }[]>()
  let netWindow = 0
  for (const l of logs) {
    const d = new Date(l.createdAt)
    if (Number.isNaN(d.getTime())) continue
    const key = dayKeyOf(d)
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push({ scoreChange: l.scoreChange })
    netWindow += l.scoreChange
  }

  // ===== 7. 逐日推进，生成 OHLC =====
  const baseline = currentTotal - netWindow
  let running = baseline

  const series = dayKeys.map((key) => {
    const list = buckets.get(key) || []
    const open = running
    let high = open
    let low = open
    let net = 0
    let add = 0
    let deduct = 0

    for (const it of list) {
      running += it.scoreChange
      if (running > high) high = running
      if (running < low) low = running
      net += it.scoreChange
      if (it.scoreChange > 0) add += it.scoreChange
      else deduct += it.scoreChange
    }

    const close = running
    return {
      date: key,
      open,
      close,
      high,
      low,
      net,
      add,
      deduct,
      count: list.length,
    }
  })

  return {
    days: series,
    currentTotal,
    baseline,
    range: { start: dayKeys[0], end: dayKeys[dayKeys.length - 1] },
  }
})
