-- ============================================================================
-- Kobciye Phase 5 — atomic identifier-login rate limiting
--
-- Reserves an attempt before the password check so concurrent brute-force
-- requests cannot all race past separate count queries. No credential or
-- plaintext password is stored.
-- ============================================================================
begin;

alter table login_attempts alter column succeeded drop not null;
alter table login_attempts alter column succeeded drop default;

create or replace function begin_identifier_login_attempt(
  p_school_code text,
  p_identifier text,
  p_kind text,
  p_ip_hash text
) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  v_school_code text := upper(trim(coalesce(p_school_code,'')));
  v_identifier text := upper(trim(coalesce(p_identifier,'')));
  v_kind text := lower(trim(coalesce(p_kind,'')));
  v_id uuid;
begin
  if v_kind not in ('student','parent')
     or v_school_code = '' or v_identifier = ''
     or p_ip_hash !~ '^[0-9a-f]{64}$' then
    return null;
  end if;

  -- Fixed lock order keeps concurrent identifier/IP reservations serialized.
  perform pg_advisory_xact_lock(hashtextextended(v_kind || ':' || v_school_code || ':' || v_identifier,0));
  perform pg_advisory_xact_lock(hashtextextended(p_ip_hash,1));

  if (select count(*) from login_attempts
      where kind=v_kind and upper(trim(school_code))=v_school_code
        and upper(trim(identifier))=v_identifier
        and succeeded is not true
        and created_at > now() - interval '15 minutes') >= 5 then
    return null;
  end if;
  if (select count(*) from login_attempts
      where ip=p_ip_hash and succeeded is not true
        and created_at > now() - interval '15 minutes') >= 20 then
    return null;
  end if;

  insert into login_attempts(school_code,identifier,kind,ip,succeeded)
  values(v_school_code,v_identifier,v_kind,p_ip_hash,null)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function begin_identifier_login_attempt(text,text,text,text) from public, anon, authenticated;
grant execute on function begin_identifier_login_attempt(text,text,text,text) to service_role;

create or replace function complete_identifier_login_attempt(
  p_attempt uuid,
  p_success boolean
) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare
  v_row login_attempts;
  v_school uuid;
begin
  update login_attempts
     set succeeded=coalesce(p_success,false)
   where id=p_attempt and succeeded is null
  returning * into v_row;
  if v_row.id is null then return false; end if;

  select id into v_school from schools
  where upper(trim(login_code))=upper(trim(v_row.school_code));
  insert into audit_logs(school_id,actor_id,action,entity,entity_id,detail)
  values(
    v_school,null,
    case when coalesce(p_success,false) then 'auth.identifier_login.success' else 'auth.identifier_login.failure' end,
    'login_attempts',v_row.id,
    jsonb_build_object('kind',v_row.kind,'school_code',upper(trim(v_row.school_code)))
  );
  return true;
end $$;
revoke all on function complete_identifier_login_attempt(uuid,boolean) from public, anon, authenticated;
grant execute on function complete_identifier_login_attempt(uuid,boolean) to service_role;

create or replace function is_login_locked(p_school_code text,p_identifier text,p_kind text)
returns boolean language sql stable security definer set search_path = public as $$
  select count(*) >= 5 from login_attempts
  where kind=lower(trim(p_kind))
    and upper(trim(school_code))=upper(trim(p_school_code))
    and upper(trim(identifier))=upper(trim(p_identifier))
    and succeeded is not true
    and created_at > now() - interval '15 minutes'
$$;
revoke all on function is_login_locked(text,text,text) from public, anon, authenticated;
grant execute on function is_login_locked(text,text,text) to service_role;

create or replace function is_login_ip_locked(p_ip_hash text)
returns boolean language sql stable security definer set search_path = public as $$
  select count(*) >= 20 from login_attempts
  where ip=p_ip_hash and succeeded is not true
    and created_at > now() - interval '15 minutes'
$$;
revoke all on function is_login_ip_locked(text) from public, anon, authenticated;
grant execute on function is_login_ip_locked(text) to service_role;

commit;
