import { useMainDb, getSchoolRawClient, getMainRawClient } from '../../database/db'
import { requireSuperAdmin, getSchoolIdFromRequest } from '../../utils/auth'
import { createSchoolDb } from '../../utils/create-school-db'
import { restoreDb } from '../../utils/backup'

// POST /api/data/restore — 从备份文件恢复数据（破坏性操作）
// body: { backup: <bundle>, confirm: true }
// 超管：恢复主库 + 全部学校；校管：仅能恢复本校（校验 schoolId 匹配）
export default defineEventHandler(async (event) => {
  const admin = await requireSuperAdmin(event)
  const isSuper = admin.role === 'super_admin'
  const body = await readBody(event)
  const backup = (body as any)?.backup ?? body

  if (!backup || !Array.isArray((backup as any).schools)) {
    throw createError({ statusCode: 400, message: '无效的备份文件（缺少 schools 数据）' })
  }
  if (!(body as any).confirm) {
    throw createError({ statusCode: 400, message: '请确认执行恢复操作' })
  }

  let restoredSchools = 0, restoredTables = 0, restoredRows = 0

  if (isSuper) {
    if ((backup as any).main && Array.isArray((backup as any).main)) {
      const mainClient = getMainRawClient()
      const r = await restoreDb(mainClient, (backup as any).main)
      restoredTables += r.tables
      restoredRows += r.rows
    }
    for (const sc of (backup as any).schools) {
      await createSchoolDb(sc.schoolId)
      const client = await getSchoolRawClient(event, sc.schoolId)
      const r = await restoreDb(client, sc.tables || [])
      restoredSchools++
      restoredTables += r.tables
      restoredRows += r.rows
    }
  } else {
    const sid = await getSchoolIdFromRequest(event)
    const own = (backup as any).schools.find((s: any) => s.schoolId === sid)
    if (!own) throw createError({ statusCode: 403, message: '备份文件不包含您管理的学校，已拒绝恢复' })
    if ((backup as any).schools.length > 1) throw createError({ statusCode: 403, message: '非超管只能恢复本校数据' })
    if ((backup as any).main) throw createError({ statusCode: 403, message: '非超管不能恢复主库数据' })

    await createSchoolDb(sid)
    const client = await getSchoolRawClient(event, sid)
    const r = await restoreDb(client, own.tables || [])
    restoredSchools = 1
    restoredTables += r.tables
    restoredRows += r.rows
  }

  return { success: true, restoredSchools, restoredTables, restoredRows }
})
