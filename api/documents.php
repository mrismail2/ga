<?php
require_once __DIR__ . '/../includes/helpers.php';
setCorsHeaders();

$auth = requirePage('documents');
$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];
$clearanceRank = ['Public' => 0, 'Official' => 1, 'Restricted' => 2, 'Secret' => 3];
$userRank = $clearanceRank[$auth['clearance']] ?? 1;
$allowedClassifications = array_keys(array_filter($clearanceRank, fn($rank) => $rank <= $userRank));

if ($method === 'GET') {
    $id = (int)($_GET['id'] ?? 0);
    if ($id && !empty($_GET['download'])) {
        $stmt = $db->prepare('SELECT * FROM documents WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) jsonError('Dukumentiga lama helin.', 404);
        if (($clearanceRank[$row['classification']] ?? 99) > $userRank) {
            auditLog($auth['user_id'], 'document_denied', 'documents', $id, $row['classification'], 'denied');
            jsonError('Clearance-kaagu kuma filna dukumentigan.', 403);
        }
        $path = dirname(__DIR__) . '/' . ltrim($row['file_path'], '/');
        if (!is_file($path)) jsonError('Faylka dukumentiga lama helin.', 404);
        auditLog($auth['user_id'], 'download', 'documents', $id, $row['document_number']);
        header('Content-Type: ' . $row['mime_type']);
        header('Content-Length: ' . filesize($path));
        header('Content-Disposition: attachment; filename="' . rawurlencode($row['file_name']) . '"');
        header('Cache-Control: private, no-store');
        readfile($path);
        exit;
    }

    $where = [];
    $params = [];
    $placeholders = implode(',', array_fill(0, count($allowedClassifications), '?'));
    $where[] = "d.classification IN ($placeholders)";
    array_push($params, ...$allowedClassifications);
    if (!empty($_GET['entity_type'])) { $where[] = 'd.entity_type = ?'; $params[] = trim($_GET['entity_type']); }
    if (!empty($_GET['entity_id'])) { $where[] = 'd.entity_id = ?'; $params[] = (int)$_GET['entity_id']; }
    if (!empty($_GET['search'])) {
        $where[] = '(d.document_number LIKE ? OR d.title LIKE ? OR d.file_name LIKE ?)';
        $q = '%' . trim($_GET['search']) . '%';
        array_push($params, $q, $q, $q);
    }
    $sql = 'SELECT d.*, u.full_name AS uploaded_by_name FROM documents d LEFT JOIN users u ON d.uploaded_by = u.id WHERE '
         . implode(' AND ', $where) . ' ORDER BY d.created_at DESC LIMIT 100';
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    requireCapability('documents.manage');
    $entityType = trim($_POST['entity_type'] ?? '');
    $entityId = (int)($_POST['entity_id'] ?? 0);
    $title = trim($_POST['title'] ?? '');
    $classification = $_POST['classification'] ?? 'Official';
    if ($entityType === '' || !$entityId || $title === '') jsonError('Entity, ID iyo cinwaan waa lagama maarmaan.', 422);
    if (!isset($clearanceRank[$classification]) || $clearanceRank[$classification] > $userRank) {
        jsonError('Ma abuuri kartid dukumenti ka sarreeya clearance-kaaga.', 403);
    }
    if (empty($_FILES['document']) || $_FILES['document']['error'] !== UPLOAD_ERR_OK) jsonError('Fadlan dooro fayl sax ah.', 422);
    $file = $_FILES['document'];
    if ($file['size'] > 15 * 1024 * 1024) jsonError('Faylku kama weynaan karo 15 MB.', 422);

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($file['tmp_name']);
    $types = [
        'application/pdf' => 'pdf',
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
        'text/plain' => 'txt',
    ];
    if (!isset($types[$mime])) jsonError('PDF, JPG, PNG, DOCX, XLSX ama TXT oo keliya ayaa la oggol yahay.', 422);

    $directory = dirname(__DIR__) . '/assets/uploads/documents';
    if (!is_dir($directory) && !mkdir($directory, 0750, true) && !is_dir($directory)) jsonError('Folder-ka dukumentiyada lama samayn karin.', 500);
    $storedName = bin2hex(random_bytes(20)) . '.' . $types[$mime];
    $destination = $directory . '/' . $storedName;
    if (!move_uploaded_file($file['tmp_name'], $destination)) jsonError('Faylka lama kaydin karin.', 500);

    $number = uniqueReference('DOC', 'documents', 'document_number');
    $relative = 'assets/uploads/documents/' . $storedName;
    try {
        $stmt = $db->prepare('INSERT INTO documents
            (document_number,entity_type,entity_id,title,file_name,file_path,mime_type,file_size,sha256,classification,uploaded_by)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)');
        $stmt->execute([
            $number, $entityType, $entityId, $title,
            basename($file['name']), $relative, $mime, (int)$file['size'],
            hash_file('sha256', $destination), $classification, $auth['user_id'],
        ]);
    } catch (Throwable $e) {
        @unlink($destination);
        jsonError('Dukumentiga lama diiwaangelin karin.', 500);
    }
    $id = (int)$db->lastInsertId();
    auditLog($auth['user_id'], 'upload', 'documents', $id, "$number | $classification");
    jsonResponse(['success' => true, 'id' => $id, 'document_number' => $number], 201);
}

jsonError('Method-ka lama aqbalo.', 405);
