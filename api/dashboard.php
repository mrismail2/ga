<?php
/**
 * Dashboard rol-ku-saleysan.
 * Rol kastaa wuxuu helaa card-yo, panel-lo iyo ficillo degdeg ah oo shaqadiisa ku habboon.
 */
require_once __DIR__ . '/../includes/helpers.php';
setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('GET kaliya.', 405);
}

$auth = requireAuth();
$db   = getDB();
$role = $auth['role'];

$count = function (string $sql, array $params = []) use ($db): int {
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    return (int)$stmt->fetchColumn();
};

$cards   = [];
$panels  = [];
$actions = [];

switch ($role) {

    // =========================================================
    // TALIYE / MAAMULE SARE — muuqaalka guud ee ciidanka
    // =========================================================
    case 'Super Admin':
    case 'Commander':
        $officersTotal  = $count('SELECT COUNT(*) FROM officers');
        $officersActive = $count("SELECT COUNT(*) FROM officers WHERE status = 'Active'");
        $casesOpen      = $count("SELECT COUNT(*) FROM cases WHERE status != 'closed'");
        $casesHigh      = $count("SELECT COUNT(*) FROM cases WHERE priority = 'high' AND status != 'closed'");
        $incToday       = $count('SELECT COUNT(*) FROM incidents WHERE DATE(reported_at) = CURDATE()');
        $incCritical    = $count("SELECT COUNT(*) FROM incidents WHERE priority = 'P1' AND status NOT IN ('resolved','closed')");
        $fleetTotal     = $count('SELECT COUNT(*) FROM fleet');
        $fleetActive    = $count("SELECT COUNT(*) FROM fleet WHERE status = 'Active'");
        $pendingReports = $count("SELECT COUNT(*) FROM field_reports WHERE status IN ('Gudbiyey','Dib u eegis')");
        $openCalls      = $count("SELECT COUNT(*) FROM emergency_calls WHERE status NOT IN ('Resolved','Cancelled')");
        $p1Calls        = $count("SELECT COUNT(*) FROM emergency_calls WHERE priority = 'P1' AND status NOT IN ('Resolved','Cancelled')");
        $overdueTasks   = $count("SELECT COUNT(*) FROM workflow_tasks WHERE due_at < NOW() AND status NOT IN ('Completed','Cancelled')");
        $custodyDue     = $count("SELECT COUNT(*) FROM custody_bookings WHERE status = 'In Custody' AND review_due_at IS NOT NULL AND review_due_at <= NOW()");

        $cards = [
            ['icon' => 'OF', 'tone' => 'blue',  'label' => 'Saraakiil Shaqaynaya', 'value' => $officersActive, 'unit' => "/ $officersTotal", 'note' => 'Diyaar-garow guud'],
            ['icon' => 'CS', 'tone' => 'amber', 'label' => 'Kiisas Firfircoon',    'value' => $casesOpen,      'unit' => 'kiis',            'note' => "$casesHigh mudnaan sare"],
            ['icon' => 'CAD','tone' => 'red',   'label' => 'Wicitaanno Furan',      'value' => $openCalls,      'unit' => 'wicitaan',        'note' => "$p1Calls mudnaan P1"],
            ['icon' => 'WK', 'tone' => 'green', 'label' => 'Hawlaha Sugaya',       'value' => $overdueTasks + $pendingReports, 'unit' => 'ficil', 'note' => "$custodyDue custody review · $pendingReports report"],
        ];

        // Warbixinnada sugaya ansixinta taliyaha
        $stmt = $db->query(
            "SELECT fr.id, fr.report_number, fr.title, fr.type, fr.priority, fr.status, fr.created_at,
                    u.full_name AS submitter_name, o.badge_id
             FROM field_reports fr
             LEFT JOIN users u    ON fr.submitted_by = u.id
             LEFT JOIN officers o ON fr.officer_id   = o.id
             WHERE fr.status IN ('Gudbiyey','Dib u eegis')
             ORDER BY FIELD(fr.priority,'Sare','Dhexe','Hoose'), fr.created_at DESC
             LIMIT 6"
        );
        $panels['pending_reports'] = $stmt->fetchAll();

        $panels['active_incidents'] = $db->query(
            "SELECT incident_number, type, location, assigned_unit, priority, status, reported_at
             FROM incidents WHERE status NOT IN ('resolved','closed')
             ORDER BY FIELD(priority,'P1','P2','P3'), reported_at DESC LIMIT 6"
        )->fetchAll();

        $panels['recent_activity'] = $db->query(
            'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 8'
        )->fetchAll();

        $actions = [
            ['label' => '+ Wicitaan Gurmad', 'modal' => 'callModal'],
            ['label' => '+ Hawlgal Cusub',  'modal' => 'operationModal'],
            ['label' => 'Soo Saar Warbixin', 'modal' => 'reportModal'],
        ];
        break;

    // =========================================================
    // BAARE — kiisaskiisa iyo caddeymaha
    // =========================================================
    case 'Investigator':
        $oid = $auth['officer_id'];
        $myOpen   = $count("SELECT COUNT(*) FROM cases WHERE investigator_id = ? AND status != 'closed'", [$oid]);
        $myInvest = $count("SELECT COUNT(*) FROM cases WHERE investigator_id = ? AND status = 'investigating'", [$oid]);
        $myCourt  = $count("SELECT COUNT(*) FROM cases WHERE investigator_id = ? AND status = 'court'", [$oid]);
        $myEvid   = $count('SELECT COUNT(*) FROM evidence e JOIN cases c ON e.case_id = c.id WHERE c.investigator_id = ?', [$oid]);
        $myReps   = $count('SELECT COUNT(*) FROM field_reports WHERE submitted_by = ?', [$auth['user_id']]);

        $cards = [
            ['icon' => 'CS', 'tone' => 'blue',  'label' => 'Kiisaskayga Furan', 'value' => $myOpen,   'unit' => 'kiis',     'note' => 'Ku xilsaaran adiga'],
            ['icon' => 'BA', 'tone' => 'amber', 'label' => 'Baaritaan ku jira', 'value' => $myInvest, 'unit' => 'kiis',     'note' => 'Socda'],
            ['icon' => 'MX', 'tone' => 'red',   'label' => 'Maxkamad jooga',    'value' => $myCourt,  'unit' => 'kiis',     'note' => 'Sugaya dhageysi'],
            ['icon' => 'EV', 'tone' => 'green', 'label' => 'Caddeymahayga',     'value' => $myEvid,   'unit' => 'caddeyn',  'note' => "$myReps warbixin"],
        ];

        $stmt = $db->prepare(
            "SELECT case_number, title, type, priority, status, location, opened_at
             FROM cases WHERE investigator_id = ? AND status != 'closed'
             ORDER BY FIELD(priority,'high','medium','low'), opened_at DESC LIMIT 8"
        );
        $stmt->execute([$oid]);
        $panels['my_cases'] = $stmt->fetchAll();

        $stmt = $db->prepare(
            'SELECT report_number, title, type, status, priority, created_at
             FROM field_reports WHERE submitted_by = ? ORDER BY created_at DESC LIMIT 5'
        );
        $stmt->execute([$auth['user_id']]);
        $panels['my_reports'] = $stmt->fetchAll();

        $actions = [
            ['label' => '+ Warbixin Cusub', 'modal' => 'fieldReportModal'],
            ['label' => '+ Kiis Cusub',     'modal' => 'caseModal'],
        ];
        break;

    // =========================================================
    // SARKAALKA CADDEYMAHA
    // =========================================================
    case 'Evidence Officer':
        $evTotal   = $count('SELECT COUNT(*) FROM evidence');
        $evProc    = $count("SELECT COUNT(*) FROM evidence WHERE status = 'Processing'");
        $evVerif   = $count("SELECT COUNT(*) FROM evidence WHERE status = 'Verified'");
        $myReports = $count('SELECT COUNT(*) FROM field_reports WHERE submitted_by = ?', [$auth['user_id']]);

        $cards = [
            ['icon' => 'EV', 'tone' => 'blue',  'label' => 'Caddeymaha Guud', 'value' => $evTotal,   'unit' => 'caddeyn', 'note' => 'Diiwaanka guud'],
            ['icon' => 'PR', 'tone' => 'amber', 'label' => 'Baaritaan ku jira','value' => $evProc,    'unit' => 'caddeyn', 'note' => 'Lab-ka jooga'],
            ['icon' => 'VF', 'tone' => 'green', 'label' => 'La xaqiijiyey',   'value' => $evVerif,   'unit' => 'caddeyn', 'note' => 'Diyaar maxkamad'],
            ['icon' => 'FR', 'tone' => 'red',   'label' => 'Warbixinnadayda', 'value' => $myReports, 'unit' => 'warbixin','note' => 'La gudbiyey'],
        ];

        $panels['recent_evidence'] = $db->query(
            'SELECT evidence_number, name, type, location, status, collected_at
             FROM evidence ORDER BY id DESC LIMIT 8'
        )->fetchAll();

        $stmt = $db->prepare(
            'SELECT report_number, title, type, status, priority, created_at
             FROM field_reports WHERE submitted_by = ? ORDER BY created_at DESC LIMIT 5'
        );
        $stmt->execute([$auth['user_id']]);
        $panels['my_reports'] = $stmt->fetchAll();

        $actions = [['label' => '+ Warbixin Cusub', 'modal' => 'fieldReportModal']];
        break;

    // =========================================================
    // SARKAAL — muuqaalkiisa shaqo maalmeed
    // =========================================================
    default:
        $uid = $auth['user_id'];
        $oid = $auth['officer_id'];

        $myReports  = $count('SELECT COUNT(*) FROM field_reports WHERE submitted_by = ?', [$uid]);
        $myPending  = $count("SELECT COUNT(*) FROM field_reports WHERE submitted_by = ? AND status IN ('Gudbiyey','Dib u eegis')", [$uid]);
        $myApproved = $count("SELECT COUNT(*) FROM field_reports WHERE submitted_by = ? AND status = 'La ansixiyey'", [$uid]);
        $zoneInc    = $count("SELECT COUNT(*) FROM incidents WHERE status NOT IN ('resolved','closed')");
        $myTasks    = $count("SELECT COUNT(*) FROM workflow_tasks WHERE (assigned_to = ? OR assigned_role = ?) AND status NOT IN ('Completed','Cancelled')", [$uid, $role]);

        $shift = '—';
        if ($oid) {
            $stmt = $db->prepare('SELECT shift, `rank`, badge_id FROM officers WHERE id = ?');
            $stmt->execute([$oid]);
            if ($me = $stmt->fetch()) {
                $shift = 'Shift ' . $me['shift'];
                $panels['me'] = $me;
            }
        }

        $cards = [
            ['icon' => 'SH', 'tone' => 'blue',  'label' => 'Shift-kayga',      'value' => $shift,      'unit' => '',        'note' => 'Jadwalka maanta'],
            ['icon' => 'FR', 'tone' => 'green', 'label' => 'Warbixinnadayda',  'value' => $myReports,  'unit' => 'warbixin','note' => "$myApproved la ansixiyey"],
            ['icon' => 'WK', 'tone' => 'amber', 'label' => 'Hawlaha Sugaya',    'value' => $myTasks,    'unit' => 'hawl',     'note' => "$myPending report sugaya"],
            ['icon' => 'IN', 'tone' => 'red',   'label' => 'Dhacdooyin Furan', 'value' => $zoneInc,    'unit' => 'dhacdo',  'note' => 'Aagga guud'],
        ];

        $stmt = $db->prepare(
            'SELECT id, report_number, title, type, status, priority, review_note, created_at
             FROM field_reports WHERE submitted_by = ? ORDER BY created_at DESC LIMIT 8'
        );
        $stmt->execute([$uid]);
        $panels['my_reports'] = $stmt->fetchAll();

        $panels['active_incidents'] = $db->query(
            "SELECT incident_number, type, location, assigned_unit, priority, status, reported_at
             FROM incidents WHERE status NOT IN ('resolved','closed')
             ORDER BY FIELD(priority,'P1','P2','P3'), reported_at DESC LIMIT 5"
        )->fetchAll();

        $actions = [['label' => '+ Soo Gudbi Warbixin', 'modal' => 'fieldReportModal']];
        break;
}

// Per-user grants also control what appears on the dashboard.  This prevents
// a staff member from learning case/evidence/incident details through dashboard
// widgets after the Commander removes that section.
if (!empty($auth['custom_access'])) {
    $hasReports = authCanAccessPage($auth, 'myreports') || authCanAccessPage($auth, 'fieldreports');
    if (!authCanAccessPage($auth, 'cases')) {
        unset($panels['my_cases']);
        $cards = array_values(array_filter($cards, fn($c) => !preg_match('/Kiis|Baaritaan|Maxkamad/i', (string)($c['label'] ?? ''))));
    }
    if (!authCanAccessPage($auth, 'evidence')) {
        unset($panels['recent_evidence']);
        $cards = array_values(array_filter($cards, fn($c) => !preg_match('/Caddeyn/i', (string)($c['label'] ?? ''))));
    }
    if (!$hasReports) {
        unset($panels['my_reports'], $panels['pending_reports']);
        $cards = array_values(array_filter($cards, fn($c) => !preg_match('/Warbixin/i', (string)($c['label'] ?? ''))));
        $actions = array_values(array_filter($actions, fn($a) => !str_contains((string)($a['modal'] ?? ''), 'Report')));
    }
    if (!authCanAccessPage($auth, 'dispatch') && !authCanAccessPage($auth, 'command')) {
        unset($panels['active_incidents']);
        $cards = array_values(array_filter($cards, fn($c) => !preg_match('/Dhacdo|Wicitaan/i', (string)($c['label'] ?? ''))));
    }
    if (!authCanAccessPage($auth, 'roster')) {
        unset($panels['me']);
        $cards = array_values(array_filter($cards, fn($c) => !preg_match('/Shift/i', (string)($c['label'] ?? ''))));
    }
    if (!authCanAccessPage($auth, 'tasks')) {
        $cards = array_values(array_filter($cards, fn($c) => !preg_match('/Hawlaha/i', (string)($c['label'] ?? ''))));
    }
}

jsonResponse([
    'success'  => true,
    'role'     => $role,
    'user'     => ['full_name' => $auth['full_name'], 'officer_id' => $auth['officer_id']],
    'cards'    => $cards,
    'panels'   => $panels,
    'actions'  => $actions,
    'pages'    => $auth['pages'],
]);
