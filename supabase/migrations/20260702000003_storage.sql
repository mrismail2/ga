-- ============================================================
-- Kobciye — Phase 2: storage buckets
--   school-logos    (public read; admins of the school write)
--   student-photos  (private; staff write, parents/students read their own)
-- Object paths are always prefixed with the school uuid:
--   school-logos/<school_id>/logo.png
--   student-photos/<school_id>/<student_id>.jpg
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('school-logos', 'school-logos', true, 2097152,
   array['image/png', 'image/jpeg', 'image/webp']),
  ('student-photos', 'student-photos', false, 5242880,
   array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- first path segment = school uuid
create or replace function public.storage_school(p_name text)
returns uuid language sql immutable as $$
  select nullif(split_part(p_name, '/', 1), '')::uuid;
$$;

-- ---------- school logos ----------
create policy "logos are public" on storage.objects for select
  using (bucket_id = 'school-logos');

create policy "admins upload school logo" on storage.objects for insert
  with check (bucket_id = 'school-logos' and public.is_admin_of(public.storage_school(name)));

create policy "admins update school logo" on storage.objects for update
  using (bucket_id = 'school-logos' and public.is_admin_of(public.storage_school(name)));

create policy "admins delete school logo" on storage.objects for delete
  using (bucket_id = 'school-logos' and public.is_admin_of(public.storage_school(name)));

-- ---------- student photos ----------
create policy "staff read student photos" on storage.objects for select
  using (bucket_id = 'student-photos' and public.is_staff_of(public.storage_school(name)));

create policy "staff upload student photos" on storage.objects for insert
  with check (bucket_id = 'student-photos' and public.is_staff_of(public.storage_school(name)));

create policy "staff update student photos" on storage.objects for update
  using (bucket_id = 'student-photos' and public.is_staff_of(public.storage_school(name)));

create policy "staff delete student photos" on storage.objects for delete
  using (bucket_id = 'student-photos' and public.is_admin_of(public.storage_school(name)));

-- parents/students read photos of their own children/themselves:
-- object name convention: <school_id>/<student uuid>.<ext>
create policy "family read own student photo" on storage.objects for select
  using (
    bucket_id = 'student-photos'
    and exists (
      select 1 from students s
      where s.id::text = split_part(split_part(storage.objects.name, '/', 2), '.', 1)
        and (s.profile_id = auth.uid() or public.is_parent_of(s.id))
    )
  );
