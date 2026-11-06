"use strict";
/* MOON cloud sync: account-owned snapshots, automatic sync and conflict protection.
   The publishable key is safe in client JS ONLY with RLS. */
(function(){
 const config=window.MOON_SUPABASE_CONFIG||{};
 const configured=/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.url||"")
   && /^(sb_publishable_|eyJ)/.test(config.publishableKey||"");
 const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 let client=null,user=null,remote=null,busy=false,errorMessage="",notice="",pendingEmail="",accountReady=false,otpRequestedAt=0,otpAttempts=0;
 let explicitLogout=false,initPromise=null,initOwner=null;
 const SYNC_KEY="moon.crm.v2.autosync", BASE_KEY="moon.crm.v2.syncbase";
 let syncTimer=null,syncRunning=false,conflicted=false,syncState="loading",syncError="",syncQueued=false;
 const SYNC_DELAY_MS=1500,FOCUS_CHECK_INTERVAL_MS=30000;
 let lastCloudCheckAt=0,retryTimer=null,retryCount=0;
 const syncKey=()=>SYNC_KEY+"."+(user?.id||"anon");
 const baseKey=()=>BASE_KEY+"."+(user?.id||"anon");
 const enabled=()=>!!user&&localStorage.getItem(syncKey())==="yes";
 const serialize=x=>JSON.stringify(x);
 const local=()=>bridge()?.snapshot();
 const valid=x=>!!x&&Array.isArray(x.contacts)&&Array.isArray(x.opportunities)&&Array.isArray(x.tasks);
 const setState=(state,message="")=>{syncState=state;syncError=message;refreshStatus()};
 function refreshStatus(){
  const label=syncState==="synced"?"Synchronisé":syncState==="saving"?"Synchronisation…":syncState==="pending"?"À synchroniser":syncState==="error"?"Synchronisation en erreur":syncState==="conflict"?"Conflit à résoudre":syncState==="paused"?"Synchronisation en pause":"Connexion…";
  const node=$("sidebar-sync-state");if(node)node.textContent="☁ "+label;
  const top=$("topbar-sync-label");if(top)top.textContent=label;
  for(const item of document.querySelectorAll("[data-sync-indicator]")){item.textContent=label;item.dataset.state=syncState}
  const detail=$("cloud-sync-detail");if(detail)detail.textContent=syncError||"Les changements sont envoyés automatiquement à votre compte.";
 }
 const hasUnsynced=()=>{if(!user||!bridge()?.ownerId?.())return false;const base=JSON.parse(localStorage.getItem(baseKey())||"null");return !base||base.user!==user.id||serialize(local())!==base.content};
 function stopSync(message){localStorage.removeItem(syncKey());conflicted=true;clearTimeout(syncTimer);clearTimeout(retryTimer);syncTimer=null;notice=message||"Synchronisation arrêtée pour éviter une perte de données.";setState("conflict",notice);refresh()}
 function syncFailed(e){setState("error",error(e));errorMessage="Synchronisation temporairement indisponible. Les modifications restent sur cet appareil.";refresh();
  if(!enabled()||conflicted||!user)return;
  clearTimeout(retryTimer);
  const delay=Math.min(60000,3000*Math.pow(2,Math.min(retryCount++,5)));
  retryTimer=setTimeout(()=>{if(document.visibilityState!=="hidden")syncOnce().catch(syncFailed)},delay);
 }
 function syncOnReturn(){if(!enabled()||!user||conflicted||document.visibilityState==="hidden")return;
  if(Date.now()-lastCloudCheckAt<FOCUS_CHECK_INTERVAL_MS)return;
  clearTimeout(syncTimer);syncOnce().catch(syncFailed);
 }
 function scheduleSync(){if(!user||!bridge()?.ownerId?.())return;
  if(!enabled()||conflicted){setState("paused");return}
  if(syncRunning){syncQueued=true;setState("pending");return}
  clearTimeout(syncTimer);setState("pending");syncTimer=setTimeout(()=>syncOnce().catch(syncFailed),SYNC_DELAY_MS)
 }
 async function syncOnce(){
  if(syncRunning||busy||!enabled()||!client||!user||conflicted)return;
  syncRunning=true;
  setState("saving");
  const owner=user.id;
  try{
   const base=JSON.parse(localStorage.getItem(baseKey())||"null");
   if(!base||base.user!==user.id){stopSync("Synchronisation désactivée : appareil non initialisé.");return}
   const current=serialize(local());
   if(!valid(JSON.parse(current)))throw Error("Données CRM invalides : synchronisation interrompue.");
   // Read only revision metadata on ordinary checks: avoid downloading the whole CRM.
   const response=await client.from("moon_snapshots").select("revision,updated_at").eq("owner_id",owner).maybeSingle();
   if(response.error)throw response.error;
   if(user?.id!==owner||bridge()?.ownerId?.()!==owner)return;
   lastCloudCheckAt=Date.now();
   const latest=response.data;
   if(!latest){stopSync("La sauvegarde cloud a disparu : synchronisation arrêtée.");return}
   const dirty=current!==base.content;
   const changed=Number(latest.revision)!==Number(base.revision);
   if(dirty&&changed){stopSync("Conflit entre appareils : vos modifications locales sont conservées. Sauvegardez vos données en JSON puis choisissez la version à conserver.");return}
   if(changed){
     if(serialize(local())!==base.content){stopSync("Modification locale détectée pendant la récupération : synchronisation arrêtée.");return}
     const full=await client.from("moon_snapshots").select("content,revision,updated_at").eq("owner_id",owner).maybeSingle();
     if(full.error)throw full.error;
     if(user?.id!==owner||bridge()?.ownerId?.()!==owner)return;
     if(!full.data||Number(full.data.revision)!==Number(latest.revision)){syncQueued=true;return}
     if(serialize(local())!==base.content){stopSync("Modification locale détectée pendant la récupération : synchronisation arrêtée.");return}
     if(!valid(full.data.content)||!bridge()?.restore(full.data.content)){stopSync("Restauration automatique impossible : données locales conservées.");return}
     localStorage.setItem(baseKey(),serialize({user:owner,revision:full.data.revision,content:serialize(local())}));
     remote=full.data;notice="Modifications récupérées depuis le cloud.";setState("synced");refresh();return;
   }
   if(dirty){
     const outgoing=local();
     const result=await client.from("moon_snapshots").update({content:outgoing,revision:Number(base.revision)+1,updated_at:new Date().toISOString()}).eq("owner_id",user.id).eq("revision",base.revision).select("revision,updated_at").maybeSingle();
     if(result.error)throw result.error;
     if(user?.id!==owner||bridge()?.ownerId?.()!==owner)return;
     if(!result.data){stopSync("Conflit de synchronisation : données locales conservées.");return}
     remote={content:outgoing,revision:result.data.revision,updated_at:result.data.updated_at};
     localStorage.setItem(baseKey(),serialize({user:user.id,revision:result.data.revision,content:serialize(outgoing)}));
     if(serialize(local())!==serialize(outgoing))syncQueued=true;
     notice="Synchronisation automatique effectuée.";setState(syncQueued?"pending":"synced");refresh();
   }
   if(!dirty&&!changed)setState("synced");
   retryCount=0;clearTimeout(retryTimer);
  }finally{syncRunning=false;if(syncQueued){syncQueued=false;setTimeout(scheduleSync,0)}}
 }
 function hasRecords(snapshot){return !!snapshot&&(snapshot.contacts?.length>0||snapshot.opportunities?.length>0||snapshot.tasks?.length>0)}
 async function initializeAccount(){
  const owner=user?.id;
  if(!client||!owner||!bridge())return;
  if(initPromise&&initOwner===owner)return initPromise;
  const work=doInitializeAccount();initPromise=work;initOwner=owner;
  try{return await work}finally{if(initOwner===owner){initPromise=null;initOwner=null}}
 }
 async function doInitializeAccount(){
  if(!client||!user||!bridge())return;
  const owner=user.id;
  if(!bridge()?.activate?.(owner))throw Error("Impossible d’isoler les données de ce compte.");
  const current=local(),latest=await fetchRemote();
  if(user?.id!==owner||bridge()?.ownerId?.()!==owner)return;
  if(!current)return;
  const previous=JSON.parse(localStorage.getItem(baseKey())||"null");
  if(previous?.user===user.id&&enabled()){
    scheduleSync();return;
  }
  if(latest){
    if(serialize(current)===serialize(latest.content)){
      remote=latest;conflicted=false;setBaseline();localStorage.setItem(syncKey(),"yes");
      notice="Compte synchronisé. Vos données sont à jour.";setState("synced");refresh();return;
    }
    if(hasRecords(current)){
      localStorage.removeItem(syncKey());
      notice="Des données existent sur cet appareil et sur votre compte. Pour éviter toute perte, choisissez une version dans Mon compte : restaurer depuis le cloud ou sauvegarder cet appareil.";
      refresh();return;
    }
    if(!bridge()?.restore(latest.content))throw Error("Impossible de charger les données du compte.");
    remote=latest;conflicted=false;setBaseline();localStorage.setItem(syncKey(),"yes");
    notice="Vos données MOON ont été chargées automatiquement depuis votre compte.";setState("synced");refresh();return;
  }
  if(hasRecords(current)){
    localStorage.removeItem(syncKey());
    notice="Votre compte est prêt. Cet appareil contient déjà des données : cliquez sur « Sauvegarder ce navigateur » pour les associer à votre compte.";
    refresh();return;
  }
  const result=await client.from("moon_snapshots").insert({owner_id:user.id,content:current,revision:1}).select("revision,updated_at").single();
  if(user?.id!==owner||bridge()?.ownerId?.()!==owner)return;
  if(result.error){
    if(result.error.code==="23505"){await fetchRemote();notice="Une sauvegarde existe déjà. Actualisez la page pour la récupérer.";refresh();return}
    throw result.error;
  }
  remote={content:current,revision:result.data.revision,updated_at:result.data.updated_at};
  conflicted=false;setBaseline();localStorage.setItem(syncKey(),"yes");
  notice="Votre espace MOON est prêt. La synchronisation est activée.";setState("synced");refresh();
 }
 function setBaseline(){if(!user||!remote)return;localStorage.setItem(baseKey(),serialize({user:user.id,revision:remote.revision,content:serialize(local())}))}
 function startPolling(){
  // No recurring requests while the user is idle. Check when returning to the app.
  window.addEventListener("focus",syncOnReturn);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")syncOnReturn()});
  window.addEventListener("online",()=>{if(enabled()&&user&&!conflicted){clearTimeout(retryTimer);syncOnce().catch(syncFailed)}});
 }
 const $=id=>document.getElementById(id);
 const bridge=()=>window.MOON_CLOUD_BRIDGE;
 function error(e){return String(e?.message||e||"Erreur inconnue")}
 async function init(){
   if(!configured){errorMessage="Connexion indisponible : configuration Supabase manquante.";authScreen();return;}
   if(!window.supabase?.createClient){
     try{
       await new Promise((resolve,reject)=>{
         const script=document.createElement("script");
         script.src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js";
         script.async=true;
         script.onload=resolve;
         script.onerror=()=>reject(new Error("Impossible de charger le SDK Supabase."));
         document.head.appendChild(script);
       });
     }catch(e){errorMessage=error(e);refresh();return}
   }
   if(!window.supabase?.createClient){errorMessage="SDK Supabase non disponible (vérifiez votre connexion ou le bloqueur de scripts).";refresh();return}
   try{
    client=window.supabase.createClient(config.url,config.publishableKey,{
     auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
    const res=await client.auth.getUser();
    if(res.error && !/session.*missing/i.test(error(res.error)))throw res.error;
    user=res.data?.user||null;
    if(user){await initializeAccount();accountReady=true;}
    client.auth.onAuthStateChange((evt,session)=>{
      // Never await a Supabase query inside this callback.
      const priorOwner=user?.id||null,next=session?.user||null;
      if(next?.id===priorOwner&&accountReady){user=next;return}
      if(priorOwner&&priorOwner!==next?.id){
        let synced=false;
        try{const baseline=JSON.parse(localStorage.getItem(BASE_KEY+"."+priorOwner)||"null");synced=!!baseline&&baseline.user===priorOwner&&serialize(local())===baseline.content}catch{}
        bridge()?.clearSession?.(explicitLogout||synced);
      }
      user=next;accountReady=false;remote=null;notice="";conflicted=false;
      if(!user){
        clearTimeout(syncTimer);clearTimeout(retryTimer);retryCount=0;lastCloudCheckAt=0;
        if(priorOwner){localStorage.removeItem(SYNC_KEY+"."+priorOwner);localStorage.removeItem(BASE_KEY+"."+priorOwner)}
        if(!priorOwner)bridge()?.clearSession?.(explicitLogout);
      }
      refresh();
      if(user){const target=user.id;setTimeout(()=>initializeAccount().then(()=>{if(user?.id!==target)return;accountReady=true;refresh()}).catch(e=>{if(user?.id===target){errorMessage=error(e);refresh()}}),0)}
    });
    startPolling();refresh();
   }catch(e){errorMessage=error(e);refresh()}
 }
 function settingsHtml(){
   if(!configured)return '<section class="panel cloud-panel"><h2>☁️ Sauvegarde cloud Supabase</h2><p class="subtle">Intégration prête à configurer. MOON reste en mode local et aucune donnée n’est envoyée en ligne.</p><div class="help">Un projet Supabase gratuit doit être créé et sa clé publique configurée. Les données ESPI réelles restent interdites sans validation DSI.</div></section>';
   let html='<section class="panel cloud-panel"><div class="section-heading"><div><div class="eyebrow">IDENTITÉ ET SYNCHRONISATION</div><h2>Votre compte MOON</h2></div><span class="settings-icon">☁</span></div><p class="subtle">Un compte unique pour retrouver vos contacts, dossiers et tâches sur tous vos appareils.</p>';
   if(!client){html+='<div class="help">Connexion à Supabase en cours…</div>';}
   else if(!user){
     html+='<form id="cloud-login-form"><div class="help">1. Saisissez votre email pour vous connecter. 2. Entrez le code reçu. 3. Vos données se chargent automatiquement sur un nouvel appareil vide.</div><label>Votre email de connexion<input class="field" type="email" name="email" id="cloud-email" autocomplete="email" required placeholder="vous@exemple.fr"></label><div class="actions" style="margin-top:12px"><button class="btn primary" type="submit">Me connecter</button></div></form><p class="subtle">Seuls les comptes autorisés peuvent se connecter.</p>';
   }else{
     const ts=remote?.updated_at?new Date(remote.updated_at).toLocaleString("fr-FR"):"";
     html+='<div class="account-identity"><span class="account-avatar">✦</span><div><span class="subtle">Adresse de connexion</span><strong>'+esc(user.email||user.id)+'</strong></div><span class="account-connected">● Connecté</span></div>';
     html+='<div class="sync-overview"><span>État de la synchronisation</span><strong data-sync-indicator data-state="'+esc(syncState)+'">'+esc(syncState==="synced"?"Synchronisé":syncState==="saving"?"Synchronisation…":syncState==="pending"?"À synchroniser":syncState==="conflict"?"Conflit à résoudre":syncState==="error"?"Synchronisation en erreur":"Connexion…")+'</strong><small id="cloud-sync-detail">'+esc(syncError||"Vos modifications sont envoyées automatiquement.")+'</small></div><p class="subtle">Dernière sauvegarde distante : '+(remote?esc(ts):"en attente")+'</p>';
     html+='<div class="actions account-primary-actions"><button class="btn primary" type="button" data-action="cloud-sync-now">Synchroniser maintenant</button><button class="btn" type="button" data-action="cloud-refresh">Vérifier le cloud</button><button class="btn danger" type="button" data-action="cloud-logout">Se déconnecter</button></div><details class="account-advanced"><summary>Options avancées et récupération</summary><div class="actions"><button class="btn" type="button" data-action="cloud-upload">Remplacer la sauvegarde distante</button><button class="btn" type="button" data-action="cloud-download" '+(remote?"":"disabled")+' >Restaurer la sauvegarde distante</button></div><p class="subtle">Ces opérations peuvent remplacer des données. Une confirmation est demandée avant toute modification.</p></details>';
     html+='<p class="subtle">Synchronisation automatique : <strong>'+(enabled()?"activée":"en pause")+'</strong>. '+(enabled()?"Chaque création ou modification est envoyée automatiquement.":"Réactivez-la après avoir résolu un éventuel conflit.")+'</p>';
     html+='<div class="help">Un téléchargement crée d’abord une copie locale de secours. Une sauvegarde distante existante doit être confirmée avant tout remplacement. Évitez de modifier les mêmes dossiers simultanément sur deux appareils : les conflits sont bloqués, pas fusionnés.</div>';
   }
   if(notice)html+='<p class="subtle" role="status">'+esc(notice)+'</p>';
   if(errorMessage)html+='<div class="help" role="alert">'+esc(errorMessage)+'</div>';
   html+='<div class="help">Vos données sont isolées par compte. Sur un ordinateur partagé, déconnectez-vous avant de partir. Les sauvegardes de récupération locales historiques restent dans le navigateur jusqu’à leur suppression manuelle.</div></section>';
   return html;
 }
 function authScreen(){
  const root=document.getElementById("auth-root");if(!root)return;
  if(user&&accountReady){root.hidden=true;document.body.classList.remove("moon-locked");if(!document.querySelector(".shell"))bridge()?.show?.();return}
  document.body.classList.add("moon-locked");root.hidden=false;
  const form=pendingEmail?'<form id="otp-verify-form"><label>Code reçu sur '+esc(pendingEmail)+'<input class="field otp-code" name="token" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{8}" maxlength="8" placeholder="00000000" required></label><button class="btn primary" type="submit">Se connecter à MOON</button><button class="btn ghost" type="button" id="otp-back">Changer d’adresse</button></form>':'<form id="otp-email-form"><label>Adresse email<input class="field" name="email" type="email" autocomplete="email" placeholder="vous@exemple.fr" required></label><button class="btn primary" type="submit">Recevoir mon code</button></form>';
  root.innerHTML='<div class="auth-card"><div class="auth-brand"><span class="brand-symbol">☾</span><strong>MOON</strong></div><h1>Votre espace commercial.</h1><p>Connectez-vous pour retrouver vos contacts, dossiers et relances sur tous vos appareils.</p>'+form+(busy?'<p role="status">Veuillez patienter…</p>':'')+(notice?'<p class="auth-notice" role="status">'+esc(notice)+'</p>':'')+(errorMessage?'<p class="auth-error" role="alert">'+esc(errorMessage)+'</p>':'')+'<small>Connexion sécurisée par code unique à 8 chiffres. Aucun mot de passe.</small></div>';
  root.querySelector("#otp-email-form")?.addEventListener("submit",async e=>{e.preventDefault();await login(e.target)});
  root.querySelector("#otp-verify-form")?.addEventListener("submit",async e=>{e.preventDefault();await verifyCode(e.target)});
  root.querySelector("#otp-back")?.addEventListener("click",()=>{pendingEmail="";otpRequestedAt=0;otpAttempts=0;notice="";errorMessage="";authScreen()});
 }
 async function verifyCode(form){
  if(!client||busy||!pendingEmail)return;
  const token=String(new FormData(form).get("token")||"").trim();
  if(!/^[0-9]{8}$/.test(token)){errorMessage="Saisissez les 8 chiffres du code.";authScreen();return}
  if(otpRequestedAt&&Date.now()-otpRequestedAt>600000){pendingEmail="";errorMessage="Le code a expiré. Demandez un nouveau code.";authScreen();return}
  if(otpAttempts>=5){pendingEmail="";errorMessage="Trop de tentatives. Demandez un nouveau code.";authScreen();return}
  otpAttempts++;
  busy=true;errorMessage="";notice="";authScreen();
  try{const r=await client.auth.verifyOtp({email:pendingEmail,token,type:"email"});if(r.error)throw r.error;if(!r.data?.user)throw Error("Connexion non confirmée.");pendingEmail="";user=r.data.user;await initializeAccount();accountReady=true;authScreen()}
  catch(e){errorMessage=error(e)}
  finally{busy=false;authScreen()}
 }
 function refresh(){authScreen();if(document.getElementById("cloud-live"))$("cloud-live").innerHTML=settingsHtml();refreshStatus()}
 async function fetchRemote(){
   if(!client||!user)return;
   const owner=user.id;
   const r=await client.from("moon_snapshots").select("content,revision,updated_at").eq("owner_id",owner).maybeSingle();
   if(r.error)throw r.error;
   if(user?.id!==owner||bridge()?.ownerId?.()!==owner)return null;
   remote=r.data||null;
   refresh();
   return remote;
 }
 async function act(action){
   if(busy)return;
   if(action==="cloud-auto-toggle"){
     if(enabled()){localStorage.removeItem(syncKey());clearTimeout(syncTimer);notice="Synchronisation automatique désactivée.";refresh();return}
     if(!client||!user||!remote){errorMessage="Effectuez d’abord une sauvegarde manuelle.";refresh();return}
     const latest=await fetchRemote().catch(e=>{errorMessage=error(e);return null});
     if(!latest){refresh();return}
     if(serialize(latest.content)!==serialize(local())){errorMessage="Les versions locale et distante diffèrent. Sauvegardez ou restaurez manuellement avant d’activer la synchronisation.";refresh();return}
     if(!confirm("Activer la synchronisation automatique sur CET appareil ? Les modifications seront envoyées à Supabase et les changements d’autres appareils seront récupérés. En cas de conflit, la synchronisation s’arrête sans écraser vos données."))return;
     conflicted=false;remote=latest;setBaseline();localStorage.setItem(syncKey(),"yes");notice="Synchronisation automatique activée.";refresh();return;
   }
   if(action==="cloud-sync-now"){if(!enabled()){errorMessage="La synchronisation est en pause. Résolvez le conflit ou restaurez la sauvegarde distante.";refresh();return}try{clearTimeout(syncTimer);await syncOnce();notice=syncState==="synced"?"Tout est synchronisé.":"Synchronisation demandée.";errorMessage="";}catch(e){syncFailed(e)}refresh();return}
   if(action==="cloud-refresh"){try{await syncOnce();notice="État actualisé.";errorMessage="";}catch(e){syncFailed(e)}refresh();return}
   if(action==="cloud-logout"){if(hasUnsynced()&&enabled()){try{clearTimeout(syncTimer);await syncOnce()}catch(e){setState("error",error(e))}}const baseline=JSON.parse(localStorage.getItem(baseKey())||"null");if(!baseline||serialize(local())!==baseline.content){errorMessage="Des modifications ne sont pas encore confirmées dans le cloud. Attendez la synchronisation ou exportez une sauvegarde JSON avant de vous déconnecter.";refresh();return}busy=true;explicitLogout=true;const owner=user.id;let loggedOut=false;try{const r=await client.auth.signOut();if(r.error)throw r.error;loggedOut=true;user=null;remote=null;notice="Déconnecté.";errorMessage="";}catch(e){errorMessage=error(e)}finally{if(loggedOut&&bridge()?.ownerId?.()===owner)bridge()?.clearSession?.(true);explicitLogout=false;busy=false;refresh()}return}
   if(!client||!user)return;
   const ui=bridge();if(!ui)return;
   const actionOwner=user.id;
   if(ui.ownerId?.()!==actionOwner){errorMessage="Compte local non initialisé.";refresh();return}
   busy=true;errorMessage="";notice="";
   try{
     if(action==="cloud-upload"){
       if(!confirm("Sauvegarder la copie locale actuelle dans votre espace Supabase ? Cette action transmet le contenu du CRM au fournisseur et peut remplacer votre précédente sauvegarde distante."))return;
       // Local data are never uploaded at sign-in. Require explicit confirmation.
       const content=ui.snapshot();
       if(!Array.isArray(content.contacts)||!Array.isArray(content.opportunities)||!Array.isArray(content.tasks))throw Error("Données locales invalides.");
       const latest=await fetchRemote();
       if(user?.id!==actionOwner||ui.ownerId?.()!==actionOwner)throw Error("Le compte a changé. Recommencez la sauvegarde.");
       if(latest&&!confirm("Une sauvegarde distante existe déjà (révision "+latest.revision+"). Voulez-vous vraiment la remplacer par les données de CE navigateur ?"))return;
       let result;
       if(latest)result=await client.from("moon_snapshots")
        .update({content,revision:Number(latest.revision)+1,updated_at:new Date().toISOString()})
        .eq("owner_id",actionOwner).eq("revision",latest.revision).select("revision,updated_at").maybeSingle();
       else result=await client.from("moon_snapshots")
        .insert({owner_id:actionOwner,content,revision:1}).select("revision,updated_at").single();
       if(result.error)throw result.error;
       if(!result.data)throw Error("Conflit : une autre copie a été sauvegardée entretemps. Actualisez et recommencez.");
       remote={content,revision:result.data.revision,updated_at:result.data.updated_at};
       conflicted=false;setBaseline();localStorage.setItem(syncKey(),"yes");scheduleSync();
       setState("synced");notice="Sauvegarde cloud effectuée. Synchronisation automatique activée.";
     }else if(action==="cloud-download"){
       const latest=await fetchRemote();
       if(!latest)throw Error("Aucune sauvegarde distante trouvée.");
       const counts=[latest.content?.contacts?.length||0,latest.content?.opportunities?.length||0,latest.content?.tasks?.length||0];
       if(!confirm("Restaurer "+counts[0]+" contacts, "+counts[1]+" opportunités et "+counts[2]+" tâches depuis Supabase ? La copie actuelle du navigateur sera d’abord conservée en secours local."))return;
       if(user?.id!==actionOwner||ui.ownerId?.()!==actionOwner)throw Error("Le compte a changé. Recommencez la restauration.");
     if(!ui.restore(latest.content))throw Error("Impossible de restaurer les données du serveur.");
       conflicted=false;setBaseline();localStorage.setItem(syncKey(),"yes");
       setState("synced");notice="Données du compte chargées. Synchronisation automatique activée. Copie locale précédente conservée en secours.";
     }
   }catch(e){errorMessage=error(e);if(/duplicate key/i.test(errorMessage))errorMessage="Une sauvegarde distante existe déjà. Actualisez avant de recommencer."}
   finally{busy=false;refresh()}
 }
 async function login(form){
   if(!client)return;
   if(busy)return;
   busy=true;errorMessage="";notice="";
   try{
     const email=String(new FormData(form).get("email")||"").trim().toLowerCase();
     if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error("Adresse email invalide.");
     const redirect=location.origin+location.pathname;
     const r=await client.auth.signInWithOtp({email,options:{emailRedirectTo:redirect,shouldCreateUser:false}});
     if(r.error && !/user not found|signups not allowed|signup disabled|email not confirmed/i.test(error(r.error)))throw r.error;
     pendingEmail=email;otpRequestedAt=Date.now();otpAttempts=0;notice="Si ce compte existe, un code de connexion sera envoyé. Vérifiez votre boîte email.";
   }catch(e){errorMessage=error(e)}finally{busy=false;refresh()}
 }
 window.MOON_CLOUD={settingsHtml,act,login,verifyCode,init,configured,onLocalSave:scheduleSync,refreshStatus,isAuthenticated:()=>!!user&&accountReady};
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
 else init();
})();