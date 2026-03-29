<?php
/**
 * 版本检查API
 * 使用AJAX异步检查GitHub最新版本
 */

// 包含配置文件以获取SYSTEM_VERSION常量
require_once __DIR__ . '/../includes/config.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

try {
    // 从GitHub API获取最新版本
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, 'https://api.github.com/repos/QianKunBoss/ClassScoreManageSystem/releases/latest');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERAGENT, 'ClassScoreManageSystem');
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        throw new Exception('GitHub API请求失败');
    }
    
    $data = json_decode($response, true);
    
    if (!$data || !isset($data['tag_name'])) {
        throw new Exception('解析GitHub响应失败');
    }
    
    $latestVersion = preg_replace('/^v/', '', $data['tag_name']);
    
    // 获取当前版本
    $currentVersion = defined('SYSTEM_VERSION') ? SYSTEM_VERSION : '1.0.0';
    
    // 比较版本
    $hasUpdate = version_compare($latestVersion, $currentVersion, '>');
    
    echo json_encode([
        'success' => true,
        'current_version' => $currentVersion,
        'latest_version' => $latestVersion,
        'has_update' => $hasUpdate,
        'release_url' => $data['html_url'] ?? 'https://github.com/QianKunBoss/ClassScoreManageSystem/releases/latest',
        'release_notes' => $data['body'] ?? ''
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}