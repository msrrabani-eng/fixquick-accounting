/* Fix Quick v031 — offline mathematical problem interpreter and exact calculation engine.
   No dynamic evaluation, network, financial posting, or changes to accounting data. */
(function(root){'use strict';
const C=typeof module!=='undefined'&&module.exports?require('./core.js'):root.Core;
const F=typeof module!=='undefined'&&module.exports?require('./finance-scenario.js'):C.financeScenario;
const MAX=9000000000000n, B=10000n, maxMonths=360;
const words={'اللَن':'الان','اللن':'الان','الالن':'الان','اللانی':'الان','اظافه':'اضافه','اظافش':'اضافه','اظافه‌':'اضافه','ماندش':'مانده اش','ماندشو':'مانده اش','محاسباته':'محاسبات','محاصبه':'محاسبه','محاسبه‌گر':'محاسبه گر','اقصاط':'اقساط','اغساط':'اقساط','اغساطی':'اقساطی','پرداختب':'پرداختی','پرداختت':'پرداخت','درصذ':'درصد','درسد':'درصد','درصت':'درصد','ملیون':'میلیون','میلون':'میلیون','ملیارد':'میلیارد','تومن':'تومان','تومون':'تومان','بدهکارر':'بدهکار','بدحسابی':'بدحسابی','ماهیانه':'ماهانه','ماهیون':'ماهانه','سودش':'سود آن','دسیار':'دستیار','گوشب':'گوشی','فرختم':'فروختم','درص':'درصد','فروختمم':'فروختم','خریدمم':'خریدم','چقد':'چقدر','چقدره':'چقدر','چطوریه':'چطور','میخواد':'می خواهد','میخام':'می خواهم','میده':'می دهد','میدم':'می دهم','بدم':'بدهم','بده':'بده','رو':'را'};
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
 if(delayed&&/پرداخت (?:کرده|کردم|کرد|شده)|دریافت (?:کرده|کردم)|تسویه جزئی/.test(s)&&!/پرداخت نکرد|پرداختی نداشته/.test(s))return {error:'پرداخت قبلی را با مبلغ و زمان مشخص کنید؛ این محاسبه فقط دوره بدون پرداخت و سپس اقساط ثابت را پوشش می‌دهد.'};
 if(!recurring||(!delayed&&(!/روی مانده|به مانده|مانده نزولی|تا تسویه|چند قسط|چند ماه|چند وقت/.test(s)||ms.length!==0||rs.length!==1)))return null;
 if(as.length!==2||rs.length!==(delayed?2:1)||ms.length!==(delayed?1:0))return {error:'برای محاسبه مانده نزولی، مبلغ اصل، مبلغ قسط، نرخ ماهانه و در صورت تأخیر، مدت و نرخ دوره بدون پرداخت را دقیق مشخص کنید.'};
 if(!unit&&as.some(a=>!unitOf(a.raw)))return {error:'واحد مبلغ‌ها (تومان یا ریال) را مشخص کنید.'};
 const paymentCue=/ماهیانه|ماهانه|هر ماه|ماهی|قسط معمول|مبلغ قسط|قسط/;
 const candidates=as.filter(a=>paymentCue.test(s.slice(Math.max(0,a.index-25),a.index))||/^(?:\s+(?:در هر ماه|هر ماه|ماهانه|ماهیانه|قسط))/.test(s.slice(a.end)));
 if(candidates.length!==1)return {error:'کدام مبلغ اصل بدهی و کدام مبلغ قسط ماهانه است؟ مبلغ قسط را با عنوان «ماهانه» مشخص کنید.'};
 const pay=candidates[0],base=as.find(x=>x!==pay);
 const principal=amountOf(base.raw,unit||C.unit),payment=amountOf(pay.raw,unit||C.unit);
 const delay=delayed?ms[0].n:0;let delayBp=delayed?rs[0].bp:0,payBp=rs[delayed?1:0].bp;
 // Bind each rate to the nearest explicit phase cue, not arbitrary number order.
 if(delayed){
 const phase=v=>{
  const no=[...v.matchAll(/(?:بدون پرداخت|پرداختی نداشته|پرداخت نداشته|پرداخت نکرد|معوق|تاخیر|تأخیر|دوره اول|بدهکار بوده)/g)].pop();
  const yes=[...v.matchAll(/(?:پس از شروع پرداخت|بعد از شروع پرداخت|از زمانی که پرداختی (?:داره|دارد)|از زمانی که پرداخت|پس از پرداخت|بعد از پرداخت|دوره (?:اقساط|دوم)|از زمان پرداخت|هنگام پرداخت|سود اقساط)/g)].pop();
  if(!no&&!yes)return '';return !yes||no&&no.index>yes.index?'delay':'pay';
 };
 const p1=phase(s.slice(Math.max(0,rs[0].index-160),rs[0].index)),p2=phase(s.slice(rs[0].end,rs[1].index));
 if(!p1||!p2||p1===p2)return {error:'هر نرخ را با عنوان دوره بدون پرداخت یا پس از شروع اقساط مشخص کنید؛ ترتیب نامشخص را حدس نمی‌زنم.'};
 delayBp=p1==='delay'?rs[0].bp:rs[1].bp;payBp=p1==='pay'?rs[0].bp:rs[1].bp;
 }
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

/* Read-only word problems, before any report or inventory lookup. */
const buyCue='خریدم|خریده ام|خریداری کردم|قیمت خرید|بهای خرید|قیمت اولیه خرید|بهای تمام شده';
const sellCue='فروختم|فروخته ام|قیمت فروش|مبلغ فروش|فروش کردم|فروخته شد|می فروشم';
function problemText(raw){return normalize(raw).text.replace(/(میلیون|میلیارد|هزار|تومان|ریال)ی(?=\s|[،.؟؛]|$)/g,'$1');}
function safeAmount(a,u){const x=amountOf(a.raw,u||C.unit);return Number.isSafeInteger(x)&&x>=0&&BigInt(x)<=MAX?x:null;}
function tradeProblem(raw){
 const s=problemText(raw);
 if(!new RegExp(buyCue).test(s)||!new RegExp(sellCue).test(s)||!/سود|زیان/.test(s)||/اقساط|قسط|چک|ماهانه|گزارش|طبق ثبت|بر اساس ثبت/.test(s))return null;
 const aa=amounts(s);if(aa.length<2)return null;
 const fail=()=>ask('برای محاسبه سود، قیمت خرید و فروش قبل از تخفیف، هزینه و تخفیف را جداگانه مشخص کنید. مبالغ مبهم یا فرضی را از انبار جستجو نمی‌کنم.');
 if(rates(s).length||/پس از تخفیف|بعد از تخفیف|با احتساب تخفیف|چند دستگاه|چند معامله/.test(s))return fail();
 // The existing exact two-price formal percentage route is retained.
 if(aa.length===2&&!/هزینه|خرج|تخفیف|کارمزد|خریدم|فروختم|خریداری کردم/.test(s))return null;
 const roles={buy:buyCue,sell:sellCue,cost:'هزینه(?:\\s+(?:جانبی|رجیستری|تعمیر|حمل|ارسال|بسته بندی))?|خرج(?:ش| آن)?(?: کردم)?|کارمزد',discount:'تخفیف(?: دادم| گرفت| دادیم)?'};
 const assigned=[];
 for(let i=0;i<aa.length;i++){
  const a=aa[i],left=s.slice(i?aa[i-1].end:0,a.index),right=s.slice(a.end,i+1<aa.length?aa[i+1].index:s.length);
  const before=Object.entries(roles).filter(([k,v])=>new RegExp('(?:^|\\s)(?:'+v+')(?:\\s+(?:به مبلغ|به قیمت|به ارزش|مبلغ|قیمت|به))?\\s*[:：]?\\s*$').test(left)).map(([k])=>k);
  const after=Object.entries(roles).filter(([k,v])=>new RegExp('^\\s*(?:'+v+')(?=\\s|[،.؟؛]|$)').test(right)).map(([k])=>k);
  const possible=before.length?before:after;
  if(possible.length!==1)return fail();
  assigned.push({...a,role:possible[0]});
 }
 if(assigned.filter(a=>a.role==='buy').length!==1||assigned.filter(a=>a.role==='sell').length!==1)return fail();
 const scaled=assigned.some(a=>/میلیون|میلیارد|هزار/.test(a.raw));
 const shorthand=!scaled&&assigned.every(a=>/^\d+(?:\.\d+)?\s*تومان$/.test(a.raw)&&parseFloat(a.raw)<10000)&&/گوشی|ایفون|موبایل/.test(s)&&/تومن|تومون/.test(String(raw));
 if(scaled&&assigned.some(a=>!/میلیون|میلیارد|هزار/.test(a.raw)&&/^\d+(?:\.\d+)?\s*تومان$/.test(a.raw)&&parseFloat(a.raw)<10000))return fail();
 const u=unitOf(s);if(!u&&assigned.some(a=>!unitOf(a.raw)))return fail();
 const v={buy:0,sell:0,cost:0,discount:0};
 for(const a of assigned){const value=safeAmount({...a,raw:shorthand?a.raw.replace(/تومان$/,'میلیون تومان'):a.raw},u);if(value===null)return fail();v[a.role]+=value;}
 if(!Object.values(v).every(x=>Number.isSafeInteger(x)&&BigInt(x)<=MAX)||v.buy<=0||v.discount>v.sell)return fail();
 const sale=v.sell-v.discount,net=sale-v.buy-v.cost,totalCost=v.buy+v.cost;
 if(!Number.isSafeInteger(totalCost)||BigInt(totalCost)>MAX||BigInt(Math.abs(net))>MAX)return fail();
 const base=/حاشیه سود/.test(s)?sale:/کل هزینه|کل سرمایه|نسبت به بهای تمام شده/.test(s)?totalCost:v.buy;if(base<=0)return fail();
 const ratio=rational(BigInt(net)*100n,BigInt(base)),pct=display(rational(round(BigInt(net)*10000n,BigInt(base)),100n));
 const details=['قیمت خرید: '+money(v.buy),'فروش قبل از تخفیف: '+money(v.sell),'تخفیف: '+money(v.discount),'مبلغ فروش پس از تخفیف: '+money(sale),'هزینه جانبی: '+money(v.cost),'مبنای درصد: '+money(base)];
 if(shorthand)details.push('فرض: در بیان محاوره‌ای قیمت گوشی، «تومن» به معنی میلیون تومان است؛ اگر منظور تومان واقعی است، همه مبالغ را بر یک میلیون تقسیم کنید. درصد ثابت است.');
 return result((net<0?'زیان خالص: ':'سود خالص: ')+money(Math.abs(net))+' — '+(net<0?'درصد زیان: ':'درصد سود: ')+pct.replace(/^-/,'')+'٪',{},details,{kind:'trade-profit',value:net,exact:ratio.map(String),...v,netSale:sale,base,shorthand});
}
function installmentsProblem(raw){
 const s=problemText(raw);if(!/اقساط|قسط/.test(s)||!/پیش\s*پرداخت/.test(s)||!/ساده/.test(s)||/مرکب|روی مانده|کاهش یافته/.test(s))return null;
 const a=amounts(s),r=rates(s),m=s.match(new RegExp('('+number+')\\s*ماه(?:ه)?(?=\\s|[،.؟؛]|$)'));
 if(a.length!==1||r.length!==2||!m)return null;
 const pre=r.filter(x=>/پیش\s*پرداخت\s*$/.test(s.slice(Math.max(0,x.index-25),x.index))||/^\s*پیش\s*پرداخت/.test(s.slice(x.end)));
 const rate=r.filter(x=>/ماهانه\s*$/.test(s.slice(Math.max(0,x.index-20),x.index))||/^\s*(?:سود\s*)?ماهانه/.test(s.slice(x.end)));
 if(pre.length!==1||rate.length!==1||pre[0]===rate[0]||pre[0].bp===null||rate[0].bp===null)return null;
 const total=safeAmount(a[0],unitOf(s)),term=F.monthCount(m[1]),p=pre[0].bp;
 if(!total||!term||p<0||p>10000)return ask('قیمت، درصد پیش‌پرداخت یا مدت معتبر نیست.');
 const down=Number(round(BigInt(total)*BigInt(p),B)),principal=total-down;
 const x=F.calculate({mode:'remaining',principal,months:term,rateBp:rate[0].bp,method:'simple'});if(!x.ok)return ask(x.error);
 const fin=down+x.due;if(!Number.isSafeInteger(fin)||BigInt(fin)>MAX)return ask('مبلغ نهایی از محدوده امن بیشتر است.');
 // Divide in whole selected currency units and assign the rounding remainder to final cheque.
 const step=C.unit==='toman'?10n:1n,each=Number(round(BigInt(x.due),BigInt(term)*step)*step),last=x.due-each*(term-1);
 return result('مجموع قیمت نهایی: '+money(fin),{},['پیش‌پرداخت: '+money(down),'اصل اقساط: '+money(principal),'سود ساده: '+money(x.interest),'هر قسط (به‌جز آخر): '+money(each),'قسط آخر: '+money(last),'مجموع اقساط: '+money(x.due)],{kind:'installment',value:x.due,final:fin,interest:x.interest,down,each,last});
}
function growthProblem(raw){
 const s=problemText(raw);if(!/سرمایه/.test(s)||!/در گردش/.test(s)||!/سود خالص/.test(s)||!/هزینه ثابت/.test(s)||!/به سرمایه اضافه/.test(s))return null;
 const a=amounts(s),r=rates(s),ms=months(s);
 if(a.length!==2||r.length!==2||ms.length!==1||!ms[0].n||r.some(x=>x.bp===null))return ask('سرمایه اولیه، درصد گردش، درصد سود روی گردش، هزینه ماهانه و تعداد ماه‌ها را مشخص کنید.');
 const turnover=r.find(x=>/^\s*(?:سرمایه(?: ام)?\s*)?در گردش/.test(s.slice(x.end))),margin=r.find(x=>/^\s*سود/.test(s.slice(x.end)));
 if(!turnover||!margin||turnover===margin||!/هزینه ثابت/.test(s.slice(a[0].end,a[1].index)))return ask('کدام درصد گردش سرمایه و کدام درصد سود روی گردش است؟');
 const start=safeAmount(a[0],unitOf(s)),cost=safeAmount(a[1],unitOf(s));if(!start||cost===null)return ask('مبالغ سرمایه و هزینه معتبر نیستند.');
 let balance=BigInt(start);const details=['فرض: سود ماهانه روی مبلغ در گردش محاسبه و پس از کسر هزینه به سرمایه اضافه می‌شود.'];
 for(let i=1;i<=ms[0].n;i++){if(balance<0n)return ask('سرمایه برای ادامه این سناریو کافی نیست.');const income=round(balance*BigInt(turnover.bp)*BigInt(margin.bp),B*B),profit=income-BigInt(cost);balance+=profit;if(abs(balance)>MAX)return ask('مبلغ از محدوده امن بیشتر است.');details.push('ماه '+C.toFa(i)+': سود خالص '+money(Number(profit))+'؛ سرمایه پایان ماه '+money(Number(balance)));}
 const profit=Number(balance-BigInt(start));details.push('مجموع سود خالص: '+money(profit));return result('سرمایه نهایی: '+money(Number(balance)),{},details,{kind:'capital-growth',value:Number(balance),profit});
}
function balanceProblem(raw){
 const s=problemText(raw);if(!/مانده حساب|مانده.*طلب/.test(s)||!/چک/.test(s)||!/نقد/.test(s)||!/خریدم/.test(s)||!/فروختم/.test(s))return null;
 const a=amounts(s);if(a.length<3)return null;
 const fail=()=>ask('برای تسویه فرضی، مبلغ فروش، نقد دریافتی، تعداد و مبلغ هر چک، تعداد چک وصول‌شده و ارزش خرید متقابل را مشخص کنید.');
 if(a.length!==4||!/دو چک|2 چک/.test(s)||!/یکی پاس شده|یکی وصول شده/.test(s)||!/دیگری.*(?:پاس نشده|وصول نشده)/.test(s))return fail();
 if(!/فروختم/.test(s.slice(a[0].end,a[1].index))||!/نقد/.test(s.slice(a[1].end,a[2].index))||!/خریدم/.test(s.slice(a[3].end)))return fail();
 const u=unitOf(s),v=a.map(x=>safeAmount(x,u));if(v.some(x=>x===null))return fail();
 const [sold,cash,cheque,bought]=v,account=sold-cash-cheque*2-bought,uncollected=account+cheque;
 if(![account,uncollected].every(x=>Number.isSafeInteger(x)&&BigInt(Math.abs(x))<=MAX))return fail();
 return result('مانده حساب شخص: '+money(account)+' — مجموع طلب با چک وصول‌نشده: '+money(uncollected),{},['فروش: '+money(sold),'نقد: '+money(cash),'دو چک دریافتی: '+money(cheque*2),'خرید متقابل: '+money(bought),'چک وصول‌نشده: '+money(cheque),'فرض: دریافت چک از حساب شخص کسر می‌شود؛ وصول نقدی جداگانه محاسبه می‌شود.'],{kind:'balance-scenario',value:account,uncollected});
}
function isWordProblem(raw){
 const s=problemText(raw),a=amounts(s);
 return a.length>=2&&/چقدر|چند درصد|چند قسط|محاسبه|چند ماه/.test(s)&&/خریدم|فروختم|گرفتم|دادم|سرمایه دارم|سرمایه ام|بدهکارم|طلب دارم/.test(s)&&!/گزارش|طبق ثبت|بر اساس ثبت/.test(s);
}

function tryMath(raw,ctx={},h){
 const word=tradeProblem(raw)||installmentsProblem(raw)||growthProblem(raw)||balanceProblem(raw);if(word)return word;
 const st=h?.state?.(),protectedNames=[...(st?.people||[]),...(st?.products||[])].map(x=>x.name||'');
 const n=normalize(raw,protectedNames),s=n.text;
 if(ctx.mathDebt&&/^(لغو|پایان محاسبه|لغو محاسبه|محاسبه جدید)$/.test(s))return result('محاسبه فرضی پایان یافت.');
 if(ctx.mathDebt&&/^(جدول|جدول اقساط|جزییات|جزئیات|محاسبات|دوباره محاسبه کن)$/.test(s))return renderDebt(ctx.mathDebt);
 if(ctx.mathDebt&&Number.isInteger(ctx.pendingRate)&&/^(?:دوره اول|دوره دوم|دوره اقساط|اقساط|دوره تاخیر|تاخیر|دوره بدون پرداخت|بدون پرداخت|بعد از شروع پرداخت)$/.test(s)){
 const d={...ctx.mathDebt};if(/اول|تاخیر|بدون پرداخت/.test(s))d.delayBp=ctx.pendingRate;else d.payBp=ctx.pendingRate;return renderDebt(d,n.fixes);
 }
 const d=parseDebt(s);
 if(d){if(d.error)return ask(d.error);d.inputUnit=unitOf(s)||C.unit;return renderDebt(d,n.fixes);}
 if(ctx.mathDebt&&/قسط|پرداخت ماهانه|ماهیانه|ماهانه|درصد|سود|تاخیر|تأخیر|اول ماه|ابتدای ماه|پایان ماه|اخر ماه|بدهی اولیه/.test(s)&&!/امروز چقدر|فروش|خرید|گزارش|موجودی|مانده حساب/.test(s)&&!(amounts(s).length===1&&rates(s).length===1&&!/قسط|تاخیر|تأخیر|دوره/.test(s))){
  const a=amend(s,ctx.mathDebt);if(a?.ambiguous)return ask('این نرخ مربوط به دوره تأخیر است یا دوره اقساط؟',{...ctx,pendingRate:rates(s)[0]?.bp});if(a)return renderDebt(a,n.fixes);
 }
 let expr=s.replace(/^(?:حساب کن|محاسبه کن|نتیجه|حاصل|چقدر میشه|چقدر می شود)\s*:?\s*/,'').replace(/[؟?]$/,'').replace(/\s*(?:چقدر می شود|چقدر میشه|چند می شود|چقدر|مساوی است)\s*$/,'').replace(/=$/,'').replace(/به علاوه|بعلاوه|جمع با|به اضافه/g,'+').replace(/منهای|منها/g,'-').replace(/ضرب در/g,'*').replace(/تقسیم بر/g,'/').replace(/به توان/g,'^');
 if(/^[\d\s.+\-*/^()%٪×÷xX−–]+$/.test(expr)&&/[+\-*/^%٪×÷xX−–]/.test(expr)){try{const a=expression(expr);return result('نتیجه: '+display(a),{},['عبارت: '+C.toFa(expr),a[1]===1n?'محاسبه صحیح و دقیق.':'مقدار دقیق: '+C.toFa(a[0].toString())+' / '+C.toFa(a[1].toString())],{kind:'arithmetic',exact:[String(a[0]),String(a[1])]});}catch(e){return ask(e.message);}}
 const as=amounts(s),rs=rates(s),u=unitOf(s);
 if(as.length===2&&!rs.length&&/چند درصد|درصد تغییر|درصد رشد|درصد کاهش|درصد سود|حاشیه سود|درصد زیان/.test(s)&&!/ماه|قسط|دریافت|پرداخت ماهانه|مانده حساب|امروز|دیروز/.test(s)){
  if(!u&&as.some(a=>!unitOf(a.raw)))return ask('واحد مبالغ را مشخص کنید.');
  const a=amountOf(as[0].raw,u||C.unit),b=amountOf(as[1].raw,u||C.unit);
  if(!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||a<=0)return ask('مبلغ مبنا باید مثبت و معتبر باشد.');
  let kind='درصد تغییر',base=a;
  if(/خرید|بهای تمام شده|قیمت تمام شده|قیمت اولیه/.test(s)&&/فروش|قیمت نهایی/.test(s)){
   if(!/خرید|بهای تمام شده|قیمت تمام شده|قیمت اولیه/.test(s.slice(0,as[0].index)))return ask('ابتدا قیمت خرید و سپس قیمت فروش را با عنوان مشخص وارد کنید.');
   kind=/حاشیه سود/.test(s)?'حاشیه سود فروش':'بازده روی بهای خرید';if(kind==='حاشیه سود فروش')base=b;
  }else if(!/از .* به |ابتدا|قبلا|مبنا|قیمت اولیه/.test(s))return ask('کدام مبلغ مبنا و کدام مبلغ نهایی است؟ مثال: از ۱۰۰ میلیون تومان به ۱۲۰ میلیون تومان.');
  if(base<=0)return ask('مبنای درصد باید مثبت باشد.');
  const frac=rational(BigInt(b-a)*100n,BigInt(base));return result(kind+': '+display(frac)+'٪',{},['مبلغ اولیه: '+money(a),'مبلغ نهایی: '+money(b),'تفاوت مبلغ: '+money(b-a),'مبنای درصد: '+money(base)],{kind:'percent-change',exact:[String(frac[0]),String(frac[1])],value:b-a});
 }
 if(as.length===1&&rs.length===1&&/چقدر|محاسبه|چند|حاصل|اضافه|کم کن/.test(s)&&!/ماه|قسط|از حساب|موجودی|فروش امروز|خرید امروز/.test(s)){
  const a=amountOf(as[0].raw,u||C.unit),bp=rs[0].bp;if(!Number.isSafeInteger(a)||bp===null)return ask('مبلغ یا درصد روشن نیست.');
  const part=round(BigInt(a)*BigInt(bp),B);let total=part,kind='درصد از مبلغ';
  if(/اضافه|افزایش|بیشتر/.test(s)){total=BigInt(a)+part;kind='مبلغ با افزایش درصدی';}else if(/کم کن|کسر|تخفیف|کاهش/.test(s)){total=BigInt(a)-part;kind='مبلغ پس از کاهش درصدی';}
  if(abs(total)>MAX)return ask('مبلغ از محدوده امن بیشتر است.');
  return result(kind+': '+money(total),{},['مبلغ مبنا: '+money(a),'درصد: '+C.toFa(String(bp/100))+'٪','مبلغ درصد: '+money(part)],{kind:'percent',value:Number(total)});
 }
 return null;
}
const problemFacts=s=>({amounts:amounts(s),rates:rates(s),months:[...s.matchAll(new RegExp('('+number+')\\s*ماه(?:ه)?(?=\\s|$|[،.؟؛])','gu'))].map(m=>({raw:m[0],n:F.monthCount(m[1]),index:m.index,end:m.index+m[0].length}))});
const api={normalize,expression,display,parseDebt,schedule,tryMath,isWordProblem,problemFacts};root.FQMath=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
