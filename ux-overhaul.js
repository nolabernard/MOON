/* MOON UX — progressive enhancement. No modification of CRM persistence or permissions. */
"use strict";
(function(){
  let viewChoice="table";
  let decorating=false;
  const originalRender=render;
  const can=(section)=>!isReadOnly()||!!window.MOON_VISITOR?.pageAllowed?.(section);
  function button(text,action,cls){const b=document.createElement("button");b.type="button";b.className=cls||"btn";b.dataset.ux=action;b.textContent=text;return b}
  function go(destination){
    if(destination==="opportunities"&&(viewChoice==="kanban"||(!can("opportunities")&&can("board"))))destination="board";
    if(!can(destination))return;
    if(document.getElementById("modal")?.open)closeModal();
    page=destination;render();window.MOON_CLOUD?.refreshStatus?.();
  }
  function enhanceForm(){
    const form=document.querySelector("#modal #opportunity-form");
    if(!form||form.dataset.uxEnhanced)return;
    form.dataset.uxEnhanced="true";
    const grid=form.querySelector(".form-grid");if(!grid)return;
    const advanced=new Set(["maturity","vat","customVat","forecast","closed","lostReason","source","owner","notes"]);
    const labels=[...grid.querySelectorAll("label")].filter(label=>label.querySelector("[name]")&&advanced.has(label.querySelector("[name]").name));
    if(!labels.length)return;
    const details=document.createElement("details");details.className="ux-advanced-fields";
    if(form.elements.id?.value)details.open=true;
    const summary=document.createElement("summary");summary.textContent="Informations complémentaires";
    const contents=document.createElement("div");contents.className="ux-advanced-grid";
    for(const label of labels)contents.append(label);
    details.append(summary,contents);grid.append(details);
  }
  const originalModal=modal;
  modal=function(){const result=originalModal.apply(this,arguments);enhanceForm();polishActions(document.querySelector("#modal"));return result};
  const icons={
    day:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
    opportunities:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
    contacts:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6m2 9v-2a6 6 0 0 0-3-5.2"/>',
    tasks:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m7.5 12 3 3 6-7"/>',
    reporting:'<path d="M4 20V12m5 8V5m5 15v-8m5 8V9"/><path d="M2 21h20"/>',
    account:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v2m0 16v2m10-10h-2M4 12H2m17.1 7.1-1.5-1.5M6.4 6.4 4.9 4.9m14.2 0-1.5 1.5M6.4 17.6l-1.5 1.5"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    voice:'<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8"/>',
    table:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10m6-10v10"/>',
    kanban:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M10 4v16m6-16v10"/>',
    check:'<path d="m4 12 5 5L20 6"/>',
    eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    download:'<path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/>',
    upload:'<path d="M12 21V9m-4 4 4-4 4 4M4 7V3h16v4"/>',
    refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5 9a8 8 0 0 1 14-2l1 5M4 12l1 5a8 8 0 0 0 14-2"/>',
    logout:'<path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M14 7l5 5-5 5M19 12H9"/>',
    trash:'<path d="M4 7h16m-10 0V4h4v3m-8 0 1 14h10l1-14M10 11v6m4-6v6"/>',
    edit:'<path d="m4 16 11-11 4 4-11 11-5 1 1-5ZM13 7l4 4"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
    close:'<path d="M5 5 19 19M19 5 5 19"/>',
    more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
  };
  function iconFor(key){return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+(icons[key]||icons.day)+'</svg>'}
  const actionIcons={
    "new-contact":"plus","new-contact-from-op":"plus","new-opportunity":"plus","new-task":"plus",
    "voice-open":"voice","edit-contact":"eye","edit-opportunity":"eye","open-opportunity":"eye","edit-task":"eye",
    "save-contact-direct":"check","save-opportunity-direct":"check","save-task-direct":"check",
    "save-interaction-direct":"check","save-exchange-edit":"check",
    "cloud-sync-now":"refresh","cloud-refresh":"refresh","cloud-logout":"logout",
    "export-json":"download","export-csv":"download","import-json":"upload","import-csv":"upload",
    "delete-contact":"trash","delete-opportunity":"trash","delete-task":"trash",
    "close-modal":"close","visitor-refresh":"refresh",
    "edit-exchange":"edit","copy-report":"check"
  };
  const uxIcons={"search":"search","create":"plus","view-table":"table","view-board":"kanban","more":"more"};
  function polishActions(root){
    if(!root)return;
    for(const btn of root.querySelectorAll("button[data-action],button[data-ux]")){
      if(btn.classList.contains("nav-button")||btn.classList.contains("ux-mobile-item")||btn.dataset.moonIconReady==="true")continue;
      const symbol=actionIcons[btn.dataset.action]||uxIcons[btn.dataset.ux];
      if(!symbol)continue;
      const text=btn.textContent.trim();
      if(!text||btn.querySelector(".moon-action-icon"))continue;
      // Glyphs represented by this outline icon are removed, not appended as another icon.
      const label=text.replace(/^[+🎙⌕☷▥↧✎✕]+\s*/u,"").trim();
      if(!label){btn.setAttribute("aria-label",btn.getAttribute("aria-label")||text);btn.classList.add("moon-icon-only")}
      else btn.textContent=label;
      const holder=document.createElement("span");holder.className="moon-action-icon";holder.innerHTML=iconFor(symbol);
      btn.prepend(holder);btn.classList.add("moon-with-icon");btn.dataset.moonIconReady="true";
    }
  }
  function decorate(){
    if(decorating)return;decorating=true;
    try{
      const shell=document.querySelector("#app .shell");
      if(!shell)return;
      const nav=shell.querySelector(".sidebar nav"),actions=shell.querySelector(".topbar .actions");
      for(const table of shell.querySelectorAll(".workspace-opportunities .data-table,.workspace-contacts .data-table")){
        const headings=[...table.querySelectorAll("thead th")].map(el=>el.textContent.trim().replace(/[↕↑↓]/g,"").trim());
        for(const row of table.querySelectorAll("tbody tr"))[...row.children].forEach((cell,index)=>cell.dataset.label=headings[index]||"Action");
      }
      if(!nav||!actions)return;
      for(const entry of nav.querySelectorAll(".nav-button")){
        const key=entry.dataset.page,container=entry.querySelector(".nav-ico");
        if(container&&icons[key])container.innerHTML=iconFor(key);
      }
      const brandIcon=shell.querySelector(".brand-symbol");if(brandIcon){brandIcon.textContent="";brandIcon.setAttribute("aria-hidden","true")}
      const navLabels=shell.querySelectorAll(".sidebar .nav-group-label");for(const label of navLabels)if(label.textContent.trim()==="ESPACE PERSONNEL")label.textContent="Espace personnel";

      nav.querySelectorAll('[data-page="dashboard"],[data-page="board"]').forEach(n=>n.remove());
      const op=nav.querySelector('[data-page="opportunities"]');
      if(op){op.classList.toggle("active",page==="board"||page==="opportunities");op.querySelector(".nav-label").textContent="Opportunités"}
      const reporting=nav.querySelector('[data-page="reporting"] .nav-label');if(reporting)reporting.textContent="Reporting";
      const title=shell.querySelector(".topbar h1");
      if(title&&page==="board")title.textContent="Opportunités";
      if(title&&page==="reporting")title.textContent="Reporting commercial";
      if(page==="day"){
        const existing=nav.querySelector('[data-page="day"] .nav-label');
        if(existing)existing.textContent="Ma journée";
      }
      if(!actions.querySelector("[data-ux='search']"))actions.prepend(button("⌕ Rechercher","search","btn ux-search"));
      if(!isReadOnly()){
        actions.querySelectorAll('[data-action="new-contact"],[data-action="new-task"],[data-action="new-opportunity"]').forEach(b=>b.remove());
        actions.append(button("+ Créer","create","btn primary ux-create"));
      }
      if(page==="board"||page==="opportunities"){
        const target=document.querySelector("#view .panel .row")||document.querySelector("#view .board");
        if(target){
          const holder=document.createElement("div");holder.className="ux-view-picker";
          const table=button("☷ Tableau","view-table","btn small"+(page==="opportunities"?" primary":""));
          const board=button("▥ Kanban","view-board","btn small"+(page==="board"?" primary":""));
          table.setAttribute("aria-pressed",String(page==="opportunities"));board.setAttribute("aria-pressed",String(page==="board"));
          holder.append(table,board);
          if(target.matches(".board"))target.before(holder);else target.append(holder);
        }
      }
      const currentBottom=shell.querySelector(".ux-bottom-nav");if(currentBottom)currentBottom.remove();
      const bottom=document.createElement("nav");bottom.className="ux-bottom-nav";bottom.setAttribute("aria-label","Navigation mobile");
      const entries=[["day","☀","Journée"],["opportunities","◇","Dossiers"],["contacts","♙","Contacts"],["tasks","☑","Tâches"],["reporting","▤","Reporting"]];
      for(const [key,icon,label] of entries){
        if(!can(key)&&!(key==="opportunities"&&can("board")))continue;
        const item=button("","navigate","ux-mobile-item");item.dataset.page=key;
        const ico=document.createElement("span");ico.innerHTML=iconFor(key);ico.setAttribute("aria-hidden","true");
        const txt=document.createElement("small");txt.textContent=label;item.append(ico,txt);
        if(page===key||(key==="opportunities"&&page==="board")){item.classList.add("active");item.setAttribute("aria-current","page")}
        bottom.append(item);
      }
      const more=button("","more","ux-mobile-item");const mi=document.createElement("span");mi.innerHTML=iconFor("more");const ml=document.createElement("small");ml.textContent="Plus";more.append(mi,ml);if(!isReadOnly())bottom.append(more);
      shell.append(bottom);
      polishActions(shell);
    }finally{decorating=false}
  }
  render=function(){const value=originalRender.apply(this,arguments);decorate();return value};
  function showSearch(){
    modal("Recherche globale",'<div class="ux-search-dialog"><label for="ux-query">Contacts, opportunités et tâches</label><input id="ux-query" class="field" placeholder="Nom, formation, entreprise, relance…" autocomplete="off"><div id="ux-results" class="ux-results" role="region" aria-live="polite"><p class="subtle">Commencez à saisir pour retrouver un élément.</p></div></div>');
    const input=document.getElementById("ux-query");input?.addEventListener("input",()=>updateSearch(input.value));input?.focus();
  }
  function updateSearch(value){
    const holder=document.getElementById("ux-results");if(!holder)return;holder.replaceChildren();
    const query=value.trim().toLocaleLowerCase("fr");
    if(!query)return;
    const results=[];
    if(can("contacts"))for(const c of data.contacts){if([contactName(c),c.company,c.email,c.phone].join(" ").toLocaleLowerCase("fr").includes(query))results.push({label:contactName(c),detail:"Contact · "+(c.company||"Sans entreprise"),action:"edit-contact",id:c.id})}
    if(can("opportunity-detail"))for(const o of data.opportunities){if([o.training,contactName(linkedContact(o)),o.stage].join(" ").toLocaleLowerCase("fr").includes(query))results.push({label:o.training,detail:"Opportunité · "+contactName(linkedContact(o)),action:"open-opportunity",id:o.id})}
    if(can("tasks"))for(const t of data.tasks){if([t.title,t.type,t.notes].join(" ").toLocaleLowerCase("fr").includes(query))results.push({label:t.title,detail:"Tâche · "+dt(t.due),action:"edit-task",id:t.id})}
    const count=document.createElement("p");count.className="subtle";count.textContent=results.length+" résultat(s)";holder.append(count);
    for(const item of results.slice(0,40)){
      const b=button("","result","ux-result");b.dataset.destination=item.action;b.dataset.id=item.id;
      const strong=document.createElement("strong");strong.textContent=item.label;const small=document.createElement("small");small.textContent=item.detail;b.append(strong,small);holder.append(b);
    }
    if(results.length>40){const p=document.createElement("p");p.className="subtle";p.textContent="Affinez la recherche pour afficher les autres résultats.";holder.append(p)}
  }
  function showCreate(){
    modal("Créer dans MOON",'<div class="ux-create-options"></div>');
    const holder=document.querySelector(".ux-create-options");
    [["opportunity","◇ Nouvelle opportunité","Suivre un nouveau projet commercial"],["contact","♙ Nouveau contact","Ajouter une personne à votre répertoire"],["task","☑ Nouvelle tâche","Planifier une relance ou une action"],["voice","🎙 Dictée vocale","Enregistrer une action en parlant"]].forEach(([key,label,detail])=>{
      const b=button("","create-"+key,"ux-create-option");const h=document.createElement("strong");h.textContent=label;const d=document.createElement("small");d.textContent=detail;b.append(h,d);holder.append(b);
    });
  }
  function showMore(){
    modal("Espace personnel",'<div class="ux-create-options"></div>');
    const holder=document.querySelector(".ux-create-options");
    [["account","☁ Mon compte"],["settings","⚙ Paramètres"]].forEach(([key,label])=>holder.append(button(label,"more-"+key,"ux-create-option")));
  }
  document.addEventListener("click",e=>{
    const b=e.target.closest("[data-ux]");if(!b)return;
    e.preventDefault();e.stopImmediatePropagation();
    const action=b.dataset.ux;
    if(action==="search")showSearch();
    if(action==="create"&&!isReadOnly())showCreate();
    if(action==="view-table"){viewChoice="table";go("opportunities")}
    if(action==="view-board"){viewChoice="kanban";go("board")}
    if(action==="navigate")go(b.dataset.page);
    if(action==="more"&&!isReadOnly())showMore();
    if(action.startsWith("more-")&&!isReadOnly())go(action.slice(5));
    if(action.startsWith("create-")&&!isReadOnly()){
      const kind=action.slice(7);closeModal();
      if(kind==="opportunity")opportunityModal();if(kind==="contact")contactModal();if(kind==="task")taskModal();
      if(kind==="voice")window.MOON_VOICE?.open?.();
    }
    if(action==="result"){
      const kind=b.dataset.destination,id=b.dataset.id;
      if(kind==="edit-contact"&&can("contacts")){closeModal();isReadOnly()?visitorContactModal(contact(id)):contactModal(contact(id))}
      if(kind==="edit-task"&&can("tasks")){closeModal();isReadOnly()?visitorTaskModal(task(id)):taskModal(task(id))}
      if(kind==="open-opportunity"&&can("opportunity-detail")){closeModal();selectedOpportunityId=id;opportunityReturnPage=can("opportunities")?"opportunities":"board";page="opportunity-detail";render()}
    }
  },true);
  document.addEventListener("click",e=>{
    const b=e.target.closest('.sidebar [data-page="board"],.sidebar [data-page="opportunities"]');
    if(b&&b.dataset.page==="opportunities"&&viewChoice==="kanban"){e.preventDefault();e.stopImmediatePropagation();go("board")}
  },true);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>decorate());else decorate();
})();
