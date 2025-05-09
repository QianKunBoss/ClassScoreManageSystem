# ClassScoreManageSystem
CSMS\
这是我的第一项开源项目\

# 更新日志：
### 0.1.1拥有基础的分数查询、分数调整、数据导出、批量导入的功能
### 0.1.2 在 0.1.1 版本中新增 `当日日志查询`、`分数预设` 功能

# 食用技巧：
这里会教你如何使用这个由php做的班级操行分积分管理系统\

### 项目图片预览
![image](https://github.com/user-attachments/assets/1e42a26f-ae6b-4a03-9718-aefbbb807640)
![image](https://github.com/user-attachments/assets/ce3566e1-443d-4544-a1b6-c3d82b3486f6)
![image](https://github.com/user-attachments/assets/3b43f06e-b3aa-404f-8f32-a5d1ff869794)
![image](https://github.com/user-attachments/assets/a0d0ddf7-2bfa-4389-bc8b-541f45d2e8d3)
![image](https://github.com/user-attachments/assets/62c23486-3455-4ed8-9e85-8d718ec38945)
![image](https://github.com/user-attachments/assets/822af0cd-9548-4260-958f-a156c34521ac)


### 1、搭建WEB服务器
可使用各种方式搭建带<ins>SQL数据库</ins>的<ins>PHP8.0</ins>服务器\
尽量使用PHP8.0

### 2、下载仓库zip包
正常下载仓库即可

### 3、上传至WEB服务器
上传至网站服务器

### 4、导入SQL数据库
SQL数据库已导出并在仓库中（ZIP包中的score-system.sql文件）\
  1、登录数据库\
  2、点击导入，选择ZIP包中的score-system.sql文件，导入完成
### 5、配置数据库
  编辑includes/config.php文件中：\
    `// 数据库配置`\
    `$host = 'localhost'; //主机地址`\
    `$dbname = 'score-system'; //数据库名称`\
    `$user = 'pwd-admin'; //数据库登录用户名`\
    `$pass = 'pwd123456'; //数据库登录密码`
### 6、如果你把以上每一个步骤都做完了，那就大功告成了，你就可以体验这个系统了！！！

## 使用信息：
请尽量使用php8.0以免不必要的麻烦^v^\
管理账户默认账号：\
账号：admin\
密码：admin#
* 如何更改账号密码？
* 答：在includes/config.php文件中编辑可以看到，并且进行修改。


## 功能介绍：
1、该系统的搜索功能拥有模糊搜索功能\
2、分数调整支持批量调整\
3、用户（学生）导入支持多人导入\
4、支持csv表格文件数据导出

## 声明：
该仓库严格按照MIT开源协议\
如有问题请提issue
