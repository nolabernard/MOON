"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const s=fs.readFileSync(require('node:path').join(__dirname,'..','app.js'),'utf8');
test('reporting has independent period filters',()=>{assert.match(s,/function reportingBounds\(/);assert.match(s,/function reportingOpportunities\(/);assert.match(s,/id="reporting-period"/);assert.match(s,/id="reporting-anchor"/);assert.match(s,/id="reporting-from"/);assert.match(s,/id="reporting-to"/)});
test('revenue breakdowns share report scope',()=>{assert.match(s,/const source=page==="reporting"\?reportingOpportunities\(\):scoped\(\)/);assert.match(s,/items:reportingOpportunities\(\)\.filter/);assert.match(s,/const ops=reportingOpportunities\(\),won=/)});
