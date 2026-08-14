<?php
require_once __DIR__ . '/../includes/helpers.php';
require_once __DIR__ . '/../includes/mailer.php';
setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

function roleNameFromId(PDO $db, int $roleId): string {
    $stmt = $db->prepare('SELECT name FROM roles WHERE id=? LIMIT 1');
    $stmt->execute([$roleId]);
    $name = $stmt->fetchColumn();
    if (!$name) jsonError('Role-ka lama helin.', 422);
    return (string)$name;
}

function sendInvitationNow(PDO $db, array $invite, array $user, array $pages, string $rawToken): array {
    $inviteUrl = applicationBaseUrl() . '/accept-invite.html?token=' . rawurlencode($rawToken);
    $expiresText = date('d M Y H:i', strtotime($invite['expires_at']));
    $html = invitationEmailHtml($user['full_name'], $user['role'], $pages, $inviteUrl, $expiresText);
    $sent = sendHtmlMail($user['email'], 'Police Management System — Casuumaadda Akoonka', $html);
    $sendStatus = $sent['success'] ? 'sent' : (mailIsConfigured() ? 'failed' : 'not_configured');
    $db->prepare('UPDATE user_invitations SET send_status=?, send_error=?, last_sent_at=NOW() WHERE id=?')
       ->execute([$sendStatus, $sent['error'], $invite['id']]);
    return ['invite_url' => $inviteUrl, 'email_sent' => $sent['success'], 'send_status' => $sendStatus, 'send_error' => $sent['error']];
}

if ($method === 'GET') {
    $auth = requireCapability('invitations.manage');
    $where = ($auth['role'] === 'Super Admin') ? '' : "WHERE r.name NOT IN ('Super Admin','Commander')";
    $sql = "SELECT i.id,i.user_id,i.email,i.status,i.expires_at,i.accepted_at,i.last_sent_at,i.send_status,i.send_error,i.created_at,
                   u.full_name,u.status AS user_status,r.name AS role
            FROM user_invitations i JOIN users u ON i.user_id=u.id JOIN roles r ON u.role_id=r.id
            $where ORDER BY i.created_at DESC LIMIT 100";
    jsonResponse([
        'success' => true,
        'data' => $db->query($sql)->fetchAll(),
        'mail' => ['configured' => mailIsConfigured(), 'base_url' => applicationBaseUrl()],
    ]);
}

if ($method === 'POST') {
    $auth = requireCapability('invitations.manage');
    $input = getInput();
    $action = (string)($input['action'] ?? 'create');

    if ($action === 'create') {
        requireFields($input, ['full_name','email','role_id']);
        $email = strtolower(trim((string)$input['email']));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) jsonError('Email-ka shaqaalaha ma saxna.', 422);
        $roleId = (int)$input['role_id'];
        $role = roleNameFromId($db, $roleId);
        if ($auth['role'] !== 'Super Admin' && roleLevel($role) >= roleLevel('Commander')) {
            jsonError('Taliyuhu email invitation uma samayn karo Commander ama Super Admin kale.', 403);
        }

        $existingStmt = $db->prepare('SELECT u.id,u.full_name,u.email,u.status,r.name AS role FROM users u JOIN roles r ON u.role_id=r.id WHERE u.email=? LIMIT 1');
        $existingStmt->execute([$email]);
        $existing = $existingStmt->fetch();
        if ($existing && !in_array($existing['status'], ['invited','inactive'], true)) {
            jsonError('Email-kan wuxuu hore u leeyahay account firfircoon/xanniban. Isticmaal Rukhsadaha ama maamulka user-ka.', 409);
        }

        $pages = is_array($input['pages'] ?? null) ? $input['pages'] : [];
        $caps  = is_array($input['capabilities'] ?? null) ? $input['capabilities'] : [];
        $scope = (string)($input['scope'] ?? dataScope($role));
        $grant = sanitizePermissionGrant($auth, $role, $pages, $caps, $scope);
        $officerId = !empty($input['officer_id']) ? (int)$input['officer_id'] : null;
        $clearance = in_array(($input['security_clearance'] ?? ''), ['Public','Official','Restricted','Secret'], true)
            ? $input['security_clearance'] : 'Official';

        $db->beginTransaction();
        try {
            if ($existing) {
                $userId = (int)$existing['id'];
                assertCanManageUser($auth, $userId);
                $db->prepare('UPDATE users SET full_name=?,role_id=?,officer_id=?,security_clearance=?,status="invited",station_id=1 WHERE id=?')
                   ->execute([$input['full_name'], $roleId, $officerId, $clearance, $userId]);
                $db->prepare("UPDATE user_invitations SET status='revoked' WHERE user_id=? AND status='pending'")->execute([$userId]);
            } else {
                $placeholder = password_hash(bin2hex(random_bytes(32)), PASSWORD_BCRYPT, ['cost' => 12]);
                $db->prepare('INSERT INTO users (full_name,email,password_hash,role_id,officer_id,station_id,security_clearance,force_password_change,status) VALUES (?,?,?,?,?,1,?,1,"invited")')
                   ->execute([$input['full_name'], $email, $placeholder, $roleId, $officerId, $clearance]);
                $userId = (int)$db->lastInsertId();
            }

            $db->prepare(
                'INSERT INTO user_permissions (user_id,allowed_pages,allowed_capabilities,data_scope,granted_by)
                 VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE allowed_pages=VALUES(allowed_pages),allowed_capabilities=VALUES(allowed_capabilities),data_scope=VALUES(data_scope),granted_by=VALUES(granted_by),updated_at=CURRENT_TIMESTAMP'
            )->execute([
                $userId,
                json_encode($grant['pages'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                json_encode($grant['capabilities'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                $grant['scope'], $auth['user_id'],
            ]);

            $token = bin2hex(random_bytes(32));
            $hash = hash('sha256', $token);
            $expiresAt = date('Y-m-d H:i:s', time() + 48 * 3600);
            $db->prepare('INSERT INTO user_invitations (user_id,email,token_hash,status,expires_at,send_status,created_by) VALUES (?,?,?,"pending",?,"pending",?)')
               ->execute([$userId, $email, $hash, $expiresAt, $auth['user_id']]);
            $inviteId = (int)$db->lastInsertId();
            $db->commit();
        } catch (Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            throw $e;
        }

        $userForMail = ['full_name' => (string)$input['full_name'], 'email' => $email, 'role' => $role];
        $inviteForMail = ['id' => $inviteId, 'expires_at' => $expiresAt];
        $delivery = sendInvitationNow($db, $inviteForMail, $userForMail, $grant['pages'], $token);
        auditLog($auth['user_id'], 'invite_create', 'users', $userId, $email . ' · ' . $delivery['send_status']);

        jsonResponse([
            'success' => true,
            'id' => $userId,
            'invitation_id' => $inviteId,
            'message' => $delivery['email_sent']
                ? 'Shaqaalaha email invitation ayaa loo diray.'
                : 'Akoonka iyo rukhsadaha waa la sameeyey. SMTP weli ma dirin email-ka; link-ga casuumaadda waad koobi-gareyn kartaa.',
        ] + $delivery, 201);
    }

    if ($action === 'resend') {
        $inviteId = (int)($input['invitation_id'] ?? 0);
        if (!$inviteId) jsonError('Invitation ID waa lagama maarmaan.', 422);
        $stmt = $db->prepare('SELECT i.*,u.full_name,u.email AS user_email,u.id AS uid,r.name AS role FROM user_invitations i JOIN users u ON i.user_id=u.id JOIN roles r ON u.role_id=r.id WHERE i.id=? LIMIT 1');
        $stmt->execute([$inviteId]);
        $row = $stmt->fetch();
        if (!$row) jsonError('Invitation-ka lama helin.', 404);
        assertCanManageUser($auth, (int)$row['uid']);
        if ($row['status'] === 'accepted') jsonError('Invitation-kan hore ayaa loo aqbalay.', 409);

        $access = effectiveUserAccess((int)$row['uid'], $row['role']);
        $token = bin2hex(random_bytes(32));
        $expiresAt = date('Y-m-d H:i:s', time() + 48 * 3600);
        $db->prepare('UPDATE users SET status="invited" WHERE id=?')->execute([(int)$row['uid']]);
        $db->prepare('UPDATE user_invitations SET token_hash=?,status="pending",expires_at=?,accepted_at=NULL,send_status="pending",send_error=NULL WHERE id=?')
           ->execute([hash('sha256',$token), $expiresAt, $inviteId]);
        $delivery = sendInvitationNow($db, ['id'=>$inviteId,'expires_at'=>$expiresAt], ['full_name'=>$row['full_name'],'email'=>$row['user_email'],'role'=>$row['role']], $access['pages'], $token);
        auditLog($auth['user_id'], 'invite_resend', 'users', (int)$row['uid'], $row['user_email'] . ' · ' . $delivery['send_status']);
        jsonResponse(['success'=>true,'message'=>$delivery['email_sent']?'Email-ka mar kale waa la diray.':'Email lama dirin; isticmaal link-ga casuumaadda ama deji SMTP.'] + $delivery);
    }

    if ($action === 'revoke') {
        $inviteId = (int)($input['invitation_id'] ?? 0);
        if (!$inviteId) jsonError('Invitation ID waa lagama maarmaan.', 422);
        $stmt = $db->prepare('SELECT i.user_id,u.status FROM user_invitations i JOIN users u ON i.user_id=u.id WHERE i.id=? LIMIT 1');
        $stmt->execute([$inviteId]);
        $row = $stmt->fetch();
        if (!$row) jsonError('Invitation-ka lama helin.',404);
        assertCanManageUser($auth,(int)$row['user_id']);
        $db->prepare("UPDATE user_invitations SET status='revoked' WHERE id=? AND status='pending'")->execute([$inviteId]);
        if ($row['status'] === 'invited') $db->prepare("UPDATE users SET status='inactive' WHERE id=?")->execute([$row['user_id']]);
        auditLog($auth['user_id'],'invite_revoke','users',(int)$row['user_id'],'Invitation revoked');
        jsonResponse(['success'=>true,'message'=>'Casuumaadda waa la joojiyey.']);
    }

    jsonError('Action-ka invitation-ka lama aqoonsan.', 422);
}

jsonError('Method-ka la isticmaalay lama aqbalo.', 405);
