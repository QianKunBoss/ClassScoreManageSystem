<?php
/**
 * 从CSS文件读取当前个性化设置
 */

// 检查用户是否已登录
session_start();
if (!isset($_SESSION['username'])) {
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => '用户未登录']);
    exit;
}

try {
    // 读取int_main.css文件
    $cssFilePath = '../assets/css/int_main.css';
    $currentCSS = file_get_contents($cssFilePath);
    
    // 解析CSS变量
    $settings = parseCSSVariables($currentCSS);
    
    header('Content-Type: application/json');
    echo json_encode(['success' => true, 'settings' => $settings]);
    
} catch (Exception $e) {
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => '读取设置失败: ' . $e->getMessage()]);
}

/**
 * 解析CSS文件中的变量
 */
function parseCSSVariables($css) {
    $settings = [];
    
    // 查找:root块
    $pattern = '/:root\s*\{([^}]*)\}/';
    
    if (preg_match($pattern, $css, $matches)) {
        $rootContent = $matches[1];
        
        // 解析各个变量
        preg_match_all('/--([a-zA-Z0-9_-]+):\s*([^;]+);/', $rootContent, $matches);
        
        foreach ($matches[1] as $index => $varName) {
            $value = trim($matches[2][$index]);
            
            // 转换变量名
            switch ($varName) {
                case 'primary-color':
                    $settings['primary_color'] = $value;
                    break;
                case 'secondary-color':
                    $settings['secondary_color'] = $value;
                    break;
                case 'success-color':
                    $settings['success_color'] = $value;
                    break;
                case 'danger-color':
                    $settings['danger_color'] = $value;
                    break;
                case 'warning-color':
                    $settings['warning_color'] = $value;
                    break;
                case 'info-color':
                    $settings['info_color'] = $value;
                    break;
                case 'font-family':
                    $settings['font_family'] = $value;
                    break;
                case 'font-size':
                    $settings['font_size'] = str_replace('px', '', $value);
                    break;
                case 'border-radius':
                    $settings['border_radius'] = str_replace('px', '', $value);
                    break;
                case 'card-shadow-level':
                    $settings['card_shadow'] = $value;
                    break;
                case 'navbar-style':
                    $settings['navbar_style'] = $value;
                    break;
            }
        }
    }
    
    return $settings;
}
?>