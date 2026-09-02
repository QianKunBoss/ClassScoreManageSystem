import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { createError } from 'h3'
import * as mainSchema from './schema.main'
import * as schoolSchema from './schema.school'
import path from 'path'
import fs from 'fs'

// ===== 主库（单例）=====
let _mainDb: ReturnType<typeof drizzle> | null = null
let _mainClient: ReturnType<typeof createClient> | null = null

function getMainClient() {
  if (_mainClient) return _mainClient
  const dbPath = path.join(process.cwd(), 'data', 'csms.db')
  const dataDir = path.dirname(dbPath)
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  _mainClient = createClient({ url: `file:${dbPath}` })
  // PRAGMA 在 init.ts 中显式 await，这里 fire-and-forget 作为备选
  _mainClient.execute('PRAGMA journal_mode = WAL')
  _mainClient.execute('PRAGMA foreign_keys = ON')
  return _mainClient
}

export function useMainDb() {
  if (_mainDb) return _mainDb
  getMainClient() // 确保 client 已初始化
  _mainDb = drizzle(_mainClient!, { schema: mainSchema })
  return _mainDb
}

/** 暴露底层 client，供初始化脚本执行原始 SQL */
export function getMainRawClient() {
  return getMainClient()
}

/**
 * 兼容旧代码：指向 useMainDb()
 * ⚠️ 仅用于尚未迁移到多数据库的旧 API，新代码请直接用 useMainDb() / useSchoolDb()
 */
export function useDb() {
  console.warn('[CSMS] useDb() 已废弃，请迁移到 useMainDb() / useSchoolDb()')
  return useMainDb()
}

/**
 * 【安全】校验学校在主库 schools 表中真实存在。
 *
 * useSchoolDb 对不存在的 .db 文件会自动建库，这原本是为兼容旧版迁移。
 * 但由于 schoolId 可由超级管理员通过 ?schoolId= 任意指定，
 * 传入一个不存在的数字就会在 data/schools/ 下凭空生成一个空库（"幽灵库"），
 * 造成磁盘垃圾、统计口径混乱，也让越权探测无法被察觉。
 * 因此建库前必须确认主库中确有该学校记录。
 */
async function assertSchoolExists(schoolId: number) {
  if (!Number.isInteger(schoolId) || schoolId <= 0) {
    throw createError({ statusCode: 400, message: `schoolId 不合法：${schoolId}` })
  }

  try {
    const result = await getMainClient().execute({
      sql: 'SELECT id FROM schools WHERE id = ? LIMIT 1',
      args: [schoolId],
    })
    if (result.rows.length === 0) {
      throw createError({ statusCode: 404, message: `学校不存在（schoolId=${schoolId}）` })
    }
  } catch (e: any) {
    // 主库首次启动尚未建表时放行，交由 initDatabase 流程处理
    if (typeof e?.message === 'string' && e.message.includes('no such table')) return
    throw e
  }
}

// ===== 学校库（per-request 缓存）=====
// TODO: useSchoolDb 中的 PRAGMA 未 await，理想情况下应改为 async
// 当前依赖 libsql 操作序列化保证 PRAGMA 在查询前执行
export async function useSchoolDb(event: any, schoolId: number) {
  const key = `_schoolDb_${schoolId}`
  if (event.context[key]) return event.context[key]

  const dbDir = path.join(process.cwd(), 'data', 'schools')
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })

  const dbPath = path.join(dbDir, `${schoolId}.db`)
  // 数据库文件不存在时自动创建（兼容旧版迁移、手动添加学校等场景）
  // 但必须先确认主库中确有该学校，避免生成"幽灵库"
  if (!fs.existsSync(dbPath)) {
    await assertSchoolExists(schoolId)
    const { createSchoolDb } = await import('../utils/create-school-db')
    await createSchoolDb(schoolId)
  }

  const client = createClient({ url: `file:${dbPath}` })
  client.execute('PRAGMA journal_mode = WAL')
  client.execute('PRAGMA foreign_keys = ON')

  // 迁移：为 seat_layout_config 表添加 class_id 列（如果存在旧表）
  await migrateSchoolDb(client, schoolId)

  const db = drizzle(client, { schema: schoolSchema })
  event.context[key] = db
  // 同时缓存 client，供需要 raw SQL 的场景使用
  event.context[`_schoolClient_${schoolId}`] = client
  return db
}

/** 获取学校库原始 client（用于 raw SQL / JOIN 查询） */
export async function getSchoolRawClient(event: any, schoolId: number): Promise<ReturnType<typeof createClient>> {
  const key = `_schoolClient_${schoolId}`
  if (!event.context[key]) {
    // 确保 useSchoolDb 已调用（会初始化 client）
    await useSchoolDb(event, schoolId)
  }
  return event.context[key]
}

/**
 * 学校库迁移：为 seat_layout_config 表添加 class_id 列
 * 旧版表结构没有 class_id，需要重建表
 */
export async function migrateSchoolDb(client: any, schoolId: number) {
  try {
    // ===== 迁移 seat_layout_config：添加 class_id 列 =====
    try {
      const result = await client.execute('PRAGMA table_info(seat_layout_config)')
      const columns = result.rows as any[]
      const hasClassId = columns.some((r: any) => r.name === 'class_id')
      if (!hasClassId) {
        // 1. 关闭外键检查
        await client.execute('PRAGMA foreign_keys = OFF')

        // 2. 重命名旧表
        await client.execute('ALTER TABLE seat_layout_config RENAME TO seat_layout_config_old')

        // 3. 创建新表（有 class_id）
        await client.execute(`CREATE TABLE seat_layout_config (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          class_id INTEGER NOT NULL UNIQUE REFERENCES classes(id) ON DELETE CASCADE,
          group_count INTEGER NOT NULL DEFAULT 4,
          rows_per_group INTEGER NOT NULL DEFAULT 3,
          cols_per_group INTEGER NOT NULL DEFAULT 3,
          has_aisle INTEGER NOT NULL DEFAULT 0
        )`)

        // 4. 迁移数据（旧数据没有 class_id，取第一个班级作为默认）
        const firstClass = await client.execute('SELECT id FROM classes LIMIT 1')
        if ((firstClass.rows as any[]).length > 0) {
          const defaultClassId = (firstClass.rows as any[])[0].id
          await client.execute(`INSERT INTO seat_layout_config (id, class_id, group_count, rows_per_group, cols_per_group, has_aisle)
            SELECT id, ${defaultClassId}, group_count, rows_per_group, cols_per_group, has_aisle FROM seat_layout_config_old`)
        }

        // 5. 删除旧表
        await client.execute('DROP TABLE seat_layout_config_old')

        // 6. 重新打开外键检查
        await client.execute('PRAGMA foreign_keys = ON')

        console.log(`[CSMS] school ${schoolId} seat_layout_config 表迁移完成：添加 class_id 列`)
      }
    } catch (e: any) {
      if (!e.message?.includes('no such table')) {
        console.error(`[CSMS] school ${schoolId} seat_layout_config 迁移失败:`, e.message)
      }
    }

    // ===== 迁移 seat_data：补充 class_id / created_at / updated_at 列 =====
    try {
      const result = await client.execute('PRAGMA table_info(seat_data)')
      const columns = result.rows as any[]
      const colNames = columns.map((r: any) => r.name)

      // 添加 class_id 列（旧表没有）
      const needsClassIdBackfill = !colNames.includes('class_id')
      if (needsClassIdBackfill) {
        await client.execute('ALTER TABLE seat_data ADD COLUMN class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE')
        console.log(`[CSMS] school ${schoolId} seat_data 表迁移完成：添加 class_id 列`)
      }

      // 回填 class_id（通过 user_id 关联 users 表获取班级）
      // 必须在 ADD COLUMN 之后执行，且只执行一次
      if (needsClassIdBackfill || colNames.includes('class_id')) {
        // 先通过 user_id 关联更新
        await client.execute(`UPDATE seat_data
          SET class_id = (SELECT u.class_id FROM users u WHERE u.id = seat_data.user_id)
          WHERE user_id IS NOT NULL AND class_id IS NULL`)
        // 剩余 NULL 行（空座位）取第一个班级
        const firstClass = await client.execute('SELECT id FROM classes LIMIT 1')
        if ((firstClass.rows as any[]).length > 0) {
          const defaultClassId = (firstClass.rows as any[])[0].id
          await client.execute(`UPDATE seat_data SET class_id = ${defaultClassId} WHERE class_id IS NULL`)
        }
        if (needsClassIdBackfill) {
          console.log(`[CSMS] school ${schoolId} seat_data 表 class_id 回填完成`)
        }
      }

      // 添加 created_at 列
      if (!colNames.includes('created_at')) {
        await client.execute(`ALTER TABLE seat_data ADD COLUMN created_at TEXT NOT NULL DEFAULT '${new Date().toISOString()}'`)
        console.log(`[CSMS] school ${schoolId} seat_data 表迁移完成：添加 created_at 列`)
      }

      // 添加 updated_at 列
      if (!colNames.includes('updated_at')) {
        await client.execute(`ALTER TABLE seat_data ADD COLUMN updated_at TEXT NOT NULL DEFAULT '${new Date().toISOString()}'`)
        console.log(`[CSMS] school ${schoolId} seat_data 表迁移完成：添加 updated_at 列`)
      }
    } catch (e: any) {
      if (!e.message?.includes('no such table')) {
        console.error(`[CSMS] school ${schoolId} seat_data 迁移失败:`, e.message)
      }
    }

    // ===== 迁移 users：添加 email / email_bound_at 列 + 邮箱唯一索引 =====
    try {
      const userResult = await client.execute('PRAGMA table_info(users)')
      const userCols = (userResult.rows as any[]).map((r: any) => r.name)
      if (!userCols.includes('email')) {
        await client.execute('ALTER TABLE users ADD COLUMN email TEXT')
        console.log(`[CSMS] school ${schoolId} users 表迁移完成：添加 email 列`)
      }
      if (!userCols.includes('email_bound_at')) {
        await client.execute('ALTER TABLE users ADD COLUMN email_bound_at TEXT')
        console.log(`[CSMS] school ${schoolId} users 表迁移完成：添加 email_bound_at 列`)
      }
      // 唯一索引（允许多个 NULL，仅约束非空值）
      await client.execute('CREATE UNIQUE INDEX IF NOT EXISTS users_email_unq ON users(email)')
      // 账号状态列（0=正常，1=禁用）
      if (!userCols.includes('disabled')) {
        await client.execute('ALTER TABLE users ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0')
        console.log(`[CSMS] school ${schoolId} users 表迁移完成：添加 disabled 列`)
      }
      // 强制改密标志（1=使用默认/重置密码登录，需强制改密）
      if (!userCols.includes('must_change_password')) {
        await client.execute('ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0')
        console.log(`[CSMS] school ${schoolId} users 表迁移完成：添加 must_change_password 列`)
      }
    } catch (e: any) {
      console.error(`[CSMS] school ${schoolId} users email 迁移失败:`, e.message)
    }

    // ===== 外部开放 API：幂等键表（新表，CREATE IF NOT EXISTS 天然幂等）=====
    try {
      await client.execute(`CREATE TABLE IF NOT EXISTS api_idempotency (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token_id INTEGER NOT NULL,
        key TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        response_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`)
      await client.execute('CREATE UNIQUE INDEX IF NOT EXISTS api_idempotency_token_key_unq ON api_idempotency(token_id, key)')
    } catch (e: any) {
      console.error(`[CSMS] school ${schoolId} api_idempotency 建表失败:`, e.message)
    }
  } catch (e: any) {
    console.error(`[CSMS] school ${schoolId} 迁移失败:`, e.message)
  }
}

/**
 * 启动期全量迁移所有学校库（data/schools/*.db）。
 *
 * 背景：migrateSchoolDb 原本只在 useSchoolDb(event, schoolId) 被调用时才针对
 * 单个学校库执行（懒迁移）。这导致升级代码后、长时间未被访问的学校库会一直停留
 * 在旧 schema（例如本项目新增的 users.must_change_password、api_idempotency 表），
 * 首次访问对应学校时才临时补齐，期间相关查询可能报 "no such column"。
 *
 * 此函数在服务启动、主库 initDatabase() 之后调用一次，扫描磁盘上所有学校库文件，
 * 逐个跑一遍 migrateSchoolDb，保证所有库在对外服务前已是最新结构。
 * 单库失败不影响其它库，也不阻断启动。
 */
export async function migrateAllSchoolDbs() {
  const dbDir = path.join(process.cwd(), 'data', 'schools')
  if (!fs.existsSync(dbDir)) return

  const files = fs.readdirSync(dbDir).filter((f) => /^(\d+)\.db$/.test(f))
  if (files.length === 0) {
    console.log('[CSMS] 未发现学校库，跳过全量迁移')
    return
  }

  let ok = 0
  let fail = 0
  for (const f of files) {
    const schoolId = parseInt(f.replace(/\.db$/, ''), 10)
    const dbPath = path.join(dbDir, f)
    try {
      const client = createClient({ url: `file:${dbPath}` })
      try {
        await client.execute('PRAGMA journal_mode = WAL')
        await client.execute('PRAGMA foreign_keys = ON')
        await migrateSchoolDb(client, schoolId)
        ok++
      } finally {
        await client.close()
      }
    } catch (e: any) {
      fail++
      console.error(`[CSMS] 启动迁移学校库 ${schoolId} 失败:`, e?.message || e)
    }
  }
  console.log(`[CSMS] 学校库全量迁移完成：成功 ${ok}，失败 ${fail}`)
}
