<?php
// 显示导航栏
function showNav() {
    // 输出favicon
    echo '<link rel="icon" href="/favicon.ico" type="image/x-icon">';
    
    // 获取当前页面名称
    $currentPage = basename($_SERVER['SCRIPT_NAME']);
    

    echo '
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary mb-4">
        <div class="container">
            <a class="navbar-brand" href="../index.php">
                <i class="fas fa-chart-line"></i> '. 
                htmlspecialchars($GLOBALS['pdo']->query("SELECT setting_value FROM system_settings WHERE setting_key = 'nav_title'")->fetchColumn() ?: '操行分管理系统') .'
            </a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav">';

                // 仅在非查询页面显示管理功能
                if (!in_array($currentPage, ['index.php', 'user_search.php'])) {
                echo '
                    <li class="nav-item">
                        <a class="nav-link" href="../pages/add_user.php">
                            <i class="fas fa-user-plus"></i> 添加学生
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="../pages/adjust_score.php">
                            <i class="fas fa-edit"></i> 调整积分
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="../pages/template_management.php">
                            <i class="fas fa-list-alt"></i> 预设管理
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="../pages/export.php">
                            <i class="fas fa-edit"></i> 数据导出
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="../pages/import_users.php">
                            <i class="fas fa-file-import"></i> 批量导入
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="../pages/settings.php">
                            <i class="fas fa-file-import"></i> 设置
                        </a>
                    </li>';
                }
                if (!in_array($currentPage, ['admin.php', 'user_detail.php', 'add_user.php', 'import_users.php', 'dengluye.php', 'adjust_score.php', "settings.php"])) {
                 echo '
                    <li class="nav-item">
                        <a class="nav-link" href="../admin.php">
                            <i class="fas fa-user-plus"></i> 后台管理
                        </a>
                    </li>';
                }
    echo '
                </ul>
            </div>
        </div>
    </nav>';

}


// 检查会话是否超时
function checkSessionTimeout() {
    if (isset($_SESSION['last_activity']) && (time() - $_SESSION['last_activity'] > SESSION_TIMEOUT)) {
        session_unset();
        session_destroy();
        return false;
    }
    $_SESSION['last_activity'] = time();
    return true;
}

// 检查用户是否已登录
function isLoggedIn() {
    if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
        return false;
    }
    
    // 验证用户是否存在于凭据文件中
    $credentialsFile = __DIR__ . '/user_credentials.php';
    if (!file_exists($credentialsFile)) {
        return false;
    }
    
    include $credentialsFile;
    if (!isset($credentials[$_SESSION['username']])) {
        return false;
    }
    
    return checkSessionTimeout();
}

// 显示页脚
function showFooter() {
    echo '
    <h6><br><br></h6>
    <h6 Align="center">该项目已开源至Github仓库（开源协议：MIT）<br>
    仓库地址：<a href="https://github.com/QianKunBoss/ClassScoreManageSystem">https://github.com/QianKunBoss/ClassScoreManageSystem</a><br>
    该项目由Tianrld工作室成员开发</h6>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
    </body>
    </html>';
}


?>