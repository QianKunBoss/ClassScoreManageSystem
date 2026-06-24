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
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  lastLogin: text('last_login'),
}, (table) => ({
  // 同一学校内用户名唯一（schoolId 相同 + username 相同 => 冲突）
  // super_admin(schoolId IS NULL) 通过应用层保证用户名唯一
  usernameSchoolUnq: unique('admins_username_school_unq').on(table.username, table.schoolId),
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

