import { eq } from 'drizzle-orm'
import { getMainRawClient } from './db'
import { useMainDb } from './db'
import { admins, schools } from './schema.main'
import bcrypt from 'bcryptjs'

/**
 * 初始化主库表结构（如果尚未创建）
 * 使用原始 SQL（libsql 不支持多语句 exec，逐条执行）
 */
export async function initDatabase() {
  const client = getMainRawClient()

  // 确保 PRAGMA 正确设置（getMainClient 中未 await，这里显式 await）
  await client.execute('PRAGMA journal_mode = WAL')
  await client.execute('PRAGMA foreign_keys = ON')

  // ===== 1. 创建主库表 =====
  const createStatements = [
    `CREATE TABLE IF NOT EXISTS schools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      disabled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(name)
    )`,
    `CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'school_admin',
      school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
      grade_id INTEGER,
      class_id INTEGER,
      api_token TEXT,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      disabled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_login TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS applications (
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
      created_school_id INTEGER REFERENCES schools(id),
      created_admin_id INTEGER REFERENCES admins(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS third_party_apis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      api_name TEXT NOT NULL,
      api_url TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      active INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER REFERENCES admins(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    )`,
  ]

  for (const sql of createStatements) {
    await client.execute(sql)
  }

  // ===== 2. 迁移：检查 admins 表是否有旧的全局 UNIQUE(username) 约束 =====
  // 旧版 v0.2.5 的 admins 表有 username TEXT NOT NULL UNIQUE（全局唯一）
  // 新版 v0.3.0 需要 (username, school_id) 联合唯一
  // SQLite 不允许 DROP 自动索引，必须重建表
  const oldIndex = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='index' AND name='sqlite_autoindex_admins_1' AND tbl_name='admins'"
  )

  if (oldIndex.rows.length > 0) {
    console.log('[CSMS] 检测到旧版 admins 表结构（username 全局唯一），开始迁移...')

    // 关闭 FK 检查（重建表期间）
    await client.execute('PRAGMA foreign_keys = OFF')

    // 1. 创建新表（无 UNIQUE(username)，正确的列定义）
    await client.execute(`CREATE TABLE admins_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'school_admin',
      school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
      grade_id INTEGER,
      class_id INTEGER,
      api_token TEXT,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_login TEXT
    )`)

    // 2. 复制数据（旧表无 must_change_password 列，默认 0）
    const oldColumns = await client.execute("PRAGMA table_info(admins)")
    const hasMustChange = oldColumns.rows.some((r: any) => r.name === 'must_change_password')
    if (hasMustChange) {
      await client.execute(`INSERT INTO admins_new (id, username, password_hash, role, school_id, grade_id, class_id, api_token, must_change_password, created_at, last_login)
        SELECT id, username, password_hash, role, school_id, grade_id, class_id, api_token, must_change_password, created_at, last_login FROM admins`)
    } else {
      await client.execute(`INSERT INTO admins_new (id, username, password_hash, role, school_id, grade_id, class_id, api_token, must_change_password, created_at, last_login)
        SELECT id, username, password_hash, role, school_id, grade_id, class_id, api_token, 0, created_at, last_login FROM admins`)
    }

    // 3. 删除旧表
    await client.execute('DROP TABLE admins')

    // 4. 重命名新表
    await client.execute('ALTER TABLE admins_new RENAME TO admins')

    // 5. 创建联合唯一索引
    await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS admins_username_school_unq ON admins(username, school_id)`)

    // 重新打开 FK 检查
    await client.execute('PRAGMA foreign_keys = ON')

    console.log('[CSMS] admins 表迁移完成：username 全局唯一 → (username, school_id) 联合唯一')
  } else {
    // 表已是新结构，确保联合唯一索引存在
    await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS admins_username_school_unq ON admins(username, school_id)`)
    // 确保 must_change_password 列存在（旧库升级）
    const columns = await client.execute(`PRAGMA table_info(admins)`)
    const hasCol = (columns.rows as any[]).some((r: any) => r.name === 'must_change_password')
    if (!hasCol) {
      await client.execute(`ALTER TABLE admins ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0`)
      console.log('[CSMS] admins 表已添加 must_change_password 列')
    }
    // 确保 disabled 列存在（v0.3.0 新增）
    const hasDisabledAdmin = (columns.rows as any[]).some((r: any) => r.name === 'disabled')
    if (!hasDisabledAdmin) {
      await client.execute(`ALTER TABLE admins ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0`)
      console.log('[CSMS] admins 表已添加 disabled 列')
    }
  }

  // ===== 3.5. 迁移 schools 表，添加 disabled 字段 =====
  const schoolsColumns = await client.execute(`PRAGMA table_info(schools)`)
  const hasSchoolDisabled = (schoolsColumns.rows as any[]).some((r: any) => r.name === 'disabled')
  if (!hasSchoolDisabled) {
    await client.execute(`ALTER TABLE schools ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0`)
    console.log('[CSMS] schools 表已添加 disabled 列')
  }

  // ===== 3. 插入超级管理员（如果不存在）=====
  const db = useMainDb()
  // 注意：username 唯一性由 (username, school_id) 联合索引保证
  // 超级管理员 school_id = NULL
  const existingAdmin = await db
    .select({ id: admins.id })
    .from(admins)
    .where(eq(admins.username, 'admin'))
    .where(eq(admins.schoolId, null as any))
    .get()

  if (!existingAdmin) {
    // 检查是否有其他 admin 用户名（可能从旧库迁移过来的）
    const anyAdmin = await db
      .select({ id: admins.id, username: admins.username })
      .from(admins)
      .get()

    if (!anyAdmin) {
      const passwordHash = bcrypt.hashSync('admin123', 10)
      await db.insert(admins).values({
        username: 'admin',
        passwordHash,
        role: 'super_admin',
        schoolId: null,
        createdAt: new Date().toISOString(),
      })
      console.log('[CSMS] 超级管理员已创建: admin / admin123')
    }
  }

  console.log('[CSMS] 主库初始化完成')
}
