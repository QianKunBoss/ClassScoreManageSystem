import { eq, or, isNull } from 'drizzle-orm'
import { schools } from '../../database/schema'
import { useMainDb } from '../../database/db'
import { getQuery } from 'h3'
import { requireSuperAdmin } from '../../utils/auth'

// GET /api/schools — 公开接口，无需登录（默认仅返回未封禁的学校，供登录/注册页选择）
// 传 ?includeDisabled=1 查看被封禁学校属敏感操作，仅超级管理员可访问
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const includeDisabled = query.includeDisabled === '1'

  // 查看被封禁学校仅限超级管理员
  if (includeDisabled) {
    await requireSuperAdmin(event)
  }

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
