<?php
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/functions.php';

// 检查是否为AJAX请求
if (!isset($_SERVER['HTTP_X_REQUESTED_WITH']) || strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) !== 'xmlhttprequest') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => '无效的请求']);
    exit;
}

// 检查用户是否已登录
if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => '未登录']);
    exit;
}

// 设置响应头
header('Content-Type: application/json');

try {
    // 处理密码验证请求
    if (isset($_POST['action']) && $_POST['action'] === 'verify_password') {
        $password = $_POST['password'] ?? '';
        $stmt = $pdo->prepare("SELECT password_hash FROM admins WHERE username = ?");
        $stmt->execute([$_SESSION['username']]);
        $admin = $stmt->fetch();
        
        if ($admin && password_verify($password, $admin['password_hash'])) {
            echo json_encode(['success' => true, 'message' => '密码验证成功']);
        } else {
            echo json_encode(['success' => false, 'message' => '密码错误']);
        }
    }
    // 处理新学期切换请求
    else if (isset($_POST['action']) && $_POST['action'] === 'switch_term') {
        $keepUsers = isset($_POST['keepUsers']) && $_POST['keepUsers'] === 'true';
        $keepRecords = isset($_POST['keepRecords']) && $_POST['keepRecords'] === 'true';
        
        $pdo->beginTransaction();
        
        try {
            // 根据选项清理数据
            if (!$keepUsers) {
                // 清空用户表并重置自增ID
                $pdo->exec("TRUNCATE TABLE users");
            }
            
            if (!$keepRecords) {
                // 清空积分记录表并重置自增ID
                $pdo->exec("TRUNCATE TABLE score_logs");
            }
            
            $pdo->commit();
            echo json_encode(['success' => true, 'message' => '新学期切换成功']);
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }
    else {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => '无效的操作']);
    }
} catch(PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => '数据库错误: ' . $e->getMessage()]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => '服务器错误: ' . $e->getMessage()]);
}
?>