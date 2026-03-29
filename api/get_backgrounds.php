<?php
/**
 * 获取已上传背景图片列表 API
 */

require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/functions.php';

if (!isLoggedIn()) {
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => '用户未登录']);
    exit;
}

try {
    $backgroundDir = __DIR__ . '/../assets/background/';
    
    // 检查目录是否存在
    if (!is_dir($backgroundDir)) {
        header('Content-Type: application/json');
        echo json_encode(['success' => true, 'backgrounds' => []]);
        exit;
    }
    
    // 获取目录中的所有图片文件
    $files = [];
    $allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    
    if ($handle = opendir($backgroundDir)) {
        while (($file = readdir($handle)) !== false) {
            $filePath = $backgroundDir . $file;
            
            // 跳过 . 和 ..
            if ($file === '.' || $file === '..') {
                continue;
            }
            
            // 只处理文件
            if (!is_file($filePath)) {
                continue;
            }
            
            // 检查文件扩展名
            $extension = strtolower(pathinfo($file, PATHINFO_EXTENSION));
            if (!in_array($extension, $allowedExtensions)) {
                continue;
            }
            
            // 获取文件信息
            $imageInfo = getimagesize($filePath);
            if ($imageInfo === false) {
                continue;
            }
            
            $files[] = [
                'filename' => $file,
                'url' => '../assets/background/' . $file,
                'size' => filesize($filePath),
                'width' => $imageInfo[0],
                'height' => $imageInfo[1],
                'type' => $imageInfo['mime'],
                'upload_time' => filemtime($filePath)
            ];
        }
        closedir($handle);
    }
    
    // 按上传时间倒序排序
    usort($files, function($a, $b) {
        return $b['upload_time'] - $a['upload_time'];
    });
    
    header('Content-Type: application/json');
    echo json_encode(['success' => true, 'backgrounds' => $files]);
    
} catch (Exception $e) {
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => '获取背景图片列表失败: ' . $e->getMessage()]);
}