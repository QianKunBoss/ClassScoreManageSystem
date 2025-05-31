<?php
require_once '../includes/config.php';
require_once '../includes/functions.php';

if (!isLoggedIn()) {
    header('Location: ../dengluye.php');
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = htmlspecialchars($_POST['username']);
    
        try {
            $stmt = $pdo->prepare("INSERT INTO users (username) VALUES (?)");
            $stmt->execute([$username]);
            header("Location: ../admin.php");
    } catch(PDOException $e) {
        $error = "添加失败: " . $e->getMessage();
    }
}
?>

<!DOCTYPE html>
<html>
<head>
    <title>添加学生</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="../assets/css/main.css" rel="stylesheet">
</head>
<body>
    <?php showNav(); ?>
    
    <div class="container mt-4">
        <a href="../admin.php" class="btn btn-secondary mb-3">← 返回排名</a>
        <div class="card">
            <div class="card-header">添加新学生</div>
            <div class="card-body">
                <?php if(isset($error)): ?>
                    <div class="alert alert-danger"><?= $error ?></div>
                <?php endif; ?>
                
                <form method="post">
                    <div class="mb-3">
                        <label>用户名</label>
                        <input type="text" name="username" class="form-control" required>
                    </div>
                    <button type="submit" class="btn btn-primary" class="need-password">添加</button>
                </form>
            </div>
        </div>
    </div>

    <?php showFooter(); ?>
</body>
</html>