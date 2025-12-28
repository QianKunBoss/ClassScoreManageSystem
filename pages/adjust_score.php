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
    // 处理用户ID（支持数组格式和逗号分隔字符串格式）
    $userIds = $_POST['user_ids'];
    if (!is_array($userIds)) {
        // 如果是逗号分隔的字符串，转换为数组
        $userIds = explode(',', $userIds);
    }
    // 过滤空值
    $userIds = array_filter($userIds, function($id) {
        return !empty($id);
    });
    
    $score = (int)$_POST['score'];
    $desc = htmlspecialchars($_POST['description']);
    
    // 处理自定义时间
    $customTime = null;
    if (!empty($_POST['record_date'])) {
        $date = $_POST['record_date'];
        $hour = (int)($_POST['record_hour'] ?? 0);
        $minute = (int)($_POST['record_minute'] ?? 0);
        $second = (int)($_POST['record_second'] ?? 0);
        
        // 验证时间范围
        $hour = max(0, min(23, $hour));
        $minute = max(0, min(59, $minute));
        $second = max(0, min(59, $second));
        
        $customTime = "$date " . sprintf('%02d:%02d:%02d', $hour, $minute, $second);
    }

    try {
        $pdo->beginTransaction();
        
        if ($customTime) {
            // 使用自定义时间
            $stmt = $pdo->prepare("INSERT INTO score_logs (user_id, score_change, description, created_at) VALUES (?, ?, ?, ?)");
            
            foreach ($userIds as $userId) {
                $stmt->execute([$userId, $score, $desc, $customTime]);
            }
        } else {
            // 使用默认当前时间
            $stmt = $pdo->prepare("INSERT INTO score_logs (user_id, score_change, description) VALUES (?, ?, ?)");
            
            foreach ($userIds as $userId) {
                $stmt->execute([$userId, $score, $desc]);
            }
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
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link href="../assets/css/main.css" rel="stylesheet">
    <style>
        .seat-container {
            overflow-x: auto;
            padding: 20px;
        }
        
        .seat-table {
            display: flex;
            gap: 20px;
            align-items: flex-start;
        }
        
        .seat-group {
            background: #f8f9fa;
            border: 2px solid #dee2e6;
            border-radius: 8px;
            padding: 10px;
            height: fit-content;
        }
        
        .seat-row {
            display: flex;
            gap: 5px;
            margin-bottom: 5px;
        }
        
        .seat {
            width: 80px;
            height: 60px;
            background: transparent;
            border: 3px solid #667eea;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #667eea;
            font-size: 12px;
            font-weight: 500;
            cursor: grab;
            transition: all 0.2s ease;
            user-select: none;
        }
        
        .seat:hover {
            border-color: #764ba2;
            color: #764ba2;
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
        
        .seat.selected {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-color: #667eea;
        }
        
        .seat.selected:hover {
            border-color: #667eea;
        }
        
        .seat.dragging {
            opacity: 0.5;
            cursor: grabbing;
        }
        
        .seat.drag-over {
            border-color: #48bb78;
            box-shadow: 0 0 10px rgba(72, 187, 120, 0.5);
        }
        
        .seat.empty-seat {
            border-color: #a0aec0;
            color: #a0aec0;
            cursor: not-allowed;
        }
        
        .seat-user {
            text-align: center;
            word-break: break-all;
            padding: 2px;
        }
        
        .seat-label {
            font-style: italic;
        }
        
        .seat-aisle {
            width: 40px;
            height: 100%;
            min-height: 60px;
            background: repeating-linear-gradient(
                45deg,
                #f0f0f0,
                #f0f0f0 10px,
                #e0e0e0 10px,
                #e0e0e0 20px
            );
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .seat-aisle::after {
            content: '走廊';
            writing-mode: vertical-rl;
            text-orientation: mixed;
            color: #999;
            font-size: 12px;
            font-weight: bold;
            letter-spacing: 2px;
        }
    </style>
</head>
<body>
    <?php showNav(); ?>
    
    <div class="container mt-4">
        <a href="../admin.php" class="btn btn-secondary mb-3">← 返回排名</a>
     
        <!-- 列表视图 -->
        <div class="card" id="listView">
            <div class="card-header d-flex justify-content-between align-items-center">
                <span>积分调整</span>
                <div class="btn-group" role="group">
                    <button type="button" class="btn btn-outline-primary active" id="listViewBtn" onclick="switchView('list')">
                        列表视图
                    </button>
                    <button type="button" class="btn btn-outline-primary" id="seatViewBtn" onclick="switchView('seat')">
                        座位表视图
                    </button>
                </div>
            </div>
            <div class="card-body">
                <?php if(isset($error)): ?>
                    <div class="alert alert-danger"><?= $error ?></div>
                <?php endif; ?>

                <form method="post" class="need-password">
                    <div class="mb-3">
                        <label>选择学生 <span class="badge bg-primary" id="selectedCount">已选择: 0人</span></label>
                        <div class="user-list">
                            <?php foreach ($users as $user): ?>
                                <div class="form-check">
                                    <input class="form-check-input user-checkbox" type="checkbox" name="user_ids[]" value="<?= $user['id'] ?>" id="user_<?= $user['id'] ?>" onchange="updateSelectedCount()">
                                    <label class="form-check-label" for="user_<?= $user['id'] ?>">
                                        <?= $user['username'] ?>
                                    </label>
                                </div>
                            <?php endforeach; ?>
                        </div>
                        <button type="button" class="btn btn-link btn-sm mt-2" onclick="toggleAllUsers(this)">
                            全选/取消
                        </button>
                        <button type="button" class="btn btn-link btn-sm mt-2" onclick="invertSelection()">
                            反选
                        </button>
                        <script>
                            function updateSelectedCount() {
                                const checkboxes = document.querySelectorAll('.user-checkbox');
                                const checkedCount = Array.from(checkboxes).filter(checkbox => checkbox.checked).length;
                                document.getElementById('selectedCount').textContent = `已选择: ${checkedCount}人`;
                            }
                            
                            function toggleAllUsers(btn) {
                                const checkboxes = document.querySelectorAll('.user-checkbox');
                                const allChecked = Array.from(checkboxes).every(checkbox => checkbox.checked);
                                checkboxes.forEach(checkbox => checkbox.checked = !allChecked);
                                btn.textContent = allChecked ? '全选' : '取消';
                                updateSelectedCount();
                            }

                            function invertSelection() {
                                const checkboxes = document.querySelectorAll('.user-checkbox');
                                checkboxes.forEach(checkbox => checkbox.checked = !checkbox.checked);
                                updateSelectedCount();
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
    
    <div class="mb-3">
        <label>记录时间 <small class="text-muted">(留空则使用当前时间)</small></label>
        <div class="row">
            <div class="col-md-3">
                <input type="date" name="record_date" class="form-control" id="recordDate">
            </div>
            <div class="col-md-2">
                <input type="number" name="record_hour" class="form-control" id="recordHour" min="0" max="23" placeholder="时">
            </div>
            <div class="col-md-2">
                <input type="number" name="record_minute" class="form-control" id="recordMinute" min="0" max="59" placeholder="分">
            </div>
            <div class="col-md-2">
                <input type="number" name="record_second" class="form-control" id="recordSecond" min="0" max="59" placeholder="秒">
            </div>
            <div class="col-md-3">
                <button type="button" class="btn btn-outline-secondary btn-sm" onclick="setCurrentTime()">设为当前时间</button>
            </div>
        </div>
    </div>
    
    <script>
        // 用户数据
        const users = <?php echo json_encode($users); ?>;
        
        // 座位选择功能
        let selectedUserIds = [];
        
        // 拖动相关变量
        let draggedSeat = null;

        // DOM加载完成后添加事件监听器
        document.addEventListener('DOMContentLoaded', function() {
            const templateSelect = document.getElementById('templateSelect');
            if (templateSelect) {
                templateSelect.addEventListener('change', function() {
                    const selectedOption = this.options[this.selectedIndex];
                    if (selectedOption.value) {
                        document.getElementById('scoreInput').value = selectedOption.dataset.score;
                        document.getElementById('descInput').value = selectedOption.dataset.desc;
                    }
                });
            }

            const templateSelectSeat = document.getElementById('templateSelectSeat');
            if (templateSelectSeat) {
                templateSelectSeat.addEventListener('change', function() {
                    const selectedOption = this.options[this.selectedIndex];
                    if (selectedOption.value) {
                        document.getElementById('scoreInputSeat').value = selectedOption.dataset.score;
                        document.getElementById('descInputSeat').value = selectedOption.dataset.desc;
                    }
                });
            }
        });

        function toggleSeatSelection(seat) {
            const userId = seat.dataset.userId;
            if (!userId) return;

            const index = selectedUserIds.indexOf(userId);
            if (index > -1) {
                selectedUserIds.splice(index, 1);
                seat.classList.remove('selected');
            } else {
                selectedUserIds.push(userId);
                seat.classList.add('selected');
            }
            
            // 更新座位视图的选择人数显示
            const seatCountElement = document.getElementById('seatSelectedCount');
            if (seatCountElement) {
                seatCountElement.textContent = `已选择: ${selectedUserIds.length}人`;
            }
            
            updateSelectedUsersDisplay();
        }

        function updateSelectedUsersDisplay() {
            const display = document.getElementById('selectedSeatUsers');
            const container = document.getElementById('selectedSeatUsers').parentElement;
            
            if (selectedUserIds.length === 0) {
                display.textContent = '未选择任何学生';
                display.className = 'mb-2 text-muted';
            } else {
                const userNames = selectedUserIds.map(id => {
                    const user = users.find(u => u.id == id);
                    return user ? user.username : id;
                });
                display.textContent = '已选择: ' + userNames.join(', ');
                display.className = 'mb-2 text-primary';
            }

            // 移除旧的hidden inputs
            const existingInputs = container.querySelectorAll('input[name="user_ids[]"]');
            existingInputs.forEach(input => input.remove());

            // 为每个选中的用户创建新的hidden input
            selectedUserIds.forEach(userId => {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = 'user_ids[]';
                input.value = userId;
                container.appendChild(input);
            });
        }

        // 设置当前时间 - 列表视图
        function setCurrentTime() {
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const hour = now.getHours();
            const minute = now.getMinutes();
            const second = now.getSeconds();
            
            document.getElementById('recordDate').value = dateStr;
            document.getElementById('recordHour').value = hour;
            document.getElementById('recordMinute').value = minute;
            document.getElementById('recordSecond').value = second;
        }

        // 设置当前时间 - 座位表视图
        function setCurrentTimeSeat() {
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const hour = now.getHours();
            const minute = now.getMinutes();
            const second = now.getSeconds();
            
            document.getElementById('recordDateSeat').value = dateStr;
            document.getElementById('recordHourSeat').value = hour;
            document.getElementById('recordMinuteSeat').value = minute;
            document.getElementById('recordSecondSeat').value = second;
        }

        // 座位表选择控制函数
        function selectAllSeats() {
            const seats = document.querySelectorAll('.seat[data-user-id]');
            seats.forEach(seat => {
                const userId = seat.dataset.userId;
                if (userId && !selectedUserIds.includes(userId)) {
                    selectedUserIds.push(userId);
                    seat.classList.add('selected');
                }
            });
            updateSelectedUsersDisplay();
            // 更新选择人数显示
            const seatCountElement = document.getElementById('seatSelectedCount');
            if (seatCountElement) {
                seatCountElement.textContent = `已选择: ${selectedUserIds.length}人`;
            }
        }

        function deselectAllSeats() {
            const seats = document.querySelectorAll('.seat.selected');
            seats.forEach(seat => {
                seat.classList.remove('selected');
            });
            selectedUserIds = [];
            updateSelectedUsersDisplay();
            // 更新选择人数显示
            const seatCountElement = document.getElementById('seatSelectedCount');
            if (seatCountElement) {
                seatCountElement.textContent = `已选择: ${selectedUserIds.length}人`;
            }
        }

        function invertSeatSelection() {
            const seats = document.querySelectorAll('.seat[data-user-id]');
            seats.forEach(seat => {
                const userId = seat.dataset.userId;
                if (userId) {
                    const index = selectedUserIds.indexOf(userId);
                    if (index > -1) {
                        selectedUserIds.splice(index, 1);
                        seat.classList.remove('selected');
                    } else {
                        selectedUserIds.push(userId);
                        seat.classList.add('selected');
                    }
                }
            });
            updateSelectedUsersDisplay();
            // 更新选择人数显示
            const seatCountElement = document.getElementById('seatSelectedCount');
            if (seatCountElement) {
                seatCountElement.textContent = `已选择: ${selectedUserIds.length}人`;
            }
        }

function selectGroup(groupIndex) {
            const seats = document.querySelectorAll(`.seat[data-group-index="${groupIndex}"][data-user-id]`);
            seats.forEach(seat => {
                const userId = seat.dataset.userId;
                if (!selectedUserIds.includes(userId)) {
                    selectedUserIds.push(userId);
                    seat.classList.add('selected');
                }
            });
            updateSelectedUsersDisplay();
            // 更新选择人数显示
            const seatCountElement = document.getElementById('seatSelectedCount');
            if (seatCountElement) {
                seatCountElement.textContent = `已选择: ${selectedUserIds.length}人`;
            }
        }

        function deselectGroup(groupIndex) {
            const seats = document.querySelectorAll(`.seat[data-group-index="${groupIndex}"].selected`);
            seats.forEach(seat => {
                const userId = seat.dataset.userId;
                const index = selectedUserIds.indexOf(userId);
                if (index > -1) {
                    selectedUserIds.splice(index, 1);
                    seat.classList.remove('selected');
                }
            });
            updateSelectedUsersDisplay();
            // 更新选择人数显示
            const seatCountElement = document.getElementById('seatSelectedCount');
            if (seatCountElement) {
                seatCountElement.textContent = `已选择: ${selectedUserIds.length}人`;
            }
        }

        function generateGroupButtons(groupCount) {
            const container = document.getElementById('groupSelectButtons');
            container.innerHTML = '';
            
            for (let i = 0; i < groupCount; i++) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'btn btn-outline-info';
                btn.textContent = `第${i + 1}组`;
                btn.onclick = function() {
                    const allSelectedInGroup = Array.from(
                        document.querySelectorAll(`.seat[data-group-index="${i}"][data-user-id]`)
                    ).every(seat => selectedUserIds.includes(seat.dataset.userId));
                    
                    if (allSelectedInGroup) {
                        deselectGroup(i);
                        this.classList.remove('active');
                    } else {
                        selectGroup(i);
                        this.classList.add('active');
                    }
                };
                container.appendChild(btn);
            }
        }

        // 视图切换功能
        function switchView(view) {
            const listView = document.getElementById('listView');
            const seatView = document.getElementById('seatView');
            const listViewBtn = document.getElementById('listViewBtn');
            const seatViewBtn = document.getElementById('seatViewBtn');
            const listViewBtn2 = document.getElementById('listViewBtn2');
            const seatViewBtn2 = document.getElementById('seatViewBtn2');
            
            if (view === 'list') {
                listView.style.display = 'block';
                seatView.style.display = 'none';
                listViewBtn.classList.add('active');
                seatViewBtn.classList.remove('active');
                if (listViewBtn2) listViewBtn2.classList.add('active');
                if (seatViewBtn2) seatViewBtn2.classList.remove('active');
                // 清空座位选择
                selectedUserIds = [];
                updateSelectedUsersDisplay();
            } else {
                listView.style.display = 'none';
                seatView.style.display = 'block';
                listViewBtn.classList.remove('active');
                seatViewBtn.classList.add('active');
                if (listViewBtn2) listViewBtn2.classList.remove('active');
                if (seatViewBtn2) seatViewBtn2.classList.add('active');
                loadSeatLayout();
            }
        }

        function handleDragStart(e) {
            draggedSeat = this;
            this.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        }

        function handleDragOver(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            this.classList.add('drag-over');
        }

        function handleDrop(e) {
            e.preventDefault();
            this.classList.remove('drag-over');

            if (draggedSeat !== this) {
                // 交换座位数据
                const draggedUserId = draggedSeat.dataset.userId;
                const targetUserId = this.dataset.userId;
                const draggedUserHtml = draggedSeat.innerHTML;
                const targetUserHtml = this.innerHTML;

                // 交换
                if (draggedUserId) {
                    this.dataset.userId = draggedUserId;
                } else {
                    delete this.dataset.userId;
                }
                this.innerHTML = draggedUserHtml;

                if (targetUserId) {
                    draggedSeat.dataset.userId = targetUserId;
                } else {
                    delete draggedSeat.dataset.userId;
                }
                draggedSeat.innerHTML = targetUserHtml;

                // 更新样式
                updateSeatStyles(this);
                updateSeatStyles(draggedSeat);
            }
        }

        function handleDragEnd(e) {
            this.classList.remove('dragging');
            document.querySelectorAll('.seat').forEach(seat => {
                seat.classList.remove('drag-over');
            });
        }

        function updateSeatStyles(seat) {
            if (seat.dataset.userId) {
                seat.classList.remove('empty-seat');
            } else {
                seat.classList.add('empty-seat');
            }
        }

        // 生成座位表
        function generateSeatLayout() {
            const groupCount = parseInt(document.getElementById('groupCount').value);
            const rowsPerGroup = parseInt(document.getElementById('rowsPerGroup').value);
            const colsPerGroup = parseInt(document.getElementById('colsPerGroup').value);
            const hasAisle = document.getElementById('hasAisle').checked;

            const container = document.getElementById('seatContainer');
            container.innerHTML = '';

            // 创建座位表
            const table = document.createElement('div');
            table.className = 'seat-table';
            table.dataset.groupCount = groupCount;
            table.dataset.rowsPerGroup = rowsPerGroup;
            table.dataset.colsPerGroup = colsPerGroup;
            table.dataset.hasAisle = hasAisle ? 1 : 0;

            let userIndex = 0;
            
            for (let g = 0; g < groupCount; g++) {
                const groupDiv = document.createElement('div');
                groupDiv.className = 'seat-group';
                groupDiv.dataset.groupIndex = g;

                for (let r = 0; r < rowsPerGroup; r++) {
                    const rowDiv = document.createElement('div');
                    rowDiv.className = 'seat-row';

                    for (let c = 0; c < colsPerGroup; c++) {
                        const seat = document.createElement('div');
                        seat.className = 'seat';
                        seat.dataset.groupIndex = g;
                        seat.dataset.rowIndex = r;
                        seat.dataset.colIndex = c;
                        seat.draggable = true;

                        if (userIndex < users.length) {
                            seat.dataset.userId = users[userIndex].id;
                            seat.innerHTML = `<span class="seat-user">${users[userIndex].username}</span>`;
                            userIndex++;
                        } else {
                            seat.classList.add('empty-seat');
                            seat.innerHTML = '<span class="seat-label">空座</span>';
                        }

                        // 拖动事件
                        if (seat && typeof seat.addEventListener === 'function') {
                            seat.addEventListener('dragstart', handleDragStart);
                            seat.addEventListener('dragover', handleDragOver);
                            seat.addEventListener('drop', handleDrop);
                            seat.addEventListener('dragend', handleDragEnd);
                            
                            // 点击选择事件（仅非空座位）
                            if (seat.dataset.userId) {
                                seat.addEventListener('click', function(e) {
                                    if (!this.classList.contains('dragging')) {
                                        toggleSeatSelection(this);
                                    }
                                });
                            }
                        }

                        rowDiv.appendChild(seat);
                    }

                    groupDiv.appendChild(rowDiv);
                }

                table.appendChild(groupDiv);

                // 添加走廊（除了最后一组）
                if (hasAisle && g < groupCount - 1) {
                    const aisle = document.createElement('div');
                    aisle.className = 'seat-aisle';
                    table.appendChild(aisle);
                }
            }

            container.appendChild(table);

            // 生成组选择按钮
            generateGroupButtons(groupCount);

            // 关闭模态框
            const modalEl = document.getElementById('seatConfigModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) {
                modal.hide();
                // 移除遮罩层
                setTimeout(() => {
                    const backdrop = document.querySelector('.modal-backdrop');
                    if (backdrop) {
                        backdrop.remove();
                    }
                    document.body.classList.remove('modal-open');
                }, 300);
            }
        }
        
                // 保存座位表布局
                function saveSeatLayout() {
            const table = document.querySelector('.seat-table');
            if (!table) {
                alert('请先生成座位表');
                return;
            }

            const seats = [];
            document.querySelectorAll('.seat').forEach(seat => {
                seats.push({
                    group_index: parseInt(seat.dataset.groupIndex),
                    row_index: parseInt(seat.dataset.rowIndex),
                    col_index: parseInt(seat.dataset.colIndex),
                    user_id: seat.dataset.userId ? parseInt(seat.dataset.userId) : null
                });
            });

            fetch('../api/save_seat_layout.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    group_count: parseInt(table.dataset.groupCount),
                    rows_per_group: parseInt(table.dataset.rowsPerGroup),
                    cols_per_group: parseInt(table.dataset.colsPerGroup),
                    has_aisle: parseInt(table.dataset.hasAisle),
                    seats: seats
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('座位表保存成功');
                } else {
                    alert('保存失败: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('保存失败');
            });
        }

        // 加载座位表布局
        function loadSeatLayout() {
            fetch('../api/load_seat_layout.php')
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.config && data.seats) {
                        renderSeatLayout(data.config, data.seats);
                    } else {
                        document.getElementById('seatContainer').innerHTML = 
                            '<p class="text-muted">请先配置座位表参数</p>';
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    document.getElementById('seatContainer').innerHTML = 
                        '<p class="text-muted">加载座位表失败</p>';
                });
        }

        // 渲染座位表
        function renderSeatLayout(config, seats) {
            const container = document.getElementById('seatContainer');
            container.innerHTML = '';

            const table = document.createElement('div');
            table.className = 'seat-table';
            table.dataset.groupCount = config.group_count;
            table.dataset.rowsPerGroup = config.rows_per_group;
            table.dataset.colsPerGroup = config.cols_per_group;
            table.dataset.hasAisle = config.has_aisle;

            // 创建座位映射
            const seatMap = {};
            seats.forEach(seat => {
                const key = `${seat.group_index}-${seat.row_index}-${seat.col_index}`;
                seatMap[key] = seat.user_id;
            });

            for (let g = 0; g < config.group_count; g++) {
                const groupDiv = document.createElement('div');
                groupDiv.className = 'seat-group';
                groupDiv.dataset.groupIndex = g;

                for (let r = 0; r < config.rows_per_group; r++) {
                    const rowDiv = document.createElement('div');
                    rowDiv.className = 'seat-row';

                    for (let c = 0; c < config.cols_per_group; c++) {
                        const seat = document.createElement('div');
                        seat.className = 'seat';
                        seat.dataset.groupIndex = g;
                        seat.dataset.rowIndex = r;
                        seat.dataset.colIndex = c;
                        seat.draggable = true;

                        const key = `${g}-${r}-${c}`;
                        const userId = seatMap[key];

                        if (userId) {
                            const user = users.find(u => u.id == userId);
                            if (user) {
                                seat.dataset.userId = userId;
                                seat.innerHTML = `<span class="seat-user">${user.username}</span>`;
                            } else {
                                seat.classList.add('empty-seat');
                                seat.innerHTML = '<span class="seat-label">空座</span>';
                            }
                        } else {
                            seat.classList.add('empty-seat');
                            seat.innerHTML = '<span class="seat-label">空座</span>';
                        }

                        // 拖动事件
                        if (seat && typeof seat.addEventListener === 'function') {
                            seat.addEventListener('dragstart', handleDragStart);
                            seat.addEventListener('dragover', handleDragOver);
                            seat.addEventListener('drop', handleDrop);
                            seat.addEventListener('dragend', handleDragEnd);
                            
                            // 点击选择事件（仅非空座位）
                            if (seat.dataset.userId) {
                                seat.addEventListener('click', function(e) {
                                    if (!this.classList.contains('dragging')) {
                                        toggleSeatSelection(this);
                                    }
                                });
                            }
                        }

                        rowDiv.appendChild(seat);
                    }

                    groupDiv.appendChild(rowDiv);
                }

                table.appendChild(groupDiv);

                // 添加走廊（除了最后一组）
                if (config.has_aisle && g < config.group_count - 1) {
                    const aisle = document.createElement('div');
                    aisle.className = 'seat-aisle';
                    table.appendChild(aisle);
                }
            }

            container.appendChild(table);

            // 生成组选择按钮
            generateGroupButtons(config.group_count);
        }
    </script>
                    
                    <button type="submit" class="btn btn-primary">提交</button>
                </form>
            </div>
        </div>
        
        <!-- 座位表视图 -->
        <div class="card" id="seatView" style="display: none;">
            <div class="card-header d-flex justify-content-between align-items-center">
                <span>积分调整（座位表）</span>
                <div class="btn-group" role="group">
                    <button type="button" class="btn btn-outline-primary" id="listViewBtn2" onclick="switchView('list')">
                        列表视图
                    </button>
                    <button type="button" class="btn btn-outline-primary active" id="seatViewBtn2" onclick="switchView('seat')">
                        座位表视图
                    </button>
                </div>
            </div>
            <div class="card-body">
                <?php if(isset($error)): ?>
                    <div class="alert alert-danger"><?= $error ?></div>
                <?php endif; ?>

                <form method="post" class="need-password">
                    <div class="mb-3 d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <label>选择学生（点击座位选择） <span class="badge bg-primary" id="seatSelectedCount">已选择: 0人</span></label>
                            <div id="selectedSeatUsers" class="mb-2 text-muted">未选择任何学生</div>
                            <div class="btn-group btn-group-sm mb-2" role="group">
                                <button type="button" class="btn btn-outline-secondary" onclick="selectAllSeats()">全选</button>
                                <button type="button" class="btn btn-outline-secondary" onclick="deselectAllSeats()">取消</button>
                                <button type="button" class="btn btn-outline-secondary" onclick="invertSeatSelection()">反选</button>
                            </div>
                            <div class="mb-2">
                                <label class="form-label small text-muted">选择组：</label>
                                <div id="groupSelectButtons" class="btn-group btn-group-sm" role="group">
                                    <!-- 动态生成组选择按钮 -->
                                </div>
                            </div>
                        </div>
                        <div class="d-flex gap-2">
                            <button type="button" class="btn btn-sm btn-info" data-bs-toggle="modal" data-bs-target="#seatConfigModal">
                                ⚙️ 配置座位表
                            </button>
                            <button type="button" class="btn btn-sm btn-success" onclick="saveSeatLayout()">
                                💾 保存布局
                            </button>
                        </div>
                    </div>

                    <div id="seatContainer" class="seat-container mb-3">
                        <p class="text-muted">请先配置座位表参数</p>
                    </div>

                    <div class="mb-3">
                        <label>选择预设</label>
                        <select class="form-select mb-2" id="templateSelectSeat">
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
                        <input type="number" name="score" class="form-control" id="scoreInputSeat" required>
                    </div>
                    
                    <div class="mb-3">
                        <label>原因说明</label>
                        <textarea name="description" class="form-control" id="descInputSeat"></textarea>
                    </div>
                    
                    <div class="mb-3">
                        <label>记录时间 <small class="text-muted">(留空则使用当前时间)</small></label>
                        <div class="row">
                            <div class="col-md-3">
                                <input type="date" name="record_date" class="form-control" id="recordDateSeat">
                            </div>
                            <div class="col-md-2">
                                <input type="number" name="record_hour" class="form-control" id="recordHourSeat" min="0" max="23" placeholder="时">
                            </div>
                            <div class="col-md-2">
                                <input type="number" name="record_minute" class="form-control" id="recordMinuteSeat" min="0" max="59" placeholder="分">
                            </div>
                            <div class="col-md-2">
                                <input type="number" name="record_second" class="form-control" id="recordSecondSeat" min="0" max="59" placeholder="秒">
                            </div>
                            <div class="col-md-3">
                                <button type="button" class="btn btn-outline-secondary btn-sm" onclick="setCurrentTimeSeat()">设为当前时间</button>
                            </div>
                        </div>
                    </div>
                    
                    <button type="submit" class="btn btn-primary">提交</button>
                </form>
            </div>
        </div>
    </div>

    <!-- 座位表配置模态框 -->
    <div class="modal fade" id="seatConfigModal" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">配置座位表</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="mb-3">
                        <label class="form-label">组数</label>
                        <input type="number" class="form-control" id="groupCount" min="1" max="10" value="4">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">每组行数</label>
                        <input type="number" class="form-control" id="rowsPerGroup" min="1" max="10" value="5">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">每组列数</label>
                        <input type="number" class="form-control" id="colsPerGroup" min="1" max="10" value="6">
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="hasAisle" checked>
                        <label class="form-check-label" for="hasAisle">
                            组间添加走廊
                        </label>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                    <button type="button" class="btn btn-primary" onclick="generateSeatLayout()">生成座位表</button>
                </div>
            </div>
        </div>
    </div>

    <?php showFooter(); ?>
    <script src="https://cdn.bootcdn.net/ajax/libs/bootstrap/5.2.3/js/bootstrap.bundle.min.js"></script>
</body>
</html>