<?php
// 显示导航栏
function showNav() {
    // 输出favicon
    echo '<link rel="icon" href="/favicon.ico" type="image/x-icon">';
    
    // 输出预加载CSS（如果还没有输出）
    if (!defined('CSS_PRELOADED')) {
        define('CSS_PRELOADED', true);
        echo '
    <!-- 预加载关键CSS -->
    <link rel="preload" href="https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.2.3/css/bootstrap.min.css" as="style" onload="this.onload=null;this.rel=\'stylesheet\'">
    <link rel="preload" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" as="style" onload="this.onload=null;this.rel=\'stylesheet\'">
    <link rel="preload" href="../assets/css/int_main.css" as="style" onload="this.onload=null;this.rel=\'stylesheet\'">
    <!-- CSS回退 -->
    <noscript>
        <link href="https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.2.3/css/bootstrap.min.css" rel="stylesheet">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
        <link href="assets/css/int_main.css" rel="stylesheet">
    </noscript>';
    }
    
    // 获取当前页面名称
    $currentPage = basename($_SERVER['SCRIPT_NAME']);
    

    echo '
    <nav class="navbar navbar-expand-lg mb-4">
        <div class="container">
            <a class="navbar-brand" href="home.php">
                <i class="fas fa-chart-line"></i> '. 
                htmlspecialchars($GLOBALS['pdo']->query("SELECT setting_value FROM system_settings WHERE setting_key = 'nav_title'")->fetchColumn() ?: '操行分管理系统') .'
            </a>
            <button class="navbar-toggler" type="button" id="navbarToggler" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav">';

                // 仅在非查询页面显示管理功能
                if (!in_array($currentPage, ['home.php', 'user_search.php'])) {
                echo '
                    <li class="nav-item">
                        <a class="nav-link" href="user_management.php">
                            <i class="fas fa-users"></i> 用户管理
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="adjust_score.php">
                            <i class="fas fa-edit"></i> 调整积分
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="template_management.php">
                            <i class="fas fa-list-alt"></i> 预设管理
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="export.php">
                            <i class="fas fa-edit"></i> 数据导出
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="data_dashboard.php">
                            <i class="fas fa-chart-line"></i> 数据仪表板
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="settings.php">
                            <i class="fas fa-file-import"></i> 设置
                        </a>
                    </li>';
                }
                if (!in_array($currentPage, ['admin.php', 'user_detail.php', 'add_user.php', 'import_users.php', 'login.php', 'adjust_score.php', "settings.php", "template_management.php", "data_dashboard.php", "user_management.php"])) {
                 echo '
                    <li class="nav-item">
                        <a class="nav-link" href="admin.php">
                            <i class="fas fa-user-plus"></i> 后台管理
                        </a>
                    </li>';
                }
    echo '
                </ul>
                <div class="d-flex align-items-center ms-auto">
                    <span class="nav-text me-3" id="version-display">v'. SYSTEM_VERSION .'</span>
                    <span id="updateStatus" class="badge bg-secondary me-3">检查中...</span>
                    <button id="darkModeToggle" class="btn btn-link nav-text me-3" title="切换深色/浅色模式">
                        <i id="darkModeIcon" class="fas fa-sun"></i>
                    </button>
                    <a href="https://github.com/QianKunBoss/ClassScoreManageSystem" target="_blank" class="nav-text" title="GitHub仓库">
                        <i class="fab fa-github fa-lg"></i>
                    </a>
                </div>
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
    global $pdo;
    
    if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true || !isset($_SESSION['username'])) {
        return false;
    }
    
    try {
        // 验证用户是否存在于管理员表中
        $stmt = $pdo->prepare("SELECT id FROM admins WHERE username = ?");
        $stmt->execute([$_SESSION['username']]);
        $admin = $stmt->fetch();
        
        if (!$admin) {
            return false;
        }
        
        return checkSessionTimeout();
    } catch (PDOException $e) {
        error_log("数据库错误: " . $e->getMessage());
        return false;
    }
}

// 显示页脚
function showFooter() {
    echo '<h6><br><br></h6>';
    echo '<script defer src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>';
    echo '<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>';
    echo '<script>';
    echo 'window.addEventListener("load", function() {';
    echo 'if (typeof bootstrap === "undefined") {';
    echo 'document.write("<script src=\\"https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.2.3/js/bootstrap.bundle.min.js\\"><\\/script>");';
    echo '}';
    echo '});';
    echo '</script>';
    echo '<script defer src="../assets/js/dark_mode.js"></script>';
    echo '<script>';
    echo '(function() {';
    echo 'var navbarToggler = document.getElementById("navbarToggler");';
    echo 'var navbarNav = document.getElementById("navbarNav");';
    echo 'if (navbarToggler && navbarNav) {';
    echo 'var isExpanded = false;';
    echo 'navbarToggler.onclick = function(e) {';
    echo 'e.preventDefault();';
    echo 'isExpanded = !isExpanded;';
    echo 'if (isExpanded) {';
    echo 'navbarNav.classList.add("show");';
    echo 'navbarToggler.setAttribute("aria-expanded", "true");';
    echo '} else {';
    echo 'navbarNav.classList.remove("show");';
    echo 'navbarToggler.setAttribute("aria-expanded", "false");';
    echo '}';
    echo '};';
    echo 'var navLinks = navbarNav.querySelectorAll(".nav-link");';
    echo 'for (var i = 0; i < navLinks.length; i++) {';
    echo 'navLinks[i].addEventListener("click", function() {';
    echo 'if (window.innerWidth < 992 && isExpanded) {';
    echo 'isExpanded = false;';
    echo 'navbarNav.classList.remove("show");';
    echo 'navbarToggler.setAttribute("aria-expanded", "false");';
    echo '}';
    echo '});';
    echo '}';
    echo '}';
    echo '})();';
    echo '</script>';
    
    // 版本检查脚本
    $versionCheckScript = <<<EOT
<!-- 版本更新模态框 -->
<div class="modal fade" id="versionUpdateModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">
                    <i class="fas fa-download me-2"></i>发现新版本
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <p class="mb-2">当前版本：<strong>v<span id="currentVersionText"></span></strong></p>
                <p class="mb-3">最新版本：<strong>v<span id="latestVersionText"></span></strong></p>
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    是否前往下载页面获取最新版本？
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                <button type="button" class="btn btn-primary" id="goToDownloadBtn">
                    <i class="fas fa-external-link-alt me-2"></i>前往下载
                </button>
            </div>
        </div>
    </div>
</div>

<script>
(function() {
    // 等待Bootstrap加载完成
    function waitForBootstrap(callback) {
        if (typeof bootstrap !== 'undefined') {
            callback();
        } else {
            setTimeout(function() { waitForBootstrap(callback); }, 100);
        }
    }
    
    waitForBootstrap(function() {
        function checkHeaderVersionUpdate() {
            var versionDisplay = document.getElementById("version-display");
            var updateStatus = document.getElementById("updateStatus");
            if (!versionDisplay || !updateStatus) return;
            
            updateStatus.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 检查中...';
            
            var apiPath = window.location.pathname.includes("/pages/") ? "../api/check_version.php" : "api/check_version.php";
            
            fetch(apiPath)
                .then(function(response) { return response.json(); })
                .then(function(data) {
                    if (data.success) {
                        if (data.has_update) {
                            updateStatus.textContent = "有新版本可用";
                            updateStatus.className = "badge bg-warning";
                            updateStatus.title = "最新版本: v" + data.latest_version;
                            updateStatus.style.cursor = "pointer";
                            updateStatus.onclick = function() {
                                showVersionUpdateModal(data.current_version, data.latest_version, data.release_url);
                            };
                        } else {
                            updateStatus.textContent = "已是最新版本";
                            updateStatus.className = "badge bg-success";
                            updateStatus.style.cursor = "default";
                            updateStatus.onclick = null;
                        }
                    } else {
                        throw new Error(data.error || "检查失败");
                    }
                })
                .catch(function(error) {
                    updateStatus.textContent = "检查失败";
                    updateStatus.className = "badge bg-danger";
                    updateStatus.title = "无法连接到更新服务器";
                    updateStatus.style.cursor = "default";
                    updateStatus.onclick = null;
                    console.error("检查更新失败:", error);
                });
        }
        
        function showVersionUpdateModal(currentVersion, latestVersion, releaseUrl) {
            console.log("显示版本更新模态框");
            document.getElementById("currentVersionText").textContent = currentVersion;
            document.getElementById("latestVersionText").textContent = latestVersion;
            
            var modalElement = document.getElementById("versionUpdateModal");
            console.log("模态框元素:", modalElement);
            console.log("模态框类名:", modalElement.className);
            
            // 强制显示样式
            modalElement.style.display = "block";
            modalElement.style.zIndex = "1070";
            modalElement.classList.add("show");
            
            console.log("添加show类后:", modalElement.className);
            
            var modal = new bootstrap.Modal(modalElement);
            console.log("Bootstrap模态框实例:", modal);
            
            modal.show();
            
            console.log("调用modal.show()后的类名:", modalElement.className);
            
            document.getElementById("goToDownloadBtn").onclick = function() {
                window.open(releaseUrl, "_blank");
                modal.hide();
            };
        }
        
        // 延迟执行版本检查
        setTimeout(checkHeaderVersionUpdate, 1000);
    });
})();
</script>
EOT;
    
    echo $versionCheckScript;
}


?>