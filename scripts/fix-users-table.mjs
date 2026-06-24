import { createClient } from '@libsql/client'
import path from 'path'
import { fileURLToPath } from 'url'

const dbPath = path.join(process.cwd(), 'data', 'csms.db')
const client = createClient({ url: `file:${dbPath}` })

const cols = [
  'total_score INTEGER NOT NULL DEFAULT 0',
  'add_score INTEGER NOT NULL DEFAULT 0',
  'deduct_score INTEGER NOT NULL DEFAULT 0',
  'score_count INTEGER NOT NULL DEFAULT 0',
]

for (const col of cols) {
  const name = col.split(' ')[0]
  const check = await client.execute(`PRAGMA table_info(users)`)
  const exists = check.rows.some(r => r.name === name)
  if (!exists) {
    await client.execute(`ALTER TABLE users ADD COLUMN ${col}`)
    console.log(`✅ 已添加字段: ${name}`)
  } else {
    console.log(`⚠️ 字段已存在: ${name}`)
  }
}

await client.close()
console.log('完成')
