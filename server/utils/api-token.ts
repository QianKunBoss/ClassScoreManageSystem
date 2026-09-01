// ===== 外部开放 API 凭证：生成、校验、范围解析 =====
//
// 设计前提：/api/v1/** 是唯一接受 api_token 的路径前缀，内部 /api/** 只认 session。
// 两套鉴权互不串门 —— 这样"系统数据不可被外部操作"就成了架构事实，
// 而不是需要在上百个接口里逐个维护的黑名单。

import { createHash, randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { useMainDb } from '../database/db'
import { apiTokens, admins, schools } from '../database/schema.main'
import { classes, grades } from '../database/schema.school'
import { API_CODE, apiError } from './api-response'

/** token 明文前缀，便于在日志/代码库里一眼识别泄露的凭证 */
const TOKEN_PLAINTEXT_PREFIX = 'csms_'
/** 存入 token_prefix 的长度（含 'csms_'），仅用于识别，不足以还原密钥 */
const TOKEN_PREFIX_LEN = 12

/** 全部可用 scope。新增端点时必须同步维护此表与 docs/API.md */
export const API_SCOPES = [
  'students:read',
  'students:write',
  'students:delete',
  'scores:read',
  'scores:write',
  'scores:revoke',
  'structure:read',
  'structure:write',
  'structure:delete',
  'templates:read',
  'templates:write',
  'stats:read',
] as const

export type ApiScope = typeof API_SCOPES[number]

/** 破坏性 scope：管理界面默认不勾选并标红警示 */
export const DANGEROUS_SCOPES: readonly ApiScope[] = ['students:delete', 'structure:delete']

export type ApiScopeType = 'school' | 'grade' | 'class'

export interface ApiTokenRow {
  id: number
  name: string
  tokenPrefix: string
  schoolId: number
  scopeType: string
  scopeGradeId: number | null
  scopeClassId: number | null
  scopes: string
  createdByAdminId: number | null
  createdByRole: string
  disabled: number
  expiresAt: string | null
  callCount: number
  createdAt: string
}

// ===== 生成 =====

/** 生成一枚新 token，返回明文（仅此一次可见）、前缀与哈希 */
export function generateToken(): { plain: string; prefix: string; hash: string } {
  const plain = TOKEN_PLAINTEXT_PREFIX + randomBytes(32).toString('base64url')
  return {
    plain,
    prefix: plain.slice(0, TOKEN_PREFIX_LEN),
    hash: hashToken(plain),
  }
}

/**
 * sha256 而非 bcrypt —— 这不是妥协，是正确选择：
 * bcrypt 带随机盐，无法建索引，鉴权只能全表扫描逐个 compare（O(n) × ~100ms）；
 * 而 token 是 256bit 高熵随机串，不存在字典/彩虹表风险，单次 sha256 已足够抗还原。
 * 低熵的人选密码才必须用 bcrypt。
 */
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex')
}

// ===== 提取与校验 =====

/** 从请求头提取 token 明文：Authorization: Bearer xxx 优先，其次 X-API-Token */
export function extractRawToken(event: any): string | null {
  const headers = getRequestHeaders(event)
  const auth = headers.authorization || (headers as any).Authorization
  if (typeof auth === 'string' && auth.length > 7 && auth.slice(0, 7).toLowerCase() === 'bearer ') {
    const v = auth.slice(7).trim()
    if (v) return v
  }
  const alt = headers['x-api-token']
  if (typeof alt === 'string' && alt.trim()) return alt.trim()
  return null
}

/**
 * 明文 token → 有效的 token 记录。任一环节不通过一律抛错，绝不放行。
 *
 * 查找方式：sha256(明文) 对 token_hash 唯一索引做等值查询，常数时间命中。
 * 【注意】不要改成"先按 token_prefix 查候选再逐个比 hash" —— 那才会引入
 * 可被计时观测的比较过程；当前写法由 SQLite 在索引内部完成，且 token 高熵，
 * 无需额外 timingSafeEqual。
 */
export async function authenticateToken(event: any): Promise<ApiTokenRow> {
  const raw = extractRawToken(event)
  if (!raw) {
    apiError(401, API_CODE.TOKEN_MISSING, '缺少 api_token，请通过 Authorization: Bearer <token> 或 X-API-Token 头传入')
  }

  const db = useMainDb()
  const row = await db.select().from(apiTokens).where(eq(apiTokens.tokenHash, hashToken(raw))).get() as ApiTokenRow | undefined

  // 未命中与"已禁用"给不同提示是有意的：能拿到具体原因说明持有者本就掌握有效密钥，
  // 不构成信息泄露；反而能让对接方自行排查，减少运维沟通成本。
  if (!row) {
    apiError(401, API_CODE.TOKEN_INVALID, 'api_token 无效')
  }
  if (row.disabled === 1) {
    apiError(401, API_CODE.TOKEN_DISABLED, 'api_token 已被禁用')
  }
  if (row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now()) {
    apiError(401, API_CODE.TOKEN_EXPIRED, 'api_token 已过期')
  }

  // 学校维度：不存在（理论上被 cascade 带走）或已停用，一律拒绝
  const school = await db.select({ id: schools.id, disabled: schools.disabled })
    .from(schools).where(eq(schools.id, row.schoolId)).get()
  if (!school) {
    apiError(403, API_CODE.SCHOOL_DISABLED, '关联学校不存在')
  }
  if (school.disabled === 1) {
    apiError(403, API_CODE.SCHOOL_DISABLED, '关联学校已停用')
  }

  // 签发者仍在但已被禁用 → 其派生凭证同时失效。
  // 禁用管理员是一个安全动作，如果不联动，被禁用的人手里的 token 还能继续写数据。
  // 而签发者被「删除」时 created_by_admin_id 变 null，token 仍有效 ——
  // 删人通常是离职流程，强行断掉生产对接会导致运维不敢删账号。差异见 docs/API.md。
  if (row.createdByAdminId != null) {
    const issuer = await db.select({ disabled: admins.disabled })
      .from(admins).where(eq(admins.id, row.createdByAdminId)).get()
    if (issuer && issuer.disabled === 1) {
      apiError(401, API_CODE.TOKEN_ISSUER_DISABLED, 'api_token 的签发者已被禁用，该凭证已失效')
    }
  }

  return row
}

// ===== scope 校验 =====

export function parseScopes(token: ApiTokenRow): string[] {
  try {
    const arr = JSON.parse(token.scopes || '[]')
    return Array.isArray(arr) ? arr.map(String) : []
  } catch {
    return []
  }
}

/** 校验 token 是否具备某项权限，不具备抛 403 */
export function assertScope(token: ApiTokenRow, needed: ApiScope): void {
  if (!parseScopes(token).includes(needed)) {
    apiError(403, API_CODE.SCOPE_DENIED, `当前 api_token 缺少 ${needed} 权限`)
  }
}

// ===== 范围解析 =====

/**
 * 把 token 的作用范围翻译成与 resolveSchoolScope() 同构的对象，
 * 于是 score-service 等公共逻辑对内部/外部两条入口可以一视同仁。
 *
 * grade 类型的 token 每次动态查询该年级下的班级集合，而不是签发时快照 ——
 * 「这个年级」的语义应当包含之后新建的班级，也与内部 grade_admin 的行为一致。
 */
export async function resolveTokenScope(token: ApiTokenRow, db: any) {
  const scopeType = token.scopeType as ApiScopeType

  if (scopeType === 'school') {
    return {
      scopeType,
      schoolWide: true,
      gradeIdSet: null as Set<number> | null,
      classIdSet: null as Set<number> | null,
      isGradeAllowed: () => true,
      isClassAllowed: () => true,
    }
  }

  if (scopeType === 'grade') {
    const gradeId = Number(token.scopeGradeId)
    const rows = await db.select({ id: classes.id }).from(classes).where(eq(classes.gradeId, gradeId))
    const classIdSet = new Set<number>(rows.map((r: any) => Number(r.id)))
    return {
      scopeType,
      schoolWide: false,
      gradeIdSet: new Set<number>([gradeId]),
      classIdSet,
      isGradeAllowed: (gid: number) => Number(gid) === gradeId,
      isClassAllowed: (cid: number) => classIdSet.has(Number(cid)),
    }
  }

  if (scopeType === 'class') {
    const classId = Number(token.scopeClassId)
    return {
      scopeType,
      schoolWide: false,
      gradeIdSet: null as Set<number> | null,
      classIdSet: new Set<number>([classId]),
      isGradeAllowed: () => false,
      isClassAllowed: (cid: number) => Number(cid) === classId,
    }
  }

  // 未知 scope_type：默认零权限，宁可拒绝也不放行
  return {
    scopeType,
    schoolWide: false,
    gradeIdSet: new Set<number>(),
    classIdSet: new Set<number>(),
    isGradeAllowed: () => false,
    isClassAllowed: () => false,
  }
}

/** 取当前请求的 token（由 middleware 挂载）；缺失说明中间件未生效，属编码错误 */
export function useApiToken(event: any): ApiTokenRow {
  const token = event.context.apiToken as ApiTokenRow | undefined
  if (!token) {
    apiError(401, API_CODE.TOKEN_MISSING, '缺少 api_token')
  }
  return token
}

/** 取当前请求的范围对象，首次调用时惰性解析并缓存到 context */
export async function useApiScope(event: any, db: any) {
  if (!event.context.apiScope) {
    event.context.apiScope = await resolveTokenScope(useApiToken(event), db)
  }
  return event.context.apiScope
}

// ===== 签发范围收窄（供内部管理接口调用）=====

/**
 * 校验签发请求是否超出签发者自身管辖范围，超出即抛 403。
 * 【安全】这是"各级管理员都可签发 token"这一决策能够成立的唯一前提：
 * 班级管理员不能签发出一枚能操作全校的凭证，否则等于权限提升漏洞。
 */
export async function assertIssuableScope(opts: {
  admin: any
  targetSchoolId: number
  scopeType: ApiScopeType
  scopeGradeId: number | null
  scopeClassId: number | null
  /** 目标学校的分库，用于 grade_admin 校验班级归属 */
  schoolDb: any
}): Promise<void> {
  const { admin, targetSchoolId, scopeType, scopeGradeId, scopeClassId, schoolDb } = opts
  const role = admin.role

  if (!['school', 'grade', 'class'].includes(scopeType)) {
    throw createError({ statusCode: 400, message: 'scopeType 必须是 school / grade / class' })
  }
  if (scopeType === 'grade' && !Number.isInteger(scopeGradeId)) {
    throw createError({ statusCode: 400, message: 'scopeType=grade 时必须指定 scopeGradeId' })
  }
  if (scopeType === 'class' && !Number.isInteger(scopeClassId)) {
    throw createError({ statusCode: 400, message: 'scopeType=class 时必须指定 scopeClassId' })
  }

  // ===== 范围目标必须真实存在于目标学校 =====
  // schoolDb 已按 targetSchoolId 打开，因此"存在"即等价于"属于本校"。
  //
  // 【为什么必须查】否则可以签出指向不存在班级的凭证：眼下它读不到任何数据看似无害，
  // 但 SQLite 自增 ID 迟早会走到那个数字 —— 届时这枚沉睡的凭证会突然"激活"到
  // 一个签发时根本不存在的班级上，且台账里没人记得它为何存在。
  if (scopeType === 'grade') {
    const g = await schoolDb.select({ id: grades.id })
      .from(grades).where(eq(grades.id, Number(scopeGradeId))).get()
    if (!g) {
      throw createError({ statusCode: 400, message: '指定的年级不存在' })
    }
  }
  if (scopeType === 'class') {
    const c = await schoolDb.select({ id: classes.id })
      .from(classes).where(eq(classes.id, Number(scopeClassId))).get()
    if (!c) {
      throw createError({ statusCode: 400, message: '指定的班级不存在' })
    }
  }

  // 超级管理员：任意学校、任意范围
  if (role === 'super_admin') return

  // 其余角色：目标学校强制等于自身学校
  if (Number(admin.schoolId) !== Number(targetSchoolId)) {
    throw createError({ statusCode: 403, message: '只能为自己所属的学校签发 api_token' })
  }

  if (role === 'school_admin') return

  if (role === 'grade_admin') {
    const myGradeId = Number(admin.gradeId)
    if (scopeType === 'school') {
      throw createError({ statusCode: 403, message: '年级管理员不能签发全校范围的 api_token' })
    }
    if (scopeType === 'grade' && Number(scopeGradeId) !== myGradeId) {
      throw createError({ statusCode: 403, message: '只能签发本年级范围的 api_token' })
    }
    if (scopeType === 'class') {
      const cls = await schoolDb.select({ gradeId: classes.gradeId })
        .from(classes).where(eq(classes.id, Number(scopeClassId))).get()
      if (!cls || Number(cls.gradeId) !== myGradeId) {
        throw createError({ statusCode: 403, message: '只能签发本年级下班级范围的 api_token' })
      }
    }
    return
  }

  if (role === 'class_admin') {
    if (scopeType !== 'class' || Number(scopeClassId) !== Number(admin.classId)) {
      throw createError({ statusCode: 403, message: '班级管理员只能签发本班范围的 api_token' })
    }
    return
  }

  throw createError({ statusCode: 403, message: '当前角色无权签发 api_token' })
}

/** 供管理接口列表查询复用：判断某 token 是否在管理员可见范围内 */
export async function isTokenVisibleTo(admin: any, token: ApiTokenRow, schoolDb: any): Promise<boolean> {
  const role = admin.role
  if (role === 'super_admin') return true
  if (Number(admin.schoolId) !== Number(token.schoolId)) return false
  if (role === 'school_admin') return true

  if (role === 'grade_admin') {
    const myGradeId = Number(admin.gradeId)
    if (token.scopeType === 'school') return false
    if (token.scopeType === 'grade') return Number(token.scopeGradeId) === myGradeId
    const cls = await schoolDb.select({ gradeId: classes.gradeId })
      .from(classes).where(eq(classes.id, Number(token.scopeClassId))).get()
    return !!cls && Number(cls.gradeId) === myGradeId
  }

  if (role === 'class_admin') {
    return token.scopeType === 'class' && Number(token.scopeClassId) === Number(admin.classId)
  }

  return false
}

/** 校验 scopes 数组合法性，返回归一化后的 JSON 字符串 */
export function normalizeScopes(input: any): string {
  if (!Array.isArray(input) || input.length === 0) {
    throw createError({ statusCode: 400, message: '请至少选择一项权限（scopes）' })
  }
  const set = new Set<string>()
  for (const s of input) {
    const v = String(s).trim()
    if (!(API_SCOPES as readonly string[]).includes(v)) {
      throw createError({ statusCode: 400, message: `未知权限项：${v}` })
    }
    set.add(v)
  }
  return JSON.stringify([...set])
}
