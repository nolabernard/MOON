"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const app=fs.readFileSync(path.join(__dirname,"..","app.js"),"utf8");
const cloud=fs.readFileSync(path.join(__dirname,"..","cloud.js"),"utf8");
const html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
test("opportunity sorting includes stage, amount, follow-up and creation",()=>{for(const key of ["amount","follow","created","stage"])assert.match(app,new RegExp('key==="'+key+'"|\\["'+key+'"'));assert.match(app,/function sortedOpportunities\(/);assert.match(app,/data-action="filter-stage"/);assert.match(app,/data-action="sort-opportunities"/)});
test("opportunity detail includes linked contact, interactions and tasks",()=>{assert.match(app,/function opportunityDetailPage\(/);assert.match(app,/data-action="open-opportunity"/);assert.match(app,/page==="opportunity-detail"\?opportunityDetailPage\(\)/);assert.match(app,/Suivi & échanges/);assert.match(app,/id="interaction-form"/);assert.match(app,/data-action="edit-contact"/);assert.match(app,/data-action="new-task"/)});
test("saved interactions return to full opportunity page",()=>{assert.match(app,/page==="opportunity-detail"&&selectedOpportunityId===o.id/);assert.match(app,/if\(page!=="opportunity-detail"\)page="tasks"/)});
test("update banner is backed by server version and safe sync guard",()=>{assert.match(app,/function checkMoonUpdate\(/);assert.match(app,/cache:"no-store"/);assert.match(app,/function applyMoonUpdate\(/);assert.match(app,/MOON_CLOUD.canReload/);assert.match(cloud,/canReload:\(\)=>/);assert.match(html,/id="moon-update"/);assert.match(html,/app.js\?v=30\.0/)});

test("direct interaction save resolves the form from the detail page, with modal fallback",()=>{assert.match(app,/btn\.closest\?\.\("#"\+kind\+"-form"\)\|\|\$\("modal"\)\?\.querySelector/);assert.match(app,/else interactionSubmit\(form\)/)});
