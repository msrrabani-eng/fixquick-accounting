/* v030: bounded, offline specialist intelligence. No remote services or ledger writes. */
(function(root){'use strict';
const C=typeof module!=='undefined'&&module.exports?require('./core.js'):root.Core;
const A=typeof module!=='undefined'&&module.exports?require('./assistant-brain.js'):C.smartAssistant;
const B=typeof module!=='undefined'&&module.exports?require('./report-assistant.js'):root.FQReports;
const F=typeof module!=='undefined'&&module.exports?require('./finance-scenario.js'):C.financeScenario;
const norm=s=>C.norm(String(s||'').normalize('NFKC').replace(/[\u0640\u064b-\u065f\u0670]/g,'')).replace(/[؟?!،؛:«»]/g,' ').replace(/\s+/g,' ').trim();
const money=n=>C.fmt(Math.round(n))+' '+C.unitName(),pct=n=>C.toFa((Math.round(n*10)/10).toString())+'٪';
const whole=(q,t)=>(' '+q+' ').includes(' '+t+' ');
const out=(text,ctx={},details=[],actions=[],data={kind:'analysis'})=>({text,ctx,details,actions,data,source:'تحلیل آفلاین بر اساس ثبت‌های حسابداری'});
const clarify=(text,ctx={})=>out(text,ctx,[],[],{kind:'clarify'});
const denied=()=>out('مجوز مشاهده اطلاعات موردنیاز این گزارش فعال نیست.',{},[],[],{kind:'denied'});
const reportLink=[{label:'گزارش‌های مالی',route:'#/reports'}],stockLink=[{label:'انبار',route:'#/products'}],chqLink=[{label:'چک‌ها',route:'#/cheques'}];
const label={sales:'فروش خالص',purchases:'خرید خالص',profit:'سود خالص',expense:'هزینه',receipts:'دریافت نقدی و بانکی',payments:'پرداخت نقدی و بانکی',turnover:'گردش حساب','sale-count':'تعداد فاکتور فروش','purchase-count':'تعداد فاکتور خرید','invoice-count':'تعداد فاکتور',balance:'مانده حساب','product-sales':'مبلغ فروش کالا','product-qty':'تعداد فروش کالا'};
const numeric=x=>Number.isSafeInteger(x);
const dateOf=s=>C.chequeAssistant.parseDate(s);
function dateScope(raw,today,settings={},def='mtd'){
 const q=norm(raw),dates=[...C.toEn(raw).matchAll(/(?:^|[^\d])((?:1[234567]\d{2}|20\d{2})[\/.-]\d{1,2}[\/.-]\d{1,2})(?!\d)/g)].map(m=>dateOf(m[1]));
 if(dates.length){if(dates.some(x=>!x)||dates.length>2||dates[0]>today||dates[1]>today||dates.length===2&&dates[0]>dates[1])return {invalid:true};return {period:'custom',from:dates[0],to:dates[1]||dates[0]};}
 if(/پریروز/.test(q))return {period:'custom',from:C.addDays(today,-2),to:C.addDays(today,-2)};
 const recent=q.match(/(\d{1,4}) روز (?:اخیر|گذشته)/);
 if(recent)return +recent[1]>0&&+recent[1]<=3650?{period:'recent',days:+recent[1]}:{invalid:true};
 const monthNames=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','ابان','اذر','دی','بهمن','اسفند'];
 const mon=q.match(new RegExp('(?:^| )(?:ماه )?('+monthNames.join('|')+')(?: ماه)?(?: (14\\d{2}))?(?: |$)'));
 if(mon){const now=C.isoToParts(today),m=monthNames.indexOf(mon[1])+1,y=mon[2]?+mon[2]:now.jy;const from=C.partsToIso(y,m,1),to=C.partsToIso(y,m,C.monthLenJ(y,m));return from>today?{invalid:true}:{period:'custom',from,to:to>today?today:to};}
 if(/سال قبل|سال گذشته|پارسال/.test(q)){const p=C.isoToParts(today),y=p.jy-1;return {period:'custom',from:C.partsToIso(y,1,1),to:C.partsToIso(y,12,C.monthLenJ(y,12))};}
 for(const [re,p] of [[/دیروز/,'yesterday'],[/امروز/,'today'],[/هفته (?:قبل|گذشته|پیش)/,'prevweek'],[/این هفته|هفته جاری/,'week'],[/ماه (?:قبل|گذشته|پیش)/,'prevmonth'],[/این ماه|ماه جاری/,'mtd'],[/امسال|سال مالی جاری|سال جاری/,'fytd'],[/از ابتدا|کل دوره|تا حالا|تا الان|همه زمان/,'all']])if(re.test(q))return {period:p};
 if(/فردا|هفته اینده|ماه اینده|سال اینده|روز اینده|روز قبل|ماه پیش|از تاریخ|تا تاریخ/.test(q))return {invalid:true};
 return def?{period:def}:null;
}
function rangeOf(s,today,st){if(!s||s.invalid)return null;if(s.period==='custom')return {from:s.from,to:s.to};if(s.period==='recent')return {from:C.addDays(today,1-s.days),to:today};if(s.period==='all'||s.period==='current')return {from:null,to:today};const r=C.periodRange(s.period,today,st.settings?.fyMonth);return r.from?{from:r.from,to:r.to>today?today:r.to}:null;}
const rangeText=r=>(r.from?C.fmtDate(r.from):'ابتدای ثبت')+' تا '+C.fmtDate(r.to);
const custom=r=>({period:'custom',from:r.from,to:r.to});
function previous(s,r,today){if(!r.from)return null;if(['mtd','week','fytd','prevmonth'].includes(s.period)){const p=C.prevPeriod({...r,k:s.period},today);if(p?.from&&p?.to)return {from:p.from,to:p.to};}return C.prevRange(r.from,r.to);}
const metricOf=q=>{
 const candidates=[];
 if(/سود|زیان|حاشیه سود/.test(q))candidates.push('profit');
 if(/هزینه|مخارج|خرج/.test(q)&&!/خرج چک/.test(q))candidates.push('expense');
 if(/فروش(?!گاه|نده)|فروخت|فروختم|فروخته/.test(q))candidates.push('sales');
 if(/خرید|خریدم|خریدیم/.test(q))candidates.push('purchases');
 if(/دریافت|پول گرفت|واریزی/.test(q))candidates.push('receipts');
 if(/پرداخت|پول داد/.test(q))candidates.push('payments');
 if(/کارکرد|گردش حساب|داد و ستد/.test(q))candidates.push('turnover');
 if(/تعداد فاکتور|چند فاکتور/.test(q)){if(candidates.length===1&&['sales','purchases'].includes(candidates[0]))return [candidates[0]==='sales'?'sale-count':'purchase-count'];if(!candidates.length)return ['invoice-count'];}
 return [...new Set(candidates)];
};
function resolve(st,kind,query,aliases=[]){
 const q=norm(query),list=kind==='person'?st.people:st.products,rows=list||[];
 const exact=rows.filter(x=>whole(q,norm(x.name)));
 const longest=exact.filter(x=>!exact.some(y=>norm(y.name).length>norm(x.name).length&&whole(norm(y.name),norm(x.name))));
 if(longest.length)return longest;
 const learned=aliases.filter(a=>a.kind===kind&&whole(q,norm(a.alias))).map(a=>rows.find(x=>x.id===a.id&&norm(x.name)===a.name)).filter(Boolean);
 if(learned.length)return [...new Map(learned.map(x=>[x.id,x])).values()];
 const stop=new Set(['فروشگاه','شرکت','مشتری','شخص','کالا','گوشی','ایفون','iphone','پرو','مکس','کابل','شارژر','بانک','خرید','فروش','حساب','امروز','دیروز','ماه','هفته','مدل']);
 return rows.filter(x=>norm(x.name).split(' ').some(t=>t.length>=3&&!stop.has(t)&&whole(q,t)));
}
function resultFor(req,h,ctx){
 if(!A.structuredPermission(req,h.permissions()))return denied();
 const r=h.read(req);if(!h.valid())throw Error('دسترسی تغییر کرده است.');
 if(!r||!A.structuredPermission(req,h.permissions()))return denied();
 if(!Number.isFinite(r.data?.value)||r.data.metric!==req.metric||!(r.data.scope||r.data.scopeInfo))return {...(r||clarify('گزارش معتبر در دسترس نیست.')),ctx};
 return {...r,ctx:{...ctx,lastReport:req},source:'گزارش مستقیم و آفلاین حسابداری'};
}
const okEntity=(kind,x)=>kind==='person'?{label:'حساب '+x.name,route:'#/person/'+x.id}:{label:'مشاهده انبار',route:'#/products'};
function analysisComparison(st,q,s,today,h,ctx){
 const metrics=metricOf(q),m=metrics.length===1?metrics[0]:ctx.lastReport?.metric;
 if(!['sales','purchases','profit','expense','receipts','payments','sale-count','purchase-count','invoice-count'].includes(m))return clarify('برای مقایسه معیار را مشخص کنید: مبلغ فروش، خرید، سود، هزینه یا تعداد فاکتور.',ctx);
 if(ctx.lastReport&&ctx.lastReport.mode!=='total'&&!metrics.length)return clarify('مقایسه همین شخص/کالا یا کل کسب‌وکار؟',ctx);
 const target=rangeOf(s,today,st),past=target&&previous(s,target,today);if(!target||!past)return clarify('دو بازه قابل مقایسه را مشخص کنید.',ctx);
 // Explicit comparison to previous month means equal elapsed days, not a full month against a partial one.
 const p1={metric:m,mode:'total',...custom(target)},p2={metric:m,mode:'total',...custom(past)};
 if(![p1,p2].every(r=>A.structuredPermission(r,h.permissions())))return denied();
 const x=h.read(p1),y=h.read(p2);if(!h.valid())throw Error('دسترسی تغییر کرده است.');
 if(!numeric(x?.data?.value)||!numeric(y?.data?.value)||x.data.metric!==m||y.data.metric!==m)return clarify('مقادیر قابل مقایسه در دسترس نیست.',ctx);
 const a=x.data.value,b=y.data.value,delta=a-b,fmt=m.endsWith('count')?n=>C.toFa(n):money;const details=[rangeText(target)+': '+fmt(a),rangeText(past)+': '+fmt(b),'تغییر: '+fmt(delta)];
 let change=b>0?(delta/b)*100:null;
 if(change!==null)details.push('درصد تغییر نسبت به دوره مبنا: '+pct(change));else details.push('درصد تغییر به علت مبنای صفر یا منفی قابل تفسیر نیست.');
 if(/چرا|علت|دلیل/.test(q)&&m==='sales'){
  const sum=r=>{const rows=st.invoices.filter(i=>i.date>=r.from&&i.date<=r.to&&i.type==='sale');return {count:rows.length,gross:rows.reduce((n,i)=>n+CoreInvoice(i),0)};};
  const a1=sum(target),b1=sum(past);details.push('تعداد فاکتور فروش: '+C.toFa(b1.count)+' ← '+C.toFa(a1.count),'میانگین مبلغ فاکتور فروش (بدون مالیات، پیش از کسر برگشتی‌های مستقل): '+money(b1.count?b1.gross/b1.count:0)+' ← '+money(a1.count?a1.gross/a1.count:0),'این عوامل تغییر عددی را نشان می‌دهند؛ علت بیرونی افت فروش از اطلاعات دفتر قابل اثبات نیست.');
 }
 return out(label[m]+' در دوره اول '+fmt(a)+' و دوره مقایسه '+fmt(b)+' است.',{lastReport:p1,comparison:{metric:m,a,b,range:target,previous:past}},details,reportLink,{kind:'comparison',metric:m,value:a,previous:b,delta,change});
}
const CoreInvoice=i=>{const t=C.invoiceTotals(i);return t.total-t.vat;};
function entityChoice(rows,kind,q,ctx){return clarify('چند '+(kind==='person'?'شخص':'کالا')+' محتمل وجود دارد. شماره مورد را بنویسید:\n'+rows.slice(0,8).map((x,i)=>C.toFa(i+1)+'. '+x.name).join('\n'),{...ctx,pending:{kind,q,ids:rows.slice(0,8).map(x=>x.id)}});}
function analytics(st,q,scope,today,h,ctx,aliases,forced){
 const can=(...k)=>k.every(x=>h.permissions()[x]===true),range=rangeOf(scope,today,st);
 const person=forced?.kind==='person'?[forced.item]:resolve(st,'person',q,aliases),products=forced?.kind==='product'?[forced.item]:resolve(st,'product',q,aliases);
 if(/گزارش مدیریت|وضعیت کسب و کار|سلامت مالی|هشدارهای هوشمند|داشبورد/.test(q)){
  const details=[];if(can('reports','cost')){const r=C.report(st,C.periodRange('mtd',today).from,today);details.push('فروش ماه تا امروز: '+money(r.revenue),'سود خالص ماه: '+money(r.net));if(r.revenue>0)details.push('حاشیه سود خالص: '+pct(100*r.net/r.revenue));}
  if(can('balances')){const b=C.receivablePayable(st);details.push('مطالبات: '+money(b.receivable),'بدهی: '+money(b.payable));}
  if(can('warehouse','reports','cost')){const s=C.stockInsights(st,today);details.push('سرمایه راکد: '+money(s.staleValue)+' در '+C.toFa(s.stale.length)+' کالا','نیازمند سفارش: '+C.toFa(s.reorder.length)+' کالا');}
  if(can('money','reports')){const x=h.read({metric:'cash',mode:'total',period:'current'}),y=h.read({metric:'cheques',mode:'total',period:'until',days:7,scope:'open',direction:'all',kindFilter:'both'});if(numeric(x?.data?.value)&&numeric(y?.data?.paid)&&numeric(y?.data?.received)){const net=x.data.value-y.data.paid;details.push('تعهدات باز تا ۷ روز (شامل معوق): '+money(y.data.paid),'نقدینگی بدون وصول دریافتی‌ها: '+money(net));if(net<0)details.push('هشدار: کسری احتمالی '+money(-net)+'؛ وصول‌ها قطعی فرض نشده‌اند.');}}
  return details.length?out('گزارش مدیریت بر اساس دسترسی فعلی و اطلاعات ثبت‌شده',{},details,[],{kind:'dashboard'}):denied();
 }
 if(/(?:پیش بینی|کسری|برآورد).*(?:نقدینگی|وجه نقد)|نقدینگی.*(?:تا اخر|تا پایان)/.test(q)){
  if(!can('money','reports'))return denied();const m=q.match(/(\d+) روز/);let days=m?+m[1]:/تا (?:اخر|پایان) ماه/.test(q)?C.diffDays(today,C.periodRange('month',today).to):/فردا/.test(q)?1:7;
  if(!Number.isInteger(days)||days<0||days>365)return clarify('بازه نقدینگی را از صفر تا ۳۶۵ روز مشخص کنید.',ctx);
  const cash=h.read({metric:'cash',mode:'total',period:'current'});if(!numeric(cash?.data?.value))return clarify('موجودی نقد قابل محاسبه نیست.',ctx);
  const to=C.addDays(today,days),payments=[],receipts=[];for(const c of st.cheques||[]){if(c.done||c.cyc&& !['box','bank','issued'].includes(c.state)||!C.validIso(c.dueDate)||c.dueDate>to||!numeric(c.amount)||c.amount<=0)continue;const day=c.dueDate<today?today:c.dueDate;if(c.direction==='pay')payments.push({day,n:c.amount});else if(c.direction==='receive')receipts.push({day,n:c.amount});}
  const events=[...new Set([today,...payments.map(x=>x.day),...receipts.map(x=>x.day),to])].sort();let a=cash.data.value,b=a,min=a,minDay=today,p=0,r=0;
  for(const d of events){const pv=payments.filter(x=>x.day===d).reduce((n,x)=>n+x.n,0),rv=receipts.filter(x=>x.day===d).reduce((n,x)=>n+x.n,0);p+=pv;r+=rv;a-=pv;b+=rv-pv;if(a<min){min=a;minDay=d;}}
  if(![a,b,p,r,min].every(numeric))return clarify('مبلغ خارج از محدوده امن است.',ctx);
  return out('برآورد نقدینگی تا '+C.fmtDate(to),{},['نقد ثبت‌شده: '+money(cash.data.value),'تعهدات (شامل معوق): '+money(p),'دریافتی‌های باز: '+money(r),'سناریوی عدم وصول: '+money(a),'سناریوی وصول کامل: '+money(b),'بیشترین کسری در سناریوی عدم وصول: '+money(Math.max(0,-min))+' در '+C.fmtDate(minDay),'فروش آینده، هزینه‌های ثبت‌نشده و احتمال واقعی وصول در این مدل محاسبه نشده‌اند.'],chqLink,{kind:'liquidity',value:a,optimistic:b});
 }
 if(/چک/.test(q)&&/پیشنهاد|خرج کنم|خرج کنیم|تسویه با|کدام چک|کدوم چک/.test(q)){
  if(!can('money','balances'))return denied();if(person.length>1)return entityChoice(person,'person',q,ctx);
  if(person.length!==1)return clarify('نام شخصی را که به او بدهکار هستید بنویسید.',ctx);
  const p=person[0],target=Math.max(0,-C.balanceOf(st,p.id));if(!target)return out('طبق مانده ثبت‌شده، بدهی قابل تسویه به '+p.name+' وجود ندارد.',{},[],[okEntity('person',p)]);
  const offer=C.suggestCheques(st.cheques,target,{limit:5});return out('پیشنهاد چک‌های صندوق برای تسویه با '+p.name+'؛ بدهی '+money(target),{lastPerson:p.id},offer.length?offer.map(o=>o.ids.map(id=>{const c=C.byId(st.cheques,id);return (c.serial||c.title||C.toFa(id))+' ('+money(c.amount)+'، '+C.fmtDate(c.dueDate)+')';}).join(' + ')+' — مانده '+money(o.difference)):['ترکیب مناسب بدون تجاوز از بدهی پیدا نشد.'],'چک‌ها'.length?chqLink:[],{kind:'cheque-suggestion',value:target});
 }
 if(/سرمایه راکد|کالاهای راکد|کالای راکد|کالاهای کم فروش|سفارش خرید|کمبود انبار|چه کالایی سفارش/.test(q)){
  if(!can('warehouse','reports','cost'))return denied();const s=C.stockInsights(st,today),order=/سفارش|کمبود/.test(q),rows=order?s.reorder:s.stale;
  return out(order?'پیشنهاد سفارش بر پایه میانگین فروش ۶۰ روزه':'سرمایه راکد به بهای خرید: '+money(s.staleValue),{},rows.slice(0,12).map(x=>x.product.name+' — '+(order?'پیشنهاد '+C.fmtQty(x.suggest)+' عدد؛ موجودی '+C.fmtQty(x.stock):money(x.value)+'؛ '+C.toFa(x.idle)+' روز بدون فروش/ورود جدید')).concat(rows.length?[]:['موردی با معیار فعلی پیدا نشد.']),stockLink,{kind:'stock-analysis',count:rows.length});
 }
 if(/قیمت گذاری|چند بفروشم|چقدر بفروشم|قیمت فروش.*درصد/.test(q)&&/درصد|٪|%/.test(q)){
  if(!can('warehouse','cost'))return denied();if(products.length>1)return entityChoice(products,'product',q,ctx);if(products.length!==1)return clarify('نام کامل کالا و درصد سود را مشخص کنید.',ctx);
  const p=products[0],m=C.toEn(q).match(/(\d+(?:\.\d+)?)\s*(?:درصد|٪|%)/),rate=m?+m[1]:NaN,cost=C.unitCost(st,p.id);
  if(!Number.isFinite(rate)||rate<0||rate>1000||!(cost>0))return clarify('بهای خرید معتبر یا درصد سود مشخص نیست.',ctx);
  const margin=/حاشیه سود/.test(q);if(margin&&rate>=100)return clarify('حاشیه سود باید کمتر از صد درصد باشد.',ctx);
  const price=Math.ceil(margin?cost/(1-rate/100):cost*(1+rate/100));return out('قیمت پیشنهادی '+p.name+': '+money(price),{},['بهای موجودی فعلی: '+money(cost),'مبنای محاسبه: '+(margin?'حاشیه سود از فروش':'درصد سود روی بهای خرید')+' '+pct(rate),'مالیات، کارمزد، تخفیف و هزینه‌های جانبی لحاظ نشده‌اند.'],stockLink,{kind:'pricing',value:price});
 }
 if(/سود/.test(q)&&(/کالا|محصول|گوشی|مدل/.test(q)||products.length)&&!/سود خالص کل|سود کل کسب/.test(q)){
  if(!can('reports','cost','warehouse'))return denied();if(!range)return clarify('بازه سود کالا معتبر نیست.',ctx);
  if(products.length>1)return entityChoice(products,'product',q,ctx);
  const rows=C.productProfit(st,range.from,range.to),items=Object.entries(rows).map(([id,x])=>({...x,p:C.byId(st.products,+id)})).filter(x=>x.p);
  if(products.length===1){const p=products[0],x=rows[p.id];return x?out('سود ناخالص فروش '+p.name+': '+money(x.profit),{},[rangeText(range),'فروش خالص: '+money(x.rev),'بهای کالای فروش‌رفته: '+money(x.cost),'هزینه عمومی بین کالاها تخصیص داده نشده است.'],stockLink,{kind:'product-profit',value:x.profit}):out('در این بازه فروش ثبت‌شده‌ای برای این کالا وجود ندارد.',{},[],stockLink);}
  if(!/بیشترین|کمترین|سوداور|زیان|رتبه|کدام|کدوم/.test(q))return clarify('نام کالا یا معیار رتبه‌بندی را مشخص کنید.',ctx);
  const low=/کمترین|زیان/.test(q);items.sort((a,b)=>low?a.profit-b.profit:b.profit-a.profit);return out('رتبه‌بندی سود ناخالص کالاها',{},[rangeText(range),...items.slice(0,10).map(x=>x.p.name+' — '+money(x.profit)+'؛ حاشیه '+pct(x.margin)),'هزینه‌های عمومی در سود کالا تخصیص داده نشده‌اند.'],reportLink,{kind:'profit-ranking',count:items.length});
 }
 if(/تامین کننده|فروشنده|از کی بخرم/.test(q)&&/ارزان|قیمت مناسب|بهترین قیمت|کمترین قیمت/.test(q)){
  if(!can('reports','cost','warehouse','balances'))return denied();if(products.length>1)return entityChoice(products,'product',q,ctx);if(products.length!==1)return clarify('برای مقایسه قیمت تأمین‌کننده نام یک کالای دقیق را وارد کنید.',ctx);
  const p=products[0],m=new Map();for(const i of st.invoices){if(i.type!=='purchase'||i.date>today||range?.from&&i.date<range.from||range?.to&&i.date>range.to)continue;for(const l of C.invoiceTotals(i).lines)if(l.productId===p.id&&l.qty>0){const a=m.get(i.personId)||{qty:0,net:0};a.qty+=l.qty;a.net+=l.net;m.set(i.personId,a);}}
  const rows=[...m].map(([id,x])=>({p:C.byId(st.people,id),price:x.net/x.qty,qty:x.qty})).filter(x=>x.p).sort((a,b)=>a.price-b.price);
  return out('مقایسه میانگین قیمت خرید ثبت‌شده '+p.name,{},[rangeText(range),...rows.slice(0,10).map(x=>x.p.name+' — '+money(x.price)+'؛ '+C.fmtQty(x.qty)+' واحد خرید'),'قیمت خرید گذشته تضمین قیمت امروز نیست؛ برگشت خرید و شرایط تحویل در این مقایسه منظور نشده است.'],stockLink,{kind:'supplier-ranking',count:rows.length});
 }
 if(/سر به سر|سربه سر|پوشش هزینه|سود روزانه لازم|هدف سود/.test(q)){
  if(!can('reports','cost'))return denied();const m=q.match(/(\d+)\s*روز کاری/);if(!m||+m[1]<1||+m[1]>31)return clarify('تعداد روز کاری ماه را مشخص کنید؛ مثلاً «سود روزانه برای پوشش هزینه ماه قبل با ۲۵ روز کاری».',ctx);
  const r=range&&C.report(st,range.from,range.to);if(!r)return clarify('بازه هزینه را مشخص کنید.',ctx);const v=Math.ceil(r.expenses/+m[1]);return out('هدف سود ناخالص روزانه برای پوشش هزینه‌های ثبت‌شده: '+money(v),{},[rangeText(range),'هزینه دوره: '+money(r.expenses),'روز کاری: '+C.toFa(+m[1]),'فقط هزینه‌های ثبت‌شده در بازه؛ هدف فروش به حاشیه سود وابسته است.'],reportLink,{kind:'break-even',value:v});
 }
 if(/حسابرسی|ثبت های غیرعادی|معاملات مشکوک|ریسک مالی|کنترل خطا/.test(q)){
  if(!can('reports','cost','balances','money'))return denied();const problems=C.audit(st),risks=C.smartGuard?.scan(st,{today,max:8});return out('کنترل سازگاری دفتر و ثبت‌های مشکوک',{},['تعداد مغایرت‌های ساختاری: '+C.toFa(problems.length),...problems.slice(0,8),'تعداد موارد مشکوک به ثبت تکراری: '+C.toFa(risks?.count||0),'موارد مشکوک خطای قطعی نیستند؛ هیچ ثبت مالی تغییر داده نشد.'],[{label:'کنترل اطلاعات',route:'#/safety'}],{kind:'audit',count:problems.length});
 }
 return null;
}
async function run(q,ctx={},h){
 if(!h.valid())throw Error('دسترسی تغییر کرده است.');
 const raw=String(q||'').trim(),n=norm(raw),today=h.today();
 // Original calculator conversations retain priority, and all new functions are optional to older callers.
 if(ctx.finance||ctx.weighted)return B.runSmart(raw,ctx,h);
 if(!h.state)return B.runSmart(raw,ctx,h);
 const st=h.state(),aliases=h.aliases?.()||[],can=(...k)=>k.every(x=>h.permissions()[x]===true);
 if(/(?:^| )(حذف|پاک کن|ثبت کن|ویرایش کن|اضافه کن|انتقال بده|تغییر بده)(?: |$)/.test(n))return clarify('دستیار فقط گزارش و محاسبه ارائه می‌دهد؛ برای ثبت یا تغییر از فرم اصلی استفاده کنید.');
 if(ctx.pendingAlias&&/^(تایید نام مستعار|تایید|بله)$/.test(n)){
  const a=ctx.pendingAlias;if(!can(...(a.kind==='person'?['balances']:['warehouse'])))return denied();
  if(!h.saveAlias||!h.saveAlias(a))return clarify('نام مستعار ذخیره نشد.');
  return out('نام مستعار «'+a.alias+'» برای «'+a.name+'» ذخیره شد.',{},[],[],{kind:'alias-saved'});
 }
 const al=raw.match(/^\s*نام مستعار\s+(شخص|کالا)\s+(.{1,50}?)\s*=\s*(.{1,100})\s*$/);
 if(al){const kind=al[1]==='شخص'?'person':'product';if(!can(kind==='person'?'balances':'warehouse'))return denied();const rows=(kind==='person'?st.people:st.products).filter(x=>norm(x.name)===norm(al[3]));if(rows.length!==1)return clarify('نام واقعی باید دقیقاً با یک شخص یا کالا در برنامه منطبق باشد.');if(!norm(al[2])||norm(al[2])===norm(al[3]))return clarify('نام مستعار متفاوت و معتبر وارد کنید.');return clarify('«'+al[2]+'» را به «'+rows[0].name+'» متصل کنم؟ برای ذخیره بنویسید «تایید نام مستعار».',{pendingAlias:{kind,alias:norm(al[2]),id:rows[0].id,name:norm(rows[0].name)}});}
 let forced=null,question=raw;
 if(ctx.pending&&/^\d+$/.test(n)){const id=ctx.pending.ids[+n-1],kind=ctx.pending.kind;if(!can(kind==='person'?'balances':'warehouse'))return denied();const item=C.byId(kind==='person'?st.people:st.products,id);if(!item)return clarify('مورد انتخاب‌شده معتبر نیست.');forced={kind,item};question=ctx.pending.q;ctx={...ctx,pending:null};}
 const text=norm(question),scope=dateScope(question,today,st.settings,'mtd');
 if(scope.invalid&&!/چک|قسط|نقدینگی|محاسبه سود|اقساط/.test(text))return clarify('تاریخ یا بازه گزارش معتبر نیست؛ تاریخ شمسی کامل یا بازه گذشته مشخص کنید.',ctx);
 if(/چند درصد (?:رشد|افت|تغییر)|درصد رشد|درصد کاهش/.test(text)&&ctx.comparison){const x=ctx.comparison;if(!A.structuredPermission({metric:x.metric,mode:'total'},h.permissions()))return denied();return out(x.b>0?'درصد تغییر '+label[x.metric]+': '+pct((x.a-x.b)/x.b):'به علت مبنای صفر یا منفی درصد رشد قابل تفسیر نیست.',ctx,[rangeText(x.range),rangeText(x.previous)],reportLink,{kind:'growth'});}
 if(/مقایسه|نسبت به|چرا.*(?:کم|زیاد|افت|رشد)|چند درصد (?:رشد|افت|تغییر)/.test(text)&&!(/شخص|مشتری|کالا|محصول|تامین کننده/.test(text)))return analysisComparison(st,text,scope,today,h,ctx);
 const adv=analytics(st,text,scope,today,h,ctx,aliases,forced);if(adv)return adv;
 if(/محاسبه اقساط|قسط.*ماهه|اقساط.*ماهه/.test(text)){
  if(!can('money'))return denied();
  const m=C.toEn(question).match(/(\d+(?:[.٫]\d+)?\s*(?:میلیارد|میلیون|هزار)?\s*(?:تومان|تومن|ریال))/);
  const term=text.match(/(\d+)\s*ماه/),rate=text.match(/(\d+(?:\.\d+)?)\s*(?:درصد|٪|%)/),pre=text.match(/(?:پیش پرداخت|نقد)\s*(\d+(?:\.\d+)?)\s*(?:درصد|٪|%)/);
  if(!m||!term||!rate||!pre||!/ساده/.test(text))return clarify('برای محاسبه اقساط، قیمت با واحد، درصد پیش‌پرداخت، مدت، نرخ ماهانه و روش ساده را مشخص کنید. مثال: اقساط ۱۰۰ میلیون تومان، ۵۰ درصد پیش پرداخت، ۴ ماه، ۷ درصد ماهانه ساده.');
  const total=F.amount(m[1],C.unit),down=Math.round(total*+pre[1]/100),principal=total-down,bp=Math.round(+rate[1]*100),months=+term[1];
  // Rate must come after the month count, not the down payment.
  const tail=text.slice(term.index+term[0].length),rr=tail.match(/(\d+(?:\.\d+)?)\s*(?:درصد|٪|%)/);
  if(!rr||!numeric(total)||total<=0||+pre[1]<0||+pre[1]>100)return clarify('مبلغ یا نرخ اقساط معتبر نیست.');
  const r=F.calculate({mode:'remaining',principal,months,rateBp:Math.round(+rr[1]*100),method:'simple'});
  if(!r.ok)return clarify(r.error);return out('مجموع اقساط: '+money(r.due),{},['پیش‌پرداخت: '+money(down),'اصل اقساط: '+money(principal),'سود ساده کل: '+money(r.interest),'میانگین هر قسط: '+money(r.due/months),'مجموع نقد و اقساط: '+money(down+r.due),'گرد کردن اقساط یا تاریخ متفاوت چک‌ها در این سناریو منظور نشده است.'],[],{kind:'installment',value:r.due});
 }
 // Preserve direct routes, then expand intent recognition using the same typed reports.
 const direct=B.specialistRoute(question,ctx,today);
 if(direct&&!forced&&!aliases.some(a=>whole(text,a.alias)))return resultFor(direct,h,ctx);
 const explicit=dateScope(question,today,st.settings,null);
 if(explicit&&!explicit.invalid&&ctx.lastReport&&/^(?:پریروز|امروز|دیروز|این ماه|ماه قبل|ماه گذشته|این هفته|هفته قبل|امسال|\d+ روز اخیر)(?: چی| چطور| چقدر بود)?$/.test(text)){
  const {period,from,to,days,...base}=ctx.lastReport;return resultFor({...base,...explicit},h,ctx);
 }
 let ps=forced?.kind==='person'?[forced.item]:resolve(st,'person',text,aliases),gs=forced?.kind==='product'?[forced.item]:resolve(st,'product',text,aliases);
 let clean=text;for(const e of [...ps,...gs])clean=(' '+clean+' ').replace(' '+norm(e.name)+' ',' ENTITY ').trim();
 let ms=metricOf(clean),rank=/بیشترین|کمترین|بهترین مشتری|پرفروش|پر فروش|رتبه|بزرگترین/.test(clean),qty=/چند تا|چندتا|تعداد|چند عدد|چند دستگاه/.test(clean);
 if(/بهترین مشتری/.test(clean))return clarify('بهترین مشتری از نظر مبلغ فروش، سود، تعداد خرید یا خوش‌حسابی؟ معیار را مشخص کنید.',ctx);
 if(/حساب|طلب|بدهکار|بدهی|بستانکار/.test(clean)&&!ms.length&&!/نقدینگی|بانک|صندوق/.test(clean)){
  const pay=/بدهی (?:من|ما)|بدهکاریم|بدهکارم|بستانکار|به کی بده/.test(clean);
  if(ps.length){if(!can('balances'))return denied();if(ps.length>1)return entityChoice(ps,'person',question,ctx);return resultFor({metric:'balance',mode:'person',person:ps[0].name,...(explicit||{period:'current'})},h,ctx);}
  if(/کل|جمع|مجموع|چقدر طلب|چقدر بدهکار|مطالبات|بیشترین|کمترین/.test(clean))return resultFor({metric:pay?'payable':'receivable',mode:rank?'rank':'total',...(rank?{order:/کمترین/.test(clean)?'asc':'desc',limit:5}:{}),...(explicit||{period:'current'})},h,ctx);
  return clarify('نام کامل شخص را بنویسید.',ctx);
 }
 if(/موجودی|چند تا داریم|چندتا داریم/.test(clean)&&!ms.length&&gs.length){if(!can('warehouse'))return denied();if(gs.length>1)return entityChoice(gs,'product',question,ctx);if(explicit)return clarify('موجودی فعلی قابل محاسبه است؛ موجودی تاریخی را از کاردکس بررسی کنید.',ctx);return resultFor({metric:'stock',mode:'product',product:gs[0].name,period:'current'},h,ctx);}
 if(ms.length>1)return clarify('چند موضوع در سؤال وجود دارد: '+ms.map(x=>label[x]).join('، ')+'. لطفاً یکی را مشخص کنید یا از مقایسه استفاده کنید.',ctx);
 if(ms.length===1){
  let m=ms[0],req={metric:m,mode:'total',...scope};
  if(ps.length&&gs.length)return clarify('گزارش شخص و کالا همزمان در این مسیر تفکیک نمی‌شود؛ یکی را انتخاب کنید.',ctx);
  if(gs.length){if(m!=='sales')return clarify('برای کالا مبلغ فروش، تعداد فروش، سود ناخالص یا موجودی را مشخص کنید.',ctx);if(!can('warehouse','reports'))return denied();if(gs.length>1)return entityChoice(gs,'product',question,ctx);req={metric:qty?'product-qty':'product-sales',mode:'product',product:gs[0].name,...scope};}
  else if(ps.length){if(!can('balances'))return denied();if(ps.length>1)return entityChoice(ps,'person',question,ctx);if(!['sales','purchases','receipts','payments','turnover','sale-count','purchase-count','invoice-count'].includes(m))return clarify('این معیار به تفکیک شخص پشتیبانی نمی‌شود.',ctx);req={metric:m,mode:'person',person:ps[0].name,...scope};}
  else if(rank){if(!['sales','purchases','turnover','sale-count','purchase-count','invoice-count'].includes(m))return clarify('رتبه‌بندی این معیار نیاز به مشخص کردن شخص یا کالا دارد.',ctx);req={metric:m==='sales'&&/کالا|محصول|گوشی|پرفروش|پر فروش/.test(clean)?(qty?'product-qty':'product-sales'):m,mode:'rank',order:/کمترین/.test(clean)?'asc':'desc',limit:5,...scope};}
  else if(/(?:از|به|برای|با) (?!ابتدا|اول|امروز|دیروز|این|ما|من|همه|نظر|صورت|پایان|تاریخ)\S+/.test(clean)&&!/نسبت به|چقدر از/.test(clean))return clarify('موضوع یا نام شخص/کالا مشخص نیست؛ برای جلوگیری از پاسخ اشتباه نام دقیق را وارد کنید.',ctx);
  return resultFor(req,h,ctx);
 }
 const old=await B.runSmart(question,ctx,h);
 if(old.data?.kind!=='clarify')return old;
 // Global search is used for explicit finding, not as an inferred accounting amount.
 if(/پیدا کن|جستجو کن|^جستجو |^پیدا کردن /.test(text)&&can('reports','cost','balances','money','warehouse')&&C.smartFind){
  const found=C.smartFind(st,question,{limit:5}),details=[],actions=[];for(const x of found.people||[]){details.push('شخص: '+x.name);actions.push(okEntity('person',x));}for(const x of found.products||[]){details.push('کالا: '+x.name);actions.push(okEntity('product',x));}for(const x of found.invoices||[]){details.push('فاکتور '+C.toFa(x.no)+' — '+C.fmtDate(x.date));actions.push({label:'مشاهده فاکتور '+C.toFa(x.no),route:'#/inv/'+x.id});}return out(details.length?'نتایج پیشنهادی جستجوی محلی':'مورد قابل نمایش پیدا نشد.',ctx,details,actions.slice(0,10),{kind:'search-results'});
 }
 return {...old,ctx,details:['بازه، نام یا معیار را دقیق‌تر بنویسید.','نمونه: «جمع فروش امروز»، «سود ناخالص کابل این ماه»، «گزارش مدیریت».']};
}
const api={run,dateScope,metricOf,resolve};root.FQAdvisor=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
