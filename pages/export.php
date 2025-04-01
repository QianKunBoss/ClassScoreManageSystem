<?php
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/functions.php';

if (!isLoggedIn()) {
    header('Location: ../dengluye.php');
    exit;
}

// 获取所有用户数据及其总积分
$users = $pdo->query("
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
")->fetchAll(PDO::FETCH_ASSOC);

// 为用户生成排名
$rankingIndex = 1;
foreach ($users as &$user) {
    $user['ranking'] = $rankingIndex++;
}
unset($user);

// 获取每日加扣分详情
$dailyLogs = [];
foreach ($users as $user) {
    $logs = $pdo->prepare("
        SELECT 
            DATE(sl.created_at) AS date,
            GROUP_CONCAT(CONCAT(sl.score_change, '（', sl.description, '）') SEPARATOR ' ') AS details
        FROM score_logs sl
        WHERE sl.user_id = ?
        GROUP BY DATE(sl.created_at)
        ORDER BY date
    ");
    $logs->execute([$user['id']]);
    $dailyLogs[$user['username']] = $logs->fetchAll(PDO::FETCH_KEY_PAIR);
}

// 动态生成日期列头
$allDates = [];
foreach ($dailyLogs as $logs) {
    $allDates = array_merge($allDates, array_keys($logs));
}
$allDates = array_unique($allDates);
sort($allDates);

// 格式化日期为“m月d日”
$allDatesFormatted = array_map(function ($date) {
    return date('n月j日', strtotime($date));
}, $allDates);

// 设置文件头
header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="班级积分报表_' . date('Ymd') . '.csv"');

// 创建输出流并添加BOM头
$output = fopen('php://output', 'w');
fwrite($output, "\xEF\xBB\xBF"); // 添加UTF-8 BOM头

// 写入表头
$headers = array_merge(['排名', '用户名', '总积分', '累计加分', '累计扣分'], $allDatesFormatted);
fputcsv($output, $headers);

// 写入数据
foreach ($users as $user) {
    $dailyDetails = $dailyLogs[$user['username']] ?? [];
    $dailyRow = array_map(function ($date) use ($dailyDetails) {
        return $dailyDetails[$date] ?? '';
    }, $allDates);
    $row = [
        $user['ranking'],
        $user['username'],
        $user['total_score'] ?? 0,
        $user['add_score'] ?? 0,
        $user['deduct_score'] ?? 0
    ];
    $finalRow = array_merge($row, $dailyRow);
    fputcsv($output, $finalRow);
}

fclose($output);
exit;
?>