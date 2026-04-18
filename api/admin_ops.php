<?php
/**
 * 内部管理员操作接口
 *
 * 仅供内部页面调用（pages/），不面向外部 API。
 * 通过 Session 进行身份验证，无需传递 token 或密码。
 *
 * 安全设计：
 * - 不接受任何外部传入的鉴权凭证
 * - 所有操作依赖已登录的 Session
 * - 删除操作需要二次密码验证（防止他人在你离开电脑时操作）
 */

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/functions.php';

// 仅允许已登录的管理员
if (!isLoggedIn()) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => '未登录'], JSON_UNESCAPED_UNICODE);
    exit;
}

// 统一响应函数
function sendJson($data, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

$op = $_GET['op'] ?? $_POST['op'] ?? null;

if (!$op) {
    sendJson(['success' => false, 'error' => '缺少 op 参数'], 400);
}

// 仅允许操作白名单
$allowedOps = ['delete_score_log', 'update_score_log'];
if (!in_array($op, $allowedOps, true)) {
    sendJson(['success' => false, 'error' => '不支持的操作'], 403);
}

// ─── 删除积分记录 ───────────────────────────────────────────────
if ($op === 'delete_score_log') {
    $id = isset($_GET['id']) ? (int)$_GET['id'] : (int)($_POST['id'] ?? 0);
    $password = $_POST['password'] ?? '';

    if (!$id) {
        sendJson(['success' => false, 'error' => '缺少记录ID'], 400);
    }
    if (!$password) {
        sendJson(['success' => false, 'error' => '请输入管理员密码'], 400);
    }

    // 获取当前管理员的密码哈希进行验证
    $stmt = $pdo->prepare("SELECT password_hash FROM admins WHERE id = ?");
    $stmt->execute([$_SESSION['admin_id']]);
    $admin = $stmt->fetch();

    if (!$admin || !password_verify($password, $admin['password_hash'])) {
        sendJson(['success' => false, 'error' => '密码错误'], 403);
    }

    // 执行删除
    try {
        $del = $pdo->prepare("DELETE FROM score_logs WHERE id = ?");
        $del->execute([$id]);

        if ($del->rowCount() === 0) {
            sendJson(['success' => false, 'error' => '记录不存在'], 404);
        }

        sendJson(['success' => true, 'message' => '删除成功']);
    } catch (PDOException $e) {
        sendJson(['success' => false, 'error' => '数据库错误'], 500);
    }
}

// ─── 更新积分记录（内部用，可编辑 created_at）───────────────────
if ($op === 'update_score_log') {
    $id = isset($_GET['id']) ? (int)$_GET['id'] : (int)($_POST['id'] ?? 0);
    $data = $_POST['data'] ?? $_GET['data'] ?? null;

    if (!$id) {
        sendJson(['success' => false, 'error' => '缺少记录ID'], 400);
    }

    $payload = is_string($data) ? json_decode($data, true) : $data;
    if (!is_array($payload)) {
        sendJson(['success' => false, 'error' => '无效的 data 参数'], 400);
    }

    // 允许更新的字段白名单
    $allowedFields = ['score_change', 'description', 'created_at'];
    $updates = [];
    $params = [];

    foreach ($allowedFields as $field) {
        if (isset($payload[$field])) {
            if ($field === 'score_change') {
                $updates[] = 'score_change = ?';
                $params[] = (int)$payload[$field];
            } elseif ($field === 'description') {
                $updates[] = 'description = ?';
                $params[] = trim($payload[$field]);
            } elseif ($field === 'created_at') {
                $updates[] = 'created_at = ?';
                $params[] = trim($payload[$field]);
            }
        }
    }

    if (empty($updates)) {
        sendJson(['success' => false, 'error' => '没有有效字段需要更新'], 400);
    }

    $params[] = $id;
    $sql = "UPDATE score_logs SET " . implode(', ', $updates) . " WHERE id = ?";

    try {
        $upd = $pdo->prepare($sql);
        $upd->execute($params);
        sendJson(['success' => true, 'message' => '更新成功']);
    } catch (PDOException $e) {
        sendJson(['success' => false, 'error' => '数据库错误'], 500);
    }
}
