/* UI foundation: storage, helpers, sheets, pickers, share/export */
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = Core.fmt, fmtDate = Core.fmtDate, fa = Core.toFa;
const UNIT = () => Core.unitName();
const DESK = !!(window.fqDesktop && window.fqDesktop.platform), DEV = DESK ? 'کامپیوتر' : 'گوشی'; // Windows version or phone
const isNative = () => { const C = window.Capacitor; if (!C) return false; if (C.isNativePlatform) return !!C.isNativePlatform(); if (C.getPlatform) return C.getPlatform() !== 'web'; return !!(C.Plugins && C.Plugins.Filesystem); };

/* ── storage (IndexedDB, one JSON document) ── */
let S = Core.emptyState();
S.settings.serialCoreStrict = true;
function idb() { return new Promise((res, rej) => { const r = indexedDB.open('fixquick-acc', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function kvGet(k) { const db = await idb(); return new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
async function kvSet(k, v) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); }
let saveChain = Promise.resolve(), lastPrev = 0;
let dataVer = 0, storageReady = false, storageFault = false;
// Serialize each requested snapshot. A later save must not get lost while an earlier IndexedDB write is pending.
function save() {
  if (!storageReady || storageFault) { toast('ذخیره غیرفعال است؛ اطلاعات قبلی را بررسی کنید و از آن پشتیبان بگیرید.', true); return Promise.resolve(false); }
  dataVer++;
  let json;
  try { json = JSON.stringify(S); } catch (e) { toast('خطا در آماده‌سازی ذخیره: ' + (e.message || e), true); return Promise.resolve(false); }
  const job = saveChain.then(async () => {
    if (storageFault) return false;
    if (Date.now() - lastPrev > 3600e3) {
      const prev = await kvGet('state');
      if (prev) await kvSet('state_prev', prev);
      lastPrev = Date.now();
    }
    await kvSet('state', json);
    return true;
  }).catch(e => {
    storageFault = true;
    toast('ذخیره‌سازی ناموفق بود. هیچ تأیید ذخیره‌ای معتبر نیست: ' + (e && e.message || e), true);
    return false;
  });
  saveChain = job.then(() => undefined);
  return job;
}
async function loadState() {
  // Never silently initialise an empty file after IndexedDB read/parse failure.
  const raw = await kvGet('state');
  if (raw != null) {
    let o;
    try { o = JSON.parse(raw); } catch (e) { throw new Error('فایل اطلاعات قبلی قابل خواندن نیست. ذخیره جدید مسدود شد.'); }
    if (!o || typeof o !== 'object' || !['people', 'products', 'invoices', 'tx', 'expenses', 'cheques', 'adjusts'].every(k => Array.isArray(o[k]))) {
      throw new Error('ساختار فایل اطلاعات قبلی ناقص است. برای جلوگیری از حذف، ذخیره جدید مسدود شد.');
    }
    // One exact, immutable snapshot of the pre-upgrade JSON. No changes to the original state key.
    const guardKey = 'state_pre_vol002';
    if (!(await kvGet(guardKey))) await kvSet(guardKey, raw);
    const base = Core.emptyState();
    S = Object.assign(base, o);
    S.settings = Object.assign(base.settings, o.settings || {});
    Core.migrate(S); S.settings.serialCoreStrict = true; applySettings(S.settings);
  } else {
    // If the main record has vanished but a previous copy exists, never overwrite it with an empty file.
    if (await kvGet('state_prev')) throw new Error('فایل اصلی پیدا نشد، اما نسخه قبلی موجود است. ذخیره خودکار مسدود شد.');
  }
  storageReady = true;
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
  enhanceMoney(wrap);
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
const faColl = (window.Intl && Intl.Collator) ? new Intl.Collator('fa', { numeric: true }) : null;
function faCmp(a, b) { return faColl ? faColl.compare(a, b) : String(a).localeCompare(String(b), 'fa'); }
/* search: Persian/English digits, Arabic ي/ك, half-space and word order don't matter */
function normQ(s) { return Core.norm(s); }
function matchQ(text, q) { const t = normQ(text), w = normQ(q).split(' ').filter(Boolean); return w.every(x => t.includes(x)) || Core.matchScore(text, q) > 0; }
function pickList(title, items, onPick, o) {
  o = o || {};
  // optional category chips (items carry .cat); the last chosen category is remembered
  let cat = '', cats = [];
  if (o.cats) { const m = new Map(); items.forEach(i => m.set(i.cat, (m.get(i.cat) || 0) + 1)); cats = [...m.entries()].sort((a, b) => Core.catRank(a[0]) - Core.catRank(b[0]) || faCmp(a[0], b[0])); cat = UI.pickCat && m.has(UI.pickCat) ? UI.pickCat : ''; }
  const TOP = '__top', top = (o.top || []).map(String); if (top.length) { cats.unshift([TOP, top.length]); cat = TOP; }
  const chipRow = () => cats.length > 1 || top.length ? '<div class="chips cats" id="pk-c">' + [['', items.length]].concat(cats).map(c => '<button type="button" class="chip' + (c[0] === cat ? ' on' : '') + (c[0] === TOP ? ' top' : '') + '" data-c="' + esc(c[0]) + '">' + esc(c[0] === TOP ? '★ ' + (o.topLabel || 'پرتکرارها') : c[0] || 'همه') + ' <i>' + Core.toFa(c[1]) + '</i></button>').join('') + '</div>' : '';
  const sh = sheet(title, '<input class="inp" id="pk-s" placeholder="جستجو…" autocomplete="off">' + (o.addNew ? '<button class="btn ghost" id="pk-new" type="button">+ ' + esc(o.addNew) + '</button>' : '') + '<div id="pk-cw">' + chipRow() + '</div><div class="list" id="pk-l"></div>', { tall: true });
  const draw = () => {
    const q = sh.q('#pk-s').value.trim();
    let all = items.filter(i => (!cat || (q && cat === TOP) || (cat === TOP ? top.includes(String(i.value)) : i.cat === cat)) && (!q || matchQ(i.label + ' ' + (i.sub || '') + ' ' + (i.cat || ''), q)));
    if (cat === TOP) all.sort((a, b) => top.indexOf(String(a.value)) - top.indexOf(String(b.value)));
    else if (q) { const sc = new Map(all.map(i => [i, Core.matchScore(i.label + ' ' + (i.sub || '') + ' ' + (i.cat || ''), q)])); all.sort((a, b) => sc.get(b) - sc.get(a)); }
    const f = all.slice(0, 80);
    let last = null;
    sh.q('#pk-l').innerHTML = (all.length > f.length ? '<p class="hint center">' + Core.toFa(all.length) + ' مورد؛ برای پیدا کردن سریع‌تر، جستجو کنید یا دسته را انتخاب کنید.</p>' : '') + (f.length ? f.map(i => '<button type="button" class="item" data-v="' + esc(i.value) + '"><span>' + esc(i.label) + (i.sub || (o.cats && !cat && i.cat) ? '<small>' + esc([o.cats && !cat ? i.cat : '', i.sub].filter(Boolean).join(' · ')) + '</small>' : '') + '</span>' + (i.right ? '<em class="' + (i.cls || '') + '">' + esc(i.right) + '</em>' : '') + '</button>').join('') : '<div class="empty">موردی پیدا نشد</div>');
  };
  draw(); let dt; sh.q('#pk-s').addEventListener('input', () => { clearTimeout(dt); dt = setTimeout(draw, 150); });
  sh.q('#pk-cw').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (!b) return; cat = b.dataset.c; if (cat !== TOP) UI.pickCat = cat; sh.q('#pk-cw').innerHTML = chipRow(); draw(); });
  sh.q('#pk-l').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; sh.close(); onPick(b.dataset.v); });
  if (o.addNew) sh.q('#pk-new').onclick = () => { sh.close(); o.onAdd(); };
  if (items.length > 12 && !cats.length) autoFocus(() => sh.q('#pk-s')); // avoid popping the keyboard for short lists (and when categories are offered)
  return sh;
}
const personItems = (o) => { const bal = Core.balances(S); return S.people.filter(p => !p.archived || (o && o.all)).map(p => { const b = bal[p.id] || 0; return { value: p.id, label: p.name, sub: [p.code ? 'کد ' + p.code : '', p.phone].filter(Boolean).join(' · '), right: b ? fmt(Math.abs(b)) + (b > 0 ? ' بد' : ' بس') : '', cls: b > 0 ? 'debit' : 'credit' }; }).sort((a, b) => faCmp(a.label, b.label)); };

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
  return '<label class="fld"><span>' + esc(label || 'تاریخ') + '</span><div class="date"><input class="inp" name="' + name + '" data-date inputmode="numeric" autocomplete="off" value="' + esc(fa(Core.isoToJalali(iso))) + '" placeholder="۱۴۰۵/۰۱/۰۱"><button type="button" class="cal-btn" data-pickdate aria-label="تقویم">' + ico('calendar') + '</button></div></label>';
}
function moneyField(name, val, label, ph) {
  return '<label class="fld"><span>' + esc(label) + '</span><input class="inp ltr" name="' + name + '" data-money inputmode="numeric" autocomplete="off" placeholder="' + esc(ph || '۰') + '" value="' + (val ? Core.fmtInput(val) : '') + '"></label>';
}
/* money boxes: amount in words underneath (in the unit chosen in settings) + a «۰۰۰» key while typing */
function mwUpdate(i) { const m = i && i._mw; if (!m) return; const raw = i.value.trim(), v = raw ? Core.parseMoney(i.value) : 0; m.textContent = raw && !isNaN(v) && v > 0 ? Core.moneyWords(v) : ''; }
function enhanceMoney(root) {
  (root || document).querySelectorAll('input[data-money]').forEach(i => {
    if (i._mw) { mwUpdate(i); return; }
    const w = document.createElement('span'); w.className = 'mwrap'; i.parentNode.insertBefore(w, i); w.appendChild(i);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'z3'; b.tabIndex = -1; b.textContent = '000'; b.setAttribute('aria-label', 'افزودن سه صفر'); w.appendChild(b);
    const m = document.createElement('small'); m.className = 'mw'; i._mw = m;
    const row = i.closest('.it-row'); if (row && $('.fld.sn', row)) row.insertBefore(m, $('.fld.sn', row)); else w.after(m);
    mwUpdate(i);
  });
}
// the «۰۰۰» key keeps the keyboard open and adds three zeros where the cursor is
document.addEventListener('pointerdown', e => { if (e.target.closest && e.target.closest('.z3')) e.preventDefault(); }, true);
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('.z3'); if (!b) return; e.preventDefault();
  const i = b.parentNode.querySelector('input'); if (!i) return; const v = i.value, raw = Core.toEn(v).replace(/[^\d.]/g, '');
  if (!raw || /^0+$/.test(raw)) { i.focus(); return; }
  let pos = i.selectionStart == null ? v.length : i.selectionStart; const digitsBefore = Core.toEn(v.slice(0, pos)).replace(/[^\d.]/g, '').length;
  const nr = raw.slice(0, digitsBefore) + '000' + raw.slice(digitsBefore); i.value = nr; i.dispatchEvent(new Event('input', { bubbles: true }));
  // put the cursor right after the inserted zeros
  let cnt = 0, at = i.value.length; const target = digitsBefore + 3; for (let k = 0; k < i.value.length; k++) { if (/[\d۰-۹.]/.test(i.value[k])) cnt++; if (cnt === target) { at = k + 1; break; } }
  i.focus(); try { i.setSelectionRange(at, at); } catch (x) { /* ignore */ }
});
function readDate(root, name) { const i = $('[name="' + name + '"]', root); return Core.jalaliToIso(i.value); }
function readMoney(root, name) { const i = $('[name="' + name + '"]', root); return i.value.trim() === '' ? 0 : Core.parseMoney(i.value); }

// global input helpers: live thousands grouping + calendar button
document.addEventListener('input', e => {
  const i = e.target; if (!(i instanceof HTMLInputElement)) return;
  if (i.hasAttribute('data-money')) {
    const raw = Core.toEn(i.value).replace(/[^\d.]/g, ''); if (raw === '') { i.value = ''; return; }
    const parts = raw.split('.'); const g = Core.group(parts[0] === '' ? 0 : +parts[0]); i.value = fa(g) + (parts.length > 1 ? '.' + parts[1] : '');
  }
  if (i.hasAttribute('data-money')) mwUpdate(i);
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-pickdate]'); if (!b) return; const inp = $('[data-date]', b.parentElement);
  datePick(Core.jalaliToIso(inp.value) || Core.todayISO(), iso => { inp.value = fa(Core.isoToJalali(iso)); inp.dispatchEvent(new Event('change', { bubbles: true })); });
});
document.addEventListener('blur', e => { const i = e.target; if (i instanceof HTMLInputElement && i.hasAttribute('data-date')) { const iso = Core.jalaliToIso(i.value); i.classList.toggle('bad', !!i.value && !iso); if (iso) i.value = fa(Core.isoToJalali(iso)); } }, true);

/* ── export / share ── */
/* Big text files go to the phone in pieces. One call through the Capacitor bridge carrying a 20+ MB backup can kill the WebView
   (the app closes; an automatic backup that crashes is then retried on every start). Desktop (Electron IPC) writes in one go. */
const FS_CHUNK = 512 * 1024;
async function fsWriteText(FS, o) {
  const s = String(o.data == null ? '' : o.data);
  if (DESK || !FS.appendFile || s.length <= FS_CHUNK) return FS.writeFile(o);
  const cut = i => { let j = Math.min(s.length, i + FS_CHUNK); if (j < s.length) { const c = s.charCodeAt(j - 1); if (c >= 0xD800 && c <= 0xDBFF) j--; } return j; }; // never split a surrogate pair
  let j = cut(0); const first = await FS.writeFile(Object.assign({}, o, { data: s.slice(0, j) }));
  for (let i = j; i < s.length; i = j) { j = cut(i); await FS.appendFile({ path: o.path, directory: o.directory, data: s.slice(i, j), encoding: o.encoding }); }
  return first;
}
// was the whole file written? (by size on the phone, so a big file is not read back through the bridge)
async function fsWritten(FS, path, directory, text) {
  if (DESK || !FS.stat) { const back = await FS.readFile({ path, directory, encoding: 'utf8' }); return !!back && back.data.length === text.length; }
  const st = await FS.stat({ path, directory }); return !!st && +st.size === new Blob([text]).size;
}
async function exportFile(name, text, mime) {
  const P = window.Capacitor && window.Capacitor.Plugins;
  if (isNative() && P && P.Filesystem && P.Share) {
    try {
      const w = await fsWriteText(P.Filesystem, { path: name, data: text, directory: 'CACHE', encoding: 'utf8' });
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
  if (DESK) { try { await window.fqDesktop.openFile(name, bytes); toast('در پنجره جدید باز شد؛ برای چاپ، دکمه چاپ یا Ctrl+P را بزنید.'); return true; } catch (e) { toast('باز کردن فایل ممکن نشد: ' + (e.message || e), true); return false; } }
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
async function done(r, okMsg) { if (!r.ok) { toast(r.error, true); return false; } if (!(await save())) return false; if (okMsg) toast(okMsg); render(); return true; } // acknowledge only after IndexedDB confirms the write
/* ── appearance (theme / accent / font size) ── */
const ACCENTS = { neutral: ['#414b59', '#313a46', 'خنثی'], blue: ['#2563eb', '#1d4ed8', 'آبی'], green: ['#16a34a', '#15803d', 'سبز'], purple: ['#7c3aed', '#6d28d9', 'بنفش'], orange: ['#ea580c', '#c2410c', 'نارنجی'], red: ['#dc2626', '#b91c1c', 'قرمز'], teal: ['#0d9488', '#0f766e', 'فیروزه‌ای'] };
const FS_MIN = 0.8, FS_MAX = 1.5;
// everything the user personalised lives in S.settings (and so in every backup); apply it all after load/restore
function applySettings(s) { s = s || {}; Core.setUnit(s.unit); applyAppearance(s); }
function applyAppearance(s) {
  s = s || {}; const r = document.documentElement, th = s.theme === 'light' || s.theme === 'dark' ? s.theme : 'auto';
  if (th === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', th);
  const a = ACCENTS[s.accent] || ACCENTS.neutral; r.style.setProperty('--blue', a[0]); r.style.setProperty('--blue2', a[1]);
  const fs = Math.min(FS_MAX, Math.max(FS_MIN, Number(s.fontScale) || 1)); r.style.setProperty('--fs', String(fs));
  const dark = th === 'dark' || (th === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme:dark)').matches);
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = dark ? '#0a0f1a' : '#ffffff';
  try { localStorage.setItem('fq_look', JSON.stringify({ theme: th, accent: s.accent || 'neutral', fontScale: fs })); } catch (e) { /* ignore */ }
}
try { applyAppearance(JSON.parse(localStorage.getItem('fq_look') || '{}')); } catch (e) { /* ignore */ }
function sign(b) { return b > 0 ? 'طلب من' : b < 0 ? 'بدهی من' : 'تسویه'; }
function bal(b) { return '<span class="' + (b > 0 ? 'debit' : b < 0 ? 'credit' : 'zero') + '">' + fmt(Math.abs(b)) + '</span>'; }

/* ── header date (every page) + static icons ── */
function tickDate() { const el = document.getElementById('hdate'); if (!el) return; const d = Core.longDate(Core.todayISO()); el.innerHTML = '<b>' + d.wd + '</b><span>' + d.date + '</span>'; }
tickDate(); setInterval(tickDate, 60e3); document.addEventListener('visibilitychange', () => { if (!document.hidden) tickDate(); });
$$('[data-ic]').forEach(e => { e.innerHTML = ico(e.dataset.ic); });
