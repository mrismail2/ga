-- ============================================================
-- Kobciye — Phase 2: row-level security
-- Every row is scoped to a school; what you may see/do inside your
-- school follows your role, mirroring the app:
--   super_admin  — everything
--   school_admin — everything inside the school (staff enter together)
--   teacher     — school data; writes attendance/exams/results/incidents
--   accountant  — finance inside the school
--   parent      — only rows about their own linked children
--   student     — only rows about themselves
-- ============================================================

-- ---------- helpers ----------
create or replace function my_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function my_school()
returns uuid language sql stable security definer set search_path = public as $$
  select school_id from profiles where id = auth.uid();
$$;

-- staff of a given school (school section: admins & teachers + accountant)
create or replace function is_staff_of(p_school uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and (role = 'super_admin'
           or (school_id = p_school and role in ('school_admin', 'teacher', 'accountant')))
  );
$$;

create or replace function is_admin_of(p_school uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and (role = 'super_admin' or (school_id = p_school and role = 'school_admin'))
  );
$$;

-- the calling parent is linked to this student
create or replace function is_parent_of(p_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from student_parents
    where parent_profile_id = auth.uid() and student_id = p_student
  );
$$;

-- the calling student IS this student
create or replace function is_self_student(p_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from students where id = p_student and profile_id = auth.uid()
  );
$$;

-- ---------- enable RLS everywhere ----------
alter table schools          enable row level security;
alter table profiles         enable row level security;
alter table subjects         enable row level security;
alter table classes          enable row level security;
alter table class_subjects   enable row level security;
alter table teachers         enable row level security;
alter table teacher_classes  enable row level security;
alter table teacher_subjects enable row level security;
alter table students         enable row level security;
alter table student_parents  enable row level security;
alter table terms            enable row level security;
alter table exam_windows     enable row level security;
alter table exams            enable row level security;
alter table results          enable row level security;
alter table attendance       enable row level security;
alter table payments         enable row level security;
alter table billing_records  enable row level security;
alter table incidents        enable row level security;
alter table messages         enable row level security;
alter table notices          enable row level security;
alter table grading_rules    enable row level security;

-- ---------- schools ----------
create policy "members read their school" on schools for select
  using (id = my_school() or my_role() = 'super_admin');
create policy "admins update their school" on schools for update
  using (is_admin_of(id));
create policy "super_admin manages schools" on schools for all
  using (my_role() = 'super_admin');

-- ---------- profiles ----------
-- NOTE: RLS controls which ROWS a policy applies to, not which COLUMNS may
-- change. "update own profile" below lets a user touch their own row, but on
-- its own that would let them also rewrite their own role/school_id (an
-- instant privilege escalation). The guard_profile_privileged_fields()
-- trigger in migration 0006 is what actually blocks that — it inspects the
-- column-level diff, which RLS structurally cannot do. Do not remove that
-- trigger; this policy alone is not sufficient protection.
create policy "read own profile" on profiles for select
  using (id = auth.uid());
create policy "staff read school profiles" on profiles for select
  using (is_staff_of(school_id));
create policy "update own profile" on profiles for update
  using (id = auth.uid());
create policy "admins manage school profiles" on profiles for all
  using (is_admin_of(school_id));

-- ---------- school-scoped reference data (read: everyone in school) ----------
create policy "school members read subjects" on subjects for select
  using (school_id = my_school() or my_role() = 'super_admin');
create policy "admins manage subjects" on subjects for all
  using (is_admin_of(school_id));

create policy "school members read classes" on classes for select
  using (school_id = my_school() or my_role() = 'super_admin');
create policy "admins manage classes" on classes for all
  using (is_admin_of(school_id));

create policy "school members read class_subjects" on class_subjects for select
  using (exists (select 1 from classes c where c.id = class_id
                 and (c.school_id = my_school() or my_role() = 'super_admin')));
create policy "admins manage class_subjects" on class_subjects for all
  using (exists (select 1 from classes c where c.id = class_id and is_admin_of(c.school_id)));

create policy "school members read terms" on terms for select
  using (school_id = my_school() or my_role() = 'super_admin');
create policy "admins manage terms" on terms for all
  using (is_admin_of(school_id));

create policy "school members read grading" on grading_rules for select
  using (school_id = my_school() or my_role() = 'super_admin');
create policy "admins manage grading" on grading_rules for all
  using (is_admin_of(school_id));

-- ---------- teachers ----------
create policy "staff read teachers" on teachers for select
  using (is_staff_of(school_id));
create policy "admins manage teachers" on teachers for all
  using (is_admin_of(school_id));
create policy "staff read teacher_classes" on teacher_classes for select
  using (exists (select 1 from teachers t where t.id = teacher_id and is_staff_of(t.school_id)));
create policy "admins manage teacher_classes" on teacher_classes for all
  using (exists (select 1 from teachers t where t.id = teacher_id and is_admin_of(t.school_id)));
create policy "staff read teacher_subjects" on teacher_subjects for select
  using (exists (select 1 from teachers t where t.id = teacher_id and is_staff_of(t.school_id)));
create policy "admins manage teacher_subjects" on teacher_subjects for all
  using (exists (select 1 from teachers t where t.id = teacher_id and is_admin_of(t.school_id)));

-- ---------- students ----------
create policy "staff read students" on students for select
  using (is_staff_of(school_id));
create policy "staff manage students" on students for all
  using (is_admin_of(school_id));
create policy "parents read their children" on students for select
  using (is_parent_of(id));
create policy "students read themselves" on students for select
  using (profile_id = auth.uid());

create policy "parents read own links" on student_parents for select
  using (parent_profile_id = auth.uid());
create policy "admins manage parent links" on student_parents for all
  using (exists (select 1 from students s
                 where s.id = student_parents.student_id and is_admin_of(s.school_id)));

-- ---------- exam windows (admin opens; teacher sees own) ----------
create policy "staff read exam windows" on exam_windows for select
  using (is_staff_of(school_id));
create policy "admins manage exam windows" on exam_windows for all
  using (is_admin_of(school_id));

-- ---------- exams ----------
create policy "staff read exams" on exams for select
  using (is_staff_of(school_id));
create policy "staff write exams" on exams for all
  using (is_staff_of(school_id) and my_role() in ('super_admin', 'school_admin', 'teacher'));
create policy "students read published exams" on exams for select
  using (status = 'published' and exists (
    select 1 from students s
    where s.school_id = exams.school_id
      and (s.profile_id = auth.uid() or is_parent_of(s.id))));

-- ---------- results ----------
create policy "staff read results" on results for select
  using (is_staff_of(school_id));
create policy "staff write results" on results for all
  using (is_staff_of(school_id) and my_role() in ('super_admin', 'school_admin', 'teacher'));
create policy "students read own published results" on results for select
  using (published and is_self_student(student_id));
create policy "parents read children results" on results for select
  using (published and is_parent_of(student_id));

-- ---------- attendance ----------
create policy "staff read attendance" on attendance for select
  using (is_staff_of(school_id));
create policy "staff write attendance" on attendance for all
  using (is_staff_of(school_id) and my_role() in ('super_admin', 'school_admin', 'teacher'));
create policy "students read own attendance" on attendance for select
  using (is_self_student(student_id));
create policy "parents read children attendance" on attendance for select
  using (is_parent_of(student_id));

-- ---------- finance ----------
create policy "finance staff read payments" on payments for select
  using (is_staff_of(school_id));
create policy "finance staff write payments" on payments for all
  using (is_staff_of(school_id) and my_role() in ('super_admin', 'school_admin', 'accountant'));
create policy "parents read children payments" on payments for select
  using (is_parent_of(student_id));
create policy "students read own payments" on payments for select
  using (is_self_student(student_id));

create policy "finance staff read billing" on billing_records for select
  using (is_staff_of(school_id));
create policy "finance staff write billing" on billing_records for all
  using (is_staff_of(school_id) and my_role() in ('super_admin', 'school_admin', 'accountant'));
create policy "parents read children billing" on billing_records for select
  using (is_parent_of(student_id));

-- ---------- incidents ----------
create policy "staff read incidents" on incidents for select
  using (is_staff_of(school_id));
create policy "staff write incidents" on incidents for all
  using (is_staff_of(school_id) and my_role() in ('super_admin', 'school_admin', 'teacher'));
create policy "parents read children incidents" on incidents for select
  using (student_id is not null and is_parent_of(student_id));

-- ---------- messages ----------
create policy "read own messages" on messages for select
  using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy "send messages in school" on messages for insert
  with check (sender_id = auth.uid() and school_id = my_school());
create policy "recipient marks read" on messages for update
  using (recipient_id = auth.uid());

-- ---------- notices ----------
create policy "school members read notices" on notices for select
  using ((school_id = my_school() or my_role() = 'super_admin')
         and (audience is null or cardinality(audience) = 0 or my_role() = any (audience)
              or my_role() in ('super_admin', 'school_admin')));
create policy "admins manage notices" on notices for all
  using (is_admin_of(school_id));
