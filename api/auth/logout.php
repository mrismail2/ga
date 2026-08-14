<?php
require_once __DIR__ . '/../../includes/helpers.php';
setCorsHeaders();

if (!empty($_SESSION['user_id'])) {
    $uid = (int)$_SESSION['user_id'];
    auditLog($uid, 'logout', 'users', $uid);
    try { getDB()->prepare('UPDATE sessions SET revoked_at = NOW() WHERE id = ?')->execute([session_id()]); } catch (Throwable $e) {}
}
session_unset();
session_destroy();
jsonResponse(['success' => true, 'message' => 'Waa laga baxay nidaamka.']);
