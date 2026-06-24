#!/usr/bin/env node
/**
 * 数据库迁移脚本 - 为 admins 表添加多租户字段
 */

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
    console.log('开始迁移数据库...\n')
    
    // ===== 迁移 admins 表 =====
    console.log('=== 迁移 admins 表 ===')
    const adminTableInfo = await client.execute('PRAGMA table_info(admins)')
    const adminColumns = adminTableInfo.rows.map(r => r.name)
    console.log('当前 admins 表字段:', adminColumns.join(', '))
    
    const adminMigrations = []
    if (!adminColumns.includes('school_id')) {
      adminMigrations.push('ALTER TABLE admins ADD COLUMN school_id INTEGER REFERENCES schools(id)')
    }
    if (!adminColumns.includes('grade_id')) {
      adminMigrations.push('ALTER TABLE admins ADD COLUMN grade_id INTEGER REFERENCES grades(id)')
    }
    if (!adminColumns.includes('class_id')) {
      adminMigrations.push('ALTER TABLE admins ADD COLUMN class_id INTEGER REFERENCES classes(id)')
    }
    if (!adminColumns.includes('scope')) {
      adminMigrations.push("ALTER TABLE admins ADD COLUMN scope TEXT DEFAULT 'class'")
    }
    
    if (adminMigrations.length === 0) {
      console.log('✅ admins 表已经是最新结构，无需迁移')
    } else {
      console.log('\n执行 admins 表迁移:')
      for (const sql of adminMigrations) {
        console.log('  -', sql)
        await client.execute(sql)
      }
      console.log('✅ admins 表迁移完成\n')
    }
    
    // ===== 迁移 users 表 =====
    console.log('\n=== 迁移 users 表 ===')
    const userTableInfo = await client.execute('PRAGMA table_info(users)')
    const userColumns = userTableInfo.rows.map(r => r.name)
    console.log('当前 users 表字段:', userColumns.join(', '))
    
    const userMigrations = []
    if (!userColumns.includes('password_hash')) {
      userMigrations.push("ALTER TABLE users ADD COLUMN password_hash TEXT DEFAULT ''")
    }
    if (!userColumns.includes('actual_name')) {
      userMigrations.push("ALTER TABLE users ADD COLUMN actual_name TEXT DEFAULT ''")
    }
    if (!userColumns.includes('school_id')) {
      userMigrations.push('ALTER TABLE users ADD COLUMN school_id INTEGER REFERENCES schools(id)')
    }
    if (!userColumns.includes('grade_id')) {
      userMigrations.push('ALTER TABLE users ADD COLUMN grade_id INTEGER REFERENCES grades(id)')
    }
    if (!userColumns.includes('class_id')) {
      userMigrations.push('ALTER TABLE users ADD COLUMN class_id INTEGER REFERENCES classes(id)')
    }
    
    if (userMigrations.length === 0) {
      console.log('✅ users 表已经是最新结构，无需迁移')
    } else {
      console.log('\n执行 users 表迁移:')
      for (const sql of userMigrations) {
        console.log('  -', sql)
        await client.execute(sql)
      }
      console.log('✅ users 表迁移完成\n')
    }
    
    // ===== 验证新结构 =====
    console.log('\n=== 验证迁移结果 ===')
    const newAdminTableInfo = await client.execute('PRAGMA table_info(admins)')
    console.log('admins 表字段:')
    newAdminTableInfo.rows.forEach(r => {
      console.log(`  - ${r.name} (${r.type})`)
    })
    
    const newUserTableInfo = await client.execute('PRAGMA table_info(users)')
    console.log('\nusers 表字段:')
    newUserTableInfo.rows.forEach(r => {
      console.log(`  - ${r.name} (${r.type})`)
    })
    
    // 更新现有管理员记录
    console.log('\n更新现有管理员记录...')
    await client.execute(`
      UPDATE admins 
      SET school_id = NULL, grade_id = NULL, class_id = NULL, scope = 'super'
      WHERE role = 'super_admin'
    `)
    
    await client.execute(`
      UPDATE admins 
      SET school_id = NULL, grade_id = NULL, class_id = NULL, scope = 'class'
      WHERE role = 'admin' AND username = 'test'
    `)
    
    // 验证数据
    const admins = await client.execute('SELECT id, username, role, scope, school_id, grade_id, class_id FROM admins')
    console.log('\n当前管理员数据:')
    console.table(admins.rows)
    
    console.log('\n✅ 数据库迁移完成！')
    
  } catch (error) {
    console.error('❌ 迁移失败:', error.message)
    throw error
  } finally {
    client.close()
  }
}

migrate()
