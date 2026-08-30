import { eq, sql } from 'drizzle-orm'
import { schools, admins, applications, announcements } from '../../database/schema'
import { useMainDb } from '../../database/db'
import { requireSuperAdmin, verifyAdminPassword } from '../../utils/auth'
import { getHeader, getQuery } from 'h3'

// DELETE /api/schools/[id] — 删除学校（超级管理员，需二次密码确认）
//   ?deleteData=1  → 同时物理删除该校数据库文件 data/schools/{id}.db（用户/班级/年级/积分全部清除）
//   ?deleteData=0  → 仅删除主库学校记录，保留数据文件（可恢复，默认）
//   密码通过 x-confirm-password 头传递（与 grades/classes/users 删除保持一致）
export default defineEventHandler(async (event) => {
  const admin = await requireSuperAdmin(event)
  const id = Number(getRouterParam(event, 'id'))

  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: '无效的学校ID' })
  }

  // 二次密码确认（防止 CSRF / 误触）
  const confirmPassword = getHeader(event, 'x-confirm-password')
  if (!confirmPassword) {
    throw createError({ statusCode: 400, message: '需要提供确认密码' })
  }
  const passwordValid = await verifyAdminPassword(admin.id, confirmPassword as string)
  if (!passwordValid) {
    throw createError({ statusCode: 403, message: '管理员密码错误，删除已取消' })
  }

  const query = getQuery(event)
  const deleteData = query.deleteData === '1' || query.deleteData === 1

  const db = useMainDb()

  const school = await db.select().from(schools).where(eq(schools.id, id)).get()
  if (!school) {
    throw createError({ statusCode: 404, message: '学校不存在' })
  }

  // 包括所有数据：物理删除该校数据库文件
  if (deleteData) {
    const dbPath = `data/schools/${id}.db`
    try {
      const fs = await import('fs')
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
    } catch (_) {
      // 文件删除失败不阻断主库记录删除，仅记录告警
      console.warn(`[CSMS] 删除学校 ${id} 的数据文件失败：${dbPath}`)
    }
  }

  // 删除学校前，先解绑所有可能引用该校的外键，避免 FK 约束拒绝删除。
  // 注意：applications.created_school_id / reviewed_by / created_admin_id、
  //       announcements.created_by 这些外键在库里都没有配 ON DELETE CASCADE，
  //       这里采用「置空脱钩」而非级联删除，以保留申请/公告等审计记录。
  await db.transaction(async (tx) => {
    // 1) 解绑该校的管理员引用：把指向这些管理员的字段置空
    await tx
      .update(applications)
      .set({ reviewedBy: null })
      .where(sql`reviewed_by IN (SELECT id FROM admins WHERE school_id = ${id})`)
    await tx
      .update(applications)
      .set({ createdAdminId: null })
      .where(sql`created_admin_id IN (SELECT id FROM admins WHERE school_id = ${id})`)
    await tx
      .update(announcements)
      .set({ createdBy: null })
      .where(sql`created_by IN (SELECT id FROM admins WHERE school_id = ${id})`)

    // 2) 解绑该校本身在 applications 上的引用（保留申请记录，仅脱钩）
    //    先把原 created_school_id 复制进 deleted_school_id 快照列（绕开 FK 约束），
    //    再置空 created_school_id 并标记 school_deleted=1：
    //    审核通过的申请将在「入驻申请」页展示黄色「已删除」标签，且仍能看到原学校 ID。
    await tx
      .update(applications)
      .set({ createdSchoolId: null, deletedSchoolId: sql`created_school_id`, schoolDeleted: 1 })
      .where(eq(applications.createdSchoolId, id))

    // 3) 删除该校管理员账号（school_id 外键已配 CASCADE，这里显式删除以彻底解绑）
    await tx.delete(admins).where(eq(admins.schoolId, id))

    // 4) 最后删除学校记录
    await tx.delete(schools).where(eq(schools.id, id))
  })

  return {
    success: true,
    message: deleteData ? '学校及其全部数据已删除' : '学校已删除，数据文件已保留',
    deletedData: deleteData,
  }
})
