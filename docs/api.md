# CSMS API 接口文档

## 概述

CSMS v0.3.0 基于 Nuxt 4 框架重构，采用 RESTful API 设计。所有 API 接口均以 `/api` 为前缀。

**基础URL**: `/api`

**响应格式**: JSON

---

## 认证方式

### Session 认证

系统使用基于 Session 的认证机制：

1. **登录**: `POST /api/auth/login` 返回 Session Cookie
2. **后续请求**: 浏览器自动携带 Cookie，无需额外处理
3. **登出**: `POST /api/auth/logout`

### Token 认证（学生端）

学生端 API 使用 Token 认证：

- 请求头: `Authorization: Bearer <token>`

---

## 统一响应格式

```json
// 成功响应
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}

// 错误响应
{
  "success": false,
  "message": "错误信息"
}
```

---

## 管理员认证 API

### 登录

```
POST /api/auth/login
```

**请求体**:
```json
{
  "username": "admin",
  "password": "password"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "admin",
    "role": "super_admin",
    "schoolId": null
  }
}
```

### 登出

```
POST /api/auth/logout
```

**响应**:
```json
{
  "success": true,
  "message": "已登出"
}
```

### 获取当前用户

```
GET /api/auth/me
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "admin",
    "role": "super_admin"
  }
}
```

### 修改密码

```
PATCH /api/auth/me
```

**请求体**:
```json
{
  "oldPassword": "old123",
  "newPassword": "new123"
}
```

---

## 学生端认证 API

### 学生登录

```
POST /api/auth/student/login
```

**请求体**:
```json
{
  "username": "student1",
  "password": "password"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "student1",
    "actualName": "张三",
    "classId": 1,
    "token": "student_token_here"
  }
}
```

### 学生登出

```
POST /api/auth/student/logout
```

### 获取学生信息

```
GET /api/auth/student/me
Authorization: Bearer <token>
```

### 修改学生信息

```
PATCH /api/auth/student/me
Authorization: Bearer <token>
```

**请求体**:
```json
{
  "oldPassword": "old123",
  "newPassword": "new123"
}
```

---

## 学校管理 API

### 获取学校列表

```
GET /api/schools
```

**响应**:
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "第一中学", "disabled": 0 }
  ]
}
```

### 获取单个学校

```
GET /api/schools/:id
```

### 创建学校

```
POST /api/schools
```

**请求体**:
```json
{
  "name": "第二中学"
}
```

### 更新学校

```
PATCH /api/schools/:id
```

**请求体**:
```json
{
  "name": "第二中学（新）",
  "disabled": 1
}
```

### 删除学校

```
DELETE /api/schools/:id
```

---

## 年级管理 API

### 获取年级列表

```
GET /api/grades
```

**查询参数**:
- `schoolDb` (必填): 学校数据库标识

**响应**:
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "高一", "createdAt": "2024-01-01T00:00:00.000Z" }
  ]
}
```

### 创建年级

```
POST /api/grades
```

**请求体**:
```json
{
  "schoolDb": "school_1",
  "name": "高二"
}
```

### 删除年级

```
DELETE /api/grades/:id
```

**查询参数**:
- `schoolDb` (必填): 学校数据库标识

---

## 班级管理 API

### 获取班级列表

```
GET /api/classes
```

**查询参数**:
- `schoolDb` (必填): 学校数据库标识
- `gradeId` (可选): 按年级筛选

### 创建班级

```
POST /api/classes
```

**请求体**:
```json
{
  "schoolDb": "school_1",
  "gradeId": 1,
  "name": "一班"
}
```

### 删除班级

```
DELETE /api/classes/:id
```

**查询参数**:
- `schoolDb` (必填): 学校数据库标识

---

## 用户/学生管理 API

### 获取学生列表

```
GET /api/users
```

**查询参数**:
- `schoolDb` (必填): 学校数据库标识
- `classId` (可选): 按班级筛选
- `search` (可选): 搜索用户名或真实姓名

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "username": "stu001",
      "actualName": "张三",
      "totalScore": 100,
      "addScore": 120,
      "deductScore": -20,
      "scoreCount": 15,
      "classId": 1
    }
  ]
}
```

### 获取单个学生

```
GET /api/users/:id
```

**查询参数**:
- `schoolDb` (必填): 学校数据库标识

### 创建学生

```
POST /api/users
```

**请求体**:
```json
{
  "schoolDb": "school_1",
  "username": "stu002",
  "password": "password",
  "actualName": "李四",
  "classId": 1
}
```

### 批量创建学生

```
POST /api/users
```

**请求体**:
```json
{
  "schoolDb": "school_1",
  "students": [
    { "username": "stu003", "actualName": "王五" },
    { "username": "stu004", "actualName": "赵六" }
  ],
  "classId": 1
}
```

### 更新学生

```
PATCH /api/users/:id
```

**请求体**:
```json
{
  "schoolDb": "school_1",
  "actualName": "李四（新）"
}
```

### 删除学生

```
DELETE /api/users/:id
```

**查询参数**:
- `schoolDb` (必填): 学校数据库标识

---

## 积分管理 API

### 添加积分记录

```
POST /api/scores/add
```

**请求体**:
```json
{
  "schoolDb": "school_1",
  "userId": 1,
  "scoreChange": 5,
  "description": "课堂表现优秀"
}
```

### 获取积分日志

```
GET /api/scores/logs
```

**查询参数**:
- `schoolDb` (必填): 学校数据库标识
- `userId` (可选): 按学生筛选
- `limit` (可选): 限制数量

### 获取积分模板

```
GET /api/scores/templates
```

**查询参数**:
- `schoolDb` (必填): 学校数据库标识

### 创建积分模板

```
POST /api/scores/templates
```

**请求体**:
```json
{
  "schoolDb": "school_1",
  "name": "迟到扣分",
  "scoreChange": -2,
  "description": "上课迟到一次"
}
```

---

## 座位表 API

### 获取座位数据

```
GET /api/seats/data
```

**查询参数**:
- `schoolDb` (必填): 学校数据库标识
- `classId` (可选): 班级 ID

### 生成座位布局

```
POST /api/seats/data/generate
```

**请求体**:
```json
{
  "schoolDb": "school_1",
  "classId": 1,
  "groupCount": 4,
  "rowsPerGroup": 5,
  "colsPerGroup": 6
}
```

### 保存座位布局

```
PATCH /api/seats/data/:id
```

**请求体**:
```json
{
  "schoolDb": "school_1",
  "userId": 1
}
```

---

## 统计 API

### 获取概览统计

```
GET /api/stats/overview
```

**查询参数**:
- `schoolDb` (必填): 学校数据库标识

**响应**:
```json
{
  "success": true,
  "data": {
    "totalUsers": 100,
    "totalScores": 5000,
    "avgScore": 50,
    "maxScore": 100,
    "minScore": 0
  }
}
```

### 获取积分记录统计

```
GET /api/stats/records
```

**查询参数**:
- `schoolDb` (必填): 学校数据库标识
- `days` (可选): 统计天数，默认 7

---

## 公告 API

### 获取公告列表（公开）

```
GET /api/announcements
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "系统维护通知",
      "content": "系统将于今晚进行维护...",
      "type": "warning",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### 获取公告列表（管理员）

```
GET /api/announcements/admin
```

### 创建公告

```
POST /api/announcements
```

**请求体**:
```json
{
  "title": "新公告",
  "content": "公告内容，支持 <b>HTML</b> 格式",
  "type": "info",
  "active": 1
}
```

### 更新公告

```
PATCH /api/announcements/:id
```

### 删除公告

```
DELETE /api/announcements/:id
```

---

## 入驻申请 API

### 获取申请列表

```
GET /api/applications
```

### 提交申请

```
POST /api/applications
```

**请求体**:
```json
{
  "schoolName": "第三中学",
  "applicantName": "张老师",
  "contactPhone": "13800138000",
  "reason": "希望使用系统管理班级"
}
```

### 审核申请

```
PATCH /api/applications/:id
```

**请求体**:
```json
{
  "status": "approved",
  "reviewNote": "审核通过"
}
```

---

## 教师/管理员管理 API

### 获取管理员列表

```
GET /api/admin/list
```

### 获取管理员详情

```
GET /api/admin/manage
```

### 创建管理员

```
POST /api/admin/manage
```

**请求体**:
```json
{
  "username": "teacher1",
  "password": "password",
  "role": "school_admin",
  "schoolId": 1
}
```

### 更新管理员

```
PATCH /api/admin/manage/:id
```

### 删除管理员

```
DELETE /api/admin/manage/:id
```

---

## 学期管理 API

### 切换学期

```
POST /api/admin/term-switch
```

**请求体**:
```json
{
  "schoolDb": "school_1",
  "classId": 1,
  "action": "reset"
}
```

**操作类型**:
- `reset`: 重置所有学生积分为 0
- `archive`: 归档当前学期数据

---

## 学生端 API

### 获取同班同学

```
GET /api/student/classmates
Authorization: Bearer <token>
```

### 获取个人积分日志

```
GET /api/student/logs
Authorization: Bearer <token>
```

**查询参数**:
- `limit` (可选): 限制数量

---

## 错误码说明

| HTTP 状态码 | 说明 |
|-------------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 401 | 未授权（未登录或 Token 无效） |
| 403 | 禁止访问（权限不足） |
| 404 | 资源不存在 |
| 409 | 资源冲突（如用户名已存在） |
| 500 | 服务器内部错误 |

---

## 注意事项

1. **数据库标识**: 大部分 API 需要 `schoolDb` 参数，这是学校数据库的唯一标识
2. **权限控制**: 管理员 API 需要登录 Session，学生端 API 需要 Token
3. **数据隔离**: 不同学校的数据完全隔离，通过 `schoolDb` 参数区分
4. **字符编码**: 所有请求和响应使用 UTF-8 编码
5. **HTML 内容**: 公告内容支持 HTML 格式，系统会自动进行 XSS 过滤
