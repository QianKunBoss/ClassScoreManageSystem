// 数据库迁移脚本：给 schools 和 admins 表添加 disabled 字段
import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.resolve(__dirname, '../data/main.db')

console.log('正在连接数据库：', dbPath)
const db = new Database(dbPath)

try {
  // 检查 schools 表是否有 disabled 字段
  const schoolsColumns = db.prepare("PRAGMA table_info(schools)").all()
  const hasSchoolDisabled = schoolsColumns.some((col: any) => col.name === 'disabled')
  
  if (!hasSchoolDisabled) {
    console.log('给 schools 表添加 disabled 字段...')
    db.exec('ALTER TABLE schools ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0')
    console.log('✅ schools 表已添加 disabled 字段')
  } else {
    console.log('ℹ️  schools 表已有 disabled 字段，跳过')
  }
  
  // 检查 admins 表是否有 disabled 字段
  const adminsColumns = db.prepare("PRAGMA table_info(admins)").all()
  const hasAdminDisabled = adminsColumns.some((col: any) => col.name === 'disabled')
  
  if (!hasAdminDisabled) {
    console.log('给 admins 表添加 disabled 字段...')
    db.exec('ALTER TABLE admins ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0')
    console.log('✅ admins 表已添加 disabled 字段')
  } else {
    console.log('ℹ️  admins 表已有 disabled 字段，跳过')
  }
  
  console.log('✅ 迁移完成')
} catch (err) {
  console.error('❌ 迁移失败：', err)
  process.exit(1)
} finally {
  db.close()
}
