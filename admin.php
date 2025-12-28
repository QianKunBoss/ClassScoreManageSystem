<?php
require_once 'includes/config.php';
require_once 'includes/functions.php';

if (!isLoggedIn()) {
    header('Location: dengluye.php');
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
    header('Location: index.php');
    exit;
}
?>

<!DOCTYPE html>
<html>
<head>
    <title><?= htmlspecialchars($pdo->query("SELECT setting_value FROM system_settings WHERE setting_key = 'system_title'")->fetchColumn() ?: '班级操行分管理系统') ?></title>
    <link href="https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.2.3/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link href="assets/css/main.css" rel="stylesheet">
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
        
        <table class="table table-striped">
            <thead>
                <tr>
                    <th>排名</th>
                    <th>用户名</th>
                    <th>总积分</th>
                    
                </tr>
            </thead>
            <tbody>
                <?php foreach ($ranking as $index => $user): ?>
                <tr>
                    <td><?= $index+1 ?></td>
                    <td>
                        <a href="pages/user_detail.php?id=<?= $user['id'] ?>">
                            <?= htmlspecialchars($user['username']) ?>
                        </a>
                    </td>
                    <td><?= $user['total_score'] ?? 0 ?></td>

                        
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>

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
    <div class="position-fixed end-0 top-50 bg-light rounded-start shadow-sm" style="transform: translateY(-50%); z-index: 1000; width: 250px; right: 0;" id="sidePanel">
        <!-- 收起状态显示的突起 -->
        <div id="sidePanelTab" class="position-absolute start-0 top-50 translate-middle-x" 
             style="width: 30px; height: 80px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px 0 0 8px; cursor: pointer; display: none; align-items: center; justify-content: center; box-shadow: -2px 0 5px rgba(0,0,0,0.1); right: -15px;"
             onclick="toggleSidePanel()">
            <i class="fas fa-chevron-left" style="font-size: 25px;"></i>
        </div>
        
        <div class="p-3" id="sidePanelContent" style="display: block;">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h5 class="mb-0" style="font-size: 16px;">日志查询</h5>
                <button type="button" class="btn btn-outline-secondary btn-sm" onclick="toggleSidePanel()">
                    <i class="fas fa-chevron-right"></i>
                </button>
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
                form.action = 'pages/delete_user.php';
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
                content.style.display = 'block';
                panel.style.width = '250px';
                panel.style.right = '0';
                tab.style.display = 'none';
            } else {
                content.style.display = 'none';
                panel.style.width = 'auto';
                panel.style.right = '0';
                tab.style.display = 'flex';
            }
        }
    </script>
</body>
</html>