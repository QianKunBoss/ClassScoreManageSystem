<?php
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/functions.php';

if (!isLoggedIn()) {
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => '未授权访问']);
    exit;
}

header('Content-Type: application/json');

try {
    // 获取所有积分记录的统计
    $recordsStats = $pdo->query("
        SELECT 
            sl.description,
            COUNT(*) as record_count,
            SUM(CASE WHEN sl.score_change > 0 THEN sl.score_change ELSE 0 END) as total_positive,
            SUM(CASE WHEN sl.score_change < 0 THEN sl.score_change ELSE 0 END) as total_negative,
            AVG(sl.score_change) as avg_score,
            MAX(sl.score_change) as max_score,
            MIN(sl.score_change) as min_score,
            MAX(sl.created_at) as last_used,
            MIN(sl.created_at) as first_used
        FROM score_logs sl
        WHERE sl.description IS NOT NULL AND sl.description != ''
        GROUP BY sl.description
        ORDER BY record_count DESC
    ")->fetchAll();

    // 计算总记录数
    $totalRecords = array_sum(array_column($recordsStats, 'record_count'));

    // 为每条记录计算百分比
    foreach ($recordsStats as &$record) {
        $record['percentage'] = $totalRecords > 0 ? round(($record['record_count'] / $totalRecords) * 100, 2) : 0;
        $record['last_used_formatted'] = date('Y-m-d H:i', strtotime($record['last_used']));
        $record['first_used_formatted'] = date('Y-m-d H:i', strtotime($record['first_used']));
    }

    echo json_encode([
        'success' => true,
        'data' => $recordsStats,
        'total_records' => $totalRecords
    ]);

} catch(PDOException $e) {
    echo json_encode([
        'success' => false, 
        'message' => '数据库错误: ' . $e->getMessage()
    ]);
}
?>