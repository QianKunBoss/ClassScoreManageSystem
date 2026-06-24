import { eq } from 'drizzle-orm'
import { systemSettings } from '../../database/schema'
import { useMainDb } from '../../database/db'
import { requireSuperAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID 必填' })
  }

  const db = useMainDb()

  const existing = await db.select()
    .from(systemSettings)
    .where(eq(systemSettings.id, Number(id)))
    .get()

  if (!existing) {
    throw createError({ statusCode: 404, message: '设置项不存在' })
  }

  await db.delete(systemSettings)
    .where(eq(systemSettings.id, Number(id)))
    .run()

  return {
    success: true,
    message: '删除成功',
  }
})
