const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const app=fs.readFileSync(path.join(__dirname,"..","app.js"),"utf8");
const a="295d0d28-363c-474b-a93b-a785b5a7ed18";
const b="49e27721-f9eb-46bc-bc38-08fd0749ddc7";
function setup(){
 const store=new Map(),listeners={};
 const ctx={
  window:{MOON_CLOUD:{isAuthenticated:()=>false}},
  document:{readyState:"loading",addEventListener(name,fn){listeners[name]=fn},getElementById(key){if(key==="app")return {innerHTML:""};if(key==="modal"||key==="voice-modal")return {addEventListener(){},open:false};return null}},
  localStorage:{getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)},
  console,Date,Math,JSON,Number,Array,String,Intl
 };
 vm.runInNewContext(app,ctx);
 return {store,ctx,bridge:ctx.window.MOON_CLOUD_BRIDGE};
}
test("CRM data are isolated by authenticated user ID",()=>{
 const {store,ctx,bridge}=setup();
 assert.equal(bridge.activate(a),true);
 vm.runInNewContext('data.contacts.push({id:"a-contact",first:"Alice"});save(false);',ctx);
 const keyA="moon.crm.v2.user."+a,keyB="moon.crm.v2.user."+b;
 assert.equal(JSON.parse(store.get(keyA)).contacts[0].id,"a-contact");
 assert.equal(bridge.activate(b),true);
 assert.equal(bridge.snapshot().contacts.length,0);
 vm.runInNewContext('data.contacts.push({id:"b-contact",first:"Bob"});save(false);',ctx);
 assert.equal(JSON.parse(store.get(keyB)).contacts[0].id,"b-contact");
 assert.equal(bridge.activate(a),true);
 assert.equal(bridge.snapshot().contacts[0].id,"a-contact");
 assert.equal(store.has(keyB),true);
});
test("Legacy unscoped CRM is never assigned to another account automatically",()=>{
 const {store,bridge}=setup();
 store.set("moon.crm.v2",JSON.stringify({version:2,contacts:[{id:"legacy-private"}],opportunities:[],tasks:[]}));
 assert.equal(bridge.activate(b),true);
 assert.equal(bridge.snapshot().contacts.length,0);
 assert.equal(store.has("moon.crm.v2"),true,"keep unassigned legacy recovery data");
});
test("Signing out clears in-memory CRM and only the current account cache",()=>{
 const {store,ctx,bridge}=setup();
 bridge.activate(a);vm.runInNewContext('data.contacts.push({id:"alice"});save(false);',ctx);
 bridge.activate(b);vm.runInNewContext('data.contacts.push({id:"bob"});save(false);',ctx);
 bridge.clearSession(true);
 assert.equal(bridge.ownerId(),null);
 assert.equal(bridge.snapshot().contacts.length,0);
 assert.equal(store.has("moon.crm.v2.user."+b),false);
 assert.equal(store.has("moon.crm.v2.user."+a),true);
});
test("App boot does not read unscoped personal data before authentication",()=>{
 const {store,ctx,bridge}=setup();
 store.set("moon.crm.v2",JSON.stringify({version:2,contacts:[{id:"secret"}],opportunities:[],tasks:[]}));
 vm.runInNewContext("init();",ctx);
 assert.equal(bridge.snapshot().contacts.length,0);
 assert.equal(store.has("moon.crm.v2"),true);
});
