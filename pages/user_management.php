<?php
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/functions.php';

if (!isLoggedIn()) {
    header('Location: ../dengluye.php');
    exit;
}

// 处理单个添加学生
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['add_single'])) {
    $username = htmlspecialchars($_POST['username']);
    
    try {
        $stmt = $pdo->prepare("INSERT INTO users (username) VALUES (?)");
        $stmt->execute([$username]);
        $_SESSION['success'] = "学生添加成功！";
        header("Location: user_management.php");
        exit;
    } catch(PDOException $e) {
        $_SESSION['error'] = "添加失败: " . $e->getMessage();
    }
}

// 处理批量导入
$successCount = 0;
$errorMessages = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['batch_import'])) {
    $usernames = trim($_POST['usernames'] ?? '');
    
    if (!empty($usernames)) {
        // 分割输入内容为数组
        $names = preg_split("/\r\n|\n|\r/", $usernames);
        
        try {
            $pdo->beginTransaction();
            
            foreach ($names as $username) {
                $username = trim($username);
                if (empty($username)) continue;

                // 检查用户名是否存在
                $check = $pdo->prepare("SELECT id FROM users WHERE username = ?");
                $check->execute([$username]);
                
                if (!$check->fetch()) {
                    $stmt = $pdo->prepare("INSERT INTO users (username) VALUES (?)");
                    $stmt->execute([$username]);
                    $successCount++;
                } else {
                    $errorMessages[] = "用户名已存在：{$username}";
                }
            }
            
            $pdo->commit();
            $_SESSION['success'] = "成功导入 {$successCount} 个学生！";
        } catch(PDOException $e) {
            $pdo->rollBack();
            $errorMessages[] = "数据库错误：" . $e->getMessage();
        }
    } else {
        $errorMessages[] = "请输入要导入的用户名";
    }
}

// 获取所有用户列表用于显示
$allUsers = $pdo->query("SELECT * FROM users ORDER BY created_at DESC LIMIT 20")->fetchAll();
?>

<!DOCTYPE html>
<html>
<head>
    <title>用户管理</title>
    <link href="https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.2.3/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link href="../assets/css/main.css" rel="stylesheet">
    <style>
        .nav-tabs .nav-link {
            border-bottom: 2px solid transparent;
            border-radius: 0.375rem 0.375rem 0 0;
            padding: 0.5rem 1rem;
            color: #495057;
            transition: color 0.15s ease-in-out, border-color 0.15s ease-in-out;
        }
        .nav-tabs .nav-link:hover {
            border-color: #e9ecef;
            color: #495057;
        }
        .nav-tabs .nav-link.active {
            color: #0d6efd;
            border-color: #0d6efd;
        }
        .user-list {
            max-height: 300px;
            overflow-y: auto;
        }
        .recent-users {
            max-height: 400px;
            overflow-y: auto;
        }
    </style>
</head>
<body>
    <?php showNav(); ?>
    
    <div class="container mt-4">
        <a href="../admin.php" class="btn btn-secondary mb-3">← 返回排名</a>
        
        <h2 class="mb-4">
            <i class="fas fa-users me-2"></i>用户管理
        </h2>

        <?php if (isset($_SESSION['success'])): ?>
            <div class="alert alert-success">
                <?= $_SESSION['success'] ?>
                <?php unset($_SESSION['success']); ?>
            </div>
        <?php endif; ?>

        <?php if (isset($_SESSION['error'])): ?>
            <div class="alert alert-danger">
                <?php foreach ($_SESSION['error'] as $error): ?>
                    <div><?= htmlspecialchars($error) ?></div>
                <?php endforeach; ?>
                <?php unset($_SESSION['error']); ?>
            </div>
        <?php endif; ?>

        <!-- 功能选项卡 -->
        <ul class="nav nav-tabs mb-4" id="userTabs" role="tablist">
            <li class="nav-item" role="presentation">
                <button class="nav-link active" id="single-tab" data-bs-toggle="tab" data-bs-target="#single" type="button" role="tab">
                    <i class="fas fa-user-plus me-2"></i>单个添加
                </button>
            </li>
            <li class="nav-item" role="presentation">
                <button class="nav-link" id="batch-tab" data-bs-toggle="tab" data-bs-target="#batch" type="button" role="tab">
                    <i class="fas fa-file-import me-2"></i>批量导入
                </button>
            </li>
            <li class="nav-item" role="presentation">
                <button class="nav-link" id="list-tab" data-bs-toggle="tab" data-bs-target="#list" type="button" role="tab">
                    <i class="fas fa-list me-2"></i>用户列表
                </button>
            </li>
        </ul>

        <div class="tab-content" id="userTabsContent">
            <!-- 单个添加 -->
            <div class="tab-pane fade show active" id="single" role="tabpanel">
                <div class="row">
                    <div class="col-md-6">
                        <div class="card">
                            <div class="card-header">
                                <h5 class="mb-0">添加单个学生</h5>
                            </div>
                            <div class="card-body">
                                <form method="post">
                                    <div class="mb-3">
                                        <label for="username" class="form-label">学生姓名</label>
                                        <input type="text" name="username" class="form-control" id="username" required
                                               placeholder="请输入学生姓名">
                                    </div>
                                    <button type="submit" name="add_single" class="btn btn-primary">
                                        <i class="fas fa-plus me-1"></i>添加学生
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-6">
                        <div class="card">
                            <div class="card-header">
                                <h5 class="mb-0">快速提示</h5>
                            </div>
                            <div class="card-body">
                                <ul class="list-unstyled">
                                    <li class="mb-2">
                                        <i class="fas fa-info-circle text-info me-2"></i>
                                        输入学生姓名后点击添加即可
                                    </li>
                                    <li class="mb-2">
                                        <i class="fas fa-check-circle text-success me-2"></i>
                                        适合少量添加单个学生
                                    </li>
                                    <li class="mb-2">
                                        <i class="fas fa-arrow-right text-warning me-2"></i>
                                        批量添加请使用"批量导入"选项卡
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 批量导入 -->
            <div class="tab-pane fade" id="batch" role="tabpanel">
                <div class="row">
                    <div class="col-md-12">
                        <div class="card">
                            <div class="card-header">
                                <h5 class="mb-0">批量导入学生</h5>
                            </div>
                            <div class="card-body">
                                <form method="post">
                                    <div class="mb-3">
                                        <label for="usernames" class="form-label">学生姓名列表</label>
                                        <textarea 
                                            name="usernames" 
                                            class="form-control" 
                                            rows="10"
                                            placeholder="请输入学生姓名，每行一个姓名：&#10;张三&#10;李四&#10;王五&#10;赵六&#10;钱七&#10;孙八&#10;周九&#10;吴十"
                                        ></textarea>
                                        <div class="form-text">每行输入一个学生姓名，支持中英文</div>
                                    </div>
                                    <button type="submit" name="batch_import" class="btn btn-success">
                                        <i class="fas fa-upload me-1"></i>批量导入
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 用户列表 -->
            <div class="tab-pane fade" id="list" role="tabpanel">
                <div class="card">
                    <div class="card-header">
                        <h5 class="mb-0">用户列表</h5>
                    </div>
                    <div class="card-body">
                        <div class="recent-users">
                            <table class="table table-hover">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>姓名</th>
                                        <th>创建时间</th>
                                        <th>操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <?php foreach ($allUsers as $user): ?>
                                    <tr>
                                        <td><?= $user['id'] ?></td>
                                        <td><?= htmlspecialchars($user['username']) ?></td>
                                        <td><?= date('Y-m-d H:i', strtotime($user['created_at'])) ?></td>
                                        <td>
                                            <button type="button" class="btn btn-sm btn-outline-danger" 
                                                    onclick="showDeleteUserModal(<?= $user['id'] ?>, '<?= htmlspecialchars($user['username']) ?>')">
                                                <i class="fas fa-trash"></i> 删除
                                            </button>
                                        </td>
                                    </tr>
                                    <?php endforeach; ?>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

        <!-- 删除确认模态框 -->
        <div class="modal fade" id="deleteUserModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">确认删除学生</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p>确定要删除学生 <strong id="deleteUserName"></strong> 吗？</p>
                        <div class="alert alert-danger">
                            <i class="fas fa-exclamation-triangle"></i>
                            <strong>此操作将同时删除该用户的所有积分记录，且不可撤销，请谨慎操作！</strong>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                        <button type="button" class="btn btn-danger" id="confirmDeleteBtn">确认删除</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <?php showFooter(); ?>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
    
    <script>
        // 显示删除确认模态框
        function showDeleteUserModal(userId, userName) {
            // 设置要删除的学生名称
            document.getElementById('deleteUserName').textContent = userName;
            
            // 设置确认删除按钮的点击事件
            document.getElementById('confirmDeleteBtn').onclick = function() {
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
    </script>
</body>
</html>