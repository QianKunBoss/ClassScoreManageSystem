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
    // 处理添加管理员请求
    if (isset($_POST['action']) && $_POST['action'] === 'add_admin') {
        if (empty($_POST['admin_username']) || empty($_POST['admin_password'])) {
            echo json_encode(['success' => false, 'message' => '用户名和密码不能为空']);
            exit;
        }
        
        $username = htmlspecialchars($_POST['admin_username']);
        $password = $_POST['admin_password'];
        
        // 检查用户名是否已存在
        $stmt = $pdo->prepare("SELECT id FROM admins WHERE username = ?");
        $stmt->execute([$username]);
        if ($stmt->fetch()) {
            echo json_encode(['success' => false, 'message' => '管理员用户名已存在！']);
            exit;
        }
        
        // 添加新管理员
        $passwordHash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("INSERT INTO admins (username, password_hash) VALUES (?, ?)");
        $stmt->execute([$username, $passwordHash]);
        
        echo json_encode(['success' => true, 'message' => '管理员添加成功！']);
    }
    // 处理编辑管理员请求
    else if (isset($_POST['action']) && $_POST['action'] === 'edit_admin') {
        if (empty($_POST['admin_id']) || empty($_POST['admin_username'])) {
            echo json_encode(['success' => false, 'message' => '管理员ID和用户名不能为空']);
            exit;
        }
        
        $adminId = (int)$_POST['admin_id'];
        $newUsername = htmlspecialchars($_POST['admin_username']);
        $newPassword = $_POST['admin_password'] ?? '';
        
        // 检查新用户名是否与其他管理员重复
        $stmt = $pdo->prepare("SELECT id FROM admins WHERE username = ? AND id != ?");
        $stmt->execute([$newUsername, $adminId]);
        if ($stmt->fetch()) {
            echo json_encode(['success' => false, 'message' => '该用户名已被其他管理员使用！']);
            exit;
        }
        
        // 更新管理员信息
        if (!empty($newPassword)) {
            // 更新用户名和密码
            $passwordHash = password_hash($newPassword, PASSWORD_DEFAULT);
            $stmt = $pdo->prepare("UPDATE admins SET username = ?, password_hash = ? WHERE id = ?");
            $stmt->execute([$newUsername, $passwordHash, $adminId]);
        } else {
            // 只更新用户名
            $stmt = $pdo->prepare("UPDATE admins SET username = ? WHERE id = ?");
            $stmt->execute([$newUsername, $adminId]);
        }
        
        // 如果编辑的是当前用户，更新会话
        if ($adminId === $_SESSION['admin_id']) {
            $_SESSION['username'] = $newUsername;
        }
        
        echo json_encode(['success' => true, 'message' => '管理员信息更新成功！']);
    }
    // 处理删除管理员请求
    else if (isset($_POST['action']) && $_POST['action'] === 'delete_admin') {
        if (empty($_POST['admin_id'])) {
            echo json_encode(['success' => false, 'message' => '管理员ID不能为空']);
            exit;
        }
        
        $adminId = (int)$_POST['admin_id'];
        
        // 检查是否为当前用户
        $stmt = $pdo->prepare("SELECT username FROM admins WHERE id = ?");
        $stmt->execute([$adminId]);
        $admin = $stmt->fetch();
        
        if ($admin && $admin['username'] === $_SESSION['username']) {
            echo json_encode(['success' => false, 'message' => '不能删除当前登录的管理员账号！']);
            exit;
        }
        
        // 删除管理员
        $stmt = $pdo->prepare("DELETE FROM admins WHERE id = ?");
        $stmt->execute([$adminId]);
        
        echo json_encode(['success' => true, 'message' => '管理员删除成功！']);
    }
    // 处理获取管理员列表请求
    else if (isset($_GET['action']) && $_GET['action'] === 'get_admins') {
        $admins = $pdo->query("
            SELECT id, username, created_at, last_login, api_token 
            FROM admins 
            ORDER BY created_at DESC
        ")->fetchAll();
        
        // 格式化数据
        $formattedAdmins = [];
        foreach ($admins as $admin) {
            $formattedAdmins[] = [
                'id' => $admin['id'],
                'username' => htmlspecialchars($admin['username']),
                'created_at' => date('Y-m-d H:i', strtotime($admin['created_at'])),
                'last_login' => $admin['last_login'] ? date('Y-m-d H:i', strtotime($admin['last_login'])) : '从未登录',
                'has_token' => !empty($admin['api_token']),
                'is_current' => $admin['username'] === $_SESSION['username']
            ];
        }
        
        echo json_encode(['success' => true, 'admins' => $formattedAdmins]);
    }
    // 处理生成token请求
    else if (isset($_POST['action']) && $_POST['action'] === 'generate_token') {
        if (empty($_POST['admin_id']) || empty($_POST['admin_password'])) {
            echo json_encode(['success' => false, 'message' => '管理员ID和密码不能为空']);
            exit;
        }
        
        $adminId = (int)$_POST['admin_id'];
        $password = $_POST['admin_password'];
        
        // 获取管理员信息
        $stmt = $pdo->prepare("SELECT id, username, password_hash FROM admins WHERE id = ?");
        $stmt->execute([$adminId]);
        $admin = $stmt->fetch();
        
        if (!$admin) {
            echo json_encode(['success' => false, 'message' => '管理员不存在']);
            exit;
        }
        
        // 验证密码
        if (!password_verify($password, $admin['password_hash'])) {
            echo json_encode(['success' => false, 'message' => '密码错误']);
            exit;
        }
        
        // 生成token：使用密码和用户名作为salt的哈希值
        // 使用SHA256哈希算法
        $token = strtoupper(hash('sha256', $password . $admin['username']));
        
        // 存储token到数据库
        $stmt = $pdo->prepare("UPDATE admins SET api_token = ? WHERE id = ?");
        $stmt->execute([$token, $adminId]);
        
        echo json_encode(['success' => true, 'message' => 'Token生成成功！', 'token' => $token]);
    }
    // 处理查看token请求
    else if (isset($_POST['action']) && $_POST['action'] === 'get_token') {
        if (empty($_POST['admin_id']) || empty($_POST['admin_password'])) {
            echo json_encode(['success' => false, 'message' => '管理员ID和密码不能为空']);
            exit;
        }
        
        $adminId = (int)$_POST['admin_id'];
        $password = $_POST['admin_password'];
        
        // 获取管理员信息
        $stmt = $pdo->prepare("SELECT id, username, password_hash, api_token FROM admins WHERE id = ?");
        $stmt->execute([$adminId]);
        $admin = $stmt->fetch();
        
        if (!$admin) {
            echo json_encode(['success' => false, 'message' => '管理员不存在']);
            exit;
        }
        
        // 验证密码
        if (!password_verify($password, $admin['password_hash'])) {
            echo json_encode(['success' => false, 'message' => '密码错误']);
            exit;
        }
        
        if (empty($admin['api_token'])) {
            echo json_encode(['success' => false, 'message' => '该管理员尚未生成Token，请先生成Token']);
            exit;
        }
        
        echo json_encode(['success' => true, 'token' => $admin['api_token']]);
    }
    else {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => '无效的操作']);
    }
} catch(PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => '数据库错误: ' . $e->getMessage()]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => '服务器错误: ' . $e->getMessage()]);
}
?>