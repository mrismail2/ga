<?php
require_once __DIR__ . '/../includes/helpers.php';
setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

switch ($method) {
    case 'GET':
        requirePage('settings');
        $rows = $db->query('SELECT `key`, `value` FROM settings')->fetchAll();
        $settings = [];
        foreach ($rows as $row) {
            $settings[$row['key']] = $row['value'];
        }
        jsonResponse(['success' => true, 'settings' => $settings]);
        break;

    case 'PUT':
        $auth  = requireCapability('settings.manage');
        $input = getInput();
        if (empty($input)) jsonError('Wax la beddelo ma jiraan.');
        $stmt = $db->prepare('INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)');
        foreach ($input as $key => $value) {
            $stmt->execute([$key, is_scalar($value) ? (string)$value : json_encode($value)]);
        }
        auditLog($auth['user_id'], 'update', 'settings', null, implode(', ', array_keys($input)));
        jsonResponse(['success' => true, 'message' => 'Isbeddellada waa la kaydiyey.']);
        break;

    default:
        jsonError('Method-ka la isticmaalay lama aqbalo.', 405);
}
