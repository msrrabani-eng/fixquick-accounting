'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('../www/core.js');require('../www/smartguard.js');const A=require('../www/assistant-brain.js');C.setUnit('rial');
const TODAY='2026-11-14',opts={today:TODAY,allow:{reports:true,cost:true,balances:true,money:true,warehouse:true}};
const st=C.emptyState();const names=['علی رضایی','مریم کاظمی','رضا کریمی','نرگس احمدی','فروشگاه پارس'];const people=names.map(name=>C.addPerson(st,{name}).person);const goods=['کابل آلفا','شارژر بتا','گلس گاما','قاب دلتا','هندزفری سیگما'].map(name=>C.addProduct(st,{name}).product);
const dates=['2026-10-05','2026-10-25','2026-11-10','2026-11-13',TODAY];
// Fixed known-cost inventory, transactions vary across dates and people; returns, discounts, VAT, cancellations and future data.
let seq=1000;const doc=(date,type,p,g,qty,price,discount=0,vatRate=0)=>{const i={id:seq++,no:String(seq),date,type,personId:p.id,items:[{productId:g.id,qty,price}],discount,vatRate};st.invoices.push(i);return i;};
const tx=(date,p,kind,amount,type)=>st.tx.push({id:seq++,date,personId:p.id,kind,amount,type,acct:1});
for(let j=0;j<5;j++){doc('2026-09-01','purchase',people[j],goods[j],1000,100*(j+1));tx('2026-09-01',people[j],j%2?'credit':'debit',100000*(j+1),'opening');}
for(let d=0;d<5;d++)for(let j=0;j<5;j++){
 const p=people[j],g=goods[j],date=dates[d],qty=(d+2)*(j+1),sale=doc(date,'sale',p,g,qty,1000*(6-j),10*(j+1),10);tx(date,p,'debit',sale.items[0].qty*sale.items[0].price-sale.discount,'sale');
 doc(date,'purchase',p,g,j+d+1,100*(j+1));tx(date,p,'credit',500*(d+1)*(5-j),'purchase');
 tx(date,p,'credit',100*(j+1)*(d+1),'receipt');tx(date,p,'debit',200*(5-j)*(d+1),'payment');
 if(j===d){doc(date,'sale_return',p,g,1,1000*(6-j));tx(date,p,'credit',1000*(6-j),'sale_return');}
 st.expenses.push({id:seq++,date,title:'هزینه '+j,amount:1000*(j+1)*(d+1)});
}
for(let i=0;i<5;i++){st.cheques.push({id:seq++,cyc:1,state:'box',direction:'receive',title:'چک نمونه '+i,amount:10000*(i+1),dueDate:C.addDays(TODAY,i-1),date:'2026-11-01',done:false});st.cheques.push({id:seq++,cyc:1,state:'issued',direction:'pay',title:'چک پرداخت '+i,amount:20000*(i+1),dueDate:C.addDays(TODAY,i-1),date:'2026-11-01',done:false});}
st.cheques.push({id:seq++,cyc:1,state:'cleared',direction:'receive',amount:999999,dueDate:TODAY,done:true});
// Oracle derives numeric results from fixture facts, not assistant output or its classification.
const periods=[['امروز',TODAY,TODAY],['دیروز','2026-11-13','2026-11-13'],['این ماه','2026-10-23',TODAY],['ماه قبل','2026-09-23','2026-10-22'],['تا حالا',null,TODAY]];
const within=(d,p)=>(!p[1]||d>=p[1])&&d<=p[2];const net=i=>i.items.reduce((s,l)=>s+l.qty*l.price,0)-(i.discount||0);
function val(metric,p,id){const inv=st.invoices.filter(i=>within(i.date,p)&&(!id||i.personId===id));const ts=st.tx.filter(t=>within(t.date,p)&&(!id||t.personId===id));
 if(metric==='turnover')return ts.filter(t=>t.type!=='opening').reduce((s,t)=>s+t.amount,0);
 if(['receipts','payments'].includes(metric))return ts.filter(t=>t.type===(metric==='receipts'?'receipt':'payment')).reduce((s,t)=>s+t.amount,0);
 if(metric==='sales'||metric==='purchases')return inv.reduce((s,i)=>s+(i.type===(metric==='sales'?'sale':'purchase')?1:i.type===(metric==='sales'?'sale_return':'purchase_return')?-1:0)*net(i),0);
 if(metric==='invoice-count')return inv.length;if(metric==='sale-count')return inv.filter(i=>i.type==='sale').length;
 if(metric==='purchase-count')return inv.filter(i=>i.type==='purchase').length;
 if(metric==='expense')return st.expenses.filter(e=>within(e.date,p)).reduce((s,e)=>s+e.amount,0);
 if(metric==='profit'){let gross=0;for(const i of inv){if(i.type==='sale'||i.type==='sale_return'){const l=i.items[0],cost=(goods.findIndex(g=>g.id===l.productId)+1)*100;gross+=(i.type==='sale'?1:-1)*(net(i)-cost*l.qty);}}return gross-val('expense',p);}
 if(metric==='balance'){return st.tx.filter(t=>t.date<=p[2]&&t.personId===id).reduce((s,t)=>s+(t.kind==='debit'?1:-1)*t.amount,0);}
 if(metric==='receivable'||metric==='payable')return Math.max(0,val('balance',p,id)*(metric==='receivable'?1:-1));
 if(metric==='stock'){return st.invoices.filter(i=>i.date<=TODAY&&i.items[0].productId===id).reduce((s,i)=>s+(['purchase','sale_return'].includes(i.type)?1:-1)*i.items[0].qty,0);}
 if(metric==='product-qty'||metric==='product-sales')return st.invoices.filter(i=>within(i.date,p)&&i.items[0].productId===id&&['sale','sale_return'].includes(i.type)).reduce((s,i)=>s+(i.type==='sale'?1:-1)*(metric==='product-qty'?i.items[0].qty:net(i)),0);
 throw Error(metric);
}
const cases=[];function add(q,expected,ctx={}){cases.push({q,expected,ctx});}
function rank(metric,phrases,low=false){for(const p of periods)for(const s of phrases){const rows=(metric.startsWith('product-')?goods:people).map(x=>({id:x.id,value:val(metric,p,x.id)})).filter(x=>x.value>0).sort((a,b)=>(low?a.value-b.value:b.value-a.value)||a.id-b.id);add(s.replace('@',p[0]),{metric,mode:'rank',value:rows[0]?.value||0,...(rows.length?{id:rows[0].id,from:p[1],to:p[2]}:{})});}}
function total(metric,phrases){for(const p of periods)for(const s of phrases)add(s.replace('@',p[0]),{metric,value:val(metric,p),from:p[1],to:p[2]});}
function personal(metric,phrases){for(const person of people)for(const s of phrases){const p=periods[4];add(s.replaceAll('#',person.name),{metric,value:val(metric,p,person.id),personId:person.id,...(metric==='balance'?{to:TODAY}:{mode:'person',from:null,to:TODAY})});}}
// 25 families × 8 natural variants × 5 periods/entities = exactly 1000 distinct questions.
rank('turnover',['@ بیشترین کارکردمون با کی بوده؟','بیشترین گردش حساب @ مال کدوم شخصه؟','@ با چه کسی بیش از همه کارکرد داشتیم','بالاترین کارکرد @ با کیه','گردش حساب کی @ از همه بیشتر بوده','@ کدوم طرف حساب بیشترین گردش رو داشته','بیشترین داد و ستد @ با کی بوده','@ از نظر گردش حساب اول جدول کیه']);
rank('turnover',['@ کمترین کارکرد مال کی بوده؟','گردش حساب چه کسی @ از همه کمتر بوده؟','@ کمترین گردش حساب با کی بوده','کمترین داد و ستد @ با کیه','کمترین کارکرد @ برای کدوم شخصه','@ کدوم شخص کمتر از بقیه کارکرد داشته','@ پایین ترین کارکرد یعنی کمترین گردش با کی بود','کمترین گردش @ رو کدوم طرف حساب داشته'],true);
rank('sales',['@ بیشترین فروش به کدوم مشتری بوده','بالاترین فروش @ به کی بوده؟','@ به کی بیشتر فروختیم','بیشترین مبلغ فروش @ مال کدوم مشتریه','@ فروش به کدوم شخص از همه بیشتر بوده','مشتری با بیشترین خرید از ما @ کیه','@ کدوم مشتری رتبه اول فروشه','@ کدوم خریدار بیش از همه خرید از ما داشته']);
rank('purchases',['@ بیشترین خرید از کی بوده؟','بالاترین مبلغ خرید @ از کدوم فروشنده','@ از چه کسی بیشتر خرید کردیم','بیشترین خریدمون @ از کیه','@ از کدوم تامین کننده بیش از همه خرید داشتیم','خرید @ از چه کسی از همه بیشتر بوده','@ کدوم فروشنده رتبه اول خریده','@ بیشترین مبلغ خرید از کدوم شخص بود']);
rank('invoice-count',['@ بیشترین فاکتور با کی داشتیم؟','بالاترین تعداد فاکتور @ مال کدوم شخصه','@ بیشترین تعداد فاکتور برای کی ثبت شده','تعداد فاکتور کی @ از همه بیشتره','@ رتبه اول تعداد فاکتور کیه','بیشترین تعداد فاکتور @ به اسم کیه','@ کدوم شخص بیش از همه فاکتور داشته','@ اول لیست تعداد فاکتور کدوم شخصه']);
rank('product-sales',['@ بیشترین مبلغ فروش کالا مال چیه؟','بالاترین ارزش فروش محصول @ کدومه','@ کدوم کالا بیشترین مبلغ فروش رو داشته','بیشترین فروش ریالی کالا @ چه جنسی بوده','@ از نظر مبلغ فروش کالا رتبه اول چیه','@ مبلغ فروش کدوم محصول از همه بیشتره','کدوم کالا @ بیش از همه مبلغ فروش داشته','@ مبلغ پرفروش ترین کالا چقدره']);
rank('product-qty',['@ پرفروش ترین کالا از نظر تعداد چیه؟','بیشترین تعداد فروش کالا @ کدومه','@ کدوم جنس بیشتر فروخته شده از نظر تعداد','@ تعداد فروش کدوم محصول از همه بیشتره','بالاترین تعداد فروش کالا @ چیه','@ کدوم کالا از نظر تعداد رتبه اول فروشه','پر فروش ترین محصول @ از نظر تعداد','@ تعداد فروش کدوم کالا بیش از همه بوده']);
rank('receivable',['@ بیشترین طلب از کیه؟','بالاترین طلب @ از کدوم شخصه','@ کی بیشترین بدهی رو به ما داره','@ کی بیشتر بهمون بدهکاره','بیشترین بدهکار @ کیه','طلب @ از کی از همه بیشتره','@ کدوم شخص بیش از همه بدهکاره','@ رتبه اول طلب از اشخاص کیه']);
rank('payable',['@ بیشترین بدهی ما به کیه؟','بالاترین بدهی من @ به کدوم شخصه','@ به کی بیشتر بدهکاریم','@ کدوم بستانکار بیشترین مانده رو داره','بیشترین بستانکار @ کیه','بدهی ما @ به کی از همه بیشتره','@ کدوم شخص بیش از همه بستانکاره','@ رتبه اول بدهی من به اشخاص کیه']);
total('sales',['فروش @ چقدر بوده؟','@ چقدر فروختیم','جمع مبلغ فروش @ رو بگو','فروشمون @ چند بوده','@ فروش خالص چقدره','مجموع فروش @ چقد میشه','@ فروش داشتیم چقدر','حاصل فروش @ رو نشون بده']);
total('purchases',['خرید @ چقدر بوده؟','@ چقدر خرید کردیم','جمع مبلغ خرید @ رو بگو','خریدمون @ چند بوده','@ خرید خالص چقدره','مجموع خرید @ چقد میشه','@ خرید داشتیم چقدر','حاصل خرید @ رو نشون بده']);
total('profit',['سود @ چقدره؟','@ چقدر سود کردیم','جمع سود خالص @ رو بگو','سودمون @ چند بوده','@ سود و زیان چقدر بوده','مجموع سود @ چقد میشه','@ چقدر سود داشتیم','نتیجه سود @ رو دربیار']);
total('expense',['هزینه @ چقدر شده؟','@ چقدر خرج کردیم','جمع مبلغ هزینه @ رو بگو','خرج مون @ چند بوده','@ مخارج چقدره','مجموع هزینه @ چقد میشه','@ هزینه داشتیم چقدر','@ خرج کردیم چقدر']);
total('invoice-count',['@ چند تا فاکتور داریم؟','تعداد فاکتور @ چقدره','جمع تعداد فاکتورها @ رو بگو','@ چند فاکتور ثبت شده','مجموع فاکتورها @ چندتاست','@ تعداد کل فاکتور رو بده','@ فاکتور چندتا ثبت کردیم','چند بار فاکتور @ ثبت شده']);
total('sale-count',['@ چند تا فاکتور فروش داشتیم؟','تعداد فاکتورهای فروش @ چقدره','جمع تعداد فاکتور فروش @ رو بگو','@ چند فاکتور فروش ثبت کردیم','مجموع تعداد فاکتورهای فروش @ چندتاست','@ تعداد کل فاکتور فروش رو بده','@ فاکتور فروش چندتا ثبت کردیم','چند بار فاکتور فروش @ ثبت شده']);
personal('sales',['به # چقدر فروختیم تا حالا؟','فروش به # از اول چقدره','جمع فروش به # رو بگو','فروشمون به # چند بوده','# چقدر خرید از ما داشته','مبلغ فروش به # چقد میشه','از ابتدا به # چقدر فروش داشتیم','فروش خالص به # رو بده']);
personal('purchases',['از # چقدر خرید کردیم تا حالا؟','خرید از # از اول چقدره','جمع خرید از # رو بگو','خریدمون از # چند بوده','# چقدر ازش خرید کردیم','مبلغ خرید از # چقد میشه','از ابتدا از # چقدر خرید داشتیم','خرید خالص از # رو بده']);
personal('turnover',['کارکردمون با # چقدر بوده؟','گردش حساب # از اول چقدره','جمع گردش حساب # رو بگو','کارکرد # چند بوده','با # چقدر داد و ستد داشتیم','گردش # چقد میشه','از ابتدا با # چقدر کارکرد داشتیم','گردش مالی # رو بده']);
personal('balance',['مانده حساب # چقدره؟','از # چقدر طلب داریم','به # چقدر بدهکاریم','# چقد بدهکاره','حساب # تسویه شده؟','مانده # رو بگو','# چقدر بهمون بدهکاره','بدهی حساب # چقدره']);
personal('invoice-count',['فاکتورهای # چندتاست؟','تعداد فاکتور # چقدره','جمع تعداد فاکتور # رو بگو','# چند فاکتور داره','با # چندتا فاکتور داشتیم','فاکتور # چند تا شده','از ابتدا تعداد فاکتور # رو بگو','تعداد کل فاکتورهای # رو بده']);
personal('receipts',['از # چقدر دریافت کردیم؟','دریافتی از # چقدره','جمع دریافت از # رو بگو','از # چقدر پول گرفتیم','# چقدر واریز کرده','مبلغ دریافت از # چقد میشه','از ابتدا از # چقدر دریافت داشتیم','جمع پولی که از # دریافت کردیم']);
personal('payments',['به # چقدر پرداخت کردیم؟','پرداختی به # چقدره','جمع پرداخت به # رو بگو','به # چقدر پول دادیم','به # چقدر واریز کردیم','مبلغ پرداخت به # چقد میشه','از ابتدا به # چقدر پرداخت داشتیم','جمع پولی که به # پرداخت کردیم']);
for(const g of goods)for(const s of ['موجودی # چقدره؟','# چند تا داریم','از # چند عدد تو انبار هست','تعداد # چقدره','الان # چندتا موجود داریم','موجودی فعلی # رو بگو','انبار # چند عدد داره','چند دستگاه # موجوده'])add(s.replace('#',g.name),{metric:'stock',value:val('stock',periods[4],g.id),productId:g.id});
for(const [direction,phrases] of [['receive',['چک دریافتی @ روز آینده چقدر داریم','سررسید چک های دریافتی تا @ روز دیگه','@ روز آینده چقدر چک وصول داریم','جمع چک دریافتی تا @ روز دیگر','چند تا چک دریافتی تا @ روز اینده داریم','چک هایی که گرفتیم تا @ روز چقدره','چک های گرفتنی @ روز آینده','چک دریافتی تا @ روز دیگه رو بگو']],['pay',['چک پرداختی @ روز آینده چقدر داریم','سررسید چک های پرداختی تا @ روز دیگه','@ روز آینده چقدر چک باید پاس کنیم','جمع چک پرداختی تا @ روز دیگر','چند تا چک پرداختی تا @ روز اینده داریم','چک هایی که دادیم تا @ روز چقدره','چک های دادنی @ روز آینده','چک پرداختی تا @ روز دیگه رو بگو']]])for(const days of [1,2,3,7,15])for(const s of phrases){const list=st.cheques.filter(c=>!c.done&&c.direction===direction&&c.dueDate<=C.addDays(TODAY,days));add(s.replace('@',C.toFa(days)),{metric:'cheques',direction,value:list.reduce((v,c)=>v+c.amount,0),count:list.length});}
assert.equal(cases.length,1000);assert.equal(new Set(cases.map(c=>c.q)).size,1000);
const snapshot=JSON.stringify(st),fail=[],log=[];const start=performance.now();let worst=0;
for(const c of cases){const t=performance.now();let r;try{r=A.ask(st,c.q,c.ctx,opts);worst=Math.max(worst,performance.now()-t);for(const [k,v] of Object.entries(c.expected))assert.deepEqual(r.data?.[k],v,k);assert.ok(r.text&&r.text.length>10);if(c.expected.value!==0||c.expected.mode!=='rank'){const m=c.expected.metric,v=c.expected.value;const shown=m==='stock'||m==='product-qty'||m.endsWith('count')?C.fmtQty(v):C.fmt(Math.abs(v));if(m!=='balance'||v!==0)assert.ok(r.text.includes(shown),'rendered answer must contain expected numeric value '+shown);}const entityId=c.expected.personId||c.expected.productId||c.expected.id;if(entityId){const ent=[...people,...goods].find(x=>x.id===entityId);assert.ok(r.text.includes(ent.name),'rendered answer must contain correct entity');} log.push({question:c.q,expected:c.expected,actual:r.data,response:r.text,pass:true});}catch(e){fail.push({q:c.q,expected:c.expected,actual:r?.data,text:r?.text,error:e.message});log.push({question:c.q,expected:c.expected,actual:r?.data,response:r?.text,pass:false,error:e.message});}}
assert.equal(JSON.stringify(st),snapshot,'assistant must not mutate fixture');
if(process.env.FQ_TEST_REPORT)fs.writeFileSync(process.env.FQ_TEST_REPORT,JSON.stringify({count:cases.length,passed:cases.length-fail.length,failed:fail.length,totalMs:performance.now()-start,worstMs:worst,results:log},null,2));
if(fail.length){console.log(JSON.stringify(fail.slice(0,35),null,2));console.log('FAIL',fail.length,'/1000', 'by metric',fail.reduce((o,f)=>(o[f.expected.metric]=(o[f.expected.metric]||0)+1,o),{}));process.exitCode=1;}else console.log('PASS 1000/1000 unique colloquial questions; exact metric/value/entity/period, read-only fixture; slowest '+worst.toFixed(2)+'ms');
// Additional safety and follow-up checks, outside the 1000.
if(!fail.length){const original=A.ask(st,'بیشترین کارکردمون با کی بوده ؟',{},opts);assert.equal(original.data.metric,'turnover');assert.equal(original.data.id,people.map(p=>({id:p.id,value:val('turnover',periods[4],p.id)})).sort((a,b)=>b.value-a.value)[0].id);
const follow=A.ask(st,'ماه قبل چقدر بود؟',original.ctx,opts);assert.equal(follow.data.metric,'turnover');assert.equal(follow.data.to,'2026-10-22');
assert.equal(A.ask(st,'بیشترین کارکردمون با کی بوده؟',{}, {...opts,allow:{...opts.allow,balances:false}}).data.kind,'denied');
assert.equal(A.ask(st,'سود این ماه',{}, {...opts,allow:{...opts.allow,cost:false}}).data.kind,'denied');
assert.equal(A.ask(st,'فروش به ناشناس چقدر بود؟',{},opts).data.kind,'clarify');
assert.equal(A.ask(st,'حذف فاکتور',{},opts).data.kind,'unsupported');
assert.equal(A.ask(st,'هوا چطوره',original.ctx,opts).data.kind,'unsupported');
assert.equal(A.ask(st,'بیشترین با کی بوده',{},opts).data.kind,'clarify');
assert.equal(A.ask(st,'موجودی کالای ناشناس',{},opts).data.kind,'clarify');
const ambiguous={...st,people:[...st.people,{id:99999,name:'رضا ناصری'}]};assert.equal(A.ask(ambiguous,'مانده حساب رضا',{},opts).data.kind,'clarify');
console.log('PASS 10 additional original-question, follow-up, permission, unknown entity and write-protection checks');}

// Unseen edge conditions: no silent period/scope switch, no unrelated guesses, no writes.
if(!fail.length){
 const safeQueries=['فروش دو ماه قبل چقدر بود؟','فروش پارسال چقدر بود؟','فروش ماه بعد چقدر میشه؟','فروش امروز و دیروز چقدره؟','چرا فروش کم شده؟','فروش و خرید این ماه چقدر بوده','دریافت و پرداخت امروز چقدره','موجودی بانک چقدره؟','مانده حساب علی رضایی و مریم کاظمی چقدره؟'];
 for(const q of safeQueries)assert.equal(A.ask(st,q,{},opts).data.kind,'clarify',q);
 const a=A.ask(st,'بیشتر با کی کار کردیم؟',{},opts);assert.equal(a.data.metric,'turnover');
 const n=A.ask(st,'مانده حساب علي رضایی',{},opts);assert.equal(n.data.personId,people[0].id);
 const p=A.ask(st,'خرید از فروشگاه پارس چقدر بوده؟',{},opts);assert.equal(p.data.value,val('purchases',periods[4],people[4].id));
 const empty=C.emptyState();assert.equal(A.ask(empty,'بیشترین کارکردمون با کی بوده؟',{},opts).data.value,0);
 const modified=JSON.parse(JSON.stringify(st));modified.tx.push({id:900000,personId:people[0].id,kind:'debit',amount:999999999,date:TODAY,type:'sale'});
 const next=A.ask(modified,'بیشترین کارکردمون با کی بوده؟',{},opts);assert.equal(next.data.id,people[0].id);assert.equal(next.data.value,val('turnover',periods[4],people[0].id)+999999999);
 const originalJson=JSON.stringify(empty);A.ask(empty,'جمع صندوق و بانک چقدره؟',{},opts);assert.equal(JSON.stringify(empty),originalJson);
 for(const [q,key] of [['بیشترین کارکردمون با کی بوده؟','balances'],['فروش این ماه','reports'],['چک دریافتی ۷ روز آینده','money'],['موجودی کابل آلفا','warehouse'],['ارزش انبار','cost']])assert.equal(A.ask(st,q,{}, {...opts,allow:{...opts.allow,[key]:false}}).data.kind,'denied',q);
 console.log('PASS additional ambiguity, new data, empty data, and 5 permission checks');
}
