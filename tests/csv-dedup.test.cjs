"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"..","app.js"),"utf8");
const begin=source.indexOf("const importNorm="),end=source.indexOf("async function importFile(",begin);
assert.ok(begin>0&&end>begin,"CSV import planner exists");
const script=source.slice(begin,end)+"\nthis.planCSVImport=planCSVImport;";
function plan(contacts,opportunities,rows){
 const context={data:{contacts,opportunities},today:()=>"2026-11-06"};
 vm.createContext(context);vm.runInContext(script,context);
 const p=context.planCSVImport(rows);
 return {accepted:p.accepted.length,duplicates:p.duplicates,ambiguous:p.ambiguous,invalid:p.invalid,newContacts:p.newContacts};
}
const person={id:"c1",first:"Alexandre",last:"BALLARIS",email:"aballaris@cesi.fr",phone:"06 07 71 04 32",company:""};
const deal={id:"o1",contactId:"c1",training:"DSI-MAPI",stage:"Gagné",ht:"5980"};
test("same CSV twice does not add opportunities",()=>{
 const rows=[{prenom:"Alexandre",nom:"BALLARIS",email:"aballaris@cesi.fr",formation:"DSI-MAPI",montant_ht:"5980"}];
 const p=plan([person],[deal],rows);assert.equal(p.accepted,0);assert.equal(p.duplicates,1);
});
test("same person, swapped first and last, and punctuation variants deduplicate",()=>{
 const p=plan([person],[deal],[{prenom:"BALLARIS",nom:"Alexandre",email:"aballaris@cesi.fr",formation:"DSI MAPI",montant_ht:"6000"}]);
 assert.equal(p.duplicates,1);assert.equal(p.accepted,0);
});
test("duplicates within same file are rejected",()=>{
 const rows=[{prenom:"Zoé",nom:"Martin",email:"zoe@example.fr",formation:"VAE GESAI"},{prenom:"Zoe",nom:"Martin",email:"ZOE@example.fr",formation:"VAE-GESAI"}];
 const p=plan([],[],rows);assert.equal(p.accepted,1);assert.equal(p.duplicates,1);assert.equal(p.newContacts,1);
});
test("same person different training remains a new opportunity",()=>{
 const p=plan([person],[deal],[{prenom:"Alexandre",nom:"BALLARIS",email:"aballaris@cesi.fr",formation:"Autre prestation"}]);
 assert.equal(p.accepted,1);assert.equal(p.duplicates,0);
});
test("same phone different identity is flagged, not silently merged",()=>{
 const p=plan([person],[deal],[{prenom:"Camille",nom:"Dupont",telephone:"0607710432",formation:"Formation courte"}]);
 assert.equal(p.accepted,0);assert.equal(p.ambiguous,1);
});
test("same name with conflicting email is flagged",()=>{
 const p=plan([person],[deal],[{prenom:"Alexandre",nom:"Ballaris",email:"autre@example.fr",formation:"DSI-MAPI"}]);
 assert.equal(p.accepted,0);assert.equal(p.ambiguous,1);
});
test("ambiguous shared email is not imported",()=>{
 const p=plan([{...person,id:"c1"},{...person,id:"c2"}],[],[{prenom:"Alexandre",nom:"BALLARIS",email:"aballaris@cesi.fr",formation:"DSI-MAPI"}]);
 assert.equal(p.ambiguous,1);
});
