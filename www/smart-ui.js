/* Read-only accounting conversation and review dialogs. */
'use strict';
let smartTalk=[],smartContext={},smartTalkUser=null,smartBusy=false,smartJob=0;
function smartCurrentUser(){try{return JSON.stringify([String(curName()),isAdmin(),...['money','balances','reports','cost','warehouse','purchase'].map(k=>can(k)),routeAllowed('products')]);}catch(_){return null;}}
function smartResetForUser(){const u=smartCurrentUser();if(smartTalkUser!==u){smartJob++;smartBusy=false;smartTalkUser=u;smartTalk=[];smartContext={};}}
function pageSmartAssistant(){
 smartResetForUser();
 const examples=['دیروز چقدر فروش داشتیم؟','این ماه چقدر سود داشتیم؟','چک های ۷ روز آینده','اولویت وصول مطالبات','پیش بینی نقدینگی ۷ روز آینده','کالاهای راکد','آیا ثبت تکراری داریم؟','رأس‌گیری چک‌ها','محاسبه سود معامله','ارزش انبار'];
 const history=smartTalk.length?smartTalk.map(m=>'<div class="fq-msg '+(m.role==='user'?'fq-user':'fq-bot')+'"><div>'+esc(m.text)+'</div>'+(m.source?'<small class="hint">'+esc(m.source)+'</small>':'')+(m.details?.length?'<ul>'+m.details.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'')+(m.actions?.length?'<div class="chips wrap">'+m.actions.map(x=>'<button type="button" class="chip" data-act="go" data-h="'+esc(x.route)+'">'+esc(x.label)+'</button>').join('')+'</div>':'')+'</div>').join(''):'<div class="hint center">سؤال خود را درباره اطلاعات ثبت‌شده بپرسید. پاسخ‌ها از موتور حسابداری محاسبه می‌شوند.</div>';
 const html='<section class="ui20-chat"><div class="ui20-scroll"><div class="ui2-chat-head"><div class="ch">'+ico('chat')+'دستیار حسابداری</div><button type="button" class="lnk" id="fq-chat-reset">'+ico('plus')+'گفت‌وگوی جدید</button></div>'+
 '<details class="ui2-chat-intro"><summary>راهنمای دستیار · آفلاین</summary><p class="hint">این دستیار فقط گزارش‌های محاسباتی و خواندنی را ارائه می‌کند. هیچ سندی ثبت یا اطلاعاتی ارسال نمی‌شود.</p></details>'+
 '<div id="fq-chat-history" class="fq-chat-history" aria-live="polite">'+history+'</div>'+
 (smartTalk.length?'':'<details class="ui20-examples"><summary>نمونه سؤال‌ها</summary><div class="chips wrap ui2-chat-examples">'+examples.map(x=>'<button type="button" class="chip" data-act="fqChatExample" data-q="'+esc(x)+'">'+esc(x)+'</button>').join('')+'</div></details>')+'</div>'+
 '<form id="fq-chat-form" class="card ui2-chat-compose"><textarea id="fq-chat-input" class="inp" rows="1" maxlength="1800" aria-label="سؤال جدید" placeholder="سؤال خود را بنویسید…" required></textarea><button class="btn blue" type="submit" aria-label="ارسال سؤال"'+(smartBusy?' disabled':'')+'>'+ico('send')+'</button></form></section>';
 return {title:'دستیار حسابداری',html,back:'#/home',mount:()=>{
  $('#fq-chat-form').onsubmit=e=>{e.preventDefault();smartAskQuestion($('#fq-chat-input').value);};
  $('#fq-chat-reset').onclick=()=>{smartJob++;smartBusy=false;smartTalk=[];smartContext={};render();};
  const b=$('.ui20-scroll');if(b&&smartTalk.length)b.scrollTop=b.scrollHeight;
 }};
}
async function smartAskQuestion(text){
 smartResetForUser();const q=String(text||'').trim(),owner=smartCurrentUser();if(!q||!owner||smartBusy||location.hash.split('?')[0]!=='#/assistant')return;
 const permissions=()=>({reports:can('reports'),balances:can('balances'),cost:can('cost'),money:can('money'),warehouse:routeAllowed('products')});
 const opts=()=>({today:today(),allow:permissions()});
 const context=smartContext,job=++smartJob,auth=JSON.stringify(permissions()),valid=()=>job===smartJob&&owner===smartCurrentUser()&&location.hash.split('?')[0]==='#/assistant'&&JSON.stringify(permissions())===auth;
 smartBusy=true;smartTalk.push({role:'user',text:q});let out;
 try{out=await FQReports.runSmart(q,context,{valid,permissions,today,read:x=>Core.smartAssistant.structuredRead(S,x,opts()),stock:()=>{const a=permissions();if(!a.warehouse||!a.reports||!a.cost)throw Error('مجوز انبار فعال نیست.');return Core.stockInsights(S,today());},finance:(x,c)=>Core.financeScenario.ask(x,c,opts()),weighted:(x,c)=>Core.chequeAssistant.weightedAsk(x,c,opts())});}
 catch(e){out={text:'گزارش کامل نشد؛ هیچ مبلغ حدسی تولید نشد.',ctx:context,details:[String(e?.message||e)],actions:[],source:'خطای گزارش'};}
 finally{if(job===smartJob)smartBusy=false;}
 if(!valid())return;
 smartContext=out.ctx||{};smartTalk.push({role:'assistant',text:out.text,details:out.details,actions:out.actions,source:out.source||'دستیار حسابداری'});smartTalk=smartTalk.slice(-16);render();
}
if(typeof window!=='undefined')window.addEventListener('hashchange',()=>{if(location.hash.split('?')[0]!=='#/assistant'){smartJob++;smartBusy=false;smartTalk=[];smartContext={};}});

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
    '';
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
