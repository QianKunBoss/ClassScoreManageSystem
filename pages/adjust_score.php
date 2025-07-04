<?php
require_once '../includes/config.php';
require_once '../includes/functions.php';

if (!isLoggedIn()) {
    header('Location: ../dengluye.php');
    exit;
}

// 获取所有用户
$users = $pdo->query("SELECT * FROM users")->fetchAll();
// 从数据库获取模板数据
$templates = $pdo->query("SELECT * FROM score_templates ORDER BY name")->fetchAll();

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
    <link href="https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.2.3/css/bootstrap.min.css" rel="stylesheet">
    <link href="../assets/css/main.css" rel="stylesheet">
</head>
<body>
    <?php showNav(); ?>
    
    <div class="container mt-4">
        <a href="../admin.php" class="btn btn-secondary mb-3">← 返回排名</a>
     
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
                            全选/取消
                        </button>
                        <script>
                            function toggleAllUsers(btn) {
                                const checkboxes = document.querySelectorAll('.user-list input[type="checkbox"]');
                                const allChecked = Array.from(checkboxes).every(checkbox => checkbox.checked);
                                checkboxes.forEach(checkbox => checkbox.checked = !allChecked);
                                btn.textContent = allChecked ? '全选' : '取消';
                            }
                        </script>
                    </div>
                    
    <div class="mb-3">
        <label>选择预设</label>
        <select class="form-select mb-2" id="templateSelect">
            <option value="">-- 请选择预设 --</option>
            <?php foreach ($templates as $index => $template): ?>
                <option value="<?= $index ?>" 
                        data-score="<?= $template['score_change'] ?>"
                        data-desc="<?= htmlspecialchars($template['description']) ?>">
                    <?= htmlspecialchars($template['name']) ?> (<?= $template['score_change'] > 0 ? '+' : '' ?><?= $template['score_change'] ?>分)
                </option>
            <?php endforeach; ?>
        </select>
    </div>
    
    <div class="mb-3">
        <label>分数变化</label>
        <input type="number" name="score" class="form-control" id="scoreInput" required>
    </div>
    
    <div class="mb-3">
        <label>原因说明</label>
        <textarea name="description" class="form-control" id="descInput"></textarea>
    </div>
    
    <script>
        document.getElementById('templateSelect').addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            if (selectedOption.value) {
                document.getElementById('scoreInput').value = selectedOption.dataset.score;
                document.getElementById('descInput').value = selectedOption.dataset.desc;
            }
        });
    </script>
                    
                    <button type="submit" class="btn btn-primary">提交</button>
                </form>
            </div>
        </div>
    </div>

    <?php showFooter(); ?>
</body>
</html>