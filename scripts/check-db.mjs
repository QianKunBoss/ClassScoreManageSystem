import { createClient } from '@libsql/client'

const client = createClient({ url: 'file:./data/csms.db' })
await client.execute('PRAGMA journal_mode = WAL')

// 检查所有表
const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table'")
console.log('=== 数据库中的表 ===')
tables.rows.forEach(r => console.log(r.name))

// 检查 admins 表结构
try {
  const columns = await client.execute('PRAGMA table_info(admins)')
  console.log('\n=== admins 表结构 ===')
  columns.rows.forEach(r => console.log(`  ${r.name} (${r.type})`))
} catch(e) {
  console.error('读取 admins 表结构失败:', e.message)
}

// 检查 admins 表是否有数据
try {
  const admins = await client.execute('SELECT id, username, role FROM admins')
  console.log('\n=== admins 数据 ===')
  console.log(JSON.stringify(admins.rows, null, 2))
} catch(e) {
  console.error('查询 admins 失败:', e.message)
}

process.exit(0)
