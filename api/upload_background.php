<?php
/**
 * 上传背景图片 API
 */

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/functions.php';

if (!isLoggedIn()) {
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => '用户未登录']);
    exit;
}

// 检查是否有文件上传
if (!isset($_FILES['background_image']) || $_FILES['background_image']['error'] !== UPLOAD_ERR_OK) {
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => '请选择要上传的图片']);
    exit;
}

$file = $_FILES['background_image'];

// 验证文件类型
$allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

if (!in_array($mimeType, $allowedTypes)) {
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => '只支持 JPG、PNG、WebP、GIF 格式的图片']);
    exit;
}

// 验证文件大小（最大 5MB）
$maxSize = 5 * 1024 * 1024; // 5MB
if ($file['size'] > $maxSize) {
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => '图片大小不能超过 5MB']);
    exit;
}

// 生成唯一文件名
$extension = pathinfo($file['name'], PATHINFO_EXTENSION);
$uniqueName = 'bg_' . time() . '_' . bin2hex(random_bytes(8)) . '.' . $extension;
$uploadDir = __DIR__ . '/../assets/background/';
$uploadPath = $uploadDir . $uniqueName;

// 移动文件到目标目录
if (!move_uploaded_file($file['tmp_name'], $uploadPath)) {
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => '文件上传失败']);
    exit;
}

// 返回成功响应
header('Content-Type: application/json');
echo json_encode([
    'success' => true,
    'message' => '背景图片上传成功',
    'filename' => $uniqueName,
    'url' => '../assets/background/' . $uniqueName
]);