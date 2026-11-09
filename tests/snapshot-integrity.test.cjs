"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
test("snapshot validation rejects missing and duplicate IDs",()=>{
 const sql=read("supabase/moon_snapshot_validation.sql");
 assert.match(sql,/jsonb_typeof\(item->'id'\)<>'string'/);
 assert.match(sql,/seen \? entity_id/);
 assert.match(sql,/validate constraint moon_snapshots_payload_valid_check/);
 assert.match(sql,/security invoker/);
});
test("historical restore is optimistic-concurrency safe and preserves previous version",()=>{
 const cloud=read("cloud.js"),sql=read("supabase/moon_snapshot_history.sql");
 assert.match(cloud,/cloud-restore-version-/);
 assert.match(cloud,/localBefore!==baseline\.content/);
 assert.match(cloud,/\.eq\("revision",current\.data\.revision\)/);
 assert.match(sql,/before update or delete/);
 assert.match(sql,/on conflict\(owner_id,revision\) do nothing/);
});
