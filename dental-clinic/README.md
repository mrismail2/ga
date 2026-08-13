# Dental Clinic Management System

A production-ready management system for **one dental clinic with one internal
pharmacy**. It replaces the clinic's physical registration book with a digital
patient record, and it tracks the installment payments (*hafto*) that the book
could never keep straight.

Built with **React + TypeScript + Vite** on **Supabase (PostgreSQL, Auth,
Storage, Row Level Security)**.

The interface is **Af-Soomaali first**. English is available from the `SO / EN`
switch in the topbar and on the sign-in card — see [Language](#language).

---

## Nidaamku maxuu xalliyaa? / What it solves

Rugta ilkuhu waxay ku xareysaa buugag waaweyn: magacyada bukaanka, daaweynta,
qalinka (braces), buuxinta (filling)… iyo cidda weli lacag ku maqan. Nidaamkani
wuxuu daqiiqado gudahood ka jawaabaa:

| Su'aasha | Meesha laga helo |
|---|---|
| Yuu yahay bukaankan? | Global search — magac, aqoonsi (DNT-000001) ama telefoon |
| Daaweyn maxaa la sameeyay? | Patient profile → Treatments |
| Ilig kee baa la daaweeyay, goorma, yaana daaweeyay? | Dental chart (FDI) — taariikh dhamaystiran |
| Immisa buu ku kacay? Immisa buu bixiyay? Immisa ayaa hadhay? | Outstanding balances + patient statement |
| Ballanka xiga waa goorma? | Patient profile header + Appointments |
| Daawo kee baa loo qoray? | Prescriptions → Pharmacy dispensing |

---

## Quick start

```bash
cd dental-clinic
npm install
cp .env.example .env.local     # add your Supabase URL + anon key
npm run dev
```

### Try it without a backend

```bash
npm run demo      # http://localhost:5173
```

The demo build swaps the Supabase client for an in-memory one in `src/demo`,
so every screen works with realistic sample data — useful for a walkthrough or
for the screenshots in `screenshots/`. `npm run dev` and `npm run build` are
unaffected and always use the real Supabase client.

---

Apply the database in the Supabase SQL editor (or `supabase db push`), in order:

```
supabase/migrations/0001_schema.sql          tables, enums, constraints, indexes
supabase/migrations/0002_functions.sql       balance views, RPCs, triggers
supabase/migrations/0003_rls.sql             Row Level Security + storage bucket
supabase/migrations/0004_reference_data.sql  service list, medicine categories, settings
supabase/migrations/0005_completion.sql      cancellation reasons and their guards
```

Then create the first admin: sign the user up in Supabase Auth, and set
`role = 'admin'` on their `profiles` row. Every later account can be created
from **Staff → Add staff account** inside the app.

> `0004_reference_data.sql` contains only configuration — the treatment price
> list, medicine categories and clinic settings. There are **no sample patients,
> treatments or payments**: the clinic's real records are the only data that
> should ever exist.

---

## Language

Every screen, dialog, table header, validation message, toast, badge and enum
label is translated. Somali is the default; the choice is stored in
`localStorage` under `dc_lang` and survives a reload.

| Piece | Where |
|---|---|
| Both dictionaries | `src/i18n/dictionary.ts` |
| Provider, `t()` and `label()` | `src/i18n/index.tsx` |
| Dates, durations, ages | `src/lib/format.ts` |

```ts
const { t, label } = useI18n();

t('pay.amountHint', { max: money(balance) })  // interpolates {max}
label('status', appointment.status)           // translates a database enum
```

The English dictionary is declared `as const` and `TranslationKey` is derived
from it, so `so` is typed `Record<TranslationKey, string>`: **a missing Somali
string is a TypeScript error**, not a silent fallback at runtime.

Dates are formatted without a date-fns locale — `setFormatLanguage()` is called
by the provider and `src/lib/format.ts` carries Somali weekday and month names
(`Arbaco, 12 Agoosto 2026`), relative times (`4 maalmood kahor`) and ages
(`31 sano`).

Two things stay in the database rather than in the dictionary, because the
clinic owns them and can edit them from Settings:

- **Treatment names and medicine categories** — seeded in Somali by
  `0004_reference_data.sql`, with the codes (`RCT`, `FILLING`) left in English
  so receipts and exports read the same in both languages.
- **Free-text clinical values** written by staff (braces type, compliance,
  clinical notes). Fixed choices like `Metal fixed` are stored in English and
  displayed through `label('braces', …)` / `label('comp', …)`, so switching
  language never rewrites a patient's record.

---

## Roles

| Role | Can do |
|---|---|
| **Admin** | Everything, plus staff, permissions, settings, audit log and voiding payments |
| **Dentist** | Patients, dental chart, examinations, treatment plans, orthodontics, prescriptions. **No** financial writes unless granted |
| **Receptionist** | Register/search patients, appointments, check-in, record payments, print receipts, view balances |
| **Pharmacist** | Prescriptions, dispensing, stock, sales, purchases, suppliers |

Roles are the baseline; an admin can grant extra capabilities per person
(**Staff → Permissions**). Menus are hidden in the UI for convenience, but the
rules are enforced by RLS policies and `SECURITY DEFINER` functions in the
database — bypassing the UI gains nothing.

---

## How the money works

This is the part the clinic gets wrong on paper, so the design is deliberate:

* **Cost lives in one place.** `treatments.final_cost` is a generated column
  (`estimated_cost - discount`). An orthodontic case does not store its own
  price; it points at the treatment that carries it.
* **Balances are never stored.** `v_treatment_balances` recomputes
  `amount_paid` and `balance` from the `payments` rows every time it is read,
  so the paid/remaining figures cannot drift out of sync.
* **Payments only go through `record_payment()`.** There is no INSERT policy on
  `payments`. The function locks the treatment row, refuses an amount above the
  remaining balance, and de-duplicates repeat submissions with a client token —
  a double-clicked button cannot create two payments.
* **Nothing is deleted.** A mistake is voided with `void_payment()`, which
  requires an admin and a reason, keeps the original row, and restores the
  balance.

```
Braces  $500
  payment 1  $100  →  paid $100, remaining $400, status Partial
  payment 2   $50  →  paid $150, remaining $350, status Partial
  payment 3  $100  →  paid $250, remaining $250, status Partial
  payment 4  $250  →  paid $500, remaining   $0, status Fully paid
```

---

## Modules

**Clinic** — Dashboard · Patients (register, edit, archive/restore) · Appointments (book, check in, reschedule, cancel) · Patient queue
**Clinical** — Dental treatments · Treatment plans · Braces/orthodontics · Prescriptions (write, cancel) · Dental chart · Examinations · Medical history · Documents
**Finance** — Payments · Outstanding balances · Expenses · Receipts · Patient statements
**Pharmacy** — Dispensing · Medicines & stock · Batches · Sales · Purchases · Suppliers
**Administration** — Reports (with CSV export) · Staff · Audit log · Settings · My account

Every list has explicit **loading, empty and error** states, and every screen
reads from the database — there are no hardcoded numbers and no dead buttons.
Every service function in `src/services` is reachable from the interface; there
is no capability that exists only in code.

### The patient record

The profile is the whole paper file: overview, dental chart, treatments and
plans, clinical notes and examinations, payments, appointments, prescriptions
and documents. Beyond reading it you can

- **edit** any registration detail, and **archive** the patient — hidden from
  lists and search, never deleted, restorable by an admin;
- add to an **append-only medical history**, so a condition recorded once stays
  in the record even when it is later corrected;
- record a **dental examination** (complaint, history, findings, diagnosis,
  recommendation);
- open a **treatment plan** grouping what was agreed with the patient;
- **upload documents** — X-rays, photos, consent forms — into a private bucket
  reached only through five-minute signed URLs, deletable by an admin.

---

## The service list is the dentist's own

**Settings → Services & prices** is the clinic's menu, editable by the admin at
any time. Adding a service asks for a **name and a price** — nothing else is
required. The internal code (`SCALING`, `RCT`) that receipts and exports use is
generated from the name, deduplicated against the existing ones, and shown
read-only afterwards.

A service that the clinic does not offer is **switched off, never deleted**:

- it disappears from the treatment and appointment pickers immediately;
- it stays visible (greyed) in Settings so it can be switched back on;
- treatments already recorded against it keep working, and keep the price they
  were created with — changing a price here only affects new treatments.

`0004_reference_data.sql` seeds the common dental services as a starting point.
A clinic that does something different keeps the ones it does, switches off the
rest, and adds its own — no migration, no developer.

Because the clinic runs with a **single dentist**, the dentist field on
bookings, treatments and braces visits fills itself in when exactly one active
dentist exists. Add a second one and the choice comes back automatically.

---

## Data integrity guarantees

Enforced in PostgreSQL, verified by the test suite:

- Duplicate patient warning before registering (same phone or similar name)
- Payments cannot be negative, or exceed the remaining balance
- The same payment submitted twice creates one row
- Payments and clinical records are voided/archived, never deleted
- Stock can never go negative
- **Expired medicine is never dispensed or sold** — deduction is first-expiring-first
- A prescription cannot be dispensed beyond the quantity prescribed
- A dentist cannot be double-booked (PostgreSQL exclusion constraint)
- The tooth chart is append-only: every change keeps the previous record
- The medical history is append-only for the same reason
- A cancelled appointment or prescription **must carry a reason**
- A completed appointment cannot be cancelled after the fact
- A prescription cannot be cancelled once medicine has been dispensed against it
- Archiving a patient keeps their treatments, payments and chart, and is reversible
- A patient must have either a date of birth or an age
- Every important action is written to `audit_logs` by a database trigger

---

## Running the database tests

The rules above are covered by a SQL test suite that runs against a plain
PostgreSQL instance (the Supabase-specific pieces are stubbed):

```bash
createdb clinic
psql -d clinic -f supabase/test/00_supabase_stub.sql
psql -d clinic -f supabase/migrations/0001_schema.sql
psql -d clinic -f supabase/migrations/0002_functions.sql
psql -d clinic -f supabase/migrations/0003_rls.sql
psql -d clinic -f supabase/migrations/0004_reference_data.sql
psql -d clinic -v ON_ERROR_STOP=1 -f supabase/test/01_business_rules.sql
```

42 assertions covering installments, duplicate payments, voiding, the tooth
chart, pharmacy stock and expiry, double-booking, cancellations, patient
archiving, the append-only medical history and the integrity guards.

---

## Project structure

```
dental-clinic/
├── supabase/
│   ├── migrations/          schema, functions, RLS, reference data
│   └── test/                local Supabase stub + business-rule tests
└── src/
    ├── demo/                in-memory client + sample data for `npm run demo`
    ├── i18n/                Somali + English dictionaries and the t() provider
    ├── lib/                 supabase client, permissions, formatting, CSV export
    ├── types/database.ts    types mirroring the SQL schema
    ├── services/            one module per domain; all queries live here
    ├── hooks/useAuth.tsx    session, profile, role and permission context
    ├── components/
    │   ├── ui/              buttons, forms, tables, modals, states, charts
    │   ├── layout/          app shell, sidebar, global search
    │   ├── dental/          interactive FDI tooth chart
    │   ├── patients/        edit-patient dialog
    │   └── finance/         payment dialog, receipt, patient statement
    └── pages/               one file per screen
```

---

## Security notes

- Only the **anon key** ever reaches the browser. The service-role key must
  never appear in this bundle.
- Every table has RLS enabled. Views are `security_invoker`, so they inherit
  the caller's policies.
- Money and stock mutations are `SECURITY DEFINER` RPCs that re-check
  permissions themselves.
- Patient documents live in a **private** Storage bucket; the app only ever
  hands out short-lived signed URLs.

---

## What is not included

- Multi-clinic / multi-branch / SaaS tenancy — deliberately out of scope
- SMS or email sending (reminder templates are not wired to a provider)
- Offline mode
