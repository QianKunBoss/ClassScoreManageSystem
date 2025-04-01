<?php
// 数据库配置
$host = 'localhost';
$dbname = 'score-system';
$user = 'pwd-admin';
$pass = 'pwd123456';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(PDOException $e) {
    die("数据库连接失败: " . $e->getMessage());
}

// 账号和密码
$username = 'admin';
$password = 'admin#2302';

// 会话超时时间（秒）
define('SESSION_TIMEOUT', 144);

// 通用设置
session_start();
?>
