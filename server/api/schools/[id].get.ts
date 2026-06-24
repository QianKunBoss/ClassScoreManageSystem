import { eq } from 'drizzle-orm'
import { schools } from '../../database/schema'
import { useMainDb } from '../../database/db'
import { requireAdmin } from '../../utils/auth'

// GET /api/schools/[id] — 获取单个学校详情（主库）
// - 超级管理员：可查看任意学校
// - 普通管理员：只能查看自己所属学校
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  const db = useMainDb()
  const school = await db.select().from(schools).where(eq(schools.id, Number(id))).get()
  if (!school) {
    setResponseStatus(event, 404)
    return { success: false, message: '学校不存在' }
  }
  // 非超级管理员只能查看自己所属学校
  if (admin.role !== 'super_admin' && admin.schoolId !== school.id) {
    setResponseStatus(event, 403)
    return { success: false, message: '无权访问其他学校信息' }
  }
  return { success: true, data: school }
})
