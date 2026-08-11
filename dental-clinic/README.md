# Dental Clinic Management System

A production-ready management system for **one dental clinic with one internal
pharmacy**. It replaces the clinic's physical registration book with a digital
patient record, and it tracks the installment payments (*hafto*) that the book
could never keep straight.

Built with **React + TypeScript + Vite** on **Supabase (PostgreSQL, Auth,
Storage, Row Level Security)**.

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

Apply the database in the Supabase SQL editor (or `supabase db push`), in order:

```
supabase/migrations/0001_schema.sql          tables, enums, constraints, indexes
supabase/migrations/0002_functions.sql       balance views, RPCs, triggers
supabase/migrations/0003_rls.sql             Row Level Security + storage bucket
supabase/migrations/0004_reference_data.sql  treatment price list, categories, settings
```

Then create the first admin: sign the user up in Supabase Auth, and set
`role = 'admin'` on their `profiles` row. Every later account can be created
from **Staff → Add staff account** inside the app.

> `0004_reference_data.sql` contains only configuration — the treatment price
> list, medicine categories and clinic settings. There are **no sample patients,
> treatments or payments**: the clinic's real records are the only data that
> should ever exist.

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

**Clinic** — Dashboard · Patients · Appointments · Patient queue
**Clinical** — Dental treatments · Braces/orthodontics · Prescriptions · Dental chart · Examinations · Documents
**Finance** — Payments · Outstanding balances · Expenses · Receipts · Patient statements
**Pharmacy** — Dispensing · Medicines & stock · Batches · Sales · Purchases · Suppliers
**Administration** — Reports · Staff · Audit log · Settings

Every list has explicit **loading, empty and error** states, and every screen
reads from the database — there are no hardcoded numbers and no dead buttons.

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

30 assertions covering installments, duplicate payments, voiding, the tooth
chart, pharmacy stock and expiry, double-booking and the integrity guards.

---

## Project structure

```
dental-clinic/
├── supabase/
│   ├── migrations/          schema, functions, RLS, reference data
│   └── test/                local Supabase stub + business-rule tests
└── src/
    ├── lib/                 supabase client, permissions, formatting
    ├── types/database.ts    types mirroring the SQL schema
    ├── services/            one module per domain; all queries live here
    ├── hooks/useAuth.tsx    session, profile, role and permission context
    ├── components/
    │   ├── ui/              buttons, forms, tables, modals, states, charts
    │   ├── layout/          app shell, sidebar, global search
    │   ├── dental/          interactive FDI tooth chart
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
