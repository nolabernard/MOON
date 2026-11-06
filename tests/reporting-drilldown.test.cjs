"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"..","app.js"),"utf8");
const pick=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,"Missing section: "+start);return source.slice(a,b)};
const helpers=pick("const REPORT_PROBABILITIES=", "function reportingPage(){");
const metricSource=pick("function metric(","function dueClass(");
const money=c=>(c/100).toFixed(2)+" €";
const c={id:"c1",first:"Davia",last:"Franceschini",company:"COPADE"};
const ops=[
 {id:"w1",contactId:"c1",training:"VEFA",category:"Formation courte",stage:"Gagné",ht:"3500",vat:"20",created:"2026-03-01"},
 {id:"w2",contactId:"c1",training:"VEFA",category:"Formation courte",stage:"Gagné",ht:"5000",vat:"20",created:"2026-05-01"},
 {id:"a1",contactId:"c1",training:"RSE",category:"Formation courte",stage:"En discussion",ht:"1000",vat:"20",created:"2026-06-01"},
 {id:"a2",contactId:"c1",training:"VAE",category:"VAE",stage:"RDV / Proposition",ht:"2000",vat:"20",created:"2026-07-01"},
 {id:"l1",contactId:"c1",training:"Perdue",category:"Autre",stage:"Perdu",ht:"200",vat:"0",created:"2026-08-01"}
];
function makeContext(page="reporting",tax="ht"){
 let result;
 const context={
  page,tax,data:{contacts:[c],opportunities:ops},TYPES:["VAE","Formation courte","Autre"],
  scoped:()=>ops.filter(x=>x.id!=="w2"),reportingOpportunities:()=>ops,isActive:o=>o.stage!=="Gagné"&&o.stage!=="Perdu",
  known:o=>o.ht!==""&&o.ht!==null&&o.ht!==undefined&&Number.isFinite(Number(o.ht)),
  amount:o=>Math.round(Number(o.ht)*100)*(tax==="ttc"?1+Number(o.vat||0)/100:1),
  sum:list=>list.reduce((total,o)=>total+Math.round(Number(o.ht||0)*100)*(tax==="ttc"?1+Number(o.vat||0)/100:1),0),
  money,compare:(a,b)=>String(a||"").localeCompare(String(b||"")),
  linkedContact:()=>c,contactName:x=>x.first+" "+x.last,
  dt:()=> "01/05/2026",esc:x=>String(x??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;"),
  modal:(title,body)=>{result={title,body}}
 };
 vm.createContext(context);
 vm.runInContext(helpers+"\n"+metricSource+"\nthis.api={revenueSelection,weightedSum,revenueBreakdown,metric};",context);
 return {api:context.api,last:()=>result};
}
test("two sales for the same customer and training appear as separate revenue lines",()=>{
 const {api,last}=makeContext();assert.equal(api.revenueSelection("secured").items.length,2);
 api.revenueBreakdown("secured");const {body}=last();
 assert.match(body,/8 500|8500\.00/);
 assert.match(body,/data-id="w1"/);assert.match(body,/data-id="w2"/);
 assert.equal((body.match(/data-action="edit-opportunity"/g)||[]).length,2);
});
test("category breakdown includes only its won deals",()=>{
 const {api,last}=makeContext();assert.equal(api.revenueSelection("category:Formation courte").items.length,2);
 api.revenueBreakdown("category:Formation courte");assert.match(last().title,/Formation courte/);
 assert.equal(api.revenueSelection("category:VAE").items.length,0);
});
test("weighted contribution is calculated per deal and shown with its source amount",()=>{
 const {api,last}=makeContext();
 assert.equal(api.weightedSum(api.revenueSelection("weighted").items),180000);
 api.revenueBreakdown("weighted");
 assert.match(last().body,/40 %/);assert.match(last().body,/70 %/);
 assert.match(last().body,/data-id="a1"/);assert.match(last().body,/data-id="a2"/);
});
test("dashboard breakdown respects scoped opportunities",()=>{
 const {api}=makeContext("dashboard");
 assert.equal(api.revenueSelection("secured").items.length,1);
 assert.equal(api.revenueSelection("pipeline").items.length,2);
 assert.equal(api.revenueSelection("lost").items.length,1);
 assert.equal(api.revenueSelection("average").items.length,1);
});
test("reporting and dashboard amounts support tax rate, with no schema change",()=>{
 const {api,last}=makeContext("reporting","ttc");
 api.revenueBreakdown("secured");
 assert.match(last().body,/10200\.00/);
 assert.match(last().body,/TTC/);
});
test("clickable KPI emits a keyboard-friendly action, static KPI remains static",()=>{
 const {api}=makeContext();
 assert.match(api.metric("CA","50 €","3 ventes","€","","secured"),/<button[^>]*data-action="revenue-breakdown"/);
 assert.match(api.metric("Conversion","50 %","2 clos","%"),/^<div class="metric">/);
});
test("all financial dashboard and reporting KPIs are wired",()=>{
 assert.match(source,/,"good","secured"\)/);
 assert.match(source,/,"","pipeline"\)/);
 assert.match(source,/,"bad","lost"\)/);
 assert.match(source,/,"","average"\)/);
 assert.match(source,/,"","weighted"\)/);
 assert.match(source,/data-revenue="category:/);
 assert.match(source,/if\(a==="revenue-breakdown"\)/);
});
