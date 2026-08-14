<?php
/**
 * Nuqul ka samee faylkan oo u bixi: config/mail.local.php
 * Kadib geli SMTP xogtaada.  Ha gelin faylkaas Git/public backup.
 */
return [
    'enabled'      => false,
    'host'         => 'smtp.gmail.com',
    'port'         => 587,
    'encryption'   => 'tls', // tls | ssl | none
    'username'     => 'your-email@gmail.com',
    'password'     => 'YOUR_APP_PASSWORD',
    'from_email'   => 'your-email@gmail.com',
    'from_name'    => 'Ciidanka Booliska Gobolka Gabiley',
    // Haddii isla PC-ga kaliya laga galayo XAMPP: http://localhost/ciidanka
    // Haddii shaqaaluhu PC/telefoon kale ka furayaan, isticmaal URL/IP ay gaadhi karaan,
    // tusaale: http://192.168.1.50/ciidanka ama production HTTPS domain.
    'app_base_url' => 'http://localhost/ciidanka',
    'timeout'      => 15,
];
