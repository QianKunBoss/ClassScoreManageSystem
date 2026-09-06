import { eq, and, sql, asc } from 'drizzle-orm'
import { scoreLogs, users } from '../../database/schema'
import { useSchoolDb } from '../../database/db'
import { getStudentFromSession } from '../../utils/auth'

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function dayKeyOf(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/**
 * GET /api/student/trend — 当前学生最近 N 天积分趋势（学生端专用）
 *
 * 仅返回「本人」数据（getStudentFromSession），与 /api/scores/trend 的
 * 管理员聚合相互独立。供学生页中间的折线图 + K 线图使用：
 *  - 折线图：每日净积分变化（net）
 *  - K 线图：累计积分的 OHLC（open/close/high/low）
 *
 * 基线说明：baseline = 当前总积分 - 窗口内全部变化量，
 * 逐日推进后末日 close === 当前总积分（不变式）。
 */
export default defineEventHandler(async (event) => {
  const student = await getStudentFromSession(event)
  if (!student) {
    setResponseStatus(event, 401)
    return { success: false, message: '请先登录' }
  }

  const db = await useSchoolDb(event, student.schoolId)

  const query = getQuery(event) as { days?: string; userId?: string }
  const days = Math.min(90, Math.max(2, Number(query.days) || 30))

  // 默认查看本人；支持查看同班同学（用于排名页展开大图）
  // 注意：getStudentFromSession 不含 totalScore，须从学校库读取真实积分
  const reqUserId = query.userId ? Number(query.userId) : null
  const targetId = reqUserId && reqUserId !== student.id ? reqUserId : student.id

  const tu = await db
    .select({ id: users.id, classId: users.classId, totalScore: users.totalScore })
    .from(users)
    .where(eq(users.id, targetId))
    .get()

  // 目标必须是本人或同班同学（学生只能看自己班级）
  if (!tu || tu.classId !== student.classId) {
    setResponseStatus(event, 403)
    return { success: false, message: '无权查看该学生' }
  }

  const currentTotal = Number(tu.totalScore || 0)

  // 时间窗口（本地时区，含今天）
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

  // 窗口内日志（仅本人）
  const logs = await db
    .select({
      id: scoreLogs.id,
      scoreChange: scoreLogs.scoreChange,
      createdAt: scoreLogs.createdAt,
    })
    .from(scoreLogs)
    .where(
      and(
        eq(scoreLogs.userId, targetId),
        sql`datetime(${scoreLogs.createdAt}) >= ${startStr}`,
      ),
    )
    .orderBy(asc(scoreLogs.createdAt))

  // 按天分桶，同时统计窗口内净变化
  const buckets = new Map<string, number[]>()
  let netWindow = 0
  for (const l of logs) {
    const d = new Date(l.createdAt)
    if (Number.isNaN(d.getTime())) continue
    const key = dayKeyOf(d)
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(l.scoreChange)
    netWindow += l.scoreChange
  }

  // 逐日推进，生成 OHLC
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

    for (const ch of list) {
      running += ch
      if (running > high) high = running
      if (running < low) low = running
      net += ch
      if (ch > 0) add += ch
      else deduct += ch
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
    success: true,
    data: {
      days: series,
      currentTotal,
      baseline,
      range: { start: dayKeys[0], end: dayKeys[dayKeys.length - 1] },
    },
  }
})
