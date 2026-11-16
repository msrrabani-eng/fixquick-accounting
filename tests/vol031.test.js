'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('../www/core.js'),F=require('../www/finance-scenario.js'),M=require('../www/math-assistant.js');
require('../www/smartguard.js');require('../www/smartsearch.js');const A=require('../www/assistant-brain.js'),O=require('../www/offline-advisor.js');
C.setUnit('toman');let n=0;const eq=(x,y)=>{assert.equal(x,y);n++;},ok=x=>{assert.ok(x);n++;};
const q='من با علی یک حسابی دارم ۳ ماه پیش گوشی بهش دادم به ارزش ۴۰۰ میلیون تومان و تا اللن پرداختی نداشته اللن تازه میخواد ماهیانه ۵۰ میلیون به من بده حالا ببین اگر بابت هر ماهی که به من بدهکار بوده و پرداختی نداشته ۷ درصد به ماندش اظافه کنم و از زمانی که پرداختی داره ماهی ۵ درصد اظافه کنم محاسباته اقساط ماهیانه چطور میشه';
const r=M.tryMath(q);eq(r.data.kind,'debt-schedule');eq(r.data.due,4900172000);eq(r.data.count,14);eq(r.data.total,6902689393);eq(r.rows.at(-1).closing,0);eq(r.rows.at(-1).payment,402689393);eq(r.data.total,r.data.principal+r.data.interest);ok(r.details.some(x=>x.includes('اللن')));
eq(M.normalize('علی ۴۰۰ میلیون تومان و ۷ درصد اظافه',['اظافه']).text,'علی 400 میلیون تومان و 7 درصد اظافه');
eq(M.tryMath('ماهی ۶۰ میلیون تومان قسط',r.ctx).data.total,6456884737);
eq(M.tryMath('قسط اول امروز',r.ctx).data.total,6443513464);
let p=M.tryMath('۶ درصد',r.ctx);eq(p.data.kind,'clarify');eq(M.tryMath('دوره اقساط',p.ctx).ctx.mathDebt.payBp,600);
eq(M.tryMath('به ۴۰۰ میلیون تومان ۷ درصد اظافه کن',r.ctx).data.value,4280000000);
eq(M.tryMath('۷ درصد از ۴۰۰ میلیون تومان چقدر میشه').data.value,280000000);
eq(M.tryMath('از ۱۰۰ میلیون تومان به ۱۲۰ میلیون تومان چند درصد رشد کرد').data.exact.join('/'),'20/1');
eq(M.tryMath('قیمت خرید ۱۰۰ میلیون تومان قیمت فروش ۱۲۰ میلیون تومان حاشیه سود چقدر').data.exact.join('/'),'50/3');
eq(M.tryMath('بدهی ۲۰۰ میلیون تومان، ماهانه ۲۰ میلیون تومان اقساط، ۵ درصد سود روی مانده، چند ماه تا تسویه؟').data.count,15);
eq(M.tryMath('۴۰۰ میلیون تومان بدهی، ۳ ماه بدون پرداخت، پس از شروع پرداخت ۵ درصد و سود دوره تأخیر ۷ درصد روی مانده، ماهانه ۵۰ میلیون تومان چند قسط؟').data.total,r.data.total);
eq(M.tryMath('۴۰۰ میلیون تومان بدهی، ۳ ماه بدون پرداخت، سود ۷ درصد و ۵ درصد، ماهانه ۵۰ میلیون تومان چند قسط؟').data.kind,'clarify');
for(const [s,v] of [['(۲+۳)×۴','20/1'],['۲^۳^۲','512/1'],['-۲^۲','-4/1'],['2^-3','1/8'],['0.1+0.2','3/10'],['7%*400','28/1'],['۱/۳+۲/۳','1/1']])eq(M.expression(s).map(String).join('/'),v);
for(const s of ['1/0','2^999','2+','((2)','process.exit()','2**3']){assert.throws(()=>M.expression(s));n++;}
eq(M.tryMath('فروش امروز چقدر است'),null);eq(M.tryMath('محاسبه سود معامله'),null);
const model=r.ctx.mathDebt;
eq(M.schedule({...model,principal:1000000,delay:0,payBp:0,payment:300000}).count,4);
eq(M.schedule({...model,payment:1}).ok,false);eq(M.schedule({...model,payment:-1}).ok,false);
for(let k=1;k<=250;k++){
 const d={principal:1000000+k*12345,delay:k%6,delayBp:k%901,payBp:k%601,payment:250000+k*5000,timing:k%2?'start':'end',delayMethod:k%3?'compound':'simple'};
 const x=M.schedule(d);ok(x.ok);eq(x.rows.at(-1).closing,0);eq(x.total,x.principal+x.interest);
 eq(x.rows.reduce((s,t)=>s+t.payment,0),x.total);
 for(const t of x.rows){eq(t.opening+t.interest-t.payment,t.closing);ok(t.closing>=0);}
}
(async()=>{
const st=C.emptyState();C.migrate(st);const snap=JSON.stringify(st);const h={state:()=>st,valid:()=>true,permissions:()=>({reports:true,cost:true,balances:true,money:true,warehouse:true}),today:()=>'2026-11-16',read:x=>A.structuredRead(st,x,{today:'2026-11-16',allow:{reports:true,cost:true,balances:true,money:true,warehouse:true}})};
eq((await O.run(q,{},h)).data.total,r.data.total);eq(JSON.stringify(st),snap);
const code=fs.readFileSync('www/math-assistant.js','utf8');assert.doesNotMatch(code,/\beval\s*\(|new Function|fetch\s*\(|WebSocket|XMLHttpRequest|https?:\/\//);n++;
for(const path of ['www/index.html','www/sw.js'])ok(fs.readFileSync(path,'utf8').includes('math-assistant.js'));
ok(fs.readFileSync('www/smart-ui.js','utf8').includes('smartMathTable(m.rows)'));
console.log('v031 offline math: '+n+' assertions passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
