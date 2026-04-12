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

    // 插入新的座位表配置记录
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

    // 获取刚插入的记录ID
    $newConfigId = $pdo->lastInsertId();

    // 删除除最新记录外的所有旧配置记录
    $pdo->prepare("DELETE FROM seat_layout_config WHERE id != ?")->execute([$newConfigId]);

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