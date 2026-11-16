'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),L=require('../www/license.js');
let n=0;const eq=(a,b)=>{assert.equal(a,b);n++;},ok=a=>{assert.ok(a);n++;};
eq(L.FREE_LIMIT,50);eq(L.CHAT_FREE_LIMIT,50);eq(L.PRICE_TEXT,'۳٬۷۵۰٬۰۰۰ تومان (۳۷٬۵۰۰٬۰۰۰ ریال)');eq(L.TERM_DAYS,365);
const settings={usedDocs:0};let local=null;
for(let i=0;i<50;i++){const d=L.chatDecision(false,settings,local);ok(d.allowed);eq(d.next,i+1);ok(d.consume);local=String(d.next);settings.usedChat=d.next;eq(L.chatLeft(settings,local),49-i);}
eq(L.chatDecision(false,settings,local).allowed,false);eq(settings.usedDocs,0);
eq(L.chatCount({},local),50);eq(L.chatCount(settings,null),50);eq(L.chatCount({usedChat:3},'49'),49);eq(L.chatCount({usedChat:1000},null),50);eq(L.chatCount({usedChat:-2},'bad'),0);
const active=L.chatDecision(true,settings,local);ok(active.allowed);eq(active.consume,false);eq(active.next,50);
eq(L.chatDecision(false,{usedDocs:50,usedChat:0},null).allowed,true);
eq(L.chatDecision(false,{usedDocs:0,usedChat:50},null).allowed,false);
eq(L.countDocs({invoices:[],expenses:[],tx:[]}),0);
const pages=fs.readFileSync('www/pages.js','utf8'),ui=fs.readFileSync('www/smart-ui.js','utf8');
const section=pages.slice(pages.indexOf('function chatStoredUsage'),pages.indexOf('async function paywall(blocked)'));
const gate=pages.slice(pages.indexOf('function gate()'),pages.indexOf('function chatStoredUsage'));
ok(gate.includes('freeLeft() > 0'));ok(!gate.includes('chat'));
const storage=new Map(),S={settings:{usedDocs:12}},events=[];let licOk=false,expired=false;
const sandbox=vm.createContext({License:L,S,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},licOk,licExpired:()=>expired,fa:String,save:async()=>true,toast:(...a)=>events.push(a)});
vm.runInContext(section,sandbox);
(async()=>{
for(let i=0;i<50;i++)ok(await vm.runInContext('chatReserve()',sandbox));
eq(await vm.runInContext('chatReserve()',sandbox),false);eq(S.settings.usedDocs,12);eq(S.settings.usedChat,50);
S.settings={usedDocs:8};eq(vm.runInContext('chatFreeLeft()',sandbox),0);eq(await vm.runInContext('chatReserve()',sandbox),false);
sandbox.licOk=true;ok(await vm.runInContext('chatReserve()',sandbox));expired=true;eq(await vm.runInContext('chatReserve()',sandbox),false);
ok(ui.includes("paywall('chat')"));ok(ui.includes('await chatReserve()'));ok(ui.includes('if(alerts&&!limited'));ok(ui.includes('chatUsageText()'));ok(ui.includes('PDF پاسخ'));
ok(pages.includes('هزینه اشتراک سالانه'));ok(pages.includes("blocked==='chat'"));
console.log('v033 independent trial: '+n+' checks passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
