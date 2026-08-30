import { eq, sql, and } from 'drizzle-orm'
import { getRequestHeader } from 'h3'
import { schools, admins, applications } from '../../database/schema'
import { grades, classes } from '../../database/schema'
import { useMainDb, useSchoolDb } from '../../database/db'
import { requireSuperAdmin, hashPasswordBcrypt } from '../../utils/auth'
import { createSchoolDb } from '../../utils/create-school-db'
import { EMAIL_RE, notifyApplicationResult } from '../../utils/mail'

/** 向申请人邮箱发送审核结果通知；邮箱无效或发信失败时返回说明，绝不抛出（不影响审核主流程） */
async function trySendApplicationEmail(opts: {
  application: any
  decision: 'approved' | 'rejected'
  vars: Record<string, string>
  loginUrl: string
}): Promise<{ sent: boolean; message: string }> {
  const email = (opts.application.contactEmail || '').trim()
  if (!email || !EMAIL_RE.test(email)) {
    return { sent: false, message: '申请人未填写有效邮箱，未发送通知邮件' }
  }
  try {
    await notifyApplicationResult({
      to: email,
      decision: opts.decision,
      vars: { ...opts.vars, loginUrl: opts.loginUrl },
    })
    return { sent: true, message: `已向 ${email} 发送通知邮件` }
  } catch (e: any) {
    return { sent: false, message: `通知邮件发送失败（不影响审核结果）：${e?.message || '未知错误'}` }
  }
}

export default defineEventHandler(async (event) => {
  const admin = await requireSuperAdmin(event)

  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const { status, reviewNote } = body

  if (status !== 'approved' && status !== 'rejected') {
    setResponseStatus(event, 400)
    return { success: false, message: 'status 必须是 approved 或 rejected' }
  }

  // 生成登录地址（用于审核通知邮件中的跳转链接，环境无关）
  const host = getRequestHeader(event, 'host') || 'localhost'
  const proto = getRequestHeader(event, 'x-forwarded-proto') || 'http'
  const loginUrl = `${proto}://${host}/login`

  const mainDb = useMainDb()

  try {
    const application = await mainDb
      .select()
      .from(applications)
      .where(eq(applications.id, id))
      .get()

    if (!application) {
      setResponseStatus(event, 404)
      return { success: false, message: '申请不存在' }
    }

    if (application.status !== 'pending') {
      setResponseStatus(event, 400)
      return { success: false, message: `该申请已${application.status === 'approved' ? '通过' : '拒绝'}，不能重复审核` }
    }

    if (status === 'rejected') {
      const result = await mainDb.update(applications)
        .set({
          status,
          reviewNote: reviewNote || null,
          reviewedBy: admin.id,
          reviewedAt: new Date().toISOString(),
        })
        .where(eq(applications.id, id))
        .returning()
        .all()

      // 向申请人邮箱发送驳回通知
      const email = await trySendApplicationEmail({
        application,
        decision: 'rejected',
        vars: {
          applicantName: application.applicantName,
          schoolName: application.schoolName,
          reason: reviewNote || '未填写具体原因',
        },
        loginUrl,
      })

      return { success: true, data: result[0], message: '已拒绝申请', loginUrl, email }
    }

    // ===== 审核通过 =====

    console.log(`[CSMS] 开始审核申请 ID=${id}, status=${status}`)
    
    // 1. 查找或创建学校（主库）
    console.log(`[CSMS] 步骤1: 查找或创建学校`)
    let schoolId: number | null = application.createdSchoolId
    if (!schoolId) {
      const existingSchool = await mainDb
        .select()
        .from(schools)
        .where(eq(schools.name, application.schoolName))
        .get()

      if (existingSchool) {
        schoolId = existingSchool.id
        console.log(`[CSMS] 找到已有学校 ID=${schoolId}`)
      } else {
        const [newSchool] = await mainDb.insert(schools)
          .values({ name: application.schoolName })
          .returning()
          .all()
        schoolId = newSchool.id
        console.log(`[CSMS] 已创建新学校 ID=${schoolId}`)
      }
    }

    // schoolId 必须存在才能继续
    if (!schoolId) {
      setResponseStatus(event, 500)
      return { success: false, message: '学校 ID 获取失败，请检查申请数据' }
    }

    console.log(`[CSMS] 步骤2: 创建学校库文件, schoolId=${schoolId}`)
    // 2. 创建学校库文件（含所有表）
    await createSchoolDb(schoolId)
    console.log(`[CSMS] 学校库文件已就绪`)

    console.log(`[CSMS] 步骤3: 连接学校库并创建年级/班级`)
    // 3. 连接学校库，创建年级/班级
    const schoolDb = await useSchoolDb(event, schoolId)
    console.log(`[CSMS] 学校库已连接`)
    let role: string
    let gradeId: number | null = null
    let classId: number | null = null

    if (application.className) {
      role = 'class_admin'
      const gradeName = (application.gradeName && application.gradeName.trim()) || '默认年级'
      console.log(`[CSMS] 审核class_admin申请: gradeName="${gradeName}", className="${application.className}"`)

      let grade = await schoolDb
        .select()
        .from(grades)
        .where(eq(grades.name, gradeName))
        .get()

      if (!grade) {
        console.log(`[CSMS] 年级"${gradeName}"不存在，创建新年级`)
        const [newGrade] = await schoolDb.insert(grades)
          .values({ name: gradeName })
          .returning()
          .all()
        grade = newGrade
      }
      console.log(`[CSMS] 绑定年级: id=${grade.id}, name=${grade.name}`)
      gradeId = grade.id

      let cls = await schoolDb
        .select()
        .from(classes)
        .where(and(eq(classes.gradeId, gradeId), eq(classes.name, application.className!)))
        .get()

      if (!cls) {
        console.log(`[CSMS] 班级"${application.className}"不存在，创建新班级`)
        const [newClass] = await schoolDb.insert(classes)
          .values({ gradeId, name: application.className! })
          .returning()
          .all()
        cls = newClass
      }
      console.log(`[CSMS] 绑定班级: id=${cls.id}, name=${cls.name}`)
      classId = cls.id

    } else if (application.gradeName) {
      role = 'grade_admin'
      let grade = await schoolDb
        .select()
        .from(grades)
        .where(eq(grades.name, application.gradeName))
        .get()

      if (!grade) {
        const [newGrade] = await schoolDb.insert(grades)
          .values({ name: application.gradeName })
          .returning()
          .all()
        grade = newGrade
      }
      gradeId = grade.id

    } else {
      role = 'school_admin'
    }

    // 4. 生成默认账号
    // 用户名规则：同一学校内唯一，不同学校可以重名
    // 基础用户名 = 申请人姓名（去掉空格，小写）
    const baseUsername = application.applicantName.replace(/\s+/g, '').toLowerCase()
    console.log(`[CSMS] 步骤4: 生成默认账号, baseUsername=${baseUsername}`)
    let defaultUsername = baseUsername

    // 检查 baseUsername 是否已被同一学校的管理员占用
    let conflict = await mainDb
      .select({ id: admins.id })
      .from(admins)
      .where(and(eq(admins.username, baseUsername), eq(admins.schoolId, schoolId)))
      .get()

    if (conflict) {
      // 一次性查询所有以此 baseUsername 开头的同校管理员用户名
      // 然后在内存中解析已使用的数字后缀，找出最小可用后缀
      const likePattern = `${baseUsername}%`
      const existing = await mainDb
        .select({ username: admins.username })
        .from(admins)
        .where(and(eq(admins.schoolId, schoolId), sql`${admins.username} LIKE ${likePattern}`))
        .all()

      const usedSuffixes = new Set(
        existing
          .map(a => a.username.slice(baseUsername.length))
          .filter(s => /^\d+$/.test(s))
          .map(Number)
      )

      let suffix = 2
      while (usedSuffixes.has(suffix)) {
        suffix++
      }
      defaultUsername = `${baseUsername}${suffix}`
      console.log(`[CSMS] baseUsername 冲突，使用带后缀的用户名: ${defaultUsername}`)
    }

    const defaultPassword = '123456'
    console.log(`[CSMS] 默认账号: username=${defaultUsername}`)

    console.log(`[CSMS] 步骤5: 创建管理员账号, role=${role}, gradeId=${gradeId}, classId=${classId}`)
    // 5. 创建管理员账号（主库）— 幂等：防止重复审核导致 UNIQUE 冲突
    let newAdminId: number
    let emailWarning: string | null = null

    // 申请邮箱自动绑定：若 contactEmail 合法且未被其他管理员占用，则创建时一并绑定
    let bindEmail: string | null = null
    const contactEmail = (application.contactEmail || '').trim()
    if (contactEmail && EMAIL_RE.test(contactEmail)) {
      const emailTaken = await mainDb
        .select({ id: admins.id })
        .from(admins)
        .where(eq(admins.email, contactEmail))
        .get()
      if (!emailTaken) {
        bindEmail = contactEmail
      } else {
        emailWarning = `申请邮箱 ${contactEmail} 已被其他管理员绑定，本次未自动绑定，请稍后在用户管理中手动设置`
      }
    }

    // 先检查是否已有同名管理员（可能是之前部分失败的审核创建的）
    const existingAdmin = await mainDb
      .select()
      .from(admins)
      .where(and(eq(admins.username, defaultUsername), eq(admins.schoolId, schoolId)))
      .get()

    if (existingAdmin) {
      // 管理员已存在，直接复用
      newAdminId = existingAdmin.id
    } else {
      const [newAdmin] = await mainDb.insert(admins)
        .values({
          username: defaultUsername,
          passwordHash: hashPasswordBcrypt(defaultPassword),
          role,
          schoolId,
          gradeId,
          classId,
          mustChangePassword: 1,
          email: bindEmail,
          emailBoundAt: bindEmail ? new Date().toISOString() : null,
        })
        .returning()
        .all()
      newAdminId = newAdmin.id
      console.log(`[CSMS] 已创建新管理员 ID=${newAdminId}${bindEmail ? ` 已绑定邮箱 ${bindEmail}` : ''}`)
    }

    console.log(`[CSMS] 步骤6: 更新申请记录`)
    // 6. 更新申请记录（主库）
    const result = await mainDb.update(applications)
      .set({
        status: 'approved',
        reviewNote: reviewNote || null,
        reviewedBy: admin.id,
        reviewedAt: new Date().toISOString(),
        createdSchoolId: schoolId,
        createdAdminId: newAdminId,
      })
      .where(eq(applications.id, id))
      .returning()
      .all()

    // 角色中文名（用于通知邮件展示）
    const roleLabelMap: Record<string, string> = {
      school_admin: '学校管理员',
      grade_admin: '年级管理员',
      class_admin: '班级管理员',
    }
    const roleLabel = roleLabelMap[role] || role

    // 7. 向申请人发送审核通过通知邮件（含账号凭据 + 学校 ID）
    const email = await trySendApplicationEmail({
      application,
      decision: 'approved',
      vars: {
        applicantName: application.applicantName,
        schoolName: application.schoolName,
        role: roleLabel,
        username: defaultUsername,
        password: defaultPassword,
        schoolId: String(schoolId),
      },
      loginUrl,
    })

    return {
      success: true,
      data: result[0],
      account: {
        username: defaultUsername,
        password: defaultPassword,
        role,
        school: application.schoolName,
        grade: application.gradeName || null,
        class: application.className || null,
      },
      emailWarning: emailWarning || undefined,
      loginUrl,
      email,
      message: emailWarning
        ? '审核通过，管理员账号已自动创建（邮箱未自动绑定，详见提示）'
        : '审核通过，管理员账号已自动创建',
    }

  } catch (error: any) {
    setResponseStatus(event, 500)
    // 暴露 libsql 底层错误原因（error.cause 包含 SQLite 错误码和描述）
    const cause = error.cause?.message || (typeof error.cause === 'string' ? error.cause : '')
    console.error('[CSMS] 审核申请失败:', {
      message: error.message,
      cause: cause,
      code: error.cause?.code,
    })
    return {
      success: false,
      message: error.message || 'Unknown error',
      cause: cause || undefined,
    }
  }
})
