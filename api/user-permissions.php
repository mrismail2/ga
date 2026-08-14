<?php
require_once __DIR__ . '/../includes/helpers.php';
setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

if ($method === 'GET') {
    $auth = requireCapability('permissions.manage');
    $catalog = permissionCatalogForActor($auth);
    $userId = (int)($_GET['user_id'] ?? 0);
    if (!$userId) {
        jsonResponse(['success' => true, 'catalog' => $catalog]);
    }

    $target = assertCanManageUser($auth, $userId);
    $effective = effectiveUserAccess($userId, $target['role']);
    jsonResponse([
        'success' => true,
        'user' => $target,
        'permissions' => [
            'pages' => $effective['pages'],
            'capabilities' => $effective['capabilities'],
            'scope' => $effective['scope'],
            'custom' => $effective['custom'],
        ],
        'role_defaults' => [
            'pages' => rolePages($target['role']),
            'capabilities' => roleCapabilities($target['role']),
            'scope' => dataScope($target['role']),
        ],
        'catalog' => $catalog,
    ]);
}

if ($method === 'PUT') {
    $auth = requireCapability('permissions.manage');
    $input = getInput();
    $userId = (int)($input['user_id'] ?? 0);
    if (!$userId) jsonError('User ID waa lagama maarmaan.', 422);
    $target = assertCanManageUser($auth, $userId);

    $pages = is_array($input['pages'] ?? null) ? $input['pages'] : [];
    $caps  = is_array($input['capabilities'] ?? null) ? $input['capabilities'] : [];
    $scope = (string)($input['scope'] ?? dataScope($target['role']));
    $grant = sanitizePermissionGrant($auth, $target['role'], $pages, $caps, $scope);

    $stmt = $db->prepare(
        'INSERT INTO user_permissions (user_id, allowed_pages, allowed_capabilities, data_scope, granted_by)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE allowed_pages=VALUES(allowed_pages), allowed_capabilities=VALUES(allowed_capabilities),
         data_scope=VALUES(data_scope), granted_by=VALUES(granted_by), updated_at=CURRENT_TIMESTAMP'
    );
    $stmt->execute([
        $userId,
        json_encode($grant['pages'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        json_encode($grant['capabilities'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        $grant['scope'],
        $auth['user_id'],
    ]);
    auditLog($auth['user_id'], 'permissions_update', 'users', $userId,
        'pages=' . implode(',', $grant['pages']) . '; capabilities=' . implode(',', $grant['capabilities']) . '; scope=' . $grant['scope']);

    // Apply immediately by ending existing sessions for the affected employee.
    revokeUserSessions($userId);

    jsonResponse([
        'success' => true,
        'message' => 'Rukhsadaha shaqaalaha waa la kaydiyey. Session-kiisii hore waa la xiray si isbeddelku isla markiiba u dhaqan galo.',
        'permissions' => $grant,
    ]);
}

jsonError('Method-ka la isticmaalay lama aqbalo.', 405);
