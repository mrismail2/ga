# Kobciye Mobile (React Native · Expo)

Kobciye School Management System — **Phase 1 & Phase 2 Frontend Prototype (Complete)**.
A native iOS / Android / Web app built with **Expo SDK 52 + React Native 0.76**,
sharing the brand, layout, Somali labels and role dashboards of the Kobciye web
dashboard.

> **This is a frontend prototype.** Real authentication, secure database
> storage, school isolation, permissions and security policies must be enforced
> by **backend services in Phase 3**. All persistence here is local, device-only
> AsyncStorage for UI preview.

---

## Canonical identity model

Every module now uses **one** consistent identity system. Names and codes are
display-only and are never used as relationship keys.

### School
- **`school_id`** (e.g. `school_001`) is the **only** school relationship key —
  used by every profile, class, student, attendance, exam, payment, incident,
  message, billing and settings record.
- **`slug`** (e.g. `hidaayada`) is display/URL text only — never a relation key.
- Helpers: `getSchoolById(schoolId)`, `getSchoolBySlug(slug)`,
  `getCurrentSchoolId(profile)` (`src/data/schools.js`).

### Class
- **`class_id`** is **globally unique** and embeds its school:
  `school_001_class_form_1a`. Two schools can each own a "Form 1A" with no
  collision.
- The class **`name`** ("Form 1A") is display-only — never a storage key, filter
  key or access key.
- Helpers: `getClassById(classId)`, `getClassesBySchool(schoolId)`,
  `getClassDisplayName(classId)`, `canAccessClass(profile, classId)`
  (`src/data/identity.js`). `classId(nameOrTuple, schoolId)` in `src/data/mock.js`
  is school-aware and idempotent.

### Student
Exactly two student identity fields:
- **`student_internal_id`** (e.g. `student_001`) — the stable **internal
  relationship key** used for parent-child ownership, attendance, exams,
  results, payments, incidents, messages, roster membership, filters and
  permissions.
- **`student_id`** (e.g. `HID-000142`) — the **visible, school-generated** ID and
  the student's login identifier. Used for display, receipts and reports only.

Legacy keys (`KOB-STU-*`, `code`, `studentCode`, `childCodes`, `assignedClasses`,
class names) are **never** used for relationships. `normalizeLegacyStudentData()`
migrates old records into the canonical shape without duplicates.

---

## One central AsyncStorage repository

All prototype records live in **one** normalized store under a single key
`kobciye_app_data_v3`, seeded **once** on first launch and migrated forward
thereafter. There is no second/legacy data layer.

```
src/data/seedData.js            // builds the canonical seed ONCE (only place
                                //   legacy generators are referenced)
src/services/appDataRepository.js // load/save + all CRUD (the source of truth)
src/context/AppDataContext.js    // provides the store to every screen
src/utils/dataSelectors.js       // role-aware read selectors
src/utils/dataPermissions.js     // canViewModule / canPerformAction
src/utils/dataMigration.js       // legacy → v2 migration (one-time)
src/utils/dataAudit.js           // structural integrity checks
scripts/audit-foundation.js      // `npm run audit:foundation`
```

Store shape (`schema_version: 2`): `schools, classes, students, profiles,
subjects, teacher_permissions, attendance, payments, billing_records, exams,
results, incidents, messages, school_settings, grading_rules`.

- **No screen reads raw static arrays.** Screens read `appData.*` via
  `useAppData()` and pass it through `dataSelectors`. Static seed data exists
  only in `seedData.js` and is used only to initialize AsyncStorage.
- Seeding never reseeds once the store exists, so added students are never wiped.
- New students persist across app restarts.
- Repository functions: `initializeAppData`, `loadAppData`, `saveAppData`,
  `getStudentsBySchool`, `getStudentsByClass`, `getStudentByInternalId`,
  `getStudentByStudentId`, `addStudent(profile, data)`, `updateStudent`,
  `deactivateStudent`, `transferStudent`, `getActiveStudentsBySchool`,
  `getSchoolSettings`, `updateSchoolSettings`, `previewStudentId`,
  `addExam`, `updateExam`, `upsertResult`, `publishExamResults`.

### Foundation audit
`npm run audit:foundation` fails if any active screen/component/context/util
references a legacy relationship pattern (`KOB-STU-`, `studentCode`, `childCodes`,
`assignedClasses`, `REGISTRY_STUDENTS`, `BILL_STUDENTS`, `rosterFor(`,
`INCIDENTS.slice(`, `PAYMENTS.slice(`), and validates that the canonical seed has
globally-unique `class_id`s, complete student identity fields, no duplicate
`student_id` per school, and valid school/class/student references.

### Student ID generation
New students get `${prefix}-${sequence:6}` (e.g. `HID-000143`) from the active
School Admin's own school (`src/services/schoolIdStorage.js`). No random
`KOB-STU-*` IDs, no hard-coded `school_001`. Changing a prefix affects **new**
students only — existing IDs never change.

---

## Billing

Monthly school billing is calculated **directly from the central registry's
active students** — there is no separate billing roster.

- Only `status === "active"` is billed. `left`, `transferred`, `graduated`,
  `inactive`, `suspended_not_billed` are excluded.
- Small school → `$0.07` × active students / month. Large school → `$0.10`.
- Adding an active student raises the bill; marking a student left/transferred/
  graduated/inactive lowers it; reactivating raises it again. Fee-exemption
  affects student **fees**, not the school subscription count.
- `src/data/billing.js`: `getActiveStudentsBySchool`, `getNonBilledStudentsBySchool`,
  `getSchoolBillingRate`, `calculateSchoolBilling`, `formatCurrency`.

---

## Exams & Results workflow

Canonical, role-aware exam workflow backed by AsyncStorage:
- `src/services/examStorage.js` — exams keyed by `school_id` + global `class_id`
  + `subject_id` + `teacher_id`; draft → published; `teacherCanWriteExam()`
  enforces assigned class + subject.
- `src/services/resultStorage.js` — results keyed by `exam_id` +
  `student_internal_id`; computes percentage/grade/status; students & parents
  see **published** results only (`filterResultsForProfile`).
- `src/services/gradingStorage.js` — per-school grading scale + pure helpers
  (`computeResult`, `summarizeStudentResults`) for marks, percentage, grade,
  pass/fail, total, average and overall result.

---

## Strict role & school filtering

Filtering uses **data**, not just hidden buttons. Core functions in
`src/data/access.js`: `filterStudentsForProfile`, `filterClassesForProfile`,
`filterAttendanceForProfile`, `filterPaymentsForProfile`, `filterExamsForProfile`,
`filterResultsForProfile`, `filterIncidentsForProfile`, `filterMessagesForProfile`,
`canViewModule`, `canPerformAction`.

- **Super Admin** — all schools / platform-wide.
- **School Admin** — everything inside own `school_id` only.
- **Teacher** — only `assigned_class_ids` + `assigned_subject_ids` +
  granted `permissions`, within own `school_id`. Never uses class names.
- **Accountant** — own school finance only (payments, fees, receipts, billing,
  finance reports). No exams, attendance editing, incidents or private messages.
- **Parent** — only records where `profile.child_student_ids.includes(student_internal_id)`.
- **Student** — only records where `student_internal_id === profile.student_internal_id`.

---

## Run

```bash
npm ci                         # install pinned deps
npm run audit:foundation       # canonical-foundation audit (must pass)
npx expo start --clear         # dev (scan QR with Expo Go on Android)
npx expo export --platform web # static web build → dist/
```

Dependencies are pinned to the versions Expo SDK 52 expects (incl.
`expo-asset ~11.0.5`, `expo-font ~13.0.4`, `expo-image-picker ~16.0.6`,
`react-native 0.76.5`).

---

## Status

**Kobciye Phase 1 and Phase 2 Frontend Prototype — Complete.**
The data foundation (one school identity, globally-unique class identity, one
canonical student identity, one central student registry, registry-driven
billing, exam/result workflow, and strict role/school filtering) is unified and
stable, ready for Phase 3 backend integration.
