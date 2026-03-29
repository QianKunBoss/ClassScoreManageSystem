/**
 * 背景图片加载脚本
 * 在页面加载时自动应用用户选择的背景图片
 * 使用统一的开关控制，支持遮罩透明度
 * 支持自动适配文字颜色
 */

$(document).ready(function() {
    // 应用已选择的背景图片
    function applyStoredBackground() {
        const selectedThirdPartyApiUrl = localStorage.getItem('selectedThirdPartyApiUrl');
        const selectedBackgroundUrl = localStorage.getItem('selectedBackgroundUrl');
        const isEnabled = localStorage.getItem('enableBackgroundImage') !== 'false'; // 默认启用
        const maskOpacity = localStorage.getItem('backgroundMaskOpacity') || '70'; // 默认70%
        
        // 优先使用第三方 API，如果没有则使用本地背景图片
        const currentBg = selectedThirdPartyApiUrl || selectedBackgroundUrl;
        
        // 获取或创建背景样式元素
        let bgStyleElement = document.getElementById('background-styles');
        
        if (!isEnabled) {
            // 未启用：移除背景图片
            if (bgStyleElement) {
                bgStyleElement.remove();
            }
        } else {
            // 已启用：应用背景图片
            if (currentBg) {
                if (!bgStyleElement) {
                    bgStyleElement = document.createElement('style');
                    bgStyleElement.id = 'background-styles';
                    document.head.appendChild(bgStyleElement);
                }
                
                bgStyleElement.textContent = `
                    body {
                        background-image: url('${currentBg}') !important;
                        background-size: cover !important;
                        background-position: center !important;
                        background-attachment: fixed !important;
                        background-repeat: no-repeat !important;
                    }
                    body::before {
                        content: '';
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0, 0, 0, ${maskOpacity / 100});
                        pointer-events: none;
                        z-index: -1;
                    }
                `;
            }
        }
        
        // 应用卡片透明度
        applyCardOpacity();
    }
    
    // 应用卡片透明度
    function applyCardOpacity() {
        const cardOpacity = localStorage.getItem('cardOpacity') || '95';
        
        let opacityStyleElement = document.getElementById('card-opacity-styles');
        if (!opacityStyleElement) {
            opacityStyleElement = document.createElement('style');
            opacityStyleElement.id = 'card-opacity-styles';
            document.head.appendChild(opacityStyleElement);
        }
        
        opacityStyleElement.textContent = `
            .card {
                background-color: color-mix(in srgb, var(--card-bg) ${cardOpacity}%, transparent) !important;
            }
            .settings-sidebar {
                background-color: color-mix(in srgb, var(--card-bg) ${cardOpacity}%, transparent) !important;
            }
        `;
    }

    // 页面加载时应用背景图片
    applyStoredBackground();
    
    // 监听主题切换事件，实时更新背景图片
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.attributeName === 'data-theme') {
                applyStoredBackground();
            }
        });
    });
    
    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme']
    });
    
    // 监听 localStorage 变化（用于跨标签页同步）
    window.addEventListener('storage', function(e) {
        if (e.key === 'enableBackgroundImage' || 
            e.key === 'selectedBackgroundUrl' || 
            e.key === 'selectedThirdPartyApiUrl' || 
            e.key === 'backgroundMaskOpacity' || 
            e.key === 'cardOpacity') {
            applyStoredBackground();
        }
    });
});