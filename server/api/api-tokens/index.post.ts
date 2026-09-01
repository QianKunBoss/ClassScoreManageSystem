// POST /api/api-tokens — 签发一枚外部 API 凭证
//
// 请求体：{ name, scopeType, scopeGradeId?, scopeClassId?, scopes: string[],
//          expiresInDays?, confirmPassword }
//
// 【明文只出现一次】数据库里只存 sha256(明文)，因此本接口的响应是调用方唯一
// 能拿到明文的机会。丢了只能吊销重发 —— 这不是不便，而是"数据库泄露也拿不到可用凭证"
// 的必要代价，与密码只存哈希同理。
//
// 【二次验密】签发凭证等于创建一把长期有效的钥匙。仅凭一个已登录会话（可能是
// 被 XSS 劫持的会话）就能悄悄签发，风险过高，故强制重输登录密码。

import { useMainDb, useSchoolDb } from '../../database/db'
import { apiTokens } from '../../database/schema.main'
import { requireAdmin, getSchoolIdFromRequest, verifyAdminPassword } from '../../utils/auth'
import {
  generateToken,
  normalizeScopes,
  assertIssuableScope,
  type ApiScopeType,
} from '../../utils/api-token'

const MAX_NAME_LEN = 64
/** 有效期上限 5 年。允许"永不过期"，但默认引导设置期限 */
const MAX_EXPIRE_DAYS = 1825

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const schoolDb = await useSchoolDb(event, schoolId)

  const body = (await readBody(event)) as any

  // ===== 二次验密 =====
  const confirmPassword = String(body?.confirmPassword ?? getHeader(event, 'x-confirm-password') ?? '')
  if (!confirmPassword) {
    throw createError({ statusCode: 400, message: '请输入登录密码以确认签发' })
  }
  if (!(await verifyAdminPassword(admin.id, confirmPassword))) {
    throw createError({ statusCode: 403, message: '密码验证失败' })
  }

  // ===== 基本字段 =====
  const name = String(body?.name ?? '').trim()
  if (!name) throw createError({ statusCode: 400, message: '请填写凭证名称' })
  if (name.length > MAX_NAME_LEN) {
    throw createError({ statusCode: 400, message: `凭证名称不得超过 ${MAX_NAME_LEN} 字` })
  }

  const scopeType = String(body?.scopeType ?? '') as ApiScopeType
  if (!['school', 'grade', 'class'].includes(scopeType)) {
    throw createError({ statusCode: 400, message: 'scopeType 必须是 school / grade / class' })
  }

  const scopeGradeId =
    body?.scopeGradeId === undefined || body.scopeGradeId === null || body.scopeGradeId === ''
      ? null
      : Number(body.scopeGradeId)
  const scopeClassId =
    body?.scopeClassId === undefined || body.scopeClassId === null || body.scopeClassId === ''
      ? null
      : Number(body.scopeClassId)

  if (scopeType === 'grade' && !Number.isInteger(scopeGradeId as number)) {
    throw createError({ statusCode: 400, message: 'scopeType=grade 时必须指定 scopeGradeId' })
  }
  if (scopeType === 'class' && !Number.isInteger(scopeClassId as number)) {
    throw createError({ statusCode: 400, message: 'scopeType=class 时必须指定 scopeClassId' })
  }

  // scopes 白名单校验（未知项直接拒绝，避免存进库后成为死配置）
  const scopesJson = normalizeScopes(body?.scopes)

  // ===== 范围不得超过签发者自身管辖 =====
  // 这是本接口的核心安全约束：班级管理员只能签出本班凭证，
  // 年级管理员不能签出全校凭证 —— 否则外部 API 会成为提权通道。
  await assertIssuableScope({
    admin,
    targetSchoolId: schoolId,
    scopeType,
    scopeGradeId,
    scopeClassId,
    schoolDb,
  })

  // ===== 有效期 =====
  let expiresAt: string | null = null
  if (body?.expiresInDays !== undefined && body.expiresInDays !== null && body.expiresInDays !== '') {
    const days = Number(body.expiresInDays)
    if (!Number.isInteger(days) || days <= 0 || days > MAX_EXPIRE_DAYS) {
      throw createError({ statusCode: 400, message: `有效期需为 1 ~ ${MAX_EXPIRE_DAYS} 之间的整数天` })
    }
    expiresAt = new Date(Date.now() + days * 86400_000).toISOString()
  }

  // ===== 落库 =====
  const { plain, prefix, hash } = generateToken()

  const [created] = await useMainDb()
    .insert(apiTokens)
    .values({
      name,
      tokenPrefix: prefix,
      tokenHash: hash,
      schoolId,
      scopeType,
      scopeGradeId: scopeType === 'grade' ? scopeGradeId : null,
      scopeClassId: scopeType === 'class' ? scopeClassId : null,
      scopes: scopesJson,
      createdByAdminId: admin.id,
      createdByRole: admin.role,
      expiresAt,
    })
    .returning()
    .all()

  return {
    success: true,
    message: '凭证已生成，请立即复制保存 —— 明文不会再次显示',
    data: {
      id: Number(created.id),
      name: created.name,
      tokenPrefix: created.tokenPrefix,
      scopeType: created.scopeType,
      scopeGradeId: created.scopeGradeId,
      scopeClassId: created.scopeClassId,
      scopes: JSON.parse(created.scopes || '[]'),
      expiresAt: created.expiresAt,
      createdAt: created.createdAt,
    },
    /** 明文 token，仅此一次返回 */
    token: plain,
  }
})
