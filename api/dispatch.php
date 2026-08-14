<?php
require_once __DIR__ . '/../includes/helpers.php';
setCorsHeaders();
$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    requirePage('dispatch');
    $where = [];
    $params = [];
    if (!empty($_GET['status'])) { $where[] = 'ec.status = ?'; $params[] = $_GET['status']; }
    if (!empty($_GET['priority'])) { $where[] = 'ec.priority = ?'; $params[] = $_GET['priority']; }
    if (!empty($_GET['search'])) {
        $where[] = '(ec.call_number LIKE ? OR ec.caller_name LIKE ? OR ec.location LIKE ? OR ec.call_type LIKE ?)';
        $q = '%' . trim($_GET['search']) . '%';
        array_push($params, $q, $q, $q, $q);
    }
    $sql = 'SELECT ec.*, u.full_name AS receiver_name, i.incident_number FROM emergency_calls ec LEFT JOIN users u ON ec.received_by=u.id LEFT JOIN incidents i ON ec.incident_id=i.id';
    if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
    $sql .= " ORDER BY FIELD(ec.priority,'P1','P2','P3','P4'), ec.received_at DESC LIMIT 100";
    $stmt = $db->prepare($sql); $stmt->execute($params);
    jsonResponse(['success'=>true,'data'=>$stmt->fetchAll()]);
}

if ($method === 'POST') {
    $auth = requireCapability('dispatch.manage');
    $input = getInput();
    requireFields($input, ['call_type','location']);
    $callNo = uniqueReference('CALL','emergency_calls','call_number');
    $priority = in_array($input['priority'] ?? 'P3', ['P1','P2','P3','P4'], true) ? $input['priority'] : 'P3';
    $db->beginTransaction();
    try {
        $stmt = $db->prepare('INSERT INTO emergency_calls (call_number,received_by,caller_name,caller_phone,call_type,priority,location,latitude,longitude,summary,status,unit_code) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
        $stmt->execute([$callNo,$auth['user_id'],$input['caller_name']??null,$input['caller_phone']??null,$input['call_type'],$priority,$input['location'],$input['latitude']??null,$input['longitude']??null,$input['summary']??null,'Validated',$input['unit_code']??null]);
        $callId = (int)$db->lastInsertId();
        $incidentNo = uniqueReference('INC','incidents','incident_number');
        $status = !empty($input['unit_code']) ? 'dispatched' : 'queued';
        $stmt = $db->prepare('INSERT INTO incidents (incident_number,call_number,source,caller_name,caller_phone,type,description,priority,location,assigned_unit,dispatcher_id,status,dispatched_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
        $stmt->execute([$incidentNo,$callNo,'Emergency Call',$input['caller_name']??null,$input['caller_phone']??null,$input['call_type'],$input['summary']??null,$priority==='P4'?'P3':$priority,$input['location'],$input['unit_code']??null,$auth['user_id'],$status,!empty($input['unit_code'])?date('Y-m-d H:i:s'):null]);
        $incidentId = (int)$db->lastInsertId();
        $db->prepare("UPDATE emergency_calls SET incident_id=?, status=?, dispatched_at=? WHERE id=?")->execute([$incidentId,!empty($input['unit_code'])?'Dispatched':'Validated',!empty($input['unit_code'])?date('Y-m-d H:i:s'):null,$callId]);
        if ($priority === 'P1') {
            $taskNo = uniqueReference('TSK','workflow_tasks','task_number');
            $db->prepare('INSERT INTO workflow_tasks (task_number,title,description,entity_type,entity_id,assigned_role,priority,due_at,status,created_by) VALUES (?,?,?,?,?,?,?,DATE_ADD(NOW(),INTERVAL 15 MINUTE),?,?)')->execute([$taskNo,"P1: $callNo",$input['summary']??'Dhacdo P1','incident',$incidentId,'Commander','Critical','Open',$auth['user_id']]);
        }
        $db->commit();
        auditLog($auth['user_id'],'create','emergency_calls',$callId,$callNo);
        jsonResponse(['success'=>true,'id'=>$callId,'call_number'=>$callNo,'incident_number'=>$incidentNo],201);
    } catch (Throwable $e) {
        $db->rollBack();
        jsonError('Wicitaanka lama kaydin karin.',500);
    }
}

if ($method === 'PUT') {
    $auth = requireCapability('dispatch.manage');
    $input = getInput();
    $id = (int)($input['id']??0); if (!$id) jsonError('ID waa lagama maarmaan.',422);
    $allowed = ['status','unit_code','priority','summary','location'];
    $fields=[];$params=[];
    foreach ($allowed as $col) if (array_key_exists($col,$input)) { $fields[]="`$col`=?"; $params[]=$input[$col]; }
    if (isset($input['status']) && $input['status']==='Dispatched') $fields[]='dispatched_at=COALESCE(dispatched_at,NOW())';
    if (isset($input['status']) && in_array($input['status'],['Resolved','Cancelled'],true)) $fields[]='closed_at=NOW()';
    if (!$fields) jsonError('Wax la beddelo ma jiraan.',422);
    $params[]=$id;
    $db->prepare('UPDATE emergency_calls SET '.implode(',',$fields).' WHERE id=?')->execute($params);
    $row=$db->prepare('SELECT incident_id,status,unit_code FROM emergency_calls WHERE id=?');$row->execute([$id]);$call=$row->fetch();
    if ($call && $call['incident_id']) {
        $map=['Validated'=>'queued','Dispatched'=>'dispatched','Responding'=>'responding','At Scene'=>'at_scene','Resolved'=>'resolved','Cancelled'=>'cancelled'];
        if (isset($map[$call['status']])) $db->prepare('UPDATE incidents SET status=?,assigned_unit=COALESCE(?,assigned_unit),dispatched_at=CASE WHEN ?="dispatched" THEN COALESCE(dispatched_at,NOW()) ELSE dispatched_at END,resolved_at=CASE WHEN ? IN ("resolved","cancelled") THEN NOW() ELSE resolved_at END WHERE id=?')->execute([$map[$call['status']],$call['unit_code'],$map[$call['status']],$map[$call['status']],$call['incident_id']]);
    }
    auditLog($auth['user_id'],'update','emergency_calls',$id,$input['status']??null);
    jsonResponse(['success'=>true]);
}
jsonError('Method-ka lama aqbalo.',405);
