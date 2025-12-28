<?php
// 验证安装条件
if (file_exists('../includes/config.php')) {
    die('系统已安装，如需重新安装请先删除includes/config.php文件');
}

// 验证必填字段
$required = ['db_host', 'db_user', 'db_name', 'admin_user', 'admin_pass'];
foreach ($required as $field) {
    if (empty($_POST[$field])) {
        die('请填写所有必填字段');
    }
}

// 创建配置目录
if (!is_dir('../includes')) {
    mkdir('../includes', 0755, true);
}

// 创建数据库配置文件
$configContent = <<<EOT
<?php
// 数据库配置
\$host = '{$_POST['db_host']}';
\$dbname = '{$_POST['db_name']}';
\$user = '{$_POST['db_user']}';
\$pass = '{$_POST['db_pass']}';

try {
    \$pdo = new PDO("mysql:host=\$host;dbname=\$dbname", \$user, \$pass);
    \$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    \$pdo->exec('SET NAMES utf8mb4');
} catch(PDOException \$e) {
    die("数据库连接失败: " . \$e->getMessage());
}

// 会话超时时间（秒）
define('SESSION_TIMEOUT', 144);

// 系统版本
define('SYSTEM_VERSION', '0.2.3');

// 通用设置
session_start();
EOT;

file_put_contents('../includes/config.php', $configContent);

// 初始化数据库
require '../includes/config.php';
$sql = file_get_contents('install.sql');
$pdo->exec($sql);



// 创建管理员账号
$hashedPassword = password_hash($_POST['admin_pass'], PASSWORD_DEFAULT);
$stmt = $pdo->prepare("INSERT INTO admins (username, password_hash) VALUES (?, ?)");
$stmt->execute([$_POST['admin_user'], $hashedPassword]);

// 保存安全问题和答案
$securityQuestion = $_POST['security_question'];
if ($securityQuestion === 'custom' && !empty($_POST['custom_security_question'])) {
    $securityQuestion = $_POST['custom_security_question'];
}

$stmt = $pdo->prepare("UPDATE system_settings SET setting_value = ? WHERE setting_key = 'security_question'");
$stmt->execute([$securityQuestion]);

$stmt = $pdo->prepare("UPDATE system_settings SET setting_value = ? WHERE setting_key = 'security_answer'");
$stmt->execute([$_POST['security_answer']]);

// 完成安装
header('Location: complete.php');
