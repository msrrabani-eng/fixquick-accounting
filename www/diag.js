/* Crash / error reporting — loaded before everything else, no dependencies. */
const APP_VER = '1.45';
const SUPPORT_WA = '989999917199';
const DIAG = { crumbs: [], max: 30 };
function diagLoad() { try { return JSON.parse(localStorage.getItem('fq_errlog') || '[]'); } catch (e) { return []; } }
function diagSave(l) { try { localStorage.setItem('fq_errlog', JSON.stringify(l.slice(-DIAG.max))); } catch (e) { /* ignore */ } }
function diagCrumb(s) { DIAG.crumbs.push(new Date().toTimeString().slice(0, 8) + ' ' + String(s).slice(0, 120)); if (DIAG.crumbs.length > 40) DIAG.crumbs.shift(); }
function diagLog(kind, msg, stack, extra) {
  const l = diagLoad(); l.push({ t: new Date().toISOString(), kind, msg: String(msg || '').slice(0, 500), stack: String(stack || '').slice(0, 1500), extra: extra || '', route: location.hash || '#/home', crumbs: DIAG.crumbs.slice(-12) }); diagSave(l);
}
window.addEventListener('error', e => { diagLog('error', e.message, e.error && e.error.stack, (e.filename || '').split('/').pop() + ':' + e.lineno + ':' + e.colno); });
window.addEventListener('unhandledrejection', e => { const r = e.reason || {}; diagLog('promise', r.message || r, r.stack); });
window.addEventListener('hashchange', () => diagCrumb('page ' + location.hash));
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-act],button'); if (b) diagCrumb('tap ' + (b.dataset.act || '') + ' ' + (b.textContent || '').trim().slice(0, 30)); }, true);

async function diagReport() {
  const L = [];
  L.push('گزارش خطای فیکس کوییک');
  L.push('نسخه برنامه: ' + APP_VER);
  try { const P = window.Capacitor && window.Capacitor.Plugins; if (P && P.App && P.App.getInfo) { const i = await P.App.getInfo(); L.push('نسخه نصبی: ' + i.version + ' (' + i.build + ')'); } } catch (e) { /* ignore */ }
  try { const P = window.Capacitor && window.Capacitor.Plugins; if (P && P.Device && P.Device.getInfo) { const d = await P.Device.getInfo(); L.push('دستگاه: ' + d.manufacturer + ' ' + d.model + ' / Android ' + d.osVersion); } } catch (e) { /* ignore */ }
  L.push('مرورگر: ' + navigator.userAgent);
  L.push('صفحه: ' + screen.width + 'x' + screen.height + ' · ' + (location.hash || '#/home'));
  L.push('زمان: ' + new Date().toISOString());
  try { if (typeof S !== 'undefined' && S) { L.push('آمار: اشخاص ' + S.people.length + ' · کالا ' + S.products.length + ' · فاکتور ' + S.invoices.length + ' · تراکنش ' + S.tx.length); if (typeof Core !== 'undefined' && Core.audit) { const a = Core.audit(S); L.push('بررسی سلامت: ' + (a.length ? a.length + ' مشکل — ' + a.slice(0, 5).join(' | ') : 'سالم')); } } } catch (e) { L.push('آمار: خطا ' + e.message); }
  const l = diagLoad();
  L.push('', 'خطاهای ثبت‌شده: ' + l.length);
  l.slice(-8).reverse().forEach((x, i) => { L.push('— ' + (i + 1) + ') ' + x.t + ' [' + x.kind + '] ' + x.msg); if (x.extra) L.push('   در: ' + x.extra); L.push('   صفحه: ' + x.route); if (x.stack) L.push('   ' + x.stack.split('\n').slice(0, 6).join('\n   ')); if (x.crumbs && x.crumbs.length) L.push('   قبل از خطا: ' + x.crumbs.join(' ← ')); });
  L.push('', 'آخرین کارها: ' + DIAG.crumbs.slice(-15).join(' ← '));
  return L.join('\n');
}
function diagWhatsApp(text) {
  const t = text.length > 3500 ? text.slice(0, 3500) + '\n…(ادامه در فایل)' : text;
  const u = 'https://wa.me/' + SUPPORT_WA + '?text=' + encodeURIComponent(t);
  const a = document.createElement('a'); a.href = u; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
}
function diagClear() { diagSave([]); }

// if the app never finished starting, replace the splash with a recovery screen
setTimeout(() => {
  const sp = document.getElementById('splash'); if (!sp) return;
  diagLog('startup', 'برنامه بعد از ۱۲ ثانیه بالا نیامد');
  sp.innerHTML = '<div style="max-width:360px;padding:20px;text-align:center;font-family:Tahoma,sans-serif;color:#111"><img src="logo.png" style="width:180px"><h3>برنامه درست باز نشد</h3><p style="color:#64748b;font-size:14px">لطفاً گزارش خطا را برای پشتیبانی بفرستید تا مشکل برطرف شود. اطلاعات شما پاک نشده است.</p><button id="cr-wa" style="width:100%;height:46px;border:0;border-radius:12px;background:#16a34a;color:#fff;font-weight:700;font-size:15px;margin:6px 0">ارسال گزارش در واتساپ</button><button id="cr-cp" style="width:100%;height:46px;border:1px solid #e5e7eb;border-radius:12px;background:#f1f5f9;font-weight:700;font-size:15px;margin:6px 0">کپی گزارش</button><button id="cr-re" style="width:100%;height:46px;border:0;border-radius:12px;background:#2563eb;color:#fff;font-weight:700;font-size:15px;margin:6px 0">تلاش دوباره</button></div>';
  document.getElementById('cr-wa').onclick = async () => diagWhatsApp(await diagReport());
  document.getElementById('cr-cp').onclick = async () => { try { await navigator.clipboard.writeText(await diagReport()); alert('گزارش کپی شد.'); } catch (e) { alert('کپی نشد.'); } };
  document.getElementById('cr-re').onclick = () => location.reload();
}, 12000);