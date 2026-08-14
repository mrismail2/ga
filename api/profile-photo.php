<?php
require_once __DIR__ . '/../includes/helpers.php';
setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('POST kaliya ayaa la aqbalaa.', 405);
}

$auth = requireAuth();
$db = getDB();
$type = trim($_POST['target_type'] ?? '');
$id = (int)($_POST['target_id'] ?? 0);

$targets = [
    'user' => ['table' => 'users', 'capability' => 'users.manage'],
    'officer' => ['table' => 'officers', 'capability' => 'officers.manage'],
    'citizen' => ['table' => 'citizens', 'capability' => 'citizens.manage'],
    'prisoner' => ['table' => 'prisoners', 'capability' => 'custody.manage'],
];
if (!$id || !isset($targets[$type])) jsonError('Nooca profile-ka ama ID-ga waa khalad.', 422);

$isSelfUser = $type === 'user' && $id === (int)$auth['user_id'];
$isSelfOfficer = $type === 'officer' && $auth['officer_id'] && $id === (int)$auth['officer_id'];
if (!$isSelfUser && !$isSelfOfficer && !authHasCapability($auth, $targets[$type]['capability'])) {
    jsonError('Awood uma lihid inaad sawirkan beddesho.', 403);
}

if (empty($_FILES['photo']) || $_FILES['photo']['error'] !== UPLOAD_ERR_OK) {
    jsonError('Fadlan dooro sawir sax ah.', 422);
}
$file = $_FILES['photo'];
if ($file['size'] > 3 * 1024 * 1024) jsonError('Sawirku kama weynaan karo 3 MB.', 422);

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($file['tmp_name']);
$extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
$imageInfo = @getimagesize($file['tmp_name']);
if (!isset($extensions[$mime]) || $imageInfo === false) {
    jsonError('Waxaa la oggol yahay JPG, PNG ama WEBP oo keliya.', 422);
}
if (($imageInfo[0] ?? 0) > 6000 || ($imageInfo[1] ?? 0) > 6000) {
    jsonError('Cabirka sawirku aad ayuu u weyn yahay.', 422);
}

$table = $targets[$type]['table'];
$check = $db->prepare("SELECT photo_url FROM `$table` WHERE id = ? LIMIT 1");
$check->execute([$id]);
$record = $check->fetch();
if (!$record) jsonError('Profile-ka lama helin.', 404);

$uploadDir = dirname(__DIR__) . '/assets/uploads/profiles';
if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true) && !is_dir($uploadDir)) {
    jsonError('Folder-ka sawirrada lama samayn karin.', 500);
}
$filename = $type . '-' . $id . '-' . bin2hex(random_bytes(8)) . '.' . $extensions[$mime];
$destination = $uploadDir . '/' . $filename;
if (!move_uploaded_file($file['tmp_name'], $destination)) jsonError('Sawirka lama kaydin karin.', 500);
$photoUrl = 'assets/uploads/profiles/' . $filename;

$db->beginTransaction();
try {
    $db->prepare("UPDATE `$table` SET photo_url = ? WHERE id = ?")->execute([$photoUrl, $id]);
    if ($type === 'user') {
        $stmt = $db->prepare('SELECT officer_id FROM users WHERE id = ?');
        $stmt->execute([$id]);
        $officerId = (int)$stmt->fetchColumn();
        if ($officerId) $db->prepare('UPDATE officers SET photo_url = ? WHERE id = ?')->execute([$photoUrl, $officerId]);
    } elseif ($type === 'officer') {
        $db->prepare('UPDATE users SET photo_url = ? WHERE officer_id = ?')->execute([$photoUrl, $id]);
    }
    auditLog($auth['user_id'], 'update_photo', $table, $id, $photoUrl);
    $db->commit();
} catch (Throwable $e) {
    $db->rollBack();
    @unlink($destination);
    jsonError('Sawirka lama kaydin karin.', 500);
}

$old = $record['photo_url'] ?? '';
if ($old && str_starts_with($old, 'assets/uploads/profiles/')) {
    $oldPath = dirname(__DIR__) . '/' . $old;
    if (is_file($oldPath) && realpath($oldPath) !== realpath($destination)) @unlink($oldPath);
}
if ($isSelfUser) $_SESSION['photo_url'] = $photoUrl;

jsonResponse(['success' => true, 'photo_url' => $photoUrl, 'message' => 'Sawirka profile-ka waa la kaydiyey.']);
