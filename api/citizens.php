<?php
require_once __DIR__ . '/../includes/helpers.php';
setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

switch ($method) {
    case 'GET':
        requirePage('citizens');
        if (!empty($_GET['search'])) {
            $results = searchTable('citizens', ['full_name', 'national_id', 'district'], $_GET['search']);
            jsonResponse(['success' => true, 'data' => $results]);
        }
        $conditions = [];
        if (!empty($_GET['status']))      $conditions['status'] = $_GET['status'];
        if (!empty($_GET['district']))     $conditions['district'] = $_GET['district'];
        if (!empty($_GET['record_type'])) $conditions['record_type'] = $_GET['record_type'];
        $result = paginate('citizens', $conditions, 'full_name ASC');
        jsonResponse(['success' => true] + $result);
        break;

    case 'POST':
        $auth  = requireCapability('citizens.manage');
        $input = getInput();
        requireFields($input, ['full_name','national_id']);
        $stmt  = $db->prepare('INSERT INTO citizens (full_name, national_id, gender, date_of_birth, phone, district, record_type, case_link, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $input['full_name'] ?? '',
            $input['national_id'] ?? '',
            $input['gender'] ?? null,
            $input['date_of_birth'] ?? null,
            $input['phone'] ?? null,
            $input['district'] ?? null,
            $input['record_type'] ?? null,
            $input['case_link'] ?? null,
            'Clear',
        ]);
        $id = $db->lastInsertId();
        auditLog($auth['user_id'], 'create', 'citizens', $id, $input['full_name'] ?? '');
        jsonResponse(['success' => true, 'id' => $id], 201);
        break;

    case 'PUT':
        $auth  = requireCapability('citizens.manage');
        $input = getInput();
        $id    = (int)($input['id'] ?? $_GET['id'] ?? 0);
        if (!$id) jsonError('ID waa lagama maarmaan.');
        $fields = [];
        $params = [];
        foreach (['full_name','national_id','gender','date_of_birth','phone','district','record_type','case_link','status'] as $col) {
            if (isset($input[$col])) {
                $fields[] = "`$col` = ?";
                $params[] = $input[$col];
            }
        }
        if (empty($fields)) jsonError('Wax la beddelo ma jiraan.');
        $params[] = $id;
        $db->prepare("UPDATE citizens SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);
        auditLog($auth['user_id'], 'update', 'citizens', $id);
        jsonResponse(['success' => true]);
        break;

    case 'DELETE':
        $auth = requireCapability('citizens.manage');
        $id   = (int)($_GET['id'] ?? 0);
        if (!$id) jsonError('ID waa lagama maarmaan.');
        $db->prepare('DELETE FROM citizens WHERE id = ?')->execute([$id]);
        auditLog($auth['user_id'], 'delete', 'citizens', $id);
        jsonResponse(['success' => true]);
        break;

    default:
        jsonError('Method-ka la isticmaalay lama aqbalo.', 405);
}
