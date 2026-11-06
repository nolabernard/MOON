const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const cloud=fs.readFileSync(path.join(__dirname,"..","cloud.js"),"utf8");
test("Local writes are grouped rather than synced on every click",()=>{
 assert.match(cloud,/SYNC_DELAY_MS=1500/);
 assert.match(cloud,/clearTimeout\(syncTimer\);setState\("pending"\);syncTimer=setTimeout\(\(\)=>syncOnce\(\)\.catch\(syncFailed\),SYNC_DELAY_MS\)/);
});
test("Idle CRM makes no repeated Supabase requests",()=>{
 assert.doesNotMatch(cloud,/setInterval\s*\(/);
 assert.match(cloud,/window\.addEventListener\("focus",syncOnReturn\)/);
 assert.match(cloud,/FOCUS_CHECK_INTERVAL_MS=30000/);
});
test("Routine checks fetch revision only and full content on actual change",()=>{
 assert.match(cloud,/select\("revision,updated_at"\)/);
 assert.match(cloud,/if\(changed\)\{/);
 assert.match(cloud,/select\("content,revision,updated_at"\)/);
 assert.match(cloud,/\.eq\("owner_id",user\.id\)\.eq\("revision",base\.revision\)/);
});
test("Network failures back off and retain local changes",()=>{
 assert.match(cloud,/Math\.min\(60000,3000\*Math\.pow/);
 assert.match(cloud,/window\.addEventListener\("online"/);
 assert.match(cloud,/Les modifications restent sur cet appareil/);
});
