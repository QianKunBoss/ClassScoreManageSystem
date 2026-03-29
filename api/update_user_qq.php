<?php
/**
 * 更新用户QQ号码API
 */

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/functions.php';

header('Content-Type: application/json');

// 验证登录状态
if (!isLoggedIn()) {
    echo json_encode(['success' => false, 'error' => '未登录']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $userId = isset($_POST['user_id']) ? (int)$_POST['user_id'] : 0;
    $qqNumber = isset($_POST['qq_number']) ? trim($_POST['qq_number']) : '';
    
    if ($userId <= 0) {
        echo json_encode(['success' => false, 'error' => '无效的用户ID']);
        exit;
    }
    
    // 验证QQ号码格式（如果提供了的话）
    if (!empty($qqNumber) && !preg_match('/^[1-9][0-9]{4,14}$/', $qqNumber)) {
        echo json_encode(['success' => false, 'error' => 'QQ号码格式不正确']);
        exit;
    }
    
    try {
        // 检查用户是否存在
        $checkStmt = $pdo->prepare("SELECT id FROM users WHERE id = ?");
        $checkStmt->execute([$userId]);
        if (!$checkStmt->fetch()) {
            echo json_encode(['success' => false, 'error' => '用户不存在']);
            exit;
        }
        
        // 更新QQ号码
        $updateStmt = $pdo->prepare("UPDATE users SET qq_number = ? WHERE id = ?");
        $updateStmt->execute([empty($qqNumber) ? null : $qqNumber, $userId]);
        
        echo json_encode(['success' => true, 'message' => 'QQ号码更新成功']);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'error' => '数据库错误：' . $e->getMessage()]);
    }
} else {
    echo json_encode(['success' => false, 'error' => '请求方法错误']);
}