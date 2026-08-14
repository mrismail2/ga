<?php
require_once __DIR__ . '/../includes/helpers.php';
setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

switch ($method) {
    case 'GET':
        requirePage('traffic');
        if (!empty($_GET['search'])) {
            $results = searchTable('fleet', ['vehicle_name', 'plate_number', 'driver'], $_GET['search']);
            jsonResponse(['success' => true, 'data' => $results]);
        }
        $conditions = [];
        if (!empty($_GET['status'])) $conditions['status'] = $_GET['status'];
        if (!empty($_GET['type']))   $conditions['type'] = $_GET['type'];
        $result = paginate('fleet', $conditions, 'plate_number ASC');
        jsonResponse(['success' => true] + $result);
        break;

    case 'POST':
        $auth  = requireCapability('fleet.manage');
        $input = getInput();
        requireFields($input, ['vehicle_name','plate_number']);
        $stmt  = $db->prepare('INSERT INTO fleet (vehicle_name, plate_number, type, driver, fuel_level, next_service, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $input['vehicle_name'] ?? '',
            $input['plate_number'] ?? '',
            $input['type'] ?? 'Patrol',
            $input['driver'] ?? null,
            $input['fuel_level'] ?? null,
            $input['next_service'] ?? null,
            $input['status'] ?? 'Active',
        ]);
        $id = $db->lastInsertId();
        auditLog($auth['user_id'], 'create', 'fleet', $id, $input['vehicle_name'] ?? '');
        jsonResponse(['success' => true, 'id' => $id], 201);
        break;

    case 'PUT':
        $auth  = requireCapability('fleet.manage');
        $input = getInput();
        $id    = (int)($input['id'] ?? $_GET['id'] ?? 0);
        if (!$id) jsonError('ID waa lagama maarmaan.');
        $fields = [];
        $params = [];
        foreach (['vehicle_name','plate_number','type','driver','fuel_level','next_service','status'] as $col) {
            if (isset($input[$col])) {
                $fields[] = "`$col` = ?";
                $params[] = $input[$col];
            }
        }
        if (empty($fields)) jsonError('Wax la beddelo ma jiraan.');
        $params[] = $id;
        $db->prepare("UPDATE fleet SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);
        auditLog($auth['user_id'], 'update', 'fleet', $id);
        jsonResponse(['success' => true]);
        break;

    case 'DELETE':
        $auth = requireCapability('fleet.manage');
        $id   = (int)($_GET['id'] ?? 0);
        if (!$id) jsonError('ID waa lagama maarmaan.');
        $db->prepare('DELETE FROM fleet WHERE id = ?')->execute([$id]);
        auditLog($auth['user_id'], 'delete', 'fleet', $id);
        jsonResponse(['success' => true]);
        break;

    default:
        jsonError('Method-ka la isticmaalay lama aqbalo.', 405);
}
