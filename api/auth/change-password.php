<?php
require_once __DIR__ . '/../../includes/helpers.php';
setCorsHeaders();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('POST kaliya ayaa la aqbalaa.', 405);

$auth = requireAuth();
$input = getInput();
$current = (string)($input['current_password'] ?? '');
$new = (string)($input['new_password'] ?? '');
$confirm = (string)($input['confirm_password'] ?? '');
if ($current === '' || $new === '' || $confirm === '') jsonError('Dhammaan password fields waa lagama maarmaan.', 422);
if (!hash_equals($new, $confirm)) jsonError('Password-yada cusub isma laha.', 422);
if (hash_equals($current, $new)) jsonError('Password-ka cusub waa inuu ka duwan yahay kii hore.', 422);
enforcePasswordPolicy($new);

$db = getDB();
$stmt = $db->prepare('SELECT password_hash FROM users WHERE id = ? LIMIT 1');
$stmt->execute([$auth['user_id']]);
$hash = $stmt->fetchColumn();
if (!$hash || !password_verify($current, $hash)) {
    auditLog($auth['user_id'], 'password_change_failed', 'users', $auth['user_id'], null, 'failure');
    jsonError('Password-ka hadda waa khalad.', 401);
}

$newHash = password_hash($new, PASSWORD_BCRYPT, ['cost' => 12]);
$db->beginTransaction();
try {
    $db->prepare('UPDATE users SET password_hash = ?, password_changed_at = NOW(), force_password_change = 0, failed_login_count = 0, locked_until = NULL WHERE id = ?')
       ->execute([$newHash, $auth['user_id']]);
    $db->prepare('UPDATE sessions SET revoked_at = NOW() WHERE user_id = ? AND id <> ?')
       ->execute([$auth['user_id'], session_id()]);
    auditLog($auth['user_id'], 'password_changed', 'users', $auth['user_id']);
    $db->commit();
} catch (Throwable $e) {
    $db->rollBack();
    jsonError('Password-ka lama beddeli karin.', 500);
}
$_SESSION['force_password_change'] = false;
jsonResponse(['success' => true, 'message' => 'Password-ka waa la beddelay; sessions-kii kale waa la xiray.']);
