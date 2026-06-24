#!/usr/bin/env node
// 独立数据库初始化脚本（纯 JS，可用 node 直接运行）
// 用法：node scripts/init-db.mjs

import { createClient } from '@libsql/client'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'

const dbPath = path.join(process.cwd(), 'data', 'csms.db')
const dataDir = path.dirname(dbPath)

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const client = createClient({ url: `file:${dbPath}` })
client.execute('PRAGMA journal_mode = WAL')
client.execute('PRAGMA foreign_keys = ON')

console.log('[CSMS] 开始初始化数据库...')

// 建表 SQL（逐条执行）
const statements = [
  `CREATE TABLE IF NOT EXISTS schools (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS grades (id INTEGER PRIMARY KEY AUTOINCREMENT, school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE, name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(school_id, name))`,
  `CREATE TABLE IF NOT EXISTS classes (id INTEGER PRIMARY KEY AUTOINCREMENT, grade_id INTEGER NOT NULL REFERENCES grades(id) ON DELETE CASCADE, name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(grade_id, name))`,
  `CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'school_admin', school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE, grade_id INTEGER REFERENCES grades(id) ON DELETE CASCADE, class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE, api_token TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), last_login TEXT)`,
  `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE, username TEXT NOT NULL, total_score INTEGER NOT NULL DEFAULT 0, score_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(class_id, username))`,
  `CREATE TABLE IF NOT EXISTS score_templates (id INTEGER PRIMARY KEY AUTOINCREMENT, class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE, name TEXT NOT NULL, score_change INTEGER NOT NULL, description TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS score_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, score_change INTEGER NOT NULL, description TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS system_settings (id INTEGER PRIMARY KEY AUTOINCREMENT, setting_key TEXT NOT NULL UNIQUE, setting_value TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS seat_layout_config (id INTEGER PRIMARY KEY AUTOINCREMENT, class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE, group_count INTEGER NOT NULL DEFAULT 4, rows_per_group INTEGER NOT NULL DEFAULT 6, cols_per_group INTEGER NOT NULL DEFAULT 2, has_aisle INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(class_id))`,
  `CREATE TABLE IF NOT EXISTS seat_data (id INTEGER PRIMARY KEY AUTOINCREMENT, class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE, group_index INTEGER NOT NULL, row_index INTEGER NOT NULL, col_index INTEGER NOT NULL, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, is_aisle INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS third_party_apis (id INTEGER PRIMARY KEY AUTOINCREMENT, api_name TEXT NOT NULL, api_url TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS applications (id INTEGER PRIMARY KEY AUTOINCREMENT, school_name TEXT NOT NULL, grade_name TEXT, class_name TEXT, applicant_name TEXT NOT NULL, contact_phone TEXT, contact_email TEXT, reason TEXT, status TEXT NOT NULL DEFAULT 'pending', review_note TEXT, reviewed_by INTEGER REFERENCES admins(id), reviewed_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
]

for (const sql of statements) {
  try { await client.execute(sql) } catch (err) {
    if (!err.message.includes('already exists')) {
      console.error('SQL 错误:', sql.substring(0, 60), err.message)
    }
  }
}

// 创建超级管理员
const passwordHash = bcrypt.hashSync('admin123', 10)
try {
  await client.execute(
    `INSERT OR IGNORE INTO admins (username, password_hash, role, created_at) VALUES (?, ?, 'super_admin', ?)`,
    ['admin', passwordHash, new Date().toISOString()]
  )
  console.log('[CSMS] 超级管理员已创建: admin / admin123')
} catch {}

// 插入默认系统设置
const defaultSettings = [
  ['system_title', '班级操行分管理系统'],
  ['nav_title', 'CSMS'],
  ['show_ranking', '1'],
  ['show_search', '1'],
  ['enable_user_detail', '1'],
  ['splash_video_enabled', '0'],
  ['show_statistics', '1'],
  ['security_question', '您设置的管理员账号是什么?'],
  ['security_answer', ''],
]
for (const [key, value] of defaultSettings) {
  try {
    await client.execute(
      `INSERT OR IGNORE INTO system_settings (setting_key, setting_value, created_at) VALUES (?, ?, ?)`,
      [key, value, new Date().toISOString()]
    )
  } catch {}
}

console.log('[CSMS] 数据库初始化完成！')
console.log('[CSMS] 数据库文件:', dbPath)
process.exit(0)
