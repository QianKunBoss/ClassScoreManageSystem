# ClassScoreManageSystem
CSMS\
这是我的第一项开源项目\
这里会教你如何使用这个由php做的班级操行分积分管理系统\

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
如有问题请联系邮箱：qiankunboss@foxmail.com
