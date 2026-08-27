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
  const { settingKey, settingValue, description, value } = body

  // 兼容旧调用方误用 `value` 字段，统一归一到 settingValue
  const incomingValue = settingValue !== undefined ? settingValue : value

  // 三个可更新字段全缺省时明确报错，避免静默保持原值
  if (settingKey === undefined && incomingValue === undefined && description === undefined) {
    throw createError({ statusCode: 400, message: '未提供任何可更新的字段' })
  }

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
      settingValue: incomingValue !== undefined ? incomingValue : existing.settingValue,
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
