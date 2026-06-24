import { eq } from 'drizzle-orm'
import { systemSettings } from '../../database/schema'
import { useMainDb } from '../../database/db'
import { requireSuperAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)

  const body = await readBody(event)
  const { settingKey, settingValue, description } = body

  if (!settingKey) {
    throw createError({ statusCode: 400, message: 'settingKey 必填' })
  }

  const db = useMainDb()

  const existing = await db.select()
    .from(systemSettings)
    .where(eq(systemSettings.settingKey, settingKey))
    .get()

  if (existing) {
    throw createError({ statusCode: 409, message: '设置项已存在' })
  }

  const result = await db.insert(systemSettings)
    .values({
      settingKey,
      settingValue: settingValue || '',
      description: description || '',
    })
    .returning()
    .get()

  return {
    success: true,
    data: result,
    message: '创建成功',
  }
})
