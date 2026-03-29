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
    // 处理用户管理表单
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // 验证当前密码
        $currentUsername = $_SESSION['username'];
        $currentPassword = $_POST['current_password'];
        $newUsername = trim($_POST['new_username']);
        $newPassword = trim($_POST['new_password']);
        
        // 检查是否只输入了当前密码但未输入新密码
        if (!empty($currentPassword) && empty($newUsername) && empty($newPassword)) {
            echo json_encode(['success' => false, 'message' => '未输入新用户名或新密码，如需更改请至少输入一项']);
            exit;
        }
        
        // 从数据库验证密码
        $stmt = $pdo->prepare("SELECT password_hash FROM admins WHERE username = ?");
        $stmt->execute([$currentUsername]);
        $admin = $stmt->fetch();
        
        if (!$admin || !password_verify($currentPassword, $admin['password_hash'])) {
            echo json_encode(['success' => false, 'message' => '当前密码不正确']);
            exit;
        }

        // 更新用户名或密码
        try {
            $pdo->beginTransaction();
            
            if (!empty($newUsername)) {
                // 检查新用户名是否已存在
                $stmt = $pdo->prepare("SELECT id FROM admins WHERE username = ?");
                $stmt->execute([$newUsername]);
                if ($stmt->fetch()) {
                    echo json_encode(['success' => false, 'message' => '该用户名已存在']);
                    exit;
                }
                
                // 更新用户名
                $stmt = $pdo->prepare("UPDATE admins SET username = ? WHERE username = ?");
                $stmt->execute([$newUsername, $currentUsername]);
                $_SESSION['username'] = $newUsername;
                $currentUsername = $newUsername;
            }
        
            if (!empty($newPassword)) {
                // 更新密码
                $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
                $stmt = $pdo->prepare("UPDATE admins SET password_hash = ? WHERE username = ?");
                $stmt->execute([$hashedPassword, $currentUsername]);
            }
            
            $pdo->commit();
            echo json_encode(['success' => true, 'message' => '用户信息已更新', 'new_username' => $newUsername]);
        } catch (Exception $e) {
            $pdo->rollBack();
            echo json_encode(['success' => false, 'message' => '更新用户信息时出错: ' . $e->getMessage()]);
        }
    } else {
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