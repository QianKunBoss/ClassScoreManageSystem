# ClassScoreManageSystem（CSMS）v0.3.2

<div align="center">

![CSMS Logo](./docs/favicon.ico)

</div>

## 班级操行分管理系统（CSMS）

> 简称 CSMS — 完全重构版本

基于 Nuxt 4 + Vue 3 + TypeScript + Drizzle ORM + SQLite 的现代化班级操行分管理系统。支持多校分级管理、四级权限架构、实时积分追踪、可视化座位表等功能。

## 📖 文档导航

- 📚 [CSMS 文档站](https://docs.csms.tianrld.top) — 外部开放 API（v1）、内部 API 等全部接口文档

---

## ✨ 版本特色（v0.3.0）

v0.3.0 是 CSMS 的一次**完全重构**，从 PHP + jQuery 的传统架构全面升级为现代化的 Nuxt 全栈框架：

- **技术栈升级**：PHP → Nuxt 4 + Vue 3 + TypeScript
- **数据库层**：原生 SQL → Drizzle ORM + SQLite
- **前端架构**：多页面 PHP → SPA 单页应用 + 服务端渲染
- **权限体系**：单班级管理员 → 四级权限分级管理
- **部署方式**：Web 服务器 + PHP → 一键 `npm run dev` / `npm run build`

---

## 🚀 主要功能

### 🏫 多级管理架构

- **超级管理员**：系统全局管理，学校入驻审核，公告发布
- **学校管理员**：管理本校年级、教师账号
- **年级管理员**：管理本年级班级
- **班级管理员**（班主任）：管理本班学生、日常积分操作
- **管理员所属范围可编辑**：超级管理员可按管理级别调整管理员的所属（学校/年级/班级）——`super_admin` 无所属，`school_admin` 仅学校，`grade_admin` 学校+年级，`class_admin` 学校+年级+班级

### 📊 积分管理

- 学生加分/扣分，实时更新总分
- 积分日志完整记录，可追溯、可删除
- 积分模板预设，一键应用常用加减分
- 自动排名，前三名奖牌标识（🥇🥈🥉）
- 学期重置功能，一键开启新学期

### 🪑 可视化座位表

- 拖拽式座位编排
- 支持分组布局（可配置组数、行列）
- 自动生成座位布局
- 过道配置

### 📈 数据统计

- 数据仪表盘概览
- 平均分、最高分、最低分统计
- 加减分趋势分析
- 积分排行榜

### 📢 公告系统

- 全局公告发布（通知/警告/重要三种类型）
- 导航栏下方固定公告栏
- 支持 HTML 内容渲染（加粗、链接、换行等）
- 公告关闭记忆（24 小时内不再显示）
- XSS 安全过滤

### 🔐 安全认证

- 基于 Session 的登录认证
- 密码 BCrypt 加密存储
- 多角色权限中间件
- 操作二次确认
- 超级管理员可免密登录任意管理员账号（便于排查问题）
- 管理员支持邮箱 + 密码登录、邮箱验证码登录、忘记密码（邮箱验证码）找回
- 学生端支持邮箱绑定与邮箱验证码找回密码
- 数据导出/导入（JSON 备份恢复，支持全校/年级/班级范围选择）

### 📧 邮件通知系统

- 学校入驻审核结果（通过 / 拒绝）自动通过申请邮箱发送通知
- 邮件模板管理：审核通过 / 拒绝通知模板可在线编辑，支持变量占位（申请人姓名、学校名称、账号、密码、学校ID 等）
- 邮件服务配置：支持 SMTP / Resend 等邮件服务商接入
- 模板内容 XSS 安全过滤

### 🔌 外部开放 API（v1，第三方对接）

- **物理隔离**：外部端点前缀 `/api/v1/**`，与内部 `/api/**`（仅 Session 鉴权）互不串门，第三方**无法触碰系统级数据**（管理员账号、学校、公告、邮件服务等）
- **凭证鉴权**：`Authorization: Bearer` 或 `X-API-Token` 传入 `api_token`；哈希（sha256）入库、明文仅签发时可见一次
- **范围与权限双控**：凭证绑定「学校 / 年级 / 班级」三种范围 + 12 项细粒度权限（含 `students:delete` / `structure:delete` 两项危险权限默认不勾选），写操作严格限制在范围内
- **安全三铁律**：① 系统数据不可被操作；② 写操作仅限校级及以下业务数据；③ 所有请求必须携带 `api_token`，缺失/失效一律拒绝
- **写操作幂等**：支持 `Idempotency-Key` 头，重试不重复加分/建号
- **Token 维度限流**：全量 600/min + 写操作 120/min，超限返回 429 + `Retry-After`
- **全量调用审计**：每次调用（含鉴权失败/限流）写入日志并带 `X-Request-Id`，保留 30 天
- **管理能力**：管理后台「API 凭证」页面签发/编辑/禁用/吊销凭证、查看调用日志，签发与吊销均需二次验密
- 覆盖 22 个外部端点（学生 / 积分 / 年级 / 班级 / 模板 / 统计 / 自检）+ 6 个凭证管理内部端点
- 完整接口文档见 CSMS 文档站（https://docs.csms.tianrld.top）

### 📱 PWA 渐进式 Web 应用（已端到端验证生效）

- 支持安装到桌面/主屏幕，全屏独立窗口运行（Android 自适应图标 + iOS 全屏）
- 静态资源与构建产物离线缓存（Workbox 预缓存 + 运行时缓存）
- **API 请求（`/api/*`）强制走网络，永不缓存**，保证积分/学生等数据实时准确
- 品牌图标体系：浏览器标签/应用内 logo 采用「CS 字母徽标 + 星星」（CS 即 ClassScoreManageSystem 缩写，星星寓意步步高升/评分之星），PWA 主屏幕图标保留火箭主体（寓意成长与超越）
- 新版本自动检测并更新（`registerType: autoUpdate`），无需手动刷新
- manifest、Service Worker、主题色等已在构建产物中实测注入 `<head>` 并可通过 HTTPS 访问

---

## 🌟 实现列表

| 功能                                                  | 状态                    | 版本              |
| --------------------------------------------------- | --------------------- | --------------- |
| 🖼 管理员登录密码验证                                        | ✅                     | v0.1.1          |
| 🔍 用户搜索                                             | ✅                     | v0.1.1          |
| 🚀 管理面板                                             | ✅                     | v0.1.1          |
| 👤 添加用户                                             | ✅                     | v0.1.1          |
| 📝 批量名单导入                                           | ✅                     | v0.1.1          |
| 🗑 删除用户                                             | ✅                     | v0.1.1          |
| 👤 用户详情页                                            | ✅                     | v0.1.1          |
| 📊 Excel xlsx 数据导出                                  | ✅                     | v0.1.1 → v0.2.3 |
| 📄 积分预设模板                                           | ✅                     | v0.1.2          |
| 📝 日志记录查询                                           | ✅                     | v0.1.2          |
| ⚙️ 快速安装引导                                           | ✅                     | v0.2.0          |
| ⚙️ 系统设置                                             | ✅                     | v0.2.0          |
| 🎈 用户详情排名显示                                         | ✅                     | v0.2.0          |
| 🔄 学期切换                                             | ✅                     | v0.2.2          |
| 🪑 座位表视图                                            | ✅                     | v0.2.3          |
| 📊 数据仪表盘                                            | ✅                     | v0.2.3          |
| 📈 平均分/最高分/最低分                                      | ✅                     | v0.2.3          |
| 👥 多管理员账号                                           | ✅                     | v0.2.3          |
| 🔗 全局 API 接口                                        | ✅                     | v0.2.4          |
| 💾 SQLite 数据库支持                                     | ✅                     | v0.2.4          |
| 🎨 个性化定制                                            | ✅                     | v0.2.4          |
| 🔐 独立登录页面                                           | ✅                     | v0.2.4          |
| 💾 数据库在线备份                                          | ✅                     | v0.2.4          |
| 🤖 QQ 机器人接入                                         | ⚠️ 暂不可用（v0.3.0 重构后失效） | v0.2.5          |
| 🗑 日志删除                                             | ✅                     | v0.2.5          |
| 🏫 **多校多班分级管理**                                     | ✅                     | **v0.3.0**      |
| 🔐 **四级权限组体系**                                      | ✅                     | **v0.3.0**      |
| 📢 **公告系统**                                         | ✅                     | **v0.3.0**      |
| 🏫 **学校入驻申请**                                       | ✅                     | **v0.3.0**      |
| 👨‍🎓 **学生端自助查询**                                   | ✅                     | **v0.3.0**      |
| 🎨 **深色主题现代化 UI**                                   | ✅                     | **v0.3.0**      |
| ⚡ **Nuxt 全栈重构**                                     | ✅                     | **v0.3.0**      |
| 📱 响应式设计                                            | ✅                     | v0.3.0          |
| 🔒 XSS 安全过滤                                         | ✅                     | v0.3.0          |
| 📝 TypeScript 类型安全                                  | ✅                     | v0.3.0          |
| 💾 **JSON 数据导出/导入**                                 | ✅                     | **v0.3.1**      |
| 📱 **PWA 渐进式 Web 应用**                               | ✅                     | **v0.3.1**      |
| 🔑 **超管免密切换登录**                                     | ✅                     | **v0.3.1**      |
| 🖱 **学校卡片点击进入管理**                                   | ✅                     | **v0.3.1**      |
| 📧 **管理员邮箱登录**                                      | ✅                     | **v0.3.1**      |
| 🔢 **管理员邮箱验证码登录**                                   | ✅                     | **v0.3.1**      |
| 🔑 **管理员忘记密码（邮箱验证码找回）**                             | ✅                     | **v0.3.1**      |
| 🏷 **管理员所属按角色编辑（学校/年级/班级）**                         | ✅                     | **v0.3.1**      |
| 👥 **超管「用户管理」模块（管理员 + 跨校学生）**                       | ✅                     | **v0.3.1**      |
| 📧 **学生端邮箱绑定与找回**                                   | ✅                     | **v0.3.1**      |
| 🆔 **入驻学校列表展示学校ID**                                 | ✅                     | **v0.3.1**      |
| 🔍 **入驻申请实时校名校验（防抖 + 重名红字提示）**                      | ✅                     | **v0.3.1**      |
| ♻️ **重复学校判定放宽（已删除/已拒绝学校可重新申请）**                     | ✅                     | **v0.3.1**      |
| 🏷 **入驻申请页「已删除」黄色标签（已通过学校被删后标记）**                   | ✅                     | **v0.3.1**      |
| 🗂 **已删除学校仍显示原学校ID（deleted_school_id 快照列）**         | ✅                     | **v0.3.1**      |
| 📧 **审核通过通知邮件附带学校ID**                               | ✅                     | **v0.3.1**      |
| 📞 **入驻申请联系方式双行显示（电话/邮箱，缺失显示 -）**                   | ✅                     | **v0.3.1**      |
| 📋 **邮件模板管理（在线编辑、变量占位）**                            | ✅                     | **v0.3.1**      |
| ⚙️ **邮件服务配置（SMTP / Resend 接入）**                     | ✅                     | **v0.3.1**      |
| 🔌 **外部开放 API（v1）物理隔离 + 凭证鉴权**                      | ✅                     | **v0.3.2**      |
| 🔑 **API 凭证管理（签发/编辑/禁用/吊销 + 调用审计）**                 | ✅                     | **v0.3.2**      |
| 🛡 **开放 API 三铁律（系统数据不可操作 / 写限校级及以下 / 强制 token 鉴权）** | ✅                     | **v0.3.2**      |
| ⚡ **写操作幂等（Idempotency-Key）+ Token 维度限流**            | ✅                     | **v0.3.2**      |
| 🧭 **导航栏按钮图标**                                       | ✅                     | **v0.3.2**      |
| 📊 **侧边栏「统计信息」入口**                                 | ✅                     | **v0.3.2**      |
| ✏️ **学生信息编辑（用户名 / 姓名 / 所属班级 / 邮箱）**            | ✅                     | **v0.3.2**      |
| 🐛 **PWA `/sw.js` 路由警告修复**                              | ✅                     | **v0.3.2**      |

> ⚠️ **QQ 机器人接入**：该能力在 v0.3.0 全栈重构前（v0.2.5）可用，重构后相关集成逻辑尚未适配 Nuxt 新架构，目前**暂不可用**，将在后续版本重新接入。

---

## 🛠 技术栈

| 类别   | 技术                                                                                    |
| ---- | ------------------------------------------------------------------------------------- |
| 框架   | [Nuxt 4](https://nuxt.com/) + [Vue 3](https://vuejs.org/)                             |
| 语言   | TypeScript                                                                            |
| 数据库  | SQLite + [Drizzle ORM](https://orm.drizzle.team/)                                     |
| 样式   | Tailwind CSS 4                                                                        |
| 认证   | Session + BCrypt                                                                      |
| 图表   | Chart.js                                                                              |
| 状态管理 | Vue Composition API                                                                   |
| PWA  | [@vite-pwa/nuxt](https://vite-pwa-org.netlify.app/frameworks/nuxt.html)（Workbox 离线缓存） |

---

## 📦 快速开始

### 环境要求

- Node.js >= 18
- npm / pnpm / yarn / bun

### 安装

```bash
# 克隆项目
git clone https://github.com/QianKunBoss/ClassScoreManageSystem.git
cd ClassScoreManageSystem

# 安装依赖
npm install
```

### 开发模式

```bash
# 启动开发服务器（http://localhost:3000）
npm run dev
```

首次启动会自动初始化数据库。

### 生产部署

CSMS 提供多种生产部署方式，按需选择：

**方式一：直接运行（Node.js）**

```bash
# 构建生产版本
npm run build

# 启动生产服务器（任选其一）
npm run preview
# 或直接运行 Nitro 产物
node .output/server/index.mjs
```

**方式二：PM2 常驻（推荐单机部署）**

```bash
npm install -g pm2            # 如未安装
npm run build
pm2 start ecosystem.config.cjs
pm2 save                      # 保存进程列表
pm2 startup                   # 设置开机自启（按提示执行）
```

> ⚠️ `ecosystem.config.cjs` 固定 `instances: 1`（SQLite 不支持多进程并发写入），**请勿**改为 cluster 模式。

**方式三：Docker（推荐，可选 Nginx 反代）**

```bash
# 构建并启动（应用 + 可选 Nginx 反向代理）
docker compose up -d --build

# 仅启动应用（不含 Nginx）
docker compose up -d --build csms
```

- 应用默认监听 `3000`，Nginx 监听 `80`（HTTPS 配置见 `deploy/nginx/`）
- 数据持久化：compose 已挂载 `csms-data` 卷到容器 `/app/data`
- 查看日志：`docker compose logs -f csms`

**方式四：一键部署脚本**

```bash
chmod +x deploy.sh
./deploy.sh        # 交互选择 Docker / PM2 / 仅构建
```

**方式五：Windows 部署**

> 适用于 Windows Server / 桌面 Windows 单机运行。同样基于 Node.js 生产产物，无需 WSL。

1. **安装 Node.js 22+**（官网 MSI 安装，勾选「Add to PATH」），并安装 PM2（可选）：
   ```powershell
   npm install -g pm2
   ```
2. **构建并运行**（ PowerShell 示例）：
   ```powershell
   # 设置运行期会话密钥（必填，建议随机值；预构建产物也必须用它）
   $env:NUXT_SESSION_PASSWORD = "你的随机密钥（openssl rand -hex 32 生成）"
   # 构建
   npm install
   npm run build
   # 直接运行 Nitro 产物
   node .output/server/index.mjs
   ```
   > CMD 写法：`set NUXT_SESSION_PASSWORD=你的密钥` 再 `node .output/server/index.mjs`。  
   > 若使用**下载包里的预构建 `.output`** 直接 `npm run preview`，同样只需设 `NUXT_SESSION_PASSWORD`（无需重新 build）。
3. **常驻 + 开机自启（推荐用 PM2）**：
   ```powershell
   pm2 start ecosystem.config.cjs
   pm2 save
   pm2 startup windows        # 按提示将生成的命令以管理员身份执行，注册为开机服务
   ```
4. **放行防火墙**（若需局域网/公网访问，默认端口 `3000`）：
   ```powershell
   netsh advfirewall firewall add rule name="CSMS" dir=in action=allow protocol=TCP localport=3000
   ```

> ⚠️ Windows 下 `ecosystem.config.cjs` 仍为 `instances: 1`，SQLite 不支持多进程并发写入，**请勿**改 cluster。如需公网域名访问，可在前置 Nginx / Caddy 做反向代理。

**方式六：宝塔面板（BT Panel）部署**

> 适用于已安装宝塔的 Linux 服务器，兼顾可视化与 Nginx 反代 / SSL。

1. **安装运行环境**：宝塔「软件商店」安装 **PM2 管理器**（或「Node.js 版本管理器」）与 **Nginx**。
2. **上传并构建**：将项目上传至 `/www/wwwroot/csms`（或宝塔「文件」中新建目录），进入目录执行：
   ```bash
   npm install
   npm run build
   ```
3. **启动服务（任选其一）**：
   - **PM2 管理器**：在宝塔「PM2 管理器」中添加项目，启动文件填 `.output/server/index.mjs`，或命令行 `pm2 start ecosystem.config.cjs`（需先 `pm2 save` 持久化）。
   - **宝塔「Node 项目」**（较新版本支持）：直接新建 Node 项目，入口选 `.output/server/index.mjs`，运行目录 `/www/wwwroot/csms`。
4. **配置反向代理**：宝塔「网站 → 添加站点」（填你的域名）→「反向代理」→ 目标 URL 填 `http://127.0.0.1:3000`，保存。此后通过域名访问 CSMS。
5. **HTTPS（可选）**：在站点「SSL」中一键申请 Let's Encrypt 证书并强制 HTTPS。
6. **数据持久化**：SQLite 数据库位于 `/www/wwwroot/csms/data/`（主库 + 各校独立库），**备份时直接复制该目录**；迁移服务器时连同 `data/` 一并打包即可。

> ⚠️ 宝塔 PM2 同样保持单实例运行（`instances: 1`），不要开启多进程；运行期密钥用 `NUXT_SESSION_PASSWORD`（宝塔「环境变量」或 `.env` 文件配置，预构建产物也必须用它）。

### 环境变量

| 变量                      | 说明                                                                                                                                                                                     | 必填 |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -- |
| `NUXT_SESSION_PASSWORD` | **运行期**会话签名密钥，推荐用它配置。**任何部署方式（含预构建产物 / `npm run preview` / PM2 / Docker）均实时生效**。生成：`openssl rand -hex 32` 或 `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | ✅  |
| `SESSION_SECRET`        | **构建期**会话密钥备选：仅在 `npm run build` **之前**设置才被烘焙进产物，运行期修改无效。新建构建时可用它替代 `NUXT_SESSION_PASSWORD`                                                                                            | ⚪  |
| `HOST`                  | 监听地址，默认 `::`（同时监听 IPv4 + IPv6）                                                                                                                                                         | ❌  |
| `PORT`                  | 监听端口，默认 `3000`                                                                                                                                                                         | ❌  |
| `NODE_ENV`              | 设为 `production` 以启用生产模式                                                                                                                                                                | ❌  |

> ⚠️ **预构建产物（如从 Release / 下载包获取的 `.output`）必须用 `NUXT_SESSION_PASSWORD`**，因为 `SESSION_SECRET` 在构建时就已经固定、运行期改不动。  
> 配置模板见 `.env.example` / `.env.production`；`deploy.sh` 会自动从 `.env.production` 复制为 `.env`。`.env` 含密钥，已在 `.gitignore` 中忽略，**请勿提交**。

### 数据持久化与备份

- SQLite 数据库位于 `data/`：主库 `data/csms.db`，各校独立库 `data/schools/{id}.db`，**必须持久化保存**。
- Docker 部署：通过 `docker-compose.yml` 的 `csms-data` 卷挂载，数据不随容器销毁丢失。
- 原生 / PM2 部署：确保 `data/` 目录不被删除，直接复制 `.db` 文件即可完成备份。

### 数据库操作

```bash
# 生成数据库迁移
npm run db:generate

# 执行迁移
npm run db:migrate

# 推送 schema 到数据库
npm run db:push

# 启动 Drizzle Studio（数据库可视化管理）
npm run db:studio
```

---

## 📁 项目结构

```
ClassScoreManageSystem/
├── app/                          # 前端应用
│   ├── assets/                   # 静态资源
│   │   └── css/
│   │       └── main.css          # 全局样式
│   ├── components/               # Vue 组件
│   │   ├── app/                  # 全局组件（导航栏、页脚、公告栏）
│   │   ├── seats/                # 座位表组件
│   │   ├── student/              # 学生端组件
│   │   ├── templates/            # 模板组件
│   │   └── ui/                   # UI 基础组件
│   ├── composables/              # 组合式函数
│   │   ├── useAuth.ts            # 认证 hook
│   │   └── useToast.ts           # 消息提示 hook
│   ├── layouts/                  # 布局模板
│   │   ├── default.vue           # 管理员默认布局
│   │   ├── student.vue           # 学生端布局
│   │   └── blank.vue             # 空白布局
│   ├── middleware/               # 路由中间件
│   │   ├── auth.global.ts        # 全局认证中间件
│   │   ├── student.ts            # 学生端认证
│   │   └── super-admin.ts        # 超级管理员校验
│   ├── pages/                    # 页面（文件路由）
│   │   ├── index.vue             # 首页（公开）
│   │   ├── login.vue             # 管理员登录
│   │   ├── apply.vue             # 学校入驻申请
│   │   ├── settings.vue          # 个人设置
│   │   ├── admin/                # 管理员页面
│   │   │   ├── index.vue         # 管理后台首页
│   │   │   ├── users.vue         # 学生管理
│   │   │   ├── scores.vue        # 积分调整
│   │   │   ├── stats.vue         # 数据统计
│   │   │   ├── seats.vue         # 座位表
│   │   │   ├── templates.vue     # 积分模板
│   │   │   ├── announcements.vue # 公告管理
│   │   │   ├── classes.vue       # 班级管理
│   │   │   ├── grades.vue        # 年级管理
│   │   │   ├── schools.vue       # 学校管理
│   │   │   └── teachers.vue      # 教师管理
│   │   ├── student/              # 学生端页面
│   │   │   ├── index.vue         # 学生首页
│   │   │   ├── ranking.vue       # 班级排名
│   │   │   └── settings.vue      # 学生设置
│   │   ├── superadmin/           # 超级管理员页面
│   │   │   ├── index.vue         # 系统管理
│   │   │   ├── admins.vue        # 管理员管理（所属按角色编辑、免密登录）
│   │   │   ├── students.vue      # 跨校学生管理
│   │   │   ├── applications.vue   # 学校入驻申请
│   │   │   └── schools/[id].vue  # 学校详情
│   │   └── users/[id].vue        # 学生详情页
│   ├── plugins/                  # Nuxt 插件
│   ├── types/                    # TypeScript 类型定义
│   ├── utils/                    # 工具函数
│   │   ├── format.ts             # 日期格式化
│   │   └── sanitizeHtml.ts       # HTML 安全过滤
│   └── app.vue                   # 根组件
├── server/                       # 服务端 API
│   ├── api/                      # API 路由
│   │   ├── admin/                # 管理员相关
│   │   │   ├── manage/           # 管理员 CRUD、免密登录、所属编辑
│   │   │   └── students/         # 跨校学生管理
│   │   ├── announcements/        # 公告相关
│   │   ├── applications/         # 入驻申请相关
│   │   ├── auth/                 # 认证相关
│   │   │   ├── admin/            # 管理员认证（邮箱/验证码/忘记密码）
│   │   │   └── student/          # 学生端认证（绑定/找回）
│   │   ├── classes/              # 班级相关
│   │   ├── grades/               # 年级相关
│   │   ├── schools/              # 学校相关
│   │   ├── scores/               # 积分相关
│   │   ├── score-logs/           # 积分日志相关
│   │   ├── seats/                # 座位相关
│   │   ├── stats/                # 统计相关
│   │   ├── student/              # 学生端相关
│   │   ├── templates/            # 模板相关
│   │   └── users/                # 用户相关
│   ├── database/                 # 数据库层
│   │   ├── db.ts                 # 数据库连接
│   │   ├── init.ts               # 数据库初始化
│   │   ├── schema.ts             # Schema 导出
│   │   ├── schema.main.ts        # 主库 Schema（学校/管理员/公告）
│   │   └── schema.school.ts      # 学校库 Schema（年级/班级/学生/积分）
│   ├── plugins/                  # 服务端插件
│   │   └── db-init.ts            # 数据库初始化插件
│   └── utils/                    # 服务端工具
│       ├── auth.ts               # 认证工具
│       └── create-school-db.ts   # 学校数据库创建
├── drizzle.config.ts             # Drizzle 配置
├── nuxt.config.ts                # Nuxt 配置
├── package.json                  # 项目依赖
├── tailwind.config.ts            # Tailwind 配置
├── Dockerfile                    # 多阶段 Docker 构建（node:22-alpine）
├── docker-compose.yml            # Docker Compose 编排（应用 + 可选 Nginx 反代）
├── ecosystem.config.cjs          # PM2 进程配置（单实例 fork，适配 SQLite）
├── deploy.sh                     # 一键部署脚本（Docker / PM2 / 仅构建）
├── deploy/                       # 部署相关配置
│   └── nginx/                    # Nginx 反向代理配置（含 HTTPS 示例）
├── scripts/
│   └── gen-pwa-icons.py          # PWA 图标生成脚本（Pillow 绘制火箭主体）
├── public/                       # 静态资源目录
│   ├── favicon.ico               # 品牌 favicon（CS 字母徽标 + 星星：CS 即 ClassScoreManageSystem 缩写，星星寓意步步高升/评分之星）
│   ├── pwa-192x192.png           # PWA 标准图标（火箭主体）
│   ├── pwa-512x512.png           # PWA 标准图标（大，火箭主体）
│   ├── pwa-maskable-192x192.png  # Android 自适应图标（火箭主体）
│   ├── pwa-maskable-512x512.png  # Android 自适应图标（大，火箭主体）
│   └── apple-touch-icon.png      # iOS「添加到主屏幕」图标（火箭主体）
├── docs/                         # 文档目录
│   └── api.md                    # API 接口文档
└── README.md                     # 项目说明
```

---

## 👥 用户角色说明

| 角色         | 权限范围 | 主要功能               |
| ---------- | ---- | ------------------ |
| 超级管理员      | 全局   | 学校入驻审核、公告管理、系统设置   |
| 学校管理员      | 本校   | 年级管理、教师账号管理、班级管理   |
| 年级管理员      | 本年级  | 班级管理、年级数据查看        |
| 班级管理员（班主任） | 本班   | 学生管理、积分调整、座位表、数据统计 |
| 学生         | 本人   | 查看个人积分、班级排名、修改个人信息 |

---

## 📝 使用说明

### 首次启动

1. 运行 `npm run dev` 启动开发服务器
2. 访问 `http://localhost:3000`
3. 系统自动初始化数据库，创建默认超级管理员账号
4. 使用超级管理员账号登录

### 学校入驻流程

1. 访问首页，点击「申请入驻」
2. 填写学校信息、申请人信息（输入学校名称时会**实时校验是否重名**，若已存在将红字提示并禁用提交 / 获取验证码按钮）
3. 提交申请，等待审核（已删除、已拒绝的学校可重新申请）
4. 超级管理员审核通过后，自动创建学校和管理员账号
5. 使用分配的管理员账号登录

### 日常使用

1. **添加学生**：进入「学生管理」→「添加学生」
2. **调整积分**：在学生详情页或积分管理页进行加减分
3. **查看排名**：首页或学生页面查看积分排行榜
4. **座位编排**：进入「座位表」页面，拖拽调整座位
5. **免密登录**：超级管理员在「系统管理」→「管理员账号」中点击「登录」，可直接切换为该账号（退出后需重新登录超管账号）
6. **安装为应用**：在生产环境（**需通过 HTTPS 访问**，如 `localhost` 或已配置 SSL 的域名）下，浏览器会弹出「安装 CSMS 到桌面」提示，安装后可像原生应用一样离线使用。开发模式（`npm run dev`）默认不启用安装提示

---

## ❓ 常见问题

**Q: 如何重置管理员密码？**  
A: 管理员可在登录页通过「忘记密码」用邮箱验证码自助重置；超级管理员也可在「用户管理 → 管理员」中重置他人密码。若超级管理员自身密码遗忘，需手动修改 `data/csms.db`。

**Q: 数据如何备份？**  
A: SQLite 数据库文件位于项目根目录 `data/` 下（主库 `data/csms.db`，各校独立库 `data/schools/{id}.db`），直接复制对应 `.db` 文件即可备份。注意 `data/` 已在 `.gitignore` 中忽略，不会进入版本库。

**Q: 支持 MySQL 吗？**  
A: v0.3.0 当前仅支持 SQLite。后续版本可能会增加 MySQL 支持。

**Q: 如何升级到新版本？**  
A: 拉取最新代码后，运行 `npm install` 更新依赖，然后运行 `npm run db:migrate` 执行数据库迁移。

---

## 📌 更新日志

### v0.3.2（当前版本）

- ✅ **外部开放 API（v1）**：新增物理隔离于内部接口的 `/api/v1/**` 端点，支持第三方通过 `api_token` 对学校/年级/班级级业务数据做增删改查
- ✅ **凭证体系**：主库新增 `api_tokens` / `api_audit_logs` 表、各校分库新增 `api_idempotency` 表；token 以 `sha256` 哈希存储，明文仅签发时可见一次
- ✅ **范围与权限双控**：凭证绑定「学校 / 年级 / 班级」范围 + 12 项细粒度权限（含 2 项危险权限默认不勾选），写操作严格限制在范围内；签发范围强制不超过签发者自身管辖
- ✅ **三铁律落地**：系统数据不可被外部操作、写操作仅限校级及以下业务数据、所有请求必须携带 `api_token`
- ✅ **写操作幂等**：`Idempotency-Key` 头保证重试不重复加分/建号（并发冲突返回 409）
- ✅ **Token 维度限流**：全量 600 次/分钟 + 写操作 120 次/分钟，超限返回 `429` + `Retry-After`
- ✅ **全量调用审计**：每次 v1 调用（含鉴权失败/限流）写入 `api_audit_logs` 并带 `X-Request-Id`，保留 30 天
- ✅ **凭证管理界面**：`/admin/api-tokens` 页面签发/编辑/禁用/吊销凭证、查看调用日志，签发与吊销均二次验密
- 📄 新增外部开放 API 对接文档 [docs/APIv1.md](./docs/APIv1.md)
- ✅ **导航栏按钮图标**：首页 / 工作台 / 系统管理 / 公告 / 登录 等导航按钮统一加 Lucide 图标，移动端「退出登录」补齐 `LogOut` 图标，与站内图标体系一致
- ✅ **侧边栏「统计信息」入口**：普通管理员侧边栏顶部新增「统计信息」按钮，跳转到 `/admin` 工作台 / 仪表盘，与导航栏「工作台」同一效果
- ✅ **学生信息编辑**：普通管理员在学生管理页可编辑学生用户名、姓名、所属班级、邮箱（复用教师详情页式编辑弹窗，含权限范围校验 `assertClassManagement`）
- 🐛 **PWA `/sw.js` 路由警告修复**：修正 `@vite-pwa/nuxt` 配置（开发期启用 dev service worker），避免生产构建缺失 `sw.js` 时 Vue Router 报 `No match found for location with path "/sw.js"`

### v0.3.1

- ✅ 管理员认证增强：支持**邮箱 + 密码登录**、**邮箱验证码登录**、**忘记密码（邮箱验证码）找回**
- ✅ 新增**超管「用户管理」模块**：集中管理全部管理员账号与跨校学生列表
- ✅ 管理员**所属（学校 / 年级 / 班级）可编辑**，可选项由管理级别约束（`super_admin` 无所属；`school_admin` 仅学校；`grade_admin` 学校+年级；`class_admin` 学校+年级+班级）
- ✅ 学生端支持**邮箱绑定**与**邮箱验证码找回密码**
- 🔧 文档与仓库修正：数据库文件位于 `data/`（主库 `data/csms.db`）；`.gitignore` 已忽略 `*.db` / `*.sqlite` / `.cloudstudio` 等运行期文件
- ✅ 入驻学校列表展示**学校ID**
- ✅ 入驻申请**实时校名校验**：输入时防抖检查重名，红字提示并禁用提交 / 获取验证码按钮，提交时二次校验
- ✅ **重复学校判定放宽**：已删除、已拒绝的学校不计入重复，允许重新申请
- ✅ 已审核通过的学校被删除后，入驻申请页对其标记黄色「**已删除**」标签（`school_deleted` 标记）
- ✅ **已删除学校仍显示原学校ID**：新增 `deleted_school_id` 快照列，删除学校时保留原 ID 引用（避免外键置空丢失）
- ✅ 审核通过通知邮件**附带学校ID**（邮件模板补充 `schoolId` 变量）
- ✅ 入驻申请「联系」列改为**双行显示**：第一行电话、第二行邮箱，缺失显示 `-`
- ✅ **邮件通知系统**：入驻审核结果邮件通知、邮件模板管理（变量占位）、邮件服务配置（SMTP / Resend）

---

## 📄 许可证

本项目采用 [GNU General Public License v3.0](LICENSE)（GPL-3.0）开源协议。

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📮 交流

- QQ 群：1074247379
- GitHub Issues：[提交问题](https://github.com/QianKunBoss/ClassScoreManageSystem/issues)
