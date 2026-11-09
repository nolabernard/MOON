-- Schema applied to production on 2026-11-09 via Supabase migration
-- moon_visitor_links_server_only. Idempotent reference for disaster recovery.
create table if not exists public.moon_visitor_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 100),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  expires_at timestamptz
);
create index if not exists moon_visitor_links_owner_idx on public.moon_visitor_links(owner_id,created_at desc);
alter table public.moon_visitor_links enable row level security;
-- No SELECT/INSERT/UPDATE grants or RLS policies for anon/authenticated clients.
-- The Edge Function verifies the owner's session or the visitor's strong token.
revoke all on public.moon_visitor_links from anon, authenticated, public;
grant select,insert,update,delete on public.moon_visitor_links to service_role;
comment on table public.moon_visitor_links is 'Hashed read-only guest bearer links. Only the server-side Edge Function may access this table.';
