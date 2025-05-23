<?php
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/functions.php';

// 验证用户ID
if (!isset($_GET['id'])) {
    header("Location: ../admin.php");
    exit;
}

$userId = (int)$_GET['id'];

// 获取用户基本信息
$user = $pdo->prepare("
    SELECT u.*, SUM(sl.score_change) AS total_score 
    FROM users u
    LEFT JOIN score_logs sl ON u.id = sl.user_id
    WHERE u.id = ?
");
$user->execute([$userId]);
$user = $user->fetch();

// 获取分类统计
$stats = $pdo->prepare("
    SELECT 
        SUM(CASE WHEN score_change > 0 THEN score_change ELSE 0 END) AS total_positive,
        SUM(CASE WHEN score_change < 0 THEN score_change ELSE 0 END) AS total_negative,
        COUNT(*) AS total_records
    FROM score_logs
    WHERE user_id = ?
");
$stats->execute([$userId]);
$stats = $stats->fetch();

// 获取每日明细（按天分组）
$daily = $pdo->prepare("
    SELECT 
        DATE(created_at) AS date,
        SUM(score_change) AS daily_total,
        GROUP_CONCAT(CONCAT(score_change, ' (', description, ')') SEPARATOR '<br>') AS details
    FROM score_logs
    WHERE user_id = ?
    GROUP BY DATE(created_at)
    ORDER BY date DESC
");
$daily->execute([$userId]);
$dailyData = $daily->fetchAll();

// 获取图表数据（最后30天）
$chart = $pdo->prepare("
    SELECT 
        DATE(created_at) AS date,
        SUM(score_change) AS daily_score
    FROM score_logs
    WHERE user_id = ? 
    AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY DATE(created_at)
    ORDER BY date ASC
");
$chart->execute([$userId]);
$chartData = $chart->fetchAll();

// 处理分数调整（新增部分）
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $score = (int)$_POST['score'];
    $desc = htmlspecialchars($_POST['description']);
    
    try {
        $stmt = $pdo->prepare("
            INSERT INTO score_logs 
            (user_id, score_change, description)
            VALUES (?, ?, ?)
        ");
        $stmt->execute([$userId, $score, $desc]);
        
        // 成功消息（刷新后显示）
        $_SESSION['success'] = "分数调整成功！";
        header("Location: user_detail.php?id=$userId");
        exit;
    } catch(PDOException $e) {
        $errorMsg = "操作失败: " . $e->getMessage();
    }
}

// 显示消息（在概要卡片之后添加）
if (isset($_SESSION['success'])) {
    echo '<div class="alert alert-success">' . $_SESSION['success'] . '</div>';
    unset($_SESSION['success']);
}
if (!empty($errorMsg)) {
    echo '<div class="alert alert-danger">' . $errorMsg . '</div>';
}
?>

<!DOCTYPE html>
<html>
<head>
    <title><?= $user['username'] ?> 的详情</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <?php showNav(); ?>
    
    <div class="container mt-4">
        <a href="../index.php" class="btn btn-secondary mb-3">← 返回查询</a>
        
        <?php
        // 获取所有用户排名
        $ranking = $pdo->query("
            SELECT 
                u.id, 
                u.username, 
                SUM(sl.score_change) AS total_score
            FROM users u
            LEFT JOIN score_logs sl ON u.id = sl.user_id
            GROUP BY u.id
            ORDER BY total_score DESC
        ")->fetchAll();
        
        // 查找当前用户排名
        $userRank = 0;
        $medal = '';
        foreach ($ranking as $index => $row) {
            if ($row['id'] == $userId) {
                $userRank = $index + 1;
                if ($userRank === 1) $medal = '🥇 ';
                elseif ($userRank === 2) $medal = '🥈 ';
                elseif ($userRank === 3) $medal = '🥉 ';
                break;
            }
        }
        ?>

        <!-- 用户概要 -->
        <div class="card mb-4">
            <div class="card-header">
                <h4><?= $medal . htmlspecialchars($user['username']) ?> 的积分档案</h4>
            </div>
            <div class="card-body">
                <div class="row g-0 text-center">
                    <div class="col-md-3 border-end">
                        <div class="text-muted small">当前总分</div>
                        <div class="h2 <?= $user['total_score'] >= 0 ? 'text-success' : 'text-danger' ?>">
                            <?= $user['total_score'] ?? 0 ?>
                        </div>
                    </div>
                    <div class="col-md-3 border-end">
                        <div class="text-muted small">加分总计</div>
                        <div class="h3 text-success">+<?= $stats['total_positive'] ?? 0 ?></div>
                    </div>
                    <div class="col-md-3 border-end">
                        <div class="text-muted small">扣分总计</div>
                        <div class="h3 text-danger"><?= $stats['total_negative'] ?? 0 ?></div>
                    </div>
                    <div class="col-md-3">
                        <div class="text-muted small">当前排名</div>
                        <div class="h2"><?= $userRank ?></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 趋势图表 -->
        <div class="card mb-4">
            <div class="card-header">分数趋势（最近30天）</div>
            <div class="card-body">
                <canvas id="trendChart"></canvas>
            </div>
        </div>

        <!-- 每日明细 -->
        <div class="card">
            <div class="card-header">每日明细</div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>日期</th>
                                <th>当日总分</th>
                                <th>详细记录</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($dailyData as $day): ?>
                            <tr>
                                <td><?= $day['date'] ?></td>
                                <td class="<?= $day['daily_total'] >= 0 ? 'text-success' : 'text-danger' ?>">
                                    <?= $day['daily_total'] ?>
                                </td>
                                <td><?= nl2br($day['details']) ?></td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
             <div class="alert alert-info mt-4">
              <i class="fas fa-info-circle"></i>
              如果图表无法显示，请尝试：
              <ul>
              <li>禁用广告拦截插件</li>
              <li>刷新页面</li>
              <li>联系网站管理员</li>
              </ul>
            </div>
            </div>
        </div>
    </div>

    <!-- 图表脚本 -->
    <script>
    const ctx = document.getElementById('trendChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: [<?= implode(',', array_map(function($v) { 
                return "'" . date('m-d', strtotime($v['date'])) . "'"; 
            }, $chartData)) ?>],
            datasets: [{
                label: '每日分数变化',
                data: [<?= implode(',', array_column($chartData, 'daily_score')) ?>],
                borderColor: '#0d6efd',
                tension: 0.4,
                fill: false
            }]
        },
        options: {
            responsive: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        title: (context) => '日期：' + context[0].label
                    }
                }
            }
        }
    });

    </script>

    <?php showFooter(); ?>
</body>
</html>