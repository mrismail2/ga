<?php
require_once __DIR__ . '/../includes/helpers.php';
setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

switch ($method) {
    case 'GET':
        requirePage('complaints');
        if (!empty($_GET['search'])) {
            $results = searchTable('complaints', ['complaint_number', 'type', 'complainant'], $_GET['search']);
            jsonResponse(['success' => true, 'data' => $results]);
        }
        $conditions = [];
        if (!empty($_GET['status']))   $conditions['status'] = $_GET['status'];
        if (!empty($_GET['priority'])) $conditions['priority'] = $_GET['priority'];
        $result = paginate('complaints', $conditions);
        jsonResponse(['success' => true] + $result);
        break;

    case 'POST':
        $auth  = requireCapability('complaints.manage');
        $input = getInput();
        requireFields($input, ['type','description']);
        $number = 'CMP-' . date('Y') . '-' . str_pad(random_int(100, 999), 3, '0', STR_PAD_LEFT);
        $stmt  = $db->prepare('INSERT INTO complaints (complaint_number, type, complainant, is_anonymous, assigned_to, filed_date, priority, status, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $number,
            $input['type'] ?? '',
            $input['complainant'] ?? null,
            (int)($input['is_anonymous'] ?? 0),
            $input['assigned_to'] ?? null,
            date('Y-m-d'),
            $input['priority'] ?? 'Dhexe',
            'Cusub',
            $input['description'] ?? null,
        ]);
        $id = $db->lastInsertId();
        auditLog($auth['user_id'], 'create', 'complaints', $id, $input['type'] ?? '');
        jsonResponse(['success' => true, 'id' => $id, 'complaint_number' => $number], 201);
        break;

    case 'PUT':
        $auth  = requireCapability('complaints.manage');
        $input = getInput();
        $id    = (int)($input['id'] ?? $_GET['id'] ?? 0);
        if (!$id) jsonError('ID waa lagama maarmaan.');
        $fields = [];
        $params = [];
        foreach (['type','complainant','is_anonymous','assigned_to','priority','status','description'] as $col) {
            if (isset($input[$col])) {
                $fields[] = "`$col` = ?";
                $params[] = $input[$col];
            }
        }
        if (empty($fields)) jsonError('Wax la beddelo ma jiraan.');
        $params[] = $id;
        $db->prepare("UPDATE complaints SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);
        auditLog($auth['user_id'], 'update', 'complaints', $id);
        jsonResponse(['success' => true]);
        break;

    default:
        jsonError('Method-ka la isticmaalay lama aqbalo.', 405);
}
