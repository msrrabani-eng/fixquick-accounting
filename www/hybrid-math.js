/* Read-only typed semantic plans and exact arithmetic. Never display raw model answers. */
(function(root){'use strict';
const C=typeof module!=='undefined'&&module.exports?require('./core.js'):root.Core;
const M=typeof module!=='undefined'&&module.exports?require('./math-assistant.js'):root.FQMath;
const F=typeof module!=='undefined'&&module.exports?require('./finance-scenario.js'):C.financeScenario;
const MAX=9000000000000n,B=10000n,fa=v=>C.toFa(String(v)),abs=v=>v<0n?-v:v;
const money=x=>{let v=BigInt(x);return (v<0n?'-':'')+fa((abs(v)/10n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,','))+(abs(v)%10n?'٫'+fa(abs(v)%10n):'')+' تومان';};
const round=(n,d)=>n<0n?-round(-n,d):(n+d/2n)/d;
const valid=n=>Number.isSafeInteger(n)&&n>=0&&BigInt(n)<=MAX;
const result=(text,details=[],data={},ctx={})=>({text,details,data,ctx,actions:[],source:'موتور محاسبات کنترل‌شده؛ بدون اطلاعات حسابداری'});
const clarify=(text,details=[],ctx={})=>result(text,details,{kind:'clarify'},ctx);
const fail=()=>clarify('رابطه اعداد را با اطمینان تشخیص ندادم. لطفاً مبلغ‌ها و نقش هرکدام را مشخص کنید؛ مقدار حدسی اعلام نمی‌کنم.');
function catalog(q){
 const s=M.normalize(q).text.replace(/(میلیون|میلیارد|هزار|تومان|ریال)ی(?=\s|[،.؟؛]|$)/g,'$1'),a=M.problemFacts(s);
 const unit=/تومان/.test(s)&&!/ریال/.test(s)?'toman':/ریال/.test(s)&&!/تومان/.test(s)?'rial':null;
 const shorthand=!/میلیون|میلیارد|هزار/.test(s)&&/گوشی|موبایل|ایفون/.test(s)&&/تومن|تومون/.test(q)&&a.amounts.length>=2&&a.amounts.every(x=>/^\d+(?:\.\d+)?\s*تومان$/.test(x.raw)&&parseFloat(x.raw)<10000);
 const amounts=a.amounts.map((x,i)=>({...x,id:i,value:F.amount(shorthand?x.raw.replace(/تومان$/,'میلیون تومان'):x.raw,unit||(/ریال$/.test(x.raw)?'rial':/تومان$/.test(x.raw)?'toman':null))}));
 if(!shorthand&&/میلیون|میلیارد/.test(s))for(const x of amounts)if(/^\d{1,4}(?:\.\d+)?\s*تومان$/.test(x.raw))x.value=null;
 return {s,amounts,rates:a.rates.map((x,i)=>({...x,id:i})),months:a.months.map((x,i)=>({...x,id:i})),shorthand};
}
const cues={buy:'خریدم|خریده ام|خریداری کردم|قیمت خرید|بهای خرید',sell:'فروختم|فروخته ام|قیمت فروش|مبلغ فروش|می فروشم|فروش کردم',cost:'هزینه(?: کردم| جانبی| رجیستری| تعمیر| ارسال| حمل)?|خرج(?:ش| ان)?(?: کردم)?|کارمزد',discount:'تخفیف(?: دادم| گرفت| دادیم)?',cash:'پیش\\s*پرداخت|نقد(?:ی)?(?: داد| گرفته ام| گرفتم| دریافت کردم)?|وجه نقد',remaining:'مانده(?: مبلغ| بدهی| طلب)?|باقی مانده(?: مبلغ| بدهی)?'};
function options(c,i){
 const a=c.amounts[i],left=c.s.slice(i?c.amounts[i-1].end:0,a.index),right=c.s.slice(a.end,i+1<c.amounts.length?c.amounts[i+1].index:c.s.length);
 const before=Object.entries(cues).filter(([k,v])=>new RegExp('(?:^|\\s)(?:'+v+')(?:\\s+(?:به مبلغ|به قیمت|به ارزش|مبلغ|قیمت|به))?\\s*[:=]?\\s*$').test(left)).map(([k])=>k);
 const after=Object.entries(cues).filter(([k,v])=>new RegExp('^\\s*(?:'+v+')(?=\\s|[،.؟؛]|$)').test(right)).map(([k])=>k);
 return [...new Set([...before,...after])];
}
const isTrade=s=>/خریدم|قیمت خرید|خریداری کردم|بهای خرید/.test(s)&&/فروختم|قیمت فروش|می فروشم|مبلغ فروش/.test(s)&&/سود|زیان/.test(s);
const isInst=s=>/اقساط|قسط/.test(s)&&/ماه/.test(s);
const excluded=s=>/چند دستگاه|چند معامله|پس از تخفیف|بعد از تخفیف|با احتساب تخفیف|چک.*پاس|چک.*وصول/.test(s);
const idx=(a,i)=>{if(!Number.isInteger(i)||i<0||i>=a.length)throw Error('invalid reference');return a[i];};
function directTrade(c){
 if(!isTrade(c.s)||excluded(c.s))return null;
 const p={kind:'trade',buy:null,sell:null,cost:[],discount:[],cash:null,remaining:null,rate:null,term:null,downRate:null};
 for(let i=0;i<c.amounts.length;i++){const a=options(c,i);if(a.length!==1)return null;const k=a[0];if(Array.isArray(p[k]))p[k].push(i);else if(p[k]===null)p[k]=i;else return null;}
 if(isInst(c.s)){
  const rates=c.rates.filter(v=>/(?:ماهی|ماهانه|هر ماه|ماهیانه)\s*$/.test(c.s.slice(Math.max(0,v.index-25),v.index))||/^\s*(?:سود\s*)?(?:ماهی|ماهانه|هر ماه|ماهیانه)/.test(c.s.slice(v.end)));
  if(rates.length===1)p.rate=rates[0].id;if(c.months.length===1)p.term=0;
  const pre=c.rates.filter(v=>/پیش\s*پرداخت\s*$/.test(c.s.slice(Math.max(0,v.index-25),v.index))||/^\s*پیش\s*پرداخت/.test(c.s.slice(v.end)));
  if(pre.length===1)p.downRate=pre[0].id;
 }
 return p;
}
function execute(p,c){
 try{
  if(!isTrade(c.s)||excluded(c.s)||!Array.isArray(p.cost)||!Array.isArray(p.discount))return fail();
  if(Object.keys(p).some(k=>!['kind','buy','sell','cost','discount','cash','remaining','rate','term','downRate'].includes(k)))return fail();
  const roles=[['buy',p.buy],['sell',p.sell],...p.cost.map(i=>['cost',i]),...p.discount.map(i=>['discount',i]),...['cash','remaining'].filter(k=>p[k]!=null).map(k=>[k,p[k]])];
  const used=new Set();
  for(const [k,i] of roles){const a=idx(c.amounts,i);if(used.has(i)||!valid(a.value))return fail();used.add(i);const opts=options(c,i);if(opts.length&&!opts.includes(k))return fail();}
  if(used.size!==c.amounts.length)return fail();
  if(!p.cost.length&&/هزینه|خرج|کارمزد/.test(c.s)&&!/بدون هزینه|هزینه ای نکردم/.test(c.s))return fail();
  if(!p.discount.length&&/تخفیف/.test(c.s)&&!/بدون تخفیف|تخفیف ندادم/.test(c.s))return fail();
  const v=i=>BigInt(idx(c.amounts,i).value),sum=a=>a.reduce((x,i)=>x+v(i),0n);
  const buy=v(p.buy),gross=v(p.sell),cost=sum(p.cost),discount=sum(p.discount),sale=gross-discount,profit=sale-buy-cost;
  if(buy<=0n||sale<0n||[buy,gross,cost,discount,abs(profit),buy+cost].some(x=>x>MAX))return fail();
  const pct=round(profit*10000n,buy),pctText=(pct<0n?'-':'')+fa(abs(pct)/100n)+'٫'+fa((abs(pct)%100n).toString().padStart(2,'0'))+'٪';
  const details=['خرید: '+money(buy),'فروش پیش از تخفیف: '+money(gross),'تخفیف: '+money(discount),'هزینه: '+money(cost),'فروش خالص: '+money(sale),'سود نقدی: '+money(profit),'بازده نسبت به قیمت خرید: '+pctText];
  if(c.shorthand)details.push('فرض: «تومن» در این سناریو یعنی میلیون تومان.');
  const data={kind:'trade',profit:Number(profit),sale:Number(sale)};
  if(!isInst(c.s))return result('سود خالص معامله: '+money(profit),details,data);
  if(/مرکب|نزولی|مانده کاهش|روی مانده هر ماه|مانده ماهانه/.test(c.s))return clarify('سود نقدی: '+money(profit)+'؛ این روش سود نیاز به تعیین فرمول دقیق دارد.',details);
  if(p.rate==null||p.term==null)return clarify('سود نقدی: '+money(profit)+'؛ نرخ ماهانه و مدت اقساط را مشخص کنید.',details);
  const rate=idx(c.rates,p.rate).bp,months=idx(c.months,p.term).n;
  if(!Number.isInteger(rate)||!Number.isInteger(months)||months<1||months>60||rate<0||rate>10000)return fail();
  if(c.rates.length!==new Set([p.rate,...(p.downRate==null?[]:[p.downRate])]).size||c.months.length!==1||p.downRate===p.rate)return fail();
  if([p.cash,p.remaining,p.downRate].filter(x=>x!=null).length>1)return fail();
  const state={sale:Number(sale),profit:Number(profit),rate,months};
  if(p.cash==null&&p.remaining==null&&p.downRate==null)return clarify('سود نقدی معامله: '+money(profit)+'\nمبلغ پیش‌پرداخت مشتری چقدر است؟ یا مبلغ باقی‌مانده را بگویید.',details,{hybridPending:state});
  let down;
  if(p.cash!=null)down=v(p.cash);else if(p.remaining!=null)down=sale-v(p.remaining);else{const bp=idx(c.rates,p.downRate).bp;if(!Number.isInteger(bp)||bp<0||bp>10000)return fail();down=round(sale*BigInt(bp),B);}
  return finish(state,down,details);
 }catch{return fail();}
}
function finish(s,down,details=[]){
 const sale=BigInt(s.sale),profit=BigInt(s.profit);if(down<0n||down>sale)return clarify('پیش‌پرداخت باید بین صفر و مبلغ فروش باشد.',details,{hybridPending:s});
 const principal=sale-down,r=F.calculate({mode:'remaining',principal:Number(principal),months:s.months,rateBp:s.rate,method:'simple'});
 if(!r.ok)return clarify(r.error,details);
 const interest=BigInt(r.interest),due=BigInt(r.due),totalProfit=profit+interest,each=due/BigInt(s.months),last=due-each*BigInt(s.months-1);
 if(abs(totalProfit)>MAX||sale+interest>MAX||each*BigInt(s.months-1)+last!==due)return fail();
 return result('سود نقدی: '+money(profit)+'\nسود کل با اقساط: '+money(totalProfit)+'\nمبلغ هر قسط: '+money(each)+(last!==each?'؛ قسط آخر '+money(last):''),[...details,'فرض: سود ساده روی اصل ثابت مانده، نه مرکب یا نزولی.','پیش‌پرداخت: '+money(down),'اصل مانده: '+money(principal),'مدت: '+fa(s.months)+' ماه؛ نرخ ماهانه: '+fa(s.rate/100)+'٪','سود اقساط: '+money(interest),'جمع اقساط: '+money(due),'جمع کل دریافتی: '+money(down+due)],{kind:'trade-installment',profit:Number(profit),interest:r.interest,totalProfit:Number(totalProfit),each:Number(each),last:Number(last),due:r.due});
}
function follow(q,ctx){
 const s=ctx?.hybridPending;if(!s)return null;const c=catalog(q);
 if(isTrade(c.s)||c.amounts.length!==1||c.rates.length||c.months.length||!valid(c.amounts[0].value))return null;
 const v=BigInt(c.amounts[0].value);if(/مانده|باقی مانده/.test(c.s))return finish(s,BigInt(s.sale)-v);
 if(/پیش\s*پرداخت|نقد|دریافت|پرداخت کرده/.test(c.s))return finish(s,v);
 return clarify('این مبلغ پیش‌پرداخت است یا مانده بدهی مشتری؟',[],ctx);
}
function cheque(c,date){
 if(!/چک/.test(c.s)||!/پایان سال|اخر سال/.test(c.s)||!/دادم|پرداخت|باید.*در بیارم/.test(c.s)||/دریافتی|گرفتم|وصول|طلب/.test(c.s)||!c.amounts.length||c.amounts.length!==c.months.length)return null;
 if(!/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(date))return fail();
 const [y,m,d]=date.split('/').map(Number);let total=0n;const details=[],used=new Set();
 for(let i=0;i<c.amounts.length;i++){const a=c.amounts[i],prev=i?c.amounts[i-1].end:0,ms=c.months.filter(t=>t.index>=prev&&t.end<=a.index&&/^\s*(?:دیگه|دیگر|بعد)/.test(c.s.slice(t.end)));
  if(ms.length!==1||used.has(ms[0].id)||!valid(a.value)||!ms[0].n)return null;
  used.add(ms[0].id);const n=m-1+ms[0].n,yy=y+Math.floor(n/12),mm=n%12+1,dd=Math.min(d,C.monthLenJ(yy,mm)),v=BigInt(a.value);
  if(yy===y)total+=v;details.push(money(v)+' — سررسید '+fa(yy+'/'+mm+'/'+dd)+(yy===y?' (تا پایان سال)':' (سال بعد)'));
 }
 if(total>MAX)return fail();return result('مبلغ چک‌های پرداختی تا پایان سال: '+money(total),[...details,'فقط چک‌های ذکرشده، بدون سایر هزینه‌ها یا موجودی نقد.'],{kind:'cheque-deadline',total:Number(total)});
}
function local(q,ctx,date){
 const c=catalog(q);
 if(/^[\d\s.+\-*/^()%٪×÷]+[؟=?]*$/.test(c.s)){try{return result(M.display(M.expression(c.s.replace(/[؟=?]+$/,''))),[],{kind:'expression'});}catch{return fail();}}
 const fu=follow(q,ctx);if(fu)return fu;
 const p=directTrade(c);if(p)return execute(p,c);
 const ch=cheque(c,date);if(ch)return ch;
 if(!isTrade(c.s)){const v=M.tryMath(q,{});if(v&&['installment','capital-growth','balance-scenario','trade-profit','expression'].includes(v.data?.kind))return v;}
 return null;
}
function planPrompt(q,date){
 const c=catalog(q),list=a=>a.map(x=>x.id+':'+x.raw).join(' | ');
 return 'Extract roles only; never calculate. Output JSON only. For purchase/sale profit with optional installments: {"kind":"trade","buy":moneyId,"sell":moneyId,"cost":[moneyIds],"discount":[moneyIds],"cash":moneyId or null,"remaining":moneyId or null,"rate":rateId or null,"term":monthId or null,"downRate":rateId or null}. Missing fields null, arrays empty. Do not confuse profit with debt. If unsupported return {"kind":"unknown"}. IDs zero-based in each list. Amounts: '+list(c.amounts)+'; Rates: '+list(c.rates)+'; Months: '+list(c.months)+'; Date: '+date+'; Question: '+q;
}
function evaluate(q,raw){try{const s=String(raw||'').trim();if(s.length>3000||!s.startsWith('{')||!s.endsWith('}'))return fail();const p=JSON.parse(s);if(p?.kind==='trade')return execute(p,catalog(q));}catch{}return fail();}
const api={catalog,local,planPrompt,evaluate};root.FQHybridMath=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
