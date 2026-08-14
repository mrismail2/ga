<?php
require_once __DIR__ . '/../includes/helpers.php';
setCorsHeaders();
$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    requirePage('custody');
    $view = $_GET['view'] ?? 'bookings';
    if ($view === 'checks') {
        $stmt = $db->query('SELECT cc.*, cb.booking_number, p.full_name, u.full_name AS checked_by_name
                            FROM custody_checks cc
                            JOIN custody_bookings cb ON cc.booking_id = cb.id
                            JOIN prisoners p ON cb.prisoner_id = p.id
                            LEFT JOIN users u ON cc.checked_by = u.id
                            ORDER BY cc.checked_at DESC LIMIT 100');
    } else {
        $stmt = $db->query('SELECT cb.*, p.full_name, p.prison_id, a.arrest_number, u.full_name AS booked_by_name
                            FROM custody_bookings cb
                            JOIN prisoners p ON cb.prisoner_id = p.id
                            LEFT JOIN arrests a ON cb.arrest_id = a.id
                            LEFT JOIN users u ON cb.booked_by = u.id
                            ORDER BY FIELD(cb.status,"In Custody","Court","Transferred","Released"), cb.booked_at DESC
                            LIMIT 100');
    }
    jsonResponse(['success' => true, 'view' => $view, 'data' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    $auth = requirePage('custody');
    $input = getInput();
    $kind = $input['record_type'] ?? 'booking';

    if ($kind === 'check') {
        if (!authHasCapability($auth, 'custody.manage') && !authHasCapability($auth, 'custody.check')) {
            jsonError('Taliyuhu kuuma oggolaan welfare check-ka custody-ga.', 403);
        }
        requireFields($input, ['booking_id', 'observation']);
        $checkType = in_array($input['check_type'] ?? 'Welfare', ['Welfare','Meal','Medication','Legal Visit','Family Contact','Court Transfer','Other'], true)
            ? $input['check_type'] : 'Welfare';
        $stmt = $db->prepare('INSERT INTO custody_checks
            (booking_id,checked_by,check_type,observation,action_taken,checked_at)
            VALUES (?,?,?,?,?,COALESCE(?,NOW()))');
        $stmt->execute([
            (int)$input['booking_id'],
            $auth['user_id'],
            $checkType,
            trim($input['observation']),
            $input['action_taken'] ?? null,
            !empty($input['checked_at']) ? $input['checked_at'] : null,
        ]);
        $id = (int)$db->lastInsertId();
        auditLog($auth['user_id'], 'create', 'custody_checks', $id, $checkType);
        jsonResponse(['success' => true, 'id' => $id], 201);
    }

    if (!authHasCapability($auth, 'custody.manage')) jsonError('Awood uma lihid booking cusub.', 403);
    requireFields($input, ['prisoner_id', 'legal_authority']);
    $risk = in_array($input['risk_level'] ?? 'Standard', ['Standard','Vulnerable','Self-harm Risk','Medical Risk','High Risk'], true)
        ? $input['risk_level'] : 'Standard';
    $number = uniqueReference('BK', 'custody_bookings', 'booking_number');
    $stmt = $db->prepare('INSERT INTO custody_bookings
        (booking_number,prisoner_id,arrest_id,booked_by,legal_authority,rights_given_at,property_inventory,medical_screening,risk_level,cell,review_due_at,status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
    $stmt->execute([
        $number,
        (int)$input['prisoner_id'],
        !empty($input['arrest_id']) ? (int)$input['arrest_id'] : null,
        $auth['user_id'],
        trim($input['legal_authority']),
        !empty($input['rights_given_at']) ? $input['rights_given_at'] : null,
        $input['property_inventory'] ?? null,
        $input['medical_screening'] ?? null,
        $risk,
        $input['cell'] ?? null,
        !empty($input['review_due_at']) ? $input['review_due_at'] : null,
        'In Custody',
    ]);
    $id = (int)$db->lastInsertId();
    auditLog($auth['user_id'], 'create', 'custody_bookings', $id, $number);
    jsonResponse(['success' => true, 'id' => $id, 'booking_number' => $number], 201);
}

if ($method === 'PUT') {
    $auth = requireCapability('custody.manage');
    $input = getInput();
    $id = (int)($input['id'] ?? 0);
    if (!$id) jsonError('ID waa lagama maarmaan.', 422);
    $allowed = ['status','cell','risk_level','review_due_at','release_authority','medical_screening'];
    $fields = [];
    $params = [];
    foreach ($allowed as $column) {
        if (array_key_exists($column, $input)) {
            $fields[] = "`$column` = ?";
            $params[] = $input[$column];
        }
    }
    if (($input['status'] ?? '') === 'Released') $fields[] = 'released_at = NOW()';
    if (!$fields) jsonError('Wax la beddelo ma jiraan.', 422);
    $params[] = $id;
    $db->prepare('UPDATE custody_bookings SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
    auditLog($auth['user_id'], 'update', 'custody_bookings', $id, $input['status'] ?? null);
    jsonResponse(['success' => true]);
}

jsonError('Method-ka lama aqbalo.', 405);
