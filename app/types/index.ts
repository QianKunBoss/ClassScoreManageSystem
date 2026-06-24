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
  totalScore: number
  scoreCount: number
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
