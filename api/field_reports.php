<?php
/**
 * Warbixinnada Ciidanka — Field Reports
 *
 * Ciidanku warbixin buu soo gudbiyaa (POST).
 * Taliyuhu wuu arkaa dhammaan, wuuna ansixiyaa ama diidaa (PUT ?action=review).
 * Sarkaalku wuxuu arkaa kuwiisa keliya.
 */
require_once __DIR__ . '/../includes/helpers.php';
setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

switch ($method) {
    // ---------------------------------------------------------
    // Liiska warbixinnada
    // ---------------------------------------------------------
    case 'GET':
        $auth    = requireAuth();
        if (!authCanAccessPage($auth, 'fieldreports') && !authCanAccessPage($auth, 'myreports')) jsonError('Qaybta warbixinnada laguma oggola.', 403);
        $viewAll = authHasCapability($auth, 'reports.view_all');

        $where  = [];
        $params = [];

        // Sarkaalku wuxuu arkaa warbixinnadiisa keliya.
        if (!$viewAll || ($_GET['mine'] ?? '') === '1') {
            $where[]  = 'fr.submitted_by = ?';
            $params[] = $auth['user_id'];
        }
        if (!empty($_GET['status'])) {
            $where[]  = 'fr.status = ?';
            $params[] = $_GET['status'];
        }
        if (!empty($_GET['type'])) {
            $where[]  = 'fr.type = ?';
            $params[] = $_GET['type'];
        }
        if (!empty($_GET['search'])) {
            $where[]  = '(fr.title LIKE ? OR fr.report_number LIKE ? OR fr.location LIKE ?)';
            $term     = '%' . $_GET['search'] . '%';
            $params[] = $term; $params[] = $term; $params[] = $term;
        }

        $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';
        $page     = max(1, (int)($_GET['page'] ?? 1));
        $limit    = min(100, max(1, (int)($_GET['limit'] ?? 20)));
        $offset   = ($page - 1) * $limit;

        $countStmt = $db->prepare("SELECT COUNT(*) FROM field_reports fr $whereSql");
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        $sql = "SELECT fr.*, u.full_name AS submitter_name, o.badge_id, o.`rank`,
                       s.name AS station_name, rv.full_name AS reviewer_name
                FROM field_reports fr
                LEFT JOIN users u     ON fr.submitted_by = u.id
                LEFT JOIN officers o  ON fr.officer_id   = o.id
                LEFT JOIN stations s  ON fr.station_id   = s.id
                LEFT JOIN users rv    ON fr.reviewed_by  = rv.id
                $whereSql
                ORDER BY fr.created_at DESC
                LIMIT ? OFFSET ?";
        $dataStmt = $db->prepare($sql);
        $dataStmt->execute([...$params, $limit, $offset]);

        jsonResponse([
            'success'     => true,
            'data'        => $dataStmt->fetchAll(),
            'total'       => $total,
            'page'        => $page,
            'limit'       => $limit,
            'total_pages' => (int)ceil($total / $limit),
            'can_review'  => authHasCapability($auth, 'reports.review'),
        ]);
        break;

    // ---------------------------------------------------------
    // Ciidanku warbixin cusub buu soo gudbiyaa
    // ---------------------------------------------------------
    case 'POST':
        $auth  = requireCapability('reports.submit');
        $input = getInput();

        $title   = trim($input['title'] ?? '');
        $content = trim($input['content'] ?? '');
        if ($title === '' || $content === '') {
            jsonError('Cinwaanka iyo faahfaahinta waa lagama maarmaan.', 422);
        }

        $number = 'FR-' . date('Y') . '-' . str_pad((string)random_int(1, 9999), 4, '0', STR_PAD_LEFT);

        $stmt = $db->prepare(
            'INSERT INTO field_reports
             (report_number, officer_id, submitted_by, station_id, type, title, content,
              location, occurred_at, priority, case_id, incident_id, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $number,
            $auth['officer_id'],
            $auth['user_id'],
            $auth['station_id'],
            $input['type'] ?? 'Dhacdo',
            $title,
            $content,
            $input['location'] ?? null,
            !empty($input['occurred_at']) ? $input['occurred_at'] : date('Y-m-d H:i:s'),
            $input['priority'] ?? 'Dhexe',
            !empty($input['case_id'])     ? (int)$input['case_id']     : null,
            !empty($input['incident_id']) ? (int)$input['incident_id'] : null,
            'Gudbiyey',
        ]);

        $id = (int)$db->lastInsertId();
        auditLog($auth['user_id'], 'submit', 'field_reports', $id, "$number — $title");

        jsonResponse([
            'success'       => true,
            'id'            => $id,
            'report_number' => $number,
            'message'       => 'Warbixintaada waa la gudbiyey. Taliyaha ayaa dib u eegi doona.',
        ], 201);
        break;

    // ---------------------------------------------------------
    // Dib u eegis / ansixin (taliye), ama tafatir (qoraaga)
    // ---------------------------------------------------------
    case 'PUT':
        $auth  = requireAuth();
        if (!authCanAccessPage($auth, 'fieldreports') && !authCanAccessPage($auth, 'myreports')) jsonError('Qaybta warbixinnada laguma oggola.', 403);
        $input = getInput();
        $id    = (int)($input['id'] ?? $_GET['id'] ?? 0);
        if (!$id) jsonError('ID waa lagama maarmaan.');

        $stmt = $db->prepare('SELECT * FROM field_reports WHERE id = ?');
        $stmt->execute([$id]);
        $report = $stmt->fetch();
        if (!$report) jsonError('Warbixinta lama helin.', 404);

        // --- Ansixin / diidmo: taliyaha keliya ---
        if (($_GET['action'] ?? '') === 'review') {
            if (!authHasCapability($auth, 'reports.review')) {
                jsonError('Awood uma lihid inaad warbixin ansixiso.', 403);
            }
            $status = $input['status'] ?? '';
            if (!in_array($status, ['Dib u eegis', 'La ansixiyey', 'La diiday'], true)) {
                jsonError('Xaalad aan sax ahayn.', 422);
            }
            $db->prepare(
                'UPDATE field_reports SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?'
            )->execute([$status, $input['review_note'] ?? null, $auth['user_id'], $id]);

            auditLog($auth['user_id'], 'review', 'field_reports', $id, "{$report['report_number']} → $status");
            jsonResponse(['success' => true, 'message' => "Warbixinta waa la cusboonaysiiyey: $status"]);
        }

        // --- Tafatir: qoraaga keliya, oo kaliya inta aan la ansixin ---
        if (!authHasCapability($auth, 'reports.submit')) jsonError('Tafatirka warbixinta laguma oggola.', 403);
        if ((int)$report['submitted_by'] !== (int)$auth['user_id']) {
            jsonError('Kaliya qoraaga ayaa tafatiri kara warbixinta.', 403);
        }
        if (in_array($report['status'], ['La ansixiyey', 'La diiday'], true)) {
            jsonError('Warbixin la ansixiyey ama la diiday lama tafatiri karo.', 409);
        }

        $fields = [];
        $params = [];
        foreach (['type', 'title', 'content', 'location', 'occurred_at', 'priority'] as $col) {
            if (isset($input[$col])) {
                $fields[] = "`$col` = ?";
                $params[] = $input[$col];
            }
        }
        if (!$fields) jsonError('Wax la beddelo ma jiraan.');
        $params[] = $id;
        $db->prepare('UPDATE field_reports SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);

        auditLog($auth['user_id'], 'update', 'field_reports', $id);
        jsonResponse(['success' => true]);
        break;

    // ---------------------------------------------------------
    case 'DELETE':
        $auth = requireCapability('reports.review');
        $id   = (int)($_GET['id'] ?? 0);
        if (!$id) jsonError('ID waa lagama maarmaan.');
        $db->prepare('DELETE FROM field_reports WHERE id = ?')->execute([$id]);
        auditLog($auth['user_id'], 'delete', 'field_reports', $id);
        jsonResponse(['success' => true]);
        break;

    default:
        jsonError('Method-ka la isticmaalay lama aqbalo.', 405);
}
