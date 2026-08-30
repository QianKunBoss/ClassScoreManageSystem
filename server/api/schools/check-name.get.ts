import { eq } from 'drizzle-orm'
import { schools } from '../../database/schema'
import { useMainDb } from '../../database/db'
import { createError } from 'h3'

// GET /api/schools/check-name?name=xxx
// 供申请表单实时校验「学校名称是否已被占用」。
// 仅匹配主库 schools 表中【现存】学校（已删除的学校会从表中移除，自然不计入；
// 已拒绝的入驻申请并未创建学校，也不计入）—— 满足「已删除/已拒绝的学校不算重复学校」。
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const name = (query.name || '').toString().trim()

  if (!name) {
    throw createError({ statusCode: 400, message: '缺少 name 参数' })
  }

  const db = useMainDb()
  // 精确匹配（与申请提交时的冲突检测保持一致）
  const existing = await db
    .select({ id: schools.id })
    .from(schools)
    .where(eq(schools.name, name))
    .get()

  return { success: true, exists: !!existing, schoolId: existing?.id ?? null }
})
