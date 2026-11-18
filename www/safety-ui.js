/* One reference convention for warnings, accounting document labels and source navigation. */
function savedDocCaption(kind,id){
 const nums=Core.savedDocNumbers(S,kind,id);
 return nums.length?'سند حسابداری '+nums.map(fa).join('، '):'بدون شماره سند حسابداری ثبت‌شده';
}
function riskRecord(ref){
 const lists={tx:'tx',exp:'expenses',chq:'cheques',inv:'invoices',mix:'combined',vch:'vouchers',xfer:'acctTx',adj:'adjusts',wh:'whTx',acct:'accounts'};
 return Core.byId(S[lists[ref.kind]]||[],+ref.id);
}
function riskInfo(ref){
 const x=riskRecord(ref);if(!x)return {caption:'رکورد مرتبط در دسترس نیست',detail:'',open:false};
 const k=ref.kind,parts=[],type=k==='tx'?({receipt:'دریافت',payment:'پرداخت',transfer:'حواله',opening:'اول دوره',invoice:'فاکتور'}[x.type]||'تراکنش'):k==='exp'?'هزینه':k==='chq'?'چک':k==='inv'?'فاکتور':k==='mix'?'سند ترکیبی':k==='vch'?'سند دستی / مالی':k==='xfer'?'انتقال وجه':k==='adj'?'تعدیل موجودی':k==='wh'?'حواله انبار':'حساب';
 if(x.personId&&can('balances'))parts.push(personName(x.personId));
 if(k==='exp')parts.push(x.title||'');
 if(k==='chq'&&x.serial)parts.push('شماره چک '+fa(x.serial));
 if(k==='inv')parts.push('شماره فاکتور '+fa(x.no));
 if(k==='wh')parts.push('شماره حواله انبار '+fa(x.no));
 if(k==='vch')parts.push('شماره ثبت دستی '+fa(x.no));
 if(x.date&&Core.validIso(x.date))parts.push(fmtDate(x.date));
 if(Number.isFinite(x.amount)&&can('money'))parts.push(fmt(x.amount)+' '+UNIT());
 if(k==='mix'&&Number.isFinite(x.applied)&&can('money'))parts.push(fmt(x.applied)+' '+UNIT());
 if(k==='inv'&&can('cost'))parts.push(fmt(Core.invoiceTotals(x).total)+' '+UNIT());
 if(x.acct&&can('money')){const ac=Core.byId(S.accounts||[],x.acct);if(ac)parts.push(Core.acctName(ac));}
 const open=k==='inv'?(x.type==='sale'||x.type==='sale_return'||can('cost')):k==='wh'||k==='adj'?can('warehouse'):k==='vch'?routeAllowed('vouchers'):k==='acct'?can('reports'):can('money');
 return {caption: type+' · '+(k==='wh'?'حواله انبار':savedDocCaption(k,ref.id)),detail:parts.filter(Boolean).join(' · '),open};
}
function riskCard(i,preview=false){
 return '<div class="alert warn fq-risk"><b>'+esc(i.message)+'</b>'+ (i.refs||[]).map(r=>{
 const info=riskInfo(r);return '<div class="fq-risk-row"><div><b>'+esc(info.caption)+'</b><small>'+esc(info.detail)+'</small></div>'+(info.open?'<button type="button" class="btn ghost sm" data-'+(preview?'risk-preview':'act')+'="'+(preview?'1':'riskOpen')+'" data-kind="'+esc(r.kind)+'" data-id="'+Number(r.id)+'">مشاهده</button>':'')+'</div>';
 }).join('')+'</div>';
}
function openRiskSource(d){
 const ref={kind:d.kind,id:+d.id},x=riskRecord(ref);if(!x||!riskInfo(ref).open)return toast('رکورد در دسترس نیست یا مجوز کافی ندارید.',true);
 switch(d.kind){
 case 'inv':return goHash('#/inv/'+x.id);
 case 'tx':return txOpen(x.id);
 case 'exp':return expenseForm(x);
 case 'chq':return chequeView(x.id);
 case 'mix':return mixedView(x.id);
 case 'vch':return voucherView(x.id);
 case 'xfer':return actions.acctXferOpen({id:String(x.id)});
 case 'wh':return whTxView(x.id);
 case 'adj':return goHash('#/kardex/'+x.productId);
 case 'acct':return goHash('#/acct/'+x.id);
 }
}
async function smartGuardConfirm(kind, candidate, editId){
 const issues=Core.smartGuard.preflight(S,kind,candidate,{editingId:editId||null,today:today()});
 if(!issues.length)return true;
 // Read-only preview during a draft; never navigate away or change a previously saved transaction mid-save.
 return new Promise(resolve=>{
 const sh=sheet('کنترل هوشمند قبل از ثبت',issues.slice(0,6).map(x=>riskCard(x,true)).join('')+'<p class="hint">ثبت جدید هنوز انجام نشده است. اگر مورد قبلی واقعاً تکراری نیست، ادامه دهید.</p><div class="row2"><button class="btn blue" data-risk-yes>بررسی کردم؛ ثبت شود</button><button class="btn ghost" data-close>انصراف</button></div>',{onClose:()=>resolve(false)});
 sh.qa('[data-risk-preview]').forEach(b=>b.onclick=()=>{const r={kind:b.dataset.kind,id:+b.dataset.id};const info=riskInfo(r);if(info.open)alertBox('جزئیات مورد مرتبط','<b>'+esc(info.caption)+'</b><p>'+esc(info.detail)+'</p><p class="hint">برای ویرایش سند قبلی، ابتدا ثبت فعلی را لغو کنید و از کنترل خطا یا اسناد ثبت‌شده وارد آن شوید.</p>');});
 sh.q('[data-risk-yes]').onclick=()=>{sh.close(true);resolve(true);};
 });
}
function pageSafety(){
 const s=Core.smartGuard.scan(S,{today:today(),max:60}),issues=isAdmin()?Core.audit(S,true):[];
 const h='<div class="card"><div class="ch">کنترل هوشمند خطاهای مالی</div><p class="hint">تشخیص فقط احتمالی است؛ هیچ سندی خودکار حذف یا اصلاح نمی‌شود. شماره حسابداری با شماره فاکتور و چک متفاوت است.</p></div>'+
 '<div class="kpis"><div class="kpi"><small>ثبت‌های احتمالاً تکراری</small><b>'+fa(s.count)+'</b></div>'+(isAdmin()?'<div class="kpi"><small>مغایرت ساختاری سیستم</small><b>'+fa(issues.length)+'</b></div>':'')+'</div>'+
 (s.items.length?'<div class="card"><div class="ch">نیازمند بررسی دستی</div>'+s.items.map(i=>riskCard(i)).join('')+(s.truncated?'<p class="hint">نتایج بیشتر نیز وجود دارد.</p>':'')+'</div>':'<div class="card"><p>در بررسی تکراری‌های ثبت‌شده مورد مشابهی پیدا نشد.</p></div>')+
 (issues.length?'<div class="card"><div class="ch">خطاهای ساختاری</div>'+issues.slice(0,60).map(i=>riskCard(i)).join('')+'</div>':'');
 return {title:'کنترل خطا',html:h,back:'#/home'};
}

/* v015: live duplicate hints and explicit confirmation; never merge or edit records. */
const entityPending = new WeakSet();
function entityMatchText(m,kind) {
  const why=[m.phone?'شماره تماس تکراری':'',m.score===100?'نام یکسان':m.score?'نام بسیار مشابه':''].filter(Boolean).join('، ');
  return m.name+(m.code?' (کد '+m.code+')':'')+(m.archived?' [بایگانی‌شده]':'')+' — '+why;
}
function entityCandidate(form) {
  return {name:form.elements.namedItem('name').value,phone:form.elements.namedItem('phone')?.value||''};
}
function entityLive(form,kind,id) {
  const box=document.createElement('div'); box.className='alert warn'; box.hidden=true;
  box.setAttribute('aria-live','polite');
  const field=form.elements.namedItem(kind==='person'?'phone':'name');
  field.closest('label').after(box);
  let t; const refresh=()=>{clearTimeout(t);t=setTimeout(()=>{
    if(!form.isConnected)return;
    const matches=Core.entityGuard.find(S,kind,entityCandidate(form),id);
    box.hidden=!matches.length;const opened=!!box.querySelector('details[open]');box.replaceChildren();if(matches.length){const detail=document.createElement('details');detail.open=opened;const sum=document.createElement('summary');sum.textContent=(matches.some(m=>m.phone)?'شماره تماس تکراری':'نام مشابه')+' · '+fa(matches.length)+' مورد';detail.append(sum);const list=document.createElement('ul');matches.slice(0,8).forEach(m=>{const li=document.createElement('li');li.textContent=entityMatchText(m,kind);list.append(li);});detail.append(list);if(matches.length>8){const more=document.createElement('div');more.textContent=fa(matches.length-8)+' مورد دیگر؛ پیش از ثبت بررسی کنید.';detail.append(more);}box.append(detail);}
  },180);};
  form.addEventListener('input',refresh); form.addEventListener('change',refresh);refresh();
}
async function entityConfirm(form,kind,data,id) {
  if(entityPending.has(form))return false;
  const matches=Core.entityGuard.find(S,kind,data,id);
  if(!matches.length)return true;
  entityPending.add(form);
  try{return await confirmBox('احتمال ثبت تکراری '+(kind==='person'?'شخص':'کالا')+':\n\n'+matches.slice(0,8).map(m=>entityMatchText(m,kind)).join('\n')+(matches.length>8?'\nو '+(matches.length-8)+' مورد دیگر':'')+'\n\nاگر مورد جدید واقعاً متفاوت است، ثبت را ادامه دهید. هیچ رکوردی ادغام یا حذف نمی‌شود.','بررسی کردم؛ ادامه ثبت',true);}
  finally{entityPending.delete(form);}
}
async function entityBatchConfirm(kind,items) {
  const rows=Core.entityGuard.batch(S,kind,items);
  if(!rows.length)return true;
  return confirmBox('در فهرست، '+rows.length+' مورد احتمالاً تکراری پیدا شد:\n\n'+rows.slice(0,8).map(r=>r.name+' ← '+r.matches.slice(0,3).map(m=>entityMatchText(m,kind)).join('؛ ')).join('\n')+(rows.length>8?'\nو '+(rows.length-8)+' مورد دیگر':'')+'\n\nقوانین فعلی ثبت نام و کد تکراری همچنان برقرارند.','بررسی کردم؛ ادامه ورود',true);
}
