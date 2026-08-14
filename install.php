<?php
/**
 * CIIDANKA BOOLISKA GOBOLKA GABILEY — Installer
 *
 * Fur `http://localhost:8000/install.php` browser-ka, buuxi xogta database-ka
 * iyo akoonka Taliyaha koowaad, kadibna nidaamku wuu isku dhisayaa.
 *
 * Nidaamku wuxuu ku bilaabmaa database madhan: ma jiraan saraakiil, kiisas,
 * caddeymo ama xog tijaabo ah. Akoonka maamulaha koowaad waxaa sameeya qofka
 * rakibaya — password wadaagsan oo hore loo qoray ma jiro.
 *
 * MUHIIM: Ka dib markaad rakibto, tirtir faylkan (ama u beddel magac)
 * si aan qof kale dib u dhisin database-kaaga.
 */
declare(strict_types=1);
error_reporting(E_ALL);
ini_set('display_errors', '1');

const LOCAL_CONFIG = __DIR__ . '/config/config.local.php';

/** Kala jar faylka SQL-ka oo qaybo ah — faallooyinka waa la saarayaa. */
function splitSql(string $sql): array {
    $lines = [];
    foreach (preg_split('/\R/', $sql) as $line) {
        $trimmed = ltrim($line);
        if ($trimmed === '' || str_starts_with($trimmed, '--')) continue;
        $lines[] = $line;
    }
    $statements = [];
    foreach (explode(';', implode("\n", $lines)) as $statement) {
        if (trim($statement) !== '') $statements[] = $statement;
    }
    return $statements;
}

$requirements = [
    'PHP >= 8.0'          => PHP_VERSION_ID >= 80000,
    'PDO'                 => extension_loaded('pdo'),
    'pdo_mysql'           => extension_loaded('pdo_mysql'),
    'mbstring'            => extension_loaded('mbstring'),
    'config/ la qori karo' => is_writable(__DIR__ . '/config'),
    'profile uploads/ la qori karo' => is_writable(__DIR__ . '/assets/uploads/profiles'),
    'document uploads/ la qori karo' => is_writable(__DIR__ . '/assets/uploads/documents'),
    'database/schema.sql' => is_readable(__DIR__ . '/database/schema.sql'),
    'database/bootstrap.sql' => is_readable(__DIR__ . '/database/bootstrap.sql'),
];
$requirementsOk = !in_array(false, $requirements, true);

$alreadyInstalled = false;
if (file_exists(LOCAL_CONFIG)) {
    try {
        require_once __DIR__ . '/config/database.php';
        getDB()->query('SELECT 1 FROM users LIMIT 1');
        $alreadyInstalled = true;
    } catch (Throwable $e) {
        $alreadyInstalled = false;
    }
}

$errors  = [];
$success = false;
$stats   = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $requirementsOk) {
    $host = trim($_POST['host'] ?? 'localhost');
    $name = trim($_POST['name'] ?? 'gabiley_police');
    $user = trim($_POST['user'] ?? 'root');
    $pass = $_POST['pass'] ?? '';

    // First administrator account — supplied by the officer performing the install.
    $adminName    = trim($_POST['admin_name'] ?? '');
    $adminEmail   = trim($_POST['admin_email'] ?? '');
    $adminPass    = $_POST['admin_pass'] ?? '';
    $adminConfirm = $_POST['admin_pass_confirm'] ?? '';

    if ($name === '' || !preg_match('/^[A-Za-z0-9_]+$/', $name)) {
        $errors[] = 'Magaca database-ka waa inuu ka koobnaadaa xarfo, tirooyin iyo _ keliya.';
    }
    if ($adminName === '') {
        $errors[] = 'Magaca buuxa ee maamulaha waa waajib.';
    }
    if (!filter_var($adminEmail, FILTER_VALIDATE_EMAIL)) {
        $errors[] = 'Email-ka maamulaha ma saxna.';
    }
    $passwordStrong = strlen($adminPass) >= 10
        && preg_match('/[a-z]/', $adminPass)
        && preg_match('/[A-Z]/', $adminPass)
        && preg_match('/\d/', $adminPass);
    if (!$passwordStrong) {
        $errors[] = 'Password-ku waa inuu leeyahay ugu yaraan 10 xaraf, xaraf weyn, xaraf yar iyo tiro.';
    }
    if ($adminPass !== $adminConfirm) {
        $errors[] = 'Labada password isku mid ma aha.';
    }

    if (!$errors) {
        try {
            $pdo = new PDO("mysql:host=$host;charset=utf8mb4", $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            ]);
            $pdo->exec("CREATE DATABASE IF NOT EXISTS `$name` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            $pdo->exec("USE `$name`");
            $pdo->exec('SET NAMES utf8mb4');

            // Schema iyo bootstrap — magaca database-ka ee faylasha ku jira waa laga
            // saarayaa si loo isticmaalo kan uu isticmaaluhu doortay.
            foreach (['schema.sql', 'bootstrap.sql'] as $file) {
                $sql = file_get_contents(__DIR__ . "/database/$file");
                $sql = preg_replace('/^\s*(CREATE DATABASE|USE)\b.*$/mi', '', $sql);
                foreach (splitSql($sql) as $statement) {
                    $pdo->exec($statement);
                }
            }

            // Akoonka maamulaha koowaad. Password-ka waxaa doortay qofka rakibaya,
            // waana la hash-gareeyaa bcrypt cost 12 sida inta kale ee nidaamka.
            $exists = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
            $exists->execute([$adminEmail]);
            if ($exists->fetch()) {
                $errors[] = 'Email-kaas horey ayuu u jiraa database-kan.';
            } else {
                $insert = $pdo->prepare(
                    'INSERT INTO users (full_name, email, password_hash, role_id, station_id,
                                        security_clearance, force_password_change, status)
                     VALUES (?, ?, ?, 1, 1, ?, 0, ?)'
                );
                $insert->execute([
                    $adminName,
                    $adminEmail,
                    password_hash($adminPass, PASSWORD_BCRYPT, ['cost' => 12]),
                    'Secret',
                    'active',
                ]);
                $adminId = (int)$pdo->lastInsertId();

                $pdo->prepare('UPDATE stations SET commander_name = ? WHERE id = 1')->execute([$adminName]);

                try {
                    $pdo->prepare(
                        'INSERT INTO audit_log (user_id, action, entity, entity_id, details, outcome)
                         VALUES (?, ?, ?, ?, ?, ?)'
                    )->execute([$adminId, 'install_completed', 'users', $adminId,
                                'Akoonka maamulaha koowaad waa la abuuray.', 'success']);
                } catch (Throwable $e) {
                    // Audit schema variations must not fail an otherwise good install.
                }
            }

            if (!$errors) {
                foreach (['users','user_permissions','user_invitations','officers','cases','emergency_calls','arrests','custody_bookings','evidence','workflow_tasks','documents'] as $table) {
                    $stats[$table] = (int)$pdo->query("SELECT COUNT(*) FROM `$table`")->fetchColumn();
                }
            }

            if (!$errors) {
                $config = "<?php\n"
                    . "// Waxaa sameeyay install.php — " . date('Y-m-d H:i:s') . "\n"
                    . "define('DB_HOST', " . var_export($host, true) . ");\n"
                    . "define('DB_NAME', " . var_export($name, true) . ");\n"
                    . "define('DB_USER', " . var_export($user, true) . ");\n"
                    . "define('DB_PASS', " . var_export($pass, true) . ");\n";
                if (file_put_contents(LOCAL_CONFIG, $config) === false) {
                    $errors[] = 'Lama qori karo config/config.local.php — hubi rukhsadaha faylka.';
                } else {
                    $success = true;
                }
            }
        } catch (PDOException $e) {
            $errors[] = 'Khalad database: ' . $e->getMessage();
        } catch (Throwable $e) {
            $errors[] = 'Khalad: ' . $e->getMessage();
        }
    }
}
?>
<!DOCTYPE html>
<html lang="so">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Rakibaadda — CIIDANKA BOOLISKA GOBOLKA GABILEY</title>
<link rel="icon" type="image/png" href="assets/favicon.png">
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:40px 20px;
  font-family:Inter,Arial,sans-serif;color:#172235;
  background:radial-gradient(circle at 75% 20%,rgba(49,91,255,.35),transparent 40%),linear-gradient(125deg,#050b22,#07163d 55%,#111182)}
.card{width:min(620px,100%);padding:38px;border-radius:20px;background:#fff;box-shadow:0 30px 90px rgba(4,20,43,.4)}
.head{display:flex;gap:14px;align-items:center;margin-bottom:26px}
.head img{width:56px;height:56px;object-fit:contain}
.head b{display:block;font-size:1.05rem;letter-spacing:.03em}
.head small{color:#6b788c;font-size:.8rem;letter-spacing:.08em}
h1{margin:0 0 6px;font-size:1.75rem}
p.lead{margin:0 0 24px;color:#6b788c;font-size:.95rem}
.req{margin-bottom:22px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}
.req div{display:flex;justify-content:space-between;align-items:center;padding:9px 14px;border-bottom:1px solid #eef2f7;font-size:.9rem}
.req div:last-child{border:0}
.yes{color:#0c9c70;font-weight:800}.no{color:#db3745;font-weight:800}
label{display:block;margin-bottom:14px;font-size:.85rem;font-weight:700}
input{width:100%;margin-top:6px;padding:11px 13px;border:1px solid #e2e8f0;border-radius:10px;
  background:#f5f8fc;font:inherit;font-weight:500;outline:none}
input:focus{border-color:#315bff;box-shadow:0 0 0 4px rgba(43,130,255,.1)}
.row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
button{width:100%;min-height:48px;margin-top:8px;border:0;border-radius:11px;color:#fff;font:inherit;font-weight:800;
  cursor:pointer;background:linear-gradient(135deg,#1717c9,#1212a9);box-shadow:0 12px 25px rgba(29,112,232,.24)}
button:disabled{opacity:.5;cursor:not-allowed}
.alert{padding:13px 15px;border-radius:11px;margin-bottom:18px;font-size:.9rem;line-height:1.6}
.err{background:#ffebed;color:#b3232f}
.ok{background:#e4f8f1;color:#0c9c70}
.warn{background:#fff8e6;color:#8a6300}
table{width:100%;border-collapse:collapse;margin:16px 0;font-size:.9rem}
th,td{padding:8px 11px;text-align:left;border-bottom:1px solid #eef2f7}
th{color:#6b788c;font-size:.76rem;text-transform:uppercase;letter-spacing:.08em}
code{padding:2px 6px;border-radius:5px;background:#f1f4f8;font-size:.85rem}
.section-split{margin:26px 0 16px;padding-top:18px;border-top:1px solid #e2e8f0;
  font-size:.8rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#405067}
p.hint{margin:-6px 0 16px;color:#6b788c;font-size:.78rem;line-height:1.55}
a.btn{display:block;margin-top:10px;padding:13px;border-radius:11px;text-align:center;text-decoration:none;
  color:#fff;font-weight:800;background:linear-gradient(135deg,#1717c9,#1212a9)}
</style>
</head>
<body>
<div class="card">
  <div class="head">
    <img src="assets/police-logo.png" alt="">
    <div><b>CIIDANKA BOOLISKA GOBOLKA GABILEY</b><small>POLICE MANAGEMENT SYSTEM</small></div>
  </div>

<?php if ($success): ?>
  <h1>Rakibaaddu waa guulaysatay</h1>
  <p class="lead">Database-ka waa la dhisay. Nidaamku wuxuu ku bilaabmayaa diiwaanno madhan —
  xog tijaabo ah lama gelin, tirakoobka dashboard-kuna wuxuu ka soo baxayaa xogta aad gelinayso.</p>
  <table>
    <tr><th>Table</th><th>Diiwaanno</th></tr>
    <?php foreach ($stats as $table => $count): ?>
    <tr><td><?= htmlspecialchars($table) ?></td><td><?= $count ?></td></tr>
    <?php endforeach; ?>
  </table>
  <div class="alert ok">
    <strong>Akoonkaaga maamulaha waa diyaar.</strong><br>
    Gal adigoo isticmaalaya email-ka iyo password-ka aad hadda dhigtay:<br>
    <code><?= htmlspecialchars($adminEmail ?? '') ?></code>
  </div>
  <div class="alert warn">
    <strong>Muhiim:</strong> Hadda tirtir <code>install.php</code> si aan qof kale
    dib u dhisin database-kaaga.
  </div>
  <a class="btn" href="login.html">Gal Nidaamka →</a>

<?php elseif ($alreadyInstalled && $_SERVER['REQUEST_METHOD'] !== 'POST'): ?>
  <h1>Nidaamku horey ayuu u rakiban yahay</h1>
  <p class="lead">Database-ku wuu jiraa waxaana ku jira xog. Haddii aad rabto inaad dib u dhisto,
  tirtir <code>config/config.local.php</code> kadibna dib u fur boggan.</p>
  <div class="alert warn"><strong>Muhiim:</strong> Tirtir <code>install.php</code> marka aad dhammayso.</div>
  <a class="btn" href="login.html">Gal Nidaamka →</a>

<?php else: ?>
  <h1>Rakibaadda Nidaamka</h1>
  <p class="lead">Buuxi xogta database-ka iyo akoonka maamulaha koowaad.
  Nidaamku wuxuu abuuri doonaa 34 table oo madhan — xog tijaabo ah lama gelinayo.</p>

  <div class="req">
    <?php foreach ($requirements as $label => $ok): ?>
      <div><span><?= htmlspecialchars($label) ?></span><span class="<?= $ok ? 'yes' : 'no' ?>"><?= $ok ? '✓ OK' : '✗ Maqan' ?></span></div>
    <?php endforeach; ?>
  </div>

  <?php if (!$requirementsOk): ?>
    <div class="alert err">Shuruudo ayaa maqan. Hubi PHP extensions-ka iyo rukhsadaha faylka ka hor.</div>
  <?php endif; ?>

  <?php foreach ($errors as $error): ?>
    <div class="alert err"><?= htmlspecialchars($error) ?></div>
  <?php endforeach; ?>

  <form method="post">
    <div class="row">
      <label>Database Host<input name="host" value="<?= htmlspecialchars($_POST['host'] ?? 'localhost') ?>" required></label>
      <label>Magaca Database-ka<input name="name" value="<?= htmlspecialchars($_POST['name'] ?? 'gabiley_police') ?>" required></label>
    </div>
    <div class="row">
      <label>Username<input name="user" value="<?= htmlspecialchars($_POST['user'] ?? 'root') ?>" required></label>
      <label>Password<input name="pass" type="password" value="<?= htmlspecialchars($_POST['pass'] ?? '') ?>"></label>
    </div>

    <div class="section-split">Akoonka Maamulaha Koowaad (Super Admin)</div>
    <label>Magaca Buuxa<input name="admin_name" value="<?= htmlspecialchars($_POST['admin_name'] ?? '') ?>" required></label>
    <label>Email<input name="admin_email" type="email" value="<?= htmlspecialchars($_POST['admin_email'] ?? '') ?>" required></label>
    <div class="row">
      <label>Password<input name="admin_pass" type="password" required minlength="10"></label>
      <label>Xaqiiji Password<input name="admin_pass_confirm" type="password" required minlength="10"></label>
    </div>
    <p class="hint">Ugu yaraan 10 xaraf, oo leh xaraf weyn, xaraf yar iyo tiro.
    Password-kan cidna lama wadaagayo, emailna laguma dirayo.</p>

    <button type="submit" <?= $requirementsOk ? '' : 'disabled' ?>>Rakib Nidaamka</button>
  </form>
<?php endif; ?>
</div>
</body>
</html>
