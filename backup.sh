#!/bin/bash
# ClassFire 数据库自动备份脚本
# 用法：./backup.sh 或通过 crontab 定时执行
#
# 备份范围：主库 data/classfire.db + 各校分库 data/schools/{id}.db
# SQLite 分库是按文件物理隔离的，主库与分库必须一并备份才能还原完整状态。

set -e

# ===== 配置 =====
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="$PROJECT_DIR/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30
MAIN_DB="classfire.db"

mkdir -p "$BACKUP_DIR" "$PROJECT_DIR/logs"

echo "[$(date)] 开始备份..."

# ===== 检测部署方式 =====
if docker compose -f "$PROJECT_DIR/docker-compose.yml" ps classfire 2>/dev/null | grep -q "Up"; then
    # ===== Docker 部署 =====
    echo "检测到 Docker 部署"

    # 主库 + 分库均用 SQLite 在线热备份（.backup 对内并发写入安全）
    docker compose exec -T classfire sh -c \
      "sqlite3 /app/data/$MAIN_DB '.backup /tmp/bk_main.db' && \
       mkdir -p /tmp/bk_schools && \
       for f in /app/data/schools/*.db; do \
         [ -e \"\$f\" ] || continue; \
         sqlite3 \"\$f\" \".backup /tmp/bk_schools/\$(basename \"\$f\")\"; \
       done"

    docker compose cp classfire:/tmp/bk_main.db "$BACKUP_DIR/classfire_$DATE.db"
    mkdir -p "$BACKUP_DIR/schools_$DATE"
    docker compose cp classfire:/tmp/bk_schools/. "$BACKUP_DIR/schools_$DATE/"

    docker compose exec -T classfire rm -rf /tmp/bk_main.db /tmp/bk_schools

    echo "[$(date)] Docker 备份完成"

elif pm2 list 2>/dev/null | grep -q "classfire"; then
    # ===== PM2 部署 =====
    echo "检测到 PM2 部署"

    if [ -f "$PROJECT_DIR/data/$MAIN_DB" ]; then
        sqlite3 "$PROJECT_DIR/data/$MAIN_DB" ".backup $BACKUP_DIR/classfire_$DATE.db"

        mkdir -p "$BACKUP_DIR/schools_$DATE"
        if [ -d "$PROJECT_DIR/data/schools" ]; then
            for f in "$PROJECT_DIR"/data/schools/*.db; do
                [ -e "$f" ] || continue
                sqlite3 "$f" ".backup $BACKUP_DIR/schools_$DATE/$(basename "$f")"
            done
        fi

        echo "[$(date)] PM2 备份完成"
    else
        echo "[$(date)] 错误：找不到数据库文件 $PROJECT_DIR/data/$MAIN_DB"
        exit 1
    fi

else
    echo "[$(date)] 错误：未检测到运行中的 ClassFire 服务"
    exit 1
fi

# ===== 压缩备份 =====
find "$BACKUP_DIR" -maxdepth 1 -name "*.db" -exec gzip -f {} \;
find "$BACKUP_DIR" -maxdepth 2 -path "*/schools_*/*.db" -exec gzip -f {} \;
echo "[$(date)] 压缩完成"

# ===== 清理旧备份 =====
find "$BACKUP_DIR" -name "*.db.gz" -mtime +$RETENTION_DAYS -delete
echo "[$(date)] 已清理 $RETENTION_DAYS 天前的旧备份"

# ===== 输出结果 =====
echo "[$(date)] 备份完成！"
echo "备份目录: $BACKUP_DIR"
ls -lh "$BACKUP_DIR" | tail -5
