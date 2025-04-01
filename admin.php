<?php
require_once 'includes/config.php';
require_once 'includes/functions.php';

if (!isLoggedIn()) {
    header('Location: dengluye.php');
    exit;
}

// 获取用户排名
$ranking = $pdo->query("
    SELECT u.id, u.username, 
           SUM(sl.score_change) AS total_score,
           MAX(sl.created_at) AS last_updated
    FROM users u
    LEFT JOIN score_logs sl ON u.id = sl.user_id
    GROUP BY u.id
    ORDER BY total_score DESC
")->fetchAll();

// 处理登出逻辑
if (isset($_GET['logout'])) {
    session_destroy();
    header('Location: index.php');
    exit;
}
?>

<!DOCTYPE html>
<html>
<head>
    <title>班级操行分管理系统</title>
    <link href="./css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="./css/all.min.css">
</head>
<body>
    <?php showNav(); ?>
    
    <div class="container">
        <?php if (isLoggedIn()): ?>
            <div class="alert alert-success">
                欢迎回来，管理员！
                <a href="?logout" class="float-end">登出</a>
            </div>
        <?php endif; ?>
     
        <h3 class="my-4">学生操行分排名</h3>
        
        <table class="table table-striped">
            <thead>
                <tr>
                    <th>排名</th>
                    <th>用户名</th>
                    <th>总积分</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($ranking as $index => $user): ?>
                <tr>
                    <td><?= $index+1 ?></td>
                    <td>
                        <a href="pages/user_detail.php?id=<?= $user['id'] ?>">
                            <?= htmlspecialchars($user['username']) ?>
                        </a>
                    </td>
                    <td><?= $user['total_score'] ?? 0 ?></td>

                        <td>
                            <form method="post" action="pages/delete_user.php">
                                <input type="hidden" name="user_id" value="<?= $user['id'] ?>">
                                <button type="submit" class="btn btn-danger btn-sm" 
                                    onclick="return confirm('确定删除该用户？')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </form>
                        </td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>

    <?php showFooter(); ?>
</body>
</html>