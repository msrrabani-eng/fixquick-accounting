'use strict';
const assert=require('node:assert/strict'),H=require('../www/hybrid-math.js'),M=require('../www/local-math.js');
(async()=>{
const q='من یک گوشی 175 میلیون تومان خریدم و ۳۱۵ میلیون تومان فروختم. ۵ میلیون هزینه کردم و ۱۰ میلیون تخفیف دادم. چقدر سود کردم و اگر مانده مبلغ رو یخوام اقساط ۵ ماهه ماهی ۲ درصد انجام بدم چقدر سود کردم و چطور باید قسط بگیرم.';
let calls=0;global.Capacitor={Plugins:{FqLocalMath:{solve:async()=>{calls++;return {text:'۱۰۵ میلیون تومان',ms:100};}}}};
let r=await M.solve(q,[],'1405/08/25');assert.equal(r.data.kind,'clarify');assert.equal(r.ctx.hybridPending.profit,1250000000);assert.match(r.text,/۱۲۵/);assert.equal(calls,0);
let next=await M.solve('۲۰۰ میلیون تومان نقد گرفته ام',[],'1405/08/25',r.ctx);assert.equal(next.data.totalProfit,1355000000);assert.equal(next.data.each,231000000);assert.equal(next.data.interest,105000000);
let no=await M.solve('۲۰۰ میلیون تومان',[],'1405/08/25',r.ctx);assert.equal(no.data.kind,'clarify');
let full=q.replace('اگر مانده مبلغ','۲۰۰ میلیون تومان نقد گرفتم و اگر مانده مبلغ');r=await M.solve(full,[],'1405/08/25');assert.equal(r.data.each,231000000);
const bare='من یه گوشب خریدم ۲۸۰ تومن و ۳۱۵ تومن فرختم ولی ۵ تومن خرجش کردم و مشتری هم ۱۰ تومن تخفیف گرفت. چقد سود کردم و چند درص میشه نسبت به خرید؟';r=await M.solve(bare,[],'1405/08/25');assert.equal(r.data.profit,200000000);
const ch='رفتم مغازه مهدی برای ۶ ماه دیگه ۵۰۰ میلیون تومان چک دادم واسه دو ماه دیگه ۲۰۰ میلیون تومان چک از قبل دارم چقد باید تا پایان سال در بیارم';assert.equal((await M.solve(ch,[],'1405/08/25')).data.total,2000000000);
const plan={kind:'trade',buy:0,sell:1,cost:[2],discount:[3],cash:null,remaining:null,rate:0,term:0,downRate:null};
assert.equal(H.evaluate(q,JSON.stringify(plan)).ctx.hybridPending.profit,1250000000);
for(const p of [{...plan,buy:1,sell:0},{...plan,cost:[0]},{...plan,discount:[]},{...plan,cash:4},{...plan,amount:105}])assert.equal(H.evaluate(q,JSON.stringify(p)).ctx.hybridPending,undefined);
assert.equal(H.evaluate(q,'۱۰۵ میلیون تومان').data.kind,'clarify');
assert.equal((await M.solve('یک سؤال مالی ناشناخته',[],'1405/08/25')).data.kind,'clarify');assert.equal(calls,1);
console.log('v040 exact arithmetic, missing-payment follow-up, installments, cheque date, and semantic-plan validation passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
