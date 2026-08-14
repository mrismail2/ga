<?php
require_once __DIR__ . '/../includes/helpers.php';
setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

switch ($method) {
    case 'GET':
        requireAnyPage(['dispatch','command']);
        if (!empty($_GET['search'])) {
            $results = searchTable('incidents', ['incident_number', 'type', 'location'], $_GET['search']);
            jsonResponse(['success' => true, 'data' => $results]);
        }
        $conditions = [];
        if (!empty($_GET['status']))   $conditions['status'] = $_GET['status'];
        if (!empty($_GET['priority'])) $conditions['priority'] = $_GET['priority'];
        $result = paginate('incidents', $conditions, 'reported_at DESC');
        jsonResponse(['success' => true] + $result);
        break;

    case 'POST':
        $auth  = requireCapability('dispatch.manage');
        $input = getInput();
        $number = uniqueReference('INC', 'incidents', 'incident_number');
        $stmt  = $db->prepare('INSERT INTO incidents (incident_number, type, description, priority, location, assigned_unit, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $number,
            $input['type'] ?? '',
            $input['description'] ?? null,
            $input['priority'] ?? 'P3',
            $input['location'] ?? '',
            $input['assigned_unit'] ?? null,
            'reported',
        ]);
        $id = $db->lastInsertId();
        auditLog($auth['user_id'], 'create', 'incidents', $id, $input['type'] ?? '');
        jsonResponse(['success' => true, 'id' => $id, 'incident_number' => $number], 201);
        break;

    case 'PUT':
        $auth  = requireCapability('dispatch.manage');
        $input = getInput();
        $id    = (int)($input['id'] ?? $_GET['id'] ?? 0);
        if (!$id) jsonError('ID waa lagama maarmaan.');
        $fields = [];
        $params = [];
        foreach (['type','description','priority','location','assigned_unit','status','case_id'] as $col) {
            if (isset($input[$col])) {
                $fields[] = "`$col` = ?";
                $params[] = $input[$col];
            }
        }
        if (!empty($input['status']) && in_array($input['status'], ['resolved','closed'])) {
            $fields[] = 'resolved_at = NOW()';
        }
        if (empty($fields)) jsonError('Wax la beddelo ma jiraan.');
        $params[] = $id;
        $db->prepare("UPDATE incidents SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);
        auditLog($auth['user_id'], 'update', 'incidents', $id);
        jsonResponse(['success' => true]);
        break;

    default:
        jsonError('Method-ka la isticmaalay lama aqbalo.', 405);
}
