<?php
require_once '../includes/config.php';
require_once '../includes/functions.php';

// 获取所有用户
$users = $pdo->query("SELECT * FROM users")->fetchAll();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $userIds = $_POST['user_ids'];
    $score = (int)$_POST['score'];
    $desc = htmlspecialchars($_POST['description']);

    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare("INSERT INTO score_logs (user_id, score_change, description) VALUES (?, ?, ?)");
        
        foreach ($userIds as $userId) {
            $stmt->execute([$userId, $score, $desc]);
        }
        
        $pdo->commit();
        header("Location: ../admin.php");
    } catch(PDOException $e) {
        $pdo->rollBack();
        $error = "操作失败: " . $e->getMessage();
    }
}
?>

<!DOCTYPE html>
<html>
<head>
    <title>调整积分</title>
    <link href="../css/bootstrap.min.css" rel="stylesheet">
</head>
<body>
    <?php showNav(); ?>
    
    <div class="container mt-4">
        <div class="card">
            <div class="card-header">积分调整</div>
            <div class="card-body">
                <?php if(isset($error)): ?>
                    <div class="alert alert-danger"><?= $error ?></div>
                <?php endif; ?>

                <form method="post" class="need-password">
                    <div class="mb-3">
                        <label>选择学生</label>
                        <div class="user-list">
                            <?php foreach ($users as $user): ?>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" name="user_ids[]" value="<?= $user['id'] ?>" id="user_<?= $user['id'] ?>">
                                    <label class="form-check-label" for="user_<?= $user['id'] ?>">
                                        <?= $user['username'] ?>
                                    </label>
                                </div>
                            <?php endforeach; ?>
                        </div>
                        <button type="button" class="btn btn-link btn-sm mt-2" onclick="toggleAllUsers(this)">
                            全选/反选
                        </button>
                        <script>
                            function toggleAllUsers(btn) {
                                const checkboxes = document.querySelectorAll('.user-list input[type="checkbox"]');
                                const allChecked = Array.from(checkboxes).every(checkbox => checkbox.checked);
                                checkboxes.forEach(checkbox => checkbox.checked = !allChecked);
                                btn.textContent = allChecked ? '全选' : '反选';
                            }
                        </script>
                    </div>
                    
                    <div class="mb-3">
                        <label>分数变化</label>
                        <input type="number" name="score" class="form-control" required>
                    </div>
                    
                    <div class="mb-3">
                        <label>原因说明</label>
                        <textarea name="description" class="form-control"></textarea>
                    </div>
                    
                    <button type="submit" class="btn btn-primary">提交</button>
                </form>
            </div>
        </div>
    </div>

    <?php showFooter(); ?>
</body>
</html>