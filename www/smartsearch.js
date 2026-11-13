/* Fix Quick — unified, read-only, offline search across accounting records.
 * Only computes suggestions. Never writes to the state, IndexedDB, or journals.
 */
(function (root) {
  'use strict';
  const C = typeof module !== 'undefined' && module.exports ? require('./core.js') : root.Core;
  const FILLER = new Set(['چک','چکها','چکهای','چکهای','چکی','سریال','شماره','شمارهچک','فاکتور','فاکتورها','فاکتورهای','رسید','رسیدها','تراکنش','تراکنشها','هزینه','هزینهها','هزینههای','بانک','بانکی','حساب','حسابها','مشتری','مشتریان','شخص','اشخاص','پرداخت','پرداختها','دریافت','دریافتها','واریز','واریزی','حواله','فروش','خرید','کالا','کالاها','محصول','محصولات','در','از','به','برای','مربوط','ها','های','رو','را','اون','این','یک','یه','لطفا','نشون','بده','پیدا','کن','بگرد','تمام','همه','مبلغ','مبالغ','چقدر','چه','تا','حدود','نزدیک','نزدیکترین','بیشتر','کمتر','بالای','زیر','تومان','تومن','ریال','میلیون','ملیون','میلیارد','ملیارد','هزار','امروز','دیروز','سررسید','تاریخ','موعد','صندوق','موجود','خرج','شده','شدهها','اخیر','ماه','اینماه','ماهقبل','قبلی','قبلا','اصلی']);
  const MILLION = { 'هزار':1000, 'میلیون':1000000, 'ملیون':1000000, 'میلیارد':1000000000, 'ملیارد':1000000000 };
  const STATUS = { box:['صندوق','موجود','دریافتی'], bank:['وصول','بانک'], spent:['خرج','واگذار'], issued:['صادر','پرداختی'], cleared:['وصول','پاس'], bounced:['برگشتی'], returned:['عودتی'], paid:['پاس'], cancelled:['باطل'] };
  const stateWords = q => {
    const s = C.norm(q);
    if (/داخل صندوق|در صندوق|صندوق/.test(s)) return 'box';
    if (/خرج شده|خرجشده/.test(s)) return 'spent';
    if (/برگشت|برگشتی/.test(s)) return 'bounced';
    if (/پاس شده|پاسشده|وصول شده/.test(s)) return 'cleared';
    if (/صادر شده|صادره/.test(s)) return 'issued';
    return '';
  };
  const exactDate = q => {
    const m = C.toEn(q).match(/(?:^|\D)(1[34]\d{2}|20\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?:\D|$)/);
    if (!m) return '';
    if (Number(m[1]) < 1600) return C.jalaliToIso([m[1],m[2].padStart(2,'0'),m[3].padStart(2,'0')].join('/')) || '';
    return [m[1],m[2].padStart(2,'0'),m[3].padStart(2,'0')].join('-');
  };
  const amountFrom = q => {
    const raw = C.toEn(q).replace(/(\d)[,٬،](?=\d{3}(?!\d))/g, '$1');
    const m = raw.match(/(\d+(?:[.٫]\d+)?)\s*(هزار|میلیون|ملیون|میلیارد|ملیارد)\s*(تومان|تومن|ریال)?/);
    if (m) return {rial:Math.round(Number(m[1].replace('٫','.'))*MILLION[m[2]]*(m[3]==='ریال'?1: m[3]?10: C.unit==='toman'?10:1)), term:m[0]};
    const big = raw.match(/(?:^|\D)(\d{5,13})\s*(تومان|تومن|ریال)?(?:\D|$)/);
    if (big) return {rial:Number(big[1])*(big[2]==='ریال'?1:big[2]?10:C.unit==='toman'?10:1), term:big[0]};
    return null;
  };
  function parse(q) {
    const s = String(q||'').trim(), en = C.toEn(s);
    const amount = amountFrom(s), date = exactDate(s);
    let clean = en;
    if (amount) clean = clean.replace(amount.term,' ');
    if (date) clean = clean.replace(/(?:1[34]\d{2}|20\d{2})[\/\-.]\d{1,2}[\/\-.]\d{1,2}/,' ');
    const words = C.sTokens(clean).filter(t=>!FILLER.has(t));
    const id = (en.match(/\b\d{4,16}\b/)||[])[0] || '';
    const mode = /(?:^|\s)چک(?:\s|$)|چکها|چکهای|سریال چک|سررسید/.test(C.norm(s)) ? 'cheques' : /هزینه|اجاره|قبض/.test(C.norm(s))?'expenses':/فاکتور/.test(C.norm(s))?'invoices':/تراکنش|رسید|پرداخت|دریافت|واریز/.test(C.norm(s))?'tx':'';
    const status = stateWords(s);
    const threshold = /بالای|بیشتر از/.test(C.norm(s)) ? 'gt' : /کمتر از|زیر/.test(C.norm(s)) ? 'lt' : /حدود|نزدیک/.test(C.norm(s)) ? 'near' : 'eq';
    return {words, amount:amount && amount.rial, date, mode, status, threshold, id, raw:en};
  }
  const matchAmount = (a, p) => {
    if (p.amount == null) return true;
    if (!Number.isFinite(+a)) return false;
    const v=Math.abs(+a), q=p.amount;
    if (p.threshold==='gt') return v>q;
    if (p.threshold==='lt') return v<q;
    if (p.threshold==='near') return Math.abs(v-q) <= Math.max(1,q*.1);
    return v===q;
  };
  const matchText = (txt,p) => {
    if (!p.words.length) return 1;
    const t = String(txt||'');
    // Core.matchScore normalizes Persian/Arabic digits, names, common aliases and tolerates short typos.
    const score = C.matchScore(t,p.words.join(' '));
    return score > 0 ? score : 0;
  };
  const numTail = (txt,id) => id.length>=4 && C.toEn(String(txt||'')).replace(/\D/g,'').endsWith(id);
  function find(st, query, o) {
    o=o||{}; const p=parse(query), max=Math.min(100,Math.max(1,o.limit||12)), active=!!String(query||'').trim();
    const out={people:[],products:[],invoices:[],cheques:[],expenses:[],tx:[],accounts:[],parsed:p};
    if (!active) return out;
    const pe=new Map((st.people||[]).map(x=>[x.id,x])); const pr=new Map((st.products||[]).map(x=>[x.id,x]));
    const person=id=>{ const x=pe.get(id); return x?[x.name,x.code||'',x.phone||''].join(' '):''; };
    const rank=(arr,kind,fn)=>{
      const a=[];
      for(const x of arr||[]) {
        const r=fn(x); if(!r)continue;
        a.push({item:x,score:r});
      }
      a.sort((a,b)=>b.score-a.score || (String(b.item.date||'').localeCompare(String(a.item.date||''))) || (b.item.id||0)-(a.item.id||0));
      out[kind]=a.slice(0,max).map(x=>x.item);
    };
    // Domain-specific words don't accidentally exclude records: querying "چک ملت" focuses on cheques.
    const only=kind=>!p.mode || p.mode===kind;
    if (only('cheques')) rank(st.cheques,'cheques',c=>{
      if (p.status && c.state!==p.status) return 0;
      if (p.date && c.date!==p.date && c.dueDate!==p.date) return 0;
      if (!matchAmount(c.amount,p)) return 0;
      const txt=[c.serial,c.bank,c.branch,c.drawer,c.title,c.note,person(c.personId),c.dueDate,C.isoToJalali(c.dueDate||''),c.date].join(' ');
      const sc=matchText(txt,p);
      return sc || (p.id && numTail(c.serial,p.id)?2: p.words.length?0:1);
    });
    if (only('expenses')) rank(st.expenses,'expenses',e=>{
      if (p.date&&e.date!==p.date||!matchAmount(e.amount,p))return 0;
      return matchText([e.title,e.category,e.note,e.date].join(' '),p);
    });
    if (only('tx')) rank(st.tx,'tx',t=>{
      if(p.date&&t.date!==p.date||!matchAmount(t.amount,p))return 0;
      return matchText([person(t.personId),t.desc,t.note,t.method,t.type,t.date].join(' '),p);
    });
    if (only('invoices')) rank(st.invoices,'invoices',i=>{
      const serialTerm = C.serialQuery(query);
      // Serial numbers are stored in invoice line notes; partial IMEI is not an amount.
      if (serialTerm && (i.items||[]).some(l => C.extractSerials(l.note).some(sn => C.serialMatches(sn, serialTerm)))) return 10;
      if (p.date&&i.date!==p.date||!matchAmount(C.invoiceTotals(i).total,p))return 0;
      const txt=[i.no,i.note,i.date,person(i.personId),(i.items||[]).map(l=>[(pr.get(l.productId)||{}).name,l.note].join(' ')).join(' ')].join(' ');
      const s=matchText(txt,p); return s || (p.id && numTail(i.no,p.id)?2:0);
    });
    if (!p.mode) {
      rank(st.people,'people',x=>matchText([x.name,x.code,x.phone,x.note].join(' '),p));
      rank(st.products,'products',x=>matchText([x.name,x.sku,x.barcode,C.catOf(x)].join(' '),p));
      rank(st.accounts,'accounts',x=>matchText([x.name,x.bank,x.owner,x.card,x.accNo,x.sheba,x.branch].join(' '),p) || (p.id && [x.card,x.accNo,x.sheba].some(v=>numTail(v,p.id)) ? 2:0));
    }
    return out;
  }
  C.smartFind=find; C.smartParseSearch=parse;
  C.smartChequeMatch = (c,query,personName) => {
    const p=parse(query); if(!p.raw.trim())return true;
    if(p.status && c.state !== p.status || p.date && c.date!==p.date && c.dueDate!==p.date || !matchAmount(c.amount,p))return false;
    const txt=[c.serial,c.bank,c.branch,c.drawer,c.title,c.note,personName||'',c.date,c.dueDate,c.dueDate?C.isoToJalali(c.dueDate):''].join(' ');
    return !!matchText(txt,p) || !!(p.id && numTail(c.serial,p.id));
  };
  C.smartInvoiceMatch = (st,i,query) => {
    const p=parse(query); if(!p.raw.trim()) return true;
    const n=C.norm(query);
    if (/\b(?:sale|sell)\b|فروش/.test(n) && !String(i.type).startsWith('sale')) return false;
    if (/\b(?:buy|purchase)\b|خرید/.test(n) && !String(i.type).startsWith('purchase')) return false;
    if(p.date && p.date!==i.date)return false;
    const serialTerm = C.serialQuery(query);
    if (serialTerm && (i.items||[]).some(l => C.extractSerials(l.note).some(sn => C.serialMatches(sn,serialTerm)))) return true;
    if(!matchAmount(C.invoiceTotals(i).total,p))return false;
    const person=(st.people||[]).find(x=>x.id===i.personId)||{};
    const txt=[i.no,i.note,i.date,person.name,person.code,person.phone,(i.items||[]).map(l=>{
      const prod=(st.products||[]).find(x=>x.id===l.productId)||{};
      return [prod.name,prod.sku,l.note].join(' ');
    }).join(' ')].join(' ');
    return !!matchText(txt,p);
  };
  C.smartExpenseMatch = (e,query) => {
    const p=parse(query); if(!p.raw.trim())return true;
    if(p.date && p.date!==e.date || !matchAmount(e.amount,p))return false;
    return !!matchText([e.title,e.category,e.note,e.date].join(' '),p);
  };
  C.smartMatchRecord = (txt,q) => { const p=parse(q); return matchText(txt,p)>0 || !!(p.id && numTail(txt,p.id)); };
  if(typeof module!=='undefined'&&module.exports)module.exports=C;
})(typeof window!=='undefined'?window:globalThis);
