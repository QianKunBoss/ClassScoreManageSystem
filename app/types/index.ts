// == CSMS 类型定义 - 匹配实际 API 返回结构 ==

/** 管理员角色 */
export type AdminRole = 'super_admin' | 'school_admin' | 'grade_admin' | 'class_admin'

/** 管理员 */
export interface Admin {
  id: number
  username: string
  role: AdminRole
  schoolId: number | null
  gradeId: number | null
  classId: number | null
  mustChangePassword?: boolean
  createdAt: string
  lastLogin: string | null
  email?: string | null
  emailBoundAt?: string | null
  disabled?: number
  // 关联名称（API 联表查询返回）
  schoolName?: string
  gradeName?: string
  className?: string
}

/** 学校 */
export interface School {
  id: number
  name: string
  createdAt: string
}

/** 年级 */
export interface Grade {
  id: number
  schoolId: number
  name: string
  createdAt: string
  schoolName?: string
}

/** 班级 */
export interface Class {
  id: number
  gradeId: number
  name: string
  createdAt: string
  gradeName?: string
  schoolName?: string
}

/** 学生 */
export interface User {
  id: number
  classId: number | null
  username: string
  actualName?: string | null
  totalScore: number
  addScore?: number
  deductScore?: number
  scoreCount: number
  email?: string | null
  disabled?: number
  createdAt: string
  // 关联
  className?: string
  gradeName?: string
}

/** 积分记录 */
export interface ScoreLog {
  id: number
  userId: number
  username: string
  scoreChange: number
  description: string | null
  createdAt: string
}

/** 积分模板 */
export interface ScoreTemplate {
  id: number
  classId: number | null
  name: string
  scoreChange: number
  description: string | null
  createdAt: string
  updatedAt: string
}

/** 座位布局配置 */
export interface SeatLayoutConfig {
  id: number
  classId: number
  groupCount: number
  rowsPerGroup: number
  colsPerGroup: number
  hasAisle: number
}

/** 座位数据 */
export interface SeatData {
  id: number
  classId: number
  groupIndex: number
  rowIndex: number
  colIndex: number
  userId: number | null
  username?: string
  actualName?: string | null
  isAisle: number
}

/** API 分页响应 */
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

/** 认证响应 */
export interface AuthResponse {
  success: boolean
  admin?: Admin
  message?: string
}

/** 通用 API 响应 */
export interface ApiResponse {
  success: boolean
  message?: string
  data?: unknown
}

/** 入驻申请 */
export interface Application {
  id: number
  schoolName: string
  gradeName: string | null
  className: string | null
  applicantName: string
  contactPhone: string | null
  contactEmail: string | null
  reason: string | null
  status: 'pending' | 'approved' | 'rejected'
  reviewNote: string | null
  reviewedBy: number | null
  reviewedAt: string | null
  createdAt: string
  createdSchoolId: number | null
  createdAdminId: number | null
  schoolDeleted?: number
  deletedSchoolId?: number | null
}

/** 审核通过后返回的管理员账号信息 */
export interface CreatedAccount {
  username: string
  password: string
  role: string
  school: string
  grade: string | null
  class: string | null
}

/** 邮件服务（多服务优先级故障转移） */
export interface MailService {
  id: number
  name: string
  provider: string
  host: string
  port: number
  secure: 'none' | 'ssl' | 'tls'
  username: string
  password: string
  fromName: string
  fromAddress: string
  priority: number
  enabled: number // 1=启用 0=禁用
  createdAt: string
  updatedAt: string | null
}

/** 邮件模板 */
export interface MailTemplate {
  id: number
  slug: string
  name: string
  subject: string
  bodyHtml: string
  variables: string // JSON 数组字符串，如 '["code","email"]'
  createdAt: string
  updatedAt: string | null
}

/** 外部 API 凭证的范围类型 */
export type ApiScopeType = 'school' | 'grade' | 'class'

/**
 * 外部 API 凭证（列表视图）
 *
 * 注意这里**没有** token 明文字段 —— 明文只在签发响应中出现一次，
 * 库里只留 sha256，所以列表永远拿不到，前端也不该缓存它。
 */
export interface ApiTokenItem {
  id: number
  name: string
  /** 明文前 12 位，用于人工辨识（如 csms_AbC12345） */
  tokenPrefix: string
  scopeType: ApiScopeType
  scopeGradeId: number | null
  scopeClassId: number | null
  /** 服务端拼好的中文范围描述，如「高一（全年级）」 */
  scopeLabel: string
  scopes: string[]
  disabled: boolean
  expiresAt: string | null
  /** 是否已过期，由服务端判定，避免前端各处重复处理时区 */
  expired: boolean
  lastUsedAt: string | null
  lastUsedIp: string | null
  callCount: number
  createdByRole: string | null
  createdByAdmin: string | null
  createdAt: string
}

/** 签发表单元数据里的单个权限项 */
export interface ApiScopeMeta {
  key: string
  label: string
  group: string
  desc: string
  /** 高破坏力权限（删除类），界面上需显著警示 */
  dangerous: boolean
}

/** 外部 API 调用审计日志 */
export interface ApiAuditLogItem {
  id: number
  tokenId: number | null
  tokenPrefix: string
  method: string
  path: string
  statusCode: number
  latencyMs: number
  ip: string
  userAgent: string
  requestId: string
  errorMessage: string
  createdAt: string
}
