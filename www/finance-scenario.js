/* Fix Quick — local read-only financing calculator. No language-model calls or ledger writes. */
(function(root){
'use strict';
const C=typeof module!=='undefined'&&module.exports?require('./core.js'):root.Core;
const MAX=9000000000000n;
const norm=v=>C.toEn(String(v??'')).normalize('NFKC').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[آأإ]/g,'ا').replace(/[\u200c\u200e\u200f]/g,' ').replace(/[٬,](?=\d{3}(?:\D|$))/g,'').replace(/٫/g,'.').replace(/\s+/g,' ').trim();
const words={'صفر':0,'یک':1,'یه':1,'دو':2,'سه':3,'چهار':4,'پنج':5,'شش':6,'شیش':6,'هفت':7,'هشت':8,'نه':9,'ده':10,'یازده':11,'دوازده':12,'سیزده':13,'چهارده':14,'پانزده':15,'شانزده':16,'هفده':17,'هجده':18,'نوزده':19,'بیست':20,'سی':30,'چهل':40,'پنجاه':50,'شصت':60,'هفتاد':70,'هشتاد':80,'نود':90,'صد':100,'یکصد':100,'دویست':200,'سیصد':300,'چهارصد':400,'پانصد':500,'ششصد':600,'هفتصد':700,'هشتصد':800,'نهصد':900};
const scales={هزار:1000,میلیون:1000000,ملیون:1000000,میلیارد:1000000000};
const tokens=Object.keys(words).concat(Object.keys(scales),['و','نیم']).sort((a,b)=>b.length-a.length).join('|');
const firstTokens=Object.keys(words).concat(Object.keys(scales),['نیم']).sort((a,b)=>b.length-a.length).join('|');
const phrase='(?:\\d+(?:\\.\\d+)?|'+firstTokens+')(?:\\s+(?:\\d+(?:\\.\\d+)?|'+tokens+'))*';
const atom=new RegExp('^'+phrase+'$');
function decimal(s){const m=String(s).match(/^(\d+)(?:\.(\d{1,6}))?$/);if(!m)return null;const d=10n**BigInt((m[2]||'').length);return [BigInt(m[1]+(m[2]||'')),d];}
function roundDiv(n,d){return (n+d/2n)/d;}
// Exact number parser: finite, nonnegative values, integer or fractional scale, descending scale order.
function number(s){s=norm(s).replace(/\s*(تومن|تومان|ریال)\s*$/,'').trim();if(!s||!atom.test(s)||/(?:^| )و$/.test(s))return null;
 const ts=s.split(' ').filter(t=>t!=='و');let total=0n,group=0n,den=1000000n,lastScale=Infinity,had=false,groupHad=false,digit=false;
 for(const t of ts){if(t in scales){const scale=scales[t];if(scale>=lastScale)return null;total+=(groupHad?group:den)*BigInt(scale);lastScale=scale;group=0n;groupHad=false;digit=false;had=true;continue;}
  if(t==='نیم'){if(digit)return null;group+=den/2n;groupHad=true;digit=true;had=true;continue;}
  if(Object.hasOwn(words,t)){if(digit)return null;group+=BigInt(words[t])*den;groupHad=true;had=true;continue;}
  const d=decimal(t);if(!d||groupHad)return null;group+=d[0]*(den/d[1]);groupHad=true;digit=true;had=true;
 }
 if(!had)return null;return [total+group,den];
}
function amount(s,unit){const n=number(s);if(!n||!['rial','toman'].includes(unit))return null;const explicit=/ریال\s*$/.test(norm(s))?'rial':/(?:تومن|تومان)\s*$/.test(norm(s))?'toman':unit;const r=roundDiv(n[0]*BigInt(explicit==='toman'?10:1),n[1]);return r<=MAX?Number(r):null;}
function basisPoints(s){const n=number(norm(s).replace(/\s*(?:درصد|[%٪])\s*$/,''));if(!n)return null;const b=roundDiv(n[0]*100n,n[1]);if(n[0]*100n!==b*n[1]||b>10000n)return null;return Number(b);}
function monthCount(s){const n=number(norm(s).replace(/\s*ماه\s*$/,''));return n&&n[0]%n[1]===0n&&n[0]/n[1]<=60n?Number(n[0]/n[1]):null;}
function calculate(d){
 const err=message=>({ok:false,error:message});
 const valid=v=>Number.isSafeInteger(v)&&v>=0&&BigInt(v)<=MAX;
 if(!['remaining','original'].includes(d.mode))return err('مبنای اصل طلب را مشخص کنید.');
 if(!valid(d.principal))return err('اصل طلب معتبر نیست.');
 const original=d.mode==='original';
 if(original&&![d.cash,d.goods,d.cheques].every(valid))return err('مبالغ نقد، کالا و چک را جداگانه و کامل وارد کنید؛ در صورت عدم دریافت صفر ثبت کنید.');
 if(original&&d.cheques>0&&!['include','exclude'].includes(d.chequeTreatment))return err('مشخص کنید چک‌ها از اصل طلب برای محاسبه سود کسر شوند یا نه.');
 if(!Number.isInteger(d.months)||d.months<1||d.months>60)return err('مدت را از یک تا ۶۰ ماه کامل وارد کنید.');
 if(!Number.isInteger(d.rateBp)||d.rateBp<0||d.rateBp>10000)return err('نرخ ماهانه معتبر نیست؛ صفر تا صد درصد با حداکثر دو رقم اعشار.');
 if(!['simple','compound'].includes(d.method))return err('روش سود ساده یا مرکب را مشخص کنید.');
 const p=BigInt(d.principal),cash=BigInt(original?d.cash:0),goods=BigInt(original?d.goods:0),cheques=BigInt(original?d.cheques:0);
 const credit=cash+goods+(d.chequeTreatment==='include'?cheques:0n);const base=p-credit;
 if(base<0n)return err('دریافت‌های منظورشده از اصل طلب بیشتر است؛ پیش از محاسبه مانده را بررسی کنید.');
 const rate=BigInt(d.rateBp),months=BigInt(d.months),factor=10000n;
 const due=d.method==='simple'?base+roundDiv(base*rate*months,factor):roundDiv(base*(factor+rate)**months,factor**months);
 if(due>MAX)return err('مبلغ نهایی از سقف قابل ثبت یک سند در برنامه بزرگ‌تر است؛ این معامله را جداگانه بررسی کنید.');
 return {ok:true,principal:Number(p),cash:Number(cash),goods:Number(goods),cheques:Number(cheques),credit:Number(credit),base:Number(base),interest:Number(due-base),due:Number(due),months:d.months,rateBp:d.rateBp,method:d.method,chequeTreatment:d.chequeTreatment,mode:d.mode};
}
const fmt=n=>C.fmtInput(n)+' '+C.unitName();
const rateFmt=bp=>C.toFa(String(bp/100).replace('.', '٫'))+'٪';
function explanation(r){
 const details=['اصل مبنا: '+fmt(r.principal)];
 if(r.mode==='original')details.push('نقد دریافتی: '+fmt(r.cash),'ارزش توافقی کالا: '+fmt(r.goods),'مبلغ چک‌ها: '+fmt(r.cheques)+(r.chequeTreatment==='include'?' (کسر از اصل برای محاسبه)':' (خارج از کسر اصل در این سناریو)'));
 details.push('مانده مبنای سود: '+fmt(r.base),'مدت: '+C.toFa(r.months)+' ماه؛ نرخ ماهانه: '+rateFmt(r.rateBp),'سود '+(r.method==='simple'?'ساده':'مرکب')+': '+fmt(r.interest),'مبلغ قابل دریافت در پایان دوره: '+fmt(r.due));
 if(r.mode==='original'&&r.cheques>0&&r.chequeTreatment==='exclude')details.push('چک‌ها در مانده محاسباتی منظور نشده‌اند. در صورت وصول، آن مبلغ نباید دوباره از مشتری مطالبه شود. برای محاسبه دقیق با سررسیدهای متفاوت، تاریخ و مبلغ هر پرداخت ضروری است.');
 details.push('این محاسبه فرض می‌کند مانده مبنای سود در طول دوره تغییری نمی‌کند. فرضی است و هیچ سندی ثبت نشده است.');return details;
}
function postingGuide(r){const lines=[];if(r.mode==='original'){
 lines.push('ابتدا منشأ اصل طلب (فاکتور فروش، قرض یا سند واقعی دیگر) را پیدا کنید؛ اگر قبلاً ثبت شده، دوباره آن را نسازید.');
 if(r.cash)lines.push('وجه نقد یا واریز دریافت‌شده: ثبت دریافت از شخص؛ بدهکار صندوق/بانک و بستانکار شخص. '+fmt(r.cash));
 if(r.goods)lines.push('کالای دریافت‌شده در برابر طلب: در صورت خرید واقعی کالا از همان شخص، فاکتور خرید با ارزش توافقی ثبت کنید تا انبار و حساب شخص اصلاح شوند؛ وجه نقد فرضی ثبت نکنید. '+fmt(r.goods));
 if(r.cheques)lines.push('چک دریافتی را از بخش چک‌ها با مبلغ و تاریخ هر چک ثبت کنید؛ دریافت چک جدید در برنامه حساب شخص را بستانکار می‌کند. هنگام وصول از عملیات وصول چک استفاده کنید، نه دریافت نقدی تکراری.');
 }
 if(r.interest)lines.push('سود توافقی '+fmt(r.interest)+' را از اصل طلب جدا نگه دارید. پس از تحقق درآمد طبق شرایط قرارداد و روش حسابداری، سند متوازن بدهکار شخص / بستانکار حساب درآمد مناسب (مثلاً ۴۲۰۱ سایر درآمدها در کدینگ فعلی، در صورت تناسب) ثبت شود؛ سود آینده را بدون بررسی زمان شناسایی درآمد امروز ثبت نکنید.');
 lines.push('قبل از ثبت، بررسی کنید این موارد قبلاً در فاکتور، چک یا دریافت ثبت نشده باشند. مبلغ حاصل از این محاسبه به‌تنهایی مجوز ثبت سند نیست.');return lines;
}
function intent(q){q=norm(q);return /محاسبه (?:سود|معامله|طلب|اقساط)|سود (?:ماهیانه|ماهانه|ساده|مرکب)|(?:ماهیانه|ماهانه|ماهی)\s+.{0,30}(?:درصد|[%٪])|(?:درصد|[%٪]).{0,20}(?:ماهیانه|ماهانه|ماهی)|(?:چقدر|چه مبلغی).{0,80}(?:بگیرم|بگیرم ازش|تسویه).{0,60}(?:سود|درصد)|(?:چک|طلب|بدهی).{0,100}(?:سود|درصد).{0,80}ماه/.test(q);}
function fresh(){return {unit:C.unit==='toman'?'toman':'rial',mode:null,principal:null,cash:null,goods:null,cheques:null,chequeTreatment:null,months:null,rateBp:null,method:null};}
function first(text,re){const m=text.match(re);return m?m[1]:null;}
const moneyRe=phrase+'(?:\\s*(?:تومان|تومن|ریال))?';
function capture(q,label){return first(q,new RegExp('(?<![\\p{L}\\d])(?:'+label+')(?![\\p{L}\\d])\\s*(?:[:=]|معادل|برابر|به مبلغ|به ارزش|مبلغ|ارزش|مجموعا|مجموع|جمع|جمعا|به میزان)?\\s*('+moneyRe+')(?![\\p{L}\\d])','u'));}
function extract(text,state){const q=norm(text),d={...state};
 const units=[/(?:تومان|تومن)/.test(q),/ریال/.test(q)];if(units[0]!==units[1])d.unit=units[0]?'toman':'rial';
 const rem=capture(q,'مانده اصل(?: طلب| بدهی)?|باقی ?مانده اصل(?: طلب| بدهی)?|اصل باقی ?مانده');const total=capture(q.replace(/(?:باقی ?مانده|مانده) اصل(?: طلب| بدهی)?/g,'مانده'),'اصل بدهی|کل بدهی|بدهی اولیه|اصل طلب|کل طلب|طلب اولیه');
 if(rem!==null&&total===null){d.mode='remaining';d.principal=amount(rem,d.unit);}else if(total!==null&&rem===null){d.mode='original';d.principal=amount(total,d.unit);}
 for(const [key,label] of [['cash','نقد دریافتی|دریافت نقدی|نقد|وجه نقد'],['goods','ارزش توافقی کالا|ارزش کالا|ارزش جنس|جنس دریافتی|جنس|کالای دریافتی|کالا'],['cheques','مجموع مبلغ چک(?: ها)?|مبلغ کل چک(?: ها)?|جمع چک(?: ها)?|مجموع چک(?: ها)?|چک(?: ها)? به مبلغ']]){const v=capture(q,label);if(v!==null)d[key]=amount(v,d.unit);}
 const backFields=[['cash','نقد(?:ی)?'],['goods','جنس|کالا']];for(const [key,label] of backFields){if(d[key]!==null)continue;const v=first(q,new RegExp('(?<![\\p{L}\\d])('+moneyRe+')\\s+(?:'+label+')(?:\\s|$|[،,.])','u'));if(v!==null)d[key]=amount(v,d.unit);}
 const m=first(q,new RegExp('(?<![\\p{L}\\d])('+phrase+')\\s*ماه(?:\\s|$|[؟?.،])','u'));if(m!==null)d.months=monthCount(m);
 const rate=first(q,new RegExp('(?<![\\p{L}\\d])('+phrase+')\\s*(?:درصد|[%٪])','u'));if(rate!==null&&/(?:ماهانه|ماهیانه|ماهی|هر ماه)/.test(q))d.rateBp=basisPoints(rate);
 if(/سود ساده|ساده حساب/.test(q)&&!/مرکب/.test(q))d.method='simple';else if(/سود مرکب|مرکب حساب/.test(q)&&!/ساده/.test(q))d.method='compound';
 if(/چک(?: ها)? (?:از اصل|از مانده) کم (?:شود|شوند|بشه|بشن)|چک(?: ها)? رو کم کن|چک(?: ها)? (?:منظور|کسر) (?:شود|شوند|بشن)|چک(?: ها)? وصول شده/.test(q)&&!/نشده|نشن|نشه|نکن/.test(q))d.chequeTreatment='include';
 else if(/چک(?: ها)? (?:از اصل|از مانده) کم (?:نشود|نشوند|نشه|نشن)|چک(?: ها)? رو کم نکن|چک(?: ها)? وصول نشده|چک(?: ها)? را فعلا منظور نکن/.test(q))d.chequeTreatment='exclude';
 if(/بقیه صفر|سایر دریافت(?: ها)? صفر|دریافت دیگری ندارم/.test(q))for(const k of ['cash','goods','cheques'])if(d[k]===null)d[k]=0;
 return d;
}
function ask(question,ctx={},opts={}){
 const guide=ctx.financeResult&&/سند|ثبت|حسابداری|بدهکار.*بستانکار/.test(norm(question));
 if(!opts.force&&!ctx.finance&&!intent(question)&&!guide)return null;
 if(opts.allow?.money===false)return {text:'مجوز تحلیل مالی برای این کاربر فعال نیست.',ctx:{},details:[],actions:[],data:{kind:'denied'}};
 if(guide)return {text:'پیشنهاد ثبت حسابداری برای سناریوی محاسبه‌شده (هیچ سندی ثبت نمی‌شود):',ctx,details:postingGuide(ctx.financeResult),actions:[],data:{kind:'finance-guide'}};
 const q=norm(question);if(/^(لغو محاسبه|پایان محاسبه|خروج از محاسبه)$/.test(q))return {text:'محاسبه فرضی پایان یافت. سؤال جدیدتان را بپرسید.',ctx:{},details:[],actions:[],data:{kind:'cancel'}};
 let d=extract(q,ctx.finance?.data||fresh()),field=ctx.finance?.field;
 // Bare answers are interpreted ONLY as the currently requested field.
 if(field==='mode'&&/^(?:مانده|مانده اصل|باقی مانده|مانده بعد از دریافت ها|2|۲)$/.test(q))d.mode='remaining';
 if(field==='mode'&&/^(?:کل|کل بدهی|اصل بدهی|اصل طلب|قبل از دریافت ها|1|۱)$/.test(q))d.mode='original';
 if(['principal','cash','goods','cheques'].includes(field)){const v=amount(q,d.unit);if(v!==null)d[field]=v;}
 if(field==='months'){const v=monthCount(q);if(v!==null)d.months=v;}
 if(field==='rateBp'){const v=basisPoints(q);if(v!==null)d.rateBp=v;}
 if(field==='method'&&/^(?:ساده|سود ساده)$/.test(q))d.method='simple';if(field==='method'&&/^(?:مرکب|سود مرکب)$/.test(q))d.method='compound';
 if(field==='chequeTreatment'&&/^(?:بله|کسر شود|کم شود|کم کن|منظور شود)$/.test(q))d.chequeTreatment='include';if(field==='chequeTreatment'&&/^(?:خیر|نه|کسر نشود|کم نشود|کم نکن)$/.test(q))d.chequeTreatment='exclude';
 const prompt=(f,text)=>({text,ctx:{finance:{data:d,field:f}},actions:[],details:[],data:{kind:'finance-clarify',field:f}});
 if(!d.mode)return prompt('mode','مبلغی که می‌خواهید مبنا باشد، کل بدهی قبل از دریافت‌هاست یا مانده‌ای که بعد از کسر دریافت‌ها باقی مانده؟ بنویسید «کل بدهی» یا «مانده اصل».');
 if(d.principal===null)return prompt('principal',(d.mode==='original'?'کل اصل بدهی':'مانده اصل طلب')+' چقدر است؟ مبلغ را با واحد (تومان یا ریال) وارد کنید.');
 if(d.mode==='original'){for(const [f,t] of [['cash','مجموع نقد/واریز دریافتی'],['goods','ارزش توافقی کالاهای دریافتی'],['cheques','مجموع مبلغ چک‌های دریافتی']])if(d[f]===null)return prompt(f,t+' چقدر است؟ اگر ندارید صفر بنویسید.');
 if(d.cheques&&!d.chequeTreatment)return prompt('chequeTreatment','آیا مبلغ چک‌ها برای محاسبه اصل مشمول سود از طلب کسر شود؟ «بله» یا «خیر». اگر چک‌ها هنوز وصول نشده‌اند، کسر از حساب شخص و وصول نقدی دو موضوع جدا هستند.');}
 if(d.months===null||d.months<1)return prompt('months','چند ماه کامل تا تسویه مانده باقی مانده است؟');
 if(d.rateBp===null)return prompt('rateBp','نرخ سود ماهانه چقدر است؟ مثلاً «۵ درصد».');
 if(!d.method)return prompt('method','سود ساده (هر ماه روی اصل ثابت) باشد یا مرکب (سود هر ماه به اصل اضافه شود)؟');
 const r=calculate(d);if(!r.ok)return prompt('principal',r.error+' می‌توانید اصل طلب را اصلاح کنید یا «لغو محاسبه» بنویسید.');
 if(field!=='confirm'||! /^(?:بله|تایید|موافقم|محاسبه کن|درست است|درسته)$/.test(q)){const details=['اصل طلب: '+fmt(r.principal),...(r.mode==='original'?['نقد: '+fmt(r.cash),'کالا: '+fmt(r.goods),'چک: '+fmt(r.cheques)+(r.chequeTreatment==='include'?' — کسر از اصل':' — خارج از کسر اصل')]:[]),'مدت: '+C.toFa(r.months)+' ماه؛ نرخ ماهانه '+rateFmt(r.rateBp),'روش: سود '+(r.method==='simple'?'ساده':'مرکب')];return {text:'لطفاً اعداد و فرض‌های برداشت‌شده را بررسی کنید. اگر درست است بنویسید «تایید»؛ در غیر این صورت مقدار را با عنوان آن اصلاح کنید؛ مثلاً «نقد: ۲۰۰ میلیون تومان».',ctx:{finance:{data:d,field:'confirm'}},details,actions:[],data:{kind:'finance-confirm'}};}
 return {text:'نتیجه محاسبه فرضی: '+fmt(r.due)+' قابل دریافت در پایان '+C.toFa(r.months)+' ماه، با سود '+fmt(r.interest)+'.',ctx:{financeResult:r},details:explanation(r),actions:[],data:{kind:'finance-result',...r}};
}
const api={number,amount,basisPoints,monthCount,calculate,explanation,postingGuide,intent,ask};C.financeScenario=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
