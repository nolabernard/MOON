"use strict";
/* MOON reporting goals. Stored inside the existing account-scoped CRM snapshot. */
(function(){
 const NAMES=["Actions de prospection","Rendez-vous planifiés","Publications réseaux sociaux","Événements"];
 const KEYS=["prospection","meetings","publications","events"];
 const DEFAULT=[60,12,4,1];
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const iso=d=>{const x=new Date(d);return Number.isFinite(x.valueOf())?x.toISOString().slice(0,10):""};
 const day=(y,m,d)=>String(y).padStart(4,"0")+"-"+String(m).padStart(2,"0")+"-"+String(d).padStart(2,"0");
 const next=(s,n)=>{const [y,m,d]=s.split("-").map(Number),x=new Date(Date.UTC(y,m-1,d+n));return x.toISOString().slice(0,10)};
 const daysBetween=(a,b)=>Math.round((Date.parse(b+"T12:00:00Z")-Date.parse(a+"T12:00:00Z"))/86400000);
 const monthEnd=(y,m)=>day(y,m,new Date(Date.UTC(y,m,0)).getUTCDate());
 const clampNum=n=>Number.isSafeInteger(Number(n))&&Number(n)>=0?Number(n):null;
 function ensure(data){if(!data.reportingGoals||typeof data.reportingGoals!=="object"||Array.isArray(data.reportingGoals))data.reportingGoals={};if(!Array.isArray(data.reportingAdjustments))data.reportingAdjustments=[];}
 function annual(data,y){const r=data.reportingGoals?.[String(y)];return r&&Array.isArray(r.base)?r:{base:DEFAULT,months:{}}}
 function monthly(data,y,m){const r=annual(data,y);return KEYS.map((_,i)=>r.months?.[String(m)]?.[i]??r.base[i]??DEFAULT[i])}
 function target(data,key,from,to){if(!from||!to||to<from)return 0;const ix=KEYS.indexOf(key);let sum=0;let cursor=from;
  while(cursor<=to){const y=Number(cursor.slice(0,4)),m=Number(cursor.slice(5,7));const end=monthEnd(y,m),last=end<to?end:to;const monthDays=Number(end.slice(-2));sum+=monthly(data,y,m)[ix]*(daysBetween(cursor,last)+1)/monthDays;cursor=next(last,1)}return Math.round(sum);
 }
 function inRange(value,from,to){const d=String(value||"").slice(0,10);return !!d&&d>=from&&d<=to}
 function auto(data,key,from,to){
  if(key==="prospection"){let count=0;for(const o of data.opportunities||[])for(const e of o.events||[]){
   if(["Appel","Email","SMS"].includes(e.channel)&&e.direction==="outgoing"&&inRange(e.at,from,to))count++;
  }return count;}
  if(key==="meetings"){const seen=new Set();let count=0;
   for(const t of data.tasks||[]){if(t.type!=="Rendez-vous"||t.meetingStatus==="cancelled"||!inRange(t.due,from,to)||seen.has(t.id))continue;seen.add(t.id);count++;}
   return count;
  }return 0;
 }
 function manual(data,key,from,to){return (data.reportingAdjustments||[]).filter(a=>a.key===key&&inRange(a.date,from,to)).reduce((n,a)=>n+Number(a.quantity||0),0)}
 function period(from,to,mode,now){if(mode==="all"||!from||!to)return [now.slice(0,4)+"-01-01",now.slice(0,4)+"-12-31"];return [from,to]}
 function render(data,from,to,mode,now,readOnly){
  const [start,end]=period(from,to,mode,now);
  const invalid=end<start;
  const range=mode==="all"?"Objectifs de l’année "+now.slice(0,4)+" (les résultats financiers restent toutes périodes)":start+" au "+end;
  return '<section class="panel moon-goals"><div class="moon-goals-head"><div><h2>Objectifs d’activité</h2><p class="subtle">'+esc(range)+'</p></div>'+
   (readOnly?'':'<button class="btn small ghost" type="button" data-action="goals-settings" title="Modifier les objectifs" aria-label="Modifier les objectifs">⚙ Objectifs</button>')+'</div>'+
   (invalid?'<p class="subtle">La période sélectionnée est invalide.</p>':'<div class="moon-goals-grid">'+KEYS.map((key,i)=>{
    const a=auto(data,key,start,end),m=manual(data,key,start,end),done=a+m,goal=target(data,key,start,end),pct=goal?Math.round(done/goal*100):(done?100:0);
    const remaining=Math.max(0,goal-done),shown=Math.min(100,pct);
    return '<button type="button" class="moon-goal-card" data-action="goals-detail" data-key="'+key+'"><span class="moon-goal-label">'+esc(NAMES[i])+'</span>'+
     '<span class="moon-goal-value">'+done+' <small>/ '+goal+'</small></span><span class="moon-goal-track"><span style="width:'+shown+'%"></span></span>'+
     '<span class="moon-goal-foot">'+(goal===0?'Sans objectif':pct+' % atteint')+' · '+(remaining?'Reste '+remaining:done>goal?'+'+(done-goal)+' au-delà':'Objectif atteint')+'</span></button>';
   }).join("")+'</div>')+'</section>';
 }
 function numberInput(name,v){return '<input class="field moon-goal-number" type="number" name="'+name+'" min="0" step="1" required value="'+esc(v)+'">'}
 function config(data,year,modal){const y=Number(year)||new Date().getFullYear(),r=annual(data,y);modal("Objectifs d’activité",'<div class="moon-goal-config"><div class="row"><strong>Année '+y+'</strong><span><button class="btn small" data-action="goals-year" data-year="'+(y-1)+'">←</button> <button class="btn small" data-action="goals-year" data-year="'+(y+1)+'">→</button></span></div>'+
 '<p class="subtle">Objectifs mensuels de référence. Vous pourrez adapter chaque mois indépendamment.</p><form id="goals-base-form" data-year="'+y+'">'+NAMES.map((n,i)=>'<label class="moon-goal-field"><span>'+esc(n)+'</span>'+numberInput("g"+i,r.base?.[i]??DEFAULT[i])+'</label>').join("")+
 '<div class="form-footer"><button class="btn" type="button" data-action="close-modal">Fermer</button><button class="btn primary" type="submit">Enregistrer les références</button></div></form>'+
 '<div class="moon-goal-months"><h3>Personnaliser un mois</h3><div class="moon-month-buttons">'+Array.from({length:12},(_,i)=>'<button class="btn small" type="button" data-action="goals-month" data-year="'+y+'" data-month="'+(i+1)+'">'+["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"][i]+(r.months?.[String(i+1)]?' •':'')+'</button>').join("")+'</div></div></div>')}
 function monthConfig(data,y,m,modal){const a=monthly(data,y,m);modal("Objectifs — "+["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"][m-1]+" "+y,
 '<form id="goals-month-form" data-year="'+y+'" data-month="'+m+'"><p class="subtle">Cette personnalisation ne change pas les autres mois.</p>'+
 NAMES.map((n,i)=>'<label class="moon-goal-field"><span>'+esc(n)+'</span>'+numberInput("g"+i,a[i])+'</label>').join("")+
 '<div class="form-footer"><button type="button" class="btn" data-action="goals-reset" data-year="'+y+'" data-month="'+m+'">Réinitialiser le mois</button><button class="btn primary" type="submit">Enregistrer</button></div></form>')}
 function detail(data,key,from,to,mode,now,readOnly,modal){const [start,end]=period(from,to,mode,now),i=KEYS.indexOf(key);if(i<0||end<start)return;
 const logs=(data.reportingAdjustments||[]).filter(a=>a.key===key&&inRange(a.date,start,end)).sort((a,b)=>b.date.localeCompare(a.date));
 modal(NAMES[i],'<div class="moon-goal-detail"><p class="subtle">'+esc(start+' au '+end)+'</p><p><strong>Automatique : '+auto(data,key,start,end)+'</strong> · Manuel : '+manual(data,key,start,end)+' · Objectif : '+target(data,key,start,end)+'</p>'+
 (key==="prospection"?'<p class="subtle">Seuls les échanges explicitement marqués « Sortant » sont comptés. Les anciens échanges sans direction ne sont pas devinés.</p>':key==="meetings"?'<p class="subtle">Rendez-vous issus des tâches, à leur date prévue, hors rendez-vous annulés.</p>':'')+
 (readOnly?'':'<form id="goals-add-form" data-key="'+key+'"><h3>Ajouter une réalisation hors MOON</h3><div class="moon-goal-add">'+
 '<label>Date<input class="field" type="date" name="date" value="'+now+'" required></label><label>Quantité<input class="field" type="number" name="quantity" value="1" min="1" max="100000" step="1" required></label></div>'+
 '<label>Note (facultatif)<input class="field" name="note" maxlength="200" placeholder="Ex. : prospection hors CRM"></label><div class="form-footer"><button class="btn primary" type="submit">Ajouter</button></div></form>')+
 '<h3>Ajouts manuels</h3>'+(logs.length?logs.map(a=>'<div class="moon-goal-log"><span><strong>+'+a.quantity+'</strong> · '+esc(a.date)+'<br><small>'+esc(a.note||"Sans note")+'</small></span>'+(readOnly?'':'<button class="btn small" type="button" data-action="goals-delete" data-id="'+esc(a.id)+'" data-key="'+key+'">Supprimer</button>')+'</div>').join(""):'<p class="subtle">Aucun ajout manuel sur cette période.</p>')+'</div>');
 }
 function handleAction(action,btn,ctx){
  const {data,save,render,modal,today,id,reportingBounds,periodMode,readOnly}=ctx;
  const [from,to]=reportingBounds(),now=today();
  if(action==="goals-detail"){detail(data,btn.dataset.key,from,to,periodMode,now,readOnly,modal);return true;}
  if(readOnly)return true;
  if(action==="goals-settings"){config(data,Number(now.slice(0,4)),modal);return true;}
  if(action==="goals-year"){config(data,btn.dataset.year,modal);return true;}
  if(action==="goals-month"){monthConfig(data,Number(btn.dataset.year),Number(btn.dataset.month),modal);return true;}
  if(action==="goals-reset"){if(!confirm("Réinitialiser les objectifs de ce mois ?"))return true;ensure(data);const r=data.reportingGoals[btn.dataset.year];if(r?.months)delete r.months[btn.dataset.month];if(save()){config(data,btn.dataset.year,modal);render()}return true;}
  if(action==="goals-delete"){if(!confirm("Supprimer cet ajustement manuel ?"))return true;ensure(data);const old=data.reportingAdjustments;data.reportingAdjustments=old.filter(a=>a.id!==btn.dataset.id);if(!save()){data.reportingAdjustments=old;return true;}render();detail(data,btn.dataset.key,from,to,periodMode,now,false,modal);return true;}
  return false;
 }
 function handleSubmit(form,ctx){const {data,save,render,closeModal,modal,today,id,reportingBounds,periodMode}=ctx;ensure(data);const v=Object.fromEntries(new FormData(form));
  if(form.id==="goals-add-form"){const quantity=clampNum(v.quantity);if(!quantity||quantity>100000||!KEYS.includes(form.dataset.key)||!/^\d{4}-\d{2}-\d{2}$/.test(v.date)||iso(v.date)!==v.date){alert("Date ou quantité invalide.");return true;}
   const entry={id:id(),key:form.dataset.key,quantity,date:v.date,note:String(v.note||"").trim().slice(0,200)};
   data.reportingAdjustments.push(entry);if(!save()){data.reportingAdjustments.pop();return true;}render();const [from,to]=reportingBounds();detail(data,form.dataset.key,from,to,periodMode,today(),false,modal);return true;
  }
  if(form.id==="goals-base-form"||form.id==="goals-month-form"){const nums=KEYS.map((_,i)=>clampNum(v["g"+i]));if(nums.some(x=>x===null||x>1000000)){alert("Les objectifs doivent être des nombres entiers positifs ou nuls.");return true;}
   const y=String(form.dataset.year),m=String(form.dataset.month||"");
   const old=JSON.stringify(data.reportingGoals);
   if(!data.reportingGoals[y])data.reportingGoals[y]={base:[...DEFAULT],months:{}};
   if(form.id==="goals-base-form")data.reportingGoals[y].base=nums;else data.reportingGoals[y].months[m]=nums;
   if(!save()){data.reportingGoals=JSON.parse(old);return true;}render();if(form.id==="goals-base-form")config(data,y,modal);else monthConfig(data,Number(y),Number(m),modal);return true;
  }return false;
 }
 window.MOON_GOALS={ensure,monthly,target,auto,manual,render,handleAction,handleSubmit};
})();