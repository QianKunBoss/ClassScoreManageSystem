<?php
// 验证是否已安装
if (!file_exists('../includes/config.php')) {
    header('Location: index.php');
    exit;
}
?>
<!DOCTYPE html>
<html>
<head>
    <title>安装完成</title>
    <link href="https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.2.3/css/bootstrap.min.css" rel="stylesheet">
    <link href="../assets/css/install/style.css" rel="stylesheet">
</head>
<body>
    <div class="install-container">
        <div class="card">
            <div class="card-header bg-success text-white">
                <h4>系统安装完成</h4>
            </div>
            <div class="card-body">
                <div class="alert alert-success">
                    <h5>操行分管理系统 v0.2.1 已成功安装！</h5>
                    <p>请妥善保管您的管理员账号信息。</p>
                    <p class="mb-0">系统版本：v0.2.1</p>
                </div>
                
                <div class="mb-4">
                    <h5>下一步操作建议：</h5>
                    <ol>
                        <li>删除install安装目录（重要安全措施）</li>
                        <li>使用管理员账号登录系统</li>
                        <li>进入系统设置配置您的系统</li>
                    </ol>
                </div>
                
                <div class="d-grid gap-2">
                    <a href="../dengluye.php" class="btn btn-primary">前往登录页面</a>
                    <a href="../admin.php" class="btn btn-secondary">进入管理后台</a>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
