#!/usr/bin/env node
import { createClient } from '@libsql/client'
import fs from 'fs'
import path from 'path'

const dbPath = path.join(process.cwd(), 'data', 'csms.db')
console.log('数据库路径:', dbPath)

if (!fs.existsSync(dbPath)) {
  console.error('数据库文件不存在！请先运行 scripts/init-db.mjs')
  process.exit(1)
}

const client = createClient({ url: `file:${dbPath}` })

async function migrate() {
  try {
    // 检查 applications 表是否存在
    const tables = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='applications'"
    )
    
    if (tables.rows.length === 0) {
      console.log('创建 applications 表...')
      await client.execute(`
        CREATE TABLE applications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          school_name TEXT NOT NULL,
          grade_name TEXT,
          class_name TEXT,
          applicant_name TEXT NOT NULL,
          contact_phone TEXT,
          contact_email TEXT,
          reason TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          review_note TEXT,
          reviewed_by INTEGER REFERENCES admins(id),
          reviewed_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `)
      console.log('✅ applications 表创建成功')
    } else {
      console.log('✅ applications 表已存在')
    }
    
    console.log('\n迁移完成！')
  } catch (error) {
    console.error('❌ 迁移失败:', error.message)
    throw error
  } finally {
    client.close()
  }
}

migrate()
