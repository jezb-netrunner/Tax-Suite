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
