/* Optional update discovery only: never uploads accounting data, never silently installs. */
'use strict';
const FQUpdate=(()=>{
 const defaultUrl='https://fixq.ir/accounting-updates/update.json';
 const githubUrl='https://api.github.com/repos/msrrabani-eng/fixquick-accounting/releases/latest';
 const validVersion=s=>typeof s==='string'&&/^\d{1,5}(\.\d{1,5}){1,3}$/.test(s);
 const https=s=>{try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash;}catch(_){return false;}};
 function compare(a,b){if(!validVersion(a)||!validVersion(b))throw Error('نسخه نامعتبر');let x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<Math.max(x.length,y.length);i++){let d=(x[i]||0)-(y[i]||0);if(d)return Math.sign(d);}return 0;}
 function parse(data,source){
  if(!https(source)||!data||typeof data!=='object')throw Error('پاسخ نسخه نامعتبر');
  let version,download,build=0;
  if(source===githubUrl){
   if(data.draft||data.prerelease)throw Error('نسخه آزمایشی');
   const m=String(data.name||'').match(/^Fix Quick Accounting (\d+(?:\.\d+)+) \(build (\d+)\)$/);
   if(!m)throw Error('عنوان نسخه نامعتبر');
   version=m[1];build=Number(m[2]);
   const asset=(data.assets||[]).find(a=>a.name==='FixQuick-Accounting.apk');
   if(!asset||asset.browser_download_url!=='https://github.com/msrrabani-eng/fixquick-accounting/releases/download/latest/FixQuick-Accounting.apk')throw Error('فایل رسمی موجود نیست');
   download='https://github.com/msrrabani-eng/fixquick-accounting/releases/download/v'+version+'-build'+build+'/FixQuick-Accounting-'+version+'-build'+build+'.apk';
  }else{
   version=data.version;build=data.build||0;download=data.downloadUrl;
   if(!https(download)||new URL(download).origin!==new URL(source).origin)throw Error('فایل باید HTTPS و روی همان دامنه باشد.');
  }
  if(!validVersion(version)||!https(download)||!Number.isSafeInteger(build)||build<0)throw Error('اطلاعات نسخه نامعتبر');
  return {version,build,download};
 }
 return {defaultUrl,githubUrl,https,compare,parse};
})();
if(typeof module==='object'&&module.exports)module.exports=FQUpdate;
let updateInfo=null,updateBusy=false,lastUpdateCheck=0,updateMessage='';
const getUpdateSource=()=>{try{const saved=localStorage.getItem('fq_update_source');return saved&&saved!==FQUpdate.githubUrl?saved:FQUpdate.defaultUrl;}catch(_){return FQUpdate.defaultUrl;}};
function paintUpdateNotice(){
 const main=document.querySelector('#main');if(!main)return;
 main.querySelector('#fq-update-notice')?.remove();
 if(main.dataset.page!=='home'||!updateInfo)return;
 const d=document.createElement('div');d.id='fq-update-notice';d.className='alert fq-update-notice';d.innerHTML='<b>نسخه جدید '+esc(updateInfo.version)+' موجود است</b><button class="lnk" data-act="go" data-h="#/updates">مشاهده و دانلود</button>';main.prepend(d);
}
async function fetchUpdate(source){
 if(!FQUpdate.https(source))throw Error('لینک HTTPS لازم است.');
 const url=new URL(source);
 if(source===FQUpdate.defaultUrl)url.searchParams.set('_',Date.now());
 const headers={Accept:'application/json'};
 const native=window.Capacitor?.Plugins?.CapacitorHttp;
 if(isNative()&&native?.get){
  const r=await native.get({url:url.href,headers,connectTimeout:8000,readTimeout:8000});
  if(r.status!==200)throw Error('HTTP '+r.status);
  return FQUpdate.parse(typeof r.data==='string'?JSON.parse(r.data):r.data,source);
 }
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),8000);
 try{
  const r=await fetch(url.href,{headers,cache:'no-store',credentials:'omit',signal:ctrl.signal});
  if(!r.ok)throw Error('HTTP '+r.status);
  return FQUpdate.parse(await r.json(),source);
 }finally{clearTimeout(timer);}
}
async function updateCheck(manual=false){
 if(updateBusy||(!manual&&Date.now()-lastUpdateCheck<30*60e3))return;
 updateBusy=true;lastUpdateCheck=Date.now();updateMessage='در حال بررسی…';const source=getUpdateSource();
 try{
  const latest=await fetchUpdate(source).catch(error=>{
   if(source!==FQUpdate.defaultUrl)throw error;
   return fetchUpdate(FQUpdate.githubUrl);
  });
  if(source!==getUpdateSource())return;
  let build=0;try{const info=await window.Capacitor?.Plugins?.App?.getInfo();const v=Number(info?.build);if(v>=100000)build=v-100000;}catch(_){}
  const cmp=FQUpdate.compare(latest.version,APP_VER);updateInfo=cmp>0||cmp===0&&build>0&&latest.build>build?latest:null;
  updateMessage=updateInfo?'نسخه جدید آماده دریافت است.':'نسخه نصب‌شده به‌روز است.';
 }catch(_){updateMessage='بررسی نسخه انجام نشد؛ اتصال اینترنت یا لینک انتشار را بررسی کنید.';}
 finally{updateBusy=false;paintUpdateNotice();drawUpdateStatus();}
}
function drawUpdateStatus(){const el=document.querySelector('#fq-update-status');if(!el)return;el.innerHTML='<p class="hint">'+esc(updateMessage||'برای بررسی دستی دکمه زیر را بزنید.')+'</p>'+(updateInfo?'<div class="alert good"><b>نسخه '+esc(updateInfo.version)+'</b><p>برنامه قبلی را حذف نکنید. پس از پشتیبان‌گیری، فایل جدید را روی همان برنامه نصب کنید.</p><a class="btn blue fq-update-download" target="_blank" rel="noopener noreferrer" href="'+esc(updateInfo.download)+'">دانلود فایل APK</a></div>':'');}
function pageUpdates(){
 const admin=isAdmin(),source=getUpdateSource();
 return {title:'به‌روزرسانی برنامه',back:'#/support',html:'<div class="card"><div class="kv"><span>نسخه فعلی</span><b>'+esc(APP_VER)+'</b></div><div id="fq-update-status"></div><button class="btn ghost" id="fq-update-check">بررسی نسخه جدید</button></div>'+(admin?'<form class="card" id="fq-update-config"><label class="fld"><span>لینک JSON نسخه جدید (HTTPS)</span><input class="inp ltr" name="url" type="url" value="'+esc(source)+'"></label><p class="hint">مسیر رسمی: سایت فیکس‌کوییک. اگر سایت پاسخ ندهد، برنامه انتشار رسمی GitHub را بررسی می‌کند. برای سایت اختصاصی، فایل JSON با version و downloadUrl و در صورت نیاز build منتشر کنید. فایل APK باید روی همان دامنه باشد.</p><button class="btn blue" type="submit">ذخیره مسیر</button><button class="btn ghost" id="fq-update-default" type="button">بازگشت به مسیر رسمی</button></form>':'')+'<p class="hint">بررسی خودکار هنگام اجرای برنامه یا بازگشت به آن، با اینترنت؛ نصب با تأیید کاربر و امضای ثابت اندروید انجام می‌شود. اطلاعات حسابداری ارسال نمی‌شود.</p>',mount(){
 drawUpdateStatus();$('#fq-update-check').onclick=()=>{updateCheck(true);drawUpdateStatus();};
 const form=$('#fq-update-config');if(form){form.onsubmit=e=>{e.preventDefault();if(!isAdmin())return;const url=form.elements.namedItem('url').value.trim();if(!FQUpdate.https(url))return toast('فقط لینک معتبر HTTPS.',true);try{localStorage.setItem('fq_update_source',url);updateInfo=null;updateMessage='';lastUpdateCheck=0;updateCheck(true);drawUpdateStatus();}catch(_){toast('ذخیره مسیر ناموفق.',true);}};$('#fq-update-default').onclick=()=>{if(!isAdmin())return;localStorage.removeItem('fq_update_source');updateInfo=null;updateMessage='';lastUpdateCheck=0;render();updateCheck(true);};}
 }};
}
function startUpdateChecks(){setTimeout(()=>updateCheck(),3500);window.addEventListener('online',()=>updateCheck());document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateCheck();});}
