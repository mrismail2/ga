<?php
require_once __DIR__ . '/../includes/helpers.php';
setCorsHeaders();

$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];

function findValidInvite(PDO $db, string $rawToken): array {
    if (!preg_match('/^[a-f0-9]{64}$/i', $rawToken)) jsonError('Link-ga casuumaaddu ma saxna.', 422);
    $hash = hash('sha256', $rawToken);
    $stmt = $db->prepare("SELECT i.*,u.full_name,u.email,u.status AS user_status,u.role_id,r.name AS role
                          FROM user_invitations i JOIN users u ON i.user_id=u.id JOIN roles r ON u.role_id=r.id
                          WHERE i.token_hash=? AND i.status='pending' LIMIT 1");
    $stmt->execute([$hash]);
    $invite = $stmt->fetch();
    if (!$invite) jsonError('Casuumaaddan lama helin ama waa la isticmaalay.', 404);
    if (strtotime($invite['expires_at']) < time()) {
        $db->prepare("UPDATE user_invitations SET status='expired' WHERE id=?")->execute([$invite['id']]);
        jsonError('Casuumaaddan way dhacday. Taliyaha ka codso email cusub.', 410);
    }
    if ($invite['user_status'] !== 'invited') jsonError('Akoonkan mar hore ayaa la hawlgeliyey ama la joojiyey.', 409);
    return $invite;
}

if ($method === 'GET') {
    $token = trim((string)($_GET['token'] ?? ''));
    $invite = findValidInvite($db, $token);
    $access = effectiveUserAccess((int)$invite['user_id'], $invite['role']);
    $pageLabels = array_map(fn($p) => PAGE_LABELS[$p] ?? $p, $access['pages']);
    jsonResponse(['success'=>true,'invite'=>[
        'full_name'=>$invite['full_name'],'email'=>$invite['email'],'role'=>$invite['role'],
        'expires_at'=>$invite['expires_at'],'pages'=>$pageLabels,
    ]]);
}

if ($method === 'POST') {
    $input = getInput();
    $token = trim((string)($input['token'] ?? ''));
    $password = (string)($input['password'] ?? '');
    $confirm = (string)($input['confirm_password'] ?? '');
    if ($password !== $confirm) jsonError('Labada password isku mid ma aha.', 422);
    enforcePasswordPolicy($password);
    $invite = findValidInvite($db, $token);

    $db->beginTransaction();
    try {
        $hash = password_hash($password, PASSWORD_BCRYPT, ['cost'=>12]);
        $db->prepare("UPDATE users SET password_hash=?,status='active',force_password_change=0,password_changed_at=NOW(),failed_login_count=0,locked_until=NULL WHERE id=?")
           ->execute([$hash, $invite['user_id']]);
        $db->prepare("UPDATE user_invitations SET status='accepted',accepted_at=NOW() WHERE id=?")->execute([$invite['id']]);
        $db->prepare("UPDATE user_invitations SET status='revoked' WHERE user_id=? AND id<>? AND status='pending'")->execute([$invite['user_id'],$invite['id']]);
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }
    auditLog((int)$invite['user_id'],'invite_accept','users',(int)$invite['user_id'],'Account activated by invitation');
    jsonResponse(['success'=>true,'message'=>'Akoonka waa la hawlgeliyey. Hadda email-kaaga iyo password-ka cusub ku gal nidaamka.']);
}

jsonError('Method-ka la isticmaalay lama aqbalo.',405);
