<?php
require_once __DIR__ . '/../../includes/helpers.php';
setCorsHeaders();

if (empty($_SESSION['user_id'])) jsonResponse(['authenticated' => false]);
$auth = requireAuth();
$role = $auth['role'];
jsonResponse([
    'authenticated' => true,
    'csrf_token' => csrfToken(),
    'user' => [
        'id' => $_SESSION['user_id'], 'full_name' => $_SESSION['full_name'], 'email' => $_SESSION['email'],
        'role' => $role, 'officer_id' => $_SESSION['officer_id'] ?? null, 'station_id' => 1,
        'photo_url' => $_SESSION['photo_url'] ?? null,
        'security_clearance' => $_SESSION['security_clearance'] ?? 'Official',
        'force_password_change' => (bool)($_SESSION['force_password_change'] ?? false),
        'pages' => $auth['pages'], 'capabilities' => $auth['capabilities'], 'scope' => $auth['scope'],
        'custom_access' => $auth['custom_access'],
    ],
]);
