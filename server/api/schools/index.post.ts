import { useMainDb } from '../../database/db'
import { schools } from '../../database/schema'
import { eq } from 'drizzle-orm'
import { requireSuperAdmin } from '../../utils/auth'

// POST /api/schools — 创建学校（主库，仅 super_admin）
export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)

  const body = await readBody(event)
  const { name } = body

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw createError({ statusCode: 400, statusMessage: '学校名称不能为空' })
  }

  const db = useMainDb()

  // 检查重名
  const existing = await db.select().from(schools).where(eq(schools.name, name.trim())).get()
  if (existing) {
    throw createError({ statusCode: 400, statusMessage: '学校名称已存在' })
  }

  const result = await db.insert(schools).values({ name: name.trim() }).returning().get()
  return { success: true, data: result }
})
