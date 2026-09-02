import { initDatabase } from '../database/init'
import { migrateAllSchoolDbs } from '../database/db'

export default defineNitroPlugin(async () => {
  // 主库建表 + 结构迁移（IF NOT EXISTS / ALTER ADD COLUMN）
  await initDatabase()
  // 启动期一次性把磁盘上所有学校库迁移到最新结构，
  // 弥补 useSchoolDb 懒迁移对"长期未访问学校库"覆盖不到的问题
  await migrateAllSchoolDbs()
})
