/* Fix Quick v014 — read-only risk checks for accounting, no writes. */
(function (root) {
  'use strict';
  const C = (typeof module !== 'undefined' && module.exports) ? require('./core.js') : root.Core;
  const norm = v => C.norm(String(v == null ? '' : v));
  const digits = v => C.toEn(String(v || '')).replace(/\D/g, '');
  const issue = (code, message, severity, ref) => ({ code, message, severity:severity || 'warning', ref:ref || null });
  const sameDay = (a,b) => String(a||'')===String(b||'');
  const med = values => { const v=values.filter(x => Number.isFinite(+x) && +x>0).map(Number).sort((a,b)=>a-b); return v.length ? v[Math.floor((v.length-1)/2)] : 0; };
  function futureDate(date, today, kind) {
    if (!date || !today || kind === 'cheque') return false; // cheques may intentionally be dated ahead
    try { return C.diffDays(today,date)>7; } catch(_) {return false;}
  }
  function preflight(st, kind, data, opts) {
    opts=opts||{}; data=data||{};
    const warnings=[], id=opts.editingId, date=data.date, today=opts.today || C.todayISO(), amount=+data.amount||0;
    if (futureDate(date,today,kind)) warnings.push(issue('future-date','تاریخ سند بیش از ۷ روز در آینده است؛ تاریخ را دوباره بررسی کنید.'));
    if (kind==='tx') {
      const rows=(st.tx||[]).filter(x => x.id!==id && x.type===data.type && x.personId===data.personId &&
        x.amount===amount && sameDay(x.date,date) && (x.acct||0)===(data.acct||0) && (x.ref||0)===(data.ref||0));
      if(rows.length) warnings.push(issue('duplicate-tx','دریافت/پرداخت با همین مبلغ، شخص، تاریخ و حساب قبلاً ثبت شده است؛ احتمال ثبت دوباره.', 'high',rows[0].id));
      const similar=(st.tx||[]).filter(x=>x.id!==id && x.type===data.type && x.personId===data.personId && x.amount>0).slice(-50).map(x=>x.amount);
      const m=med(similar); if(similar.length>=4 && m>0 && amount>=m*5) warnings.push(issue('amount-outlier','مبلغ این تراکنش نسبت به سابقه همین شخص بسیار بزرگ است؛ تعداد صفرها و واحد پول را بررسی کنید.'));
      if (data.type==='receipt' && amount>0 && data.ref) {
        const inv=(st.invoices||[]).find(x=>x.id===data.ref);
        if(inv) {const rem=C.invoiceInfo(st,inv).remaining;
          if(rem>=0 && amount>rem)warnings.push(issue('overpayment','دریافتی از مانده باقی‌مانده فاکتور بیشتر است؛ شاید مبلغ یا فاکتور اشتباه انتخاب شده باشد.'));
        }
      }
    } else if(kind==='expense') {
      const rows=(st.expenses||[]).filter(x=>x.id!==id && x.amount===amount && sameDay(x.date,date) && (x.acct||0)===(data.acct||0) && norm(x.title)===norm(data.title));
      if(rows.length) warnings.push(issue('duplicate-expense','هزینه‌ای با همین عنوان، مبلغ، تاریخ و حساب قبلاً ثبت شده است.', 'high', rows[0].id));
      const similar=(st.expenses||[]).filter(x=>x.id!==id && norm(x.title)===norm(data.title) && x.amount>0).slice(-40).map(x=>x.amount);
      const m=med(similar); if(similar.length>=4 && amount>=m*5)warnings.push(issue('expense-outlier','این هزینه نسبت به پرداخت‌های قبلی با همین عنوان بسیار بزرگ است.'));
    } else if(kind==='cheque') {
      const sn=digits(data.serial);
      if(sn.length>=4) {
        const rows=(st.cheques||[]).filter(x=>x.id!==id && digits(x.serial)===sn &&
          x.direction===data.direction && (norm(x.bank)===norm(data.bank) || data.direction==='pay' && x.acct===data.acct));
        if(rows.length)warnings.push(issue('duplicate-cheque','چکی با همین سریال و بانک/حساب قبلاً ثبت شده است.', 'high', rows[0].id));
      }
      if(data.date && data.dueDate) {
        try {if(C.diffDays(data.dueDate,data.date)>0) warnings.push(issue('cheque-due-before-date','سررسید چک قبل از تاریخ ثبت آن است؛ تاریخ‌ها را بررسی کنید.'));}catch(_){}
      }
    } else if(kind==='invoice') {
      const items=Array.isArray(data.items)?data.items:[];
      const sub=items.reduce((s,x)=>s+Math.round((+x.qty||0)*(+x.price||0)),0);
      const discount=+data.discount||0, vatRate=+data.vatRate||0;
      const total=Math.max(0,sub-discount)+Math.round(Math.max(0,sub-discount)*vatRate/100);
      if(discount>sub && sub>0) warnings.push(issue('discount-over-subtotal','تخفیف از جمع اقلام فاکتور بیشتر است؛ اعداد را بررسی کنید.', 'high'));
      if((+data.paid||0)>total && total>0)warnings.push(issue('paid-exceeds-total','مبلغ تسویه همزمان بیشتر از مبلغ کل فاکتور است؛ مبلغ را دوباره بررسی کنید.', 'high'));
      const inv=(st.invoices||[]).filter(i=>i.id!==id&&i.personId===data.personId&&i.type===data.type);
      const totals=inv.slice(-30).map(i=>C.invoiceTotals(i).total).filter(x=>x>0), m=med(totals);
      if(totals.length>=4 && m>0 && total>=m*8)warnings.push(issue('invoice-outlier','مبلغ فاکتور نسبت به خرید و فروش‌های قبلی همین شخص غیرمعمول است؛ قیمت‌ها و تعدادها را بررسی کنید.'));
    } else if(kind==='transfer') {
      if(data.fromId && data.toId && data.fromId===data.toId)warnings.push(issue('transfer-self','مبدأ و مقصد حواله یک شخص هستند؛ انتخاب‌ها را بررسی کنید.', 'high'));
      const rows=(st.tx||[]).filter(x=>x.type==='transfer'&&x.personId===data.fromId&&x.amount===amount&&x.date===date&&norm(x.desc)===norm(data.desc));
      if(rows.length) warnings.push(issue('transfer-possible-duplicate','حواله مشابهی با همین مبلغ و تاریخ در حساب مبدأ وجود دارد؛ پیش از ثبت بررسی کنید.', 'high', rows[0].id));
    }
    return warnings;
  }
  function scan(st, opts) {
    opts=opts||{}; const findings=[],today=opts.today||C.todayISO(), max=Math.min(100,opts.max||40);
    const seenTx=new Map(),seenExp=new Map(),seenChq=new Map();
    for(const t of st.tx||[]) {
      if(!['receipt','payment'].includes(t.type)||!(t.amount>0))continue;
      const key=[t.type,t.personId,t.acct||0,t.amount,t.date,t.ref||0].join('|');
      if(seenTx.has(key))findings.push(issue('duplicate-tx','دریافت/پرداخت مشابه در همان روز؛ سند '+seenTx.get(key)+' و '+t.id,'high',t.id));
      else seenTx.set(key,t.id);
    }
    for(const e of st.expenses||[]) {
      const key=[norm(e.title),e.amount,e.date,e.acct||0].join('|');
      if(seenExp.has(key))findings.push(issue('duplicate-expense','هزینه مشابه در یک روز؛ سند '+seenExp.get(key)+' و '+e.id,'high',e.id));
      else seenExp.set(key,e.id);
    }
    for(const c of st.cheques||[]) {
      const sn=digits(c.serial);if(sn.length<4)continue;
      const key=[sn,c.direction,norm(c.bank),c.acct||0].join('|');
      if(seenChq.has(key))findings.push(issue('duplicate-cheque','شماره چک مشابه: '+C.toFa(sn)+' (اسناد '+seenChq.get(key)+' و '+c.id+')','high',c.id));
      else seenChq.set(key,c.id);
    }
    // Existing integrity audit is authoritative for structural errors. These are only hints.
    return {count:findings.length,items:findings.slice(0,max),truncated:findings.length>max,checkedAt:today};
  }
  C.smartGuard={preflight,scan};
  if(typeof module!=='undefined'&&module.exports)module.exports=C.smartGuard;
})(typeof window!=='undefined'?window:globalThis);
