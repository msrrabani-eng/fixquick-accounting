/* Read-only accounting conversation and review dialogs. */
'use strict';
let smartTalk=[],smartContext={},smartTalkUser=null,smartBusy=false,smartJob=0,smartDraft='',smartExpanded=false,smartExporting=false,smartEditorDispose=null,smartDataAccess=false,smartModeSessions={};
function smartCurrentUser(){try{return JSON.stringify([String(curName()),isAdmin(),...['money','balances','reports','cost','warehouse','purchase'].map(k=>can(k)),routeAllowed('products')]);}catch(_){return null;}}
function smartResetForUser(){const u=smartCurrentUser();if(smartTalkUser!==u){smartJob++;smartBusy=false;smartTalkUser=u;smartTalk=[];smartContext={};smartDraft='';smartExpanded=false;smartDataAccess=false;smartModeSessions={};}}
function smartToggleData(){
 if(smartBusy||smartExporting)return;
 smartModeSessions[smartDataAccess?'data':'math']={talk:smartTalk,context:smartContext,draft:smartDraft,expanded:smartExpanded};
 smartDataAccess=!smartDataAccess;smartJob++;
 const next=smartModeSessions[smartDataAccess?'data':'math']||{};
 smartTalk=next.talk||[];smartContext=next.context||{};smartDraft=next.draft||'';smartExpanded=!!next.expanded;
 document.body.classList.remove('fq-chat-typing');render();
}
function smartAliasKey(){return 'fq_offline_aliases_v1:'+encodeURIComponent(String(curName()||''));}
function smartAliases(){try{const a=JSON.parse(localStorage.getItem(smartAliasKey())||'[]');return Array.isArray(a)?a.filter(x=>x&&typeof x.alias==='string'&&typeof x.name==='string'&&['person','product'].includes(x.kind)).slice(0,200):[];}catch(_){return [];}}
function smartSaveAlias(a){try{const list=smartAliases().filter(x=>!(x.kind===a.kind&&x.alias===a.alias));list.push(a);localStorage.setItem(smartAliasKey(),JSON.stringify(list.slice(-200)));return true;}catch(_){return false;}}
function smartPerms(){return {reports:can('reports'),balances:can('balances'),cost:can('cost'),money:can('money'),warehouse:can('warehouse')&&routeAllowed('products')};}
function smartHandlers(valid){
 const snapshot=JSON.parse(JSON.stringify(S)),opts=()=>({today:today(),allow:smartPerms()});
 return {valid,permissions:smartPerms,today,state:()=>snapshot,aliases:smartAliases,saveAlias:a=>valid()&&smartSaveAlias(a),read:x=>Core.smartAssistant.structuredRead(snapshot,x,opts()),stock:()=>{const a=smartPerms();if(!a.warehouse||!a.reports||!a.cost)throw Error('مجوز انبار فعال نیست.');return Core.stockInsights(snapshot,today());},finance:(x,c)=>Core.financeScenario.ask(x,c,opts()),weighted:(x,c)=>Core.chequeAssistant.weightedAsk(x,c,opts())};
}
function smartMathTable(rows,unit=Core.unit){
 if(!Array.isArray(rows)||!rows.length)return '';
 const cell=x=>esc(FQChatFormat.amount(x,unit,Core));
 return '<details class="fq-math-schedule" open><summary>جدول کامل محاسبات ('+fa(rows.length)+' ردیف)</summary><div class="fq-math-scroll"><table dir="rtl"><thead><tr><th>مرحله</th><th>مانده اول</th><th>سود</th><th>پرداخت</th><th>مانده آخر</th></tr></thead><tbody>'+rows.map(r=>'<tr><th>'+ (r.phase==='delay'?'تأخیر ':'قسط ')+fa(r.month)+'</th><td>'+cell(r.opening)+'</td><td>'+cell(r.interest)+'</td><td>'+cell(r.payment)+'</td><td>'+cell(r.closing)+'</td></tr>').join('')+'</tbody></table></div><small class="hint">واحد مبالغ: '+esc(Core.unitName(unit))+'</small></details>';
}
function smartStamp(m){return FQChatFormat.stamp(m.at,Core);}
function smartAccess(owner){return !!owner&&owner===smartCurrentUser()&&owner===smartTalkUser&&location.hash.split('?')[0]==='#/assistant';}
async function smartCopy(button,index){
 const owner=smartCurrentUser(),m=smartTalk[index];if(!m||!owner||!smartAccess(owner))return;
 const text=FQChatFormat.copyText(m,Core);let ok=false;
 try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);ok=true;}}catch(_){}
 if(!ok&&smartAccess(owner)){
  const el=document.createElement('textarea');el.value=text;el.readOnly=true;el.style.cssText='position:fixed;opacity:0;inset:0 auto auto 0;font-size:16px;pointer-events:none';document.body.appendChild(el);el.select();try{ok=document.execCommand('copy');}catch(_){}el.remove();
 }
 if(!smartAccess(owner))return;
 if(ok){toast('متن کامل پیام کپی شد.');if(button.isConnected){button.textContent='✓ کپی شد';setTimeout(()=>{if(button.isConnected)button.textContent='کپی';},1400);}}
 else{const sh=sheet('کپی پاسخ','<textarea class="inp" readonly style="height:45vh;white-space:pre-wrap">'+esc(text)+'</textarea><p class="hint">متن را انتخاب و کپی کنید.</p>');sh.q('textarea').select();}
}
async function smartPdf(button,index){
 const owner=smartCurrentUser();if(!smartAccess(owner)||smartExporting)return;
 const selected=index===undefined?smartTalk:smartTalk.slice(index,index+1);if(!selected.length)return;
 const data=JSON.parse(JSON.stringify(selected)),job=smartJob;const valid=()=>smartAccess(owner)&&job===smartJob;
 smartExporting=true;button.disabled=true;const old=button.textContent;button.textContent='در حال ساخت PDF…';
 try{const logo=await loadImg('logo.png');if(!valid())return;
  const imgs=await FQChatFormat.drawPdf(data,{core:Core,createCanvas:(w,h)=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;return cv;},encode:jpegBytes,logo,valid});
  if(!valid())return;const bytes=imagesToPdf(imgs,595.28,841.89);
  await exportBinary('FixQuick-Chat-'+Date.now()+'.pdf',bytes,'application/pdf','ذخیره یا ارسال PDF گفتگو');
 }catch(e){if(valid())toast('ساخت PDF ناموفق بود: '+(e.message||e),true);}
 finally{smartExporting=false;if(button.isConnected){button.disabled=false;button.textContent=old;}}
}
function smartEditorMount(){
 smartEditorDispose?.();smartEditorDispose=null;
 const chat=$('.ui20-chat'),box=$('#fq-chat-input'),toggle=$('#fq-chat-expand'),scroll=$('.ui20-scroll');if(!chat||!box||!toggle)return;
 let normalHeight=window.visualViewport?.height||window.innerHeight,keyboardReduced=false;
 const sync=()=>{const view=chat.clientHeight||window.visualViewport?.height||window.innerHeight;chat.classList.toggle('fq-chat-expanded',smartExpanded);toggle.textContent=smartExpanded?'کوچک کردن':'بزرگ کردن';toggle.setAttribute('aria-expanded',String(smartExpanded));const max=FQChatFormat.pageLimit(Math.max(80,view-($('#fq-chat-input')?.parentElement?.querySelector('.fq-chat-compose-tools')?.offsetHeight||30)),smartExpanded);box.style.maxHeight=max+'px';box.style.height='auto';box.style.height=(smartExpanded?max:Math.min(max,Math.max(52,box.scrollHeight)))+'px';box.style.overflowY=box.scrollHeight>box.clientHeight+2?'auto':'hidden';};
 box.value=smartDraft;box.addEventListener('input',()=>{smartDraft=box.value;sync();});box.addEventListener('focus',()=>{document.body.classList.add('fq-chat-typing');requestAnimationFrame(sync);});box.addEventListener('blur',()=>{document.body.classList.remove('fq-chat-typing');requestAnimationFrame(sync);});
 toggle.disabled=box.disabled;toggle.onclick=()=>{if(box.disabled)return;smartExpanded=!smartExpanded;sync();box.focus({preventScroll:true});};
 const keyboard=$('#fq-chat-keyboard');keyboard.disabled=box.disabled;keyboard.onclick=()=>box.blur();
 const observer=typeof ResizeObserver==='function'?new ResizeObserver(()=>{if(chat.isConnected)sync();else observer.disconnect();}):null;observer?.observe(chat);
 // Visual viewport on Android may resize separately from CSS layout.
 const viewport=()=>{if(!chat.isConnected){smartEditorDispose?.();return;}const v=window.visualViewport,h=v?.height||window.innerHeight,typing=document.activeElement===box;if(!typing){normalHeight=h;keyboardReduced=false;}else{normalHeight=Math.max(normalHeight,h);const reduced=normalHeight-h>90;if(keyboardReduced&&!reduced){keyboardReduced=false;box.blur();return;}keyboardReduced=reduced;}if(typing&&v)document.body.style.setProperty('--fq-chat-view',Math.round(h)+'px');else document.body.style.removeProperty('--fq-chat-view');sync();};
 window.visualViewport?.addEventListener('resize',viewport);window.addEventListener('resize',viewport);box.addEventListener('focus',viewport);box.addEventListener('blur',viewport);
 smartEditorDispose=()=>{observer?.disconnect();window.visualViewport?.removeEventListener('resize',viewport);window.removeEventListener('resize',viewport);};sync();
}
function pageSmartAssistant(){
 smartResetForUser();
 const examples=smartDataAccess?['(۲۵۰ + ۷۵) × ۳','۷ درصد از ۴۰۰ میلیون تومان چقدر است؟','۴۰۰ میلیون تومان بدهی، ۳ ماه بدون پرداخت، سود دوره تأخیر ۷ درصد روی مانده و پس از شروع پرداخت ۵ درصد، ماهانه ۵۰ میلیون تومان، چند قسط؟','فروش این ماه نسبت به ماه قبل','چرا فروش این ماه کم شده؟','بیشترین سود کالا این ماه','چک های ۷ روز آینده','اولویت وصول مطالبات','پیش بینی نقدینگی تا آخر ماه','سرمایه راکد','پیشنهاد سفارش خرید','عملکرد سه ماه اخیر','حسابرسی','رأس‌گیری چک‌ها','محاسبه سود معامله','اقساط ۱۰۰ میلیون تومان، پیش پرداخت ۵۰ درصد، ۴ ماه، ۷ درصد ماهانه ساده','ارزش انبار']:['(۲۵۰ + ۷۵) × ۳','۷ درصد از ۴۰۰ میلیون تومان چقدر است؟','یک گوشی ۲۸۰ میلیون تومان خریدم و ۳۱۵ میلیون تومان فروختم، ۵ میلیون تومان هزینه و ۱۰ میلیون تومان تخفیف؛ سود چند درصد است؟','اقساط ۱۰۰ میلیون تومان، پیش پرداخت ۵۰ درصد، ۴ ماه، ۷ درصد ماهانه ساده'];
 const limited=!chatPaid()&&chatFreeLeft()===0;
 const history=smartTalk.length?smartTalk.map((m,i)=>'<article class="fq-msg '+(m.role==='user'?'fq-user':'fq-bot')+'"><div class="fq-chat-meta"><b>'+(m.role==='user'?'شما':'دستیار حسابداری')+'</b><time datetime="'+esc(new Date(m.at).toISOString())+'">'+esc(smartStamp(m))+'</time></div><div class="fq-chat-text">'+esc(m.text)+'</div>'+(m.source?'<small class="hint">'+esc(m.source)+'</small>':'')+(m.details?.length?'<ul>'+m.details.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'')+(m.unit&&m.unit!==Core.unit?smartMathTable(m.rows,m.unit):smartMathTable(m.rows))+(m.actions?.length?'<div class="chips wrap">'+m.actions.map(x=>'<button type="button" class="chip" data-act="go" data-h="'+esc(x.route)+'">'+esc(x.label)+'</button>').join('')+'</div>':'')+'<div class="fq-chat-actions"><button type="button" class="fq-chat-tool" data-chat-copy="'+i+'">کپی</button>'+(m.role==='assistant'?'<button type="button" class="fq-chat-tool" data-chat-pdf="'+i+'">PDF پاسخ</button>':'')+'</div></article>').join(''):'<div class="hint center">سؤال جدید خود را در حالت انتخاب‌شده بنویسید.</div>';
 const html='<section class="ui20-chat"><div class="fq-chat-top"><div class="ui2-chat-head"><div class="ch">'+ico('chat')+'دستیار آفلاین</div><span class="fq-chat-quota" aria-live="polite">'+esc(chatUsageText())+'</span><button type="button" class="fq-chat-tool" id="fq-chat-data-access" role="switch" aria-checked="'+smartDataAccess+'"'+(smartBusy?' disabled':'')+'>دسترسی به اطلاعات برنامه: '+(smartDataAccess?'روشن':'خاموش')+'</button><span class="fq-chat-quota">'+(smartDataAccess?'گزارش‌گیری از اطلاعات مجاز برنامه و محاسبه':'فقط حل مسئله؛ بدون دسترسی به انبار، چک‌ها و حساب اشخاص')+'</span><div class="fq-chat-top-actions"><button type="button" class="fq-chat-tool" id="fq-chat-pdf"'+(smartTalk.length?'':' disabled')+'>'+ico('file')+' PDF گفتگو</button><button type="button" class="fq-chat-tool" id="fq-chat-reset">'+ico('plus')+' گفت‌وگوی جدید</button></div></div></div><div class="ui20-scroll">'+
 (smartDataAccess?'<details class="ui2-chat-intro"><summary>راهنمای گزارش‌گیری</summary><p class="hint">پرسش درباره فروش، سود، کالا، اشخاص و سررسیدها؛ هیچ ثبت مالی تغییر نمی‌کند.</p></details>':'<div class="hint">محاسبه صرفاً با اعداد و توضیحات خودتان انجام می‌شود.</div>')+
 '<div id="fq-chat-history" class="fq-chat-history" aria-live="polite">'+history+(smartBusy?'<div class="fq-chat-progress" role="status">در حال محاسبه آفلاین…</div>':'')+'</div>'+
 (limited?'<div class="alert warn">سهمیه ۵۰ سؤال پایان یافته است. پاسخ‌های قبلی قابل کپی و خروجی PDF هستند؛ برای سؤال جدید فعال‌سازی کنید. این محدودیت روی ثبت اسناد اثر ندارد.<button type="button" class="btn blue" id="fq-chat-activate">فعالسازی · سالانه '+esc(License.PRICE_TEXT)+'</button></div>':'')+
 (smartTalk.length||limited||!smartDataAccess?'':'<div class="card fq-advisor-overview" id="fq-advisor-overview"><div class="ch">وضعیت هوشمند کسب‌وکار</div><div id="fq-advisor-alerts" class="hint" aria-live="polite">در حال بررسی ثبت‌های محلی…</div><button type="button" class="btn ghost" data-act="fqChatExample" data-q="گزارش مدیریت">گزارش کامل مدیریت</button></div><details class="ui20-examples"><summary>نمونه سؤال‌ها</summary><div class="chips wrap ui2-chat-examples">'+examples.map(x=>'<button type="button" class="chip" data-act="fqChatExample" data-q="'+esc(x)+'">'+esc(x)+'</button>').join('')+'</div></details>')+'</div>'+
 '<form id="fq-chat-form" class="card ui2-chat-compose"><div class="fq-chat-input-wrap"><div class="fq-chat-compose-tools"><button type="button" class="fq-chat-tool" id="fq-chat-expand" aria-expanded="false">بزرگ کردن</button><button type="button" class="fq-chat-tool" id="fq-chat-keyboard">'+ico('keyboard')+' بستن صفحه‌کلید</button></div><textarea id="fq-chat-input" class="inp" rows="1" maxlength="4000"'+(limited?' disabled':'')+' aria-label="سؤال جدید" placeholder="مسئله مالی، ریاضی یا سؤال حسابداری خود را بنویسید…" required></textarea></div><button class="btn blue" type="submit" aria-label="ارسال سؤال"'+(smartBusy||limited?' disabled':'')+'>'+ico('send')+'</button></form></section>';
 return {title:'دستیار حسابداری',html,back:'#/home',mount:()=>{
  $('#fq-chat-form').onsubmit=e=>{e.preventDefault();const box=$('#fq-chat-input');const value=box.value;if(!value.trim()||smartBusy)return;box.blur();smartAskQuestion(value);};
  $('#fq-chat-reset').onclick=async()=>{const owner=smartCurrentUser();if((smartTalk.length||smartDraft.trim())&&!await confirmBox('گفت‌وگوی فعلی و متن در حال تایپ پاک می‌شوند. ابتدا در صورت نیاز PDF بگیرید.','شروع گفت‌وگوی جدید',true))return;if(!smartAccess(owner))return;smartJob++;smartBusy=false;smartTalk=[];smartContext={};smartDraft='';smartExpanded=false;document.body.classList.remove('fq-chat-typing');render();};
  $('#fq-chat-pdf').onclick=e=>smartPdf(e.currentTarget);
  $('#fq-chat-data-access').onclick=smartToggleData;
  const activate=$('#fq-chat-activate');if(activate)activate.onclick=()=>paywall('chat');
  document.querySelectorAll('[data-chat-copy]').forEach(b=>b.onclick=()=>smartCopy(b,+b.dataset.chatCopy));document.querySelectorAll('[data-chat-pdf]').forEach(b=>b.onclick=()=>smartPdf(b,+b.dataset.chatPdf));smartEditorMount();
  const b=$('.ui20-scroll'),last=b?.querySelector('.fq-msg:last-child');if(b&&last){b.scrollTop+=last.getBoundingClientRect().top-b.getBoundingClientRect().top-4;}
  const alerts=$('#fq-advisor-alerts');if(alerts&&!limited&&typeof FQAdvisor!=='undefined'){const owner=smartCurrentUser(),valid=()=>alerts.isConnected&&owner===smartCurrentUser()&&location.hash.split('?')[0]==='#/assistant';setTimeout(async()=>{if(!valid())return;try{const r=await FQAdvisor.run('گزارش مدیریت',{},smartHandlers(valid));if(valid())alerts.innerHTML=r.details?.length?r.details.slice(0,6).map(x=>'<div class="fq-advisor-line">'+esc(x)+'</div>').join(''):esc(r.text);}catch(_){if(valid())alerts.textContent='گزارش فعلاً قابل محاسبه نیست.';}},50);}
 }};
}
async function smartAskQuestion(text){
 smartResetForUser();const q=String(text||'').trim(),owner=smartCurrentUser();if(!q||!owner||smartBusy||location.hash.split('?')[0]!=='#/assistant')return;
 if(!chatPaid()&&chatFreeLeft()===0){paywall('chat');return;}
 const permissions=smartPerms;
 const opts=()=>({today:today(),allow:permissions()});
 const context=smartContext,dataAccess=smartDataAccess,job=++smartJob,auth=JSON.stringify(permissions()),valid=()=>job===smartJob&&owner===smartCurrentUser()&&location.hash.split('?')[0]==='#/assistant'&&JSON.stringify(permissions())===auth;
 smartBusy=true;
 // Reserve once per accepted submission, including follow-up questions; automatic dashboard is not counted.
 try{if(!await chatReserve()){if(valid()){smartBusy=false;if(!chatPaid()&&chatFreeLeft()===0)paywall('chat');}return;}}catch(e){if(valid()){smartBusy=false;toast('ثبت سهمیه سؤال ناموفق بود.',true);}return;}
 if(!valid()){if(job===smartJob)smartBusy=false;return;}
 smartDraft='';smartExpanded=false;document.body.classList.remove('fq-chat-typing');document.body.style.removeProperty('--fq-chat-view');const unit=Core.unit;smartTalk.push({role:'user',text:q,at:Date.now(),unit});let out;render();
 try{await new Promise(res=>setTimeout(res,0));if(!valid())return;if(!dataAccess){out=await FQAdvisor.runMathOnly(q,context,{valid,today});}else{const h=smartHandlers(valid);out=typeof FQAdvisor!=='undefined'?await FQAdvisor.run(q,context,h):await FQReports.runSmart(q,context,h);}}
 catch(e){out={text:'گزارش کامل نشد؛ هیچ مبلغ حدسی تولید نشد.',ctx:context,details:[String(e?.message||e)],actions:[],source:'خطای گزارش'};}
 finally{if(job===smartJob)smartBusy=false;}
 if(!valid())return;
 smartContext=out.ctx||{};smartTalk.push({role:'assistant',text:out.text,details:out.details,actions:out.actions,source:out.source||'دستیار حسابداری',rows:out.rows,at:Date.now(),unit});render();
}
if(typeof window!=='undefined')window.addEventListener('hashchange',()=>{if(location.hash.split('?')[0]!=='#/assistant'){smartEditorDispose?.();smartEditorDispose=null;smartJob++;smartBusy=false;smartTalk=[];smartContext={};smartDraft='';smartExpanded=false;smartDataAccess=false;smartModeSessions={};document.body.classList.remove('fq-chat-typing');document.body.style.removeProperty('--fq-chat-view');}});

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
