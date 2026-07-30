-- Kobciye Phase 4 guardian-directory least-privilege correction.
-- Phase 4 keeps teacher/accountant guardian access conservative: only school
-- admins/super admins manage the directory, and a parent may read only their
-- own directory row. The broad staff policy included teachers/accountants and
-- survived a parent -> teacher role change, leaking the guardian row.

drop policy if exists "staff read parents" on parents;
