/* UI foundation: storage, helpers, sheets, pickers, share/export */
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = Core.fmt, fmtDate = Core.fmtDate, fa = Core.toFa;
const isNative = () => { const C = window.Capacitor; if (!C) return false; if (C.isNativePlatform) return !!C.isNativePlatform(); if (C.getPlatform) return C.getPlatform() !== 'web'; return !!(C.Plugins && C.Plugins.Filesystem); };

/* ── storage (IndexedDB, one JSON document) ── */
let S = Core.emptyState();
function idb() { return new Promise((res, rej) => { const r = indexedDB.open('fixquick-acc', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function kvGet(k) { const db = await idb(); return new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
async function kvSet(k, v) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); }
let saveChain = Promise.resolve(), lastPrev = 0;
function save() {
  const json = JSON.stringify(S);
  saveChain = saveChain.then(async () => {
    if (Date.now() - lastPrev > 3600e3) { lastPrev = Date.now(); const prev = await kvGet('state'); if (prev) await kvSet('state_prev', prev); }
    await kvSet('state', json);
  }).catch(e => { toast('ذخیره‌سازی ناموفق بود: ' + (e && e.message || e), true); });
  return saveChain;
}
async function loadState() {
  let raw = null; try { raw = await kvGet('state'); } catch (e) { /* ignore */ }
  if (raw) { try { const o = JSON.parse(raw); const base = Core.emptyState(); S = Object.assign(base, o); S.settings = Object.assign(base.settings, o.settings || {}); applyAppearance(S.settings); return; } catch (e) { /* fall through to prev */ } }
  try { const prev = await kvGet('state_prev'); if (prev) { S = Object.assign(Core.emptyState(), JSON.parse(prev)); toast('اطلاعات از نسخه پشتیبان خودکار بازیابی شد.'); } } catch (e) { /* new */ }
}

// focus a field shortly after a sheet opens, unless the user already focused something inside it
function autoFocus(get) { setTimeout(() => { const el = get(); if (!el || !el.isConnected) return; const w = el.closest('.sheet-wrap'); const a = document.activeElement; if (a && a !== document.body && (!w || w.contains(a))) return; el.focus(); }, 60); }
/* ── toast ── */
let toastT;
function toast(msg, bad) {
  let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.className = 'show' + (bad ? ' bad' : ''); clearTimeout(toastT); toastT = setTimeout(() => t.className = '', bad ? 4200 : 2200);
}

/* ── sheets ── */
const sheetStack = [];
// One history entry ("guard") represents "some sheet is open", so the Android back button closes sheets first.
let guard = false, popByCode = 0, pendingBack = false;
function pushGuard() { if (guard) return; try { history.pushState({ fqSheet: 1 }, '', location.href); guard = true; } catch (e) { /* ignore */ } }
function sheet(title, html, o) {
  o = o || {};
  const wrap = document.createElement('div'); wrap.className = 'sheet-wrap';
  wrap.innerHTML = '<div class="sheet' + (o.tall ? ' tall' : '') + '" role="dialog" aria-modal="true"><div class="sheet-h"><b>' + esc(title) + '</b><button class="x" type="button" data-close aria-label="بستن">✕</button></div><div class="sheet-b">' + html + '</div></div>';
  document.body.appendChild(wrap); document.body.classList.add('noscroll');
  let closed = false;
  const api = {
    el: wrap, o, q: s => $(s, wrap), qa: s => $$(s, wrap),
    remove() { if (closed) return; closed = true; wrap.remove(); const i = sheetStack.indexOf(api); if (i >= 0) sheetStack.splice(i, 1); if (!sheetStack.length) document.body.classList.remove('noscroll'); },
    close(silent) {
      if (closed) return; api.remove();
      if (!sheetStack.length && guard && !pendingBack) {
        pendingBack = true; // deferred: another sheet may open right away (picker → form)
        setTimeout(() => { pendingBack = false; if (!sheetStack.length && guard) { guard = false; popByCode++; history.back(); } }, 0);
      }
      if (!silent && o.onClose) o.onClose();
    }
  };
  sheetStack.push(api); pushGuard();
  wrap.addEventListener('click', e => { if ((e.target === wrap && !o.lock) || e.target.closest('[data-close]')) api.close(); });
  return api;
}
// navigate only after any pending history.back() has settled
function goHash(h) {
  const run = () => { if (location.hash === h) render(); else location.hash = h; };
  if (!pendingBack && popByCode <= 0) return run();
  let n = 0; const w = () => { if ((!pendingBack && popByCode <= 0) || n++ > 60) run(); else setTimeout(w, 10); }; setTimeout(w, 10);
}
window.addEventListener('popstate', () => {
  if (popByCode > 0) { popByCode--; return; }
  if (!guard) return; // ordinary page navigation
  guard = false; const top = sheetStack[sheetStack.length - 1]; if (!top) return;
  if (top.o.lock) { pushGuard(); return; }
  top.remove(); if (top.o.onClose) top.o.onClose();
  if (sheetStack.length) pushGuard();
});
function confirmBox(msg, label, danger) {
  return new Promise(res => {
    const sh = sheet('تأیید', '<p class="msg">' + esc(msg) + '</p><div class="row2"><button class="btn ' + (danger ? 'red' : 'blue') + '" data-yes>' + esc(label || 'تأیید') + '</button><button class="btn ghost" data-close>انصراف</button></div>', { onClose: () => res(false) });
    sh.q('[data-yes]').onclick = () => { sh.close(true); res(true); };
  });
}
function alertBox(title, html) { const sh = sheet(title, '<div class="msg">' + html + '</div><button class="btn blue" data-close style="margin-top:12px">باشه</button>'); return sh; }

/* ── generic searchable picker ── */
function pickList(title, items, onPick, o) {
  o = o || {};
  const sh = sheet(title, '<input class="inp" id="pk-s" placeholder="جستجو…" autocomplete="off">' + (o.addNew ? '<button class="btn ghost" id="pk-new" type="button">+ ' + esc(o.addNew) + '</button>' : '') + '<div class="list" id="pk-l"></div>', { tall: true });
  const draw = () => {
    const q = Core.toEn(sh.q('#pk-s').value).trim().toLowerCase();
    const f = items.filter(i => !q || (i.label + ' ' + (i.sub || '')).toLowerCase().includes(q));
    sh.q('#pk-l').innerHTML = f.length ? f.map(i => '<button type="button" class="item" data-v="' + esc(i.value) + '"><span>' + esc(i.label) + (i.sub ? '<small>' + esc(i.sub) + '</small>' : '') + '</span>' + (i.right ? '<em class="' + (i.cls || '') + '">' + esc(i.right) + '</em>' : '') + '</button>').join('') : '<div class="empty">موردی پیدا نشد</div>';
  };
  draw(); sh.q('#pk-s').addEventListener('input', draw);
  sh.q('#pk-l').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; sh.close(); onPick(b.dataset.v); });
  if (o.addNew) sh.q('#pk-new').onclick = () => { sh.close(); o.onAdd(); };
  if (items.length > 12) autoFocus(() => sh.q('#pk-s')); // avoid popping the keyboard for short lists
  return sh;
}
const personItems = (o) => S.people.filter(p => !p.archived || (o && o.all)).map(p => { const b = Core.balanceOf(S, p.id); return { value: p.id, label: p.name, sub: p.phone, right: b ? fmt(Math.abs(b)) + (b > 0 ? ' بد' : ' بس') : '', cls: b > 0 ? 'debit' : 'credit' }; }).sort((a, b) => a.label.localeCompare(b.label, 'fa'));

/* ── Jalali date picker ── */
function datePick(iso, cb) {
  let { jy, jm } = Core.isoToParts(Core.validIso(iso) ? iso : Core.todayISO()); const sel = Core.validIso(iso) ? iso : Core.todayISO(); const today = Core.todayISO();
  const sh = sheet('انتخاب تاریخ', '<div class="cal-h"><button type="button" class="btn ghost sm" data-m="-1" aria-label="ماه قبل">▶</button><b id="cal-t"></b><button type="button" class="btn ghost sm" data-m="1" aria-label="ماه بعد">◀</button></div><div class="cal-w">' + ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map(x => '<span>' + x + '</span>').join('') + '</div><div class="cal-g" id="cal-g"></div><div class="row2" style="margin-top:10px"><button type="button" class="btn blue" data-today>امروز</button><button type="button" class="btn ghost" data-close>بستن</button></div>');
  const draw = () => {
    sh.q('#cal-t').textContent = Core.MONTHS[jm - 1] + ' ' + fa(jy); const first = Core.partsToIso(jy, jm, 1), off = Core.weekdayIdx(first), len = Core.monthLenJ(jy, jm); let h = '';
    for (let i = 0; i < off; i++) h += '<i></i>';
    for (let d = 1; d <= len; d++) { const iso2 = Core.partsToIso(jy, jm, d); h += '<button type="button" data-d="' + iso2 + '" class="' + (iso2 === sel ? 'sel ' : '') + (iso2 === today ? 'tod' : '') + '">' + fa(d) + '</button>'; }
    sh.q('#cal-g').innerHTML = h;
  };
  draw();
  sh.el.addEventListener('click', e => {
    const m = e.target.closest('[data-m]'); if (m) { jm += +m.dataset.m; if (jm > 12) { jm = 1; jy++; } if (jm < 1) { jm = 12; jy--; } draw(); return; }
    const d = e.target.closest('[data-d]'); if (d) { sh.close(); cb(d.dataset.d); return; }
    if (e.target.closest('[data-today]')) { sh.close(); cb(today); }
  });
}
function dateField(name, iso, label) {
  return '<label class="fld"><span>' + esc(label || 'تاریخ') + '</span><div class="date"><input class="inp" name="' + name + '" data-date inputmode="numeric" autocomplete="off" value="' + esc(fa(Core.isoToJalali(iso))) + '" placeholder="۱۴۰۵/۰۱/۰۱"><button type="button" class="cal-btn" data-pickdate aria-label="تقویم">📅</button></div></label>';
}
function moneyField(name, val, label, ph) {
  return '<label class="fld"><span>' + esc(label) + '</span><input class="inp ltr" name="' + name + '" data-money inputmode="numeric" autocomplete="off" placeholder="' + esc(ph || '۰') + '" value="' + (val ? fmt(val) : '') + '"></label>';
}
function readDate(root, name) { const i = $('[name="' + name + '"]', root); return Core.jalaliToIso(i.value); }
function readMoney(root, name) { const i = $('[name="' + name + '"]', root); return i.value.trim() === '' ? 0 : Core.parseMoney(i.value); }

// global input helpers: live thousands grouping + calendar button
document.addEventListener('input', e => {
  const i = e.target; if (!(i instanceof HTMLInputElement)) return;
  if (i.hasAttribute('data-money')) {
    const raw = Core.toEn(i.value).replace(/[^\d.]/g, ''); if (raw === '') { i.value = ''; return; }
    const parts = raw.split('.'); const g = Core.group(parts[0] === '' ? 0 : +parts[0]); i.value = fa(g) + (parts.length > 1 ? '.' + parts[1] : '');
  }
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-pickdate]'); if (!b) return; const inp = $('[data-date]', b.parentElement);
  datePick(Core.jalaliToIso(inp.value) || Core.todayISO(), iso => { inp.value = fa(Core.isoToJalali(iso)); inp.dispatchEvent(new Event('change', { bubbles: true })); });
});
document.addEventListener('blur', e => { const i = e.target; if (i instanceof HTMLInputElement && i.hasAttribute('data-date')) { const iso = Core.jalaliToIso(i.value); i.classList.toggle('bad', !!i.value && !iso); if (iso) i.value = fa(Core.isoToJalali(iso)); } }, true);

/* ── export / share ── */
async function exportFile(name, text, mime) {
  const P = window.Capacitor && window.Capacitor.Plugins;
  if (isNative() && P && P.Filesystem && P.Share) {
    try {
      const w = await P.Filesystem.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' });
      await P.Share.share({ title: name, url: w.uri, dialogTitle: 'ذخیره / ارسال فایل' }); return true;
    } catch (e) { if (e && /cancel/i.test(String(e.message || e))) return false; toast('خطا در ساخت فایل: ' + (e.message || e), true); return false; }
  }
  if (isNative()) { const sh = sheet(name, '<p class="hint">ذخیره مستقیم فایل در این دستگاه ممکن نشد. متن زیر را کپی کنید و در یک فایل یا پیام برای خودتان نگه دارید.</p><textarea class="inp" style="height:40vh;direction:ltr;font-size:11px" readonly>' + esc(text) + '</textarea><button class="btn blue" data-copy>کپی</button>'); sh.q('[data-copy]').onclick = async () => { try { await navigator.clipboard.writeText(text); toast('کپی شد.'); } catch (e) { sh.q('textarea').select(); document.execCommand('copy'); toast('کپی شد.'); } }; return true; }
  const blob = new Blob([text], { type: mime || 'application/octet-stream' }); const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); return true;
}
async function exportBinary(name, bytes, mime) {
  const P = window.Capacitor && window.Capacitor.Plugins;
  if (isNative() && P && P.Filesystem && P.Share) {
    try {
      let s = ''; for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
      const w = await P.Filesystem.writeFile({ path: name, data: btoa(s), directory: 'CACHE' });
      await P.Share.share({ title: name, url: w.uri, dialogTitle: 'چاپ یا ذخیره فاکتور' }); return true;
    } catch (e) { if (e && /cancel/i.test(String(e.message || e))) return false; toast('خطا در ساخت فایل: ' + (e.message || e), true); return false; }
  }
  const blob = new Blob([bytes], { type: mime || 'application/octet-stream' }), u = URL.createObjectURL(blob);
  if (!window.open(u, '_blank')) { const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
  setTimeout(() => URL.revokeObjectURL(u), 60000); return true;
}
async function shareText(text, title) {
  const P = window.Capacitor && window.Capacitor.Plugins;
  try {
    if (isNative() && P && P.Share) { await P.Share.share({ title: title || 'فیکس کوییک', text, dialogTitle: 'اشتراک‌گذاری' }); return; }
    if (navigator.share) { await navigator.share({ title: title || 'فیکس کوییک', text }); return; }
    await navigator.clipboard.writeText(text); toast('متن کپی شد.');
  } catch (e) { if (e && e.name === 'AbortError') return; try { await navigator.clipboard.writeText(text); toast('متن کپی شد.'); } catch (e2) { alertBox('متن', '<pre class="pre">' + esc(text) + '</pre>'); } }
}
const csvFile = rows => '﻿' + Core.csv(rows);
const stamp = () => Core.isoToJalali(Core.todayISO()).replace(/\//g, '');

/* ── result handler ── */
async function done(r, okMsg) { if (!r.ok) { toast(r.error, true); return false; } await save(); if (okMsg) toast(okMsg); render(); return true; }
/* ── appearance (theme / accent / font size) ── */
const ACCENTS = { blue: ['#2563eb', '#1d4ed8', 'آبی'], green: ['#16a34a', '#15803d', 'سبز'], purple: ['#7c3aed', '#6d28d9', 'بنفش'], orange: ['#ea580c', '#c2410c', 'نارنجی'], red: ['#dc2626', '#b91c1c', 'قرمز'], teal: ['#0d9488', '#0f766e', 'فیروزه‌ای'] };
const FS_MIN = 0.8, FS_MAX = 1.5;
function applyAppearance(s) {
  s = s || {}; const r = document.documentElement, th = s.theme === 'light' || s.theme === 'dark' ? s.theme : 'auto';
  if (th === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', th);
  const a = ACCENTS[s.accent] || ACCENTS.blue; r.style.setProperty('--blue', a[0]); r.style.setProperty('--blue2', a[1]);
  const fs = Math.min(FS_MAX, Math.max(FS_MIN, Number(s.fontScale) || 1)); r.style.setProperty('--fs', String(fs));
  const dark = th === 'dark' || (th === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme:dark)').matches);
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = dark ? '#0a0f1a' : '#111827';
  try { localStorage.setItem('fq_look', JSON.stringify({ theme: th, accent: s.accent || 'blue', fontScale: fs })); } catch (e) { /* ignore */ }
}
try { applyAppearance(JSON.parse(localStorage.getItem('fq_look') || '{}')); } catch (e) { /* ignore */ }
function sign(b) { return b > 0 ? 'طلب من' : b < 0 ? 'بدهی من' : 'تسویه'; }
function bal(b) { return '<span class="' + (b > 0 ? 'debit' : b < 0 ? 'credit' : 'zero') + '">' + fmt(Math.abs(b)) + '</span>'; }
