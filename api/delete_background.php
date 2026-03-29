<?php
/**
 * 删除背景图片 API
 */

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/functions.php';

if (!isLoggedIn()) {
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => '用户未登录']);
    exit;
}

// 获取要删除的文件名
$filename = $_POST['filename'] ?? '';

if (empty($filename)) {
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => '请指定要删除的文件']);
    exit;
}

// 安全验证：只允许删除特定格式的文件
if (!preg_match('/^bg_[0-9]+_[a-f0-9]{16}\.(jpg|jpeg|png|webp|gif)$/i', $filename)) {
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => '无效的文件名']);
    exit;
}

$filePath = __DIR__ . '/../assets/background/' . $filename;

// 检查文件是否存在
if (!file_exists($filePath)) {
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => '文件不存在']);
    exit;
}

// 删除文件
if (unlink($filePath)) {
    header('Content-Type: application/json');
    echo json_encode(['success' => true, 'message' => '背景图片删除成功']);
} else {
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => '删除失败']);
}