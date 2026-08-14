<?php
require_once __DIR__ . '/../includes/helpers.php';
setCorsHeaders();
$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    requirePage('evidence');
    $evidenceId = (int)($_GET['evidence_id'] ?? 0);
    if (!$evidenceId) jsonError('evidence_id waa lagama maarmaan.', 422);
    $stmt = $db->prepare('SELECT em.*, u1.full_name AS released_by_name, u2.full_name AS received_by_name
                          FROM evidence_movements em
                          LEFT JOIN users u1 ON em.released_by = u1.id
                          LEFT JOIN users u2 ON em.received_by = u2.id
                          WHERE em.evidence_id = ?
                          ORDER BY em.occurred_at DESC');
    $stmt->execute([$evidenceId]);
    jsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    $auth = requireCapability('evidence.manage');
    $input = getInput();
    requireFields($input, ['evidence_id','movement_type']);
    $type = in_array($input['movement_type'], ['Collected','Received','Transferred','Examined','Sealed','Unsealed','Court','Returned','Disposed'], true)
        ? $input['movement_type'] : null;
    if (!$type) jsonError('Nooca movement-ka ma saxna.', 422);

    $evidenceId = (int)$input['evidence_id'];
    $exists = $db->prepare('SELECT id, location FROM evidence WHERE id = ?');
    $exists->execute([$evidenceId]);
    $evidence = $exists->fetch();
    if (!$evidence) jsonError('Caddeynta lama helin.', 404);

    $stmt = $db->prepare('INSERT INTO evidence_movements
        (evidence_id,movement_type,from_location,to_location,released_by,received_by,purpose,condition_note,seal_number,occurred_at)
        VALUES (?,?,?,?,?,?,?,?,?,COALESCE(?,NOW()))');
    $stmt->execute([
        $evidenceId,
        $type,
        $input['from_location'] ?? $evidence['location'],
        $input['to_location'] ?? null,
        $auth['user_id'],
        !empty($input['received_by']) ? (int)$input['received_by'] : null,
        $input['purpose'] ?? null,
        $input['condition_note'] ?? null,
        $input['seal_number'] ?? null,
        normalizeDateTimeValue($input['occurred_at'] ?? null),
    ]);
    $id = (int)$db->lastInsertId();
    $db->prepare('UPDATE evidence
                  SET location = COALESCE(?, location),
                      chain_of_custody = CONCAT(COALESCE(chain_of_custody, ""), "\n", NOW(), " - ", ?)
                  WHERE id = ?')->execute([$input['to_location'] ?? null, $type, $evidenceId]);
    auditLog($auth['user_id'], 'create', 'evidence_movements', $id, "$type | evidence:$evidenceId");
    jsonResponse(['success' => true, 'id' => $id], 201);
}

jsonError('Method-ka lama aqbalo.', 405);
