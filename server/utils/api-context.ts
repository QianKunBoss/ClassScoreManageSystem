// ===== 外部开放 API：请求上下文与范围过滤助手 =====
//
// 每个 v1 端点都需要同一套四件套：token、分库 drizzle 实例、raw client、范围对象。
// 抽在这里不只是少写几行 —— 更重要的是让"范围过滤"只有一份实现。
// 如果每个端点各自拼 WHERE，早晚会有人漏掉 class_id IN (...)，那就是越权读取。

import { useSchoolDb, getSchoolRawClient } from '../database/db'
import { useApiToken, useApiScope, type ApiTokenRow } from './api-token'

export interface ApiContext {
  token: ApiTokenRow
  schoolId: number
  /** drizzle 实例（学校分库） */
  db: any
  /** libsql 原始 client，用于需要 JOIN / 聚合的查询 */
  client: any
  /** 与 resolveSchoolScope() 同构的范围对象 */
  scope: any
}

/**
 * 取当前 v1 请求的完整上下文。
 * schoolId 只来自 token 记录，**不接受任何请求参数覆盖** ——
 * 内部接口允许超管用 ?schoolId= 切换学校，外部 token 绝不可以跨校。
 */
export async function useApiContext(event: any): Promise<ApiContext> {
  if (event.context.apiCtx) return event.context.apiCtx

  const token = useApiToken(event)
  const schoolId = Number(token.schoolId)
  const db = await useSchoolDb(event, schoolId)
  const client = await getSchoolRawClient(event, schoolId)
  const scope = await useApiScope(event, db)

  const ctx: ApiContext = { token, schoolId, db, client, scope }
  event.context.apiCtx = ctx
  return ctx
}

// ===== 范围 → SQL 条件 =====

export interface ScopeClause {
  /** 形如 `u.class_id IN (?,?)`；全校范围时为 null（无需附加条件） */
  sql: string | null
  args: number[]
  /** true 表示范围为空集，端点可直接返回空列表，省掉一次必然无结果的查询 */
  empty: boolean
}

/**
 * 把 id 集合拼成安全的 IN 条件。
 *
 * 空集返回 `1 = 0` 而不是 null 或空串，这一点很关键：
 *   - 拼 `IN ()` 是 SQLite 语法错误；
 *   - 拼 null / 空串会让 WHERE 整段消失，条件从"仅限这些班级"退化为"全表" —— 即越权。
 * 让默认行为是「拒绝」，而不是依赖每个调用方都记得检查 empty。
 */
export function inClause(columnRef: string, ids: number[]): { sql: string; args: number[] } {
  const clean = ids.map(Number).filter((n) => Number.isInteger(n))
  if (clean.length === 0) return { sql: '1 = 0', args: [] }
  return { sql: `${columnRef} IN (${clean.map(() => '?').join(',')})`, args: clean }
}

/**
 * 生成班级维度的范围约束。
 *
 * 【安全】这是外部读接口唯一的越权防线：调用方传的 classId / gradeId 只是"筛选"，
 * 而本条件是"上限"，两者用 AND 串联 —— 筛选永远不可能突破上限。
 */
export function classScopeClause(scope: any, columnRef: string): ScopeClause {
  if (scope?.schoolWide) return { sql: null, args: [], empty: false }

  const ids = Array.from((scope?.classIdSet as Set<number>) || []).map(Number)
  const c = inClause(columnRef, ids)
  return { sql: c.sql, args: c.args, empty: ids.length === 0 }
}

/** 取 token 可见班级 id 数组（全校范围返回 null 表示不受限） */
export function scopeClassIds(scope: any): number[] | null {
  if (scope?.schoolWide) return null
  return Array.from((scope?.classIdSet as Set<number>) || []).map(Number)
}

/**
 * 解析 token 可见的年级 id 集合。
 * 返回 null 代表不受限（全校）。class 范围的 token 需要反查其班级归属的年级 ——
 * 否则班级 token 调用年级列表会拿到全校年级。
 */
export async function allowedGradeIds(ctx: ApiContext): Promise<number[] | null> {
  const { scope, client } = ctx
  if (scope?.schoolWide) return null

  const gradeSet = scope?.gradeIdSet as Set<number> | null
  if (gradeSet && gradeSet.size > 0) return Array.from(gradeSet).map(Number)

  const classIds = Array.from((scope?.classIdSet as Set<number>) || []).map(Number)
  if (classIds.length === 0) return []

  const res = await client.execute({
    sql: `SELECT DISTINCT grade_id FROM classes WHERE id IN (${classIds.map(() => '?').join(',')})`,
    args: classIds,
  })
  return (res.rows as any[]).map((r) => Number(r.grade_id)).filter((n) => Number.isInteger(n))
}

// ===== 时间区间参数 =====

/**
 * 把 startDate / endDate 归一化成可与 created_at 直接做字符串比较的边界。
 *
 * created_at 存的是 new Date().toISOString()（UTC，形如 2026-08-30T15:04:05.123Z），
 * ISO 8601 的字典序与时间序一致，因此无需 date() 函数即可比较，且能用上索引。
 * 传 YYYY-MM-DD 时自动补全为当日 00:00:00.000 / 23:59:59.999（**按 UTC 计**，见 docs/API.md）。
 */
export function normalizeDateBound(raw: any, kind: 'start' | 'end'): string | null {
  const v = String(raw ?? '').trim()
  if (!v) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return kind === 'start' ? `${v}T00:00:00.000Z` : `${v}T23:59:59.999Z`
  }
  // 完整 ISO 串原样透传；其余格式视为非法，交由调用方修正
  if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return v

  return null
}
