"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,".."),load=p=>fs.readFileSync(path.join(root,p),"utf8");
const visitor=load("visitor.js"),edge=load("supabase/functions/moon-visitor-access/index.ts"),app=load("app.js");
test("guest access can select and later modify sections",()=>{
 assert.match(visitor,/data-visitor-permission/);
 assert.match(visitor,/visitor-create/);
 assert.match(visitor,/visitor-edit/);
 assert.match(visitor,/visitor-save/);
 assert.match(visitor,/call\("update",\{id:btn\.dataset\.id,allowedSections:requestedSections\},jwt\)/);
 assert.match(visitor,/selectedPermissions/);
});
test("server filters snapshots before returning them to guests",()=>{
 assert.match(edge,/function filteredSnapshot/);
 assert.match(edge,/content: filteredSnapshot\(full\.data\.content,allowedSections\)/);
 assert.match(edge,/allowed_sections,permissions_version/);
 assert.match(edge,/knownPermissionsVersion/);
 assert.match(edge,/permissions_version:existing\.data\.permissions_version\+1/);
 assert.match(edge,/validSections\(input\.allowedSections\)/);
});
test("visitor navigation is restricted and polling is one minute",()=>{
 assert.match(app,/if\(isReadOnly\(\)&&!window\.MOON_VISITOR\?\.pageAllowed\?\.\(k\)\)return ""/);
 assert.match(visitor,/\},60000\);/);
 assert.match(visitor,/pageAllowed\(key\)/);
});
