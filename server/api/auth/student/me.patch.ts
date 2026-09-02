import { getStudentFromSession, setStudentSession } from '../../../utils/auth'
import { users } from '../../../database/schema'
import { useSchoolDb } from '../../../database/db'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { verifyEmailCode } from '../../../utils/mail'

// PATCH /api/auth/student/me — 学生修改密码和真实姓名
export default defineEventHandler(async (event) => {
  const student = await getStudentFromSession(event)
  if (!student) {
    setResponseStatus(event, 401)
    return { success: false, message: '请先登录' }
  }

  const body = await readBody(event)
  const { currentPassword, newPassword, actualName, username, emailCode } = body

  const db = await useSchoolDb(event, student.schoolId)
  const updates: any = {}
  const messages: string[] = []

  // 修改用户名（需要验证当前密码）
  if (username !== undefined) {
    if (!currentPassword) {
      setResponseStatus(event, 400)
      return { success: false, message: '修改用户名需输入当前密码' }
    }
    // 验证当前密码
    const userWithHash = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, student.id))
      .get()
    if (!userWithHash || !bcrypt.compareSync(currentPassword, userWithHash.passwordHash)) {
      setResponseStatus(event, 400)
      return { success: false, message: '当前密码错误' }
    }
    // 检查新用户名是否已被使用
    const trimmedUsername = String(username).trim()
    if (!trimmedUsername) {
      setResponseStatus(event, 400)
      return { success: false, message: '用户名不能为空' }
    }
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, trimmedUsername))
      .get()
    if (existingUser && existingUser.id !== student.id) {
      setResponseStatus(event, 400)
      return { success: false, message: '用户名已被使用' }
    }
    updates.username = trimmedUsername
    messages.push('用户名已更新')
  }

  // 修改真实姓名
  if (actualName !== undefined) {
    const trimmed = String(actualName).trim()
    updates.actualName = trimmed || null
    messages.push('姓名已更新')
  }

  // 修改密码（验证当前密码 或 已绑定邮箱的验证码）
  if (newPassword) {
    if (newPassword.length < 6) {
      setResponseStatus(event, 400)
      return { success: false, message: '新密码长度至少6位' }
    }

    const userWithHash = await db
      .select({ passwordHash: users.passwordHash, email: users.email })
      .from(users)
      .where(eq(users.id, student.id))
      .get()

    let authedByCode = false
    if (currentPassword) {
      if (!userWithHash || !bcrypt.compareSync(currentPassword, userWithHash.passwordHash)) {
        setResponseStatus(event, 400)
        return { success: false, message: '当前密码错误' }
      }
    } else if (emailCode) {
      if (!userWithHash?.email) {
        setResponseStatus(event, 400)
        return { success: false, message: '未绑定邮箱，无法使用验证码验证' }
      }
      if (!verifyEmailCode(userWithHash.email, emailCode)) {
        setResponseStatus(event, 400)
        return { success: false, message: '邮箱验证码错误或已失效' }
      }
      authedByCode = true
    } else {
      setResponseStatus(event, 400)
      return { success: false, message: '修改密码需输入当前密码或邮箱验证码' }
    }

    // 新密码不能和当前密码相同（仅当前密码校验路径）
    if (!authedByCode && userWithHash && bcrypt.compareSync(newPassword, userWithHash.passwordHash)) {
      setResponseStatus(event, 400)
      return { success: false, message: '新密码不能和当前密码相同' }
    }

    updates.passwordHash = bcrypt.hashSync(newPassword, 10)
    updates.mustChangePassword = 0
    messages.push('密码已更新')
  }

  if (Object.keys(updates).length === 0) {
    setResponseStatus(event, 400)
    return { success: false, message: '没有任何修改' }
  }

  // 更新数据库
  await db
    .update(users)
    .set(updates)
    .where(eq(users.id, student.id))

  // 刷新 session（如果改了姓名）
  if (updates.actualName !== undefined) {
    await setStudentSession(event, {
      ...student,
      actualName: updates.actualName,
    })
  }

  return { success: true, message: messages.join('、') }
})
