-- 迁移脚本：给 schools 和 admins 表添加 disabled 字段
-- 运行方式：sqlite3 data/main.db < scripts/migrate-add-disabled.sql

-- 给 schools 表添加 disabled 字段
ALTER TABLE schools ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0;

-- 给 admins 表添加 disabled 字段
ALTER TABLE admins ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0;
