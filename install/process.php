<?php
// 禁用错误显示，确保只输出JSON
ini_set('display_errors', 0);
error_reporting(E_ALL);

// 定义安装访问常量
define('INSTALL_ACCESS', true);

// 引入公共配置文件
require_once 'config.php';

// 设置JSON响应头
header('Content-Type: application/json; charset=utf-8');

try {
    // 验证安装条件
    if (file_exists('../includes/config.php')) {
        throw new Exception(ERROR_MESSAGES['already_installed']);
    }

    // 验证必填字段
    $dbType = $_POST['db_type'] ?? 'mysql';

    if ($dbType === 'mysql') {
        $required = ['db_host', 'db_user', 'db_name', 'admin_user', 'admin_pass'];
        foreach ($required as $field) {
            if (empty($_POST[$field])) {
                throw new Exception(ERROR_MESSAGES['missing_required']);
            }
        }
    } elseif ($dbType === 'sqlite') {
        $required = ['db_file', 'admin_user', 'admin_pass'];
        foreach ($required as $field) {
            if (empty($_POST[$field])) {
                throw new Exception(ERROR_MESSAGES['missing_required']);
            }
        }
    } else {
        throw new Exception('不支持的数据库类型');
    }

    $steps = [];

    // 步骤1: 创建配置目录
    $steps[] = [
        'step' => 1,
        'name' => '创建配置目录',
        'status' => 'processing'
    ];

    if (!is_dir('../includes')) {
        if (!mkdir('../includes', 0755, true)) {
            $steps[count($steps) - 1]['status'] = 'error';
            throw new Exception('无法创建includes目录');
        }
    }
    $steps[count($steps) - 1]['status'] = 'success';

    // 步骤2: 创建数据库配置文件
    $steps[] = [
        'step' => 2,
        'name' => '创建数据库配置文件',
        'status' => 'processing'
    ];

    $configContent = "<?php\n";
    $configContent .= "// 数据库配置\n";
    $configContent .= "\$db_type = '{$dbType}';\n";
    $configContent .= "\n";
    $configContent .= "// MySQL 配置\n";
    $configContent .= "\$host = '" . ($dbType === 'mysql' ? $_POST['db_host'] : 'localhost') . "';\n";
    $configContent .= "\$dbname = '" . ($dbType === 'mysql' ? $_POST['db_name'] : '') . "';\n";
    $configContent .= "\$user = '" . ($dbType === 'mysql' ? $_POST['db_user'] : '') . "';\n";
    $configContent .= "\$pass = '" . ($dbType === 'mysql' ? $_POST['db_pass'] : '') . "';\n";
    $configContent .= "\n";
    $configContent .= "// SQLite 配置 - 使用绝对路径\n";
    $configContent .= "\$db_file = __DIR__ . '/../database/class_score.db';\n";
    $configContent .= "\n";
    $configContent .= "try {\n";
    $configContent .= "    if (\$db_type === 'mysql') {\n";
    $configContent .= "        \$pdo = new PDO(\"mysql:host=\$host;dbname=\$dbname;charset=" . DEFAULT_DB_CHARSET . "\", \$user, \$pass);\n";
    $configContent .= "        \$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);\n";
    $configContent .= "        \$pdo->exec('SET NAMES utf8mb4');\n";
    $configContent .= "    } else {\n";
    $configContent .= "        // 确保 database 目录存在\n";
    $configContent .= "        \$dbDir = dirname(\$db_file);\n";
    $configContent .= "        if (!is_dir(\$dbDir)) {\n";
    $configContent .= "            mkdir(\$dbDir, 0755, true);\n";
    $configContent .= "        }\n";
    $configContent .= "\n";
    $configContent .= "        \$pdo = new PDO(\"sqlite:{\$db_file}\");\n";
    $configContent .= "        \$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);\n";
    $configContent .= "        // 启用 SQLite 外键约束\n";
    $configContent .= "        \$pdo->exec('PRAGMA foreign_keys = ON');\n";
    $configContent .= "    }\n";
    $configContent .= "} catch(PDOException \$e) {\n";
    $configContent .= "    die(\"数据库连接失败: \" . \$e->getMessage());\n";
    $configContent .= "}\n";
    $configContent .= "\n";
    $configContent .= "// 会话超时时间（秒）\n";
    $configContent .= "define('SESSION_TIMEOUT', " . SESSION_TIMEOUT . ");\n";
    $configContent .= "\n";
    $configContent .= "// 系统版本\n";
    $configContent .= "define('SYSTEM_VERSION', '" . SYSTEM_VERSION . "');\n";
    $configContent .= "\n";
    $configContent .= "// 通用设置\n";
    $configContent .= "session_start();\n";

    $configFilePath = '../includes/config.php';
    $writeResult = file_put_contents($configFilePath, $configContent);

    if ($writeResult === false) {
        $steps[count($steps) - 1]['status'] = 'error';
        throw new Exception("创建配置文件失败：无法写入 " . $configFilePath);
    }
    $steps[count($steps) - 1]['status'] = 'success';

    // 步骤3: 测试数据库连接
    $steps[] = [
        'step' => 3,
        'name' => '测试数据库连接',
        'status' => 'processing'
    ];

    require '../includes/config.php';
    $steps[count($steps) - 1]['status'] = 'success';

    // 步骤4: 检查数据库是否为空
    $steps[] = [
        'step' => 4,
        'name' => '检查数据库状态',
        'status' => 'processing'
    ];

    $tableExists = false;
    $adminExists = false;

    try {
        // 检查是否有表
        if ($dbType === 'mysql') {
            $stmt = $pdo->query("SHOW TABLES");
            $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
        } else {
            $stmt = $pdo->query("SELECT name FROM sqlite_master WHERE type='table'");
            $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
        }

        if (count($tables) > 0) {
            $tableExists = true;

            // 检查是否有管理员表和用户
            if (in_array('admins', $tables)) {
                $stmt = $pdo->prepare("SELECT COUNT(*) FROM admins WHERE username = ?");
                $stmt->execute([$_POST['admin_user']]);
                if ($stmt->fetchColumn() > 0) {
                    $adminExists = true;
                }
            }
        }

        $steps[count($steps) - 1]['status'] = 'success';
        $steps[count($steps) - 1]['warning'] = $tableExists ? '数据库不为空，可能已有数据' : null;
    } catch (PDOException $e) {
        $steps[count($steps) - 1]['status'] = 'success'; // 检查失败不影响安装
        $steps[count($steps) - 1]['warning'] = '无法检查数据库状态';
    }

    // 步骤4: 初始化数据库
    $steps[] = [
        'step' => 4,
        'name' => '初始化数据库表结构',
        'status' => 'processing'
    ];

    $sqlFile = ($dbType === 'sqlite') ? 'install_sqlite.sql' : 'install.sql';

    if (!file_exists($sqlFile)) {
        $steps[count($steps) - 1]['status'] = 'error';
        throw new Exception($sqlFile . '文件不存在');
    }

    $sql = file_get_contents($sqlFile);
    if (empty($sql)) {
        $steps[count($steps) - 1]['status'] = 'error';
        throw new Exception($sqlFile . '文件内容为空');
    }

    // SQLite 需要逐条执行SQL语句
    if ($dbType === 'sqlite') {
        $statements = explode(';', $sql);
        foreach ($statements as $statement) {
            $statement = trim($statement);
            if (!empty($statement)) {
                try {
                    $pdo->exec($statement);
                } catch (PDOException $e) {
                    // 某些语句可能因为表已存在而失败，忽略这些错误
                    if (strpos($e->getMessage(), 'already exists') === false) {
                        throw $e;
                    }
                }
            }
        }
    } else {
        $pdo->exec($sql);
    }

    $steps[count($steps) - 1]['status'] = 'success';

    // 步骤5: 创建管理员账号
    $steps[] = [
        'step' => 5,
        'name' => '创建管理员账号',
        'status' => 'processing'
    ];

    $adminCreated = false;
    $adminExistsWarning = false;

    try {
        // 先检查管理员是否已存在
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM admins WHERE username = ?");
        $stmt->execute([$_POST['admin_user']]);
        $adminCount = $stmt->fetchColumn();

        if ($adminCount > 0) {
            $adminExistsWarning = true;
            $steps[count($steps) - 1]['status'] = 'success';
            $steps[count($steps) - 1]['warning'] = "管理员账号 '{$_POST['admin_user']}' 已存在，跳过创建";
        } else {
            $hashedPassword = password_hash($_POST['admin_pass'], PASSWORD_DEFAULT);
            $stmt = $pdo->prepare("INSERT INTO admins (username, password_hash) VALUES (?, ?)");
            $stmt->execute([$_POST['admin_user'], $hashedPassword]);
            $adminCreated = true;
            $steps[count($steps) - 1]['status'] = 'success';
        }
    } catch (PDOException $e) {
        // 检查是否是重复键错误
        if ($e->getCode() == '23000' || strpos($e->getMessage(), 'Duplicate entry') !== false) {
            $adminExistsWarning = true;
            $steps[count($steps) - 1]['status'] = 'success';
            $steps[count($steps) - 1]['warning'] = "管理员账号 '{$_POST['admin_user']}' 已存在，跳过创建";
        } else {
            $steps[count($steps) - 1]['status'] = 'error';
            throw new Exception('创建管理员账号失败: ' . $e->getMessage());
        }
    }

    // 步骤6: 保存安全问题和答案
    $steps[] = [
        'step' => 6,
        'name' => '保存安全问题和答案',
        'status' => 'processing'
    ];

    $securityQuestion = $_POST['security_question'];
    if ($securityQuestion === 'custom' && !empty($_POST['custom_security_question'])) {
        $securityQuestion = $_POST['custom_security_question'];
    }

    try {
        $stmt = $pdo->prepare("UPDATE system_settings SET setting_value = ? WHERE setting_key = 'security_question'");
        $stmt->execute([$securityQuestion]);
    } catch (PDOException $e) {
        // 忽略错误，继续执行
        $steps[count($steps) - 1]['warning'] = '更新安全问题时出现警告';
    }

    try {
        $stmt = $pdo->prepare("UPDATE system_settings SET setting_value = ? WHERE setting_key = 'security_answer'");
        $stmt->execute([$_POST['security_answer']]);
    } catch (PDOException $e) {
        // 忽略错误，继续执行
        $steps[count($steps) - 1]['warning'] = '更新安全答案时出现警告';
    }

    $steps[count($steps) - 1]['status'] = 'success';

    // 步骤7: 完成安装
    $steps[] = [
        'step' => 7,
        'name' => '完成安装',
        'status' => 'success'
    ];

    // 收集所有警告信息
    $warnings = [];
    foreach ($steps as $step) {
        if (isset($step['warning']) && $step['warning']) {
            $warnings[] = $step['warning'];
        }
    }

    // 返回成功响应
    $response = [
        'success' => true,
        'message' => '安装成功',
        'steps' => $steps
    ];

    if (!empty($warnings)) {
        $response['warnings'] = $warnings;
        $response['message'] = '安装成功，但有一些警告';
    }

    echo json_encode($response);

} catch (Exception $e) {
    // 返回错误响应
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
        'steps' => $steps
    ]);
}
?>