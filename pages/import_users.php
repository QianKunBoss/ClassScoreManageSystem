<?php
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/functions.php';

if (!isLoggedIn()) {
    header('Location: ../dengluye.php');
    exit;
}

// 处理表单提交
$successCount = 0;
$errorMessages = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
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
        } catch(PDOException $e) {
            $pdo->rollBack();
            $errorMessages[] = "数据库错误：" . $e->getMessage();
        }
    } else {
        $errorMessages[] = "请输入要导入的用户名";
    }
}
?>

<!DOCTYPE html>
<html>
<head>
    <title>批量导入用户</title>
    <link href="https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.2.3/css/bootstrap.min.css" rel="stylesheet">
    <link href="../assets/css/main.css" rel="stylesheet">
</head>
<body>
    <?php showNav(); ?>
    
    <div class="container mt-4">
     <a href="../admin.php" class="btn btn-secondary mb-3">← 返回排名</a>
        <div class="card">
            <div class="card-header">批量导入用户</div>
            <div class="card-body">
                <?php if (!empty($errorMessages)): ?>
                    <div class="alert alert-danger">
                        <?php foreach ($errorMessages as $msg): ?>
                            <div><?= htmlspecialchars($msg) ?></div>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>

                <?php if ($successCount > 0): ?>
                    <div class="alert alert-success">
                        成功导入 <?= $successCount ?> 个用户！
                    </div>
                <?php endif; ?>

                <form method="post">
                    <div class="mb-3">
                        <label class="form-label">用户名列表（每行一个）</label>
                        <textarea 
                            name="usernames" 
                            class="form-control" 
                            rows="10"
                            placeholder="示例：
张三
李四
王五"
                        ><?= isset($_POST['usernames']) ? htmlspecialchars($_POST['usernames']) : '' ?></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary">开始导入</button>
                </form>
            </div>
        </div>
    </div>

    <?php showFooter(); ?>
</body>
</html>