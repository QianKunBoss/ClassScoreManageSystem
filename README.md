# ClassScoreManageSystem（CSMS）v0.3.0

<div align="center">

![CSMS Logo](./docs/favicon.png)

</div>

## 班级操行分管理系统（CSMS）

> 简称 CSMS — 完全重构版本

基于 Nuxt 4 + Vue 3 + TypeScript + Drizzle ORM + SQLite 的现代化班级操行分管理系统。支持多校分级管理、四级权限架构、实时积分追踪、可视化座位表等功能。

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

---

## 🌟 实现列表

| 功能 | 状态 | 版本 |
|------|------|------|
| 🖼 管理员登录密码验证 | ✅ | v0.1.1 |
| 🔍 用户搜索 | ✅ | v0.1.1 |
| 🚀 管理面板 | ✅ | v0.1.1 |
| 👤 添加用户 | ✅ | v0.1.1 |
| 📝 批量名单导入 | ✅ | v0.1.1 |
| 🗑 删除用户 | ✅ | v0.1.1 |
| 👤 用户详情页 | ✅ | v0.1.1 |
| 📊 Excel xlsx 数据导出 | ✅ | v0.1.1 → v0.2.3 |
| 📄 积分预设模板 | ✅ | v0.1.2 |
| 📝 日志记录查询 | ✅ | v0.1.2 |
| ⚙️ 快速安装引导 | ✅ | v0.2.0 |
| ⚙️ 系统设置 | ✅ | v0.2.0 |
| 🎈 用户详情排名显示 | ✅ | v0.2.0 |
| 🔄 学期切换 | ✅ | v0.2.2 |
| 🪑 座位表视图 | ✅ | v0.2.3 |
| 📊 数据仪表盘 | ✅ | v0.2.3 |
| 📈 平均分/最高分/最低分 | ✅ | v0.2.3 |
| 👥 多管理员账号 | ✅ | v0.2.3 |
| 🔗 全局 API 接口 | ✅ | v0.2.4 |
| 💾 SQLite 数据库支持 | ✅ | v0.2.4 |
| 🎨 个性化定制 | ✅ | v0.2.4 |
| 🔐 独立登录页面 | ✅ | v0.2.4 |
| 💾 数据库在线备份 | ✅ | v0.2.4 |
| 🤖 QQ 机器人接入 | ✅ | v0.2.5 |
| 🗑 日志删除 | ✅ | v0.2.5 |
| 🏫 **多校多班分级管理** | ✅ | **v0.3.0** |
| 🔐 **四级权限组体系** | ✅ | **v0.3.0** |
| 📢 **公告系统** | ✅ | **v0.3.0** |
| 🏫 **学校入驻申请** | ✅ | **v0.3.0** |
| 👨‍🎓 **学生端自助查询** | ✅ | **v0.3.0** |
| 🎨 **深色主题现代化 UI** | ✅ | **v0.3.0** |
| ⚡ **Nuxt 全栈重构** | ✅ | **v0.3.0** |
| 📱 响应式设计 | ✅ | v0.3.0 |
| 🔒 XSS 安全过滤 | ✅ | v0.3.0 |
| 📝 TypeScript 类型安全 | ✅ | v0.3.0 |

---

## 🛠 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | [Nuxt 4](https://nuxt.com/) + [Vue 3](https://vuejs.org/) |
| 语言 | TypeScript |
| 数据库 | SQLite + [Drizzle ORM](https://orm.drizzle.team/) |
| 样式 | Tailwind CSS 4 |
| 认证 | Session + BCrypt |
| 图表 | Chart.js |
| 状态管理 | Vue Composition API |

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

```bash
# 构建生产版本
npm run build

# 启动生产服务器
npm run preview
```

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
│   │   ├── announcements/        # 公告相关
│   │   ├── applications/         # 入驻申请相关
│   │   ├── auth/                 # 认证相关
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
├── docs/                         # 文档目录
│   └── api.md                    # API 接口文档
└── README.md                     # 项目说明
```

---

## 👥 用户角色说明

| 角色 | 权限范围 | 主要功能 |
|------|----------|----------|
| 超级管理员 | 全局 | 学校入驻审核、公告管理、系统设置 |
| 学校管理员 | 本校 | 年级管理、教师账号管理、班级管理 |
| 年级管理员 | 本年级 | 班级管理、年级数据查看 |
| 班级管理员（班主任） | 本班 | 学生管理、积分调整、座位表、数据统计 |
| 学生 | 本人 | 查看个人积分、班级排名、修改个人信息 |

---

## 📝 使用说明

### 首次启动

1. 运行 `npm run dev` 启动开发服务器
2. 访问 `http://localhost:3000`
3. 系统自动初始化数据库，创建默认超级管理员账号
4. 使用超级管理员账号登录

### 学校入驻流程

1. 访问首页，点击「申请入驻」
2. 填写学校信息、申请人信息
3. 提交申请，等待审核
4. 超级管理员审核通过后，自动创建学校和管理员账号
5. 使用分配的管理员账号登录

### 日常使用

1. **添加学生**：进入「学生管理」→「添加学生」
2. **调整积分**：在学生详情页或积分管理页进行加减分
3. **查看排名**：首页或学生页面查看积分排行榜
4. **座位编排**：进入「座位表」页面，拖拽调整座位

---

## ❓ 常见问题

**Q: 如何重置管理员密码？**
A: 超级管理员可以在教师管理中重置密码。如果是超级管理员密码遗忘，需要手动修改数据库。

**Q: 数据如何备份？**
A: SQLite 数据库文件位于 `server/database/` 目录下，直接复制 `.db` 文件即可备份。

**Q: 支持 MySQL 吗？**
A: v0.3.0 当前仅支持 SQLite。后续版本可能会增加 MySQL 支持。

**Q: 如何升级到新版本？**
A: 拉取最新代码后，运行 `npm install` 更新依赖，然后运行 `npm run db:migrate` 执行数据库迁移。

---

## 📄 许可证

MIT License

---

## 📚 文档

- [API 接口文档](./docs/api.md) - 完整的 API 接口说明

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📮 交流

- QQ 群：1074247379
- GitHub Issues：[提交问题](https://github.com/QianKunBoss/ClassScoreManageSystem/issues)
