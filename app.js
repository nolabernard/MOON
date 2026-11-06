
"use strict";
const KEY="moon.crm.v2",OLD="moon.crm.v1";
// Browser data are scoped to the authenticated Supabase user, never shared between accounts.
let activeOwner=null;
const scopedKey=()=>activeOwner?KEY+".user."+activeOwner:KEY;
const emptyCRM=()=>({version:2,contacts:[],opportunities:[],tasks:[]});
const STAGES=["Nouveau","Contacté","En discussion","RDV / Proposition","Gagné","Perdu"];
const MATURITIES=["","Froid","Tiède","Chaud"];
const TYPES=["VAE","Formation courte","Autre"];
const CHANNELS=["Appel","Email","SMS","Visioconférence","Rendez-vous","Note"];
let data={version:2,contacts:[],opportunities:[],tasks:[]};
let naturalQuery="";
let page="day",period="all",rangeFrom="",rangeTo="",tax="ht",taskMode="open",afterContact=false;
const $=id=>document.getElementById(id);
const today=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10)};
const id=()=>typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():"moon-"+Date.now()+"-"+Math.random().toString(36).slice(2);
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=c=>new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(c/100);
const dt=x=>x?new Date(x+"T12:00:00").toLocaleDateString("fr-FR"):"—";
const fmtDateTime=x=>x?new Date(x).toLocaleString("fr-FR"):"";
const contactName=c=>c?[c.first,c.last].filter(Boolean).join(" ").trim()||c.company||"Sans nom":"Contact introuvable";
const linkedContact=o=>data.contacts.find(c=>c.id===o.contactId);
const opportunity=x=>data.opportunities.find(o=>o.id===x);
const contact=x=>data.contacts.find(c=>c.id===x);
const task=x=>data.tasks.find(t=>t.id===x);
const isActive=o=>o.stage!=="Gagné"&&o.stage!=="Perdu";
const known=o=>o.ht!==""&&o.ht!==null&&o.ht!==undefined&&Number.isFinite(Number(o.ht));
const amount=o=>{if(!known(o))return null;const ht=Math.round(Number(o.ht)*100);const rate=o.vat==="exempt"?0:Number(o.vat??0);return tax==="ht"?ht:Math.round(ht*(1+(Number.isFinite(rate)?rate:0)/100))};
const sum=a=>a.reduce((s,o)=>s+(amount(o)??0),0);
const amountText=o=>known(o)?money(amount(o)):"Non renseigné";
const compare=(a,b)=>(a||"").localeCompare(b||"");
function normalize(){
if(!Array.isArray(data.contacts))data.contacts=[];
if(!Array.isArray(data.opportunities))data.opportunities=[];
if(!Array.isArray(data.tasks))data.tasks=[];
data.contacts=data.contacts.filter(c=>c&&c.id).map(c=>({...c,first:c.first||"",last:c.last||"",company:c.company||""}));
data.opportunities=data.opportunities.filter(o=>o&&o.id).map(o=>({...o,stage:STAGES.includes(o.stage)?o.stage:"Nouveau",maturity:MATURITIES.includes(o.maturity)?o.maturity:"",events:Array.isArray(o.events)?o.events:[],category:o.category||"Autre",vat:o.vat??"0"}));
data.tasks=data.tasks.filter(t=>t&&t.id).map(t=>({...t,status:t.status==="done"?"done":"open",type:t.type||"Relance"}));
}
function migrateOld(){
let old;try{old=JSON.parse(localStorage.getItem(OLD)||"[]")}catch{return false}
const items=Array.isArray(old)?old:Array.isArray(old.opportunities)?old.opportunities:[];
if(!items.length)return false;
const keys=new Map();
for(const o of items){
if(!o||!o.id)continue;
const first=o.first||"",last=o.last||"",company=o.company||"",email=o.email||"",phone=o.phone||"";
const key=(email.trim()? "email:"+email.trim().toLowerCase(): "name:"+[first,last,company].join("|").toLowerCase());
let c=keys.get(key);
if(!c){c={id:id(),first,last,company,email,phone,profile:o.profile||"Salarié",created:o.created||today(),notes:""};data.contacts.push(c);keys.set(key,c)}
data.opportunities.push({id:o.id,contactId:c.id,training:o.training||"Projet sans intitulé",category:o.category||"Autre",stage:STAGES.includes(o.stage)?o.stage:"Nouveau",ht:o.ht??"",vat:o.vat??"0",follow:o.follow||"",forecast:o.forecast||"",closed:o.closed||"",created:o.created||today(),source:o.source||"",owner:o.owner||"",notes:o.notes||"",lostReason:o.lostReason||"",events:Array.isArray(o.events)?o.events:[]});
}
return true;
}
function load(){
if(window.MOON_CLOUD&&!activeOwner)return;
let loaded=false;
try{const s=JSON.parse(localStorage.getItem(scopedKey())||"null");if(s&&Array.isArray(s.contacts)&&Array.isArray(s.opportunities)&&Array.isArray(s.tasks)){data=s;loaded=true}}catch(e){console.error("MOON loading",e)}
if(!loaded){if(!activeOwner)migrateOld();save(false)}normalize();
}
function save(show=true){
 if(window.MOON_CLOUD&&!activeOwner)return false;
 try{
  const serialized=JSON.stringify(data);
  localStorage.setItem(scopedKey(),serialized);
  if(localStorage.getItem(scopedKey())!==serialized)throw Error("Vérification du stockage local échouée.");
 }catch(e){alert("Impossible d'enregistrer dans ce navigateur : "+e.message);return false}
 if(show){
  try{window.MOON_CLOUD?.onLocalSave?.()}catch(e){console.error("MOON cloud notification",e)}
  try{toast("Modifications enregistrées")}catch(e){console.error("MOON toast",e)}
 }
 return true;
}
function toast(message){const area=$("toast");area.textContent=message;area.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>area.hidden=true,3600)}
function badge(stage){return `<span class="badge ${stage==="Gagné"?"won":stage==="Perdu"?"lost":""}">${esc(stage)}</span>`}
function opts(values,chosen){return values.map(s=>`<option value="${esc(s)}" ${String(chosen)===String(s)?"selected":""}>${esc(s)}</option>`).join("")}
function monthMatch(date){
if(period==="all")return true;
if(!date)return false;
if(period==="month")return date.startsWith(today().slice(0,7));
if(period==="year")return date.startsWith(today().slice(0,4));
if(period==="quarter"){const now=today();return date.slice(0,4)===now.slice(0,4)&&Math.floor((Number(date.slice(5,7))-1)/3)===Math.floor((Number(now.slice(5,7))-1)/3)}
if(period==="custom")return (!rangeFrom||date>=rangeFrom)&&(!rangeTo||date<=rangeTo);
return true;
}
function scoped(){return data.opportunities.filter(o=>monthMatch(isActive(o)?o.forecast:o.closed||o.created))}
function navButton(k,icon,label){return `<button class="nav-button ${page===k?"active":""}" data-action="nav" data-page="${k}" type="button"><span class="nav-ico">${icon}</span><span>${label}</span></button>`}
function toolbar(){
const filter=`<select class="field" id="period" aria-label="Période">${opts(["all","month","quarter","year","custom"],period).replace(/>all</g,">Toutes périodes<").replace(/>month</g,">Ce mois<").replace(/>quarter</g,">Ce trimestre<").replace(/>year</g,">Cette année<").replace(/>custom</g,">Personnalisée<")}</select>${period==="custom"?`<label class="subtle">Du <input class="field" id="range-from" type="date" value="${esc(rangeFrom)}"></label><label class="subtle">Au <input class="field" id="range-to" type="date" value="${esc(rangeTo)}"></label>`:""}`;
return `<div class="filters">${page==="dashboard"||page==="board"||page==="opportunities"?filter:""}
${page==="dashboard"||page==="board"||page==="opportunities"?`<select class="field" id="tax" aria-label="Affichage financier">${opts(["ht","ttc"],tax).replace(/>ht</g,">Montants HT<").replace(/>ttc</g,">Montants TTC<")}</select>`:""}
${page==="contacts"||page==="opportunities"||page==="tasks"?`<input class="field search" id="search" placeholder="Rechercher..." autocomplete="off" aria-label="Rechercher">`:""}
${page==="tasks"?`<select id="task-mode" class="field" aria-label="Filtrer les tâches">${opts(["open","all","done"],taskMode).replace(/>open</g,">À faire<").replace(/>all</g,">Toutes<").replace(/>done</g,">Terminées<")}</select>`:""}
</div>`;
}
function render(){
if(window.MOON_CLOUD&&!window.MOON_CLOUD.isAuthenticated?.()){const root=$("app");if(root)root.innerHTML="";return}
const titles={day:["Ma journée","Vos relances, dossiers à suivre et priorités du jour"],dashboard:["Tableau de bord","Une vision claire de vos résultats et priorités"],board:["Pipeline commercial","Déplacez les opportunités pour suivre leur progression"],opportunities:["Opportunités","Les projets commerciaux et leurs montants"],contacts:["Contacts","Un contact peut avoir plusieurs opportunités"],tasks:["Tâches & relances","Ajoutez, terminez, modifiez ou supprimez vos actions"],reporting:["Reporting commercial","Vos indicateurs et votre bilan partageable"],settings:["Paramètres","Personnalisation, importations et sauvegardes"],account:["Mon compte","Connexion sécurisée, synchronisation et appareils"]};
const [title,subtitle]=titles[page];
$("app").innerHTML=`<div class="shell"><aside class="sidebar"><div class="brand"><div class="brand-symbol">☾</div><div><strong>MOON</strong><small>ESPI EXECUTIVE</small></div></div><nav aria-label="Navigation principale">
${navButton("day","☀","Ma journée")}${navButton("dashboard","◫","Accueil")}${navButton("board","▥","Pipeline")}${navButton("opportunities","◇","Opportunités")}${navButton("contacts","♙","Contacts")}${navButton("tasks","☑","Tâches")}${navButton("reporting","▤","Reporting")}<div class="nav-divider" aria-hidden="true"></div><div class="nav-group-label">ESPACE PERSONNEL</div>${navButton("account","☁","Mon compte")}${navButton("settings","⚙","Paramètres")}
</nav><div class="sidebar-bottom"><span id="sidebar-sync-state">☁ Vérification de la synchronisation…</span><br>MOON · Votre espace sécurisé</div></aside>
<div class="main"><div class="topbar"><div><div class="eyebrow">MOON / ${esc(page)}</div><h1>${title}</h1><div class="subtle">${subtitle}</div></div><div class="actions"><button class="btn" type="button" data-action="nav" data-page="account" title="Compte et synchronisation entre ordinateurs">☁ <span id="topbar-sync-label">Mon compte</span></button><button class="btn" data-action="voice-open" type="button">🎙 Dicter</button>
${page==="contacts"?`<button class="btn primary" data-action="new-contact">+ Nouveau contact</button>`:page==="tasks"?`<button class="btn primary" data-action="new-task">+ Nouvelle tâche</button>`:page==="settings"||page==="account"?"":`<button class="btn" data-action="new-task">+ Tâche</button><button class="btn primary" data-action="new-opportunity">+ Opportunité</button>`}</div></div>
${toolbar()}<div id="view">${page==="day"?dayPage():page==="dashboard"?dashboard():page==="board"?board():page==="opportunities"?opportunities():page==="contacts"?contacts():page==="tasks"?tasks():page==="reporting"?reportingPage():page==="account"?accountPage():settings()}</div></div></div>`;
}
function metric(label,value,foot,icon,color=""){return `<div class="metric"><div class="label">${label}<span>${icon}</span></div><div class="number ${color}">${value}</div><div class="foot">${foot}</div></div>`}
function dueClass(t){if(t.status==="done")return "won";if(t.due&&t.due<today())return "late";if(t.due===today())return "today";return ""}
function dueLabel(t){if(t.status==="done")return "Terminée";if(!t.due)return "Sans échéance";if(t.due<today())return "En retard · "+dt(t.due);if(t.due===today())return "Aujourd'hui";return dt(t.due)}
function taskRelation(t){const o=opportunity(t.opportunityId);const c=o?linkedContact(o):contact(t.contactId);return [c?contactName(c):"",o?o.training:""].filter(Boolean).join(" · ")}
function taskRow(t){return `<div class="task-item ${t.status==="done"?"done":""}"><input class="task-check" type="checkbox" aria-label="Terminer ${esc(t.title)}" data-action="toggle-task" data-id="${esc(t.id)}" ${t.status==="done"?"checked":""}>
<div class="task-content"><div class="task-title">${esc(t.title)}</div><div class="task-meta">${esc(t.type||"Tâche")} · ${esc(taskRelation(t))} ${t.notes?"· "+esc(t.notes):""}</div></div><span class="badge ${dueClass(t)}">${esc(dueLabel(t))}</span><div class="task-actions"><button class="btn small" data-action="edit-task" data-id="${esc(t.id)}">Modifier</button><button class="btn small danger" data-action="delete-task" data-id="${esc(t.id)}">Supprimer</button></div></div>`}
function daysSince(date){
 if(!date)return null;
 const d=new Date(date);if(Number.isNaN(d.getTime()))return null;
 return Math.max(0,Math.floor((new Date(today()+"T12:00:00")-d)/86400000));
}
function lastActivity(o){
 const times=[o.created,...(o.events||[]).map(e=>e.at||e.date)].filter(Boolean).map(x=>new Date(x).getTime()).filter(Number.isFinite);
 return times.length?new Date(Math.max(...times)).toISOString():"";
}
function priorityScore(o){
 const late=o.follow&&o.follow<today(),due=o.follow===today(),idle=daysSince(lastActivity(o));
 let score=(late?45:due?30:0)+(idle>=15?25:idle>=7?15:0)+(known(o)?Math.min(20,Math.floor(Number(o.ht)/1000)*3):0);
 if(o.stage==="RDV / Proposition")score+=10;
 return Math.min(100,score);
}

function dayPage(){
 const active=data.opportunities.filter(isActive);
 const openTasks=data.tasks.filter(t=>t.status==="open");
 const overdueTasks=openTasks.filter(t=>t.due&&t.due<today()).sort((a,b)=>compare(a.due,b.due));
 const todayTasks=openTasks.filter(t=>t.due===today()).sort((a,b)=>String(b.priority).localeCompare(String(a.priority)));
 const laterTasks=openTasks.filter(t=>!t.due||t.due>today()).sort((a,b)=>compare(a.due||"9999",b.due||"9999"));
 const overdueOps=active.filter(o=>o.follow&&o.follow<today()).sort((a,b)=>compare(a.follow,b.follow));
 const todayOps=active.filter(o=>o.follow===today()).sort((a,b)=>priorityScore(b)-priorityScore(a));
 const dormant=active.filter(o=>!o.follow&&(daysSince(lastActivity(o))??0)>=7).sort((a,b)=>priorityScore(b)-priorityScore(a));
 const pending=overdueTasks.length+todayTasks.length+overdueOps.length+todayOps.length;
 const firstName=overdueTasks[0]||todayTasks[0]||overdueOps[0]||todayOps[0];
 const taskCard=(t,late)=>'<div class="day-action"><input class="task-check" type="checkbox" data-action="toggle-task" data-id="'+esc(t.id)+'" aria-label="Terminer '+esc(t.title)+'"><div class="day-action-main"><strong>'+esc(t.title)+'</strong><div class="day-action-meta">'+esc(taskRelation(t)||t.type||"Tâche")+' · '+esc(late?"En retard depuis "+dt(t.due):"Aujourd’hui")+'</div></div><button class="btn small" type="button" data-action="edit-task" data-id="'+esc(t.id)+'">Ouvrir</button></div>';
 const oppCard=(o,late)=>{const c=linkedContact(o);return '<div class="day-action"><span class="day-avatar" aria-hidden="true">'+esc((contactName(c)||"?").slice(0,1).toUpperCase())+'</span><div class="day-action-main"><strong>'+esc(contactName(c))+'</strong><div class="day-action-meta">'+esc(o.training||"Dossier")+' · '+esc(o.stage)+(late?' · En retard depuis '+esc(dt(o.follow)):' · À relancer aujourd’hui')+'</div></div><button class="btn small" type="button" data-action="edit-opportunity" data-id="'+esc(o.id)+'">Ouvrir</button></div>'};
 const section=(title,count,content,empty)=>'<section class="day-section"><div class="day-section-head"><h3>'+title+' <span class="day-count">'+count+'</span></h3></div>'+(count?content:'<p class="day-empty">'+empty+'</p>')+'</section>';
 const formatted=new Date(today()+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
 return '<div class="day-workspace"><div class="day-hero"><div><div class="day-kicker">'+esc(formatted)+'</div><h2>'+ (pending?'Votre journée, en un coup d’œil':'Tout est à jour pour aujourd’hui')+'</h2><p>'+ (pending?pending+' action(s) à traiter aujourd’hui ou en retard. Commencez par les plus urgentes.':'Aucune échéance immédiate. Profitez-en pour préparer vos prochaines relances.')+'</p></div><div class="day-hero-actions"><button type="button" class="btn primary" data-action="new-task">+ Planifier une action</button><button type="button" class="btn" data-action="new-opportunity">+ Opportunité</button></div></div>'+
 '<div class="day-summary"><button class="day-stat" type="button" data-action="day-jump" data-target="day-overdue"><span>En retard</span><strong>'+ (overdueTasks.length+overdueOps.length)+'</strong><small>À régulariser</small></button><button class="day-stat" type="button" data-action="day-jump" data-target="day-today"><span>À faire aujourd’hui</span><strong>'+(todayTasks.length+todayOps.length)+'</strong><small>Actions planifiées</small></button><button class="day-stat" type="button" data-action="day-jump" data-target="day-dormant"><span>À réactiver</span><strong>'+dormant.length+'</strong><small>Dossiers sans suivi</small></button></div>'+
 '<div class="day-columns"><div class="day-primary"><div class="day-panel"><div class="day-panel-head"><div><span class="day-kicker">FILE D’ACTIONS</span><h2>À traiter maintenant</h2></div><span class="day-pill">'+pending+' à traiter</span></div>'+
 '<div id="day-overdue">'+section("En retard",overdueTasks.length+overdueOps.length,overdueTasks.map(t=>taskCard(t,true)).join("")+overdueOps.map(o=>oppCard(o,true)).join(""),"Aucune action en retard. Bien joué !")+'</div>'+
 '<div id="day-today">'+section("Aujourd’hui",todayTasks.length+todayOps.length,todayTasks.map(t=>taskCard(t,false)).join("")+todayOps.map(o=>oppCard(o,false)).join(""),"Rien de prévu pour aujourd’hui.")+'</div></div></div>'+
 '<aside class="day-secondary"><div class="day-panel"><div class="day-panel-head"><div><span class="day-kicker">ANTICIPER</span><h2>Prochaines actions</h2></div></div>'+(laterTasks.length?laterTasks.slice(0,5).map(t=>'<button type="button" class="day-next" data-action="edit-task" data-id="'+esc(t.id)+'"><span>'+esc(dt(t.due)||"À planifier")+'</span><strong>'+esc(t.title)+'</strong></button>').join(""):'<p class="day-empty">Aucune tâche à venir.</p>')+'<button type="button" class="day-text-link" data-action="nav" data-page="tasks">Voir toutes les tâches →</button></div>'+
 '<div class="day-panel" id="day-dormant"><div class="day-panel-head"><div><span class="day-kicker">OPPORTUNITÉS</span><h2>À réactiver</h2></div><span class="day-count">'+dormant.length+'</span></div>'+(dormant.length?dormant.slice(0,5).map(o=>'<button type="button" class="day-next" data-action="edit-opportunity" data-id="'+esc(o.id)+'"><span>'+esc((daysSince(lastActivity(o))??0)+' jours sans échange')+'</span><strong>'+esc(contactName(linkedContact(o)))+'</strong><small>'+esc(o.training)+'</small></button>').join(""):'<p class="day-empty">Tous les dossiers actifs ont un suivi récent ou une relance planifiée.</p>')+'</div></aside></div></div>';
}

function contactTimeline(c){
 const ops=data.opportunities.filter(o=>o.contactId===c.id);
 const events=ops.flatMap(o=>(o.events||[]).map(e=>({...e,training:o.training,oid:o.id}))).sort((a,b)=>String(b.at).localeCompare(String(a.at)));
 const tasks=data.tasks.filter(t=>t.status!=="done"&&(t.contactId===c.id||ops.some(o=>o.id===t.opportunityId))).sort((a,b)=>String(a.due).localeCompare(String(b.due)));
 const last=events[0],next=tasks[0];
 return '<section class="panel" style="margin-top:18px"><h3>Historique chronologique</h3><p class="subtle">'+(last?'Dernier échange : '+esc(fmtDateTime(last.at))+' · '+esc(last.text):'Aucun échange enregistré')+(next?' · Prochaine action : '+esc(next.title)+' ('+esc(dt(next.due))+')':'')+'</p>'+
 (events.length?events.map(e=>'<div class="task-item"><div class="task-content"><strong>'+esc(e.channel||"Échange")+' · '+esc(e.training)+'</strong><div class="subtle">'+esc(fmtDateTime(e.at))+'</div><div>'+esc(e.text)+'</div></div><button type="button" class="btn small" data-action="edit-opportunity" data-id="'+esc(e.oid)+'">Dossier</button></div>').join(""):'<p class="subtle">Les échanges des opportunités apparaîtront ici.</p>')+
 '<h3>Actions en attente</h3>'+(tasks.length?tasks.map(taskRow).join(""):'<p class="subtle">Aucune tâche en attente.</p>')+'</section>';
}
function suggestedStage(o){
 if(!o||!isActive(o))return "";
 const txt=[o.notes,...(o.events||[]).map(e=>e.text)].join(" ").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
 const advanced=["financement confirme","financement valide","accord de financement","cpf valide","devis signe","inscription confirmee","proposition envoyee","devis envoye","offre transmise","rendez-vous effectue","rdv effectue"];
 const discussing=["interesse","interessee","interesses","interessees","a rappeler","echange realise","echange effectue","souhaite avancer","veut avancer"];
 if(advanced.some(term=>txt.includes(term))&&["Nouveau","Contacté","En discussion"].includes(o.stage))return "RDV / Proposition";
 if(discussing.some(term=>txt.includes(term))&&["Nouveau","Contacté"].includes(o.stage))return "En discussion";
 return "";
}
function naturalMatches(raw){
 const q=String(raw||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
 const cat=q.includes("vae")?"VAE":q.includes("formation courte")?"Formation courte":"";
 const amount=Number(q.match(/(?:plus de|superieur a|au dessus de)\s*([\d\s]+)\s*(?:€|euros)?/)?.[1]?.replace(/\s/g,"")||0);
 const idle=Number(q.match(/(?:depuis|sans echange depuis|sans nouvelles depuis)\s*(\d+)\s*jours?/)?.[1]||0);
 const won=q.includes("gagne"),lost=q.includes("perdu"),active=q.includes("en cours");
 return data.opportunities.filter(o=>(!cat||o.category===cat||String(o.training).toLowerCase().includes(cat.toLowerCase()))&&(!amount||Number(o.ht)>amount)&&(!idle||(daysSince(lastActivity(o))??0)>=idle)&&(!won||o.stage==="Gagné")&&(!lost||o.stage==="Perdu")&&(!active||isActive(o)));
}
function searchNaturalPage(){
 const q=naturalQuery||"",found=q?naturalMatches(q):[];
 return '<section class="panel"><h2>Recherche en langage naturel</h2><p class="subtle">Exemples : « VAE de plus de 5 000 € », « sans échange depuis 15 jours », « dossiers gagnés ». Filtres locaux, sans IA externe.</p><div class="actions"><input class="field" style="flex:1;min-width:220px" id="natural-query" value="'+esc(q)+'" placeholder="VAE de plus de 5000 € sans échange depuis 15 jours"><button class="btn primary" type="button" data-action="natural-search">Rechercher</button></div>'+
 (q?'<p class="subtle">'+found.length+' dossier(s) trouvé(s)</p>'+found.map(o=>'<div class="task-item"><div class="task-content"><strong>'+esc(contactName(linkedContact(o)))+' · '+esc(o.training)+'</strong><div class="subtle">'+esc(o.stage)+' · '+esc(amountText(o))+'</div></div><button type="button" class="btn small" data-action="edit-opportunity" data-id="'+esc(o.id)+'">Ouvrir</button></div>').join(""):'')+'</section>';
}
function reportText(){
 const won=data.opportunities.filter(o=>o.stage==="Gagné"),lost=data.opportunities.filter(o=>o.stage==="Perdu");
 return "MOON — Bilan commercial ("+today()+")\nContacts : "+data.contacts.length+"\nOpportunités : "+data.opportunities.length+"\nGagnées : "+won.length+"\nPerdues : "+lost.length+"\nCA sécurisé HT : "+money(sum(won))+"\nTâches en attente : "+data.tasks.filter(t=>t.status!=="done").length;
}
function reportingPage(){
 const ops=data.opportunities,won=ops.filter(o=>o.stage==="Gagné"),lost=ops.filter(o=>o.stage==="Perdu"),open=ops.filter(isActive);
 const rate=won.length+lost.length?Math.round(won.length/(won.length+lost.length)*100):0;
 const weighted=open.reduce((acc,o)=>acc+(Number(o.ht)||0)*({Nouveau:.1,Contacté:.2,"En discussion":.4,"RDV / Proposition":.7}[o.stage]||0),0);
 return '<section class="grid-metrics">'+metric("CA sécurisé",money(sum(won)),won.length+" dossiers gagnés","€")+metric("CA pondéré estimé",money(Math.round(weighted*100)),"Probabilités indicatives par étape","↗")+metric("Conversion",rate+" %",(won.length+lost.length)+" dossiers clos","%")+metric("Perdus",lost.length+"","Dossiers non convertis","×")+'</section>'+
 '<section class="panel"><h2>Résultats par formation</h2>'+TYPES.map(cat=>{const a=ops.filter(o=>o.category===cat);return '<div class="task-item"><div class="task-content"><strong>'+esc(cat)+'</strong><div class="subtle">'+a.length+' opportunités · '+a.filter(o=>o.stage==="Gagné").length+' gagnées</div></div><strong>'+money(sum(a.filter(o=>o.stage==="Gagné")))+'</strong></div>'}).join("")+'</section>'+
 '<section class="panel"><h2>Bilan partageable</h2><p class="subtle">Données CRM à cet instant. Le CA pondéré est une estimation.</p><button type="button" class="btn primary" data-action="copy-report">Copier le bilan</button></section>';
}

function dashboard(){
const all=scoped(),won=all.filter(o=>o.stage==="Gagné"),lost=all.filter(o=>o.stage==="Perdu"),open=all.filter(isActive),priced=won.filter(known);
const due=data.tasks.filter(t=>t.status==="open"&&t.due&&t.due<=today()).sort((a,b)=>compare(a.due,b.due));
const future=data.tasks.filter(t=>t.status==="open"&&t.due>today()).sort((a,b)=>compare(a.due,b.due));
const dueOpportunities=data.opportunities.filter(o=>isActive(o)&&o.follow&&o.follow<=today()).sort((a,b)=>compare(a.follow,b.follow));
const followRows=dueOpportunities.slice(0,5).map(o=>'<div class="task-item"><div class="task-content"><div class="task-title">Relancer '+esc(contactName(linkedContact(o)))+'</div><div class="task-meta">'+esc(o.training)+' · '+esc(dt(o.follow))+'</div></div><span class="badge '+(o.follow<today()?'late':'today')+'">'+(o.follow<today()?'En retard':"Aujourd’hui")+'</span><button class="btn small" data-action="edit-opportunity" data-id="'+esc(o.id)+'">Ouvrir</button></div>').join("");
const conversion=won.length+lost.length?Math.round(won.length/(won.length+lost.length)*100)+" %":"—";
return `<section class="grid-metrics">
${metric("CA sécurisé",money(sum(won)),won.length+" opportunité(s) gagnée(s)","↗","good")}
${metric("Pipeline en cours",money(sum(open)),open.length+" opportunité(s) active(s)","◉")}
${metric("Montant perdu",money(sum(lost)),lost.length+" opportunité(s) perdue(s)","↘","bad")}
${metric("Panier moyen",priced.length?money(Math.round(sum(priced)/priced.length)):"—",priced.length+" vente(s) chiffrée(s)","◈")}
</section><div class="split"><section class="panel"><div class="row"><h2>Relances et tâches prioritaires</h2><button class="btn small" data-action="nav" data-page="tasks">Toutes les tâches</button></div>
${due.length||dueOpportunities.length?followRows+due.slice(0,7).map(taskRow).join(""):`<div class="empty"><strong>Tout est à jour</strong><p>Aucune tâche en retard ou prévue aujourd'hui.</p><button class="btn" data-action="new-task">Ajouter une tâche</button></div>`}</section>
<section class="panel"><h2>Indicateurs complémentaires</h2><div class="kpi-line"><span>Taux de conversion</span><strong>${conversion}</strong></div><div class="kpi-line"><span>Contacts enregistrés</span><strong>${data.contacts.length}</strong></div><div class="kpi-line"><span>Relances d’opportunités en retard</span><strong>${dueOpportunities.filter(o=>o.follow<today()).length}</strong></div><div class="kpi-line"><span>Tâches en retard</span><strong>${due.filter(t=>t.due<today()).length}</strong></div><div class="kpi-line"><span>Tâches du jour</span><strong>${due.filter(t=>t.due===today()).length}</strong></div><div class="kpi-line"><span>Tâches à venir</span><strong>${future.length}</strong></div><div class="kpi-line"><span>Rendez-vous à venir</span><strong>${future.filter(t=>t.type==="Rendez-vous").length}</strong></div></section></div>`;
}
function board(){
const all=scoped();
return `<div class="board">${STAGES.map(s=>{const list=all.filter(o=>o.stage===s),total=sum(list);return `<section class="lane" data-stage="${esc(s)}"><div class="lane-header"><span class="lane-title">${esc(s)}</span><span class="badge">${list.length}</span></div><div class="amount">${money(total)}</div>${list.map(o=>`<article class="op-card" draggable="true" data-id="${esc(o.id)}" data-action="edit-opportunity" tabindex="0" role="button"><div class="head">${esc(contactName(linkedContact(o)))}</div><p>${esc(o.training)} · ${esc(o.category)}</p><div class="bottom"><strong>${amountText(o)}</strong><span>${o.follow?"↻ "+dt(o.follow):""}</span></div></article>`).join("")}</section>`}).join("")}</div>`;
}
function opportunities(){
const all=scoped().slice().sort((a,b)=>compare(b.created,a.created));
if(!all.length)return `<section class="panel empty"><strong>Aucune opportunité</strong><p>Créez d'abord un contact, puis associez-lui une ou plusieurs opportunités.</p><button class="btn primary" data-action="new-opportunity">Créer une opportunité</button></section>`;
return `<section class="panel"><div class="row"><h2>Opportunités <span class="badge">${all.length}</span></h2></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Contact</th><th>Formation / prestation</th><th>Statut</th><th>Montant</th><th>Relance</th><th></th></tr></thead><tbody>
${all.map(o=>{const c=linkedContact(o);return `<tr data-search="${esc((contactName(c)+" "+(c?.company||"")+" "+o.training+" "+o.stage).toLowerCase())}"><td><div class="person">${esc(contactName(c))}<small>${esc(c?.company||"")}</small></div></td><td>${esc(o.training)}<div class="subtle">${esc(o.category)}</div></td><td>${badge(o.stage)}</td><td><strong>${amountText(o)}</strong></td><td>${dt(o.follow)}</td><td><button class="btn small" data-action="edit-opportunity" data-id="${esc(o.id)}">Ouvrir</button></td></tr>`}).join("")}</tbody></table></div></section>`;
}
function contacts(){
const all=data.contacts.slice().sort((a,b)=>compare(a.last,b.last));
if(!all.length)return `<section class="panel empty"><strong>Aucun contact</strong><p>Créez un contact, puis associez-lui autant de projets que nécessaire.</p><button class="btn primary" data-action="new-contact">Créer un contact</button></section>`;
return `<section class="panel"><div class="row"><h2>Répertoire <span class="badge">${all.length}</span></h2></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Nom</th><th>Entreprise</th><th>Coordonnées</th><th>Profil</th><th>Opportunités</th><th></th></tr></thead><tbody>
${all.map(c=>`<tr data-search="${esc((contactName(c)+" "+c.company+" "+c.email+" "+c.phone).toLowerCase())}"><td><strong>${esc(contactName(c))}</strong></td><td>${esc(c.company)}</td><td>${esc(c.email)}<div class="subtle">${esc(c.phone)}</div></td><td>${esc(c.profile||"—")}</td><td><span class="badge">${data.opportunities.filter(o=>o.contactId===c.id).length}</span></td><td><button class="btn small" data-action="edit-contact" data-id="${esc(c.id)}">Ouvrir</button></td></tr>`).join("")}</tbody></table></div></section>`;
}
function tasks(){
let all=data.tasks.slice().filter(t=>taskMode==="all"||t.status===(taskMode==="open"?"open":"done")).sort((a,b)=>((a.status==="done")-(b.status==="done"))||compare(a.due||"9999",b.due||"9999"));
return `<section class="panel"><div class="row"><h2>Tâches <span class="badge">${all.length}</span></h2><button class="btn small" data-action="new-task">+ Ajouter</button></div>
<div class="stack" style="margin-top:12px">${all.length?all.map(t=>`<div data-search="${esc((t.title+" "+t.notes+" "+taskRelation(t)).toLowerCase())}">${taskRow(t)}</div>`).join(""):`<div class="empty"><strong>Aucune tâche dans cette vue</strong><p>Les nouvelles tâches apparaîtront ici immédiatement après leur enregistrement.</p><button class="btn primary" data-action="new-task">Nouvelle tâche</button></div>`}</div></section>`;
}
function accountPage(){
return `<div class="account-layout"><div id="cloud-live">${window.MOON_CLOUD?.settingsHtml()||""}</div><section class="panel account-help"><h2>Retrouvez MOON sur tous vos ordinateurs</h2><p class="subtle">Utilisez la même adresse email de connexion sur chaque appareil. Vos contacts, opportunités, tâches et échanges sont conservés dans votre compte Supabase.</p><div class="account-steps"><div><strong>01</strong><span>Vos modifications sont regroupées et envoyées automatiquement après une courte pause.</span></div><div><strong>02</strong><span>Attendez l’indication « Synchronisé » avant de fermer ou quitter l’appareil.</span></div><div><strong>03</strong><span>Connectez-vous ailleurs avec le même email : MOON charge vos données.</span></div></div><p class="subtle">En cas de modification simultanée sur deux appareils, MOON bloque le conflit pour protéger les données. Ne remplacez pas une sauvegarde sans vérifier son contenu.</p></section></div>`;
}
function settings(){
return `<div class="settings-layout"><section class="panel"><div class="section-heading"><div><div class="eyebrow">GESTION DES DONNÉES</div><h2>Exports et importations</h2></div><span class="settings-icon">↧</span></div><p class="subtle">Téléchargez une copie de secours ou importez vos fichiers. Les changements importés sont également synchronisés sur votre compte lorsque la connexion est active.</p>
<div class="actions" style="margin-top:18px"><button class="btn primary" data-action="export-json">Télécharger une sauvegarde complète (.json)</button><button class="btn" data-action="import-json">Restaurer une sauvegarde JSON</button><button class="btn" data-action="export-csv">Exporter les opportunités CSV</button><button class="btn" data-action="import-csv">Importer des opportunités CSV</button></div>
<div class="help">MOON utilise une authentification Supabase et des règles de confidentialité par compte. L’utilisation de données professionnelles réelles reste soumise à la validation et aux règles de sécurité de votre organisation.</div>
</section><section class="panel"><div class="section-heading"><div><div class="eyebrow">VOTRE ESPACE</div><h2>Contenu actuel</h2></div><span class="settings-icon">▤</span></div><div class="kpi-line"><span>Contacts</span><strong>${data.contacts.length}</strong></div><div class="kpi-line"><span>Opportunités</span><strong>${data.opportunities.length}</strong></div><div class="kpi-line"><span>Tâches</span><strong>${data.tasks.length}</strong></div><div class="settings-tip">La synchronisation et la déconnexion se gèrent dans <button type="button" class="inline-link" data-action="nav" data-page="account">Mon compte</button>.</div></section></div>`;
}
function modal(title,body){$("modal").innerHTML=`<div class="dialog-head"><h2>${esc(title)}</h2><button type="button" class="btn small ghost" data-action="close-modal" aria-label="Fermer">✕</button></div><div class="dialog-body">${body}</div>`;$("modal").showModal()}
function input(name,label,value="",type="text",required=false,extra=""){return `<label>${esc(label)}<input class="field" name="${name}" type="${type}" value="${esc(value)}" ${required?"required":""} ${extra}></label>`}
function select(name,label,values,value){return `<label>${esc(label)}<select class="field" name="${name}">${opts(values,value)}</select></label>`}
function textarea(name,label,value=""){return `<label class="wide">${esc(label)}<textarea class="field" name="${name}">${esc(value)}</textarea></label>`}
function formFooter(edit,kind){return `<div class="form-footer"><div>${edit?`<button type="button" class="btn danger" data-action="delete-${kind}" data-id="${esc(edit.id)}">Supprimer</button>`:""}</div><div class="actions"><button type="button" class="btn" data-action="close-modal">Annuler</button><button class="btn primary" type="button" data-action="save-${kind}-direct">Enregistrer</button></div></div>`}
function contactModal(c=null){
modal(c?"Fiche contact":"Nouveau contact",`<form id="contact-form"><input type="hidden" name="id" value="${esc(c?.id||"")}"><div class="form-grid">
${input("first","Prénom",c?.first)}${input("last","Nom *",c?.last,"text",true)}
${input("email","Email",c?.email,"email")}${input("phone","Téléphone",c?.phone,"tel")}
${input("company","Entreprise",c?.company)}${select("profile","Profil",["Salarié","Reconversion","Entreprise"],c?.profile||"Salarié")}
${textarea("notes","Notes sur le contact",c?.notes)}
</div><div class="form-footer"><div>${c?`<button type="button" class="btn danger" data-action="delete-contact" data-id="${esc(c.id)}">Supprimer</button>`:""}</div><div class="actions"><button type="button" class="btn" data-action="close-modal">Annuler</button><button type="button" class="btn primary" data-action="save-contact-direct">Enregistrer le contact</button></div></div></form>
${c?contactTimeline(c):""}
${c?`<div class="row" style="margin-top:25px"><h3>Opportunités liées (${data.opportunities.filter(o=>o.contactId===c.id).length})</h3><button class="btn small" data-action="new-task" data-contact-id="${esc(c.id)}">+ Tâche liée</button><button class="btn small" data-action="new-opportunity" data-contact-id="${esc(c.id)}">+ Opportunité</button></div>
${data.opportunities.filter(o=>o.contactId===c.id).map(o=>`<div class="task-item"><div class="task-content"><strong>${esc(o.training)}</strong><div class="subtle">${esc(o.stage)} · ${amountText(o)}</div></div><button class="btn small" data-action="edit-opportunity" data-id="${esc(o.id)}">Ouvrir</button></div>`).join("")}`:""}`);
}
function opportunityModal(o=null,contactId=""){
if(!data.contacts.length){afterContact=true;toast("Créez d'abord le contact à associer");contactModal();return}
const choices=data.contacts.slice().sort((a,b)=>compare(a.last,b.last)).map(c=>`<option value="${esc(c.id)}" ${String(o?.contactId||contactId)===String(c.id)?"selected":""}>${esc(contactName(c))}${c.company?" · "+esc(c.company):""}</option>`).join("");
const moneyInput=known(o||{})?o.ht:"";
const vat=o?.vat??"0";
const vatChoices=["0","5.5","10","20","exempt","custom"];
const vatOptions=vatChoices.map(v=>`<option value="${v}" ${(v==="custom"?!["0","5.5","10","20","exempt"].includes(String(vat)):String(vat)===v)?"selected":""}>${v==="exempt"?"Exonéré":v==="custom"?"Taux personnalisé":v.replace(".",",")+" %"}</option>`).join("");
const customVat=vatChoices.includes(String(vat))?"":vat;
const events=[...(o?.events||[])].reverse();
modal(o?"Modifier l'opportunité":"Nouvelle opportunité",`${o&&suggestedStage(o)?`<div class="panel"><strong>Suggestion MOON</strong><p>Un échange enregistré suggère de passer à « ${esc(suggestedStage(o))} ».</p><button type="button" class="btn primary" data-action="apply-stage-suggestion" data-id="${esc(o.id)}">Valider le changement</button></div>`:""}<form id="opportunity-form"><input type="hidden" name="id" value="${esc(o?.id||"")}"><div class="form-grid">
<label>Contact *<select name="contactId" class="field" required>${choices}</select></label><label>Ajouter un autre contact<button class="btn" type="button" data-action="new-contact-from-op">+ Nouveau contact</button></label>
${input("training","Formation / prestation *",o?.training,"text",true)}
${select("category","Catégorie",TYPES,o?.category||"VAE")}
${select("stage","Étape commerciale",STAGES,o?.stage||"Nouveau")}
<label>Niveau de maturité<select class="field" name="maturity"><option value="">Non renseigné</option>${MATURITIES.filter(Boolean).map(m=>`<option value="${m}" ${o?.maturity===m?"selected":""}>${m}</option>`).join("")}</select></label>
${input("ht","Montant HT (€)",moneyInput,"number",false,'min="0" step="0.01" placeholder="Non renseigné"')}
<label>TVA<select class="field" name="vat">${vatOptions}</select></label>
${input("customVat","Taux personnalisé (%)",customVat,"number",false,'min="0" max="100" step="0.01"')}
${input("follow","Prochaine relance",o?.follow||"","date")}
${input("forecast","Clôture prévisionnelle",o?.forecast||"","date")}
${input("closed","Date de clôture réelle",o?.closed||"","date")}
${input("lostReason","Motif de perte (si perdu)",o?.lostReason)}
${input("source","Origine",o?.source)}
${input("owner","Responsable",o?.owner)}
${textarea("notes","Notes commerciales",o?.notes)}
</div>${formFooter(o,"opportunity")}</form>
${o?`<div class="row" style="margin-top:24px"><h3>Historique des échanges</h3><button class="btn small" data-action="new-task" data-opportunity-id="${esc(o.id)}">+ Tâche liée</button></div>
<form id="interaction-form" data-id="${esc(o.id)}"><div class="form-grid">${select("channel","Canal",CHANNELS,"Appel")}${input("date","Date / heure",new Date().toISOString().slice(0,16),"datetime-local",true)}${textarea("text","Commentaire *","")}</div><div class="form-footer"><span></span><button type="button" data-action="save-interaction-direct" class="btn primary">+ Ajouter un échange</button></div></form>
<div class="timeline">${events.length?events.map(e=>`<div class="timeline-item"><div class="timeline-meta">${esc(e.channel)} · ${fmtDateTime(e.at)}</div><p>${esc(e.text)}</p></div>`).join(""):'<p class="subtle">Aucun échange enregistré.</p>'}</div>`:'<p class="subtle">Enregistrez l’opportunité pour ajouter des échanges et des tâches liées.</p>'}`);
}
function taskLabel(type,opId,contactId){const o=opportunity(opId),c=o?linkedContact(o):contact(contactId);return [type||"Tâche",o?.training||(c?contactName(c):"")].filter(Boolean).join(" - ")}
function taskModal(t=null,opId="",contactId=""){
 const selectedOp=opportunity(t?.opportunityId||opId),selectedContact=selectedOp?.contactId||t?.contactId||contactId;
 const lockedOp=!t&&!!selectedOp,lockedContact=!t&&!lockedOp&&!!selectedContact;
const opChoices=['<option value="">Aucune opportunité</option>',...data.opportunities.map(o=>`<option value="${esc(o.id)}" ${String(selectedOp?.id||"")===String(o.id)?"selected":""}>${esc(o.training)} · ${esc(contactName(linkedContact(o)))}</option>`)].join("");
const cChoices=['<option value="">Aucun contact</option>',...data.contacts.map(c=>`<option value="${esc(c.id)}" ${String(selectedContact||"")===String(c.id)?"selected":""}>${esc(contactName(c))}</option>`)].join("");
modal(t?"Modifier la tâche":"Nouvelle tâche",`<form id="task-form"><input type="hidden" name="id" value="${esc(t?.id||"")}"><div class="form-grid">
<label class="wide">Nom généré automatiquement<output class="field" id="task-auto-title" style="display:block">${esc(taskLabel(t?.type||"Relance",selectedOp?.id||"",selectedContact))}</output></label>
${select("type","Type",["Relance","Appel","Email","Rendez-vous","Administratif","Autre"],t?.type||"Relance")}
${input("due","Date d'échéance *",t?.due||today(),"date",true)}
${select("priority","Priorité",["Normale","Haute","Basse"],t?.priority||"Normale")}
${lockedOp?`<input type="hidden" name="opportunityId" value="${esc(selectedOp.id)}"><input type="hidden" name="contactId" value="${esc(selectedContact)}"><div class="help">Opportunité : ${esc(selectedOp.training)} · Contact : ${esc(contactName(contact(selectedContact)))}</div>`:lockedContact?`<input type="hidden" name="contactId" value="${esc(selectedContact)}"><div class="help">Contact : ${esc(contactName(contact(selectedContact)))}</div><label>Opportunité liée<select class="field" name="opportunityId">${opChoices}</select></label>`:`<label>Opportunité liée<select class="field" name="opportunityId">${opChoices}</select></label><label>Contact lié<select class="field" name="contactId">${cChoices}</select></label>`}
${textarea("notes","Commentaire / détails",t?.notes)}
</div>${formFooter(t,"task")}</form>`);
}
function closeModal(){$("modal").close()}
function markStage(o,newStage,reason=""){
if(o.stage===newStage)return true;
if(newStage==="Perdu"&&!reason&&!o.lostReason){const answer=prompt("Motif de perte (facultatif) :","");if(answer===null)return false;reason=answer}
const old=o.stage;o.stage=newStage;if(reason)o.lostReason=reason;
if(newStage==="Gagné"||newStage==="Perdu"){o.closed=o.closed||today();o.follow=""}
else if(old==="Gagné"||old==="Perdu")o.closed="";
o.events??=[];o.events.push({at:new Date().toISOString(),channel:"Changement de statut",text:old+" → "+newStage});
return true;
}
function contactSubmit(f){
const v=Object.fromEntries(new FormData(f));v.last=v.last.trim();if(!v.last){alert("Le nom est obligatoire.");return}
if(!v.email.trim()&&!v.phone.trim()){alert("Renseignez au moins un email ou un téléphone.");return}
const existing=data.contacts.find(c=>c.id===v.id);
if(existing){Object.assign(existing,{first:v.first.trim(),last:v.last,email:v.email.trim(),phone:v.phone.trim(),company:v.company.trim(),profile:v.profile,notes:v.notes})}
else{const c={id:id(),created:today(),first:v.first.trim(),last:v.last,email:v.email.trim(),phone:v.phone.trim(),company:v.company.trim(),profile:v.profile,notes:v.notes};data.contacts.push(c)}
if(save()){
 const savedId=existing?.id||data.contacts[data.contacts.length-1]?.id;
 const verified=JSON.parse(localStorage.getItem(scopedKey())||"null")?.contacts?.some(c=>c.id===savedId);
 if(!verified){alert("Le contact n'a pas été confirmé dans le stockage local. Le formulaire reste ouvert.");return}
 const openOpportunity=afterContact;afterContact=false;
 page="contacts";closeModal();render();
 toast(existing?"Contact modifié et vérifié":"Contact créé et vérifié dans le répertoire");
 if(openOpportunity)opportunityModal(null,savedId);
}
}
function opportunitySubmit(f){
const v=Object.fromEntries(new FormData(f));v.training=v.training.trim();
if(!v.training||!contact(v.contactId)){alert("Choisissez un contact et renseignez la formation.");return}
if(v.ht!==""&&(!Number.isFinite(Number(v.ht))||Number(v.ht)<0)){alert("Montant HT invalide.");return}
if(v.vat==="custom"){v.vat=v.customVat;if(v.vat===""||!Number.isFinite(Number(v.vat))||Number(v.vat)<0||Number(v.vat)>100){alert("Taux de TVA personnalisé invalide.");return}}
const stage=v.stage,existing=opportunity(v.id);
const record={contactId:v.contactId,training:v.training,category:v.category,maturity:MATURITIES.includes(v.maturity)?v.maturity:"",ht:v.ht,vat:v.vat,follow:v.follow,forecast:v.forecast,closed:v.closed,lostReason:v.lostReason,source:v.source,owner:v.owner,notes:v.notes};let o;
if(existing){o=existing;Object.assign(o,record);if(o.stage!==stage){if(!markStage(o,stage,v.lostReason))return}}
else{o={id:id(),created:today(),events:[],stage:"Nouveau",...record};data.opportunities.push(o);if(stage!=="Nouveau"){if(!markStage(o,stage,v.lostReason)){data.opportunities.pop();return}}}
if(!isActive(o))o.follow="";if((o.stage==="Gagné"||o.stage==="Perdu")&&!o.closed)o.closed=today();
if(save()){
 const verified=JSON.parse(localStorage.getItem(scopedKey())||"null")?.opportunities?.some(x=>x.id===o.id);
 if(!verified){alert("Opportunité non confirmée dans le stockage.");return}
 closeModal();page="opportunities";render();toast("Opportunité enregistrée et vérifiée");
}
}
function taskSubmit(f){
const v=Object.fromEntries(new FormData(f));
if(!v.due){alert("La date d’échéance est obligatoire.");return}
const existing=task(v.id);const op=v.opportunityId?opportunity(v.opportunityId):null;
const contactId=op?.contactId||v.contactId||"";
const values={title:taskLabel(v.type,op?.id||"",contactId),type:v.type,due:v.due,priority:v.priority,opportunityId:op?.id||"",contactId,notes:v.notes};
if(existing)Object.assign(existing,values);else data.tasks.push({id:id(),created:new Date().toISOString(),status:"open",...values});
if(save()){
 const savedId=existing?.id||data.tasks[data.tasks.length-1]?.id;
 const verified=JSON.parse(localStorage.getItem(scopedKey())||"null")?.tasks?.some(x=>x.id===savedId);
 if(!verified){alert("Tâche non confirmée dans le stockage.");return}
 closeModal();page="tasks";taskMode="all";render();toast("Tâche enregistrée et vérifiée");
}
}
function interactionSubmit(f){
const o=opportunity(f.dataset.id);if(!o)return;
const v=Object.fromEntries(new FormData(f));if(!v.text.trim()){alert("Saisissez un commentaire.");return}
o.events??=[];o.events.push({at:new Date(v.date).toISOString(),channel:v.channel,text:v.text.trim()});
if(save()){
 const last=o.events[o.events.length-1];
 const verified=JSON.parse(localStorage.getItem(scopedKey())||"null")?.opportunities?.find(x=>x.id===o.id)?.events?.some(x=>x.at===last.at&&x.text===last.text);
 if(!verified){alert("Échange non confirmé dans le stockage.");return}
 opportunityModal(o);toast(suggestedStage(o)?"Échange enregistré · suggestion de statut disponible en haut de la fiche":"Échange enregistré et vérifié");
}
}
function deleteRecord(kind,entityId){
let item=kind==="contact"?contact(entityId):kind==="opportunity"?opportunity(entityId):task(entityId);
if(!item)return;
if(kind==="contact"&&data.opportunities.some(o=>o.contactId===entityId)){alert("Ce contact possède des opportunités. Supprimez ou réattribuez-les avant de supprimer le contact.");return}
if(!confirm("Supprimer définitivement cet élément ?"))return;
if(kind==="contact")data.contacts=data.contacts.filter(c=>c.id!==entityId);
if(kind==="opportunity"){data.opportunities=data.opportunities.filter(o=>o.id!==entityId);data.tasks.forEach(t=>{if(t.opportunityId===entityId)t.opportunityId=""})}
if(kind==="task")data.tasks=data.tasks.filter(t=>t.id!==entityId);
if(save()){closeModal();render()}
}
function download(filename,text,type){
const blob=new Blob([text],{type});const url=URL.createObjectURL(blob),a=document.createElement("a");
a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
}
function exportJson(){download("moon-sauvegarde-"+today()+".json",JSON.stringify({...data,exportedAt:new Date().toISOString()},null,2),"application/json")}
function csvCell(x){const s=String(x??"");return /[",;\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
function exportCsv(){
const header=["id","prenom","nom","email","telephone","entreprise","formation","categorie","statut","maturite","montant_ht","tva","montant_ttc","relance","cloture_prevue","cloture_reelle","origine","responsable","notes"];
const rows=data.opportunities.map(o=>{const c=linkedContact(o)||{};const rate=o.vat==="exempt"?0:Number(o.vat||0);return [o.id,c.first,c.last,c.email,c.phone,c.company,o.training,o.category,o.stage,o.maturity||"",o.ht,o.vat,known(o)?(Math.round(Math.round(Number(o.ht)*100)*(1+rate/100))/100).toFixed(2):"",o.follow,o.forecast,o.closed,o.source,o.owner,o.notes]});
download("moon-opportunites-"+today()+".csv","\ufeff"+[header,...rows].map(r=>r.map(csvCell).join(";")).join("\r\n"),"text/csv;charset=utf-8");
}
function parseCSV(raw){
let text=raw.replace(/^\ufeff/,"");let first=text.split(/\r?\n/)[0]||"",delimiter=(first.match(/;/g)||[]).length>=(first.match(/,/g)||[]).length?";":",";
let rows=[],row=[],cell="",quote=false;
for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(quote&&text[i+1]==='"'){cell+='"';i++}else quote=!quote}else if(ch===delimiter&&!quote){row.push(cell);cell=""}else if((ch==='\n'||ch==='\r')&&!quote){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x!==""))rows.push(row);row=[];cell=""}else cell+=ch}
row.push(cell);if(row.some(x=>x!==""))rows.push(row);if(!rows.length)return [];
const head=rows.shift().map(x=>x.trim().toLowerCase().replace(/\s+/g,"_"));return rows.map(r=>Object.fromEntries(head.map((h,i)=>[h,r[i]||""])));
}

const importNorm=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase().replace(/\s+/g," ");
const importEmail=v=>String(v??"").trim().toLowerCase();
const importPhone=v=>{let x=String(v??"").replace(/\D/g,"");return x.startsWith("0033")&&x.length===13?"0"+x.slice(4):x.startsWith("33")&&x.length===11?"0"+x.slice(2):x.length===9?"0"+x:x};
const importField=(r,...keys)=>keys.map(k=>r[k]).find(v=>v!==undefined&&v!==null&&String(v).trim()!=="")||"";
function importMatchContact(person,contacts){
 const email=importEmail(person.email),phone=importPhone(person.phone);
 const em=email?contacts.filter(c=>importEmail(c.email)===email):[];
 const ph=phone?contacts.filter(c=>importPhone(c.phone)===phone):[];
 if(em.length>1||ph.length>1||(em.length&&ph.length&&em[0]!==ph[0]))return {ambiguous:true};
 const match=em[0]||ph[0];
 if(match)return email&&importEmail(match.email)&&importEmail(match.email)!==email?{ambiguous:true}:{contact:match};
 const full=importNorm(person.first+" "+person.last),org=importNorm(person.company);
 const byName=full?contacts.filter(c=>importNorm(c.first+" "+c.last)===full&&(!org||!importNorm(c.company)||importNorm(c.company)===org)):[];
 if(byName.length>1)return {ambiguous:true};
 if(byName.length){
  const c=byName[0];
  if((email&&importEmail(c.email)&&importEmail(c.email)!==email)||(phone&&importPhone(c.phone)&&importPhone(c.phone)!==phone))return {ambiguous:true};
  return {contact:c};
 }
 if(!full&&org){
  const byCompany=contacts.filter(c=>!importNorm(c.first)&&importNorm(c.company)===org);
  if(byCompany.length>1)return {ambiguous:true};
  if(byCompany.length)return {contact:byCompany[0]};
 }
 return {contact:null};
}
function planCSVImport(rows){
 const contacts=data.contacts.slice(),ops=data.opportunities.slice(),ids=new Set(ops.map(o=>o.id));
 const accepted=[];let duplicates=0,ambiguous=0,invalid=0;
 for(const r of rows){
  const training=importField(r,"formation","training");
  const p={first:importField(r,"prenom","first"),last:importField(r,"nom","last"),company:importField(r,"entreprise","company"),email:importField(r,"email"),phone:importField(r,"telephone","phone")};
  if(!training||!Object.values(p).some(Boolean)){invalid++;continue}
  if(r.id&&ids.has(r.id)){duplicates++;continue}
  const match=importMatchContact(p,contacts);
  if(match.ambiguous){ambiguous++;continue}
  let c=match.contact;
  if(!c){c={...p,id:"pending-"+contacts.length,created:today(),profile:"Salarié",notes:""};contacts.push(c)}
  // Re-importing the same training for the same person does not create another deal.
  if(ops.some(o=>o.contactId===c.id&&importNorm(o.training)===importNorm(training))){duplicates++;continue}
  accepted.push({r,c,training});ops.push({contactId:c.id,training});
 }
 const newContacts=new Set(accepted.filter(x=>String(x.c.id).startsWith("pending-")).map(x=>x.c.id)).size;
 return {accepted,duplicates,ambiguous,invalid,newContacts};
}
async function importFile(file,kind){
 try{
  const txt=await file.text();
  if(kind==="json"){
   const imported=JSON.parse(txt);
   if(!imported||!Array.isArray(imported.contacts)||!Array.isArray(imported.opportunities)||!Array.isArray(imported.tasks))throw Error("Sauvegarde MOON v2 invalide");
   if(!confirm("Remplacer les données actuelles par "+imported.contacts.length+" contacts, "+imported.opportunities.length+" opportunités et "+imported.tasks.length+" tâches ?"))return;
   const backup=data;data=imported;normalize();if(!save()){data=backup;return}
   render();toast("Sauvegarde restaurée");return;
  }
  const rows=parseCSV(txt);
  if(!rows.length||!Object.keys(rows[0]).some(k=>k==="formation"||k==="training"))throw Error("CSV incompatible : colonne formation manquante");
  const plan=planCSVImport(rows);
  const recap="Import CSV :\n"+plan.accepted.length+" nouvelle(s) opportunité(s)\n"+plan.newContacts+" nouveau(x) contact(s)\n"+plan.duplicates+" doublon(s) ignoré(s)\n"+plan.ambiguous+" fiche(s) ambiguë(s) à vérifier\n"+plan.invalid+" ligne(s) incomplète(s)\n\nAucune fiche existante ne sera modifiée.";
  if(!plan.accepted.length){alert(recap+"\n\nAucune donnée ajoutée.");return}
  if(!confirm(recap+"\n\nImporter uniquement les nouveaux dossiers ?"))return;
  const backup=JSON.stringify(data),created=new Map();
  for(const {r,c,training} of plan.accepted){
   let contactId=c.id;
   if(String(contactId).startsWith("pending-")){
    if(!created.has(contactId)){const fresh={...c,id:id(),last:c.last||c.company||"Contact importé"};data.contacts.push(fresh);created.set(contactId,fresh.id)}
    contactId=created.get(contactId);
   }
   const ht=String(importField(r,"montant_ht")).replace(/\s/g,"").replace(",",".");
   const stage=importField(r,"statut"),maturity=importField(r,"maturite","maturity");
   data.opportunities.push({id:id(),contactId,created:today(),training,
    category:TYPES.includes(r.categorie)?r.categorie:"Autre",stage:STAGES.includes(stage)?stage:"Nouveau",
    maturity:MATURITIES.includes(maturity)?maturity:"",ht:ht!==""&&Number.isFinite(Number(ht))?ht:"",
    vat:importField(r,"tva")||"0",follow:importField(r,"relance"),forecast:importField(r,"cloture_prevue"),
    closed:importField(r,"cloture_reelle"),source:importField(r,"origine"),owner:importField(r,"responsable"),
    notes:importField(r,"notes"),lostReason:"",events:[]});
  }
  if(!save()){data=JSON.parse(backup);normalize();return}
  render();toast(plan.accepted.length+" opportunité(s) ajoutée(s) · "+plan.duplicates+" doublon(s) ignoré(s)");
 }catch(e){alert("Import impossible : "+e.message)}
}
function onClick(e){
const btn=e.target.closest("[data-action]");if(!btn||btn.matches("input[type=checkbox]"))return;
const a=btn.dataset.action,x=btn.dataset.id;
if(["save-contact-direct","save-opportunity-direct","save-task-direct","save-interaction-direct"].includes(a)){
 e.preventDefault();e.stopPropagation();
 const kind=a.slice(5,-7),form=$("modal")?.querySelector("#"+kind+"-form");
 if(!form){alert("Formulaire introuvable. Réessayez.");return}
 if(!form.reportValidity())return;
 try{
  if(kind==="contact")contactSubmit(form);
  else if(kind==="opportunity")opportunitySubmit(form);
  else if(kind==="task")taskSubmit(form);
  else interactionSubmit(form);
 }catch(err){console.error("MOON direct save failure",kind,err);alert("Enregistrement interrompu : "+(err?.message||err))}
 return;
}
if(a==="day-jump"){document.getElementById(btn.dataset.target)?.scrollIntoView({behavior:"smooth",block:"start"});return}
if(a==="natural-search"){naturalQuery=$("natural-query")?.value?.trim()||"";render();return}
if(a==="copy-report"){if(typeof navigator!=="undefined"&&navigator.clipboard?.writeText)navigator.clipboard.writeText(reportText()).then(()=>toast("Bilan copié")).catch(()=>alert(reportText()));else alert(reportText());return}
if(a==="apply-stage-suggestion"){const o=opportunity(x);if(!o)return;const next=suggestedStage(o);if(!next)return;if(!confirm("Passer cette opportunité à « "+next+" » ?"))return;if(markStage(o,next)&&save()){opportunityModal(o);toast("Étape mise à jour et historisée")}return}
if(a.startsWith("cloud-")){window.MOON_CLOUD?.act(a);return}
if(a==="nav"){page=btn.dataset.page==="search"?"opportunities":btn.dataset.page;render();window.MOON_CLOUD?.refreshStatus?.()}
else if(a==="voice-open")window.MOON_VOICE?.open();
else if(a==="new-contact"||a==="new-contact-from-op"){afterContact=a==="new-contact-from-op";contactModal()}
else if(a==="new-opportunity")opportunityModal(null,btn.dataset.contactId||"");
else if(a==="new-task")taskModal(null,btn.dataset.opportunityId||"",btn.dataset.contactId||"");
else if(a==="edit-contact")contactModal(contact(x));
else if(a==="edit-opportunity")opportunityModal(opportunity(x));
else if(a==="edit-task")taskModal(task(x));
else if(a==="delete-contact")deleteRecord("contact",x);
else if(a==="delete-opportunity")deleteRecord("opportunity",x);
else if(a==="delete-task")deleteRecord("task",x);
else if(a==="close-modal")closeModal();
else if(a==="export-json")exportJson();
else if(a==="export-csv")exportCsv();
else if(a==="import-json"||a==="import-csv"){$("file-import").dataset.kind=a==="import-json"?"json":"csv";$("file-import").accept=a==="import-json"?".json":".csv,text/csv";$("file-import").click()}
}
function handleFormSubmit(e){
 const form=e.target;
 if(!["cloud-login-form","contact-form","opportunity-form","task-form","interaction-form"].includes(form?.id))return;
 // Capture-phase cancellation: never allow a CRM form to navigate/reload the page.
 e.preventDefault();
 e.stopPropagation();
 try{
  if(form.id==="cloud-login-form"){window.MOON_CLOUD?.login(form);return}
  if(form.id==="contact-form")contactSubmit(form);
  else if(form.id==="opportunity-form")opportunitySubmit(form);
  else if(form.id==="task-form")taskSubmit(form);
  else interactionSubmit(form);
 }catch(err){
  console.error("MOON submit failure",form.id,err);
  alert("Enregistrement interrompu : "+(err?.message||err)+". Vos données précédentes sont conservées.");
 }
}
function init(){
// Do not load unscoped legacy CRM data before authentication.
if(!window.MOON_CLOUD)load();render();
document.addEventListener("click",onClick);
document.addEventListener("change",e=>{
const t=e.target;
if(t.id==="period"){period=t.value;render()}
else if(t.id==="range-from"){rangeFrom=t.value;render()}
else if(t.id==="range-to"){rangeTo=t.value;render()}
else if(t.id==="tax"){tax=t.value;render()}
else if(t.id==="task-mode"){taskMode=t.value;render()}
else if(t.closest?.("#task-form")&&["type","opportunityId","contactId"].includes(t.name)){const f=t.closest("#task-form"),o=opportunity(f.elements.opportunityId?.value),c=o?.contactId||f.elements.contactId?.value||"";const out=f.querySelector("#task-auto-title");if(out)out.textContent=taskLabel(f.elements.type?.value,o?.id||"",c)}
else if(t.dataset.action==="toggle-task"){const item=task(t.dataset.id);if(item){item.status=t.checked?"done":"open";item.completed=item.status==="done"?new Date().toISOString():"";if(save())render()}}
else if(t.id==="file-import"){const f=t.files?.[0];if(f)importFile(f,t.dataset.kind);t.value=""}
});
document.addEventListener("input",e=>{if(e.target.id==="search"){const term=e.target.value.trim().toLowerCase();document.querySelectorAll("[data-search]").forEach(el=>el.hidden=!el.dataset.search.includes(term))}});
document.addEventListener("submit",handleFormSubmit,true);
let dragged="";
document.addEventListener("dragstart",e=>{const card=e.target.closest(".op-card");if(card){dragged=card.dataset.id;e.dataTransfer.setData("text/plain",dragged);e.dataTransfer.effectAllowed="move"}});
document.addEventListener("dragover",e=>{const lane=e.target.closest(".lane");if(lane){e.preventDefault();lane.classList.add("over")}});
document.addEventListener("dragleave",e=>{const lane=e.target.closest(".lane");if(lane&&!lane.contains(e.relatedTarget))lane.classList.remove("over")});
document.addEventListener("drop",e=>{const lane=e.target.closest(".lane");if(!lane)return;e.preventDefault();document.querySelectorAll(".lane.over").forEach(n=>n.classList.remove("over"));const o=opportunity(e.dataTransfer.getData("text/plain")||dragged);if(o&&markStage(o,lane.dataset.stage)){save();render()}dragged=""});
$("modal").addEventListener("click",e=>{if(e.target===$("modal"))closeModal()});
}

/* Optional Supabase bridge: never uploads without confirmation in cloud.js. */
window.MOON_CLOUD_BRIDGE={
 activate:ownerId=>{
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(ownerId||"")))return false;
  if(activeOwner===ownerId)return true;
  data=emptyCRM();activeOwner=ownerId;page="day";naturalQuery="";
  try{const saved=JSON.parse(localStorage.getItem(scopedKey())||"null");if(saved&&Array.isArray(saved.contacts)&&Array.isArray(saved.opportunities)&&Array.isArray(saved.tasks))data=saved}catch(e){console.error("MOON scoped loading",e)}
  normalize();render();return true;
 },
 ownerId:()=>activeOwner,
 clearSession:(discardSynced=false)=>{
  const key=activeOwner?scopedKey():null;
  data=emptyCRM();activeOwner=null;page="day";naturalQuery="";
  if(discardSynced&&key){try{
   localStorage.removeItem(key);
   // Historical recovery checkpoints are preserved to avoid data loss.
  }catch(e){console.error("MOON account cleanup",e)}}
  const dlg=document.getElementById("modal");if(dlg?.open)dlg.close();if(dlg)dlg.innerHTML="";
  window.MOON_VOICE?.close?.();
  const voice=document.getElementById("voice-modal");if(voice?.open)voice.close();if(voice)voice.innerHTML="";
  const toastNode=document.getElementById("toast");if(toastNode){toastNode.textContent="";toastNode.hidden=true}
  const file=document.getElementById("file-import");if(file)file.value="";
  render();
 },
 show:()=>render(),
 snapshot:()=>JSON.parse(JSON.stringify(data)),
 restore:record=>{
  if(!record||!Array.isArray(record.contacts)||!Array.isArray(record.opportunities)||!Array.isArray(record.tasks))return false;
  const current=JSON.stringify(data),checkpoint=scopedKey()+".precloud."+Date.now();
  try{
   // Stop rather than overwriting without a recovery point.
   localStorage.setItem(checkpoint,current);
   data=JSON.parse(JSON.stringify(record));
   normalize();
   if(!save(false))throw Error("Échec du stockage local");
   render();
   return true;
  }catch(e){
   data=JSON.parse(current);
   try{localStorage.setItem(scopedKey(),current)}catch{}
   console.error("MOON cloud restore",e);
   return false;
  }
 }
};

/* Voice assistant bridge: validate parsed fields and persist only after explicit confirmation. */
function saveVoiceConversation(v){
 const name=String(v.last||"").trim(),email=String(v.email||"").trim(),phone=String(v.phone||"").trim();
 const existing=v.existingContact?contact(v.existingContact):null;
 if(v.existingContact&&!existing)return {ok:false,error:"Contact sélectionné introuvable."};
 if(!existing&&!name)return {ok:false,error:"Indiquez un nom ou sélectionnez un contact existant."};
 if(v.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return {ok:false,error:"Email invalide."};
 if(v.due&&!/^\d{4}-\d{2}-\d{2}$/.test(v.due))return {ok:false,error:"Date de relance invalide."};
 if(!String(v.training||"").trim())return {ok:false,error:"Précisez la formation ou la prestation."};
 const snapshot=JSON.stringify(data);
 try{
  let c=existing;
  if(!c){
   const sameEmail=email&&data.contacts.find(x=>x.email?.trim().toLowerCase()===email.toLowerCase());
   const sameName=data.contacts.filter(x=>x.last?.trim().toLowerCase()===name.toLowerCase()&&(!v.first||x.first?.trim().toLowerCase()===String(v.first).trim().toLowerCase()));
   if(sameEmail)c=sameEmail;
   else if(sameName.length===1)c=sameName[0];
   else if(sameName.length>1)return {ok:false,error:"Plusieurs contacts correspondent : choisissez le bon contact."};
   else{
    c={id:id(),created:today(),first:String(v.first||"").trim(),last:name,email,phone,company:String(v.company||"").trim(),profile:"Salarié",notes:""};
    data.contacts.push(c);
   }
  }
  const training=String(v.training).trim();
  const existingOps=data.opportunities.filter(o=>o.contactId===c.id&&o.training?.trim().toLowerCase()===training.toLowerCase()&&isActive(o));
  if(existingOps.length>1){data=JSON.parse(snapshot);return {ok:false,error:"Plusieurs opportunités actives correspondent : mettez à jour le dossier manuellement pour éviter un doublon."}}
  let o=existingOps[0];
  if(!o){
   o={id:id(),created:today(),contactId:c.id,training,category:TYPES.includes(v.category)?v.category:"Autre",stage:"Nouveau",ht:"",vat:"0",follow:"",forecast:"",closed:"",source:"Assistant vocal",owner:"",notes:"",lostReason:"",events:[]};
   data.opportunities.push(o);
  }
  const note=String(v.summary||v.transcript||"").trim();
  if(note){o.events??=[];o.events.push({at:new Date().toISOString(),channel:"Appel",text:note})}
  if(v.due){
   o.follow=v.due;
   const duplicate=data.tasks.some(t=>t.status!=="done"&&t.opportunityId===o.id&&t.due===v.due&&t.type==="Relance");
   if(!duplicate)data.tasks.push({id:id(),created:new Date().toISOString(),status:"open",title:"Relancer "+contactName(c),type:"Relance",due:v.due,priority:"Normale",opportunityId:o.id,contactId:c.id,notes:"Suite au compte rendu vocal"});
  }
  if(!save()){data=JSON.parse(snapshot);return {ok:false,error:"Enregistrement local impossible."}}
  const verified=JSON.parse(localStorage.getItem(scopedKey())||"null");
  if(!verified?.contacts?.some(x=>x.id===c.id)||!verified?.opportunities?.some(x=>x.id===o.id)){data=JSON.parse(snapshot);return {ok:false,error:"Vérification de sauvegarde échouée."}}
  page="contacts";
  return {ok:true,message:"Échange enregistré : contact, opportunité, historique"+(v.due?" et relance":"")};
 }catch(e){data=JSON.parse(snapshot);console.error("MOON voice conversation",e);return {ok:false,error:"Enregistrement interrompu : "+e.message}}
}
window.MOON_VOICE_BRIDGE={
 saveConversation:saveVoiceConversation,
 contacts:()=>data.contacts.map(c=>({id:c.id,first:c.first,last:c.last,company:c.company})),
 refresh:()=>render(),
 notify:message=>toast(message),
 save(v){
  const kind=v.kind,existing=v.existingContact?contact(v.existingContact):null;
  if(!["contact","opportunity","task"].includes(kind))return {ok:false,error:"Action non reconnue."};
  if(v.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))return {ok:false,error:"Adresse email invalide."};
  if(v.due&&!/^\d{4}-\d{2}-\d{2}$/.test(v.due))return {ok:false,error:"Date invalide."};
  if(v.amount!==""&&(!Number.isFinite(Number(v.amount))||Number(v.amount)<0))return {ok:false,error:"Montant invalide."};
  if(kind!=="task"&&!existing&&!v.last?.trim())return {ok:false,error:"Le nom est obligatoire pour créer un contact."};
  if(kind==="opportunity"&&!existing&&!v.email?.trim()&&!v.phone?.trim())return {ok:false,error:"Pour créer un contact lié à une opportunité, renseignez un email ou un téléphone."};
  if(kind==="opportunity"&&!v.training?.trim())return {ok:false,error:"La formation / prestation est obligatoire."};
  if(kind==="task"&&!v.title?.trim())return {ok:false,error:"L’intitulé de la tâche est obligatoire."};
  if(kind==="task"&&!v.due)return {ok:false,error:"La date d’échéance est obligatoire pour une tâche."};
  let c=existing;
  if(!c&&kind!=="task"){
   const email=v.email?.trim().toLowerCase();
   if(email)c=data.contacts.find(x=>x.email?.trim().toLowerCase()===email);
   if(!c&&v.last?.trim())c=data.contacts.find(x=>x.last?.trim().toLowerCase()===v.last.trim().toLowerCase()&&x.first?.trim().toLowerCase()===(v.first||"").trim().toLowerCase());
   if(!c){c={id:id(),created:today(),first:v.first?.trim()||"",last:v.last.trim(),company:v.company?.trim()||"",email:v.email?.trim()||"",phone:v.phone?.trim()||"",profile:"Salarié",notes:""};data.contacts.push(c)}
  }
  if(kind==="contact"){if(!save())return {ok:false,error:"Enregistrement impossible."};return {ok:true,message:"Contact enregistré : "+contactName(c)}}
  if(kind==="task"){
   const t={id:id(),created:new Date().toISOString(),status:"open",title:v.title.trim(),type:"Relance",due:v.due,priority:"Normale",opportunityId:"",contactId:existing?.id||"",notes:"Ajouté par dictée vocale"};
   data.tasks.push(t);
   if(!save())return {ok:false,error:"Enregistrement impossible."};
   page="tasks";taskMode="all";return {ok:true,message:"Tâche enregistrée : "+t.title};
  }
  const amountKnown=v.amount!=="";
  const amountHT=amountKnown&&v.vatMode==="ht"?v.amount:"";
  const notes=["Créé par dictée vocale."];
  if(amountKnown&&v.vatMode==="ttc")notes.push("Montant annoncé : "+v.amount+" € TTC. HT et TVA à préciser.");
  if(amountKnown&&v.vatMode==="unknown")notes.push("Montant annoncé : "+v.amount+" €. HT/TTC à vérifier.");
  const o={id:id(),created:today(),contactId:c.id,training:v.training.trim(),category:TYPES.includes(v.category)?v.category:"Autre",stage:"Nouveau",ht:amountHT,vat:"0",follow:v.due||"",forecast:"",closed:"",source:"Commande vocale",owner:"",notes:notes.join("\n"),lostReason:"",events:[]};
  data.opportunities.push(o);
  if(v.due)data.tasks.push({id:id(),created:new Date().toISOString(),status:"open",title:"Relancer "+contactName(c),type:"Relance",due:v.due,priority:"Normale",opportunityId:o.id,contactId:c.id,notes:"Créée par dictée vocale"});
  if(!save())return {ok:false,error:"Enregistrement impossible."};
  page="opportunities";
  return {ok:true,message:"Contact, opportunité"+(v.due?" et relance":"")+" enregistrés"};
 }
};

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
