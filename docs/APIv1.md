# CSMS 外部开放 API 文档（v1）

> 适用版本：**CSMS v0.3.2** 起
> 基础路径：`/api/v1/**`
> 配套文档：内部管理员 API 见 [api.md](./api.md)；本文件只描述对外第三方对接的开放接口。

---

## 1. 概述与设计三铁律

外部开放 API 用于让**第三方系统**（如校园一卡通、教务平台、自动排座脚本）在授权范围内对学校/年级/班级的业务数据进行读写，而**不接触系统级数据**（账号体系、学校入驻、公告、邮件服务等）。

三条不可突破的约束（已在架构层强制，而非靠逐个接口维护）：

1. **系统数据不可被操作**：外部端点物理隔离在 `/api/v1/**`，与内部 `/api/**` 互不串门；内部接口只认 Session，外部接口只认 `api_token`。任何第三方都无法通过开放 API 触碰管理员账号、学校、公告、邮件配置等。
2. **写操作仅限校级及以下**：所有增删改（创建/修改/删除学生、加减分、增删年级班级模板等）只能作用于业务数据，且被严格限制在凭证自身的数据范围内（见 §4「作用范围」）。
3. **所有请求必须携带 `api_token`**：缺失或校验失败一律拒绝（HTTP 401/403），永不降级放行。

---

## 2. 基础约定

### 2.1 Base URL

```
<站点域名>/api/v1
```

例如本站部署在 `https://csms.example.com`，则 ping 端点为 `https://csms.example.com/api/v1/ping`。

### 2.2 统一响应信封

**所有** v1 响应（成功与失败）均为同一结构，便于第三方用统一代码处理：

```jsonc
{
  "code": 0,                 // 业务码：0 表示成功，非 0 见 §5 错误码表
  "message": "ok",           // 人类可读信息
  "data": { },               // 业务数据；失败时恒为 null
  "requestId": "uuid-v4"     // 每次请求唯一，与审计日志对应，报障时凭此定位
}
```

- 成功：`code === 0`，HTTP 状态码一般为 `200`。
- 失败：`code !== 0`，HTTP 状态码为 `4xx` / `5xx`，`data` 为 `null`。**注意**：失败响应也带 `requestId` 并且会被记入审计日志（失败恰恰是最需要留痕的部分）。

成功示例：

```json
{ "code": 0, "message": "ok", "data": { "ok": true }, "requestId": "9f1c...e3" }
```

失败示例（token 缺失）：

```json
{
  "code": 40101,
  "message": "缺少 api_token，请通过 Authorization: Bearer <token> 或 X-API-Token 头传入",
  "data": null,
  "requestId": "2b7a...01"
}
```

### 2.3 分页约定

所有列表接口支持 `page`（默认 1）与 `limit`（默认 20，上限 100）查询参数。响应 `data` 统一为：

```jsonc
{
  "list": [ /* 当前页条目 */ ],
  "total": 123,   // 符合条件的总条数（不受分页影响）
  "page": 1,
  "limit": 20
}
```

### 2.4 排序白名单

列表接口的 `sortBy` 只能取文档注明的枚举值，直接拼进 `ORDER BY` 前会经白名单校验，未命中则回退默认值——**不接受任意字段**，杜绝 SQL 注入。

### 2.5 时间字段与日期筛选

- 所有时间戳为 **UTC ISO 8601** 字符串（如 `2026-08-30T15:04:05.123Z`）。
- 日期筛选参数（`startDate` / `endDate`）支持两种格式：
  - `YYYY-MM-DD`：自动补全为当日 `00:00:00.000Z` / `23:59:59.999Z`（**按 UTC 计**）。
  - 完整 ISO 串：原样透传。
  - 其他格式视为非法，返回 400。

---

## 3. 认证

### 3.1 携带 token

每次请求需在 Header 中携带凭证明文，**二选一**：

```
Authorization: Bearer csms_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

或

```
X-API-Token: csms_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> token 明文形如 `csms_` + 高熵随机串（共约 45 字符）。后端仅以 `sha256(token)` 哈希入库（唯一索引，常数时间命中），明文只在校验时由调用方提供，库内不存储明文、无法还原。

### 3.2 校验顺序与拒绝情形

中间件在请求到达业务端点前完成以下检查，**任一步不通过即短路返回**，且不消耗目标 token 的限流配额：

1. 缺 `api_token` → `40101 TOKEN_MISSING`
2. token 无效（哈希未命中）→ `40102 TOKEN_INVALID`
3. token 已被禁用 → `40103 TOKEN_DISABLED`
4. token 已过期（`expiresAt` 早于当前）→ `40104 TOKEN_EXPIRED`
5. 关联学校不存在或已停用 → `40301 SCHOOL_DISABLED`
6. 签发者（管理员）被禁用 → `40105 TOKEN_ISSUER_DISABLED`

### 3.3 凭证签发（管理侧）

凭证由**管理员在管理后台签发**，不支持自助注册：

- **入口页面**：`/admin/api-tokens`（「API 凭证」导航，归属校级功能）。
- **谁可以签发**：任意管理员均可，但签发范围强制不超过签发者自身管辖（班级管理员只能签本班、年级管理员只能签本年级/本年级班级、学校管理员签本校、超级管理员任意）。这是「各级都可签发」得以成立的安全前提。
- **二次验密**：签发/吊销需重新输入登录密码（`x-confirm-password` 头 / 模态框），防止会话被盗后滥发凭证。
- **明文一次性展示**：签发成功后明文 token 仅在界面展示一次，关闭后不可再查——请立即复制保存。
- 也可经内部接口批量管理，见 §10。

---

## 4. 作用范围（Scope）与权限（Scopes）

### 4.1 三种范围类型

| type | 含义 | 可见数据 |
|------|------|----------|
| `school` | 全校 | 该校全部年级/班级/学生/积分 |
| `grade` | 单个年级 | 该年级下全部班级及其学生（**含签发后新建的班级**） |
| `class` | 单个班级 | 仅该班 |

范围在签发时确定，**不可经 API 变更**（编辑只能改名称/权限/有效期）。范围目标是签发时即校验真实存在的，杜绝指向「未来可能出现的 ID」的幽灵凭证。

### 4.2 十二项权限（scopes）

权限以字符串数组 `scopes` 标识，调用方需具备目标端点的权限，否则 `40302 SCOPE_DENIED`。

| 权限 | 可访问端点 | 说明 |
|------|-----------|------|
| `students:read` | 学生列表/详情 | 只读 |
| `students:write` | 创建/更新学生 | 不含改密码与改邮箱 |
| `students:delete` | 删除学生 | 🔴 危险 |
| `scores:read` | 积分流水查询、统计概览 | 只读 |
| `scores:write` | 加减分 | 批量/模板 |
| `scores:revoke` | 撤销积分记录 | 对称回滚四列 |
| `structure:read` | 年级/班级列表 | 只读 |
| `structure:write` | 年级/班级增改、模板增改 | 部分受范围限制 |
| `structure:delete` | 删除年级/班级 | 🔴 危险，级联删除 |
| `templates:read` | 积分模板列表 | 只读 |
| `templates:write` | 模板增改删 | — |
| `stats:read` | 统计概览 | 只读 |

> 🔴 **危险权限**（`students:delete`、`structure:delete`）在管理界面默认不勾选并标红警示。删除年级会经外键级联删除该年级下全部班级、学生、积分流水与座位数据——是整个开放 API 里破坏力最大的操作，叠加「仅校级凭证可调用 + 强制 `confirm=true`」双重门槛。

### 4.3 范围与权限的关系

- **范围**决定「能看哪些数据」（横向边界）。
- **权限**决定「能对这些数据做什么动作」（纵向边界）。
- 两者 AND 串联：即使有权限，也只能操作范围内数据。例如 `class` 范围 + `scores:write` 的凭证，加减分只作用于本班学生；传入范围外的 `userId` 会返回 `40303 OUT_OF_RANGE`。
- **统计接口同样是侧信道防线**：班级凭证看到的「总人数」是本班人数而非全校，否则统计接口会成为绕过范围的越权通道。

### 4.4 读接口 404 vs 写接口 403

- 读接口（如学生详情、流水）对**范围外**目标返回 `40401 NOT_FOUND`（而非 403）。原因：403 会泄露「该 ID 存在但不属于你」，足以让班级级凭证遍历出全校规模。
- 写接口（如更新/删除学生）对范围外目标返回 `40303 OUT_OF_RANGE`（「无权限操作该学生」），因为调用方已明确指名目标，明确的错误更利于排障，且无枚举风险。

---

## 5. 错误码表

业务码 `code` = HTTP 状态码 × 100 + 序号。`message` 为可读信息，可展示给用户或写入日志。

| code | HTTP | 含义 | 常见触发 |
|------|------|------|----------|
| `0` | 200 | 成功 | — |
| `40001` | 400 | 请求体/参数整体非法 | 非法 JSON、缺必需字段 |
| `40002` | 400 | 参数值非法 | 负数 ID、超长字符串、非法枚举 |
| `40003` | 400 | 缺少必需参数 | 未传 `classId`、空 `batch` |
| `40004` | 400 | 需要显式确认 | 删除未带 `confirm=true` |
| `40101` | 401 | 缺少 api_token | 请求头未带 token |
| `40102` | 401 | token 无效 | 哈希未命中 |
| `40103` | 401 | token 已禁用 | 被管理员禁用 |
| `40104` | 401 | token 已过期 | 超过 `expiresAt` |
| `40105` | 401 | 签发者已被禁用 | 派生凭证随之失效 |
| `40301` | 403 | 关联学校不存在/停用 | 学校被删或停用 |
| `40302` | 403 | 权限不足 | 缺对应 scope |
| `40303` | 403 | 超出数据范围 | 操作范围外班级/学生 |
| `40401` | 404 | 资源不存在（或范围外） | 学生/模板/年级 ID 不存在或不可见 |
| `40901` | 409 | 冲突 | 用户名已存在、幂等键处理中/已占用 |
| `42901` | 429 | 限流 | 超过速率上限（见 §6） |
| `50001` | 500 | 服务器内部错误 | 未预期异常（会留栈） |

---

## 6. 限流（Rate Limit）

按 **token 维度、进程内存**双桶限流（在鉴权通过后执行）：

| 桶 | 上限 | 适用 |
|----|------|------|
| 全量 | **600 次 / 分钟**（约 10 QPS） | 所有请求 |
| 写操作 | **120 次 / 分钟** | `POST` / `PATCH` / `DELETE` |

- 超限返回 `42901`，并带响应头 `Retry-After`（秒）与 `X-RateLimit-Limit`。
- 已知短板：状态在单进程内存，PM2 cluster 多 worker 时实际阈值 ≈ 单 worker 阈值 × worker 数。横向扩容时需迁移到共享存储（与登录限流同样的取舍）。

---

## 7. 幂等（Idempotency-Key）

写操作（创建学生、加减分、撤销记录）强烈建议携带：

```
Idempotency-Key: <自定义唯一串，最长 128 字符>
```

- 同一 `token + 同一 key` 重复提交：直接回放首次响应体（HTTP 仍为 2xx），**不再执行业务逻辑**，避免网络重试导致重复加分/重复建号。
- 不带该头则退化为普通请求（不做保护），保持简单场景易用。
- 并发重复：另一请求抢先占据该 key 且仍在处理时，返回 `40901` 并提示「稍后重试」；key 已用于其他端点则提示「不可复用」。
- 成功响应会带响应头 `Idempotency-Replayed: true`（回放时）。
- 失败（业务异常）不锁定 key，调用方可换 key 或用同一 key 正常重试。

> 适用端点：`POST /students`、`POST /scores`、`DELETE /scores/:logId`。

---

## 8. 调用审计

每次 v1 调用（含鉴权失败、限流拒绝）都会写入审计日志 `api_audit_logs`，保留 **30 天**（约每 500 次调用触发一次清理）。记录字段：

| 字段 | 说明 |
|------|------|
| `requestId` | 与响应体的 `requestId` 一致 |
| `tokenId` / `tokenPrefix` | 凭证 ID 与前缀（`csms_xxx…`） |
| `schoolId` | 所属学校 |
| `method` / `path` | 请求方法与路径 |
| `statusCode` / `latencyMs` | 响应码与耗时 |
| `ip` / `userAgent` | 来源 IP 与 UA |
| `errorMessage` | 失败原因（成功为 null） |
| `createdAt` | 调用时间（UTC） |

- 每次响应附带响应头 `X-Request-Id`（= `requestId`）。
- 仅鉴权通过的调用才累加 token 的 `callCount` / `lastUsedAt` / `lastUsedIp`（被拒请求不计入使用量）。
- 审计写失败**不影响业务**（旁路能力，吞异常只打日志）。
- 查看/筛选日志：管理后台「API 凭证 → 调用日志」标签页，或内部接口 §10。

---

## 9. 端点清单（外部开放，共 22 个）

> 标注 🔒 的为写操作（受 120/min 写限流 + 建议幂等）；🔴 为危险/破坏性。
> 所有 `:id` / `:logId` 为路径参数；`query` 为 URL 查询参数；`body` 为 JSON 请求体。

### 9.1 连通性自检

#### `GET /ping` — 无需 scope
无需任何 scope（只要 token 有效）。返回 token 自身元信息，便于对接方自助排查「我的凭证绑在哪校、有什么权限」。

响应 `data`：
```jsonc
{
  "ok": true,
  "serverTime": "2026-08-30T15:04:05.123Z",
  "school": { "id": 7, "name": "示例学校" },
  "token": {
    "name": "一卡通对接", "prefix": "csms_Ab12cd34",
    "scopeType": "class", "scopeGradeId": null, "scopeClassId": 42,
    "scopes": ["students:read","scores:read","scores:write"],
    "expiresAt": null, "callCount": 128, "createdAt": "2026-08-01T..."
  }
}
```

### 9.2 学生 students

#### `GET /students` — `students:read`
分页列表。query：`page` `limit` `sortBy`(id|username|actualName|totalScore|scoreCount|createdAt) `order`(asc|desc) `classId` `gradeId` `keyword` `disabled`(true|false)。

`data.list[]` 字段：`id, username, actualName, classId, className, gradeId, gradeName, disabled, totalScore, addScore, deductScore, scoreCount, createdAt`。
> 积分字段由 `score_logs` 实时聚合（非读取旧列），与管理端口径一致。

#### `GET /students/:id` — `students:read`
学生详情（含最近 10 条积分流水 `recentScores`）。范围外返回 `404`。
`data` 字段：`id, username, actualName, classId, className, gradeId, gradeName, disabled, emailBound`(是否绑邮箱，不返回邮箱明文), `emailBoundAt, totalScore, addScore, deductScore, scoreCount, createdAt, recentScores[]`。

#### 🔒 `POST /students` — `students:write`
创建学生。支持单条与批量：
- 单条 body：`{ classId?, username, password?, actualName? }`
- 批量 body：`{ classId?, defaultPassword?, batch: [{ username, actualName?, classId? }] }`

规则：
- `class` 范围凭证可省略 `classId`（默认落到本班）；其余范围必须提供且必须在范围内（`40303`）。
- 未提供 `password` 时服务端生成随机密码（≥6 位），**仅在响应里返回一次**（`initialPassword`）；指定密码则不回显。
- 批量上限 `200`，响应 `data`：`{ successCount, failedCount, totalCount, details[] }`（逐条结果，含失败原因；不在事务里整体回滚，便于部分成功场景）。
- 单条响应 `data`：`{ id, username, actualName, classId, disabled, createdAt, initialPassword? }`。

#### 🔒 `PATCH /students/:id` — `students:write`
更新学生。body 可选：`username` / `actualName` / `disabled`(bool) / `classId`（转班）。
- **刻意不开放** `password` 与 `email`：二者属账号身份/隐私，不在「班级积分业务数据」开放边界内。
- 转班要求源与目标班级都在范围内（`40303`）。
- 响应 `data`：`{ id, username, actualName, classId, disabled, createdAt }`。

#### 🔒🔴 `DELETE /students/:id?confirm=true` — `students:delete`
删除学生（级联删除其积分流水与座位）。**必须** `confirm=true`，否则 `40004`。范围外 `40303`。
响应 `data`：`{ id, username, classId }`。

### 9.3 积分 scores

#### `GET /scores` — `scores:read`
积分流水分页。query：`page` `limit` `sortBy`(id|createdAt|scoreChange) `order` `userId` `username` `classId` `gradeId` `type`(add|deduct) `startDate` `endDate`。
`data.list[]`：`id, userId, username, actualName, classId, className, gradeId, gradeName, scoreChange, description, createdAt`。

#### 🔒 `POST /scores` — `scores:write`
加减分（建议带 `Idempotency-Key`）。三种写法二选一：
- 单条：`{ userId | username, scoreChange, description? }`
- 批量：`{ items: [{ userId|username, scoreChange?, description? }], scoreChange?, description? }`
- 模板：`{ templateId, items: [...] }`（模板提供 `scoreChange`/`description` 默认值；绑定班级的模板须在范围内）

规则：
- 单次最多 `200` 条；分值须为 `±10000` 内整数（超出 `40002`）。
- 走与内部 `/api/scores/add` 共用的 `score-service`，保证四列（total/add/deduct/count）口径一致。
- 逐条校验范围与合法性，失败条目写入 `details` 不中断整批。
- 响应 `data`：`{ successCount, failedCount, totalCount, details[] }`，`details[].logId` 为本次写入的流水自增 ID（用于后续撤销）。

#### 🔒 `DELETE /scores/:logId` — `scores:revoke`
撤销一条积分记录（对称回滚 users 的四列，与内部撤销共用逻辑）。建议带 `Idempotency-Key`（key 绑定具体 `logId`）。
响应 `data`：`{ logId, userId, username, revokedScoreChange }`。

### 9.4 年级 grades

#### `GET /grades` — `structure:read`
年级列表（范围内）。`data.list[]`：`id, name, schoolId, createdAt`（按 schema.school 实际字段）。

#### 🔒 `POST /grades` — `structure:write`
**仅 `school` 范围**凭证可创建年级。body：`{ name }`。班级级/年级级凭证调用返回 `40303`。

#### 🔒 `PATCH /grades/:id` — `structure:write`
更新年级（如改名）。`grade` 范围凭证只能改自己所属年级；越权 `40303`。body：`{ name }`。

#### 🔒🔴 `DELETE /grades/:id?confirm=true` — `structure:delete`
**仅 `school` 范围**凭证，且必须 `confirm=true`。级联删除该年级下全部班级、学生、积分流水、座位。响应 `data` 回传影响规模：
```jsonc
{ "id": 3, "name": "高一", "cascadeDeleted": { "classes": 6, "students": 240 } }
```

### 9.5 班级 classes

#### `GET /classes` — `structure:read`
班级列表（范围内），含 `gradeName`。

#### 🔒 `POST /classes` — `structure:write`
创建班级。body：`{ name, gradeId }`。**`class` 范围凭证拒绝**（`40303`，班级管理员不能新建班级）。

#### 🔒 `PATCH /classes/:id` — `structure:write`
更新班级（如改名、调所属年级）。越权 `40303`。

#### 🔒🔴 `DELETE /classes/:id?confirm=true` — `structure:delete`
删除班级（级联学生等）。**`class` 范围凭证拒绝**（`40303`），其余须 `confirm=true`。

### 9.6 积分模板 templates

#### `GET /templates` — `templates:read`
模板列表。`data.list[]`：`id, classId`(null=全校通用), `global, name, scoreChange, description, createdAt, updatedAt`。

#### 🔒 `POST /templates` — `templates:write`
创建模板。body：`{ name, scoreChange(±10000 内非零整数), description?, classId? }`。
- `classId` 省略 = 全校通用模板，**仅 `school` 范围**凭证可建（否则 `40303`）；指定 `classId` 须在范围内。
- 同归属下重名返回 `40901`。
- 响应 `data`：`{ id, classId, global, name, scoreChange, description, createdAt, updatedAt }`。

#### 🔒 `PATCH /templates/:id` — `templates:write`
更新模板（`name/scoreChange/description`）。**不可改 `classId`**（归属是身份，需删旧建新）。

#### 🔒 `DELETE /templates/:id` — `templates:write`
删除模板。**不需 `confirm`**（模板无级联破坏）。

### 9.7 统计 stats

#### `GET /stats/overview` — `stats:read`
范围内统计概览。query：`startDate?` `endDate?`（仅影响积分聚合与排行，不影响人数结构统计）。
响应 `data`：
```jsonc
{
  "scope": { "type": "class", "gradeId": null, "classId": 42 },
  "range": { "startDate": null, "endDate": null },
  "structure": { "gradeCount": 0, "classCount": 1, "studentCount": 48, "disabledStudentCount": 2 },
  "scores": { "totalScore": 1234, "addScore": 2000, "deductScore": 766, "recordCount": 312, "todayRecordCount": 5 },
  "topStudents": [ { "rank": 1, "id": 9, "username": "...", "actualName": "...", "classId": 42, "className": "...", "totalScore": 320, "scoreCount": 40 } ]
}
```
> 数字严格限定在 token 范围内（班级凭证看到的 `studentCount` 是本班人数）。

---

## 10. 凭证管理内部接口（`/api/api-tokens`）

供管理后台与运维使用，**需管理员 Session 登录**，不在开放 API 前缀内（不受 token 鉴权，受 Session 鉴权 + 范围可见性约束）。

| 方法 & 路径 | 说明 |
|-------------|------|
| `GET /api/api-tokens` | 凭证列表（**不含 token 明文**），含状态/范围/权限/调用统计 |
| `POST /api/api-tokens` | 签发凭证（**响应一次性返回 `token` 明文**），body 含 `name, scopeType, scopeGradeId?, scopeClassId?, scopes[], expiresInDays?` |
| `GET /api/api-tokens/meta` | 签发前置元数据：`scopeTypes`、`scope` 清单（12 项 + 危险标记）、`fixedGradeId`/`fixedClassId`（按当前管理员可见范围锁定）、`maxExpireDays` |
| `PATCH /api/api-tokens/:id` | 编辑：改名 / 改权限 / 改有效期；**`scopeType` 不可改**（范围为身份） |
| `GET /api/api-tokens/logs` | 审计日志列表，支持按 `tokenId`/`method`/`statusCode`/`onlyFailed` 筛选与分页 |
| `DELETE /api/api-tokens/:id` | 吊销凭证，需 `x-confirm-password` 头（二次验密）；吊销后该 token 立即 `40103` |

> 日志与凭证生命周期解耦：删除（吊销）凭证后，其历史审计日志仍保留，便于事后追溯。

---

## 11. 快速开始（curl 示例）

```bash
BASE="https://csms.example.com/api/v1"
TOKEN="csms_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# 1) 自检：我的凭证绑在哪校、有什么权限
curl -H "Authorization: Bearer $TOKEN" "$BASE/ping"

# 2) 给本班学生小明加 5 分（带幂等键防止重试重复加分）
curl -X POST "$BASE/scores" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{ "username": "xiaoming", "scoreChange": 5, "description": "晨读积极" }'

# 3) 查询本班学生列表
curl -H "Authorization: Bearer $TOKEN" "$BASE/students?page=1&limit=20&sortBy=totalScore"

# 4) 撤销一条积分（用上面返回的 logId）
curl -X DELETE "$BASE/scores/12345" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: revoke-12345"

# 5) 范围内统计概览
curl -H "Authorization: Bearer $TOKEN" "$BASE/stats/overview"
```

Node.js（fetch）示例：

```js
const BASE = 'https://csms.example.com/api/v1'
const TOKEN = process.env.CSMS_TOKEN

async function addScore(username, scoreChange, description) {
  const res = await fetch(`${BASE}/scores`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `${username}-${Date.now()}`,
    },
    body: JSON.stringify({ username, scoreChange, description }),
  })
  const json = await res.json()
  if (json.code !== 0) throw new Error(`API ${json.code}: ${json.message} (req ${json.requestId})`)
  return json.data
}
```

---

## 12. 排障清单

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| `40101` 缺少 token | 未带 `Authorization` / `X-API-Token` | 检查请求头拼写与 Bearer 前缀 |
| `40102` token 无效 | 明文复制不全/含多余空格 | 重新从管理后台复制完整 `csms_...` 串 |
| `40103` / `40104` | 凭证被禁用或过期 | 管理后台查看状态/有效期，必要时重发 |
| `40105` | 签发者（管理员）被禁用 | 联系上级管理员恢复签发者账号 |
| `40302` 权限不足 | 凭证 `scopes` 不含目标权限 | 管理后台扩充权限或换凭证 |
| `40303` 超出范围 | 操作了范围外的班级/学生 | 检查 `scopeType` 与传参的 classId/userId 归属 |
| `40401`（读接口） | 资源不存在 **或** 在范围外 | 读接口对范围外统一返回 404（防枚举） |
| `40901` | 用户名冲突 / 幂等键占用 | 换 username；幂等键被占用时等待或换 key |
| `42901` | 触发限流 | 读取 `Retry-After` 秒后重试，降低调用频率 |
| 响应 `data.null` | 任何失败 | 看 `code` + `message`，凭 `requestId` 查审计日志 |

---

## 13. 兼容性与版本策略

- 当前版本前缀 `/api/v1`。未来破坏性变更将升到 `/api/v2`，旧版本在公告期后保留一段时间。
- 响应信封结构（`code/message/data/requestId`）、错误码表、认证头为长期稳定契约。
- 新增端点须在 `server/utils/api-token.ts` 的 `API_SCOPES` 与本文档同步登记。
- 限流阈值、幂等键长度等策略参数可能随运维需要调整，以响应头实际情况为准。

---

*文档生成对应代码版本：CSMS v0.3.2。如与代码不符，以 `server/utils/api-*.ts`、`server/api/v1/**` 及 `server/api/api-tokens/**` 的实际实现为准。*
