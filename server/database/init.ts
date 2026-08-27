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
    `CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_key TEXT NOT NULL UNIQUE,
      setting_value TEXT,
      description TEXT,
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS mail_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'custom',
      host TEXT NOT NULL,
      port INTEGER NOT NULL DEFAULT 587,
      secure TEXT NOT NULL DEFAULT 'tls',
      username TEXT NOT NULL DEFAULT '',
      password TEXT NOT NULL DEFAULT '',
      from_name TEXT NOT NULL DEFAULT '',
      from_address TEXT NOT NULL DEFAULT '',
      priority INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS mail_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      subject TEXT NOT NULL DEFAULT '',
      body_html TEXT NOT NULL DEFAULT '',
      variables TEXT NOT NULL DEFAULT '[]',
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
      disabled INTEGER NOT NULL DEFAULT 0,
      email TEXT,
      email_bound_at TEXT,
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
    await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS admins_email_unq ON admins(email)`)

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
    // 确保 email / email_bound_at 列存在（v0.4.0 新增，用于邮箱登录 / 找回密码）
    const hasEmailCol = (columns.rows as any[]).some((r: any) => r.name === 'email')
    if (!hasEmailCol) {
      await client.execute(`ALTER TABLE admins ADD COLUMN email TEXT`)
      await client.execute(`ALTER TABLE admins ADD COLUMN email_bound_at TEXT`)
      await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS admins_email_unq ON admins(email)`)
      console.log('[CSMS] admins 表已添加 email / email_bound_at 列')
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

  // ===== 4. 邮件设置默认值（若不存在则插入）=====
  const emailDefaults: { key: string; value: string; desc: string }[] = [
    { key: 'mail_provider', value: 'custom', desc: '邮件服务提供商' },
    { key: 'mail_smtp_host', value: '', desc: 'SMTP 服务器地址' },
    { key: 'mail_secure', value: 'tls', desc: '安全连接：none / ssl / tls' },
    { key: 'mail_port', value: '587', desc: 'SMTP 端口号' },
    { key: 'mail_username', value: '', desc: 'SMTP 认证用户名' },
    { key: 'mail_password', value: '', desc: 'SMTP 认证密码' },
    { key: 'mail_from_name', value: '', desc: '发件人名称' },
    { key: 'mail_from_address', value: '', desc: '发件人邮箱' },
  ]
  for (const e of emailDefaults) {
    await client.execute({
      sql: 'INSERT OR IGNORE INTO system_settings (setting_key, setting_value, description, updated_at) VALUES (?, ?, ?, ?)',
      args: [e.key, e.value, e.desc, new Date().toISOString()],
    })
  }
  console.log('[CSMS] 邮件设置默认值已就绪')

  // ===== 4.5. 迁移旧邮件设置 → mail_services 第一条记录（若服务表为空且有旧配置）=====
  const svcCountRows = await client.execute('SELECT COUNT(*) AS c FROM mail_services')
  const svcCount = Number((svcCountRows.rows[0] as any)?.c || 0)
  if (svcCount === 0) {
    const getOld = async (k: string) => {
      const r = await client.execute({ sql: 'SELECT setting_value FROM system_settings WHERE setting_key = ?', args: [k] })
      return (r.rows[0] as any)?.setting_value ?? ''
    }
    const oldHost = await getOld('mail_smtp_host')
    const oldUser = await getOld('mail_username')
    const oldPass = await getOld('mail_password')
    const oldFromName = await getOld('mail_from_name')
    const oldFromAddr = await getOld('mail_from_address')
    const oldSecure = await getOld('mail_secure')
    const oldPort = await getOld('mail_port')
    const oldProvider = await getOld('mail_provider')
    if (oldHost || oldFromAddr || oldUser || oldPass) {
      const resolvedSecure = ['none', 'ssl', 'tls'].includes(oldSecure) ? oldSecure : 'tls'
      const resolvedPort = Number(oldPort) || (resolvedSecure === 'ssl' ? 465 : 587)
      await client.execute({
        sql: `INSERT INTO mail_services (name, provider, host, port, secure, username, password, from_name, from_address, priority, enabled, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          '默认邮件服务（迁移自旧配置）',
          oldProvider || 'custom',
          oldHost,
          resolvedPort,
          resolvedSecure,
          oldUser,
          oldPass,
          oldFromName,
          oldFromAddr,
          0,
          1,
          new Date().toISOString(),
          new Date().toISOString(),
        ],
      })
      console.log('[CSMS] 已将旧邮件设置迁移为 mail_services 记录')
    }
  }

  // ===== 4.6. 种子化邮件模板（若不存在则插入）=====
  const templateDefaults: { slug: string; name: string; subject: string; bodyHtml: string; variables: string[] }[] = [
    {
      slug: 'verification_code',
      name: '邮箱验证码',
      subject: '【CSMS】您的邮箱验证码',
      variables: ['code', 'email', 'expiresMinutes'],
      bodyHtml: `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0b1220;color:#e2e8f0;border-radius:16px">
  <h2 style="color:#4a7ab5;margin:0 0 16px">CSMS 班级积分管理系统</h2>
  <p style="margin:0 0 12px">您好，您正在申请入驻 CSMS，本次操作的邮箱验证码为：</p>
  <div style="font-size:32px;font-weight:700;letter-spacing:6px;color:#4a7ab5;margin:12px 0">{{code}}</div>
  <p style="margin:0 0 8px;color:#94a3b8;font-size:14px">验证码有效期 {{expiresMinutes}} 分钟，请勿泄露给他人。若非本人操作请忽略本邮件。</p>
  <p style="margin:24px 0 0;color:#64748b;font-size:12px">本邮件由系统自动发送，请勿直接回复。</p>
</div>`,
    },
    {
      slug: 'application_approved',
      name: '入驻申请通过通知',
      subject: '【CSMS】您的入驻申请已通过',
      variables: ['schoolName', 'applicantName', 'loginUrl'],
      bodyHtml: `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0b1220;color:#e2e8f0;border-radius:16px">
  <h2 style="color:#4a7ab5;margin:0 0 16px">恭喜，申请已通过</h2>
  <p style="margin:0 0 12px">尊敬的 {{applicantName}}：</p>
  <p style="margin:0 0 12px">您提交的「{{schoolName}}」入驻申请已审核通过，现在可以使用分配的账号登录系统。</p>
  <p style="margin:0 0 8px"><a href="{{loginUrl}}" style="color:#4a7ab5">点击此处登录系统</a></p>
  <p style="margin:24px 0 0;color:#64748b;font-size:12px">本邮件由系统自动发送，请勿直接回复。</p>
</div>`,
    },
    {
      slug: 'application_rejected',
      name: '入驻申请驳回通知',
      subject: '【CSMS】您的入驻申请未通过',
      variables: ['schoolName', 'applicantName', 'reason'],
      bodyHtml: `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0b1220;color:#e2e8f0;border-radius:16px">
  <h2 style="color:#c0564a;margin:0 0 16px">很抱歉，申请未通过</h2>
  <p style="margin:0 0 12px">尊敬的 {{applicantName}}：</p>
  <p style="margin:0 0 12px">您提交的「{{schoolName}}」入驻申请未能通过审核，原因如下：</p>
  <blockquote style="margin:8px 0;padding:12px 16px;background:#1a2233;border-left:3px solid #c0564a;color:#cbd5e1">{{reason}}</blockquote>
  <p style="margin:0;color:#94a3b8;font-size:14px">如需进一步沟通，请联系管理员。</p>
</div>`,
    },
  ]
  for (const t of templateDefaults) {
    await client.execute({
      sql: 'INSERT OR IGNORE INTO mail_templates (slug, name, subject, body_html, variables, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [t.slug, t.name, t.subject, t.bodyHtml, JSON.stringify(t.variables), new Date().toISOString(), new Date().toISOString()],
    })
  }
  console.log('[CSMS] 邮件模板已就绪')

  console.log('[CSMS] 主库初始化完成')
}
