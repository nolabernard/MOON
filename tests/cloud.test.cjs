const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const cloud=fs.readFileSync(path.join(__dirname,"..","cloud.js"),"utf8");
const app=fs.readFileSync(path.join(__dirname,"..","app.js"),"utf8");

test("Cloud is disabled without an explicit Supabase project configuration",()=>{
 const listeners={};
 const ctx={window:{},document:{readyState:"loading",addEventListener(name,fn){listeners[name]=fn}},console,Date};
 vm.runInNewContext(cloud,ctx);
 assert.equal(ctx.window.MOON_CLOUD.configured,false);
 assert.match(ctx.window.MOON_CLOUD.settingsHtml(),/aucune donnée n’est envoyée en ligne/);
});

test("Cloud restore preserves previous local CRM data in a backup",()=>{
 const memory=new Map();
 const ctx={window:{},document:{readyState:"loading",addEventListener(){},getElementById(){return null}},localStorage:{
   getItem:k=>memory.get(k)||null,
   setItem:(k,v)=>memory.set(k,v)
 },crypto:{randomUUID:()=>"test-id"},console,Date,Intl,Math,Number,String,Array,JSON};
 vm.runInNewContext(app,ctx);
 vm.runInNewContext('load();data.contacts=[{id:"local",first:"Local",last:"Test",email:"local@example.org"}];save(false);',ctx);
 const input={version:2,contacts:[{id:"remote",first:"Remote",last:"Test",email:"remote@example.org"}],opportunities:[],tasks:[]};
 assert.equal(ctx.window.MOON_CLOUD_BRIDGE.restore(input),true);
 const latest=JSON.parse(memory.get("moon.crm.v2"));
 assert.equal(latest.contacts[0].id,"remote");
 const backups=[...memory.keys()].filter(k=>k.startsWith("moon.crm.v2.precloud."));
 assert.equal(backups.length,1);
 assert.equal(JSON.parse(memory.get(backups[0])).contacts[0].id,"local");
});

test("Cloud rejects malformed remote data without touching local CRM",()=>{
 const memory=new Map();
 const ctx={window:{},document:{readyState:"loading",addEventListener(){},getElementById(){return null}},localStorage:{
  getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)
 },console,Date,Intl,Math,Number,String,Array,JSON};
 vm.runInNewContext(app,ctx);
 vm.runInNewContext('load();data.contacts=[{id:"original",last:"Test"}];save(false);',ctx);
 const before=memory.get("moon.crm.v2");
 assert.equal(ctx.window.MOON_CLOUD_BRIDGE.restore({contacts:[],opportunities:"broken",tasks:[]}),false);
 assert.equal(memory.get("moon.crm.v2"),before);
});
