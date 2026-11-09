"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const edge=read("supabase/functions/moon-visitor-access/index.ts");
const code=edge.slice(edge.indexOf("function pick("),edge.indexOf("\nDeno.serve("))
 .replaceAll(":readonly string[]","").replaceAll(":Record<string,unknown>","")
 .replaceAll(":string[]","").replaceAll(":any","").replaceAll(" as const","");
const project=new Function("content","sections",code+"return filteredSnapshot(content,sections);");
const sample={version:2,contacts:[{id:"c1",first:"Alice",last:"Durand",company:"Acme",email:"SECRET_EMAIL",phone:"SECRET_PHONE",notes:"SECRET_CONTACT_NOTES"}],
 opportunities:[{id:"o1",contactId:"c1",training:"Formation",stage:"Gagné",ht:"500",vat:"20",category:"VAE",created:"2026-11-01",forecast:"2026-12-01",closed:"2026-11-02",notes:"SECRET_OPPORTUNITY_NOTES",events:[{text:"SECRET_EVENT"}],owner:"SECRET_OWNER"}],
 tasks:[{id:"t1",contactId:"c1",opportunityId:"o1",title:"Rappel",notes:"SECRET_TASK_NOTES",status:"open",due:"2026-11-20"}]};
test("reporting-only: no contact, task, identity or confidential opportunity fields",()=>{
 const data=project(sample,["reporting"]),text=JSON.stringify(data);
 assert.equal(data.contacts.length,0);assert.equal(data.tasks.length,0);
 for(const secret of ["SECRET_EMAIL","SECRET_PHONE","SECRET_CONTACT_NOTES","SECRET_OPPORTUNITY_NOTES","SECRET_EVENT","SECRET_OWNER","SECRET_TASK_NOTES","Formation","c1"])assert.ok(!text.includes(secret),secret);
 assert.equal(data.opportunities[0].ht,"500");assert.equal(data.opportunities[0].stage,"Gagné");
});
test("pipeline-only: names and amounts but no contact details, private notes or interactions",()=>{
 const data=project(sample,["board"]),text=JSON.stringify(data);
 assert.equal(data.contacts[0].first,"Alice");assert.equal(data.opportunities[0].ht,"500");
 assert.equal(data.tasks.length,0);
 for(const secret of ["SECRET_EMAIL","SECRET_PHONE","SECRET_CONTACT_NOTES","SECRET_OPPORTUNITY_NOTES","SECRET_EVENT","SECRET_OWNER","SECRET_TASK_NOTES"])assert.ok(!text.includes(secret),secret);
});
test("contacts-only and tasks-only never reveal unrelated full records",()=>{
 const contacts=project(sample,["contacts"]);assert.equal(contacts.contacts[0].email,"SECRET_EMAIL");assert.deepEqual(contacts.opportunities,[]);assert.deepEqual(contacts.tasks,[]);
 const tasks=project(sample,["tasks"]);assert.equal(tasks.tasks[0].notes,"SECRET_TASK_NOTES");assert.ok(!JSON.stringify(tasks).includes("SECRET_EMAIL"));assert.ok(!JSON.stringify(tasks).includes("SECRET_OPPORTUNITY_NOTES"));
});
test("full opportunities have details but not unrelated contact private fields",()=>{
 const data=project(sample,["opportunities"]);assert.equal(data.opportunities[0].notes,"SECRET_OPPORTUNITY_NOTES");assert.equal(data.contacts[0].email,undefined);assert.equal(data.tasks.length,0);
});
test("versioned history uses owner RLS, archives before changes and exposes restore UI",()=>{
 const sql=read("supabase/moon_snapshot_history.sql"),cloud=read("cloud.js");
 assert.match(sql,/create trigger moon_snapshot_archive_before_change before update or delete/);
 assert.match(sql,/owner_id=\(select auth\.uid\(\)\)/);
 assert.match(sql,/on conflict\(owner_id,revision\) do nothing/);
 assert.match(cloud,/cloud-history-list/);
 assert.match(cloud,/cloud-restore-version-/);
 assert.match(cloud,/\.eq\("revision",current\.data\.revision\)/);
});
