"use strict";
/* MOON cloud sync: explicit backup/restore only; opt-in, never silently uploads
   local CRM data. The publishable key is safe in client JS ONLY with RLS. */
(function(){
 const config=window.MOON_SUPABASE_CONFIG||{};
 const configured=/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.url||"")
   && /^(sb_publishable_|eyJ)/.test(config.publishableKey||"");
 const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 let client=null,user=null,remote=null,busy=false,errorMessage="",notice="",pendingEmail="";
 const SYNC_KEY="moon.crm.v2.autosync", BASE_KEY="moon.crm.v2.syncbase";
 let syncTimer=null,syncRunning=false,conflicted=false;
 const enabled=()=>localStorage.getItem(SYNC_KEY)==="yes";
 const serialize=x=>JSON.stringify(x);
 const local=()=>bridge()?.snapshot();
 function stopSync(message){localStorage.removeItem(SYNC_KEY);conflicted=true;clearTimeout(syncTimer);syncTimer=null;notice=message||"Synchronisation arrêtée pour éviter une perte de données.";refresh()}
 function scheduleSync(){if(!enabled()||!user||conflicted)return;clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncOnce().catch(e=>{errorMessage=error(e);refresh()}),1400)}
 async function syncOnce(){
  if(syncRunning||busy||!enabled()||!client||!user||conflicted)return;
  syncRunning=true;
  try{
   const base=JSON.parse(localStorage.getItem(BASE_KEY)||"null");
   if(!base||base.user!==user.id){stopSync("Synchronisation désactivée : appareil non initialisé.");return}
   const current=serialize(local());
   const response=await client.from("moon_snapshots").select("content,revision,updated_at").eq("owner_id",user.id).maybeSingle();
   if(response.error)throw response.error;
   const latest=response.data;
   if(!latest){stopSync("La sauvegarde cloud a disparu : synchronisation arrêtée.");return}
   const dirty=current!==base.content;
   const changed=Number(latest.revision)!==Number(base.revision);
   if(dirty&&changed){stopSync("Conflit entre appareils : vos modifications locales sont conservées. Sauvegardez vos données en JSON puis choisissez la version à conserver.");return}
   if(changed){
     if(serialize(local())!==base.content){stopSync("Modification locale détectée pendant la récupération : synchronisation arrêtée.");return}
     if(!bridge()?.restore(latest.content)){stopSync("Restauration automatique impossible : données locales conservées.");return}
     localStorage.setItem(BASE_KEY,serialize({user:user.id,revision:latest.revision,content:serialize(local())}));
     remote=latest;notice="Modifications récupérées depuis le cloud.";refresh();return;
   }
   if(dirty){
     const outgoing=local();
     const result=await client.from("moon_snapshots").update({content:outgoing,revision:Number(base.revision)+1,updated_at:new Date().toISOString()}).eq("owner_id",user.id).eq("revision",base.revision).select("revision,updated_at").maybeSingle();
     if(result.error)throw result.error;
     if(!result.data){stopSync("Conflit de synchronisation : données locales conservées.");return}
     remote={content:outgoing,revision:result.data.revision,updated_at:result.data.updated_at};
     localStorage.setItem(BASE_KEY,serialize({user:user.id,revision:result.data.revision,content:serialize(outgoing)}));
     if(serialize(local())!==serialize(outgoing))scheduleSync();
     notice="Synchronisation automatique effectuée.";refresh();
   }
  }finally{syncRunning=false}
 }
 function hasRecords(snapshot){return !!snapshot&&(snapshot.contacts?.length>0||snapshot.opportunities?.length>0||snapshot.tasks?.length>0)}
 async function initializeAccount(){
  if(!client||!user||!bridge())return;
  const current=local(),latest=await fetchRemote();
  if(!current)return;
  const previous=JSON.parse(localStorage.getItem(BASE_KEY)||"null");
  if(previous?.user===user.id&&enabled()){
    scheduleSync();return;
  }
  if(latest){
    if(serialize(current)===serialize(latest.content)){
      remote=latest;conflicted=false;setBaseline();localStorage.setItem(SYNC_KEY,"yes");
      notice="Compte synchronisé. Vos données sont à jour.";refresh();return;
    }
    if(hasRecords(current)){
      localStorage.removeItem(SYNC_KEY);
      notice="Des données existent sur cet appareil et sur votre compte. Pour éviter toute perte, choisissez une version dans Mon compte : restaurer depuis le cloud ou sauvegarder cet appareil.";
      refresh();return;
    }
    if(!bridge()?.restore(latest.content))throw Error("Impossible de charger les données du compte.");
    remote=latest;conflicted=false;setBaseline();localStorage.setItem(SYNC_KEY,"yes");
    notice="Vos données MOON ont été chargées automatiquement depuis votre compte.";refresh();return;
  }
  if(hasRecords(current)){
    localStorage.removeItem(SYNC_KEY);
    notice="Votre compte est prêt. Cet appareil contient déjà des données : cliquez sur « Sauvegarder ce navigateur » pour les associer à votre compte.";
    refresh();return;
  }
  const result=await client.from("moon_snapshots").insert({owner_id:user.id,content:current,revision:1}).select("revision,updated_at").single();
  if(result.error){
    if(result.error.code==="23505"){await fetchRemote();notice="Une sauvegarde existe déjà. Actualisez la page pour la récupérer.";refresh();return}
    throw result.error;
  }
  remote={content:current,revision:result.data.revision,updated_at:result.data.updated_at};
  conflicted=false;setBaseline();localStorage.setItem(SYNC_KEY,"yes");
  notice="Votre espace MOON est prêt. La synchronisation est activée.";refresh();
 }
 function setBaseline(){if(!user||!remote)return;localStorage.setItem(BASE_KEY,serialize({user:user.id,revision:remote.revision,content:serialize(local())}))}
 function startPolling(){setInterval(()=>{if(enabled()&&user&&document.visibilityState!=="hidden")scheduleSync()},15000);window.addEventListener("focus",scheduleSync)}
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
    if(user)await initializeAccount();
    client.auth.onAuthStateChange((evt,session)=>{
      // Never await a Supabase query inside this callback.
      user=session?.user||null;remote=null;notice="";if(!user){clearTimeout(syncTimer);localStorage.removeItem(SYNC_KEY);localStorage.removeItem(BASE_KEY);bridge()?.clearSession?.()}
      refresh();
      if(user)setTimeout(()=>initializeAccount().catch(e=>{errorMessage=error(e);refresh()}),0);
    });
    startPolling();refresh();
   }catch(e){errorMessage=error(e);refresh()}
 }
 function settingsHtml(){
   if(!configured)return '<section class="panel cloud-panel"><h2>☁️ Sauvegarde cloud Supabase</h2><p class="subtle">Intégration prête à configurer. MOON reste en mode local et aucune donnée n’est envoyée en ligne.</p><div class="help">Un projet Supabase gratuit doit être créé et sa clé publique configurée. Les données ESPI réelles restent interdites sans validation DSI.</div></section>';
   let html='<section class="panel cloud-panel"><h2>☁️ Mon compte et mes appareils</h2><p class="subtle">Connectez-vous avec votre email sur n’importe quel ordinateur : vos données sont récupérées automatiquement et les modifications sont synchronisées. Aucun mot de passe à mémoriser.</p>';
   if(!client){html+='<div class="help">Connexion à Supabase en cours…</div>';}
   else if(!user){
     html+='<form id="cloud-login-form"><div class="help">1. Saisissez votre email pour créer votre compte ou vous connecter. 2. Cliquez sur le lien reçu. 3. Vos données se chargent automatiquement sur un nouvel appareil vide.</div><label>Votre email de connexion<input class="field" type="email" name="email" id="cloud-email" autocomplete="email" required placeholder="vous@exemple.fr"></label><div class="actions" style="margin-top:12px"><button class="btn primary" type="submit">Créer mon compte / Me connecter</button></div></form><p class="subtle">Si votre email ne possède pas encore de compte, Supabase peut le créer lors de votre première connexion, selon la configuration du projet.</p>';
   }else{
     const ts=remote?.updated_at?new Date(remote.updated_at).toLocaleString("fr-FR"):"";
     html+='<p class="subtle">✓ Compte connecté : <strong>'+esc(user.email||user.id)+'</strong></p><p class="subtle">Copie distante : '+(remote?'existante · dernière modification '+esc(ts):"aucune sauvegarde détectée")+'</p>';
     html+='<div class="actions"><button class="btn primary" type="button" data-action="cloud-upload">Sauvegarder ce navigateur dans Supabase</button><button class="btn" type="button" data-action="cloud-download" '+(remote?"":"disabled")+'>Restaurer depuis Supabase</button><button class="btn" type="button" data-action="cloud-refresh">Actualiser l’état</button><button class="btn" type="button" data-action="cloud-logout">Se déconnecter</button></div>';
     html+='<div class="actions" style="margin-top:12px"><button class="btn" type="button" data-action="cloud-auto-toggle">'+(enabled()?"Désactiver la synchronisation automatique":"Activer la synchronisation automatique")+'</button></div><p class="subtle">Synchronisation sur cet appareil : <strong>'+(enabled()?"activée":"désactivée")+'</strong>. Elle s’active automatiquement lorsque les données locales et celles du compte sont compatibles. En cas de divergence, choisissez une version.</p>';
     html+='<div class="help">Un téléchargement crée d’abord une copie locale de secours. Une sauvegarde distante existante doit être confirmée avant tout remplacement. Évitez de modifier les mêmes dossiers simultanément sur deux appareils : les conflits sont bloqués, pas fusionnés.</div>';
   }
   if(notice)html+='<p class="subtle" role="status">'+esc(notice)+'</p>';
   if(errorMessage)html+='<div class="help" role="alert">'+esc(errorMessage)+'</div>';
   html+='<div class="help">Les données de votre compte sont privées grâce aux règles d’accès Supabase. Sur un ordinateur partagé, déconnectez-vous et effacez les données locales du navigateur avant de le quitter.</div></section>';
   return html;
 }
 function authScreen(){
  const root=document.getElementById("auth-root");if(!root)return;
  if(user){root.hidden=true;document.body.classList.remove("moon-locked");if(!document.querySelector(".shell"))bridge()?.show?.();return}
  document.body.classList.add("moon-locked");root.hidden=false;
  const form=pendingEmail?'<form id="otp-verify-form"><label>Code reçu sur '+esc(pendingEmail)+'<input class="field otp-code" name="token" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="000000" required></label><button class="btn primary" type="submit">Se connecter à MOON</button><button class="btn ghost" type="button" id="otp-back">Changer d’adresse</button></form>':'<form id="otp-email-form"><label>Adresse email<input class="field" name="email" type="email" autocomplete="email" placeholder="vous@exemple.fr" required></label><button class="btn primary" type="submit">Recevoir mon code</button></form>';
  root.innerHTML='<div class="auth-card"><div class="auth-brand"><span class="brand-symbol">☾</span><strong>MOON</strong></div><h1>Votre espace commercial.</h1><p>Connectez-vous pour retrouver vos contacts, dossiers et relances sur tous vos appareils.</p>'+form+(busy?'<p role="status">Veuillez patienter…</p>':'')+(notice?'<p class="auth-notice" role="status">'+esc(notice)+'</p>':'')+(errorMessage?'<p class="auth-error" role="alert">'+esc(errorMessage)+'</p>':'')+'<small>Connexion sécurisée par code unique à 6 chiffres. Aucun mot de passe.</small></div>';
  root.querySelector("#otp-email-form")?.addEventListener("submit",async e=>{e.preventDefault();await login(e.target)});
  root.querySelector("#otp-verify-form")?.addEventListener("submit",async e=>{e.preventDefault();await verifyCode(e.target)});
  root.querySelector("#otp-back")?.addEventListener("click",()=>{pendingEmail="";notice="";errorMessage="";authScreen()});
 }
 async function verifyCode(form){
  if(!client||busy||!pendingEmail)return;
  const token=String(new FormData(form).get("token")||"").trim();
  if(!/^\\d{6}$/.test(token)){errorMessage="Saisissez les 6 chiffres du code.";authScreen();return}
  busy=true;errorMessage="";notice="";authScreen();
  try{const r=await client.auth.verifyOtp({email:pendingEmail,token,type:"email"});if(r.error)throw r.error;if(!r.data?.user)throw Error("Connexion non confirmée.");pendingEmail="";user=r.data.user;await initializeAccount();authScreen()}
  catch(e){errorMessage=error(e)}
  finally{busy=false;authScreen()}
 }
 function refresh(){authScreen();if(document.getElementById("cloud-live"))$("cloud-live").innerHTML=settingsHtml();}
 async function fetchRemote(){
   if(!client||!user)return;
   const r=await client.from("moon_snapshots").select("content,revision,updated_at").eq("owner_id",user.id).maybeSingle();
   if(r.error)throw r.error;
   remote=r.data||null;
   refresh();
   return remote;
 }
 async function act(action){
   if(busy)return;
   if(action==="cloud-auto-toggle"){
     if(enabled()){localStorage.removeItem(SYNC_KEY);clearTimeout(syncTimer);notice="Synchronisation automatique désactivée.";refresh();return}
     if(!client||!user||!remote){errorMessage="Effectuez d’abord une sauvegarde manuelle.";refresh();return}
     const latest=await fetchRemote().catch(e=>{errorMessage=error(e);return null});
     if(!latest){refresh();return}
     if(serialize(latest.content)!==serialize(local())){errorMessage="Les versions locale et distante diffèrent. Sauvegardez ou restaurez manuellement avant d’activer la synchronisation.";refresh();return}
     if(!confirm("Activer la synchronisation automatique sur CET appareil ? Les modifications seront envoyées à Supabase et les changements d’autres appareils seront récupérés. En cas de conflit, la synchronisation s’arrête sans écraser vos données."))return;
     conflicted=false;remote=latest;setBaseline();localStorage.setItem(SYNC_KEY,"yes");notice="Synchronisation automatique activée.";refresh();return;
   }
   if(action==="cloud-refresh"){try{await fetchRemote();notice="État actualisé.";errorMessage="";}catch(e){errorMessage=error(e)}refresh();return}
   if(action==="cloud-logout"){busy=true;try{const r=await client.auth.signOut();if(r.error)throw r.error;user=null;remote=null;bridge()?.clearSession?.();notice="Déconnecté.";errorMessage="";}catch(e){errorMessage=error(e)}finally{busy=false;refresh()}return}
   if(!client||!user)return;
   const ui=bridge();if(!ui)return;
   busy=true;errorMessage="";notice="";
   try{
     if(action==="cloud-upload"){
       if(!confirm("Sauvegarder la copie locale actuelle dans votre espace Supabase ? Cette action transmet le contenu du CRM au fournisseur et peut remplacer votre précédente sauvegarde distante."))return;
       // Local data are never uploaded at sign-in. Require explicit confirmation.
       const content=ui.snapshot();
       if(!Array.isArray(content.contacts)||!Array.isArray(content.opportunities)||!Array.isArray(content.tasks))throw Error("Données locales invalides.");
       const latest=await fetchRemote();
       if(latest&&!confirm("Une sauvegarde distante existe déjà (révision "+latest.revision+"). Voulez-vous vraiment la remplacer par les données de CE navigateur ?"))return;
       let result;
       if(latest)result=await client.from("moon_snapshots")
        .update({content,revision:Number(latest.revision)+1,updated_at:new Date().toISOString()})
        .eq("owner_id",user.id).eq("revision",latest.revision).select("revision,updated_at").maybeSingle();
       else result=await client.from("moon_snapshots")
        .insert({owner_id:user.id,content,revision:1}).select("revision,updated_at").single();
       if(result.error)throw result.error;
       if(!result.data)throw Error("Conflit : une autre copie a été sauvegardée entretemps. Actualisez et recommencez.");
       remote={content,revision:result.data.revision,updated_at:result.data.updated_at};
       conflicted=false;setBaseline();localStorage.setItem(SYNC_KEY,"yes");scheduleSync();
       notice="Sauvegarde cloud effectuée. Synchronisation automatique activée.";
     }else if(action==="cloud-download"){
       const latest=await fetchRemote();
       if(!latest)throw Error("Aucune sauvegarde distante trouvée.");
       const counts=[latest.content?.contacts?.length||0,latest.content?.opportunities?.length||0,latest.content?.tasks?.length||0];
       if(!confirm("Restaurer "+counts[0]+" contacts, "+counts[1]+" opportunités et "+counts[2]+" tâches depuis Supabase ? La copie actuelle du navigateur sera d’abord conservée en secours local."))return;
       if(!ui.restore(latest.content))throw Error("Impossible de restaurer les données du serveur.");
       conflicted=false;setBaseline();localStorage.setItem(SYNC_KEY,"yes");
       notice="Données du compte chargées. Synchronisation automatique activée. Copie locale précédente conservée en secours.";
     }
   }catch(e){errorMessage=error(e);if(/duplicate key/i.test(errorMessage))errorMessage="Une sauvegarde distante existe déjà. Actualisez avant de recommencer."}
   finally{busy=false;refresh()}
 }
 async function login(form){
   if(!client)return;
   if(busy)return;
   busy=true;errorMessage="";notice="";
   try{
     const email=String(new FormData(form).get("email")||"").trim();
     if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error("Adresse email invalide.");
     const redirect=location.origin+location.pathname;
     const r=await client.auth.signInWithOtp({email,options:{emailRedirectTo:redirect}});
     if(r.error)throw r.error;
     pendingEmail=email;notice="Un code à 6 chiffres a été demandé. Vérifiez votre boîte email.";
   }catch(e){errorMessage=error(e)}finally{busy=false;refresh()}
 }
 window.MOON_CLOUD={settingsHtml,act,login,verifyCode,init,configured,onLocalSave:scheduleSync,isAuthenticated:()=>!!user};
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
 else init();
})();