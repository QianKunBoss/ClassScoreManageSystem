<?php
// 定义安装访问常量
define('INSTALL_ACCESS', true);

// 引入公共配置文件
require_once 'config.php';

if (file_exists('../includes/config.php')) {
    die(ERROR_MESSAGES['already_installed']);
}
?>
<!DOCTYPE html>
<html>
<head>
    <title>系统安装向导</title>
    <link href="https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.2.3/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.bootcdn.net/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <link href="style.css" rel="stylesheet">
</head>
<body>
    <div class="install-container">
        <div class="card">
            <div class="card-header bg-primary text-white">
                <h4><i class="fas fa-cog"></i> <?php echo SYSTEM_NAME; ?> v<?php echo SYSTEM_VERSION; ?> 安装向导</h4>
            </div>
            <div class="card-body">
                <!-- 步骤指示器 -->
                <div class="step-indicator mb-4">
                    <div class="step-item active" data-step="1">
                        <div class="step-number">1</div>
                        <div class="step-title">系统检查</div>
                    </div>
                    <div class="step-item" data-step="2">
                        <div class="step-number">2</div>
                        <div class="step-title">数据库配置</div>
                    </div>
                    <div class="step-item" data-step="3">
                        <div class="step-number">3</div>
                        <div class="step-title">管理员设置</div>
                    </div>
                    <div class="step-item" data-step="4">
                        <div class="step-number">4</div>
                        <div class="step-title">安全问题</div>
                    </div>
                    <div class="step-item" data-step="5">
                        <div class="step-number">5</div>
                        <div class="step-title">安装中</div>
                    </div>
                </div>

                <!-- 步骤1：系统检查 -->
                <div id="step1" class="step-content active">
                    <h5 class="mb-3"><i class="fas fa-clipboard-check"></i> 系统环境检查</h5>
                    <div id="checkResults">
                        <div class="text-center">
                            <div class="spinner-border text-primary" role="status">
                                <span class="visually-hidden">检查中...</span>
                            </div>
                            <p class="mt-2">正在检查系统环境...</p>
                        </div>
                    </div>
                    <div class="mt-4">
                        <button type="button" class="btn btn-primary" id="checkAgainBtn" style="display: none;">
                            <i class="fas fa-sync-alt"></i> 重新检查
                        </button>
                        <button type="button" class="btn btn-success" id="step1NextBtn" style="display: none;" disabled>
                            <i class="fas fa-arrow-right"></i> 下一步
                        </button>
                    </div>
                </div>

                <!-- 步骤2：数据库配置 -->
                <div id="step2" class="step-content">
                    <h5 class="mb-3"><i class="fas fa-database"></i> 数据库配置</h5>
                    <form id="installForm">
                        <div class="mb-3">
                            <label class="form-label">数据库类型</label>
                            <select name="db_type" class="form-select" id="dbTypeSelect" required>
                                <option value="mysql">MySQL</option>
                                <option value="sqlite">SQLite</option>
                            </select>
                            <div class="form-text">选择您要使用的数据库类型</div>
                        </div>

                        <!-- MySQL 配置 -->
                        <div id="mysqlConfig">
                            <div class="mb-3">
                                <label class="form-label">数据库地址</label>
                                <input type="text" name="db_host" class="form-control" value="localhost">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">数据库用户名</label>
                                <input type="text" name="db_user" class="form-control">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">数据库密码（可选）</label>
                                <input type="password" name="db_pass" class="form-control">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">数据库名称</label>
                                <input type="text" name="db_name" class="form-control">
                            </div>
                        </div>

                        <!-- SQLite 配置 -->
                        <div id="sqliteConfig" style="display: none;">
                            <div class="mb-3">
                                <label class="form-label">数据库文件路径</label>
                                <input type="text" name="db_file" class="form-control" value="../database/class_score.db" disabled>
                                <div class="form-text">SQLite 数据库将自动存储在 database/class_score.db</div>
                            </div>
                        </div>

                        <div class="d-flex justify-content-between mt-4">
                            <button type="button" class="btn btn-secondary" onclick="goToStep(1)">
                                <i class="fas fa-arrow-left"></i> 上一步
                            </button>
                            <button type="button" class="btn btn-primary" onclick="goToStep(3)">
                                <i class="fas fa-arrow-right"></i> 下一步
                            </button>
                        </div>
                    </form>
                </div>

                <!-- 步骤3：管理员设置 -->
                <div id="step3" class="step-content">
                    <h5 class="mb-3"><i class="fas fa-user-shield"></i> 管理员账号设置</h5>
                    <form>
                        <div class="mb-3">
                            <label class="form-label">管理员用户名</label>
                            <input type="text" name="admin_user" class="form-control" value="admin" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">管理员密码</label>
                            <input type="password" name="admin_pass" class="form-control" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">确认密码</label>
                            <input type="password" name="admin_pass_confirm" class="form-control" required>
                        </div>
                        <div class="d-flex justify-content-between mt-4">
                            <button type="button" class="btn btn-secondary" onclick="goToStep(2)">
                                <i class="fas fa-arrow-left"></i> 上一步
                            </button>
                            <button type="button" class="btn btn-primary" onclick="goToStep(4)">
                                <i class="fas fa-arrow-right"></i> 下一步
                            </button>
                        </div>
                    </form>
                </div>

                <!-- 步骤4：安全问题 -->
                <div id="step4" class="step-content">
                    <h5 class="mb-3"><i class="fas fa-question-circle"></i> 安全问题设置</h5>
                    <form id="securityForm">
                        <div class="mb-3">
                            <label class="form-label">安全问题</label>
                            <select name="security_question" class="form-select" id="securityQuestionSelect" required>
                                <option value="您设置的管理员账号是什么?">您设置的管理员账号是什么?</option>
                                <option value="您的出生年份是?">您的出生年份是?</option>
                                <option value="您最喜欢的颜色是?">您最喜欢的颜色是?</option>
                                <option value="您的小学校名是?">您的小学校名是?</option>
                                <option value="custom">自定义问题</option>
                            </select>
                        </div>
                        <div class="mb-3" id="customQuestionDiv" style="display: none;">
                            <label class="form-label">自定义安全问题</label>
                            <input type="text" name="custom_security_question" class="form-control" id="customQuestionInput" placeholder="请输入您的安全问题">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">安全答案</label>
                            <input type="text" name="security_answer" class="form-control" placeholder="请牢记您的安全答案" required>
                            <div class="form-text">安全答案用于重置密码，请务必牢记</div>
                        </div>
                        <div class="d-flex justify-content-between mt-4">
                            <button type="button" class="btn btn-secondary" onclick="goToStep(3)">
                                <i class="fas fa-arrow-left"></i> 上一步
                            </button>
                            <button type="submit" class="btn btn-success">
                                <i class="fas fa-check"></i> 开始安装
                            </button>
                        </div>
                        <div class="alert alert-info mt-3">
                            <i class="fas fa-info-circle"></i> <strong>提示：</strong>如果数据库不为空（已存在数据），系统会显示警告但不会中断安装。请确认您选择的数据库是正确的。
                        </div>
                    </form>
                </div>
            </div>
            
                            <!-- 安装中 -->
                            <div id="step5" class="step-content">
                                <h5 class="mb-3"><i class="fas fa-cogs fa-spin"></i> 正在安装系统...</h5>
                                <div id="installProgress" class="mb-3">
                                    <div class="progress">
                                        <div id="installProgressBar" class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style="width: 0%"></div>
                                    </div>
                                    <div class="text-center mt-2">
                                        <span id="installProgressText">0%</span>
                                    </div>
                                </div>
                                <div id="installLogs" class="border rounded p-3" style="height: 300px; overflow-y: auto; background: #f8f9fa;">
                                    <div class="text-muted">等待开始安装...</div>
                                </div>
                            </div>
            
                        </div>
                    </div>
                </div>
            
                <script>
        let systemChecksPassed = false;

        // 步骤切换
        function goToStep(step) {
            // 隐藏所有步骤
            document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
            // 显示目标步骤
            document.getElementById('step' + step).classList.add('active');
            // 更新步骤指示器
            document.querySelectorAll('.step-item').forEach(el => el.classList.remove('active'));
            document.querySelector('.step-item[data-step="' + step + '"]').classList.add('active');
        }

        // 系统检查
        async function performSystemChecks() {
            try {
                // 隐藏所有按钮
                document.getElementById('checkAgainBtn').style.display = 'none';
                document.getElementById('step1NextBtn').style.display = 'none';

                const response = await fetch('check_system.php');
                const data = await response.json();

                if (data.success) {
                    // 渲染检查结果（会自动处理按钮显示）
                    renderCheckResults(data.results);
                } else {
                    throw new Error('系统检查失败');
                }
            } catch (error) {
                document.getElementById('checkResults').innerHTML = `
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-triangle"></i> 系统检查失败: ${error.message}
                    </div>
                `;
                document.getElementById('checkAgainBtn').style.display = 'inline-block';
            }
        }

        function renderCheckResults(results) {
            const container = document.getElementById('checkResults');
            container.innerHTML = '';

            let displayedCount = 0;
            const totalChecks = results.length;
            const allPassed = results.every(r => r.status === 'success' || r.status === 'warning');

            results.forEach((check, index) => {
                setTimeout(() => {
                    const iconClass = check.status === 'success' ? 'fa-check-circle' :
                                     check.status === 'error' ? 'fa-times-circle' : 'fa-exclamation-triangle';

                    const checkItem = document.createElement('div');
                    checkItem.className = `check-item ${check.status}`;
                    checkItem.style.opacity = '0';
                    checkItem.style.transform = 'translateX(-20px)';

                    // 检查是否需要显示更新按钮
                    let updateButton = '';
                    if (check.has_update && check.release_url) {
                        updateButton = `
                            <a href="${check.release_url}" target="_blank" class="btn btn-sm btn-outline-primary">
                                <i class="fas fa-download"></i> 获取新版本
                            </a>
                        `;
                    }

                    checkItem.innerHTML = `
                        <div class="check-content">
                            <i class="fas ${iconClass} check-icon"></i>
                            <strong>${check.name}</strong>
                            <div class="check-details">${check.message}</div>
                            <div class="check-details">${check.details}</div>
                        </div>
                        ${updateButton}
                    `;

                    container.appendChild(checkItem);

                    // 添加淡入动画
                    setTimeout(() => {
                        checkItem.style.transition = 'all 0.5s ease';
                        checkItem.style.opacity = '1';
                        checkItem.style.transform = 'translateX(0)';
                    }, 50);

                    // 计数已显示的检查项
                    displayedCount++;

                    // 当所有检查项都显示完毕时
                    if (displayedCount === totalChecks) {
                        systemChecksPassed = allPassed;

                        if (allPassed) {
                            // 启用下一步按钮
                            const nextBtn = document.getElementById('step1NextBtn');
                            nextBtn.style.display = 'inline-block';
                            nextBtn.disabled = false;
                            nextBtn.classList.remove('disabled');
                        } else {
                            // 显示重新检查按钮
                            document.getElementById('checkAgainBtn').style.display = 'inline-block';
                        }
                    }
                }, index * 1000); // 每个检查项延迟1秒显示
            });
        }

        // 页面加载时执行系统检查
        document.addEventListener('DOMContentLoaded', function() {
            performSystemChecks();

            // 数据库类型切换
            const dbTypeSelect = document.getElementById('dbTypeSelect');
            const mysqlConfig = document.getElementById('mysqlConfig');
            const sqliteConfig = document.getElementById('sqliteConfig');

            dbTypeSelect.addEventListener('change', function() {
                if (this.value === 'mysql') {
                    mysqlConfig.style.display = 'block';
                    sqliteConfig.style.display = 'none';
                    // 设置MySQL字段为必填
                    document.querySelector('input[name="db_host"]').required = true;
                    document.querySelector('input[name="db_user"]').required = true;
                    document.querySelector('input[name="db_name"]').required = true;
                    document.querySelector('input[name="db_file"]').required = false;
                } else {
                    mysqlConfig.style.display = 'none';
                    sqliteConfig.style.display = 'block';
                    // 设置SQLite字段为必填
                    document.querySelector('input[name="db_host"]').required = false;
                    document.querySelector('input[name="db_user"]').required = false;
                    document.querySelector('input[name="db_name"]').required = false;
                    document.querySelector('input[name="db_file"]').required = true;
                }
            });
        });

        // 重新检查按钮
        document.getElementById('checkAgainBtn').addEventListener('click', function() {
            document.getElementById('checkAgainBtn').style.display = 'none';
            document.getElementById('step1NextBtn').style.display = 'none';
            document.getElementById('checkResults').innerHTML = `
                <div class="text-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">检查中...</span>
                    </div>
                    <p class="mt-2">正在检查系统环境...</p>
                </div>
            `;
            performSystemChecks();
        });

        // 下一步按钮
        document.getElementById('step1NextBtn').addEventListener('click', function() {
            goToStep(2);
        });

        // 自定义安全问题
        document.getElementById('securityQuestionSelect').addEventListener('change', function() {
            const customQuestionDiv = document.getElementById('customQuestionDiv');
            const customQuestionInput = document.getElementById('customQuestionInput');

            if (this.value === 'custom') {
                customQuestionDiv.style.display = 'block';
                customQuestionInput.required = true;
            } else {
                customQuestionDiv.style.display = 'none';
                customQuestionInput.required = false;
                customQuestionInput.value = '';
            }
        });

        // 提交安装
        document.getElementById('securityForm').addEventListener('submit', function(e) {
            e.preventDefault();

            // 验证密码
            const pass = document.querySelector('input[name="admin_pass"]').value;
            const confirmPass = document.querySelector('input[name="admin_pass_confirm"]').value;

            if (pass !== confirmPass) {
                alert('两次输入的密码不一致！');
                return;
            }

            // 切换到安装步骤
            goToStep(5);

            // 清空安装日志
            const logsContainer = document.getElementById('installLogs');
            logsContainer.innerHTML = '';

            // 添加日志函数
            function addLog(message, type = 'info') {
                const logItem = document.createElement('div');
                logItem.className = 'log-item mb-2';

                let iconClass = 'fa-info-circle';
                let textClass = 'text-primary';

                if (type === 'success') {
                    iconClass = 'fa-check-circle';
                    textClass = 'text-success';
                } else if (type === 'error') {
                    iconClass = 'fa-times-circle';
                    textClass = 'text-danger';
                } else if (type === 'warning') {
                    iconClass = 'fa-exclamation-triangle';
                    textClass = 'text-warning';
                }

                const timestamp = new Date().toLocaleTimeString();
                logItem.innerHTML = `
                    <span class="text-muted small">[${timestamp}]</span>
                    <i class="fas ${iconClass} ${textClass}"></i>
                    <span class="${textClass}">${message}</span>
                `;

                logsContainer.appendChild(logItem);
                logsContainer.scrollTop = logsContainer.scrollHeight;
            }

            // 更新进度条
            function updateProgress(percent, text) {
                const progressBar = document.getElementById('installProgressBar');
                const progressText = document.getElementById('installProgressText');

                progressBar.style.width = percent + '%';
                progressText.textContent = text || percent + '%';
            }

            // 收集所有表单数据
            const formData = new FormData();
            formData.append('db_type', document.querySelector('#dbTypeSelect').value);
            formData.append('db_host', document.querySelector('input[name="db_host"]').value);
            formData.append('db_user', document.querySelector('input[name="db_user"]').value);
            formData.append('db_pass', document.querySelector('input[name="db_pass"]').value);
            formData.append('db_name', document.querySelector('input[name="db_name"]').value);
            formData.append('db_file', document.querySelector('input[name="db_file"]').value);
            formData.append('admin_user', document.querySelector('input[name="admin_user"]').value);
            formData.append('admin_pass', pass);
            formData.append('security_question', document.querySelector('#securityQuestionSelect').value);
            formData.append('security_answer', document.querySelector('input[name="security_answer"]').value);

            if (document.querySelector('#securityQuestionSelect').value === 'custom') {
                formData.append('custom_security_question', document.querySelector('#customQuestionInput').value);
            }

            // 开始安装
            addLog('开始安装系统...', 'info');
            updateProgress(0, '准备中...');

            // 提交到process.php
            fetch('process.php', {
                method: 'POST',
                body: formData
            })
            .then(response => {
                // 检查响应是否成功
                if (!response.ok) {
                    throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
                }
                return response.text();
            })
            .then(text => {
                try {
                    const data = JSON.parse(text);
                    
                    if (data.success) {
                                        // 逐步显示每个步骤的日志
                                        const totalSteps = data.steps.length;
                    
                                        data.steps.forEach((step, index) => {
                                            setTimeout(() => {
                                                let logType = 'info';
                                                if (step.status === 'success') {
                                                    logType = 'success';
                                                } else if (step.status === 'error') {
                                                    logType = 'error';
                                                }
                    
                                                let message = step.name;
                                                if (step.status === 'success') {
                                                    message += ' - 完成';
                                                } else if (step.status === 'error') {
                                                    message += ' - 失败';
                                                }
                    
                                                // 如果有警告信息
                                                if (step.warning) {
                                                    message += ` (警告: ${step.warning})`;
                                                    logType = 'warning';
                                                }
                    
                                                addLog(message, logType);
                    
                                                // 更新进度条
                                                const progress = Math.round(((index + 1) / totalSteps) * 100);
                                                updateProgress(progress, `${step.name} - ${step.status === 'success' ? '完成' : '失败'}`);
                    
                                                // 如果是最后一步且成功
                                                if (index === totalSteps - 1 && step.status === 'success') {
                                                    setTimeout(() => {
                                                        let successMessage = '安装成功！即将跳转到完成页面...';
                                                        if (data.warnings && data.warnings.length > 0) {
                                                            successMessage = '安装成功，但有一些警告。即将跳转到完成页面...';
                                                        }
                                                        addLog(successMessage, 'success');
                                                        
                                                        // 显示所有警告
                                                        if (data.warnings && data.warnings.length > 0) {
                                                            data.warnings.forEach((warning, i) => {
                                                                setTimeout(() => {
                                                                    addLog('警告: ' + warning, 'warning');
                                                                }, (i + 1) * 500);
                                                            });
                                                        }
                                                        
                                                        setTimeout(() => {
                                                            window.location.href = 'complete.php';
                                                        }, 2000 + (data.warnings ? data.warnings.length * 500 : 0));
                                                    }, 500);
                                                }
                                            }, index * 800); // 每个步骤间隔800ms
                                        });
                                    } else {                        addLog('安装失败: ' + data.message, 'error');
                        updateProgress(0, '安装失败');

                        // 显示已完成的步骤
                        if (data.steps && data.steps.length > 0) {
                            data.steps.forEach(step => {
                                if (step.status === 'success') {
                                    addLog(`${step.name} - 完成`, 'success');
                                } else if (step.status === 'error') {
                                    addLog(`${step.name} - 失败`, 'error');
                                }
                            });
                        }

                        alert('安装失败: ' + data.message);
                    }
                } catch (parseError) {
                    // JSON解析失败，显示原始响应
                    addLog('服务器响应格式错误: ' + parseError.message, 'error');
                    addLog('原始响应: ' + text.substring(0, 200), 'warning');
                    updateProgress(0, '安装失败');
                    alert('安装失败: 服务器返回了无效的响应\n' + text.substring(0, 500));
                }
            })
            .catch(error => {
                addLog('安装失败: ' + error.message, 'error');
                updateProgress(0, '安装失败');
                alert('安装失败: ' + error.message);
            });
        });
    </script>
</body>
</html>