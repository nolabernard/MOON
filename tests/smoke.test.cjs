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
 'if(data.tasks.length!==1||data.tasks[0].title!=="Appel")throw Error("Task not added");',
 'const t=data.tasks[0];',
 'taskSubmit({fields:{id:t.id,title:"Rappeler le candidat",type:"Relance",due:"2026-11-08",priority:"Normale",opportunityId:"",contactId:"",notes:"Suivi"}});',
 'if(data.tasks.length!==1||data.tasks[0].title!=="Relance")throw Error("Task not updated");',
 'data.tasks[0].status="done";save(false);',
 'if(JSON.parse(localStorage.getItem(KEY)).tasks[0].status!=="done")throw Error("Task not completed");',
 'deleteRecord("task",t.id);',
 'if(data.tasks.length!==0||JSON.parse(localStorage.getItem(KEY)).tasks.length!==0)throw Error("Task not deleted");'
 ];
 vm.runInNewContext(source+"\n"+commands.join("\n"),context);
});

test("Contact submit prevents page navigation and persists a verifiable contact",()=>{
 const store=new Map(),elements=new Map();
 const doc={readyState:"loading",addEventListener(){},getElementById(k){
  if(!elements.has(k))elements.set(k,{innerHTML:"",textContent:"",hidden:true,close(){},showModal(){}});
  return elements.get(k);
 }};
 class MockFormData{constructor(form){this.fields=form.fields}*[Symbol.iterator](){yield* Object.entries(this.fields)}}
 const ctx={window:{},document:doc,localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},
  FormData:MockFormData,crypto:{randomUUID:()=>"new-contact-1"},console,Date,Intl,Math,Number,String,Array,JSON,
  alert(message){throw Error(message)},confirm(){return true},setTimeout(){return 1},clearTimeout(){}};
 const check=`
 load();page="dashboard";
 let prevented=false,stopped=false;
 handleFormSubmit({target:{id:"contact-form",fields:{id:"",first:"Marie",last:"Martin",email:"marie@example.org",phone:"",company:"",profile:"Salarié",notes:""}},
  preventDefault(){prevented=true},stopPropagation(){stopped=true}});
 if(!prevented||!stopped)throw Error("Browser navigation was not blocked");
 if(page!=="contacts")throw Error("Contact list not displayed");
 if(data.contacts.length!==1)throw Error("Contact missing from memory");
 if(!JSON.parse(localStorage.getItem(KEY)).contacts.some(c=>c.email==="marie@example.org"))throw Error("Contact missing from localStorage");
 if(!document.getElementById("app").innerHTML.includes("Marie Martin"))throw Error("New contact missing from visible directory");
 `;
 vm.runInNewContext(source+"\n"+check,ctx);
});

test("Voice conversation commits contact, opportunity, history and follow-up only after confirmation",()=>{
 const store=new Map(),elements=new Map();
 const doc={readyState:"loading",addEventListener(){},getElementById(k){if(!elements.has(k))elements.set(k,{innerHTML:"",textContent:"",hidden:true,close(){},showModal(){}});return elements.get(k)}};
 const ctx={window:{},document:doc,localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},crypto:{randomUUID:()=>String(Math.random())},console,Date,Intl,Math,Number,String,Array,JSON,alert(m){throw Error(m)},confirm(){return true},setTimeout(){return 1},clearTimeout(){}};
 vm.runInNewContext(source+`
 load();
 const before=JSON.stringify(data);
 const values={last:"Martin",first:"",training:"VAE",category:"VAE",summary:"En attente de vérification CPF",due:"2026-11-12"};
 if(JSON.stringify(data)!==before)throw Error("Preview mutated CRM");
 const a=saveVoiceConversation(values);
 if(!a.ok)throw Error(a.error);
 if(data.contacts.length!==1||data.opportunities.length!==1||data.tasks.length!==1)throw Error("Four-action save incomplete");
 if(data.opportunities[0].events.length!==1)throw Error("History missing");
 const b=saveVoiceConversation(values);
 if(!b.ok||data.contacts.length!==1||data.opportunities.length!==1||data.tasks.length!==1)throw Error("Duplicate created");
 if(JSON.parse(localStorage.getItem(KEY)).tasks.length!==1)throw Error("Not persisted");
 `,ctx);
});

test("Ma journée computes overdue follow-ups and priority without mutating data",()=>{
 const store=new Map(),doc={readyState:"loading",addEventListener(){},getElementById(){return {innerHTML:""}}};
 const ctx={window:{},document:doc,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},crypto:{randomUUID:()=>String(Math.random())},console,Date,Intl,Math,Number,String,Array,JSON,alert(){},confirm(){return true},setTimeout(){return 1},clearTimeout(){}};
 vm.runInNewContext(source+`
 load();
 data.contacts.push({id:"c1",first:"Sophie",last:"Martin"});
 data.opportunities.push({id:"o1",contactId:"c1",training:"VAE",stage:"Nouveau",created:"2026-01-01",follow:"2026-01-02",ht:"5980",events:[]});
 const before=JSON.stringify(data),html=dayPage();
 if(!html.includes("Sophie Martin")||!html.includes("VAE"))throw Error("Daily page missing opportunity");
 if(priorityScore(data.opportunities[0])<=0)throw Error("Priority missing");
 if(JSON.stringify(data)!==before)throw Error("Daily page mutated data");
 `,ctx);
});

test("Direct buttons create contact, opportunity, task and interaction without navigation",()=>{
 const store=new Map(),elements=new Map();
 const doc={readyState:"loading",addEventListener(){},getElementById(k){if(!elements.has(k))elements.set(k,{innerHTML:"",textContent:"",hidden:true,close(){},showModal(){}});return elements.get(k)}};
 class MockFormData{constructor(form){this.fields=form.fields}*[Symbol.iterator](){yield* Object.entries(this.fields)}}
 const ctx={window:{},document:doc,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},FormData:MockFormData,crypto:{randomUUID:()=>String(Math.random())},console,Date,Intl,Math,Number,String,Array,JSON,alert(m){throw Error(m)},confirm(){return true},setTimeout(){return 1},clearTimeout(){}};
 vm.runInNewContext(source+`
 load();
 const dialog=$("modal");
 const form=(id,fields)=>({id,fields,reportValidity(){return true},dataset:{id:fields.opportunityId||""}});
 const click=(action,formElement)=>{
  dialog.querySelector=()=>formElement;
  let prevented=false;
  const e={target:{closest:()=>({dataset:{action},matches:()=>false})},preventDefault(){prevented=true},stopPropagation(){}};
  onClick(e);
  if(!prevented)throw Error("Direct action did not prevent navigation: "+action);
 };
 click("save-contact-direct",form("contact-form",{id:"",first:"Camille",last:"Durand",email:"camille@example.com",phone:"",company:"",profile:"Salarié",notes:""}));
 if(data.contacts.length!==1)throw Error("Contact missing");
 const cid=data.contacts[0].id;
 click("save-opportunity-direct",form("opportunity-form",{id:"",contactId:cid,training:"VAE",category:"VAE",stage:"Nouveau",ht:"5980",vat:"0",follow:"",forecast:"",closed:"",lostReason:"",source:"",owner:"",notes:""}));
 if(data.opportunities.length!==1)throw Error("Opportunity missing");
 const oid=data.opportunities[0].id;
 click("save-task-direct",form("task-form",{id:"",title:"Rappeler Camille",type:"Relance",due:"2026-11-12",priority:"Haute",opportunityId:oid,contactId:cid,notes:""}));
 if(data.tasks.length!==1)throw Error("Task missing");
 click("save-interaction-direct",form("interaction-form",{opportunityId:oid,date:"2026-11-05T14:00",channel:"Appel",text:"Financement CPF à confirmer"}));
 if(data.opportunities[0].events.length!==1)throw Error("History missing");
 const saved=JSON.parse(localStorage.getItem(KEY));
 if(saved.contacts.length!==1||saved.opportunities.length!==1||saved.tasks.length!==1||saved.opportunities[0].events.length!==1)throw Error("Persistence incomplete");
 `,ctx);
});

test("Four commercial intelligence features: contact timeline, suggestions, natural search, reporting",()=>{
 run('load();data.contacts.push({id:"c",first:"Sophie",last:"Martin"});data.opportunities.push({id:"o",contactId:"c",training:"VAE",category:"VAE",ht:"5980",vat:"0",stage:"Nouveau",created:"2026-01-01",events:[{at:"2026-02-01T10:00:00Z",channel:"Email",text:"Proposition envoyée"}]});data.tasks.push({id:"t",contactId:"c",title:"Relancer",due:"2026-11-12",status:"open"});if(!contactTimeline(data.contacts[0]).includes("Proposition envoyée"))throw Error("Timeline missing");if(suggestedStage(data.opportunities[0])!=="RDV / Proposition")throw Error("Suggestion missing");if(naturalMatches("VAE de plus de 5000 euros sans échange depuis 15 jours").length!==1)throw Error("Natural filter missing");if(!reportingPage().includes("CA pondéré"))throw Error("Reporting missing");');
});

test("Pipeline suggestions recognize accented French, feminine and do not regress stages",()=>{
 run('load();const o={id:"o",stage:"Nouveau",notes:"",events:[{text:"La candidate est intéressée par la VAE"}]};if(suggestedStage(o)!=="En discussion")throw Error("Feminine interested missed");o.events=[{text:"Proposition envoyée à la candidate"}];if(suggestedStage(o)!=="RDV / Proposition")throw Error("Accented proposal missed");o.stage="RDV / Proposition";if(suggestedStage(o)!=="")throw Error("Must not regress advanced stage");o.stage="Gagné";if(suggestedStage(o)!=="")throw Error("Must not suggest on won deal");');
});

test("Ma journée: prioritize overdue and today without modifying data",()=>{
 run('load();data.contacts=[{id:"c1",first:"Alice",last:"Martin"}];data.opportunities=[{id:"o1",contactId:"c1",training:"VAE",stage:"Nouveau",follow:"2020-01-01",created:"2020-01-01",events:[]}];data.tasks=[{id:"t1",title:"Appeler Alice",due:"2020-01-01",status:"open",contactId:"c1"},{id:"t2",title:"Préparer un dossier",due:"2099-01-01",status:"open"}];const before=JSON.stringify(data);const html=dayPage();if(!html.includes("À traiter maintenant")||!html.includes("Appeler Alice")||!html.includes("À réactiver")||!html.includes("Prochaines actions")||!html.includes("day-jump"))throw Error("Daily workspace incomplete");if(JSON.stringify(data)!==before)throw Error("Day view mutated data");');
});
