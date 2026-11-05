-- MOON: snapshot JSON v2, isolated by authenticated Supabase user.
-- Run in a NEW, dedicated Supabase project after approval.
-- No anonymous access; never use service_role in the browser.
create table if not exists public.moon_snapshots (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  content jsonb not null check (
    jsonb_typeof(content) = 'object'
    and jsonb_typeof(content->'contacts') = 'array'
    and jsonb_typeof(content->'opportunities') = 'array'
    and jsonb_typeof(content->'tasks') = 'array'
  ),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.moon_snapshots enable row level security;
revoke all on public.moon_snapshots from anon;
grant select, insert, update, delete on public.moon_snapshots to authenticated;
create policy "moon_snapshots_read_own" on public.moon_snapshots
 for select to authenticated using (owner_id = (select auth.uid()));
create policy "moon_snapshots_insert_own" on public.moon_snapshots
 for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "moon_snapshots_update_own" on public.moon_snapshots
 for update to authenticated using (owner_id = (select auth.uid()))
 with check (owner_id = (select auth.uid()));
create policy "moon_snapshots_delete_own" on public.moon_snapshots
 for delete to authenticated using (owner_id = (select auth.uid()));
