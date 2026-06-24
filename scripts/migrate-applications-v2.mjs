// 用相对路径绕过中文路径问题
import { createClient } from '@libsql/client'
import { fileURLToPath } from 'url'
import path from 'path'
import { chdir } from 'process'

// 切换到项目根目录
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
chdir(path.resolve(__dirname, '../..')) // 切到项目根目录

console.log('工作目录:', process.cwd())

const client = createClient({ url: 'file:./data/csms.db' })

async function migrate() {
  try {
    console.log('开始迁移 applications 表...\n')

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
      console.log('✅ applications 表已是最新结构，无需迁移')
    } else {
      console.log('\n执行迁移:')
      for (const sql of migrations) {
        console.log('  -', sql)
        await client.execute(sql)
      }
      console.log('✅ 迁移完成\n')
    }

    const newTableInfo = await client.execute('PRAGMA table_info(applications)')
    console.log('迁移后 applications 表字段:')
    newTableInfo.rows.forEach(r => {
      console.log(`  - ${r.name} (${r.type})`)
    })

  } catch (error) {
    console.error('❌ 迁移失败:', error.message)
  } finally {
    client.close()
  }
}

migrate()
