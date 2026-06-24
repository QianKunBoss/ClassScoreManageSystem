import { eq } from 'drizzle-orm'
import { schools } from '../../database/schema'
import { useMainDb } from '../../database/db'
import { requireSuperAdmin } from '../../utils/auth'

// DELETE /api/schools/[id] — 删除学校（主库，同时删除学校 .db 文件）
export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const id = Number(getRouterParam(event, 'id'))

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: '无效的学校ID' })
  }

  const db = useMainDb()

  const school = await db.select().from(schools).where(eq(schools.id, id)).get()
  if (!school) {
    throw createError({ statusCode: 404, statusMessage: '学校不存在' })
  }

  // 删除学校库文件
  const dbPath = `data/schools/${id}.db`
  try {
    const fs = await import('fs')
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath)
    }
  } catch (_) {}

  // 删除主库中的学校记录（CASCADE 会自动处理 applications 等关联数据）
  await db.delete(schools).where(eq(schools.id, id))

  return { success: true, message: '学校已删除' }
})
