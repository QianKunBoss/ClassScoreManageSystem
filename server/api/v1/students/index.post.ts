// POST /api/v1/students — 创建学生账号
//
// scope: students:write
// 请求体：{ classId, username, password?, actualName? }
//        批量：{ classId?, defaultPassword?, batch: [{ username, actualName?, classId? }] }
//
// 【密码】外部 API 不返回明文密码；未提供 password 时用 defaultPassword，
// 两者都缺省则生成随机密码并**在响应里返回一次**（否则账号无法登录，等于建了个死号）。

import { eq } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'
import { users } from '../../../database/schema.school'
import {
  API_CODE,
  apiError,
  apiOk,
  defineApiV1Handler,
} from '../../../utils/api-response'
import { assertScope } from '../../../utils/api-token'
import { useApiContext } from '../../../utils/api-context'
import { withIdempotency } from '../../../utils/api-idempotency'
import { hashPasswordBcrypt } from '../../../utils/auth'

const MAX_BATCH = 200
const MAX_USERNAME_LEN = 64

/** 随机初始密码：10 位 base64url，足够抗爆破又便于人工转述 */
function randomPassword(): string {
  return randomBytes(8).toString('base64url').slice(0, 10)
}

function normalizeName(raw: any, field: string): string {
  const v = String(raw ?? '').trim()
  if (!v) apiError(400, API_CODE.MISSING_PARAM, `${field} 不能为空`)
  if (v.length > MAX_USERNAME_LEN) {
    apiError(400, API_CODE.INVALID_PARAM, `${field} 长度不得超过 ${MAX_USERNAME_LEN}`)
  }
  return v
}

export default defineApiV1Handler(async (event) => {
  const ctx = await useApiContext(event)
  assertScope(ctx.token, 'students:write')

  const body = (await readBody(event)) as any
  if (!body || typeof body !== 'object') {
    apiError(400, API_CODE.BAD_REQUEST, '请求体必须是 JSON 对象')
  }

  // class 范围的 token 可省略 classId，默认落到自己那个班
  const onlyClassId =
    ctx.token.scopeType === 'class' && ctx.token.scopeClassId != null
      ? Number(ctx.token.scopeClassId)
      : null

  const resolveClassId = (raw: any): number => {
    const v = raw === undefined || raw === null || raw === '' ? onlyClassId : Number(raw)
    if (v == null || !Number.isInteger(v) || v <= 0) {
      apiError(400, API_CODE.MISSING_PARAM, '缺少有效的 classId')
    }
    // 【安全】唯一的越权防线：目标班级必须在 token 范围内
    if (!ctx.scope.isClassAllowed(v)) {
      apiError(403, API_CODE.OUT_OF_RANGE, `无权限在班级 ${v} 下创建学生`)
    }
    return v
  }

  const data = await withIdempotency({
    event,
    db: ctx.db,
    tokenId: ctx.token.id,
    endpoint: 'POST /api/v1/students',
    run: async () => {
      // ===== 批量 =====
      if (Array.isArray(body.batch)) {
        if (body.batch.length === 0) {
          apiError(400, API_CODE.MISSING_PARAM, 'batch 不能为空数组')
        }
        if (body.batch.length > MAX_BATCH) {
          apiError(400, API_CODE.INVALID_PARAM, `单次最多创建 ${MAX_BATCH} 个账号`)
        }

        const sharedPassword = body.defaultPassword ? String(body.defaultPassword) : null
        const details: any[] = []
        let successCount = 0
        let failedCount = 0

        for (const item of body.batch) {
          const username = String(item?.username ?? '').trim()
          if (!username) {
            failedCount++
            details.push({ username: null, success: false, error: '用户名为空' })
            continue
          }
          try {
            const classId = resolveClassId(item?.classId ?? body.classId)
            const dup = await ctx.db
              .select({ id: users.id })
              .from(users)
              .where(eq(users.username, username))
              .get()
            if (dup) {
              failedCount++
              details.push({ username, success: false, error: '用户名已存在' })
              continue
            }
            const plain = sharedPassword || randomPassword()
            const [created] = await ctx.db
              .insert(users)
              .values({
                username,
                passwordHash: hashPasswordBcrypt(plain),
                actualName: item?.actualName ? String(item.actualName) : null,
                classId,
              })
              .returning()
              .all()
            successCount++
            details.push({
              id: Number(created.id),
              username,
              classId,
              success: true,
              // 仅当密码由服务端生成时回传，调用方指定的密码没必要回显
              initialPassword: sharedPassword ? undefined : plain,
            })
          } catch (e: any) {
            failedCount++
            details.push({ username, success: false, error: e?.message || '创建失败' })
          }
        }

        return { successCount, failedCount, totalCount: body.batch.length, details }
      }

      // ===== 单个 =====
      const username = normalizeName(body.username, 'username')
      const classId = resolveClassId(body.classId)

      const dup = await ctx.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, username))
        .get()
      if (dup) {
        apiError(409, API_CODE.CONFLICT, '用户名已存在')
      }

      const generated = !body.password
      const plain = generated ? randomPassword() : String(body.password)
      if (plain.length < 6) {
        apiError(400, API_CODE.INVALID_PARAM, '密码长度至少 6 位')
      }

      const [created] = await ctx.db
        .insert(users)
        .values({
          username,
          passwordHash: hashPasswordBcrypt(plain),
          actualName: body.actualName ? String(body.actualName) : null,
          classId,
        })
        .returning()
        .all()

      return {
        id: Number(created.id),
        username: created.username,
        actualName: created.actualName || '',
        classId,
        disabled: false,
        createdAt: created.createdAt,
        // 服务端生成的密码只在此刻可见，不会二次下发
        initialPassword: generated ? plain : undefined,
      }
    },
  })

  return apiOk(event, data, '创建成功')
})
