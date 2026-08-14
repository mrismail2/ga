<?php
require_once __DIR__ . '/../includes/helpers.php';
setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

function requestedRoleName(PDO $db, int $roleId): string {
    $stmt = $db->prepare('SELECT name FROM roles WHERE id=? LIMIT 1');
    $stmt->execute([$roleId]);
    $role = $stmt->fetchColumn();
    if (!$role) jsonError('Role-ka lama helin.', 422);
    return (string)$role;
}

switch ($method) {
    case 'GET':
        $auth = requireCapability('users.manage');
        $where = $auth['role'] === 'Super Admin' ? '' : "WHERE r.name NOT IN ('Super Admin','Commander')";
        $sql = "SELECT u.id,u.full_name,u.email,u.photo_url,u.role_id,r.name AS role,u.officer_id,u.security_clearance,
                       u.force_password_change,u.two_factor_enabled,u.last_login,u.status,u.created_at,
                       (SELECT i.status FROM user_invitations i WHERE i.user_id=u.id ORDER BY i.id DESC LIMIT 1) AS invitation_status,
                       (SELECT i.send_status FROM user_invitations i WHERE i.user_id=u.id ORDER BY i.id DESC LIMIT 1) AS invitation_send_status,
                       (SELECT i.id FROM user_invitations i WHERE i.user_id=u.id ORDER BY i.id DESC LIMIT 1) AS invitation_id,
                       EXISTS(SELECT 1 FROM user_permissions up WHERE up.user_id=u.id) AS custom_permissions
                FROM users u JOIN roles r ON u.role_id=r.id $where ORDER BY u.id";
        jsonResponse(['success'=>true,'data'=>$db->query($sql)->fetchAll()]);
        break;

    case 'POST':
        $auth = requireCapability('users.manage');
        if ($auth['role'] !== 'Super Admin') jsonError('Shaqaale cusub ku samee Email Invitation; direct account creation waa Super Admin emergency action oo keliya.', 403);
        $input = getInput();
        requireFields($input, ['full_name','email','password']);
        $email = strtolower(trim((string)$input['email']));
        $pass = (string)$input['password'];
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) jsonError('Email-ka ma saxna.',422);
        enforcePasswordPolicy($pass);
        $roleId=(int)($input['role_id']??4);
        $role=requestedRoleName($db,$roleId);
        if ($auth['role']!=='Super Admin' && roleLevel($role)>=roleLevel('Commander')) jsonError('Taliyuhu ma abuuri karo Commander ama Super Admin kale.',403);
        $existing=$db->prepare('SELECT id FROM users WHERE email=?');$existing->execute([$email]);
        if($existing->fetch()) jsonError('Email-kan horay ayuu u jiray.',409);
        $hash=password_hash($pass,PASSWORD_BCRYPT,['cost'=>12]);
        $stmt=$db->prepare('INSERT INTO users (full_name,email,password_hash,role_id,officer_id,station_id,security_clearance,force_password_change,status) VALUES (?,?,?,?,?,1,?,1,"active")');
        $stmt->execute([$input['full_name'],$email,$hash,$roleId,!empty($input['officer_id'])?(int)$input['officer_id']:null,$input['security_clearance']??'Official']);
        $id=(int)$db->lastInsertId();
        auditLog($auth['user_id'],'create','users',$id,$input['full_name']);
        jsonResponse(['success'=>true,'id'=>$id],201);
        break;

    case 'PUT':
        $auth=requireCapability('users.manage');
        $input=getInput();
        $id=(int)($input['id']??$_GET['id']??0);
        if(!$id) jsonError('ID waa lagama maarmaan.');
        $target=assertCanManageUser($auth,$id);
        if(isset($input['role_id'])){
            $newRole=requestedRoleName($db,(int)$input['role_id']);
            if($auth['role']!=='Super Admin' && roleLevel($newRole)>=roleLevel('Commander')) jsonError('Role-kan ma qoondeyn kartid.',403);
        }
        $fields=[];$params=[];
        foreach(['full_name','email','role_id','officer_id','security_clearance','two_factor_enabled','status'] as $col){
            if(array_key_exists($col,$input)){$fields[]="`$col` = ?";$params[]=$input[$col];}
        }
        if(!empty($input['password'])){
            enforcePasswordPolicy((string)$input['password']);
            $fields[]='password_hash = ?';$params[]=password_hash($input['password'],PASSWORD_BCRYPT,['cost'=>12]);
            $fields[]='password_changed_at = NOW()';$fields[]='force_password_change = 0';
        }
        if(!$fields) jsonError('Wax la beddelo ma jiraan.');
        $params[]=$id;
        $db->prepare('UPDATE users SET '.implode(', ',$fields).' WHERE id=?')->execute($params);
        revokeUserSessions($id);
        auditLog($auth['user_id'],'update','users',$id);
        jsonResponse(['success'=>true,'message'=>'User-ka waa la cusboonaysiiyey; session-kiisii hore waa la xiray.']);
        break;

    case 'DELETE':
        $auth=requireCapability('users.manage');
        $id=(int)($_GET['id']??0);
        if(!$id) jsonError('ID waa lagama maarmaan.');
        assertCanManageUser($auth,$id);
        revokeUserSessions($id);
        $db->prepare('DELETE FROM users WHERE id=?')->execute([$id]);
        auditLog($auth['user_id'],'delete','users',$id);
        jsonResponse(['success'=>true]);
        break;

    default:
        jsonError('Method-ka la isticmaalay lama aqbalo.',405);
}
