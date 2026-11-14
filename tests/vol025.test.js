'use strict';
const assert=require('node:assert/strict');
const O=require('../www/ai-orchestrator.js');
const C=require('../www/core.js');
const today='2026-11-14';
const greeting='سلام', question='چقدر امروز فروش داشتیم';
const g=O.fastIntent(greeting), s=O.fastIntent(question);
assert.equal(g.kind,'greeting');
assert.deepEqual(s,{kind:'basic-total',metric:'sales',period:'today'});
assert.equal(O.fastIntent('فروش و سود امروز چقدر بود؟'),null);
assert.equal(O.fastIntent(question,{finance:{}}),null);
assert.ok(O.fastPrompt(greeting,g).length<O.planPrompt(greeting,[],today).length/4);
assert.ok(O.fastPrompt(question,s).length<O.planPrompt(question,[],today).length/2);
const request={metric:'sales',mode:'total',period:'today'};
const plan={kind:'read',requests:[request]};
let reads=0,calls=[],responses=[],allow={money:true,balances:true,cost:true,reports:true,warehouse:true};
const h={valid:()=>true,today:()=>today,permissions:()=>allow,generate:async(p)=>{calls.push(p);assert.ok(responses.length);return JSON.stringify(responses.shift());},read:r=>{reads++;assert.deepEqual(r,request);return {text:'فروش امروز: ۸۰۰ ریال',data:{metric:'sales',value:800,scope:'today'},details:[],actions:[]};}};
async function run(q,...r){responses=r;calls=[];reads=0;return O.run(q,[],{},h);}
(async()=>{
 let r=await run(greeting,{kind:'answer',text:'سلام!'});assert.equal(r.text,'سلام!');assert.equal(reads,0);assert.equal(calls.length,1);
 r=await run(question,plan);assert.equal(r.data.kind,'tool-result');assert.equal(calls.length,0);assert.equal(reads,1);assert.match(r.text,/۸۰۰/);
 r=await run(question,{kind:'read',requests:[{...request,period:'yesterday'}]},plan,{kind:'answer',text:'گزارش را بررسی کنید.'});assert.equal(calls.length,0);assert.equal(reads,1);
 allow={};r=await run(question,plan);assert.equal(r.data.kind,'denied');assert.equal(reads,0);
 console.log('v025: compact genuine model prompts and direct verified short totals, permission enforcement passed (mock native output)');
})().catch(e=>{console.error(e);process.exitCode=1;});
