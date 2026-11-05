"use strict";
/* MOON cloud sync: explicit backup/restore only; opt-in, never silently uploads
   local CRM data. The publishable key is safe in client JS ONLY with RLS. */
(function(){
 const config=window.MOON_SUPABASE_CONFIG||{};
 const configured=/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.url||"")
   && /^(sb_publishable_|eyJ)/.test(config.publishableKey||"");
 const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 let client=null,user=null,remote=null,busy=false,errorMessage="",notice="";
 const $=id=>document.getElementById(id);
 const bridge=()=>window.MOON_CLOUD_BRIDGE;
 function error(e){return String(e?.message||e||"Erreur inconnue")}
 async function init(){
   if(!configured)return;
   if(!window.supabase?.createClient){errorMessage="SDK Supabase non disponible (vérifiez votre connexion ou le bloqueur de scripts).";refresh();return}
   try{
    client=window.supabase.createClient(config.url,config.publishableKey,{
     auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
    const res=await client.auth.getUser();
    if(res.error && !/session.*missing/i.test(error(res.error)))throw res.error;
    user=res.data?.user||null;
    if(user)await fetchRemote();
    client.auth.onAuthStateChange((evt,session)=>{
      // Never await a Supabase query inside this callback.
      user=session?.user||null;remote=null;notice="";
      refresh();
      if(user)setTimeout(()=>fetchRemote().catch(e=>{errorMessage=error(e);refresh()}),0);
    });
    refresh();
   }catch(e){errorMessage=error(e);refresh()}
 }
 function settingsHtml(){
   if(!configured)return '<section class="panel cloud-panel"><h2>☁️ Sauvegarde cloud Supabase</h2><p class="subtle">Intégration prête à configurer. MOON reste en mode local et aucune donnée n’est envoyée en ligne.</p><div class="help">Un projet Supabase gratuit doit être créé et sa clé publique configurée. Les données ESPI réelles restent interdites sans validation DSI.</div></section>';
   let html='<section class="panel cloud-panel"><h2>☁️ Sauvegarde cloud Supabase</h2><p class="subtle">Transfert manuel uniquement. Les données restent dans ce navigateur tant que vous ne confirmez pas explicitement une sauvegarde cloud.</p>';
   if(!client){html+='<div class="help">Connexion à Supabase en cours…</div>';}
   else if(!user){
     html+='<form id="cloud-login-form"><label>Votre email de connexion<input class="field" type="email" name="email" id="cloud-email" autocomplete="email" required placeholder="vous@exemple.fr"></label><div class="actions" style="margin-top:12px"><button class="btn primary" type="submit">Recevoir un lien de connexion</button></div></form><p class="subtle">Le lien ouvre MOON et active votre session sur cet appareil.</p>';
   }else{
     const ts=remote?.updated_at?new Date(remote.updated_at).toLocaleString("fr-FR"):"";
     html+='<p class="subtle">Compte connecté : <strong>'+esc(user.email||user.id)+'</strong></p><p class="subtle">Copie distante : '+(remote?'existante · dernière modification '+esc(ts):"aucune sauvegarde détectée")+'</p>';
     html+='<div class="actions"><button class="btn primary" type="button" data-action="cloud-upload">Sauvegarder ce navigateur dans Supabase</button><button class="btn" type="button" data-action="cloud-download" '+(remote?"":"disabled")+'>Restaurer depuis Supabase</button><button class="btn" type="button" data-action="cloud-refresh">Actualiser l’état</button><button class="btn" type="button" data-action="cloud-logout">Se déconnecter</button></div>';
     html+='<div class="help">Un téléchargement crée d’abord une copie locale de secours. Une sauvegarde distante existante doit être confirmée avant tout remplacement. Les modifications faites sur deux appareils ne sont pas fusionnées automatiquement.</div>';
   }
   if(notice)html+='<p class="subtle" role="status">'+esc(notice)+'</p>';
   if(errorMessage)html+='<div class="help" role="alert">'+esc(errorMessage)+'</div>';
   html+='<div class="help">⚠️ Version de démonstration : ne stockez pas de données personnelles ESPI sans autorisation de votre DSI.</div></section>';
   return html;
 }
 function refresh(){if(document.getElementById("cloud-live"))$("cloud-live").innerHTML=settingsHtml();}
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
   if(action==="cloud-refresh"){try{await fetchRemote();notice="État actualisé.";errorMessage="";}catch(e){errorMessage=error(e)}refresh();return}
   if(action==="cloud-logout"){busy=true;try{const r=await client.auth.signOut();if(r.error)throw r.error;user=null;remote=null;notice="Déconnecté.";errorMessage="";}catch(e){errorMessage=error(e)}finally{busy=false;refresh()}return}
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
       notice="Sauvegarde cloud effectuée avec succès.";
     }else if(action==="cloud-download"){
       const latest=await fetchRemote();
       if(!latest)throw Error("Aucune sauvegarde distante trouvée.");
       const counts=[latest.content?.contacts?.length||0,latest.content?.opportunities?.length||0,latest.content?.tasks?.length||0];
       if(!confirm("Restaurer "+counts[0]+" contacts, "+counts[1]+" opportunités et "+counts[2]+" tâches depuis Supabase ? La copie actuelle du navigateur sera d’abord conservée en secours local."))return;
       if(!ui.restore(latest.content))throw Error("Impossible de restaurer les données du serveur.");
       notice="Sauvegarde restaurée depuis Supabase. Copie locale précédente conservée dans ce navigateur.";
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
     notice="Un lien de connexion a été demandé. Consultez votre boîte email.";
   }catch(e){errorMessage=error(e)}finally{busy=false;refresh()}
 }
 window.MOON_CLOUD={settingsHtml,act,login,init,configured};
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
 else init();
})();