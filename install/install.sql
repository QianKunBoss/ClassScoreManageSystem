-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 创建积分模板表
CREATE TABLE IF NOT EXISTS score_templates (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `score_change` int NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

-- 创建积分记录表
CREATE TABLE IF NOT EXISTS score_logs (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `score_change` int NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `score_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 初始化积分模板数据
INSERT IGNORE INTO score_templates (name, score_change, description) VALUES
('课堂表现优秀', 5, '课堂积极回答问题，表现突出'),
('作业未完成', -3, '未按时完成作业'),
('卫生值日优秀', 2, '卫生值日表现突出'),
('迟到', -2, '上课迟到'),
('早退', -3, '未经允许提前离开'),
('帮助同学', 3, '主动帮助同学解决问题');

-- 创建管理员表
CREATE TABLE IF NOT EXISTS admins (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `last_login` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 创建系统设置表
CREATE TABLE IF NOT EXISTS system_settings (
  `id` int NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(50) COLLATE utf8mb4_general_ci NOT NULL COMMENT '设置键名',
  `setting_value` text COLLATE utf8mb4_general_ci COMMENT '设置值',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 初始化默认设置
INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES
('system_title', '班级操行分管理系统'),
('nav_title', '操行分管理系统'),
('show_ranking', '1'),
('show_search', '1'),
('enable_user_detail', '1'),
('splash_video_enabled', '1'),
('show_statistics', '1'),
('security_question', '您设置的管理员账号是什么?'),
('security_answer', '');

-- 表的索引 `score_templates`
ALTER TABLE score_templates
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

-- 创建座位表配置表
CREATE TABLE IF NOT EXISTS seat_layout_config (
  `id` int NOT NULL AUTO_INCREMENT,
  `group_count` int NOT NULL DEFAULT 1 COMMENT '组数',
  `rows_per_group` int NOT NULL DEFAULT 5 COMMENT '每组行数',
  `cols_per_group` int NOT NULL DEFAULT 6 COMMENT '每组列数',
  `has_aisle` tinyint(1) NOT NULL DEFAULT 1 COMMENT '是否有走廊(1:有, 0:无)',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 创建座位表数据表
CREATE TABLE IF NOT EXISTS seat_data (
  `id` int NOT NULL AUTO_INCREMENT,
  `group_index` int NOT NULL COMMENT '所属组索引(从0开始)',
  `row_index` int NOT NULL COMMENT '行索引(从0开始)',
  `col_index` int NOT NULL COMMENT '列索引(从0开始)',
  `user_id` int DEFAULT NULL COMMENT '用户ID(空座位为NULL)',
  `is_aisle` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否为走廊(1:是, 0:否)',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_position` (`group_index`, `row_index`, `col_index`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `seat_data_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 初始化默认座位表配置
INSERT IGNORE INTO seat_layout_config (group_count, rows_per_group, cols_per_group, has_aisle) VALUES
(4, 5, 6, 1);
