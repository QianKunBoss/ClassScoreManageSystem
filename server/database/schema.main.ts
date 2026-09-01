// ===== 主库 schema：schools / admins / applications / announcements =====
import { sqliteTable, text, integer, unique, index } from 'drizzle-orm/sqlite-core'

export const ROLE_SUPER_ADMIN = 'super_admin'
export const ROLE_SCHOOL_ADMIN = 'school_admin'
export const ROLE_GRADE_ADMIN = 'grade_admin'
export const ROLE_CLASS_ADMIN = 'class_admin'

// ===== schools（主库）=====
export const schools = sqliteTable('schools', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  disabled: integer('disabled').notNull().default(0),  // 0=正常，1=禁用
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  nameUnq: unique('schools_name_unq').on(table.name),
}))

// ===== admins（主库）=====
// schoolId: 该管理员属于哪个学校（null = 超级管理员）
// gradeId/classId: 管辖范围 hint（同库内无 FK，学校库的表在不同文件）
// 同一学校内用户名唯一；不同学校可以重名
export const admins = sqliteTable('admins', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default(ROLE_SCHOOL_ADMIN),
  schoolId: integer('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  gradeId: integer('grade_id'),   // 仅 hint，无跨库 FK
  classId: integer('class_id'),  // 仅 hint，无跨库 FK
  /**
   * @deprecated 已被 api_tokens 表取代（v0.4.0 外部开放 API）。
   * 该字段从未被任何鉴权逻辑读取，仅 server/api/admin/list.get.ts 用它算 hasToken 展示。
   * 保留列以避免迁移风险，后续版本清理。请勿在新代码中使用。
   */
  apiToken: text('api_token'),
  mustChangePassword: integer('must_change_password').notNull().default(0),
  disabled: integer('disabled').notNull().default(0),  // 0=正常，1=禁用
  // 绑定邮箱：用于邮箱登录 / 邮箱验证码登录 / 找回密码。可空（未绑定）；非空时全局唯一
  email: text('email'),
  emailBoundAt: text('email_bound_at'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  lastLogin: text('last_login'),
}, (table) => ({
  // 同一学校内用户名唯一（schoolId 相同 + username 相同 => 冲突）
  // super_admin(schoolId IS NULL) 通过应用层保证用户名唯一
  usernameSchoolUnq: unique('admins_username_school_unq').on(table.username, table.schoolId),
  // 邮箱唯一（仅对非空值生效，允许多个 NULL）
  emailUnq: unique('admins_email_unq').on(table.email),
}))

// ===== applications（主库）=====
export const applications = sqliteTable('applications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  schoolName: text('school_name').notNull(),
  gradeName: text('grade_name'),
  className: text('class_name'),
  applicantName: text('applicant_name').notNull(),
  contactPhone: text('contact_phone'),
  contactEmail: text('contact_email'),
  reason: text('reason'),
  status: text('status').notNull().default('pending'),
  reviewNote: text('review_note'),
  reviewedBy: integer('reviewed_by').references(() => admins.id),
  reviewedAt: text('reviewed_at'),
  createdSchoolId: integer('created_school_id').references(() => schools.id),
  createdAdminId: integer('created_admin_id').references(() => admins.id),
  // 学校被删除标记：该校审核通过后又被超级管理员删除时为 1，用于在「入驻申请」页打黄色「已删除」标签
  schoolDeleted: integer('school_deleted').notNull().default(0),
  // 被删学校 ID 快照：删除学校时把 created_school_id 复制到此列再置空（绕开 FK 约束），
  // 用于在「入驻申请」页即使学校已被删除仍展示其原始学校 ID。
  deletedSchoolId: integer('deleted_school_id'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

// ===== announcements（主库，全局公告）=====
export const announcements = sqliteTable('announcements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  type: text('type').notNull().default('info'),  // info / warning / important
  active: integer('active').notNull().default(1), // 1=启用，0=禁用
  createdBy: integer('created_by').references(() => admins.id),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at'),
})

// ===== third_party_apis（主库，全局）=====
/**
 * @deprecated 历史遗留空表，从未被任何代码读写。外部开放 API 请用 api_tokens。
 * 保留以避免迁移风险，后续版本清理。
 */
export const thirdPartyApis = sqliteTable('third_party_apis', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  apiName: text('api_name').notNull(),
  apiUrl: text('api_url').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

// ===== system_settings（主库，全局系统设置）=====
export const systemSettings = sqliteTable('system_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  settingKey: text('setting_key').notNull().unique(),
  settingValue: text('setting_value'),
  description: text('description'),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()),
})

// ===== mail_services（主库，多邮件服务，支持优先级故障转移）=====
// priority: 0 为最高优先级，数值越大优先级越低；发送时按 priority 升序依次尝试
// enabled: 1=启用，0=禁用
// password 明文存储（仅 super_admin 可读写，public 接口不暴露）
export const mailServices = sqliteTable('mail_services', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  provider: text('provider').notNull().default('custom'), // qq/163/gmail/outlook/aliyun/custom
  host: text('host').notNull(),
  port: integer('port').notNull().default(587),
  secure: text('secure').notNull().default('tls'), // none / ssl / tls
  username: text('username').notNull().default(''),
  password: text('password').notNull().default(''),
  fromName: text('from_name').notNull().default(''),
  fromAddress: text('from_address').notNull().default(''),
  priority: integer('priority').notNull().default(0),
  enabled: integer('enabled').notNull().default(1),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at'),
})

// ===== mail_templates（主库，邮件发件模板）=====
// slug: 业务标识（如 verification_code），用于代码侧按 slug 渲染
// variables: JSON 数组，模板支持的变量键（如 ["code","email"]）
export const mailTemplates = sqliteTable('mail_templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  subject: text('subject').notNull().default(''),
  bodyHtml: text('body_html').notNull().default(''),
  variables: text('variables').notNull().default('[]'), // JSON 数组
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at'),
})

// ===== api_tokens（主库，外部开放 API 凭证）=====
//
// 【安全】设计要点：
// 1. 库里只存 sha256(明文) —— 泄库也拿不到可用凭证。用 sha256 而非 bcrypt 的原因：
//    bcrypt 带随机盐，无法建索引，鉴权只能全表扫描逐个 compare（O(n) × ~100ms）。
//    而 token 是 256bit 高熵随机串，不存在字典/彩虹表风险，单次 sha256 已足够，
//    且能对 token_hash 建唯一索引做 O(log n) 精确查找。密码才需要 bcrypt（低熵、人为选择）。
// 2. token_prefix 存明文前 12 字符，让管理界面能识别"这是哪个 token"，但不足以还原密钥。
// 3. scope_type + scope_grade_id / scope_class_id 存的是 id 而非快照后的 class 列表 ——
//    grade token 的语义是"这个年级"，年级后续新增班级应自动纳入，
//    与内部 resolveSchoolScope() 的动态行为保持一致，避免出现两套语义。
// 4. school_id 带 cascade：学校被删除时其 token 一并消失，不留悬空凭证。
export const apiTokens = sqliteTable('api_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),                        // 备注名，如"教务系统对接"
  tokenPrefix: text('token_prefix').notNull(),         // 明文前 12 字符，仅用于识别
  tokenHash: text('token_hash').notNull().unique(),    // sha256(明文) hex
  schoolId: integer('school_id').notNull().references(() => schools.id, { onDelete: 'cascade' }),
  scopeType: text('scope_type').notNull(),             // 'school' | 'grade' | 'class'
  scopeGradeId: integer('scope_grade_id'),             // 分库内 id，跨库故无 FK
  scopeClassId: integer('scope_class_id'),             // 分库内 id，跨库故无 FK
  scopes: text('scopes').notNull().default('[]'),      // JSON 数组，权限白名单
  createdByAdminId: integer('created_by_admin_id').references(() => admins.id, { onDelete: 'set null' }),
  createdByRole: text('created_by_role').notNull(),    // 签发时角色快照，供事后审计
  disabled: integer('disabled').notNull().default(0),  // 0=启用，1=禁用
  expiresAt: text('expires_at'),                       // ISO 字符串，null = 永不过期
  lastUsedAt: text('last_used_at'),
  lastUsedIp: text('last_used_ip'),
  callCount: integer('call_count').notNull().default(0),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  schoolIdx: index('api_tokens_school_idx').on(table.schoolId),
}))

// ===== api_audit_logs（主库，外部 API 调用审计）=====
//
// 放主库而非分库的原因：鉴权失败的请求拿不到有效 schoolId，分库根本开不出来，
// 日志将无处落地；且超级管理员需要看全平台调用情况，跨分库聚合成本过高。
// token_id 不加 FK —— 鉴权失败时该字段为 null，且 token 被吊销后历史日志仍需保留。
export const apiAuditLogs = sqliteTable('api_audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tokenId: integer('token_id'),
  tokenPrefix: text('token_prefix'),
  schoolId: integer('school_id'),
  method: text('method').notNull(),
  path: text('path').notNull(),
  statusCode: integer('status_code').notNull(),
  latencyMs: integer('latency_ms').notNull().default(0),
  ip: text('ip'),
  userAgent: text('user_agent'),
  requestId: text('request_id').notNull().default(''),
  errorMessage: text('error_message'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  tokenIdx: index('api_audit_logs_token_idx').on(table.tokenId, table.createdAt),
  createdIdx: index('api_audit_logs_created_idx').on(table.createdAt),
}))

