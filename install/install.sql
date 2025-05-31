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
('splash_video_enabled', '1');

-- 表的索引 `score_templates`
ALTER TABLE score_templates
  MODIFY `id` int NOT NULL AUTO_INCREMENT;
