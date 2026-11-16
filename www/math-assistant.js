/* Fix Quick v031 — offline mathematical problem interpreter and exact calculation engine.
   No dynamic evaluation, network, financial posting, or changes to accounting data. */
(function(root){'use strict';
const C=typeof module!=='undefined'&&module.exports?require('./core.js'):root.Core;
const F=typeof module!=='undefined'&&module.exports?require('./finance-scenario.js'):C.financeScenario;
const MAX=9000000000000n, B=10000n, maxMonths=360;
const words={'اللَن':'الان','اللن':'الان','الالن':'الان','اللانی':'الان','اظافه':'اضافه','اظافش':'اضافه','اظافه‌':'اضافه','ماندش':'مانده اش','ماندشو':'مانده اش','محاسباته':'محاسبات','محاصبه':'محاسبه','محاسبه‌گر':'محاسبه گر','اقصاط':'اقساط','اغساط':'اقساط','اغساطی':'اقساطی','پرداختب':'پرداختی','پرداختت':'پرداخت','درصذ':'درصد','درسد':'درصد','درصت':'درصد','ملیون':'میلیون','میلون':'میلیون','ملیارد':'میلیارد','تومن':'تومان','تومون':'تومان','بدهکارر':'بدهکار','بدحسابی':'بدحسابی','ماهیانه':'ماهانه','ماهیون':'ماهانه','سودش':'سود آن','دسیار':'دستیار','چقد':'چقدر','چقدره':'چقدر','چطوریه':'چطور','میخواد':'می خواهد','میخام':'می خواهم','میده':'می دهد','میدم':'می دهم','بدم':'بدهم','بده':'بده','رو':'را'};
function normalize(raw,protectedNames=[]){
 let s=C.toEn(String(raw??'')).normalize('NFKC').replace(/[\u0640\u064b-\u065f\u0670]/g,'').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[أإآ]/g,'ا').replace(/[\u200c\u200e\u200f]/g,' ').replace(/[,٬](?=\d{3}(?:\D|$))/g,'').replace(/٫/g,'.').replace(/\s+/g,' ').trim();
 const fixes=[],protectedSet=new Set(protectedNames.flatMap(x=>C.norm(x).split(' ')));
 s=s.replace(/[\p{L}]+/gu,t=>{const v=words[t];if(v&&v!==t&&!protectedSet.has(C.norm(t))){fixes.push([t,v]);return v;}return t;});
 return {text:s,fixes:[...new Map(fixes.map(x=>[x[0],x])).values()]};
}
const money=n=>C.fmt(Number(n))+' '+C.unitName();
const result=(text,ctx={},details=[],data={kind:'math-result'},rows=[])=>({text,ctx,details,actions:[],data,rows,source:'موتور محاسبات دقیق آفلاین؛ بدون ثبت سند'});
const ask=(text,ctx={},details=[])=>result(text,ctx,details,{kind:'clarify'});
const round=(n,d)=>{if(d<=0n)throw Error('مخرج نامعتبر');return n>=0n?(n+d/2n)/d:-((-n+d/2n)/d);};
const dec=n=>{if(!/^\d+(?:\.\d{1,8})?$/.test(n))throw Error('عدد نامعتبر');const [a,b='']=n.split('.');return [BigInt(a+b),10n**BigInt(b.length)];};
const abs=n=>n<0n?-n:n;
function gcd(a,b){a=abs(a);b=abs(b);while(b)[a,b]=[b,a%b];return a||1n;}
function rational(n,d=1n){if(!d)throw Error('تقسیم بر صفر تعریف نشده است.');if(d<0n){n=-n;d=-d;}const g=gcd(n,d);n/=g;d/=g;if(n.toString().length>160||d.toString().length>160)throw Error('عدد خارج از محدوده محاسبات است.');return [n,d];}
function op(a,b,o){const [n,d]=a,[m,e]=b;if(o==='+')return rational(n*e+m*d,d*e);if(o==='-')return rational(n*e-m*d,d*e);if(o==='*')return rational(n*m,d*e);if(o==='/')return rational(n*e,d*m);if(o==='^'){if(e!==1n||abs(m)>30n)throw Error('توان صحیح از منفی ۳۰ تا ۳۰ مجاز است.');return m<0n?rational(d**(-m),n**(-m)):rational(n**m,d**m);}throw Error('عملگر نامعتبر');}
function expression(raw){
 const s=C.toEn(raw).replace(/٫/g,'.').replace(/[,٬](?=\d{3}(?:\D|$))/g,'').replace(/[×xX]/g,'*').replace(/÷/g,'/').replace(/[−–]/g,'-').replace(/\s/g,'');
 if(!s||s.length>300||!/^[\d.+\-*/^()%٪]+$/.test(s))throw Error('عبارت حسابی معتبر نیست.');
 const ts=s.match(/\d+(?:\.\d+)?|[+\-*/^()%٪]/g)||[];if(ts.join('')!==s||ts.length>160)throw Error('عبارت نامعتبر است.');
 let i=0,depth=0;
 function atom(){if(++depth>40)throw Error('پرانتز بیش از حد');let a,t=ts[i++];if(t==='('){a=add();if(ts[i++]!==')')throw Error('پرانتز بسته نشده است.');}else if(/^\d/.test(t||''))a=dec(t);else throw Error('عدد یا پرانتز لازم است.');while(['%','٪'].includes(ts[i])){i++;a=op(a,[100n,1n],'/');}depth--;return a;}
 function power(){const a=atom();return ts[i]==='^'?(i++,op(a,unary(),'^')):a;}
 function unary(){if(++depth>40)throw Error('عبارت بیش از حد پیچیده');let a;if(ts[i]==='+'||ts[i]==='-'){const k=ts[i++];a=unary();if(k==='-')a=[-a[0],a[1]];}else a=power();depth--;return a;}
 function mul(){let a=unary();while(ts[i]==='*'||ts[i]==='/'){const o=ts[i++];a=op(a,unary(),o);}return a;}
 function add(){let a=mul();while(ts[i]==='+'||ts[i]==='-'){const o=ts[i++];a=op(a,mul(),o);}return a;}
 const v=add();if(i!==ts.length)throw Error('عبارت کامل نیست.');return rational(...v);
}
function display([n,d]){if(d===1n)return C.toFa(n.toString());const sign=n<0n?'-':'',v=abs(n),scale=100000000n,q=round(v*scale,d);const str=sign+(q/scale)+'.'+String(q%scale).padStart(8,'0').replace(/0+$/,'');return C.toFa(str.replace(/\.$/,'').replace('.', '٫'));}
const numWords='صفر|یک|یه|دو|سه|چهار|پنج|شش|شیش|هفت|هشت|نه|ده|یازده|دوازده|سیزده|چهارده|پانزده|شانزده|هفده|هجده|نوزده|بیست|سی|چهل|پنجاه|شصت|هفتاد|هشتاد|نود|صد|یکصد|دویست|سیصد|چهارصد|پانصد|ششصد|هفتصد|هشتصد|نهصد|نیم';
const number='(?:\\d+(?:\\.\\d+)?|(?:'+numWords+')(?:\\s+و\\s+(?:'+numWords+'))*)';
const amountPattern=number+'(?:\\s*(?:میلیارد|میلیون|هزار))?(?:\\s*(?:تومان|ریال))?';
function amounts(s){return [...s.matchAll(new RegExp('(?:^|[^\\p{L}\\d.])('+amountPattern+')(?=\\s|$|[،,.؟؛])','gu'))].map(m=>({raw:m[1],index:m.index+m[0].indexOf(m[1]),end:m.index+m[0].length})).filter(x=>/میلیون|میلیارد|هزار|تومان|ریال/.test(x.raw));}
function amountOf(t,unit){return F.amount(t,unit);}
function unitOf(s){const a=/تومان/.test(s),b=/ریال/.test(s);return a&&!b?'toman':b&&!a?'rial':null;}
function rateOf(t){return F.basisPoints(t);}
function rates(s){return [...s.matchAll(new RegExp('('+number+')\\s*(?:درصد|[%٪])','gu'))].map(m=>({bp:rateOf(m[1]),raw:m[0],index:m.index,end:m.index+m[0].length}));}
function months(s){return [...s.matchAll(new RegExp('('+number+')\\s*ماه(?![\\p{L}])','gu'))].map(m=>({n:F.monthCount(m[1]),index:m.index,end:m.index+m[0].length}));}
function schedule(d){
 const err=error=>({ok:false,error});if(!d||!Number.isSafeInteger(d.principal)||d.principal<=0||BigInt(d.principal)>MAX||!Number.isInteger(d.delay)||d.delay<0||d.delay>60||!Number.isInteger(d.delayBp)||d.delayBp<0||d.delayBp>10000||!Number.isInteger(d.payBp)||d.payBp<0||d.payBp>10000||!Number.isSafeInteger(d.payment)||d.payment<=0||BigInt(d.payment)>MAX||!['end','start'].includes(d.timing)||!['compound','simple'].includes(d.delayMethod))return err('مبلغ، نرخ، مدت یا ترتیب پرداخت معتبر نیست.');
 let principal=BigInt(d.principal),bal=principal,due=0n,total=0n,interest=0n;const rows=[],toNum=n=>Number(n);
 const append=(phase,month,opening,i,p,closing)=>{if([opening,i,p,closing].some(x=>x<0n||x>MAX))throw Error('مبلغ از سقف محاسبات امن خارج شد.');rows.push({phase,month,opening:toNum(opening),interest:toNum(i),payment:toNum(p),closing:toNum(closing)});};
 try{
 for(let k=1;k<=d.delay;k++){const opening=bal,i=round((d.delayMethod==='simple'?principal:bal)*BigInt(d.delayBp),B);bal+=i;interest+=i;append('delay',k,opening,i,0n,bal);}
 due=bal;
 for(let k=1;k<=maxMonths&&bal>0n;k++){
  const opening=bal;let i,p;if(d.timing==='end'){i=round(bal*BigInt(d.payBp),B);p=BigInt(d.payment)<bal+i?BigInt(d.payment):bal+i;bal+=i-p;}else{p=BigInt(d.payment)<bal?BigInt(d.payment):bal;bal-=p;i=round(bal*BigInt(d.payBp),B);bal+=i;}
  if(bal>=opening)return err('قسط برای کاهش بدهی کافی نیست؛ مبلغ قسط باید بیشتر شود یا نرخ کاهش یابد.');
  interest+=i;total+=p;append('payment',k,opening,i,p,bal);
  if(total>MAX||interest>MAX)return err('جمع محاسبات بیش از سقف امن است.');
 }
 if(bal>0n)return err('با این شرایط بدهی در ۳۶۰ ماه تسویه نمی‌شود.');
 if(total!==principal+interest)return err('کنترل تراز محاسبات ناموفق بود.');
 return {ok:true,principal:d.principal,due:Number(due),total:Number(total),interest:Number(interest),count:rows.length-d.delay,rows};
 }catch(e){return err(e.message);}
}
function parseDebt(text){
 const s=text,as=amounts(s),rs=rates(s),ms=months(s),unit=unitOf(s);
 if(!/اقساط|قسط|پرداخت|بدهی|بدهکار/.test(s)||!/سود|درصد/.test(s)||!/ماه/.test(s))return null;
 const delayed=/بدون پرداخت|پرداختی نداشته|پرداخت نداشته|پرداخت نکرد|پول نداده|معوق|تا الان|تا حالا|تا امروز|مدت تاخیر|مدت تأخیر/.test(s);
 const recurring=/ماهانه|ماهی|هر ماه|قسط/.test(s);
 if(!delayed||!recurring)return null;
 if(as.length!==2||rs.length!==2||ms.length!==1)return {error:'برای محاسبه دو مرحله‌ای، اصل بدهی، مدت بدون پرداخت، نرخ آن دوره، مبلغ قسط ماهانه و نرخ پس از شروع پرداخت را مشخص کنید.'};
 if(!unit&&as.some(a=>!unitOf(a.raw)))return {error:'واحد مبلغ‌ها (تومان یا ریال) را مشخص کنید.'};
 const principal=amountOf(as[0].raw,unit||C.unit),payment=amountOf(as[1].raw,unit||C.unit);
 const delay=ms[0].n,delayBp=rs[0].bp,payBp=rs[1].bp;
 // Only assign rates when clauses establish which rate applies to each phase.
 const before=s.slice(Math.max(0,rs[0].index-100),rs[0].end+35),after=s.slice(Math.max(0,rs[1].index-100),rs[1].end+35);
 if(!/بدهکار|پرداختی نداشته|پرداخت نداشته|بدون پرداخت|تاخیر|تأخیر|معوق|اول/.test(before)||!/پرداخت|قسط|از زمانی|بعد|شروع/.test(after))return {error:'مشخص کنید کدام نرخ مربوط به دوره بدون پرداخت و کدام مربوط به دوره اقساط است.'};
 if(!Number.isSafeInteger(principal)||!Number.isSafeInteger(payment)||delay===null||delayBp===null||payBp===null)return {error:'مبالغ، مدت یا درصد معتبر نیست؛ دوباره با واحد دقیق وارد کنید.'};
 return {principal,payment,delay,delayBp,payBp,timing:/اول ماه|ابتدای ماه|اولین قسط امروز|اولین پرداخت امروز|قسط اول همین الان|قسط اول الان/.test(s)?'start':'end',delayMethod:/سود ساده|روی اصل ثابت/.test(s)?'simple':'compound'};
}
function renderDebt(d,fixes=[]){
 const r=schedule(d);if(!r.ok)return ask(r.error,{mathDebt:d});
 const pct=bp=>C.toFa(String(bp/100))+'٪';
 const details=['اصل بدهی: '+money(d.principal),'دوره بدون پرداخت: '+C.toFa(d.delay)+' ماه با نرخ '+pct(d.delayBp)+' روی '+(d.delayMethod==='compound'?'مانده بدهی':'اصل ثابت'),'مانده پیش از اولین قسط: '+money(r.due),'دوره اقساط: نرخ '+pct(d.payBp)+' روی مانده؛ '+(d.timing==='end'?'ابتدا سود ماه و سپس پرداخت در پایان ماه؛ اولین قسط یک ماه بعد':'پرداخت اول همین امروز؛ سپس سود روی مانده تا پایان ماه'),'قسط معمول: '+money(d.payment),'آخرین پرداخت: '+money(r.rows[r.rows.length-1].payment),'کل سود دو دوره: '+money(r.interest),'جمع پرداخت‌ها: '+money(r.total),'محاسبات تا یک ریال در هر ماه گرد شده‌اند. این سناریوی فرضی است و هیچ سندی ثبت نشده است.'];
 if(fixes.length)details.push('اصلاح نوشتار: '+fixes.map(x=>x.join(' ← ')).join('، '));
 return result('تسویه در '+C.toFa(r.count)+' قسط؛ مجموع '+money(r.total),{mathDebt:d},details,{kind:'debt-schedule',value:r.total,...r},r.rows);
}
function amend(s,d){
 const as=amounts(s),rs=rates(s),ms=months(s),unit=unitOf(s);let v={...d},changed=false;
 if(as.length===1&&/قسط|پرداخت ماهانه|ماهی|ماهانه/.test(s)){const a=amountOf(as[0].raw,unit||d.inputUnit||C.unit);if(a===null)return null;v.payment=a;changed=true;}
 else if(as.length===1&&/اصل|بدهی اولیه/.test(s)){const a=amountOf(as[0].raw,unit||d.inputUnit||C.unit);if(a===null)return null;v.principal=a;changed=true;}
 if(rs.length===1){if(/بدون پرداخت|تاخیر|تأخیر|معوق|دوره اول/.test(s)){v.delayBp=rs[0].bp;changed=true;}else if(/قسط|بعد|دوره دوم|پرداخت/.test(s)){v.payBp=rs[0].bp;changed=true;}else return {ambiguous:true};}
 if(ms.length===1&&/بدون پرداخت|تاخیر|تأخیر|معوق|دوره اول/.test(s)){v.delay=ms[0].n;changed=true;}
 if(/اولین قسط امروز|قسط اول امروز|اول ماه|ابتدای ماه/.test(s)){v.timing='start';changed=true;}if(/پایان ماه|اخر ماه|اولین قسط ماه بعد/.test(s)){v.timing='end';changed=true;}
 if(/سود دوره اول ساده|سود تاخیر ساده|سود تأخیر ساده/.test(s)){v.delayMethod='simple';changed=true;}if(/سود دوره اول مرکب|سود تاخیر مرکب|سود تأخیر مرکب/.test(s)){v.delayMethod='compound';changed=true;}
 return changed?v:null;
}
function tryMath(raw,ctx={},h){
 const st=h?.state?.(),protectedNames=[...(st?.people||[]),...(st?.products||[])].map(x=>x.name||'');
 const n=normalize(raw,protectedNames),s=n.text;
 if(ctx.mathDebt&&/^(لغو|پایان محاسبه|لغو محاسبه|محاسبه جدید)$/.test(s))return result('محاسبه فرضی پایان یافت.');
 if(ctx.mathDebt&&/^(جدول|جدول اقساط|جزییات|جزئیات|محاسبات|دوباره محاسبه کن)$/.test(s))return renderDebt(ctx.mathDebt);
 const d=parseDebt(s);
 if(d){if(d.error)return ask(d.error);d.inputUnit=unitOf(s)||C.unit;return renderDebt(d,n.fixes);}
 if(ctx.mathDebt&&/قسط|پرداخت ماهانه|ماهیانه|ماهانه|درصد|سود|تاخیر|تأخیر|اول ماه|ابتدای ماه|پایان ماه|اخر ماه|بدهی اولیه/.test(s)&&!/امروز چقدر|فروش|خرید|گزارش|موجودی|مانده حساب/.test(s)){
  const a=amend(s,ctx.mathDebt);if(a?.ambiguous)return ask('این نرخ مربوط به دوره تأخیر است یا دوره اقساط؟',ctx);if(a)return renderDebt(a,n.fixes);
 }
 let expr=s.replace(/^(?:حساب کن|محاسبه کن|نتیجه|حاصل|چقدر میشه|چقدر می شود)\s*:?\s*/,'').replace(/[؟?]$/,'').replace(/\s*(?:چقدر می شود|چقدر میشه|چند می شود|چقدر|مساوی است)\s*$/,'').replace(/=$/,'').replace(/به علاوه|بعلاوه|جمع با|به اضافه/g,'+').replace(/منهای|منها/g,'-').replace(/ضرب در/g,'*').replace(/تقسیم بر/g,'/').replace(/به توان/g,'^');
 if(/^[\d\s.+\-*/^()%٪×÷xX−–]+$/.test(expr)&&/[+\-*/^%٪×÷xX−–]/.test(expr)){try{const a=expression(expr);return result('نتیجه: '+display(a),{},['عبارت: '+C.toFa(expr),a[1]===1n?'محاسبه صحیح و دقیق.':'مقدار دقیق: '+C.toFa(a[0].toString())+' / '+C.toFa(a[1].toString())],{kind:'arithmetic',exact:[String(a[0]),String(a[1])]});}catch(e){return ask(e.message);}}
 const as=amounts(s),rs=rates(s),u=unitOf(s);
 if(as.length===1&&rs.length===1&&/چقدر|محاسبه|چند|حاصل|اضافه|کم کن/.test(s)&&!/ماه|قسط|از حساب|موجودی|فروش امروز|خرید امروز/.test(s)){
  const a=amountOf(as[0].raw,u||C.unit),bp=rs[0].bp;if(!Number.isSafeInteger(a)||bp===null)return ask('مبلغ یا درصد روشن نیست.');
  const part=round(BigInt(a)*BigInt(bp),B);let total=part,kind='درصد از مبلغ';
  if(/اضافه|افزایش|بیشتر/.test(s)){total=BigInt(a)+part;kind='مبلغ با افزایش درصدی';}else if(/کم کن|کسر|تخفیف|کاهش/.test(s)){total=BigInt(a)-part;kind='مبلغ پس از کاهش درصدی';}
  if(abs(total)>MAX)return ask('مبلغ از محدوده امن بیشتر است.');
  return result(kind+': '+money(total),{},['مبلغ مبنا: '+money(a),'درصد: '+C.toFa(String(bp/100))+'٪','مبلغ درصد: '+money(part)],{kind:'percent',value:Number(total)});
 }
 return null;
}
const api={normalize,expression,display,parseDebt,schedule,tryMath};root.FQMath=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
