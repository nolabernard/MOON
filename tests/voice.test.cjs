const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"..","voice.js"),"utf8");
function setup(){
 const window={};
 const document={getElementById(){return null}};
 vm.runInNewContext(source,{window,document,Date,Intl,console});
 return window.MOON_VOICE;
}
test("French dictation extracts contact, training, amount and next weekday",()=>{
 const voice=setup();
 const base=new Date(2026,10,5);
 const p=voice.parse("Ajoute un contact Sophie Martin de l'entreprise Nexity, intéressée par une VAE en immobilier à 5980 euros, à rappeler mardi prochain.",base);
 assert.equal(p.first,"Sophie");
 assert.equal(p.last,"Martin");
 assert.equal(p.category,"VAE");
 assert.equal(p.amount,"5980");
 assert.equal(p.due,"2026-11-10");
});
test("Tomorrow and explicit dates are interpreted locally",()=>{
 const voice=setup(),base=new Date(2026,10,5);
 assert.equal(voice.dateFromSpeech("rappeler demain",base),"2026-11-06");
 assert.equal(voice.dateFromSpeech("rappeler le 12 novembre",base),"2026-11-12");
 assert.equal(voice.dateFromSpeech("rappeler le 32 novembre",base),"");
});
test("No implicit VAT conversion or persistence during parsing",()=>{
 const voice=setup();
 const p=voice.parse("Contact Marie Dupont intéressée par une VAE à 5000 euros TTC");
 assert.equal(p.amount,"5000");
 assert.equal(p.vatMode,"ttc");
 assert.equal(p.kind,"opportunity");
});
test("Task dictation is identified",()=>{
 const voice=setup();
 const p=voice.parse("Rappeler Sophie Martin vendredi");
 assert.equal(p.kind,"task");
 assert.ok(p.title);
});
