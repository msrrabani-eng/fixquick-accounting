/* Fix Quick v017 — deterministic, offline, read-only Persian accounting assistant. */
(function(root){
'use strict';
const C=typeof module!=='undefined'&&module.exports?require('./core.js'):root.Core;
const normalize=s=>C.norm(String(s||'').normalize('NFKC').replace(/[\u0640\u064b-\u065f\u0670]/g,'')).replace(/[؟?!،,.؛:«»]/g,' ').replace(/\s+/g,' ').trim();
const money=n=>C.fmt(Math.round(n))+' '+C.unitName();
const result=(text,ctx={},actions=[],details=[],data=null)=>({text,ctx,actions,details,data});
const clarify=(text,ctx={})=>result(text,ctx,[],[],{kind:'clarify'});
const denied=()=>result('مجوز مشاهده این اطلاعات مالی برای این کاربر فعال نیست.',{},[],[],{kind:'denied'});
const search=()=>result('برای این سؤال پاسخ محاسباتی مطمئنی ندارم. موضوع، نام شخص یا کالا و بازه زمانی را مشخص کنید. مثلاً «بیشترین کارکردمون با کی بوده؟» یا «فروش این ماه چقدر بوده؟».',{},[{label:'جستجوی سراسری',route:'#/search'}],[],{kind:'unsupported'});
const whole=(q,n)=>n&&(' '+q+' ').includes(' '+n+' ');
const personAction=p=>[{label:'مشاهده حساب '+p.name,route:'#/person/'+p.id}];
function period(q,today,ctx,st){
  let k,label;
  if(/دیروز/.test(q)){k='yesterday';label='دیروز';}
  else if(/امروز/.test(q)){k='today';label='امروز';}
  else if(/ماه (قبل|گذشته|پیش)/.test(q)){k='prevmonth';label='ماه قبل';}
  else if(/هفته (قبل|گذشته|پیش)/.test(q)){k='prevweek';label='هفته قبل';}
  else if(/این هفته|هفته جاری/.test(q)){k='week';label='این هفته';}
  else if(/امسال|سال جاری|سال مالی جاری/.test(q)){k='fytd';label='سال مالی جاری';}
  else if(/این ماه|ماه جاری/.test(q)){k='mtd';label='این ماه';}
  else if(/از ابتدا|از اول|تا الان|تا به حال|تا حالا|کل دوره|همه دوره|همه زمان/.test(q))return {from:null,to:today,label:'از ابتدای ثبت تا امروز'};
  else {const m=q.match(/(\d+)\s*روز (قبل|اخیر|گذشته)/);if(m&&+m[1]>=1&&+m[1]<=3650)return {from:C.addDays(today,1-Number(m[1])),to:today,label:C.toFa(m[1])+' روز اخیر'};if(/همون دوره|همان دوره|اون دوره/.test(q))return ctx.range||null;return null;}
  const r=C.periodRange(k,today,st.settings?.fyMonth);return {...r,to:r.to>today?today:r.to,label};
}
function entity(rows,q,kind){
  const all=rows||[];const normalized=all.map(p=>({p,n:normalize(p.name)})).filter(x=>x.n);
  const exact=normalized.filter(x=>whole(q,x.n));
  if(exact.length)return exact.filter(x=>!exact.some(y=>y.n.length>x.n.length&&whole(y.n,x.n))).map(x=>x.p);
  if(kind==='product')return [];
  // Only distinctive whole name tokens, never substring such as «علی» in «علیان».
  const generic=new Set(['فروشگاه','شرکت','آقا','خانم','حاج','مهندس','مشتری','شخص','کالا','خرید','فروش','حساب','بانک']);
  return normalized.filter(x=>x.n.split(' ').some(n=>n.length>=3&&!generic.has(n)&&whole(q,n))).map(x=>x.p);
}
function ask(st,question,context={},opts={}){
  let q=normalize(question);const today=opts.today||C.todayISO(),allow=opts.allow||{},can=k=>allow[k]!==false;
  if(!q)return clarify('سؤال خود را بنویسید؛ مثلاً «بیشترین کارکرد با کی بوده؟»');
  // No mutations, forecasts, unrelated or compound questions pretending to be single metrics.
  if(/(?:^| )(حذف|پاک کن|ثبت کن|ثبتش کن|ویرایش کن|اضافه کن|تغییر بده|پیش بینی|پیشبینی|فردا چقدر میفروشیم)(?: |$)/.test(q))return search();
    const people=entity(st.people,q,'person'),products=entity(st.products,q,'product');
  // Full entity names are not intent keywords (e.g. فروشگاه پارس is not فروش).
  for(const e of [...people,...products]){const n=normalize(e.name);if(whole(q,n))q=(' '+q+' ').replace(' '+n+' ',' ENTITY ').trim();}
  const explicit=period(q,today,context,st);
  if(/فردا|هفته (بعد|اینده)|ماه (بعد|اینده)|سال (بعد|اینده)/.test(q)&&!/چک|سررسید|اقساط|قسط/.test(q))return clarify('این دستیار گزارش ثبت‌های موجود را محاسبه می‌کند؛ برای آینده پیش‌بینی ارائه نمی‌کند.');
  if(/سال (قبل|گذشته|پیش)|پارسال|(?:^| )(?:دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|[0-9]+) ماه (قبل|گذشته|پیش)|[0-9]+ سال|از تاریخ|بازه زمانی خاص/.test(q))return clarify('این بازه را به شکل امروز، دیروز، این ماه، ماه قبل، این هفته یا تعداد روز اخیر مشخص کنید.');
  if(/امروز و دیروز|دیروز و امروز|این ماه و ماه قبل|ماه قبل و این ماه/.test(q))return clarify('برای مقایسه دو دوره، هر دوره را جداگانه سؤال کنید.');
  if(/(?:^| )(چرا|دلیل|علت|پیش بینی|پیشبینی)(?: |$)/.test(q))return clarify('برای تشخیص علت یا پیش‌بینی، صرفاً از یک عدد نمی‌توان نتیجه گرفت؛ گزارش عددی مشخصی مانند فروش این ماه یا ماه قبل را بپرسید.');
  const pronoun=/(?:^| )(ایشون|ایشان|اون|همون|همان|ازش|بهش|حسابش|بدهیش|طلبش|او)(?: |$)/.test(q);
  const follow=!!explicit&&/^(ماه|هفته|این ماه|این هفته|امسال|سال جاری|امروز|دیروز|از ابتدا|از اول|کل دوره|\d+ روز|همون دوره)/.test(q)&&!/(فروش|خرید|طلب|بده|سود|هزینه|کارکرد|گردش|فاکتور|چک|کالا|موجودی)/.test(q);
  const allRange={from:null,to:today,label:'از ابتدای ثبت تا امروز'};
  const defaultMonth={...C.periodRange('mtd',today),label:'این ماه'};
  const rank=/بیشترین|بیشتر(?:ین)?(?: |$)|بالاترین|بزرگ ?ترین|پر ?فروش|پر ?خرید|پر ?تراکنش|کمترین|کمتر(?:ین)?(?: |$)|رتبه اول|اول جدول|صدر جدول|اول لیست|بیش از همه|از همه بیشتر|از همه کمتر|بیشتر از همه/.test(q);
  const low=/کمترین|کمتر(?:ین)?(?: |$)|از همه کمتر/.test(q);
  const turn=/کار ?کرد|گردش|داد و ستد|مراود|حجم (معامله|معاملات)|رفت و امد حساب/.test(q);
  const sales=/فروش(?!گاه|نده)|فروخت|فروخته|از ما خرید|خرید از ما|درامد فروش|خریدار/.test(q);
  const buys=/خرید|خریدمون|خریدیم|تامین کننده|فروشنده|جنس گرفت/.test(q);
  const exp=/هزینه|خرج|مخارج/.test(q),profit=/سود|زیان|درامد خالص/.test(q);
  const qty=/تعداد|چند تا|چندتا|چند عدد|چند دستگاه|چند قلم|چند بار|چندبار/.test(q);
  const payable=/بدهی (?:من|ما)|بدهکار(?:یم|م)|به کی بده|به چه کسی بده|بهش بده|بستانکار|باید (?:به .* )?بد(?:ه|یم)|به .* بدهکار/.test(q);
  const receivable=/طلب|بدهکار|بدهی|بهمون بده|به ما بده|به من بده|از .* پول بگیر/.test(q);
  let metric='',mode='scalar',p=null,prod=null,direction='all',days=0;
  if(/خطا|ثبت تکراری|اشتباه ثبت|مغایرت/.test(q))metric='risk';
  else if(/چک|سررسید|اقساط|قسط/.test(q)){metric='cheques';direction=/پرداختی|صادر|پاس کنیم|پاس بش|دادیم|دادنی/.test(q)?'pay':/دریافتی|گرفتیم|وصول|گرفتنی/.test(q)?'receive':'all';const m=q.match(/(\d+)\s*روز/);days=m?+m[1]:/فردا/.test(q)?1:0;if(days>365)return clarify('بازه چک را بین امروز و ۳۶۵ روز آینده مشخص کنید.');if(rank||profit||exp)return search();}
  else if(/موجودی (?:نقد|صندوق|بانک|حساب)|پول (?:نقد|توی صندوق|تو صندوق|تو بانک)|نقدینگی|جمع (?:بانک و صندوق|صندوق و بانک)/.test(q))metric='cash';
  else if(/ارزش (?:کل )?انبار|ارزش موجودی/.test(q))metric='inventory-value';
  else if(/موجودی|انبار/.test(q)&&!rank&&!sales&&!buys){metric='stock';mode='product';}
  else if(rank){mode='rank';if(profit||exp)return clarify('برای رتبه‌بندی، معیار قابل مقایسه را مشخص کنید: گردش، فروش، خرید، تعداد فاکتور یا مانده حساب.');
    if(turn)metric='turnover';
    else if(payable)metric='payable';else if(receivable)metric='receivable';
    else if(/فاکتور/.test(q))metric='invoice-count';
    else if(sales&&/کالا|محصول|گوشی|جنس|مدل|پرفروش|پر فروش/.test(q)&&!/مشتری|شخص|به کی|به چه کسی/.test(q))metric=qty||/پرفروش|پر فروش/.test(q)&&!/مبلغ|ارزش/.test(q)?'product-qty':'product-sales';
    else if(/خرید از ما|از ما خرید/.test(q)||sales&&!/خرید (?:از|کردیم)|از کی خرید|از چه کسی خرید/.test(q))metric='sales';else if(buys)metric='purchases';
    else return clarify('بیشترین از نظر چه چیزی؟ گردش حساب، مبلغ فروش، مبلغ خرید، تعداد فاکتور یا مانده؟');
  }else if(profit)metric='profit';else if(exp)metric='expense';else if(turn){metric='turnover';mode=people.length||pronoun?'person':'scalar';}
  else if(/پرداخت|پول داد|واریز کردیم|دادیم به/.test(q)&&!/فاکتور/.test(q)){metric='payments';}
  else if(/دریافت|پول گرفت|واریز کرد|گرفتیم از/.test(q)&&!/فاکتور/.test(q)){metric='receipts';}
  else if(/فاکتور/.test(q))metric=sales?'sale-count':buys?'purchase-count':'invoice-count';
  else if(payable||receivable||/مانده|تسویه|حساب (آقا|خانم)/.test(q))metric=people.length||pronoun||!/جمع|مجموع|کل|همه|چقدر بدهکاریم|چقدر طلب داریم/.test(q)?'balance':payable?'payable':'receivable';
  else if(sales)metric='sales';else if(buys)metric='purchases';
  else if(products.length&&qty){metric='stock';mode='product';}
  else if(follow&&context.metric){metric=context.metric;mode=context.mode||'scalar';direction=context.direction||'all';days=context.days||0;}
  else if(pronoun&&context.metric){metric=context.metric;mode=context.mode||'person';}
  else return search();
  // Avoid answering a different query than was asked.
  if(profit&&exp)return clarify('سود خالص را می‌خواهید یا هزینه‌ها؟');
  if(/فروش و خرید|خرید و فروش/.test(q)&&metric!=='turnover'&&metric!=='invoice-count')return clarify('گزارش خرید را می‌خواهید یا فروش؟ هر کدام را جداگانه بپرسید.');
  if(/دریافت و پرداخت|پرداخت و دریافت/.test(q))return clarify('مبلغ دریافت را می‌خواهید یا پرداخت؟');
  const monetaryPerson=['sales','purchases','invoice-count','sale-count','purchase-count','receipts','payments','turnover','balance'];
  const needsPerson=/(?:^| )(از|به|برای|با) (?:کی|چه کسی|کدوم شخص|کدام شخص)(?: |$)/.test(q);
  const subjectCue=/(?:^| )(به|از|برای|با) (?!ابتدا(?: |$)|اول(?: |$)|ما(?: |$)|من(?: |$)|همه(?: |$)|امروز(?: |$)|دیروز(?: |$)|این(?: |$)|[0-9]+(?: |$)|نظر(?: |$)|صورت(?: |$)|حال(?: |$))[^ ]+/.test(q);
  if(mode!=='rank'&&metric!=='stock'&&people.length>1){if(!can('balances')&&!can('reports'))return denied();return clarify('چند شخص با این نام پیدا شد. نام کامل‌تر را بنویسید: '+people.map(x=>x.name).join('، '));}
  if(mode==='rank'&&people.length)return clarify('رتبه‌بندی همه اشخاص را می‌خواهید یا گزارش همین شخص؟');
  if(mode!=='rank'&&metric!=='stock'){
    p=people[0]||((pronoun||follow)&&context.personId?(st.people||[]).find(x=>x.id===context.personId):null);
    if(p&&monetaryPerson.includes(metric))mode='person';
    if(p&&!monetaryPerson.includes(metric))return result('تفکیک '+(metric==='profit'?'سود':metric==='expense'?'هزینه':'این گزارش')+' بر اساس شخص در این نسخه پشتیبانی نمی‌شود؛ مبلغ کل را جایگزین نمی‌کنم.');
    if((metric==='balance'||mode==='person'||monetaryPerson.includes(metric)&&(needsPerson||subjectCue)&&!p)&&!p)return clarify('نام شخص مشخص نیست. نام کامل شخص را بنویسید.');
    if(products.length&&['sales','purchases','profit','expense','invoice-count'].includes(metric))return clarify('برای این گزارش کالا، معیار دقیق را مشخص کنید؛ مبلغ، تعداد یا موجودی؟');
  }
  const balanceMetrics=['balance','receivable','payable','turnover'];
  const access=metric==='risk'||['sales','purchases','profit','expense','invoice-count','sale-count','purchase-count','product-sales','product-qty'].includes(metric)?'reports':balanceMetrics.includes(metric)?'balances':['cash','receipts','payments','cheques'].includes(metric)?'money':'warehouse';
  if(!can(access)||(['profit','inventory-value'].includes(metric)&&!can('cost'))||((metric==='receipts'||metric==='payments')&&p&&!can('balances')))return denied();
  if(mode==='rank'&&metric.startsWith('product-')&&!can('warehouse'))return denied();
  let range=explicit||((follow||pronoun)&&context.range?context.range:null)||(mode==='rank'||mode==='person'||balanceMetrics.includes(metric)?allRange:defaultMonth);
  const inRange=d=>!!d&&(!range.from||d>=range.from)&&d<=range.to;
  const docs=(st.invoices||[]).filter(i=>inRange(i.date));
  const ctx={metric,mode,range,personId:p?.id,direction,days,low:follow?!!context.low:low,intent:mode==='rank'?'ranking':metric};
  const label={sales:'فروش خالص',purchases:'خرید خالص',profit:'سود خالص',expense:'هزینه‌های ثبت‌شده',turnover:'گردش حساب',receivable:'طلب از اشخاص',payable:'بدهی به اشخاص','invoice-count':'تعداد فاکتورها','sale-count':'تعداد فاکتورهای فروش','purchase-count':'تعداد فاکتورهای خرید','product-sales':'فروش خالص کالا','product-qty':'تعداد خالص فروش کالا',receipts:'دریافت نقدی/بانکی ثبت‌شده در حساب اشخاص',payments:'پرداخت نقدی/بانکی ثبت‌شده در حساب اشخاص'}[metric];
  const countMetric=metric.endsWith('count')||metric==='product-qty';const fmt=v=>countMetric?C.fmtQty(v)+(metric==='product-qty'?' واحد':' فاکتور'):money(v);
  const routes=[{label:'گزارش‌های مالی',route:'#/reports'}];
  if(metric==='risk'){const r=C.smartGuard.scan(st,{today,max:8});return result(r.count?'در بررسی اولیه '+C.toFa(r.count)+' مورد مشکوک به ثبت تکراری پیدا شد؛ خطای قطعی نیست.':'در بررسی ثبت‌های تکراری مورد مشکوکی پیدا نشد.',ctx,[{label:'مشاهده جزئیات کنترل خطا',route:'#/safety'}],r.items.map(x=>x.message),{metric,value:r.count});}
  if(metric==='cheques'){
    if(explicit&&!/امروز/.test(q))return clarify('برای سررسیدهای باز، تعداد روز آینده یا «امروز» را مشخص کنید.');
    const end=C.addDays(today,days),overdueOnly=/معوق|سررسید گذشته|عقب افتاده/.test(q);
    const list=(st.cheques||[]).filter(c=>!c.done&&(!c.cyc||!c.state||['box','bank','issued'].includes(c.state))&&c.dueDate&&(overdueOnly?c.dueDate<today:c.dueDate<=end)&&(direction==='all'||c.direction===direction));
    const value=list.reduce((v,c)=>v+c.amount,0);return result((overdueOnly?'معوقه‌ها':'تا '+C.toFa(days)+' روز آینده (شامل معوقه‌ها)')+'؛ '+(direction==='receive'?'دریافتی':direction==='pay'?'پرداختی':'دریافتی و پرداختی')+': '+C.toFa(list.length)+' چک/قسط تعیین‌تکلیف‌نشده با جمع '+money(value),ctx,[{label:'مشاهده چک‌ها',route:'#/cheques'}],list.slice(0,8).map(c=>(c.title||c.serial||'چک')+' — '+C.isoToJalali(c.dueDate)+' — '+money(c.amount)),{metric,value,count:list.length,direction});
  }
  if(metric==='cash'||metric==='inventory-value'||metric==='stock'){
    if(explicit&&range.to!==today)return clarify('این گزارش فقط برای وضعیت فعلی در دسترس است.');
    if(metric==='cash'){if(/(?:بانک|صندوق)/.test(q)&&!(/بانک/.test(q)&&/صندوق/.test(q)))return clarify('جمع همه حساب‌ها و بانک‌ها را می‌خواهید یا فقط یک حساب مشخص؟ برای جزئیات از بخش صندوق و بانک استفاده کنید.');const source=Array.isArray(st.accounts)&&st.accounts.length?st:JSON.parse(JSON.stringify(st));const value=C.cashBalance(source);return result('موجودی ثبت‌شده صندوق و بانک: '+money(value),ctx,[{label:'صندوق و بانک',route:'#/accounts'}],[],{metric,value});}
    if(metric==='inventory-value'){const value=C.inventoryValue(st);return result('ارزش فعلی موجودی انبار (بهای خرید): '+money(value),ctx,[{label:'انبار',route:'#/products'}],[],{metric,value});}
    if(!products.length){const terms=q.replace(/موجودی|انبار|چقدر|چند ?تا|چند عدد|چند دستگاه|تعداد|فعلی|الان|داریم|داره|دارم|موجوده|موجود|هست|(?:^| )از(?: |$)|(?:^| )تو(?: |$)|(?:^| )رو(?: |$)|(?:^| )را(?: |$)|بگو/g,' ').replace(/\s+/g,' ').trim();const hits=terms?st.products.filter(x=>whole(normalize(x.name),terms)):[];return clarify(hits.length?'نام کامل مدل یا ظرفیت را مشخص کنید: '+hits.slice(0,6).map(x=>x.name).join('، '):'نام دقیق کالا را بنویسید؛ مثلاً «موجودی کابل شارژ»');}
    if(products.length>1)return clarify('نام کالا را دقیق‌تر بنویسید: '+products.map(x=>x.name).join('، '));
    prod=products[0];const value=C.replay(st).stock[prod.id]?.stock||0;return result('موجودی فعلی '+prod.name+': '+C.fmtQty(value)+' '+(prod.unit||'عدد'),ctx,[{label:'مشاهده انبار',route:'#/products'}],[],{metric,value,productId:prod.id});
  }
  const balances=C.balancesAt(st,range.to);
  if(metric==='balance'){const value=balances[p.id]||0;return result(value>0?'شما از '+p.name+' مبلغ '+money(value)+' طلب دارید.':value<0?'شما به '+p.name+' مبلغ '+money(-value)+' بدهکار هستید.':'حساب '+p.name+' طبق ثبت‌های موجود تسویه است.',ctx,personAction(p),['مانده تا '+C.isoToJalali(range.to)],{metric,value,personId:p.id,to:range.to});}
  const sums=new Map();const add=(id,v,dr=0,cr=0)=>{const a=sums.get(id)||{id,value:0,dr:0,cr:0};a.value+=v;a.dr+=dr;a.cr+=cr;sums.set(id,a);};
  if(metric==='receivable'||metric==='payable'){for(const x of st.people||[])add(x.id,Math.max(0,(balances[x.id]||0)*(metric==='receivable'?1:-1)));}
  else if(['turnover','receipts','payments'].includes(metric)){for(const t of st.tx||[]){if(t.personId==null||!inRange(t.date)||t.type==='opening'||!(t.amount>0))continue;if(metric==='receipts'&&t.type!=='receipt'||metric==='payments'&&t.type!=='payment')continue;if(!['debit','credit'].includes(t.kind))continue;add(t.personId,t.amount,t.kind==='debit'?t.amount:0,t.kind==='credit'?t.amount:0);}}
  else if(['sales','purchases','invoice-count','sale-count','purchase-count','product-sales','product-qty'].includes(metric)){
    for(const i of docs){if(metric==='invoice-count'||metric==='sale-count'&&i.type==='sale'||metric==='purchase-count'&&i.type==='purchase'){add(i.personId,1);continue;}if(countMetric&&metric!=='product-qty')continue;const types=metric==='purchases'?['purchase','purchase_return']:['sale','sale_return'];if(!types.includes(i.type))continue;const sg=i.type===types[0]?1:-1,t=C.invoiceTotals(i);if(metric.startsWith('product-'))for(const l of t.lines)add(l.productId,sg*(metric==='product-qty'?l.qty:l.net));else add(i.personId,sg*(t.total-t.vat));}
  }
  const explanation=metric==='turnover'?'کارکرد = جمع بدهکار و بستانکار، بدون مانده اول دوره؛ نه فروش و نه سود.':metric==='receivable'||metric==='payable'?'مانده در پایان بازه، نه گردش دوره.':metric==='sales'||metric==='purchases'||metric.startsWith('product-')?'خالص پس از کسر برگشتی‌ها؛ مبالغ بدون ارزش افزوده.':countMetric?'تعداد اسناد ثبت‌شده.':'';
  if(mode==='rank'){
    const entities=new Map((metric.startsWith('product-')?st.products:st.people).map(x=>[x.id,x]));const rows=[...sums.values()].filter(x=>x.value>0&&entities.has(x.id)).sort((a,b)=>(ctx.low?a.value-b.value:b.value-a.value)||a.id-b.id);
    if(!rows.length)return result('برای '+label+' در '+range.label+' مورد مثبت ثبت نشده است.',ctx,[],[],{metric,mode,value:0,rows:[]});
    const best=rows[0],ties=rows.filter(x=>x.value===best.value),n=Math.min(10,Math.max(1,Number((q.match(/(\d+)\s*(?:نفر|شخص|مشتری|کالا|مورد)/)||[])[1]||5))),name=x=>entities.get(x.id).name;
    const title=(ctx.low?'کمترین':'بیشترین')+' '+label+' ('+range.label+') متعلق به '+ties.map(name).join('، ')+' است: '+fmt(best.value)+' . '+explanation;
    return result(title,ctx,metric.startsWith('product-')?[{label:'انبار',route:'#/products'}]:personAction(entities.get(best.id)),rows.slice(0,n).map((x,i)=>C.toFa(i+1)+'. '+name(x)+' — '+fmt(x.value)+(metric==='turnover'?' (بدهکار: '+money(x.dr)+'، بستانکار: '+money(x.cr)+')':'')),{metric,mode,value:best.value,id:best.id,rows:rows.slice(0,n),from:range.from,to:range.to});
  }
  let value,details=[];
  if(metric==='profit'||metric==='expense'){const r=C.report(st,range.from,range.to);value=metric==='profit'?r.net:r.expenses;if(metric==='profit')details=['فروش خالص: '+money(r.revenue),'بهای کالای فروش‌رفته و تعدیلات: '+money(r.cogsTotal),'هزینه‌ها: '+money(r.expenses)];}
  else if(p){value=sums.get(p.id)?.value||0;if(metric==='turnover'){const x=sums.get(p.id)||{dr:0,cr:0};details=['بدهکار: '+money(x.dr),'بستانکار: '+money(x.cr)];}}
  else value=[...sums.values()].reduce((v,x)=>v+x.value,0);
  if(!Number.isFinite(value))return search();
  let text=label+(p?' '+(metric==='sales'?'به ':metric==='purchases'?'از ':'')+p.name:'')+' در '+range.label+' برابر '+fmt(value)+' است. '+explanation;
  if(metric==='invoice-count'&&p){const sum=docs.filter(i=>i.personId===p.id).reduce((n,i)=>n+C.invoiceTotals(i).total,0);text='برای '+p.name+' تعداد '+C.toFa(value)+' فاکتور در '+range.label+' با مجموع ناخالص '+money(sum)+' ثبت شده است. این مبلغ مانده حساب نیست.';}
  return result(text,ctx,p?personAction(p):routes,details,{metric,mode,value,personId:p?.id,from:range.from,to:range.to});
}
C.smartAssistant={ask};if(typeof module!=='undefined'&&module.exports)module.exports=C.smartAssistant;
})(typeof window!=='undefined'?window:globalThis);
