-- 升级脚本：为users表添加qq_number字段
-- 支持MySQL/MariaDB和SQLite

-- MySQL/MariaDB版本
ALTER TABLE users ADD COLUMN qq_number VARCHAR(20) DEFAULT NULL COMMENT 'QQ号码';

-- SQLite版本
-- ALTER TABLE users ADD COLUMN qq_number VARCHAR(20) DEFAULT NULL;