'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../www/core.js'),F=require('../www/chat-format.js');let n=0;
const eq=(a,b)=>{assert.equal(a,b);n++;};const ok=a=>{assert.ok(a);n++;};
const at=new Date(2026,10,16,18,5,0).getTime();
eq(F.stamp(at,C),'۱۴۰۵/۰۸/۲۵ · ۱۸:۰۵');eq(F.stamp(null,C),'');
eq(F.amount(4000000000,'toman',C),'۴۰۰,۰۰۰,۰۰۰');eq(F.amount(4000000000,'rial',C),'۴,۰۰۰,۰۰۰,۰۰۰');
eq(F.amount(402689393,'toman',C),'۴۰,۲۶۸,۹۳۹.۳');
eq(F.amount(-3,'toman',C),'-۰.۳');
const row={phase:'payment',month:14,opening:383513708,interest:19175685,payment:402689393,closing:0};
const m={role:'assistant',at,unit:'toman',text:'نتیجه تسویه',source:'موتور محاسبه آفلاین',details:['شرح کامل'],rows:[row]};
const copy=F.copyText(m,C);for(const t of ['نتیجه تسویه','۱۸:۰۵','شرح کامل','موتور محاسبه آفلاین','جدول محاسبات (تومان)','قسط ۱۴','۴۰,۲۶۸,۹۳۹.۳'])ok(copy.includes(t));
eq(F.pageLimit(600,false),300);ok(F.pageLimit(250,false)<250);ok(F.pageLimit(600,true)>F.pageLimit(600,false));ok(F.pageLimit(100,true)>0);
const measure={measureText:s=>({width:[...s].length*10})};eq(F.wrap(measure,'abcdefghijklmnop',40).join(''),'abcdefghijklmnop');eq(F.wrap(measure,'سلام\nدنیا',100).join('|'),'سلام|دنیا');
function fakeCanvas(w,h){const calls=[],ctx={measureText:measure.measureText,fillRect(){},strokeRect(){},save(){},restore(){},drawImage(){},fillText(s,x,y){calls.push({s,x,y});}};return {width:w,height:h,calls,getContext:()=>ctx};}
(async()=>{
 const records=[],long={...m,rows:Array.from({length:120},(_,i)=>({...row,month:i+1})),details:['متن آزمایشی '.repeat(800)]};
 const imgs=await F.drawPdf([{role:'user',at,text:'سؤال اصلی'},long],{core:C,createCanvas:fakeCanvas,logo:null,valid:()=>true,encode:c=>{records.push(c.calls.slice());return new Uint8Array([255,216,255,217]);}});
 ok(imgs.length>5);eq(records.length,imgs.length);
 const calls=records.flat();ok(calls.some(x=>x.s==='سؤال اصلی'));ok(calls.some(x=>x.s==='قسط ۱۲۰'));eq(calls.filter(x=>/^قسط [۰-۹]+$/.test(x.s)).length,120);ok(calls.every(x=>x.y>=0&&x.y<=1754));ok(records.every(page=>page.some(x=>x.s.includes('صفحه'))));
 await assert.rejects(F.drawPdf([],{core:C,valid:()=>true}));n++;
 await assert.rejects(F.drawPdf([m],{core:C,valid:()=>false}));n++;
 // Verify PDF byte assembly using the existing app engine (mock JPEG payload only).
 const sandbox=vm.createContext({TextEncoder,Uint8Array});vm.runInContext(fs.readFileSync('www/print.js','utf8'),sandbox);
 const pdf=vm.runInContext('imagesToPdf',sandbox)(imgs,595.28,841.89);const str=Buffer.from(pdf).toString('latin1');ok(str.startsWith('%PDF-1.4'));ok(str.includes('/Count '+imgs.length));ok(str.includes('/MediaBox [0 0 595.28 841.89]'));ok(str.endsWith('%%EOF'));
 const ui=fs.readFileSync('www/smart-ui.js','utf8'),css=fs.readFileSync('www/ui2.css','utf8');
 for(const token of ['data-chat-copy','data-chat-pdf','id="fq-chat-pdf"','id="fq-chat-expand"','scrollHeight','smartDraft=box.value','Date.now()','FQChatFormat.drawPdf','imagesToPdf(imgs,595.28,841.89)','navigator.clipboard','smartAccess(owner)','smartEditorDispose','keyboardReduced'])ok(ui.includes(token));
 ok(!ui.includes('smartTalk.slice(-16)'));ok(css.includes('grid-template-rows:auto minmax(0,1fr) auto'));ok(css.includes('fq-chat-expanded'));ok(css.includes('body.fq-chat-typing:has(#main[data-page=assistant]) .nav{display:none}'));
 for(const p of ['www/index.html','www/sw.js'])ok(fs.readFileSync(p,'utf8').includes('chat-format.js'));
 // User change must clear both drafts and history, even when no DOM exists.
 const uiSandbox=vm.createContext({curName:()=> 'owner',isAdmin:()=>true,can:()=>true,routeAllowed:()=>true});
 vm.runInContext(ui,uiSandbox);vm.runInContext("smartResetForUser();smartTalk=[{text:'private'}];smartDraft='private';smartExpanded=true",uiSandbox);uiSandbox.curName=()=> 'another';vm.runInContext('smartResetForUser()',uiSandbox);eq(vm.runInContext('smartTalk.length',uiSandbox),0);eq(vm.runInContext('smartDraft',uiSandbox),'');eq(vm.runInContext('smartExpanded',uiSandbox),false);
 console.log('v032 chat workspace: '+n+' assertions passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
