"use strict";
/* MOON visitor links: anonymous, revocable, read-only snapshots over a secured Edge Function.
   Bearer tokens live only in URL fragments and volatile memory, never in localStorage. */
(function(){
 const config=window.MOON_SUPABASE_CONFIG||{};
 const hash=new URLSearchParams(location.hash.replace(/^#/,""));
 const token=hash.has("visit")?hash.get("visit"):"";
 const visitor=hash.has("visit");
 const ENDPOINT=(config.url||"")+"/functions/v1/moon-visitor-access";
 const SECTIONS=[["day","Ma journée"],["dashboard","Tableau de bord"],["board","Pipeline commercial"],["opportunities","Opportunités"],["contacts","Contacts"],["tasks","Tâches"],["reporting","Reporting"]];
 const PAGES=new Set([...SECTIONS.map(x=>x[0]),"opportunity-detail"]);
 let allowedSections=SECTIONS.map(x=>x[0]),permissionsVersion=0,editingLink=null;
 const $=id=>document.getElementById(id);
 const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 let ready=false,invalid=false,revision=null,lastSuccess=0,pending=false,refreshTimer=null,status="Consultation sécurisée";
 let links=[],linksLoaded=false,linksLoading=false,linksUpdatedAt=0,createdLink="",adminError="",adminMessage="",adminBusy=false;
 function isVisitor(){return visitor}
 function isVisitorReady(){return visitor&&ready&&!invalid}
 function pageAllowed(key){return PAGES.has(key)&&(key==="opportunity-detail"?(allowedSections.includes("board")||allowedSections.includes("opportunities")):allowedSections.includes(key))}
 function labelStatus(message){
  status=message;
  const el=$("visitor-live-status");if(el)el.textContent=message;
  const side=$("sidebar-sync-state");if(side&&visitor)side.textContent="◉ "+message;
 }
 function lockScreen(message){
  document.body.classList.add("moon-locked","moon-visitor");
  const root=$("auth-root");if(root){root.hidden=false;root.innerHTML='<div class="auth-card"><div class="auth-brand">☾ MOON</div><h1>Consultation en lecture seule</h1><p>'+esc(message)+'</p><small>Aucun compte visiteur n’est nécessaire.</small></div>'}
 }
 function unlockScreen(){
  const root=$("auth-root");if(root)root.hidden=true;
  document.body.classList.remove("moon-locked");
  document.body.classList.add("moon-visitor");
 }
 async function call(action,fields={},jwt=""){
  const response=await fetch(ENDPOINT,{
   method:"POST",mode:"cors",cache:"no-store",credentials:"omit",
   headers:{"Content-Type":"application/json","apikey":config.publishableKey||"",...(jwt?{"Authorization":"Bearer "+jwt}:{})},
   body:JSON.stringify({action,...fields})
  });
  const body=await response.json().catch(()=>({error:"Réponse inattendue du serveur."}));
  if(!response.ok||!body.ok){const e=new Error(body.error||"Service indisponible.");e.status=response.status;throw e}
  return body;
 }
 function forgetVisitor(message){
  ready=false;revision=null;invalid=true;
  window.MOON_CLOUD_BRIDGE?.visitorClear?.();
  lockScreen(message);
 }
 async function refreshVisitor(){
  if(!visitor||pending||invalid||document.hidden)return;
  pending=true;
  try{
   const result=await call("read",{token,knownRevision:revision,knownPermissionsVersion:permissionsVersion});
   lastSuccess=Date.now();invalid=false;
   if(Array.isArray(result.allowedSections)){allowedSections=result.allowedSections.filter(x=>PAGES.has(x));permissionsVersion=result.permissionsVersion||1}
   if(!result.unchanged){
    const c=result.content;
    if(!c||!Array.isArray(c.contacts)||!Array.isArray(c.opportunities)||!Array.isArray(c.tasks))
     throw new Error("Le contenu reçu est invalide.");
    revision=result.revision;
    ready=true;unlockScreen();
    if(!window.MOON_CLOUD_BRIDGE?.visitorLoad?.(c)){ready=false;throw new Error("Impossible d'afficher les données.");}
   }else if(!ready){
    // Never show stale data when the server unexpectedly returns unchanged before first load.
    revision=null;throw new Error("Chargement incomplet.");
   }
   if(!pageAllowed(window.MOON_CLOUD_BRIDGE?.visitorPage?.()||"day"))window.MOON_CLOUD_BRIDGE?.visitorNavigate?.(allowedSections[0]||"day");
   labelStatus("Lecture seule · à jour");
  }catch(err){
   if([401,403,404,410].includes(err.status)){forgetVisitor(err.message||"Ce lien n'est plus disponible.");return}
   labelStatus("Connexion interrompue · nouvel essai automatique");
   if(!ready||Date.now()-lastSuccess>180000){
    ready=false;revision=null;
    window.MOON_CLOUD_BRIDGE?.visitorClear?.();
    lockScreen("Connexion momentanément indisponible. Nouvelle tentative automatique dans quelques secondes.");
   }
  }finally{pending=false}
 }
 function start(){
  if(!visitor)return;
  document.body.classList.add("moon-visitor");
  lockScreen("Vérification de votre lien privé…");
  if(!/^v1_[A-Za-z0-9_-]{43}$/.test(token||"")){forgetVisitor("Ce lien visiteur est invalide.");return}
  refreshVisitor();
  refreshTimer=setInterval(()=>{if(!document.hidden)refreshVisitor()},60000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)refreshVisitor()});
  window.addEventListener("focus",()=>refreshVisitor());
  window.addEventListener("online",()=>refreshVisitor());
 }
 function permissionCheckboxes(selected,prefix){return '<div class="visitor-permissions"><strong>Rubriques autorisées</strong><div class="visitor-permissions-grid">'+SECTIONS.map(([id,label])=>'<label class="visitor-permission"><input type="checkbox" data-visitor-permission="'+prefix+'" value="'+id+'" '+(selected.includes(id)?"checked":"")+'>'+esc(label)+'</label>').join("")+'</div><small class="subtle">Mon compte et Paramètres restent privés. Au moins une rubrique requise.</small></div>'}
 function selectedPermissions(prefix){return Array.from(document.querySelectorAll('[data-visitor-permission="'+prefix+'"]:checked')).map(el=>el.value)}
 function adminHtml(){
  const rows=links.map(l=>{
   const active=!l.revoked_at&&(!l.expires_at||new Date(l.expires_at)>new Date());
   return '<div class="visitor-link-row"><div><strong>'+esc(l.label)+'</strong><small>'+esc(new Date(l.created_at).toLocaleDateString("fr-FR"))+' · '+(active?"Actif":"Désactivé")+' · '+esc((l.allowed_sections||SECTIONS.map(x=>x[0])).map(k=>SECTIONS.find(x=>x[0]===k)?.[1]||k).join(", "))+'</small></div>'+(active?'<div class="actions"><button type="button" class="btn small" data-action="visitor-edit" data-id="'+esc(l.id)+'">Modifier les accès</button><button type="button" class="btn small" data-action="visitor-recover" data-id="'+esc(l.id)+'" data-legacy="'+(!l.recoverable)+'">'+(l.recoverable?"Copier":"Renouveler et copier")+'</button><button type="button" class="btn small danger" data-action="visitor-revoke" data-id="'+esc(l.id)+'">Désactiver</button></div>':'<div class="actions"><span class="subtle">Accès coupé</span><button type="button" class="btn small danger" data-action="visitor-delete" data-id="'+esc(l.id)+'">Supprimer</button></div>')+'</div>'+(editingLink===l.id&&active?'<div class="visitor-edit-panel">'+permissionCheckboxes(l.allowed_sections||SECTIONS.map(x=>x[0]),"edit")+'<button type="button" class="btn primary small" data-action="visitor-save" data-id="'+esc(l.id)+'">Enregistrer les accès</button><button type="button" class="btn small" data-action="visitor-cancel">Annuler</button></div>':"");
  }).join("");
  return '<section id="visitor-management" class="panel visitor-management"><div class="section-heading"><div><div class="eyebrow">PARTAGE SÉCURISÉ</div><h2>Accès visiteurs</h2></div><span class="settings-icon">◉</span></div>'+
  '<p class="subtle">Créez un lien privé pour consulter toutes les données de MOON, sauf Mon compte et Paramètres. Accès sans connexion, lecture seule, mise à jour automatique toutes les 60 secondes.</p>'+
  '<div class="visitor-create"><label>Nom du lien (pour vous repérer)<input id="visitor-link-label" class="field" maxlength="100" autocomplete="off" placeholder="Ex. Direction, collaborateur, partenaire"></label>'+permissionCheckboxes(SECTIONS.map(x=>x[0]),"create")+'<button type="button" class="btn primary" data-action="visitor-create" '+(adminBusy?"disabled":"")+'>Générer un lien privé</button></div>'+
  (createdLink?'<div class="visitor-created"><strong>Lien visiteur prêt à partager</strong><p class="subtle">Vous pourrez retrouver ce lien à tout moment avec le bouton Copier de la liste.</p><div class="visitor-url"><input id="visitor-created-url" class="field" readonly aria-label="Nouveau lien visiteur" value="'+esc(createdLink)+'"><button class="btn primary" type="button" data-action="visitor-copy">Copier</button></div></div>':"")+
  (adminError?'<p role="alert" class="auth-error">'+esc(adminError)+'</p>':"")+
  (adminMessage?'<p role="status" class="subtle">'+esc(adminMessage)+'</p>':"")+
  '<div class="row"><h3>Liens générés</h3><button class="btn small" type="button" data-action="visitor-list" '+(adminBusy?"disabled":"")+'>Actualiser</button></div>'+
  (linksLoading?'<p class="subtle">Chargement des liens…</p>':linksLoaded?(rows||'<p class="subtle">Aucun lien visiteur généré.</p>'):'<p class="subtle">Les liens seront affichés ici.</p>')+
  '<p class="subtle">Un lien donne accès aux coordonnées et aux historiques commerciaux : partagez-le uniquement avec des personnes de confiance.</p></section>';
 }
 function updateAdmin(){
  const node=$("visitor-management");if(node)node.outerHTML=adminHtml();
 }
 async function ownerJwt(){
  const jwt=await window.MOON_CLOUD?.getAccessToken?.();
  if(!jwt)throw new Error("Connectez-vous à votre compte MOON pour gérer les liens visiteurs.");
  return jwt;
 }
 async function maybeLoadAdminLinks(force=false){
  if(visitor||linksLoading||adminBusy)return;
  if(!force&&linksLoaded&&Date.now()-linksUpdatedAt<60000)return;
  linksLoading=true;updateAdmin();
  try{
   const jwt=await ownerJwt();
   const res=await call("list",{},jwt);
   links=res.links||[];linksLoaded=true;linksUpdatedAt=Date.now();adminError="";
  }catch(e){adminError=e.message||"Impossible de charger les liens."}
  finally{linksLoading=false;updateAdmin()}
 }
 async function adminAction(action,btn){
  if(visitor||adminBusy)return;
  if(action==="visitor-copy"){
   if(!createdLink)return;
   try{await navigator.clipboard.writeText(createdLink);adminMessage="Lien copié dans le presse-papiers.";adminError=""}
   catch(e){const inp=$("visitor-created-url");inp?.focus();inp?.select();adminMessage="Sélectionnez et copiez le lien affiché."}
   updateAdmin();return;
  }
  if(action==="visitor-recover"&&btn.dataset.legacy==="true"&&!confirm("Ce lien ancien ne peut pas être récupéré. Le renouveler désactivera son ancienne adresse. Continuer ?"))return;
  if(action==="visitor-edit"){editingLink=btn.dataset.id;updateAdmin();return}
  if(action==="visitor-cancel"){editingLink=null;updateAdmin();return}
  if(action==="visitor-list"){await maybeLoadAdminLinks(true);return}
  const label=String($("visitor-link-label")?.value||"").trim();
  if(action==="visitor-create"&&(!label||label.length>100)){adminError="Indiquez un nom pour identifier ce lien.";updateAdmin();return}
  if(["visitor-create","visitor-save"].includes(action)&&!selectedPermissions(action==="visitor-create"?"create":"edit").length){adminError="Sélectionnez au moins une rubrique.";updateAdmin();return}
  const requestedSections=["visitor-create","visitor-save"].includes(action)?selectedPermissions(action==="visitor-create"?"create":"edit"):null;
  if(action==="visitor-delete"&&!confirm("Supprimer définitivement ce lien désactivé de la liste ? Cette action est irréversible et ne supprime aucune donnée CRM."))return;
  if(action==="visitor-revoke"&&!confirm("Désactiver définitivement ce lien ? Ses visiteurs perdront l'accès lors de leur prochaine vérification."))return;
  adminBusy=true;adminError="";adminMessage="";updateAdmin();
  try{
   const jwt=await ownerJwt();
   if(action==="visitor-create"){
    const response=await call("create",{label,allowedSections:requestedSections},jwt);
    const base=location.origin+location.pathname;
    createdLink=base+"#visit="+encodeURIComponent(response.token);
    adminMessage="Lien actif. Copiez-le et transmettez-le à votre visiteur.";
   }else if(action==="visitor-save"){
    await call("update",{id:btn.dataset.id,allowedSections:requestedSections},jwt);
    editingLink=null;adminMessage="Accès mis à jour. Le visiteur verra les changements lors de sa prochaine actualisation.";
   }else if(action==="visitor-recover"){
    const response=await call("recover",{id:btn.dataset.id},jwt);
    const base=location.origin+location.pathname;
    createdLink=base+"#visit="+encodeURIComponent(response.token);
    try{
     await navigator.clipboard.writeText(createdLink);
     adminMessage=response.rotated?"Nouveau lien copié. L'ancien lien n'est plus valide.":"Lien visiteur copié dans le presse-papiers.";
    }catch(e){
     adminMessage=response.rotated?"Nouveau lien généré : copiez-le ci-dessous. L'ancien lien n'est plus valide.":"Lien retrouvé : sélectionnez-le et copiez-le ci-dessous.";
    }
   }else if(action==="visitor-delete"){
    const response=await call("delete",{id:btn.dataset.id},jwt);
    if(!response.deleted)throw new Error("Ce lien n'est plus disponible ou n'est pas désactivé.");
    if(editingLink===btn.dataset.id)editingLink=null;
    adminMessage="Lien supprimé définitivement de la liste. Vos données CRM sont conservées.";
   }else if(action==="visitor-revoke"){
    await call("revoke",{id:btn.dataset.id},jwt);
    adminMessage="Lien désactivé. Le visiteur n'aura plus accès aux données.";
   }
   const list=await call("list",{},jwt);links=list.links||[];linksLoaded=true;linksUpdatedAt=Date.now();
  }catch(e){adminError=e.message||"Opération impossible."}
  finally{adminBusy=false;updateAdmin()}
 }
 window.MOON_VISITOR={
  isVisitor,isVisitorReady,pageAllowed,adminHtml,adminAction,maybeLoadAdminLinks,
  refresh:refreshVisitor,status:()=>status
 };
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);
 else start();
})();
