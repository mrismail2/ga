<?php
require_once __DIR__ . '/../includes/helpers.php';
setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

switch ($method) {
    case 'GET':
        requirePage('settings');
        $stmt = $db->query('SELECT * FROM stations WHERE id = 1 LIMIT 1');
        $station = $stmt->fetch();

        // Strength figures are always counted live. The stations table still carries
        // the legacy total_officers/active_cases/vehicles/readiness_pct columns, but
        // a stored number goes stale the moment a record is added elsewhere, so the
        // API answers with the real counts instead of whatever was written there.
        if ($station) {
            $officers = (int)$db->query('SELECT COUNT(*) FROM officers')->fetchColumn();
            $onDuty   = (int)$db->query("SELECT COUNT(*) FROM officers WHERE status = 'Active'")->fetchColumn();
            $station['total_officers'] = $officers;
            $station['active_cases']   = (int)$db->query("SELECT COUNT(*) FROM cases WHERE status != 'closed'")->fetchColumn();
            $station['vehicles']       = (int)$db->query('SELECT COUNT(*) FROM fleet')->fetchColumn();
            $station['readiness_pct']  = $officers > 0 ? (int)round($onDuty / $officers * 100) : 0;
        }

        jsonResponse(['success' => true, 'data' => $station ? [$station] : [], 'total' => $station ? 1 : 0]);
        break;

    case 'PUT':
        $auth = requireCapability('settings.manage');
        $input = getInput();
        $fields = [];
        $params = [];
        // Only descriptive fields are writable. The strength counters are derived on
        // read, so accepting them here would just let stale numbers back in.
        foreach (['name','commander_name','address','phone','status'] as $col) {
            if (isset($input[$col])) { $fields[] = "`$col` = ?"; $params[] = $input[$col]; }
        }
        if (empty($fields)) jsonError('Wax la beddelo ma jiraan.');
        $params[] = 1;
        $db->prepare('UPDATE stations SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
        auditLog($auth['user_id'], 'update', 'stations', 1, 'Single station settings');
        jsonResponse(['success' => true]);
        break;

    case 'POST':
    case 'DELETE':
        jsonError('Nidaamkani wuxuu leeyahay hal saldhig oo keliya; saldhig kale lama abuuri karo ama lama tirtiri karo.', 405);
        break;

    default:
        jsonError('Method-ka la isticmaalay lama aqbalo.', 405);
}
