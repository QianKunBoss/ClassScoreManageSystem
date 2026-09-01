// PATCH /api/v1/students/:id — 更新学生
//
// scope: students:write
// 可改字段：username / actualName / disabled / classId（转班）
//
// 【刻意不开放】password 与 email：二者是登录凭证与个人隐私，属于账号身份范畴，
// 不在"班级积分业务数据"的开放边界内。第三方系统若需重置密码，应走管理端人工操作。

import { and, eq, ne } from 'drizzle-orm'
import { users } from '../../../database/schema.school'
import {
  API_CODE,
  apiError,
  apiOk,
  defineApiV1Handler,
} from '../../../utils/api-response'
import { assertScope } from '../../../utils/api-token'
import { useApiContext } from '../../../utils/api-context'

const MAX_USERNAME_LEN = 64

export default defineApiV1Handler(async (event) => {
  const ctx = await useApiContext(event)
  assertScope(ctx.token, 'students:write')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    apiError(400, API_CODE.INVALID_PARAM, '学生 id 不合法')
  }

  const body = (await readBody(event)) as any
  if (!body || typeof body !== 'object') {
    apiError(400, API_CODE.BAD_REQUEST, '请求体必须是 JSON 对象')
  }

  const existing = await ctx.db.select().from(users).where(eq(users.id, id)).get()
  if (!existing) {
    apiError(404, API_CODE.NOT_FOUND, '学生不存在')
  }
  // 写接口返回 403 而非 404：调用方已明确指名目标，无需再防枚举，
  // 明确的错误信息更有助于排障。读接口的取舍不同，见 students/[id].get.ts。
  if (!ctx.scope.isClassAllowed(Number(existing.classId))) {
    apiError(403, API_CODE.OUT_OF_RANGE, '无权限操作该学生')
  }

  const setData: Record<string, any> = {}

  if (body.username !== undefined) {
    const username = String(body.username ?? '').trim()
    if (!username) apiError(400, API_CODE.INVALID_PARAM, 'username 不能为空')
    if (username.length > MAX_USERNAME_LEN) {
      apiError(400, API_CODE.INVALID_PARAM, `username 长度不得超过 ${MAX_USERNAME_LEN}`)
    }
    if (username !== existing.username) {
      const dup = await ctx.db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.username, username), ne(users.id, id)))
        .get()
      if (dup) apiError(409, API_CODE.CONFLICT, '用户名已存在')
    }
    setData.username = username
  }

  if (body.actualName !== undefined) {
    const v = String(body.actualName ?? '').trim()
    setData.actualName = v || null
  }

  if (body.disabled !== undefined) {
    setData.disabled = body.disabled === true || body.disabled === 1 || body.disabled === '1' ? 1 : 0
  }

  if (body.classId !== undefined && body.classId !== null && body.classId !== '') {
    const target = Number(body.classId)
    if (!Number.isInteger(target) || target <= 0) {
      apiError(400, API_CODE.INVALID_PARAM, 'classId 不合法')
    }
    // 转班要求源班级与目标班级都在范围内 —— 否则等于把学生"搬出"可见范围，
    // 或者把范围外的学生"搬进来"，两者都是越权。
    if (!ctx.scope.isClassAllowed(target)) {
      apiError(403, API_CODE.OUT_OF_RANGE, `无权限将学生转入班级 ${target}`)
    }
    setData.classId = target
  }

  if (Object.keys(setData).length === 0) {
    apiError(400, API_CODE.MISSING_PARAM, '请至少指定一个要修改的字段')
  }

  await ctx.db.update(users).set(setData).where(eq(users.id, id))
  const updated = await ctx.db.select().from(users).where(eq(users.id, id)).get()

  return apiOk(
    event,
    {
      id: Number(updated.id),
      username: updated.username,
      actualName: updated.actualName || '',
      classId: updated.classId == null ? null : Number(updated.classId),
      disabled: Number(updated.disabled ?? 0) === 1,
      createdAt: updated.createdAt,
    },
    '更新成功',
  )
})
