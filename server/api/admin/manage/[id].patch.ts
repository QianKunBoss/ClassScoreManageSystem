import { eq, and } from 'drizzle-orm'
import { admins, schools } from '../../../database/schema.main'
import { useMainDb, getSchoolRawClient } from '../../../database/db'
import { requireAdmin } from '../../../utils/auth'
import { EMAIL_RE } from '../../../utils/mail'

// PATCH: 更新管理员（角色 / 密码）
// 权限规则：
// - 超级管理员：可以修改所有管理员
// - 学校管理员：可以修改本校的所有管理员
// - 年级管理员：可以修改本年级的班级管理员
// - 班级管理员：无权修改其他管理员（只能改自己，通过 /api/auth/me PATCH）
export default defineEventHandler(async (event) => {
  const currentAdmin = await requireAdmin(event)
  const db = useMainDb()
  const id = parseInt(event.context.params?.id || '')

  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的管理员ID' })
  }

  // 查出目标管理员
  const targetAdmin = await db
    .select()
    .from(admins)
    .where(eq(admins.id, id))
    .get()

  if (!targetAdmin) {
    throw createError({ statusCode: 404, message: '管理员不存在' })
  }

  // 检查权限：当前管理员能否操作目标管理员
  if (!canManageAdmin(currentAdmin, targetAdmin)) {
    throw createError({ statusCode: 403, message: '无权操作此管理员' })
  }

  const body = await readBody(event) as {
    role?: string
    password?: string
    disabled?: number
    email?: string
    schoolId?: number | null
    gradeId?: number | null
    classId?: number | null
  }

  if (!body.role && !body.password && body.disabled === undefined && body.email === undefined
    && body.schoolId === undefined && body.gradeId === undefined && body.classId === undefined) {
    throw createError({ statusCode: 400, message: '请指定要修改的字段' })
  }

  const setData: Record<string, any> = {}

  if (body.role) {
    // 修改角色也需要权限检查
    // 学校管理员不能把别人改成学校管理员或超级管理员
    if (currentAdmin.role === 'school_admin') {
      if (body.role === 'school_admin' || body.role === 'super_admin') {
        throw createError({ statusCode: 403, message: '无权设置此角色' })
      }
    }
    // 年级管理员不能修改角色
    if (currentAdmin.role === 'grade_admin') {
      throw createError({ statusCode: 403, message: '无权修改角色' })
    }
    setData.role = body.role
  }

  if (body.password) {
    if (body.password.length < 6) {
      throw createError({ statusCode: 400, message: '密码长度至少6位' })
    }
    const { hashPasswordBcrypt } = await import('../../../utils/auth')
    setData.passwordHash = hashPasswordBcrypt(body.password)
  }

  if (body.disabled !== undefined) {
    // 只有超级管理员可以封禁/启用管理员
    if (currentAdmin.role !== 'super_admin') {
      throw createError({ statusCode: 403, message: '无权执行此操作' })
    }
    setData.disabled = body.disabled ? 1 : 0
  }

  // 邮箱（修改登录凭证；可空表示解绑）。需全局唯一（排除自身）
  if (body.email !== undefined) {
    const email = (body.email || '').trim()
    if (email) {
      if (!EMAIL_RE.test(email)) {
        throw createError({ statusCode: 400, message: '邮箱格式不正确' })
      }
      if (email !== targetAdmin.email) {
        const dup = await db
          .select({ id: admins.id })
          .from(admins)
          .where(eq(admins.email, email))
          .get()
        if (dup && dup.id !== id) {
          throw createError({ statusCode: 409, message: '该邮箱已被其他管理员绑定' })
        }
      }
      setData.email = email
      setData.emailBoundAt = email ? new Date().toISOString() : null
    } else {
      setData.email = null
      setData.emailBoundAt = null
    }
  }

  // 所属（学校 / 年级 / 班级）：与角色（管理级别）联动校验
  if (body.role || body.schoolId !== undefined || body.gradeId !== undefined || body.classId !== undefined) {
    const aff = await resolveAffiliation(event, db, currentAdmin, targetAdmin, body)
    setData.schoolId = aff.schoolId
    setData.gradeId = aff.gradeId
    setData.classId = aff.classId
  }

  await db.update(admins)
    .set(setData)
    .where(eq(admins.id, id))

  return { success: true }
})

// 解析并校验「所属」字段，使其与角色（管理级别）保持一致
// - super_admin：无所属（全部清空）
// - school_admin：仅学校
// - grade_admin：学校 + 年级
// - class_admin：学校 + 年级 + 班级
async function resolveAffiliation(
  event: any,
  db: any,
  current: any,
  target: any,
  body: any,
): Promise<{ schoolId: number | null; gradeId: number | null; classId: number | null }> {
  const hasAffiliation = body.schoolId !== undefined || body.gradeId !== undefined || body.classId !== undefined
  // '' 视为未选 / 清空
  const inSchool = body.schoolId === '' ? null : body.schoolId
  const inGrade = body.gradeId === '' ? null : body.gradeId
  const inClass = body.classId === '' ? null : body.classId

  const role: string = body.role || target.role
  const schoolId = hasAffiliation && inSchool !== undefined ? inSchool : target.schoolId
  const gradeId = hasAffiliation && inGrade !== undefined ? inGrade : target.gradeId
  const classId = hasAffiliation && inClass !== undefined ? inClass : target.classId

  let norm: { schoolId: number | null; gradeId: number | null; classId: number | null }
  if (role === 'super_admin') {
    norm = { schoolId: null, gradeId: null, classId: null }
  } else if (role === 'school_admin') {
    if (hasAffiliation && !schoolId) throw createError({ statusCode: 400, message: '学校管理员必须指定学校' })
    norm = { schoolId: schoolId || null, gradeId: null, classId: null }
  } else if (role === 'grade_admin') {
    if (hasAffiliation && (!schoolId || !gradeId)) throw createError({ statusCode: 400, message: '年级管理员必须指定学校和年级' })
    norm = { schoolId: schoolId || null, gradeId: gradeId || null, classId: null }
  } else if (role === 'class_admin') {
    if (hasAffiliation && (!schoolId || !gradeId || !classId)) throw createError({ statusCode: 400, message: '班级管理员必须指定学校、年级和班级' })
    norm = { schoolId: schoolId || null, gradeId: gradeId || null, classId: classId || null }
  } else {
    throw createError({ statusCode: 400, message: '无效的角色' })
  }

  // 引用完整性校验（仅在显式提交所属时）
  if (hasAffiliation) {
    if (norm.schoolId) {
      const sch = await db.select({ id: schools.id }).from(schools).where(eq(schools.id, norm.schoolId)).get()
      if (!sch) throw createError({ statusCode: 400, message: '学校不存在' })
    }
    if (norm.gradeId && norm.schoolId) {
      const sClient = await getSchoolRawClient(event, norm.schoolId)
      const g = await sClient.execute({ sql: 'SELECT id FROM grades WHERE id = ?', args: [norm.gradeId] })
      if ((g.rows as any[]).length === 0) throw createError({ statusCode: 400, message: '年级不存在' })
    }
    if (norm.classId && norm.gradeId) {
      const sClient = await getSchoolRawClient(event, norm.schoolId!)
      const c = await sClient.execute({ sql: 'SELECT id FROM classes WHERE id = ? AND grade_id = ?', args: [norm.classId, norm.gradeId] })
      if ((c.rows as any[]).length === 0) throw createError({ statusCode: 400, message: '班级不存在或不属于该年级' })
    }
    // 学校管理员只能在本校范围内调整所属
    if (current.role === 'school_admin' && norm.schoolId && norm.schoolId !== current.schoolId) {
      throw createError({ statusCode: 403, message: '无权将管理员调整到其它学校' })
    }
    // 年级管理员只能在本年级范围内调整所属（学校与年级均不得越界）
    if (current.role === 'grade_admin') {
      if (norm.schoolId && norm.schoolId !== current.schoolId) {
        throw createError({ statusCode: 403, message: '无权将管理员调整到其它学校' })
      }
      if (norm.gradeId && norm.gradeId !== current.gradeId) {
        throw createError({ statusCode: 403, message: '无权将管理员调整到其它年级' })
      }
    }
  }

  return norm
}

// 检查当前管理员是否能管理目标管理员
function canManageAdmin(current: any, target: any): boolean {
  // 超级管理员可以管理所有
  if (current.role === 'super_admin') return true

  // 不能管理自己（自己改自己通过 /api/auth/me PATCH）
  if (current.id === target.id) return false

  // 学校管理员可以管理本校的所有管理员
  if (current.role === 'school_admin') {
    return current.schoolId === target.schoolId
  }

  // 年级管理员可以管理本年级的班级管理员
  if (current.role === 'grade_admin') {
    return (
      current.schoolId === target.schoolId &&
      current.gradeId === target.gradeId &&
      target.role === 'class_admin'
    )
  }

  // 班级管理员无权管理其他管理员
  return false
}
