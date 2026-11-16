'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../www/core.js'),L=require('../www/license.js'),G=require('../www/smartguard.js'),E=require('../www/entity-guard.js');
const read=p=>fs.readFileSync(p,'utf8');
const removed=['cheque-assistant.js','assistant-brain.js','finance-scenario.js','report-assistant.js','math-assistant.js','offline-advisor.js','chat-format.js','hybrid-math.js','local-math.js','smart-ui.js'];
for(const name of removed){assert.equal(fs.existsSync('www/'+name),false,name);for(const p of ['www/index.html','www/sw.js'])assert.ok(!read(p).includes(name),p+' '+name);}
for(const p of ['local-math','tools/install_math_engine.py','tools/install_storage_cleanup.py','migration/RetiredStorageCleanup.java'])assert.equal(fs.existsSync(p),false,p);
for(const p of ['www/pages.js','www/index.html','www/sw.js','www/help.js','www/ui2.css','www/app.css','www/license.js','www/safety-ui.js']){
 const s=read(p);assert.doesNotMatch(s,/pageSmartAssistant|#\/assistant|FQLocalMath|FQAdvisor|FQMath|Qwen|chatUsageText|chatReserve|CHAT_FREE_LIMIT|usedChat|دستیار حسابداری|fq-chat-|ui20-chat|ui20-scroll/,p);
}
assert.equal(L.FREE_LIMIT,50);assert.match(L.PRICE_TEXT,/۳٬۷۵۰٬۰۰۰/);assert.equal(L.chatDecision,undefined);
const st=C.emptyState();st.settings.usedChat=50;const before=JSON.stringify(st);
assert.equal(L.countDocs(st),0);assert.equal(JSON.stringify(st),before);
const p=C.addPerson(st,{name:'علی رضایی',phone:'09121234567'}).person;
assert.ok(E.find(st,'person',{name:'علی رضایی'}).length);
st.tx.push({id:987,personId:p.id,type:'receipt',kind:'credit',amount:100,date:'2026-11-16',acct:1});
assert.ok(G.preflight(st,'tx',{personId:p.id,type:'receipt',amount:100,date:'2026-11-16',acct:1},{today:'2026-11-16'}).some(r=>r.code==='duplicate-tx'));
const box=vm.createContext({Core:C,S:st,today:()=> '2026-11-16',isAdmin:()=>true,ico:()=>'',fa:String,esc:String});
vm.runInContext(read('www/safety-ui.js'),box);assert.equal(vm.runInContext('pageSafety().title',box),'کنترل خطا');
for(const n of ['core.js','smartsearch.js','smartguard.js','entity-guard.js','safety-ui.js','drafts.js','ledger.js','reports.js','license.js','search-viewport.js','mixed-ui.js']){assert.ok(read('www/index.html').includes(n),n);assert.ok(read('www/sw.js').includes(n),n);}
const wf=read('.github/workflows/build-apk.yml');assert.doesNotMatch(wf,/install_math_engine|sdkmanager "ndk|externalNativeBuild|install_storage_cleanup/);assert.match(wf,/Check the APK is signed with the fixed key/);assert.match(wf,/assert b'FqMathPlugin' not in data/);
console.log('v042: no assistant route, assets, engine, or quota; accounting safety, document limit, price, prior settings compatibility, search and signing retained');
