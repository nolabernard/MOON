
"use strict";
const KEY="moon.crm.v2",OLD="moon.crm.v1";
const STAGES=["Nouveau","Contacté","En discussion","RDV / Proposition","Gagné","Perdu"];
const TYPES=["VAE","Formation courte","Autre"];
const CHANNELS=["Appel","Email","SMS","Visioconférence","Rendez-vous","Note"];
let data={version:2,contacts:[],opportunities:[],tasks:[]};
let page="dashboard",period="all",rangeFrom="",rangeTo="",tax="ht",taskMode="open",afterContact=false;
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
data.opportunities=data.opportunities.filter(o=>o&&o.id).map(o=>({...o,stage:STAGES.includes(o.stage)?o.stage:"Nouveau",events:Array.isArray(o.events)?o.events:[],category:o.category||"Autre",vat:o.vat??"0"}));
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
let loaded=false;
try{const s=JSON.parse(localStorage.getItem(KEY)||"null");if(s&&Array.isArray(s.contacts)&&Array.isArray(s.opportunities)&&Array.isArray(s.tasks)){data=s;loaded=true}}catch(e){console.error("MOON loading",e)}
if(!loaded){migrateOld();save(false)}normalize();
}
function save(show=true){
 try{
  const serialized=JSON.stringify(data);
  localStorage.setItem(KEY,serialized);
  if(localStorage.getItem(KEY)!==serialized)throw Error("Vérification du stockage local échouée.");
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
const titles={dashboard:["Tableau de bord","Une vision claire de vos résultats et priorités"],board:["Pipeline commercial","Déplacez les opportunités pour suivre leur progression"],opportunities:["Opportunités","Les projets commerciaux et leurs montants"],contacts:["Contacts","Un contact peut avoir plusieurs opportunités"],tasks:["Tâches & relances","Ajoutez, terminez, modifiez ou supprimez vos actions"],settings:["Réglages & sauvegardes","Conservez vos informations en toute sécurité"]};
const [title,subtitle]=titles[page];
$("app").innerHTML=`<div class="shell"><aside class="sidebar"><div class="brand"><div class="brand-symbol">☾</div><div><strong>MOON</strong><small>ESPI EXECUTIVE</small></div></div><nav aria-label="Navigation principale">
${navButton("dashboard","◫","Accueil")}${navButton("board","▥","Pipeline")}${navButton("opportunities","◇","Opportunités")}${navButton("contacts","♙","Contacts")}${navButton("tasks","☑","Tâches")}${navButton("settings","⚙","Réglages")}
</nav><div class="sidebar-bottom">MOON · Version 3<br>Stockage local avec synchronisation cloud facultative</div></aside>
<div class="main"><div class="topbar"><div><div class="eyebrow">MOON / ${esc(page)}</div><h1>${title}</h1><div class="subtle">${subtitle}</div></div><div class="actions"><button class="btn" data-action="voice-open" type="button">🎙 Dicter</button>
${page==="contacts"?`<button class="btn primary" data-action="new-contact">+ Nouveau contact</button>`:page==="tasks"?`<button class="btn primary" data-action="new-task">+ Nouvelle tâche</button>`:page==="settings"?"":`<button class="btn" data-action="new-task">+ Tâche</button><button class="btn primary" data-action="new-opportunity">+ Opportunité</button>`}</div></div>
${toolbar()}<div id="view">${page==="dashboard"?dashboard():page==="board"?board():page==="opportunities"?opportunities():page==="contacts"?contacts():page==="tasks"?tasks():settings()}</div></div></div>`;
}
function metric(label,value,foot,icon,color=""){return `<div class="metric"><div class="label">${label}<span>${icon}</span></div><div class="number ${color}">${value}</div><div class="foot">${foot}</div></div>`}
function dueClass(t){if(t.status==="done")return "won";if(t.due&&t.due<today())return "late";if(t.due===today())return "today";return ""}
function dueLabel(t){if(t.status==="done")return "Terminée";if(!t.due)return "Sans échéance";if(t.due<today())return "En retard · "+dt(t.due);if(t.due===today())return "Aujourd'hui";return dt(t.due)}
function taskRelation(t){const o=opportunity(t.opportunityId);const c=o?linkedContact(o):contact(t.contactId);return [c?contactName(c):"",o?o.training:""].filter(Boolean).join(" · ")}
function taskRow(t){return `<div class="task-item ${t.status==="done"?"done":""}"><input class="task-check" type="checkbox" aria-label="Terminer ${esc(t.title)}" data-action="toggle-task" data-id="${esc(t.id)}" ${t.status==="done"?"checked":""}>
<div class="task-content"><div class="task-title">${esc(t.title)}</div><div class="task-meta">${esc(t.type||"Tâche")} · ${esc(taskRelation(t))} ${t.notes?"· "+esc(t.notes):""}</div></div><span class="badge ${dueClass(t)}">${esc(dueLabel(t))}</span><div class="task-actions"><button class="btn small" data-action="edit-task" data-id="${esc(t.id)}">Modifier</button><button class="btn small danger" data-action="delete-task" data-id="${esc(t.id)}">Supprimer</button></div></div>`}
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
function settings(){
return `<section class="panel"><h2>Sauvegardes et données</h2><p class="subtle">Les données de MOON sont enregistrées dans ce navigateur. Exportez régulièrement une copie JSON. La sauvegarde Supabase est facultative. Vous pouvez activer la synchronisation automatique après une première sauvegarde manuelle.</p>
<div class="actions" style="margin-top:18px"><button class="btn primary" data-action="export-json">Télécharger une sauvegarde complète (.json)</button><button class="btn" data-action="import-json">Restaurer une sauvegarde JSON</button><button class="btn" data-action="export-csv">Exporter les opportunités CSV</button><button class="btn" data-action="import-csv">Importer des opportunités CSV</button></div>
<div class="help">⚠️ La version GitHub Pages est publique et ne comporte ni authentification ni stockage serveur sécurisé. Utilisez uniquement des données fictives tant que l'usage de données ESPI réelles n'a pas été validé par la DSI.</div>
<div class="kpi-line"><span>Contacts</span><strong>${data.contacts.length}</strong></div><div class="kpi-line"><span>Opportunités</span><strong>${data.opportunities.length}</strong></div><div class="kpi-line"><span>Tâches</span><strong>${data.tasks.length}</strong></div></section><div id="cloud-live">${window.MOON_CLOUD?.settingsHtml()||""}</div>`;
}
function modal(title,body){$("modal").innerHTML=`<div class="dialog-head"><h2>${esc(title)}</h2><button type="button" class="btn small ghost" data-action="close-modal" aria-label="Fermer">✕</button></div><div class="dialog-body">${body}</div>`;$("modal").showModal()}
function input(name,label,value="",type="text",required=false,extra=""){return `<label>${esc(label)}<input class="field" name="${name}" type="${type}" value="${esc(value)}" ${required?"required":""} ${extra}></label>`}
function select(name,label,values,value){return `<label>${esc(label)}<select class="field" name="${name}">${opts(values,value)}</select></label>`}
function textarea(name,label,value=""){return `<label class="wide">${esc(label)}<textarea class="field" name="${name}">${esc(value)}</textarea></label>`}
function formFooter(edit,kind){return `<div class="form-footer"><div>${edit?`<button type="button" class="btn danger" data-action="delete-${kind}" data-id="${esc(edit.id)}">Supprimer</button>`:""}</div><div class="actions"><button type="button" class="btn" data-action="close-modal">Annuler</button><button class="btn primary" type="submit">Enregistrer</button></div></div>`}
function contactModal(c=null){
modal(c?"Fiche contact":"Nouveau contact",`<form id="contact-form"><input type="hidden" name="id" value="${esc(c?.id||"")}"><div class="form-grid">
${input("first","Prénom",c?.first)}${input("last","Nom *",c?.last,"text",true)}
${input("email","Email",c?.email,"email")}${input("phone","Téléphone",c?.phone,"tel")}
${input("company","Entreprise",c?.company)}${select("profile","Profil",["Salarié","Reconversion","Entreprise"],c?.profile||"Salarié")}
${textarea("notes","Notes sur le contact",c?.notes)}
</div>${formFooter(c,"contact")}</form>
${c?`<div class="row" style="margin-top:25px"><h3>Opportunités liées (${data.opportunities.filter(o=>o.contactId===c.id).length})</h3><button class="btn small" data-action="new-opportunity" data-contact-id="${esc(c.id)}">+ Opportunité</button></div>
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
modal(o?"Modifier l'opportunité":"Nouvelle opportunité",`<form id="opportunity-form"><input type="hidden" name="id" value="${esc(o?.id||"")}"><div class="form-grid">
<label>Contact *<select name="contactId" class="field" required>${choices}</select></label><label>Ajouter un autre contact<button class="btn" type="button" data-action="new-contact-from-op">+ Nouveau contact</button></label>
${input("training","Formation / prestation *",o?.training,"text",true)}
${select("category","Catégorie",TYPES,o?.category||"VAE")}
${select("stage","Étape commerciale",STAGES,o?.stage||"Nouveau")}
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
<form id="interaction-form" data-id="${esc(o.id)}"><div class="form-grid">${select("channel","Canal",CHANNELS,"Appel")}${input("date","Date / heure",new Date().toISOString().slice(0,16),"datetime-local",true)}${textarea("text","Commentaire *","")}</div><div class="form-footer"><span></span><button type="submit" class="btn primary">+ Ajouter un échange</button></div></form>
<div class="timeline">${events.length?events.map(e=>`<div class="timeline-item"><div class="timeline-meta">${esc(e.channel)} · ${fmtDateTime(e.at)}</div><p>${esc(e.text)}</p></div>`).join(""):'<p class="subtle">Aucun échange enregistré.</p>'}</div>`:'<p class="subtle">Enregistrez l’opportunité pour ajouter des échanges et des tâches liées.</p>'}`);
}
function taskModal(t=null,opId=""){
const opChoices=['<option value="">Aucune opportunité</option>',...data.opportunities.map(o=>`<option value="${esc(o.id)}" ${String(t?.opportunityId||opId)===String(o.id)?"selected":""}>${esc(o.training)} · ${esc(contactName(linkedContact(o)))}</option>`)].join("");
const cChoices=['<option value="">Aucun contact</option>',...data.contacts.map(c=>`<option value="${esc(c.id)}" ${String(t?.contactId||"")===String(c.id)?"selected":""}>${esc(contactName(c))}</option>`)].join("");
modal(t?"Modifier la tâche":"Nouvelle tâche",`<form id="task-form"><input type="hidden" name="id" value="${esc(t?.id||"")}"><div class="form-grid">
${input("title","Intitulé de la tâche *",t?.title,"text",true)}
${select("type","Type",["Relance","Appel","Email","Rendez-vous","Administratif","Autre"],t?.type||"Relance")}
${input("due","Date d'échéance *",t?.due||today(),"date",true)}
${select("priority","Priorité",["Normale","Haute","Basse"],t?.priority||"Normale")}
<label>Opportunité liée<select class="field" name="opportunityId">${opChoices}</select></label>
<label>Contact lié<select class="field" name="contactId">${cChoices}</select></label>
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
 const verified=JSON.parse(localStorage.getItem(KEY)||"null")?.contacts?.some(c=>c.id===savedId);
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
const record={contactId:v.contactId,training:v.training,category:v.category,ht:v.ht,vat:v.vat,follow:v.follow,forecast:v.forecast,closed:v.closed,lostReason:v.lostReason,source:v.source,owner:v.owner,notes:v.notes};let o;
if(existing){o=existing;Object.assign(o,record);if(o.stage!==stage){if(!markStage(o,stage,v.lostReason))return}}
else{o={id:id(),created:today(),events:[],stage:"Nouveau",...record};data.opportunities.push(o);if(stage!=="Nouveau"){if(!markStage(o,stage,v.lostReason)){data.opportunities.pop();return}}}
if(!isActive(o))o.follow="";if((o.stage==="Gagné"||o.stage==="Perdu")&&!o.closed)o.closed=today();
if(save()){closeModal();render()}
}
function taskSubmit(f){
const v=Object.fromEntries(new FormData(f));v.title=v.title.trim();
if(!v.title||!v.due){alert("Intitulé et échéance obligatoires.");return}
const existing=task(v.id);const op=v.opportunityId?opportunity(v.opportunityId):null;
const values={title:v.title,type:v.type,due:v.due,priority:v.priority,opportunityId:op?.id||"",contactId:op?.contactId||v.contactId,notes:v.notes};
if(existing)Object.assign(existing,values);else data.tasks.push({id:id(),created:new Date().toISOString(),status:"open",...values});
if(save()){closeModal();page="tasks";taskMode="all";render();toast("Tâche enregistrée dans la liste des tâches")}
}
function interactionSubmit(f){
const o=opportunity(f.dataset.id);if(!o)return;
const v=Object.fromEntries(new FormData(f));if(!v.text.trim()){alert("Saisissez un commentaire.");return}
o.events??=[];o.events.push({at:new Date(v.date).toISOString(),channel:v.channel,text:v.text.trim()});
if(save()){opportunityModal(o);toast("Échange ajouté à l'historique")}
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
const header=["id","prenom","nom","email","telephone","entreprise","formation","categorie","statut","montant_ht","tva","montant_ttc","relance","cloture_prevue","cloture_reelle","origine","responsable","notes"];
const rows=data.opportunities.map(o=>{const c=linkedContact(o)||{};const rate=o.vat==="exempt"?0:Number(o.vat||0);return [o.id,c.first,c.last,c.email,c.phone,c.company,o.training,o.category,o.stage,o.ht,o.vat,known(o)?(Math.round(Math.round(Number(o.ht)*100)*(1+rate/100))/100).toFixed(2):"",o.follow,o.forecast,o.closed,o.source,o.owner,o.notes]});
download("moon-opportunites-"+today()+".csv","\ufeff"+[header,...rows].map(r=>r.map(csvCell).join(";")).join("\r\n"),"text/csv;charset=utf-8");
}
function parseCSV(raw){
let text=raw.replace(/^\ufeff/,"");let first=text.split(/\r?\n/)[0]||"",delimiter=(first.match(/;/g)||[]).length>=(first.match(/,/g)||[]).length?";":",";
let rows=[],row=[],cell="",quote=false;
for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(quote&&text[i+1]==='"'){cell+='"';i++}else quote=!quote}else if(ch===delimiter&&!quote){row.push(cell);cell=""}else if((ch==='\n'||ch==='\r')&&!quote){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x!==""))rows.push(row);row=[];cell=""}else cell+=ch}
row.push(cell);if(row.some(x=>x!==""))rows.push(row);if(!rows.length)return [];
const head=rows.shift().map(x=>x.trim().toLowerCase().replace(/\s+/g,"_"));return rows.map(r=>Object.fromEntries(head.map((h,i)=>[h,r[i]||""])));
}
async function importFile(file,kind){
try{
const txt=await file.text();
if(kind==="json"){const imported=JSON.parse(txt);if(!imported||!Array.isArray(imported.contacts)||!Array.isArray(imported.opportunities)||!Array.isArray(imported.tasks))throw Error("Sauvegarde MOON v2 invalide");
if(!confirm(`Remplacer les données actuelles par ${imported.contacts.length} contacts, ${imported.opportunities.length} opportunités et ${imported.tasks.length} tâches ?`))return;
const backup=data;data=imported;normalize();if(!save()){data=backup;return}
}
else{
const rows=parseCSV(txt).filter(r=>r.formation||r.training);
if(!rows.length)throw Error("Fichier CSV sans colonne formation et opportunités");
const signature=(email,first,last,company,training,forecast,ht)=>[
(email||"").trim().toLowerCase()||[first,last,company].join("|").trim().toLowerCase(),
(training||"").trim().toLowerCase(),forecast||"",(ht||"").replace(",",".")
].join("::");
const existingIds=new Set(data.opportunities.map(o=>o.id));
const seen=new Set(data.opportunities.map(o=>{const c=linkedContact(o)||{};return signature(c.email,c.first,c.last,c.company,o.training,o.forecast,String(o.ht??""))}));
const unique=[];let duplicateCount=0;
for(const r of rows){
 const key=signature(r.email,r.prenom||r.first,r.nom||r.last,r.entreprise||r.company,r.formation||r.training,r.cloture_prevue,r.montant_ht||"");
 if((r.id&&existingIds.has(r.id))||seen.has(key)){duplicateCount++;continue}
 seen.add(key);unique.push(r);
}
if(!unique.length){toast("Import ignoré : toutes les opportunités sont déjà présentes.");return}
const columns=Object.keys(rows[0]).join(", ");
if(!confirm("Colonnes détectées : "+columns+"\\n\\nImporter "+unique.length+" opportunité(s) ? "+duplicateCount+" doublon(s) ignoré(s). Les données actuelles seront conservées."))return;
let n=0;
for(const r of unique){const email=r.email||"",last=r.nom||r.last||"",first=r.prenom||r.first||"",company=r.entreprise||r.company||"";
let c=data.contacts.find(x=>email&&x.email?.toLowerCase()===email.toLowerCase());
if(!c)c=data.contacts.find(x=>x.last.toLowerCase()===last.toLowerCase()&&x.first.toLowerCase()===first.toLowerCase()&&x.company.toLowerCase()===company.toLowerCase());
if(!c){c={id:id(),created:today(),first,last:last||company||"Contact importé",email,phone:r.telephone||"",company,profile:"Salarié",notes:""};data.contacts.push(c)}
const ht=(r.montant_ht||"").replace(",",".");data.opportunities.push({id:id(),contactId:c.id,created:today(),training:r.formation||r.training,category:TYPES.includes(r.categorie)?r.categorie:"Autre",stage:STAGES.includes(r.statut)?r.statut:"Nouveau",ht:ht!==""&&!isNaN(Number(ht))?ht:"",vat:r.tva||"0",follow:r.relance||"",forecast:r.cloture_prevue||"",closed:r.cloture_reelle||"",source:r.origine||"",owner:r.responsable||"",notes:r.notes||"",lostReason:"",events:[]});n++}
if(!save())return;toast(n+" opportunité(s) importée(s) · "+duplicateCount+" doublon(s) ignoré(s)");
}
render();if(kind==="json")toast("Sauvegarde restaurée");else toast("Import CSV terminé");
}catch(e){alert("Import impossible : "+e.message)}
}
function onClick(e){
const btn=e.target.closest("[data-action]");if(!btn||btn.matches("input[type=checkbox]"))return;
const a=btn.dataset.action,x=btn.dataset.id;
if(a.startsWith("cloud-")){window.MOON_CLOUD?.act(a);return}
if(a==="nav"){page=btn.dataset.page;render()}
else if(a==="voice-open")window.MOON_VOICE?.open();
else if(a==="new-contact"||a==="new-contact-from-op"){afterContact=a==="new-contact-from-op";contactModal()}
else if(a==="new-opportunity")opportunityModal(null,btn.dataset.contactId||"");
else if(a==="new-task")taskModal(null,btn.dataset.opportunityId||"");
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
load();render();
document.addEventListener("click",onClick);
document.addEventListener("change",e=>{
const t=e.target;
if(t.id==="period"){period=t.value;render()}
else if(t.id==="range-from"){rangeFrom=t.value;render()}
else if(t.id==="range-to"){rangeTo=t.value;render()}
else if(t.id==="tax"){tax=t.value;render()}
else if(t.id==="task-mode"){taskMode=t.value;render()}
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
 snapshot:()=>JSON.parse(JSON.stringify(data)),
 restore:record=>{
  if(!record||!Array.isArray(record.contacts)||!Array.isArray(record.opportunities)||!Array.isArray(record.tasks))return false;
  const current=JSON.stringify(data),checkpoint=KEY+".precloud."+Date.now();
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
   try{localStorage.setItem(KEY,current)}catch{}
   console.error("MOON cloud restore",e);
   return false;
  }
 }
};

/* Voice assistant bridge: validate parsed fields and persist only after explicit confirmation. */
window.MOON_VOICE_BRIDGE={
 contacts:()=>data.contacts.map(c=>({id:c.id,first:c.first,last:c.last,company:c.company})),
 refresh:()=>render(),
 notify:message=>toast(message),
 save(v){
  const kind=v.kind,existing=v.existingContact?contact(v.existingContact):null;
  if(!["contact","opportunity","task"].includes(kind))return {ok:false,error:"Action non reconnue."};
  if(v.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))return {ok:false,error:"Adresse email invalide."};
  if(v.due&&!/^\d{4}-\d{2}-\d{2}$/.test(v.due))return {ok:false,error:"Date invalide."};
  if(v.amount!==""&&(!Number.isFinite(Number(v.amount))||Number(v.amount)<0))return {ok:false,error:"Montant invalide."};
  if(kind!=="task"&&!existing&&(!v.last?.trim()||(!v.email?.trim()&&!v.phone?.trim())))return {ok:false,error:"Pour créer un contact, renseignez le nom et au moins un email ou téléphone."};
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
