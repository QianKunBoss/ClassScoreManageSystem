// PATCH /api/api-tokens/:id — 启用 / 禁用凭证，或改备注名、权限、有效期
//
// 【刻意不支持改 scopeType / scopeGradeId / scopeClassId】
// 范围是凭证的身份，改范围等于换了一把钥匙却沿用同一个编号 ——
// 审计日志里的历史调用会被错误地归因到新范围下。需要换范围就吊销重发。
//
// 禁用是即时生效的：鉴权链每次请求都实时读 disabled 列，不做缓存。

import { eq } from 'drizzle-orm'
import { useMainDb, useSchoolDb } from '../../database/db'
import { apiTokens } from '../../database/schema.main'
import { requireAdmin, getSchoolIdFromRequest } from '../../utils/auth'
import { isTokenVisibleTo, normalizeScopes, type ApiTokenRow } from '../../utils/api-token'

const MAX_NAME_LEN = 64
const MAX_EXPIRE_DAYS = 1825

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const schoolDb = await useSchoolDb(event, schoolId)

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: '无效的凭证 ID' })
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

  const body = (await readBody(event)) as any
  const setData: Record<string, any> = {}

  if (body?.name !== undefined) {
    const name = String(body.name ?? '').trim()
    if (!name) throw createError({ statusCode: 400, message: '凭证名称不能为空' })
    if (name.length > MAX_NAME_LEN) {
      throw createError({ statusCode: 400, message: `凭证名称不得超过 ${MAX_NAME_LEN} 字` })
    }
    setData.name = name
  }

  if (body?.disabled !== undefined) {
    setData.disabled = body.disabled === true || body.disabled === 1 || body.disabled === '1' ? 1 : 0
  }

  // 收窄/调整权限允许，但仍受白名单约束
  if (body?.scopes !== undefined) {
    setData.scopes = normalizeScopes(body.scopes)
  }

  if (body?.expiresInDays !== undefined) {
    if (body.expiresInDays === null || body.expiresInDays === '') {
      setData.expiresAt = null // 改为永不过期
    } else {
      const days = Number(body.expiresInDays)
      if (!Number.isInteger(days) || days <= 0 || days > MAX_EXPIRE_DAYS) {
        throw createError({ statusCode: 400, message: `有效期需为 1 ~ ${MAX_EXPIRE_DAYS} 之间的整数天` })
      }
      setData.expiresAt = new Date(Date.now() + days * 86400_000).toISOString()
    }
  }

  if (Object.keys(setData).length === 0) {
    throw createError({ statusCode: 400, message: '请指定要修改的字段' })
  }

  await useMainDb().update(apiTokens).set(setData).where(eq(apiTokens.id, id))

  const updated = await useMainDb().select().from(apiTokens).where(eq(apiTokens.id, id)).get()

  return {
    success: true,
    message: setData.disabled === 1 ? '凭证已禁用' : setData.disabled === 0 ? '凭证已启用' : '更新成功',
    data: {
      id,
      name: updated!.name,
      disabled: Number(updated!.disabled) === 1,
      scopes: JSON.parse(updated!.scopes || '[]'),
      expiresAt: updated!.expiresAt,
    },
  }
})
