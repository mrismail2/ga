# Kobciye — Phase 5 Correction manual browser checklist (2026‑07‑26)

Run these against a **real Supabase project** with both Edge Functions deployed
(see `KOBCIYE_PHASE5_EDGE_FUNCTIONS_DEPLOY_20260726.md`) and the corrective
migration applied. These are the **BLOCKED** items from the correction report —
they cannot be verified without live credentials + a browser, and must pass
before production readiness is declared. Mark each ✅/❌.

Legend: **A**=School Admin, **T**=Teacher, **St**=Student, **P**=Parent,
**SA**=Super Admin, **U**=University admin.

## 1. Landing / identifier login (§3)
1. [ ] Landing shows 3 login tabs; **no “Dhawaan/Coming Soon”** anywhere.
2. [ ] **Staff** tab: A/T sign in with email + password → real session, dashboard.
3. [ ] **Ardayga** tab: `School ID (login_code) + Student ID + password` signs a
       provisioned student in → **read‑only** student experience.
4. [ ] **Waalidka** tab: `School ID + child Student ID + parent password` signs in
       the **primary** parent → parent experience with a child selector.
5. [ ] Wrong password / unknown ID → **one generic error** (no “user not found”,
       no hint which field was wrong).
6. [ ] 5 rapid bad attempts on one identifier → **locked** for the window.
7. [ ] A student from School A cannot log in against School B’s `login_code`.
8. [ ] First login for a forced‑change account → **must change password** before use.

## 2. Provisioning (§4)
9.  [ ] A: provision a **no‑email student** → one‑time credentials shown **once**
        (school code, student id, temp password). Reopening does not re‑reveal.
10. [ ] Those credentials log the student in, then force a password change.
11. [ ] A: invite a **Teacher/Parent** → email field is editable + validated;
        invite email is delivered (SMTP).

## 3. Role‑aware controls (§5) — hidden before render
12. [ ] St/P: **no “Ku dar” create buttons** and **no admin row actions** anywhere.
13. [ ] T on exams: sees **Natiijo geli** + **Gudbi**, but **not** Ansixi/Daabac/Qorshee.
14. [ ] A on exams: sees Qorshee, Natiijo geli, Gudbi, Ansixi, Daabac.
15. [ ] SA: must pick a school first; no `"*"`/blank school reaches any screen.
16. [ ] SA: switch active school while a create form is open → the form and its
        picked values **clear** (no stale School‑A selection submitted to B). (§5.5)

## 4. Attendance (§6)
17. [ ] T/A: mark a class roster; parent absence notifications fire (per RPC).
18. [ ] St: **read‑only** own attendance; no marking controls.
19. [ ] P: **read‑only** attendance with a **child selector** across linked children.

## 5. Timetable (§7)
20. [ ] A: add a timetable entry (class/subject/teacher/day/time).
21. [ ] A: **Xilliyada** tab — add a period; **Nasasho** toggle stores a real boolean.
22. [ ] A: **Maalmaha** tab — mark a weekday as teaching/holiday.
23. [ ] T/St/P: see only their own timetable rows (RLS).

## 6. Assignments (§8)
24. [ ] T: create + publish an assignment.
25. [ ] St: open the published assignment → **Gudbi** → submit work; sees “submitted”.
26. [ ] T: **Gudbinno** → grade the submission (score ≤ max, feedback); St sees grade.
27. [ ] St cannot see or grade another student’s submission.

## 7. Exams / results (§9)
28. [ ] A: create an exam; **Qorshee** → add a sitting (date/time/room).
29. [ ] T: **Natiijo geli** → enter per‑student scores (0…full_marks); duplicate
        click is blocked; re‑opening shows saved scores.
30. [ ] T: **Gudbi** submits; A: **Ansixi** then **Daabac**; parents notified.
31. [ ] St/P: see only **published** results.

## 8. Finance (§10/§13)
32. [ ] Finance staff: **Samee biil** → generate an invoice for a student from a
        fee structure; it appears in the list with a real balance.
33. [ ] Finance staff: **Bixi** → record a payment; balance rolls forward; a
        negative/over/duplicate‑reference payment is rejected.
34. [ ] St/P: see only their own/linked invoices; **no** payment controls.

## 9. Reports (§12)
35. [ ] A: reports show real enrolment, fees, teacher‑load, results figures (real
        zeros for an empty school; an auth failure shows an error, never a fake 0).
36. [ ] A: **Soo dejiso CSV** downloads a CSV of the live figures (web).

## 10. University (§14)
37. [ ] U: **Results** → pick a course → enrol a student (create enrollment).
38. [ ] U: enter a per‑student score (0–100) → **upsert course result**; the
        **Transcripts** GPA snapshot reflects it.
39. [ ] School Mode never shows University terms and vice‑versa.

## 11. Regression / preservation
40. [ ] K‑logo LoadingScreen unchanged; ForgotPasswordScreen works.
41. [ ] Landing/branding/dashboard/class layout/sidebar visually unchanged.
42. [ ] Browser tab title = **Kobciye School Management**.
