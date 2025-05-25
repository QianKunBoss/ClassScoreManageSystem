<div align="center">
  <a href="https://github.com/QianKunBoss/ClassScoreManageSystem/">
    <img src="/favicon.png" alt="Logo" width="120" height="120">
  </a>

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


# 食用技巧：
使用指南

### 项目图片预览
![image](https://github.com/user-attachments/assets/205cc5ec-eedd-4765-b390-54d737b0ca3f)
![image](https://github.com/user-attachments/assets/5929ab06-54d5-41e9-bff1-29578501f76e)
![image](https://github.com/user-attachments/assets/ad81d660-9969-4beb-b0f1-dd1456031da7)
![image](https://github.com/user-attachments/assets/346cf499-3411-45aa-a95d-4a5681ce886f)
![image](https://github.com/user-attachments/assets/7c92f504-fbcc-4261-bb6c-021c5c0cdcc7)
![image](https://github.com/user-attachments/assets/5719cef0-5e4d-49f9-8645-7e13df7e1379)
![image](https://github.com/user-attachments/assets/9c5567a0-d0b7-4499-a1a0-7986b4f14ede)
![image](https://github.com/user-attachments/assets/a818abd0-5328-45fc-9acb-7d716490163b)


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
- **数据导出**：支持将积分数据导出为Excel格式
- **系统设置**：自定义系统标题、导航栏等显示选项
- **积分模板**：预设常用积分调整模板

## 系统要求

- PHP 7.4+（推荐使用8.0）
- MySQL 5.7+
- Web服务器（Apache/Nginx）

## 安装指南

1. 将项目文件上传到Web服务器
2. 创建MySQL数据库（建议命名为`score_system`）
3. 导入`install/install.sql`文件初始化数据库
4. 修改`includes/config.php`中的数据库连接配置
5. 访问`install/`目录完成安装

## 使用说明

1. **管理员登录**：
   - 默认管理员账号：admin
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
A: 编辑`includes/user_credentials.php`文件，修改对应的密码哈希

**Q: 如何备份数据？**
A: 使用`pages/export.php`导出数据，或直接备份MySQL数据库（备份时推荐直接备份数据库，调取数据时推荐使用“导出数据功能”）


## 声明：
该仓库严格按照MIT开源协议\
如有问题请提issue
