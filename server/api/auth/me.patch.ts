import { eq, and } from 'drizzle-orm'
import { admins } from '../../database/schema'
import { useMainDb } from '../../database/db'
import { requireAdmin, hashPasswordBcrypt, verifyPasswordBcrypt } from '../../utils/auth'
import { verifyEmailCode } from '../../utils/mail'

// PATCH /api/auth/me — 用户修改自己的密码/用户名
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const db = useMainDb()
  const body = await readBody(event) as {
    currentPassword?: string
    newPassword?: string
    username?: string
    // 邮箱验证码（已绑定邮箱时，可替代当前密码用于身份验证改密）
    emailCode?: string
  }

  if (!body.newPassword && !body.username) {
    throw createError({ statusCode: 400, message: '请指定要修改的内容' })
  }

  const setData: Record<string, any> = {}

  // 修改密码
  if (body.newPassword) {
    if (body.newPassword.length < 6) {
      throw createError({ statusCode: 400, message: '新密码长度至少6位' })
    }

    const current = await db.select({ passwordHash: admins.passwordHash, email: admins.email }).from(admins).where(eq(admins.id, admin.id)).get()

    // 身份校验：当前密码 或 已绑定邮箱的验证码（二选一）
    let authedByCode = false
    if (body.currentPassword) {
      if (!current || !verifyPasswordBcrypt(body.currentPassword, current.passwordHash)) {
        throw createError({ statusCode: 400, message: '当前密码错误' })
      }
    } else if (body.emailCode) {
      if (!current?.email) {
        throw createError({ statusCode: 400, message: '未绑定邮箱，无法使用验证码验证' })
      }
      if (!verifyEmailCode(current.email, body.emailCode)) {
        throw createError({ statusCode: 400, message: '邮箱验证码错误或已失效' })
      }
      authedByCode = true
    } else {
      throw createError({ statusCode: 400, message: '修改密码需要提供当前密码或邮箱验证码' })
    }

    // 新密码不能和当前密码相同（仅当前密码校验路径）
    if (!authedByCode && current && verifyPasswordBcrypt(body.newPassword, current.passwordHash)) {
      throw createError({ statusCode: 400, message: '新密码不能和当前密码相同' })
    }

    setData.passwordHash = hashPasswordBcrypt(body.newPassword)
    setData.mustChangePassword = 0
  }

  // 修改用户名
  if (body.username) {
    if (!body.currentPassword) {
      throw createError({ statusCode: 400, message: '修改用户名需要提供当前密码' })
    }
    if (body.username.length < 2) {
      throw createError({ statusCode: 400, message: '用户名至少2位' })
    }

    // 验证当前密码
    if (!setData.passwordHash) {
      const current = await db.select({ passwordHash: admins.passwordHash }).from(admins).where(eq(admins.id, admin.id)).get()
      if (!current || !verifyPasswordBcrypt(body.currentPassword, current.passwordHash)) {
        throw createError({ statusCode: 400, message: '当前密码错误' })
      }
    }

    // 检查同校用户名冲突
    const conflict = await db.select({ id: admins.id }).from(admins)
      .where(and(eq(admins.username, body.username), eq(admins.schoolId, admin.schoolId)))
      .get()
    if (conflict && conflict.id !== admin.id) {
      throw createError({ statusCode: 400, message: `用户名 "${body.username}" 已被使用` })
    }

    setData.username = body.username
  }

  await db.update(admins).set(setData).where(eq(admins.id, admin.id))

  return { success: true }
})
