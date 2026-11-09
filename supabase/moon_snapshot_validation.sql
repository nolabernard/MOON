-- Applied to production. Safe additive constraint, validated against existing snapshots.
create or replace function public.moon_snapshot_payload_valid(payload jsonb)
returns boolean language plpgsql immutable security invoker set search_path=pg_catalog as $$
declare collection text; item jsonb; entity_id text; seen jsonb;
begin
 if payload is null or jsonb_typeof(payload)<>'object' then return false; end if;
 foreach collection in array array['contacts','opportunities','tasks'] loop
  if jsonb_typeof(payload->collection)<>'array' then return false; end if;
  seen:='{}'::jsonb;
  for item in select value from jsonb_array_elements(payload->collection) loop
   if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'id')<>'string' then return false; end if;
   entity_id:=item->>'id';
   if entity_id is null or length(trim(entity_id))=0 or seen ? entity_id then return false; end if;
   seen:=seen||jsonb_build_object(entity_id,true);
  end loop;
 end loop;
 return true;
exception when others then return false;
end; $$;
revoke all on function public.moon_snapshot_payload_valid(jsonb) from public,anon;
grant execute on function public.moon_snapshot_payload_valid(jsonb) to authenticated,service_role;
alter table public.moon_snapshots add constraint moon_snapshots_payload_valid_check
 check(public.moon_snapshot_payload_valid(content)) not valid;
alter table public.moon_snapshots validate constraint moon_snapshots_payload_valid_check;
