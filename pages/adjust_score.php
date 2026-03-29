<?php
require_once '../includes/config.php';
require_once '../includes/functions.php';

if (!isLoggedIn()) {
    header('Location: login.php');
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
        header("Location: admin.php");
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
    <script>
    // 在CSS加载前立即应用保存的主题，防止闪烁
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
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    
</head>
<body>
    <?php showNav(); ?>
    
    <div class="container mt-4">
        <a href="admin.php" class="btn btn-secondary mb-3 return-button">← 返回排名</a>
     
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

                <form method="post" class="need-password" id="listViewForm">
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
        let draggedUser = null;

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
            
            // 初始化用户列表
            initializeUserList();
            
            // 添加搜索功能
            const searchInput = document.getElementById('userSearchInput');
            if (searchInput) {
                searchInput.addEventListener('input', function() {
                    filterUsers(this.value);
                });
            }

            // 绑定提交按钮事件
            const submitListBtn = document.getElementById('submitListBtn');
            if (submitListBtn) {
                submitListBtn.addEventListener('click', function() {
                    submitForm('listViewForm', 'submitListBtn');
                });
            }

            const submitSeatBtn = document.getElementById('submitSeatBtn');
            if (submitSeatBtn) {
                submitSeatBtn.addEventListener('click', function() {
                    submitForm('seatViewForm', 'submitSeatBtn');
                });
            }
        });
        
        // 初始化用户列表
        function initializeUserList() {
            const userListContainer = document.getElementById('userList');
            if (!userListContainer) return;
            
            userListContainer.innerHTML = '';
            
            users.forEach(user => {
                const userItem = document.createElement('div');
                userItem.className = 'user-item';
                userItem.dataset.userId = user.id;
                userItem.textContent = user.username;
                userItem.draggable = true;
                
                // 添加拖拽事件
                userItem.addEventListener('dragstart', handleUserDragStart);
                userItem.addEventListener('dragend', handleUserDragEnd);
                userItem.addEventListener('dragover', handleUserDragOver);
                userItem.addEventListener('dragleave', handleUserDragLeave);
                userItem.addEventListener('drop', handleUserDrop);
                
                userListContainer.appendChild(userItem);
            });
        }
        
        // 切换用户列表面板显示/隐藏
        function toggleUserList() {
            const panel = document.getElementById('userListPanel');
            if (!panel) return;
            
            if (panel.style.display === 'none') {
                panel.style.display = 'block';
                // 添加进入动画
                panel.style.opacity = '0';
                panel.style.transform = 'translateX(20px)';
                
                setTimeout(() => {
                    panel.style.transition = 'all 0.3s ease';
                    panel.style.opacity = '1';
                    panel.style.transform = 'translateX(0)';
                }, 10);
            } else {
                // 添加退出动画
                panel.style.transition = 'all 0.3s ease';
                panel.style.opacity = '0';
                panel.style.transform = 'translateX(20px)';
                
                setTimeout(() => {
                    panel.style.display = 'none';
                }, 300);
            }
        }
        
        // 处理用户拖拽开始
        function handleUserDragStart(e) {
            draggedUser = this;
            this.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', this.dataset.userId);
        }
        
        // 处理用户拖拽结束
        function handleUserDragEnd(e) {
            this.classList.remove('dragging');
            draggedUser = null;
        }
        
        // 处理用户列表项的拖拽悬停
        function handleUserDragOver(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            this.style.backgroundColor = '#e7f3ff';
        }
        
        // 处理用户列表项的拖拽离开
        function handleUserDragLeave(e) {
            this.style.backgroundColor = '';
        }
        
        // 处理用户列表项的拖拽放置
        function handleUserDrop(e) {
            e.preventDefault();
            this.style.backgroundColor = '';
            
            // 检查是否是从座位拖拽过来的
            if (draggedSeat && draggedSeat.classList.contains('seat')) {
                const userId = draggedSeat.dataset.userId;
                const userName = draggedSeat.innerHTML;
                
                // 找到对应的用户项并显示
                const userItem = document.querySelector(`.user-item[data-user-id="${userId}"]`);
                if (userItem) {
                    userItem.classList.remove('hidden');
                }
                
                // 清空座位
                delete draggedSeat.dataset.userId;
                draggedSeat.innerHTML = '<span class="seat-label">空座</span>';
                draggedSeat.classList.add('empty-seat');
                
                // 更新样式
                updateSeatStyles(draggedSeat);
            }
        }
        
        // 过滤用户列表
        function filterUsers(searchTerm) {
            const userItems = document.querySelectorAll('.user-item');
            const term = searchTerm.toLowerCase();
            
            userItems.forEach(item => {
                const username = item.textContent.toLowerCase();
                if (username.includes(term)) {
                    item.classList.remove('hidden');
                } else {
                    item.classList.add('hidden');
                }
            });
        }

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

            // 检查是否是从用户列表拖拽过来的
            if (draggedUser && draggedUser.classList.contains('user-item')) {
                // 从用户列表拖拽到座位
                const userId = draggedUser.dataset.userId;
                const userName = draggedUser.textContent;
                
                // 如果座位已有用户，先将其放回用户列表
                if (this.dataset.userId) {
                    const existingUserItem = document.querySelector(`.user-item[data-user-id="${this.dataset.userId}"]`);
                    if (existingUserItem) {
                        existingUserItem.classList.remove('hidden');
                    }
                }
                
                // 将用户放到座位上
                this.dataset.userId = userId;
                this.innerHTML = `<span class="seat-user">${userName}</span>`;
                this.classList.remove('empty-seat');
                
                // 隐藏用户列表中的该项
                draggedUser.classList.add('hidden');
                
                // 添加点击选择事件
                if (!this.hasClickListener) {
                    this.addEventListener('click', function(e) {
                        if (!this.classList.contains('dragging')) {
                            toggleSeatSelection(this);
                        }
                    });
                    this.hasClickListener = true;
                }
                
                // 更新样式
                updateSeatStyles(this);
            } else if (draggedSeat !== this) {
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
            
            for (let g = 0; g < groupCount; g++) {
                const groupDiv = document.createElement('div');
                groupDiv.className = 'seat-group';
                groupDiv.dataset.groupIndex = g;

                for (let r = 0; r < rowsPerGroup; r++) {
                    const rowDiv = document.createElement('div');
                    rowDiv.className = 'seat-row';

                    for (let c = 0; c < colsPerGroup; c++) {
                        const seat = document.createElement('div');
                        seat.className = 'seat empty-seat';
                        seat.dataset.groupIndex = g;
                        seat.dataset.rowIndex = r;
                        seat.dataset.colIndex = c;
                        seat.draggable = true;
                        seat.innerHTML = '<span class="seat-label">空座</span>';

                        // 拖动事件
                        if (seat && typeof seat.addEventListener === 'function') {
                            seat.addEventListener('dragstart', handleDragStart);
                            seat.addEventListener('dragover', handleDragOver);
                            seat.addEventListener('drop', handleDrop);
                            seat.addEventListener('dragend', handleDragEnd);
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
                // 移除遮罩层和恢复滚动
                setTimeout(() => {
                    const backdrop = document.querySelector('.modal-backdrop');
                    if (backdrop) {
                        backdrop.remove();
                    }
                    document.body.classList.remove('modal-open');
                    document.body.style.overflow = '';
                    document.body.style.paddingRight = '';
                }, 300);
            }
        }
        
                // 保存座位表布局
                function saveSeatLayout() {
            const table = document.querySelector('.seat-table');
            if (!table) {
                showSaveResultModal('请先生成座位表', false);
                return;
            }

            // 显示保存进度模态框
            showSaveProgressModal();

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
                setTimeout(() => {
                    if (data.success) {
                        showSaveResultModal('座位表保存成功', true);
                    } else {
                        showSaveResultModal('保存失败: ' + data.message, false);
                    }
                }, 1000); // 至少显示1秒进度条
            })
            .catch(error => {
                console.error('Error:', error);
                setTimeout(() => {
                    showSaveResultModal('保存失败', false);
                }, 1000);
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
                        // 确保所有用户项都显示
                        document.querySelectorAll('.user-item').forEach(item => {
                            item.classList.remove('hidden');
                        });
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
                                seat.classList.remove('empty-seat');
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
            
            // 隐藏已入座的用户
            document.querySelectorAll('.user-item').forEach(item => {
                item.classList.remove('hidden');
            });
            
            document.querySelectorAll('.seat[data-user-id]').forEach(seat => {
                const userId = seat.dataset.userId;
                const userItem = document.querySelector(`.user-item[data-user-id="${userId}"]`);
                if (userItem) {
                    userItem.classList.add('hidden');
                }
            });
        }
        
        // 显示保存进度模态框
        function showSaveProgressModal() {
            // 检查是否已存在模态框，如果存在则先移除
            const existingModal = document.getElementById('saveProgressModal');
            if (existingModal) {
                existingModal.remove();
            }
            
            const modalHtml = `
                <div class="modal fade" id="saveProgressModal" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
                    <div class="modal-dialog modal-sm modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-body text-center py-4">
                                <div class="spinner-border text-primary mb-3" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>
                                <h5 class="mb-2">正在保存座位表</h5>
                                <p class="text-muted mb-0">请稍候...</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            const modal = new bootstrap.Modal(document.getElementById('saveProgressModal'));
            modal.show();
        }
        
        // 显示保存结果模态框
        function showSaveResultModal(message, success) {
            const progressModal = document.getElementById('saveProgressModal');
            const progressModalInstance = bootstrap.Modal.getInstance(progressModal);
            
            if (progressModal && progressModalInstance) {
                // 更新进度模态框内容为结果
                const modalBody = progressModal.querySelector('.modal-body');
                modalBody.innerHTML = `
                    <div class="text-center py-4">
                        <div class="mb-3">
                            ${success ? 
                                '<div class="checkmark-circle success"><div class="checkmark"></div></div>' : 
                                '<div class="crossmark-circle error"><div class="crossmark"></div></div>'
                            }
                        </div>
                        <h5 class="mb-2">${success ? '保存成功' : '保存失败'}</h5>
                        <p class="text-muted mb-3">${message}</p>
                        <button type="button" class="btn btn-${success ? 'success' : 'danger'}" onclick="closeSaveResultModal()">确定</button>
                    </div>
                `;
                
                // 2秒后自动关闭成功提示
                if (success) {
                    setTimeout(() => {
                        closeSaveResultModal();
                    }, 2000);
                }
            }
        }
        
        // 关闭保存结果模态框
        function closeSaveResultModal() {
            const modal = document.getElementById('saveProgressModal');
            const modalInstance = bootstrap.Modal.getInstance(modal);
            if (modal && modalInstance) {
                modalInstance.hide();
                setTimeout(() => {
                    modal.remove();
                }, 300);
            }
        }

        // 提交表单（AJAX）
        function submitForm(formId, btnId) {
            const form = document.getElementById(formId);
            const btn = document.getElementById(btnId);
            
            // 收集表单数据
            const formData = new FormData(form);
            const data = {};
            formData.forEach((value, key) => {
                if (data[key]) {
                    if (Array.isArray(data[key])) {
                        data[key].push(value);
                    } else {
                        data[key] = [data[key], value];
                    }
                } else {
                    data[key] = value;
                }
            });
            
            // 获取选中的用户ID
            if (formId === 'listViewForm') {
                const checkboxes = form.querySelectorAll('.user-checkbox:checked');
                const userIds = Array.from(checkboxes).map(cb => cb.value);
                data.user_ids = userIds;
            } else if (formId === 'seatViewForm') {
                data.user_ids = selectedUserIds;
            }
            
            // 验证
            if (!data.user_ids || data.user_ids.length === 0) {
                showToast('请选择至少一个学生', 'error');
                return;
            }
            
            if (!data.score || data.score === '') {
                showToast('请输入分数变化', 'error');
                return;
            }
            
            // 显示提交动画
            showSubmitModal();
            
            // 禁用按钮
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 提交中...';
            
            // 发送 AJAX 请求
            fetch(window.location.href, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams(data)
            })
            .then(response => {
                // 检查是否重定向到 admin.php（成功）
                if (response.redirected && response.url.includes('admin.php')) {
                    return { success: true, message: '积分调整成功' };
                }
                return response.text().then(text => {
                    // 检查是否包含错误信息
                    if (text.includes('alert alert-danger')) {
                        const match = text.match(/alert alert-danger.*?>(.*?)</);
                        return { success: false, message: match ? match[1] : '操作失败' };
                    }
                    return { success: true, message: '积分调整成功' };
                });
            })
            .then(result => {
                setTimeout(() => {
                    if (result.success) {
                        showSubmitSuccess(result.message);
                    } else {
                        showSubmitError(result.message);
                    }
                    
                    // 重新启用按钮
                    btn.disabled = false;
                    btn.innerHTML = '提交';
                    
                    // 清空表单
                    form.reset();
                    if (formId === 'listViewForm') {
                        updateSelectedCount();
                    } else if (formId === 'seatViewForm') {
                        selectedUserIds = [];
                        updateSelectedUsersDisplay();
                    }
                }, 1500);
            })
            .catch(error => {
                setTimeout(() => {
                    showSubmitError('提交失败，请重试');
                    btn.disabled = false;
                    btn.innerHTML = '提交';
                }, 1500);
            });
        }

        // 显示提交模态框
        function showSubmitModal() {
            const modalHtml = `
                <div class="modal fade" id="submitModal" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
                    <div class="modal-dialog modal-sm modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-body text-center py-4">
                                <div id="submitLoading" class="mb-3">
                                    <div class="spinner-border" role="status" style="width: 3rem; height: 3rem;">
                                        <span class="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                                <div id="submitSuccess" class="mb-3" style="display: none;">
                                    <div class="checkmark-circle success">
                                        <div class="checkmark"></div>
                                    </div>
                                </div>
                                <div id="submitError" class="mb-3" style="display: none;">
                                    <div class="crossmark-circle error">
                                        <div class="crossmark"></div>
                                    </div>
                                </div>
                                <h5 id="submitStatus" class="mb-2">正在提交</h5>
                                <p id="submitMessage" class="text-muted mb-3">请稍候...</p>
                                <button type="button" class="btn btn-primary" id="submitCloseBtn" style="display: none;" onclick="closeSubmitModal()">确定</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            const modal = new bootstrap.Modal(document.getElementById('submitModal'));
            modal.show();
        }

        // 显示提交成功
        function showSubmitSuccess(message) {
            document.getElementById('submitLoading').style.display = 'none';
            document.getElementById('submitSuccess').style.display = 'block';
            document.getElementById('submitError').style.display = 'none';
            document.getElementById('submitStatus').textContent = '提交成功';
            document.getElementById('submitMessage').textContent = message;
            document.getElementById('submitCloseBtn').style.display = 'inline-block';
            
            // 2秒后自动关闭
            setTimeout(() => {
                closeSubmitModal();
            }, 2000);
        }

        // 显示提交错误
        function showSubmitError(message) {
            document.getElementById('submitLoading').style.display = 'none';
            document.getElementById('submitSuccess').style.display = 'none';
            document.getElementById('submitError').style.display = 'block';
            document.getElementById('submitStatus').textContent = '提交失败';
            document.getElementById('submitMessage').textContent = message;
            document.getElementById('submitCloseBtn').style.display = 'inline-block';
        }

        // 关闭提交模态框
        function closeSubmitModal() {
            const modal = document.getElementById('submitModal');
            const modalInstance = bootstrap.Modal.getInstance(modal);
            if (modal && modalInstance) {
                modalInstance.hide();
                setTimeout(() => {
                    modal.remove();
                }, 300);
            }
        }

        // Toast 提示函数
        function showToast(message, type = 'info') {
            const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
            const toastClass = type === 'success' ? 'bg-success' : type === 'error' ? 'bg-danger' : 'bg-info';
            const toastBodyClass = isDarkMode ? 'bg-dark text-white' : '';
            const toastHtml = `
            <div class="position-fixed bottom-0 end-0 p-3" style="z-index: 9999">
                <div class="toast show" role="alert" aria-live="assertive" aria-atomic="true">
                    <div class="toast-header ${toastClass} text-white">
                        <strong class="me-auto">系统提示</strong>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
                    </div>
                    <div class="toast-body ${toastBodyClass}">
                        ${message}
                    </div>
                </div>
            </div>
            `;
            
            $('.toast').parent().remove();
            $('body').append(toastHtml);
            
            setTimeout(() => {
                $('.toast').toast('hide');
            }, 5000);
        }
        
        
    </script>
                    
                    <button type="button" class="btn btn-primary" id="submitListBtn">提交</button>
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

                <form method="post" class="need-password" id="seatViewForm">
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
                            <button type="button" class="btn btn-sm btn-warning" onclick="toggleUserList()">
                                👥 编辑座位表
                            </button>
                            <button type="button" class="btn btn-sm btn-success" onclick="saveSeatLayout()">
                                💾 保存布局
                            </button>
                        </div>
                    </div>

                    <div class="d-flex gap-3">
                        <div id="seatContainer" class="seat-container mb-3 flex-grow-1">
                            <p class="text-muted">请先配置座位表参数</p>
                        </div>
                        
                        <!-- 用户列表面板 -->
                        <div id="userListPanel" class="user-list-panel" style="display: none;">
                            <div class="card">
                                <div class="card-header d-flex justify-content-between align-items-center">
                                    <h6 class="mb-0">用户名单</h6>
                                    <button type="button" class="btn-close btn-close-sm" onclick="toggleUserList()"></button>
                                </div>
                                <div class="card-body p-2">
                                    <div class="mb-2">
                                        <input type="text" class="form-control form-control-sm" id="userSearchInput" placeholder="搜索用户...">
                                    </div>
                                    <div id="userList" class="user-list">
                                        <!-- 用户列表将通过JavaScript动态生成 -->
                                    </div>
                                </div>
                            </div>
                        </div>
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
                    
                    <button type="button" class="btn btn-primary" id="submitSeatBtn">提交</button>
                </form>
            </div>
        </div>
    </div>

    <!-- 提交动画模态框 -->
    <div class="modal fade" id="submitModal" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
        <div class="modal-dialog modal-sm modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-body text-center py-4">
                    <div id="submitLoading" class="mb-3">
                        <div class="spinner-border" role="status" style="width: 3rem; height: 3rem;">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                    </div>
                    <div id="submitSuccess" class="mb-3" style="display: none;">
                        <div class="checkmark-circle success">
                            <div class="checkmark"></div>
                        </div>
                    </div>
                    <div id="submitError" class="mb-3" style="display: none;">
                        <div class="crossmark-circle error">
                            <div class="crossmark"></div>
                        </div>
                    </div>
                    <h5 id="submitStatus" class="mb-2">正在提交</h5>
                    <p id="submitMessage" class="text-muted mb-3">请稍候...</p>
                    <button type="button" class="btn btn-primary" id="submitCloseBtn" style="display: none;" onclick="closeSubmitModal()">确定</button>
                </div>
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
                    <button type="button" class="btn btn-primary" onclick="generateSeatLayout()">生成空表格</button>
                </div>
            </div>
        </div>
    </div>

    <?php showFooter(); ?>
    <script src="https://cdn.bootcdn.net/ajax/libs/bootstrap/5.2.3/js/bootstrap.bundle.min.js"></script>
    <script src="../assets/js/background_image.js"></script>
</body>
</html>