<?php
require_once __DIR__ . '/../includes/helpers.php';
setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

switch ($method) {
    case 'GET':
        requirePage('reports');
        $conditions = [];
        if (!empty($_GET['type'])) $conditions['type'] = $_GET['type'];
        $result = paginate('reports', $conditions, 'generated_at DESC');
        jsonResponse(['success' => true] + $result);
        break;

    case 'POST':
        $auth  = requireCapability('reports.generate');
        $input = getInput();
        $type  = $input['type'] ?? 'Daily';
        $from  = $input['from'] ?? date('Y-m-01');
        $to    = $input['to'] ?? date('Y-m-d');

        $data = [];
        switch ($type) {
            case 'Daily':
                $stmt = $db->prepare("SELECT COUNT(*) AS total, SUM(priority='P1') AS critical FROM incidents WHERE DATE(reported_at) BETWEEN ? AND ?");
                $stmt->execute([$from, $to]);
                $data['incidents'] = $stmt->fetch();
                $stmt = $db->prepare("SELECT COUNT(*) AS total FROM cases WHERE DATE(opened_at) BETWEEN ? AND ?");
                $stmt->execute([$from, $to]);
                $data['cases'] = $stmt->fetch();
                break;

            case 'Monthly':
                $stmt = $db->prepare("SELECT type, COUNT(*) AS total FROM cases WHERE DATE(opened_at) BETWEEN ? AND ? GROUP BY type");
                $stmt->execute([$from, $to]);
                $data['by_type'] = $stmt->fetchAll();
                break;

            case 'HR':
                $data['by_status']     = $db->query("SELECT status, COUNT(*) AS total FROM officers GROUP BY status")->fetchAll();
                $data['by_department'] = $db->query("SELECT department, COUNT(*) AS total FROM officers GROUP BY department")->fetchAll();
                break;

            case 'Operations':
                $data['fleet']  = $db->query("SELECT status, COUNT(*) AS total FROM fleet GROUP BY status")->fetchAll();
                $data['patrol'] = $db->query("SELECT status, COUNT(*) AS total FROM patrol_units GROUP BY status")->fetchAll();
                break;

            case 'Finance':
                $stmt = $db->prepare("SELECT category, SUM(amount) AS total FROM expenses WHERE expense_date BETWEEN ? AND ? GROUP BY category");
                $stmt->execute([$from, $to]);
                $data['by_category'] = $stmt->fetchAll();
                break;
        }

        $title = ($input['title'] ?? "$type Report") . ' — ' . date('d M Y');
        $stmt  = $db->prepare('INSERT INTO reports (title, type, period, generated_by, format) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([$title, $type, "$from — $to", $_SESSION['full_name'] ?? 'System', $input['format'] ?? 'PDF']);
        $id = $db->lastInsertId();

        auditLog($auth['user_id'], 'generate', 'reports', $id, $title);
        jsonResponse(['success' => true, 'id' => $id, 'title' => $title, 'data' => $data], 201);
        break;

    default:
        jsonError('Method-ka la isticmaalay lama aqbalo.', 405);
}
