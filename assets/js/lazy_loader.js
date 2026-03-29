/**
 * 懒加载优化脚本
 * 优先加载样式，延迟加载内容数据
 */

(function() {
    // 页面加载完成后执行
    document.addEventListener('DOMContentLoaded', function() {
        // 查找所有带有 data-lazy-load 属性的容器
        const lazyContainers = document.querySelectorAll('[data-lazy-load]');
        
        lazyContainers.forEach(function(container) {
            const loadUrl = container.getAttribute('data-load-url');
            const loadMethod = container.getAttribute('data-load-method') || 'GET';
            const loadParams = container.getAttribute('data-load-params') || '';
            
            if (loadUrl) {
                // 显示加载状态
                container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">加载中...</span></div><p class="mt-3 text-muted">正在加载数据...</p></div>';
                
                // 发送请求加载数据
                fetch(loadUrl, {
                    method: loadMethod,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: loadMethod === 'POST' ? loadParams : undefined
                })
                .then(response => response.text())
                .then(html => {
                    // 淡入效果
                    container.style.opacity = '0';
                    container.innerHTML = html;
                    container.style.transition = 'opacity 0.3s ease';
                    setTimeout(() => {
                        container.style.opacity = '1';
                    }, 50);
                })
                .catch(error => {
                    container.innerHTML = '<div class="alert alert-danger"><i class="fas fa-exclamation-triangle"></i> 数据加载失败，请刷新页面重试</div>';
                    console.error('Lazy load error:', error);
                });
            }
        });
    });

    // 提供全局函数供手动触发懒加载
    window.lazyLoad = function(containerId, url, method = 'GET', params = '') {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.setAttribute('data-lazy-load', 'true');
        container.setAttribute('data-load-url', url);
        container.setAttribute('data-load-method', method);
        container.setAttribute('data-load-params', params);
        
        // 触发自定义事件来加载
        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);
    };
})();