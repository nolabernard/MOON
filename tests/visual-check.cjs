"use strict";
const {chromium}=require("playwright");
const fs=require("node:fs"),path=require("node:path");
const base="http://127.0.0.1:8765/tests/ui-fixture.html";
const output=path.join(__dirname,"..","screenshots");
fs.mkdirSync(output,{recursive:true});
const data={
 version:2,
 contacts:[{id:"c1",created:"2026-11-01",first:"Camille",last:"Martin",company:"Entreprise Démonstration",email:"camille@example.org",phone:"0600000000",profile:"Salarié",notes:""}],
 opportunities:[{id:"o1",created:"2026-11-01",contactId:"c1",training:"VAE — Diplôme supérieur en immobilier",category:"VAE",stage:"En discussion",ht:"5980",vat:"0",follow:"2026-11-10",forecast:"2026-12-12",closed:"",maturity:"Tiède",owner:"",notes:"",events:[]}],
 tasks:[{id:"t1",created:"2026-11-01",type:"Relance",title:"Relancer Camille Martin",priority:"Normale",status:"open",due:"2026-11-10",contactId:"c1",opportunityId:"o1",notes:""}],
 reportingGoals:{},reportingAdjustments:[]
};
function check(ok,why){if(!ok)throw Error(why)}
async function main(){
 const browser=await chromium.launch({headless:true});
 const widths=[375,768,1024,1440],sections=["day","opportunities","contacts","tasks","reporting","account","settings"];
 let checked=0;
 try{
  for(const width of widths){
   const tab=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
   const errors=[];
   tab.on("pageerror",e=>errors.push(String(e)));
   await tab.goto(base,{waitUntil:"load"});
   await tab.waitForFunction(()=>typeof window.MOON_CLOUD_BRIDGE==="object",{timeout:15000});
   await tab.evaluate(seed=>{window.eval("data="+JSON.stringify(seed))},data);
   for(const section of sections){
    await tab.evaluate(next=>{window.eval("page="+JSON.stringify(next)+";render()")},section);
    await tab.locator("#app .shell").waitFor({state:"visible"});
    const result=await tab.evaluate(()=>{
      const root=document.documentElement;
      const labels=[...document.querySelectorAll(".moon-filter-group")].map(group=>{
       const label=group.querySelector(".moon-filter-label"),control=group.querySelector(".field");
       if(!label||!control)return {ok:false,reason:"missing filter label or control"};
       const a=label.getBoundingClientRect(),b=control.getBoundingClientRect();
       return {ok:a.bottom<=b.top+2,reason:"label is not above its field"};
      });
      const actions=[...document.querySelectorAll("#app .btn")].filter(b=>b.offsetWidth>0&&b.offsetHeight>0);
      const small=actions.filter(b=>b.classList.contains("small"));
      const regular=actions.filter(b=>!b.classList.contains("small"));
      return {
       scrollWidth:root.scrollWidth,innerWidth:window.innerWidth,filters:labels,
       regularBad:regular.filter(b=>b.getBoundingClientRect().height<39).map(b=>b.textContent.slice(0,45)),
       smallBad:small.filter(b=>b.getBoundingClientRect().height<32).map(b=>b.textContent.slice(0,45)),
       darkTheme:getComputedStyle(document.body).color==="rgb(240, 242, 250)"
      };
    });
    const where=section+" at "+width+"px";
    check(result.scrollWidth<=result.innerWidth+3,where+": horizontal overflow "+result.scrollWidth+" > "+result.innerWidth);
    check(result.filters.every(x=>x.ok),where+": misaligned filter labels");
    check(!result.regularBad.length,where+": short buttons "+result.regularBad);
    check(!result.smallBad.length,where+": short compact buttons "+result.smallBad);
    check(!result.darkTheme,where+": unexpected dark theme");
    if(section==="reporting")check(result.filters.length>=2,where+": reporting filters missing");
    if([375,1440].includes(width))await tab.screenshot({path:path.join(output,section+"-"+width+".png"),fullPage:true});
    checked++;
   }
   if(errors.length)throw Error("Browser errors at "+width+"px: "+errors.join("; "));
   await tab.close();
  }
  console.log("PASS: "+checked+" page/viewport checks, screenshots saved.");
 }finally{await browser.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1});
