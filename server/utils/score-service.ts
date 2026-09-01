// ===== 积分变更公共服务 =====
//
// 加分/减分是系统里唯一不可逆的核心写操作。它同时被两条入口调用：
//   1. 内部管理端 POST /api/scores/add（session 鉴权）
//   2. 外部开放 API POST /api/v1/scores（api_token 鉴权）
// 两份独立实现必然会在分值上限、越权判定、汇总字段同步这些细节上漂移，
// 因此把逻辑收敛到这里，两端都只负责鉴权和参数适配。
//
// scope 参数接受 resolveSchoolScope()（内部）或 resolveTokenScope()（外部）的产物，
// 二者返回同构对象（都有 isClassAllowed / isGradeAllowed），故可通用。

import { eq, sql } from 'drizzle-orm'
import { users, scoreLogs } from '../database/schema.school'

/** 单次加/减分的合法区间（防止 NaN / Infinity / 荒谬数值污染积分） */
export const MAX_SCORE_DELTA = 10000

/** 与 resolveSchoolScope / resolveTokenScope 返回值兼容的最小接口 */
export interface ScopeLike {
  isClassAllowed: (classId: number) => boolean
  isGradeAllowed: (gradeId: number) => boolean
}

export interface ScoreChangeItem {
  /** 优先使用 userId 精确定位；缺省时回退到 username 全校匹配 */
  userId?: number
  username?: string
  scoreChange: number
  description?: string
}

export interface ScoreChangeDetail {
  username: string | null
  userId: number | null
  scoreChange: number | null
  success: boolean
  error?: string
  /**
   * 成功写入的流水 ID，失败时为 null。
   *
   * 【为什么必须回传】撤销接口 DELETE /api/v1/scores/:logId 以 logId 为唯一入参。
   * 若不回传，对接方加分后只能反查 GET /api/v1/scores 列表来猜哪条是自己刚写的 ——
   * 并发下会撤错记录。回传 ID 让"写入-撤销"成为闭环。
   */
  logId: number | null
}

export interface ApplyScoreResult {
  successCount: number
  failedCount: number
  totalCount: number
  details: ScoreChangeDetail[]
}

/**
 * 批量应用积分变更。逐条处理，单条失败不影响其余条目（返回 details 里标注原因）。
 *
 * 【安全】每条都会用 scope.isClassAllowed 校验学生所属班级：
 * 加分按 username 全校匹配，若不收窄范围，班级管理员只要知道别班学生用户名就能改对方积分。
 */
export async function applyScoreChanges(opts: {
  db: any
  scope: ScopeLike
  items: ScoreChangeItem[]
  /** 条目未单独指定 description 时的兜底文案 */
  defaultDescription?: string
}): Promise<ApplyScoreResult> {
  const { db, scope, items, defaultDescription = '' } = opts

  const details: ScoreChangeDetail[] = []
  let successCount = 0
  let failedCount = 0

  for (const item of items) {
    const delta = Number(item.scoreChange)
    if (!Number.isFinite(delta) || !Number.isInteger(delta) || Math.abs(delta) > MAX_SCORE_DELTA) {
      failedCount++
      details.push({
        username: item.username ?? null,
        userId: item.userId ?? null,
        scoreChange: null,
        success: false,
        error: `分值不合法（需为 ±${MAX_SCORE_DELTA} 内的整数）`,
        logId: null,
      })
      continue
    }

    // 定位学生：userId 优先（外部 API 常用），否则按 username
    let userData: any = null
    if (item.userId != null) {
      userData = await db.select().from(users).where(eq(users.id, Number(item.userId))).get()
    } else if (item.username) {
      userData = await db.select().from(users).where(eq(users.username, item.username)).get()
    }

    if (!userData) {
      failedCount++
      details.push({
        username: item.username ?? null,
        userId: item.userId ?? null,
        scoreChange: null,
        success: false,
        error: '用户不存在',
        logId: null,
      })
      continue
    }

    // 越权拦截：学生所属班级必须在调用方的管理范围内
    if (!scope.isClassAllowed(Number(userData.classId))) {
      failedCount++
      details.push({
        username: userData.username,
        userId: userData.id,
        scoreChange: null,
        success: false,
        error: '无权限操作该学生',
        logId: null,
      })
      continue
    }

    const description = item.description ?? defaultDescription

    // returning 取回自增 ID：外部 API 的撤销闭环依赖它（见 ScoreChangeDetail.logId）
    const inserted = await db
      .insert(scoreLogs)
      .values({
        userId: userData.id,
        username: userData.username,
        scoreChange: delta,
        description,
        createdAt: new Date().toISOString(),
      })
      .returning({ id: scoreLogs.id })
      .get()

    // 同步累加汇总字段（原子 SQL 表达式，避免读-改-写竞态）。
    // 历史实现只累加 total_score，导致 add_score / deduct_score / score_count 长期为 0；
    // 页面靠 SUM(score_logs) 实时聚合所以显示正常，但这三列的数据一直是脏的 —— 此处一并修正。
    await db
      .update(users)
      .set({
        totalScore: sql`total_score + ${delta}`,
        addScore: delta > 0 ? sql`add_score + ${delta}` : sql`add_score`,
        deductScore: delta < 0 ? sql`deduct_score + ${Math.abs(delta)}` : sql`deduct_score`,
        scoreCount: sql`score_count + 1`,
      })
      .where(eq(users.id, userData.id))

    successCount++
    details.push({
      username: userData.username,
      userId: userData.id,
      scoreChange: delta,
      success: true,
      logId: inserted?.id == null ? null : Number(inserted.id),
    })
  }

  return { successCount, failedCount, totalCount: items.length, details }
}

/**
 * 撤销单条积分记录：删除流水并对称回滚学生汇总字段。
 *
 * 【安全】历史实现直接 DELETE，既不校验管理范围（任意管理员可删别校/别班记录），
 * 也不回滚 users 汇总字段。这里补齐两者。
 */
export async function revokeScoreLog(opts: {
  db: any
  scope: ScopeLike
  logId: number
}): Promise<{ userId: number; username: string; scoreChange: number }> {
  const { db, scope, logId } = opts

  if (!Number.isInteger(logId) || logId <= 0) {
    throw createError({ statusCode: 400, message: '积分记录 ID 不合法' })
  }

  const log = await db.select().from(scoreLogs).where(eq(scoreLogs.id, logId)).get()
  if (!log) {
    throw createError({ statusCode: 404, message: '积分记录不存在' })
  }

  const userData = await db.select().from(users).where(eq(users.id, log.userId)).get()
  // 学生可能已被删除（score_logs 级联删除应已带走，防御性处理）
  if (userData && !scope.isClassAllowed(Number(userData.classId))) {
    throw createError({ statusCode: 403, message: '无权限操作该学生的积分记录' })
  }

  await db.delete(scoreLogs).where(eq(scoreLogs.id, logId))

  if (userData) {
    const delta = Number(log.scoreChange)
    await db
      .update(users)
      .set({
        totalScore: sql`total_score - ${delta}`,
        addScore: delta > 0 ? sql`max(add_score - ${delta}, 0)` : sql`add_score`,
        deductScore: delta < 0 ? sql`max(deduct_score - ${Math.abs(delta)}, 0)` : sql`deduct_score`,
        scoreCount: sql`max(score_count - 1, 0)`,
      })
      .where(eq(users.id, userData.id))
  }

  return { userId: log.userId, username: log.username, scoreChange: log.scoreChange }
}
