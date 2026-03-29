<?php
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/functions.php';

if (!isLoggedIn()) {
    header('Location: login.php');
    exit;
}

// 获取用户排名
$ranking = $pdo->query("
    SELECT u.id, u.username, 
           SUM(sl.score_change) AS total_score,
           MAX(sl.created_at) AS last_updated
    FROM users u
    LEFT JOIN score_logs sl ON u.id = sl.user_id
    GROUP BY u.id
    ORDER BY total_score DESC
")->fetchAll();

// 处理登出逻辑
if (isset($_GET['logout'])) {
    session_destroy();
    header('Location: home.php');
    exit;
}
?>

<!DOCTYPE html>
<html>
<head>
    <title><?= htmlspecialchars($pdo->query("SELECT setting_value FROM system_settings WHERE setting_key = 'system_title'")->fetchColumn() ?: '班级操行分管理系统') ?></title>
    <script>
    // 在CSS加载前立即应用保存的主题，防止闪烁
    (function() {
        var savedTheme = localStorage.getItem('theme') || 'light';
        if (savedTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    })();
    </script>
    <!-- 预加载关键CSS -->
    <link rel="preload" href="https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.2.3/css/bootstrap.min.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
    <link rel="preload" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
    <link rel="preload" href="../assets/css/int_main.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
    <!-- CSS回退 -->
    <noscript>
        <link href="https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.2.3/css/bootstrap.min.css" rel="stylesheet">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
        <link href="../assets/css/int_main.css" rel="stylesheet">
    </noscript>
</head>
<body>
    <?php showNav(); ?>
    
    <div class="container">
        <?php if (isLoggedIn()): ?>
            <div class="alert alert-success">
                欢迎回来，管理员（<?= htmlspecialchars($_SESSION['username']) ?>）！
                <a href="?logout" class="float-end">登出</a>
            </div>
        <?php endif; ?>
     
        <h3 class="my-4">学生操行分排名</h3>

        <div class="card mt-4">
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th class="text-center">排名</th>
                        <th>用户名</th>
                        <th class="text-center">总积分</th>
                        
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($ranking as $index => $user): ?>
                    <tr>
                        <td class="text-center"><?= $index+1 ?></td>
                        <td>
                            <a href="user_detail.php?id=<?= $user['id'] ?>">
                                <?= htmlspecialchars($user['username']) ?>
                            </a>
                        </td>
                        <td class="text-center"><?= $user['total_score'] ?? 0 ?></td>

                            
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>

        <!-- 添加日志显示区域 -->
        <div class="card mt-4" id="logSection">
            <div class="card-header d-flex justify-content-between align-items-center">
                <form method="get" class="row g-3 flex-grow-1" onsubmit="location.hash='logSection'; return true;">
                    <div class="col-md-4">
                        <label for="logDate" class="form-label">选择日期查看日志</label>
                        <input type="date" id="logDate" name="logDate" class="form-control" 
                               value="<?= $_GET['logDate'] ?? date('Y-m-d') ?>">
                    </div>
                    <div class="col-md-2">
                        <button type="submit" class="btn btn-primary mt-4">查询</button>
                    </div>
                </form>
                <button type="button" class="btn btn-outline-secondary btn-sm ms-3" id="toggleLogBtn" onclick="toggleLogSection()">
                    <i class="fas fa-chevron-up" id="toggleIcon"></i>
                </button>
            </div>
            <div class="card-body" id="logCardBody">
                <?php
                $selectedDate = $_GET['logDate'] ?? date('Y-m-d');
                $logs = $pdo->prepare("
                    SELECT u.username, sl.score_change, sl.description, sl.created_at
                    FROM score_logs sl
                    JOIN users u ON sl.user_id = u.id
                    WHERE DATE(sl.created_at) = ?
                    ORDER BY sl.created_at DESC
                ");
                $logs->execute([$selectedDate]);
                ?>
                
                <table class="table">
                    <thead>
                        <tr>
                            <th>用户名</th>
                            <th>分数变化</th>
                            <th>原因</th>
                            <th>时间</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($logs as $log): ?>
                        <tr>
                            <td><?= htmlspecialchars($log['username']) ?></td>
                            <td class="<?= $log['score_change'] > 0 ? 'text-success' : 'text-danger' ?>">
                                <?= $log['score_change'] > 0 ? '+' : '' ?><?= $log['score_change'] ?>
                            </td>
                            <td><?= htmlspecialchars($log['description']) ?></td>
                            <td><?= date('H:i', strtotime($log['created_at'])) ?></td>
                        </tr>
                        <?php endforeach; ?>
                        <?php if ($logs->rowCount() === 0): ?>
                        <tr>
                            <td colspan="4" class="text-center">当日无日志记录</td>
                        </tr>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <?php showFooter(); ?>

    <!-- 右侧固定查询面板 -->
    <div class="position-fixed end-0 top-50 bg-light rounded-start shadow-sm" style="transform: translateY(-50%); z-index: 1000; width: auto; right: 0;" id="sidePanel">
        <!-- 收起状态显示的突起 -->
        <div id="sidePanelTab" class="position-absolute start-0 top-50 translate-middle-x"
             style="width: 30px; height: 80px; background: #f8f9fa; border-radius: 8px 0 0 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: -2px 0 5px rgba(0,0,0,0.1); right: -15px;"
             onclick="toggleSidePanel()">
            <i class="fas fa-chevron-left" style="font-size: 25px;"></i>
        </div>

        <div class="p-3" id="sidePanelContent" style="display: none; width: 250px;">
            <!-- 收起按钮放在内容左侧 -->
            <div id="closePanelBtn" class="position-absolute start-0 top-50 translate-middle-x"
                 style="width: 30px; height: 80px; background: #f8f9fa; border-radius: 8px 0 0 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: -2px 0 5px rgba(0,0,0,0.1); right: -15px; z-index: 1;"
                 onclick="toggleSidePanel()">
                <i class="fas fa-chevron-right" style="font-size: 25px;"></i>
            </div>
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h5 class="mb-0" style="font-size: 16px;">日志查询</h5>
            </div>
            <form method="get" onsubmit="location.hash='logSection'; return true;">
                <div class="mb-3">
                    <label for="sideLogDate" class="form-label" style="font-size: 14px;">选择日期</label>
                    <input type="date" id="sideLogDate" name="logDate" class="form-control form-control-sm" 
                           value="<?= $_GET['logDate'] ?? date('Y-m-d') ?>">
                </div>
                <button type="submit" class="btn btn-primary btn-sm w-100">查询</button>
            </form>
        </div>
    </div>

    <!-- 删除用户确认模态框 -->
    <div class="modal fade" id="deleteUserModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">确认删除用户</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <p>确定要删除用户 <strong id="deleteUserName"></strong> 吗？</p>
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle"></i>
                        此操作将同时删除该用户的所有积分记录，且不可撤销，请谨慎操作！
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                    <button type="button" class="btn btn-danger" id="confirmDeleteUserBtn">确认删除</button>
                </div>
            </div>
        </div>
    </div>

    <script>
        // 显示删除用户确认模态框
        function showDeleteUserModal(userId, userName) {
            // 设置要删除的用户名称
            document.getElementById('deleteUserName').textContent = userName;
            
            // 设置确认删除按钮的点击事件
            document.getElementById('confirmDeleteUserBtn').onclick = function() {
                // 创建表单并提交
                const form = document.createElement('form');
                form.method = 'post';
                form.action = '../api/delete_user.php';
                form.style.display = 'none';
                
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = 'user_id';
                input.value = userId;
                
                form.appendChild(input);
                document.body.appendChild(form);
                form.submit();
            };
            
            // 显示模态框
            const modal = new bootstrap.Modal(document.getElementById('deleteUserModal'));
            modal.show();
        }

        function toggleLogSection() {
            const cardBody = document.getElementById('logCardBody');
            const icon = document.getElementById('toggleIcon');
            
            if (cardBody.style.display === 'none') {
                cardBody.style.display = 'block';
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-up');
            } else {
                cardBody.style.display = 'none';
                icon.classList.remove('fa-chevron-up');
                icon.classList.add('fa-chevron-down');
            }
        }

        function toggleSidePanel() {
            const panel = document.getElementById('sidePanel');
            const content = document.getElementById('sidePanelContent');
            const tab = document.getElementById('sidePanelTab');
            
            if (content.style.display === 'none') {
                // 展开：先显示内容，然后添加动画类
                content.style.display = 'block';
                panel.style.width = '250px';
                tab.style.display = 'none';
                
                // 添加动画类
                setTimeout(() => {
                    content.classList.add('show');
                }, 10);
            } else {
                // 收起：先移除动画类，然后隐藏内容
                content.classList.remove('show');
                
                // 等待动画完成后隐藏
                setTimeout(() => {
                    content.style.display = 'none';
                    panel.style.width = 'auto';
                    tab.style.display = 'flex';
                }, 300);
            }
        }
    </script>

    <!-- jQuery (备用CDN) -->
    <script src="https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js" crossorigin="anonymous"></script>
    <script>
        // 如果CDN加载失败，使用备用CDN
        if (typeof jQuery === 'undefined') {
            document.write('<script src="https://cdn.bootcdn.net/ajax/libs/jquery/3.6.0/jquery.min.js"><\/script>');
        }
    </script>

    <!-- Bootstrap Bundle (备用CDN) -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/js/bootstrap.bundle.min.js" crossorigin="anonymous"></script>
    <script>
        // 如果CDN加载失败，使用备用CDN
        if (typeof bootstrap === 'undefined') {
            document.write('<script src="https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.2.3/js/bootstrap.bundle.min.js"><\/script>');
        }
    </script>

    <!-- 背景图片脚本 -->
    <script src="../assets/js/background_image.js"></script>

</body>
</html>