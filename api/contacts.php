<?php
require_once __DIR__ . '/../includes/helpers.php';
setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

switch ($method) {
    case 'GET':
        requirePage('complaints');
        $conditions = [];
        if (isset($_GET['is_read'])) $conditions['is_read'] = (int)$_GET['is_read'];
        $result = paginate('contacts', $conditions, 'created_at DESC');
        jsonResponse(['success' => true] + $result);
        break;

    case 'POST':
        $input = getInput();
        $name    = trim($input['name'] ?? '');
        $phone   = trim($input['phone'] ?? '');
        $message = trim($input['message'] ?? '');
        if ($name === '' || $message === '') {
            jsonError('Magaca iyo fariinta waa lagama maarmaan.', 422);
        }
        $stmt = $db->prepare('INSERT INTO contacts (name, phone, type, district, message) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([
            $name,
            $phone ?: null,
            $input['type'] ?? null,
            $input['district'] ?? null,
            $message,
        ]);
        jsonResponse(['success' => true, 'message' => 'Fariintaada waa la diiwaan geliyey. Waad ku mahadsantahay.'], 201);
        break;

    case 'PUT':
        $auth = requireCapability('complaints.manage');
        $id   = (int)($_GET['id'] ?? 0);
        if (!$id) jsonError('ID waa lagama maarmaan.');
        $db->prepare('UPDATE contacts SET is_read = 1 WHERE id = ?')->execute([$id]);
        jsonResponse(['success' => true]);
        break;

    default:
        jsonError('Method-ka la isticmaalay lama aqbalo.', 405);
}
