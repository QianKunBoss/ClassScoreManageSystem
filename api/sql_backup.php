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
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
        if ($_POST['action'] === 'create_backup') {
            // 检测数据库类型
            global $db_type, $db_file, $host, $dbname, $user, $pass;
            
            $dbConfig = [
                'type' => $db_type,
                'host' => $host,
                'dbname' => $dbname,
                'username' => $user,
                'password' => $pass,
                'file' => $db_file
            ];
            
            // 创建备份
            createBackup($dbConfig);
        } else if ($_POST['action'] === 'download_backup' && isset($_POST['filename'])) {
            $filename = $_POST['filename'];
            $filePath = __DIR__ . '/../' . $filename;
            
            if (file_exists($filePath) && preg_match('/^backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.(sql|db)$/', $filename)) {
                echo json_encode([
                    'success' => true,
                    'message' => '备份文件准备下载',
                    'download_url' => '../' . $filename
                ]);
            } else {
                echo json_encode(['success' => false, 'message' => '备份文件不存在']);
            }
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => '无效的操作']);
        }
    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => '不支持的请求方法']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => '服务器错误: ' . $e->getMessage()]);
}

/**
 * 创建数据库备份
 */
function createBackup($dbConfig) {
    $dbType = $dbConfig['type'];
    
    if ($dbType === 'sqlite') {
        // SQLite：直接复制数据库文件
        createSQLiteBackup($dbConfig);
    } else {
        // MySQL：生成SQL备份文件
        createMySQLBackup($dbConfig);
    }
}

/**
 * 创建SQLite备份（直接复制db文件）
 */
function createSQLiteBackup($dbConfig) {
    try {
        $sourceFile = $dbConfig['file'];
        
        if (!file_exists($sourceFile)) {
            throw new Exception('SQLite数据库文件不存在');
        }
        
        // 创建备份文件名
        $backupFileName = 'backup_' . date('Y-m-d_H-i-s') . '.db';
        $backupFilePath = __DIR__ . '/../' . $backupFileName;
        
        // 复制数据库文件
        if (copy($sourceFile, $backupFilePath)) {
            echo json_encode([
                'success' => true, 
                'message' => 'SQLite数据库备份创建成功！',
                'filename' => $backupFileName,
                'database_type' => 'SQLite'
            ]);
        } else {
            throw new Exception('无法复制数据库文件');
        }
    } catch (Exception $e) {
        throw new Exception('SQLite备份失败: ' . $e->getMessage());
    }
}

/**
 * 创建MySQL备份（生成SQL文件）
 */
function createMySQLBackup($dbConfig) {
    try {
        // 连接数据库
        $pdo = new PDO("mysql:host={$dbConfig['host']};dbname={$dbConfig['dbname']};charset=utf8mb4", 
                      $dbConfig['username'], $dbConfig['password']);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        
        // 创建备份文件名
        $backupFileName = 'backup_' . date('Y-m-d_H-i-s') . '.sql';
        $backupFilePath = __DIR__ . '/../' . $backupFileName;
        
        // 生成SQL备份内容
        $sqlContent = generateMySQLBackup($pdo, $dbConfig['dbname']);
        
        // 写入备份文件
        if (file_put_contents($backupFilePath, $sqlContent)) {
            echo json_encode([
                'success' => true, 
                'message' => 'MySQL数据库备份创建成功！',
                'filename' => $backupFileName,
                'database_type' => 'MySQL'
            ]);
        } else {
            throw new Exception('无法创建备份文件');
        }
    } catch (PDOException $e) {
        throw new Exception('MySQL备份失败: ' . $e->getMessage());
    }
}

/**
 * 生成MySQL数据库备份内容
 */
function generateMySQLBackup($pdo, $dbname) {
    $sql = "-- 数据库备份文件\n";
    $sql .= "-- 数据库类型: MySQL\n";
    $sql .= "-- 数据库: {$dbname}\n";
    $sql .= "-- 生成时间: " . date('Y-m-d H:i:s') . "\n";
    $sql .= "-- 班级操行分管理系统\n\n";
    
    // 获取所有表名
    $tables = [];
    $stmt = $pdo->query("SHOW TABLES");
    while ($row = $stmt->fetch(PDO::FETCH_NUM)) {
        $tables[] = $row[0];
    }
    
    // 为每个表生成创建语句和插入数据
    foreach ($tables as $table) {
        // 获取表结构
        $stmt = $pdo->query("SHOW CREATE TABLE `$table`");
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $sql .= "-- 表结构: $table\n";
        $sql .= "DROP TABLE IF EXISTS `$table`;\n";
        $sql .= $row['Create Table'] . ";\n\n";
        
        // 获取表数据
        $stmt = $pdo->query("SELECT * FROM `$table`");
        $rowCount = $stmt->rowCount();
        
        if ($rowCount > 0) {
            $sql .= "-- 表数据: $table ($rowCount 条记录)\n";
            
            // 获取列信息
            $columns = [];
            for ($i = 0; $i < $stmt->columnCount(); $i++) {
                $col = $stmt->getColumnMeta($i);
                $columns[] = $col['name'];
            }
            
            // 生成插入语句
            $columnList = '`' . implode('`, `', $columns) . '`';
            $sql .= "INSERT INTO `$table` ($columnList) VALUES\n";
            
            $values = [];
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $valueList = [];
                foreach ($row as $value) {
                    if ($value === null) {
                        $valueList[] = 'NULL';
                    } else {
                        $valueList[] = "'" . addslashes($value) . "'";
                    }
                }
                $values[] = '(' . implode(', ', $valueList) . ')';
            }
            
            $sql .= implode(",\n", $values) . ";\n\n";
        }
    }
    
    $sql .= "-- 备份完成\n";
    
    return $sql;
}
?>