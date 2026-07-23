-- ============================================================
-- Kobciye — Phase 2: reference seed
-- Two schools (as in the frontend prototype), their subjects,
-- three terms each, and default grading rules. Students/teachers/
-- profiles are created through the app (auth signups), not seeded.
-- ============================================================

with s as (
  insert into schools (slug, name, plan, student_id_prefix, next_student_sequence, location)
  values
    ('hidaayada', 'Dugsiga Hidaayada', 'large', 'HID', 1, 'Gabiley'),
    ('nuurul-cilmi', 'Dugsiga Nuurul Cilmi', 'small', 'NUR', 1, 'Gabiley')
  on conflict (slug) do nothing
  returning id, slug
),
subj as (
  insert into subjects (school_id, name, name_en)
  select s.id, v.name, v.name_en
  from s cross join (values
    ('Xisaab', 'Mathematics'),
    ('Sayniska', 'Science'),
    ('Af-Soomaali', 'Somali'),
    ('Ingiriis', 'English'),
    ('Cilmiga Diinta', 'Islamic Studies'),
    ('Juqraafi', 'Geography'),
    ('Taariikh', 'History')
  ) as v (name, name_en)
  on conflict do nothing
),
trm as (
  insert into terms (school_id, name, "order")
  select s.id, t.name, t.ord
  from s cross join (values ('Term 1', 1), ('Term 2', 2), ('Term 3', 3)) as t (name, ord)
  on conflict do nothing
)
insert into grading_rules (school_id)
select id from s
on conflict do nothing;
