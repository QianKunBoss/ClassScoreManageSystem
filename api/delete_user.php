<?php
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/functions.php';

if (!isLoggedIn()) {
    header('Location: ../dengluye.php');
    exit;
}

// 直接获取用户ID
$userId = (int)$_POST['user_id'];

try {
    // 删除用户
    $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    
    // 自动级联删除积分记录（需确保数据库已设置外键级联）
} catch(PDOException $e) {
    die("删除失败: " . $e->getMessage());
}

// 返回首页
header("Location: ../admin.php");