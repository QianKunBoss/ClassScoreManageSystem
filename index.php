<?php
// 检查是否已安装
if (!file_exists(__DIR__ . '/includes/config.php')) {
    if (is_dir(__DIR__ . '/install')) {
        header('Location: install/');
        exit;
    } else {
        die('<div class="alert alert-danger">系统未安装且安装目录不存在，请联系管理员</div>');
    }
}

require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/functions.php';
// 处理登录逻辑
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['login'])) {
    $inputUsername = $_POST['username'] ?? '';
    $inputPassword = $_POST['password'] ?? '';
    
    try {
        // 从数据库验证管理员
        $stmt = $pdo->prepare("SELECT id, password_hash FROM admins WHERE username = ?");
        $stmt->execute([$inputUsername]);
        $admin = $stmt->fetch();
        
        if ($admin && password_verify($inputPassword, $admin['password_hash'])) {
            $_SESSION['loggedin'] = true;
            $_SESSION['username'] = $inputUsername;
            
            // 更新最后登录时间
            $pdo->prepare("UPDATE admins SET last_login = NOW() WHERE id = ?")
                ->execute([$admin['id']]);
        } else {
            $loginError = '账号或密码错误';
        }
    } catch (PDOException $e) {
        $loginError = '系统错误，请稍后再试';
        error_log("登录错误: " . $e->getMessage());
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
<?php if ($pdo->query("SELECT setting_value FROM system_settings WHERE setting_key = 'splash_video_enabled'")->fetchColumn() !== '0'): ?>
<!-- 开屏动画视频 -->
<div id="splash-video-container">
    <video id="splash-video" autoplay muted>
    <source src="assets/videos/splash.mp4" type="video/mp4">
    <source src="assets/videos/splash.webm" type="video/webm">
        您的浏览器不支持视频标签。
    </video>
</div>
<?php endif; ?>
    <script src="assets/js/main.js"></script>

<html>
<head>
    <title><?= htmlspecialchars($pdo->query("SELECT setting_value FROM system_settings WHERE setting_key = 'system_title'")->fetchColumn() ?: '积分查询') ?></title>
    <link href="https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.2.3/css/bootstrap.min.css" rel="stylesheet">
    <link href="assets/css/main.css" rel="stylesheet">
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

    <?php
    // 获取显示设置
    $showRanking = $pdo->query("SELECT setting_value FROM system_settings WHERE setting_key = 'show_ranking'")->fetchColumn() ?? '1';
    $showSearch = $pdo->query("SELECT setting_value FROM system_settings WHERE setting_key = 'show_search'")->fetchColumn() ?? '1';
    
    // 调试信息
    //echo '<div class="alert alert-info">';
    //echo '当前设置 - 显示排名: ' . ($showRanking === '1' ? '是' : '否') . ', ';
    //echo '显示搜索: ' . ($showSearch === '1' ? '是' : '否');
    //echo '</div>';
    ?>

    <?php if ($showSearch === '1'): ?>
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
    <?php endif; ?>

    <?php if ($showSearch === '1'): ?>
        <?php if (!empty($searchResult)): ?>
        <div class="list-group mb-4">
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
    <?php endif; ?>

    <?php if ($showRanking === '1'): ?>
    <!-- 添加积分排名表格 -->
    <h3 class="my-4">学生操行分排名（TOP 20）</h3>
    <?php
    $ranking = $pdo->query("
        SELECT 
            u.id, 
            u.username, 
            SUM(sl.score_change) AS total_score,
            SUM(CASE WHEN sl.score_change > 0 THEN sl.score_change ELSE 0 END) AS add_score,
            SUM(CASE WHEN sl.score_change < 0 THEN sl.score_change ELSE 0 END) AS deduct_score
        FROM users u
        LEFT JOIN score_logs sl ON u.id = sl.user_id
        GROUP BY u.id
        ORDER BY total_score DESC
        LIMIT 20
    ")->fetchAll();
    ?>
    
    <table class="table table-striped">
        <thead>
            <tr>
                <th>排名</th>
                <th>用户名</th>
                <th>总积分</th>
                <th>已加分数</th>
                <th>已扣分数</th>
            </tr>
        </thead>
        <tbody>
            <?php foreach ($ranking as $index => $user): ?>
            <tr>
                <td><?= $index+1 ?></td>
                <td>
                    <?php 
                    $enableUserDetail = $pdo->query("SELECT setting_value FROM system_settings WHERE setting_key = 'enable_user_detail'")->fetchColumn() ?? '1';
                    $medal = '';
                    if ($index+1 === 1) $medal = '🥇 ';
                    elseif ($index+1 === 2) $medal = '🥈 ';
                    elseif ($index+1 === 3) $medal = '🥉 ';
                    
                    if ($enableUserDetail === '1'): ?>
                        <a href="./pages/user_search.php?id=<?= $user['id'] ?>">
                            <?= $medal . htmlspecialchars($user['username']) ?>
                        </a>
                    <?php else: ?>
                        <?= $medal . htmlspecialchars($user['username']) ?>
                    <?php endif; ?>
                </td>
                <td><?= $user['total_score'] ?? 0 ?></td>
                <td class="text-success">+<?= $user['add_score'] ?? 0 ?></td>
                <td class="text-danger"><?= $user['deduct_score'] ?? 0 ?></td>
            </tr>
            <?php endforeach; ?>
        </tbody>
    </table>
    <?php endif; ?>

    <?php showFooter(); ?>
</body>
</html>