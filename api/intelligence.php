<?php
require_once __DIR__ . '/../includes/helpers.php';
setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

switch ($method) {
    case 'GET':
        $auth = requirePage('intelligence');
        $conditions = [];
        if (!empty($_GET['classification'])) $conditions['classification'] = $_GET['classification'];
        if (!empty($_GET['threat_level']))    $conditions['threat_level'] = $_GET['threat_level'];
        $result = paginate('intelligence', $conditions);
        auditLog($auth['user_id'], 'read', 'intelligence', null, 'Qaybta sirdoonka ayaa la arkay');
        jsonResponse(['success' => true] + $result);
        break;

    case 'POST':
        $auth  = requireCapability('intelligence.manage');
        $input = getInput();
        requireFields($input, ['title','content']);
        $stmt  = $db->prepare('INSERT INTO intelligence (title, classification, source, content, threat_level, author_id) VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $input['title'] ?? '',
            $input['classification'] ?? 'U',
            $input['source'] ?? null,
            $input['content'] ?? null,
            $input['threat_level'] ?? 'Low',
            $auth['user_id'],
        ]);
        $id = $db->lastInsertId();
        auditLog($auth['user_id'], 'create', 'intelligence', $id, $input['title'] ?? '');
        jsonResponse(['success' => true, 'id' => $id], 201);
        break;

    case 'PUT':
        $auth  = requireCapability('intelligence.manage');
        $input = getInput();
        $id    = (int)($input['id'] ?? $_GET['id'] ?? 0);
        if (!$id) jsonError('ID waa lagama maarmaan.');
        $fields = [];
        $params = [];
        foreach (['title','classification','source','content','threat_level'] as $col) {
            if (isset($input[$col])) {
                $fields[] = "`$col` = ?";
                $params[] = $input[$col];
            }
        }
        if (empty($fields)) jsonError('Wax la beddelo ma jiraan.');
        $params[] = $id;
        $db->prepare("UPDATE intelligence SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);
        auditLog($auth['user_id'], 'update', 'intelligence', $id);
        jsonResponse(['success' => true]);
        break;

    default:
        jsonError('Method-ka la isticmaalay lama aqbalo.', 405);
}
