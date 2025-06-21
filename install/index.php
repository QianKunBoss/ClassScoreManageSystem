<?php
if (file_exists('../includes/config.php')) {
    die('系统已安装，如需重新安装请先删除includes/config.php文件');
}
?>
<!DOCTYPE html>
<html>
<head>
    <title>系统安装向导</title>
    <link href="https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.2.3/css/bootstrap.min.css" rel="stylesheet">
    <link href="../assets/css/install/style.css" rel="stylesheet">
</head>
<body>
    <div class="install-container">
        <div class="card">
            <div class="card-header bg-primary text-white">
                <h4>操行分管理系统 v0.2.1 安装向导</h4>
            </div>
            <div class="card-body">
                <div class="alert alert-info mb-4">
                    <h5>安装前准备</h5>
                    <ol>
                        <li>确保已创建MySQL数据库(score_system)</li>
                        <li>确保PHP版本 >= 8.0</li>
                        <li>确保MySQL版本 >= 5.7</li>
                        <li>确保有数据库管理权限</li>
                    </ol>
                </div>
                
                <form action="process.php" method="post">
                    <h5 class="mb-3">第一步：数据库配置</h5>
                    <div class="mb-3">
                        <label class="form-label">数据库地址</label>
                        <input type="text" name="db_host" class="form-control" value="localhost" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">数据库用户名</label>
                        <input type="text" name="db_user" class="form-control" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">数据库密码</label>
                        <input type="password" name="db_pass" class="form-control">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">数据库名称</label>
                        <input type="text" name="db_name" class="form-control" required>
                    </div>
                    
                    <h5 class="mb-3 mt-4">第二步：管理员账号设置</h5>
                    <div class="mb-3">
                        <label class="form-label">管理员用户名</label>
                        <input type="text" name="admin_user" class="form-control" value="admin" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">管理员密码</label>
                        <input type="password" name="admin_pass" class="form-control" required>
                    </div>
                    
                    <button type="submit" class="btn btn-primary">开始安装</button>
                </form>
            </div>
        </div>
    </div>
</body>
</html>
