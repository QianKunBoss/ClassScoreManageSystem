<?php
/**
 * 安装向导公共变量文件
 * 用于存储安装向导的公共配置和常量
 */

// 防止直接访问
if (!defined('INSTALL_ACCESS')) {
    die('Direct access to this file is not allowed');
}

// ==================== 系统版本信息 ====================
define('SYSTEM_VERSION', '0.2.4');
define('SYSTEM_NAME', '班级操行分管理系统');

// ==================== 系统要求 ====================
define('REQUIRED_PHP_VERSION', '8.0.0');
define('REQUIRED_MYSQL_VERSION', '5.7.0');
define('REQUIRED_EXTENSIONS', [
    'pdo',
    'pdo_mysql',
    'mysqli',
    'json',
    'mbstring',
    'ctype'
]);

// ==================== 文件权限检查目录 ====================
define('CHECK_DIRECTORIES', [
    '../includes',
    '../assets/css',
    '../assets/js',
    '../api',
    '../pages'
]);

// ==================== 数据库配置 ====================
define('DEFAULT_DB_HOST', 'localhost');
define('DEFAULT_DB_PORT', '3306');
define('DEFAULT_DB_CHARSET', 'utf8mb4');

// ==================== 安装步骤 ====================
define('INSTALL_STEPS', [
    1 => '系统检查',
    2 => '数据库配置',
    3 => '管理员设置',
    4 => '安全问题设置'
]);

// ==================== 安全问题选项 ====================
define('SECURITY_QUESTIONS', [
    '您设置的管理员账号是什么?',
    '您的出生年份是?',
    '您最喜欢的颜色是?',
    '您的小学校名是?'
]);

// ==================== 文件上传限制 ====================
define('MAX_FILE_SIZE', 5 * 1024 * 1024); // 5MB
define('ALLOWED_IMAGE_TYPES', [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif'
]);

// ==================== GitHub配置 ====================
define('GITHUB_REPO', 'QianKunBoss/ClassScoreManageSystem');
define('GITHUB_API_URL', 'https://api.github.com/repos/' . GITHUB_REPO . '/releases/latest');
define('GITHUB_RELEASES_URL', 'https://github.com/' . GITHUB_REPO . '/releases/latest');

// ==================== 会话配置 ====================
define('SESSION_TIMEOUT', 1440); // 4小时（秒）

// ==================== 错误消息 ====================
define('ERROR_MESSAGES', [
    'db_connection' => '数据库连接失败，请检查配置',
    'db_query' => '数据库查询失败',
    'file_permission' => '文件权限不足，无法写入配置文件',
    'already_installed' => '系统已安装，如需重新安装请先删除includes/config.php文件',
    'invalid_data' => '无效的数据',
    'missing_required' => '请填写所有必填字段',
    'password_mismatch' => '两次输入的密码不一致',
    'username_exists' => '用户名已存在'
]);

// ==================== 成功消息 ====================
define('SUCCESS_MESSAGES', [
    'install_complete' => '安装完成！',
    'settings_saved' => '设置已保存',
    'check_passed' => '检查通过',
    'config_created' => '配置文件已创建'
]);

// ==================== 检查状态 ====================
define('CHECK_STATUS', [
    'success' => 'success',
    'error' => 'error',
    'warning' => 'warning'
]);

// ==================== 获取当前版本号 ====================
function getSystemVersion() {
    return SYSTEM_VERSION;
}

// ==================== 获取PHP版本要求 ====================
function getRequiredPHPVersion() {
    return REQUIRED_PHP_VERSION;
}

// ==================== 获取GitHub最新版本 ====================
function getLatestVersion() {
    try {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, GITHUB_API_URL);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_USERAGENT, 'ClassScoreManageSystem');
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 200) {
            $data = json_decode($response, true);
            if (isset($data['tag_name'])) {
                return [
                    'version' => preg_replace('/^v/', '', $data['tag_name']),
                    'url' => $data['html_url'] ?? GITHUB_RELEASES_URL,
                    'notes' => $data['body'] ?? ''
                ];
            }
        }

        return null;
    } catch (Exception $e) {
        return null;
    }
}

// ==================== 检查PHP版本是否满足要求 ====================
function checkPHPVersion() {
    return version_compare(PHP_VERSION, REQUIRED_PHP_VERSION, '>=');
}

// ==================== 检查必需的PHP扩展 ====================
function checkRequiredExtensions() {
    $missing = [];
    foreach (REQUIRED_EXTENSIONS as $ext) {
        if (!extension_loaded($ext)) {
            $missing[] = $ext;
        }
    }
    return $missing;
}

// ==================== 检查目录权限 ====================
function checkDirectoryPermissions() {
    $results = [];
    foreach (CHECK_DIRECTORIES as $dir) {
        $results[$dir] = [
            'writable' => is_writable($dir),
            'exists' => is_dir($dir)
        ];
    }
    return $results;
}
?>