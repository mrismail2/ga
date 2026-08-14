<?php
require_once __DIR__ . '/../includes/helpers.php';
setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

switch ($method) {
    case 'GET':
        requirePage('operations');
        if (!empty($_GET['search'])) {
            $results = searchTable('operations', ['name', 'commander_name', 'location'], $_GET['search']);
            jsonResponse(['success' => true, 'data' => $results]);
        }
        $conditions = [];
        if (!empty($_GET['status']))     $conditions['status'] = $_GET['status'];
        if (!empty($_GET['risk_level'])) $conditions['risk_level'] = $_GET['risk_level'];
        $result = paginate('operations', $conditions);
        jsonResponse(['success' => true] + $result);
        break;

    case 'POST':
        $auth  = requireCapability('operations.manage');
        $input = getInput();
        $stmt  = $db->prepare('INSERT INTO operations (name, commander_name, location, personnel_count, start_date, end_date, risk_level, status, objective) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $input['name'] ?? '',
            $input['commander_name'] ?? null,
            $input['location'] ?? null,
            (int)($input['personnel_count'] ?? 0),
            $input['start_date'] ?? date('Y-m-d'),
            $input['end_date'] ?? null,
            $input['risk_level'] ?? 'Dhexe',
            $input['status'] ?? 'Qorshaysan',
            $input['objective'] ?? null,
        ]);
        $id = $db->lastInsertId();
        auditLog($auth['user_id'], 'create', 'operations', $id, $input['name'] ?? '');
        jsonResponse(['success' => true, 'id' => $id], 201);
        break;

    case 'PUT':
        $auth  = requireCapability('operations.manage');
        $input = getInput();
        $id    = (int)($input['id'] ?? $_GET['id'] ?? 0);
        if (!$id) jsonError('ID waa lagama maarmaan.');
        $fields = [];
        $params = [];
        foreach (['name','commander_name','location','personnel_count','start_date','end_date','risk_level','status','objective'] as $col) {
            if (isset($input[$col])) {
                $fields[] = "`$col` = ?";
                $params[] = $input[$col];
            }
        }
        if (empty($fields)) jsonError('Wax la beddelo ma jiraan.');
        $params[] = $id;
        $db->prepare("UPDATE operations SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);
        auditLog($auth['user_id'], 'update', 'operations', $id);
        jsonResponse(['success' => true]);
        break;

    case 'DELETE':
        $auth = requireCapability('operations.manage');
        $id   = (int)($_GET['id'] ?? 0);
        if (!$id) jsonError('ID waa lagama maarmaan.');
        $db->prepare('DELETE FROM operations WHERE id = ?')->execute([$id]);
        auditLog($auth['user_id'], 'delete', 'operations', $id);
        jsonResponse(['success' => true]);
        break;

    default:
        jsonError('Method-ka la isticmaalay lama aqbalo.', 405);
}
