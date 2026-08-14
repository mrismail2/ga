<?php
require_once __DIR__ . '/../includes/helpers.php';
setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

switch ($method) {
    case 'GET':
        requirePage('officers');
        if (!empty($_GET['search'])) {
            $results = searchTable('officers', ['full_name', 'badge_id', 'email', 'department'], $_GET['search']);
            jsonResponse(['success' => true, 'data' => $results]);
        }
        $conditions = [];
        if (!empty($_GET['status']))     $conditions['status'] = $_GET['status'];
        if (!empty($_GET['department'])) $conditions['department'] = $_GET['department'];
        $result = paginate('officers', $conditions);
        jsonResponse(['success' => true] + $result);
        break;

    case 'POST':
        $auth  = requireCapability('officers.manage');
        $input = getInput();
        $stmt  = $db->prepare('INSERT INTO officers (full_name, email, phone, badge_id, `rank`, department, station_id, shift, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $input['full_name'] ?? '',
            $input['email'] ?? null,
            $input['phone'] ?? null,
            $input['badge_id'] ?? '',
            $input['rank'] ?? 'Officer',
            $input['department'] ?? null,
            1,
            $input['shift'] ?? 'A',
            'Active',
        ]);
        $id = $db->lastInsertId();
        auditLog($auth['user_id'], 'create', 'officers', $id, $input['full_name'] ?? '');
        jsonResponse(['success' => true, 'id' => $id], 201);
        break;

    case 'PUT':
        $auth  = requireCapability('officers.manage');
        $input = getInput();
        $id    = (int)($input['id'] ?? $_GET['id'] ?? 0);
        if (!$id) jsonError('ID waa lagama maarmaan.');
        $fields = [];
        $params = [];
        foreach (['full_name','email','phone','badge_id','rank','department','shift','status'] as $col) {
            if (isset($input[$col])) {
                $fields[] = "`$col` = ?";
                $params[] = $input[$col];
            }
        }
        if (empty($fields)) jsonError('Wax la beddelo ma jiraan.');
        $params[] = $id;
        $db->prepare("UPDATE officers SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);
        auditLog($auth['user_id'], 'update', 'officers', $id);
        jsonResponse(['success' => true]);
        break;

    case 'DELETE':
        $auth = requireCapability('officers.manage');
        $id   = (int)($_GET['id'] ?? 0);
        if (!$id) jsonError('ID waa lagama maarmaan.');
        $db->prepare('DELETE FROM officers WHERE id = ?')->execute([$id]);
        auditLog($auth['user_id'], 'delete', 'officers', $id);
        jsonResponse(['success' => true]);
        break;

    default:
        jsonError('Method-ka la isticmaalay lama aqbalo.', 405);
}
