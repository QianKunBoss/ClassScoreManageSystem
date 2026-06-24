import { eq, or, isNull } from 'drizzle-orm'
import { schools } from '../../database/schema'
import { useMainDb } from '../../database/db'
import { getQuery } from 'h3'

// GET /api/schools — 公开接口，无需登录
// 默认过滤被封禁的学校；传 ?includeDisabled=1 可查看全部（供超级管理员使用）
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const includeDisabled = query.includeDisabled === '1'

  const db = useMainDb()

  // 构建查询
  const queryBuilder = db
    .select({
      id: schools.id,
      name: schools.name,
      disabled: schools.disabled,
      createdAt: schools.createdAt,
    })
    .from(schools)

  // 如果不包含被封禁的学校，则添加过滤条件
  if (!includeDisabled) {
    queryBuilder.where(
      or(eq(schools.disabled, 0), isNull(schools.disabled))
    )
  }

  const rows = await queryBuilder.orderBy(schools.id)

  return { success: true, data: rows }
})
