// 学校库 schema：grades / classes / users / score_logs / score_templates / seat_layout / seat_data
import { sqliteTable, text, integer, unique, index } from 'drizzle-orm/sqlite-core'

// ===== grades =====
export const grades = sqliteTable('grades', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  nameUnq: unique('grades_name_unq').on(table.name),
}))

// ===== classes =====
export const classes = sqliteTable('classes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gradeId: integer('grade_id').notNull().references(() => grades.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  unq: unique('classes_grade_name_unq').on(table.gradeId, table.name),
}))

// ===== users =====
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  classId: integer('class_id').references(() => classes.id, { onDelete: 'cascade' }),
  username: text('username').notNull(),
  passwordHash: text('password_hash').notNull(),
  actualName: text('actual_name'),
  // 绑定邮箱：用于找回密码 / 安全验证。可空（未绑定）；非空时全校唯一（SQLite 唯一索引允许多个 NULL）
  email: text('email'),
  emailBoundAt: text('email_bound_at'),
  // 账号状态：0=正常，1=禁用（禁用后无法登录）
  disabled: integer('disabled').notNull().default(0),
  // 强制改密标志：1=使用默认/重置密码登录，需强制修改密码后才能进入系统
  mustChangePassword: integer('must_change_password').notNull().default(0),
  totalScore: integer('total_score').notNull().default(0),
  addScore: integer('add_score').notNull().default(0),
  deductScore: integer('deduct_score').notNull().default(0),
  scoreCount: integer('score_count').notNull().default(0),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  unq: unique('users_class_username_unq').on(table.classId, table.username),
  // 邮箱唯一（仅对非空值生效，允许多个 NULL）
  emailUnq: unique('users_email_unq').on(table.email),
}))

// ===== score_logs =====
export const scoreLogs = sqliteTable('score_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  username: text('username').notNull(),
  scoreChange: integer('score_change').notNull(),
  description: text('description'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  userIdx: index('score_logs_user_idx').on(table.userId),
}))

// ===== score_templates =====
export const scoreTemplates = sqliteTable('score_templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  classId: integer('class_id').references(() => classes.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  scoreChange: integer('score_change').notNull(),
  description: text('description'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()).$onUpdate(() => new Date().toISOString()),
})

// ===== seat_layout_config =====
// 按班级配置座位布局（每个班级一套）
export const seatLayoutConfig = sqliteTable('seat_layout_config', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  classId: integer('class_id').notNull().unique().references(() => classes.id, { onDelete: 'cascade' }),
  groupCount: integer('group_count').notNull().default(4),
  rowsPerGroup: integer('rows_per_group').notNull().default(3),
  colsPerGroup: integer('cols_per_group').notNull().default(3),
  hasAisle: integer('has_aisle').notNull().default(0), // 注意：字段名是 hasAisle（与现有DB一致）
})

// ===== seat_data =====
export const seatData = sqliteTable('seat_data', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  classId: integer('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
  groupIndex: integer('group_index').notNull(),
  rowIndex: integer('row_index').notNull(),
  colIndex: integer('col_index').notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  isAisle: integer('is_aisle').notNull().default(0),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()).$onUpdate(() => new Date().toISOString()),
}, (table) => ({
  unq: unique('seat_data_unique').on(table.classId, table.groupIndex, table.rowIndex, table.colIndex),
}))

// ===== api_idempotency（外部 API 幂等键）=====
//
// 加分是不可逆累加，第三方网络重试极易造成重复加分。调用方带上 Idempotency-Key 头后，
// 同一 (token_id, key) 命中即直接回放上次响应，不再执行写入。
// 放分库而非主库：key 只在单校范围内有意义，且能随学校删除一并清理。保留 24 小时。
export const apiIdempotency = sqliteTable('api_idempotency', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tokenId: integer('token_id').notNull(),
  key: text('key').notNull(),
  endpoint: text('endpoint').notNull(),
  responseJson: text('response_json').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  unq: unique('api_idempotency_token_key_unq').on(table.tokenId, table.key),
}))
