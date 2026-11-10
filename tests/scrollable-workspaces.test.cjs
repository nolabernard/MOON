"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const app=fs.readFileSync(path.join(__dirname,"..","app.js"),"utf8"),css=fs.readFileSync(path.join(__dirname,"..","styles.css"),"utf8"),html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
test("all four requested pages use a bounded workspace",()=>{for(const p of ["opportunities","contacts","tasks","reporting"])assert.match(app,new RegExp('"'+p+'"'));assert.match(app,/workspace-main/);assert.match(app,/workspace-view workspace-/)});
test("tables and task list scroll independently with sticky table headings",()=>{assert.match(css,/\.workspace-opportunities \.table-wrap/);assert.match(css,/\.workspace-contacts \.table-wrap/);assert.match(css,/\.workspace-tasks \.panel>\.stack/);assert.match(css,/position:sticky;top:0/);assert.match(css,/\.workspace-reporting\{overflow-y:auto\}/)});
test("mobile retains native scrolling and cache versions are bumped",()=>{assert.match(css,/@media\(max-width:720px\)\{\.workspace-view/);assert.match(html,/styles\.css\?v=6\.0/);assert.match(html,/app\.js\?v=32\.1/)});
