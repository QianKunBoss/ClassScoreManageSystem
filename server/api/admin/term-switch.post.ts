import { requireAdmin, getSchoolIdFromRequest, verifyAdminPassword } from '../../utils/auth'
import { useSchoolDb, getSchoolRawClient } from '../../database/db'

// POST /api/admin/term-switch — 新学期切换（清空学校库数据）
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)
  const client = await getSchoolRawClient(event, schoolId)

  const body = await readBody(event) as {
    password: string
    keepUsers?: boolean
    keepRecords?: boolean
  }

  if (!body.password) {
    throw createError({ statusCode: 400, statusMessage: '请输入管理员密码进行确认' })
  }

  const valid = await verifyAdminPassword(admin.id, body.password)
  if (!valid) {
    throw createError({ statusCode: 403, statusMessage: '密码错误' })
  }

  await client.execute('BEGIN TRANSACTION')

  try {
    if (!body.keepUsers) {
      await client.execute('DELETE FROM users')
      await client.execute(`DELETE FROM sqlite_sequence WHERE name = "users"`)
    }

    if (!body.keepRecords) {
      await client.execute('DELETE FROM score_logs')
      await client.execute(`DELETE FROM sqlite_sequence WHERE name = "score_logs"`)
    }

    await client.execute('COMMIT')
    return { success: true, message: '新学期切换成功' }
  } catch (e) {
    await client.execute('ROLLBACK')
    throw createError({ statusCode: 500, statusMessage: '操作失败' })
  }
})
