<?php
// 检查是否已安装
if (!file_exists(__DIR__ . '/../includes/config.php')) {
    if (is_dir(__DIR__ . '/../install')) {
        header('Location: ../install/');
        exit;
    } else {
        die('<div class="alert alert-danger">系统未安装且安装目录不存在，请联系管理员</div>');
    }
}

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/functions.php';
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
            $pdo->prepare("UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?")
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
    header('Location: home.php');
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
<?php if ($pdo->query("SELECT setting_value FROM system_settings WHERE setting_key = 'splash_video_enabled'")->fetchColumn() !== '0'): ?>
<!-- 开屏动画视频 -->
<div id="splash-video-container">
    <video id="splash-video" autoplay muted>
    <source src="../assets/videos/splash.mp4" type="video/mp4">
    <source src="../assets/videos/splash.webm" type="video/webm">
        您的浏览器不支持视频标签。
    </video>
</div>
<?php endif; ?>

<head>
    <title><?= htmlspecialchars($pdo->query("SELECT setting_value FROM system_settings WHERE setting_key = 'system_title'")->fetchColumn() ?: '积分查询') ?></title>
    <script>
    // 在CSS加载前立即应用保存的主题，防止闪烁
    (function() {
        var savedTheme = localStorage.getItem('theme') || 'light';
        if (savedTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    })();
    </script>
    <!-- 预加载关键CSS -->
    <link rel="preload" href="https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.2.3/css/bootstrap.min.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
    <link rel="preload" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
    <link rel="preload" href="../assets/css/int_main.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
    <!-- CSS回退 -->
    <noscript>
        <link href="https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.2.3/css/bootstrap.min.css" rel="stylesheet">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
        <link href="../assets/css/int_main.css" rel="stylesheet">
    </noscript>
</head>
<body>
    <?php showNav(); ?>
    
    <div class="container mt-4">
        <?php if (isLoggedIn()): ?>
            <div class="alert alert-success">
                欢迎回来，管理员（<?= htmlspecialchars($_SESSION['username']) ?>）！
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
    $showStatistics = $pdo->query("SELECT setting_value FROM system_settings WHERE setting_key = 'show_statistics'")->fetchColumn() ?? '1';
    
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
            <div class="input-group mb-3">
                <input type="text" id="searchInput" class="form-control"
                       placeholder="输入用户名进行查询" autocomplete="off">
                <button class="btn btn-primary" id="searchBtn">搜索</button>
            </div>
            <div id="searchResults"></div>
            <script>
                // AJAX 实时搜索
                document.addEventListener('DOMContentLoaded', function() {
                    const searchInput = document.getElementById('searchInput');
                    const searchResults = document.getElementById('searchResults');
                    let searchTimeout;

                    function performSearch(query) {
                        if (!query || query.trim() === '') {
                            searchResults.innerHTML = '';
                            return;
                        }

                        searchResults.innerHTML = '<div class="text-center"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">加载中...</span></div></div>';

                        fetch('../api/search_users.php?q=' + encodeURIComponent(query))
                            .then(response => response.json())
                            .then(data => {
                                if (data.error) {
                                    searchResults.innerHTML = '<div class="alert alert-danger">' + data.error + '</div>';
                                    return;
                                }

                                if (data.results.length === 0) {
                                    searchResults.innerHTML = '<div class="alert alert-warning">未找到匹配用户</div>';
                                    return;
                                }

                                let html = '<div class="list-group">';
                                data.results.forEach(function(user) {
                                    html += '<a href="user_search.php?id=' + user.id + '" class="list-group-item list-group-item-action">' + user.username + '</a>';
                                });
                                html += '</div>';
                                searchResults.innerHTML = html;
                            })
                            .catch(error => {
                                console.error('搜索错误:', error);
                                searchResults.innerHTML = '<div class="alert alert-danger">搜索失败，请重试</div>';
                            });
                    }

                    searchInput.addEventListener('input', function() {
                        clearTimeout(searchTimeout);
                        searchTimeout = setTimeout(function() {
                            performSearch(searchInput.value);
                        }, 500);
                    });

                    document.getElementById('searchBtn').addEventListener('click', function() {
                        performSearch(searchInput.value);
                    });

                    searchInput.addEventListener('keypress', function(e) {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            performSearch(searchInput.value);
                        }
                    });
                });
            </script>
        </div>
    </div>
    <?php endif; ?>

    <?php if ($showStatistics === '1'): ?>
    <!-- 统计数据区域 -->
    <div class="row mb-4">
        <div class="col-md-4">
            <div class="card text-center">
                <div class="card-body">
                    <h5 class="card-title">总平均分</h5>
                    <h2 class="text-primary">
                        <?php
                        $avgScore = $pdo->query("
                            SELECT AVG(total_score) as avg_score 
                            FROM (
                                SELECT u.id, COALESCE(SUM(sl.score_change), 0) AS total_score
                                FROM users u
                                LEFT JOIN score_logs sl ON u.id = sl.user_id
                                GROUP BY u.id
                            ) AS user_scores
                        ")->fetchColumn();
                        echo round($avgScore, 1);
                        ?>
                    </h2>
                </div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card text-center">
                <div class="card-body">
                    <h5 class="card-title">最高分</h5>
                    <h2 class="text-success">
                        <?php
                        $maxScore = $pdo->query("
                            SELECT MAX(total_score) as max_score 
                            FROM (
                                SELECT u.id, COALESCE(SUM(sl.score_change), 0) AS total_score
                                FROM users u
                                LEFT JOIN score_logs sl ON u.id = sl.user_id
                                GROUP BY u.id
                            ) AS user_scores
                        ")->fetchColumn();
                        echo $maxScore ?: 0;
                        ?>
                    </h2>
                </div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card text-center">
                <div class="card-body">
                    <h5 class="card-title">最低分</h5>
                    <h2 class="text-danger">
                        <?php
                        $minScore = $pdo->query("
                            SELECT MIN(total_score) as min_score 
                            FROM (
                                SELECT u.id, COALESCE(SUM(sl.score_change), 0) AS total_score
                                FROM users u
                                LEFT JOIN score_logs sl ON u.id = sl.user_id
                                GROUP BY u.id
                            ) AS user_scores
                        ")->fetchColumn();
                        echo $minScore ?: 0;
                        ?>
                    </h2>
                </div>
            </div>
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
                <th class="text-center">排名</th>
                <th>用户名</th>
                <th class="text-center">总积分</th>
                <th class="text-center">已加分数</th>
                <th class="text-center">已扣分数</th>
            </tr>
        </thead>
        <tbody>
            <?php foreach ($ranking as $index => $user): ?>
            <tr>
                <td class="text-center"><?= $index+1 ?></td>
                <td>
                    <?php 
                    $enableUserDetail = $pdo->query("SELECT setting_value FROM system_settings WHERE setting_key = 'enable_user_detail'")->fetchColumn() ?? '1';
                    $medal = '';
                    if ($index+1 === 1) $medal = '🥇 ';
                    elseif ($index+1 === 2) $medal = '🥈 ';
                    elseif ($index+1 === 3) $medal = '🥉 ';
                    
                    if ($enableUserDetail === '1'): ?>
                        <a href="user_search.php?id=<?= $user['id'] ?>">
                            <?= $medal . htmlspecialchars($user['username']) ?>
                        </a>
                    <?php else: ?>
                        <?= $medal . htmlspecialchars($user['username']) ?>
                    <?php endif; ?>
                </td>
                <td class="text-center"><?= $user['total_score'] ?? 0 ?></td>
                <td class="text-center text-success">+<?= $user['add_score'] ?? 0 ?></td>
                <td class="text-center text-danger"><?= $user['deduct_score'] ?? 0 ?></td>
            </tr>
            <?php endforeach; ?>
        </tbody>
    </table>
    <?php endif; ?>

    <!-- jQuery (备用CDN) -->
    <script src="https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js" crossorigin="anonymous"></script>
    <script>
        if (typeof jQuery === 'undefined') {
            document.write('<script src="https://cdn.bootcdn.net/ajax/libs/jquery/3.6.0/jquery.min.js"><\/script>');
        }
    </script>

    <!-- Bootstrap Bundle (备用CDN) -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/js/bootstrap.bundle.min.js" crossorigin="anonymous"></script>
    <script>
        if (typeof bootstrap === 'undefined') {
            document.write('<script src="https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.2.3/js/bootstrap.bundle.min.js"><\/script>');
        }
    </script>

    <!-- 自定义脚本 - 使用defer延迟加载，不阻塞页面渲染 -->
    <script defer src="../assets/js/main.js"></script>
    <script defer src="../assets/js/background_image.js"></script>

    <!-- 页面加载优化：显示加载完成提示 -->
    <script>
    window.addEventListener('load', function() {
        // 页面完全加载后执行
        console.log('页面加载完成');
    });
    </script>

    <?php
    showFooter();
?>
</body>
</html>