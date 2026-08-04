-- Multi-tenant taxpayer profiles: one account owns many profiles
-- (bookkeepers/accountants manage several client businesses).
-- Profile contents live in jsonb `data` — the app's profile schema
-- (src/engine/profile.js) evolves without further migrations.

create table public.taxpayer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index taxpayer_profiles_user_idx on public.taxpayer_profiles (user_id);

alter table public.taxpayer_profiles enable row level security;

create policy "select own profiles" on public.taxpayer_profiles
  for select using (auth.uid() = user_id);

create policy "insert own profiles" on public.taxpayer_profiles
  for insert with check (auth.uid() = user_id);

create policy "update own profiles" on public.taxpayer_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "delete own profiles" on public.taxpayer_profiles
  for delete using (auth.uid() = user_id);
