"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const src=fs.readFileSync(path.join(__dirname,"..","visitor.js"),"utf8");
test("active visitor links offer copying or explicitly labelled legacy renewal",()=>{
 assert.match(src,/data-action="visitor-recover"/);
 assert.match(src,/Renouveler et copier/);
 assert.match(src,/l\.recoverable\?"Copier"/);
});
test("legacy renewal warns before invalidating the previously shared link",()=>{
 assert.match(src,/btn\.dataset\.legacy==="true"/);
 assert.match(src,/ancienne adresse/);
 assert.match(src,/response\.rotated/);
});
test("recovered links are copied and remain available in the UI",()=>{
 assert.match(src,/call\("recover",\{id:btn\.dataset\.id\},jwt\)/);
 assert.match(src,/navigator\.clipboard\.writeText\(createdLink\)/);
 assert.match(src,/Lien retrouvé/);
});
