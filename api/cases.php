<?php
require_once __DIR__ . '/../includes/helpers.php';
setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

/** Row-level case scope: all only when Commander explicitly grants it. */
function caseScopeSql(array $auth, string $alias = 'c'): array {
    if (($auth['scope'] ?? 'own') === 'all' || authHasCapability($auth, 'cases.view_all')) return ['', []];
    $officerId = (int)($auth['officer_id'] ?? 0);
    if (!$officerId) return ['1=0', []];
    return ["$alias.investigator_id = ?", [$officerId]];
}

function assertCaseAccessible(PDO $db, array $auth, int $caseId): void {
    [$scopeSql, $params] = caseScopeSql($auth, 'c');
    $sql = 'SELECT c.id FROM cases c WHERE c.id = ?';
    $allParams = [$caseId];
    if ($scopeSql !== '') { $sql .= ' AND ' . $scopeSql; $allParams = array_merge($allParams, $params); }
    $stmt = $db->prepare($sql); $stmt->execute($allParams);
    if (!$stmt->fetchColumn()) jsonError('Kiiskan laguma oggola ama laguguma xilsaarin.', 403);
}

switch ($method) {
    case 'GET':
        $auth = requirePage('cases');
        [$scopeSql, $scopeParams] = caseScopeSql($auth, 'c');

        if (($_GET['view'] ?? '') === 'persons') {
            $where = $scopeSql !== '' ? 'WHERE ' . $scopeSql : '';
            $stmt = $db->prepare("SELECT cp.*, c.case_number, c.title AS case_title, COALESCE(ci.full_name, cp.person_name) AS display_name, ci.national_id
                                  FROM case_persons cp JOIN cases c ON cp.case_id=c.id LEFT JOIN citizens ci ON cp.citizen_id=ci.id
                                  $where ORDER BY cp.created_at DESC LIMIT 200");
            $stmt->execute($scopeParams);
            jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
        }

        $where = [];
        $params = [];
        if ($scopeSql !== '') { $where[] = $scopeSql; $params = array_merge($params, $scopeParams); }
        if (!empty($_GET['status']))   { $where[] = 'c.status = ?';   $params[] = $_GET['status']; }
        if (!empty($_GET['priority'])) { $where[] = 'c.priority = ?'; $params[] = $_GET['priority']; }
        if (!empty($_GET['type']))     { $where[] = 'c.type = ?';     $params[] = $_GET['type']; }
        if (!empty($_GET['search'])) {
            $q = '%' . trim((string)$_GET['search']) . '%';
            $where[] = '(c.case_number LIKE ? OR c.title LIKE ? OR c.location LIKE ?)';
            array_push($params, $q, $q, $q);
        }
        $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';
        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = min(100, max(1, (int)($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;
        $countStmt = $db->prepare("SELECT COUNT(*) FROM cases c $whereSql");
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();
        $stmt = $db->prepare("SELECT c.* FROM cases c $whereSql ORDER BY c.id DESC LIMIT ? OFFSET ?");
        $stmt->execute([...$params, $limit, $offset]);
        jsonResponse(['success'=>true,'data'=>$stmt->fetchAll(),'total'=>$total,'page'=>$page,'limit'=>$limit,'total_pages'=>(int)ceil($total/$limit)]);
        break;

    case 'POST':
        $auth  = requireCapability('cases.manage');
        $input = getInput();
        if (($input['record_type'] ?? '') === 'person') {
            requireFields($input, ['case_id','person_name','role']);
            $caseId = (int)$input['case_id'];
            assertCaseAccessible($db, $auth, $caseId);
            $stmt = $db->prepare('INSERT INTO case_persons (case_id,citizen_id,person_name,role,statement_status,is_vulnerable,notes) VALUES (?,?,?,?,?,?,?)');
            $stmt->execute([$caseId,($input['citizen_id'] ?? null) ?: null,$input['person_name'],$input['role'],$input['statement_status'] ?? 'Not Taken',(int)($input['is_vulnerable'] ?? 0),$input['notes'] ?? null]);
            $id = $db->lastInsertId();
            auditLog($auth['user_id'], 'create', 'case_persons', $id, $input['person_name']);
            jsonResponse(['success'=>true,'id'=>$id],201);
        }
        requireFields($input, ['title']);
        $number = uniqueReference('CR', 'cases', 'case_number');
        $canChooseInvestigator = (($auth['scope'] ?? 'own') === 'all' || authHasCapability($auth, 'cases.view_all'));
        if ($canChooseInvestigator) {
            $investigatorId = !empty($input['investigator_id']) ? (int)$input['investigator_id'] : null;
        } else {
            $investigatorId = (int)($auth['officer_id'] ?? 0);
            if (!$investigatorId) jsonError('Kiis cusub kuma samayn kartid ilaa akoonkaaga lagu xiro officer profile.', 403);
        }
        $stmt  = $db->prepare('INSERT INTO cases (case_number, title, description, type, priority, status, location, investigator_id, station_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $number,
            $input['title'] ?? '',
            $input['description'] ?? null,
            $input['type'] ?? 'Kale',
            $input['priority'] ?? 'medium',
            'new',
            $input['location'] ?? null,
            $investigatorId,
            1,
        ]);
        $id = $db->lastInsertId();
        auditLog($auth['user_id'], 'create', 'cases', $id, $input['title'] ?? '');
        jsonResponse(['success' => true, 'id' => $id, 'case_number' => $number], 201);
        break;

    case 'PUT':
        $auth  = requireCapability('cases.manage');
        $input = getInput();
        $id    = (int)($input['id'] ?? $_GET['id'] ?? 0);
        if (!$id) jsonError('ID waa lagama maarmaan.');
        assertCaseAccessible($db, $auth, $id);
        $fields = [];
        $params = [];
        $allowedCols = ['title','description','type','priority','status','location'];
        if (($auth['scope'] ?? 'own') === 'all' || authHasCapability($auth, 'cases.view_all')) $allowedCols[] = 'investigator_id';
        foreach ($allowedCols as $col) {
            if (array_key_exists($col, $input)) {
                $fields[] = "`$col` = ?";
                $params[] = $input[$col];
            }
        }
        if (!empty($input['status']) && $input['status'] === 'closed') $fields[] = 'closed_at = NOW()';
        if (empty($fields)) jsonError('Wax la beddelo ma jiraan.');
        $params[] = $id;
        $db->prepare("UPDATE cases SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);
        auditLog($auth['user_id'], 'update', 'cases', $id);
        jsonResponse(['success' => true]);
        break;

    case 'DELETE':
        $auth = requireCapability('cases.manage');
        $id   = (int)($_GET['id'] ?? 0);
        if (!$id) jsonError('ID waa lagama maarmaan.');
        assertCaseAccessible($db, $auth, $id);
        $db->prepare('DELETE FROM cases WHERE id = ?')->execute([$id]);
        auditLog($auth['user_id'], 'delete', 'cases', $id);
        jsonResponse(['success' => true]);
        break;

    default:
        jsonError('Method-ka la isticmaalay lama aqbalo.', 405);
}
