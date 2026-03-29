/**
 * 智能颜色对比度检测和调整系统
 * 根据主题色自动调整文字和边框颜色，确保良好的可读性
 */

/**
 * 计算颜色的相对亮度
 * @param {string} hex - 十六进制颜色值
 * @returns {number} 相对亮度值 (0-1)
 */
function getLuminance(hex) {
    // 移除 # 号
    hex = hex.replace('#', '');
    
    // 转换为RGB
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;
    
    // 计算相对亮度
    const RsRGB = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
    const GsRGB = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
    const BsRGB = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
    
    return 0.2126 * RsRGB + 0.7152 * GsRGB + 0.0722 * BsRGB;
}

/**
 * 计算两个颜色之间的对比度
 * @param {string} color1 - 第一个颜色
 * @param {string} color2 - 第二个颜色
 * @returns {number} 对比度值 (1-21)
 */
function getContrastRatio(color1, color2) {
    const lum1 = getLuminance(color1);
    const lum2 = getLuminance(color2);
    
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    
    return (brightest + 0.05) / (darkest + 0.05);
}

/**
 * 根据背景色智能选择文字颜色
 * @param {string} backgroundColor - 背景颜色
 * @returns {string} 文字颜色 (#000000 或 #FFFFFF)
 */
function getSmartTextColor(backgroundColor) {
    const whiteContrast = getContrastRatio(backgroundColor, '#ffffff');
    const blackContrast = getContrastRatio(backgroundColor, '#000000');
    
    // WCAG标准要求对比度至少为4.5:1
    return whiteContrast >= 4.5 ? '#ffffff' : '#000000';
}

/**
 * 生成智能的颜色变体
 * @param {string} baseColor - 基础颜色
 * @returns {Object} 包含各种颜色变体的对象
 */
function generateSmartColors(baseColor) {
    const textColor = getSmartTextColor(baseColor);
    
    return {
        primary: baseColor,
        text: textColor,
        border: baseColor,
        hover: adjustColor(baseColor, -15), // 稍微变暗
        light: adjustColor(baseColor, 10),  // 稍微变亮
        lightBg: hexToRgba(baseColor, 0.1), // 10%透明度
        mediumBg: hexToRgba(baseColor, 0.2), // 20%透明度
    };
}

/**
 * 调整颜色亮度
 * @param {string} color - 原始颜色
 * @param {number} percent - 调整百分比 (-100 到 100)
 * @returns {string} 调整后的颜色
 */
function adjustColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255))
        .toString(16).slice(1);
}

/**
 * 将十六进制颜色转换为RGBA
 * @param {string} hex - 十六进制颜色
 * @param {number} alpha - 透明度 (0-1)
 * @returns {string} RGBA颜色值
 */
function hexToRgba(hex, alpha) {
    const r = parseInt(hex.substr(1, 2), 16);
    const g = parseInt(hex.substr(3, 2), 16);
    const b = parseInt(hex.substr(5, 2), 16);
    
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * 应用智能颜色主题
 * @param {string} primaryColor - 主题色
 */
function applySmartColorTheme(primaryColor) {
    const colors = generateSmartColors(primaryColor);
    
    // 更新CSS变量
    const root = document.documentElement;
    root.style.setProperty('--primary-text', colors.text);
    root.style.setProperty('--primary-border', colors.border);
    root.style.setProperty('--primary-hover-bg', colors.hover);
    root.style.setProperty('--primary-light-bg', colors.lightBg);
    
    // 检查是否需要调整背景色
    const primaryLuminance = getLuminance(primaryColor);
    
    // 如果主题色太亮，调整相关的背景色
    if (primaryLuminance > 0.8) {
        root.style.setProperty('--light-gray', '#f8f9fa');
        root.style.setProperty('--sidebar-color', '#f8f9fa');
    }
    // 如果主题色太暗，确保文字对比度
    else if (primaryLuminance < 0.2) {
        root.style.setProperty('--text-dark', '#343a40');
        root.style.setProperty('--sidebar-color', '#f8f9fa');
    }
}

// 导出函数供全局使用
window.smartColors = {
    getLuminance,
    getContrastRatio,
    getSmartTextColor,
    generateSmartColors,
    adjustColor,
    hexToRgba,
    applySmartColorTheme
};