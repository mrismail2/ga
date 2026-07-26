# Kobciye — Phase 5 Manual Real-Supabase Browser Test Checklist

Run against a real Supabase project (migrations applied, `provision-account`
Edge Function deployed). This is the gating checklist for production sign-off —
the automated suites cover the logic, but these steps confirm the live
end-to-end experience per role. Do **not** run `supabase db reset`.

For every module confirm the shared states: **loading**, **empty**, **error +
retry**, **success confirmation**, **Save disabled while submitting**, and **no
duplicate record on a double-click**.

---

## Super Admin
1. Sign in → dashboard loads (real platform counts, no fake data).
2. Open a school screen → the **"Dooro Dugsi"** selector appears; no query runs before selecting.
3. Select a real school → school name shows in the active-school bar.
4. Open **Fasallada / Ardayda** — no `invalid input syntax for type uuid` error.
5. Open **Jadwal, Xaadiris, Shaqo-guri, Imtixaanno, Natiijooyin, Lacagaha, Kiisaska, Warbixinno, Ogeysiisyo** — each loads the selected school's real data.
6. **Switch schools** ("Beddel dugsi") → all screens now show School B; no School A data leaks.
7. Sign out → sign back in → active-school selection behaviour intact.

## School Admin
1. Sign in → dashboard (real counts).
2. **Akoonnada**: pick a teacher → "U dir Casuumaad" → status becomes pending; "Dib u dir" resends; "Jooji" revokes. Repeat for a student (with and without email) and a parent.
3. **Jadwal**: add a period; add a timetable entry for an assigned teacher/subject/class → saved; try an overlapping time → visible error; try an unassigned subject → visible error.
4. **Xaadiris**: pick a class + date → active roster loads → mark some absent → Kaydi → success shows notification count.
5. **Shaqo-guri**: create an assignment → Daabac (publish).
6. **Imtixaanno**: create an exam → (teacher enters results) → Ansixi → Daabac.
7. **Natiijooyin**: confirm published results appear.
8. **Lacagaha**: create a fee structure; confirm invoices list; record a payment → balance updates; negative/duplicate-reference → visible error.
9. **Kiisaska**: create a case with a confidential note + follow-up date → saved.
10. **Warbixinno**: real enrollment + fee totals (real zero if empty, never fake).
11. **Ogeysiisyo**: see own notifications; mark one read → persists after refresh.
12. Refresh browser → everything persists. Sign out / sign in → intact.

## Teacher (after accepting the invitation + setting password)
1. Sign in → sees ONLY assigned classes/subjects.
2. **Jadwal**: only own entries.
3. **Xaadiris**: only assigned classes selectable; mark attendance → an absent student triggers the parent notification.
4. **Shaqo-guri**: create only for an assigned class+subject; grade a submission.
5. **Imtixaanno / Natiijooyin**: enter results only for assigned pairs; submit (cannot approve/publish).
6. Confirm an unassigned class/subject is unavailable everywhere.

## Student (after activation)
1. Sign in → sees only own profile + school data.
2. **Jadwal**: only own class timetable.
3. **Xaadiris**: only own attendance.
4. **Shaqo-guri**: published assignments for own enrollment; submit work; see grade.
5. **Imtixaanno/Natiijooyin**: only own **published** results (drafts invisible).
6. **Lacagaha**: only own issued invoices.
7. Confirm no administrative actions are available; no other student's data is visible.

## Parent (after activation)
1. Sign in → sees only children linked via `student_parents`.
2. **Ogeysiisyo**: receives the **absence notification** after a teacher marks the child absent (correct Somali wording, student name, date, school, class, status).
3. Correct the child's attendance to present → parent sees the notification superseded + a correction notification.
4. **Xaadiris / Natiijooyin / Lacagaha / Shaqo-guri**: only linked children's data.
5. Confirm no unrelated student appears anywhere.

## University Admin
1. Sign in → University shell only (no School Mode terms).
2. Create faculty → department → programme → semester → course; assign a lecturer to the course; register a student.
3. Enter a course result → publish.
4. **Transcripts**: issue a transcript → GPA snapshot appears; the student sees only their own.
5. Confirm School Mode RPCs are unavailable (mode separation).

## Ministry / read-only role (where supported)
1. Confirm the approved read-only restrictions are preserved (no create/update surfaces).

---

## Cross-cutting checks
- **Cross-school isolation:** as School A staff, confirm no School B row is ever visible in any module.
- **Refresh persistence:** every created record survives a full browser refresh.
- **Sign out / sign in:** state re-derives correctly; no stale school context.
- **K-logo loading screen** shows on load; **browser tab** reads `Kobciye School Management`.
- **Phase 1–4 regression:** onboarding, invitations, classes, students+enrollment, admissions, guardian linking, lesson plans, messaging all still work.
