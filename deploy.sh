#!/bin/bash
# ===========================================
# CSMS v0.3.0 - 一键部署脚本
# 支持 Docker 和 PM2 两种方式
# ===========================================

set -e

echo "========================================"
echo "  CSMS v0.3.0 部署脚本"
echo "========================================"

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "⚠️  未找到 .env 文件，从模板创建..."
    cp .env.production .env
    echo "📝 请编辑 .env 修改 SESSION_SECRET！"
    echo "   生成密钥: openssl rand -base64 32"
    exit 1
fi

# 检查 SESSION_SECRET 是否修改
if grep -q "change-this" .env; then
    echo "⚠️  SESSION_SECRET 还是默认值，请先修改！"
    echo "   生成密钥: openssl rand -base64 32"
    exit 1
fi

# 选择部署方式
echo ""
echo "请选择部署方式:"
echo "  1) Docker (推荐 - 一键启动，含 Nginx)"
echo "  2) PM2 (轻量 - 需要 Node.js 环境)"
echo "  3) 仅构建 (不自动启动)"
read -p "输入选项 [1/2/3]: " DEPLOY_MODE

case $DEPLOY_MODE in
    1)
        echo ""
        echo "🚢 Docker 部署模式"
        
        # 检查 Docker
        if ! command -v docker &> /dev/null; then
            echo "❌ Docker 未安装，请先安装 Docker"
            exit 1
        fi
        
        if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
            echo "❌ Docker Compose 未安装"
            exit 1
        fi
        
        # 构建
        echo "🔨 构建 Docker 镜像..."
        docker compose build
        
        # 启动
        echo "🚀 启动服务..."
        docker compose up -d
        
        echo ""
        echo "✅ 部署完成！"
        echo "   访问: http://localhost"
        echo "   查看日志: docker compose logs -f"
        echo "   停止服务: docker compose down"
        echo "   数据备份: docker run --rm -v csms-data:/data -v $(pwd):/backup alpine cp /data/csms.db /backup/"
        ;;
    
    2)
        echo ""
        echo "⚡ PM2 部署模式"
        
        # 检查 Node.js
        if ! command -v node &> /dev/null; then
            echo "❌ Node.js 未安装"
            exit 1
        fi
        
        # 安装 PM2
        if ! command -v pm2 &> /dev/null; then
            echo "📦 安装 PM2..."
            npm install -g pm2
        fi
        
        # 构建
        echo "🔨 构建 Nuxt 生产包..."
        npm install --production=false
        npm run build
        
        # 启动
        echo "🚀 启动 PM2..."
        pm2 start ecosystem.config.cjs
        
        # 保存 PM2 进程列表
        pm2 save
        
        echo ""
        echo "✅ 部署完成！"
        echo "   访问: http://localhost:3000"
        echo "   查看日志: pm2 logs csms"
        echo "   停止服务: pm2 stop csms"
        echo "   设置开机自启: pm2 startup"
        ;;
    
    3)
        echo ""
        echo "🔨 仅构建模式"
        npm install --production=false
        npm run build
        echo "✅ 构建完成！"
        echo "   手动启动: node .output/server/index.mjs"
        ;;
    
    *)
        echo "❌ 无效选项"
        exit 1
        ;;
esac
