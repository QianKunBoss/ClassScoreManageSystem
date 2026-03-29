# Global API 接口文档

## 概述

`global_api.php` 是系统的全局API接口，支持对多个数据表进行增删改查操作。

**基础URL**: `/api/global_api.php`

**响应格式**: JSON

## 授权说明

**Token格式**: 由大写字母和数字组成的64位字符串（例如：`ABC123XYZ...`）

**Token传递方式**（任选其一）：
1. 请求头: `Authorization: YOUR_TOKEN`
2. GET参数: `?token=YOUR_TOKEN`
3. POST参数: `token=YOUR_TOKEN`

---

## 支持的数据表

### 免Token访问的表（仅读取操作）

| 表名 | 说明 | 读取操作 | 增删改操作 |
|------|------|---------|-----------|
| `users` | 用户/学生表 | ✅ 免token | 🔐 需要token |
| `score_logs` | 积分记录表 | ✅ 免token | 🔐 需要token |
| `seat_layout_config` | 座位表配置表 | ✅ 免token | 🔐 需要token |
| `seat_data` | 座位数据表 | ✅ 免token | 🔐 需要token |

### 不允许访问的表

以下表不在此API中提供访问，请使用专门的API接口：
- `score_templates` - 积分模板表
- `admins` - 管理员表
- `system_settings` - 系统设置表

---

## 操作权限说明

### 1. 查询操作 (READ) ✅

对以下表的所有查询操作均**不需要token**：
- `users`
- `score_logs`
- `seat_layout_config`
- `seat_data`

### 2. 修改操作 (CREATE/UPDATE/DELETE) 🔐

对以下表的所有修改操作均**需要管理员token**：
- `users`
- `score_logs`
- `seat_layout_config`
- `seat_data`

### 3. 批量加减分 (ADD_SCORE) 🔐

此操作**需要管理员token**，用于批量给用户加分或扣分。

---

## API 接口详情

### 1. 查询记录 (READ)

**请求方式**: GET

**参数**:
- `table`: 表名（必填）
- `id`: 记录ID（可选，查询单条记录）
- `where`: WHERE条件JSON字符串（可选）
- `search`: 搜索关键词（可选，部分表支持）
- `order_by`: 排序字段（可选）
- `order`: 排序方向（可选，ASC/DESC）
- `limit`: 返回记录数限制（可选）
- `offset`: 偏移量（可选，用于分页）

**示例**:

```bash
# 查询所有用户（免token）
GET /api/global_api.php?users

# 查询积分记录（免token）
GET /api/global_api.php?score_logs

# 查询座位表配置（免token）
GET /api/global_api.php?seat_layout_config

# 查询座位数据（免token）
GET /api/global_api.php?seat_data

# 查询单个用户（ID为1）（免token）
GET /api/global_api.php?users&id=1

# 带条件查询用户（免token）
GET /api/global_api.php?users&where={"username":"张三"}

# 带分页查询（免token）
GET /api/global_api.php?users&limit=20&offset=0

# 带排序查询（免token）
GET /api/global_api.php?users&order_by=total_score&order=DESC

# 搜索用户（免token）
GET /api/global_api.php?users&search=张三
```

**响应示例**:

```json
{
  "data": [
    {
      "id": 1,
      "username": "张三",
      "created_at": "2024-01-01 10:00:00",
      "total_score": 100,
      "add_score": 50,
      "deduct_score": -20,
      "score_count": 5,
      "group_index": 0,
      "row_index": 0,
      "col_index": 0
    }
  ],
  "total": 1,
  "limit": 100,
  "offset": 0
}
```

---

### 2. 创建记录 (CREATE) 🔐

**请求方式**: GET

**参数**:
- `action`: 固定值 `create`
- `table`: 表名（必填）
- `data`: 记录数据JSON字符串（必填）

**请求头/参数**:
- `token`: 管理员授权token（必填）

**示例**:

```bash
# 创建新用户（需要token）
GET /api/global_api.php?users&action=create&data={"username":"李四"}&token=YOUR_TOKEN

# 创建积分记录（需要token）
GET /api/global_api.php?score_logs&action=create&data={"user_id":1,"score_change":5,"description":"表现优秀"}&token=YOUR_TOKEN

# 创建座位表配置（需要token）
GET /api/global_api.php?seat_layout_config&action=create&data={"group_count":4,"rows_per_group":5,"cols_per_group":6,"has_aisle":1}&token=YOUR_TOKEN
```

**响应示例**:

```json
{
  "success": true,
  "message": "创建成功",
  "data": {
    "id": 2,
    "username": "李四",
    "created_at": "2024-01-02 10:00:00"
  }
}
```

**错误响应**:

```json
{
  "error": "用户已存在"
}
```

---

### 3. 更新记录 (UPDATE) 🔐

**请求方式**: GET

**参数**:
- `action`: 固定值 `update`
- `table`: 表名（必填）
- `id`: 记录ID（必填）
- `data`: 更新数据JSON字符串（必填）

**请求头/参数**:
- `token`: 管理员授权token（必填）

**示例**:

```bash
# 更新用户信息（需要token）
GET /api/global_api.php?users&action=update&id=1&data={"username":"张三更新"}&token=YOUR_TOKEN

# 更新积分记录描述（需要token）
GET /api/global_api.php?score_logs&action=update&id=1&data={"description":"课堂表现优秀"}&token=YOUR_TOKEN

# 更新座位表配置（需要token）
GET /api/global_api.php?seat_layout_config&action=update&id=1&data={"rows_per_group":6}&token=YOUR_TOKEN
```

**响应示例**:

```json
{
  "success": true,
  "message": "更新成功",
  "data": {
    "id": 1,
    "username": "张三更新",
    "created_at": "2024-01-01 10:00:00"
  }
}
```

---

### 4. 删除记录 (DELETE) 🔐

**请求方式**: GET

**参数**:
- `action`: 固定值 `delete`
- `table`: 表名（必填）
- `id`: 记录ID（可选）
- `where`: WHERE条件JSON字符串（可选）

**注意**: `id` 和 `where` 至少提供一个

**请求头/参数**:
- `token`: 管理员授权token（必填）

**示例**:

```bash
# 通过ID删除用户（需要token）
GET /api/global_api.php?users&action=delete&id=1&token=YOUR_TOKEN

# 通过条件删除用户（需要token）
GET /api/global_api.php?users&action=delete&where={"username":"张三"}&token=YOUR_TOKEN

# 删除积分记录（需要token）
GET /api/global_api.php?score_logs&action=delete&id=1&token=YOUR_TOKEN

# 删除座位数据（需要token）
GET /api/global_api.php?seat_data&action=delete&where={"group_index":0,"row_index":0}&token=YOUR_TOKEN
```

**响应示例**:

```json
{
  "success": true,
  "message": "删除成功",
  "deleted_count": 1,
  "deleted_ids": [1]
}
```

---

### 5. 批量加减分 (ADD_SCORE) 🔐

**请求方式**: GET

**参数**:
- `action`: 固定值 `add_score`
- `data`: 积分数据JSON字符串（必填）

**数据格式**:

**单个用户**:
```json
{
  "username": "张三",
  "score_change": 5,
  "description": "课堂表现优秀"
}
```

**批量用户**:
```json
{
  "users": [
    {"username": "张三", "score_change": 5},
    {"username": "李四", "score_change": 3}
  ],
  "description": "表现优秀"
}
```

**请求头/参数**:
- `token`: 管理员授权token（必填）

**示例**:

```bash
# 单个用户加分（需要token）
GET /api/global_api.php?action=add_score&data={"username":"张三","score_change":5,"description":"表现优秀"}&token=YOUR_TOKEN

# 批量用户加分（需要token）
GET /api/global_api.php?action=add_score&data={"users":[{"username":"张三","score_change":5},{"username":"李四","score_change":3}],"description":"表现优秀"}&token=YOUR_TOKEN
```

**响应示例**:

```json
{
  "success": true,
  "message": "操作完成：成功 2 条，失败 0 条",
  "summary": {
    "success_count": 2,
    "failed_count": 0,
    "total_count": 2
  },
  "details": [
    {
      "username": "张三",
      "user_id": 1,
      "score_change": 5,
      "success": true
    },
    {
      "username": "李四",
      "user_id": 2,
      "score_change": 3,
      "success": true
    }
  ]
}
```

---

## 特殊说明

### users 表特殊字段

查询 `users` 表时会自动计算以下聚合字段：

| 字段 | 说明 |
|------|------|
| `total_score` | 总积分 |
| `add_score` | 加分总计 |
| `deduct_score` | 扣分总计 |
| `score_count` | 积分记录数量 |
| `group_index` | 所属组索引 |
| `row_index` | 行索引 |
| `col_index` | 列索引 |

### 只读字段

以下字段为只读字段，创建或更新时无法修改：

- `users`: `id`, `created_at`
- `score_logs`: `id`, `created_at`
- `seat_layout_config`: `id`, `created_at`, `updated_at`
- `seat_data`: `id`, `created_at`, `updated_at`

### 搜索字段

支持搜索的表和字段：

| 表名 | 可搜索字段 |
|------|-----------|
| `users` | `username` |
| `score_logs` | `description` |

---

## 错误响应格式

所有错误响应遵循以下格式：

```json
{
  "error": "错误描述信息"
}
```

**常见错误码**:

| HTTP状态码 | 说明 |
|-----------|------|
| 200 | 请求成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未授权（缺少或无效的token） |
| 403 | 禁止访问（表不被允许访问） |
| 404 | 资源不存在 |
| 409 | 资源冲突（如用户已存在） |
| 500 | 服务器内部错误 |

---

## 使用示例（cURL）

```bash
# 查询所有用户（免token）
curl "http://localhost/api/global_api.php?users"

# 查询积分记录（免token）
curl "http://localhost/api/global_api.php?score_logs"

# 创建新用户（需要token）
curl "http://localhost/api/global_api.php?users&action=create&data={\"username\":\"王五\"}" \
  -H "Authorization: YOUR_TOKEN"

# 更新用户信息（需要token）
curl "http://localhost/api/global_api.php?users&action=update&id=1&data={\"username\":\"张三更新\"}" \
  -H "Authorization: YOUR_TOKEN"

# 删除用户（需要token）
curl "http://localhost/api/global_api.php?users&action=delete&id=1" \
  -H "Authorization: YOUR_TOKEN"

# 批量加分（需要token）
curl "http://localhost/api/global_api.php?action=add_score&data={\"username\":\"张三\",\"score_change\":5,\"description\":\"表现优秀\"}" \
  -H "Authorization: YOUR_TOKEN"
```

---

## 注意事项

1. **Token安全**: 请妥善保管管理员token，不要在客户端代码中硬编码
2. **数据验证**: 建议在调用API前对数据进行客户端验证
3. **批量操作**: 使用批量加减分功能时，建议单次操作不超过100条记录
4. **分页查询**: 列表查询默认限制100条，使用`limit`参数调整
5. **字符编码**: 所有请求和响应使用UTF-8编码
6. **表访问限制**: 此API仅允许访问 `users`、`score_logs`、`seat_layout_config`、`seat_data` 四个表
7. **权限控制**: 读取操作免token，修改操作需要管理员token
8. **错误处理**: 访问不允许的表会返回403错误