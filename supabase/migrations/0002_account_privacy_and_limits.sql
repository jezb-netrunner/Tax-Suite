-- 0002: privacy and abuse limits for accounts mode.
--
-- NOT APPLIED to any database. Accounts mode has never been live
-- (REVIEW.md 4.3, decision 17). Apply it together with 0001 only when
-- accounts mode is switched on (owner action 4), e.g. `supabase db push`.

-- M25: "Delete my account".
-- A signed-in user deletes their own login. Deleting a row from auth.users
-- needs more rights than the user has, so the function runs as its owner
-- (SECURITY DEFINER), with an empty search_path and fully qualified names,
-- and acts only on the caller's own id. The user's profiles are removed by
-- ON DELETE CASCADE on taxpayer_profiles.user_id (0001).
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  delete from auth.users where id = uid;
end;
$$;

-- Callable by signed-in users only (not by PUBLIC or the anon role).
revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

-- L17: limits and integrity for taxpayer_profiles.

-- One profile's data may not exceed 64 kB (a full profile with every
-- estimator's figures is a few kB).
alter table public.taxpayer_profiles
  add constraint taxpayer_profiles_data_size check (pg_column_size(data) < 65536);

-- At most 500 profiles per account. The advisory lock makes concurrent
-- inserts for the same user wait for each other, so the cap cannot be raced;
-- rows inserted earlier in the same statement are counted too.
create or replace function public.taxpayer_profiles_row_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('taxpayer_profiles:' || new.user_id::text, 0));
  if (select count(*) from public.taxpayer_profiles where user_id = new.user_id) >= 500 then
    raise exception 'profile limit reached: 500 profiles per account'
      using errcode = 'P0001', hint = 'Delete profiles you no longer need.';
  end if;
  return new;
end;
$$;

create trigger taxpayer_profiles_row_cap
  before insert on public.taxpayer_profiles
  for each row execute function public.taxpayer_profiles_row_cap();

-- The database, not the client, sets the timestamps: created_at is fixed at
-- insert and cannot be changed; updated_at is set on every write.
create or replace function public.taxpayer_profiles_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger taxpayer_profiles_stamp
  before insert or update on public.taxpayer_profiles
  for each row execute function public.taxpayer_profiles_stamp();

-- Trigger functions are not meant to be called through the API.
revoke all on function public.taxpayer_profiles_row_cap() from public, anon, authenticated;
revoke all on function public.taxpayer_profiles_stamp() from public, anon, authenticated;

-- Policies rewritten for signed-in users only, with auth.uid() evaluated once
-- per statement ((select auth.uid())) rather than once per row.
drop policy "select own profiles" on public.taxpayer_profiles;
drop policy "insert own profiles" on public.taxpayer_profiles;
drop policy "update own profiles" on public.taxpayer_profiles;
drop policy "delete own profiles" on public.taxpayer_profiles;

create policy "select own profiles" on public.taxpayer_profiles
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "insert own profiles" on public.taxpayer_profiles
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "update own profiles" on public.taxpayer_profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "delete own profiles" on public.taxpayer_profiles
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Signed-out visitors have no business with this table at all.
revoke all on public.taxpayer_profiles from anon;
