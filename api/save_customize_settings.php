<?php
/**
 * 保存个性化设置并更新int_main.css文件
 */

// 检查用户是否已登录
session_start();
if (!isset($_SESSION['username'])) {
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => '用户未登录']);
    exit;
}

// 获取POST数据
$data = json_decode(file_get_contents('php://input'), true);

if (!$data) {
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => '无效的数据']);
    exit;
}

try {
    // 读取当前的int_main.css文件
    $cssFilePath = '../assets/css/int_main.css';
    $currentCSS = file_get_contents($cssFilePath);

    // 更新CSS变量
    $newCSS = updateCSSVariables($currentCSS, $data);

    // 保存更新后的CSS文件
    file_put_contents($cssFilePath, $newCSS);

    // 获取文件修改时间作为版本号
    $version = filemtime($cssFilePath);

    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'message' => '设置已保存并更新CSS文件',
        'version' => $version
    ]);

} catch (Exception $e) {
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => '保存失败: ' . $e->getMessage()]);
}

/**
 * 更新CSS文件中的变量
 */
function updateCSSVariables($css, $settings) {
    // 查找:root块
    $pattern = '/:root\s*\{([^}]*)\}/';
    
    if (preg_match($pattern, $css, $matches)) {
        $rootContent = $matches[1];
        $lines = explode("\n", $rootContent);
        $newLines = [];
        
        // 处理每一行
        foreach ($lines as $line) {
            $trimmedLine = trim($line);
            
            // 跳过空行和注释
            if (empty($trimmedLine) || strpos($trimmedLine, '/*') === 0 || strpos($trimmedLine, '//') === 0) {
                $newLines[] = $line;
                continue;
            }
            
            // 检查是否是CSS变量行
            if (preg_match('/--([a-zA-Z0-9_-]+):/', $trimmedLine, $varMatches)) {
                $varName = $varMatches[1];
                
                // 根据变量名更新值
                switch ($varName) {
                    case 'primary-color':
                        if (isset($settings['primary_color'])) {
                            $newLines[] = '    --primary-color: ' . $settings['primary_color'] . ';';
                            continue 2;
                        }
                        break;
                    case 'secondary-color':
                        if (isset($settings['secondary_color'])) {
                            $newLines[] = '    --secondary-color: ' . $settings['secondary_color'] . ';';
                            continue 2;
                        }
                        break;
                    case 'success-color':
                        if (isset($settings['success_color'])) {
                            $newLines[] = '    --success-color: ' . $settings['success_color'] . ';';
                            continue 2;
                        }
                        break;
                    case 'danger-color':
                        if (isset($settings['danger_color'])) {
                            $newLines[] = '    --danger-color: ' . $settings['danger_color'] . ';';
                            continue 2;
                        }
                        break;
                    case 'warning-color':
                        if (isset($settings['warning_color'])) {
                            $newLines[] = '    --warning-color: ' . $settings['warning_color'] . ';';
                            continue 2;
                        }
                        break;
                    case 'info-color':
                        if (isset($settings['info_color'])) {
                            $newLines[] = '    --info-color: ' . $settings['info_color'] . ';';
                            continue 2;
                        }
                        break;
                    case 'font-family':
                        if (isset($settings['font_family'])) {
                            $newLines[] = '    --font-family: ' . $settings['font_family'] . ';';
                            continue 2;
                        }
                        break;
                    case 'font-size':
                        if (isset($settings['font_size'])) {
                            $newLines[] = '    --font-size: ' . $settings['font_size'] . 'px;';
                            continue 2;
                        }
                        break;
                    case 'border-radius':
                        if (isset($settings['border_radius'])) {
                            $newLines[] = '    --border-radius: ' . $settings['border_radius'] . 'px;';
                            continue 2;
                        }
                        break;
                    case 'card-shadow-level':
                        if (isset($settings['card_shadow'])) {
                            $newLines[] = '    --card-shadow-level: ' . $settings['card_shadow'] . ';';
                            continue 2;
                        }
                        break;
                    case 'navbar-style':
                        if (isset($settings['navbar_style'])) {
                            $newLines[] = '    --navbar-style: ' . $settings['navbar_style'] . ';';
                            continue 2;
                        }
                        break;
                }
            }
            
            // 保留原行
            $newLines[] = $line;
        }
        
        // 重新构建:root块
        $newRootBlock = ":root {\n" . implode("\n", $newLines) . "\n}";
        
        // 替换原CSS中的:root块
        $newCSS = preg_replace($pattern, $newRootBlock, $css);
        return $newCSS;
    }
    
    return $css;
}
?>