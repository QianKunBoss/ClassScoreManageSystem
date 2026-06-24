#!/bin/bash
# CSMS 数据库自动备份脚本
# 用法：./backup.sh 或通过 crontab 定时执行

set -e

# ===== 配置 =====
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="$PROJECT_DIR/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR" "$PROJECT_DIR/logs"

echo "[$(date)] 开始备份..."

# ===== 检测部署方式 =====
if docker compose -f "$PROJECT_DIR/docker-compose.yml" ps csms 2>/dev/null | grep -q "Up"; then
    # ===== Docker 部署 =====
    echo "检测到 Docker 部署"

    docker compose exec -T csms sh -c \
      "sqlite3 /app/data/main.db '.backup /tmp/backup_main.db'" 2>/dev/null

    docker compose cp csms:/tmp/backup_main.db "$BACKUP_DIR/main_$DATE.db"

    docker compose exec -T csms rm /tmp/backup_main.db 2>/dev/null

    echo "[$(date)] Docker 备份完成"

elif pm2 list 2>/dev/null | grep -q "csms"; then
    # ===== PM2 部署 =====
    echo "检测到 PM2 部署"

    if [ -f "$PROJECT_DIR/data/main.db" ]; then
        sqlite3 "$PROJECT_DIR/data/main.db" ".backup $BACKUP_DIR/main_$DATE.db"
        echo "[$(date)] PM2 备份完成"
    else
        echo "[$(date)] 错误：找不到数据库文件 $PROJECT_DIR/data/main.db"
        exit 1
    fi

else
    echo "[$(date)] 错误：未检测到运行中的 CSMS 服务"
    exit 1
fi

# ===== 压缩备份 =====
gzip -f "$BACKUP_DIR"/*.db
echo "[$(date)] 压缩完成"

# ===== 清理旧备份 =====
find "$BACKUP_DIR" -name "*.db.gz" -mtime +$RETENTION_DAYS -delete
echo "[$(date)] 已清理 $RETENTION_DAYS 天前的旧备份"

# ===== 输出结果 =====
echo "[$(date)] 备份完成！"
echo "备份目录: $BACKUP_DIR"
ls -lh "$BACKUP_DIR" | tail -5
