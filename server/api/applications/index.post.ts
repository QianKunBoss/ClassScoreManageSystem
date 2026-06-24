import { applications } from '../../database/schema'
import { schools, admins } from '../../database/schema'
import { useMainDb } from '../../database/db'
import { useSchoolDb } from '../../database/db'
import { grades, classes } from '../../database/schema.school'
import { eq, and } from 'drizzle-orm'

/**
 * 计算申请层级：全校=3 > 年级=2 > 班级=1
 */
function getScopeLevel(gradeName: string | null, className: string | null): number {
  if (className) return 1  // 班级
  if (gradeName) return 2  // 年级
  return 3              // 全校
}

// 从 admin role 计算层级
function getRoleLevel(role: string): number {
  switch (role) {
    case 'class_admin': return 1
    case 'grade_admin': return 2
    default: return 3  // school_admin / super_admin
  }
}

// POST /api/applications — 提交入驻申请（主库，公开接口）
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const {
    schoolName,
    gradeName,
    className,
    applicantName,
    contactPhone,
    contactEmail,
    reason,
  } = body

  if (!schoolName || !applicantName) {
    setResponseStatus(event, 400)
    return { success: false, message: '校名和申请人姓名为必填项' }
  }

  const db = useMainDb()
  const newLevel = getScopeLevel(gradeName || null, className || null)

  // ===== 冲突检测：同校名已有记录 =====
  // 1. 查已通过申请并创建学校的记录（最准确：看实际学校的 admin 管辖范围）
  const existingSchool = await db.select().from(schools).where(
    eq(schools.name, schoolName)
  ).get()

  if (existingSchool) {
    // 查该校所有管理员
    const schoolAdmins = await db.select().from(admins).where(
      eq(admins.schoolId, existingSchool.id)
    ).all()

    let blocked = false
    let blockMessage = ''
    let existingScope = ''

    if (newLevel === 3) {
      // 学校申请：只要学校有任意管理员，就拦截
      if (schoolAdmins.length > 0) {
        blocked = true
        blockMessage = `该校已有管理员，请勿重复申请全校管理权限。`
        existingScope = '全校'
      }
    } else if (newLevel === 2 && gradeName) {
      // 年级申请：只检查是否有同年级的年级管理员
      const schoolDb = await useSchoolDb(event, existingSchool.id)
      const gradeRecord = await schoolDb.select().from(grades).where(
        eq(grades.name, gradeName)
      ).get()

      if (gradeRecord) {
        const sameGradeAdmin = schoolAdmins.find(
          a => a.role === 'grade_admin' && a.gradeId === gradeRecord.id
        )
        if (sameGradeAdmin) {
          blocked = true
          blockMessage = `该校的${gradeName}已有年级管理员，请勿重复申请。`
          existingScope = '年级'
        }
        // 如果没有同年级的管理员，则允许申请（即使有其他年级的管理员）
      }
      // 如果年级不存在于学校库中，也允许申请（由超级管理员审核时处理）
    } else if (newLevel === 1 && gradeName && className) {
      // 班级申请：检查是否有同班级的管理员（班级管理员 或 同年级的年级管理员）
      const schoolDb = await useSchoolDb(event, existingSchool.id)
      const gradeRecord = await schoolDb.select().from(grades).where(
        eq(grades.name, gradeName)
      ).get()

      if (gradeRecord) {
        const classRecord = await schoolDb.select().from(classes).where(
          and(
            eq(classes.gradeId, gradeRecord.id),
            eq(classes.name, className)
          )
        ).get()

        if (classRecord) {
          const sameClassAdmin = schoolAdmins.find(
            a => a.role === 'class_admin' && a.classId === classRecord.id
          )
          const sameGradeAdmin = schoolAdmins.find(
            a => a.role === 'grade_admin' && a.gradeId === gradeRecord.id
          )
          if (sameClassAdmin || sameGradeAdmin) {
            blocked = true
            blockMessage = `该校的${gradeName}${className}已有管理员，请勿重复申请。`
            existingScope = sameClassAdmin ? '班级' : '年级'
          }
        }
      }
    }

    if (blocked) {
      // 尝试获取联系信息（从最新申请记录中）
      const latestApp = await db.select().from(applications).where(
        eq(applications.schoolName, schoolName)
      ).orderBy(applications.createdAt).all().then(rows => rows[rows.length - 1])

      setResponseStatus(event, 200)
      return {
        success: false,
        code: 'EXISTING_SCHOOL',
        message: blockMessage,
        contact: {
          applicantName: latestApp?.applicantName || undefined,
          contactPhone: latestApp?.contactPhone || null,
          contactEmail: latestApp?.contactEmail || null,
          schoolName: existingSchool.name,
          existingScope,
        }
      }
    }
    // 未被拦截，正常走申请流程
  }

  // 2. 查 applications 表中同校名的申请记录（含 pending/approved/rejected）
  const existingApps = await db.select().from(applications).where(
    eq(applications.schoolName, schoolName)
  ).orderBy(applications.createdAt).all()

  if (existingApps.length > 0) {
    const latestApp = existingApps[existingApps.length - 1]
    const existingLevel = getScopeLevel(latestApp.gradeName, latestApp.className)

    // 同样按具体年级/班级精确比对
    let blocked = false
    let blockMessage = ''

    if (newLevel === 3) {
      if (existingLevel >= 3) {
        blocked = true
        blockMessage = `该校已有全校范围的入驻申请记录。`
      }
    } else if (newLevel === 2 && gradeName) {
      if (existingLevel >= 2 && latestApp.gradeName === gradeName) {
        blocked = true
        blockMessage = `该校的${gradeName}已有入驻申请记录。`
      }
    } else if (newLevel === 1 && gradeName && className) {
      if (existingLevel >= 1 && latestApp.gradeName === gradeName && latestApp.className === className) {
        blocked = true
        blockMessage = `该校的${gradeName}${className}已有入驻申请记录。`
      }
    }

    if (blocked) {
      setResponseStatus(event, 200)
      return {
        success: false,
        code: 'EXISTING_APPLICATION',
        message: blockMessage + '您的申请范围小于或等于已有申请，请先联系申请人。',
        contact: {
          applicantName: latestApp.applicantName,
          contactPhone: latestApp.contactPhone || null,
          contactEmail: latestApp.contactEmail || null,
          schoolName: latestApp.schoolName,
          existingScope: existingLevel === 3 ? '全校' : existingLevel === 2 ? '年级' : '班级',
        }
      }
    }
    // 未被拦截，正常走申请流程
  }

  // ===== 无冲突 → 正常提交 =====
  try {
    const result = await db.insert(applications).values({
      schoolName,
      gradeName: gradeName || null,
      className: className || null,
      applicantName,
      contactPhone: contactPhone || null,
      contactEmail: contactEmail || null,
      reason: reason || null,
      status: 'pending',
    }).returning().all()
    return { success: true, data: result[0] }
  } catch (error: any) {
    setResponseStatus(event, 500)
    return { success: false, message: error.message }
  }
})
