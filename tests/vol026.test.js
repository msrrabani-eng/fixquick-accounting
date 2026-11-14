'use strict';
const assert=require('node:assert/strict');
const C=require('../www/core.js');require('../www/smartguard.js');
const A=require('../www/assistant-brain.js'),O=require('../www/ai-orchestrator.js');
C.setUnit('rial');
const today='2026-11-14', yesterday='2026-11-13';
const st=C.emptyState(),p=C.addPerson(st,{name:'مشتری نمونه'}).person,g=C.addProduct(st,{name:'کابل نمونه'}).product;
let id=100;
function doc(type,date,qty,price){st.invoices.push({id:id++,type,date,personId:p.id,items:[{productId:g.id,qty,price}],discount:0,vatRate:0});}
doc('sale',yesterday,5,200);doc('sale_return',yesterday,1,200);doc('sale',today,3,300);
const before=JSON.stringify(st);
let allow={reports:true,money:true,cost:true,warehouse:true,balances:true},reads=[],calls=0,alive=true;
const h={valid:()=>alive,today:()=>today,permissions:()=>allow,read:req=>{reads.push(req);return A.structuredRead(st,req,{today,allow});},generate:async()=>{calls++;return '{"kind":"answer","text":"پاسخ واقعی مدل آزمایشی"}';}};
const q='دیروز چقدر فروش داشتیم';
async function run(question,context={}){reads=[];calls=0;return O.run(question,[],context,h);}
(async()=>{
 for(const v of [q,'چقدر دیروز فروش داشتیم','فروش دیروز چقدر بود؟','جمع فروش دیروز','دیروز فروش چقدره']){
  const out=await run(v);assert.equal(calls,0,v);assert.equal(reads.length,1,v);assert.equal(reads[0].period,'yesterday',v);assert.equal(out.data.kind,'tool-result',v);
  assert.equal(A.structuredRead(st,reads[0],{today,allow}).data.value,800);assert.match(out.text,/۸۰۰|800/);assert.match(out.source,/بدون پردازش مدل/);
 }
 const current=await run('امروز چقدر فروش داشتیم');assert.equal(calls,0);assert.equal(reads[0].period,'today');assert.equal(A.structuredRead(st,reads[0],{today,allow}).data.value,900);assert.match(current.text,/۹۰۰|900/);
 for(const s of ['فروش و سود دیروز چقدر بود','فروش علی دیروز چقدر بود','فروش دیروز چرا کم شد','فروش فردا چقدر خواهد بود','اگر فروش دیروز چقدر بود','فروش دیروز چقدر بود و ثبت کن','سود این ماه نسبت به ماه قبل چطوره','فروش ماه قبل به مشتری علی چقدر بود'])assert.equal(O.directReport(s),null,s);
 assert.equal(O.directReport(q,{finance:{}}),null);
 assert.equal(O.directReport(q,{weighted:{}}),null);
 allow.reports=false;let out=await run(q);assert.equal(out.data.kind,'denied');assert.equal(calls,0);assert.equal(reads.length,0);allow.reports=true;
 allow.cost=false;out=await run('این ماه چقدر سود داشتیم');assert.equal(out.data.kind,'denied');assert.equal(reads.length,0);allow.cost=true;
 out=await run('سلام');assert.equal(calls,1);assert.equal(reads.length,0);assert.match(out.text,/پاسخ واقعی/);
 out=await run('چرا فروشم کم شده و چه پیشنهادی داری؟');assert.equal(calls,1);assert.equal(reads.length,0);
 alive=false;await assert.rejects(run(q),/دسترسی/);assert.equal(reads.length,0);alive=true;
 assert.equal(JSON.stringify(st),before);
 console.log('v026: observed yesterday-sales wording, actual nonzero ledger totals/returns, exact dates, zero native calls, permissions, ambiguous questions remain model-driven, no writes passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
