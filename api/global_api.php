<?php
/**
 * 全局 API - 支持增删改查操作
 * 返回 JSON 格式数据
 * 
 * 免token访问的表（仅读取）: users, score_logs, seat_layout_config, seat_data
 * 需要token的操作（增删改）: users, score_logs, seat_layout_config, seat_data
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// 处理 OPTIONS 预检请求
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../includes/config.php';

/**
 * 验证管理员授权token
 * token必须由数字和英文大写字母组成，且必须在数据库中存在
 */
function verifyAdminToken() {
    global $pdo;
    
    // 从请求头或参数中获取token
    $token = $_SERVER['HTTP_AUTHORIZATION'] ?? $_GET['token'] ?? $_POST['token'] ?? null;
    
    if (empty($token)) {
        sendResponse(['error' => '缺少授权token'], 401);
    }
    
    // 验证token格式：只包含数字和英文大写字母
    if (!preg_match('/^[A-Z0-9]+$/', $token)) {
        sendResponse(['error' => '无效的token格式，token必须由数字和英文大写字母组成'], 401);
    }
    
    // 验证token是否在数据库中存在
    try {
        $stmt = $pdo->prepare("SELECT id, username FROM admins WHERE api_token = ?");
        $stmt->execute([$token]);
        $admin = $stmt->fetch();
        
        if (!$admin) {
            sendResponse(['error' => '无效的token，token不存在或已失效'], 401);
        }
        
        // 可以在这里添加更多验证逻辑，如检查token是否过期等
        
        return true;
    } catch (PDOException $e) {
        sendResponse(['error' => 'token验证失败：数据库错误'], 500);
    }
}

// 定义允许操作的表及其字段配置
// 免token访问的表（仅读取操作）
$free_access_tables = ['users', 'score_logs', 'seat_layout_config', 'seat_data'];

// 需要token访问的表（增删改操作）
$token_required_tables = ['users', 'score_logs', 'seat_layout_config', 'seat_data'];

// 完整的表配置
$allowed_tables = [
    'users' => [
        'fields' => ['id', 'username', 'created_at', 'group_index', 'row_index', 'col_index'],
        'readonly_fields' => ['id', 'created_at'],
        'searchable_fields' => ['username']
    ],
    'score_logs' => [
        'fields' => ['id', 'user_id', 'score_change', 'description', 'created_at'],
        'readonly_fields' => ['id', 'created_at'],
        'searchable_fields' => ['description']
    ],
    'seat_layout_config' => [
        'fields' => ['id', 'group_count', 'rows_per_group', 'cols_per_group', 'has_aisle', 'created_at', 'updated_at'],
        'readonly_fields' => ['id', 'created_at', 'updated_at'],
        'searchable_fields' => []
    ],
    'seat_data' => [
        'fields' => ['id', 'group_index', 'row_index', 'col_index', 'user_id', 'is_aisle', 'created_at', 'updated_at'],
        'readonly_fields' => ['id', 'created_at', 'updated_at'],
        'searchable_fields' => []
    ]
];

/**
 * 验证表访问权限
 */
function validateTableAccess($table, $action) {
    global $allowed_tables, $free_access_tables, $token_required_tables;
    
    // 检查表是否在允许的列表中
    if (!isset($allowed_tables[$table])) {
        sendResponse([
            'error' => '不允许访问该表',
            'message' => '此API仅允许访问指定表，其他表请使用专门的API',
            'allowed_tables' => array_keys($allowed_tables)
        ], 403);
    }
    
    // 检查操作是否需要token
    if ($action !== 'read' && in_array($table, $token_required_tables)) {
        verifyAdminToken();
    }
    
    return true;
}

/**
 * 统一响应函数
 */
function sendResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * 获取请求方法和路径
 */
$method = $_SERVER['REQUEST_METHOD'];

// 直接从 GET 参数获取表名和 ID
// 格式: /api/global_api.php?users&id=1
$table = null;
$id = null;

// 先检查是否有明确的 id 参数
if (isset($_GET['id'])) {
    $id = $_GET['id'];
}

// 查找表名参数（第一个不是 action、data、id、where 等保留字的参数）
$excluded_params = ['action', 'data', 'where', 'search', 'limit', 'offset', 'order_by', 'order', 'id', 'path'];
foreach ($_GET as $key => $value) {
    if (!in_array($key, $excluded_params)) {
        $table = $key;
        break;
    }
}

// 如果没有找到表名，从 path 参数获取（兼容旧格式）
if ($table === null) {
    $path = $_GET['path'] ?? $_SERVER['PATH_INFO'] ?? '';
    $path_parts = explode('/', trim($path, '/'));
    $table = $path_parts[0] ?? '';
    $id = $path_parts[1] ?? null;
}

// 获取操作类型（通过 action 参数）
$action = $_GET['action'] ?? 'read';

// 特殊操作：add_score 和 validate_token 不需要验证表名
if ($action !== 'add_score' && $action !== 'validate_token') {
    // 验证表访问权限
    validateTableAccess($table, $action);
    $table_config = $allowed_tables[$table];
}

/**
 * 获取请求数据 - 从 GET 参数的 data 字段获取 JSON 数据
 */
function getRequestData() {
    if (!empty($_GET['data'])) {
        return json_decode($_GET['data'], true) ?? [];
    }
    return [];
}

/**
 * 验证字段
 */
function validateFields($data, $table_config, $forCreate = true) {
    $allowedFields = $table_config['fields'];
    $readonlyFields = $table_config['readonly_fields'];
    
    $filtered = [];
    foreach ($data as $key => $value) {
        if (!in_array($key, $allowedFields)) {
            continue;
        }
        if ($forCreate && in_array($key, $readonlyFields)) {
            continue;
        }
        $filtered[$key] = $value;
    }
    
    return $filtered;
}

/**
 * GET 请求 - 根据 action 参数分发操作
 */
if ($method === 'GET') {
    // 根据 action 参数分发到不同的处理块
    if ($action === 'create') {
        // 创建记录
        try {
            $data = getRequestData();

            if (empty($data)) {
                sendResponse(['error' => '请求数据为空'], 400);
            }

            $filteredData = validateFields($data, $table_config, true);

            if (empty($filteredData)) {
                sendResponse(['error' => '没有有效的字段数据'], 400);
            }

            $fields = array_keys($filteredData);
            $placeholders = array_fill(0, count($fields), '?');

            $query = "INSERT INTO {$table} (" . implode(', ', $fields) . ") VALUES (" . implode(', ', $placeholders) . ")";

            $stmt = $pdo->prepare($query);
            $result = $stmt->execute(array_values($filteredData));

            if ($result) {
                $newId = $pdo->lastInsertId();

                // 获取新创建的记录
                $stmt = $pdo->prepare("SELECT * FROM {$table} WHERE id = ?");
                $stmt->execute([$newId]);
                $newRecord = $stmt->fetch(PDO::FETCH_ASSOC);

                sendResponse([
                    'success' => true,
                    'message' => '创建成功',
                    'data' => $newRecord
                ], 201);
            } else {
                sendResponse(['error' => '创建失败'], 500);
            }
        } catch (PDOException $e) {
            // 检查是否是重复键错误
            if ($e->getCode() == '23000') {
                sendResponse(['error' => '用户已存在'], 409);
            }
            sendResponse(['error' => '数据库错误: ' . $e->getMessage()], 500);
        }
    }
    elseif ($action === 'update') {
        // 更新记录
        if ($id === null) {
            sendResponse(['error' => '缺少记录 ID'], 400);
        }

        try {
            $data = getRequestData();

            if (empty($data)) {
                sendResponse(['error' => '请求数据为空'], 400);
            }

            $filteredData = validateFields($data, $table_config, false);

            if (empty($filteredData)) {
                sendResponse(['error' => '没有有效的字段数据'], 400);
            }

            $setClause = [];
            foreach (array_keys($filteredData) as $field) {
                $setClause[] = "{$field} = ?";
            }

            $query = "UPDATE {$table} SET " . implode(', ', $setClause) . " WHERE id = ?";
            $params = array_merge(array_values($filteredData), [$id]);

            $stmt = $pdo->prepare($query);
            $result = $stmt->execute($params);

            if ($result) {
                if ($stmt->rowCount() === 0) {
                    sendResponse(['error' => '记录不存在或未更新'], 404);
                }

                // 获取更新后的记录
                $stmt = $pdo->prepare("SELECT * FROM {$table} WHERE id = ?");
                $stmt->execute([$id]);
                $updatedRecord = $stmt->fetch(PDO::FETCH_ASSOC);

                sendResponse([
                    'success' => true,
                    'message' => '更新成功',
                    'data' => $updatedRecord
                ]);
            } else {
                sendResponse(['error' => '更新失败'], 500);
            }
        } catch (PDOException $e) {
            sendResponse(['error' => '数据库错误: ' . $e->getMessage()], 500);
        }
    }
    elseif ($action === 'delete') {
        // 删除记录
        try {
            $conditions = [];
            $params = [];

            // 检查是否使用 where 参数
            if (!empty($_GET['where'])) {
                $whereData = json_decode($_GET['where'], true);
                if (is_array($whereData)) {
                    foreach ($whereData as $field => $value) {
                        $allowedFields = $table_config['fields'];
                        if (in_array($field, $allowedFields)) {
                            $conditions[] = "{$field} = ?";
                            $params[] = $value;
                        }
                    }
                }
                if (empty($conditions)) {
                    sendResponse(['error' => '无效的 where 条件'], 400);
                }
            } elseif ($id !== null) {
                // 使用 ID 删除
                $conditions[] = "id = ?";
                $params[] = $id;
            } else {
                sendResponse(['error' => '缺少记录 ID 或 where 条件'], 400);
            }

            // 先检查记录是否存在
            $checkQuery = "SELECT id FROM {$table} WHERE " . implode(' AND ', $conditions);
            $stmt = $pdo->prepare($checkQuery);
            $stmt->execute($params);

            $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
            if (empty($records)) {
                sendResponse(['error' => '记录不存在'], 404);
            }

            // 执行删除
            $query = "DELETE FROM {$table} WHERE " . implode(' AND ', $conditions);
            $deleteStmt = $pdo->prepare($query);
            $result = $deleteStmt->execute($params);

            if ($result) {
                $deletedIds = array_column($records, 'id');
                sendResponse([
                    'success' => true,
                    'message' => '删除成功',
                    'deleted_count' => count($deletedIds),
                    'deleted_ids' => $deletedIds
                ]);
            } else {
                sendResponse(['error' => '删除失败'], 500);
            }
        } catch (PDOException $e) {
            sendResponse(['error' => '数据库错误: ' . $e->getMessage()], 500);
        }
    }
    elseif ($action === 'validate_token') {
        // 验证 token 有效性
        try {
            // 验证 token
            if (!verifyAdminToken()) {
                // verifyAdminToken 已经会发送响应并退出
                exit;
            }
            
            // 获取管理员信息
            $token = $_SERVER['HTTP_AUTHORIZATION'] ?? $_GET['token'] ?? $_POST['token'] ?? null;
            $stmt = $pdo->prepare("SELECT id, username FROM admins WHERE api_token = ?");
            $stmt->execute([$token]);
            $admin = $stmt->fetch();
            
            if ($admin) {
                sendResponse([
                    'success' => true,
                    'message' => 'Token 验证成功',
                    'data' => [
                        'admin_id' => $admin['id'],
                        'username' => $admin['username']
                    ]
                ]);
            } else {
                sendResponse(['error' => '管理员不存在'], 401);
            }
        } catch (PDOException $e) {
            sendResponse(['error' => '数据库错误: ' . $e->getMessage()], 500);
        }
    }
    elseif ($action === 'add_score') {
        // 批量加/减分
        try {
            $data = getRequestData();

            if (empty($data)) {
                sendResponse(['error' => '请求数据为空'], 400);
            }

            // 支持两种格式：
            // 1. 单个用户: {"username":"张三","score_change":10,"description":"表现优秀"}
            // 2. 批量用户: {"users":[{"username":"张三","score_change":10},{"username":"李四","score_change":5}],"description":"表现优秀"}

            if (isset($data['users']) && is_array($data['users'])) {
                // 批量操作
                $username = null;
                $users = $data['users'];
                $description = $data['description'] ?? '';
            } else {
                // 单个用户操作，转换为批量格式
                $username = $data['username'] ?? null;
                $users = [['username' => $username, 'score_change' => $data['score_change'] ?? 0]];
                $description = $data['description'] ?? '';
            }

            if (empty($users)) {
                sendResponse(['error' => '没有有效的用户数据'], 400);
            }

            $pdo->beginTransaction();

            $results = [];
            $successCount = 0;
            $failedCount = 0;

            foreach ($users as $user) {
                if (!isset($user['username']) || !isset($user['score_change'])) {
                    $failedCount++;
                    $results[] = [
                        'username' => $user['username'] ?? '未知',
                        'success' => false,
                        'error' => '缺少用户名或分数'
                    ];
                    continue;
                }

                // 查询用户ID
                $stmt = $pdo->prepare("SELECT id, username FROM users WHERE username = ?");
                $stmt->execute([$user['username']]);
                $userData = $stmt->fetch(PDO::FETCH_ASSOC);

                if (!$userData) {
                    $failedCount++;
                    $results[] = [
                        'username' => $user['username'],
                        'success' => false,
                        'error' => '用户不存在'
                    ];
                    continue;
                }

                // 插入积分记录
                $stmt = $pdo->prepare("INSERT INTO score_logs (user_id, score_change, description) VALUES (?, ?, ?)");
                $result = $stmt->execute([
                    $userData['id'],
                    $user['score_change'],
                    $description
                ]);

                if ($result) {
                    $successCount++;
                    $results[] = [
                        'username' => $userData['username'],
                        'user_id' => $userData['id'],
                        'score_change' => $user['score_change'],
                        'success' => true
                    ];
                } else {
                    $failedCount++;
                    $results[] = [
                        'username' => $userData['username'],
                        'success' => false,
                        'error' => '积分记录创建失败'
                    ];
                }
            }

            $pdo->commit();

            sendResponse([
                'success' => true,
                'message' => "操作完成：成功 {$successCount} 条，失败 {$failedCount} 条",
                'summary' => [
                    'success_count' => $successCount,
                    'failed_count' => $failedCount,
                    'total_count' => count($users)
                ],
                'details' => $results
            ]);

        } catch (PDOException $e) {
            if (isset($pdo) && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            sendResponse(['error' => '数据库错误: ' . $e->getMessage()], 500);
        }
    }
    else {
        // 默认查询操作 (action=read)
        try {
            // 特殊处理 users 表，返回完整信息
            if ($table === 'users') {
                $query = "
                    SELECT
                        u.id,
                        u.username,
                        u.created_at,
                        COALESCE(SUM(sl.score_change), 0) AS total_score,
                        COALESCE(SUM(CASE WHEN sl.score_change > 0 THEN sl.score_change ELSE 0 END), 0) AS add_score,
                        COALESCE(SUM(CASE WHEN sl.score_change < 0 THEN sl.score_change ELSE 0 END), 0) AS deduct_score,
                        COUNT(sl.id) AS score_count,
                        sd.group_index,
                        sd.row_index,
                        sd.col_index
                    FROM users u
                    LEFT JOIN score_logs sl ON u.id = sl.user_id
                    LEFT JOIN seat_data sd ON u.id = sd.user_id
                ";
                $params = [];
            } else {
                $query = "SELECT * FROM {$table}";
                $params = [];
            }
            
            // 如果有 ID，查询单条记录
            if ($id !== null) {
                if ($table === 'users') {
                    $query .= " WHERE u.id = ? GROUP BY u.id, sd.group_index, sd.row_index, sd.col_index";
                } else {
                    $query .= " WHERE id = ?";
                }
                $params = [$id];
            } else {
                // 列表查询逻辑
                // 支持查询参数
                $conditions = [];
                $orderBy = 'id';
                $order = 'ASC';
                $limit = 100;
                $offset = 0;

                // WHERE 条件和 HAVING 条件
                $conditions = [];
                $havingConditions = [];

                if (!empty($_GET['where'])) {
                    $whereData = json_decode($_GET['where'], true);
                    if (is_array($whereData)) {
                        foreach ($whereData as $field => $value) {
                            $allowedFields = $table_config['fields'];
                            // users 表额外允许使用聚合字段作为筛选条件
                            if ($table === 'users') {
                                $allowedFields = array_merge($allowedFields, ['total_score', 'add_score', 'deduct_score', 'score_count']);
                            }
                            if (in_array($field, $allowedFields)) {
                                // 聚合字段需要使用 HAVING 子句
                                if (in_array($field, ['total_score', 'add_score', 'deduct_score', 'score_count'])) {
                                    // 支持操作符解析
                                    $operator = '=';
                                    $actualValue = $value;
                                    if (is_string($value)) {
                                        if (preg_match('/^(>=|<=|>|<|!=|=)/', $value, $matches)) {
                                            $operator = $matches[1];
                                            $actualValue = substr($value, strlen($operator));
                                        }
                                    }
                                    $havingConditions[] = "{$field} {$operator} ?";
                                    $params[] = $actualValue;
                                } else {
                                    // 普通字段使用 WHERE 子句
                                    $prefix = ($table === 'users') ? 'u.' : '';
                                    $conditions[] = "{$prefix}{$field} = ?";
                                    $params[] = $value;
                                }
                            }
                        }
                    }
                }

                // 搜索功能
                if (!empty($_GET['search']) && !empty($table_config['searchable_fields'])) {
                    $searchTerm = '%' . $_GET['search'] . '%';
                    $searchConditions = [];
                    foreach ($table_config['searchable_fields'] as $field) {
                        $prefix = ($table === 'users') ? 'u.' : '';
                        $searchConditions[] = "{$prefix}{$field} LIKE ?";
                        $params[] = $searchTerm;
                    }
                    if (!empty($searchConditions)) {
                        $conditions[] = '(' . implode(' OR ', $searchConditions) . ')';
                    }
                }

                // 构建完整查询
                if (!empty($conditions)) {
                    $query .= ' WHERE ' . implode(' AND ', $conditions);
                }

                // 添加 GROUP BY（必须在 WHERE 之后）
                // 注意: 所有非聚合列都需要在 GROUP BY 中（sql_mode=only_full_group_by）
                if ($table === 'users') {
                    $query .= " GROUP BY u.id, sd.group_index, sd.row_index, sd.col_index";
                }

                // 添加 HAVING 子句（用于过滤聚合字段，必须在 GROUP BY 之后）
                if (!empty($havingConditions)) {
                    $query .= ' HAVING ' . implode(' AND ', $havingConditions);
                }

                // 排序
                $orderByDirection = 'ASC';
                if (!empty($_GET['order']) && in_array(strtoupper($_GET['order']), ['ASC', 'DESC'])) {
                    $orderByDirection = strtoupper($_GET['order']);
                }

                if (!empty($_GET['order_by'])) {
                    $orderByField = $_GET['order_by'];
                    $allowedOrderFields = $table_config['fields'];
                    // users 表额外允许按积分字段排序
                    if ($table === 'users') {
                        $allowedOrderFields = array_merge($allowedOrderFields, ['total_score', 'add_score', 'deduct_score', 'score_count', 'group_index', 'row_index', 'col_index']);
                    }
                    if (in_array($orderByField, $allowedOrderFields)) {
                        $prefix = ($table === 'users' && in_array($orderByField, ['total_score', 'add_score', 'deduct_score', 'score_count'])) ? '' : 'u.';
                        if (in_array($orderByField, ['group_index', 'row_index', 'col_index'])) {
                            $prefix = 'sd.';
                        }
                        $orderBy = $prefix . $orderByField;
                    }
                }

                if ($table === 'users' && $orderBy === 'id') {
                    // users 表默认按总积分降序排序，然后按 ID 排序
                    $orderBy = 'total_score DESC, u.id ' . $orderByDirection;
                } else {
                    $orderBy .= ' ' . $orderByDirection;
                }
                $query .= " ORDER BY {$orderBy}";

                // 分页
                if (!empty($_GET['limit'])) {
                    $limit = max(1, min(1000, intval($_GET['limit'])));
                }
                if (!empty($_GET['offset'])) {
                    $offset = max(0, intval($_GET['offset']));
                }
                $query .= " LIMIT {$limit} OFFSET {$offset}";
            }
            
            $stmt = $pdo->prepare($query);
            $stmt->execute($params);
            $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            if ($id !== null) {
                if (empty($results)) {
                    sendResponse(['error' => '记录不存在'], 404);
                }
                sendResponse(['data' => $results[0]]);
            } else {
                // 获取总数
                if ($table === 'users') {
                    // 如果有 HAVING 条件，需要使用子查询来正确统计
                    if (!empty($havingConditions)) {
                        $countQuery = "
                            SELECT COUNT(*) FROM (
                                SELECT
                                    u.id,
                                    COALESCE(SUM(sl.score_change), 0) AS total_score,
                                    COALESCE(SUM(CASE WHEN sl.score_change > 0 THEN sl.score_change ELSE 0 END), 0) AS add_score,
                                    COALESCE(SUM(CASE WHEN sl.score_change < 0 THEN sl.score_change ELSE 0 END), 0) AS deduct_score,
                                    COUNT(sl.id) AS score_count
                                FROM users u
                                LEFT JOIN score_logs sl ON u.id = sl.user_id
                                LEFT JOIN seat_data sd ON u.id = sd.user_id
                        ";
                        if (!empty($conditions)) {
                            $countQuery .= ' WHERE ' . implode(' AND ', $conditions);
                        }
                        $countQuery .= " GROUP BY u.id, sd.group_index, sd.row_index, sd.col_index";
                        $countQuery .= ' HAVING ' . implode(' AND ', $havingConditions);
                        $countQuery .= ") AS subquery";
                        $countStmt = $pdo->prepare($countQuery);
                        $countStmt->execute($params);
                    } else {
                        // 没有 HAVING 条件，直接统计
                        $countQuery = "SELECT COUNT(*) FROM users u";
                        if (!empty($conditions)) {
                            $countQuery .= ' WHERE ' . implode(' AND ', $conditions);
                        }
                        $countStmt = $pdo->prepare($countQuery);
                        $countStmt->execute(array_slice($params, 0, count($conditions)));
                    }
                } else {
                    $countQuery = "SELECT COUNT(*) FROM {$table}";
                    if (!empty($conditions)) {
                        $countQuery .= ' WHERE ' . implode(' AND ', $conditions);
                    }
                    $countStmt = $pdo->prepare($countQuery);
                    $countStmt->execute(array_slice($params, 0, count($conditions)));
                }
                $total = $countStmt->fetchColumn();
                
                sendResponse([
                    'data' => $results,
                    'total' => count($results),
                    'limit' => $limit,
                    'offset' => $offset
                ]);
            }
        } catch (PDOException $e) {
            sendResponse(['error' => '数据库错误: ' . $e->getMessage()], 500);
        }
    }
} else {
    sendResponse(['error' => '不支持的操作类型，请使用: read/create/update/delete'], 400);
}