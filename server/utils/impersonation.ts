import { and, eq } from 'drizzle-orm'
import { getRequestIP, getRequestHeader } from 'h3'
import type { H3Event } from 'h3'
import { admins, adminImpersonationLogs } from '../database/schema.main'
import { useMainDb, getMainRawClient } from '../database/db'

export type AdminRow = typeof admins.$inferSelect
export type OrgScope = 'school' | 'grade' | 'class'

export interface PickResult {
  admin: AdminRow | null
  /** 是否因为目标账号未完成安全初始化而被迫绕过 */
  bypassedSecurity: boolean
  candidates: number
  /** 实际命中的层级（目标层级无管理员时会向上回退） */
  matchedScope: OrgScope | null
  /** 是否发生了向上回退 */
  fallback: boolean
}

/** 在某一层级内挑选：优先已完成安全初始化（已改密且已绑邮箱）的账号，随机取一个 */
async function pickTier(
  schoolId: number,
  role: string,
  extra: { gradeId?: number; classId?: number },
) {
  const db = useMainDb()
  const conds = [eq(admins.schoolId, schoolId), eq(admins.role, role), eq(admins.disabled, 0)]
  if (extra.gradeId != null) conds.push(eq(admins.gradeId, extra.gradeId))
  if (extra.classId != null) conds.push(eq(admins.classId, extra.classId))

  const rows = await db.select().from(admins).where(and(...conds)).all()
  if (!rows.length) return null

  const ready = rows.filter((a: AdminRow) => !a.mustChangePassword && !!a.email)
  const pool = ready.length ? ready : rows
  return {
    admin: pool[Math.floor(Math.random() * pool.length)] as AdminRow,
    bypassedSecurity: ready.length === 0,
    candidates: rows.length,
  }
}

/**
 * 按目标组织层级选人（策略 B）：
 * - class：班级管理员 → 年级管理员 → 学校管理员
 * - grade：年级管理员 → 学校管理员
 * - school：学校管理员
 * 每级内部优先已完成安全初始化的账号；只有该级没有管理员才向上回退。
 */
export async function pickOrgAdmin(
  schoolId: number,
  scope: OrgScope,
  gradeId?: number,
  classId?: number,
): Promise<PickResult> {
  const tiers: Array<{ scope: OrgScope; role: string; extra: { gradeId?: number; classId?: number } }> = []

  if (scope === 'class') {
    tiers.push({ scope: 'class', role: 'class_admin', extra: { gradeId, classId } })
    if (gradeId != null) tiers.push({ scope: 'grade', role: 'grade_admin', extra: { gradeId } })
    tiers.push({ scope: 'school', role: 'school_admin', extra: {} })
  } else if (scope === 'grade') {
    tiers.push({ scope: 'grade', role: 'grade_admin', extra: { gradeId } })
    tiers.push({ scope: 'school', role: 'school_admin', extra: {} })
  } else {
    tiers.push({ scope: 'school', role: 'school_admin', extra: {} })
  }

  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i]
    const hit = await pickTier(schoolId, t.role, t.extra)
    if (hit) return { ...hit, matchedScope: t.scope, fallback: i > 0 }
  }

  return { admin: null, bypassedSecurity: false, candidates: 0, matchedScope: null, fallback: false }
}

export interface ImpersonationLogPayload {
  action: 'enter' | 'exit'
  actorId: number
  actorName: string
  targetId?: number | null
  targetName?: string | null
  schoolId?: number | null
  schoolName?: string | null
  nodeKind?: OrgScope | null
  nodeName?: string | null
  bypassedSecurity?: boolean
}

/**
 * 写入冒充审计日志。
 * 故意不吞异常：审计写不进去时不放行冒充操作（fail-closed）。
 * 表在进程内首次写入前自愈创建/补列，避免「老库未重启」导致功能不可用。
 */
let schemaEnsured: Promise<void> | null = null

async function ensureLogTable() {
  if (schemaEnsured) return schemaEnsured
  const client = getMainRawClient()
  schemaEnsured = (async () => {
    await client.execute(`CREATE TABLE IF NOT EXISTS admin_impersonation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      actor_id INTEGER NOT NULL,
      actor_name TEXT NOT NULL,
      target_id INTEGER,
      target_name TEXT,
      school_id INTEGER,
      school_name TEXT,
      node_kind TEXT,
      node_name TEXT,
      bypassed_security INTEGER NOT NULL DEFAULT 0,
      ip TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`)
    // 兼容本次改动前已创建的表
    for (const ddl of [
      'ALTER TABLE admin_impersonation_logs ADD COLUMN node_kind TEXT',
      'ALTER TABLE admin_impersonation_logs ADD COLUMN node_name TEXT',
    ]) {
      try { await client.execute(ddl) } catch { /* 列已存在 */ }
    }
    await client.execute('CREATE INDEX IF NOT EXISTS imp_logs_created_idx ON admin_impersonation_logs(created_at)')
    await client.execute('CREATE INDEX IF NOT EXISTS imp_logs_actor_idx ON admin_impersonation_logs(actor_id, created_at)')
  })()
  try {
    await schemaEnsured
  } catch (err) {
    schemaEnsured = null
    throw err
  }
  return schemaEnsured
}

export async function writeImpersonationLog(event: H3Event, p: ImpersonationLogPayload) {
  await ensureLogTable()

  const db = useMainDb()
  const ip = getRequestIP(event, { xForwardedFor: true }) || null
  const userAgent = getRequestHeader(event, 'user-agent') || null

  await db.insert(adminImpersonationLogs).values({
    action: p.action,
    actorId: p.actorId,
    actorName: p.actorName,
    targetId: p.targetId ?? null,
    targetName: p.targetName ?? null,
    schoolId: p.schoolId ?? null,
    schoolName: p.schoolName ?? null,
    nodeKind: p.nodeKind ?? null,
    nodeName: p.nodeName ?? null,
    bypassedSecurity: p.bypassedSecurity ? 1 : 0,
    ip,
    userAgent,
  })
}

/** 会话中保存的原超管身份（用于「退出模拟」） */
export interface ImpersonatorInfo {
  adminId: number
  username: string
}

export function getImpersonator(session: any): ImpersonatorInfo | null {
  const imp = session?.data?.impersonator
  if (!imp?.adminId) return null
  return { adminId: Number(imp.adminId), username: String(imp.username || '') }
}

/** 目标管理员身份 → 会话数据 */
export function sessionDataOf(admin: AdminRow, impersonator?: ImpersonatorInfo) {
  const data: Record<string, any> = {
    adminId: admin.id,
    username: admin.username,
    role: admin.role,
    schoolId: admin.schoolId,
    gradeId: admin.gradeId,
    classId: admin.classId,
  }
  if (impersonator) data.impersonator = impersonator
  return data
}
