<?php
require_once __DIR__ . '/../../includes/helpers.php';
setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('POST kaliya ayaa la aqbalaa.', 405);

$input = getInput();
$email = strtolower(trim($input['email'] ?? ''));
$password = (string)($input['password'] ?? '');
if ($email === '' || $password === '') jsonError('Email iyo password waa lagama maarmaan.', 422);

$db = getDB();
$ip = $_SERVER['REMOTE_ADDR'] ?? null;
$rate = $db->prepare("SELECT COUNT(*) FROM login_attempts WHERE email = ? AND success = 0 AND attempted_at >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)");
$rate->execute([$email]);
if ((int)$rate->fetchColumn() >= 5) {
    jsonError('Isku-dayo badan ayaa dhacay. Sug 15 daqiiqo ama la xiriir maamulaha.', 429);
}

$stmt = $db->prepare('SELECT u.*, r.name AS role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.email = ? LIMIT 1');
$stmt->execute([$email]);
$user = $stmt->fetch();

$valid = $user && $user['status'] === 'active' && (empty($user['locked_until']) || strtotime($user['locked_until']) <= time()) && password_verify($password, $user['password_hash']);
$db->prepare('INSERT INTO login_attempts (email, ip_address, success) VALUES (?, ?, ?)')->execute([$email, $ip, $valid ? 1 : 0]);

if (!$valid) {
    if ($user) {
        $db->prepare("UPDATE users SET failed_login_count = LEAST(failed_login_count + 1, 255), locked_until = CASE WHEN failed_login_count + 1 >= 5 THEN DATE_ADD(NOW(), INTERVAL 15 MINUTE) ELSE locked_until END WHERE id = ?")->execute([$user['id']]);
        auditLog((int)$user['id'], 'login_failed', 'users', (int)$user['id'], 'Aqoonsi khaldan ama account xiran', 'failure');
    }
    jsonError('Email ama password-ka waa khalad.', 401);
}

session_regenerate_id(true);
$_SESSION['user_id']    = (int)$user['id'];
$_SESSION['full_name']  = $user['full_name'];
$_SESSION['email']      = $user['email'];
$_SESSION['role']       = $user['role_name'];
$_SESSION['officer_id'] = $user['officer_id'];
$_SESSION['station_id'] = 1;
$_SESSION['photo_url']  = $user['photo_url'] ?? null;
$_SESSION['security_clearance'] = $user['security_clearance'] ?? 'Official';
$_SESSION['force_password_change'] = (bool)($user['force_password_change'] ?? false);
$_SESSION['last_activity'] = time();
$csrf = csrfToken();

$db->prepare('UPDATE users SET last_login = NOW(), failed_login_count = 0, locked_until = NULL WHERE id = ?')->execute([$user['id']]);
$db->prepare('REPLACE INTO sessions (id,user_id,ip_address,user_agent,expires_at,last_activity_at,revoked_at) VALUES (?,?,?,?,DATE_ADD(NOW(),INTERVAL 30 MINUTE),NOW(),NULL)')->execute([
    session_id(), $user['id'], $ip, substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255)
]);
auditLog((int)$user['id'], 'login', 'users', (int)$user['id'], 'Gal guul leh');

$access = effectiveUserAccess((int)$user['id'], $user['role_name']);
jsonResponse([
    'success' => true,
    'csrf_token' => $csrf,
    'user' => [
        'id' => (int)$user['id'], 'full_name' => $user['full_name'], 'email' => $user['email'],
        'role' => $user['role_name'], 'officer_id' => $user['officer_id'], 'station_id' => 1,
        'photo_url' => $user['photo_url'] ?? null, 'security_clearance' => $user['security_clearance'] ?? 'Official',
        'force_password_change' => (bool)($user['force_password_change'] ?? false),
        'pages' => $access['pages'], 'capabilities' => $access['capabilities'],
        'scope' => $access['scope'], 'custom_access' => $access['custom'],
    ],
]);
