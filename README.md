# CIIDANKA BOOLISKA GOBOLKA GABILEY — Police Management System

Nidaam **hal saldhig** ah oo loogu talagalay Saldhigga Ciidanka Booliska Gobolka Gabiley. Waxa uu isku daraa diiwaannada dadka, command-and-control, kiisaska, caddeymaha, custody-ga, hawlaha iyo audit-ka hal xog-ururin oo role-ku-saleysan.

> **Xaddidaadda muhiimka ah:** mashruucani wuxuu qaabeeyaa hab-raacyada caadiga ah ee police information systems, laakiin ma aha nidaam si madax-bannaan loogu shahaadeeyey CJIS, ISO 27001 ama sharci gaar ah. Ka hor isticmaal dhab ah waxaa loo baahan yahay legal review, security assessment, backup/DR testing, training iyo policy maxalli ah.

## Qaybaha waaweyn

- **CAD / Emergency Calls:** call number, caller, priority P1–P4, goob, unit, dispatch status iyo incident xiriirsan.
- **Command Center:** dhacdooyinka furan, units-ka, hawlgallada iyo warbixinta taliska.
- **Case Management:** kiis, investigator, suspects/victims/witnesses (`case_persons`), status iyo priority.
- **Warrants & Arrests:** authority, warrant, arrest basis, rights explained, officer iyo case link.
- **Custody & Booking:** prisoner link, legal authority, property inventory, medical screening, risk, cell, review iyo welfare checks.
- **Evidence & Chain of Custody:** evidence register, movement history, from/to location, releaser/receiver, seal iyo SHA-256 document hashes.
- **Duty Roster:** officer, date, shift, assignment, zone, supervisor iyo attendance status.
- **Workflow Tasks:** task number, assignee/role, entity link, priority, deadline, overdue/completed.
- **Controlled Documents:** PDF/JPG/PNG/DOCX/XLSX/TXT, classification, clearance check, private download iyo audit.
- **Profiles:** users, officers, citizens iyo prisoners dhammaantood sawir profile ayay leeyihiin.
- **Supporting modules:** patrol, fleet/road-safety, intelligence, complaints, field reports, finance, report register, settings iyo role-aware global search.
- **People-in-case:** victim, witness, suspect, accused, complainant, informant, statement status iyo vulnerable-person flag.

## Qaab-dhismeedka

```text
├── install.php
├── index.html / login.html / dashboard.html
├── app.js / styles.css
├── assets/
│   ├── api.js
│   └── uploads/
│       ├── profiles/
│       └── documents/       # direct web access waa la xannibay
├── api/
│   ├── auth/
│   ├── dispatch.php
│   ├── arrests.php
│   ├── custody.php
│   ├── roster.php
│   ├── tasks.php
│   ├── evidence-chain.php
│   ├── documents.php
│   └── ...existing modules
├── includes/
│   ├── helpers.php
│   └── permissions.php
└── database/
    ├── schema.sql            # 34 tables
    ├── bootstrap.sql         # roles + station + settings only (no demo data)
    ├── migration_single_station_profiles.sql
    └── migration_global_policing.sql
```

## Rakibaad cusub

1. Ku shub folder-ka server leh **PHP 8+**, `pdo_mysql`, `mbstring` iyo MySQL 5.7+/MariaDB 10.3+.
2. Hubi in `config/`, `assets/uploads/profiles/` iyo `assets/uploads/documents/` la qori karo.
3. Fur `install.php`.
4. Buuxi database host/name/user/password **iyo akoonka maamulaha koowaad**
   (magac buuxa, email, password), kadib guji **Rakib Nidaamka**.
5. Marka uu dhammaado, **tirtir `install.php`**.
6. Gal `login.html`.

Habka terminal-ka:

```bash
mysql -u root -p < database/schema.sql
mysql -u root -p gabiley_police < database/bootstrap.sql
php -S localhost:8000
```

## Cusboonaysiin database hore

Haddii aad haysato noocii hore ee profile-ka iyo hal-saldhigga:

1. Samee backup buuxa.
2. Orod hal mar:

```bash
mysql -u root -p gabiley_police < database/migration_global_policing.sql
```

Migration-ku wuxuu ku daraa CAD, warrants/arrests, custody, chain-of-custody, roster, tasks, documents, login throttling iyo audit fields. Faylku waa **one-time migration**; ha ku celin database hore loo migrate-gareeyey.

### Cusboonaysiinta noocan (production UI / no-demo)

Haddii database-kaagu horey u shaqaynayay, orod migration-kan **nabdoon**. Ma
tirtiro table, ma tirtiro diiwaanno, dib umana dhiso database-ka:

```bash
mysqldump -u root -p gabiley_police > backup-$(date +%F).sql
mysql -u root -p gabiley_police < database/migration_production_ui.sql
```

Wuxuu keliya nadiifiyaa tirooyinkii gacanta lagu qoray ee `stations`
(hadda si toos ah ayaa loo xisaabiyaa) iyo email placeholder-ka.

Haddii rakibaaddaadu ahayd mid **xogta demo-ga oo keliya** ku shaqaynaysay oo
aadan weli xog dhab ah gelin, waxaa jira fayl **ikhtiyaari** ah oo tirtira
diiwaannadii tijaabada ahaa:

```bash
mysql -u root -p gabiley_police < database/optional_remove_demo_records.sql
```

> Faylkaas **wuu tirtiraa rows**. Ha ordin haddii saldhiggu xog dhab ah galiyey —
> halkii, ka tirtir diiwaannada demo-ga mid mid application-ka dhexdiisa.

## Akoonka koowaad

Nidaamku ma leh akoon hore loo sameeyay iyo password wadaagsan. `install.php`
wuxuu weydiiyaa magaca, email-ka iyo password-ka maamulaha koowaad, kadibna
wuxuu abuuraa hal akoon **Super Admin** ah. Password-ka waxaa lagu kaydiyaa
bcrypt (cost 12); emailna laguma diro.

Shaqaalaha intiisa kale waxaa lagu daraa **Users & Permissions → Email ugu
Casuum Shaqaale**; qofkaasi wuxuu password-kiisa ka sameystaa link ammaan ah.

Database-ku wuxuu ku bilaabmaa **diiwaanno madhan** — saraakiil, kiisas,
caddeymo iyo maxaabiis tijaabo ah lama gelin. Tirakoob kasta oo dashboard-ka
ah wuxuu ka soo baxaa `COUNT` toos ah, sidaas darteed database madhan wuxuu si
sax ah u tusayaa `0`, qayb kastaana waxay tusaysaa empty state.

## Roles & access

- **Super Admin:** system configuration, users, dhammaan operational modules.
- **Commander:** command, CAD, roster, cases, arrests, custody, evidence, reports, finance, staff invitations iyo individual permissions.
- **Investigator:** assigned cases, arrests, evidence, custody view, documents, intelligence iyo tasks.
- **Evidence Officer:** evidence, chain-of-custody, documents, related cases iyo custody view.
- **Officer:** dispatch view, own roster, patrol, assigned tasks, own field reports iyo profile.

Sidebar-ka la qariyo waa UI convenience; API walba wuxuu isticmaalaa `requirePage()`/`requireCapability()` iyo per-user grants si access-ka server-ka looga xaddido.

**Fail-closed staff access:** marka `user_permissions` table-ku jiro, shaqaale caadi ah oo aan weli Taliyuhu rukhsad gaar ah siin wuxuu arkaa oo keliya Dashboard-ka aasaasiga ah iyo Profile-kiisa. Qayb kale ama action kale ma furmayo ilaa si gaar ah loo oggolaado.

## Workflow-yada muhiimka ah

### CAD → Incident

1. Call-taker wuxuu abuuraa wicitaan.
2. System-ku wuxuu sameeyaa `CALL-*` iyo incident `INC-*` xiriirsan.
3. Unit ayaa loo qoondeeyaa, status-kuna wuxuu maraa `Validated → Dispatched → Responding → At Scene → Resolved`.
4. P1 call wuxuu abuuraa task Critical oo commander-ka u socda.

### Warrant → Arrest → Custody

1. Warrant waxaa lagu xiraa case iyo issuing authority.
2. Arrest wuxuu qabtaa legal basis, officer, goob, waqtiga iyo rights explained.
3. Booking wuxuu u baahan yahay prisoner record iyo legal authority.
4. Medical screening, risk, property inventory, cell iyo review deadline waa la diiwaangeliyaa.
5. Welfare check kasta wuxuu yeeshaa user, timestamp, observation iyo action.

### Evidence chain

1. Evidence item ayaa la abuuraa.
2. Dhaqdhaqaaq kasta waxaa lagu qoraa movement type, locations, users, purpose, seal iyo timestamp.
3. Documents-ka la xiriira waxaa loo sameeyaa SHA-256 hash.
4. Upload/download iyo movement kasta audit log ayuu galayaa.

## Amniga la hirgeliyey

- Bcrypt password hashes (cost 12).
- Strong-password policy marka user cusub/password cusub la sameeyo.
- Account throttling iyo 15-daqiiqo lock ka dib login failures badan.
- 30-daqiiqo inactivity timeout iyo session revocation.
- Secure/HttpOnly/SameSite session cookies; HTTPS marka server-ku bixiyo.
- CSRF token dhammaan authenticated write requests.
- Same-origin CORS, `nosniff`, restrictive referrer/permissions headers.
- PDO prepared statements.
- Central RBAC + data scope.
- Security clearances: Public, Official, Restricted, Secret.
- Audit: user, action, entity, IP, user-agent, request ID iyo outcome.
- Document MIME allowlist, 15 MB limit, randomized stored names, SHA-256 hash iyo direct-access block.
- Profile image MIME/dimension validation, 3 MB limit.
- Hal-saldhig enforcement: `station_id = 1`; API ma abuuri karo saldhig labaad.

### Waxa weli production-ka looga baahan yahay

- HTTPS certificate iyo secure reverse proxy.
- MFA/2FA provider oo dhab ah; database-ka wuxuu leeyahay field diyaar ah, laakiin mashruucu ma fuliyo TOTP/SMS MFA.
- Staff invitation email SMTP waa la taageeraa; SMS/push iyo automatic operational-alert provider/escalation service weli dibadda ayaa looga baahan yahay.
- PDF/Excel reporting engine; hadda report-ku waa database summary/print-ready record oo keliya.
- Encrypted backups, disaster recovery, retention/destruction policy.
- Encryption at rest iyo key-management ku habboon deegaanka.
- Penetration test, dependency/server patching, centralized monitoring iyo alerting.
- Privacy/legal rules: access approvals, disclosure, expungement, court procedures iyo data-sharing agreements.
- High-availability infrastructure haddii hawlgal 24/7 la doonayo.

## API-yada cusub

| Endpoint | Shaqada |
|---|---|
| `api/dispatch.php` | CAD calls, auto-linked incidents, dispatch status |
| `api/arrests.php` | arrests + `?view=warrants` |
| `api/custody.php` | bookings + `?view=checks` |
| `api/roster.php` | duty roster iyo own-duty updates |
| `api/tasks.php` | workflow tasks iyo completion |
| `api/evidence-chain.php` | evidence movement history |
| `api/documents.php` | controlled list/upload/download |
| `api/search.php` | role-aware global search |

Dhammaan authenticated POST/PUT/DELETE requests waxay u baahan yihiin `X-CSRF-Token`; `assets/api.js` si otomaatig ah ayuu u diraa.

## Hubinta ka hor deployment

```bash
find . -name '*.php' -print0 | xargs -0 -n1 php -l
node --check app.js
node --check assets/api.js
```

Kadib samee manual role test: Super Admin, Commander, Investigator, Evidence Officer iyo Officer; tijaabi access-denied, upload/download, CAD lifecycle, arrest-to-custody, evidence movement, session timeout iyo audit entries.

## Staff email invitations + individual permissions

Noocan wuxuu ku darayaa **per-user access control**. Role-ku wuxuu bixiyaa default shaqo; shaqaale caadi ah access-kiisa dhabta ah waxaa go’aamiya rukhsadaha Taliyuhu qofkaas si gaar ah ugu qoro:

- pages/menus-ka uu arki karo;
- capabilities-ka uu samayn karo (tusaale create/update cases, manage evidence, view/manage finance);
- data scope: `own`, `assigned`, ama `all` (workflow-yada leh owner/assignee sida cases, roster, tasks iyo field reports).

Rukhsaddu **server-side** ayay ka shaqaysaa. Haddii menu la qariyo oo shaqaaluhu isku dayo URL/API toos ah, `requirePage()`/`requireCapability()` ayaa 403 ku diidaya. Marka rukhsad shaqaale la beddelo, sessions-kiisa jira waa la revoke-gareeyaa si isbeddelku isla markiiba u dhaqan galo.

### Email invitation workflow

1. Taliyaha wuxuu furaa **Users & Permissions**.
2. Wuxuu gujiyaa **Email ugu Casuum Shaqaale**.
3. Wuxuu geliyaa magaca/email/role/clearance.
4. Wuxuu calaamadeeyaa pages iyo actions-ka loo oggolaaday.
5. System-ku wuxuu abuuraa invitation token 256-bit ah, database-kana waxaa lagu kaydiyaa SHA-256 hash oo keliya.
6. Link-gu wuxuu shaqaynayaa 48 saac.
7. Shaqaaluhu link-ga ayuu ka sameystaa password-kiisa; temporary password email laguma diro.
8. Invitation-ku hal mar ayuu shaqeeyaa, kadibna `accepted` ayuu noqdaa.

SMTP-ga waxaa lagu dejiyaa `config/mail.local.php`. Nuqul ka samee `config/mail.local.example.php`. Haddii SMTP aan la dejin, invitation account/rukhsado way samaysmaan, Taliyuhuna wuxuu heli karaa link uu shaqaalaha u gudbiyo.

### Existing database upgrade

Haddii database-ku hore u jiray, backup samee kadib browser-ka ka fur:

```text
http://localhost/ciidanka/upgrade-access.php
```

Guji upgrade-ka hal mar, kadib **tirtir `upgrade-access.php`**. SQL-ga u dhigma waa `database/migration_staff_permissions_email.sql`.

> `config/mail.local.php` waxaa ku jira SMTP secret/app-password; `.gitignore` ayaa ka reebaya, hana la wadaagin.
