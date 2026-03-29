<?php
/**
 * 第三方图片API管理
 * 支持添加、删除、获取第三方图片API
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// 处理 OPTIONS 预检请求
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

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

try {
    // 初始化第三方API表
    global $db_type;

    if ($db_type === 'sqlite') {
        // SQLite语法
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS third_party_apis (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                api_name TEXT NOT NULL,
                api_url TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ");
    } else {
        // MySQL/MariaDB语法
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS third_party_apis (
                id INT PRIMARY KEY AUTO_INCREMENT,
                api_name VARCHAR(255) NOT NULL,
                api_url TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
    }

    // 处理GET请求 - 获取所有第三方API
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $action = $_GET['action'] ?? 'list';

        if ($action === 'list') {
            $stmt = $pdo->query("
                SELECT id, api_name, api_url, created_at 
                FROM third_party_apis 
                ORDER BY created_at DESC
            ");
            $apis = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // 格式化时间
            foreach ($apis as &$api) {
                $api['created_at'] = date('Y-m-d H:i', strtotime($api['created_at']));
            }

            echo json_encode(['success' => true, 'data' => $apis]);
        }
    }
    // 处理POST请求 - 添加第三方API
    elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);

        if (empty($data['api_name']) || empty($data['api_url'])) {
            echo json_encode(['success' => false, 'message' => 'API名称和URL不能为空']);
            exit;
        }

        $apiName = htmlspecialchars(trim($data['api_name']));
        $apiUrl = htmlspecialchars(trim($data['api_url']));

        // 验证URL格式
        if (!filter_var($apiUrl, FILTER_VALIDATE_URL)) {
            echo json_encode(['success' => false, 'message' => '请输入有效的URL地址']);
            exit;
        }

        // 添加到数据库
        $stmt = $pdo->prepare("INSERT INTO third_party_apis (api_name, api_url) VALUES (?, ?)");
        $result = $stmt->execute([$apiName, $apiUrl]);

        if ($result) {
            echo json_encode(['success' => true, 'message' => '添加成功']);
        } else {
            echo json_encode(['success' => false, 'message' => '添加失败']);
        }
    }
    // 处理DELETE请求 - 删除第三方API
    elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        $id = $_GET['id'] ?? null;

        if (!$id) {
            echo json_encode(['success' => false, 'message' => '缺少API ID']);
            exit;
        }

        $stmt = $pdo->prepare("DELETE FROM third_party_apis WHERE id = ?");
        $result = $stmt->execute([$id]);

        if ($result && $stmt->rowCount() > 0) {
            echo json_encode(['success' => true, 'message' => '删除成功']);
        } else {
            echo json_encode(['success' => false, 'message' => 'API不存在或删除失败']);
        }
    }
    else {
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