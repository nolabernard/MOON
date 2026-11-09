-- Applied to MOON production 2026-11-09. Additive, no destructive migration.
create table if not exists public.moon_snapshot_history (
 owner_id uuid not null references auth.users(id) on delete cascade,
 revision bigint not null check(revision>0),
 content jsonb not null,
 saved_at timestamptz not null default now(),
 source text not null default 'automatic' check(source in ('automatic','baseline','before_delete')),
 primary key(owner_id,revision)
);
create index if not exists moon_snapshot_history_recent_idx on public.moon_snapshot_history(owner_id,saved_at desc);
alter table public.moon_snapshot_history enable row level security;
revoke all on public.moon_snapshot_history from public,anon,authenticated;
grant select on public.moon_snapshot_history to authenticated;
grant all on public.moon_snapshot_history to service_role;
drop policy if exists moon_snapshot_history_read_own on public.moon_snapshot_history;
create policy moon_snapshot_history_read_own on public.moon_snapshot_history
 for select to authenticated using(owner_id=(select auth.uid()));
insert into public.moon_snapshot_history(owner_id,revision,content,saved_at,source)
select owner_id,revision,content,updated_at,'baseline' from public.moon_snapshots
on conflict(owner_id,revision) do nothing;
create or replace function public.moon_archive_snapshot()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if TG_OP='UPDATE' then
  if NEW.revision<=OLD.revision then raise exception 'Snapshot revision must increase'; end if;
  if NEW.owner_id is distinct from OLD.owner_id then raise exception 'Snapshot owner cannot change'; end if;
 end if;
 insert into public.moon_snapshot_history(owner_id,revision,content,saved_at,source)
 values(OLD.owner_id,OLD.revision,OLD.content,OLD.updated_at,
 case when TG_OP='DELETE' then 'before_delete' else 'automatic' end)
 on conflict(owner_id,revision) do nothing;
 return case when TG_OP='DELETE' then OLD else NEW end;
end; $$;
revoke all on function public.moon_archive_snapshot() from public,anon,authenticated;
drop trigger if exists moon_snapshot_archive_before_change on public.moon_snapshots;
create trigger moon_snapshot_archive_before_change before update or delete on public.moon_snapshots
for each row execute function public.moon_archive_snapshot();
