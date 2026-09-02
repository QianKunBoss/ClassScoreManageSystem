import { randomBytes } from 'crypto'
import fs from 'fs'
import path from 'path'
import { eq } from 'drizzle-orm'
import { users } from '../../../../database/schema.school'
import { useSchoolDb } from '../../../../database/db'
import { requireSuperAdmin, hashPasswordBcrypt } from '../../../../utils/auth'

// POST /api/admin/students/[id]/reset-password?schoolId= — 超级管理员代学生重置密码
// 生成临时密码并以明文返回给管理员（由管理员转告学生）
function generateTempPassword(): string {
  // 去掉易混淆字符 0/O/1/l/I
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = randomBytes(6)
  let rand = ''
  for (let i = 0; i < 6; i++) rand += alphabet[bytes[i] % alphabet.length]
  return 'Csms' + rand // 共 10 位，前缀确保含字母、长度达标
}

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const query = getQuery(event) as { schoolId?: string }
  const schoolId = query.schoolId ? Number(query.schoolId) : ''
  if (!schoolId) {
    throw createError({ statusCode: 400, message: '缺少 schoolId 参数' })
  }

  const dbPath = path.join(process.cwd(), 'data', 'schools', `${schoolId}.db`)
  if (!fs.existsSync(dbPath)) {
    throw createError({ statusCode: 404, message: '学校库不存在' })
  }

  const db = await useSchoolDb(event, schoolId)
  const id = Number(getRouterParam(event, 'id'))
  if (!id) {
    throw createError({ statusCode: 400, message: '缺少用户 ID' })
  }

  const existing = await db.select().from(users).where(eq(users.id, id)).get()
  if (!existing) {
    throw createError({ statusCode: 404, message: '用户不存在' })
  }

  const tempPassword = generateTempPassword()
  await db.update(users).set({ passwordHash: hashPasswordBcrypt(tempPassword), mustChangePassword: 1 }).where(eq(users.id, id))

  return {
    success: true,
    message: '密码已重置',
    data: {
      id,
      username: existing.username,
      actualName: existing.actualName || '',
      password: tempPassword,
    },
  }
})
