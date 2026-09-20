import { eq } from 'drizzle-orm'
import { useMainDb, getSchoolRawClient, getMainRawClient } from '../../database/db'
import { schools } from '../../database/schema.main'
import { requireSuperAdmin, getSchoolIdFromRequest } from '../../utils/auth'
import { dumpDb } from '../../utils/backup'

// POST /api/data/backup — 一键备份
// 超管：导出主库 + 全部学校库（整机备份，可用于迁移）；校管：仅导出本校库
export default defineEventHandler(async (event) => {
  const admin = await requireSuperAdmin(event)
  const isSuper = admin.role === 'super_admin'
  const mainDb = useMainDb()

  const schoolsData: any[] = []
  if (isSuper) {
    const list = await mainDb.select({ id: schools.id, name: schools.name }).from(schools)
    for (const sc of list) {
      const client = await getSchoolRawClient(event, sc.id)
      schoolsData.push({ schoolId: sc.id, name: sc.name, tables: await dumpDb(client) })
    }
    const mainClient = getMainRawClient()
    const bundle = {
      meta: {
        app: 'ClassFire', version: 1, type: 'full',
        exportedAt: new Date().toISOString(), generatedBy: admin.username,
      },
      main: await dumpDb(mainClient),
      schools: schoolsData,
    }
    setResponseHeader(event, 'Content-Type', 'application/json')
    setResponseHeader(event, 'Content-Disposition', `attachment; filename="classfire-backup-full-${new Date().toISOString().slice(0, 10)}.json"`)
    return bundle
  }

  // 非超管：仅本校
  const sid = await getSchoolIdFromRequest(event)
  const s = await mainDb.select({ id: schools.id, name: schools.name }).from(schools).where(eq(schools.id, sid)).get()
  const client = await getSchoolRawClient(event, sid)
  schoolsData.push({ schoolId: sid, name: s?.name || '', tables: await dumpDb(client) })
  const bundle = {
    meta: {
      app: 'ClassFire', version: 1, type: 'school', schoolId: sid,
      exportedAt: new Date().toISOString(), generatedBy: admin.username,
    },
    schools: schoolsData,
  }
  setResponseHeader(event, 'Content-Type', 'application/json')
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="classfire-backup-school-${sid}-${new Date().toISOString().slice(0, 10)}.json"`)
  return bundle
})
