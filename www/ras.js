/* Read-only weighted invoice dates. Integer rial * calendar days, no accounting writes. */
'use strict';
const FQRas=(()=>{
 const valid=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&(()=>{try{return Core.addDays(d,0)===d;}catch(_){return false;}})();
 function weighted(rows,base){
  if(!valid(base))throw Error('تاریخ مبنا نامعتبر است.');
  let total=0n,weightedSum=0n,count=0,used=[];
  for(const r of rows){
   if(!valid(r.date)||!Number.isSafeInteger(r.amount)||r.amount<0)throw Error('مبلغ یا تاریخ یک فاکتور نامعتبر است.');
   if(!r.amount)continue;
   const days=Core.diffDays(base,r.date),amt=BigInt(r.amount);
   total+=amt;weightedSum+=amt*BigInt(days);count++;used.push({...r,days});
  }
  if(!total)return {count:0,total:'0',date:null,days:null,rows:[]};
  // nearest calendar day; half a day rounds towards the later date.
  let n=weightedSum/total,rem=weightedSum%total;if(rem<0n){n--;rem+=total;}
  if(rem*2n>=total)n++;
  const days=Number(weightedSum)/Number(total);
  return {count,total:total.toString(),date:Core.addDays(base,Number(n)),days,rows:used};
 }
 function calculate(st,o){
  if(!valid(o.from)||!valid(o.to)||o.from>o.to)throw Error('بازه تاریخ معتبر انتخاب کنید.');
  if(!['total','remaining'].includes(o.basis)||!['sale','purchase','both'].includes(o.type))throw Error('مبنای گزارش نامعتبر است.');
  const types=o.type==='both'?['sale','purchase']:[o.type],out={};
  for(const type of types){
   const rows=[];let excluded=0;
   for(const i of st.invoices||[]){
    if(i.type!==type||i.date<o.from||i.date>o.to||(o.pid&&+i.personId!==+o.pid))continue;
    const raw=o.basis==='remaining'?Core.invoiceInfo(st,i).remaining:Core.invoiceTotals(i).total;
    if(!Number.isSafeInteger(raw))throw Error('مبلغ فاکتور از محدوده محاسبه دقیق خارج است.');
    if(raw<=0){excluded++;continue;}
    rows.push({id:i.id,no:i.no,pid:i.personId,date:i.date,amount:raw});
   }
   rows.sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id);
   out[type]={...weighted(rows,o.from),excluded};
  }
  return out;
 }
 return {weighted,calculate};
})();
if(typeof module==='object'&&module.exports)module.exports=FQRas;
let rasOptions=null;
function rasMoney(n){const s=String(n),v=BigInt(s),div=UNIT()==='تومان'?10n:1n;const neg=v<0n,abs=neg?-v:v;return fa((neg?'-':'')+(abs/div).toString().replace(/\B(?=(\d{3})+(?!\d))/g,',')+(abs%div?'.'+String(abs%div):''));}
function rasLabel(k){return k==='sale'?'فروش':'خرید';}
function rasAllowed(o){return can('reports')&&(o.type==='sale'||can('cost'))&&(o.basis!=='remaining'||can('balances'));}
function rasText(o,r){
 const a=['رأس‌گیری فاکتورها','بازه: '+fmtDate(o.from)+' تا '+fmtDate(o.to),'شخص: '+(o.pid?personName(o.pid):'همه اشخاص'),'مبنا: '+(o.basis==='remaining'?'مانده فعلی تسویه‌نشده':'مبلغ نهایی فاکتور')+' ('+UNIT()+')','تاریخ‌ها تاریخ ثبت فاکتورند، نه سررسید پرداخت. برگشت‌ها جدا و خارج از محاسبه‌اند.'];
 for(const [k,x] of Object.entries(r)){a.push('',rasLabel(k)+' | تعداد: '+fa(x.count)+' | مجموع: '+rasMoney(x.total),x.date?'تاریخ رأس: '+fmtDate(x.date)+' | فاصله از ابتدای بازه: '+fa(x.days.toFixed(2))+' روز':'داده دارای مبلغ مثبت نیست.');for(const row of x.rows)a.push(fmtDate(row.date)+' | فاکتور '+fa(row.no)+' | '+personName(row.pid)+' | '+fmt(row.amount));}
 if(r.sale?.date&&r.purchase?.date)a.push('فاصله رأس فروش از خرید: '+fa((r.sale.days-r.purchase.days).toFixed(2))+' روز');
 return a;
}
async function rasPdf(lines){
 const {W,H,M,FONT}=PRINT,pages=[];let cv,ctx,y;
 const page=()=>{cv=document.createElement('canvas');cv.width=W;cv.height=H;ctx=cv.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.fillStyle='#111827';ctx.direction='rtl';ctx.textAlign='right';ctx.font='32px '+FONT;pages.push(cv);y=M+35;};
 page();for(const line of lines){for(const row of wrapText(ctx,line,W-2*M)){if(y>H-M)page();ctx.fillText(row,W-M,y);y+=54;}}
 await exportBinary('ras-'+stamp()+'.pdf',canvasesToPdf(pages,W,H),'application/pdf');
}
function pageRas(){
 if(!can('reports'))return {title:'دسترسی محدود',html:'',back:'#/reports'};
 const range=Core.periodRange('mtd',today()),o=rasOptions&&rasAllowed(rasOptions)?rasOptions:{from:range.from||today(),to:today(),type:can('cost')?'both':'sale',basis:'total',pid:0};
 let pid=o.pid||0;
 const opt=(v,t,c)=>'<option value="'+v+'"'+(v===c?' selected':'')+'>'+t+'</option>';
 const html='<form id="ras-form" class="card"><div class="row2">'+dateField('from',o.from,'از تاریخ')+dateField('to',o.to,'تا تاریخ')+'</div><label class="fld"><span>شخص (اختیاری)</span><button type="button" class="inp pick" id="ras-person">'+esc(pid?personName(pid):'همه اشخاص')+'</button></label><button type="button" id="ras-all" class="lnk">همه اشخاص</button><div class="row2"><label class="fld"><span>نوع فاکتور</span><select class="inp" name="type">'+opt('sale','فروش',o.type)+(can('cost')?opt('purchase','خرید',o.type)+opt('both','خرید و فروش',o.type):'')+'</select></label><label class="fld"><span>مبنای مبلغ</span><select class="inp" name="basis">'+opt('total','مبلغ نهایی',o.basis)+(can('balances')?opt('remaining','مانده فعلی',o.basis):'')+'</select></label></div><button class="btn blue" type="submit">محاسبه رأس</button></form><p class="hint">تاریخ ثبت فاکتور، نه سررسید چک؛ برگشت‌ها منظور نمی‌شوند. مانده فعلی به معنای مانده امروز است، نه مانده در پایان بازه. مبلغ صفر و مانده غیرمثبت حذف می‌شود.</p><div id="ras-result"></div>';
 return {title:'رأس‌گیری فاکتورها',html,back:'#/reports',mount(){
  const f=$('#ras-form'),out=$('#ras-result');
  const calc=()=>{const v={from:readDate(f,'from'),to:readDate(f,'to'),type:f.elements.namedItem('type').value,basis:f.elements.namedItem('basis').value,pid};
   try{if(!rasAllowed(v))throw Error('مجوز کافی ندارید.');const r=FQRas.calculate(S,v);rasOptions=v;
    out.innerHTML=Object.entries(r).map(([k,x])=>'<div class="card"><div class="ch">'+rasLabel(k)+'</div><div class="kv"><span>تعداد فاکتور</span><b>'+fa(x.count)+'</b><span>جمع ('+UNIT()+')</span><b>'+rasMoney(x.total)+'</b><span>تاریخ رأس</span><b class="credit">'+(x.date?fmtDate(x.date):'—')+'</b><span>فاصله از ابتدای بازه</span><b>'+(x.date?fa(x.days.toFixed(2))+' روز':'—')+'</b><span>مبالغ غیرمثبت حذف‌شده</span><b>'+fa(x.excluded)+'</b></div><details class="mix-details"><summary>جزئیات '+fa(x.count)+' فاکتور</summary>'+x.rows.map(a=>'<button class="row" data-act="go" data-h="#/inv/'+a.id+'"><span><b>فاکتور '+fa(a.no)+' · '+esc(personName(a.pid))+'</b><small>'+fmtDate(a.date)+'</small></span><em>'+fmt(a.amount)+'</em></button>').join('')+'</details></div>').join('')+(r.sale?.date&&r.purchase?.date?'<div class="card"><div class="kv"><span>فاصله تاریخ وزنی فروش از خرید (روز)</span><b>'+fa((r.sale.days-r.purchase.days).toFixed(2))+'</b></div><p class="hint">این فاصله لزوماً مدت وصول مطالبات یا گردش یک کالای خاص نیست.</p></div>':'')+'<div class="row2"><button class="btn ghost" id="ras-share">ارسال گزارش</button><button class="btn ghost" id="ras-pdf">PDF</button></div>';
    const lines=rasText(v,r);$('#ras-share').onclick=()=>{if(rasAllowed(v))shareText(lines.join('\n'),'رأس‌گیری');};$('#ras-pdf').onclick=async()=>{if(rasAllowed(v))try{await rasPdf(lines);}catch(e){toast('ساخت PDF ناموفق بود.',true);}};
   }catch(e){out.innerHTML='<p class="alert warn">'+esc(e.message)+'</p>';}
  };
  f.onsubmit=e=>{e.preventDefault();calc();};$('#ras-person').onclick=()=>pickList('انتخاب شخص',personItems(),v=>{pid=+v;$('#ras-person').textContent=personName(pid);calc();});$('#ras-all').onclick=()=>{pid=0;$('#ras-person').textContent='همه اشخاص';calc();};f.addEventListener('input',()=>{out.innerHTML='';});calc();
 }};
}
