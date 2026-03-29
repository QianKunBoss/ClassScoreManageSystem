<?php
/**
 * 系统环境检查API
 * 用于安装向导第一步的系统检查
 */

// 定义安装访问常量
define('INSTALL_ACCESS', true);

// 引入公共配置文件
require_once 'config.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$results = [];

// 检查1: 数据库扩展
$hasMySQL = extension_loaded('pdo_mysql');
$hasSQLite = extension_loaded('pdo_sqlite');

$hasAnyDB = $hasMySQL || $hasSQLite;

if ($hasMySQL && $hasSQLite) {
    $dbStatus = CHECK_STATUS['success'];
    $dbMessage = '已安装MySQL和SQLite扩展';
} elseif ($hasMySQL) {
    $dbStatus = CHECK_STATUS['success'];
    $dbMessage = '已安装MySQL扩展';
} elseif ($hasSQLite) {
    $dbStatus = CHECK_STATUS['success'];
    $dbMessage = '已安装SQLite扩展';
} else {
    $dbStatus = CHECK_STATUS['error'];
    $dbMessage = '未安装数据库扩展';
}

$results[] = [
    'name' => '数据库扩展',
    'status' => $dbStatus,
    'message' => $dbMessage,
    'details' => '用于数据库操作，至少需要MySQL或SQLite之一',
    'has_mysql' => $hasMySQL,
    'has_sqlite' => $hasSQLite
];

// 检查2: 文件修改权限
$directoryResults = checkDirectoryPermissions();
$notWritable = [];

foreach ($directoryResults as $dir => $info) {
    if (!$info['writable']) {
        $notWritable[] = $dir;
    }
}

if (empty($notWritable)) {
    $results[] = [
        'name' => '文件修改权限',
        'status' => CHECK_STATUS['success'],
        'message' => '所有目录具有写入权限',
        'details' => '可以正常写入配置文件'
    ];
} else {
    $results[] = [
        'name' => '文件修改权限',
        'status' => CHECK_STATUS['error'],
        'message' => '部分目录无写入权限',
        'details' => '无权限的目录: ' . implode(', ', $notWritable)
    ];
}

// 检查3: PHP版本
$currentVersion = PHP_VERSION;
$requiredVersion = getRequiredPHPVersion();
$isCompatible = checkPHPVersion();

$results[] = [
    'name' => 'PHP版本',
    'status' => $isCompatible ? CHECK_STATUS['success'] : CHECK_STATUS['error'],
    'message' => '当前版本: ' . $currentVersion . ($isCompatible ? ' (符合要求)' : ' (不符合要求)'),
    'details' => '要求版本 >= ' . $requiredVersion
];

// 检查4: 最新版本
$latestVersionInfo = getLatestVersion();

if ($latestVersionInfo) {
        $latestVersion = $latestVersionInfo['version'];
        $currentVersion = getSystemVersion();
        $hasUpdate = version_compare($latestVersion, $currentVersion, '>');

        if ($hasUpdate) {
            $results[] = [
                'name' => '版本检查',
                'status' => CHECK_STATUS['warning'],
                'message' => '发现新版本: v' . $latestVersion,
                'details' => '当前版本: v' . $currentVersion . '，建议更新到最新版本',
                'has_update' => true,
                'release_url' => $latestVersionInfo['url']
            ];
        } else {
            $results[] = [
                'name' => '版本检查',
                'status' => CHECK_STATUS['success'],
                'message' => '已是最新版本: v' . $currentVersion,
                'details' => 'GitHub最新版本: v' . $latestVersion
            ];
        }
    } else {
        $results[] = [
            'name' => '版本检查',
            'status' => CHECK_STATUS['warning'],
            'message' => '无法检查版本更新',
            'details' => '网络连接失败，跳过版本检查'
        ];
    }
// 检查是否全部通过
$allPassed = true;
foreach ($results as $result) {
    if ($result['status'] === CHECK_STATUS['error']) {
        $allPassed = false;
        break;
    }
}

echo json_encode([
    'success' => true,
    'all_passed' => $allPassed,
    'results' => $results
]);