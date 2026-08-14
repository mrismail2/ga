<?php
require_once __DIR__ . '/../includes/helpers.php';
setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

switch ($method) {
    case 'GET':
        requirePage('patrol');
        $conditions = [];
        if (!empty($_GET['status'])) $conditions['status'] = $_GET['status'];
        if (!empty($_GET['zone']))   $conditions['zone'] = $_GET['zone'];
        $result = paginate('patrol_units', $conditions, 'unit_code ASC');
        jsonResponse(['success' => true] + $result);
        break;

    case 'POST':
        $auth  = requireCapability('operations.manage');
        $input = getInput();
        requireFields($input, ['unit_code','name']);
        $stmt  = $db->prepare('INSERT INTO patrol_units (unit_code, name, personnel, zone, status, shift) VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $input['unit_code'] ?? '',
            $input['name'] ?? '',
            $input['personnel'] ?? null,
            $input['zone'] ?? null,
            $input['status'] ?? 'Standby',
            $input['shift'] ?? 'A',
        ]);
        $id = $db->lastInsertId();
        auditLog($auth['user_id'], 'create', 'patrol_units', $id, $input['name'] ?? '');
        jsonResponse(['success' => true, 'id' => $id], 201);
        break;

    case 'PUT':
        $auth  = requireCapability('operations.manage');
        $input = getInput();
        $id    = (int)($input['id'] ?? $_GET['id'] ?? 0);
        if (!$id) jsonError('ID waa lagama maarmaan.');
        $fields = [];
        $params = [];
        foreach (['unit_code','name','personnel','zone','status','shift'] as $col) {
            if (isset($input[$col])) {
                $fields[] = "`$col` = ?";
                $params[] = $input[$col];
            }
        }
        if (empty($fields)) jsonError('Wax la beddelo ma jiraan.');
        $params[] = $id;
        $db->prepare("UPDATE patrol_units SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);
        auditLog($auth['user_id'], 'update', 'patrol_units', $id);
        jsonResponse(['success' => true]);
        break;

    default:
        jsonError('Method-ka la isticmaalay lama aqbalo.', 405);
}
