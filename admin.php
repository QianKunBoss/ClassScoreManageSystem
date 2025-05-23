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
    <title><?= htmlspecialchars($pdo->query("SELECT setting_value FROM system_settings WHERE setting_key = 'system_title'")->fetchColumn() ?: '班级操行分管理系统') ?></title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
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

        <!-- 添加日志显示区域 -->
        <div class="card mt-4" id="logSection">
            <div class="card-header">
                <form method="get" class="row g-3" onsubmit="location.hash='logSection'; return true;">
                    <div class="col-md-4">
                        <label for="logDate" class="form-label">选择日期查看日志</label>
                        <input type="date" id="logDate" name="logDate" class="form-control" 
                               value="<?= $_GET['logDate'] ?? date('Y-m-d') ?>">
                    </div>
                    <div class="col-md-2">
                        <button type="submit" class="btn btn-primary mt-4">查询</button>
                    </div>
                </form>
            </div>
            <div class="card-body">
                <?php
                $selectedDate = $_GET['logDate'] ?? date('Y-m-d');
                $logs = $pdo->prepare("
                    SELECT u.username, sl.score_change, sl.description, sl.created_at
                    FROM score_logs sl
                    JOIN users u ON sl.user_id = u.id
                    WHERE DATE(sl.created_at) = ?
                    ORDER BY sl.created_at DESC
                ");
                $logs->execute([$selectedDate]);
                ?>
                
                <table class="table">
                    <thead>
                        <tr>
                            <th>用户名</th>
                            <th>分数变化</th>
                            <th>原因</th>
                            <th>时间</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($logs as $log): ?>
                        <tr>
                            <td><?= htmlspecialchars($log['username']) ?></td>
                            <td class="<?= $log['score_change'] > 0 ? 'text-success' : 'text-danger' ?>">
                                <?= $log['score_change'] > 0 ? '+' : '' ?><?= $log['score_change'] ?>
                            </td>
                            <td><?= htmlspecialchars($log['description']) ?></td>
                            <td><?= date('H:i', strtotime($log['created_at'])) ?></td>
                        </tr>
                        <?php endforeach; ?>
                        <?php if ($logs->rowCount() === 0): ?>
                        <tr>
                            <td colspan="4" class="text-center">当日无日志记录</td>
                        </tr>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <?php showFooter(); ?>

    <!-- 右侧固定查询面板 -->
    <div class="position-fixed end-0 top-50 p-3 bg-light rounded-start shadow-sm" style="transform: translateY(-50%); z-index: 1000;">
        <h5 class="mb-3">日志查询</h5>
        <form method="get" onsubmit="location.hash='logSection'; return true;">
            <div class="mb-3">
                <label for="sideLogDate" class="form-label">选择日期</label>
                <input type="date" id="sideLogDate" name="logDate" class="form-control" 
                       value="<?= $_GET['logDate'] ?? date('Y-m-d') ?>">
            </div>
            <button type="submit" class="btn btn-primary w-100">查询</button>
        </form>
    </div>
</body>
</html>