<?php
require_once __DIR__ . '/../includes/helpers.php';
setCorsHeaders();
$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    requirePage('arrests');
    $view = $_GET['view'] ?? 'arrests';
    if ($view === 'warrants') {
        $stmt = $db->query('SELECT w.*, c.case_number, u.full_name AS created_by_name
                            FROM warrants w
                            LEFT JOIN cases c ON w.case_id = c.id
                            LEFT JOIN users u ON w.created_by = u.id
                            ORDER BY FIELD(w.status,"Active","Executed","Expired","Cancelled"), w.issued_date DESC
                            LIMIT 100');
    } else {
        $stmt = $db->query('SELECT a.*, c.case_number, w.warrant_number, o.full_name AS officer_name
                            FROM arrests a
                            LEFT JOIN cases c ON a.case_id = c.id
                            LEFT JOIN warrants w ON a.warrant_id = w.id
                            LEFT JOIN officers o ON a.arrested_by = o.id
                            ORDER BY a.arrested_at DESC
                            LIMIT 100');
    }
    jsonResponse(['success' => true, 'view' => $view, 'data' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    $input = getInput();
    $kind = $input['record_type'] ?? 'arrest';

    if ($kind === 'warrant') {
        $auth = requireCapability('warrants.manage');
        requireFields($input, ['person_name', 'issuing_authority', 'issued_date']);
        $type = in_array($input['warrant_type'] ?? 'Arrest', ['Arrest','Search','Summons','Other'], true)
            ? $input['warrant_type'] : 'Arrest';
        $risk = in_array($input['risk_level'] ?? 'Medium', ['Low','Medium','High','Critical'], true)
            ? $input['risk_level'] : 'Medium';
        $number = uniqueReference('WR', 'warrants', 'warrant_number');
        $stmt = $db->prepare('INSERT INTO warrants
            (warrant_number,case_id,person_name,warrant_type,issuing_authority,issued_date,expiry_date,status,risk_level,notes,created_by)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)');
        $stmt->execute([
            $number,
            !empty($input['case_id']) ? (int)$input['case_id'] : null,
            trim($input['person_name']),
            $type,
            trim($input['issuing_authority']),
            $input['issued_date'],
            !empty($input['expiry_date']) ? $input['expiry_date'] : null,
            'Active',
            $risk,
            $input['notes'] ?? null,
            $auth['user_id'],
        ]);
        $id = (int)$db->lastInsertId();
        auditLog($auth['user_id'], 'create', 'warrants', $id, $number);
        jsonResponse(['success' => true, 'id' => $id, 'warrant_number' => $number], 201);
    }

    $auth = requireCapability('arrests.manage');
    requireFields($input, ['person_name', 'arrested_at', 'legal_basis']);
    $status = in_array($input['status'] ?? 'Booked', ['Booked','Released','Transferred','Court'], true)
        ? $input['status'] : 'Booked';
    $number = uniqueReference('AR', 'arrests', 'arrest_number');
    $stmt = $db->prepare('INSERT INTO arrests
        (arrest_number,case_id,warrant_id,citizen_id,person_name,arrested_by,arrested_at,location,legal_basis,rights_explained,use_of_force,medical_attention,status,notes,created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    $stmt->execute([
        $number,
        !empty($input['case_id']) ? (int)$input['case_id'] : null,
        !empty($input['warrant_id']) ? (int)$input['warrant_id'] : null,
        !empty($input['citizen_id']) ? (int)$input['citizen_id'] : null,
        trim($input['person_name']),
        !empty($input['arrested_by']) ? (int)$input['arrested_by'] : ($auth['officer_id'] ?: null),
        $input['arrested_at'],
        $input['location'] ?? null,
        trim($input['legal_basis']),
        !empty($input['rights_explained']) ? 1 : 0,
        !empty($input['use_of_force']) ? 1 : 0,
        !empty($input['medical_attention']) ? 1 : 0,
        $status,
        $input['notes'] ?? null,
        $auth['user_id'],
    ]);
    $id = (int)$db->lastInsertId();
    auditLog($auth['user_id'], 'create', 'arrests', $id, $number);
    jsonResponse(['success' => true, 'id' => $id, 'arrest_number' => $number], 201);
}

if ($method === 'PUT') {
    $input = getInput();
    $id = (int)($input['id'] ?? 0);
    if (!$id) jsonError('ID waa lagama maarmaan.', 422);
    $kind = $input['record_type'] ?? 'arrest';

    if ($kind === 'warrant') {
        $auth = requireCapability('warrants.manage');
        $allowed = ['status','expiry_date','risk_level','notes'];
        $table = 'warrants';
    } else {
        $auth = requireCapability('arrests.manage');
        $allowed = ['status','notes','rights_explained','medical_attention'];
        $table = 'arrests';
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
    if ($table === 'warrants' && ($input['status'] ?? '') === 'Executed') $fields[] = 'executed_at = NOW()';
    $params[] = $id;
    $db->prepare("UPDATE `$table` SET " . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
    auditLog($auth['user_id'], 'update', $table, $id, $input['status'] ?? null);
    jsonResponse(['success' => true]);
}

jsonError('Method-ka lama aqbalo.', 405);
