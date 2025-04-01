<?php
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/functions.php';

// 处理登录逻辑
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['login'])) {
    $inputUsername = $_POST['username'] ?? '';
    $inputPassword = $_POST['password'] ?? '';

    if ($inputUsername === $username && $inputPassword === $password) {
        $_SESSION['loggedin'] = true;
    } else {
        $loginError = '账号或密码错误';
    }
}

// 处理登出逻辑
if (isset($_GET['logout'])) {
    session_destroy();
    header('Location: index.php');
    exit;
}

$searchResult = [];
if ($_SERVER['REQUEST_METHOD'] === 'GET' && !empty($_GET['q'])) {
    $searchTerm = '%'.trim($_GET['q']).'%';
    
    $stmt = $pdo->prepare("
        SELECT id, username 
        FROM users 
        WHERE username LIKE ? 
        ORDER BY username
        LIMIT 20
    ");
    $stmt->execute([$searchTerm]);
    $searchResult = $stmt->fetchAll();
}
?>

<!DOCTYPE html>
<html>
<head>
    <title>积分查询</title>
    <link href="./css/bootstrap.min.css" rel="stylesheet">
</head>
<body>
    <?php showNav(); ?>
    
    <div class="container mt-4">
        <?php if (isLoggedIn()): ?>
            <div class="alert alert-success">
                欢迎回来，管理员！
                <a href="?logout" class="float-end">登出</a>
            </div>
        <?php else: ?>
            <div class="card mb-4">
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
        <?php endif; ?>

        <div class="card">
            <div class="card-header">积分查询</div>
            <div class="card-body">
                <form method="get">
                    <div class="input-group mb-3">
                        <input type="text" name="q" class="form-control" 
                               placeholder="输入用户名进行查询" value="<?= htmlspecialchars($_GET['q'] ?? '') ?>">
                        <button class="btn btn-primary" type="submit">搜索</button>
                    </div>
                </form>

                <?php if (!empty($searchResult)): ?>
                <div class="list-group">
                    <?php foreach ($searchResult as $user): ?>
                    <a href="./pages/user_search.php?id=<?= $user['id'] ?>" 
                       class="list-group-item list-group-item-action">
                        <?= htmlspecialchars($user['username']) ?>
                    </a>
                    <?php endforeach; ?>
                </div>
                <?php elseif(isset($_GET['q'])): ?>
                <div class="alert alert-warning mt-3">未找到匹配用户</div>
                <?php endif; ?>
            </div>
        </div>
    </div>

    <?php showFooter(); ?>
</body>
</html>