-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  qq_number TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建积分模板表
CREATE TABLE IF NOT EXISTS score_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  score_change INTEGER NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建积分记录表
CREATE TABLE IF NOT EXISTS score_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  score_change INTEGER NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 初始化积分模板数据
INSERT OR IGNORE INTO score_templates (name, score_change, description) VALUES
('课堂表现优秀', 5, '课堂积极回答问题，表现突出'),
('作业未完成', -3, '未按时完成作业'),
('卫生值日优秀', 2, '卫生值日表现突出'),
('迟到', -2, '上课迟到'),
('早退', -3, '未经允许提前离开'),
('帮助同学', 3, '主动帮助同学解决问题');

-- 创建管理员表
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  api_token TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME
);

-- 创建系统设置表
CREATE TABLE IF NOT EXISTS system_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 初始化默认设置
INSERT OR IGNORE INTO system_settings (setting_key, setting_value) VALUES
('system_title', '班级操行分管理系统'),
('nav_title', '操行分管理系统'),
('show_ranking', '1'),
('show_search', '1'),
('enable_user_detail', '1'),
('splash_video_enabled', '1'),
('show_statistics', '1'),
('security_question', '您设置的管理员账号是什么?'),
('security_answer', '');

-- 创建座位表配置表
CREATE TABLE IF NOT EXISTS seat_layout_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_count INTEGER NOT NULL DEFAULT 1,
  rows_per_group INTEGER NOT NULL DEFAULT 5,
  cols_per_group INTEGER NOT NULL DEFAULT 6,
  has_aisle INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建座位表数据表
CREATE TABLE IF NOT EXISTS seat_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_index INTEGER NOT NULL,
  row_index INTEGER NOT NULL,
  col_index INTEGER NOT NULL,
  user_id INTEGER,
  is_aisle INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (group_index, row_index, col_index),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 初始化默认座位表配置
INSERT OR IGNORE INTO seat_layout_config (group_count, rows_per_group, cols_per_group, has_aisle) VALUES
(4, 5, 6, 1);

-- 创建第三方图片API表
CREATE TABLE IF NOT EXISTS third_party_apis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_name TEXT NOT NULL,
  api_url TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);