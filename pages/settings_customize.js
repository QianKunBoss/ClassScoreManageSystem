// 个性化设置功能
let customizeSettings = {};

// 加载个性化设置（从CSS文件读取）
function loadCustomizeSettings() {
    // 创建临时元素读取CSS变量值
    const temp = document.createElement('div');
    temp.style.display = 'none';
    document.body.appendChild(temp);

    // 从CSS变量中读取当前值
    const computedStyle = getComputedStyle(temp);
    customizeSettings = {
        primary_color: getCSSVariableValue('--primary-color'),
        secondary_color: getCSSVariableValue('--secondary-color'),
        success_color: getCSSVariableValue('--success-color'),
        danger_color: getCSSVariableValue('--danger-color'),
        warning_color: getCSSVariableValue('--warning-color'),
        info_color: getCSSVariableValue('--info-color'),
        font_family: getCSSVariableValue('--font-family'),
        font_size: parseInt(getCSSVariableValue('--font-size')) || '16',
        border_radius: parseInt(getCSSVariableValue('--border-radius')) || '8',
        card_shadow: getCSSVariableValue('--card-shadow-level') || '1',
        navbar_style: getCSSVariableValue('--navbar-style') || 'primary'
    };

    document.body.removeChild(temp);

    // 应用设置到页面预览
    applyCustomizeSettings(customizeSettings);
    // 更新表单控件值
    updateCustomizeForm(customizeSettings);
}

// 获取CSS变量值的辅助函数
function getCSSVariableValue(varName) {
    const element = document.documentElement;
    return getComputedStyle(element).getPropertyValue(varName).trim();
}

// 应用个性化设置到页面
function applyCustomizeSettings(settings) {
    // 创建或更新自定义样式
    let customCSS = `
        :root {
            --primary-color: ${settings.primary_color || '#667eea'};
            --secondary-color: ${settings.secondary_color || '#6c757d'};
            --success-color: ${settings.success_color || '#28a745'};
            --danger-color: ${settings.danger_color || '#dc3545'};
            --warning-color: ${settings.warning_color || '#ffc107'};
            --info-color: ${settings.info_color || '#17a2b8'};
            --font-family: ${settings.font_family || 'HarmonyOS Sans SC, sans-serif'};
            --font-size: ${settings.font_size || '16'}px;
            --border-radius: ${settings.border_radius || '5'}px;
        }
        
        body {
            font-family: var(--font-family);
            font-size: var(--font-size);
        }
        
        .btn-primary {
            background-color: var(--primary-color) !important;
            border-color: var(--primary-color) !important;
        }
        
        .btn-primary:hover {
            background-color: color-mix(in srgb, var(--primary-color) 85%, black) !important;
            border-color: color-mix(in srgb, var(--primary-color) 85%, black) !important;
        }
        
        .settings-sidebar .nav-link.active {
            background-color: var(--primary-color) !important;
        }
        
        .card {
            border-radius: var(--border-radius) !important;
        }
        
        .btn, .form-control, .form-select {
            border-radius: var(--border-radius) !important;
        }
        
        .settings-sidebar {
            background-color: var(--sidebar-color) !important;
        }
    `;
    
    // 卡片阴影
    const shadowLevel = parseInt(settings.card_shadow || '1');
    if (shadowLevel === 0) {
        customCSS += `.card { box-shadow: none !important; }`;
    } else if (shadowLevel === 1) {
        customCSS += `.card { box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075) !important; }`;
    } else if (shadowLevel === 2) {
        customCSS += `.card { box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15) !important; }`;
    } else if (shadowLevel === 3) {
        customCSS += `.card { box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.175) !important; }`;
    }
    
    // 导航栏样式
    const navbarStyle = settings.navbar_style || 'light';
    if (navbarStyle === 'dark') {
        customCSS += `.navbar { background-color: #343a40 !important; }`;
        customCSS += `.navbar .navbar-brand, .navbar .nav-link { color: #fff !important; }`;
    } else if (navbarStyle === 'primary') {
        customCSS += `.navbar { background-color: var(--primary-color) !important; }`;
        customCSS += `.navbar .navbar-brand, .navbar .nav-link { color: #fff !important; }`;
    }
    
    // 更新或创建样式标签
    let styleElement = document.getElementById('customize-styles');
    if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = 'customize-styles';
        document.head.appendChild(styleElement);
    }
    styleElement.textContent = customCSS;
}

// 更新表单控件的值
function updateCustomizeForm(settings) {
    // 颜色设置
    Object.keys(settings).forEach(key => {
        if (key.includes('_color')) {
            const colorInput = $(`input[name="${key}"]`);
            const textInput = $(`input[name="${key}_text"]`);
            if (colorInput.length) colorInput.val(settings[key]);
            if (textInput.length) textInput.val(settings[key]);
        }
    });
    
    // 其他设置
    $('select[name="font_family"]').val(settings.font_family || 'HarmonyOS Sans SC, sans-serif');
    $('input[name="font_size"]').val(settings.font_size || '16');
    $('#fontSizeValue').text((settings.font_size || '16') + 'px');
    $('input[name="border_radius"]').val(settings.border_radius || '5');
    $('#borderRadiusValue').text((settings.border_radius || '5') + 'px');
    $('select[name="card_shadow"]').val(settings.card_shadow || '1');
    $('select[name="navbar_style"]').val(settings.navbar_style || 'light');
}

// 更新CSS版本号，强制浏览器重新加载
function updateCSSVersion(version) {
    $('link[href*="int_main.css"]').each(function() {
        const href = $(this).attr('href');
        const newHref = href.replace(/\?v=\d+/, '') + '?v=' + version;
        $(this).attr('href', newHref);
    });
}

// 应用卡片透明度
function applyCardOpacity(opacity) {
    // 创建或更新透明度样式
    let opacityStyleElement = document.getElementById('card-opacity-styles');
    if (!opacityStyleElement) {
        opacityStyleElement = document.createElement('style');
        opacityStyleElement.id = 'card-opacity-styles';
        document.head.appendChild(opacityStyleElement);
    }
    
    opacityStyleElement.textContent = `
        .card {
            background-color: color-mix(in srgb, var(--card-bg) ${opacity}%, transparent) !important;
        }
    `;
    
    // 保存到 localStorage
    localStorage.setItem('cardOpacity', opacity);
}

$(document).ready(function() {
    // ================== 个性化设置功能 ==================
    
    // 实时预览 - 颜色变化
    $('input[name$="_color"]').on('input', function() {
        const colorName = $(this).attr('name');
        const colorValue = $(this).val();
        
        // 同步文本输入框
        $(`input[name="${colorName}_text"]`).val(colorValue);
        
        // 实时应用设置
        customizeSettings[colorName] = colorValue;
        applyCustomizeSettings(customizeSettings);
    });
    
    // 实时预览 - 文本输入颜色
    $('input[name$="_color_text"]').on('input', function() {
        const colorName = $(this).attr('name').replace('_text', '');
        const colorValue = $(this).val();
        
        // 验证颜色格式
        if (/^#[0-9A-Fa-f]{6}$/.test(colorValue)) {
            // 同步颜色选择器
            $(`input[name="${colorName}"]`).val(colorValue);
            
            // 实时应用设置
            customizeSettings[colorName] = colorValue;
            applyCustomizeSettings(customizeSettings);
        }
    });
    
    // 实时预览 - 字体
    $('select[name="font_family"]').on('change', function() {
        customizeSettings.font_family = $(this).val();
        applyCustomizeSettings(customizeSettings);
    });
    
    // 实时预览 - 字体大小
    $('input[name="font_size"]').on('input', function() {
        const fontSize = $(this).val();
        $('#fontSizeValue').text(fontSize + 'px');
        customizeSettings.font_size = fontSize;
        applyCustomizeSettings(customizeSettings);
    });
    
    // 实时预览 - 圆角
    $('input[name="border_radius"]').on('input', function() {
        const borderRadius = $(this).val();
        $('#borderRadiusValue').text(borderRadius + 'px');
        customizeSettings.border_radius = borderRadius;
        applyCustomizeSettings(customizeSettings);
    });
    
    // 实时预览 - 卡片阴影
    $('select[name="card_shadow"]').on('change', function() {
        customizeSettings.card_shadow = $(this).val();
        applyCustomizeSettings(customizeSettings);
    });
    
    // 实时预览 - 导航栏样式
    $('select[name="navbar_style"]').on('change', function() {
        customizeSettings.navbar_style = $(this).val();
        applyCustomizeSettings(customizeSettings);
    });
    
    // 实时预览 - 卡片透明度
    $('input[name="card_opacity"]').on('input', function() {
        const cardOpacity = $(this).val();
        $('#cardOpacityValue').text(cardOpacity + '%');
        applyCardOpacity(cardOpacity);
    });
    
    // 保存个性化设置
    $('#customizeForm').on('submit', function(e) {
        e.preventDefault();

        const $btn = $('#saveCustomizeBtn');
        const originalText = $btn.text();

        // 显示加载状态
        $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 保存中...');

        $.ajax({
            url: '../api/save_customize_settings.php',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(customizeSettings),
            dataType: 'json',
            success: function(response) {
                if(response.success) {
                    showToast(response.message, 'success');
                    // 更新CSS版本号，强制浏览器重新加载
                    if(response.version) {
                        updateCSSVersion(response.version);
                    }
                } else {
                    showToast(response.message, 'error');
                }
            },
            error: function() {
                showToast('保存个性化设置失败，请重试！', 'error');
            },
            complete: function() {
                $btn.prop('disabled', false).text(originalText);
            }
        });
    });
    
    // 重置个性化设置
    $('#resetCustomizeBtn').click(function() {
        if (confirm('确定要重置为默认设置吗？')) {
            const $btn = $(this);
            const originalText = $btn.text();

            // 显示加载状态
            $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 重置中...');

            $.ajax({
                url: '../api/reset_customize_settings.php',
                type: 'POST',
                dataType: 'json',
                success: function(response) {
                    if(response.success) {
                        showToast(response.message, 'success');
                        // 更新CSS版本号，强制浏览器重新加载
                        if(response.version) {
                            updateCSSVersion(response.version);
                        }
                        // 重新加载设置
                        loadCustomizeSettings();
                    } else {
                        showToast(response.message, 'error');
                    }
                },
                error: function() {
                    showToast('重置个性化设置失败，请重试！', 'error');
                },
                complete: function() {
                    $btn.prop('disabled', false).text(originalText);
                }
            });
        }
    });

    // ================== 背景图片管理功能 ==================
    
    // 加载背景图片列表
    function loadBackgroundImages() {
        const $grid = $('#backgroundImagesGrid');
        $grid.html('<div class="col-12 text-center"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">加载中...</span></div></div>');

        $.ajax({
            url: '../api/get_backgrounds.php',
            type: 'GET',
            dataType: 'json',
            success: function(response) {
                if (response.success) {
                    renderBackgroundImages(response.backgrounds);
                    loadCurrentBackground();
                } else {
                    $grid.html('<div class="col-12 text-center text-muted">加载失败</div>');
                }
            },
            error: function() {
                $grid.html('<div class="col-12 text-center text-muted">加载失败，请重试</div>');
            }
        });
    }

    // 渲染背景图片缩略图
    function renderBackgroundImages(backgrounds) {
        const $grid = $('#backgroundImagesGrid');

        if (backgrounds.length === 0) {
            $grid.html('<div class="col-12 text-center text-muted">暂无背景图片，请上传</div>');
            return;
        }

        let html = '';
        const selectedBackground = localStorage.getItem('selectedBackground');

        backgrounds.forEach(function(bg) {
            const isSelected = selectedBackground === bg.filename;
            html += `
                <div class="col-md-3 col-sm-4 col-6">
                    <div class="card bg-image-card ${isSelected ? 'border-primary' : ''}" data-filename="${bg.filename}">
                        <div class="position-relative">
                            <img src="${bg.url}" class="card-img-top bg-thumbnail" alt="背景图片" style="height: 100px; object-fit: cover;">
                            ${isSelected ? '<div class="position-absolute top-0 start-0 bg-primary text-white rounded-circle" style="width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;"><i class="fas fa-check" style="font-size: 12px;"></i></div>' : ''}
                            <button class="btn btn-sm btn-danger position-absolute top-0 end-0 delete-bg-btn" data-filename="${bg.filename}" style="display: none;">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                        <div class="card-body p-2">
                            <small class="text-muted d-block text-truncate" title="${bg.filename}">${bg.filename}</small>
                            <div class="d-flex justify-content-between align-items-center mt-1">
                                <small class="text-muted">${(bg.size / 1024).toFixed(1)} KB</small>
                                <button class="btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline-primary'} select-bg-btn" data-filename="${bg.filename}" data-url="${bg.url}">
                                    ${isSelected ? '已选择' : '选择'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        $grid.html(html);

        // 如果有选中的本地背景图片，清除第三方 API 的选中状态
        if (selectedBackground) {
            $('.bg-image-card[data-api-id]').removeClass('border-primary');
            $('.select-api-btn').removeClass('btn-primary').addClass('btn-outline-primary').text('选择');
        }

        // 绑定事件
        bindBackgroundImageEvents();
    }

    // 绑定背景图片事件
    function bindBackgroundImageEvents() {
        // 悬停显示删除按钮
        $('.bg-image-card').hover(
            function() { $(this).find('.delete-bg-btn').fadeIn(); },
            function() { $(this).find('.delete-bg-btn').fadeOut(); }
        );
        
        // 选择背景图片
        $('.select-bg-btn').click(function() {
            const filename = $(this).data('filename');
            const url = $(this).data('url');
            selectBackground(filename, url);
        });
        
        // 删除背景图片
        $('.delete-bg-btn').click(function(e) {
            e.stopPropagation();
            const filename = $(this).data('filename');
            if (confirm('确定要删除这张背景图片吗？')) {
                deleteBackground(filename);
            }
        });
    }

    // 选择背景图片
    function selectBackground(filename, url) {
        localStorage.setItem('selectedBackground', filename);
        localStorage.setItem('selectedBackgroundUrl', url);

        // 清除第三方 API 的选择
        localStorage.removeItem('selectedThirdPartyApi');
        localStorage.removeItem('selectedThirdPartyApiUrl');
        localStorage.removeItem('selectedThirdPartyApiName');

        // 更新UI - 本地背景图片
        $('.bg-image-card').removeClass('border-primary');
        $(`.bg-image-card[data-filename="${filename}"]`).addClass('border-primary');

        // 更新UI - 第三方 API
        $('.bg-image-card[data-api-id]').removeClass('border-primary');
        $('.select-api-btn').removeClass('btn-primary').addClass('btn-outline-primary').text('选择');

        $('.select-bg-btn').removeClass('btn-primary').addClass('btn-outline-primary').text('选择');
        $(`.select-bg-btn[data-filename="${filename}"]`).removeClass('btn-outline-primary').addClass('btn-primary').text('已选择');

        // 更新当前背景预览
        updateCurrentBackgroundPreview(url);

        // 应用背景到页面
        applyBackgroundToPage(url);

        showToast('背景图片已选择', 'success');
    }

    // 加载当前选择的背景
    function loadCurrentBackground() {
        const selectedThirdPartyApiUrl = localStorage.getItem('selectedThirdPartyApiUrl');
        const selectedBackgroundUrl = localStorage.getItem('selectedBackgroundUrl');

        // 优先使用第三方 API，否则使用本地背景图片
        const currentBg = selectedThirdPartyApiUrl || selectedBackgroundUrl;
        updateCurrentBackgroundPreview(currentBg);

        if (currentBg) {
            if (selectedThirdPartyApiUrl) {
                // 如果选择了第三方 API，应用第三方 API
                applyThirdPartyApiToPage(selectedThirdPartyApiUrl);
            } else {
                // 否则应用本地背景图片
                applyBackgroundToPage(selectedBackgroundUrl);
            }
        }
    }

    // 更新当前背景预览
    function updateCurrentBackgroundPreview(url) {
        const $preview = $('#currentBackgroundPreview');
        if (url) {
            $preview.html(`<img src="${url}" class="img-fluid rounded" style="max-height: 200px; width: 100%; object-fit: cover;">`);
        } else {
            $preview.html('<div class="text-muted">未选择背景图片</div>');
        }
    }

    // 应用背景到页面
    function applyBackgroundToPage(url) {
        if (!url) return;
        
        const isEnabled = localStorage.getItem('enableBackgroundImage') !== 'false';
        const maskOpacity = localStorage.getItem('backgroundMaskOpacity') || '70';
        
        // 获取或创建背景样式元素
        let bgStyleElement = document.getElementById('background-styles');
        
        if (!isEnabled) {
            // 未启用：移除背景图片
            if (bgStyleElement) {
                bgStyleElement.remove();
            }
        } else {
            // 已启用：应用背景图片
            if (!bgStyleElement) {
                bgStyleElement = document.createElement('style');
                bgStyleElement.id = 'background-styles';
                document.head.appendChild(bgStyleElement);
            }
            
            bgStyleElement.textContent = `
                body {
                    background-image: url('${url}') !important;
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

    // 上传背景图片
    $('#uploadBackgroundBtn').click(function() {
        const fileInput = $('#backgroundImageInput')[0];
        
        if (!fileInput.files || fileInput.files.length === 0) {
            showToast('请选择要上传的图片', 'warning');
            return;
        }
        
        const file = fileInput.files[0];
        
        // 验证文件类型
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            showToast('只支持 JPG、PNG、WebP、GIF 格式的图片', 'error');
            return;
        }
        
        // 验证文件大小（5MB）
        if (file.size > 5 * 1024 * 1024) {
            showToast('图片大小不能超过 5MB', 'error');
            return;
        }
        
        const formData = new FormData();
        formData.append('background_image', file);
        
        const $btn = $(this);
        const originalText = $btn.html();
        
        // 显示加载状态
        $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 上传中...');
        
        $.ajax({
            url: '../api/upload_background.php',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            dataType: 'json',
            success: function(response) {
                if (response.success) {
                    showToast(response.message, 'success');
                    // 清空文件输入
                    fileInput.value = '';
                    // 重新加载背景图片列表
                    loadBackgroundImages();
                } else {
                    showToast(response.message, 'error');
                }
            },
            error: function(xhr, status, error) {
                console.error('上传错误:', error);
                console.error('响应状态:', xhr.status);
                console.error('响应文本:', xhr.responseText);
                showToast('上传失败，请重试', 'error');
            },
            complete: function() {
                $btn.prop('disabled', false).html(originalText);
            }
        });
    });

    // 删除背景图片
    function deleteBackground(filename) {
        $.ajax({
            url: '../api/delete_background.php',
            type: 'POST',
            data: { filename: filename },
            dataType: 'json',
            success: function(response) {
                if (response.success) {
                    showToast(response.message, 'success');
                    // 如果删除的是当前选择的背景，清除选择
                    if (localStorage.getItem('selectedBackground') === filename) {
                        localStorage.removeItem('selectedBackground');
                        localStorage.removeItem('selectedBackgroundUrl');
                        // 移除背景样式
                        const bgStyleElement = document.getElementById('background-styles');
                        if (bgStyleElement) {
                            bgStyleElement.remove();
                        }
                        updateCurrentBackgroundPreview(null);
                    }
                    // 重新加载背景图片列表
                    loadBackgroundImages();
                } else {
                    showToast(response.message, 'error');
                }
            },
            error: function() {
                showToast('删除失败，请重试', 'error');
            }
        });
    }

    // 初始化时加载个性化设置
    loadCustomizeSettings();

    // 初始化时加载背景图片列表
    loadBackgroundImages();

    // 初始化时应用当前选择的背景（本地或第三方 API）
    const selectedThirdPartyApiUrl = localStorage.getItem('selectedThirdPartyApiUrl');
    const selectedBackgroundUrl = localStorage.getItem('selectedBackgroundUrl');

    if (selectedThirdPartyApiUrl) {
        applyThirdPartyApiToPage(selectedThirdPartyApiUrl);
    } else if (selectedBackgroundUrl) {
        applyBackgroundToPage(selectedBackgroundUrl);
    }
    
    // 背景图片开关事件
    $('#enableBackgroundImage').change(function() {
        const isEnabled = $(this).prop('checked');
        localStorage.setItem('enableBackgroundImage', isEnabled);

        // 更新背景图片设置内容区域的遮罩状态
        const $bgSettingsContent = $('#backgroundSettingsContent');
        if (isEnabled) {
            // 移除遮罩
            $bgSettingsContent.css('opacity', '1').css('pointer-events', 'auto');
        } else {
            // 添加遮罩
            $bgSettingsContent.css('opacity', '0.5').css('pointer-events', 'none');
        }

        // 根据当前选择的内容类型应用背景
        const selectedThirdPartyApiUrl = localStorage.getItem('selectedThirdPartyApiUrl');
        const selectedBackgroundUrl = localStorage.getItem('selectedBackgroundUrl');

        if (selectedThirdPartyApiUrl) {
            // 如果选择了第三方 API，应用第三方 API
            applyThirdPartyApiToPage(selectedThirdPartyApiUrl);
        } else {
            // 否则应用本地背景图片
            applyBackgroundToPage(selectedBackgroundUrl);
        }

        showToast(isEnabled ? '背景图片已启用' : '背景图片已禁用', 'success');
    });
    
    // 背景遮罩透明度滑块事件
    $('input[name="background_mask_opacity"]').on('input', function() {
        const opacity = $(this).val();
        $('#backgroundMaskOpacityValue').text(opacity + '%');
        localStorage.setItem('backgroundMaskOpacity', opacity);

        // 只有在启用背景图片时才应用背景
        const isEnabled = $('#enableBackgroundImage').prop('checked');
        if (!isEnabled) return;

        // 根据当前选择的内容类型应用背景
        const selectedThirdPartyApiUrl = localStorage.getItem('selectedThirdPartyApiUrl');
        const selectedBackgroundUrl = localStorage.getItem('selectedBackgroundUrl');

        if (selectedThirdPartyApiUrl) {
            // 如果选择了第三方 API，应用第三方 API
            applyThirdPartyApiToPage(selectedThirdPartyApiUrl);
        } else {
            // 否则应用本地背景图片
            applyBackgroundToPage(selectedBackgroundUrl);
        }
    });
    
    // 初始化背景图片开关状态
    const isBackgroundEnabled = localStorage.getItem('enableBackgroundImage') !== 'false';
    $('#enableBackgroundImage').prop('checked', isBackgroundEnabled);
    
    // 初始化背景图片设置内容区域的遮罩状态
    const $bgSettingsContent = $('#backgroundSettingsContent');
    if (isBackgroundEnabled) {
        $bgSettingsContent.css('opacity', '1').css('pointer-events', 'auto');
    } else {
        $bgSettingsContent.css('opacity', '0.5').css('pointer-events', 'none');
    }
    
    // 初始化背景遮罩透明度
    const maskOpacity = localStorage.getItem('backgroundMaskOpacity') || '70';
    $('input[name="background_mask_opacity"]').val(maskOpacity);
    $('#backgroundMaskOpacityValue').text(maskOpacity + '%');
    
    // 初始化卡片透明度
    const cardOpacity = localStorage.getItem('cardOpacity') || '95';
    $('input[name="card_opacity"]').val(cardOpacity);
    $('#cardOpacityValue').text(cardOpacity + '%');
    applyCardOpacity(cardOpacity);
    
    // 当切换到个性化设置标签时刷新背景图片列表
    $('a[data-target="customize"]').click(function() {
        loadBackgroundImages();
        loadThirdPartyApis();

        // 重新应用当前选择的背景
        const selectedThirdPartyApiUrl = localStorage.getItem('selectedThirdPartyApiUrl');
        const selectedBackgroundUrl = localStorage.getItem('selectedBackgroundUrl');

        if (selectedThirdPartyApiUrl) {
            applyThirdPartyApiToPage(selectedThirdPartyApiUrl);
        } else if (selectedBackgroundUrl) {
            applyBackgroundToPage(selectedBackgroundUrl);
        }
    });
    
    // ================== 第三方图片 API 管理功能 ==================
    
    // 加载第三方 API 列表
    function loadThirdPartyApis() {
        const $grid = $('#thirdPartyApiGrid');
        $grid.html('<div class="col-12 text-center"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">加载中...</span></div></div>');

        $.ajax({
            url: '../api/third_party_api.php',
            type: 'GET',
            dataType: 'json',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            },
            success: function(response) {
                if (response.success) {
                    renderThirdPartyApis(response.data);
                } else {
                    $grid.html('<div class="col-12 text-center text-muted">加载失败: ' + (response.message || '未知错误') + '</div>');
                }
            },
            error: function(xhr, status, error) {
                console.error('加载第三方API失败:', error);
                console.error('响应状态:', xhr.status);
                console.error('响应文本:', xhr.responseText);
                $grid.html('<div class="col-12 text-center text-muted">加载失败，请重试</div>');
            }
        });
    }

    // 渲染第三方 API 卡片
    function renderThirdPartyApis(apis) {
        const $grid = $('#thirdPartyApiGrid');

        if (apis.length === 0) {
            $grid.html('<div class="col-12 text-center text-muted">暂无第三方 API，请添加</div>');
            return;
        }

        let html = '';
        const selectedThirdPartyApi = localStorage.getItem('selectedThirdPartyApi');

        apis.forEach(function(api) {
            const isSelected = selectedThirdPartyApi === api.id.toString();
            html += `
                <div class="col-md-4 col-sm-6 col-12">
                    <div class="card bg-image-card ${isSelected ? 'border-primary' : ''}" data-api-id="${api.id}">
                        <div class="card-body p-3">
                            <h6 class="card-title mb-2"><i class="fas fa-globe me-2"></i>${api.api_name}</h6>
                            <p class="card-text text-muted small text-truncate" title="${api.api_url}">${api.api_url}</p>
                            <div class="d-flex justify-content-between align-items-center mt-2">
                                <small class="text-muted">${api.created_at}</small>
                                <div class="btn-group btn-group-sm">
                                    <button class="btn ${isSelected ? 'btn-primary' : 'btn-outline-primary'} select-api-btn" data-api-id="${api.id}" data-api-url="${api.api_url}" data-api-name="${api.api_name}">
                                        ${isSelected ? '已选择' : '选择'}
                                    </button>
                                    <button class="btn btn-danger delete-api-btn" data-api-id="${api.id}" data-api-name="${api.api_name}">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        $grid.html(html);

        // 如果有选中的第三方 API，清除本地背景图片的选中状态
        if (selectedThirdPartyApi) {
            $('.bg-image-card[data-filename]').removeClass('border-primary');
            $('.select-bg-btn').removeClass('btn-primary').addClass('btn-outline-primary').text('选择');
        }

        // 绑定事件
        bindThirdPartyApiEvents();
    }

    // 绑定第三方 API 事件
    function bindThirdPartyApiEvents() {
        // 选择第三方 API
        $('.select-api-btn').click(function() {
            const apiId = $(this).data('api-id');
            const apiUrl = $(this).data('api-url');
            const apiName = $(this).data('api-name');
            selectThirdPartyApi(apiId, apiUrl, apiName);
        });
        
        // 删除第三方 API
        $('.delete-api-btn').click(function(e) {
            e.stopPropagation();
            const apiId = $(this).data('api-id');
            const apiName = $(this).data('api-name');
            showDeleteApiModal(apiId, apiName);
        });
    }

    // 选择第三方 API
    function selectThirdPartyApi(apiId, apiUrl, apiName) {
        localStorage.setItem('selectedThirdPartyApi', apiId.toString());
        localStorage.setItem('selectedThirdPartyApiUrl', apiUrl);
        localStorage.setItem('selectedThirdPartyApiName', apiName);

        // 清除本地背景图片的选择
        localStorage.removeItem('selectedBackground');
        localStorage.removeItem('selectedBackgroundUrl');

        // 更新UI - 第三方 API
        $('.bg-image-card[data-api-id]').removeClass('border-primary');
        $(`.bg-image-card[data-api-id="${apiId}"]`).addClass('border-primary');

        // 更新UI - 本地背景图片
        $('.bg-image-card[data-filename]').removeClass('border-primary');
        $('.select-bg-btn').removeClass('btn-primary').addClass('btn-outline-primary').text('选择');

        $('.select-api-btn').removeClass('btn-primary').addClass('btn-outline-primary').text('选择');
        $(`.select-api-btn[data-api-id="${apiId}"]`).removeClass('btn-outline-primary').addClass('btn-primary').text('已选择');

        // 应用第三方 API 到页面（使用 API URL 作为背景）
        applyThirdPartyApiToPage(apiUrl);

        showToast(`已选择 API: ${apiName}`, 'success');
    }

    // 应用第三方 API 到页面
    function applyThirdPartyApiToPage(apiUrl) {
        if (!apiUrl) return;
        
        const isEnabled = localStorage.getItem('enableBackgroundImage') !== 'false';
        const maskOpacity = localStorage.getItem('backgroundMaskOpacity') || '70';
        
        // 获取或创建背景样式元素
        let bgStyleElement = document.getElementById('background-styles');
        
        if (!isEnabled) {
            // 未启用：移除背景图片
            if (bgStyleElement) {
                bgStyleElement.remove();
            }
        } else {
            // 已启用：应用第三方 API 作为背景
            if (!bgStyleElement) {
                bgStyleElement = document.createElement('style');
                bgStyleElement.id = 'background-styles';
                document.head.appendChild(bgStyleElement);
            }
            
            // 直接使用 API URL 作为背景（浏览器会自动请求）
            bgStyleElement.textContent = `
                body {
                    background-image: url('${apiUrl}') !important;
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
            
            // 更新当前背景预览
            updateCurrentBackgroundPreview(apiUrl);
        }
    }

    // 添加第三方 API
    $('#addThirdPartyApiBtn').click(function() {
        const apiName = $('#thirdPartyApiName').val().trim();
        const apiUrl = $('#thirdPartyApiUrl').val().trim();

        if (!apiName || !apiUrl) {
            showToast('请填写 API 名称和 URL', 'warning');
            return;
        }

        // 验证 URL 格式
        if (!isValidUrl(apiUrl)) {
            showToast('请输入有效的 URL 地址', 'error');
            return;
        }

        const $btn = $(this);
        const originalText = $btn.html();

        // 显示加载状态
        $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 添加中...');

        $.ajax({
            url: '../api/third_party_api.php',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                api_name: apiName,
                api_url: apiUrl
            }),
            dataType: 'json',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            },
            success: function(response) {
                if (response.success) {
                    showToast(response.message, 'success');
                    // 清空输入框
                    $('#thirdPartyApiName').val('');
                    $('#thirdPartyApiUrl').val('');
                    // 重新加载第三方 API 列表
                    loadThirdPartyApis();
                } else {
                    showToast(response.message, 'error');
                }
            },
            error: function(xhr, status, error) {
                console.error('添加第三方API失败:', error);
                console.error('响应状态:', xhr.status);
                console.error('响应文本:', xhr.responseText);
                showToast('添加失败，请重试', 'error');
            },
            complete: function() {
                $btn.prop('disabled', false).html(originalText);
            }
        });
    });

    // 删除第三方 API
    function deleteThirdPartyApi(apiId) {
        $.ajax({
            url: '../api/third_party_api.php?id=' + apiId,
            type: 'DELETE',
            dataType: 'json',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            },
            success: function(response) {
                if (response.success) {
                    showToast(response.message, 'success');
                    // 如果删除的是当前选择的 API，清除选择
                    if (localStorage.getItem('selectedThirdPartyApi') === apiId.toString()) {
                        localStorage.removeItem('selectedThirdPartyApi');
                        localStorage.removeItem('selectedThirdPartyApiUrl');
                        localStorage.removeItem('selectedThirdPartyApiName');
                        // 移除背景样式
                        const bgStyleElement = document.getElementById('background-styles');
                        if (bgStyleElement) {
                            bgStyleElement.remove();
                        }
                        updateCurrentBackgroundPreview(null);
                    }
                    // 重新加载第三方 API 列表
                    loadThirdPartyApis();
                } else {
                    showToast(response.message, 'error');
                }
            },
            error: function(xhr, status, error) {
                console.error('删除第三方API失败:', error);
                console.error('响应状态:', xhr.status);
                console.error('响应文本:', xhr.responseText);
                showToast('删除失败，请重试', 'error');
            }
        });
    }

    // 显示删除API确认模态框
    function showDeleteApiModal(apiId, apiName) {
        // 设置要删除的API名称
        document.getElementById('deleteApiName').textContent = apiName;

        // 设置确认删除按钮的点击事件
        document.getElementById('confirmDeleteApiBtn').onclick = function() {
            const $btn = $(this);
            const originalText = $btn.text();

            // 显示加载状态
            $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 删除中...');

            // 删除API
            deleteThirdPartyApi(apiId);

            // 关闭模态框
            const modal = bootstrap.Modal.getInstance(document.getElementById('deleteApiModal'));
            modal.hide();

            // 恢复按钮状态
            $btn.prop('disabled', false).text(originalText);
        };

        // 显示模态框
        const modal = new bootstrap.Modal(document.getElementById('deleteApiModal'));
        modal.show();
    }

    // URL 验证函数
    function isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }
    
    // 初始化时加载第三方 API 列表
    // 移除初始化加载，改为在切换标签时加载
    // loadThirdPartyApis();
});