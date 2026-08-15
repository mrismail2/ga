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
        // Public tip line: unauthenticated and CSRF-exempt by design, which also
        // makes it the one endpoint a stranger can call repeatedly. Submissions
        // are throttled per source address and every field is length-capped so a
        // single client cannot flood the table or push oversized rows into it.
        $input = getInput();
        $name    = trim((string)($input['name'] ?? ''));
        $phone   = trim((string)($input['phone'] ?? ''));
        $message = trim((string)($input['message'] ?? ''));
        $type     = trim((string)($input['type'] ?? ''));
        $district = trim((string)($input['district'] ?? ''));

        if ($name === '' || $message === '') {
            jsonError('Magaca iyo fariinta waa lagama maarmaan.', 422);
        }
        if (mb_strlen($name) > 100)    jsonError('Magacu wuu dheer yahay.', 422);
        if (mb_strlen($phone) > 30)    jsonError('Telefoonku wuu dheer yahay.', 422);
        if (mb_strlen($type) > 50)     jsonError('Nooca fariintu wuu dheer yahay.', 422);
        if (mb_strlen($district) > 80) jsonError('Degmadu way dheer tahay.', 422);
        if (mb_strlen($message) > 4000) jsonError('Fariintu waa ka dheer tahay 4000 xaraf.', 422);

        // The raw address is never stored — only a salted hash, which is enough
        // to throttle abuse without keeping the IP of a member of the public
        // reporting a crime.
        $ipHash = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|contact-form|' . DB_NAME);
        try {
            $recent = $db->prepare('SELECT COUNT(*) FROM contacts WHERE ip_hash = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)');
            $recent->execute([$ipHash]);
            if ((int)$recent->fetchColumn() >= 5) {
                jsonError('Fariimo badan ayaad dirtay. Fadlan sug daqiiqado kadibna isku day mar kale.', 429);
            }
            $stmt = $db->prepare('INSERT INTO contacts (name, phone, type, district, message, ip_hash) VALUES (?, ?, ?, ?, ?, ?)');
            $stmt->execute([$name, $phone ?: null, $type ?: null, $district ?: null, $message, $ipHash]);
        } catch (PDOException $e) {
            // Installations that have not yet run migration_audit_hardening.sql
            // have no ip_hash column; accept the message rather than reject the
            // public who is trying to report something.
            $stmt = $db->prepare('INSERT INTO contacts (name, phone, type, district, message) VALUES (?, ?, ?, ?, ?)');
            $stmt->execute([$name, $phone ?: null, $type ?: null, $district ?: null, $message]);
        }
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
