import { eq } from 'drizzle-orm'
import { systemSettings } from '../../database/schema'
import { useMainDb } from '../../database/db'
import { requireSuperAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)

  const db = useMainDb()
  const settings = await db.select().from(systemSettings).all()

  return {
    success: true,
    data: settings,
  }
})
