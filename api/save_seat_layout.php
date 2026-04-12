<?php
require_once '../includes/config.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => '无效的请求方法']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    echo json_encode(['success' => false, 'message' => '无效的输入数据']);
    exit;
}

try {
    $pdo->beginTransaction();

    // 更新或插入座位表配置
    // 检查是否已有配置
    $checkStmt = $pdo->query("SELECT COUNT(*) FROM seat_layout_config");
    $hasConfig = $checkStmt->fetchColumn() > 0;

    if ($hasConfig) {
        // 更新现有配置
        $stmt = $pdo->prepare("
            UPDATE seat_layout_config
            SET group_count = ?,
                rows_per_group = ?,
                cols_per_group = ?,
                has_aisle = ?,
                updated_at = CURRENT_TIMESTAMP
            LIMIT 1
        ");
        $stmt->execute([
            $input['group_count'],
            $input['rows_per_group'],
            $input['cols_per_group'],
            $input['has_aisle']
        ]);
    } else {
        // 插入新配置
        $stmt = $pdo->prepare("
            INSERT INTO seat_layout_config (group_count, rows_per_group, cols_per_group, has_aisle)
            VALUES (?, ?, ?, ?)
        ");
        $stmt->execute([
            $input['group_count'],
            $input['rows_per_group'],
            $input['cols_per_group'],
            $input['has_aisle']
        ]);
    }

    // 删除旧的座位数据
    $pdo->exec("DELETE FROM seat_data");

    // 插入新的座位数据
    $stmt = $pdo->prepare("
        INSERT INTO seat_data (group_index, row_index, col_index, user_id, is_aisle)
        VALUES (?, ?, ?, ?, 0)
    ");

    foreach ($input['seats'] as $seat) {
        $stmt->execute([
            $seat['group_index'],
            $seat['row_index'],
            $seat['col_index'],
            $seat['user_id']
        ]);
    }

    $pdo->commit();

    echo json_encode(['success' => true, 'message' => '座位表保存成功']);

} catch(PDOException $e) {
    $pdo->rollBack();
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}