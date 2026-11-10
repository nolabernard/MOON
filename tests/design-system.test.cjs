"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=(name)=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const app=read("app.js"),ux=read("ux-overhaul.js"),css=read("moon-2026.css"),html=read("index.html");

test("all list and reporting filters share one accessible labeled control",()=>{
 assert.match(app,/function filterField\(/);
 for(const id of ["reporting-period","reporting-anchor","reporting-from","reporting-to","period","range-from","range-to","tax","search","task-mode"])assert.ok(app.includes('id="'+id+'"')||app.includes('id=\\"'+id+'\\"'),id);
 assert.match(app,/class="moon-filter-group/);
 assert.match(app,/class="moon-filter-label"/);
 assert.match(app,/class="filters moon-filter-bar"/);
 assert.match(app,/return fields\?'<div class="filters moon-filter-bar"/);
});

test("component sizes and responsive layouts come from shared design tokens",()=>{
 for(const token of ["--moon-button-height:42px","--moon-control-height:44px","--moon-button-small-height:34px","--moon-card-radius:16px","--moon-section-gap:24px"])assert.ok(css.includes(token),token);
 assert.match(css,/\.moon-filter-group\{/);
 assert.match(css,/\.moon-filter-group\.moon-filter-date/);
 assert.match(css,/@media\(max-width:720px\)/);
 assert.match(css,/@media\(max-width:390px\)/);
 assert.match(css,/\.account-layout/);
 assert.match(css,/\.day-summary/);
});

test("action and metric pictograms use reusable outline SVG rather than emoji-only controls",()=>{
 assert.match(ux,/function polishActions\(/);
 assert.match(ux,/const actionIcons=/);
 assert.match(css,/stroke-width:1\.8/);
 assert.match(ux,/polishActions\(shell\)/);
 assert.match(app,/function metricIcon\(/);
 assert.match(app,/metricIcon\(icon\)/);
 assert.match(css,/\.moon-action-icon svg/);
 assert.match(css,/\.moon-metric-icon svg/);
});

test("MOON stays light-only with unchanged backend entrypoints",()=>{
 assert.match(html,/moon-2026\.css\?v=1\.2/);
 assert.match(html,/ux-overhaul\.js\?v=2\.2/);
 assert.match(html,/app\.js\?v=33\.1/);
 assert.doesNotMatch(app,/themePreference/);
 assert.match(app,/document\.documentElement\.dataset\.theme="light"/);
 assert.match(app,/window\.MOON_CLOUD_BRIDGE/);
});
