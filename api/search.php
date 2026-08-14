<?php
require_once __DIR__ . '/../includes/helpers.php';
setCorsHeaders();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') jsonError('GET kaliya.', 405);

$auth = requireAuth();
$query = trim($_GET['q'] ?? '');
if ($query === '') jsonError('Raadinta waa madhan tahay.', 422);
if (mb_strlen($query) < 2) jsonError('Qor ugu yaraan laba xaraf.', 422);

$results = [];
if (authCanAccessPage($auth, 'officers')) $results['officers'] = searchTable('officers', ['full_name','badge_id','email'], $query, 'id DESC', 5);
if (authCanAccessPage($auth, 'cases')) {
    if (($auth['scope'] ?? 'own') === 'all' || authHasCapability($auth, 'cases.view_all')) {
        $results['cases'] = searchTable('cases', ['case_number','title','location'], $query, 'id DESC', 5);
    } elseif (!empty($auth['officer_id'])) {
        $term = '%' . $query . '%';
        $stmt = getDB()->prepare('SELECT * FROM cases WHERE investigator_id = ? AND (case_number LIKE ? OR title LIKE ? OR location LIKE ?) ORDER BY id DESC LIMIT 5');
        $stmt->execute([(int)$auth['officer_id'], $term, $term, $term]);
        $results['cases'] = $stmt->fetchAll();
    } else {
        $results['cases'] = [];
    }
}
if (authCanAccessPage($auth, 'dispatch')) {
    $results['incidents'] = searchTable('incidents', ['incident_number','call_number','type','location'], $query, 'id DESC', 5);
    $results['emergency_calls'] = searchTable('emergency_calls', ['call_number','caller_name','call_type','location'], $query, 'id DESC', 5);
}
if (authCanAccessPage($auth, 'citizens')) $results['citizens'] = searchTable('citizens', ['full_name','national_id'], $query, 'id DESC', 5);
if (authCanAccessPage($auth, 'evidence')) $results['evidence'] = searchTable('evidence', ['evidence_number','name'], $query, 'id DESC', 5);
if (authCanAccessPage($auth, 'arrests')) {
    $results['warrants'] = searchTable('warrants', ['warrant_number','person_name','issuing_authority'], $query, 'id DESC', 5);
    $results['arrests'] = searchTable('arrests', ['arrest_number','person_name','legal_basis'], $query, 'id DESC', 5);
}
if (authCanAccessPage($auth, 'custody')) $results['custody'] = searchTable('custody_bookings', ['booking_number','legal_authority','cell'], $query, 'id DESC', 5);
if (authCanAccessPage($auth, 'traffic')) $results['fleet'] = searchTable('fleet', ['vehicle_name','plate_number'], $query, 'id DESC', 5);
if (authCanAccessPage($auth, 'tasks')) $results['tasks'] = searchTable('workflow_tasks', ['task_number','title','description'], $query, 'id DESC', 5);

$total = array_sum(array_map('count', $results));
auditLog($auth['user_id'], 'search', 'global_search', null, mb_substr($query, 0, 100));
jsonResponse(['success' => true, 'query' => $query, 'total' => $total, 'results' => $results]);
