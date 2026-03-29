<?php
// 定义安装访问常量
define('INSTALL_ACCESS', true);

// 引入公共配置文件
require_once 'config.php';

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
    <script>
    // 在CSS加载前立即应用保存的主题，防止闪烁
    (function() {
        var savedTheme = localStorage.getItem('theme') || 'light';
        if (savedTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    })();
    </script>
    <link href="https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.2.3/css/bootstrap.min.css" rel="stylesheet">
    <link href="style.css" rel="stylesheet">
</head>
<body>
    <div class="install-container">
        <div class="card">
            <div class="card-header bg-success text-white">
                <h4><i class="fas fa-check-circle me-2"></i>系统安装完成</h4>
            </div>
            <div class="card-body">
                <div class="alert alert-success">
                    <h5><i class="fas fa-thumbs-up me-2"></i><?php echo SYSTEM_NAME; ?> v<?php echo SYSTEM_VERSION; ?> 已成功安装！</h5>
                    <p>请妥善保管您的管理员账号信息。</p>
                    <p class="mb-0"><strong>系统版本：</strong>v<?php echo SYSTEM_VERSION; ?></p>
                </div>

                <div class="alert alert-info">
                    <h5><i class="fas fa-server me-2"></i>安装信息</h5>
                    <ul class="mb-0">
                        <li><strong>安装时间：</strong><?php echo date('Y-m-d H:i:s'); ?></li>
                        <li><strong>数据库类型：</strong>SQLite / MySQL</li>
                        <li><strong>安装目录：</strong><?php echo dirname(__DIR__); ?></li>
                    </ul>
                </div>

                <div class="mb-4">
                    <h5><i class="fas fa-tasks me-2"></i>下一步操作建议：</h5>
                    <ol>
                        <li><strong class="text-danger">删除install安装目录（重要安全措施）</strong></li>
                        <li>使用管理员账号登录系统</li>
                        <li>进入系统设置配置您的系统</li>
                        <li>根据需要添加学生信息和积分记录</li>
                    </ol>
                </div>

                <div class="alert alert-warning">
                    <h5><i class="fas fa-exclamation-triangle me-2"></i>安全提醒</h5>
                    <ul class="mb-0">
                        <li>请尽快删除 install 目录，防止他人重新安装系统</li>
                        <li>定期备份数据库，防止数据丢失</li>
                        <li>保护好管理员账号和密码，不要轻易透露给他人</li>
                        <li>建议定期检查和更新系统到最新版本</li>
                    </ul>
                </div>

                <div class="d-grid gap-2">
                    <a href="../pages/login.php" class="btn btn-primary btn-lg">
                        <i class="fas fa-sign-in-alt me-1"></i>前往登录页面
                    </a>
                    <a href="../pages/admin.php" class="btn btn-secondary btn-lg">
                        <i class="fas fa-tachometer-alt me-1"></i>进入管理后台
                    </a>
                </div>
            </div>
        </div>
    </div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css"></script>
</body>
</html>
