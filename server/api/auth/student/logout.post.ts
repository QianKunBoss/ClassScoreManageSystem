import { logoutStudent } from '../../../utils/auth'

// POST /api/auth/student/logout — 学生退出登录
export default defineEventHandler(async (event) => {
  await logoutStudent(event)
  return { success: true, message: '已退出登录' }
})
