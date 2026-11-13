/* Fix Quick — read-only bank receipt text analyzer.
 * Extracted text must be reviewed by a human; never proves settlement.
 * No state, IndexedDB or network writes.
 */
(function(root){
'use strict';
const C = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.Core;
const banks = ['ملی','ملت','صادرات','تجارت','سپاه','سپه','پارسیان','پاسارگاد','سامان','اقتصاد نوین','آینده','شهر','رفاه','کشاورزی','مسکن','کارآفرین','دی','سینا','ایران زمین','گردشگری','خاورمیانه','رسالت','مهر ایران','بلو','بلوبانک','ویپاد','ملل'];
const normalize = s => C.toEn(String(s||'')).replace(/[ي]/g,'ی').replace(/[ك]/g,'ک').replace(/[\u200c\u200f\u200e]/g,' ').replace(/[٬،,](?=\d{3}(?:\D|$))/g,'').replace(/\s+/g,' ').trim();
function amountToRial(num,unit){
  const val = Number(String(num).replace(/[,٬،\s]/g,''));
  if(!Number.isSafeInteger(val) || val<=0) return null;
  if(/تومان|تومن/.test(unit||'')) return val * 10;
  if(/ریال/.test(unit||'')) return val;
  return null; // An unidentified unit must never be guessed.
}
function analyze(text, state){
 const raw=normalize(text), lines=String(text||'').split(/\r?\n/).map(normalize).filter(Boolean);
 const result={amountRial:null,amountUnit:null,trackingCode:null,date:null,time:null,sourceBank:null,destinationBank:null,banks:[],duplicateCandidates:[],warnings:[],reviewRequired:true,verified:false};
 if(!raw){result.warnings.push('متن فیش خالی است.');return result;}
 const bankRegex=new RegExp('(?:بانک\\s*)?('+banks.slice().sort((a,b)=>b.length-a.length).map(x=>x.replace(/ /g,'\\s*')).join('|')+')','g');
 result.banks=[...new Set([...raw.matchAll(bankRegex)].map(m=>m[1].replace(/\s+/g,' ')))];
 const labelBank=(label)=>{const x=lines.find(l=>label.test(l) && /بانک/.test(l));if(!x)return null;const values=[...x.matchAll(bankRegex)].map(m=>m[1]);return values[values.length-1]||null;};
 result.sourceBank=labelBank(/مبدا|مبدأ|فرستنده|واریزکننده/);
 result.destinationBank=labelBank(/مقصد|گیرنده|دریافت کننده|دریافت‌کننده/);
 const amountCandidates=[];
 for(const line of lines){
  const label=/مبلغ|انتقال|واریز|پرداخت|برداشت|تراکنش/.test(line);
  const re=/(\d{1,3}(?:[٬،,]\d{3})+|\d{4,13})\s*(ریال|تومان|تومن)/g;
  for(const m of line.matchAll(re)){
   const value=amountToRial(m[1],m[2]);if(value)amountCandidates.push({value,unit:m[2],rank:label?2:1});
  }
 }
 amountCandidates.sort((a,b)=>b.rank-a.rank);
 if(amountCandidates.length){result.amountRial=amountCandidates[0].value;result.amountUnit=amountCandidates[0].unit;
   if(amountCandidates.some(x=>x.value!==result.amountRial))result.warnings.push('چند مبلغ متفاوت در فیش وجود دارد؛ مبلغ را بررسی کنید.');
 }else result.warnings.push('مبلغ با واحد مشخص (ریال یا تومان) شناسایی نشد.');
 const trackLine=lines.find(l=>/کد\s*(پیگیری|رهگیری|مرجع)|شماره\s*(پیگیری|رهگیری|مرجع)|شماره\s*تراکنش|شماره\s*سند/.test(l));
 if(trackLine){const tail=trackLine.replace(/^.*?(?:پیگیری|رهگیری|مرجع|تراکنش|سند)\s*[:：#-]?\s*/,'');const m=tail.match(/\b\d{4,30}\b/);if(m)result.trackingCode=m[0];}
 if(!result.trackingCode)result.warnings.push('کد رهگیری معتبر شناسایی نشد.');
 const dateMatch=raw.match(/(?:^|\D)((?:1[34]\d{2}|20\d{2})[\/.-](?:0?[1-9]|1[0-2])[\/.-](?:0?[1-9]|[12]\d|3[01]))(?:\D|$)/);
 if(dateMatch)result.date=dateMatch[1].replace(/[.\-]/g,'/'); else result.warnings.push('تاریخ شناسایی نشد.');
 const timeMatch=raw.match(/(?:^|\D)((?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?)(?:\D|$)/);
 if(timeMatch)result.time=timeMatch[1]; else result.warnings.push('ساعت شناسایی نشد.');
 const txs=(state&&Array.isArray(state.tx))?state.tx:[];
 if(result.trackingCode){const code=result.trackingCode;
  result.duplicateCandidates=txs.filter(t=>[t.desc,t.note,t.trackingCode,t.reference,t.refNo].some(v=>v && normalize(v).includes(code))).map(t=>({id:t.id,amount:t.amount,date:t.date}));
  if(result.duplicateCandidates.length)result.warnings.push('کد رهگیری مشابه در تراکنش‌های قبلی یافت شد؛ احتمال ثبت تکراری.');
 }
 if(result.banks.length===1 && (!result.sourceBank||!result.destinationBank))result.warnings.push('بانک مبدأ و مقصد را جداگانه تأیید کنید.');
 result.warnings.push('متن فیش به‌تنهایی اثبات واریز موفق نیست؛ پیش از ثبت با گردش حساب تطبیق دهید.');
 return result;
}
C.analyzeBankReceipt=analyze;
if(typeof module!=='undefined'&&module.exports)module.exports=C;
})(typeof window!=='undefined'?window:globalThis);
