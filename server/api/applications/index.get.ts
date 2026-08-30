import { applications } from '../../database/schema'
import { useMainDb } from '../../database/db'
import { eq } from 'drizzle-orm'
import { requireSuperAdmin } from '../../utils/auth'

// GET /api/applications — 获取申请列表（主库，仅超级管理员可访问，含申请人隐私信息）
export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const db = useMainDb()
  const query = getQuery(event) as { status?: string }

  let apps
  if (query.status) {
    apps = await db
      .select()
      .from(applications)
      .where(eq(applications.status, query.status))
      .orderBy(applications.id)
  } else {
    apps = await db
      .select()
      .from(applications)
      .orderBy(applications.id)
  }

  return { success: true, data: apps }
})
