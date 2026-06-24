import { createClient } from '@libsql/client'
import path from 'path'
import fs from 'fs'

/**
 * 为新学校创建独立的 .db 文件并初始化所有表
 * 在审核通过后调用一次，运行时不再检查
 */
export async function createSchoolDb(schoolId: number) {
  const dbDir = path.join(process.cwd(), 'data', 'schools')
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })

  const dbPath = path.join(dbDir, `${schoolId}.db`)
  
  // 文件已存在则直接返回，避免重复初始化导致卡住
  if (fs.existsSync(dbPath)) {
    console.log(`[CSMS] 学校 ID=${schoolId} 的数据库文件已存在，跳过创建`)
    return
  }
  
  console.log(`[CSMS] 正在为学校 ID=${schoolId} 创建数据库文件...`)
  const client = createClient({ url: `file:${dbPath}` })

  try {
    // 启用 WAL + 外键约束
    await client.execute('PRAGMA journal_mode = WAL')
    await client.execute('PRAGMA foreign_keys = ON')

    const tables = [
      `CREATE TABLE IF NOT EXISTS grades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(name)
      )`,
      `CREATE TABLE IF NOT EXISTS classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grade_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(grade_id, name),
        FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
        username TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        actual_name TEXT,
        total_score INTEGER NOT NULL DEFAULT 0,
        add_score INTEGER NOT NULL DEFAULT 0,
        deduct_score INTEGER NOT NULL DEFAULT 0,
        score_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(class_id, username)
      )`,
      `CREATE TABLE IF NOT EXISTS score_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        username TEXT NOT NULL,
        score_change INTEGER NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS score_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        score_change INTEGER NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS seat_layout_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id INTEGER NOT NULL UNIQUE REFERENCES classes(id) ON DELETE CASCADE,
        group_count INTEGER NOT NULL DEFAULT 4,
        rows_per_group INTEGER NOT NULL DEFAULT 3,
        cols_per_group INTEGER NOT NULL DEFAULT 3,
        has_aisle INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS seat_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        group_index INTEGER NOT NULL,
        row_index INTEGER NOT NULL,
        col_index INTEGER NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        username TEXT,
        is_aisle INTEGER NOT NULL DEFAULT 0,
        UNIQUE(class_id, group_index, row_index, col_index)
      )`,
    ]

    for (const sql of tables) {
      await client.execute(sql)
    }
  } finally {
    client.close()
  }
}
