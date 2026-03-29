<?php
// 搜索用户 API
header('Content-Type: application/json');

require_once __DIR__ . '/../includes/config.php';

// 只接受 GET 请求
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => '只接受 GET 请求']);
    exit;
}

$query = $_GET['q'] ?? '';

if (empty($query)) {
    echo json_encode(['results' => []]);
    exit;
}

try {
    $searchTerm = '%' . trim($query) . '%';
    
    $stmt = $pdo->prepare("
        SELECT id, username 
        FROM users 
        WHERE username LIKE ? 
        ORDER BY username
        LIMIT 20
    ");
    $stmt->execute([$searchTerm]);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode(['results' => $results]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => '数据库错误']);
    error_log("搜索错误: " . $e->getMessage());
}