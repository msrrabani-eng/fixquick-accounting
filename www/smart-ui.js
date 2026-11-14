/* Fix Quick v014 — read-only review dialogs and offline conversational UI. */
'use strict';
let smartTalk = [], smartContext = {}, smartTalkUser = null;
function smartCurrentUser() { try { return typeof curName === 'function' ? String(curName()) : 'owner'; } catch (_) { return 'owner'; } }
function smartResetForUser() { const u=smartCurrentUser(); if(smartTalkUser!==u){ aiCancel(); smartTalkUser=u; smartTalk=[]; smartContext={}; } }
function pageSmartAssistant() {
  smartResetForUser();
  const examples=['محاسبه سود معامله','بیشترین کارکردمون با کی بوده؟','فروش این ماه چقدر بوده؟','چک‌های سررسید ۷ روز آینده','آیا ثبت تکراری داریم؟','سود ماه قبل چقدر بوده؟','بیشترین خرید از کی بوده؟','مانده حساب یک مشتری','پرفروش‌ترین کالا از نظر تعداد چیه؟'];
  const history=smartTalk.length ? smartTalk.map(m => '<div class="fq-msg '+(m.role==='user'?'fq-user':'fq-bot')+'"><div>'+esc(m.text)+'</div>'+(m.details&&m.details.length?'<ul>'+m.details.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'')+(m.actions&&m.actions.length?'<div class="chips wrap">'+m.actions.map(x=>'<button type="button" class="chip" data-act="go" data-h="'+esc(x.route)+'">'+esc(x.label)+'</button>').join('')+'</div>':'')+'</div>').join('') : '<div class="hint center">سؤالتان را درباره اطلاعات ثبت‌شده بپرسید. پاسخ‌ها فقط از داده‌های همین برنامه محاسبه می‌شوند.</div>';
  const h='<div class="ui2-chat-head"><div class="ch">'+ico('chat')+'دستیار حسابداری</div><button type="button" class="lnk" id="fq-chat-reset">'+ico('plus')+'گفت‌وگوی جدید</button></div>'+
    '<div class="ui2-ai-tools"><button type="button" class="chip" id="fq-ai-addon">'+ico('download')+'افزونه هوش مصنوعی</button><span id="fq-ai-tag" class="hint">دستیار پایه</span><button type="button" class="chip" id="fq-ai-speak">خواندن پاسخ</button></div>'+
    '<details class="ui2-chat-intro"><summary>راهنمای دستیار · آفلاین</summary><p class="hint">تحلیل آفلاین گردش، فروش، خرید، سود، هزینه، موجودی، چک و مانده حساب؛ سؤال‌های مبهم نیاز به توضیح دارند. اطلاعاتی ارسال یا ثبت نمی‌شود.</p></details>'+
    '<div id="fq-chat-history" class="fq-chat-history" aria-live="polite">'+history+(aiBusy?'<div class="fq-msg fq-bot">در حال تحلیل محلی… <button type="button" id="fq-ai-cancel" class="lnk">توقف</button></div>':'')+'</div>'+
    (smartTalk.length?'':'<div class="chips wrap ui2-chat-examples">'+examples.map(x=>'<button type="button" class="chip" data-act="fqChatExample" data-q="'+esc(x)+'">'+esc(x)+'</button>').join('')+'</div>')+
    '<form id="fq-chat-form" class="card ui2-chat-compose"><textarea id="fq-chat-input" class="inp" rows="1" maxlength="1800" aria-label="سؤال جدید" placeholder="سؤال خود را بنویسید…" required></textarea><button class="btn ghost" type="button" id="fq-ai-mic" aria-label="گفتار فارسی">'+ico('mic')+'</button><button class="btn blue" type="submit" aria-label="ارسال سؤال"'+(aiBusy?' disabled':'')+'>'+ico('send')+'</button></form>';
  return {title:'دستیار گفت‌وگویی',html:h,back:'#/home',mount:()=>{
    const f=$('#fq-chat-form'); f.onsubmit=e=>{e.preventDefault(); smartAskQuestion($('#fq-chat-input').value);};
    $('#fq-chat-reset').onclick=()=>{aiCancel();smartTalk=[];smartContext={};render();};
    $('#fq-ai-addon').onclick=aiOpenAddon;$('#fq-ai-mic').onclick=aiVoiceInput;$('#fq-ai-speak').onclick=aiSpeakLast;
    const stop=$('#fq-ai-cancel');if(stop)stop.onclick=()=>{aiCancel();smartTalk.push({role:'assistant',text:'تحلیل متوقف شد.'});render();};
    const tag=$('#fq-ai-tag');aiReadStatus().then(()=>{if(tag?.isConnected)tag.textContent=aiReady()&&aiEnabled()?'مدل محلی آماده':'دستیار پایه';});
    const b=$('#fq-chat-history');if(b)b.scrollTop=b.scrollHeight;
  }};
}
async function smartAskQuestion(text){
  smartResetForUser();const q=String(text||'').trim();if(!q||aiBusy||aiListening)return;
  const opts={today:today(),allow:{reports:can('reports'),balances:can('balances'),cost:can('cost'),money:can('money'),warehouse:routeAllowed('products')}};
  const history=smartTalk.slice(-4),context=smartContext,owner=smartCurrentUser();
  let out=Core.financeScenario.ask(q,context,opts)||Core.smartAssistant.ask(S,q,context,opts);
  // Deterministic financial results and confirmations have priority. The optional model
  // handles unsupported / unclear questions, not privileged writes or automatic confirmations.
  const complex=/چطور|چگونه|چرا|روش ثبت|سند زدن|سند بزن|تحلیل|مشاوره|بهتره|بهتر است/.test(q);
  const useAI=aiEnabled()&&!!FQAI.plugin()&&(!out.data||['unsupported','clarify'].includes(out.data.kind)||complex&&out.data.kind!=='denied'&&!String(out.data.kind||'').startsWith('finance-'))&&!context.finance;
  smartTalk.push({role:'user',text:q});
  if(useAI){const job=++aiJob;aiBusy=true;render();try{
    const modelOut=await aiAdvanced(q,history,opts);
    if(job!==aiJob||owner!==smartCurrentUser())return;
    // Re-read permissions after inference, rather than trusting an earlier permission snapshot.
    const live={today:today(),allow:{reports:can('reports'),balances:can('balances'),cost:can('cost'),money:can('money'),warehouse:routeAllowed('products')}};
    const interpreted=FQAI.route(modelOut,{query:x=>Core.smartAssistant.ask(S,x,{},live),finance:x=>Core.financeScenario.ask(x,{},live)});
    if(interpreted)out=interpreted;
  }catch(e){if(job!==aiJob||owner!==smartCurrentUser())return;out={...out,details:[...(out.details||[]),'مدل محلی پاسخ نداد: '+aiError(e)]};}
  finally{if(job===aiJob)aiBusy=false;}
  if(job!==aiJob||owner!==smartCurrentUser())return;}
  smartContext=out.ctx||{}; smartTalk.push({role:'assistant',text:out.text,details:out.details,actions:out.actions});
  smartTalk=smartTalk.slice(-16);if(location.hash.split('?')[0]==='#/assistant')render();
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
