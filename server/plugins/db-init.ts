import { initDatabase } from '../database/init'

export default defineNitroPlugin(async () => {
  await initDatabase()
})
