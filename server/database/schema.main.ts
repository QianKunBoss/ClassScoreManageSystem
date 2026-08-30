// ===== 主库 schema：schools / admins / applications / announcements =====
import { sqliteTable, text, integer, unique } from 'drizzle-orm/sqlite-core'

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

