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
    <link href="https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.2.3/css/bootstrap.min.css" rel="stylesheet">
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

        <!-- 其他操作部分 -->
        <div class="card mt-4">
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

    <?php showFooter(); ?>
</body>
</html>
