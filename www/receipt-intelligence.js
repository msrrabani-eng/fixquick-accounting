/* Fix Quick v009 — deterministic, offline Iranian bank receipt/SMS parser.
 * Parsing NEVER constitutes proof of settlement and NEVER writes accounting state.
 */
(function(root){
'use strict';
const C = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.Core;
const digits = s => String(s||'').replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632));
const normalized = s => digits(s).replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\u200f\u200e\u2066-\u2069]/g,' ').replace(/\s+/g,' ').trim();
const banks = ['اقتصاد نوین','بانک صادرات ایران','بلوبانک','بانک ملی','بانک ملت','بانک سپه','بانک سامان','بانک پاسارگاد','بانک پارسیان','بانک کشاورزی','بانک مسکن','بانک تجارت','بانک صادرات','بلو','ملی','ملت','صادرات','تجارت','سپاه','سپه','پارسیان','پاسارگاد','سامان','آینده','شهر','رفاه','کشاورزی','مسکن','کارآفرین','دی','سینا','ایران زمین','گردشگری','خاورمیانه','رسالت','مهر ایران','ویپاد','ملل'];
const months = {'فروردین':1,'اردیبهشت':2,'خرداد':3,'تیر':4,'مرداد':5,'شهریور':6,'مهر':7,'آبان':8,'آذر':9,'دی':10,'بهمن':11,'اسفند':12};
const pad = n => String(n).padStart(2,'0');
function money(x,unit){const n=Number(digits(x).replace(/[٬،,\s]/g,''));if(!Number.isSafeInteger(n)||n<=0)return null;const v=/تومان|تومن/.test(unit)?n*10:n;return Number.isSafeInteger(v)?v:null;}
function dates(lines){
  const allowed=/^(?:1[34]\d{2}|20\d{2})[\/.-](?:0?[1-9]|1[0-2])[\/.-](?:0?[1-9]|[12]\d|3[01])$/;
  const choices=[];
  for(const l of lines){
    for(const m of l.matchAll(/(?:^|\D)((?:1[34]\d{2}|20\d{2})[\/.-](?:0?[1-9]|1[0-2])[\/.-](?:0?[1-9]|[12]\d|3[01]))(?=\D|$)/g)){
      if(allowed.test(m[1]))choices.push({date:m[1].replace(/[.-]/g,'/'),rank:/تراکنش|انتقال|زمان|پرداخت/.test(l)?3:/سررسید|افتتاح/.test(l)?-3:1});
    }
    for(const m of l.matchAll(/(?:^|\D)([0-3]?\d)\s*(فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند)\s*(1[34]\d{2})(?=\D|$)/g)){
      const day=+m[1];if(day>=1&&day<=31)choices.push({date:m[3]+'/'+pad(months[m[2]])+'/'+pad(day),rank:3});
    }
  }
  choices.sort((a,b)=>b.rank-a.rank);return choices[0]?.date||null;
}
function analyze(text,state){
  const lines=String(text||'').split(/\r?\n/).map(normalized).filter(Boolean);
  const raw=normalized(text);
  const r={amountRial:null,amountUnit:null,trackingCode:null,date:null,time:null,sourceBank:null,destinationBank:null,banks:[],duplicateCandidates:[],warnings:[],reviewRequired:true,verified:false,status:'unknown',method:null,sourcePerson:null,destinationPerson:null};
  if(!raw){r.warnings.push('متن فیش خالی است.');return r;}
  const bankNames=banks.slice().sort((a,b)=>b.length-a.length);const found=bankNames.filter(b=>raw.includes(b));
  const canonical=b=>/بلو/.test(b)?'بلوبانک':/صادرات/.test(b)?'صادرات':b.replace(/^بانک\s*/,'');
  r.banks=[...new Set(found.map(canonical))];
  const findBank=(regex)=>{for(const line of lines){if(!regex.test(line))continue;const b=bankNames.find(x=>line.includes(x));if(b)return canonical(b);}return null;};
  r.sourceBank=findBank(/نام بانک مبدا|بانک مبدأ|بانک مبدا|از بانک/);
  r.destinationBank=findBank(/نام بانک مقصد|بانک مقصد|بانک گیرنده/);
  if(!r.sourceBank && /blubank|blu\.bank|b transfer|بلوبانک|بلو بانک/.test(raw.toLowerCase()))r.sourceBank='بلوبانک';
  if(/پایا/.test(raw))r.method='پایا';else if(/ساتنا/.test(raw))r.method='ساتنا';else if(/کارت به کارت/.test(raw))r.method='کارت به کارت';else if(/بلو به بلو/.test(raw))r.method='داخلی';
  const amounts=[];
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    // Unit and number may be on opposite sides of the label, as in Persian RTL receipts.
    const near=[line,lines[i+1]||''].join(' ');
    for(const m of line.matchAll(/(\d{1,3}(?:[٬،,]\d{3})+|\d{4,15})\s*(ریال|تومان|تومن)|(?:ریال|تومان|تومن)\s*(\d{1,3}(?:[٬،,]\d{3})+|\d{4,15})/g)){
      const val=money(m[1]||m[3],m[2]||(m[0].match(/ریال|تومان|تومن/)||[])[0]);
      if(val)amounts.push({val,unit:m[2]||(m[0].match(/ریال|تومان|تومن/)||[])[0],rank:/مبلغ انتقال|انتقال مبلغ|مبلغ پرداخت|انتقال وجه|انتقال پول|^مبلغ\s*:|\sمبلغ\s*:/.test(line)?10:/کارمزد|موجودی|مانده|قابل برداشت|سررسید/.test(line)?-10:/مبلغ|انتقال|پرداخت|واریز/.test(near)?5:1});
    }
    // OCR can split the bank's label, amount and unit into adjacent lines.
    // Only use tight proximity to an explicit amount label; never infer an unlabeled number.
    if(/(?:^|\s)(?:مبلغ|مبلغ انتقال|انتقال مبلغ)\s*[:：]?/.test(line) && !/کارمزد|مانده|موجودی/.test(line)) {
      const windowText=[line,lines[i+1]||'',lines[i+2]||''].join(' ');
      const nearNumber=windowText.match(/(\d{1,3}(?:[٬،,]\d{3})+|\d{5,15})\s*(ریال|تومان|تومن)|(?:ریال|تومان|تومن)\s*(\d{1,3}(?:[٬،,]\d{3})+|\d{5,15})/);
      if(nearNumber){const unit=nearNumber[2]||(nearNumber[0].match(/ریال|تومان|تومن/)||[])[0];const val=money(nearNumber[1]||nearNumber[3],unit);if(val)amounts.push({val,unit,rank:12});}
    }
    // Some bank messages put number and Rial on separate lines.
    if(/مبلغ\s*[:：]?/.test(line) && !/کارمزد/.test(line)) {
      for(const m of near.matchAll(/(\d{1,3}(?:[٬،,]\d{3})+|\d{5,15})\s*(ریال|تومان|تومن)/g)){
        const val=money(m[1],m[2]);if(val)amounts.push({val,unit:m[2],rank:9});
      }
    }
  }
  amounts.sort((a,b)=>b.rank-a.rank);
  if(amounts.length){r.amountRial=amounts[0].val;r.amountUnit=amounts[0].unit;if(amounts.some(a=>a.val!==r.amountRial))r.warnings.push('چند مبلغ متفاوت در فیش دیده شد؛ مبلغ اصلی را تأیید کنید.');}
  else r.warnings.push('مبلغ با واحد ریال/تومان شناسایی نشد.');
  const codeLabels=/شماره\s*(?:پیگیری|رهگیری|مرجع|سند|تراکنش)|کد\s*(?:پیگیری|رهگیری|مرجع)|رسید\s*بانکی|شناسه\s*پرداخت/;
  for(let i=0;i<lines.length;i++){
    if(!codeLabels.test(lines[i]))continue;
    const line=lines[i];const candidates=[...line.matchAll(/\d[\d\s-]{5,35}\d|\b\d{6,30}\b/g)].map(x=>x[0].replace(/[\s-]/g,'')).filter(x=>/^\d{6,30}$/.test(x));
    if(candidates.length){r.trackingCode=candidates[candidates.length-1];break;}
    const next=(lines[i+1]||'').match(/\b\d{6,30}\b/);if(next){r.trackingCode=next[0];break;}
  }
  if(!r.trackingCode)r.warnings.push('کد رهگیری یا مرجع شناسایی نشد.');
  r.date=dates(lines);if(!r.date)r.warnings.push('تاریخ تراکنش شناسایی نشد.');
  const txLines=lines.filter(l=>/زمان|ساعت|تاریخ تراکنش|تاریخ انتقال|انتقال پول|انتقال وجه|تراکنش|تاریخ\s*:/.test(l));
  const takeTime=l=>{const m=l.match(/(?:^|\D)([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?(?=\D|$)/);return m?pad(+m[1])+':'+m[2]+(m[3]?':'+m[3]:''):null;};
  // Prefer labelled transaction lines; phone status bar times are not transaction times.
  r.time=txLines.map(takeTime).find(Boolean)||lines.filter(l=>/آبان|آذر|فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|دی|بهمن|اسفند/.test(l)).map(takeTime).find(Boolean)||null;
  if(!r.time)r.warnings.push('ساعت تراکنش به‌طور مطمئن شناسایی نشد.');
  for(const l of lines){let m=l.match(/(?:انتقال\s*دهنده|واریز\s*کننده|پرداخت\s*کننده)\s*[:：]?\s*(.+)$/);if(m&&m[1].length<100)r.sourcePerson=m[1];m=l.match(/(?:به\s*نام|دریافت\s*کننده|گیرنده)\s*[:：]?\s*(.+)$/);if(m&&m[1].length<100)r.destinationPerson=m[1];}
  if(/در انتظار پذیرش|در انتظار پردازش|در حال بررسی|هنوز واریز نشده|ثبت درخواست|درخواست حواله|درخواست انتقال|در انتظار تایید|در انتظار تأیید/.test(raw))r.status='pending';
  else if(/انتقال موفق|پرداخت شده|تراکنش موفق|پرداخت موفق|موفقیت آمیز/.test(raw))r.status='reported_success';
  else if(/ثبت شده/.test(raw))r.status='registered';
  if(r.method==='پایا' && r.status==='unknown')r.status='pending';
  if(r.status==='pending'||r.status==='registered')r.warnings.push('ثبت یا درخواست حواله به معنی وصول قطعی نیست؛ وضعیت را از حساب مقصد بررسی کنید.');
  if(r.status==='reported_success')r.warnings.push('اعلام موفقیت در تصویر/پیامک به‌تنهایی اثبات وصول وجه نیست.');
  const txs=state&&Array.isArray(state.tx)?state.tx:[];
  if(r.trackingCode){r.duplicateCandidates=txs.filter(t=>[t.desc,t.note,t.trackingCode,t.reference,t.refNo].some(v=>v&&normalized(v).includes(r.trackingCode))).map(t=>({id:t.id,amount:t.amount,date:t.date}));if(r.duplicateCandidates.length)r.warnings.push('شماره پیگیری تکراری در اسناد قبلی یافت شد.');}
  return r;
}
C.analyzeBankReceipt=analyze;
if(typeof module!=='undefined'&&module.exports)module.exports=C;
})(typeof window!=='undefined'?window:globalThis);
