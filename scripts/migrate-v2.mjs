// 必须在项目根目录下运行： node scripts/migrate-v2.mjs
import { createClient } from '@libsql/client'

const dbPath = './data/csms.db'
console.log('数据库路径:', dbPath)

const client = createClient({ url: `file:${dbPath}` })

async function migrate() {
  try {
    console.log('检查 applications 表字段...')
    const tableInfo = await client.execute('PRAGMA table_info(applications)')
    const columns = tableInfo.rows.map(r => r.name)
    console.log('当前字段:', columns.join(', '))

    const migrations = []

    if (!columns.includes('created_school_id')) {
      migrations.push('ALTER TABLE applications ADD COLUMN created_school_id INTEGER REFERENCES schools(id)')
    }
    if (!columns.includes('created_admin_id')) {
      migrations.push('ALTER TABLE applications ADD COLUMN created_admin_id INTEGER REFERENCES admins(id)')
    }

    if (migrations.length === 0) {
      console.log('✅ 无需迁移')
    } else {
      console.log('\n执行迁移:')
      for (const sql of migrations) {
        console.log('  -', sql)
        await client.execute(sql)
      }
      console.log('✅ 迁移完成\n')
    }

    // 验证
    const newTableInfo = await client.execute('PRAGMA table_info(applications)')
    console.log('完成后字段:')
    newTableInfo.rows.forEach(r => {
      console.log(`  - ${r.name} (${r.type})`)
    })

  } catch (error) {
    console.error('❌ 失败:', error.message)
  } finally {
    client.close()
  }
}

migrate()
