<?php
require_once __DIR__ . '/../includes/helpers.php';
setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

switch ($method) {
    case 'GET':
        requirePage('evidence');
        if (!empty($_GET['search'])) {
            $results = searchTable('evidence', ['evidence_number', 'name', 'type'], $_GET['search']);
            jsonResponse(['success' => true, 'data' => $results]);
        }
        $conditions = [];
        if (!empty($_GET['status']))  $conditions['status'] = $_GET['status'];
        if (!empty($_GET['type']))    $conditions['type'] = $_GET['type'];
        if (!empty($_GET['case_id'])) $conditions['case_id'] = $_GET['case_id'];
        $result = paginate('evidence', $conditions);
        jsonResponse(['success' => true] + $result);
        break;

    case 'POST':
        $auth  = requireCapability('evidence.manage');
        $input = getInput();
        requireFields($input, ['name','location']);
        $number = uniqueReference('EV', 'evidence', 'evidence_number');
        $stmt  = $db->prepare('INSERT INTO evidence (evidence_number, name, type, case_id, location, chain_of_custody, status, collected_at, collected_by) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)');
        $stmt->execute([
            $number,
            $input['name'] ?? '',
            $input['type'] ?? 'Physical',
            $input['case_id'] ?? null,
            $input['location'] ?? null,
            $input['chain_of_custody'] ?? null,
            'Processing',
            $auth['officer_id'] ?? null,
        ]);
        $id = $db->lastInsertId();
        $movement = $db->prepare('INSERT INTO evidence_movements (evidence_id, movement_type, to_location, received_by, purpose, condition_note) VALUES (?, ?, ?, ?, ?, ?)');
        $movement->execute([$id, 'Collected', $input['location'] ?? null, $auth['user_id'], 'Initial evidence intake', $input['chain_of_custody'] ?? null]);
        auditLog($auth['user_id'], 'create', 'evidence', $id, $input['name'] ?? '');
        jsonResponse(['success' => true, 'id' => $id, 'evidence_number' => $number], 201);
        break;

    case 'PUT':
        $auth  = requireCapability('evidence.manage');
        $input = getInput();
        $id    = (int)($input['id'] ?? $_GET['id'] ?? 0);
        if (!$id) jsonError('ID waa lagama maarmaan.');
        $fields = [];
        $params = [];
        foreach (['name','type','case_id','location','chain_of_custody','status'] as $col) {
            if (isset($input[$col])) {
                $fields[] = "`$col` = ?";
                $params[] = $input[$col];
            }
        }
        if (empty($fields)) jsonError('Wax la beddelo ma jiraan.');
        $params[] = $id;
        $db->prepare("UPDATE evidence SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);
        auditLog($auth['user_id'], 'update', 'evidence', $id);
        jsonResponse(['success' => true]);
        break;

    default:
        jsonError('Method-ka la isticmaalay lama aqbalo.', 405);
}
