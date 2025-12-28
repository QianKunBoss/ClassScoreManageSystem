<?php
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/functions.php';

if (!isLoggedIn()) {
    header('Location: ../dengluye.php');
    exit;
}

// 初始化设置表
$pdo->exec("
    CREATE TABLE IF NOT EXISTS system_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(50) UNIQUE,
        setting_value TEXT
    )
");

// 初始化默认设置
$defaultSettings = [
    'system_title' => '班级操行分管理系统',
    'nav_title' => '操行分管理系统',
    'show_ranking' => '1',
    'show_search' => '1',
    'enable_user_detail' => '1',
    'splash_video_enabled' => '1',
    'show_statistics' => '1',
    'security_question' => '您设置的管理员账号是什么?',
    'security_answer' => '',
];

foreach ($defaultSettings as $key => $value) {
    $stmt = $pdo->prepare("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES (?, ?)");
    $stmt->execute([$key, $value]);
}

// 处理表单提交
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // 处理添加管理员请求
    if (isset($_POST['admin_username']) && isset($_POST['admin_password'])) {
        $username = htmlspecialchars($_POST['admin_username']);
        $password = $_POST['admin_password'];
        
        try {
            // 检查用户名是否已存在
            $stmt = $pdo->prepare("SELECT id FROM admins WHERE username = ?");
            $stmt->execute([$username]);
            if ($stmt->fetch()) {
                $_SESSION['error'] = "管理员用户名已存在！";
            } else {
                // 添加新管理员
                $passwordHash = password_hash($password, PASSWORD_DEFAULT);
                $stmt = $pdo->prepare("INSERT INTO admins (username, password_hash) VALUES (?, ?)");
                $stmt->execute([$username, $passwordHash]);
                $_SESSION['success'] = "管理员添加成功！";
            }
        } catch(PDOException $e) {
            $_SESSION['error'] = "添加管理员失败: " . $e->getMessage();
        }
        header("Location: settings.php");
        exit;
    }
    
    // 处理编辑管理员请求
    if (isset($_POST['edit_admin_id']) && isset($_POST['edit_admin_username'])) {
        $adminId = (int)$_POST['edit_admin_id'];
        $newUsername = htmlspecialchars($_POST['edit_admin_username']);
        $newPassword = $_POST['edit_admin_password'] ?? '';
        
        try {
            // 检查新用户名是否与其他管理员重复
            $stmt = $pdo->prepare("SELECT id FROM admins WHERE username = ? AND id != ?");
            $stmt->execute([$newUsername, $adminId]);
            if ($stmt->fetch()) {
                $_SESSION['error'] = "该用户名已被其他管理员使用！";
            } else {
                // 更新管理员信息
                if (!empty($newPassword)) {
                    // 更新用户名和密码
                    $passwordHash = password_hash($newPassword, PASSWORD_DEFAULT);
                    $stmt = $pdo->prepare("UPDATE admins SET username = ?, password_hash = ? WHERE id = ?");
                    $stmt->execute([$newUsername, $passwordHash, $adminId]);
                } else {
                    // 只更新用户名
                    $stmt = $pdo->prepare("UPDATE admins SET username = ? WHERE id = ?");
                    $stmt->execute([$newUsername, $adminId]);
                }
                
                // 如果编辑的是当前用户，更新会话
                if ($adminId === $_SESSION['admin_id']) {
                    $_SESSION['username'] = $newUsername;
                }
                
                $_SESSION['success'] = "管理员信息更新成功！";
            }
        } catch(PDOException $e) {
            $_SESSION['error'] = "更新管理员失败: " . $e->getMessage();
        }
        header("Location: settings.php");
        exit;
    }
    
    // 处理删除管理员请求
    if (isset($_POST['delete_admin'])) {
        $adminId = (int)$_POST['delete_admin'];
        
        try {
            // 检查是否为当前用户
            $stmt = $pdo->prepare("SELECT username FROM admins WHERE id = ?");
            $stmt->execute([$adminId]);
            $admin = $stmt->fetch();
            
            if ($admin && $admin['username'] === $_SESSION['username']) {
                $_SESSION['error'] = "不能删除当前登录的管理员账号！";
            } else {
                // 删除管理员
                $stmt = $pdo->prepare("DELETE FROM admins WHERE id = ?");
                $stmt->execute([$adminId]);
                $_SESSION['success'] = "管理员删除成功！";
            }
        } catch(PDOException $e) {
            $_SESSION['error'] = "删除管理员失败: " . $e->getMessage();
        }
        header("Location: settings.php");
        exit;
    }
    
    // 处理密码验证请求
    if (isset($_POST['verify_password'])) {
        $password = $_POST['password'] ?? '';
        $stmt = $pdo->prepare("SELECT password_hash FROM admins WHERE username = ?");
        $stmt->execute([$_SESSION['username']]);
        $admin = $stmt->fetch();
        
        if ($admin && password_verify($password, $admin['password_hash'])) {
            header('Content-Type: application/json');
            echo json_encode(['success' => true]);
            exit;
        } else {
            header('Content-Type: application/json');
            echo json_encode(['success' => false]);
            exit;
        }
    }

    // 处理新学期切换请求
    if (isset($_POST['new_term'])) {
        try {
            $pdo->beginTransaction();
            
            // 根据选项清理数据
            if ($_POST['keepUsers'] === 'false') {
                // 清空用户表并重置自增ID
                $pdo->exec("TRUNCATE TABLE users");
            }
            
            if ($_POST['keepRecords'] === 'false') {
                // 清空积分记录表并重置自增ID
                $pdo->exec("TRUNCATE TABLE score_logs");
            }
            
            $pdo->commit();
            exit;
        } catch (Exception $e) {
            $pdo->rollBack();
            header('HTTP/1.1 500 Internal Server Error');
            exit;
        }
    }
    
    // 处理系统设置表单
    if (!isset($_GET['user_management']) && !isset($_POST['new_term'])) {
        // 处理文本输入
        $textSettings = ['system_title', 'nav_title', 'security_answer'];
        foreach ($textSettings as $key) {
            if (isset($_POST[$key])) {
                $stmt = $pdo->prepare("UPDATE system_settings SET setting_value = ? WHERE setting_key = ?");
                $stmt->execute([htmlspecialchars($_POST[$key]), $key]);
            }
        }
        
        // 处理安全问题
        $securityQuestion = $_POST['security_question'];
        if ($securityQuestion === 'custom' && !empty($_POST['custom_security_question'])) {
            $securityQuestion = $_POST['custom_security_question'];
        }
        $stmt = $pdo->prepare("UPDATE system_settings SET setting_value = ? WHERE setting_key = 'security_question'");
        $stmt->execute([htmlspecialchars($securityQuestion)]);
        
        // 处理开关输入
        $switchSettings = ['show_ranking', 'show_search', 'enable_user_detail', 'splash_video_enabled', 'show_statistics'];
        foreach ($switchSettings as $key) {
            $valueToSave = isset($_POST[$key]) ? '1' : '0';
            $stmt = $pdo->prepare("UPDATE system_settings SET setting_value = ? WHERE setting_key = ?");
            $stmt->execute([$valueToSave, $key]);
        }
        $_SESSION['success'] = "系统设置已保存！";
        header("Location: settings.php");
        exit;
    }
    
    // 处理用户管理表单
    if (isset($_GET['user_management'])) {
        // 验证当前密码
        $currentUsername = $_SESSION['username'];
        $currentPassword = $_POST['current_password'];
        $newPassword = trim($_POST['new_password']);
        
        // 检查是否只输入了当前密码但未输入新密码
        if (!empty($currentPassword) && empty($newPassword)) {
            $_SESSION['error'] = "未输入新密码，如需更改密码请输入新密码";
            header("Location: settings.php");
            exit;
        }
        
        // 从数据库验证密码
        $stmt = $pdo->prepare("SELECT password_hash FROM admins WHERE username = ?");
        $stmt->execute([$currentUsername]);
        $admin = $stmt->fetch();
        
        if (!$admin || !password_verify($currentPassword, $admin['password_hash'])) {
            $_SESSION['error'] = "当前密码不正确";
            header("Location: settings.php");
            exit;
        }

        // 更新用户名或密码
        $newUsername = trim($_POST['new_username']);
        $newPassword = trim($_POST['new_password']);
        
        try {
            $pdo->beginTransaction();
            
            if (!empty($newUsername)) {
                // 检查新用户名是否已存在
                $stmt = $pdo->prepare("SELECT id FROM admins WHERE username = ?");
                $stmt->execute([$newUsername]);
                if ($stmt->fetch()) {
                    $_SESSION['error'] = "该用户名已存在";
                    header("Location: settings.php");
                    exit;
                }
                
                // 更新用户名
                $stmt = $pdo->prepare("UPDATE admins SET username = ? WHERE username = ?");
                $stmt->execute([$newUsername, $currentUsername]);
                $_SESSION['username'] = $newUsername;
                $currentUsername = $newUsername;
            }
        
        if (!empty($newPassword)) {
            // 更新密码
            $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
            $stmt = $pdo->prepare("UPDATE admins SET password_hash = ? WHERE username = ?");
            $stmt->execute([$hashedPassword, $currentUsername]);
        }
        
        $pdo->commit();
        $_SESSION['success'] = "用户信息已更新";
        header("Location: settings.php");
        exit;
    } catch (Exception $e) {
        $pdo->rollBack();
        $_SESSION['error'] = "更新用户信息时出错: " . $e->getMessage();
        header("Location: settings.php");
        exit;
    }
    }
}

// 获取当前设置
$settings = [];
$stmt = $pdo->query("SELECT setting_key, setting_value FROM system_settings");
while ($row = $stmt->fetch()) {
    $settings[$row['setting_key']] = htmlspecialchars($row['setting_value']);
}

// 获取当前管理员ID
$currentAdminStmt = $pdo->prepare("SELECT id FROM admins WHERE username = ?");
$currentAdminStmt->execute([$_SESSION['username']]);
$currentAdmin = $currentAdminStmt->fetch();
if ($currentAdmin) {
    $_SESSION['admin_id'] = $currentAdmin['id'];
}

// 获取管理员列表
$admins = $pdo->query("
    SELECT id, username, created_at, last_login 
    FROM admins 
    ORDER BY created_at DESC
")->fetchAll();
?>

<!DOCTYPE html>
<html>
<head>
    <title>系统设置</title>
    <link href="https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.2.3/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link href="../assets/css/main.css" rel="stylesheet">
    
<style>
        .settings-sidebar {
            min-height: calc(100vh - 200px);
            max-width: 200px;
        }
        .settings-sidebar .nav-link {
            border-radius: 5px;
            margin-bottom: 5px;
        }
        .settings-sidebar .nav-link.active {
            background-color: #667eea;
            color: white;
        }
        .settings-sidebar .nav-link:hover:not(.active) {
            background-color: #e9ecef;
        }
        .settings-content {
            min-height: 500px;
        }
        @media (max-width: 768px) {
            .settings-sidebar {
                margin-bottom: 15px;
                min-height: auto;
                height: auto;
                max-width: 100%;
            }
            .settings-sidebar .nav {
                flex-direction: row !important;
                flex-wrap: nowrap !important;
                overflow-x: auto;
                white-space: nowrap;
                padding: 0;
                height: auto;
            }
            .settings-sidebar .nav-link {
                flex-shrink: 0;
                margin-right: 5px;
                margin-bottom: 0;
                padding: 0.5rem 1rem;
                display: inline-block;
            }
            .settings-content {
                min-height: auto;
            }
        }
    </style>
</head>
<body>
    <?php showNav(); ?>
    
    <div class="container mt-4">
        <a href="../admin.php" class="btn btn-secondary mb-3">← 返回管理后台</a>
        
        <?php if (isset($_SESSION['success'])): ?>
            <div class="alert alert-success"><?= $_SESSION['success'] ?></div>
            <?php unset($_SESSION['success']); ?>
        <?php endif; ?>
        
        <?php if (isset($_SESSION['error'])): ?>
            <div class="alert alert-danger"><?= $_SESSION['error'] ?></div>
            <?php unset($_SESSION['error']); ?>
        <?php endif; ?>

        <div class="row">
            <!-- 侧边栏 -->
            <div class="col-md-3">
                <div class="card settings-sidebar">
                    <div class="card-body p-2">
                        <nav class="nav flex-column" id="settingsNav" style="display: flex; flex-wrap: nowrap; overflow-x: auto;">
                            <a class="nav-link active" href="#" data-target="system">
                                <i class="fas fa-cog me-2"></i>系统设置
                            </a>
                            <a class="nav-link" href="#" data-target="user">
                                <i class="fas fa-user me-2"></i>用户管理
                            </a>
                            <a class="nav-link" href="#" data-target="admin">
                                <i class="fas fa-user-shield me-2"></i>管理员管理
                            </a>
                            <a class="nav-link" href="#" data-target="other">
                                <i class="fas fa-tools me-2"></i>其他操作
                            </a>
                        </nav>
                    </div>
                </div>
            </div>

            <!-- 内容区域 -->
            <div class="col-md-9">
                <!-- 系统设置 -->
                <div class="card settings-content" id="systemSettings">
                    <div class="card-header">系统设置</div>
                    <div class="card-body">
                        <form method="post">
                            <div class="mb-3">
                                <label class="form-label">系统标题</label>
                                <input type="text" name="system_title" class="form-control" 
                                       value="<?= $settings['system_title'] ?? '' ?>" required>
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label">导航栏标题</label>
                                <input type="text" name="nav_title" class="form-control" 
                                       value="<?= $settings['nav_title'] ?? '' ?>" required>
                            </div>

                            <div class="mb-3 form-check form-switch">
                                <input type="checkbox" name="show_ranking" class="form-check-input" role="switch" id="showRanking" value="1"
                                    <?= ($settings['show_ranking'] ?? '1') === '1' ? 'checked' : '' ?>>
                                <label class="form-check-label" for="showRanking">显示积分排名</label>
                            </div>

                            <div class="mb-3 form-check form-switch">
                                <input type="checkbox" name="show_search" class="form-check-input" role="switch" id="showSearch" value="1"
                                    <?= ($settings['show_search'] ?? '1') === '1' ? 'checked' : '' ?>>
                                <label class="form-check-label" for="showSearch">显示积分查询</label>
                            </div>

                            <div class="mb-3 form-check form-switch">
                                <input type="checkbox" name="enable_user_detail" class="form-check-input" role="switch" id="enableUserDetail" value="1"
                                    <?= ($settings['enable_user_detail'] ?? '1') === '1' ? 'checked' : '' ?>>
                                <label class="form-check-label" for="enableUserDetail">允许点击用户名查看详情</label>
                            </div>

                            <div class="mb-3 form-check form-switch">
                                <input type="checkbox" name="splash_video_enabled" class="form-check-input" role="switch" id="splashVideoEnabled" value="1"
                                    <?= ($settings['splash_video_enabled'] ?? '1') === '1' ? 'checked' : '' ?>>
                                <label class="form-check-label" for="splashVideoEnabled">启用开屏动画</label>
                            </div>

                            <div class="mb-3 form-check form-switch">
                                <input type="checkbox" name="show_statistics" class="form-check-input" role="switch" id="showStatistics" value="1"
                                    <?= ($settings['show_statistics'] ?? '1') === '1' ? 'checked' : '' ?>>
                                <label class="form-check-label" for="showStatistics">显示统计数据（平均分、最高分、最低分）</label>
                            </div>

                            <hr>
                            <h5>安全问题设置</h5>
                            <div class="mb-3">
                                <label class="form-label">安全问题</label>
                                <select name="security_question" class="form-select" id="securityQuestionSelect" required>
                                    <option value="您设置的管理员账号是什么?" <?= ($settings['security_question'] ?? '') === '您设置的管理员账号是什么?' ? 'selected' : '' ?>>您设置的管理员账号是什么?</option>
                                    <option value="您的出生年份是?" <?= ($settings['security_question'] ?? '') === '您的出生年份是?' ? 'selected' : '' ?>>您的出生年份是?</option>
                                    <option value="您最喜欢的颜色是?" <?= ($settings['security_question'] ?? '') === '您最喜欢的颜色是?' ? 'selected' : '' ?>>您最喜欢的颜色是?</option>
                                    <option value="您的小学校名是?" <?= ($settings['security_question'] ?? '') === '您的小学校名是?' ? 'selected' : '' ?>>您的小学校名是?</option>
                                    <option value="custom" <?= ($settings['security_question'] ?? '') === 'custom' || !in_array($settings['security_question'] ?? '', ['您设置的管理员账号是什么?', '您的出生年份是?', '您最喜欢的颜色是?', '您的小学校名是?']) ? 'selected' : '' ?>>自定义问题</option>
                                </select>
                            </div>
                            <div class="mb-3" id="customQuestionDiv" style="display: <?= !in_array($settings['security_question'] ?? '', ['您设置的管理员账号是什么?', '您的出生年份是?', '您最喜欢的颜色是?', '您的小学校名是?']) ? 'block' : 'none' ?>;">
                                <label class="form-label">自定义安全问题</label>
                                <input type="text" name="custom_security_question" class="form-control" id="customQuestionInput" 
                                       value="<?= !in_array($settings['security_question'] ?? '', ['您设置的管理员账号是什么?', '您的出生年份是?', '您最喜欢的颜色是?', '您的小学校名是?']) ? htmlspecialchars($settings['security_question'] ?? '') : '' ?>" 
                                       placeholder="请输入您的安全问题">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">安全答案</label>
                                <input type="text" name="security_answer" class="form-control" 
                                       value="<?= $settings['security_answer'] ?? '' ?>" 
                                       placeholder="请输入安全答案" required>
                                <div class="form-text">安全答案用于重置密码，请务必牢记</div>
                            </div>
                            
                            <button type="submit" class="btn btn-primary">保存设置</button>
                        </form>
                    </div>
                </div>

                <!-- 用户管理 -->
                <div class="card settings-content" id="userManagement" style="display: none;">
                    <div class="card-header">用户管理</div>
                    <div class="card-body">
                        <form method="post" action="?user_management">
                            <div class="mb-3">
                                <label class="form-label">当前用户名</label>
                                <input type="text" class="form-control" value="<?= $_SESSION['username'] ?>" readonly>
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label">新用户名</label>
                                <input type="text" name="new_username" class="form-control" 
                                       placeholder="留空则不修改用户名">
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label">当前密码</label>
                                <input type="password" name="current_password" class="form-control">
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label">新密码</label>
                                <input type="password" name="new_password" class="form-control" 
                                       placeholder="留空则不修改密码">
                            </div>
                            
                            <button type="submit" class="btn btn-primary">保存更改</button>
                        </form>
                    </div>
                </div>

                <!-- 管理员管理 -->
                <div class="card settings-content mt-4" id="adminManagement" style="display: none;">
                    <div class="card-header">管理员管理</div>
                    <div class="card-body">
                        <!-- 添加管理员表单 -->
                        <div class="card mb-4">
                            <div class="card-header">添加管理员</div>
                            <div class="card-body">
                                <form method="post" id="addAdminForm">
                                    <div class="row">
                                        <div class="col-md-4">
                                            <div class="mb-3">
                                                <label class="form-label">管理员用户名</label>
                                                <input type="text" name="admin_username" class="form-control" required>
                                            </div>
                                        </div>
                                        <div class="col-md-4">
                                            <div class="mb-3">
                                                <label class="form-label">密码</label>
                                                <input type="password" name="admin_password" class="form-control" required>
                                            </div>
                                        </div>
                                        <div class="col-md-4">
                                            <div class="mb-3">
                                                <label class="form-label">&nbsp;</label>
                                                <div>
                                                    <button type="submit" class="btn btn-primary">添加管理员</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </div>

                        <!-- 管理员列表 -->
                        <div class="card">
                            <div class="card-header">管理员列表</div>
                            <div class="card-body">
                                <div class="table-responsive">
                                    <table class="table table-striped">
                                        <thead>
                                            <tr>
                                                <th>ID</th>
                                                <th>用户名</th>
                                                <th>创建时间</th>
                                                <th>最后登录</th>
                                                <th>操作</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <?php foreach ($admins as $admin): ?>
                                            <tr>
                                                <td><?= $admin['id'] ?></td>
                                                <td><?= htmlspecialchars($admin['username']) ?></td>
                                                <td><?= date('Y-m-d H:i', strtotime($admin['created_at'])) ?></td>
                                                <td><?= $admin['last_login'] ? date('Y-m-d H:i', strtotime($admin['last_login'])) : '从未登录' ?></td>
                                                <td>
                                                    <?php if ($admin['username'] !== $_SESSION['username']): ?>
                                                        <button type="button" class="btn btn-primary btn-sm me-1" 
                                                                onclick="showEditAdminModal(<?= $admin['id'] ?>, '<?= htmlspecialchars($admin['username']) ?>')">
                                                            <i class="fas fa-edit"></i> 管理
                                                        </button>
                                                        <button type="button" class="btn btn-danger btn-sm" 
                                                                onclick="showDeleteAdminModal(<?= $admin['id'] ?>, '<?= htmlspecialchars($admin['username']) ?>')">
                                                            <i class="fas fa-trash"></i> 删除
                                                        </button>
                                                    <?php else: ?>
                                                        <span class="text-muted">当前用户</span>
                                                    <?php endif; ?>
                                                </td>
                                            </tr>
                                            <?php endforeach; ?>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 其他操作 -->
                <div class="card settings-content" id="otherOperations" style="display: none;">
                    <div class="card-header">其他操作</div>
                    <div class="card-body">
                        <div class="text-center">
                            <button type="button" class="btn btn-primary m-2" data-bs-toggle="modal" data-bs-target="#confirmNewTermModal">切换新学期</button>
                        </div>

                        <!-- 确认新学期切换模态框 -->
                        <div class="modal fade" id="confirmNewTermModal" tabindex="-1" aria-hidden="true">
                            <div class="modal-dialog">
                                <div class="modal-content">
                                    <div class="modal-header">
                                        <h5 class="modal-title">新学期切换选项</h5>
                                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                                    </div>
                                    <div class="modal-body">
                                        <div class="mb-3">
                                            <div class="form-check">
                                                <input class="form-check-input" type="checkbox" id="keepUsers" checked>
                                                <label class="form-check-label" for="keepUsers">
                                                    保留现有用户名单
                                                </label>
                                            </div>
                                        </div>
                                        <div class="mb-3">
                                            <div class="form-check">
                                                <input class="form-check-input" type="checkbox" id="keepRecords">
                                                <label class="form-check-label" for="keepRecords">
                                                    保留历史积分记录
                                                </label>
                                            </div>
                                        </div>
                                        <div class="alert alert-warning">
                                            注意：如果不保留用户名单，将清空所有用户数据！
                                        </div>
                                    </div>
                                    <div class="modal-footer">
                                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                                        <button type="button" class="btn btn-primary" id="confirmNewTermBtn">确认切换</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- 密码验证模态框 -->
                        <div class="modal fade" id="passwordModal" tabindex="-1" aria-hidden="true">
                            <div class="modal-dialog">
                                <div class="modal-content">
                                    <div class="modal-header">
                                        <h5 class="modal-title">管理员验证</h5>
                                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                                    </div>
                                    <div class="modal-body">
                                        <form id="passwordForm">
                                            <div class="mb-3">
                                                <label for="adminPassword" class="form-label">请输入管理员密码</label>
                                                <input type="password" class="form-control" id="adminPassword" required>
                                                <div id="passwordValidation" class="invalid-feedback d-none">
                                                    密码错误，请重试
                                                </div>
                                                <div id="passwordSuccess" class="valid-feedback d-none">
                                                    验证通过
                                                </div>
                                            </div>
                                        </form>
                                    </div>
                                    <div class="modal-footer">
                                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                                        <button type="button" class="btn btn-primary" id="verifyPasswordBtn">验证</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
                        <script>
                        $(document).ready(function() {

                            $('#confirmNewTermBtn').click(function() {
                                const keepUsers = $('#keepUsers').is(':checked');
                                const keepRecords = $('#keepRecords').is(':checked');
                                
                                var confirmModal = bootstrap.Modal.getInstance($('#confirmNewTermModal')[0]);
                                confirmModal.hide();
                                
                                // 显示密码验证模态框
                                var passwordModal = new bootstrap.Modal($('#passwordModal')[0]);
                                passwordModal.show();
                                
                                // 存储选项到全局变量
                                window.newTermOptions = {
                                    keepUsers: keepUsers,
                                    keepRecords: keepRecords
                                };
                            });

                            $('#verifyPasswordBtn').click(function() {
                                const password = $('#adminPassword').val();
                                const $btn = $(this);
                                const originalText = $btn.text();
                                
                                // 清除之前的验证状态
                                $('#passwordValidation').addClass('d-none');
                                $('#passwordSuccess').addClass('d-none');
                                $('#adminPassword').removeClass('is-invalid is-valid');
                                
                                // 显示加载状态
                                $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 验证中...');
                                
                                // 直接使用当前页面的PHP逻辑验证密码
                                $.ajax({
                                    url: 'settings.php',
                                    type: 'POST',
                                    data: { 
                                        verify_password: true,
                                        password: password 
                                    },
                                    success: function(response) {
                                        if(response.success) {
                                            // 密码验证成功
                                            $('#adminPassword').addClass('is-valid');
                                            $('#passwordSuccess').removeClass('d-none');
                                            
                                            // 1秒后执行新学期切换
                                            setTimeout(function() {
                                                $('#passwordModal').modal('hide');
                                                // 显示更明显的成功提示
                                                // 创建并显示toast提示
                                                const toastHtml = `
                                                <div class="position-fixed bottom-0 end-0 p-3" style="z-index: 11">
                                                    <div id="successToast" class="toast show" role="alert" aria-live="assertive" aria-atomic="true">
                                                        <div class="toast-header bg-success text-white">
                                                            <strong class="me-auto">系统提示</strong>
                                                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
                                                        </div>
                                                        <div class="toast-body">
                                                            验证成功！新学期已切换。
                                                        </div>
                                                    </div>
                                                </div>
                                                `;
                                                $('body').append(toastHtml);
                                                // 5秒后自动消失
                                                setTimeout(() => {
                                                    $('#successToast').toast('hide');
                                                }, 5000);
                                                // 执行新学期切换操作
                                                $.ajax({
                                                    url: 'settings.php',
                                                    type: 'POST',
                                                    data: {
                                                        new_term: true,
                                                        keepUsers: window.newTermOptions.keepUsers,
                                                        keepRecords: window.newTermOptions.keepRecords
                                                    },
                                                    success: function() {
                                                        // 刷新页面
                                                        location.reload();
                                                    },
                                                    error: function() {
                                                        alert('新学期切换失败，请重试！');
                                                    }
                                                });
                                            }, 1000);
                                        } else {
                                            // 密码验证失败
                                            $('#adminPassword').addClass('is-invalid');
                                            $('#passwordValidation').removeClass('d-none');
                                        }
                                    },
                                    error: function() {
                                        alert('验证过程中出错，请重试！');
                                    },
                                    complete: function() {
                                        $btn.prop('disabled', false).text(originalText);
                                    }
                                });
                            });
                            
                            // 输入新密码时清除错误状态
                            $('#adminPassword').on('input', function() {
                                $(this).removeClass('is-invalid');
                                $('#passwordValidation').addClass('d-none');
                            });
                        });
                        </script>
                    </div>
                </div>
            </div>
        </div>

        <!-- 删除管理员确认模态框 -->
        <div class="modal fade" id="deleteAdminModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">确认删除管理员</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p>确定要删除管理员 <strong id="deleteAdminName"></strong> 吗？</p>
                        <div class="alert alert-warning">
                            <i class="fas fa-exclamation-triangle"></i>
                            此操作不可撤销，请谨慎操作！
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                        <button type="button" class="btn btn-danger" id="confirmDeleteAdminBtn">确认删除</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- 编辑管理员模态框 -->
        <div class="modal fade" id="editAdminModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">编辑管理员</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <form id="editAdminForm">
                            <div class="mb-3">
                                <label for="editAdminUsername" class="form-label">用户名</label>
                                <input type="text" class="form-control" id="editAdminUsername" required>
                                <div class="form-text">用户名不能重复</div>
                            </div>
                            <div class="mb-3">
                                <label for="editAdminPassword" class="form-label">新密码</label>
                                <input type="password" class="form-control" id="editAdminPassword">
                                <div class="form-text">留空则不修改密码</div>
                            </div>
                            <div class="mb-3">
                                <label for="editAdminConfirmPassword" class="form-label">确认新密码</label>
                                <input type="password" class="form-control" id="editAdminConfirmPassword">
                                <div class="form-text">如需修改密码，请再次输入新密码</div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                        <button type="button" class="btn btn-primary" id="confirmEditAdminBtn">保存修改</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        // 显示删除管理员确认模态框
        function showDeleteAdminModal(adminId, adminName) {
            // 设置要删除的管理员名称
            document.getElementById('deleteAdminName').textContent = adminName;
            
            // 设置确认删除按钮的点击事件
            document.getElementById('confirmDeleteAdminBtn').onclick = function() {
                // 创建表单并提交
                const form = document.createElement('form');
                form.method = 'post';
                form.style.display = 'none';
                
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = 'delete_admin';
                input.value = adminId;
                
                form.appendChild(input);
                document.body.appendChild(form);
                form.submit();
            };
            
            // 显示模态框
            const modal = new bootstrap.Modal(document.getElementById('deleteAdminModal'));
            modal.show();
        }

        // 显示编辑管理员模态框
        function showEditAdminModal(adminId, adminName) {
            // 设置当前管理员信息
            document.getElementById('editAdminUsername').value = adminName;
            document.getElementById('editAdminPassword').value = '';
            document.getElementById('editAdminConfirmPassword').value = '';
            
            // 设置确认编辑按钮的点击事件
            document.getElementById('confirmEditAdminBtn').onclick = function() {
                const username = document.getElementById('editAdminUsername').value.trim();
                const password = document.getElementById('editAdminPassword').value;
                const confirmPassword = document.getElementById('editAdminConfirmPassword').value;
                
                // 验证用户名
                if (!username) {
                    alert('请输入用户名！');
                    return;
                }
                
                // 验证密码
                if (password && password !== confirmPassword) {
                    alert('两次输入的密码不一致！');
                    return;
                }
                
                // 创建表单并提交
                const form = document.createElement('form');
                form.method = 'post';
                form.style.display = 'none';
                
                // 添加管理员ID
                const idInput = document.createElement('input');
                idInput.type = 'hidden';
                idInput.name = 'edit_admin_id';
                idInput.value = adminId;
                
                // 添加用户名
                const usernameInput = document.createElement('input');
                usernameInput.type = 'hidden';
                usernameInput.name = 'edit_admin_username';
                usernameInput.value = username;
                
                form.appendChild(idInput);
                form.appendChild(usernameInput);
                
                // 如果有密码，添加密码字段
                if (password) {
                    const passwordInput = document.createElement('input');
                    passwordInput.type = 'hidden';
                    passwordInput.name = 'edit_admin_password';
                    passwordInput.value = password;
                    form.appendChild(passwordInput);
                }
                
                document.body.appendChild(form);
                form.submit();
            };
            
            // 显示模态框
            const modal = new bootstrap.Modal(document.getElementById('editAdminModal'));
            modal.show();
        }

        // 处理自定义安全问题
        const securityQuestionSelect = document.getElementById('securityQuestionSelect');
        const customQuestionDiv = document.getElementById('customQuestionDiv');
        const customQuestionInput = document.getElementById('customQuestionInput');
        
        if (securityQuestionSelect) {
            securityQuestionSelect.addEventListener('change', function() {
                if (this.value === 'custom') {
                    customQuestionDiv.style.display = 'block';
                    customQuestionInput.required = true;
                } else {
                    customQuestionDiv.style.display = 'none';
                    customQuestionInput.required = false;
                    customQuestionInput.value = '';
                }
            });
        }

        // 侧边栏导航切换
        document.querySelectorAll('#settingsNav .nav-link').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                
                // 移除所有active类
                document.querySelectorAll('#settingsNav .nav-link').forEach(l => l.classList.remove('active'));
                // 添加active类到当前点击的链接
                this.classList.add('active');
                
                // 隐藏所有内容区域
                document.querySelectorAll('.settings-content').forEach(content => content.style.display = 'none');
                
                // 显示对应的内容区域
                const target = this.dataset.target;
                if (target === 'system') {
                    document.getElementById('systemSettings').style.display = 'block';
                } else if (target === 'user') {
                    document.getElementById('userManagement').style.display = 'block';
                } else if (target === 'admin') {
                    document.getElementById('adminManagement').style.display = 'block';
                } else if (target === 'other') {
                    document.getElementById('otherOperations').style.display = 'block';
                }
            });
        });
    </script>

    <?php showFooter(); ?>
</body>
</html>
