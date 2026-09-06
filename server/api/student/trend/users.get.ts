import { eq, asc, and, sql } from 'drizzle-orm'
import { scoreLogs, users } from '../../../database/schema'
import { useSchoolDb } from '../../../database/db'
import { getStudentFromSession } from '../../../utils/auth'

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function dayKeyOf(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/**
 * GET /api/student/trend/users — 本班「每个学生」的每日趋势序列（学生端专用）
 *
 * 学生只能看自己班级，classId 强制取自身班级，不信任客户端传入值。
 * 供学生排名页每行内嵌的迷你图使用（折线用 net，K 线用 OHLC）。
 * 一次请求返回全班，避免逐行请求导致的 N+1。
 *
 * 返回（紧凑数组，减少体积）：
 * {
 *   days: ['2026-08-08', ...],
 *   users: { '<userId>': [[open, close, high, low, net], ...] }  // 与 days 一一对应
 * }
 *
 * 基线 = 该生当前积分 − 窗口内净变化，末日收盘 === 其当前 totalScore。
 */
export default defineEventHandler(async (event) => {
  const student = await getStudentFromSession(event)
  if (!student) {
    setResponseStatus(event, 401)
    return { success: false, message: '请先登录' }
  }

  const db = await useSchoolDb(event, student.schoolId)

  const query = getQuery(event) as { days?: string }
  const days = Math.min(90, Math.max(2, Number(query.days) || 30))

  // 学生仅能查看本班
  if (student.classId == null) {
    return { days: [], users: {} }
  }
  const classId = student.classId

  // 本班学生（只需要 id 与当前积分）
  const userRows = await db
    .select({ id: users.id, totalScore: users.totalScore })
    .from(users)
    .where(eq(users.classId, classId))

  if (userRows.length === 0) return { days: [], users: {} }

  // 时间窗口
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

  // 窗口内日志（仅本班，时间升序）
  const logs = await db
    .select({
      userId: scoreLogs.userId,
      scoreChange: scoreLogs.scoreChange,
      createdAt: scoreLogs.createdAt,
    })
    .from(scoreLogs)
    .leftJoin(users, eq(scoreLogs.userId, users.id))
    .where(
      and(
        sql`datetime(${scoreLogs.createdAt}) >= ${startStr}`,
        eq(users.classId, classId),
      ),
    )
    .orderBy(asc(scoreLogs.createdAt))

  // userId -> (dayKey -> 当日变化列表)，同时累计该生窗口内净变化
  const byUser = new Map<number, Map<string, number[]>>()
  const netByUser = new Map<number, number>()

  for (const l of logs) {
    const uid = l.userId
    if (uid == null) continue
    const d = new Date(l.createdAt)
    if (Number.isNaN(d.getTime())) continue
    const key = dayKeyOf(d)

    if (!byUser.has(uid)) byUser.set(uid, new Map())
    const dayMap = byUser.get(uid)!
    if (!dayMap.has(key)) dayMap.set(key, [])
    dayMap.get(key)!.push(l.scoreChange)

    netByUser.set(uid, (netByUser.get(uid) || 0) + l.scoreChange)
  }

  // 逐生推进，生成紧凑序列
  const result: Record<string, number[][]> = {}

  for (const u of userRows) {
    const uid = u.id
    const current = Number(u.totalScore || 0)
    const netWindow = netByUser.get(uid) || 0
    const dayMap = byUser.get(uid)

    let running = current - netWindow
    const series: number[][] = []

    for (const key of dayKeys) {
      const list = dayMap?.get(key) || []
      const open = running
      let high = open
      let low = open
      let net = 0

      for (const ch of list) {
        running += ch
        if (running > high) high = running
        if (running < low) low = running
        net += ch
      }

      const close = running
      series.push([open, close, high, low, net])
    }

    result[String(uid)] = series
  }

  return { days: dayKeys, users: result }
})
