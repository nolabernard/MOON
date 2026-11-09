"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
test("disabled visitor links have a delete action with confirmation",()=>{
 const s=read("visitor.js");
 assert.match(s,/data-action="visitor-delete"/);
 assert.match(s,/action==="visitor-delete"&&!confirm/);
 assert.match(s,/call\("delete",\{id:btn\.dataset\.id\},jwt\)/);
});
test("deletion is owner authenticated and only for revoked or expired links",()=>{
 const s=read("supabase/functions/moon-visitor-access/index.ts");
 assert.match(s,/if \(action === "delete"\)/);
 assert.match(s,/eq\("owner_id",owner\.id\)/);
 assert.match(s,/if\(!disabled\)return json\(req,409/);
 assert.match(s,/\.delete\(\)\.eq\("owner_id",owner\.id\)/);
 assert.match(s,/deleted:true/);
});
