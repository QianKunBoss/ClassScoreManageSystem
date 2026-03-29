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

header('Content-Type: application/json');

try {
    global $db_type, $db_file, $host, $dbname, $user, $pass;
    
    // 解析当前db_file路径
    $realDbPath = realpath($db_file);
    if ($realDbPath === false) {
        $realDbPath = $db_file;
    }
    
    // 获取htdocs目录（项目根目录）
    $htdocsDir = dirname(__DIR__);
    
    // 计算从htdocs开始的相对路径
    $relativePath = str_replace($htdocsDir, '', $realDbPath);
    $relativePath = str_replace('\\', '/', $relativePath);
    $relativePath = ltrim($relativePath, '/');
    
    // 相对于includes目录，需要添加../
    $relativeDbFile = '../' . $relativePath;
    
    $config = [
        'type' => $db_type,
        'file' => $relativeDbFile,
        'host' => $host,
        'dbname' => $dbname,
        'user' => $user
    ];
    
    echo json_encode([
        'success' => true,
        'database_type' => $db_type,
        'config' => $config
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => '服务器错误: ' . $e->getMessage()]);
}
?>