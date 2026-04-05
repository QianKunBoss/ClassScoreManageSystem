<?php
/**
 * 数据库升级脚本 - 添加QQ号码字段
 * 此脚本为现有数据库添加qq_number字段
 */

require_once __DIR__ . '/../includes/config.php';

echo "<h2>数据库升级 - 添加QQ号码字段</h2>";

try {
    $dbType = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
    echo "<p>当前数据库类型: <strong>{$dbType}</strong></p>";
    
    // 检查字段是否已存在
    $columnExists = false;
    if ($dbType === 'mysql') {
        $stmt = $pdo->query("SHOW COLUMNS FROM users LIKE 'qq_number'");
        $columnExists = $stmt->fetch() !== false;
    } else {
        // SQLite
        $stmt = $pdo->query("PRAGMA table_info(users)");
        $columns = $stmt->fetchAll();
        foreach ($columns as $column) {
            if ($column['name'] === 'qq_number') {
                $columnExists = true;
                break;
            }
        }
    }
    
    if ($columnExists) {
        echo "<p class='alert alert-warning'>qq_number字段已存在，无需升级。</p>";
    } else {
        echo "<p class='alert alert-info'>正在添加qq_number字段...</p>";
        
        // 添加字段
        if ($dbType === 'mysql') {
            $pdo->exec("ALTER TABLE users ADD COLUMN qq_number VARCHAR(20) DEFAULT NULL COMMENT 'QQ号码'");
            $pdo->exec("ALTER TABLE users ADD INDEX idx_qq_number (qq_number)");
        } else {
            // SQLite需要重建表
            $pdo->beginTransaction();
            
            // 创建新表
            $pdo->exec("CREATE TABLE users_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                qq_number TEXT DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )");
            
            // 复制数据
            $pdo->exec("INSERT INTO users_new (id, username, created_at) SELECT id, username, created_at FROM users");
            
            // 删除旧表
            $pdo->exec("DROP TABLE users");
            
            // 重命名新表
            $pdo->exec("ALTER TABLE users_new RENAME TO users");
            
            // 重建索引
            $pdo->exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_username ON users(username)");
            
            $pdo->commit();
        }
        
        echo "<p class='alert alert-success'>qq_number字段添加成功！</p>";
    }
    
    echo "<p class='alert alert-success'>数据库升级完成！</p>";
    echo "<p><a href='../pages/user_management.php'>返回用户管理</a></p>";
    
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo "<p class='alert alert-danger'>升级失败: " . $e->getMessage() . "</p>";
}
?>