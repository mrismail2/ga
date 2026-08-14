<?php
require_once __DIR__ . '/../includes/helpers.php';
setCorsHeaders();
$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $auth = requirePage('tasks');
    $where = [];
    $params = [];
    if (!authHasCapability($auth, 'tasks.manage')) {
        $where[] = '(wt.assigned_to = ? OR wt.assigned_role = ?)';
        $params[] = $auth['user_id'];
        $params[] = $auth['role'];
    }
    if (!empty($_GET['status'])) {
        $where[] = 'wt.status = ?';
        $params[] = $_GET['status'];
    }
    $sql = 'SELECT wt.*, u.full_name AS assignee_name, c.full_name AS creator_name
            FROM workflow_tasks wt
            LEFT JOIN users u ON wt.assigned_to = u.id
            LEFT JOIN users c ON wt.created_by = c.id';
    if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
    $sql .= " ORDER BY
              CASE WHEN wt.due_at < NOW() AND wt.status NOT IN ('Completed','Cancelled') THEN 0 ELSE 1 END,
              FIELD(wt.status,'Overdue','Open','In Progress','Completed','Cancelled'),
              FIELD(wt.priority,'Critical','High','Medium','Low'), wt.due_at
              LIMIT 100";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    $auth = requireCapability('tasks.manage');
    $input = getInput();
    requireFields($input, ['title']);
    $priority = in_array($input['priority'] ?? 'Medium', ['Low','Medium','High','Critical'], true)
        ? $input['priority'] : 'Medium';
    $number = uniqueReference('TSK', 'workflow_tasks', 'task_number');
    $stmt = $db->prepare('INSERT INTO workflow_tasks
        (task_number,title,description,entity_type,entity_id,assigned_to,assigned_role,priority,due_at,status,created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)');
    $stmt->execute([
        $number,
        trim($input['title']),
        $input['description'] ?? null,
        $input['entity_type'] ?? null,
        !empty($input['entity_id']) ? (int)$input['entity_id'] : null,
        !empty($input['assigned_to']) ? (int)$input['assigned_to'] : null,
        $input['assigned_role'] ?? null,
        $priority,
        normalizeDateTimeValue($input['due_at'] ?? null),
        'Open',
        $auth['user_id'],
    ]);
    $id = (int)$db->lastInsertId();
    auditLog($auth['user_id'], 'create', 'workflow_tasks', $id, $number);
    jsonResponse(['success' => true, 'id' => $id, 'task_number' => $number], 201);
}

if ($method === 'PUT') {
    $auth = requirePage('tasks');
    $input = getInput();
    $id = (int)($input['id'] ?? 0);
    if (!$id) jsonError('ID waa lagama maarmaan.', 422);

    $stmt = $db->prepare('SELECT assigned_to, assigned_role FROM workflow_tasks WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) jsonError('Task lama helin.', 404);
    $ownsTask = (int)$row['assigned_to'] === $auth['user_id'] || $row['assigned_role'] === $auth['role'];
    if (!authHasCapability($auth, 'tasks.manage') && (!authHasCapability($auth, 'tasks.update') || !$ownsTask)) jsonError('Awood uma lihid.', 403);

    $allowed = authHasCapability($auth, 'tasks.manage')
        ? ['title','description','assigned_to','assigned_role','priority','due_at','status']
        : ['status'];
    $fields = [];
    $params = [];
    foreach ($allowed as $column) {
        if (!array_key_exists($column, $input)) continue;
        $fields[] = "`$column` = ?";
        $params[] = $column === 'due_at' ? normalizeDateTimeValue($input[$column]) : $input[$column];
    }
    if (($input['status'] ?? '') === 'Completed') $fields[] = 'completed_at = NOW()';
    if (!$fields) jsonError('Wax la beddelo ma jiraan.', 422);
    $params[] = $id;
    $db->prepare('UPDATE workflow_tasks SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
    auditLog($auth['user_id'], 'update', 'workflow_tasks', $id, $input['status'] ?? null);
    jsonResponse(['success' => true]);
}

jsonError('Method-ka lama aqbalo.', 405);
