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
];

foreach ($defaultSettings as $key => $value) {
    $stmt = $pdo->prepare("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES (?, ?)");
    $stmt->execute([$key, $value]);
}

// 处理表单提交
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // 处理系统设置表单
    if (!isset($_GET['user_management'])) {
        // 处理文本输入
        $textSettings = ['system_title', 'nav_title'];
        foreach ($textSettings as $key) {
            if (isset($_POST[$key])) {
                $stmt = $pdo->prepare("UPDATE system_settings SET setting_value = ? WHERE setting_key = ?");
                $stmt->execute([htmlspecialchars($_POST[$key]), $key]);
            }
        }
        
        // 处理开关输入
        $switchSettings = ['show_ranking', 'show_search', 'enable_user_detail', 'splash_video_enabled'];
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
?>

<!DOCTYPE html>
<html>
<head>
    <title>系统设置</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="../assets/css/main.css" rel="stylesheet">
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

        <div class="card">
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
                    
                    <button type="submit" class="btn btn-primary">保存设置</button>
                </form>
            </div>
        </div>

        <!-- 用户管理部分 -->
        <div class="card mt-4">
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
    </div>

    <?php showFooter(); ?>
</body>
</html>
