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
  totalScore: integer('total_score').notNull().default(0),
  addScore: integer('add_score').notNull().default(0),
  deductScore: integer('deduct_score').notNull().default(0),
  scoreCount: integer('score_count').notNull().default(0),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  unq: unique('users_class_username_unq').on(table.classId, table.username),
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
