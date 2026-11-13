/* Fix Quick v014 — privacy-first, offline, READ-ONLY conversational analytics.
 * Not a generative LLM: responds only to verified supported accounting questions.
 */
(function(root){
'use strict';
const C=(typeof module!=='undefined'&&module.exports)?require('./core.js'):root.Core;
const normalize = s=>C.norm(String(s||'')).replace(/[؟?!،,.]/g,' ').replace(/\s+/g,' ').trim();
const money=n=>C.fmt(Math.round(n||0))+' '+C.unitName();
const result=(text,ctx,actions,details)=>({text,ctx:ctx||{},actions:actions||[],details:details||[]});
function period(q,today,context){
  const s=normalize(q);
  if(/دیروز/.test(s))return {...C.periodRange('yesterday',today),label:'دیروز'};
  if(/امروز/.test(s))return {...C.periodRange('today',today),label:'امروز'};
  if(/ماه قبل|ماه گذشته/.test(s))return {...C.periodRange('prevmonth',today),label:'ماه قبل'};
  if(/هفته قبل|هفته گذشته/.test(s))return {...C.periodRange('prevweek',today),label:'هفته قبل'};
  if(/این هفته/.test(s))return {...C.periodRange('week',today),label:'این هفته'};
  if(/امسال|سال جاری/.test(s))return {...C.periodRange('fytd',today),label:'سال مالی جاری'};
  if(/این ماه|ماه جاری/.test(s))return {...C.periodRange('mtd',today),label:'این ماه'};
  if(/همون دوره|همان دوره|اون دوره/.test(s)&&context?.range)return context.range;
  return null;
}
function names(st,q){
  let nq=normalize(q);
  return (st.people||[]).filter(x=>{const n=normalize(x.name); return n.length>=3&&nq.includes(n);});
}
function choosePerson(st,q,ctx){
  const found=names(st,q);
  if(found.length===1)return found[0];
  if(found.length>1)return {ambiguous:found.slice(0,5)};
  if(ctx?.personId && /(همون|همان|ایشون|اون|او|وی|ش|مشتری قبلی|این شخص|ازش|بهش|حسابش)/.test(normalize(q)))return (st.people||[]).find(p=>p.id===ctx.personId)||null;
  return null;
}
function ask(st,question,context,opts){
  context=context||{};opts=opts||{};
  const q=normalize(question),today=opts.today||C.todayISO(),allow=opts.allow||{};
  const allowed=(key)=>allow[key]!==false;
  if(!q)return result('سؤال خود را بنویسید؛ مثلاً «مانده حساب علی چقدر است؟»',context);
  const range=period(q,today,context);
  const hasWords=rx=>rx.test(q);
  // Deterministic multi-turn: short follow-ups reuse the last supported intent/period.
  let intent='';
  if(hasWords(/خطا|اشتباه|تکراری|مغایرت/))intent='risk';
  else if(hasWords(/سود|زیان|حاشیه سود/))intent='profit';
  else if(hasWords(/هزینه|خرج/))intent='expense';
  else if(hasWords(/چک|سررسید|اقساط/))intent='cheques';
  else if(hasWords(/فروش|درآمد|فروخت/))intent='sales';
  else if(hasWords(/موجودی|انبار|کالا/))intent='stock';
  else if(hasWords(/فاکتور|فاکتورهای/))intent='invoices';
  else if(hasWords(/بده|طلب|مانده|حساب (?:آقا|خانم)|تسویه/))intent='balance';
  else if((hasWords(/قبلی|چی|چقدر|همون|همان|اون|ایشون/)||range)&&context.intent)intent=context.intent;
  if(intent==='risk'){
    if(!allowed('reports'))return result('دسترسی بررسی خطاهای مالی برای این کاربر فعال نیست.',{});
    const r=C.smartGuard.scan(st,{today,max:8});
    return result(r.count?'در بررسی اولیه '+C.toFa(r.count)+' مورد مشکوک به ثبت تکراری پیدا شد؛ این موارد الزاماً خطای قطعی نیستند.':'در بررسی ثبت‌های تکراری مورد مشکوکی پیدا نشد. این نتیجه جایگزین مغایرت‌گیری بانکی نیست.',{intent},[{label:'مشاهده جزئیات کنترل خطا',route:'#/safety'}],r.items.map(x=>x.message));
  }
  if(intent==='cheques'){
    if(!allowed('money'))return result('شما مجوز مشاهده چک‌ها را ندارید.',{});
    const days=(C.toEn(q).match(/(\d+)\s*روز/)||[])[1];
    const limit=days?C.addDays(today,Math.min(365,Number(days))):today;
    const list=(st.cheques||[]).filter(c=>!c.done&&c.dueDate&&c.dueDate<=limit);
    const past=list.filter(c=>c.dueDate<today).length,amount=list.reduce((s,c)=>s+(+c.amount||0),0);
    return result((days?'تا '+C.toFa(days)+' روز آینده (شامل معوقه‌ها)':'تا امروز')+' '+C.toFa(list.length)+' چک/قسط تعیین‌تکلیف‌نشده با جمع '+money(amount)+' وجود دارد. '+(past?'از این تعداد '+C.toFa(past)+' مورد سررسیدگذشته است.':''),{intent,days},[{label:'مشاهده چک‌ها',route:'#/cheques'}],list.slice(0,5).map(c=>(c.title||c.serial||'چک')+' — '+C.isoToJalali(c.dueDate)+' — '+money(c.amount)));
  }
  if(intent==='balance'){
    if(!allowed('balances'))return result('مجوز مشاهده مانده حساب اشخاص برای این کاربر فعال نیست.',{});
    const p=choosePerson(st,q,context);
    if(p?.ambiguous)return result('چند شخص با این نام پیدا شد. نام کامل‌تر را بنویسید: '+p.ambiguous.map(x=>x.name).join('، '),{});
    if(!p)return result('نام شخص مشخص نیست. نام کامل یا بخشی مشخص از نام مشتری را همراه سؤال بنویسید؛ مثل «مانده حساب علی رضایی».',{});
    const bal=C.balanceOf(st,p.id);
    const text=bal>0?'شما از '+p.name+' مبلغ '+money(bal)+' طلب دارید.':bal<0?'شما به '+p.name+' مبلغ '+money(-bal)+' بدهکار هستید.':'حساب '+p.name+' طبق ثبت‌های موجود تسویه است.';
    return result(text,{intent,personId:p.id},[{label:'مشاهده حساب '+p.name,route:'#/person/'+p.id}]);
  }
  if(intent==='stock'){
    if(!allowed('warehouse'))return result('مجوز مشاهده انبار برای این کاربر فعال نیست.',{});
    const words=q.replace(/موجودی|انبار|کالا|چقدر|چند|داریم|دارم|از|تعداد|هست|رو|را|؟/g,'').trim();
    if(!words)return result('نام کالا را بگویید؛ مثل «موجودی آیفون ۱۶ پرو»',{});
    const matches=(st.products||[]).filter(p=>C.matchScore(p.name+' '+(p.sku||''),words)>0).slice(0,8);
    if(!matches.length)return result('کالایی مطابق «'+words+'» در اطلاعات ثبت‌شده پیدا نشد.',{});
    const rp=C.replay(st);
    const lines=matches.map(p=>{const stock=rp.stock[p.id]?.stock||0;return p.name+': '+C.toFa(stock)+' '+(p.unit||'عدد');});
    return result('موجودی '+C.toFa(matches.length)+' کالای مرتبط در انبار ثبت شده است:',{intent,term:words},[{label:'مشاهده انبار',route:'#/products'}],lines);
  }
  if(intent==='invoices'){
    if(!allowed('reports'))return result('مجوز مشاهده اطلاعات فاکتورها برای این کاربر فعال نیست.',{});
    const p=choosePerson(st,q,context);
    if(p?.ambiguous)return result('چند شخص با این نام پیدا شد. نام دقیق‌تر را بنویسید: '+p.ambiguous.map(x=>x.name).join('، '),{});
    if(!p)return result('برای بررسی فاکتورها، نام شخص را هم بنویسید؛ مثلاً «فاکتورهای علی رضایی».',{});
    const inv=(st.invoices||[]).filter(i=>i.personId===p.id&&(!range||i.date>=range.from&&i.date<=range.to));
    const sum=inv.reduce((n,i)=>n+C.invoiceTotals(i).total,0);
    return result('برای '+p.name+' تعداد '+C.toFa(inv.length)+' فاکتور'+(range?' در '+range.label:'')+' با مجموع ناخالص '+money(sum)+' ثبت شده است. این عدد جمع مبالغ اسناد است، نه مانده حساب.',{intent,personId:p.id,range},[{label:'مشاهده حساب '+p.name,route:'#/person/'+p.id}]);
  }
  if(['sales','profit','expense'].includes(intent)){
    if(!allowed('reports'))return result('مجوز مشاهده گزارش‌های مالی برای این کاربر فعال نیست.',{});
    if(intent==='profit'&&!allowed('cost'))return result('مجوز مشاهده سود و قیمت خرید برای این کاربر فعال نیست.',{});
    const rg=range||((context.intent===intent&&context.range)?context.range:{...C.periodRange('mtd',today),label:'این ماه'});
    const person=choosePerson(st,q,context);
    if(person?.ambiguous)return result('نام چند شخص مشابه است. نام دقیق‌تر را بنویسید.',{});
    if(person && intent==='sales'){
      const docs=(st.invoices||[]).filter(i=>i.personId===person.id&&i.date>=rg.from&&i.date<=rg.to&&['sale','sale_return'].includes(i.type));
      const value=docs.reduce((n,i)=>{const x=C.invoiceTotals(i);return n+(i.type==='sale'?1:-1)*(x.total-x.vat);},0);
      return result('فروش خالص ثبت‌شده به '+person.name+' در '+rg.label+' برابر '+money(value)+' است؛ این مبلغ لزوماً وصول‌شده نیست.',{intent,range:rg,personId:person.id},[{label:'مشاهده حساب '+person.name,route:'#/person/'+person.id}]);
    }
    if(person && intent!=='sales')return result('تفکیک '+(intent==='profit'?'سود':'هزینه')+' بر اساس شخص در این نسخه پشتیبانی نمی‌شود؛ برای جلوگیری از نمایش عدد گمراه‌کننده، مجموع کل را به جای آن نشان نمی‌دهم.',{});
    const r=C.report(st,rg.from,rg.to);
    const amount=intent==='sales'?r.revenue:intent==='profit'?r.net:r.expenses;
    const title=intent==='sales'?'فروش خالص':intent==='profit'?'سود خالص':'هزینه‌های ثبت‌شده';
    return result(title+' '+rg.label+' برابر '+money(amount)+' است. این محاسبه فقط بر اساس اسناد موجود در برنامه انجام شده است.',{intent,range:rg},[{label:'گزارش‌های مالی',route:'#/reports'}],intent==='profit'?['فروش خالص: '+money(r.revenue),'بهای کالای فروش‌رفته: '+money(r.cogs),'هزینه‌ها: '+money(r.expenses)]:[]);
  }
  return result('برای این سؤال پاسخ محاسباتی مطمئنی ندارم. می‌توانید درباره «مانده حساب مشتری»، «فروش این ماه»، «سود»، «هزینه»، «چک‌های سررسید»، «موجودی کالا» یا «خطاهای احتمالی» سؤال کنید. برای جستجوی عمومی از بخش جستجو استفاده کنید.',{},[{label:'جستجوی سراسری',route:'#/search'}]);
}
C.smartAssistant={ask};
if(typeof module!=='undefined'&&module.exports)module.exports=C.smartAssistant;
})(typeof window!=='undefined'?window:globalThis);
