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
    // 处理系统设置表单
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // 处理文本输入
        $textSettings = ['system_title', 'nav_title', 'security_answer'];
        foreach ($textSettings as $key) {
            if (isset($_POST[$key])) {
                $stmt = $pdo->prepare("UPDATE system_settings SET setting_value = ? WHERE setting_key = ?");
                $stmt->execute([htmlspecialchars($_POST[$key]), $key]);
            }
        }
        
        // 处理安全问题
        $securityQuestion = $_POST['security_question'];
        if ($securityQuestion === 'custom' && !empty($_POST['custom_security_question'])) {
            $securityQuestion = $_POST['custom_security_question'];
        }
        $stmt = $pdo->prepare("UPDATE system_settings SET setting_value = ? WHERE setting_key = 'security_question'");
        $stmt->execute([htmlspecialchars($securityQuestion)]);
        
        // 处理开关输入
        $switchSettings = ['show_ranking', 'show_search', 'enable_user_detail', 'splash_video_enabled', 'show_statistics'];
        foreach ($switchSettings as $key) {
            $valueToSave = isset($_POST[$key]) ? '1' : '0';
            $stmt = $pdo->prepare("UPDATE system_settings SET setting_value = ? WHERE setting_key = ?");
            $stmt->execute([$valueToSave, $key]);
        }
        
        echo json_encode(['success' => true, 'message' => '系统设置已保存！']);
    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => '不支持的请求方法']);
    }
} catch(PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => '数据库错误: ' . $e->getMessage()]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => '服务器错误: ' . $e->getMessage()]);
}
?>