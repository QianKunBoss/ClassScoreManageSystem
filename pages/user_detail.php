<?php
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../includes/functions.php';

if (!isLoggedIn()) {
    header('Location: login.php');
    exit;
}

// 验证用户ID
if (!isset($_GET['id'])) {
    header("Location: home.php");
    exit;
}

$userId = (int)$_GET['id'];

// 获取用户基本信息
$user = $pdo->prepare("
    SELECT u.*, SUM(sl.score_change) AS total_score
    FROM users u
    LEFT JOIN score_logs sl ON u.id = sl.user_id
    WHERE u.id = ?
");
$user->execute([$userId]);
$user = $user->fetch();

// 获取分类统计
$stats = $pdo->prepare("
    SELECT
        SUM(CASE WHEN score_change > 0 THEN score_change ELSE 0 END) AS total_positive,
        SUM(CASE WHEN score_change < 0 THEN score_change ELSE 0 END) AS total_negative,
        COUNT(*) AS total_records
    FROM score_logs
    WHERE user_id = ?
");
$stats->execute([$userId]);
$stats = $stats->fetch();

// 获取所有积分记录（按日期倒序），带 id 以便编辑/删除
$records = $pdo->prepare("
    SELECT id, score_change, description, created_at
    FROM score_logs
    WHERE user_id = ?
    ORDER BY created_at DESC
");
$records->execute([$userId]);
$recordsData = $records->fetchAll();

// 获取图表数据（最后30天）
$thirtyDaysAgo = date('Y-m-d H:i:s', strtotime('-30 days'));
$chart = $pdo->prepare("
    SELECT
        DATE(created_at) AS date,
        SUM(score_change) AS daily_score
    FROM score_logs
    WHERE user_id = ?
    AND created_at >= ?
    GROUP BY DATE(created_at)
    ORDER BY date ASC
");
$chart->execute([$userId, $thirtyDaysAgo]);
$chartData = $chart->fetchAll();
?>

<!DOCTYPE html>
<html>
<head>
    <title><?= $user['username'] ?> 的详情</title>
    <script>
    (function() {
        var savedTheme = localStorage.getItem('theme') || 'light';
        if (savedTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    })();
    </script>
    <link href="https://cdn.bootcdn.net/ajax/libs/twitter-bootstrap/5.2.3/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link href="../assets/css/int_main.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <?php showNav(); ?>

    <div class="container mt-4">
        <a href="admin.php" class="btn btn-secondary mb-3 return-button">← 返回排名</a>

        <?php
        $ranking = $pdo->query("
            SELECT
                u.id,
                u.username,
                SUM(sl.score_change) AS total_score
            FROM users u
            LEFT JOIN score_logs sl ON u.id = sl.user_id
            GROUP BY u.id
            ORDER BY total_score DESC
        ")->fetchAll();

        $userRank = 0;
        $medal = '';
        foreach ($ranking as $index => $row) {
            if ($row['id'] == $userId) {
                $userRank = $index + 1;
                if ($userRank === 1) $medal = '🥇 ';
                elseif ($userRank === 2) $medal = '🥈 ';
                elseif ($userRank === 3) $medal = '🥉 ';
                break;
            }
        }
        ?>

        <!-- 用户概要 -->
        <div class="card mb-4">
            <div class="card-header">
                <h4><?= $medal . htmlspecialchars($user['username']) ?> 的积分档案</h4>
            </div>
            <div class="card-body">
                <div class="row g-0 text-center">
                    <div class="col-md-3 border-end">
                        <div class="text-muted small">当前总分</div>
                        <div class="h2 <?= $user['total_score'] >= 0 ? 'text-success' : 'text-danger' ?>">
                            <?= $user['total_score'] ?? 0 ?>
                        </div>
                    </div>
                    <div class="col-md-3 border-end">
                        <div class="text-muted small">加分总计</div>
                        <div class="h3 text-success">+<?= $stats['total_positive'] ?? 0 ?></div>
                    </div>
                    <div class="col-md-3 border-end">
                        <div class="text-muted small">扣分总计</div>
                        <div class="h3 text-danger"><?= $stats['total_negative'] ?? 0 ?></div>
                    </div>
                    <div class="col-md-3">
                        <div class="text-muted small">当前排名</div>
                        <div class="h2"><?= $userRank ?></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 趋势图表 -->
        <div class="card mb-4">
            <div class="card-header">分数趋势（最近30天）</div>
            <div class="card-body">
                <canvas id="trendChart"></canvas>
            </div>
        </div>

        <!-- 每日明细（积分记录列表 + 内联编辑） -->
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <span>积分记录</span>
                <span class="badge bg-secondary">共 <?= count($recordsData) ?> 条</span>
            </div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-hover align-middle">
                        <thead>
                            <tr>
                                <th style="width:160px">时间</th>
                                <th style="width:110px">分数变化</th>
                                <th>说明</th>
                                <th class="text-center" style="width:120px">操作</th>
                            </tr>
                        </thead>
                        <tbody id="records-body">
                            <?php if (empty($recordsData)): ?>
                            <tr id="no-records">
                                <td colspan="4" class="text-center text-muted py-4">暂无积分记录</td>
                            </tr>
                            <?php else: foreach ($recordsData as $row): ?>
                            <tr data-id="<?= $row['id'] ?>" id="row-<?= $row['id'] ?>">
                                <td class="text-nowrap">
                                    <span class="view-mode"><?= date('Y-m-d H:i', strtotime($row['created_at'])) ?></span>
                                    <input type="datetime-local" class="edit-mode form-control form-control-sm time-input d-none" value="<?= date('Y-m-d\TH:i', strtotime($row['created_at'])) ?>">
                                </td>
                                <td>
                                    <span class="view-mode score-text <?= $row['score_change'] >= 0 ? 'text-success' : 'text-danger' ?> fw-bold">
                                        <?= $row['score_change'] > 0 ? '+' : '' ?><?= $row['score_change'] ?>
                                    </span>
                                    <input type="number" class="edit-mode form-control form-control-sm score-input d-none" value="<?= $row['score_change'] ?>">
                                </td>
                                <td>
                                    <span class="view-mode desc-text"><?= htmlspecialchars($row['description'] ?? '-') ?></span>
                                    <input type="text" class="edit-mode form-control form-control-sm desc-input d-none" value="<?= htmlspecialchars($row['description'] ?? '') ?>">
                                </td>
                                <td class="text-center">
                                    <span class="view-mode">
                                        <button class="btn btn-sm btn-outline-primary" onclick="startEdit(<?= $row['id'] ?>)" title="编辑">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button class="btn btn-sm btn-outline-danger" onclick="deleteRecord(<?= $row['id'] ?>)" title="删除">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </span>
                                    <span class="edit-mode d-none">
                                        <button class="btn btn-sm btn-success" onclick="submitEdit(<?= $row['id'] ?>)"><i class="fas fa-check"></i></button>
                                        <button class="btn btn-sm btn-secondary" onclick="cancelEdit(<?= $row['id'] ?>)"><i class="fas fa-times"></i></button>
                                    </span>
                                </td>
                            </tr>
                            <?php endforeach; endif; ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <!-- 删除确认模态框 -->
    <div class="modal fade" id="deleteModal" tabindex="-1">
        <div class="modal-dialog modal-sm modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">确认删除</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <p class="mb-2">确定要删除这条积分记录吗？<br><strong>此操作不可恢复。</strong></p>
                    <div class="mb-2">
                        <label class="form-label small text-muted">请输入管理员密码以确认</label>
                        <input type="password" class="form-control" id="delete-password" placeholder="管理员密码" autocomplete="current-password">
                    </div>
                    <div id="delete-error" class="text-danger small d-none"></div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                    <button class="btn btn-danger" id="confirmDeleteBtn">删除</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Toast 通知容器 -->
    <div class="position-fixed bottom-0 end-0 p-3" style="z-index:1050">
        <div id="toast" class="toast" role="alert">
            <div class="toast-body"></div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/js/bootstrap.bundle.min.js"></script>
    <script>
    const userId = <?= $userId ?>;
    // 缓存每行原始视图数据，用于取消编辑时恢复
    const originalData = {};

    function showToast(message, isError) {
        const toastEl = document.getElementById('toast');
        toastEl.classList.remove('bg-success', 'bg-danger', 'text-white');
        toastEl.classList.add(isError ? 'bg-danger' : 'bg-success', 'text-white');
        toastEl.querySelector('.toast-body').textContent = message;
        new bootstrap.Toast(toastEl, { delay: 2500 }).show();
    }

    // 开始内联编辑
    function startEdit(id) {
        const row = document.getElementById('row-' + id);
        // 缓存原始值
        originalData[id] = {
            time:  row.querySelector('.view-mode').textContent.trim(),
            score: row.querySelector('.score-text').textContent.trim(),
            desc:  row.querySelector('.desc-text').textContent.trim()
        };
        // 切换视图
        row.querySelectorAll('.view-mode').forEach(el => el.classList.add('d-none'));
        row.querySelectorAll('.edit-mode').forEach(el => el.classList.remove('d-none'));
    }

    // 取消编辑
    function cancelEdit(id) {
        const row = document.getElementById('row-' + id);
        row.querySelector('.view-mode').textContent = originalData[id].time;
        row.querySelector('.score-text').textContent = originalData[id].score;
        row.querySelector('.desc-text').textContent = originalData[id].desc;
        row.querySelectorAll('.edit-mode').forEach(el => el.classList.add('d-none'));
        row.querySelectorAll('.view-mode').forEach(el => el.classList.remove('d-none'));
    }

    // 提交编辑
    function submitEdit(id) {
        const row = document.getElementById('row-' + id);
        const timeVal = row.querySelector('.time-input').value;
        const score = row.querySelector('.score-input').value;
        const desc  = row.querySelector('.desc-input').value;

        if (score === '' || isNaN(score)) {
            showToast('请输入有效分数', true);
            return;
        }

        // 格式化为 MySQL DATETIME
        const formattedTime = timeVal ? timeVal.replace('T', ' ') + ':00' : null;

        const formData = new FormData();
        formData.append('id', id);
        formData.append('data', JSON.stringify({
            score_change: parseInt(score),
            description: desc,
            ...(formattedTime ? { created_at: formattedTime } : {})
        }));

        fetch('../api/admin_ops.php?op=update_score_log', {
            method: 'POST',
            body: formData
        })
            .then(r => r.json())
            .then(data => {
                if (data.success || data.message) {
                    showToast('更新成功', false);
                    // 回写视图值并切换回查看模式
                    row.querySelector('.view-mode').textContent = formattedTime
                        ? formattedTime.replace(' ', ' ').substring(0, 16)
                        : row.querySelector('.view-mode').textContent;
                    row.querySelector('.score-text').textContent = (parseInt(score) > 0 ? '+' : '') + score;
                    row.querySelector('.score-text').className = 'view-mode score-text fw-bold ' + (parseInt(score) >= 0 ? 'text-success' : 'text-danger');
                    row.querySelector('.desc-text').textContent = desc || '-';
                    row.querySelectorAll('.edit-mode').forEach(el => el.classList.add('d-none'));
                    row.querySelectorAll('.view-mode').forEach(el => el.classList.remove('d-none'));
                } else {
                    showToast(data.error || '更新失败', true);
                }
            })
            .catch(() => showToast('网络错误', true));
    }

    // 删除记录
    let deleteTargetId = null;
    let pendingErrorMsg = ''; // 错误时保存错误信息，等待模态框关闭后再显示
    const deleteModal = new bootstrap.Modal(document.getElementById('deleteModal'));
    const deleteModalEl = document.getElementById('deleteModal');
    const deleteErrorEl = document.getElementById('delete-error');
    const deletePasswordEl = document.getElementById('delete-password');
    const confirmBtn = document.getElementById('confirmDeleteBtn');

    // 模态框完全关闭后，如果有待处理错误则重新打开
    deleteModalEl.addEventListener('hidden.bs.modal', function() {
        if (pendingErrorMsg !== '') {
            const msg = pendingErrorMsg;
            pendingErrorMsg = '';
            deleteErrorEl.textContent = msg;
            deleteErrorEl.classList.remove('d-none');
            deletePasswordEl.value = '';
            deleteModal.show();
        }
    });

    function deleteRecord(id) {
        deleteTargetId = id;
        pendingErrorMsg = '';
        deleteErrorEl.textContent = '';
        deleteErrorEl.classList.add('d-none');
        deletePasswordEl.value = '';
        deleteModal.show();
    }

    confirmBtn.addEventListener('click', function() {
        if (deleteTargetId === null) return;
        const id = deleteTargetId;
        const password = deletePasswordEl.value;

        if (!password) {
            pendingErrorMsg = '请输入管理员密码';
            deleteModal.hide();
            return;
        }

        this.disabled = true;
        this.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        deleteErrorEl.textContent = '';
        deleteErrorEl.classList.add('d-none');

        const formData = new FormData();
        formData.append('id', id);
        formData.append('password', password);

        fetch('../api/admin_ops.php?op=delete_score_log', {
            method: 'POST',
            body: formData
        })
            .then(r => r.json())
            .then(data => {
                if (data.success || data.message) {
                    deleteModal.hide();
                    showToast('删除成功', false);
                    document.getElementById('row-' + id)?.remove();
                    if (!document.querySelector('#records-body tr[data-id]')) {
                        document.getElementById('records-body').innerHTML =
                            '<tr id="no-records"><td colspan="4" class="text-center text-muted py-4">暂无积分记录</td></tr>';
                    }
                    deleteTargetId = null;
                } else {
                    pendingErrorMsg = data.error || '密码错误，删除失败';
                    deleteModal.hide();
                }
            })
            .catch(() => {
                pendingErrorMsg = '网络错误，请重试';
                deleteModal.hide();
            })
            .finally(() => {
                this.disabled = false;
                this.innerHTML = '删除';
            });
    });
    </script>

    <script>
    // 趋势图表
    const ctx = document.getElementById('trendChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: [<?= implode(',', array_map(function($v) {
                return "'" . date('m-d', strtotime($v['date'])) . "'";
            }, $chartData)) ?>],
            datasets: [{
                label: '每日分数变化',
                data: [<?= implode(',', array_column($chartData, 'daily_score')) ?>],
                borderColor: '#0d6efd',
                tension: 0.4,
                fill: false
            }]
        },
        options: {
            responsive: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        title: (context) => '日期：' + context[0].label
                    }
                }
            }
        }
    });
    </script>

    <?php showFooter(); ?>

    <script src="../assets/js/background_image.js"></script>
</body>
</html>
