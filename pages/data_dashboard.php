<?php
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/functions.php';

if (!isLoggedIn()) {
    header('Location: ../dengluye.php');
    exit;
}

// 获取统计数据
$totalUsers = $pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
$totalAdmins = $pdo->query("SELECT COUNT(*) FROM admins")->fetchColumn();
$totalScoreLogs = $pdo->query("SELECT COUNT(*) FROM score_logs")->fetchColumn();

// 获取积分统计
$scoreStats = $pdo->query("
    SELECT 
        SUM(CASE WHEN score_change > 0 THEN score_change ELSE 0 END) as total_positive,
        SUM(CASE WHEN score_change < 0 THEN score_change ELSE 0 END) as total_negative,
        COUNT(CASE WHEN score_change > 0 THEN 1 END) as positive_count,
        COUNT(CASE WHEN score_change < 0 THEN 1 END) as negative_count
    FROM score_logs
")->fetch();

// 获取积分统计信息
$scoreOverview = $pdo->query("
    SELECT 
        AVG(user_total.total_score) as avg_score,
        MAX(user_total.total_score) as max_score,
        MIN(user_total.total_score) as min_score
    FROM (
        SELECT 
            u.id,
            u.username,
            COALESCE(SUM(sl.score_change), 0) as total_score
        FROM users u
        LEFT JOIN score_logs sl ON u.id = sl.user_id
        GROUP BY u.id, u.username
    ) as user_total
")->fetch();

// 获取前10名用户
$topUsers = $pdo->query("
    SELECT 
        u.username,
        SUM(sl.score_change) as total_score,
        COUNT(sl.id) as log_count
    FROM users u
    LEFT JOIN score_logs sl ON u.id = sl.user_id
    GROUP BY u.id, u.username
    ORDER BY total_score DESC
    LIMIT 10
")->fetchAll();



// 获取本月积分变化
$monthlyStats = $pdo->query("
    SELECT 
        SUM(CASE WHEN score_change > 0 THEN score_change ELSE 0 END) as monthly_positive,
        SUM(CASE WHEN score_change < 0 THEN score_change ELSE 0 END) as monthly_negative,
        COUNT(*) as monthly_logs
    FROM score_logs 
    WHERE MONTH(created_at) = MONTH(CURDATE()) 
    AND YEAR(created_at) = YEAR(CURDATE())
")->fetch();


?>

<!DOCTYPE html>
<html>
<head>
    <title>数据仪表板</title>
    <link href="https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.2.3/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link href="../assets/css/main.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        .stat-card {
            transition: transform 0.2s;
        }
        .stat-card:hover {
            transform: translateY(-5px);
        }
        .chart-container {
            position: relative;
            height: 300px;
        }
        .number-display {
            font-size: 2.5rem;
            font-weight: bold;
        }
        .positive { color: #28a745; }
        .negative { color: #dc3545; }
    </style>
</head>
<body>
    <?php showNav(); ?>
    
    <div class="container mt-4">
        <a href="../admin.php" class="btn btn-secondary mb-3">← 返回管理后台</a>
        
        <h2 class="mb-4">
            <i class="fas fa-chart-line me-2"></i>数据仪表板
        </h2>

        <!-- 统计卡片 -->
        <div class="row mb-4">
            <div class="col-md-3">
                <div class="card stat-card bg-primary text-white">
                    <div class="card-body">
                        <div class="d-flex justify-content-between">
                            <div>
                                <h6 class="card-title">总用户数</h6>
                                <div class="number-display"><?= $totalUsers ?></div>
                            </div>
                            <div class="align-self-center">
                                <i class="fas fa-users fa-2x opacity-75"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="col-md-3">
                <div class="card stat-card bg-success text-white">
                    <div class="card-body">
                        <div class="d-flex justify-content-between">
                            <div>
                                <h6 class="card-title">管理员数</h6>
                                <div class="number-display"><?= $totalAdmins ?></div>
                            </div>
                            <div class="align-self-center">
                                <i class="fas fa-user-shield fa-2x opacity-75"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="col-md-3">
                <div class="card stat-card bg-info text-white">
                    <div class="card-body">
                        <div class="d-flex justify-content-between">
                            <div>
                                <h6 class="card-title">积分记录</h6>
                                <div class="number-display"><?= $totalScoreLogs ?></div>
                            </div>
                            <div class="align-self-center">
                                <i class="fas fa-history fa-2x opacity-75"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="col-md-3">
                <div class="card stat-card bg-warning text-white">
                    <div class="card-body">
                        <div class="d-flex justify-content-between">
                            <div>
                                <h6 class="card-title">本月记录</h6>
                                <div class="number-display"><?= $monthlyStats['monthly_logs'] ?? 0 ?></div>
                            </div>
                            <div class="align-self-center">
                                <i class="fas fa-calendar-alt fa-2x opacity-75"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            
        </div>
        
        <!-- 第二行统计卡片 -->
        <div class="row mb-4">
            <div class="col-md-4">
                <div class="card stat-card bg-secondary text-white">
                    <div class="card-body">
                        <div class="d-flex justify-content-between">
                            <div>
                                <h6 class="card-title">总平均分</h6>
                                <div class="number-display"><?= round($scoreOverview['avg_score'] ?? 0, 1) ?></div>
                            </div>
                            <div class="align-self-center">
                                <i class="fas fa-chart-bar fa-2x opacity-75"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="col-md-4">
                <div class="card stat-card bg-dark text-white">
                    <div class="card-body">
                        <div class="d-flex justify-content-between">
                            <div>
                                <h6 class="card-title">最高分</h6>
                                <div class="number-display"><?= $scoreOverview['max_score'] ?? 0 ?></div>
                            </div>
                            <div class="align-self-center">
                                <i class="fas fa-arrow-up fa-2x opacity-75"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="col-md-4">
                <div class="card stat-card bg-danger text-white">
                    <div class="card-body">
                        <div class="d-flex justify-content-between">
                            <div>
                                <h6 class="card-title">最低分</h6>
                                <div class="number-display"><?= $scoreOverview['min_score'] ?? 0 ?></div>
                            </div>
                            <div class="align-self-center">
                                <i class="fas fa-arrow-down fa-2x opacity-75"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 图表区域 -->
        <div class="row mb-4">
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header">
                        <h5 class="mb-0">积分统计</h5>
                    </div>
                    <div class="card-body">
                        <div class="chart-container">
                            <canvas id="scoreChart"></canvas>
                        </div>
                        <div class="mt-3">
                            <div class="d-flex justify-content-between">
                                <span>总加分：</span>
                                <span class="positive fw-bold">+<?= $scoreStats['total_positive'] ?? 0 ?></span>
                            </div>
                            <div class="d-flex justify-content-between">
                                <span>总扣分：</span>
                                <span class="negative fw-bold"><?= $scoreStats['total_negative'] ?? 0 ?></span>
                            </div>
                            <div class="d-flex justify-content-between">
                                <span>净积分：</span>
                                <span class="fw-bold"><?= ($scoreStats['total_positive'] ?? 0) + ($scoreStats['total_negative'] ?? 0) ?></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 数据表格 -->
        <div class="row mb-4">
            <div class="col-12">
                <div class="card">
                    <div class="card-header">
                        <h5 class="mb-0">前10名用户</h5>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>排名</th>
                                        <th>用户名</th>
                                        <th>总积分</th>
                                        <th>记录数</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <?php foreach ($topUsers as $index => $user): ?>
                                    <tr>
                                        <td><?= $index + 1 ?></td>
                                        <td><?= htmlspecialchars($user['username']) ?></td>
                                        <td><?= $user['total_score'] ?? 0 ?></td>
                                        <td><?= $user['log_count'] ?></td>
                                    </tr>
                                    <?php endforeach; ?>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 记录数统计 -->
        <div class="row">
            <div class="col-12">
                <div class="card">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <h5 class="mb-0">积分记录数统计</h5>
                        <div>
                            <button class="btn btn-sm btn-outline-secondary me-2" onclick="refreshRecordsStats()">
                                <i class="fas fa-sync-alt me-1"></i>刷新统计
                            </button>
                            <button class="btn btn-sm btn-outline-primary" onclick="exportData()">
                                <i class="fas fa-download me-1"></i>导出数据
                            </button>
                        </div>
                    </div>
                    <div class="card-body">
                        <!-- 加载状态 -->
                        <div id="recordsStatsLoading" class="text-center py-4">
                            <div class="spinner-border text-primary" role="status">
                                <span class="visually-hidden">加载中...</span>
                            </div>
                            <p class="mt-2 text-muted">正在加载记录统计数据...</p>
                        </div>
                        
                        <!-- 统计数据表格 -->
                        <div id="recordsStatsContent" style="display: none;">
                            <div class="alert alert-info">
                                <i class="fas fa-info-circle me-2"></i>
                                共找到 <strong id="totalRecordsCount">0</strong> 条积分记录
                            </div>
                            <div class="table-responsive">
                                <table class="table">
                                    <thead>
                                        <tr>
                                            <th>记录描述</th>
                                            <th>记录数</th>
                                            <th>使用频率</th>
                                            <th>平均分值</th>
                                            <th>最高分</th>
                                            <th>最低分</th>
                                            <th>最后使用</th>
                                        </tr>
                                    </thead>
                                    <tbody id="recordsStatsTableBody">
                                        <!-- 动态加载内容 -->
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <?php showFooter(); ?>

    <script>
        // 准备图表数据
            const scorePositive = <?= $scoreStats['positive_count'] ?? 0 ?>;
            const scoreNegative = <?= $scoreStats['negative_count'] ?? 0 ?>;
    
            // 页面加载完成后自动加载记录统计
            document.addEventListener('DOMContentLoaded', function() {
                loadRecordsStats();
            });
    
            // 异步加载记录统计
            async function loadRecordsStats() {
                const loadingElement = document.getElementById('recordsStatsLoading');
                const contentElement = document.getElementById('recordsStatsContent');
                const tableBody = document.getElementById('recordsStatsTableBody');
                const totalCountElement = document.getElementById('totalRecordsCount');
    
                // 显示加载状态
                loadingElement.style.display = 'block';
                contentElement.style.display = 'none';
    
                try {
                    const response = await fetch('../api/api_records_stats.php');
                    const result = await response.json();
    
                    if (result.success) {
                        // 更新总记录数
                        totalCountElement.textContent = result.total_records;
    
                        // 清空表格内容
                        tableBody.innerHTML = '';
    
                        // 生成表格行
                        result.data.forEach(record => {
                            const row = document.createElement('tr');
                            row.innerHTML = `
                                <td>${htmlspecialchars(record.description)}</td>
                                <td>${record.record_count}</td>
                                <td>
                                    <div class="progress" style="height: 20px;">
                                        <div class="progress-bar" role="progressbar" 
                                             style="width: ${record.percentage}%"
                                             aria-valuenow="${record.percentage}" 
                                             aria-valuemin="0" aria-valuemax="100">
                                            ${record.percentage}%
                                        </div>
                                    </div>
                                </td>
                                <td>${record.avg_score ? Math.round(record.avg_score * 10) / 10 : 0}</td>
                                <td class="${record.max_score > 0 ? 'positive' : 'negative'}">${record.max_score}</td>
                                <td class="${record.min_score < 0 ? 'negative' : 'positive'}">${record.min_score}</td>
                                <td>${record.last_used_formatted}</td>
                            `;
                            tableBody.appendChild(row);
                        });
    
                        // 显示内容区域
                        loadingElement.style.display = 'none';
                        contentElement.style.display = 'block';
                    } else {
                        throw new Error(result.message || '获取数据失败');
                    }
                } catch (error) {
                    loadingElement.innerHTML = `
                        <div class="alert alert-danger">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            加载失败: ${error.message}
                        </div>
                        <button class="btn btn-outline-primary mt-2" onclick="loadRecordsStats()">
                            <i class="fas fa-redo me-1"></i>重试
                        </button>
                    `;
                }
            }
    
            // 刷新记录统计
            function refreshRecordsStats() {
                loadRecordsStats();
            }
    
            // HTML转义函数
            function htmlspecialchars(text) {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }
        

        

        // 积分统计饼图
        const scoreCtx = document.getElementById('scoreChart').getContext('2d');
        new Chart(scoreCtx, {
            type: 'doughnut',
            data: {
                labels: ['加分次数', '扣分次数'],
                datasets: [{
                    data: [scorePositive, scoreNegative],
                    backgroundColor: [
                        'rgba(40, 167, 69, 0.8)',
                        'rgba(220, 53, 69, 0.8)'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });

        

        // 导出数据功能
        async function exportData() {
            try {
                // 获取记录统计数据
                const response = await fetch('../api/api_records_stats.php');
                const result = await response.json();
                
                if (result.success) {
                    const data = {
                        statistics: {
                            totalUsers: <?= $totalUsers ?>,
                            totalAdmins: <?= $totalAdmins ?>,
                            totalScoreLogs: <?= $totalScoreLogs ?>,
                            monthlyLogs: <?= $monthlyStats['monthly_logs'] ?? 0 ?>
                        },
                        topUsers: <?= json_encode($topUsers) ?>,
                        recordsStats: result.data,
                        scoreStats: <?= json_encode($scoreStats) ?>,
                        scoreOverview: <?= json_encode($scoreOverview) ?>,
                        exportTime: new Date().toISOString()
                    };

                    const dataStr = JSON.stringify(data, null, 2);
                    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
                    
                    const exportFileDefaultName = 'dashboard_data_' + new Date().toISOString().slice(0, 10) + '.json';
                    
                    const linkElement = document.createElement('a');
                    linkElement.setAttribute('href', dataUri);
                    linkElement.setAttribute('download', exportFileDefaultName);
                    linkElement.click();
                } else {
                    alert('获取记录统计数据失败，无法导出完整数据');
                }
            } catch (error) {
                alert('导出数据失败: ' + error.message);
            }
        }
    </script>
</body>
</html>