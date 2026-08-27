import { systemSettings } from '../../database/schema.main'
import { useMainDb } from '../../database/db'
import { inArray } from 'drizzle-orm'

// GET /api/settings/public — 获取公开展示设置（导航栏标题、系统标题、开关等）
export default defineEventHandler(async (event) => {
  const db = useMainDb()

  const rows = await db
    .select({
      key: systemSettings.settingKey,
      value: systemSettings.settingValue,
    })
    .from(systemSettings)
    .where(inArray(systemSettings.settingKey, ['nav_title', 'system_title', 'show_ranking']))
    .all()

  const settings: Record<string, string> = {}
  for (const row of rows) {
    if (row.value != null) settings[row.key] = row.value
  }

  return { success: true, data: settings }
})
