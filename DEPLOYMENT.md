# CSMS v0.3.0 生产环境部署指南

> 班级积分管理系统 — Nuxt 4 + SQLite + Drizzle ORM

---

## 目录

- [部署架构](#部署架构)
- [方案一：Docker 部署（推荐）](#方案一docker-部署推荐)
- [方案二：PM2 部署](#方案二pm2-部署)
- [HTTPS / SSL 配置](#httpsssl-配置)
- [数据库备份与恢复](#数据库备份与恢复)
- [环境变量说明](#环境变量说明)
- [IPv6 说明](#ipv6-说明)
- [常见问题排查](#常见问题排查)

---

## 部署架构

```
                    ┌──────────────┐
   用户 ──HTTP/HTTPS──▶│   Nginx      │  :80 / :443
                    │  (反向代理)   │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  Nuxt Server │  :3000
                    │  (Node.js)   │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   SQLite     │  /app/data/*.db
                    │   (文件数据库) │
                    └──────────────┘
```

**技术选型理由：**
- SQLite 是文件数据库，**不需要单独部署数据库服务**，降低运维成本
- SQLite **不支持多进程并发写入**，所以只能跑单进程（不能用 cluster 模式）
- Nginx 负责 HTTPS 终止、静态资源缓存、压缩、安全头

---

## 方案一：Docker 部署（推荐）

### 1. 前置要求

- Docker Engine 24.0+
- Docker Compose v2.20+
- 服务器开放 80（HTTP）和/或 443（HTTPS）端口

```bash
# 检查 Docker 版本
docker --version
docker compose version
```

### 2. 准备项目文件

将项目上传到服务器：

```bash
# 方式一：Git 克隆
git clone <your-repo-url> /opt/csms
cd /opt/csms

# 方式二：SCP 上传（在本地执行）
scp -r ./ClassScoreManageSystem-0.3.0 user@your-server:/opt/csms
```

### 3. 配置环境变量

在项目根目录创建 `.env` 文件：

```bash
cd /opt/csms
cp .env.example .env   # 如果没有 .env.example，手动创建
vim .env
```

`.env` 文件内容：

```env
# ===== 必须修改 =====
# Session 加密密钥（用 openssl rand -hex 32 生成）
SESSION_SECRET=替换为你的随机密钥

# ===== 可选 =====
# 时区
TZ=Asia/Shanghai
```

生成随机密钥：

```bash
openssl rand -hex 32
```

### 4. 构建并启动

```bash
# 构建镜像并后台启动
docker compose up -d --build

# 查看启动日志
docker compose logs -f

# 确认容器运行状态
docker compose ps
```

正常输出应该类似：

```
NAME          STATUS                    PORTS
csms-app      Up (healthy)              0.0.0.0:3000->3000/tcp
csms-nginx    Up                        0.0.0.0:80->80/tcp
```

### 5. 验证部署

```bash
# 本地验证
curl http://localhost/api/settings

# 远程验证（替换为你的服务器 IP 或域名）
curl http://your-server-ip/api/settings
```

返回 JSON 数据即部署成功。

### 6. 常用运维命令

```bash
# 查看日志
docker compose logs -f csms      # 应用日志
docker compose logs -f nginx     # Nginx 日志

# 重启服务
docker compose restart csms
docker compose restart nginx

# 停止所有服务
docker compose down

# 更新代码后重新部署
git pull
docker compose up -d --build

# 进入容器排查
docker compose exec csms sh
```

---

## 方案二：PM2 部署

> 适用于没有 Docker 的环境。注意 SQLite 不支持多进程写入，**必须单进程运行**。

### 1. 安装 Node.js 22+

```bash
# 使用 nvm 安装
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22
```

### 2. 安装 PM2

```bash
npm install -g pm2
```

### 3. 构建项目

```bash
cd /opt/csms

# 安装依赖
npm ci

# 构建 Nuxt 生产版本
npm run build
```

### 4. 创建 PM2 配置文件

在项目根目录创建 `ecosystem.config.cjs`：

```javascript
module.exports = {
  apps: [{
    name: 'csms',
    script: '.output/server/index.mjs',
    instances: 1,          // 必须为 1！SQLite 不支持多进程写入
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      HOST: '0.0.0.0',
      PORT: 3000,
      SESSION_SECRET: '替换为你的随机密钥',
    },
    max_memory_restart: '512M',
    error_file: './logs/csms-error.log',
    out_file: './logs/csms-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }]
}
```

### 5. 启动服务

```bash
mkdir -p logs data

# 启动
pm2 start ecosystem.config.cjs

# 保存进程列表（开机自启）
pm2 save
pm2 startup    # 按提示执行返回的命令

# 查看状态
pm2 status
pm2 logs csms
```

### 6. 配置 Nginx 反向代理

```bash
# 安装 Nginx
sudo apt install -y nginx

# 复制项目中的 Nginx 配置
sudo cp deploy/nginx/nginx.conf /etc/nginx/nginx.conf
sudo cp deploy/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf

# 修改 default.conf 中的 proxy_pass
# 将 http://csms-app:3000 改为 http://127.0.0.1:3000
sudo vim /etc/nginx/conf.d/default.conf

# 测试并重载
sudo nginx -t
sudo systemctl reload nginx
```

---

## HTTPS/SSL 配置

> **生产环境强烈建议启用 HTTPS**，尤其是通过域名或 IPv6 访问时。

### 使用 Let's Encrypt 免费证书（推荐）

#### Docker 部署方式

1. 修改 `docker-compose.yml`，添加 Certbot 服务：

```yaml
  certbot:
    image: certbot/certbot
    container_name: csms-certbot
    volumes:
      - ./deploy/nginx/certs:/etc/letsencrypt
      - ./deploy/nginx/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
```

2. 修改 `deploy/nginx/conf.d/default.conf`：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com;

    # Let's Encrypt 验证
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # HTTP 重定向到 HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/certs/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/live/your-domain.com/privkey.pem;

    # SSL 优化
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # 安全头
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # ... 其余 proxy 配置与 HTTP 版本相同
    location / {
        proxy_pass http://csms-app:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /_nuxt/ {
        proxy_pass http://csms-app:3000;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location /api/ {
        proxy_pass http://csms-app:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }
}
```

3. 修改 `docker-compose.yml` 中 nginx 的端口映射：

```yaml
  nginx:
    ports:
      - "80:80"
      - "[::]:80:80"
      - "443:443"
      - "[::]:443:443"
    volumes:
      - ./deploy/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./deploy/nginx/conf.d:/etc/nginx/conf.d:ro
      - ./deploy/nginx/certs:/etc/nginx/certs:ro
      - ./deploy/nginx/www:/var/www/certbot:ro
```

4. 首次申请证书：

```bash
# 先启动只有 HTTP 的 nginx
docker compose up -d nginx

# 申请证书（替换 your-domain.com 和邮箱）
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  -d your-domain.com \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email

# 重启 nginx 加载 HTTPS 配置
docker compose restart nginx
```

#### PM2 部署方式

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 一键申请并配置
sudo certbot --nginx -d your-domain.com

# 自动续期（Certbot 会自动设置 cron）
sudo certbot renew --dry-run
```

---

## 数据库备份与恢复

### 自动备份脚本

创建 `/opt/csms/backup.sh`：

```bash
#!/bin/bash
# CSMS 数据库自动备份脚本

BACKUP_DIR="/opt/csms/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

echo "[$(date)] 开始备份..."

# Docker 部署：在容器内执行 SQLite 热备份
if docker compose ps csms | grep -q "Up"; then
    docker compose exec -T csms sh -c \
      "sqlite3 /app/data/main.db '.backup /tmp/backup_main.db' && \
       sqlite3 /app/data/schools.db '.backup /tmp/backup_schools.db'" 2>/dev/null

    docker compose cp csms:/tmp/backup_main.db "$BACKUP_DIR/main_$DATE.db"
    docker compose cp csms:/tmp/backup_schools.db "$BACKUP_DIR/schools_$DATE.db"

    docker compose exec -T csms rm /tmp/backup_main.db /tmp/backup_schools.db

# PM2 部署：直接本地备份
elif pm2 list | grep -q "csms"; then
    sqlite3 /opt/csms/data/main.db ".backup $BACKUP_DIR/main_$DATE.db"
    sqlite3 /opt/csms/data/schools.db ".backup $BACKUP_DIR/schools_$DATE.db"
fi

# 压缩备份
gzip "$BACKUP_DIR"/*.db

# 清理旧备份
find "$BACKUP_DIR" -name "*.db.gz" -mtime +$RETENTION_DAYS -delete

echo "[$(date)] 备份完成: $BACKUP_DIR"
ls -lh "$BACKUP_DIR" | tail -5
```

设置定时任务：

```bash
chmod +x /opt/csms/backup.sh

# 每天凌晨 3 点自动备份
crontab -e
# 添加以下行：
0 3 * * * /opt/csms/backup.sh >> /opt/csms/logs/backup.log 2>&1
```

### 手动备份

```bash
# Docker
docker compose exec csms sh -c "sqlite3 /app/data/main.db '.backup /tmp/backup.db'"
docker compose cp csms:/tmp/backup.db ./my-backup.db

# PM2
sqlite3 /opt/csms/data/main.db ".backup ./my-backup.db"
```

### 恢复备份

```bash
# Docker（需要先停止应用）
docker compose stop csms
docker compose cp ./my-backup.db csms:/app/data/main.db
docker compose start csms

# PM2
pm2 stop csms
cp ./my-backup.db /opt/csms/data/main.db
pm2 start csms
```

---

## 环境变量说明

| 变量名 | 必须修改 | 默认值 | 说明 |
|--------|---------|--------|------|
| `SESSION_SECRET` | ✅ 是 | `csms-dev-secret-change-in-production` | Session 加密密钥，**必须修改** |
| `NODE_ENV` | 否 | `production` | 运行环境 |
| `HOST` | 否 | `::` | 监听地址，`::` 同时支持 IPv4/IPv6 |
| `PORT` | 否 | `3000` | 应用端口 |
| `TZ` | 否 | 系统时区 | 时区设置，建议 `Asia/Shanghai` |

---

## IPv6 说明

本项目已全面支持 IPv6：

| 组件 | 配置位置 | 说明 |
|------|---------|------|
| Nuxt 开发服务器 | `nuxt.config.ts` → `devServer.host: '::'` | 开发环境 |
| Docker 容器 | `Dockerfile` → `ENV HOST=::` | 生产环境 |
| Docker 端口映射 | `docker-compose.yml` → `[::]:3000:3000` | IPv6 端口转发 |
| Nginx | `default.conf` → `listen [::]:80` | IPv6 监听 |
| Docker 网络 | `docker-compose.yml` → `enable_ipv6: true` | 容器间 IPv6 通信 |

**测试 IPv6 连接：**

```bash
# 本机 IPv6 测试
curl -g -6 http://[::1]:3000/api/settings

# 公网 IPv6 测试
curl -g -6 http://[your-ipv6-address]/api/settings
```

> **注意：** 开发环境下通过裸 IPv6 地址 + HTTP 访问时，浏览器会拒绝保存 Cookie（安全策略）。
> 开发时请用 `localhost`，生产环境用 HTTPS + 域名即可正常工作。

---

## 常见问题排查

### 1. 容器启动失败

```bash
# 查看详细日志
docker compose logs csms

# 常见原因：
# - 端口被占用 → 修改 docker-compose.yml 中的端口映射
# - 权限问题 → sudo chown -R $USER:$USER /opt/csms
# - 构建失败 → docker compose build --no-cache
```

### 2. 登录后立即跳回登录页

**原因：** Cookie 未正确保存

**排查：**
```bash
# 检查是否通过 HTTPS 访问（非 localhost 的 HTTP 不保存 Cookie）
curl -v https://your-domain.com/api/auth/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123","schoolId":1}'

# 检查 Response Headers 是否有 Set-Cookie
```

**解决：** 启用 HTTPS，或通过 `localhost` 访问。

### 3. 数据库锁定 (database is locked)

**原因：** SQLite 并发写入冲突

**解决：**
- 确保只运行**一个**应用进程
- Docker：`instances: 1`
- PM2：`exec_mode: 'fork'`，`instances: 1`
- 不要使用 `cluster` 模式

### 4. 磁盘空间不足

```bash
# 清理 Docker 无用镜像
docker system prune -a

# 清理旧备份
find /opt/csms/backups -name "*.db.gz" -mtime +30 -delete

# 查看磁盘使用
df -h
du -sh /opt/csms/*
```

### 5. 更新部署

```bash
cd /opt/csms

# 拉取最新代码
git pull origin main

# 重新构建并启动
docker compose up -d --build

# 或者 PM2 方式
npm ci
npm run build
pm2 restart csms
```

---

## 部署检查清单

部署完成后，逐项确认：

- [ ] `SESSION_SECRET` 已修改为随机密钥
- [ ] 容器状态为 `Up (healthy)`
- [ ] `curl http://localhost/api/settings` 返回 JSON
- [ ] 能通过域名/IP 访问登录页
- [ ] 登录成功后能进入管理面板
- [ ] HTTPS 已配置（如果使用域名）
- [ ] 数据库自动备份已设置
- [ ] 防火墙仅开放 80/443 端口
- [ ] `docker compose logs` 无报错

---

## 默认管理员

部署后首次登录：

```
用户名：admin
密码：admin123
```

> **安全提醒：** 部署后请立即修改默认密码！
