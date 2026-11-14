/* Offline read-only accounting assistant. No external inference. */
(function(root){'use strict';
const C=typeof module!=='undefined'&&module.exports?require('./core.js'):root.Core;
const A=typeof module!=='undefined'&&module.exports?require('./assistant-brain.js'):C.smartAssistant;
const metrics=Object.freeze(['sales','purchases','profit','expense','turnover','balance','receivable','payable','cash','receipts','payments','cheques','inventory-value','stock','invoice-count','sale-count','purchase-count','product-sales','product-qty','risk']);
const periodValues=['today','yesterday','week','prevweek','mtd','prevmonth','fytd','all','current','custom','recent','exact','until','overdue'];
function directReport(question,context={}){
 if(context.weighted||context.finance)return null;
 const q=C.norm(String(question||'')).replace(/[؟?!،.!]+$/g,'').trim();
 const period='امروز|دیروز|این هفته|هفته جاری|هفته قبل|هفته گذشته|این ماه|ماه جاری|ماه قبل|ماه گذشته';
 const metric='فروش|خرید|سود|هزینه|دریافت|پرداخت';
 const amount='چقدر|چه قدر|چه مبلغی';
 const verb='داشتیم|بوده|بود|شده|است|هست';
 const patterns=[
  '^('+period+') ('+amount+') ('+metric+')(?: (?:'+verb+'))?$',
  '^('+amount+') ('+period+') ('+metric+')(?: (?:'+verb+'))?$',
  '^('+metric+') ('+period+') ('+amount+')(?: (?:'+verb+'))?$',
  '^('+period+') ('+metric+') ('+amount+')(?: (?:'+verb+'))?$',
  '^(?:مجموع|جمع|مبلغ|کل) ('+metric+') ('+period+')(?: ('+amount+')(?: (?:'+verb+'))?)?$',
  '^('+metric+') ('+period+') چقدره$',
  '^('+period+') ('+metric+') چقدره$'
 ];
 const periods={'امروز':'today','دیروز':'yesterday','این هفته':'week','هفته جاری':'week','هفته قبل':'prevweek','هفته گذشته':'prevweek','این ماه':'mtd','ماه جاری':'mtd','ماه قبل':'prevmonth','ماه گذشته':'prevmonth'};
 const metrics={'فروش':'sales','خرید':'purchases','سود':'profit','هزینه':'expense','دریافت':'receipts','پرداخت':'payments'};
 for(const pattern of patterns){const m=q.match(new RegExp(pattern));if(!m)continue;
  const parts=m.slice(1),p=parts.find(x=>Object.hasOwn(periods,x)),a=parts.find(x=>Object.hasOwn(metrics,x));
  if(p&&a)return {metric:metrics[a],mode:'total',period:periods[p]};
 }
 return null;
}
function request(v){
 if(!v||typeof v!=='object'||Array.isArray(v)||!metrics.includes(v.metric)||!['total','rank','person','product'].includes(v.mode)||!periodValues.includes(v.period))return null;
 const keys=['metric','mode','period'];if(v.mode==='rank')keys.push('order','limit');if(v.mode==='person')keys.push('person');if(v.mode==='product')keys.push('product');if(v.period==='custom')keys.push('from','to');if(['exact','until','recent'].includes(v.period))keys.push('days');if(v.metric==='cheques')keys.push('direction','scope','kindFilter');
 if(Object.keys(v).some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(v,k)))return null;
 const r={};for(const k of keys){const val=v[k];if(k==='days'||k==='limit'){if(!Number.isInteger(val)||val<0||val>3650)return null;r[k]=val;}else {if(typeof val!=='string'||!val.trim()||val.length>150||/[<>\u0000-\u001f]/.test(val))return null;r[k]=val.trim();}}
 if(r.mode==='rank'&&(!['asc','desc'].includes(r.order)||r.limit<1||r.limit>10))return null;
 if(r.metric==='cheques'){if(!['receive','pay','all'].includes(r.direction)||!['box','bank','issued','open'].includes(r.scope)||!['cheque','installment','both'].includes(r.kindFilter)||!['exact','until','overdue','all','custom'].includes(r.period))return null;}
 else if(['exact','until','overdue'].includes(r.period))return null;
 return r;
}
const fail=(text,kind='error',ctx={})=>({text,ctx,details:[],actions:[],data:{kind},source:kind==='denied'?'کنترل دسترسی برنامه':'وضعیت دستیار'});
const mayRead=(r,a)=>A.structuredPermission(r,a);
const dayWords={'امروز':'today','دیروز':'yesterday','پریروز':'beforeYesterday','این هفته':'week','هفته قبل':'prevweek','هفته گذشته':'prevweek','این ماه':'mtd','ماه قبل':'prevmonth','ماه گذشته':'prevmonth','امسال':'fytd'};
const normQuick=q=>C.norm(q).replace(/[؟?!،.!؛:]+/g,' ').replace(/\s+/g,' ').trim();
function applyPeriod(r,p,today){
 const next={...r};delete next.from;delete next.to;delete next.days;
 if(p==='beforeYesterday'){next.period='custom';next.from=next.to=C.addDays(today,-2);}
 else next.period=p;
 return request(next);
}
function specialistRoute(q,context={},today=C.todayISO()){
 q=normQuick(q);
 if(context.finance||context.weighted)return null;
 const old=context.lastReport;
 const tail=q.match(/^(امروز|دیروز|پریروز|این هفته|هفته قبل|هفته گذشته|این ماه|ماه قبل|ماه گذشته|امسال)(?: (?:چی|چطور|چقدره|چقدر بود|چقدر شده))?$/);
 if(tail&&old&&old.metric!=='cheques'&&!['cash','stock','inventory-value','risk'].includes(old.metric))return applyPeriod(old,dayWords[tail[1]],today);
 const d=directReport(q,{});if(d)return d;
 if(q.includes('پریروز')){const r=directReport(q.replace('پریروز','دیروز'),{});if(r)return applyPeriod(r,'beforeYesterday',today);}
 const totals=[
  [/^(?:کل |جمع |مجموع )?(?:مطالبات|طلب ها|طلب های ما|طلب ما|طلب من)(?: چقدر(?: است| داریم| دارم)?)?$/,'receivable'],
  [/^(?:کل |جمع |مجموع )?(?:بدهی ها|بدهی های ما|بدهی ما|بدهی من)(?: چقدر(?: است| داریم| دارم)?)?$/,'payable'],
  [/^چقدر (?:بدهکاریم|بدهکارم)$/,'payable'],
  [/^چقدر طلب (?:داریم|دارم)$/,'receivable'],
  [/^(?:نقدینگی|موجودی نقد|موجودی صندوق و بانک|جمع بانک و صندوق)(?: چقدر(?: است| داریم)?)?$/,'cash'],
  [/^(?:ارزش (?:کل )?انبار|ارزش موجودی)(?: چقدر است)?$/,'inventory-value'],
  [/^(?:ایا )?(?:ثبت تکراری|مغایرت|خطای مالی)(?: داریم)?$/,'risk']
 ];
 for(const [re,metric] of totals)if(re.test(q))return {metric,mode:'total',period:'current'};
 let m=q.match(/^(?:مانده حساب|حساب|طلب از|بدهی به) (.+?)(?: چقدر (?:است|شده|هست))?$/);
 if(m&&!/ و |یا |چرا|فروش|خرید|پیش بینی/.test(m[1]))return {metric:'balance',mode:'person',person:m[1],period:'current'};
 m=q.match(/^(?:موجودی|تعداد موجودی) (.+?)(?: چقدر (?:است|داریم)| چند تا داریم)?$/);
 if(m&&!/ و |یا |چرا|بانک|صندوق|ارزش/.test(m[1]))return {metric:'stock',mode:'product',product:m[1],period:'current'};
 m=q.match(/^(?:بیشترین (?:طلب|مطالبات)|چه کسی بیشترین بدهی را به ما دارد|اولویت وصول مطالبات|از کی اول پول بگیرم|بزرگترین بدهکاران)$/);
 if(m)return {metric:'receivable',mode:'rank',period:'current',order:'desc',limit:5};
 if(/^(?:بیشترین بدهی ما به کیست|بیشترین بدهی به چه کسی داریم)$/.test(q))return {metric:'payable',mode:'rank',period:'current',order:'desc',limit:5};
 m=q.match(/^(?:پرفروش ترین کالا|پر فروش ترین کالا|بیشترین فروش کالا از نظر تعداد)(?: (این ماه|ماه قبل|این هفته|هفته قبل))?(?: چیست| چیه)?$/);
 if(m)return {metric:'product-qty',mode:'rank',period:dayWords[m[1]]||'mtd',order:'desc',limit:5};
 m=q.match(/^(?:چک(?: ها| های)?|سررسید چک(?: ها| های)?)(?: (دریافتی|پرداختی|صندوق|بانک|صادره))?(?: سررسید)? (امروز|فردا|معوق|گذشته|[0-9]+ روز اینده|[0-9]+ روز دیگر)(?: چقدر(?: است| داریم)?)?$/);
 if(m){
  const scope=({صندوق:'box',بانک:'bank',صادره:'issued'})[m[1]]||'open';
  const direction=['box','bank'].includes(scope)||m[1]==='دریافتی'?'receive':scope==='issued'||m[1]==='پرداختی'?'pay':'all';
  const result={metric:'cheques',mode:'total',scope,direction,kindFilter:'cheque',period:'exact',days:0};
  if(['معوق','گذشته'].includes(m[2])){result.period='overdue';delete result.days;}
  else if(m[2]==='فردا')result.days=1;
  else if(m[2]!=='امروز'){
   result.days=Number(m[2].split(' ')[0]);if(result.days>365)return null;
   if(m[2].endsWith('اینده')){result.period='custom';result.from=today;result.to=C.addDays(today,result.days);delete result.days;}
  }
  return result;
 }
 return null;
}
function specialistHelp(ctx={}){
 return {text:'می‌توانم با اطلاعات همین برنامه گزارش فروش، سود، خرید، هزینه، مانده اشخاص، مطالبات، بدهی، چک‌ها و انبار را محاسبه کنم.',ctx,details:['مثلاً: دیروز چقدر فروش داشتیم؟ سپس: پریروز چی؟','اولویت وصول مطالبات (بر اساس بزرگ‌ترین مانده طلب)','پیش بینی نقدینگی ۷ روز آینده (فقط سررسیدهای ثبت‌شده)','کالاهای راکد (۶۰ روز بدون فروش)','کنترل ثبت تکراری'],actions:[],data:{kind:'help'},source:'راهنمای قابلیت‌های واقعی برنامه'};
}
async function runSmart(q,context={},h){
 const valid=()=>{if(!h.valid())throw Error('دسترسی تغییر کرده است یا تحلیل متوقف شد.');};valid();
 const n=normQuick(q);const denied=()=>fail('مجوز مشاهده این گزارش برای کاربر فعال نیست.','denied');
 const read=r=>{valid();if(!mayRead(r,h.permissions()))return null;const x=h.read(r);valid();if(!mayRead(r,h.permissions()))return null;return x;};
 const verified=(x,r)=>x&&x.data?.metric===r.metric&&Number.isFinite(x.data.value)&&!!(x.data.scope||x.data.scopeInfo);
 if(!n)return specialistHelp(context);
 if(/^(سلام|درود|سلام خوبی|سلام علیکم|صبح بخیر|شب بخیر|وقت بخیر)$/.test(n))return {...specialistHelp(context),text:'سلام! درباره حسابداری و مدیریت فروشگاه چه کمکی نیاز دارید؟',details:[]};
 if(/^(?:تو )?چه کمک(?:ی| هایی)? (?:به من )?(?:میتونی|می تونی|می توانی) (?:انجام بدی|انجام بدهی|بکنی|بکنی به من)$/.test(n)||/^(?:چه کارهایی بلدی|چه کاری ازت برمیاد|راهنما|چه کمکی می کنی|چه کمکی میکنی)$/.test(n))return specialistHelp(context);
 if(/^(?:پیش بینی نقدینگی|پیش بینی کسری نقدینگی|کسری نقدینگی) (?:([0-9]+) روز اینده)$/.test(n)){
  const days=Number(n.match(/[0-9]+/)[0]);if(days<1||days>90)return fail('بازه بین ۱ تا ۹۰ روز انتخاب کنید.','clarify');
  const cashReq={metric:'cash',mode:'total',period:'current'},dueReq={metric:'cheques',mode:'total',period:'until',days,scope:'open',direction:'all',kindFilter:'both'};
  if(![cashReq,dueReq].every(r=>mayRead(r,h.permissions())))return denied();
  const cash=read(cashReq),due=read(dueReq);if(!verified(cash,cashReq)||!verified(due,dueReq))return fail('داده معتبر برای برآورد نقدینگی کافی نیست.','clarify');
  const a=cash.data.value,b=due.data.received,c=due.data.paid,base=a-c,net=base+b;if(![a,b,c,base,net].every(Number.isSafeInteger))return fail('مبلغ خارج از محدوده محاسبه امن است.','clarify');
  const fmt=x=>C.fmt(x)+' '+C.unitName();
  return {text:'برآورد نقدینگی تا '+C.fmtDate(C.addDays(h.today(),days))+' با فرض وصول کامل دریافتی‌های ثبت‌شده: '+fmt(net),ctx:{},details:['نقدینگی ثبت‌شده: '+fmt(a),'دریافتی‌های باز با سررسید تا آن روز (شامل معوق): '+fmt(b),'پرداختی‌های باز با سررسید تا آن روز (شامل معوق): '+fmt(c),'بدون وصول دریافتی‌ها: '+fmt(base),net<0?'کسری احتمالی حتی با وصول کامل: '+fmt(-net):'در سناریوی وصول کامل، کسری پایان بازه نشان داده نمی‌شود.','این پیش‌بینی جریان کامل کسب‌وکار نیست؛ فروش آینده، هزینه‌های ثبت‌نشده و زمان دقیق وصول لحاظ نشده‌اند.'],actions:cash.actions||[],data:{kind:'cash-scenario',value:net},source:'سناریوی محاسباتی از داده‌های واقعی'};
 }
 if(/^(?:کالاهای راکد|کالاهای کم فروش|کالاهای بدون فروش|کدام کالاها راکد هستند)$/.test(n)){
  if(!h.permissions().warehouse||!h.permissions().reports||!h.permissions().cost)return denied();
  const insight=h.stock?.();valid();if(!insight||!Array.isArray(insight.stale))return fail('گزارش گردش انبار در دسترس نیست.','clarify');
  const rows=insight.stale;const details=rows.slice(0,10).map(x=>x.product.name+' — '+C.fmtQty(x.stock)+' '+(x.product.unit||'عدد')+' — '+C.toFa(x.idle)+' روز بدون فروش');
  return {text:rows.length?C.toFa(rows.length)+' کالا با موجودی مثبت و حداقل ۶۰ روز بدون فروش و بدون ورود جدید شناسایی شدند.':'با معیار ۶۰ روز، کالای راکد شناسایی نشد.',ctx:{},details,actions:[{label:'انبار',route:'#/products'}],data:{kind:'stock-insight'},source:'تحلیل گردش واقعی انبار'};
 }
 const r=specialistRoute(q,context,h.today());if(r){
  const req=request(r);if(!req)return fail('محدوده گزارش را دقیق‌تر مشخص کنید.','clarify');
  const x=read(req);if(!x)return denied();if(!verified(x,req))return {...fail(x.text||'گزارش معتبر در دسترس نیست.','clarify'),source:'موتور حسابداری'};
  return {...x,ctx:{lastReport:req},data:{...x.data,kind:'tool-result'},source:'گزارش واقعی حسابداری'};
 }
 if(context.finance||context.weighted||/راس گیری|میانگین موعد|محاسبه سود معامله|سود ماهانه|سود مرکب|سود ساده/.test(n)){
  if(!h.permissions().money)return denied();
  const x=context.weighted||/راس گیری|میانگین موعد/.test(n)?h.weighted?.(q,context):h.finance?.(q,context);
  valid();if(!h.permissions().money)return denied();if(x)return {...x,source:'محاسبه محلی؛ بدون ثبت خودکار'};
 }
 if(/^(?:امروز|دیروز|پریروز|این هفته|هفته قبل|این ماه|ماه قبل)(?: چی| چطور| چقدر بود)?$/.test(n))return fail('گزارش کدام موضوع را می‌خواهید؟ فروش، خرید، سود یا هزینه؟','clarify');
 return {...fail('برای این سؤال گزارش قطعی و سریع ندارم. موضوع یا بازه را دقیق‌تر بنویسید .','clarify'),source:'دستیار تخصصی؛ هیچ مبلغ حدسی ارائه نشد'};
}
const api={runSmart,specialistRoute,directReport};root.FQReports=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
