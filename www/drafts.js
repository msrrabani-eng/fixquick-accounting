/* Fix Quick v012 — local, per-user drafts for interrupted accounting workflows.
   Drafts never enter S or the journal and have NO accounting effect until submit succeeds.
   Each flow has its own key; document edits cannot overwrite new-document drafts.
*/
'use strict';
const Drafts = (() => {
  const PREFIX = 'fq_workdraft_v012:', VERSION = 1, MAX = 240000;
  const active = new Set(), controllers = new WeakMap();
  function user() {
    try { return encodeURIComponent(String(typeof curName === 'function' ? curName() : 'owner').trim().toLowerCase() || 'owner'); }
    catch (_) { return 'owner'; }
  }
  function storageKey(kind) { return PREFIX + user() + ':' + kind; }
  function get(kind) {
    try { const raw = localStorage.getItem(storageKey(kind)); if (!raw) return null;
      const v = JSON.parse(raw); return v && v.version === VERSION && v.fields && typeof v.fields === 'object' ? v : null;
    } catch (_) { return null; }
  }
  function discard(kind) { try { localStorage.removeItem(storageKey(kind)); } catch (_) {} }
  function list() {
    const prefix = PREFIX + user() + ':', res = [];
    try { for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i); if (!k || !k.startsWith(prefix)) continue;
      const kind = k.slice(prefix.length), val = get(kind); if (val) res.push({kind, at:val.at || 0});
    } } catch (_) {}
    return res.sort((a,b) => b.at - a.at).slice(0,30);
  }
  function namedFields(form) {
    return Array.from(form.querySelectorAll('input[name],select[name],textarea[name]'))
      .filter(e => !['file','password','submit','button'].includes((e.type || '').toLowerCase()));
  }
  function captureFields(form) {
    const out = {};
    for (const el of namedFields(form)) {
      const a = out[el.name] || (out[el.name] = []);
      a.push(el.type === 'checkbox' || el.type === 'radio' ? {checked: !!el.checked, value:el.value} : {value:String(el.value)});
    }
    return out;
  }
  function restoreFields(form, fields) {
    const count = {};
    for (const el of namedFields(form)) {
      const ix = count[el.name] || 0; count[el.name] = ix + 1;
      const item = (fields[el.name] || [])[ix]; if (!item) continue;
      if (el.type === 'checkbox' || el.type === 'radio') el.checked = !!item.checked;
      else if (el.tagName === 'SELECT') { if (Array.from(el.options).some(o => o.value === String(item.value))) el.value = String(item.value); }
      else el.value = String(item.value ?? '');
    }
    form.querySelectorAll('input[data-money]').forEach(el => { if (typeof mwUpdate === 'function') mwUpdate(el); });
  }
  function bind(form, kind, hooks={}) {
    if (!form || !kind) return null;
    const previous = get(kind);
    const snapshot = () => ({fields:captureFields(form), extra: hooks.getExtra ? hooks.getExtra() : null});
    let initial = JSON.stringify(snapshot()), timer = null, halted = false;
    if (previous) {
      try {
        if (hooks.setExtra) hooks.setExtra(previous.extra || {});
        if (hooks.beforeRestore) hooks.beforeRestore(previous.extra || {});
        restoreFields(form, previous.fields);
        if (hooks.afterRestore) hooks.afterRestore(previous.extra || {});
        initial = JSON.stringify(snapshot());
        const notice = document.createElement('div'); notice.className = 'draft-restored';
        notice.textContent = '✓ پیش‌نویس نیمه‌تمام بازیابی شد؛ هنوز در حسابداری ثبت نشده است.';
        form.insertBefore(notice, form.firstChild);
      } catch(e) { console.warn('Draft restore skipped', e); }
    }
    const ctl = {
      kind, form,
      save() {
        if (halted) return false;
        const obj = snapshot(), body = JSON.stringify(obj);
        if (!previous && body === initial) return true; // untouched form has nothing to preserve
        const val = JSON.stringify({version:VERSION,at:Date.now(),...obj});
        if (val.length > MAX) { if (typeof toast === 'function') toast('پیش‌نویس بسیار بزرگ است؛ برخی اقلام را کوتاه کنید.',true); return false; }
        try { localStorage.setItem(storageKey(kind), val); return true; }
        catch (e) { if (typeof toast === 'function') toast('ذخیره پیش‌نویس ناموفق بود؛ فضای گوشی را بررسی کنید.',true); return false; }
      },
      touch() { if (halted) return; clearTimeout(timer); timer = setTimeout(() => ctl.save(), 100); },
      clear() { halted = true; clearTimeout(timer); discard(kind); active.delete(ctl); controllers.delete(form); },
      detach() { clearTimeout(timer); ctl.save(); halted = true; active.delete(ctl); controllers.delete(form); }
    };
    controllers.set(form,ctl); active.add(ctl);
    form.addEventListener('input',()=>ctl.touch(),true);
    form.addEventListener('change',()=>ctl.touch(),true);
    // Buttons that change values through code (calendar, price full, category) also save.
    form.addEventListener('click',()=>ctl.touch(),true);
    return ctl;
  }
  // Offer explicit choices for abandoning a workflow. No accounting entry is created.
  // The destructive option removes only the current operation's LOCAL draft.
  function requestExit(form, leave, title) {
    const ctl = controllers.get(form);
    if (!ctl) return false;
    const confirm = sheet(title || 'لغو عملیات',
      '<p class="msg">این عملیات هنوز ثبت نشده است. می‌خواهید پیش‌نویس برای ادامه بعدی باقی بماند یا حذف شود؟</p>' +
      '<button type="button" class="btn blue" id="draft-exit-keep">خروج و حفظ پیش‌نویس</button>' +
      '<button type="button" class="btn ghost red" id="draft-exit-delete">لغو عملیات و حذف پیش‌نویس</button>' +
      '<button type="button" class="btn ghost" data-close>ادامه ویرایش</button>' +
      '<p class="hint">حذف پیش‌نویس، هیچ فاکتور ثبت‌شده، موجودی انبار یا تراکنش قطعی را تغییر نمی‌دهد.</p>');
    confirm.q('#draft-exit-keep').onclick = () => {
      if (ctl.save() === false) { confirm.close(); return; }
      confirm.close(); if (typeof leave === 'function') leave();
    };
    confirm.q('#draft-exit-delete').onclick = () => {
      ctl.clear(); confirm.close(); if (typeof leave === 'function') leave();
    };
    return true;
  }
  function touch(form) { const c = controllers.get(form); if(c) c.touch(); }
  function saved(form) { const c = controllers.get(form); if (c) c.save(); }
  function clear(form) { const c = controllers.get(form); if(c) c.clear(); }
  function attachSheet(sh,kind,hooks={}) {
    if (!sh) return null;
    const form = sh.el.querySelector('form'); if (!form) return null;
    const c = bind(form,kind,hooks), prev = sh.o.onClose;
    sh.o.onClose = () => { c.detach(); if (prev) prev(); };
    const close = sh.close;
    sh.close = function(silent) { if (!silent && c) c.detach(); close.call(sh,silent); };
    // Every draft-backed purchase/payment/cheque/transfer dialog has a visible Cancel.
    // The × button still provides the fast, non-destructive save-and-close behavior.
    const cancel = document.createElement('button');
    cancel.type = 'button'; cancel.className = 'btn ghost draft-cancel';
    cancel.textContent = 'لغو / خروج از عملیات';
    cancel.addEventListener('click', () => requestExit(form, () => sh.close(), 'لغو عملیات'));
    form.appendChild(cancel);
    return c;
  }
  function flushPage() { for(const c of Array.from(active)) if(c.form && c.form.closest('#main')) c.detach(); }
  function flushAll() { for(const c of Array.from(active)) c.save(); }
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide',flushAll);
    document.addEventListener('visibilitychange',()=>{ if(document.visibilityState === 'hidden') flushAll(); });
  }
  return {get,list,discard,bind,attachSheet,requestExit,touch,saved,clear,flushPage,flushAll,captureFields,restoreFields};
})();
if(typeof module !== 'undefined' && module.exports) module.exports = Drafts;
