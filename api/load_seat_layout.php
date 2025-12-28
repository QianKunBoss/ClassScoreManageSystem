<?php
require_once '../includes/config.php';

header('Content-Type: application/json');

try {
    // 获取座位表配置
    $config = $pdo->query("SELECT * FROM seat_layout_config ORDER BY id DESC LIMIT 1")->fetch();

    if (!$config) {
        echo json_encode(['success' => false, 'message' => '未找到座位表配置']);
        exit;
    }

    // 获取座位数据
    $seats = $pdo->query("SELECT group_index, row_index, col_index, user_id FROM seat_data")->fetchAll();

    echo json_encode([
        'success' => true,
        'config' => [
            'group_count' => (int)$config['group_count'],
            'rows_per_group' => (int)$config['rows_per_group'],
            'cols_per_group' => (int)$config['cols_per_group'],
            'has_aisle' => (int)$config['has_aisle']
        ],
        'seats' => array_map(function($seat) {
            return [
                'group_index' => (int)$seat['group_index'],
                'row_index' => (int)$seat['row_index'],
                'col_index' => (int)$seat['col_index'],
                'user_id' => $seat['user_id'] ? (int)$seat['user_id'] : null
            ];
        }, $seats)
    ]);

} catch(PDOException $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}