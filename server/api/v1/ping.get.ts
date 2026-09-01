// GET /api/v1/ping — 连通性与凭证自检
//
// 对接方最常见的问题是"我的 token 到底有什么权限、绑在哪所学校"。
// 提供这个端点后，这类咨询可以自助解决，不必要求管理员去后台截图。
// 它不需要任何 scope —— 只要 token 有效即可调用。

import { eq } from 'drizzle-orm'
import { useMainDb } from '../../database/db'
import { schools } from '../../database/schema.main'
import { apiOk, defineApiV1Handler } from '../../utils/api-response'
import { useApiToken, parseScopes } from '../../utils/api-token'

export default defineApiV1Handler(async (event) => {
  const token = useApiToken(event)

  const school = await useMainDb()
    .select({ id: schools.id, name: schools.name })
    .from(schools)
    .where(eq(schools.id, token.schoolId))
    .get()

  return apiOk(event, {
    ok: true,
    serverTime: new Date().toISOString(),
    school: {
      id: token.schoolId,
      name: school?.name || '',
    },
    token: {
      name: token.name,
      prefix: token.tokenPrefix,
      scopeType: token.scopeType,
      scopeGradeId: token.scopeGradeId,
      scopeClassId: token.scopeClassId,
      scopes: parseScopes(token),
      expiresAt: token.expiresAt,
      callCount: token.callCount,
      createdAt: token.createdAt,
    },
  })
})
