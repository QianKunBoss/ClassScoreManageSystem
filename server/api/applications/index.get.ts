import { applications } from '../../database/schema'
import { useMainDb } from '../../database/db'
import { eq } from 'drizzle-orm'

// GET /api/applications — 获取申请列表（主库，公开接口）
export default defineEventHandler(async (event) => {
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
