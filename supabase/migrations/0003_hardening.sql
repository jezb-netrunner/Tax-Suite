-- 0003: hardening from the audit of November 12, 2026 (AUDIT-2026-11-12.md, X15).
--
-- NOT APPLIED to any database. Accounts mode has never been live. Apply it
-- after 0001 and 0002, in order, only when accounts mode is switched on
-- (owner action), e.g. `supabase db push`. It has not been run against a
-- database: run it on a test project first.

-- A profile's data must be a JSON object, as the app always sends
-- (never a bare number, text or list).
alter table public.taxpayer_profiles
  add constraint taxpayer_profiles_data_object check (jsonb_typeof(data) = 'object');

-- The 64 kB limit is measured on the text of the data. 0002 measured the
-- stored size, which the database may compress, so the real limit was
-- larger and unclear. The constraint keeps its name: the app recognises it
-- to show "This profile is too large to save."
alter table public.taxpayer_profiles drop constraint if exists taxpayer_profiles_data_size;
alter table public.taxpayer_profiles
  add constraint taxpayer_profiles_data_size check (octet_length(data::text) < 65536);

-- Row-level security also binds the table's owner, not only other roles.
-- (Foreign-key cascades, such as deleting a login's profiles, are not
-- affected: referential actions bypass row security.)
alter table public.taxpayer_profiles force row level security;

-- Rights the app never uses.
revoke truncate, references, trigger on public.taxpayer_profiles from authenticated, anon;
