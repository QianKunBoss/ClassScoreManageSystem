<div align="center">
  <a href="https://github.com/QianKunBoss/ClassScoreManageSystem/">
    <img src="/favicon.png" alt="Logo" width="120" height="120">
  </a>
  
![Static Badge](https://img.shields.io/badge/LICENSE-MIT-blue)
[![Static Badge](https://img.shields.io/badge/QQ%E7%BE%A4-1074247379-green)](https://qm.qq.com/cgi-bin/qm/qr?k=zq6abuB_dFlnKdZ8m-xbEYSf2dbbT_wH&jump_from=webapi&authKey=hDGw4OP4pavLFl5MmqaiivM5Ki9q4rx8pixuzKN7xk2hFTnQQ8s1j3ECcfAPY39V)




</div>



# ClassScoreManageSystem（CSMS）
## 班级操行分管理系统（CSMS）
简称CSMS\
这是我的第一项开源项目



# 更新日志：
### 0.1.1拥有基础的分数查询、分数调整、数据导出、批量导入的功能
### 0.1.2 在 0.1.1 版本中新增 `当日日志查询`、`分数预设` 功能
### 0.2.0 在 0.1.2 版本的基础上进行功能性的`大更新`：
- 由于原本的手动安装对于某些人来说过于麻烦，所以直接更新出`快速安装引导页`
- 可开关主页显示内容，包括`搜索栏是否显示`、`排行榜是否显示`以及`主页排行榜是否可以直接点击用户名访问用户详情`
- 新增用户详情页排名显示
- 新增`设置`页面，以综合设置系统功能，除第二条以外，还可以修改管理员用户名和登录密码、导航栏标题、标签页标题。
- 新增初始图标（自认为很垃圾）
### 0.2.2 进行功能性小更新：
- 新增学期重置功能（设置/其他操作/切换新学期）
- 更换Boostrap CDN源，使网站访问更稳定
### 0.2.3 大部分更新
- 1、修复了已知Bug
- 2、新增_座位表视图，便于选择和寻找
- 3、改善样式一致性
- 4、新增数据仪表盘页面，用于显示综合信息
- 5、新增平均分、最高分、最低分数据公示（可开关）
- 6、支持可添加多个管理员账号
- 7、支持用户反选_
- 8、简化页面（添加用户和批量导入页面二合一页面），并且取消管理页主页删除用户按钮，移植至用户管理
- 9、数据导出直接支持xlsx表格导出

### 0.2.4 重大功能更新 🎉
- **数据库功能增强**：
  - 新增SQLite数据库支持（无需MySQL，开箱即用）
  - 新增QQ号码字段支持，便于记录学生联系方式，为后续QQ群机器人项目奠定了基础

- **API系统重构**：
  - **全局API（global_api.php）**：供外部系统调用的标准化RESTful接口
    - 支持用户、积分记录、座位配置等数据的查询和操作
    - 读取操作免Token，修改操作需要管理员Token授权
    - 完整的CRUD接口，支持批量操作
  - **系统内部API**：用于系统内部功能的专用接口
    - 管理员管理、背景管理、个性化设置、数据备份等

- **个性化定制**：
  - 支持自定义主题颜色（主色调、辅助色、成功色等）
  - 支持自定义字体、边框、阴影等样式
  - 支持上传自定义背景图片
  - 实时CSS变量更新

- **系统功能优化**：
  - 迁移独立登录页面和密码重置页面（./admin.php → ./pages/admin.php | ./dengluye.php → ./pages/dengluye.php）
  - 新增安装前系统环境检测
  - 在设置页新增GitHub版本自动检查功能
  - 新增数据库在线备份
  - 优化新学期切换功能
  - 优化模态框显示图层

- **文档完善**：
  - 新增完整的API接口文档（docs/global_api.md）
  - 详细的接口说明和使用示例

# 食用技巧：
使用指南

### 项目图片预览
主页
<img width="1919" height="947" alt="image" src="https://github.com/user-attachments/assets/7e321b39-1479-4a57-95e9-945722be68ed" />
管理页首页
<img width="1919" height="952" alt="image" src="https://github.com/user-attachments/assets/17fc1f17-56bc-42dd-adc1-5f6203f0afb2" />
用户管理
<img width="1919" height="472" alt="image" src="https://github.com/user-attachments/assets/9b7e80b3-725b-4ece-b022-9ab0d98abadb" />
<img width="1919" height="712" alt="image" src="https://github.com/user-attachments/assets/52046103-2ee5-436b-bc63-be128c4a7248" />
<img width="1919" height="949" alt="image" src="https://github.com/user-attachments/assets/0cdaf298-0c45-4a59-bed5-1773a537dec5" />
调整积分
<img width="1778" height="876" alt="image" src="https://github.com/user-attachments/assets/549f3c76-b938-4ca9-a357-5b03daf586d3" />
<img width="1919" height="886" alt="image" src="https://github.com/user-attachments/assets/e676eb44-43a9-4708-904f-708a4b6c223d" />
预设管理
<img width="1919" height="949" alt="image" src="https://github.com/user-attachments/assets/b8f00c28-04f4-4d93-9aed-00497398873c" />
数据仪表盘
<img width="1089" height="944" alt="image" src="https://github.com/user-attachments/assets/d0e5c226-51c0-4fdb-8b2a-7ca648d57577" />
设置
<img width="1919" height="955" alt="image" src="https://github.com/user-attachments/assets/7f87ca2a-18a5-45ae-a652-6808621edf14" />
<img width="1918" height="2282" alt="image" src="https://github.com/user-attachments/assets/ee4d374c-a9c2-4f6a-b677-13fbcb951914" />
<img width="1919" height="954" alt="image" src="https://github.com/user-attachments/assets/34eb6c3e-6f80-485b-977d-9a7c2197629a" />
<img width="1919" height="952" alt="image" src="https://github.com/user-attachments/assets/77d4bd8e-59ea-49f2-b3ed-952020399c2d" />
<img width="1919" height="954" alt="image" src="https://github.com/user-attachments/assets/b6682fd6-24df-462f-a81e-70d6889bf7d5" />
<img width="1919" height="673" alt="image" src="https://github.com/user-attachments/assets/2597ef5f-1280-4abc-9f2a-8132703298d0" />
<img width="1919" height="953" alt="image" src="https://github.com/user-attachments/assets/c4a0edeb-ff74-42d6-aa15-bdbca8513135" />




## 项目简介
班级操行分管理系统是一个用于记录和管理学生日常操行分的Web应用程序。该系统可以帮助班主任和任课教师：

- 记录学生的加分/扣分情况
- 查看学生积分排名
- 生成积分明细报表
- 管理积分模板

## 主要功能

- **学生管理**：添加、删除、查看学生信息
- **积分调整**：记录学生的加分和扣分情况
- **排名统计**：自动计算学生积分排名，前三名显示奖牌标识
- **数据导出**：支持将积分数据导出为Excel xlsx格式（无需任何额外插件）
- **系统设置**：自定义系统标题、导航栏等显示选项
- **积分模板**：预设常用积分调整模板

# 🌟 实现列表

| 任务大概 | 目前情况 | 实现版本  |
|---|---|---|
| **🖼 管理员登陆密码验证** | ✅ | v0.1.1 |
| **🔍 用户搜索** | ✅ | v0.1.1 |
| **🚀 管理面板** | ✅ | v0.1.1 |
| **👤 添加用户** | ✅ | v0.1.1 |
| **📝 批量名单导入** | ✅ | v0.1.1 |
| **🗑 删除用户** | ✅ | v0.1.1 |
| **👤 用户页面** | ✅ | v0.1.1 |
| **📝 csv → Excel xlsx格式表格数据导出** | ✅ | v0.1.1 → v0.2.3 |
| **📄 预设模板** | ✅ | v0.1.2 |
| **📝 日志记录查询** | ✅ | v0.1.2 |
| **📧 管理员账号重置密码** | ✅ | v0.2.0 |
| **⚙️ 快速安装引导页** | ✅ | v0.2.0 |
| **⚙️ 自定义设置** | ✅ | v0.2.0 |
| **🎈 用户详情页排名显示** | ✅ | v0.2.0 |
| **🖼 开屏动画（可在设置页开关）** | ✅ | v0.2.1 |
| **🖼 管理员信息使用MySQL数据库存储** | ✅ | v0.2.1 |
| **🗺️ 文件目录规范化** | ✅ | v0.2.1 |
| **🔄 学期更换** | ✅ | v0.2.2 |
| **🗺️ 座位表视图** | ✅ | v0.2.3 |
| **📊 数据仪表盘页面** | ✅ | v0.2.3 |
| **📈 平均分、最高分、最低分数据公示** | ✅ | v0.2.3 |
| **👥 多管理员账号支持** | ✅ | v0.2.3 |
| **🔄 用户反选功能** | ✅ | v0.2.3 |
| **🔗 全局API接口（global_api.php）** | ✅ | v0.2.4 |
| **📱 SQLite数据库支持** | ✅ | v0.2.4 |
| **🎨 个性化定制功能** | ✅ | v0.2.4 |
| **🆔 QQ号码字段支持** | ✅ | v0.2.4 |
| **🔐 独立登录页面** | ✅ | v0.2.4 |
| **🔑 密码重置页面** | ✅ | v0.2.4 |
| **🔍 系统环境检测工具** | ✅ | v0.2.4 |
| **📡 GitHub版本自动检查功能** | ✅ | v0.2.4 |
| **💾 数据库在线备份与恢复功能** | ✅ | v0.2.4 |
| **🖼 自定义背景图片功能** | ✅ | v0.2.4 |
| **🔧 数据库升级工具** | ✅ | v0.2.4 |
| **📚 完整API接口文档** | ✅ | v0.2.4 |
| **🤖 接入QQ机器人** | 🚧 | 预计v0.2.5 |
| **✅ 支持多校多班管理** | 🚧 | 预计v0.3.0 |
| **✅ 权限组完全完成** | 🚧 | 预计v0.3.0 |
| **🗑 删除日志** | 🚧 | 预计v0.3.0 |
| **🎈 404 页面** | 🚧 | 预计v0.3.0 |
| **📝 更快速的信息处理和反馈优化** | 🚧 | 预计v0.3.0 |
| **🔒 数据安全** | ⏳ |        |
| **📱 登录二步验证** | ⏳ |        |


以下是图例的翻译，供您参考：

- ✅：任务已完成。太棒了！🎉
- 🚧：任务正在进行中。我们正在努力！💪
- ⏳：任务即将开始。令人期待的事情即将到来！🌠

## 系统要求

- [PHP 7.4+](https://img.shields.io/badge/PHP-%3E%3D7.4-purple)（推荐使用[8.0](https://img.shields.io/badge/%20-8.0-purple)）
- **数据库二选一**：
  - ![Static Badge](https://img.shields.io/badge/MySQL-%3E%3D5.7-green) / ![Static Badge](https://img.shields.io/badge/MariaDB-%3E%3D10.0-orange)
  - ![Static Badge](https://img.shields.io/badge/SQlite-%3E%3D3.0-red)（无需配置数据库，开箱即用）
- Web服务器（Apache/Nginx）

# 🛠️ 快速开始

## 方式一：快速安装（推荐新手）

1. 将项目文件上传到Web服务器
2. 访问`install/`目录，系统会自动检测环境
3. 按照安装向导完成配置：
   - 选择数据库类型（SQLite或MySQL）
   - 设置管理员账号和密码
   - 完成系统初始化

## 方式二：手动安装（MySQL）

1. 将项目文件上传到Web服务器
2. 创建MySQL数据库（建议命名为`score_system`）
3. 导入`install/install.sql`文件初始化数据库
4. 修改`includes/config.php`中的数据库连接配置
5. 访问`install/`目录完成安装

## 从旧版本升级

1. 备份现有数据库
2. 将新版本文件覆盖到原目录
3. 更新`includes/config.php`配置文件

## 文件目录结构

```
ClassScoreManageSystem/
├── api/                                # API接口目录
│   ├── admin_management.php           # 管理员管理
│   ├── api_records_stats.php          # 记录统计
│   ├── check_version.php              # 版本检查
│   ├── delete_background.php          # 删除背景图片
│   ├── delete_user.php                # 删除用户
│   ├── get_backgrounds.php            # 获取背景图片列表
│   ├── get_database_info.php          # 获取数据库信息
│   ├── global_api.php                 # 全局API接口（外部调用）
│   ├── load_css_settings.php          # 加载CSS设置
│   ├── load_seat_layout.php           # 加载座位布局
│   ├── new_term_switch.php            # 新学期切换
│   ├── reset_customize_settings.php   # 重置自定义设置
│   ├── save_customize_settings.php    # 保存自定义设置
│   ├── save_seat_layout.php           # 保存座位布局
│   ├── search_users.php               # 用户搜索
│   ├── sql_backup.php                 # 数据库备份
│   ├── third_party_api.php            # 第三方API
│   ├── update_database_config.php     # 更新数据库配置
│   ├── update_system_settings.php     # 更新系统设置
│   ├── update_user_management.php     # 更新用户管理
│   ├── update_user_qq.php             # 更新用户QQ号码
│   ├── upload_background.php          # 上传背景图片
│   └── verify_admin_password.php      # 验证管理员密码
├── assets/                            # 资源文件目录
│   ├── background/                    # 背景图片
│   ├── css/                           # 样式文件
│   │   └── int_main.css              # 主样式文件
│   ├── fonts/                         # 字体文件
│   │   └── HarmonyOS_Sans_SC_Black.ttf
│   ├── js/                            # JavaScript文件
│   │   ├── background_image.js
│   │   ├── dark_mode.js
│   │   ├── lazy_loader.js
│   │   ├── main.js
│   │   └── smart_colors.js
│   └── videos/                        # 视频文件
│       └── splash.mp4
├── includes/                          # 包含文件目录
│   └── functions.php                  # 公共函数
├── install/                           # 安装目录
│   ├── check_system.php               # 系统环境检测
│   ├── complete.php                   # 安装完成
│   ├── config.php                     # 安装配置
│   ├── index.php                      # 安装入口
│   ├── install.sql                    # MySQL安装脚本
│   ├── install_sqlite.sql             # SQLite安装脚本
│   ├── process.php                    # 安装处理
│   └── style.css                      # 安装样式
├── pages/                             # 页面目录
│   ├── adjust_score.php               # 调整分数
│   ├── admin.php                      # 管理页面
│   ├── data_dashboard.php             # 数据仪表盘
│   ├── export.php                     # 数据导出
│   ├── home.php                       # 首页
│   ├── login.php                      # 登录页面
│   ├── reset_password.php             # 密码重置
│   ├── settings_customize.js          # 个性化设置
│   ├── settings.php                   # 设置页面
│   ├── template_management.php        # 模板管理
│   ├── user_detail.php                # 用户详情
│   ├── user_management.php            # 用户管理
│   └── user_search.php                # 用户搜索
├── index.php                          # 入口文件
├── favicon.ico                        # 网站图标
└── README.md                          # 项目说明文档
```

## 使用说明

1. **管理员登录**：
   - 默认管理员账号：admin（安装时可更改）
   - 密码：安装时设置

2. **添加学生**：
   - 导航到"添加学生"页面
   - 填写学生姓名等信息
   - 点击"提交"按钮

3. **调整积分**：
   - 在学生详情页点击"调整分数"
   - 输入分数变化值和原因
   - 点击"提交调整"按钮

4. **查看排名**：
   - 首页或后台管理页面显示学生积分排名
   - 前三名显示🥇、🥈、🥉奖牌标识

## 常见问题

**Q: 安装时出现数据库连接错误？**
A: 请检查`includes/config.php`中的数据库配置是否正确

**Q: 如何重置管理员密码？**
A: 在登录页点击忘记密码，完成相关流程以完成密码重置

**Q: 如何备份数据？**
A: 使用`pages/export.php`导出数据，或直接备份MySQL数据库（备份时推荐直接备份数据库，调取数据时推荐使用"导出数据功能"）

## API使用说明

### 外部API（global_api.php）

**用途**：供外部系统调用的标准化RESTful接口，支持第三方系统集成

**基础URL**：`/api/global_api.php`

**响应格式**：JSON

---

#### 权限说明

- **读取操作（READ）**：无需Token，可直接访问
- **修改操作（CREATE/UPDATE/DELETE）**：需要管理员Token授权

**Token传递方式**（任选其一）：
1. 请求头：`Authorization: YOUR_TOKEN`
2. GET参数：`?token=YOUR_TOKEN`
3. POST参数：`token=YOUR_TOKEN`

---

#### 支持的数据表

| 表名 | 说明 | 读取操作 | 增删改操作 |
|------|------|---------|-----------|
| `users` | 用户/学生表 | ✅ 免token | 🔐 需要token |
| `score_logs` | 积分记录表 | ✅ 免token | 🔐 需要token |
| `seat_layout_config` | 座位表配置表 | ✅ 免token | 🔐 需要token |
| `seat_data` | 座位数据表 | ✅ 免token | 🔐 需要token |

**users表特殊字段**（查询时自动计算）：
- `total_score` - 总积分
- `add_score` - 加分总计
- `deduct_score` - 扣分总计
- `score_count` - 积分记录数量
- `group_index` - 所属组索引
- `row_index` - 行索引
- `col_index` - 列索引

---

#### API操作类型

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

---

#### 错误响应

所有错误响应遵循以下格式：

```json
{
  "error": "错误描述信息"
}
```

**常见错误码**：

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

#### 注意事项

1. **Token安全**：请妥善保管管理员token，不要在客户端代码中硬编码
2. **数据验证**：建议在调用API前对数据进行客户端验证
3. **批量操作**：使用批量加减分功能时，建议单次操作不超过100条记录
4. **分页查询**：列表查询默认限制100条，使用`limit`参数调整
5. **字符编码**：所有请求和响应使用UTF-8编码
6. **表访问限制**：此API仅允许访问 `users`、`score_logs`、`seat_layout_config`、`seat_data` 四个表
7. **权限控制**：读取操作免token，修改操作需要管理员token

**详细文档**：查看 `docs/global_api.md` 获取完整的API接口文档，包括详细的参数说明、响应格式、字段说明等

---

### 系统内部API

**用途**：用于系统内部功能实现的专用接口，不建议直接调用

**API列表**：
- `admin_management.php` - 管理员账户管理
- `delete_background.php` - 删除自定义背景图片
- `get_backgrounds.php` - 获取背景图片列表
- `upload_background.php` - 上传自定义背景图片
- `update_user_qq.php` - 更新用户QQ号码
- `save_customize_settings.php` - 保存个性化设置
- `load_css_settings.php` - 加载自定义CSS设置
- `new_term_switch.php` - 新学期数据切换
- `sql_backup.php` - 数据库备份与恢复
- `verify_admin_password.php` - 管理员密码验证
- `check_version.php` - GitHub版本检查
- 其他系统专用接口...

**注意**：这些接口仅供系统内部使用，请勿直接调用

## 声明：
该仓库严格按照MIT开源协议\
如有问题请提issue
