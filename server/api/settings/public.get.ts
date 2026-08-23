import { systemSettings } from '../../database/schema.main'
import { useMainDb } from '../../database/db'
import { eq } from 'drizzle-orm'

// GET /api/settings/public — 获取公开设置（学生端可用）
export default defineEventHandler(async (event) => {
  const db = useMainDb()

  const rows = await db
    .select({
      key: systemSettings.settingKey,
      value: systemSettings.settingValue,
    })
    .from(systemSettings)
    .where(
      eq(systemSettings.settingKey, 'show_ranking'),
      // 只返回对学生有意义的设置
    )
    .all()

  const settings: Record<string, string> = {}
  for (const row of rows) {
    settings[row.key] = row.value
  }

  return { success: true, data: settings }
})
