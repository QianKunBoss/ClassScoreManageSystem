import { sql } from 'drizzle-orm'
import { useMainDb, getSchoolRawClient } from '../../database/db'
import { schools, admins, applications, announcements } from '../../database/schema.main'
import { requireSuperAdmin, getSchoolIdFromRequest } from '../../utils/auth'

// GET /api/data/stats — 系统数据总览（超管=全部学校聚合；校管=本校）
// 返回概览卡片 + 各维度图表数据 + 每校明细，供前端图表/列表渲染
export default defineEventHandler(async (event) => {
  const admin = await requireSuperAdmin(event)
  const isSuper = admin.role === 'super_admin'
  const mainDb = useMainDb()

  // 决定统计范围：超管全部学校，其余仅本校
  let schoolList: { id: number; name: string }[] = []
  if (isSuper) {
    schoolList = (await mainDb.select({ id: schools.id, name: schools.name }).from(schools)) as any
  } else {
    const sid = await getSchoolIdFromRequest(event)
    const s = await mainDb
      .select({ id: schools.id, name: schools.name })
      .from(schools)
      .where(sql`${schools.id} = ${sid}`)
      .get()
    if (s) schoolList = [s as any]
  }

  // 主库统计（角色分布 / 申请状态 / 公告数）
  const adminRoles = await mainDb
    .select({ role: admins.role, c: sql<number>`count(*)` })
    .from(admins)
    .groupBy(admins.role)
  const appStatus = await mainDb
    .select({ status: applications.status, c: sql<number>`count(*)` })
    .from(applications)
    .groupBy(applications.status)
  const annCount = (await mainDb.select({ c: sql<number>`count(*)` }).from(announcements).get())?.c || 0

  const schoolsAgg: any[] = []
  const studentsBySchool: { name: string; value: number }[] = []
  const scoreBySchool: { name: string; value: number }[] = []
  const buckets: Record<string, number> = {
    负分: 0, '0': 0, '1-50': 0, '51-100': 0, '101-200': 0, '201-500': 0, '500+': 0,
  }
  let totalStudents = 0, totalDisabled = 0, totalEmailBound = 0, totalLogs = 0
  let totalScoreSum = 0, totalGrades = 0, totalClasses = 0

  for (const sc of schoolList) {
    const client = await getSchoolRawClient(event, sc.id)
    const u = (await client.execute(`SELECT
        count(*) as c,
        coalesce(sum(case when disabled=1 then 1 else 0 end),0) as disabled,
        coalesce(sum(case when email is not null and email != '' then 1 else 0 end),0) as emailBound,
        coalesce(sum(total_score),0) as totalScore,
        coalesce(avg(total_score),0) as avgScore,
        coalesce(max(total_score),0) as maxScore,
        coalesce(min(total_score),0) as minScore
      FROM users`)).rows[0] as any
    const g = (await client.execute(`SELECT count(*) as c FROM grades`)).rows[0] as any
    const cl = (await client.execute(`SELECT count(*) as c FROM classes`)).rows[0] as any
    const lg = (await client.execute(`SELECT count(*) as c FROM score_logs`)).rows[0] as any

    const studentCount = Number(u.c) || 0
    const totalScore = Number(u.totalScore) || 0
    schoolsAgg.push({
      id: sc.id, name: sc.name,
      studentCount,
      disabledStudentCount: Number(u.disabled) || 0,
      emailBoundCount: Number(u.emailBound) || 0,
      gradeCount: Number(g.c) || 0,
      classCount: Number(cl.c) || 0,
      logCount: Number(lg.c) || 0,
      totalScore,
      avgScore: Math.round((Number(u.avgScore) || 0) * 10) / 10,
      maxScore: Number(u.maxScore) || 0,
      minScore: Number(u.minScore) || 0,
    })
    studentsBySchool.push({ name: sc.name, value: studentCount })
    scoreBySchool.push({ name: sc.name, value: totalScore })
    totalStudents += studentCount
    totalDisabled += Number(u.disabled) || 0
    totalEmailBound += Number(u.emailBound) || 0
    totalLogs += Number(lg.c) || 0
    totalScoreSum += totalScore
    totalGrades += Number(g.c) || 0
    totalClasses += Number(cl.c) || 0

    const dist = (await client.execute(`SELECT
        coalesce(sum(case when total_score < 0 then 1 else 0 end),0) as neg,
        coalesce(sum(case when total_score = 0 then 1 else 0 end),0) as z,
        coalesce(sum(case when total_score between 1 and 50 then 1 else 0 end),0) as a,
        coalesce(sum(case when total_score between 51 and 100 then 1 else 0 end),0) as b,
        coalesce(sum(case when total_score between 101 and 200 then 1 else 0 end),0) as c,
        coalesce(sum(case when total_score between 201 and 500 then 1 else 0 end),0) as d,
        coalesce(sum(case when total_score > 500 then 1 else 0 end),0) as e
      FROM users`)).rows[0] as any
    buckets['负分'] += Number(dist.neg) || 0
    buckets['0'] += Number(dist.z) || 0
    buckets['1-50'] += Number(dist.a) || 0
    buckets['51-100'] += Number(dist.b) || 0
    buckets['101-200'] += Number(dist.c) || 0
    buckets['201-500'] += Number(dist.d) || 0
    buckets['500+'] += Number(dist.e) || 0
  }

  // 最近 14 天积分记录趋势（按天计数，跨校累加）
  const trendMap: Record<string, number> = {}
  for (let i = 13; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    trendMap[d.toISOString().slice(0, 10)] = 0
  }
  const since = new Date()
  since.setDate(since.getDate() - 13)
  for (const sc of schoolList) {
    const client = await getSchoolRawClient(event, sc.id)
    const res = await client.execute(
      `SELECT date(created_at) as d, count(*) as c FROM score_logs WHERE created_at >= ? GROUP BY d`,
      [since.toISOString().slice(0, 10)],
    )
    for (const r of res.rows as any[]) {
      const key = String(r.d).slice(0, 10)
      if (key in trendMap) trendMap[key] += Number(r.c) || 0
    }
  }
  const scoreTrend = Object.entries(trendMap).map(([date, value]) => ({ date, value }))

  // 枚举中文映射（饼图图例汉化）
  const ROLE_LABELS: Record<string, string> = {
    super_admin: '超级管理员',
    school_admin: '学校管理员',
    grade_admin: '年级管理员',
    class_admin: '班级管理员',
  }
  const APP_STATUS_LABELS: Record<string, string> = {
    pending: '待审核',
    approved: '已通过',
    rejected: '已拒绝',
  }

  return {
    scope: isSuper ? 'system' : 'school',
    generatedAt: new Date().toISOString(),
    overview: {
      schoolCount: isSuper ? schoolList.length : 1,
      totalStudents,
      totalDisabled,
      totalEmailBound,
      totalLogs,
      totalScoreSum,
      totalGrades,
      totalClasses,
      announcementCount: annCount,
      avgScore: totalStudents ? Math.round((totalScoreSum / totalStudents) * 10) / 10 : 0,
      adminCount: adminRoles.reduce((s: number, r: any) => s + Number(r.c), 0),
    },
    schools: schoolsAgg,
    charts: {
      studentsBySchool,
      scoreBySchool,
      scoreBuckets: Object.entries(buckets).map(([label, value]) => ({ label, value })),
      scoreTrend,
      roleDistribution: isSuper ? adminRoles.map((r: any) => ({ label: ROLE_LABELS[r.role] || r.role, value: Number(r.c) })) : [],
      applicationStatus: isSuper ? appStatus.map((r: any) => ({ label: APP_STATUS_LABELS[r.status] || r.status, value: Number(r.c) })) : [],
    },
  }
})
