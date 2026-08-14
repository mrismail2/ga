<?php
/**
 * Central RBAC + per-user permission grants.
 *
 * Role = ceiling/default.  The Commander can then grant each staff member an
 * individual subset of pages and actions.  Server-side checks are authoritative;
 * hiding a menu item is only a UI convenience.
 */
const ROLE_HIERARCHY = [
    'Super Admin'      => 100,
    'Commander'        => 80,
    'Investigator'     => 60,
    'Evidence Officer' => 40,
    'Officer'          => 20,
];

const PAGE_LABELS = [
    'overview'      => 'Dashboard',
    'command'       => 'Command Center',
    'dispatch'      => 'Wicitaannada & Dispatch',
    'operations'    => 'Hawlgallada',
    'officers'      => 'Saraakiisha',
    'roster'        => 'Jadwalka Shaqada',
    'cases'         => 'Kiisaska',
    'arrests'       => 'Xarig & Warrants',
    'citizens'      => 'Muwaadiniinta',
    'evidence'      => 'Caddeymaha',
    'documents'     => 'Dukumentiyada',
    'custody'       => 'Custody & Booking',
    'prison'        => 'Maxaabiista',
    'patrol'        => 'Patrol',
    'traffic'       => 'Traffic & Vehicles',
    'intelligence'  => 'Sirdoonka',
    'complaints'    => 'Cabashooyinka',
    'tasks'         => 'Hawlaha',
    'fieldreports'  => 'Warbixinnada Ciidanka',
    'myreports'     => 'Warbixinnadayda',
    'reports'       => 'Warbixinnada Guud',
    'finance'       => 'Miisaaniyadda',
    'users'         => 'Users & Permissions',
    'profile'       => 'Profile-kayga',
    'settings'      => 'Settings',
];

const CAPABILITY_LABELS = [
    'reports.submit'       => 'Gudbi warbixin',
    'reports.generate'     => 'Soo saar warbixin guud',
    'reports.review'       => 'Dib u eeg/ansixi warbixin',
    'reports.view_all'     => 'Arag warbixinnada oo dhan',
    'officers.manage'      => 'Maamul saraakiisha',
    'roster.manage'        => 'Maamul jadwalka shaqada',
    'roster.update_own'    => 'Cusboonaysii xaaladda duty-gaaga',
    'cases.manage'         => 'Abuur/bedel kiisaska',
    'cases.view_all'       => 'Arag kiisaska oo dhan',
    'arrests.manage'       => 'Maamul xarigga',
    'warrants.manage'      => 'Maamul warrants',
    'custody.check'        => 'Diiwaangeli welfare check',
    'custody.manage'       => 'Maamul custody-ga',
    'evidence.manage'      => 'Maamul caddeymaha',
    'dispatch.manage'      => 'Maamul dispatch-ka',
    'operations.manage'    => 'Maamul hawlgallada/patrol',
    'intelligence.manage'  => 'Maamul sirdoonka',
    'finance.manage'       => 'Maamul kharashaadka',
    'complaints.manage'    => 'Maamul cabashooyinka',
    'citizens.manage'      => 'Maamul muwaadiniinta',
    'fleet.manage'         => 'Maamul gaadiidka',
    'tasks.update'         => 'Cusboonaysii hawlaha loo xilsaaray',
    'tasks.manage'         => 'Abuur/qoondee hawlaha',
    'documents.manage'     => 'Upload/maamul dukumentiyada',
    'users.manage'         => 'Maamul users-ka',
    'permissions.manage'   => 'Qoondee rukhsadaha shaqaalaha',
    'invitations.manage'   => 'Dir/maamul email invitations',
    'settings.manage'      => 'Maamul settings-ka nidaamka',
];

const CAPABILITY_PAGES = [
    'reports.submit' => ['fieldreports','myreports'], 'reports.generate' => ['reports'], 'reports.review' => ['fieldreports'], 'reports.view_all' => ['fieldreports'],
    'officers.manage' => ['officers'], 'roster.manage' => ['roster'], 'roster.update_own' => ['roster'],
    'cases.manage' => ['cases'], 'cases.view_all' => ['cases'], 'arrests.manage' => ['arrests'], 'warrants.manage' => ['arrests'],
'custody.check' => ['custody'], 'custody.manage' => ['custody','prison'], 'evidence.manage' => ['evidence'],
'dispatch.manage' => ['dispatch'], 'operations.manage' => ['operations','patrol'],
'intelligence.manage' => ['intelligence'],
'finance.manage' => ['finance'], 'complaints.manage' => ['complaints'],
    'citizens.manage' => ['citizens'], 'fleet.manage' => ['traffic'], 'tasks.update' => ['tasks'], 'tasks.manage' => ['tasks'],
    'documents.manage' => ['documents'], 'users.manage' => ['users'], 'permissions.manage' => ['users'],
    'invitations.manage' => ['users'], 'settings.manage' => ['settings'],
];

const ROLE_PAGES = [
    'Super Admin' => [
        'overview','command','dispatch','operations','officers','roster','cases','arrests','citizens',
        'evidence','documents','custody','prison','patrol','traffic','intelligence','complaints','tasks',
        'fieldreports','reports','finance','users','profile','settings',
    ],
    'Commander' => [
        'overview','command','dispatch','operations','officers','roster','cases','arrests','citizens',
        'evidence','documents','custody','prison','patrol','traffic','intelligence','complaints','tasks',
        'fieldreports','reports','finance','users','profile',
    ],
    'Investigator' => [
        'overview','dispatch','cases','arrests','citizens','evidence','documents','custody','prison','intelligence',
        'tasks','fieldreports','myreports','profile',
    ],
    'Evidence Officer' => [
        'overview','evidence','documents','cases','custody','tasks','myreports','profile',
    ],
    'Officer' => [
        'overview','dispatch','roster','patrol','tasks','myreports','profile',
    ],
];

const ROLE_CAPABILITIES = [
    'Super Admin' => [
        'reports.submit','reports.generate','reports.review','reports.view_all','officers.manage','roster.manage','roster.update_own',
        'cases.manage','cases.view_all','arrests.manage','warrants.manage','custody.check','custody.manage',
        'evidence.manage','dispatch.manage','operations.manage','intelligence.manage',
        'finance.manage','complaints.manage','citizens.manage','fleet.manage','tasks.update','tasks.manage',
        'users.manage','permissions.manage','invitations.manage','settings.manage','documents.manage',
    ],
    'Commander' => [
        'reports.submit','reports.generate','reports.review','reports.view_all','officers.manage','roster.manage','roster.update_own',
        'cases.manage','cases.view_all','arrests.manage','warrants.manage','custody.check','custody.manage',
        'evidence.manage','dispatch.manage','operations.manage','intelligence.manage',
        'finance.manage','complaints.manage','citizens.manage','fleet.manage','tasks.update','tasks.manage',
        'users.manage','permissions.manage','invitations.manage','documents.manage',
    ],
    'Investigator' => [
        'reports.submit','cases.manage','arrests.manage','evidence.manage','citizens.manage',
        'tasks.update','documents.manage',
    ],
    'Evidence Officer' => [
        'reports.submit','evidence.manage','tasks.update','documents.manage',
    ],
    'Officer' => [
        'reports.submit','roster.update_own','tasks.update',
    ],
];

const ROLE_DATA_SCOPE = [
    'Super Admin' => 'all', 'Commander' => 'all', 'Investigator' => 'assigned',
    'Evidence Officer' => 'assigned', 'Officer' => 'own',
];

/** Pages the Commander may delegate to ordinary staff. */
const STAFF_ASSIGNABLE_PAGES = [
    'overview','command','dispatch','operations','officers','roster','cases','arrests','citizens','evidence',
    'documents','custody','prison','patrol','traffic','intelligence','complaints','tasks','fieldreports','myreports',
    'reports','finance','profile',
];

/** Capabilities the Commander may delegate to ordinary staff. */
const STAFF_ASSIGNABLE_CAPABILITIES = [
    'reports.submit','reports.generate','reports.review','reports.view_all','officers.manage','roster.manage','roster.update_own','cases.manage','cases.view_all',
    'arrests.manage','warrants.manage','custody.check','custody.manage','evidence.manage','dispatch.manage',
    'operations.manage','intelligence.manage','finance.manage','complaints.manage',
    'citizens.manage','fleet.manage','tasks.update','tasks.manage','documents.manage',
];

function roleLevel(string $role): int { return ROLE_HIERARCHY[$role] ?? 0; }
function rolePages(string $role): array { return ROLE_PAGES[$role] ?? ROLE_PAGES['Officer']; }
function roleCapabilities(string $role): array { return ROLE_CAPABILITIES[$role] ?? ROLE_CAPABILITIES['Officer']; }
function dataScope(string $role): string { return ROLE_DATA_SCOPE[$role] ?? 'own'; }
function canAccessPage(string $role, string $page): bool { return in_array($page, rolePages($role), true); }
function hasCapability(string $role, string $capability): bool { return in_array($capability, roleCapabilities($role), true); }

function cleanPermissionList(array $values, array $allowed): array {
    $values = array_values(array_unique(array_filter(array_map('strval', $values))));
    return array_values(array_intersect($values, $allowed));
}

/**
 * Effective per-user access. If the per-user migration/table is not available yet,
 * role defaults are used so older databases continue to run until migrated.
 */
function effectiveUserAccess(int $userId, string $role): array {
    $fallback = ['pages' => rolePages($role), 'capabilities' => roleCapabilities($role), 'scope' => dataScope($role), 'custom' => false];
    if ($userId <= 0) return $fallback;

    try {
        $stmt = getDB()->prepare('SELECT allowed_pages, allowed_capabilities, data_scope FROM user_permissions WHERE user_id = ? LIMIT 1');
        $stmt->execute([$userId]);
        $row = $stmt->fetch();
        if (!$row) {
            // Fail closed for ordinary staff once the per-user permissions table exists:
            // until Command explicitly grants sections/actions, staff only see a safe landing
            // dashboard and their own profile. Admin roles retain their management defaults.
            if (!in_array($role, ['Super Admin','Commander'], true)) {
                return ['pages' => ['overview','profile'], 'capabilities' => [], 'scope' => 'own', 'custom' => true];
            }
            return $fallback;
        }

        $pages = json_decode($row['allowed_pages'] ?? '[]', true);
        $caps  = json_decode($row['allowed_capabilities'] ?? '[]', true);
        if (!is_array($pages)) $pages = [];
        if (!is_array($caps)) $caps = [];

        // Super Admin may retain all system areas. Commander may retain its role ceiling.
        // Staff may only receive operational pages/capabilities explicitly delegated by command.
        $pageCeiling = $role === 'Super Admin' ? array_keys(PAGE_LABELS)
            : ($role === 'Commander' ? rolePages('Commander') : STAFF_ASSIGNABLE_PAGES);
        $capCeiling = $role === 'Super Admin' ? array_keys(CAPABILITY_LABELS)
            : ($role === 'Commander' ? roleCapabilities('Commander') : STAFF_ASSIGNABLE_CAPABILITIES);

        $pages = cleanPermissionList($pages, $pageCeiling);
        $caps  = cleanPermissionList($caps, $capCeiling);

        // Every authenticated account needs its own profile, and dashboard is the safe landing page.
        foreach (['overview','profile'] as $requiredPage) {
            if (in_array($requiredPage, $pageCeiling, true) && !in_array($requiredPage, $pages, true)) $pages[] = $requiredPage;
        }

        $scope = in_array(($row['data_scope'] ?? ''), ['own','assigned','all'], true) ? $row['data_scope'] : dataScope($role);
        return ['pages' => $pages, 'capabilities' => $caps, 'scope' => $scope, 'custom' => true];
    } catch (Throwable $e) {
        return $fallback;
    }
}

function authCanAccessPage(array $auth, string $page): bool {
    return in_array($page, $auth['pages'] ?? rolePages($auth['role'] ?? 'Officer'), true);
}

function authHasCapability(array $auth, string $capability): bool {
    $hasGrant = in_array($capability, $auth['capabilities'] ?? roleCapabilities($auth['role'] ?? 'Officer'), true);
    if (!$hasGrant) return false;
    $requiredPages = CAPABILITY_PAGES[$capability] ?? [];
    return !$requiredPages || count(array_intersect($requiredPages, $auth['pages'] ?? rolePages($auth['role'] ?? 'Officer'))) > 0;
}

function requireCapability(string $capability): array {
    $auth = requireAuth();
    $requiredPages = CAPABILITY_PAGES[$capability] ?? [];
    $pageAllowed = !$requiredPages || count(array_intersect($requiredPages, $auth['pages'] ?? [])) > 0;
    if (!authHasCapability($auth, $capability) || !$pageAllowed) {
        auditLog($auth['user_id'], 'capability_denied', 'permissions', null, $capability, 'denied');
        jsonError('Awood uma lihid ficilkan ama qaybtiisa laguma oggola.', 403);
    }
    return $auth;
}

function requireAnyPage(array $pages): array {
    $auth = requireAuth();
    foreach ($pages as $page) if (authCanAccessPage($auth, (string)$page)) return $auth;
    auditLog($auth['user_id'], 'page_denied', 'permissions', null, implode(',', $pages), 'denied');
    jsonError('Qaybahan Taliyuhu kuuma oggolaan.', 403);
}

function requirePage(string $page): array {
    $auth = requireAuth();
    if (!authCanAccessPage($auth, $page)) {
        auditLog($auth['user_id'], 'page_denied', 'permissions', null, $page, 'denied');
        jsonError('Qaybtan Taliyuhu kuuma oggolaan.', 403);
    }
    return $auth;
}

/** Fetch target user + role for privilege checks. */
function permissionTargetUser(int $targetUserId): array {
    $stmt = getDB()->prepare('SELECT u.id,u.full_name,u.email,u.role_id,u.status,r.name AS role FROM users u JOIN roles r ON u.role_id=r.id WHERE u.id=? LIMIT 1');
    $stmt->execute([$targetUserId]);
    $row = $stmt->fetch();
    if (!$row) jsonError('User-ka lama helin.', 404);
    return $row;
}

/** Commander may only manage staff below Commander level; Super Admin may manage any other account. */
function assertCanManageUser(array $auth, int $targetUserId): array {
    if ($targetUserId === (int)$auth['user_id']) jsonError('Rukhsadaha akoonkaaga adigu iskama beddeli kartid.', 403);
    $target = permissionTargetUser($targetUserId);
    $actorRole = $auth['role'] ?? 'Officer';
    if ($actorRole === 'Super Admin') return $target;
    if ($actorRole === 'Commander' && roleLevel($target['role']) < roleLevel('Commander')) return $target;
    jsonError('User-kan ma maamuli kartid.', 403);
}

function permissionCatalogForActor(array $auth): array {
    $isSuper = ($auth['role'] ?? '') === 'Super Admin';
    $pageKeys = $isSuper ? array_keys(PAGE_LABELS) : STAFF_ASSIGNABLE_PAGES;
    $capKeys  = $isSuper ? array_keys(CAPABILITY_LABELS) : STAFF_ASSIGNABLE_CAPABILITIES;
    $pages = [];
    foreach ($pageKeys as $key) $pages[] = ['key' => $key, 'label' => PAGE_LABELS[$key] ?? $key];
    $caps = [];
    foreach ($capKeys as $key) $caps[] = ['key' => $key, 'label' => CAPABILITY_LABELS[$key] ?? $key];
    return ['pages' => $pages, 'capabilities' => $caps, 'scopes' => ['own','assigned','all']];
}

/**
 * Sanitize a grant made by an administrator.  Commander cannot delegate user/settings
 * administration or grant to another Commander/Super Admin.
 */
function sanitizePermissionGrant(array $auth, string $targetRole, array $pages, array $caps, string $scope): array {
    if (($auth['role'] ?? '') !== 'Super Admin' && roleLevel($targetRole) >= roleLevel('Commander')) {
        jsonError('Taliyuhu rukhsad uma qoondeyn karo Commander ama Super Admin kale.', 403);
    }
    $catalog = permissionCatalogForActor($auth);
    $allowedPageKeys = array_column($catalog['pages'], 'key');
    $allowedCapKeys  = array_column($catalog['capabilities'], 'key');
    $pages = cleanPermissionList($pages, $allowedPageKeys);
    $caps  = cleanPermissionList($caps, $allowedCapKeys);
    foreach (['overview','profile'] as $requiredPage) {
        if (in_array($requiredPage, $allowedPageKeys, true) && !in_array($requiredPage, $pages, true)) $pages[] = $requiredPage;
    }
    // A write/action permission is meaningless (and unsafe) without access to its section.
    $caps = array_values(array_filter($caps, function ($cap) use ($pages) {
        $required = CAPABILITY_PAGES[$cap] ?? [];
        return !$required || count(array_intersect($required, $pages)) > 0;
    }));
    if (!in_array($scope, ['own','assigned','all'], true)) $scope = dataScope($targetRole);
    return ['pages' => $pages, 'capabilities' => $caps, 'scope' => $scope];
}
