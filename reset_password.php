<?php
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/functions.php';

// 默认安全问题
$security_question = "您设置的管理员账号是什么?";

// 处理密码重置请求
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['reset_password'])) {
    $username = trim($_POST['username'] ?? '');
    $answer = trim($_POST['security_answer'] ?? '');
    $new_password = $_POST['new_password'] ?? '';
    $confirm_password = $_POST['confirm_password'] ?? '';

    // 验证输入
    $error = '';
    if (empty($username) || empty($answer) || empty($new_password) || empty($confirm_password)) {
        $error = "请填写所有字段";
    } elseif ($new_password !== $confirm_password) {
        $error = "两次输入的密码不一致";
    } elseif (strlen($new_password) < 8) {
        $error = "密码长度至少需要8个字符";
    } elseif ($answer !== $username) {
        $error = "安全问题答案不正确";
    } else {
        // 验证用户存在
        try {
            $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ? AND is_admin = 1");
            $stmt->execute([$username]);
            $user = $stmt->fetch();
            
            if (!$user) {
                $error = "管理员账号不存在";
            } else {
                // 更新密码
                $hashed_password = password_hash($new_password, PASSWORD_DEFAULT);
                
                // 更新数据库中的管理员密码
                $stmt = $pdo->prepare("UPDATE admins SET password_hash = ? WHERE username = ?");
                $stmt->execute([$hashed_password, $username]);
                
                $success = "密码已成功重置";
            }
        } catch (PDOException $e) {
            $error = "数据库错误: " . $e->getMessage();
        }
    }
}
?>

<!DOCTYPE html>
<html>
<head>
    <title>重置密码</title>
    <link href="https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.2.3/css/bootstrap.min.css" rel="stylesheet">
    <link href="assets/css/main.css" rel="stylesheet">
</head>
<body>
    <div class="container mt-5">
        <div class="row justify-content-center">
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header">重置管理员密码</div>
                    <div class="card-body">
                        <?php if (isset($error)): ?>
                            <div class="alert alert-danger"><?= $error ?></div>
                        <?php endif; ?>
                        <?php if (isset($success)): ?>
                            <div class="alert alert-success"><?= $success ?></div>
                        <?php endif; ?>
                        
                        <form method="post">
                            <div class="mb-3">
                                <label for="username" class="form-label">管理员账号</label>
                                <input type="text" name="username" class="form-control" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">安全问题: <?= $security_question ?></label>
                                <input type="text" name="security_answer" class="form-control" required>
                            </div>
                            <div class="mb-3">
                                <label for="new_password" class="form-label">新密码 (至少8个字符)</label>
                                <input type="password" name="new_password" class="form-control" required minlength="8">
                            </div>
                            <div class="mb-3">
                                <label for="confirm_password" class="form-label">确认新密码</label>
                                <input type="password" name="confirm_password" class="form-control" required minlength="8">
                            </div>
                            <button type="submit" name="reset_password" class="btn btn-primary">重置密码</button>
                            <a href="dengluye.php" class="btn btn-link">返回登录</a>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
