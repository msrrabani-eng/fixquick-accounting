/* Fix Quick v014 — read-only review dialogs and offline conversational UI. */
'use strict';
let smartTalk = [], smartContext = {}, smartTalkUser = null;
function smartCurrentUser() { try { return typeof curName === 'function' ? String(curName()) : 'owner'; } catch (_) { return 'owner'; } }
function smartResetForUser() { const u=smartCurrentUser(); if(smartTalkUser!==u){ smartTalkUser=u; smartTalk=[]; smartContext={}; } }
function pageSmartAssistant() {
  smartResetForUser();
  const examples=['فروش این ماه چقدر بوده؟','چک‌های سررسید ۷ روز آینده','آیا ثبت تکراری داریم؟','سود ماه قبل چقدر بوده؟','مانده حساب یک مشتری'];
  const history=smartTalk.length ? smartTalk.map(m => '<div class="fq-msg '+(m.role==='user'?'fq-user':'fq-bot')+'"><div>'+esc(m.text)+'</div>'+(m.details&&m.details.length?'<ul>'+m.details.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'')+(m.actions&&m.actions.length?'<div class="chips wrap">'+m.actions.map(x=>'<button type="button" class="chip" data-act="go" data-h="'+esc(x.route)+'">'+esc(x.label)+'</button>').join('')+'</div>':'')+'</div>').join('') : '<div class="hint center">سؤالتان را درباره اطلاعات ثبت‌شده بپرسید. پاسخ‌ها فقط از داده‌های همین برنامه محاسبه می‌شوند.</div>';
  const h='<div class="card"><div class="ch">دستیار گفت‌وگویی حسابداری</div><p class="hint">آفلاین، بدون ارسال اطلاعات مشتریان به اینترنت، فقط خواندنی. این نسخه یک تحلیل‌گر گفت‌وگویی قاعده‌محور است، نه هوش مصنوعی مولد. پاسخ نامطمئن را حدس نمی‌زند.</p></div>'+
    '<div id="fq-chat-history" class="fq-chat-history" aria-live="polite">'+history+'</div>'+
    '<form id="fq-chat-form" class="card"><label class="fld"><span>سؤال جدید یا ادامه سؤال قبلی</span><textarea id="fq-chat-input" class="inp" rows="2" maxlength="500" placeholder="مثلاً: از علی رضایی چقدر طلب دارم؟" required></textarea></label><div class="row2"><button class="btn blue" type="submit">پرسیدن</button><button class="btn ghost" type="button" id="fq-chat-reset">گفت‌وگوی جدید</button></div></form>'+
    '<div class="chips wrap">'+examples.map(x=>'<button type="button" class="chip" data-act="fqChatExample" data-q="'+esc(x)+'">'+esc(x)+'</button>').join('')+'</div>';
  return {title:'دستیار گفت‌وگویی',html:h,back:'#/home',mount:()=>{
    const f=$('#fq-chat-form'); f.onsubmit=e=>{e.preventDefault(); smartAskQuestion($('#fq-chat-input').value);};
    $('#fq-chat-reset').onclick=()=>{smartTalk=[];smartContext={};render();};
    const b=$('#fq-chat-history');if(b)b.scrollTop=b.scrollHeight;
  }};
}
function smartAskQuestion(text){
  smartResetForUser();const q=String(text||'').trim();if(!q)return;
  const out=Core.smartAssistant.ask(S,q,smartContext,{today:today(),allow:{reports:can('reports'),balances:can('balances'),cost:can('cost'),money:can('money'),warehouse:routeAllowed('products')}});
  smartContext=out.ctx||{}; smartTalk.push({role:'user',text:q},{role:'assistant',text:out.text,details:out.details,actions:out.actions});
  smartTalk=smartTalk.slice(-16);render();
}
async function smartGuardConfirm(kind, candidate, editId){
  const issues=Core.smartGuard.preflight(S,kind,candidate,{editingId:editId||null,today:today()});
  if(!issues.length)return true;
  return confirmBox('کنترل هوشمند قبل از ثبت '+(issues.some(x=>x.severity==='high')?'(احتمال خطای مهم)':'')+':\n\n'+issues.slice(0,6).map((x,i)=>(i+1)+'. '+x.message).join('\n')+'\n\nآیا اطلاعات را بررسی کرده‌اید و با وجود این هشدارها می‌خواهید ثبت شود؟','بررسی کردم؛ ثبت شود',true);
}
function pageSafety(){
  const s=Core.smartGuard.scan(S,{today:today(),max:60});
  const issues=isAdmin()?Core.audit(S):[];
  const h='<div class="card"><div class="ch">کنترل هوشمند خطاهای مالی</div><p class="hint">بررسی فقط خواندنی است؛ هیچ سندی به‌صورت خودکار اصلاح یا حذف نمی‌شود. تشخیص «احتمالی» است و باید با اسناد واقعی تطبیق داده شود.</p></div>'+
    '<div class="kpis"><div class="kpi"><small>ثبت‌های احتمالاً تکراری</small><b>'+fa(s.count)+'</b></div>'+(isAdmin()?'<div class="kpi"><small>مغایرت ساختاری سیستم</small><b>'+fa(issues.length)+'</b></div>':'')+'</div>'+
    (s.items.length?'<div class="card"><div class="ch">نیازمند بررسی دستی</div>'+s.items.map(i=>'<div class="alert warn">'+esc(i.message)+'</div>').join('')+(s.truncated?'<p class="hint">نتایج بیشتر نیز وجود دارد.</p>':'')+'</div>':'<div class="card"><p>در بررسی تکراری‌های ثبت‌شده مورد مشابهی پیدا نشد.</p></div>')+
    (isAdmin()&&issues.length?'<div class="card"><div class="ch">خطاهای ساختاری</div><ul>'+issues.slice(0,20).map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div>':'')+
    '<button class="btn ghost" data-act="go" data-h="#/assistant">درباره نتیجه از دستیار بپرسید</button>';
  return {title:'کنترل خطا',html:h,back:'#/home'};
}