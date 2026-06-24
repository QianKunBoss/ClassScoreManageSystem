#!/usr/bin/env node
/**
 * 迁移：允许不同学校管理员用户名重复
 * - 删除 admins.username 全局唯一约束
 * - 添加 (username, school_id) 联合唯一约束（同一学校内用户名唯一）
 *
 * 用法：node scripts/migrate-allow-duplicate-usernames.mjs
 */

import path from 'path'
import { createClient } from '@libsql/client'
import fs from 'fs'

const mainDbPath = path.join(process.cwd(), 'data', 'csms.db')
if (!fs.existsSync(mainDbPath)) {
  console.error('主库不存在：', mainDbPath)
  process.exit(1)
}

const client = createClient({ url: `file:${mainDbPath}` })

async function main() {
  console.log('开始迁移：允许不同学校用户名重复...\n')

  // 1. 查看当前 admins 表的索引
  const indexes = await client.execute(`
    SELECT name, sql FROM sqlite_master
    WHERE type = 'index' AND tbl_name = 'admins'
  `)
  console.log('当前 admins 表索引：')
  for (const row of indexes.rows) {
    console.log(' -', row.name, row.sql || '')
  }

  // 2. 删除旧的 username 唯一索引（Drizzle 命名规则：table_column_unique）
  try {
    await client.execute(`DROP INDEX IF EXISTS admins_username_unique`)
    console.log('\n已删除旧索引：admins_username_unique')
  } catch (e) {
    console.log('删除旧索引失败（可能不存在）：', e.message)
  }

  // 3.  also try dropping by the new naming convention (in case it was already migrated)
  try {
    await client.execute(`DROP INDEX IF EXISTS admins_username_school_unq`)
    console.log('已删除旧索引：admins_username_school_unq')
  } catch (e) {
    // ignore
  }

  // 4. 确保 school_id 列存在（防御性检查）
  const columns = await client.execute(`PRAGMA table_info(admins)`)
  const hasSchoolId = columns.rows.some(r => r.name === 'school_id')
  if (!hasSchoolId) {
    console.log('添加 school_id 列...')
    await client.execute(`ALTER TABLE admins ADD COLUMN school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE`)
  }

  // 5. 对于已有的数据：将所有 school_id 为 NULL 的记录的 school_id 设为 0（超级管理员标记）
  //    这样 (username, school_id) 联合唯一才能正确约束超级管理员
  //    实际上：SQLite 中 NULL 不参与唯一约束，所以需要特殊处理
  //    方案：超级管理员的 school_id 设为 0（一个不存在的学校 ID），这样唯一约束能生效
  //    或者：保留 NULL，在应用层保证超级管理员用户名唯一
  //    这里选择：应用层保证，数据库层只保证 (username, school_id) 唯一（NULL 值不冲突）

  // 6. 创建新的联合唯一索引
  //    注意：SQLite 中 (username, school_id) 唯一索引允许多个 (xxx, NULL) 行
  //    所以超级管理员（school_id=NULL）的用户名唯一性需要在应用层保证
  await client.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS admins_username_school_unq
    ON admins(username, school_id)
  `)
  console.log('已创建联合唯一索引：admins_username_school_unq (username, school_id)')

  // 7. 验证新索引
  const newIndexes = await client.execute(`
    SELECT name, sql FROM sqlite_master
    WHERE type = 'index' AND tbl_name = 'admins'
  `)
  console.log('\n迁移后 admins 表索引：')
  for (const row of newIndexes.rows) {
    console.log(' -', row.name, row.sql || '')
  }

  console.log('\n✅ 迁移完成！')
  console.log('说明：')
  console.log('  - 不同学校的管理员可以使用相同用户名')
  console.log('  - 同一学校内用户名仍然唯一')
  console.log('  - 超级管理员（school_id=NULL）用户名需在应用层保证唯一')
}

main().catch(err => {
  console.error('迁移失败：', err)
  process.exit(1)
})
