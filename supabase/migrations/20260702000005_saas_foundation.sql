-- ============================================================
-- Kobciye — Phase 2 (cont.): multi-school SaaS foundation tables
--   academic_years   school calendar container for terms
--   school_members   per-school membership + role (multi-school ready)
--   subscriptions    per-school plan/billing state
--   audit_logs       who did what, where, when
--   parents          per-school parent directory (links to profiles)
--   staff            non-teaching staff directory (admins, accountants …)
-- All school-owned rows carry school_id and are protected by RLS.
-- ============================================================

-- ---------- academic years ----------
create table academic_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  name text not null,                       -- '2026/2027'
  starts_on date,
  ends_on date,
  is_current boolean not null default false,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, name),
  check (starts_on is null or ends_on is null or starts_on <= ends_on)
);
comment on table academic_years is 'One row per school year; terms hang off it.';
-- only one current year per school
create unique index academic_years_one_current
  on academic_years (school_id) where is_current;
create index academic_years_school on academic_years (school_id);

-- terms belong to an academic year (nullable so existing rows keep working)
alter table terms add column academic_year_id uuid references academic_years (id) on delete set null;
create index terms_academic_year on terms (academic_year_id);

-- ---------- school members ----------
-- Membership + role per school. profiles.school_id/role stays the user's
-- primary home (what the app reads today); this table lets one person hold
-- roles in several schools (e.g. an accountant serving two campuses) and is
-- what Phase 3 role checks can graduate to.
create table school_members (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  role user_role not null default 'student',
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, profile_id, role)
);
comment on table school_members is 'Who belongs to which school, as what role. Multi-school ready.';
create index school_members_school on school_members (school_id);
create index school_members_profile on school_members (profile_id);

-- keep profiles and school_members in step for the common single-school case
create or replace function sync_primary_membership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.school_id is not null then
    insert into school_members (school_id, profile_id, role)
    values (new.school_id, new.id, new.role)
    on conflict (school_id, profile_id, role) do update set status = 'active';
  end if;
  return new;
end;
$$;
create trigger profiles_sync_membership
  after insert or update of school_id, role on profiles
  for each row execute function sync_primary_membership();

-- ---------- subscriptions ----------
create type subscription_status as enum ('trialing', 'active', 'past_due', 'canceled');

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  plan school_plan not null default 'small',
  status subscription_status not null default 'trialing',
  -- first month free — the landing's '1 Bil Bilaash Ah!' offer
  trial_ends_at timestamptz,
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz,
  price_per_student_usd numeric(6, 2) not null default 0.07,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table subscriptions is 'Per-school plan + billing period; one active row per school.';
-- one non-canceled subscription per school
create unique index subscriptions_one_active
  on subscriptions (school_id) where status <> 'canceled';
create index subscriptions_school on subscriptions (school_id);

-- ---------- audit logs ----------
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools (id) on delete set null,  -- null = platform-level event
  actor_id uuid references profiles (id) on delete set null,
  action text not null,                     -- 'student.create', 'result.publish' …
  entity text,                              -- table / module name
  entity_id text,                           -- affected row id (text: uuid or display id)
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
comment on table audit_logs is 'Append-only trail of important actions; rows are never updated.';
create index audit_logs_school_time on audit_logs (school_id, created_at desc);
create index audit_logs_actor on audit_logs (actor_id);

-- ---------- parents (directory; login link optional) ----------
create table parents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  profile_id uuid references profiles (id) on delete set null,  -- set once the parent gets a login
  full_name text not null,
  phone text,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table parents is 'Per-school parent directory; student_parents links them to children.';
create index parents_school on parents (school_id);
create index parents_profile on parents (profile_id);

-- student_parents gains an optional pointer into the directory
alter table student_parents add column parent_id uuid references parents (id) on delete cascade;
create index student_parents_parent on student_parents (parent_id);

-- ---------- staff (non-teaching staff; teachers live in teachers) ----------
create table staff (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  profile_id uuid references profiles (id) on delete set null,
  full_name text not null,
  role user_role not null default 'school_admin',   -- school_admin | accountant
  phone text,
  status record_status not null default 'active',
  permissions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (role in ('school_admin', 'accountant'))
);
comment on table staff is 'Admins & accountants per school; mirrors teachers for non-teaching roles.';
create index staff_school on staff (school_id);

-- ---------- updated_at triggers ----------
create trigger academic_years_updated_at before update on academic_years for each row execute function set_updated_at();
create trigger school_members_updated_at before update on school_members for each row execute function set_updated_at();
create trigger subscriptions_updated_at  before update on subscriptions  for each row execute function set_updated_at();
create trigger parents_updated_at        before update on parents        for each row execute function set_updated_at();
create trigger staff_updated_at          before update on staff          for each row execute function set_updated_at();

-- ============================================================
-- RLS
-- ============================================================
alter table academic_years enable row level security;
alter table school_members enable row level security;
alter table subscriptions  enable row level security;
alter table audit_logs     enable row level security;
alter table parents        enable row level security;
alter table staff          enable row level security;

-- academic_years: anyone in the school can read the calendar; only admins shape it
create policy "school members read years" on academic_years for select
  using (school_id = my_school() or my_role() = 'super_admin');
create policy "admins manage years" on academic_years for all
  using (is_admin_of(school_id));

-- school_members: you can always see your own memberships; staff see the
-- school roster; only admins (or the platform) change membership
create policy "read own memberships" on school_members for select
  using (profile_id = auth.uid());
create policy "staff read school memberships" on school_members for select
  using (is_staff_of(school_id));
create policy "admins manage memberships" on school_members for all
  using (is_admin_of(school_id));

-- subscriptions: billing state is admin/accountant business inside the school;
-- super_admin manages all plans from the platform side
create policy "school staff read subscription" on subscriptions for select
  using (is_staff_of(school_id) and my_role() in ('super_admin', 'school_admin', 'accountant'));
create policy "super_admin manages subscriptions" on subscriptions for all
  using (my_role() = 'super_admin');

-- audit_logs: append-only — inserts must be stamped with the caller's id and
-- school; admins read their school's trail; nobody updates or deletes
create policy "school writes own audit rows" on audit_logs for insert
  with check (actor_id = auth.uid()
              and (school_id = my_school() or my_role() = 'super_admin'));
create policy "admins read school audit" on audit_logs for select
  using (is_admin_of(school_id) or my_role() = 'super_admin');

-- parents directory: staff manage/read inside the school; a parent with a
-- login can read their own directory row
create policy "staff read parents" on parents for select
  using (is_staff_of(school_id));
create policy "admins manage parents" on parents for all
  using (is_admin_of(school_id));
create policy "parents read own row" on parents for select
  using (profile_id = auth.uid());

-- staff directory: visible to school staff; only admins hire/fire
create policy "staff read staff" on staff for select
  using (is_staff_of(school_id));
create policy "admins manage staff" on staff for all
  using (is_admin_of(school_id));
