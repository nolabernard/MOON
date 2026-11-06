const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const app=fs.readFileSync(path.join(__dirname,"..","app.js"),"utf8");
const cloud=fs.readFileSync(path.join(__dirname,"..","cloud.js"),"utf8");
function runApp(code){
 const store=new Map(),elements=new Map();
 const ctx={window:{},document:{readyState:"loading",addEventListener(){},getElementById(id){if(!elements.has(id))elements.set(id,{innerHTML:"",textContent:"",hidden:true,addEventListener(){},close(){},showModal(){}});return elements.get(id)}},
 localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},console,Date,Math,Intl,Number,String,Array,JSON,alert(m){throw Error(m)},confirm(){return true}};
 vm.runInNewContext(app+"\n"+code,ctx);
 return {store,ctx};
}
test("Account and settings are distinct sidebar destinations",()=>{
 const {ctx}=runApp('page="account";render();');
 const html=ctx.document.getElementById("app").innerHTML;
 assert.match(html,/data-page="account"[^>]*>.*?Mon compte/s);
 assert.match(html,/data-page="settings"[^>]*>.*?Paramètres/s);
 assert.match(html,/Retrouvez MOON sur tous vos ordinateurs/);
 assert.doesNotMatch(html,/Importer des opportunités CSV/);
});
test("Settings contains export and import actions, not account controls",()=>{
 const {ctx}=runApp('page="settings";render();');
 const html=ctx.document.getElementById("app").innerHTML;
 for(const action of ["export-json","import-json","export-csv","import-csv"])assert.ok(html.includes('data-action="'+action+'"'));
 assert.doesNotMatch(html,/data-action="cloud-logout"/);
});
test("Contact, opportunity and task create buttons remain wired",()=>{
 const {ctx}=runApp('page="tasks";render();');
 assert.match(ctx.document.getElementById("app").innerHTML,/data-action="new-task"/);
 const {ctx:ctx2}=runApp('page="contacts";render();');
 assert.match(ctx2.document.getElementById("app").innerHTML,/data-action="new-contact"/);
 const {ctx:ctx3}=runApp('page="opportunities";render();');
 assert.match(ctx3.document.getElementById("app").innerHTML,/data-action="new-opportunity"/);
 for(const name of ["contact","opportunity","task"])assert.match(app,new RegExp('data-action="save-'+name+'-direct"'));
});
test("Cloud sync is connected to local save and account-scoped snapshot writes",()=>{
 assert.match(app,/window\.MOON_CLOUD\?\.onLocalSave\?\.\(\)/);
 assert.match(cloud,/onLocalSave:scheduleSync/);
 assert.match(cloud,/\.from\("moon_snapshots"\)\.update\(/);
 assert.match(cloud,/\.eq\("owner_id",user\.id\)\.eq\("revision",base\.revision\)/);
 assert.match(cloud,/setTimeout\(\(\)=>syncOnce\(\)/);
 assert.match(cloud,/syncState==="synced"/);
});
