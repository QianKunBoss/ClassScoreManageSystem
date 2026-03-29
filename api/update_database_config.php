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
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['config'])) {
        $config = json_decode($_POST['config'], true);
        
        if (!$config || !isset($config['type'])) {
            echo json_encode(['success' => false, 'message' => '无效的配置数据']);
            exit;
        }
        
        $configFile = __DIR__ . '/../includes/config.php';
        
        // 读取当前配置文件
        $configContent = file_get_contents($configFile);
        
        if ($configContent === false) {
            echo json_encode(['success' => false, 'message' => '无法读取配置文件']);
            exit;
        }
        
        // 更新数据库类型
        $configContent = preg_replace(
            '/\$db_type\s*=\s*[\'"].*?[\'"];/',
            "\$db_type = '{$config['type']}';",
            $configContent
        );
        
        // 更新SQLite配置
        $configContent = preg_replace(
            '/\$db_file\s*=\s*__DIR__\s*\.\s*[\'"].*?[\'"];/',
            "\$db_file = __DIR__ . '/" . str_replace('\\', '/', $config['file']) . "';",
            $configContent
        );
        
        // 更新MySQL配置
        if (isset($config['host'])) {
            $configContent = preg_replace(
                '/\$host\s*=\s*[\'"].*?[\'"];/',
                "\$host = '{$config['host']}';",
                $configContent
            );
        }
        
        if (isset($config['dbname'])) {
            $configContent = preg_replace(
                '/\$dbname\s*=\s*[\'"].*?[\'"];/',
                "\$dbname = '{$config['dbname']}';",
                $configContent
            );
        }
        
        if (isset($config['user'])) {
            $configContent = preg_replace(
                '/\$user\s*=\s*[\'"].*?[\'"];/',
                "\$user = '{$config['user']}';",
                $configContent
            );
        }
        
        if (isset($config['pass'])) {
            $configContent = preg_replace(
                '/\$pass\s*=\s*[\'"].*?[\'"];/',
                "\$pass = '{$config['pass']}';",
                $configContent
            );
        }
        
        // 创建备份
        $backupFile = $configFile . '.backup.' . date('YmdHis');
        if (!copy($configFile, $backupFile)) {
            echo json_encode(['success' => false, 'message' => '无法创建配置文件备份']);
            exit;
        }
        
        // 写入新配置
        if (file_put_contents($configFile, $configContent)) {
            echo json_encode([
                'success' => true,
                'message' => '数据库配置更新成功',
                'backup' => $backupFile
            ]);
        } else {
            echo json_encode(['success' => false, 'message' => '无法写入配置文件']);
        }
    } else {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => '缺少必要参数']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => '服务器错误: ' . $e->getMessage()]);
}
?>