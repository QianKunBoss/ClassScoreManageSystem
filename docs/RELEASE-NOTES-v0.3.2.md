# ClassFire v0.3.2 发布说明

- 发布日期：2026-09-19
- 上一版本：v0.3.1
- 仓库：<https://github.com/QianKunBoss/ClassFire>
- 文档站：<https://docs.csms.tianrld.top>

## 0. 关于本文件

v0.3.0 对项目做了一次整体重构：后端框架、数据访问层、权限模型、部署方式全部更换，改动覆盖整个产品。因此本发布说明不采用增量变更清单的写法，而是完整描述 v0.3.2 的产品能力，作为该版本的功能基线。v0.3.1 与 v0.3.2 的增量内容见第 8 节和第 11 节。

## 1. 概述

ClassFire（班级操行分管理系统）面向各级学校，用于管理操行分（班级积分）。系统以多租户架构为基础，每所学校使用独立的数据库文件；以四级权限体系支撑「总系统 / 学校 / 年级 / 班级 / 学生」的层级管理。原本依靠纸质台账、黑板公示与 Excel 核算的操行分管理，在系统中变为可实时查询、可追溯、可统计、可对接第三方平台的线上能力。

## 2. 重构前后对照

| 维度 | 重构前（PHP 版） | 重构后（v0.3.x） |
| --- | --- | --- |
| 后端框架 | PHP 原生脚本 | Nuxt 4（Nitro 服务端引擎，SSR） |
| 前端架构 | 多页面 PHP + jQuery | Vue 3 SPA + 服务端渲染，TypeScript 全量类型 |
| 数据访问 | 手写 SQL 字符串拼接 | Drizzle ORM（类型安全查询构造器） |
| 数据库 | 单库单表结构 | SQLite 多租户分裂库（主库 + 每校独立 `.db`） |
| 权限模型 | 单班级管理员 | 四级权限体系（super_admin / school_admin / grade_admin / class_admin），另有学生端 |
| 数据隔离 | 靠 `WHERE` 条件约束 | 靠物理文件隔离，跨校数据不在同一个数据库文件内 |
| 部署方式 | Web 服务器 + PHP-FPM | 单进程 Nitro 产物，`node .output/server/index.mjs` 即可启动 |
| 第三方对接 | 无 | 外部开放 API v1（22 个端点 + 凭证体系 + 审计） |
| 客户端形态 | 仅网页 | PWA 可安装应用（离线缓存 + 主屏幕图标） |
| 安全基线 | 口令明文、弱校验 | BCrypt + 会话密封 + 启动期安全守卫 + 登录限流 |

重构带来的主要收益是数据隔离方式的改变。跨校数据不再依靠 SQL 条件约束，而是依靠文件系统隔离：学校 A 的数据库文件中不存在学校 B 的表，因此漏写一处 `WHERE school_id = ?` 不会造成跨校数据泄露。

## 3. 功能说明

### 3.1 多租户架构与权限体系

**租户模型：一校一库**

```
data/
├── classfire.db                  ← 主库：学校、管理员、入驻申请、公告、系统设置、
│                              邮件服务与模板、API 凭证、API 审计日志
└── schools/
    ├── 1.db                 ← 学校 1 的独立业务库
    ├── 7.db                 ← 学校 7 的独立业务库
    └── ...
        （每库含：年级、班级、学生、积分流水、积分模板、座位布局、座位数据、幂等键）
```

- 新学校审批通过时，由 `create-school-db` 工具动态生成该校数据库文件并初始化 schema。
- 两个库均启用 `PRAGMA journal_mode = WAL`（并发读写友好）与 `PRAGMA foreign_keys = ON`（SQLite 默认关闭外键约束，需显式开启）。
- 防止幽灵库：`useSchoolDb()` 在打开分库前先调用 `assertSchoolExists(schoolId)`（`server/database/db.ts:55`，调用点 `:89`）确认主库 `schools` 表中存在该记录，否则拒绝打开。否则超级管理员传入任意 `?schoolId=` 就能凭空产生一个空库。
- 启动期全量迁移：`migrateAllSchoolDbs()`（`db.ts:275`）在 `initDatabase()` 之后扫描 `data/schools/*.db`，逐个执行 `migrateSchoolDb()`。这样长期未被访问的学校库不会停留在旧 schema，避免某校长时间未登录、升级后一登录就报缺列。
- 删除学校提供两种模式（`DELETE /api/schools/[id]`，需超管权限，并通过 `x-confirm-password` 二次验密）：
  - 默认（`deleteData=0`）只删除主库中的学校记录，保留 `data/schools/{id}.db` 数据文件，误删后可人工恢复；
  - 显式传入 `?deleteData=1` 才物理删除数据库文件，学生、班级、年级、积分数据全部清除且不可恢复；
  - 删除前先做外键解绑而非级联删除：将 `applications.reviewed_by` / `created_admin_id`、`announcements.created_by` 置空以保留审计记录，再删除该校管理员账号，最后删除学校记录，整个过程在一个事务内完成；
  - 删除与封禁是两个不同操作。封禁走 `PATCH /api/schools/[id]`，将 `disabled` 置为 1，学校及其数据完整保留，可随时解封。
- 跨库引用只在必要处出现：主库的 `admins.school_id` 用于定位学校库；`admins.grade_id` / `class_id` 仅作为管辖范围提示，不建立跨库外键（SQLite 不支持跨文件外键），一致性由应用层保证。权限判定以当前登录管理员的真实身份和实时解析的管辖范围为准，不信任前端传入的 `schoolId` / `gradeId` / `classId`。
- `useDb()` 旧接口已废弃（`db.ts:41`），统一使用 `useMainDb()` / `useSchoolDb()`。

**四级角色与管辖范围**

| 角色 | 标识 | 管辖范围 | 主要职责 |
| --- | --- | --- | --- |
| 超级管理员 | `super_admin` | 全局，无所属 | 学校入驻审核与封禁、管理员账号管理、公告发布、邮件与系统设置、全平台数据管理 |
| 学校管理员 | `school_admin` | 本校 | 年级管理、班级管理、教师账号管理、本校 API 凭证签发 |
| 年级管理员 | `grade_admin` | 本校 + 本年级 | 本年级班级管理、年级统计查看 |
| 班级管理员（班主任） | `class_admin` | 本校 + 本年级 + 本班 | 学生管理、加减分、模板、座位表、班级统计 |
| 学生 | 学生表 | 本人 | 查看个人积分与流水、班级排名，绑定邮箱，修改个人信息 |

- 管理员的所属范围可编辑，可选范围由管理级别约束：`super_admin` 无所属，`school_admin` 仅可选学校，`grade_admin` 可选学校与年级，`class_admin` 可选学校、年级与班级。
- 涉及管辖范围的接口统一通过 `assertClassManagement` 一类函数校验，内部接口与外部开放 API 共用同一套范围语义，避免出现两套互相矛盾的规则。

**鉴权模型**

- 内部接口（`/api/**`）只接受 Session（`nuxt-auth-utils` 密封 Cookie）。
- 外部接口（`/api/v1/**`）只接受 `api_token`。
- 两套鉴权相互隔离。外部调用无法操作系统级数据，这一点由路由结构保证，不需要在上百个接口中逐个维护黑名单。

### 3.2 积分引擎

**加减分的三种方式**

1. 单条：指定学生、分值与事由。
2. 批量：一次提交多个学生（上限 200 条），逐条校验并逐条返回结果。
3. 模板：选用预置模板，一键套用其分值与事由描述。

**四列账本口径**

每个学生记录上维护四个与积分流水实时同步的聚合列：

| 列 | 含义 |
| --- | --- |
| `total_score` | 当前总分（`add_score - deduct_score`） |
| `add_score` | 累计加分 |
| `deduct_score` | 累计扣分 |
| `score_count` | 积分记录条数 |

- 加分、扣分、撤销都通过同一个 `score-service` 执行，内部接口与外部开放 API 共用，保证任何入口写入都不会造成四列口径不一致。
- 撤销采用对称回滚：撤销一条 `+5` 的记录，会同时把 `total_score` 减 5、`add_score` 减 5、`score_count` 减 1，而不是再记一次扣分。语义上该记录视为不存在，而不是被抵消。
- 单次分值上限为 ±10000（`MAX_SCORE_DELTA`），超出返回 `40002` 参数非法。
- 提供全量重算接口（`recalculate-scores`）：聚合列因异常写入发生漂移时，可按流水重建四列，作为兜底修复手段。

**积分流水**

- 每条记录保存学生 ID、用户名快照、分值变化、事由描述、创建时间（UTC ISO 8601）。
- 支持按学生、用户名、班级、年级、类型（加分 / 扣分）、时间区间筛选与分页。
- 支持删除单条记录，删除时同步回滚聚合列，操作带二次确认。
- 学生可查看自己的全部流水，管理员可查看管辖范围内的全部流水。

**积分模板**

- 两种归属：班级专属模板与全校通用模板。
- 支持创建、编辑（名称、分值、描述）与删除。同一归属下不允许重名，重名返回 `40901`。
- 模板归属在创建时确定，不可修改。需要更换归属时删除后重建，避免历史记录语义漂移。
- 全校通用模板仅学校级及以上管理员可创建。

**学期切换**

- 一键开启新学期，重置学生的四列积分统计，用于学期制操行分重新起算。
- 该操作需要超级管理员权限，属高风险操作。

### 3.3 排行榜与图表

**排行榜**

- 按总分排序，默认展示前 10 名。
- 名次排序使用 `localeCompare`，保证中英文姓名混排顺序符合习惯。
- 前三名显示奖牌标识。
- 支持校级、年级、班级三级范围切换。超管可查看全校、按年级、按班级；年级管理员可查看全年级、按班级。

**图表组件（Chart.js 4 + vue-chartjs 5）**

| 组件 | 用途 |
| --- | --- |
| `ScoreTrendLine` | 积分趋势折线图，按日期聚合的累积与增量走势 |
| `ScoreCandlestick` | 积分 K 线图，将每日加减分聚合成开高低收，呈现当日净变化幅度 |
| `MiniSparkline` | 列表行内的迷你折线走势 |
| `MiniCandles` | 排行榜行内的迷你 K 线趋势预览 |
| `ScoreAddDeductBar` | 加减分对比柱状图，红色表示加分、绿色表示减分 |

- 趋势接口提供按班级聚合与按学生个体两个维度（`scores/trend` 与 `scores/trend/users`），学生端另有独立的个人趋势接口。
- `scores/breakdown` 提供分值构成拆解，展示各事由贡献的分数。
- `stats/records` 提供积分记录的统计口径（按人、按类型、按时间）。

配色遵循项目统一规范：宇宙科技风钢蓝色系，全站不使用渐变（无 `linear-gradient`、`radial-gradient`、`bg-gradient-*`），发光效果通过纯色配合 `box-shadow` / `text-shadow` 实现，语义色保留 emerald / amber / red。

### 3.4 可视化座位表

- 拖拽式编排，直接拖动学生到目标座位，所见即所得。
- 分组布局，可配置组数（`groupCount`）、每组行数（`rowsPerGroup`）、每组列数（`colsPerGroup`）。
- 过道配置（`hasAisle`），支持在组间留出过道，贴合真实教室排布。
- 支持按配置一键生成座位网格，再手工微调。
- `seat_data` 表以 `(班级, 组序号, 行序号, 列序号)` 唯一约束一个格位，格位可以绑定学生，也可以标记为过道。
- 学生被删除时座位自动置空（`ON DELETE SET NULL`），不会留下指向已删除学生的座位记录。
- 班级删除或学生转班时，座位与学生的对应关系按班级维度整体管理，避免跨班错位。

### 3.5 数据统计

- 工作台仪表盘（`/admin`）是管理后台首页，展示班级态势、积分概览、排行榜等概览信息。
- 概览统计（`stats/overview`）：班级数、学生数、总积分、加分合计、扣分合计、记录总数、今日记录数、TOP 榜。
- 记录统计（`stats/records`）：按时间、类型、人员聚合记录。
- 多级筛选：超管支持全校、年级、班级三级切换，年级管理员支持全年级、班级两级切换。
- 趋势分析：加分、扣分、净变化随时间的走势，可用于发现纪律问题集中的时间段。

### 3.6 学生端

学生是系统中唯一自证身份的角色，有独立的登录入口与界面。

- 独立登录页与登录接口（`auth/student/login`），与管理员体系分离。
- 个人主页：展示本人总分、加分、扣分、记录条数以及最近积分流水。
- 个人趋势：本人积分随时间的变化曲线。
- 班级排行榜：查看本班排名，默认前 10 名。
- 同班同学列表：仅展示用户名、姓名等公开信息。
- 个人设置：修改用户名、修改姓名、修改密码、绑定邮箱（用于找回密码）。其中用户名允许学生自助修改。
- 邮箱验证码找回密码：绑定邮箱后可通过验证码自助重置密码，无需联系班主任。
- 强制改密：新学生使用默认口令（如 `123456`）或管理员重置后的临时口令首次登录时，`must_change_password` 标记为 1，系统跳转到 `setup-required` 页面，未完成改密无法进入系统。
- 账号禁用：学生被禁用（`disabled = 1`）后无法登录。

### 3.7 学校入驻与审批

入驻链路从公开申请到自动开户，共九个环节。

1. 公开申请页（`/apply`），无需登录即可访问。
2. 校名实时校验：输入校名时防抖检查是否重名，已存在则提示并禁用提交与获取验证码按钮；提交时再校验一次，防止并发绕过。
3. 重复判定放宽：已删除、已拒绝的学校不计入重复，允许重新申请，避免一次申请永久占位。
4. 邮箱验证码：申请时通过邮箱验证码确认申请人邮箱真实性，复用邮件服务系统。
5. 超管审核（`/superadmin/applications`）：通过或拒绝，可填写审核备注。
6. 通过后自动开户：创建学校记录、该校独立数据库以及学校管理员账号，并分配初始账号密码。
7. 结果邮件通知：审核结果自动发送到申请时填写的邮箱，邮件中可携带账号、密码、学校 ID 等变量。
8. 学校封禁：超管可将学校置为 `disabled = 1`，被封禁学校的全部管理员与学生均无法登录，超管仍可查看与解封。
9. 删除留痕：
   - 已审核通过的学校被删除后，入驻申请页对应记录显示黄色「已删除」标签（`school_deleted` 标记）；
   - 新增 `deleted_school_id` 快照列。删除学校时把原学校 ID 复制到该列再置空外键，使申请记录在学校数据库文件已删除后仍能展示原始学校 ID，不会变成无法追溯的孤儿记录；
   - 删除行为本身有两种模式（默认保留数据文件，可显式要求物理删库），详见 3.1 节。封禁与删除是两个操作，封禁只置 `disabled = 1`，学校与其数据完整保留。

### 3.8 公告系统

- 全局公告由超级管理员统一发布，全平台可见。
- 三种类型：通知（info）、警告（warning）、重要（important），前端按类型区分颜色。
- 导航栏下方固定公告栏（`AnnouncementBar`），进站即可看到，不打断操作。
- 内容支持加粗、链接、换行等基础 HTML。
- 所有公告内容经 `sanitizeHtml` 白名单过滤后才渲染。公告是三端共享的注入面，此处为硬性防线。
- 关闭记忆：用户关闭某条公告后，24 小时内不再显示（本地记忆），避免反复打扰。
- 公告可整体下线而不删除，保留历史记录。
- 提供公开拉取接口，登录页等未鉴权页面也能获取公告，该接口只读且内容已过滤。

### 3.9 认证与账号安全

**管理员登录方式**

1. 用户名 + 密码
2. 邮箱 + 密码（登录标识符可切换）
3. 邮箱验证码登录（免密）

**密码找回与绑定**

- 管理员忘记密码可通过邮箱验证码自助重置。
- 邮箱绑定分两步：`send-code` 发送验证码，`verify` 校验并写入数据库，绑定时间记录在 `email_bound_at`。
- 邮箱在各自作用域内唯一（管理员全局唯一，学生全校唯一）。SQLite 唯一索引允许多个 NULL，因此未绑定的记录不冲突。
- 改密码、改邮箱等敏感操作走 `security/send-code` 二次验证码确认。

**强制修改密码与强制安全设置**

- 管理员与学生两张表都带 `must_change_password` 标志。
- 管理员重置他人密码，或用默认密码新建账号后，被重置者登录时会被强制改密；学生用默认口令首次登录同样被强制改密。
- 跳转落点不同：管理员进入 `/settings?force=true`，学生进入 `/student/setup-required`。两者均为独立布局（`blank`），未完成设置无法进入系统其余部分。
- 为避免死锁，全局中间件只在 `mustChangePassword` 为真，或者未绑定邮箱且系统确实已配置邮件服务时才强制跳转。未配置 SMTP 时不以未绑邮箱为由拦截，否则新建学校在配好邮件服务之前，全校管理员会被困在无法完成的绑定页上。

**密码存储**

- 统一使用 BCrypt（`bcryptjs`）哈希，带随机盐，不可逆。
- 不存储明文，也不使用 md5、sha1 等弱哈希。

**会话管理**

- 会话基于 `nuxt-auth-utils` 的密封票据（iron-webcrypto），不使用自签 JWT。
- Cookie 安全标志显式声明，不依赖框架默认值：
  - `httpOnly: true`：前端 JS 不可读，缓解 XSS 窃取会话；
  - `secure: true`（生产环境）：仅通过 HTTPS 传输；
  - `sameSite: 'lax'`：缓解 CSRF，跨站 POST 不携带 Cookie；
  - `path: '/'`。
- 会话有效期 7 天，同时作为 Cookie 的 `expires` 与票据 TTL，到期需重新登录。

**启动期安全守卫（v0.3.2 新增）**

- 会话密钥是密封票据的唯一完整性来源。如果密钥可预测，例如沿用代码中的示例值，攻击者可以离线伪造任意 super_admin 会话，绕过全部鉴权。
- `server/plugins/00.security-guard.ts` 在 Nitro 启动阶段审计会话密钥，检查四项：是否为空、长度是否小于 32 字符、是否命中已知示例或默认密钥黑名单、字符种类是否少于 8（随机性不足）。
- 生产环境下校验不通过时执行三步处理：打印带修复指引的错误信息；注册请求级 503 兜底，避免宿主吞掉启动异常后仍以不安全配置对外服务；抛出异常使进程退出。
- 开发环境仅告警不阻断，`nuxt-auth-utils` 会自动生成随机密钥并写入 `.env`。

**登录失败限流（v0.3.2 新增）**

- 登录接口原本对失败次数没有约束，学生默认口令 `123456` 与管理员 6 位弱口令都可能被短时间爆破。
- 采用双桶策略：
  - 账号桶：同一账号 10 分钟内失败 5 次，锁定 15 分钟，防止针对特定账号的爆破；
  - IP 桶：同一 IP 10 分钟内失败 40 次，锁定 10 分钟，防止撞库。
- IP 桶阈值比账号桶宽松。学校网络普遍使用 NAT 共享出口，全校师生对外只有一个 IP，如果两个桶同样严格，一个人输错密码就会导致整校被锁。
- 账号不存在、密码错误、验证码错误均计入失败次数，避免通过响应差异枚举账号是否存在。
- 超限返回 `429` 并带 `Retry-After` 响应头。
- 不同登录入口（`admin-password` / `admin-email-code` / `student-password`）独立计数，因为管理员与学生可能同名。
- 已知取舍：限流状态存储在单进程内存中，PM2 cluster 多 worker 运行时实际阈值约为单 worker 阈值乘以 worker 数，横向扩容需要迁移到共享存储。

**其它安全措施**

- 多角色权限中间件（`middleware/auth.global.ts` / `student.ts` / `super-admin.ts`）在路由层拦截越权访问。
- 删除学生、删除班级、删除年级、删除积分记录等破坏性操作均需二次确认。
- 前端渲染统一经 `sanitizeHtml` 白名单过滤，覆盖公告、邮件模板等。
- 超级管理员可以免密登录任意管理员账号，用于线上排查问题。该能力仅超管可用，退出后需重新登录超管账号。

### 3.10 邮件通知

**多服务与优先级故障转移**

- 主库 `mail_services` 表支持配置多个邮件服务，包括 QQ、163、Gmail、Outlook、阿里云和自定义 SMTP。
- 每个服务带 `priority`（0 最高）与 `enabled` 开关。发送时按 `priority` 升序依次尝试，前一个失败自动降级到下一个。
- 支持 `none` / `ssl` / `tls` 三种加密方式，端口与发件人（`from_name` / `from_address`）均可配置。
- 提供连通性测试（`test-connection`）与测试发信（`test-send`）接口，配置完成后可立即验证，不必等真实业务触发。
- 凭据仅超级管理员可读写，公开接口不暴露。

**邮件模板管理**

- 主库 `mail_templates` 表以 `slug` 作为业务标识（如 `verification_code`），代码侧按 slug 渲染。
- 可在后台在线编辑主题与 HTML 正文。
- 模板声明支持的变量键（JSON 数组），渲染时由 `renderTemplate` / `renderString` 替换，例如申请人姓名、学校名称、账号、密码、学校 ID。
- 提供模板测试发信（`test-verification-code`）与验证码校验（`verify-verification-code`）接口。
- 模板内容经 XSS 过滤。

**业务通知场景**

- 入驻审核结果通知（通过或拒绝）自动发送至申请邮箱。
- 邮箱验证码用于入驻申请、管理员邮箱绑定、管理员找回密码、管理员改密验证、学生邮箱绑定、学生找回密码，全部复用同一套验证码服务，并带验证码限流。

### 3.11 外部开放 API（v1）

外部开放 API 供第三方系统（校园一卡通、教务平台、自动排座脚本等）在授权范围内读写业务数据，但无法触碰系统级数据。

**三条约束（由架构层强制）**

1. 系统数据不可操作：外部端点隔离在 `/api/v1/**`，与内部 `/api/**` 相互独立，第三方无法通过开放 API 操作管理员账号、学校、公告、邮件配置等。
2. 写操作仅限校级及以下业务数据，且限制在凭证自身的数据范围内。
3. 所有请求必须携带 `api_token`，缺失或校验失败一律拒绝（401 / 403），不做降级放行。

**认证**

- 请求头使用 `Authorization: Bearer classfire_...` 或 `X-API-Token: classfire_...`。
- token 明文形如 `classfire_` 加高熵随机串，约 45 字符。
- 数据库只存储 `sha256(token)`，建唯一索引，库内无明文，无法还原。
- 使用 sha256 而非 bcrypt 的原因：bcrypt 带随机盐，无法建索引，鉴权只能全表扫描逐个比对；token 本身是 256 位高熵随机串，不存在字典与彩虹表风险，单次 sha256 已经足够。密码属于低熵、人为选择的内容，才需要 bcrypt。
- 同时存储 `token_prefix`（明文前 12 字符），用于在管理界面识别 token，不足以还原密钥。
- 校验顺序为：缺少 token、token 无效、已禁用、已过期、关联学校不存在或停用、签发者已被禁用。任一步不通过即短路返回，不消耗限流配额。

**范围（scope）与权限（scopes）双层控制**

- 范围决定能查看哪些数据，取值 `school`（全校）、`grade`（单年级，含签发后新建的班级）、`class`（单班）。
- 权限决定能对数据执行哪些动作，共 12 项：

| 权限 | 端点 | 说明 |
| --- | --- | --- |
| `students:read` | 学生列表 / 详情 | 只读 |
| `students:write` | 创建 / 更新学生 | 不含改密码与改邮箱 |
| `students:delete` | 删除学生 | 危险操作 |
| `scores:read` | 积分流水、统计概览 | 只读 |
| `scores:write` | 加减分（单条 / 批量 / 模板） | — |
| `scores:revoke` | 撤销积分记录 | 对称回滚四列 |
| `structure:read` | 年级 / 班级列表 | 只读 |
| `structure:write` | 年级 / 班级 / 模板增改 | 部分受范围限制 |
| `structure:delete` | 删除年级 / 班级 | 危险操作，级联删除 |
| `templates:read` | 积分模板列表 | 只读 |
| `templates:write` | 模板增改删 | — |
| `stats:read` | 统计概览 | 只读 |

- 范围与权限为 AND 关系：即使拥有权限，也只能操作范围内的数据。`class` 范围加 `scores:write` 的凭证传入范围外的 `userId`，返回 `40303 OUT_OF_RANGE`。
- 危险权限默认不勾选，并在界面上标红提示。
- 统计接口同样受范围约束：班级凭证看到的「总人数」是本班人数而非全校，避免统计接口成为绕过范围的越权通道。

**读接口返回 404、写接口返回 403 的原因**

- 读接口对范围外的目标返回 `404` 而不是 `403`。`403` 会泄露「该 ID 存在但不属于你」，班级级凭证据此可以遍历出全校规模。
- 写接口对范围外的目标返回 `403`。调用方已明确指名目标，明确的错误更便于排障，且不存在枚举风险。

**作用范围不可变更**

- `scope_type` / `scope_grade_id` / `scope_class_id` 在签发时确定，不能通过 API 变更，编辑操作只能修改名称、权限与有效期。
- 范围目标在签发时即校验真实存在，避免出现指向「未来可能出现的 ID」的凭证。
- `grade` 范围存储的是年级 id，而不是班级列表快照。语义为「这个年级」，后续新增班级自动纳入，与内部 `resolveSchoolScope()` 的动态行为保持一致。

**28 个端点（22 个外部 + 6 个凭证管理）**

下表标注 `(写)` 的端点为写操作，需要对应的 `write` 或 `delete` 权限。其中 `DELETE /students/:id`、`DELETE /grades/:id`、`DELETE /classes/:id` 属危险操作。

| 分组 | 端点 |
| --- | --- |
| 连通性自检 | `GET /ping`（无需 scope，返回凭证自身元信息，便于对接方自助排查） |
| 学生 students | `GET /students` · `GET /students/:id` · `POST /students` (写) · `PATCH /students/:id` (写) · `DELETE /students/:id` (写) |
| 积分 scores | `GET /scores` · `POST /scores` (写) · `DELETE /scores/:logId` (写) |
| 年级 grades | `GET /grades` · `POST /grades` (写，仅校级) · `PATCH /grades/:id` (写) · `DELETE /grades/:id` (写，仅校级) |
| 班级 classes | `GET /classes` · `POST /classes` (写) · `PATCH /classes/:id` (写) · `DELETE /classes/:id` (写) |
| 模板 templates | `GET /templates` · `POST /templates` (写) · `PATCH /templates/:id` (写) · `DELETE /templates/:id` (写) |
| 统计 stats | `GET /stats/overview` |
| 凭证管理（内部 Session） | `GET /api/api-tokens` · `POST /api/api-tokens` · `GET /api/api-tokens/meta` · `PATCH /api/api-tokens/:id` · `GET /api/api-tokens/logs` · `DELETE /api/api-tokens/:id` |

**统一响应体**

成功与失败使用同一结构，便于第三方用统一代码处理：

```jsonc
{
  "code": 0,                 // 业务码：0 为成功；非 0 时按 HTTP 状态码 × 100 + 序号 计算
  "message": "ok",
  "data": { },               // 失败时固定为 null
  "requestId": "uuid-v4"     // 与审计日志对应，报障时凭此定位
}
```

- 失败响应同样带 `requestId`，并且会记入审计日志。
- 列表接口统一返回 `{ list, total, page, limit }`，`page` 默认 1，`limit` 默认 20、上限 100。
- 排序字段使用白名单：`sortBy` 只能取文档中枚举的值，拼接进 `ORDER BY` 前经校验，未命中则回退默认值，不接受任意字段。
- 时间戳统一为 UTC ISO 8601。`startDate` / `endDate` 支持 `YYYY-MM-DD`（自动补全为当日 `00:00:00.000Z` / `23:59:59.999Z`）与完整 ISO 串，其他格式返回 400。
- 错误码表覆盖参数、鉴权、范围、冲突、限流、服务端共 18 个业务码。

**写操作幂等（Idempotency-Key）**

- 加分是不可逆累加，第三方网络重试容易造成重复加分，这是幂等机制存在的原因。
- 同一 token 加同一 key 重复提交时，直接回放首次响应体，不再执行业务逻辑。
- 并发重复：另一请求已占用该 key 且仍在处理时返回 `40901`，提示稍后重试；key 已用于其他端点则提示不可复用。
- 回放响应带 `Idempotency-Replayed: true`。
- 业务异常导致的失败不锁定 key，调用方可以换 key 或使用原 key 重试。
- 幂等记录存储在各校分库的 `api_idempotency` 表中。key 只在单校范围内有意义，且可随学校删除一并清理，保留 24 小时。
- 适用端点：`POST /students`、`POST /scores`、`DELETE /scores/:logId`。

**限流（按 token 维度，进程内存双桶）**

| 桶 | 上限 | 适用 |
| --- | --- | --- |
| 全量 | 600 次 / 分钟（约 10 QPS） | 所有请求 |
| 写操作 | 120 次 / 分钟 | POST / PATCH / DELETE |

- 超限返回 `42901`，带 `Retry-After`（秒）与 `X-RateLimit-Limit`。
- 阈值依据是批量加分本身支持一次提交多个学生，不需要高频写操作，正常教务系统对接远达不到 600 次 / 分钟。

**调用审计**

- 每次 v1 调用（包括鉴权失败与限流拒绝）写入 `api_audit_logs`，保留 30 天。
- 记录字段包括 `requestId`、`tokenId`、`tokenPrefix`、`schoolId`、`method`、`path`、`statusCode`、`latencyMs`、`ip`、`userAgent`、`errorMessage`、`createdAt`。
- 每次响应附带 `X-Request-Id` 响应头。
- 只有鉴权通过的调用才累加 token 的 `callCount`、`lastUsedAt`、`lastUsedIp`，被拒请求不计入使用量。
- 审计写入失败不影响业务，异常被吞掉并只记录日志。
- 审计日志表放在主库而非分库：鉴权失败的请求拿不到有效的 `schoolId`，分库无法打开，日志将无处存放；此外超管需要查看全平台调用情况，跨分库聚合成本过高。
- `token_id` 不加外键。鉴权失败时该字段为 null，且 token 被吊销后历史日志仍需保留，日志与凭证的生命周期是解耦的。

**凭证签发与管理**

- 入口页面为 `/admin/api-tokens`，导航项名为「API 凭证」。
- 任意管理员均可签发凭证，但签发范围不能超过签发者自身的管辖范围：班级管理员只能签本班，年级管理员只能签本年级及其班级，学校管理员签本校，超管不受限制。
- 签发与吊销均需重新输入登录密码（`x-confirm-password` 头），防止会话泄露后凭证被滥用。
- 明文 token 仅在签发成功后展示一次，关闭后不可再查看。
- 可编辑名称、权限与有效期，可禁用，可吊销。吊销后调用立即返回 `40103`。
- `expiresAt` 为空表示永不过期。签发时可指定有效天数，上限 1825 天（5 年），由签发前置元数据接口 `maxExpireDays` 下发，前端据此约束输入。
- 凭证关联学校时带 cascade，学校被删除时其 token 一并删除，不会留下悬空凭证。

### 3.12 数据管理与备份

系统中有两套面向不同角色的导出 / 导入能力，使用时不要混淆。

**A. 管理员范围备份（工作台内，`/api/admin/*`，`requireAdmin`）**

- 导出（`GET /api/admin/export`）：按 `scope = all | grade | class` 导出结构化 JSON 备份。
- 导入恢复（`POST /api/admin/import`）：支持 `mode = 'overwrite' | 'merge'` 两种策略。
- 目标范围内已有数据且未指定 `mode` 时，接口先返回 `{ needConfirm: true, existing }`，由前端弹窗确认后再带 `mode` 重试，不会静默覆盖。
- 导出范围基于当前登录管理员的真实身份经 `resolveSchoolScope()` 解析。前端传入的 `gradeId` / `classId` 只能在自身权限内进一步缩小范围，越权返回 403。
- 入口在工作台 `/admin`。超级管理员端不显示这两个按钮，超管使用下面 B 套能力。

**B. 超管数据枢纽（`/api/data/*`，`requireSuperAdmin`）**

| 端点 | 作用 |
| --- | --- |
| `GET /data/stats` | 系统数据总览：超管为全部学校聚合，返回概览卡片、各维度图表数据与每校明细 |
| `GET /data/activity` | 明细记录：跨校或本校最近的积分记录与新注册学生 |
| `GET /data/export` | 按需导出 CSV：`type = students / scores / grades-classes / admins / applications / announcements / schools`，可带 `schoolId` |
| `POST /data/backup` | 一键备份。超管可导出主库与全部学校库，用于整机迁移 |
| `POST /data/restore` | 从备份恢复 |
| `POST /data/import/preview` | 导入预览，解析并展示影响规模，不写库 |
| `POST /data/import/commit` | 确认后正式落库 |

- 管理入口是超管的「数据管理」页（`/superadmin/data`，`<DataHub/>` 组件）。
- CSV 工具位于 `server/utils/csv.ts`，用于批量名单导入导出。

**磁盘层面备份**

- `data/` 目录包含主库 `classfire.db` 与各校 `data/schools/{id}.db`。直接复制对应的 `.db` 文件即可完成备份，主库与分库需一并备份才能还原完整状态。
- `data/` 已列入 `.gitignore`，不会进入版本库。
- 危险操作均有二次确认。

### 3.13 系统设置与外观

- 系统设置（`/superadmin/settings/system`）：站点级参数。
- 外观设置（`/superadmin/settings/appearance`）：品牌与视觉配置。
- 模板设置（`/superadmin/settings/templates`）：邮件模板统一管理入口。
- 公开设置接口（`settings/public`）只暴露可公开的键值，如站点名称、公告开关、注册开关，密钥类配置不对外输出。
- 设置项存储在主库 `system_settings` 表，`setting_key` 唯一，附描述字段与更新时间。
- 主题默认深色（`@nuxtjs/color-mode`，`preference: 'dark'`，`storageKey: 'classfire-theme'`），支持切换。
- 视觉规范：全站采用宇宙级未来科技科幻风，深空蓝黑底 `#070b14`、钢蓝主色 `#4a7ab5`、蓝灰与银灰点缀；包含 Canvas 星海（鼠标视差）、滚动揭示、磁性按钮、3D 倾斜卡片、打字机轮播、计数动画等交互效果；全站不出现任何渐变，发光通过纯色配合阴影或模糊实现。

### 3.14 PWA

- 可安装到桌面或主屏幕，以全屏独立窗口运行，Android 使用自适应图标，iOS 支持全屏。
- 通过 Workbox 预缓存构建产物（JS、CSS、HTML、字体、图标）并做运行时缓存。
- `/api/*` 请求强制 `NetworkOnly`，不做缓存，保证积分、学生等数据实时准确。这是以数据正确性优先于离线可用性的取舍。
- 新版本自动更新（`registerType: 'autoUpdate'`），无需手动刷新。
- `navigateFallback: null`，避免 Service Worker 拦截 SSR 导航。
- 开发模式关闭 PWA（`devOptions.enabled: false`）且不注入 SW 注册插件，避免 HMR 与 Service Worker 相互干扰。
- 品牌图标：浏览器标签与应用内 logo 为「CS 字母徽标 + 星星」（该徽标沿用更名前 CSMS 的缩写，尚未按 ClassFire 重做）；PWA 主屏幕图标保留火箭主体，寓意成长与超越。
- 安装提示组件 `PwaPrompt` 在满足 HTTPS 条件时提示安装。
- 已修复：生产构建缺失 `sw.js` 时 Vue Router 报 `No match found for location with path "/sw.js"`，通过调整 PWA 配置修正。

## 4. 技术栈

| 层次 | 选型 |
| --- | --- |
| 框架 | Nuxt 4（`compatibilityVersion: 4`，SSR 开启）+ Nitro `node-server` preset |
| 前端 | Vue 3（3.5）+ TypeScript + Vue Router 5 |
| 样式 | Tailwind CSS v4（`@import "tailwindcss"` + `@tailwindcss/vite`）+ 自定义 `@theme` 令牌 |
| 数据库 | SQLite（libSQL 客户端 `@libsql/client`） |
| ORM | Drizzle ORM 0.44 + drizzle-kit（generate / migrate / push / studio） |
| 认证 | `nuxt-auth-utils`（iron-webcrypto 密封会话）+ bcryptjs |
| 邮件 | nodemailer（SMTP / Resend 等） |
| 图表 | Chart.js 4 + vue-chartjs 5 |
| 图标 | Lucide + Morphicons（变形图标 `MorphIcon`） |
| 工具库 | VueUse 13、clsx、tailwind-merge |
| PWA | `@vite-pwa/nuxt` 1.1（Workbox） |
| 主题 | `@nuxtjs/color-mode` 3.5 |
| 构建 | Vite 8、esbuild |
| 依赖管理 | npm（`package-lock.json` 入库，`.gitignore` 仅忽略 `node_modules`） |

## 5. 数据模型

### 主库 `data/classfire.db`（9 张有效表）

| 表 | 说明 |
| --- | --- |
| `schools` | 学校。`name` 全局唯一，`disabled` 为封禁标志 |
| `admins` | 管理员。`role` 四级；`school_id` 为归属学校（NULL 表示超管）；`grade_id` / `class_id` 为管辖范围提示；含 `must_change_password`、`disabled`、`email` / `email_bound_at`、`last_login`。唯一约束：`(username, school_id)` 同校不重名，`email` 非空唯一 |
| `applications` | 入驻申请。含 `status`、审核信息、`school_deleted` 标记与 `deleted_school_id` 快照 |
| `announcements` | 全局公告。`type` 三态，`active` 开关 |
| `system_settings` | 系统设置键值对 |
| `mail_services` | 多邮件服务。`priority` 升序故障转移，`enabled` 开关 |
| `mail_templates` | 邮件模板。`slug` 唯一，`variables` 为 JSON |
| `api_tokens` | 外部 API 凭证。`token_hash` 唯一索引，`scope_type` 加范围 id，`scopes` 为 JSON，含 `expires_at` 与调用统计；`school_id` cascade |
| `api_audit_logs` | API 调用审计。双索引（`token_id + created_at`、`created_at`） |

### 分库 `data/schools/{id}.db`（8 张表）

| 表 | 说明 |
| --- | --- |
| `grades` | 年级。`name` 校内唯一 |
| `classes` | 班级。`grade_id` cascade，`(grade_id, name)` 唯一 |
| `users` | 学生。`class_id` cascade，`(class_id, username)` 唯一，`email` 非空校内唯一，含四列积分聚合、`must_change_password`、`disabled` |
| `score_logs` | 积分流水。`user_id` cascade，`(user_id)` 索引 |
| `score_templates` | 积分模板。`class_id` 为 NULL 表示全校通用，`updated_at` 自动维护 |
| `seat_layout_config` | 座位布局配置。`class_id` 唯一，含组数、组内行数、组内列数、过道 |
| `seat_data` | 座位格位。`(class_id, group_index, row_index, col_index)` 唯一，`user_id` 为 `SET NULL` |
| `api_idempotency` | 幂等键。`(token_id, key)` 唯一，保留 24 小时 |

废弃列说明：`admins.api_token`（已被 `api_tokens` 表取代）与主库 `third_party_apis` 空表均为历史遗留，已在 schema 中标注 `@deprecated` 并保留列以避免迁移风险，计划后续版本清理。前者从未被任何鉴权逻辑读取，仅用于管理列表展示 `hasToken`。

## 6. 接口规模

| 分类 | 数量 |
| --- | --- |
| 内部 API 路由文件 | 116 |
| 外部开放 API（`/api/v1/**`） | 22 |
| API 路由文件合计 | 138 |
| 页面（`.vue`） | 32 |
| 公共组件 | 20 |
| 服务端工具 / 插件 / 中间件 | 21 |
| 数据表合计 | 17（主库 9 + 分库 8） |

**页面分布**

- 公开页 5 个：`index`（首页）、`login`（登录）、`apply`（入驻申请）、`settings`、`users/[id]`
- 管理后台 12 个：`admin/index`（工作台 / 仪表盘）、`users`（学生管理）、`teachers`（教师管理）、`grades`（组织架构）、`classes`、`scores`（积分管理）、`templates`（积分模板）、`seats`（座位表）、`api-tokens`（API 凭证）、`announcements`（公告）、`schools`、`settings`
  - 例外：`admin/schools` 虽位于 `admin/` 目录下，但挂了 `middleware: 'super-admin'`，实际仅超级管理员可进，普通管理员访问会被跳回 `/admin`。
  - 页面级守卫只是第一道门，真正的越权防护在后端：`getSchoolIdFromRequest()` 强制非超管的 `schoolId` 等于其自身学校，`resolveSchoolScope()` 按真实身份解析可管理范围，`assertClassManagement()` / `assertGradeManagement()` 拦截越权操作。前端导航裁剪（侧边栏按角色显示）只是体验优化，不承担安全职责。
- 学生端 5 个：`student/index`（个人主页）、`ranking`（排行榜）、`settings`（设置）、`bind-email`（绑定邮箱）、`setup-required`（强制改密）
- 超级管理端 10 个：`superadmin/index`（总览）、`schools/index`（学校管理）、`schools/[id]`（学校详情）、`admins`（管理员账号）、`students`（跨校学生）、`applications`（入驻申请）、`data`（数据管理）、`settings/system`、`settings/appearance`、`settings/templates`

## 7. 部署与运维

**环境要求**

- Node.js 20 及以上，推荐 22 LTS
- 可写目录用于存放 SQLite 数据文件（`data/`）

**开发**

```bash
npm install
npm run dev          # http://localhost:3000
```

**生产构建与启动**

```bash
npm run build
node .output/server/index.mjs
```

**必需环境变量**

| 变量 | 说明 |
| --- | --- |
| `NUXT_SESSION_PASSWORD` | 生产必填，运行时实时读取，需 32 字符以上的随机值（`openssl rand -hex 32`）。预构建产物必须用它 |
| `SESSION_SECRET` | 备选方案，仅在 `npm run build` 之前设置才会被烘焙进产物 |

会话密钥未配置或使用示例值时，生产环境会直接拒绝启动。更换密钥会使所有已登录会话失效，属预期行为。

**数据库迁移**

```bash
npm run db:generate   # 生成迁移
npm run db:migrate    # 执行迁移
npm run db:push       # 直接推送 schema
npm run db:studio     # 可视化数据管理
```

**其它部署资产**

- `Dockerfile` + `docker-compose.yml`（可选 Nginx 反向代理）
- `ecosystem.config.cjs`（PM2 进程管理）
- `deploy.sh` / `backup.sh`
- `.htaccess`（Apache 场景）
- `DEPLOYMENT.md`（完整部署文档）

## 8. 版本沿革

| 版本 | 主要里程碑 |
| --- | --- |
| v0.1.1 | 管理员登录、用户搜索、管理面板、添加 / 批量导入 / 删除用户、用户详情页 |
| v0.1.2 | 积分预设模板、日志记录查询 |
| v0.2.0 | 快速安装引导、系统设置 |
| v0.2.3 | Excel xlsx 数据导出 |
| v0.3.0 | 完全重构：PHP 迁移到 Nuxt 4 + Vue 3 + TS + Drizzle + SQLite；多租户分裂库；四级权限；实时积分；座位表；统计；公告；PWA |
| v0.3.1 | 管理员邮箱登录 / 验证码登录 / 找回密码；超管用户管理模块；管理员所属可编辑；学生邮箱绑定与找回；入驻校名实时校验；已删除学校 ID 快照；邮件通知系统 |
| v0.3.2 | 外部开放 API v1（22 端点 + 凭证体系 + 三条约束 + 幂等 + 限流 + 审计 + 管理界面）；登录失败限流；启动期会话密钥安全守卫；导航图标统一；侧边栏统计入口；学生信息可编辑；PWA `/sw.js` 路由警告修复 |

> **项目更名**：v0.3.2 起，项目名称由 CSMS（ClassScoreManageSystem）改为 **ClassFire**。更名不涉及功能变更，但代码内标识符随之调整：主库文件名 `csms.db` → `classfire.db`、会话 Cookie 名 `csms-session` → `classfire-session`、API token 明文前缀 `csms_` → `classfire_`、PM2 进程名与 Docker 服务/卷名同步更新。升级注意事项见第 11 节。

## 9. 安全设计基线

| 层面 | 措施 |
| --- | --- |
| 数据隔离 | 一校一库，物理文件级隔离，跨校串号在架构上不可能 |
| 鉴权隔离 | 内部只认 Session，外部只认 token，两条链路互不串门 |
| 凭证存储 | 密码用 BCrypt（随机盐）；API token 用 sha256 加唯一索引；明文仅在签发时可见一次 |
| 会话 | 密封票据（非自签 JWT）；httpOnly + secure + sameSite=lax；有效期 7 天 |
| 启动守卫 | 生产环境会话密钥不安全时返回 503 兜底并退出进程 |
| 爆破防护 | 登录双桶限流（账号 5 次 / 10 分钟锁 15 分钟；IP 40 次 / 10 分钟锁 10 分钟） |
| 越权防护 | 四级范围校验统一语义；读接口范围外返 404 防枚举；统计接口限定范围防侧信道 |
| 注入防护 | Drizzle 参数化查询；`sortBy` 白名单；公告与邮件模板经 XSS 白名单过滤 |
| 误操作防护 | 破坏性操作二次确认；外部 API 危险权限默认不勾选并要求 `confirm=true`；签发与吊销二次验密 |
| 可审计 | 外部 API 全量调用审计保留 30 天（含失败）；`X-Request-Id` 贯穿响应与日志 |
| CSRF | Cookie `sameSite=lax`，跨站 POST 不携带会话 |

## 10. 已知限制

1. 仅支持 SQLite。v0.3.x 不提供 MySQL / PostgreSQL 支持。
2. 限流状态为进程内存。登录限流与 API 限流均存于单进程内存，PM2 cluster 多 worker 时实际阈值约为单 worker 阈值乘以 worker 数，横向扩容需迁移至 Redis 等共享存储。
3. 管理端统计页与仪表盘合一。`admin/index.vue` 即工作台兼统计概览，未拆分独立的统计页面路由。
4. 无版本号单一真源。`package.json` 未设 `version` 字段，版本号分散在 `README.md`、`nuxt.config.ts` 的 meta description 与文档中，存在不一致风险（技术债）。
5. 历史遗留列未清理。`admins.api_token` 与 `third_party_apis` 空表仍在 schema 中，已标注 `@deprecated`。
6. 超级管理员免密登录属高风险能力，目前无独立审计日志，仅限超管可用。
7. 仓库根目录存在临时产物，如 `.output.zip`、若干 `ClassFire_*.tar` 与 `ClassFire_*.md` 验证报告，建议后续整理归档。
8. 两处超管设置页缺少页面级中间件：`/superadmin/settings/system.vue`（邮件服务）与 `/superadmin/settings/templates.vue`（邮件模板）只声明了 `layout: 'superadmin'`，未挂 `middleware: 'super-admin'`，而同组的 `appearance.vue` 与 `superadmin/index.vue` 都挂了。
   - 实际风险有限，数据安全由后端 `requireSuperAdmin()` 兜底，非超管拿不到任何数据；
   - 非超管直接访问这两个 URL 会渲染出页面骨架（随后接口返回 403），属体验与一致性缺陷，不涉及数据泄露；
   - 建议给这两页补上 `middleware: 'super-admin'`，与同组保持一致。
9. 学校管理入口重复：`/admin/schools`（挂 `super-admin` 中间件）与 `/superadmin/schools`（超管导航内）功能重叠，并存原因代码中未注释，疑似历史遗留。建议收敛到 `/superadmin/schools` 单一入口。
10. 删库路径依赖工作目录：`DELETE /api/schools/[id]?deleteData=1` 使用相对路径 `data/schools/{id}.db`，以进程 cwd 为基准。若从非项目根目录启动服务，删除会失败（代码已捕获并降级为告警，不阻断主库记录删除）。建议改为基于项目根的绝对路径。
11. `/api/data/*` 系列存在不可达分支：该系列 7 个端点全部以 `requireSuperAdmin(event)` 开头，非超管直接 403，但紧接着又计算 `const isSuper = admin.role === 'super_admin'` 并分叉出「非超管走本校」的逻辑，该分支对非超管永远不可达，与文件头注释「超管可跨校 / 校管仅本校」不一致。实际效果是更严格（非超管完全无法调用），不构成越权风险，但注释会误导后人。建议二选一：放宽为 `requireAdmin` 让注释成真，或删掉死分支并修正注释。
12. 存在重复的模板列表路由：`server/api/cores/templates.get.ts` 的注释写的是 `GET /api/scores/templates`，但文件实际挂在 `/api/cores/templates`；而 `server/api/scores/templates.get.ts` 同时存在。`cores` 疑为早期拼写错误遗留的重复端点，建议确认无调用方后删除。

## 11. 升级说明

从 v0.3.1 升级到 v0.3.2：

1. 拉取最新代码。
2. 执行 `npm install` 更新依赖，新增 `nodemailer`、`@types/nodemailer` 等。
3. 执行 `npm run db:migrate` 迁移数据库。v0.3.2 新增三张表：
   - 主库：`api_tokens`、`api_audit_logs`
   - 各校分库：`api_idempotency`（注意需要为每个已存在的学校库分别执行迁移）
4. 配置 `NUXT_SESSION_PASSWORD`，需 32 字符以上的随机值。未配置或使用示例值时，生产环境将拒绝启动。
5. 重新构建并启动：`npm run build && node .output/server/index.mjs`。
6. 如无第三方对接需求，外部开放 API 无需任何额外配置，不签发 token 即无人可调用。

本次升级无破坏性变更。现有 Session 会因密钥配置而失效一次，重新登录即可。已有业务数据（学校、年级、班级、学生、积分流水、座位）完整保留。

### 11.1 更名附带的操作

代码内标识符随更名调整，按部署方式需要做对应处理：

1. **数据库文件**：把 `data/csms.db` 及其 `-wal` / `-shm` 三个文件**作为一组**重命名为 `classfire.db*`。三个文件必须同时移动，单独改主文件会丢掉 WAL 中尚未 checkpoint 的写入。
2. **会话 Cookie**：Cookie 名由 `csms-session` 改为 `classfire-session`，所有已登录用户需要重新登录一次。
3. **API token**：前缀由 `csms_` 改为 `classfire_`。**已签发的 token 无需重签**——鉴权按 `sha256(token)` 查库，不校验前缀；仅此后新签发的 token 使用新前缀。管理界面上旧 token 显示的 `token_prefix` 仍是 `csms_…`（展示字段，不影响鉴权）。
4. **PM2**：进程名由 `csms` 改为 `classfire`，需 `pm2 delete csms && pm2 start ecosystem.config.cjs`，日志文件路径同步变为 `logs/classfire-*.log`。
5. **Docker**：服务名与卷名由 `csms*` 改为 `classfire*`。卷名变更后 Docker 不会自动接管旧卷，需先导出旧卷数据再导入新卷，否则表现为数据丢失。
6. **安全守卫黑名单**：`KNOWN_WEAK_SECRETS` 同时保留新旧两套示例值，因此沿用旧示例密钥的部署仍会被判定为不安全。

## 12. 相关文档

| 文档 | 内容 |
| --- | --- |
| [README.md](../README.md) | 项目概览、快速开始、部署指引、常见问题 |
| [docs/APIv1.md](./APIv1.md) | 外部开放 API v1 完整对接文档（鉴权、范围与权限、错误码、幂等、限流、审计、curl / Node 示例、排障清单、版本策略） |
| [docs/api.md](./api.md) | 内部 API 接口文档 |
| [DEPLOYMENT.md](../DEPLOYMENT.md) | 部署运维详解 |
| [docs/安全审计报告-2026-08-30.md](./安全审计报告-2026-08-30.md) | 安全审计结论与修复记录 |
| <https://docs.csms.tianrld.top> | 在线文档站 |

---

本文档对应代码版本 ClassFire v0.3.2。如与实现不一致，以仓库代码为准。
