<?php
require_once '../includes/config.php';
require_once '../includes/functions.php';

if (!isLoggedIn()) {
    header('Location: ../dengluye.php');
    exit;
}
/*
SQL 命令参考:
1. 添加模板:
INSERT INTO score_templates (name, score_change, description) 
VALUES ('模板名称', 分数变化, '描述内容');

2. 更新模板:
UPDATE score_templates 
SET name = '新名称', score_change = 新分数, description = '新描述'
WHERE id = 模板ID;

3. 删除模板:
DELETE FROM score_templates WHERE id = 模板ID;

4. 查询所有模板:
SELECT * FROM score_templates ORDER BY id DESC;
*/

// 添加新模板
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['add_template'])) {
    $stmt = $pdo->prepare("INSERT INTO score_templates (name, score_change, description) VALUES (?, ?, ?)");
    $stmt->execute([
        htmlspecialchars($_POST['name']),
        (int)$_POST['score'],
        htmlspecialchars($_POST['description'])
    ]);
    header("Location: template_management.php");
    exit;
}

// 更新模板
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['update_template'])) {
    $stmt = $pdo->prepare("UPDATE score_templates SET name = ?, score_change = ?, description = ? WHERE id = ?");
    $stmt->execute([
        htmlspecialchars($_POST['name']),
        (int)$_POST['score'],
        htmlspecialchars($_POST['description']),
        (int)$_POST['id']
    ]);
    header("Location: template_management.php");
    exit;
}

// 删除模板
if (isset($_GET['delete'])) {
    $pdo->prepare("DELETE FROM score_templates WHERE id = ?")->execute([(int)$_GET['delete']]);
    header("Location: template_management.php");
    exit;
}

// 获取所有模板
$templates = $pdo->query("SELECT * FROM score_templates ORDER BY id DESC")->fetchAll();
?>

<!DOCTYPE html>
<html>
<head>
    <title>积分预设管理</title>
    <link href="https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.2.3/css/bootstrap.min.css" rel="stylesheet">
    <link href="../assets/css/main.css" rel="stylesheet">
</head>
<body>
    <?php showNav(); ?>
    
    <div class="container mt-4">
        <a href="../admin.php" class="btn btn-secondary mb-3">← 返回排名</a>
     
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <span>积分模板管理</span>
                <button class="btn btn-sm btn-primary" data-bs-toggle="modal" data-bs-target="#addTemplateModal">
                    添加新预设
                </button>
            </div>
            <div class="card-body">
                <table class="table">
                    <thead>
                        <tr>
                            <th>预设名称</th>
                            <th>分数变化</th>
                            <th>描述</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($templates as $template): ?>
                        <tr>
                            <td><?= htmlspecialchars($template['name']) ?></td>
                            <td><?= $template['score_change'] > 0 ? '+' : '' ?><?= $template['score_change'] ?></td>
                            <td><?= htmlspecialchars($template['description']) ?></td>
                            <td>
                                <button class="btn btn-sm btn-warning" 
                                        data-bs-toggle="modal" 
                                        data-bs-target="#editTemplateModal"
                                        data-id="<?= $template['id'] ?>"
                                        data-name="<?= htmlspecialchars($template['name']) ?>"
                                        data-score="<?= $template['score_change'] ?>"
                                        data-desc="<?= htmlspecialchars($template['description']) ?>">
                                    编辑
                                </button>
                                <a href="template_management.php?delete=<?= $template['id'] ?>" 
                                   class="btn btn-sm btn-danger"
                                   onclick="return confirm('确定要删除这个模板吗？')">
                                    删除
                                </a>
                            </td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- 添加模板模态框 -->
    <div class="modal fade" id="addTemplateModal" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <form method="post">
                    <div class="modal-header">
                        <h5 class="modal-title">添加新预设</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label">预设名称</label>
                            <input type="text" name="name" class="form-control" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">分数变化</label>
                            <input type="number" name="score" class="form-control" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">描述</label>
                            <textarea name="description" class="form-control"></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                        <button type="submit" name="add_template" class="btn btn-primary">保存</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <!-- 编辑模板模态框 -->
    <div class="modal fade" id="editTemplateModal" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <form method="post">
                    <input type="hidden" name="id" id="editTemplateId">
                    <div class="modal-header">
                        <h5 class="modal-title">编辑预设</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label">预设名称</label>
                            <input type="text" name="name" id="editTemplateName" class="form-control" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">分数变化</label>
                            <input type="number" name="score" id="editTemplateScore" class="form-control" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">描述</label>
                            <textarea name="description" id="editTemplateDesc" class="form-control"></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                        <button type="submit" name="update_template" class="btn btn-primary">更新</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <script>
        // 编辑模态框数据填充
        const editModal = document.getElementById('editTemplateModal');
        editModal.addEventListener('show.bs.modal', function(event) {
            const button = event.relatedTarget;
            document.getElementById('editTemplateId').value = button.dataset.id;
            document.getElementById('editTemplateName').value = button.dataset.name;
            document.getElementById('editTemplateScore').value = button.dataset.score;
            document.getElementById('editTemplateDesc').value = button.dataset.desc;
        });
    </script>
    
    <?php showFooter(); ?>
</body>
</html>
