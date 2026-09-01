// DELETE /api/api-tokens/:id — 吊销（彻底删除）凭证
//
// 需要二次输入登录密码，与删除年级/班级同一套门槛。
//
// 【为什么允许硬删】禁用（disabled=1）已经能让凭证失效，删除的价值在于清理台账。
// 但审计日志 api_audit_logs 里保留了 token_prefix 快照，因此历史调用记录不会随之丢失 ——
// 这是把"凭证生命周期"与"调用留痕"解耦的好处。

import { eq } from 'drizzle-orm'
import { useMainDb, useSchoolDb } from '../../database/db'
import { apiTokens } from '../../database/schema.main'
import { requireAdmin, getSchoolIdFromRequest, verifyAdminPassword } from '../../utils/auth'
import { isTokenVisibleTo, type ApiTokenRow } from '../../utils/api-token'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const schoolDb = await useSchoolDb(event, schoolId)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: '无效的凭证 ID' })
  }

  const confirmPassword = getHeader(event, 'x-confirm-password')
  if (!confirmPassword) {
    throw createError({ statusCode: 400, message: '需要提供确认密码' })
  }
  if (!(await verifyAdminPassword(admin.id, confirmPassword))) {
    throw createError({ statusCode: 403, message: '密码验证失败' })
  }

  const token = (await useMainDb()
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.id, id))
    .get()) as ApiTokenRow | undefined

  if (!token || Number(token.schoolId) !== schoolId) {
    throw createError({ statusCode: 404, message: '凭证不存在' })
  }
  if (!(await isTokenVisibleTo(admin, token, schoolDb))) {
    throw createError({ statusCode: 403, message: '无权限管理该凭证' })
  }

  await useMainDb().delete(apiTokens).where(eq(apiTokens.id, id))

  return { success: true, message: `凭证「${token.name}」已吊销` }
})
