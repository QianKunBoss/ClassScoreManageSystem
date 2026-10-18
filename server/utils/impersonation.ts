import { and, eq } from 'drizzle-orm'
import { getRequestIP, getRequestHeader } from 'h3'
import type { H3Event } from 'h3'
import { admins, adminImpersonationLogs } from '../database/schema.main'
import { useMainDb, getMainRawClient } from '../database/db'

export type AdminRow = typeof admins.$inferSelect

export interface PickResult {
  admin: AdminRow | null
  /** 是否因为目标账号未完成安全初始化而被迫绕过 */
  bypassedSecurity: boolean
  candidates: number
}

/**
 * 按「策略 B」挑选某校的学校管理员：
 * 1. 只考虑 role=school_admin、school_id 精确匹配、未封禁的账号；
 * 2. 优先已完成安全初始化（mustChangePassword=0 且已绑定邮箱）的账号，随机取一个；
 * 3. 若全部未完成初始化，才回退到这批账号中随机取一个（bypassedSecurity=true）。
 */
export async function pickSchoolAdmin(schoolId: number): Promise<PickResult> {
  const db = useMainDb()
  const rows = await db
    .select()
    .from(admins)
    .where(and(
      eq(admins.schoolId, schoolId),
      eq(admins.role, 'school_admin'),
      eq(admins.disabled, 0),
    ))
    .all()

  if (!rows.length) return { admin: null, bypassedSecurity: false, candidates: 0 }

  const ready = rows.filter((a: AdminRow) => !a.mustChangePassword && !!a.email)
  const pool = ready.length ? ready : rows
  const picked = pool[Math.floor(Math.random() * pool.length)]
  return { admin: picked, bypassedSecurity: ready.length === 0, candidates: rows.length }
}

export interface ImpersonationLogPayload {
  action: 'enter' | 'exit'
  actorId: number
  actorName: string
  targetId?: number | null
  targetName?: string | null
  schoolId?: number | null
  schoolName?: string | null
  bypassedSecurity?: boolean
}

/**
 * 写入冒充审计日志。
 * 故意不吞异常：审计写不进去时不放行冒充操作（fail-closed）。
 * 表在进程内首次写入前自愈创建，避免「老库未重启」导致功能不可用。
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
      bypassed_security INTEGER NOT NULL DEFAULT 0,
      ip TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`)
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
