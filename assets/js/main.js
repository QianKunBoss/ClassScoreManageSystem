// 开屏视频控制逻辑
document.addEventListener('DOMContentLoaded', function() {
    const splashVideo = document.getElementById('splash-video');
    const splashContainer = document.getElementById('splash-video-container');
    
    if (splashVideo && splashContainer) {
        // 添加splash-active类禁用滚动
        document.documentElement.classList.add('splash-active');
        document.body.classList.add('splash-active');
        
        // 视频结束事件处理
        splashVideo.onended = function() {
            splashContainer.style.opacity = '0';
            setTimeout(function() {
                splashContainer.style.display = 'none';
                // 移除splash-active类恢复滚动
                document.documentElement.classList.remove('splash-active');
                document.body.classList.remove('splash-active');
            }, 1000);
        };
    }
});