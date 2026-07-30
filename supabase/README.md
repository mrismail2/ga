# Kobciye — Phase 2: Supabase Backend

Backend foundation-ka Kobciye: database schema, migrations, row-level
security (RLS), storage buckets, iyo environment setup.

## Waxa ku jira

```
supabase/
├── config.toml                                 # supabase CLI project config
├── migrations/
│   ├── 20260702000001_initial_schema.sql       # tables, enums, triggers, id generator
│   ├── 20260702000002_rls_policies.sql         # amniga door kasta (RLS)
│   ├── 20260702000003_storage.sql              # buckets: school-logos, student-photos
│   ├── 20260702000004_seed.sql                 # 2 dugsi, maadooyinka, terms, grading
│   ├── 20260702000005_saas_foundation.sql      # academic_years, school_members, subscriptions, audit_logs, parents, staff
│   ├── 20260702000006_security_hardening.sql   # privilege-escalation fixes (round 1)
│   ├── 20260702000007_security_hardening_2.sql # round 2: admin bypass saarid, school_members xir, function EXECUTE revoke
│   └── 20260702000008_security_hardening_3.sql # round 3: allow-list profiles UPDATE, dugsi-abuurista super_admin oo keliya
└── tests/
    ├── security.test.js                        # 46 assertion — eeg "Security tests" hoose
    └── package.json
```

## Security tests

```bash
cd supabase/tests
npm install
npm test
```

Wuxuu ku shubaa migrations-ka oo dhan Postgres dhab ah (pglite — ma aha
mock), kadibna wuxuu isku dayaa weerarrada dhabta ah: signup metadata oo
sheegaya `super_admin`, user isku badalaya `role`/`school_id`-kiisa,
`school_admin` oo isku dayaya inuu ka gudbo `assign_role()` isaga oo si
toos ah wax uga qorayo miiska `profiles`, dugsi isku dayaya inuu wax ka
qoro dugsi kale, iyo `next_student_id()` oo si toos ah loo yeeri isku dayo
`anon`/`authenticated`. Dhammaan waxay ku socdaan door Postgres
`authenticated`/`anon` (ma aha superuser) si RLS run ahaan loo tijaabiyo,
ma aha si ay u soo baxaan si fudud (superuser wuxuu ka gudbaa RLS).

## 1. Samee Supabase project

1. Aad [supabase.com](https://supabase.com) → **New Project** (magac: `kobciye`).
2. Kaydi **Database Password**-ka aad dooratay.
3. **Settings → API** ka qaado:
   - `Project URL` (https://xxxx.supabase.co)
   - `anon public` key

## 2. Ku shub migrations-ka (Supabase CLI)

```bash
npm i -g supabase             # hal mar
supabase login
supabase link --project-ref <PROJECT-REF>   # ref-ka URL-kaaga
supabase db push              # waxay ku shubtaa migrations-ka isku xigxiga
```

**Ama CLI la'aan:** Dashboard → **SQL Editor** → migration kasta koobi geli
oo socodsii isku xigxiga (0001 → 0002 → 0003 → 0004 → 0005 → 0006 → 0007 → 0008).

## 3. Environment setup (mobile app)

```bash
cd mobile
cp .env.example .env
# .env geli URL-ka iyo anon key-ga project-kaaga:
#   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
#   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
npm install                   # @supabase/supabase-js horey ayuu ugu jiraa package.json
npm run web                   # ama: npx expo start
```

Client-ka: `mobile/src/services/supabase.js` — `.env` la'aan app-ku wuxuu sii
isticmaalaa keydka local-ka ah (prototype), marka `.env` la buuxiyo
`isSupabaseConfigured()` waa `true` oo backend-ka la isticmaali karaa.

`.env` waa **secret** — `.gitignore` ayuu ku jiraa, ha commit-garayn.

## 4. Qaab-dhismeedka database-ka

| Miis | Waxa uu hayo |
|---|---|
| `schools` | dugsiyada + prefix-ka ID ardayda (HID, NUR…) iyo sequence-ka |
| `profiles` | isticmaale kasta (auth) + `role` + dugsiga uu ka tirsan yahay |
| `subjects`, `classes`, `class_subjects` | maadooyinka iyo fasallada dugsi kasta |
| `teachers`, `teacher_classes`, `teacher_subjects` | macalimiinta iyo xilkooda |
| `students`, `student_parents` | ardayda + xiriirka waalidka ↔ ilmaha |
| `terms`, `exam_windows`, `exams`, `results` | imtixaannada (admin ayaa fura windows) |
| `attendance` | xaadiriska (hal diiwaan arday/maalin) |
| `payments`, `billing_records` | maaliyadda |
| `incidents`, `messages`, `notices` | kiisaska, fariimaha, ogeysiisyada |
| `grading_rules` | heerarka darajooyinka dugsi kasta |

**Otomaatig:**
- Arday cusub oo aan `student_id` lahayn → trigger ayaa siiya ID-ga xiga
  ee dugsigiisa (`HID-001`, `HID-002` …) isaga oo sequence-ka si ammaan ah
  u kordhinaya (row lock — labo arday isku ID ma heli karaan).
- Auth signup kasta → row `profiles` ah ayaa toos loogu abuuraa, **`role`
  waxay had iyo jeer noqotaa `'pending'`** (`school_id = null`). `role`
  iyo `school_id`-ga signup metadata-ka lagama qaato — caller-ku wuxuu
  metadata-ka geliyi karaa wax kasta (`{"role":"super_admin"}`), sidaas
  darteed laguma kalsoonaan karo.

## 5. Sida loo helo door dhab ah (privilege escalation-ka waa la xannibay)

`pending` ma arki karto wax — `school_id` ma laha, RLS-na miis kastaba wuxuu
u baahan yahay `school_id` iyo `role` sax ah. Laba jid oo keliya ayaa jira
oo lagu heli karo door — **midna ma aha self-service**:

- **`create_school_as_super_admin(name, slug, location, initial_admin_profile_id)`**
  — waxaa keliya wici kara account-ka `role`-kiisu si dhab ah u yahay
  `super_admin` (database-ka lagaga hubiyo, lama isku halleeyo wax uu
  client-ku soo diro). Wuxuu abuuraa dugsi CUSUB, subscription trial-kiisa,
  kadibna wuxuu profile-ka `pending` ee la sheegay ka dhigaa
  `school_admin`-ka koowaad ee dugsigaas. Account `pending` ma abuuri karo
  dugsigiisa, kumana beddeli karo doorkiisa isagoo dugsi abuuraya —
  weligeed abuurista dugsi kama aha self-service. (`provision_school()`
  ee mar hore jirtay oo self-service ahayd hadda waa la joojiyay
  weligeed — `EXECUTE` looga saaray door kasta oo client ah — waxaana
  loo hayaa taariikh keliya.)
- **`assign_role(profile_id, role, school_id)`** — `school_admin` (dugsigiisa
  gudihiisa) ama `super_admin` ayaa siin kara qof kale door. `super_admin`
  kaliya ayaa siin kara door `super_admin` ah. Wicitaan kastaa waxaa lagu
  qoraa `audit_logs`.

RLS oo keliya kuma filna profiles — user-ku wuxuu weli UPDATE gareyn karaa
saf-kiisa (`id = auth.uid()`), taasoo aan xaddidin CONTENT-ka (ma aha kaliya
role/school_id, waxa kale sida `created_at`/`updated_at` sidoo kale).
Trigger `guard_profile_privileged_fields()` (hadda **allow-list**, ma aha
deny-list) ayaa xaddida taas: qof kasta wuu badali karaa
`full_name`/`phone`/`avatar_url` kaliya — wax kasta oo kale (oo ay ku jiraan
`role`, `school_id`, `id`, `created_at`, `updated_at`, iyo tiir kasta oo
mustaqbalka lagu daro) waa la diidayaa si automatig ah. Isbadalka
`role`/`school_id` wuxuu keliya u ogolyahay
`assign_role()`/`create_school_as_super_admin()` (ama session aan JWT
lahayn — SQL Editor-ka, marka la bilaabayo `super_admin`-ka ugu horreeya).

## 6. Amniga (RLS) — sida app-ka oo kale

Doorka wuxuu ka imanayaa login-ka (landing): **Dugsiga** (maamule &
macalin), **Waalid**, **Arday** — laakiin door dhab ah ma jiro ilaa
`assign_role()`/`create_school_as_super_admin()` la wado (Phase 3).

| Door | Waxa uu arki/qori karaa |
|---|---|
| `super_admin` | wax walba |
| `school_admin` | wax walba dugsigiisa gudihiisa |
| `teacher` | xogta dugsiga; wuxuu qoraa xaadiris, imtixaanno, natiijooyin, kiisas |
| `accountant` | maaliyadda dugsigiisa |
| `parent` | kaliya xogta caruurtiisa (natiijooyin la daabacay, xaadiris, lacago) |
| `student` | kaliya xogtiisa |
| `pending` | midna — sugaya in loo dhiibo door |

**Cross-school guards:** trigger kasta oo ku xiraya laba xog (macalin↔fasal,
macalin↔maado, fasal↔maado, arday↔fasal, imtixaan↔fasal/maado/macalin,
natiijo↔imtixaan/arday, xaadiris↔fasal/arday, waalid↔arday) wuu xaqiijiyaa
in labaduba isku dugsi (`school_id`) ka yihiin — haddii kale wuu diidaa.

## 7. Storage

| Bucket | Access | Path |
|---|---|---|
| `school-logos` | public read; admin-ka dugsiga ayaa qori kara | `<school_id>/logo.png` |
| `student-photos` | private; staff-ka dugsiga + waalid/arday (kooda) | `<school_id>/<student_uuid>.jpg` |

Helpers: `schoolLogoUrl()` iyo `studentPhotoUrl()` — `mobile/src/services/supabase.js`.

## 8. Local development (ikhtiyaari)

```bash
supabase start        # Docker ku socodsii Postgres + Auth + Storage local ahaan
supabase db reset     # migrations + seed dib u shub
# Studio: http://localhost:54323
```

---
**Phase-ka xiga (Phase 3):** screens-ka app-ka in laga beddelo keydka
local-ka ah (AsyncStorage) loona wareejiyo Supabase queries + auth dhab ah.
