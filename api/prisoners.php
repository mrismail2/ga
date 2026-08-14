<?php
require_once __DIR__ . '/../includes/helpers.php';
setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

switch ($method) {
    case 'GET':
        requirePage('prison');
        if (!empty($_GET['search'])) {
            $results = searchTable('prisoners', ['full_name', 'prison_id', 'cell', 'crime'], $_GET['search']);
            jsonResponse(['success' => true, 'data' => $results]);
        }
        $conditions = [];
        if (!empty($_GET['status'])) $conditions['status'] = $_GET['status'];
        $result = paginate('prisoners', $conditions);
        jsonResponse(['success' => true] + $result);
        break;

    case 'POST':
        $auth  = requireCapability('custody.manage');
        $input = getInput();
        requireFields($input, ['full_name','cell','crime']);
        $prisonId = uniqueReference('PR', 'prisoners', 'prison_id');
        $stmt  = $db->prepare('INSERT INTO prisoners (full_name, prison_id, cell, crime, entry_date, release_date, case_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $input['full_name'] ?? '',
            $prisonId,
            $input['cell'] ?? null,
            $input['crime'] ?? null,
            $input['entry_date'] ?? date('Y-m-d'),
            $input['release_date'] ?? null,
            $input['case_id'] ?? null,
            'Detained',
        ]);
        $id = $db->lastInsertId();
        auditLog($auth['user_id'], 'create', 'prisoners', $id, $input['full_name'] ?? '');
        jsonResponse(['success' => true, 'id' => $id, 'prison_id' => $prisonId], 201);
        break;

    case 'PUT':
        $auth  = requireCapability('custody.manage');
        $input = getInput();
        $id    = (int)($input['id'] ?? $_GET['id'] ?? 0);
        if (!$id) jsonError('ID waa lagama maarmaan.');
        $fields = [];
        $params = [];
        foreach (['full_name','cell','crime','entry_date','release_date','case_id','status'] as $col) {
            if (isset($input[$col])) {
                $fields[] = "`$col` = ?";
                $params[] = $input[$col];
            }
        }
        if (empty($fields)) jsonError('Wax la beddelo ma jiraan.');
        $params[] = $id;
        $db->prepare("UPDATE prisoners SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);
        auditLog($auth['user_id'], 'update', 'prisoners', $id);
        jsonResponse(['success' => true]);
        break;

    default:
        jsonError('Method-ka la isticmaalay lama aqbalo.', 405);
}
