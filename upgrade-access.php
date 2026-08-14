<?php
/** One-time browser migration for per-user permissions + email invitations. Delete after use. */
declare(strict_types=1);
error_reporting(E_ALL); ini_set('display_errors','1');
$remote = $_SERVER['REMOTE_ADDR'] ?? '';
if (!in_array($remote, ['127.0.0.1','::1'], true)) {
    http_response_code(403);
    exit('Upgrade-kan waxaa lagu ordi karaa localhost oo keliya.');
}
require_once __DIR__ . '/config/database.php';
function splitUpgradeSql(string $sql): array {
    $lines=[]; foreach(preg_split('/\R/',$sql) as $line){$t=ltrim($line);if($t===''||str_starts_with($t,'--'))continue;$lines[]=$line;}
    return array_values(array_filter(array_map('trim',explode(';',implode("\n",$lines)))));
}
$done=false;$error='';
if($_SERVER['REQUEST_METHOD']==='POST'){
    try{
        $db=getDB();
        $sql=file_get_contents(__DIR__.'/database/migration_staff_permissions_email.sql');
        $sql=preg_replace('/^\s*USE\b.*$/mi','',$sql);
        foreach(splitUpgradeSql($sql) as $statement){$db->exec($statement);}
        $done=true;
    }catch(Throwable $e){$error=$e->getMessage();}
}
?><!doctype html><html lang="so"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Upgrade Access Control</title><style>body{font-family:Arial,sans-serif;background:#f4f7fb;padding:40px;color:#172235}.card{max-width:620px;margin:auto;background:white;padding:28px;border:1px solid #dfe6ef;border-radius:14px}button,a{display:block;width:100%;padding:13px;border:0;border-radius:9px;background:#1f62d6;color:#fff;text-align:center;text-decoration:none;font-weight:700}code{background:#eef2f6;padding:2px 5px;border-radius:4px}.ok{padding:12px;background:#eaf8f1;color:#08724f}.err{padding:12px;background:#fff0f1;color:#b12632}</style></head><body><div class="card"><h2>Staff Permissions & Email Invitations</h2><?php if($done):?><p class="ok">Upgrade-ku wuu dhammaaday. Hadda tirtir <code>upgrade-access.php</code>.</p><a href="dashboard.html#users">Fur Users & Permissions</a><?php else:?><p>Database hore ku dar per-user permissions iyo invitation tables. Backup samee ka hor.</p><?php if($error):?><p class="err"><?=htmlspecialchars($error)?></p><?php endif;?><form method="post"><button>Orod Upgrade-ka Hal Mar</button></form><?php endif;?></div></body></html>
