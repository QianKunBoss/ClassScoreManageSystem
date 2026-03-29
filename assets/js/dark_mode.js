/**
 * 深色/浅色模式切换功能
 */

(function() {
    // 检查本地存储中的主题设置
    const savedTheme = localStorage.getItem('theme') || 'light';

    // 标记是否已初始化事件监听器
    let eventListenersInitialized = false;

    // 判断颜色是否接近白色（用于自动调整文字颜色）
    function isLightColor(color) {
        // 处理 rgb() 格式
        if (color.startsWith('rgb')) {
            const rgb = color.match(/\d+/g);
            if (rgb && rgb.length >= 3) {
                const r = parseInt(rgb[0]);
                const g = parseInt(rgb[1]);
                const b = parseInt(rgb[2]);
                // 计算亮度 (YIQ公式)
                const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
                return yiq >= 128;
            }
        }
        // 处理十六进制格式
        if (color.startsWith('#')) {
            const hex = color.replace('#', '');
            if (hex.length === 3) {
                const r = parseInt(hex[0] + hex[0], 16);
                const g = parseInt(hex[1] + hex[1], 16);
                const b = parseInt(hex[2] + hex[2], 16);
                const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
                return yiq >= 128;
            } else if (hex.length === 6) {
                const r = parseInt(hex.substring(0, 2), 16);
                const g = parseInt(hex.substring(2, 4), 16);
                const b = parseInt(hex.substring(4, 6), 16);
                const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
                return yiq >= 128;
            }
        }
        return false;
    }

    // 根据导航栏背景色自动调整文字颜色
    function adjustNavbarTextColor() {
        const navbar = document.querySelector('.navbar');
        if (!navbar) return;

        const bgColor = window.getComputedStyle(navbar).backgroundColor;
        const isLight = isLightColor(bgColor);

        const textColor = isLight ? '#343a40' : '#ffffff';
        const hoverColor = isLight ? '#007bff' : 'rgba(255, 255, 255, 0.8)';

        // 调整导航链接颜色
        navbar.querySelectorAll('.navbar-brand, .nav-link, .nav-text').forEach(function(el) {
            el.style.setProperty('color', textColor, 'important');
        });

        // 只初始化一次事件监听器
        if (!eventListenersInitialized) {
            navbar.querySelectorAll('.nav-link, .nav-text').forEach(function(el) {
                el.addEventListener('mouseenter', function() {
                    this.style.setProperty('color', hoverColor, 'important');
                });
                el.addEventListener('mouseleave', function() {
                    this.style.setProperty('color', textColor, 'important');
                });
            });
            eventListenersInitialized = true;
        }
    }

    // 应用保存的主题
    function applyTheme(theme, event = null) {
        // 切换主题函数
        const toggleTheme = () => {
            if (theme === 'dark') {
                document.documentElement.setAttribute('data-theme', 'dark');
                document.getElementById('darkModeIcon').className = 'fas fa-moon';
            } else {
                document.documentElement.removeAttribute('data-theme');
                document.getElementById('darkModeIcon').className = 'fas fa-sun';
            }
            localStorage.setItem('theme', theme);

            // 主题切换后立即调整文字颜色
            adjustNavbarTextColor();
        };

        // 如果提供了事件对象（点击事件），使用 View Transition API
        if (event && document.startViewTransition) {
            // 获取点击位置
            const x = event.clientX;
            const y = event.clientY;

            // 计算最大半径（覆盖整个屏幕）
            const endRadius = Math.hypot(
                Math.max(x, window.innerWidth - x),
                Math.max(y, window.innerHeight - y)
            );

            // 设置CSS变量
            document.documentElement.style.setProperty('--theme-x', x + 'px');
            document.documentElement.style.setProperty('--theme-y', y + 'px');
            document.documentElement.style.setProperty('--theme-r', endRadius + 'px');

            // 使用 View Transition API
            document.startViewTransition(() => {
                toggleTheme();
            });
        } else {
            // 不支持 View Transition API 或没有事件对象，直接切换
            toggleTheme();
        }
    }

    // 初始化主题
    if (document.getElementById('darkModeToggle')) {
        applyTheme(savedTheme);

        // 绑定切换按钮事件
        document.getElementById('darkModeToggle').addEventListener('click', function(event) {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            applyTheme(newTheme, event);
        });
    }

    // 页面加载完成后调整文字颜色
    document.addEventListener('DOMContentLoaded', function() {
        adjustNavbarTextColor();
    });
})();