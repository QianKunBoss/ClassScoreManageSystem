<?php
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/functions.php';

if (!isLoggedIn()) {
    header('Location: login.php');
    exit;
}

// 初始化设置表
global $db_type;

if ($db_type === 'sqlite') {
    // SQLite语法
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS system_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            setting_key TEXT UNIQUE,
            setting_value TEXT
        )
    ");
} else {
    // MySQL/MariaDB语法
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS system_settings (
            id INT PRIMARY KEY AUTO_INCREMENT,
            setting_key VARCHAR(255) UNIQUE,
            setting_value TEXT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
}

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
    // 根据数据库类型选择正确的INSERT语法
    if ($db_type === 'sqlite') {
        $sql = "INSERT OR IGNORE INTO system_settings (setting_key, setting_value) VALUES (?, ?)";
    } else {
        $sql = "INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES (?, ?)";
    }
    
    $stmt = $pdo->prepare($sql);
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
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link href="../assets/css/int_main.css" rel="stylesheet">
    

</head>
<body>
    <?php showNav(); ?>
    
    <div class="container mt-4">
        <a href="admin.php" class="btn mb-3 return-button">← 返回管理后台</a>
        
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
                        <nav class="nav flex-column" id="settingsNav" >
                            <a class="nav-link active" href="#" data-target="system">
                                <i class="fas fa-cog me-2"></i>系统设置
                            </a>
                            <a class="nav-link" href="#" data-target="customize">
                                <i class="fas fa-palette me-2"></i>个性化设置
                            </a>
                            <a class="nav-link" href="#" data-target="user">
                                <i class="fas fa-user me-2"></i>用户管理
                            </a>
                            <a class="nav-link" href="#" data-target="admin">
                                <i class="fas fa-user-shield me-2"></i>管理员管理
                            </a>
                            <a class="nav-link" href="#" data-target="database">
                                <i class="fas fa-database me-2"></i>数据库管理
                            </a>
                            <a class="nav-link" href="#" data-target="other">
                                <i class="fas fa-tools me-2"></i>其他操作
                            </a>
                            <a class="nav-link" href="#" data-target="about">
                                <i class="fas fa-info-circle me-2"></i>关于
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
                        <form id="systemSettingsForm">
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
                            
                            <button type="submit" class="btn btn-primary" id="saveSystemSettingsBtn">保存设置</button>
                        </form>
                    </div>
                </div>

                <!-- 个性化设置 -->
                <div class="card settings-content" id="customizeSettings" style="display: none;">
                    <div class="card-header">个性化设置</div>
                    <div class="card-body">
                        <form id="customizeForm">
                            <div class="row">
                                <div class="col-md-6">
                                    <h5 class="mb-3">颜色设置</h5>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">主题色</label>
                                        <div class="input-group">
                                            <input type="color" class="form-control form-control-color" name="primary_color" value="#667eea">
                                            <input type="text" class="form-control" name="primary_color_text" value="#667eea" pattern="^#[0-9A-Fa-f]{6}$">
                                        </div>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">次要颜色</label>
                                        <div class="input-group">
                                            <input type="color" class="form-control form-control-color" name="secondary_color" value="#6c757d">
                                            <input type="text" class="form-control" name="secondary_color_text" value="#6c757d" pattern="^#[0-9A-Fa-f]{6}$">
                                        </div>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">成功色</label>
                                        <div class="input-group">
                                            <input type="color" class="form-control form-control-color" name="success_color" value="#28a745">
                                            <input type="text" class="form-control" name="success_color_text" value="#28a745" pattern="^#[0-9A-Fa-f]{6}$">
                                        </div>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">危险色</label>
                                        <div class="input-group">
                                            <input type="color" class="form-control form-control-color" name="danger_color" value="#dc3545">
                                            <input type="text" class="form-control" name="danger_color_text" value="#dc3545" pattern="^#[0-9A-Fa-f]{6}$">
                                        </div>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">警告色</label>
                                        <div class="input-group">
                                            <input type="color" class="form-control form-control-color" name="warning_color" value="#ffc107">
                                            <input type="text" class="form-control" name="warning_color_text" value="#ffc107" pattern="^#[0-9A-Fa-f]{6}$">
                                        </div>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">信息色</label>
                                        <div class="input-group">
                                            <input type="color" class="form-control form-control-color" name="info_color" value="#17a2b8">
                                            <input type="text" class="form-control" name="info_color_text" value="#17a2b8" pattern="^#[0-9A-Fa-f]{6}$">
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="col-md-6">
                                    <h5 class="mb-3">字体和样式设置</h5>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">字体</label>
                                        <select class="form-select" name="font_family">
                                            <option value="'HarmonyOS Sans SC', sans-serif">HarmonyOS Sans SC black</option>
                                            <option value="'Microsoft YaHei', sans-serif">微软雅黑</option>
                                            <option value="'SimSun', serif">宋体</option>
                                            <option value="'SimHei', sans-serif">黑体</option>
                                            <option value="'KaiTi', serif">楷体</option>
                                            <option value="Arial, sans-serif">Arial</option>
                                            <option value="'Times New Roman', serif">Times New Roman</option>
                                            <option value="Georgia, serif">Georgia</option>
                                            <option value="Verdana, sans-serif">Verdana</option>
                                        </select>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">字体大小 (px)</label>
                                        <input type="range" class="form-range" name="font_size" min="12" max="20" value="16">
                                        <div class="d-flex justify-content-between">
                                            <small>12px</small>
                                            <span id="fontSizeValue">16px</span>
                                            <small>20px</small>
                                        </div>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">圆角大小 (px)</label>
                                        <input type="range" class="form-range" name="border_radius" min="0" max="15" value="5">
                                        <div class="d-flex justify-content-between">
                                            <small>0px</small>
                                            <span id="borderRadiusValue">5px</span>
                                            <small>15px</small>
                                        </div>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">卡片阴影</label>
                                        <select class="form-select" name="card_shadow">
                                            <option value="0">无阴影</option>
                                            <option value="1">轻微阴影</option>
                                            <option value="2">中等阴影</option>
                                            <option value="3">深度阴影</option>
                                        </select>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">导航栏样式</label>
                                        <select class="form-select" name="navbar_style">
                                            <option value="light">浅色</option>
                                            <option value="dark">深色</option>
                                            <option value="primary">主题色</option>
                                        </select>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">卡片背景颜色透明度</label>
                                        <input type="range" class="form-range" name="card_opacity" min="0" max="100" value="95">
                                        <div class="d-flex justify-content-between">
                                            <small>0%（完全透明）</small>
                                            <span id="cardOpacityValue">95%</span>
                                            <small>100%（完全不透明）</small>
                                        </div>
                                        <div class="form-text">调整卡片的背景透明度，使背景图片可见</div>
                                    </div>
                                </div>
                                
                                <!-- 双行分割线 -->
                                <div class="col-md-12">
                                    <div class="double-divider">
                                        <div class="double-divider-line primary"></div>
                                        <div class="double-divider-line secondary"></div>
                                    </div>
                                </div>
                                
                                <div class="col-md-12">
                                    <div class="d-flex justify-content-between align-items-center mb-3">
                                        <h5 class="mb-0">背景图片设置</h5>
                                        <div class="form-check form-switch mb-0">
                                            <input type="checkbox" class="form-check-input" role="switch" id="enableBackgroundImage">
                                            <label class="form-check-label" for="enableBackgroundImage">启用背景图片</label>
                                        </div>
                                    </div>
                                    
                                    <div id="backgroundSettingsContent">
                                        <div class="mb-3">
                                            <label class="form-label">上传背景图片</label>
                                            <div class="input-group">
                                                <input type="file" class="form-control" id="backgroundImageInput" accept="image/jpeg,image/jpg,image/png,image/webp,image/gif">
                                                <button class="btn btn-primary" type="button" id="uploadBackgroundBtn">
                                                    <i class="fas fa-upload"></i> 上传
                                                </button>
                                            </div>
                                            <div class="form-text">支持 JPG、PNG、WebP、GIF 格式，最大 5MB</div>
                                        </div>

                                    <div class="mb-3">
                                        <label class="form-label">添加第三方图片API</label>
                                        <div class="input-group mb-2">
                                            <input type="text" class="form-control" id="thirdPartyApiName" placeholder="API名称（如：必应每日图片）">
                                            <input type="url" class="form-control flex-grow-1" id="thirdPartyApiUrl" placeholder="API图片地址（如：https://picsum.photos/1920/1080）">
                                            <button class="btn btn-success" type="button" id="addThirdPartyApiBtn">
                                                <i class="fas fa-plus"></i> 添加
                                            </button>
                                        </div>
                                        <div class="form-text">支持返回图片URL的第三方API，系统将自动加载API返回的图片</div>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">已上传的背景图片</label>
                                        <div id="backgroundImagesGrid" class="row g-2">
                                            <div class="text-center text-muted">
                                                <div class="spinner-border text-primary" role="status">
                                                    <span class="visually-hidden">加载中...</span>
                                                </div>
                                                <div class="mt-2">加载中...</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="mb-3">
                                        <label class="form-label">第三方图片API</label>
                                        <div id="thirdPartyApiGrid" class="row g-2">
                                            <div class="text-center text-muted">
                                                <div class="spinner-border text-primary" role="status">
                                                    <span class="visually-hidden">加载中...</span>
                                                </div>
                                                <div class="mt-2">加载中...</div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">当前使用的背景图片</label>
                                        <div id="currentBackgroundPreview" class="border rounded p-2">
                                            <div class="text-muted">未选择背景图片</div>
                                        </div>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">背景遮罩透明度</label>
                                        <input type="range" class="form-range" name="background_mask_opacity" min="0" max="100" value="70">
                                        <div class="d-flex justify-content-between">
                                            <small>0%（完全透明）</small>
                                            <span id="backgroundMaskOpacityValue">70%</span>
                                            <small>100%（完全不透明）</small>
                                        </div>
                                        <div class="form-text">调整背景图片的遮罩透明度，使内容更清晰</div>
                                    </div>
                                    </div>
                                </div>
                            </div>
                            
                            <hr>
                            
                            <div class="d-flex justify-content-between">
                                <button type="button" class="btn btn-outline-secondary" id="resetCustomizeBtn">重置为默认</button>
                                <button type="submit" class="btn btn-primary" id="saveCustomizeBtn">保存设置</button>
                            </div>
                        </form>
                    </div>
                </div>

                <!-- 用户管理 -->
                <div class="card settings-content" id="userManagement" style="display: none;">
                    <div class="card-header">用户管理</div>
                    <div class="card-body">
                        <form id="userManagementForm">
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
                                <input type="password" name="current_password" class="form-control" required>
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label">新密码</label>
                                <input type="password" name="new_password" class="form-control" 
                                       placeholder="留空则不修改密码">
                            </div>
                            
                            <button type="submit" class="btn btn-primary" id="saveUserManagementBtn">保存更改</button>
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
                                <form id="addAdminForm">
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
                                                    <button type="submit" class="btn btn-primary" id="addAdminBtn">添加管理员</button>
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
                                    <table class="table table-striped" id="adminsTable">
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
                                            <tr data-admin-id="<?= $admin['id'] ?>">
                                                <td><?= $admin['id'] ?></td>
                                                <td><?= htmlspecialchars($admin['username']) ?></td>
                                                <td><?= date('Y-m-d H:i', strtotime($admin['created_at'])) ?></td>
                                                <td><?= $admin['last_login'] ? date('Y-m-d H:i', strtotime($admin['last_login'])) : '从未登录' ?></td>
                                                <td>
                                                    <?php if ($admin['username'] !== $_SESSION['username']): ?>
                                                        <button type="button" class="btn btn-primary btn-sm me-1 edit-admin-btn" 
                                                                data-admin-id="<?= $admin['id'] ?>" data-admin-username="<?= htmlspecialchars($admin['username']) ?>">
                                                            <i class="fas fa-edit"></i> 管理
                                                        </button>
                                                        <button type="button" class="btn btn-info btn-sm me-1 token-btn" 
                                                                data-admin-id="<?= $admin['id'] ?>" data-admin-username="<?= htmlspecialchars($admin['username']) ?>">
                                                            <i class="fas fa-key"></i> Token
                                                        </button>
                                                        <button type="button" class="btn btn-danger btn-sm delete-admin-btn" 
                                                                data-admin-id="<?= $admin['id'] ?>" data-admin-username="<?= htmlspecialchars($admin['username']) ?>">
                                                            <i class="fas fa-trash"></i> 删除
                                                        </button>
                                                    <?php else: ?>
                                                        <span class="text-muted me-2">当前用户</span>
                                                        <button type="button" class="btn btn-info btn-sm token-btn" 
                                                                data-admin-id="<?= $admin['id'] ?>" data-admin-username="<?= htmlspecialchars($admin['username']) ?>">
                                                            <i class="fas fa-key"></i> Token
                                                        </button>
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
                            <button type="button" class="btn btn-success m-2" data-bs-toggle="modal" data-bs-target="#sqlBackupModal">SQL备份</button>
                        </div>
                    </div>
                </div>

                <!-- 数据库管理 -->
                <div class="card settings-content" id="databaseManagement" style="display: none;">
                    <div class="card-header">
                        <i class="fas fa-database me-2"></i>数据库管理
                    </div>
                    <div class="card-body">
                        <div class="alert alert-danger">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            <strong>危险操作警告：</strong>数据库管理涉及系统核心数据，错误操作可能导致数据丢失或系统故障。请谨慎操作，并在操作前备份数据库！
                        </div>
                        
                        <div class="card mb-3">
                            <div class="card-body">
                                <h5 class="card-title">
                                    <i class="fas fa-server me-2"></i>当前数据库信息
                                </h5>
                                <table class="table">
                                    <tbody>
                                        <tr>
                                            <td><strong>数据库类型</strong></td>
                                            <td>
                                                <span id="currentDbType">检测中...</span>
                                                <span class="badge bg-primary ms-2" id="dbTypeBadge">Active</span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td><strong>数据库状态</strong></td>
                                            <td>
                                                <span class="text-success">
                                                    <i class="fas fa-check-circle me-1"></i>正常运行
                                                </span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td><strong>支持的操作</strong></td>
                                            <td>
                                                <span id="supportedOperations">检测中...</span>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        
                        <div class="alert alert-info">
                            <i class="fas fa-info-circle me-2"></i>
                            <strong>重要说明：</strong>
                            <ul class="mb-0 mt-2">
                                <li>当前系统支持 <strong>SQLite</strong> 和 <strong>MySQL</strong> 两种数据库类型</li>
                                <li>SQLite 适合小型应用，数据存储在文件中，便于备份和迁移</li>
                                <li>MySQL 适合大型应用，支持并发访问，性能更好</li>
                                <li>数据库类型切换需要重新配置系统，请确保已备份所有数据</li>
                            </ul>
                        </div>
                        
                        <div class="text-center">
                            <button type="button" class="btn btn-warning" id="openDatabaseConfigBtn">
                                <i class="fas fa-cog me-1"></i>配置数据库
                            </button>
                            <button type="button" class="btn btn-success" id="openBackupBtn">
                                <i class="fas fa-download me-1"></i>立即备份
                            </button>
                        </div>
                    </div>
                </div>

                <!-- 关于 -->
                <div class="card settings-content" id="aboutContent" style="display: none;">
                    <div class="card-header">关于</div>
                    <div class="card-body">
                        <div class="text-center mb-4">
                            <h3><i class="fas fa-chart-line"></i> 班级操行分管理系统</h3>
                            <p class="text-muted">一个简单高效的班级操行分管理解决方案</p>
                        </div>
                        
                        <div class="row">
                            <div class="col-md-6">
                                <h5><i class="fas fa-info-circle"></i> 系统信息</h5>
                                <table class="table table-bordered">
                                    <tr>
                                        <td><strong>当前版本</strong></td>
                                        <td>
                                            <span id="currentVersionDisplay">v<?= SYSTEM_VERSION ?></span>
                                            <span id="aboutUpdateStatus" class="badge bg-secondary ms-2">检查更新中...</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td><strong>PHP版本</strong></td>
                                        <td><?= PHP_VERSION ?></td>
                                    </tr>
                                    <tr>
                                        <td><strong>数据库</strong></td>
                                        <td><?= $db_type === 'mysql' ? 'MySQL / MariaDB' : 'SQLite' ?></td>
                                    </tr>
                                    <tr>
                                        <td><strong>开发团队</strong></td>
                                        <td>QianKunBoss</td>
                                    </tr>
                                    <tr>
                                        <td><strong>使用字体</strong></td>
                                        <td>HarmonyOS Sans SC Black</td>
                                    </tr>
                                </table>
                            </div>
                            <div class="col-md-6">
                                <h5><i class="fas fa-star"></i> 主要功能</h5>
                                <ul class="list-group">
                                    <li class="list-group-item"><i class="fas fa-check text-success"></i> 用户管理与积分记录</li>
                                    <li class="list-group-item"><i class="fas fa-check text-success"></i> 座位表可视化管理</li>
                                    <li class="list-group-item"><i class="fas fa-check text-success"></i> 积分调整与预设管理</li>
                                    <li class="list-group-item"><i class="fas fa-check text-success"></i> 数据统计与导出</li>
                                    <li class="list-group-item"><i class="fas fa-check text-success"></i> 深色/浅色主题切换</li>
                                    <li class="list-group-item"><i class="fas fa-check text-success"></i> 个性化界面设置</li>
                                </ul>
                            </div>
                        </div>
                        
                        <div class="mt-4">
                            <h5><i class="fas fa-link"></i> 相关链接</h5>
                            <div class="text-center">
                                <a href="https://github.com/QianKunBoss/ClassScoreManageSystem" target="_blank" class="btn btn-outline-primary me-2">
                                    <i class="fab fa-github"></i> GitHub 仓库
                                </a>
                                <a href="https://github.com/QianKunBoss/ClassScoreManageSystem/releases" target="_blank" class="btn btn-outline-secondary">
                                    <i class="fas fa-download"></i> 下载最新版本
                                </a>
                            </div>
                        </div>
                        
                        <div class="mt-4 text-center text-muted">
                            <small>&copy; 2024-2026 班级操行分管理系统. All rights reserved.</small>
                        </div>
                        
                    </div>
                </div>
            </div>
        </div>
                <!-- SQL备份模态框 -->
                <div class="modal fade" id="sqlBackupModal" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">SQL数据库备份</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <div class="alert alert-info">
                                    <i class="fas fa-info-circle"></i>
                                    <strong>说明：</strong>SQL备份将创建包含所有表结构和数据的完整数据库备份文件，可用于数据迁移和恢复。
                                </div>
                                <div class="alert alert-warning">
                                    <i class="fas fa-exclamation-triangle"></i>
                                    <strong>注意：</strong>备份文件包含所有数据，包括用户信息、积分记录、管理员账户和系统设置等敏感数据，请妥善保管！
                                </div>
                                <div class="text-center my-3">
                                    <i class="fas fa-database fa-3x text-primary"></i>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                                <button type="button" class="btn btn-success" id="createBackupBtn">创建备份</button>
                            </div>
                        </div>
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

        <!-- 删除第三方API确认模态框 -->
        <div class="modal fade" id="deleteApiModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">确认删除第三方API</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p>确定要删除第三方API <strong id="deleteApiName"></strong> 吗？</p>
                        <div class="alert alert-warning">
                            <i class="fas fa-exclamation-triangle"></i>
                            此操作不可撤销，请谨慎操作！
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                        <button type="button" class="btn btn-danger" id="confirmDeleteApiBtn">确认删除</button>
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

        <!-- Token管理模态框 -->
        <div class="modal fade" id="tokenModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">API授权Token</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-info">
                            <i class="fas fa-info-circle"></i>
                            <strong>说明：</strong>Token用于API授权验证，调用增删改操作时需要提供此Token。
                        </div>
                        <div class="mb-3">
                            <label for="tokenAdminUsername" class="form-label">管理员</label>
                            <input type="text" class="form-control" id="tokenAdminUsername" readonly>
                        </div>
                        <div class="mb-3">
                            <label for="tokenAdminPassword" class="form-label">验证密码</label>
                            <input type="password" class="form-control" id="tokenAdminPassword" placeholder="请输入该管理员的密码进行验证">
                            <div class="form-text">需要验证管理员密码才能生成或查看Token</div>
                        </div>
                        <div id="tokenDisplayArea" class="mb-3" style="display: none;">
                            <label class="form-label">Token</label>
                            <div class="input-group">
                                <input type="text" class="form-control" id="tokenValue" readonly>
                                <button class="btn btn-outline-secondary" type="button" id="copyTokenBtn">
                                    <i class="fas fa-copy"></i> 复制
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                        <button type="button" class="btn btn-primary" id="viewTokenBtn">
                            <i class="fas fa-eye"></i> 查看Token
                        </button>
                        <button type="button" class="btn btn-success" id="generateTokenBtn">
                            <i class="fas fa-sync-alt"></i> 生成新Token
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="../assets/js/smart_colors.js"></script>
    <script>
    // 显示版本更新模态框
    function showVersionUpdateModal(currentVersion, latestVersion, releaseUrl) {
        // 设置版本信息
        document.getElementById('currentVersionText').textContent = currentVersion;
        document.getElementById('latestVersionText').textContent = latestVersion;
        
        // 设置前往下载按钮的点击事件
        document.getElementById('goToDownloadBtn').onclick = function() {
            window.open(releaseUrl, '_blank');
            // 关闭模态框并清理backdrop
            safeCloseModal('versionUpdateModal');
        };
        
        // 显示模态框
        const modalElement = document.getElementById('versionUpdateModal');
        
        // 强制设置opacity为1，覆盖可能的fade效果
        modalElement.style.opacity = '1';
        
        // 移除所有旧的背景遮罩
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        
        
        // 设置模态框样式
        modalElement.style.display = 'block';
        modalElement.style.zIndex = '1055';
        modalElement.classList.add('show');
        
        // 确保modal-dialog可见
        const modalDialog = modalElement.querySelector('.modal-dialog');
        if (modalDialog) {
            modalDialog.style.opacity = '1';
            modalDialog.style.transform = 'none';
        }
        
        // 使用Bootstrap API
        const modal = new bootstrap.Modal(modalElement, {
            backdrop: true,
            keyboard: true
        });
        modal.show();
    }

    // 设置AJAX全局错误处理
    $(document).ajaxError(function(event, jqxhr, settings, error) {
        if (jqxhr.responseJSON && jqxhr.responseJSON.message) {
            showToast(jqxhr.responseJSON.message, 'error');
        } else if (jqxhr.status === 0) {
            showToast('网络连接错误，请检查网络连接！', 'error');
        } else if (jqxhr.status === 401) {
            showToast('登录已过期，请重新登录！', 'error');
            setTimeout(() => {
                window.location.href = 'login.php';
            }, 2000);
        } else if (jqxhr.status === 500) {
            showToast('服务器内部错误，请稍后重试！', 'error');
        } else {
            showToast('请求失败，请稍后重试！', 'error');
        }
    });
    
    // 显示toast提示
    function showToast(message, type = 'info') {
        const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
        const toastClass = type === 'success' ? 'bg-success' : type === 'error' ? 'bg-danger' : 'bg-info';
        const toastBodyClass = isDarkMode ? 'bg-dark text-white' : '';
        const toastHtml = `
        <div class="position-fixed bottom-0 end-0 p-3" style="z-index: 9999">
            <div class="toast show" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header ${toastClass} text-white">
                    <strong class="me-auto">系统提示</strong>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body ${toastBodyClass}">
                    ${message}
                </div>
            </div>
        </div>
        `;
        
        // 移除现有的toast
        $('.toast').parent().remove();
        
        // 添加新的toast
        $('body').append(toastHtml);
        
        // 5秒后自动消失
        setTimeout(() => {
            $('.toast').toast('hide');
        }, 5000);
    }

    // 显示删除管理员确认模态框
    function showDeleteAdminModal(adminId, adminName) {
        // 设置要删除的管理员名称
        document.getElementById('deleteAdminName').textContent = adminName;
        
        // 设置确认删除按钮的点击事件
        document.getElementById('confirmDeleteAdminBtn').onclick = function() {
            const $btn = $(this);
            const originalText = $btn.text();
            
            // 显示加载状态
            $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 删除中...');
            
            // 使用AJAX删除管理员
            $.ajax({
                url: '../api/admin_management.php',
                type: 'POST',
                data: {
                    action: 'delete_admin',
                    admin_id: adminId
                },
                dataType: 'json',
                success: function(response) {
                    if(response.success) {
                        // 关闭模态框并清理backdrop
                        safeCloseModal('deleteAdminModal');
                        
                        // 从表格中移除该行
                        $(`tr[data-admin-id="${adminId}"]`).fadeOut(300, function() {
                            $(this).remove();
                        });

                        // 显示成功提示
                        showToast(response.message, 'success');
                    } else {
                        showToast(response.message, 'error');
                    }
                },
                error: function() {
                    showToast('删除管理员失败，请重试！', 'error');
                },
                complete: function() {
                    $btn.prop('disabled', false).text(originalText);
                }
            });
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
                showToast('请输入用户名！', 'error');
                return;
            }
            
            // 验证密码
            if (password && password !== confirmPassword) {
                showToast('两次输入的密码不一致！', 'error');
                return;
            }
            
            const $btn = $(this);
            const originalText = $btn.text();
            
            // 显示加载状态
            $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 保存中...');
            
            // 使用AJAX编辑管理员
            $.ajax({
                url: '../api/admin_management.php',
                type: 'POST',
                data: {
                    action: 'edit_admin',
                    admin_id: adminId,
                    admin_username: username,
                    admin_password: password
                },
                dataType: 'json',
                success: function(response) {
                    if(response.success) {
                        // 关闭模态框并清理backdrop
                        safeCloseModal('editAdminModal');
                        
                        // 更新表格中的用户名
                        const $row = $(`tr[data-admin-id="${adminId}"]`);
                        $row.find('td:eq(1)').text(username);
                        
                        // 更新按钮的data属性
                        $row.find('.edit-admin-btn').attr('data-admin-username', username);
                        $row.find('.delete-admin-btn').attr('data-admin-username', username);
                        
                        // 显示成功提示
                        showToast(response.message, 'success');
                    } else {
                        showToast(response.message, 'error');
                    }
                },
                error: function() {
                    showToast('更新管理员失败，请重试！', 'error');
                },
                complete: function() {
                    $btn.prop('disabled', false).text(originalText);
                }
            });
        };
        
        // 显示模态框
        const modal = new bootstrap.Modal(document.getElementById('editAdminModal'));
        modal.show();
    }

    // 显示Token管理模态框
    function showTokenModal(adminId, adminName) {
        // 设置管理员信息
        document.getElementById('tokenAdminUsername').value = adminName;
        document.getElementById('tokenAdminPassword').value = '';
        document.getElementById('tokenDisplayArea').style.display = 'none';
        
        // 清空之前的token显示
        document.getElementById('tokenValue').value = '';
        
        // 设置当前管理员ID
        window.currentAdminId = adminId;
        
        // 查看Token按钮点击事件
        document.getElementById('viewTokenBtn').onclick = function() {
            const password = document.getElementById('tokenAdminPassword').value;
            
            if (!password) {
                showToast('请输入管理员密码！', 'error');
                return;
            }
            
            const $btn = $(this);
            const originalText = $btn.html();
            
            // 显示加载状态
            $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 查看中...');
            
            // 使用AJAX查看Token
            $.ajax({
                url: '../api/admin_management.php',
                type: 'POST',
                data: {
                    action: 'get_token',
                    admin_id: window.currentAdminId,
                    admin_password: password
                },
                dataType: 'json',
                success: function(response) {
                    if(response.success) {
                        // 显示Token
                        document.getElementById('tokenValue').value = response.token;
                        document.getElementById('tokenDisplayArea').style.display = 'block';
                        showToast('Token获取成功！', 'success');
                    } else {
                        showToast(response.message, 'error');
                    }
                },
                complete: function() {
                    $btn.prop('disabled', false).html(originalText);
                }
            });
        };
        
        // 生成新Token按钮点击事件
        document.getElementById('generateTokenBtn').onclick = function() {
            const password = document.getElementById('tokenAdminPassword').value;
            
            if (!password) {
                showToast('请输入管理员密码！', 'error');
                return;
            }
            
            const $btn = $(this);
            const originalText = $btn.html();
            
            // 显示加载状态
            $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 生成中...');
            
            // 使用AJAX生成Token
            $.ajax({
                url: '../api/admin_management.php',
                type: 'POST',
                data: {
                    action: 'generate_token',
                    admin_id: window.currentAdminId,
                    admin_password: password
                },
                dataType: 'json',
                success: function(response) {
                    if(response.success) {
                        // 显示新Token
                        document.getElementById('tokenValue').value = response.token;
                        document.getElementById('tokenDisplayArea').style.display = 'block';
                        showToast('Token生成成功！', 'success');
                    } else {
                        showToast(response.message, 'error');
                    }
                },
                complete: function() {
                    $btn.prop('disabled', false).html(originalText);
                }
            });
        };
        
        // 复制Token按钮点击事件
        document.getElementById('copyTokenBtn').onclick = function() {
            const tokenInput = document.getElementById('tokenValue');
            tokenInput.select();
            document.execCommand('copy');
            showToast('Token已复制到剪贴板！', 'success');
        };
        
        // 显示模态框
        const modal = new bootstrap.Modal(document.getElementById('tokenModal'));
        modal.show();
    }

    // 安全关闭模态框并清理backdrop
    function safeCloseModal(modalId) {
        const modalElement = document.getElementById(modalId);
        if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) {
                modal.hide();
                // 等待动画完成后清理
                setTimeout(() => {
                    // 移除所有backdrop元素
                    document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
                    // 移除body上的modal-open类
                    document.body.classList.remove('modal-open');
                    // 恢复body的overflow
                    document.body.style.overflow = '';
                    document.body.style.paddingRight = '';
                }, 300);
            }
        }
    }

    $(document).ready(function() {
        // 系统设置表单提交
        $('#systemSettingsForm').on('submit', function(e) {
            e.preventDefault();
            
            const $btn = $('#saveSystemSettingsBtn');
            const originalText = $btn.text();
            
            // 显示加载状态
            $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 保存中...');
            
            $.ajax({
                url: '../api/update_system_settings.php',
                type: 'POST',
                data: $(this).serialize(),
                dataType: 'json',
                success: function(response) {
                    if(response.success) {
                        showToast(response.message, 'success');
                    } else {
                        showToast(response.message, 'error');
                    }
                },
                error: function() {
                    showToast('保存系统设置失败，请重试！', 'error');
                },
                complete: function() {
                    $btn.prop('disabled', false).text(originalText);
                }
            });
        });
        
        // 用户管理表单提交
        $('#userManagementForm').on('submit', function(e) {
            e.preventDefault();
            
            const $btn = $('#saveUserManagementBtn');
            const originalText = $btn.text();
            
            // 显示加载状态
            $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 保存中...');
            
            $.ajax({
                url: '../api/update_user_management.php',
                type: 'POST',
                data: $(this).serialize(),
                dataType: 'json',
                success: function(response) {
                    if(response.success) {
                        showToast(response.message, 'success');
                        
                        // 如果用户名被更新，更新页面显示
                        if(response.new_username) {
                            $('.navbar-brand').text(response.new_username);
                            // 更新当前用户名显示
                            $('#userManagementForm input[readonly]').val(response.new_username);
                        }
                    } else {
                        showToast(response.message, 'error');
                    }
                },
                error: function() {
                    showToast('保存用户信息失败，请重试！', 'error');
                },
                complete: function() {
                    $btn.prop('disabled', false).text(originalText);
                }
            });
        });
        
        // 添加管理员表单提交
        $('#addAdminForm').on('submit', function(e) {
            e.preventDefault();
            
            const $btn = $('#addAdminBtn');
            const originalText = $btn.text();
            
            // 显示加载状态
            $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 添加中...');
            
            $.ajax({
                url: '../api/admin_management.php',
                type: 'POST',
                data: {
                    action: 'add_admin',
                    admin_username: $('input[name="admin_username"]').val(),
                    admin_password: $('input[name="admin_password"]').val()
                },
                dataType: 'json',
                success: function(response) {
                    if(response.success) {
                        showToast(response.message, 'success');
                        
                        // 清空表单
                        $(this)[0].reset();
                        
                        // 刷新管理员列表
                        refreshAdminsList();
                    } else {
                        showToast(response.message, 'error');
                    }
                }.bind(this),
                error: function() {
                    showToast('添加管理员失败，请重试！', 'error');
                },
                complete: function() {
                    $btn.prop('disabled', false).text(originalText);
                }
            });
        });
        
        // 刷新管理员列表
        function refreshAdminsList() {
            $.ajax({
                url: '../api/admin_management.php',
                type: 'GET',
                data: { action: 'get_admins' },
                dataType: 'json',
                success: function(response) {
                    if(response.success) {
                        const $tbody = $('#adminsTable tbody');
                        $tbody.empty();
                        
                        response.admins.forEach(function(admin) {
                            const buttons = admin.is_current ? 
                                `<span class="text-muted me-2">当前用户</span>
                                <button type="button" class="btn btn-info btn-sm token-btn" 
                                        data-admin-id="${admin.id}" data-admin-username="${admin.username}">
                                    <i class="fas fa-key"></i> Token
                                </button>` :
                                `<button type="button" class="btn btn-primary btn-sm me-1 edit-admin-btn" 
                                        data-admin-id="${admin.id}" data-admin-username="${admin.username}">
                                    <i class="fas fa-edit"></i> 管理
                                </button>
                                <button type="button" class="btn btn-info btn-sm me-1 token-btn" 
                                        data-admin-id="${admin.id}" data-admin-username="${admin.username}">
                                    <i class="fas fa-key"></i> Token
                                </button>
                                <button type="button" class="btn btn-danger btn-sm delete-admin-btn" 
                                        data-admin-id="${admin.id}" data-admin-username="${admin.username}">
                                    <i class="fas fa-trash"></i> 删除
                                </button>`;
                            
                            $tbody.append(`
                                <tr data-admin-id="${admin.id}">
                                    <td>${admin.id}</td>
                                    <td>${admin.username}</td>
                                    <td>${admin.created_at}</td>
                                    <td>${admin.last_login}</td>
                                    <td>${buttons}</td>
                                </tr>
                            `);
                        });
                        
                        // 重新绑定事件
                        bindAdminButtons();
                    }
                },
                error: function() {
                    showToast('刷新管理员列表失败，请重试！', 'error');
                }
            });
        }
        
        // 绑定管理员按钮事件
        function bindAdminButtons() {
            $('.edit-admin-btn').off('click').on('click', function() {
                const adminId = $(this).data('admin-id');
                const adminUsername = $(this).data('admin-username');
                showEditAdminModal(adminId, adminUsername);
            });
            
            $('.token-btn').off('click').on('click', function() {
                const adminId = $(this).data('admin-id');
                const adminUsername = $(this).data('admin-username');
                showTokenModal(adminId, adminUsername);
            });
            
            $('.delete-admin-btn').off('click').on('click', function() {
                const adminId = $(this).data('admin-id');
                const adminUsername = $(this).data('admin-username');
                showDeleteAdminModal(adminId, adminUsername);
            });
        }
        
        // 初始绑定
        bindAdminButtons();

        // 新学期切换
        $('#confirmNewTermBtn').click(function() {
            const keepUsers = $('#keepUsers').is(':checked');
            const keepRecords = $('#keepRecords').is(':checked');
            
            // 关闭新学期确认模态框并清理backdrop
            safeCloseModal('confirmNewTermModal');
            
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
            
            // 使用新的API端点验证密码
            $.ajax({
                url: '../api/new_term_switch.php',
                type: 'POST',
                data: { 
                    action: 'verify_password',
                    password: password 
                },
                dataType: 'json',
                success: function(response) {
                    if(response.success) {
                        // 密码验证成功
                        $('#adminPassword').addClass('is-valid');
                        $('#passwordSuccess').removeClass('d-none');
                        
                        // 1秒后执行新学期切换
                        setTimeout(function() {
                            // 关闭密码验证模态框并清理backdrop
                            safeCloseModal('passwordModal');
                            // 显示更明显的成功提示
                            showToast('验证成功！正在切换新学期...', 'success');
                            
                            // 执行新学期切换操作
                            $.ajax({
                                url: '../api/new_term_switch.php',
                                type: 'POST',
                                data: {
                                    action: 'switch_term',
                                    keepUsers: window.newTermOptions.keepUsers,
                                    keepRecords: window.newTermOptions.keepRecords
                                },
                                dataType: 'json',
                                success: function(response) {
                                    if(response.success) {
                                        showToast('新学期切换成功！页面即将刷新...', 'success');
                                        setTimeout(() => {
                                            location.reload();
                                        }, 2000);
                                    } else {
                                        showToast('新学期切换失败：' + response.message, 'error');
                                    }
                                },
                                error: function() {
                                    showToast('新学期切换失败，请重试！', 'error');
                                }
                            });
                        }, 1000);
                    } else {
                        // 密码验证失败
                        $('#adminPassword').addClass('is-invalid');
                        $('#passwordValidation').removeClass('d-none');
                        $('#passwordValidation').text(response.message || '密码错误，请重试');
                    }
                },
                error: function() {
                    showToast('验证过程中出错，请重试！', 'error');
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
        
        // SQL备份功能
        $('#createBackupBtn').click(function() {
            const $btn = $(this);
            const originalText = $btn.text();
            
            // 显示加载状态
            $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 备份中...');
            
            // 创建备份
            $.ajax({
                url: '../api/sql_backup.php',
                type: 'POST',
                data: {
                    action: 'create_backup'
                },
                dataType: 'json',
                success: function(response) {
                    if(response.success) {
                        // 关闭模态框并清理backdrop
                        safeCloseModal('sqlBackupModal');
                        
                        // 显示成功提示
                        showToast('SQL备份创建成功！正在下载...', 'success');
                        
                        // 下载备份文件
                        setTimeout(function() {
                            window.location.href = '../' + response.filename;
                        }, 1000);
                    } else {
                        showToast(response.message, 'error');
                    }
                },
                error: function() {
                    showToast('创建SQL备份失败，请重试！', 'error');
                },
                complete: function() {
                    $btn.prop('disabled', false).text(originalText);
                }
            });
        });
        
        // 关于页版本检查函数
        function checkAboutVersionUpdate() {
            const updateStatus = $('#aboutUpdateStatus');
            
            if (!updateStatus.length) return;
            
            // 显示检查中状态
            updateStatus.html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 检查中...');
            
            $.ajax({
                url: '../api/check_version.php',
                type: 'GET',
                dataType: 'json',
                timeout: 10000,
                success: function(response) {
                    if (response.success) {
                        if (response.has_update) {
                            updateStatus
                                .text('有新版本可用')
                                .removeClass('badge bg-success badge-danger')
                                .addClass('badge bg-warning')
                                .attr('title', '最新版本: v' + response.latest_version)
                                .css('cursor', 'pointer')
                                .off('click')
                                .on('click', function() {
                                    showVersionUpdateModal(response.current_version, response.latest_version, response.release_url);
                                });
                        } else {
                            updateStatus
                                .text('已是最新版本')
                                .removeClass('badge bg-warning badge-danger')
                                .addClass('badge bg-success')
                                .css('cursor', 'default')
                                .off('click');
                        }
                    } else {
                        throw new Error(response.error || '检查失败');
                    }
                },
                error: function(xhr, status, error) {
                    updateStatus
                        .text('检查失败')
                        .removeClass('badge bg-success badge-warning')
                        .addClass('badge bg-danger')
                        .css('cursor', 'default')
                        .attr('title', '无法连接到更新服务器')
                        .off('click');
                }
            });
        }
        
        // 当切换到"关于"选项卡时检查版本
        $('a[data-target="about"]').on('click', function() {
            // 延迟检查，等待选项卡切换完成
            setTimeout(checkAboutVersionUpdate, 300);
        });
    });
    </script>

    <script>
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
                } else if (target === 'customize') {
                    document.getElementById('customizeSettings').style.display = 'block';
                } else if (target === 'user') {
                    document.getElementById('userManagement').style.display = 'block';
                } else if (target === 'admin') {
                    document.getElementById('adminManagement').style.display = 'block';
                } else if (target === 'database') {
                    document.getElementById('databaseManagement').style.display = 'block';
                    loadDatabaseInfo();
                } else if (target === 'other') {
                    document.getElementById('otherOperations').style.display = 'block';
                } else if (target === 'about') {
                    document.getElementById('aboutContent').style.display = 'block';
                }
            });
        });
        
        // 表单验证增强
        function validateForm(formId) {
            const form = document.getElementById(formId);
            const inputs = form.querySelectorAll('input[required], select[required]');
            let isValid = true;
            
            inputs.forEach(input => {
                // 只验证可见的字段
                if (input.offsetParent !== null && !input.value.trim()) {
                    input.classList.add('is-invalid');
                    isValid = false;
                } else {
                    input.classList.remove('is-invalid');
                }
            });
            
            return isValid;
        }
        
        // 数据库配置表单专用验证
        function validateDatabaseConfigForm() {
            const dbType = $('#dbType').val();
            let isValid = true;
            
            if (dbType === 'mysql') {
                // 验证MySQL配置字段
                const mysqlFields = ['dbHost', 'dbPort', 'dbName', 'dbUser'];
                mysqlFields.forEach(fieldId => {
                    const field = document.getElementById(fieldId);
                    if (field && !field.value.trim()) {
                        field.classList.add('is-invalid');
                        isValid = false;
                    } else if (field) {
                        field.classList.remove('is-invalid');
                    }
                });
            } else if (dbType === 'sqlite') {
                // 验证SQLite配置字段
                const dbFile = document.getElementById('dbFile');
                if (dbFile && !dbFile.value.trim()) {
                    dbFile.classList.add('is-invalid');
                    isValid = false;
                } else if (dbFile) {
                    dbFile.classList.remove('is-invalid');
                }
            }
            
            return isValid;
        }
        
        // 添加表单验证
        document.getElementById('systemSettingsForm').addEventListener('submit', function(e) {
            if (!validateForm('systemSettingsForm')) {
                e.preventDefault();
                showToast('请填写所有必填字段！', 'error');
            }
        });
        
        document.getElementById('userManagementForm').addEventListener('submit', function(e) {
            if (!validateForm('userManagementForm')) {
                e.preventDefault();
                showToast('请填写当前密码！', 'error');
            }
        });
        
        document.getElementById('addAdminForm').addEventListener('submit', function(e) {
            if (!validateForm('addAdminForm')) {
                e.preventDefault();
                showToast('请填写所有必填字段！', 'error');
            }
        });
        
        // 清除输入时的错误状态
        document.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('input', function() {
                this.classList.remove('is-invalid');
            });
        });
        
        // 数据库配置表单输入监听
        document.querySelectorAll('#databaseConfigForm input, #databaseConfigForm select').forEach(input => {
            input.addEventListener('input', function() {
                this.classList.remove('is-invalid');
            });
        });
        
        // 密码强度检查
        function checkPasswordStrength(password) {
            if (password.length < 6) return 'weak';
            if (password.length < 8) return 'medium';
            if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) return 'medium';
            return 'strong';
        }
        
        // 添加密码强度指示器
        document.querySelectorAll('input[type="password"]').forEach(input => {
            if (input.id.includes('password') && !input.id.includes('current')) {
                const strengthIndicator = document.createElement('div');
                strengthIndicator.className = 'password-strength mt-1';
                strengthIndicator.innerHTML = '<small class="text-muted">密码强度: <span></span></small>';
                input.parentNode.appendChild(strengthIndicator);
                
                input.addEventListener('input', function() {
                    const strength = checkPasswordStrength(this.value);
                    const strengthText = strengthIndicator.querySelector('span');
                    const strengthClass = strength === 'weak' ? 'text-danger' : 
                                         strength === 'medium' ? 'text-warning' : 'text-success';
                    
                    strengthText.textContent = strength === 'weak' ? '弱' : 
                                             strength === 'medium' ? '中' : '强';
                    strengthText.className = strengthClass;
                });
            }
        });
    </script>



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

    <!-- 数据库配置密码验证模态框 -->
    <div class="modal fade" id="databasePasswordModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">
                        <i class="fas fa-lock me-2"></i>管理员验证
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        <strong>安全验证：</strong>数据库管理涉及系统核心数据，需要验证管理员密码以确保操作安全。
                    </div>
                    <form id="databasePasswordForm">
                        <div class="mb-3">
                            <label for="databaseAdminPassword" class="form-label">请输入管理员密码</label>
                            <input type="password" class="form-control" id="databaseAdminPassword" required>
                            <div id="databasePasswordValidation" class="invalid-feedback d-none">
                                密码错误，请重试
                            </div>
                            <div id="databasePasswordSuccess" class="valid-feedback d-none">
                                验证通过
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                    <button type="button" class="btn btn-primary" id="databaseVerifyPasswordBtn">验证</button>
                </div>
            </div>
        </div>
    </div>

    <!-- 数据库配置模态框 -->
    <div class="modal fade" id="databaseConfigModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">
                        <i class="fas fa-cog me-2"></i>数据库配置
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        <strong>重要警告：</strong>更改数据库配置是一个危险操作，可能导致数据丢失！请确保：
                        <ul class="mb-0 mt-2">
                            <li>已备份当前数据库</li>
                            <li>了解新数据库的配置要求</li>
                            <li>准备好数据库迁移方案</li>
                        </ul>
                    </div>
                    
                    <form id="databaseConfigForm">
                        <div class="mb-3">
                            <label for="dbType" class="form-label">数据库类型</label>
                            <select class="form-select" id="dbType" required>
                                <option value="sqlite">SQLite (文件数据库)</option>
                                <option value="mysql">MySQL (服务器数据库)</option>
                            </select>
                            <div class="form-text">
                                SQLite适合小型应用，MySQL适合大型应用
                            </div>
                        </div>
                        
                        <!-- MySQL配置 -->
                        <div id="mysqlConfig" style="display: none;">
                            <h6 class="mb-3">MySQL数据库配置</h6>
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label for="dbHost" class="form-label">主机地址</label>
                                    <input type="text" class="form-control" id="dbHost" value="localhost" required>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label for="dbPort" class="form-label">端口</label>
                                    <input type="number" class="form-control" id="dbPort" value="3306" required>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label for="dbName" class="form-label">数据库名称</label>
                                    <input type="text" class="form-control" id="dbName" required>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label for="dbCharset" class="form-label">字符集</label>
                                    <select class="form-select" id="dbCharset">
                                        <option value="utf8mb4">utf8mb4 (推荐)</option>
                                        <option value="utf8">utf8</option>
                                        <option value="gbk">gbk</option>
                                    </select>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label for="dbUser" class="form-label">用户名</label>
                                    <input type="text" class="form-control" id="dbUser" required>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label for="dbPass" class="form-label">密码</label>
                                    <input type="password" class="form-control" id="dbPass">
                                </div>
                            </div>
                        </div>
                        
                        <!-- SQLite配置 -->
                        <div id="sqliteConfig">
                            <h6 class="mb-3">SQLite数据库配置</h6>
                            <div class="mb-3">
                                <label for="dbFile" class="form-label">数据库文件路径</label>
                                <input type="text" class="form-control" id="dbFile" value="../database/class_score.db" required>
                                <div class="form-text">
                                    相对于配置文件的路径，通常使用 ../database/class_score.db
                                </div>
                            </div>
                            <div class="alert alert-info">
                                <i class="fas fa-info-circle me-2"></i>
                                <strong>提示：</strong>SQLite数据库将数据存储在单个文件中，便于备份和迁移。系统会自动创建不存在的数据库文件。
                            </div>
                        </div>
                        
                        <div class="form-check mb-3">
                            <input class="form-check-input" type="checkbox" id="confirmDangerous" required>
                            <label class="form-check-label" for="confirmDangerous">
                                我已备份数据库，了解风险并继续
                            </label>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                    <button type="button" class="btn btn-warning" id="saveDatabaseConfigBtn">
                        <i class="fas fa-save me-1"></i>保存配置
                    </button>
                </div>
            </div>
        </div>
    </div>

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
        // 数据库管理功能
        // 加载数据库信息
        function loadDatabaseInfo() {
            $('#currentDbType').html('<span class="spinner-border spinner-border-sm"></span> 检测中...');
            $('#supportedOperations').html('<span class="spinner-border spinner-border-sm"></span> 检测中...');
            
            $.ajax({
                url: '../api/get_database_info.php',
                type: 'GET',
                dataType: 'json',
                success: function(response) {
                    if (response.success) {
                        const dbType = response.database_type === 'sqlite' ? 'SQLite' : 'MySQL';
                        $('#currentDbType').text(dbType);
                        $('#dbTypeBadge').text(dbType);
                        
                        const operations = response.database_type === 'sqlite' 
                            ? '数据备份、数据迁移、数据库修复' 
                            : '数据备份、数据迁移、数据库优化';
                        $('#supportedOperations').text(operations);
                    } else {
                        $('#currentDbType').text('检测失败');
                        $('#supportedOperations').text('检测失败');
                    }
                },
                error: function() {
                    $('#currentDbType').text('检测失败');
                    $('#supportedOperations').text('检测失败');
                }
            });
        }

        // 打开数据库配置（需要密码验证）
        $('#openDatabaseConfigBtn').click(function() {
            // 清空密码输入框
            $('#databaseAdminPassword').val('');
            $('#databasePasswordValidation').addClass('d-none');
            $('#databasePasswordSuccess').addClass('d-none');
            $('#databaseAdminPassword').removeClass('is-invalid is-valid');
            
            // 显示密码验证模态框
            const passwordModal = new bootstrap.Modal(document.getElementById('databasePasswordModal'));
            passwordModal.show();
        });

        // 验证管理员密码
        $('#databaseVerifyPasswordBtn').click(function() {
            const password = $('#databaseAdminPassword').val();
            const $btn = $(this);
            const originalText = $btn.text();
            
            if (!password) {
                showToast('请输入管理员密码！', 'error');
                return;
            }
            
            // 显示加载状态
            $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 验证中...');
            
            $.ajax({
                url: '../api/verify_admin_password.php',
                type: 'POST',
                data: {
                    password: password
                },
                dataType: 'json',
                success: function(response) {
                    if (response.success) {
                        $('#databaseAdminPassword').addClass('is-valid');
                        $('#databasePasswordSuccess').removeClass('d-none');
                        
                        // 验证成功，打开数据库配置模态框
                        setTimeout(function() {
                            // 关闭密码验证模态框
                            safeCloseModal('databasePasswordModal');
                            
                            // 加载当前配置
                            loadCurrentDatabaseConfig();
                            
                            // 显示数据库配置模态框
                            const configModal = new bootstrap.Modal(document.getElementById('databaseConfigModal'));
                            configModal.show();
                        }, 1000);
                    } else {
                        $('#databaseAdminPassword').addClass('is-invalid');
                        $('#databasePasswordValidation').removeClass('d-none');
                        $('#databasePasswordValidation').text(response.message || '密码错误，请重试');
                    }
                },
                error: function() {
                    showToast('验证过程中出错，请重试！', 'error');
                },
                complete: function() {
                    $btn.prop('disabled', false).text(originalText);
                }
            });
        });

        // 加载当前数据库配置
        function loadCurrentDatabaseConfig() {
            $.ajax({
                url: '../api/get_database_info.php',
                type: 'GET',
                dataType: 'json',
                success: function(response) {
                    if (response.success) {
                        const dbType = response.database_type;
                        
                        // 设置数据库类型
                        $('#dbType').val(dbType);
                        
                        // 根据数据库类型显示/隐藏配置区域
                        if (dbType === 'mysql') {
                            $('#mysqlConfig').show();
                            $('#sqliteConfig').hide();
                            
                            // 填充MySQL配置
                            $('#dbHost').val(response.config.host || 'localhost');
                            $('#dbPort').val(response.config.port || 3306);
                            $('#dbName').val(response.config.dbname || '');
                            $('#dbCharset').val(response.config.charset || 'utf8mb4');
                            $('#dbUser').val(response.config.user || '');
                        } else {
                            $('#mysqlConfig').hide();
                            $('#sqliteConfig').show();
                            
                            // 填充SQLite配置
                            $('#dbFile').val(response.config.file || '../database/class_score.db');
                        }
                    }
                },
                error: function() {
                    showToast('加载数据库配置失败！', 'error');
                }
            });
        }

        // 数据库类型切换
        $('#dbType').on('change', function() {
            const dbType = $(this).val();
            
            // 清除所有数据库配置字段的错误状态
            document.querySelectorAll('#mysqlConfig input, #sqliteConfig input').forEach(input => {
                input.classList.remove('is-invalid');
            });
            
            if (dbType === 'mysql') {
                $('#mysqlConfig').show();
                $('#sqliteConfig').hide();
            } else {
                $('#mysqlConfig').hide();
                $('#sqliteConfig').show();
            }
        });

        // 保存数据库配置
        $('#saveDatabaseConfigBtn').click(function() {
            if (!validateDatabaseConfigForm()) {
                showToast('请填写所选数据库类型的必填字段！', 'error');
                return;
            }

            if (!$('#confirmDangerous').is(':checked')) {
                showToast('请确认已备份数据库并了解风险！', 'error');
                return;
            }

            const $btn = $(this);
            const originalText = $btn.html();
            
            // 显示加载状态
            $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 保存中...');
            
            const config = {
                type: $('#dbType').val()
            };
            
            if (config.type === 'mysql') {
                config.host = $('#dbHost').val();
                config.port = $('#dbPort').val();
                config.dbname = $('#dbName').val();
                config.charset = $('#dbCharset').val();
                config.user = $('#dbUser').val();
                config.pass = $('#dbPass').val();
            } else {
                config.file = $('#dbFile').val();
            }

            $.ajax({
                url: '../api/update_database_config.php',
                type: 'POST',
                data: {
                    config: JSON.stringify(config)
                },
                dataType: 'json',
                success: function(response) {
                    if (response.success) {
                        showToast('数据库配置保存成功！系统将重新启动...', 'success');
                        setTimeout(function() {
                            // 关闭模态框
                            safeCloseModal('databaseConfigModal');
                            // 刷新页面
                            location.reload();
                        }, 2000);
                    } else {
                        showToast('保存失败：' + response.message, 'error');
                    }
                },
                error: function() {
                    showToast('保存失败，请重试！', 'error');
                },
                complete: function() {
                    $btn.prop('disabled', false).html(originalText);
                }
            });
        });

        // 立即备份按钮
        $('#openBackupBtn').click(function() {
            $('#sqlBackupModal').modal('show');
        });

        // 输入密码时清除错误状态
        $('#databaseAdminPassword').on('input', function() {
            $(this).removeClass('is-invalid');
            $('#databasePasswordValidation').addClass('d-none');
        });
    </script>

    <script src="../pages/settings_customize.js"></script>

    <!-- Bootstrap Bundle (备用CDN) -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/js/bootstrap.bundle.min.js" crossorigin="anonymous"></script>
    <script>
        // 如果CDN加载失败，使用备用CDN
        if (typeof bootstrap === 'undefined') {
            document.write('<script src="https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.2.3/js/bootstrap.bundle.min.js"><\/script>');
        }
    </script>

    <?php showFooter(); ?>
</body>
</html>
