"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const src=fs.readFileSync(path.join(__dirname,"..","reporting-goals.js"),"utf8");
const context={window:{},Date,Number,String,Math,Array,JSON};
vm.runInNewContext(src,context);
const g=context.window.MOON_GOALS;
const sample=()=>({contacts:[],tasks:[],opportunities:[],reportingGoals:{},reportingAdjustments:[]});
test("default annual goal is monthly and a different month can override it",()=>{
 const d=sample();
 assert.equal(g.target(d,"prospection","2027-01-01","2027-12-31"),720);
 d.reportingGoals["2027"]={base:[60,12,4,1],months:{"8":[30,4,0,0]}};
 assert.equal(g.target(d,"prospection","2027-01-01","2027-12-31"),690);
 assert.equal(g.target(d,"prospection","2027-08-01","2027-08-31"),30);
 assert.equal(g.target(d,"prospection","2027-09-01","2027-09-30"),60);
});
test("week crossing two months uses prorated targets",()=>{
 const d=sample();
 d.reportingGoals["2027"]={base:[60,12,4,1],months:{"2":[28,12,4,1]}};
 assert.equal(g.target(d,"prospection","2027-02-22","2027-02-28"),7);
 assert.equal(g.target(d,"prospection","2027-02-26","2027-03-04"),Math.round(3*28/28+4*60/31));
});
test("prospection counts only explicitly outbound calls, emails and SMS, including repeated businesses",()=>{
 const d=sample();
 d.opportunities=[{id:"a",events:[
  {channel:"Appel",direction:"outgoing",at:"2026-11-02T08:00:00Z"},
  {channel:"Email",direction:"outgoing",at:"2026-11-04T08:00:00Z"},
  {channel:"SMS",direction:"incoming",at:"2026-11-06T08:00:00Z"},
  {channel:"Email",at:"2026-11-07T08:00:00Z"},
  {channel:"Note",direction:"outgoing",at:"2026-11-08T08:00:00Z"}]}];
 assert.equal(g.auto(d,"prospection","2026-11-01","2026-11-30"),2);
});
test("meetings use scheduled date and ignore cancellations, manual entries have their own date",()=>{
 const d=sample();
 d.tasks=[{id:"1",type:"Rendez-vous",due:"2026-12-05",status:"open"},{id:"2",type:"Rendez-vous",due:"2026-12-15",meetingStatus:"cancelled"},{id:"3",type:"Relance",due:"2026-12-05"}];
 d.reportingAdjustments=[{id:"man1",key:"meetings",date:"2026-12-06",quantity:3},{id:"man2",key:"meetings",date:"2026-11-06",quantity:1}];
 assert.equal(g.auto(d,"meetings","2026-11-01","2026-11-30"),0);
 assert.equal(g.auto(d,"meetings","2026-12-01","2026-12-31"),1);
 assert.equal(g.manual(d,"meetings","2026-12-01","2026-12-31"),3);
});
test("objective cards show overperformance without dividing by zero",()=>{
 const d=sample();d.reportingGoals["2026"]={base:[0,0,0,0],months:{}};
 const html=g.render(d,"2026-11-01","2026-11-30","month","2026-11-10",false);
 assert.match(html,/Objectifs d’activité/);assert.match(html,/Sans objectif/);assert.match(html,/goals-settings/);
});
