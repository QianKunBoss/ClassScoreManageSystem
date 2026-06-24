import { eq, desc, sql } from 'drizzle-orm'
import { admins } from '../../database/schema'
import { useMainDb } from '../../database/db'
import { requireAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const db = useMainDb()

  const adminList = await db
    .select({
      id: admins.id,
      username: admins.username,
      createdAt: admins.createdAt,
      lastLogin: admins.lastLogin,
      hasToken: sql<boolean>`${admins.apiToken} is not null`,
    })
    .from(admins)
    .orderBy(desc(admins.createdAt))
    .all()

  // 标记当前管理员
  const formatted = adminList.map(a => ({
    ...a,
    isCurrent: a.id === admin.id,
  }))

  return { data: formatted }
})
