<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/permissions.php';

const SESSION_IDLE_SECONDS = 1800;

function startSecureSession(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['SERVER_PORT'] ?? '') === '443');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}

function csrfToken(): string {
    startSecureSession();
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function verifyCsrf(): void {
    startSecureSession();
    $provided = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    $expected = $_SESSION['csrf_token'] ?? '';
    if ($expected === '' || $provided === '' || !hash_equals($expected, $provided)) {
        jsonError('Codsiga amniga lama xaqiijin. Dib u fur bogga oo isku day mar kale.', 419);
    }
}

function requestId(): string {
    static $id;
    if (!$id) $id = bin2hex(random_bytes(12));
    return $id;
}

function jsonResponse(array $data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Request-ID: ' . requestId());
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function jsonError(string $message, int $status = 400): void {
    jsonResponse(['success' => false, 'error' => $message, 'request_id' => requestId()], $status);
}

function getInput(): array {
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);
    return is_array($data) ? $data : [];
}

function requireAuth(): array {
    startSecureSession();
    if (empty($_SESSION['user_id'])) {
        jsonError('Fadlan gal nidaamka.', 401);
    }

    $last = (int)($_SESSION['last_activity'] ?? time());
    if (time() - $last > SESSION_IDLE_SECONDS) {
        $uid = (int)$_SESSION['user_id'];
        try {
            getDB()->prepare('UPDATE sessions SET revoked_at = NOW() WHERE id = ?')->execute([session_id()]);
            auditLog($uid, 'session_timeout', 'sessions', null, '30 daqiiqo dhaqdhaqaaq la’aan', 'success');
        } catch (Throwable $e) { /* session expiry must still continue */ }
        session_unset();
        session_destroy();
        jsonError('Fadhigaaga wuu dhammaaday. Fadlan dib u gal.', 401);
    }
    $_SESSION['last_activity'] = time();

    // Server-side session revocation: permission/status changes can terminate
    // a staff session immediately, not merely hide menus after refresh.
    try {
        $sessionStmt = getDB()->prepare('SELECT revoked_at, expires_at FROM sessions WHERE id = ? AND user_id = ? LIMIT 1');
        $sessionStmt->execute([session_id(), (int)$_SESSION['user_id']]);
        $sessionRow = $sessionStmt->fetch();
        if ($sessionRow && (!empty($sessionRow['revoked_at']) || strtotime((string)$sessionRow['expires_at']) <= time())) {
            session_unset();
            session_destroy();
            jsonError('Fadhigaaga waa la xiray. Fadlan dib u gal.', 401);
        }
    } catch (Throwable $e) { /* backwards compatibility during migration */ }

    // Accounts marked for a mandatory password change may only access the
    // session, logout and change-password endpoints until the password is updated.
    if (!empty($_SESSION['force_password_change'])) {
        $script = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '');
        $allowed = str_ends_with($script, '/api/auth/session.php')
            || str_ends_with($script, '/api/auth/logout.php')
            || str_ends_with($script, '/api/auth/change-password.php');
        if (!$allowed) jsonError('Password-ka waa inaad beddeshaa ka hor intaadan nidaamka isticmaalin.', 428);
    }

    try {
        getDB()->prepare('UPDATE sessions SET last_activity_at = NOW(), expires_at = DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE id = ? AND revoked_at IS NULL')->execute([session_id()]);
    } catch (Throwable $e) { /* database migration may not yet be applied */ }

    $role = $_SESSION['role'] ?? 'Officer';
    $access = effectiveUserAccess((int)$_SESSION['user_id'], $role);

    return [
        'user_id'      => (int)$_SESSION['user_id'],
        'role'         => $role,
        'officer_id'   => isset($_SESSION['officer_id']) ? (int)$_SESSION['officer_id'] : null,
        'station_id'   => 1,
        'full_name'    => $_SESSION['full_name'] ?? '',
        'clearance'    => $_SESSION['security_clearance'] ?? 'Official',
        'pages'        => $access['pages'],
        'capabilities' => $access['capabilities'],
        'scope'        => $access['scope'],
        'custom_access'=> $access['custom'],
    ];
}

function requireRole(array $allowed): array {
    $auth = requireAuth();
    if (!in_array($auth['role'], $allowed, true)) {
        auditLog($auth['user_id'], 'access_denied', 'roles', null, implode(',', $allowed), 'denied');
        jsonError('Awood uma lihid ficilkan.', 403);
    }
    return $auth;
}

function auditLog(int $userId, string $action, string $entityType, ?int $entityId = null, ?string $details = null, string $outcome = 'success'): void {
    $db = getDB();
    $stmt = $db->prepare('INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, ip_address, user_agent, request_id, outcome) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([
        $userId,
        $action,
        $entityType,
        $entityId,
        $details,
        $_SERVER['REMOTE_ADDR'] ?? null,
        substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255),
        requestId(),
        $outcome,
    ]);
}

function revokeUserSessions(int $userId, ?string $exceptSessionId = null): void {
    try {
        if ($exceptSessionId) {
            getDB()->prepare('UPDATE sessions SET revoked_at = NOW() WHERE user_id = ? AND id <> ? AND revoked_at IS NULL')->execute([$userId, $exceptSessionId]);
        } else {
            getDB()->prepare('UPDATE sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL')->execute([$userId]);
        }
    } catch (Throwable $e) { /* non-fatal on legacy DB */ }
}

function paginate(string $table, array $conditions = [], string $orderBy = 'id DESC', int $defaultLimit = 20): array {
    $db = getDB();
    $page  = max(1, (int)($_GET['page'] ?? 1));
    $limit = min(100, max(1, (int)($_GET['limit'] ?? $defaultLimit)));
    $offset = ($page - 1) * $limit;

    $where = '';
    $params = [];
    if (!empty($conditions)) {
        $clauses = [];
        foreach ($conditions as $col => $val) {
            if (!preg_match('/^[A-Za-z0-9_]+$/', $col)) jsonError('Filter aan sax ahayn.', 422);
            $clauses[] = "`$col` = ?";
            $params[]  = $val;
        }
        $where = 'WHERE ' . implode(' AND ', $clauses);
    }

    if (!preg_match('/^[A-Za-z0-9_`,. ]+(ASC|DESC)?$/i', $orderBy)) $orderBy = 'id DESC';
    $countStmt = $db->prepare("SELECT COUNT(*) FROM `$table` $where");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    $dataStmt = $db->prepare("SELECT * FROM `$table` $where ORDER BY $orderBy LIMIT ? OFFSET ?");
    $params[] = $limit;
    $params[] = $offset;
    $dataStmt->execute($params);
    $rows = $dataStmt->fetchAll();

    return [
        'data'        => $rows,
        'total'       => $total,
        'page'        => $page,
        'limit'       => $limit,
        'total_pages' => (int)ceil($total / $limit),
    ];
}

function searchTable(string $table, array $searchCols, string $query, string $orderBy = 'id DESC', int $limit = 20): array {
    $db = getDB();
    $clauses = [];
    $params  = [];
    foreach ($searchCols as $col) {
        if (!preg_match('/^[A-Za-z0-9_]+$/', $col)) continue;
        $clauses[] = "`$col` LIKE ?";
        $params[]  = "%$query%";
    }
    if (!$clauses) return [];
    $where = 'WHERE (' . implode(' OR ', $clauses) . ')';
    $stmt  = $db->prepare("SELECT * FROM `$table` $where ORDER BY $orderBy LIMIT ?");
    $params[] = min(100, max(1, $limit));
    $stmt->execute($params);
    return $stmt->fetchAll();
}

function uniqueReference(string $prefix, string $table, string $column): string {
    $db = getDB();
    for ($i = 0; $i < 8; $i++) {
        $ref = $prefix . '-' . date('Y') . '-' . str_pad((string)random_int(1, 99999), 5, '0', STR_PAD_LEFT);
        $stmt = $db->prepare("SELECT 1 FROM `$table` WHERE `$column` = ? LIMIT 1");
        $stmt->execute([$ref]);
        if (!$stmt->fetchColumn()) return $ref;
    }
    throw new RuntimeException('Reference gaar ah lama abuuri karin.');
}

function requireFields(array $input, array $fields): void {
    foreach ($fields as $field) {
        if (!isset($input[$field]) || trim((string)$input[$field]) === '') {
            jsonError("$field waa lagama maarmaan.", 422);
        }
    }
}

function normalizeDateTimeValue(?string $value): ?string {
    if ($value === null || trim($value) === '') return null;
    $normalized = str_replace('T', ' ', trim($value));
    if (preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/', $normalized)) $normalized .= ':00';
    return $normalized;
}

function enforcePasswordPolicy(string $password): void {
    $valid = strlen($password) >= 10
        && preg_match('/[a-z]/', $password)
        && preg_match('/[A-Z]/', $password)
        && preg_match('/\d/', $password);
    if (!$valid) jsonError('Password-ku waa inuu leeyahay ugu yaraan 10 xaraf, xaraf weyn, xaraf yar iyo tiro.', 422);
}

function setCorsHeaders(): void {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $host = $_SERVER['HTTP_HOST'] ?? '';
    if ($origin !== '' && $host !== '') {
        $originHost = parse_url($origin, PHP_URL_HOST);
        $requestHost = explode(':', $host)[0];
        if ($originHost === $requestHost) {
            header("Access-Control-Allow-Origin: $origin");
            header('Vary: Origin');
            header('Access-Control-Allow-Credentials: true');
        }
    }
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: no-referrer');
    header("Permissions-Policy: camera=(), microphone=(), geolocation=(self)");

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }

    startSecureSession();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $script = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '');
    $csrfExempt = ($method === 'POST' && str_ends_with($script, '/api/auth/login.php'))
        || ($method === 'POST' && str_ends_with($script, '/api/contacts.php'))
        || ($method === 'POST' && str_ends_with($script, '/api/invite-accept.php'));
    if (in_array($method, ['POST','PUT','DELETE','PATCH'], true) && !$csrfExempt && !empty($_SESSION['user_id'])) {
        verifyCsrf();
    }
}
