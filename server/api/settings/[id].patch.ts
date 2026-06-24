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

  const body = await readBody(event)
  const { settingKey, settingValue, description } = body

  const db = useMainDb()

  const existing = await db.select()
    .from(systemSettings)
    .where(eq(systemSettings.id, Number(id)))
    .get()

  if (!existing) {
    throw createError({ statusCode: 404, message: '设置项不存在' })
  }

  const result = await db.update(systemSettings)
    .set({
      settingKey: settingKey || existing.settingKey,
      settingValue: settingValue !== undefined ? settingValue : existing.settingValue,
      description: description !== undefined ? description : existing.description,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(systemSettings.id, Number(id)))
    .returning()
    .get()

  return {
    success: true,
    data: result,
    message: '更新成功',
  }
})
