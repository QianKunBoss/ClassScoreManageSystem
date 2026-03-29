<?php
/**
 * 班级操行分管理系统 - 入口文件
 * 默认跳转到主页
 */

// 检查是否已安装
if (!file_exists(__DIR__ . '/includes/config.php')) {
    if (is_dir(__DIR__ . '/install')) {
        header('Location: install/');
        exit;
    } else {
        die('<div class="alert alert-danger">系统未安装且安装目录不存在，请联系管理员</div>');
    }
}

// 默认跳转到主页
header('Location: pages/home.php');
exit;