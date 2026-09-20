import { eq, and } from 'drizzle-orm'
import { grades, classes, users } from '../../../database/schema.school'
import { useSchoolDb } from '../../../database/db'
import {
  requireSuperAdmin, getSchoolIdFromRequest, resolveSchoolScope, validatePasswordStrength,
} from '../../../utils/auth'
import { parseCsv } from '../../../utils/csv'

// POST /api/data/import/preview — 解析 CSV 并逐行校验，返回预览（含每行错误），不写入数据库
// body: { schoolId?, type: 'students'|'scores'|'grades-classes', csv: string }
// 鉴权：基于当前管理员真实身份解析范围（resolveSchoolScope），越权班级/年级逐行标记错误。
const TYPE_LABEL: Record<string, string> = {
  students: '学生档案',
  scores: '积分记录',
  'grades-classes': '年级/班级结构',
}

const HEADER_ALIASES: Record<string, string> = {
  username: 'username', 学号: 'username', 账号: 'username', 用户名: 'username',
  actualname: 'actualName', 姓名: 'actualName', 名字: 'actualName',
  gradename: 'gradeName', 年级: 'gradeName',
  classname: 'className', 班级: 'className',
  classid: 'classId', 班级id: 'classId', 班级ID: 'classId',
  password: 'password', 密码: 'password',
  email: 'email', 邮箱: 'email',
  scorechange: 'scoreChange', 积分: 'scoreChange', 加减分: 'scoreChange', 分值: 'scoreChange', 分数: 'scoreChange',
  description: 'description', 说明: 'description', 备注: 'description', 描述: 'description',
  studentid: 'studentId', 学生id: 'studentId', 学生ID: 'studentId',
}

function canon(header: string): string {
  return HEADER_ALIASES[header.toLowerCase().trim()] || header
}

export default defineEventHandler(async (event) => {
  const admin = await requireSuperAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)
  const scope = await resolveSchoolScope(admin, db)

  const body = await readBody(event)
  const type = body?.type as string
  const csv = (body?.csv as string) || ''

  if (!TYPE_LABEL[type]) {
    throw createError({ statusCode: 400, message: '未知的导入类型' })
  }
  if (!csv.trim()) {
    throw createError({ statusCode: 400, message: 'CSV 内容为空' })
  }

  const { headers, rows } = parseCsv(csv)
  if (!headers.length) {
    throw createError({ statusCode: 400, message: '无法解析 CSV 表头' })
  }
  const canons = headers.map(canon)
  const normalized = rows.map((r) => {
    const o: Record<string, string> = {}
    canons.forEach((c, i) => { o[c] = (r[headers[i]] ?? '').trim() })
    return o
  })

  const out: { index: number; status: 'ok' | 'error'; errors: string[]; data: any }[] = []
  const seenStudentKeys = new Set<string>() // 文件内去重：classId|username

  for (let i = 0; i < normalized.length; i++) {
    const row = normalized[i]
    const errors: string[] = []
    let data: any = {}

    if (type === 'students') {
      const username = row.username
      const actualName = row.actualName
      if (!username) errors.push('缺少账号(username)')
      if (!actualName) errors.push('缺少姓名(actualName)')

      const cls = await resolveClass(db, row)
      if (!cls) {
        errors.push('班级不存在（请检查 年级/班级 或 班级ID）')
      } else {
        if (!scope.isClassAllowed(cls.id)) errors.push('无权限导入该班级')
        data.classId = cls.id
        data.className = cls.name
      }

      const pwd = row.password || username
      if (row.password) {
        const v = validatePasswordStrength(row.password)
        if (!v.ok) errors.push(`密码${v.message}`)
      }
      data.username = username
      data.actualName = actualName
      data.password = pwd
      data.email = row.email || ''

      if (cls && username) {
        const key = `${cls.id}|${username}`
        const existing = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.classId, cls.id), eq(users.username, username)))
          .get()
        if (existing) errors.push('该班级已存在此账号')
        if (seenStudentKeys.has(key)) errors.push('文件内重复账号')
        else seenStudentKeys.add(key)
      }
    }

    else if (type === 'scores') {
      const changeRaw = row.scoreChange
      const change = Number(changeRaw)
      if (changeRaw === '' || Number.isNaN(change) || !Number.isInteger(change)) {
        errors.push('分值(scoreChange)必须为整数')
      }
      const stu = await resolveStudent(db, row)
      if (!stu) {
        errors.push('学生不存在（请检查 账号+年级/班级 或 学生ID）')
      } else {
        if (!scope.isClassAllowed(stu.classId)) errors.push('无权限操作该学生所在班级')
        data.userId = stu.id
        data.classId = stu.classId
        data.username = stu.username
      }
      data.scoreChange = change
      data.description = row.description || ''
    }

    else if (type === 'grades-classes') {
      const gradeName = row.gradeName
      if (!gradeName) {
        errors.push('缺少年级(gradeName)')
      } else {
        if (!scope.isGradeAllowed(undefined)) {
          // grade_admin 仅能操作自己年级；class_admin 无权限
          const g = await db.select().from(grades).where(eq(grades.name, gradeName)).get()
          if (!(g && scope.isGradeAllowed(g.id))) errors.push('无权限创建/导入该年级')
        }
      }
      data.gradeName = gradeName
      data.className = row.className || ''
    }

    out.push({
      index: i + 2, // CSV 行号（含表头）
      status: errors.length ? 'error' : 'ok',
      errors,
      data,
    })
  }

  const accepted = out.filter((r) => r.status === 'ok').length
  const rejected = out.length - accepted
  return {
    type,
    typeLabel: TYPE_LABEL[type],
    total: out.length,
    accepted,
    rejected,
    rows: out,
  }
})

// 解析班级：优先 classId，否则 gradeName + className
async function resolveClass(db: any, row: Record<string, string>) {
  if (row.classId) {
    const c = await db.select().from(classes).where(eq(classes.id, Number(row.classId))).get()
    return c || null
  }
  if (row.gradeName && row.className) {
    const g = await db.select().from(grades).where(eq(grades.name, row.gradeName)).get()
    if (!g) return null
    const c = await db
      .select()
      .from(classes)
      .where(and(eq(classes.gradeId, g.id), eq(classes.name, row.className)))
      .get()
    return c || null
  }
  return null
}

// 解析学生：优先 studentId，否则 classId/username 或 gradeName+className+username
async function resolveStudent(db: any, row: Record<string, string>) {
  if (row.studentId) {
    const u = await db.select().from(users).where(eq(users.id, Number(row.studentId))).get()
    if (u) return u
  }
  let classId = row.classId ? Number(row.classId) : null
  if (!classId && row.gradeName && row.className) {
    const cls = await resolveClass(db, row)
    if (cls) classId = cls.id
  }
  if (classId && row.username) {
    return (await db
      .select()
      .from(users)
      .where(and(eq(users.classId, classId), eq(users.username, row.username)))
      .get()) || null
  }
  return null
}
