import { users } from '../../database/schema'
import { getSchoolRawClient } from '../../database/db'
import { requireAdmin, getSchoolIdFromRequest } from '../../utils/auth'
import { eq, like } from 'drizzle-orm'

// GET /api/users/search?q=xxx — 搜索学生（学校库）
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const client = getSchoolRawClient(event, schoolId)

  const query = getQuery(event) as { q?: string }
  const keyword = (query.q || '').trim()

  if (!keyword) {
    return { data: [] }
  }

  const pattern = `%${keyword.replace(/'/g, "''")}%`

  const result = await client.execute({
    sql: `SELECT id, username, actual_name
          FROM users
          WHERE username LIKE ? OR actual_name LIKE ?
          ORDER BY username
          LIMIT 20`,
    args: [pattern, pattern],
  })

  return { data: result.rows as any[] }
})
