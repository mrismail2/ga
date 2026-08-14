<?php
/** Lightweight SMTP mailer for staff invitations (no Composer required). */
function mailConfig(): array {
    static $cfg = null;
    if ($cfg !== null) return $cfg;
    $path = __DIR__ . '/../config/mail.local.php';
    if (!is_readable($path)) {
        return $cfg = ['enabled' => false];
    }
    $loaded = require $path;
    $cfg = is_array($loaded) ? $loaded : ['enabled' => false];
    return $cfg;
}

function mailIsConfigured(): bool {
    $c = mailConfig();
    return !empty($c['enabled']) && !empty($c['host']) && !empty($c['from_email']);
}

function applicationBaseUrl(): string {
    $c = mailConfig();
    if (!empty($c['app_base_url'])) return rtrim((string)$c['app_base_url'], '/');
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['SERVER_PORT'] ?? '') === '443');
    $scheme = $https ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $script = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '/api/invitations.php');
    $basePath = preg_replace('#/api/[^/]+$#', '', $script);
    return $scheme . '://' . $host . rtrim($basePath ?: '', '/');
}

function smtpRead($socket): string {
    $response = '';
    while (($line = fgets($socket, 8192)) !== false) {
        $response .= $line;
        if (strlen($line) >= 4 && $line[3] === ' ') break;
    }
    return $response;
}

function smtpExpect($socket, array $codes): string {
    $response = smtpRead($socket);
    $code = (int)substr($response, 0, 3);
    if (!in_array($code, $codes, true)) {
        throw new RuntimeException('SMTP error ' . $code . ': ' . trim($response));
    }
    return $response;
}

function smtpCommand($socket, string $command, array $codes): string {
    fwrite($socket, $command . "\r\n");
    return smtpExpect($socket, $codes);
}

function sanitizeMailHeader(string $value): string {
    return trim(str_replace(["\r", "\n"], '', $value));
}

function encodeMailSubject(string $subject): string {
    return '=?UTF-8?B?' . base64_encode($subject) . '?=';
}

/** @return array{success:bool,error:?string} */
function sendHtmlMail(string $to, string $subject, string $html, ?string $text = null): array {
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) return ['success' => false, 'error' => 'Email-ka qofka ma saxna.'];
    $c = mailConfig();
    if (!mailIsConfigured()) return ['success' => false, 'error' => 'SMTP weli lama dejin.'];

    $host = (string)$c['host'];
    $port = (int)($c['port'] ?? 587);
    $enc  = strtolower((string)($c['encryption'] ?? 'tls'));
    $timeout = max(5, (int)($c['timeout'] ?? 15));
    $remote = ($enc === 'ssl' ? 'ssl://' : 'tcp://') . $host . ':' . $port;

    $errno = 0; $errstr = '';
    $socket = @stream_socket_client($remote, $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT);
    if (!$socket) return ['success' => false, 'error' => "SMTP connection failed: $errstr ($errno)"];
    stream_set_timeout($socket, $timeout);

    try {
        smtpExpect($socket, [220]);
        $ehloHost = preg_replace('/[^A-Za-z0-9.-]/', '', $_SERVER['SERVER_NAME'] ?? 'localhost') ?: 'localhost';
        smtpCommand($socket, 'EHLO ' . $ehloHost, [250]);

        if ($enc === 'tls') {
            smtpCommand($socket, 'STARTTLS', [220]);
            $crypto = @stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
            if ($crypto !== true) throw new RuntimeException('SMTP TLS lama bilaabi karin. Hubi OpenSSL iyo SMTP settings.');
            smtpCommand($socket, 'EHLO ' . $ehloHost, [250]);
        }

        $username = (string)($c['username'] ?? '');
        $password = (string)($c['password'] ?? '');
        if ($username !== '') {
            smtpCommand($socket, 'AUTH LOGIN', [334]);
            smtpCommand($socket, base64_encode($username), [334]);
            smtpCommand($socket, base64_encode($password), [235]);
        }

        $fromEmail = sanitizeMailHeader((string)$c['from_email']);
        $fromName  = sanitizeMailHeader((string)($c['from_name'] ?? 'Gabiley Police'));
        smtpCommand($socket, 'MAIL FROM:<' . $fromEmail . '>', [250]);
        smtpCommand($socket, 'RCPT TO:<' . $to . '>', [250,251]);
        smtpCommand($socket, 'DATA', [354]);

        $boundary = 'b_' . bin2hex(random_bytes(12));
        $text = $text ?? trim(preg_replace('/\s+/', ' ', strip_tags(str_replace(['<br>','<br/>','<br />'], "\n", $html))));
        $headers = [
            'Date: ' . date(DATE_RFC2822),
            'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . ($ehloHost ?: 'localhost') . '>',
            'From: ' . encodeMailSubject($fromName) . ' <' . $fromEmail . '>',
            'To: <' . sanitizeMailHeader($to) . '>',
            'Subject: ' . encodeMailSubject($subject),
            'MIME-Version: 1.0',
            'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
        ];
        $body = implode("\r\n", $headers) . "\r\n\r\n";
        $body .= '--' . $boundary . "\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($text)) . "\r\n";
        $body .= '--' . $boundary . "\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($html)) . "\r\n";
        $body .= '--' . $boundary . "--\r\n";
        $body = preg_replace('/(^|\r\n)\./', '$1..', $body);
        fwrite($socket, $body . "\r\n.\r\n");
        smtpExpect($socket, [250]);
        smtpCommand($socket, 'QUIT', [221]);
        fclose($socket);
        return ['success' => true, 'error' => null];
    } catch (Throwable $e) {
        @fwrite($socket, "QUIT\r\n");
        @fclose($socket);
        return ['success' => false, 'error' => $e->getMessage()];
    }
}

function invitationEmailHtml(string $name, string $role, array $pages, string $inviteUrl, string $expiresText): string {
    $safeName = htmlspecialchars($name, ENT_QUOTES, 'UTF-8');
    $safeRole = htmlspecialchars($role, ENT_QUOTES, 'UTF-8');
    $safeUrl = htmlspecialchars($inviteUrl, ENT_QUOTES, 'UTF-8');
    $items = '';
    foreach ($pages as $page) {
        $label = PAGE_LABELS[$page] ?? $page;
        $items .= '<li style="margin:5px 0">' . htmlspecialchars($label, ENT_QUOTES, 'UTF-8') . '</li>';
    }
    return '<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#172235">'
        . '<div style="padding:22px;background:#0f2f6f;color:white;border-radius:12px 12px 0 0"><strong>CIIDANKA BOOLISKA GOBOLKA GABILEY</strong><div style="font-size:13px;opacity:.85;margin-top:4px">Police Management System</div></div>'
        . '<div style="padding:26px;border:1px solid #dfe6ef;border-top:0;border-radius:0 0 12px 12px">'
        . '<h2 style="margin-top:0">Ku soo dhowow, ' . $safeName . '</h2>'
        . '<p>Taliyaha ayaa kuu sameeyey akoon <strong>' . $safeRole . '</strong> ah. Waxaad arki doontaa oo keliya qaybaha laguu oggolaaday.</p>'
        . '<p><strong>Qaybaha laguu furay:</strong></p><ul>' . $items . '</ul>'
        . '<p style="margin:26px 0"><a href="' . $safeUrl . '" style="background:#1f62d6;color:white;padding:13px 20px;text-decoration:none;border-radius:8px;font-weight:700">Samee Password oo Gal</a></p>'
        . '<p style="font-size:13px;color:#6c7788">Link-kan wuxuu dhacayaa ' . htmlspecialchars($expiresText, ENT_QUOTES, 'UTF-8') . '. Haddii aadan filayn email-kan, la xiriir Taliyaha.</p>'
        . '</div></div>';
}
