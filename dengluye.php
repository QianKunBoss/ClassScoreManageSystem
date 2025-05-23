<?php
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/functions.php';

// 处理登录逻辑
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['login'])) {
    $inputUsername = $_POST['username'] ?? '';
    $inputPassword = $_POST['password'] ?? '';
    
    $credentialsFile = __DIR__ . '/includes/user_credentials.php';
    if (!file_exists($credentialsFile)) {
        die('用户凭据文件不存在');
    }
    
    include $credentialsFile;
    if (isset($credentials[$inputUsername]) && password_verify($inputPassword, $credentials[$inputUsername])) {
        $_SESSION['loggedin'] = true;
        $_SESSION['username'] = $inputUsername;
        header('Location: admin.php');
        exit;
    } else {
        $loginError = '账号或密码错误';
    }
}
?>

<!DOCTYPE html>
<html>
<head>
    <title>登录</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body>
    <div class="container mt-5">
        <div class="row justify-content-center">
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header">管理员登录</div>
                    <div class="card-body">
                        <form method="post">
                            <div class="mb-3">
                                <label for="username" class="form-label">账号</label>
                                <input type="text" name="username" class="form-control" required>
                            </div>
                            <div class="mb-3">
                                <label for="password" class="form-label">密码</label>
                                <input type="password" name="password" class="form-control" required>
                            </div>
                            <button type="submit" name="login" class="btn btn-primary">登录</button>
                            <?php if (isset($loginError)): ?>
                                <div class="alert alert-danger mt-3"><?= $loginError ?></div>
                            <?php endif; ?>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <script>
    // 设置超时时间（秒）
    const timeout = <?= SESSION_TIMEOUT ?> * 1000; // 转换为毫秒

    let timer;
    const resetTimer = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            window.location.href = 'dengluye.php?logout';
        }, timeout);
    };

    // 监听用户活动
    window.onload = resetTimer;
    window.onmousemove = resetTimer;
    window.onmousedown = resetTimer;
    window.ontouchstart = resetTimer;
    window.onclick = resetTimer;
    window.onkeypress = resetTimer;
    </script>
</body>
</html>
