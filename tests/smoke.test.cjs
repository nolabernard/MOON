const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"..","app.js"),"utf8");
function run(check,old=[]){
 const db=new Map();
 if(old.length)db.set("moon.crm.v1",JSON.stringify(old));
 const context={
  window:{},
  document:{readyState:"loading",addEventListener(){}},
  localStorage:{getItem(k){return db.get(k)??null},setItem(k,v){db.set(k,v)}},
  crypto:{randomUUID:()=>String(Math.random())},
  console,Date,Intl,Math,Number,String,Array,JSON,
  alert(message){throw new Error(message)},
  confirm(){return true}
 };
 vm.runInNewContext(source+"\n"+check,context);
 return db;
}
test("Migration V1 preserves opportunities and separates shared contacts",()=>{
 const old=[{id:"o1",first:"Jean",last:"Martin",email:"jm@example.org",training:"VAE",stage:"Nouveau",ht:"5000",vat:"0",events:[{at:"2026-01-01T12:00:00Z",channel:"Appel",text:"Test"}]},{id:"o2",first:"Jean",last:"Martin",email:"jm@example.org",training:"RSE",stage:"Contacté",ht:"3000"}];
 const db=run('load();if(data.contacts.length!==1||data.opportunities.length!==2)throw Error("Migration incorrecte");if(data.opportunities[0].contactId!==data.opportunities[1].contactId)throw Error("Contact non partagé");if(data.opportunities[0].events.length!==1)throw Error("Historique perdu");',old);
 assert.ok(db.has("moon.crm.v1"),"V1 original must remain untouched");
 assert.ok(db.has("moon.crm.v2"),"V2 must be persisted");
});
test("Financial calculations use per-opportunity VAT and handle zero",()=>{
 run('data.opportunities=[{id:"a",ht:"100",vat:"20",stage:"Gagné"},{id:"b",ht:"50",vat:"exempt",stage:"Gagné"},{id:"c",ht:"",vat:"20",stage:"Nouveau"},{id:"d",ht:"0",vat:"20",stage:"Nouveau"}];tax="ht";if(sum(data.opportunities)!==15000)throw Error("HT incorrect");tax="ttc";if(sum(data.opportunities)!==17000)throw Error("TTC incorrect");if(known(data.opportunities[2]))throw Error("Blank amount should be unknown");if(!known(data.opportunities[3]))throw Error("Zero should be valid");');
});
test("Pipeline stage change is tracked and closes relance",()=>{
 run('const o={id:"a",stage:"Contacté",follow:"2026-11-07",events:[],closed:""};if(!markStage(o,"Gagné"))throw Error("Stage change refused");if(o.stage!=="Gagné"||o.follow||!o.closed||o.events.length!==1)throw Error("Stage transition invalid");');
});
test("CSV parser reads semicolon and quoted values",()=>{
 run('const a=parseCSV("nom;formation;notes\\nMartin;VAE;\\\"Email; appel\\\"");if(a.length!==1||a[0].notes!=="Email; appel")throw Error("CSV parsing invalid");');
});
test("Task records persist and can be marked complete",()=>{
 run('load();data.tasks.push({id:"t1",title:"Rappeler Jean",due:"2026-11-09",status:"open",type:"Relance"});if(!save(false))throw Error("Save failed");if(JSON.parse(localStorage.getItem(KEY)).tasks.length!==1)throw Error("Task was not persisted");data.tasks[0].status="done";save(false);if(JSON.parse(localStorage.getItem(KEY)).tasks[0].status!=="done")throw Error("Completion was not persisted");');
});
test("User flow: add, edit, complete and delete tasks",function regressionTest(){
 const store=new Map(),elements=new Map();
 const doc={
  readyState:"loading",addEventListener(){},
  getElementById(key){if(!elements.has(key))elements.set(key,{innerHTML:"",textContent:"",hidden:true,close(){},showModal(){}});return elements.get(key)}
 };
 class MockFormData{constructor(form){this.fields=form.fields}*[Symbol.iterator](){yield* Object.entries(this.fields)}}
 const context={window:{},document:doc,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},FormData:MockFormData,crypto:{randomUUID:()=>String(Math.random())},console,Date,Intl,Math,Number,String,Array,JSON,alert(message){throw Error(message)},confirm(){return true},setTimeout(){return 1},clearTimeout(){}};
 const commands=[
 'load();page="tasks";',
 'taskSubmit({fields:{id:"",title:"Appeler le candidat",type:"Appel",due:"2026-11-07",priority:"Haute",opportunityId:"",contactId:"",notes:"Premier contact"}});',
 'if(data.tasks.length!==1||data.tasks[0].title!=="Appeler le candidat")throw Error("Task not added");',
 'const t=data.tasks[0];',
 'taskSubmit({fields:{id:t.id,title:"Rappeler le candidat",type:"Relance",due:"2026-11-08",priority:"Normale",opportunityId:"",contactId:"",notes:"Suivi"}});',
 'if(data.tasks.length!==1||data.tasks[0].title!=="Rappeler le candidat")throw Error("Task not updated");',
 'data.tasks[0].status="done";save(false);',
 'if(JSON.parse(localStorage.getItem(KEY)).tasks[0].status!=="done")throw Error("Task not completed");',
 'deleteRecord("task",t.id);',
 'if(data.tasks.length!==0||JSON.parse(localStorage.getItem(KEY)).tasks.length!==0)throw Error("Task not deleted");'
 ];
 vm.runInNewContext(source+"\n"+commands.join("\n"),context);
});
