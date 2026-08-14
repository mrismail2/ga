<?php
require_once __DIR__ . '/../includes/helpers.php';
setCorsHeaders();
$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $auth = requirePage('roster');
    $where = [];
    $params = [];
    if ($auth['scope'] === 'own') {
        if (!$auth['officer_id']) jsonResponse(['success' => true, 'data' => []]);
        $where[] = 'dr.officer_id = ?';
        $params[] = $auth['officer_id'];
    } elseif (!empty($_GET['date'])) {
        $where[] = 'dr.duty_date = ?';
        $params[] = $_GET['date'];
    }
    $sql = 'SELECT dr.*, o.full_name, o.badge_id, s.full_name AS supervisor_name
            FROM duty_roster dr
            JOIN officers o ON dr.officer_id = o.id
            LEFT JOIN officers s ON dr.supervisor_id = s.id';
    if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
    $sql .= " ORDER BY dr.duty_date DESC, FIELD(dr.shift,'A','B','C','Special') LIMIT 150";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    $auth = requireCapability('roster.manage');
    $input = getInput();
    requireFields($input, ['officer_id','duty_date','shift','assignment']);
    $shift = in_array($input['shift'], ['A','B','C','Special'], true) ? $input['shift'] : 'A';
    $status = in_array($input['status'] ?? 'Scheduled', ['Scheduled','Checked In','Completed','Absent','Excused'], true)
        ? $input['status'] : 'Scheduled';
    $stmt = $db->prepare('INSERT INTO duty_roster
        (officer_id,duty_date,shift,assignment,zone,unit_code,supervisor_id,start_time,end_time,status,created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)');
    try {
        $stmt->execute([
            (int)$input['officer_id'], $input['duty_date'], $shift, trim($input['assignment']),
            $input['zone'] ?? null, $input['unit_code'] ?? null,
            !empty($input['supervisor_id']) ? (int)$input['supervisor_id'] : null,
            !empty($input['start_time']) ? $input['start_time'] : null,
            !empty($input['end_time']) ? $input['end_time'] : null,
            $status, $auth['user_id'],
        ]);
    } catch (PDOException $e) {
        if ((string)$e->getCode() === '23000') jsonError('Sarkaalkan shift-kan hore ayaa loogu qoray.', 409);
        throw $e;
    }
    $id = (int)$db->lastInsertId();
    auditLog($auth['user_id'], 'create', 'duty_roster', $id);
    jsonResponse(['success' => true, 'id' => $id], 201);
}

if ($method === 'PUT') {
    $auth = requirePage('roster');
    $input = getInput();
    $id = (int)($input['id'] ?? 0);
    if (!$id) jsonError('ID waa lagama maarmaan.', 422);
    if (!authHasCapability($auth, 'roster.manage')) {
        if (!authHasCapability($auth, 'roster.update_own')) jsonError('Taliyuhu kuuma oggolaan inaad duty-ga beddesho.', 403);
        $stmt = $db->prepare('SELECT officer_id FROM duty_roster WHERE id = ?');
        $stmt->execute([$id]);
        if ((int)$stmt->fetchColumn() !== $auth['officer_id']) jsonError('Waxaad beddeli kartaa duty-gaaga oo keliya.', 403);
        $allowed = ['status'];
    } else {
        $allowed = ['duty_date','shift','assignment','zone','unit_code','supervisor_id','start_time','end_time','status'];
    }
    $fields = [];
    $params = [];
    foreach ($allowed as $column) {
        if (array_key_exists($column, $input)) {
            $fields[] = "`$column` = ?";
            $params[] = $input[$column];
        }
    }
    if (!$fields) jsonError('Wax la beddelo ma jiraan.', 422);
    $params[] = $id;
    $db->prepare('UPDATE duty_roster SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
    auditLog($auth['user_id'], 'update', 'duty_roster', $id, $input['status'] ?? null);
    jsonResponse(['success' => true]);
}

jsonError('Method-ka lama aqbalo.', 405);
