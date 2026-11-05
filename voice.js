"use strict";
/* MOON voice assistant: browser speech recognition, deterministic local parsing.
   Audio processing depends on browser implementation and may use remote services.
   Never automatically persists a dictated record. */
(function(){
const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clean=s=>String(s||"").replace(/\s+/g," ").trim();
const lower=s=>clean(s).toLocaleLowerCase("fr-FR");
const iso=d=>{const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");return y+"-"+m+"-"+day};
const normalize=s=>lower(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const TYPES=["VAE","Formation courte","Autre"];
const weekdays=["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
const months=["janvier","fevrier","mars","avril","mai","juin","juillet","aout","septembre","octobre","novembre","decembre"];
function dateFromSpeech(text,base=new Date()){
 const t=normalize(text),today=new Date(base.getFullYear(),base.getMonth(),base.getDate());
 if(/\b(apres[- ]demain)\b/.test(t)){today.setDate(today.getDate()+2);return iso(today)}
 if(/\bdemain\b/.test(t)){today.setDate(today.getDate()+1);return iso(today)}
 if(/\baujourd.?hui\b/.test(t))return iso(today);
 const num=t.match(/\b(?:le\s+)?(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\b/);
 if(num){let y=num[3]?Number(num[3]):today.getFullYear();if(y<100)y+=2000;const d=new Date(y,Number(num[2])-1,Number(num[1]));if(d.getDate()!==Number(num[1])||d.getMonth()!==Number(num[2])-1)return "";if(!num[3]&&d<today)d.setFullYear(y+1);return iso(d)}
 const named=t.match(/\b(?:le\s+)?(\d{1,2})\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)(?:\s+(\d{4}))?\b/);
 if(named){const y=named[3]?Number(named[3]):today.getFullYear(),d=new Date(y,months.indexOf(named[2]),Number(named[1]));if(d.getDate()!==Number(named[1]))return "";if(!named[3]&&d<today)d.setFullYear(y+1);return iso(d)}
 const weekday=t.match(/\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/);
 if(weekday){const target=weekdays.indexOf(weekday[1]);let diff=(target-today.getDay()+7)%7;if(diff===0||/\bprochain\b/.test(t))diff+=diff===0?7:0;today.setDate(today.getDate()+diff);return iso(today)}
 return "";
}
function parse(text,base=new Date()){
 const original=clean(text),t=normalize(original);
 let kind=/\b(tache|rappel|rappelle|relance|appeler|rappeler|penser a|faire)\b/.test(t)?"task":/\b(contact|personne|prospect)\b/.test(t)&&!/\b(formation|vae|opportunite|interesse|projet)\b/.test(t)?"contact":"opportunity";
 const titled=original.match(/\b(?:mme|madame|monsieur|mr|m\.)\s+([A-ZÀ-Ÿ][\\p{L}'-]+)/iu);
 const firstWords=original.match(/(?:contact|prospect|pour|avec|monsieur|madame|mme|m\.|m'appelle|nomme|s'appelle)\s+(?:monsieur\s+|madame\s+)?([A-ZÀ-Ÿ][\p{L}'-]+)\s+([A-ZÀ-Ÿ][\p{L}'-]+)/u);
 let first=firstWords?.[1]||"",last=firstWords?.[2]||titled?.[1]||"";
 const email=original.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0]||"";
 const phone=original.match(/(?:\+33\s?[1-9]|0[1-9])(?:[\s.-]?\d{2}){4}\b/)?.[0]||"";
 const company=original.match(/(?:entreprise|societe|société|chez)\s+([^\.,;]+?)(?=\s+(?:qui|pour|interess|intéress|a\s+|est\s+|avec\s+|et\s+|a\s+rappeler|à\s+rappeler|montant|formation)\b|[,.;]|$)/i)?.[1]?.trim()||"";
 const money=original.match(/\b(\d{1,3}(?:[ \u00a0\u202f]\d{3})+|\d{3,7})(?:[,.](\d{1,2}))?\s*(?:€|euros?)\b/i);
 const amount=money?money[1].replace(/[ \u00a0\u202f]/g,"")+(money[2]?"."+money[2]:""):"";
 const vatMode=/\bttc\b/i.test(original)?"ttc":/\bht\b/i.test(original)?"ht":"unknown";
 let category=/\bvae\b/i.test(original)?"VAE":/\bformation\s+courte\b/i.test(original)?"Formation courte":"Autre";
 let training="";
 const trainingMatch=original.match(/(?:interess[ée]e?\s+par|intéress[ée]e?\s+par|formation\s+(?:en|sur|de|à)|vae\s+(?:en|de|sur)|projet\s+(?:de|en))\s+([^,.;]+?)(?=\s+(?:a\s+\d|à\s+\d|pour\s+\d|montant|a\s+rappeler|à\s+rappeler|rappeler|relancer|vendredi|lundi|mardi|mercredi|jeudi|samedi|dimanche)\b|[,.;]|$)/i);
 if(trainingMatch)training=clean(trainingMatch[1]);
 if(!training&&category==="VAE")training="VAE";
 if(!training&&category==="Formation courte")training="Formation courte";
 const duePhrase=original.match(/(?:rappeler|relancer|rappel|relance|pour|avant|le)\s+(.+)$/i)?.[1]||original;
 const due=dateFromSpeech(duePhrase,base);
 let title=original.replace(/^(?:ajoute|ajouter|cree|crée|créer|nouvelle?|une?|un|tache|tâche|rappel|relance|pense à|penser à)\s+/gi,"").trim();
 if(!title)title="Nouvelle tâche";
 const conversational=/\b(j.ai eu|j'ai eu|j ai eu|echange|échange|j'ai parle|j ai parle|elle est|il est|je la rappelle|je le rappelle)\b/i.test(original);
 const statusMatch=original.match(/(?:doit\s+verifier|doit\s+vérifier|en attente de|attend(?:re)?\s+)([^,.;]+)/i);
 const summary=statusMatch?"En attente de "+clean(statusMatch[1]).replace(/^son\s+/i,"vérification de son "):"";
 return {kind,first,last,company,email,phone,training,category,amount,vatMode,due,title,transcript:original,conversational,summary};
}
function field(label,name,value="",type="text",extra=""){return '<label>'+label+'<input class="field" name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+extra+'></label>'}
function select(label,name,items,chosen){return '<label>'+label+'<select class="field" name="'+name+'">'+items.map(x=>'<option value="'+esc(x[0])+'" '+(x[0]===chosen?"selected":"")+'>'+esc(x[1])+'</option>').join("")+'</select></label>'}
function status(message){const e=$("voice-status");if(e)e.textContent=message}
let recognition=null;
function open(){
 const dialog=$("voice-modal");if(!dialog)return;
 dialog.innerHTML='<div class="dialog-head"><h2>🎙 Dictée MOON</h2><button type="button" class="btn small" id="voice-close">Fermer</button></div><div class="dialog-body"><p class="subtle">Dictez un contact, une opportunité ou une tâche. MOON prépare une fiche que vous vérifierez avant enregistrement.</p><div class="help">La reconnaissance vocale dépend du navigateur et peut transmettre l’audio à son fournisseur. N’utilisez pas de données personnelles réelles ESPI sans validation DSI.</div><div class="actions"><button class="btn primary" id="voice-start">🎤 Commencer à dicter</button><button class="btn" id="voice-stop" disabled>Arrêter</button></div><p id="voice-status" class="subtle" role="status">'+(Recognition?"Microphone disponible si autorisé par le navigateur.":"Reconnaissance vocale indisponible ici : vous pouvez saisir la phrase ci-dessous.")+'</p><label class="wide">Texte dicté ou saisi<textarea id="voice-transcript" class="field" placeholder="Exemple : Ajoute un contact Sophie Martin de Nexity intéressée par une VAE à 5980 euros, à rappeler mardi prochain."></textarea></label><div class="actions" style="margin:15px 0"><button class="btn primary" id="voice-analyze">Analyser la demande</button></div><div id="voice-preview"></div></div>';
 dialog.showModal();
 $("voice-close").onclick=()=>{stop();dialog.close()};
 $("voice-start").onclick=start;
 $("voice-stop").onclick=stop;
 $("voice-analyze").onclick=analyze;
 dialog.addEventListener("click",e=>{if(e.target===dialog){stop();dialog.close()}},{once:true});
}
function start(){
 if(!Recognition){status("Microphone non disponible dans ce navigateur. Utilisez la saisie manuelle.");return}
 stop();
 try{
 recognition=new Recognition();recognition.lang="fr-FR";recognition.interimResults=false;recognition.continuous=false;
 recognition.onresult=e=>{const transcript=Array.from(e.results).map(r=>r[0]?.transcript||"").join(" ");$("voice-transcript").value=transcript;status("Dictée reçue. Vérifiez le texte puis cliquez sur Analyser.");analyze()};
 recognition.onerror=e=>{status("Reconnaissance vocale : "+({not_allowed:"microphone refusé","not-allowed":"microphone refusé","no-speech":"aucune parole détectée","network":"service vocal indisponible"}[e.error]||e.error)+". Vous pouvez saisir le texte manuellement.")};
 recognition.onend=()=>{$("voice-start").disabled=false;$("voice-stop").disabled=true};
 recognition.start();$("voice-start").disabled=true;$("voice-stop").disabled=false;status("Écoute en cours… Parlez maintenant.");
 }catch(e){status("Impossible d'activer le microphone : "+e.message)}
}
function stop(){if(recognition){try{recognition.stop()}catch{}recognition=null}if($("voice-start"))$("voice-start").disabled=false;if($("voice-stop"))$("voice-stop").disabled=true}
function analyze(){
 const transcript=clean($("voice-transcript")?.value);if(!transcript){status("Dictez ou saisissez d'abord une demande.");return}
 const p=parse(transcript);
 const kinds=[["conversation","Échange : contact + opportunité + historique + relance"],["contact","Contact"],["opportunity","Contact + opportunité"],["task","Tâche / relance"]];
 const contacts=window.MOON_VOICE_BRIDGE?.contacts()||[];
 if(p.conversational)p.kind="conversation";
 const matches=p.last?contacts.filter(c=>normalize(c.last)===normalize(p.last)):[];
 const suggested=matches.length===1?matches[0].id:"";
 let html='<h3>Vérifier avant d’enregistrer</h3><form id="voice-confirm"><div class="form-grid">'+select("Action","kind",kinds,p.kind);
 html+=field("Prénom","first",p.first)+field("Nom","last",p.last)+field("Entreprise","company",p.company)+field("Email","email",p.email,"email")+field("Téléphone","phone",p.phone,"tel");
 html+=select("Contact existant (facultatif)","existingContact",[["","Créer un contact / aucun"],...contacts.map(c=>[c.id,[c.first,c.last,c.company].filter(Boolean).join(" · ")])],suggested);
 if(matches.length>1)html+='<p class="help">Plusieurs contacts portent ce nom : choisissez la bonne personne.</p>';
 html+=field("Compte rendu / décision","summary",p.summary||p.transcript);
 html+=field("Formation / prestation","training",p.training)+select("Catégorie","category",TYPES.map(x=>[x,x]),p.category);
 html+='<p class="subtle">Actions proposées : associer le contact, créer ou mettre à jour une opportunité, ajouter le compte rendu à l’historique et créer une relance si une date est indiquée. Rien ne sera enregistré avant votre confirmation.</p>';
 html+=field("Montant (€)","amount",p.amount,"number",'min="0" step="0.01"')+select("Montant annoncé","vatMode",[["unknown","Non précisé : à vérifier"],["ht","HT"],["ttc","TTC"]],p.vatMode);
 html+=field("Date de relance / échéance","due",p.due,"date")+field("Intitulé de tâche","title",p.title);
 html+='</div><p class="subtle">Le montant TTC ou sans précision ne sera pas converti automatiquement en HT. Il faudra compléter la TVA dans la fiche opportunité. Les dates relatives doivent être vérifiées.</p><div class="form-footer"><button type="button" class="btn" id="voice-cancel">Annuler</button><button type="submit" class="btn primary">Confirmer l’enregistrement</button></div></form>';
 $("voice-preview").innerHTML=html;
 $("voice-cancel").onclick=()=>{$("voice-preview").innerHTML=""};
 $("voice-confirm").onsubmit=e=>{
 e.preventDefault();const values=Object.fromEntries(new FormData(e.target));
 const result=values.kind==="conversation"?window.MOON_VOICE_BRIDGE?.saveConversation({...values,transcript}):window.MOON_VOICE_BRIDGE?.save(values);
 if(result?.ok){stop();$("voice-modal").close();status("");window.MOON_VOICE_BRIDGE?.refresh();window.MOON_VOICE_BRIDGE?.notify(result.message||"Enregistrement effectué")}
 else status(result?.error||"Impossible d'enregistrer cette demande.");
 };
 status("Informations proposées : vérifiez et complétez les champs manquants.");
}
window.MOON_VOICE={open,parse,dateFromSpeech,available:!!Recognition};
})();