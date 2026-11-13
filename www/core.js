/* Fix Quick Accounting — core engine (pure logic, no DOM, no storage).
 * All money values are integers (Rial). Quantities have up to 3 decimals.
 * Person balance = sum(debit) - sum(credit):  > 0  => person owes us (بدهکار)
 *                                             < 0  => we owe person (بستانکار)
 */
(function (root) {
  'use strict';
  const Core = {};

  /* ───────────── numbers ───────────── */
  const FA = '۰۱۲۳۴۵۶۷۸۹';
  const AR = '٠١٢٣٤٥٦٧٨٩';
  Core.toEn = function (s) {
    return String(s == null ? '' : s).replace(/[۰-۹]/g, d => FA.indexOf(d)).replace(/[٠-٩]/g, d => AR.indexOf(d));
  };
  Core.toFa = function (s) {
    return String(s).replace(/[0-9]/g, d => FA[d]);
  };
  // parse user typed number; returns NaN when invalid
  Core.parseNum = function (s) {
    if (typeof s === 'number') return s;
    let t = Core.toEn(s).replace(/[,٬،\s]/g, '').replace(/٫/g, '.');
    if (t === '' || !/^-?\d*\.?\d+$|^-?\d+\.?$/.test(t)) return NaN;
    return Number(t);
  };
  const MAX_MONEY = 9e12;
  Core.parseMoney = function (s) {
    const n = Core.parseNum(s);
    if (!isFinite(n) || n < 0) return NaN;
    const r = Math.round(n * (Core.unit === 'toman' ? 10 : 1));
    return r > MAX_MONEY ? NaN : r;
  };
  Core.parseQty = function (s) {
    const n = Core.parseNum(s);
    if (!isFinite(n) || n <= 0 || n > 1e9) return NaN;
    return Math.round(n * 1000) / 1000;
  };
  Core.group = function (n) {
    n = Math.round(Number(n) || 0);
    const neg = n < 0; let s = String(Math.abs(n));
    s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '\u200e-' : '') + s;
  };
  // display unit: amounts are always stored in Rial; Toman only changes what is shown and typed (÷10 / ×10)
  Core.unit = 'rial';
  Core.setUnit = u => { Core.unit = u === 'toman' ? 'toman' : 'rial'; };
  Core.unitName = u => ((u || Core.unit) === 'toman' ? 'تومان' : 'ریال');
  Core.shown = n => (Core.unit === 'toman' ? (Number(n) || 0) / 10 : n);
  Core.fmt = n => Core.toFa(Core.group(Core.shown(n)));
  // for pre-filling input boxes: exact (Toman keeps one decimal when the Rial amount doesn't end in 0, so editing never changes the amount)
  Core.fmtInput = function (n) { n = Math.round(Number(n) || 0); if (Core.unit !== 'toman') return Core.toFa(Core.group(n)); const d = Math.abs(n % 10); return Core.toFa(Core.group(Math.trunc(n / 10)) + (d ? '.' + d : '')); };
  // number → Persian words: 12500000 → «دوازده میلیون و پانصد هزار»
  const W1 = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'], W10 = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
  const W2 = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'], W3 = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
  const SCALE = ['', 'هزار', 'میلیون', 'میلیارد', 'هزار میلیارد'];
  const words3 = n => { const h = Math.floor(n / 100), r = n % 100, out = []; if (h) out.push(W3[h]); if (r >= 10 && r < 20) out.push(W10[r - 10]); else { if (Math.floor(r / 10)) out.push(W2[Math.floor(r / 10)]); if (r % 10) out.push(W1[r % 10]); } return out.join(' و '); };
  Core.numToWords = function (n) {
    n = Math.round(Math.abs(Number(n) || 0)); if (!n) return 'صفر';
    const parts = []; let i = 0;
    while (n > 0 && i < SCALE.length) { const g = n % 1000; if (g) parts.unshift(i === 1 && g === 1 ? 'هزار' : words3(g) + (SCALE[i] ? ' ' + SCALE[i] : '')); n = Math.floor(n / 1000); i++; }
    return parts.join(' و ');
  };
  // an amount (stored in Rial) in words, in the unit chosen in settings: «دوازده میلیون و پانصد هزار تومان»
  Core.moneyWords = function (rial) { const v = Core.shown(rial); if (!v) return ''; const whole = Math.round(Math.abs(v)); return (whole ? Core.numToWords(whole) : 'کمتر از یک') + ' ' + Core.unitName(); };
  Core.fmtQty = function (q) {
    q = Math.round((Number(q) || 0) * 1000) / 1000;
    const parts = String(q).split('.'); parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return Core.toFa(parts.join('.'));
  };
  const r3 = x => Math.round(x * 1000) / 1000;

  /* ───────────── Jalali calendar (jalaali-js algorithm) ───────────── */
  const div = (a, b) => ~~(a / b);
  const mod = (a, b) => a - ~~(a / b) * b;
  const BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  function jalCal(jy) {
    const bl = BREAKS.length; let gy = jy + 621, leapJ = -14, jp = BREAKS[0], jm, jump = 0, n, i;
    if (jy < jp || jy >= BREAKS[bl - 1]) throw new Error('سال شمسی خارج از محدوده');
    for (i = 1; i < bl; i++) {
      jm = BREAKS[i]; jump = jm - jp;
      if (jy < jm) break;
      leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4); jp = jm;
    }
    n = jy - jp;
    leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
    const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    const march = 20 + leapJ - leapG;
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    let leap = mod(mod(n + 1, 33) - 1, 4); if (leap === -1) leap = 4;
    return { leap, gy, march };
  }
  function g2d(gy, gm, gd) {
    let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
    d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752; return d;
  }
  function d2g(jdn) {
    let j = 4 * jdn + 139361631; j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    const i = div(mod(j, 1461), 4) * 5 + 308;
    const gd = div(mod(i, 153), 5) + 1, gm = mod(div(i, 153), 12) + 1, gy = div(j, 1461) - 100100 + div(8 - gm, 6);
    return { gy, gm, gd };
  }
  function j2d(jy, jm, jd) { const r = jalCal(jy); return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1; }
  function d2j(jdn) {
    const gy = d2g(jdn).gy; let jy = gy - 621; const r = jalCal(jy); const jdn1f = g2d(gy, 3, r.march); let k = jdn - jdn1f, jm, jd;
    if (k >= 0) { if (k <= 185) { return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 }; } k -= 186; }
    else { jy -= 1; k += 179; if (r.leap === 1) k += 1; }
    jm = 7 + div(k, 30); jd = mod(k, 30) + 1; return { jy, jm, jd };
  }
  Core.isLeapJ = jy => jalCal(jy).leap === 0;
  Core.monthLenJ = (jy, jm) => jm <= 6 ? 31 : jm <= 11 ? 30 : (Core.isLeapJ(jy) ? 30 : 29);
  Core.MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  Core.WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
  const pad2 = n => (n < 10 ? '0' : '') + n;
  Core.isoToParts = function (iso) { const [y, m, d] = iso.split('-').map(Number); return d2j(g2d(y, m, d)); };
  Core.partsToIso = function (jy, jm, jd) { const g = d2g(j2d(jy, jm, jd)); return g.gy + '-' + pad2(g.gm) + '-' + pad2(g.gd); };
  Core.isoToJalali = function (iso) { if (!iso) return ''; const p = Core.isoToParts(iso); return p.jy + '/' + pad2(p.jm) + '/' + pad2(p.jd); };
  Core.fmtDate = iso => (iso ? Core.toFa(Core.isoToJalali(iso)) : '—');
  // 0 = Saturday … 6 = Friday
  Core.weekdayIdx = function (iso) { const [y, m, d] = iso.split('-').map(Number); return mod(g2d(y, m, d) + 2, 7); };
  // «شنبه ۱۹ مهر ۱۴۰۵»
  Core.longDate = function (iso) { const p = Core.isoToParts(iso); return { wd: Core.WEEKDAYS[Core.weekdayIdx(iso)], date: Core.toFa(p.jd + ' ' + Core.MONTHS[p.jm - 1] + ' ' + p.jy) }; };
  Core.validIso = function (iso) {
    if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    const [y, m, d] = iso.split('-').map(Number); if (m < 1 || m > 12 || d < 1) return false;
    const dt = new Date(Date.UTC(y, m - 1, d)); return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  };
  // accepts 1405/7/14 or ۱۴۰۵-۰۷-۱۴ ; returns ISO or null
  Core.jalaliToIso = function (s) {
    const m = Core.toEn(s).trim().match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/); if (!m) return null;
    const jy = +m[1], jm = +m[2], jd = +m[3];
    if (jy < 1200 || jy > 1700 || jm < 1 || jm > 12 || jd < 1 || jd > Core.monthLenJ(jy, jm)) return null;
    return Core.partsToIso(jy, jm, jd);
  };
  Core.todayISO = function (now) { const d = now || new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
  Core.addDays = function (iso, n) { const [y, m, d] = iso.split('-').map(Number); const g = d2g(g2d(y, m, d) + n); return g.gy + '-' + pad2(g.gm) + '-' + pad2(g.gd); };
  Core.diffDays = function (a, b) { const [y1, m1, d1] = a.split('-').map(Number), [y2, m2, d2] = b.split('-').map(Number); return g2d(y2, m2, d2) - g2d(y1, m1, d1); };
  // period helpers (Jalali based) → {from,to}
  Core.periodRange = function (kind, todayIso, fyMonth) {
    const t = todayIso || Core.todayISO(); const p = Core.isoToParts(t);
    if (kind === 'today') return { from: t, to: t };
    if (kind === 'yesterday') { const y = Core.addDays(t, -1); return { from: y, to: y }; }
    if (kind === 'mtd') return { from: Core.partsToIso(p.jy, p.jm, 1), to: t };
    if (kind === 'fytd') { const fm = Math.min(12, Math.max(1, +fyMonth || 1)), y = p.jm >= fm ? p.jy : p.jy - 1; return { from: Core.partsToIso(y, fm, 1), to: t }; }
    if (kind === 'week') { const w = Core.weekdayIdx(t); const from = Core.addDays(t, -w); return { from, to: Core.addDays(from, 6) }; }
    if (kind === 'month') return { from: Core.partsToIso(p.jy, p.jm, 1), to: Core.partsToIso(p.jy, p.jm, Core.monthLenJ(p.jy, p.jm)) };
    if (kind === 'prevmonth') { const jm = p.jm === 1 ? 12 : p.jm - 1, jy = p.jm === 1 ? p.jy - 1 : p.jy; return { from: Core.partsToIso(jy, jm, 1), to: Core.partsToIso(jy, jm, Core.monthLenJ(jy, jm)) }; }
    if (kind === 'prevweek') { const w = Core.weekdayIdx(t); const from = Core.addDays(t, -w - 7); return { from, to: Core.addDays(from, 6) }; }
    if (kind === 'year') return { from: Core.partsToIso(p.jy, 1, 1), to: Core.partsToIso(p.jy, 12, Core.monthLenJ(p.jy, 12)) };
    return { from: null, to: null };
  };

  /* ───────────── state ───────────── */
  Core.emptyState = () => ({
    v: 1, seq: 1, people: [], products: [], invoices: [], tx: [], expenses: [], cheques: [], adjusts: [], acctTx: [], recons: [], vouchers: [], whTx: [],
    settings: { business: '', openingCash: 0, lastBackup: null }
  });
  const nid = st => st.seq++;
  // id lookups are indexed (large data: thousands of people/products/invoices); index rebuilt when the array changes
  const idxCache = new WeakMap();
  const byId = (arr, id) => {
    let c = idxCache.get(arr);
    if (!c || c.len !== arr.length) { const m = new Map(); for (const x of arr) m.set(x.id, x); c = { len: arr.length, m }; idxCache.set(arr, c); }
    const x = c.m.get(id); if (x && x.id === id) return x;
    if (x) { idxCache.delete(arr); return arr.find(y => y.id === id); }
    return undefined;
  };
  // transactions grouped by invoice ref (for paid/remaining), cached per tx array
  const refCache = new WeakMap();
  const txByRef = st => {
    let c = refCache.get(st.tx);
    if (!c || c.len !== st.tx.length) { const m = new Map(); for (const t of st.tx) if (t.ref != null) { const a = m.get(t.ref); if (a) a.push(t); else m.set(t.ref, [t]); } c = { len: st.tx.length, m }; refCache.set(st.tx, c); }
    return c.m;
  };
  Core.txByRef = txByRef;
  Core.byId = byId;

  const METHODS = { cash: 'نقد', bank: 'کارت/حواله بانکی', cheque: 'چک' };
  Core.METHODS = METHODS;
  Core.TYPE_FA = { sale: 'فروش', purchase: 'خرید', sale_return: 'برگشت از فروش', purchase_return: 'برگشت از خرید' };
  const INV_KIND = { sale: 'debit', purchase: 'credit', sale_return: 'credit', purchase_return: 'debit' };
  // payment made at invoice time: the opposite entry on the person's account
  const PAY_KIND = { sale: 'credit', purchase: 'debit', sale_return: 'debit', purchase_return: 'credit' };
  const err = m => ({ ok: false, error: m });
  const ok = (x) => Object.assign({ ok: true }, x || {});

  /* ───────────── people ───────────── */
  Core.addPerson = function (st, d) {
    const name = String(d.name || '').trim(); if (!name) return err('نام را وارد کنید.');
    if (st.people.some(p => !p.archived && p.name === name)) return err('شخصی با این نام قبلاً ثبت شده است.');
    const code = Core.toEn(String(d.code || '').trim()); if (code && st.people.some(x => x.code && Core.norm(x.code) === Core.norm(code))) return err('این کد برای شخص دیگری ثبت شده است.');
    const p = { id: nid(st), name, phone: String(d.phone || '').trim(), note: String(d.note || '').trim(), archived: false, createdAt: d.createdAt || Date.now() };
    if (code) p.code = code;
    st.people.push(p);
    const ob = d.opening || 0;
    if (ob) { // opening balance: positive => owes us (debit), negative => we owe (credit)
      st.tx.push({ id: nid(st), personId: p.id, kind: ob > 0 ? 'debit' : 'credit', amount: Math.abs(ob), type: 'opening', desc: 'مانده اول دوره', date: d.date || Core.todayISO(), ref: null, group: null, method: null });
    }
    return ok({ person: p });
  };
  Core.editPerson = function (st, id, d) {
    Core._pv++;
    const p = byId(st.people, id); if (!p) return err('شخص پیدا نشد.');
    const name = String(d.name || '').trim(); if (!name) return err('نام را وارد کنید.');
    if (st.people.some(x => x.id !== id && !x.archived && x.name === name)) return err('شخصی با این نام قبلاً ثبت شده است.');
    if (d.code !== undefined) { const code = Core.toEn(String(d.code || '').trim()); if (code && st.people.some(x => x.id !== id && x.code && Core.norm(x.code) === Core.norm(code))) return err('این کد برای شخص دیگری ثبت شده است.'); if (code) p.code = code; else delete p.code; }
    p.name = name; p.phone = String(d.phone || '').trim(); p.note = String(d.note || '').trim(); return ok();
  };
  // next free numeric code: people start at 1001, products at 101
  Core.nextCode = function (st, kind) { const L = kind === 'product' ? st.products.map(p => p.sku) : st.people.map(p => p.code); let m = kind === 'product' ? 100 : 1000; L.forEach(c => { const v = /^\d{1,9}$/.test(Core.toEn(c || '')) ? +Core.toEn(c) : 0; if (v > m) m = v; }); return String(m + 1); };
  Core.personHasActivity = (st, id) => st.tx.some(t => t.personId === id) || st.invoices.some(i => i.personId === id) || st.cheques.some(c => c.personId === id);
  Core.deletePerson = function (st, id) {
    if (Core.personHasActivity(st, id)) return err('این شخص سابقه مالی دارد و حذف نمی‌شود. می‌توانید او را بایگانی کنید.');
    st.people = st.people.filter(p => p.id !== id); return ok();
  };
  Core.setArchived = function (st, id, v) { const p = byId(st.people, id); if (!p) return err('شخص پیدا نشد.'); p.archived = !!v; return ok(); };

  /* ───────────── ledger ───────────── */
  // date-range views: what each person / product did between two dates (either end may be empty)
  const inR = (d, from, to) => (!from || d >= from) && (!to || d <= to);
  Core.peopleMoves = function (st, from, to) { const m = {}; st.tx.forEach(t => { if (t.personId == null || !inR(t.date, from, to)) return; const x = m[t.personId] || (m[t.personId] = { dr: 0, cr: 0, n: 0 }); if (t.kind === 'debit') x.dr += t.amount; else x.cr += t.amount; x.n++; }); return m; };
  Core.balancesAt = function (st, to) { const m = {}; st.tx.forEach(t => { if (t.personId == null || (to && t.date > to)) return; m[t.personId] = (m[t.personId] || 0) + (t.kind === 'debit' ? t.amount : -t.amount); }); return m; };
  Core.productMovesIn = function (st, from, to) {
    const m = {}, g = id => m[id] || (m[id] = { sold: 0, bought: 0, adj: 0, n: 0 });
    st.invoices.forEach(inv => { if (!inR(inv.date, from, to)) return; const k = inv.type === 'sale' ? ['sold', 1] : inv.type === 'sale_return' ? ['sold', -1] : inv.type === 'purchase' ? ['bought', 1] : ['bought', -1]; (inv.items || []).forEach(l => { const x = g(l.productId); x[k[0]] = r3(x[k[0]] + k[1] * l.qty); x.n++; }); });
    st.adjusts.forEach(a => { if (!inR(a.date, from, to)) return; const x = g(a.productId); x.adj = r3(x.adj + a.qty); x.n++; });
    (st.whTx || []).forEach(w => { if (!inR(w.date, from, to)) return; (w.items || []).forEach(l => { g(l.productId).n++; }); });
    return m;
  };
  Core.balanceOf = (st, pid) => st.tx.reduce((s, t) => t.personId === pid ? s + (t.kind === 'debit' ? t.amount : -t.amount) : s, 0);
  Core.balances = function (st) { const m = {}; st.people.forEach(p => m[p.id] = 0); st.tx.forEach(t => { if (t.personId in m) m[t.personId] += t.kind === 'debit' ? t.amount : -t.amount; }); return m; };
  Core.ledger = function (st, pid, from, to) {
    const rows = st.tx.filter(t => t.personId === pid).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id);
    let run = 0, carry = 0; const out = [];
    for (const t of rows) {
      const delta = t.kind === 'debit' ? t.amount : -t.amount;
      if (from && t.date < from) { carry += delta; run += delta; continue; }
      if (to && t.date > to) continue;
      run += delta; out.push({ tx: t, debit: t.kind === 'debit' ? t.amount : 0, credit: t.kind === 'credit' ? t.amount : 0, balance: run });
    }
    return { carry, rows: out, closing: run };
  };
  const checkDate = d => Core.validIso(d) ? null : 'تاریخ نامعتبر است.';
  // type: manual | receipt | payment
  /* ───────────── cash boxes and bank accounts ─────────────
   * Every receipt, payment, expense and first payment of an invoice goes in or out of one account.
   * Balance of an account = its opening balance + money in − money out (transfers between accounts move money, they are not income). */
  Core.BANKS = ['ملی', 'ملت', 'صادرات', 'تجارت', 'سپه', 'کشاورزی', 'مسکن', 'رفاه کارگران', 'پاسارگاد', 'سامان', 'پارسیان', 'اقتصاد نوین', 'شهر', 'آینده', 'سینا', 'دی', 'کارآفرین', 'خاورمیانه', 'گردشگری', 'ایران زمین', 'سرمایه', 'توسعه تعاون', 'پست بانک', 'بلو (سامان)', 'رسالت', 'مهر ایران', 'ملل', 'نور', 'توسعه صادرات', 'صنعت و معدن'];
  const acctName = a => (a ? (a.kind === 'bank' ? (a.bank ? 'بانک ' + a.bank + (a.name && a.name !== a.bank ? ' - ' + a.name : '') : a.name || 'حساب بانکی') : a.name || 'صندوق') : '—');
  Core.acctName = acctName;
  Core.migrate = function (st) { // older data: one cash figure and a payment «method» → real accounts
    // phones are costed by their own IMEI from the start; with closed years, only after the last closed year (closed figures never move)
    if (st.settings && st.settings.serialCostFrom === undefined) { const y = (st.fyClosed || []).reduce((m, f) => (f.to > m ? f.to : m), ''); st.settings.serialCostFrom = y ? Core.addDays(y, 1) : ''; }
    if (!Array.isArray(st.acctTx)) st.acctTx = [];
    if (!Array.isArray(st.recons)) st.recons = [];
    if (Array.isArray(st.accounts) && st.accounts.length) return st;
    st.accounts = [];
    const cash = { id: st.seq++, kind: 'cash', name: 'صندوق اصلی', opening: Math.round(+((st.settings || {}).openingCash) || 0) };
    st.accounts.push(cash); if (st.settings) st.settings.openingCash = 0;
    let bank = null; const bankFor = () => bank || (bank = (st.accounts.push({ id: st.seq++, kind: 'bank', name: 'حساب بانکی', bank: '', accNo: '', card: '', sheba: '', opening: 0 }), st.accounts[st.accounts.length - 1]));
    const pickA = m => (m === 'bank' || m === 'card' || m === 'cheque' ? bankFor().id : cash.id);
    (st.tx || []).forEach(t => { if ((t.type === 'receipt' || t.type === 'payment') && t.acct == null) t.acct = pickA(t.method); });
    (st.expenses || []).forEach(e => { if (e.acct == null) e.acct = pickA(e.method); });
    return st;
  };
  const ensureAcct = st => { if (!Array.isArray(st.accounts) || !st.accounts.length) Core.migrate(st); return st.accounts; };
  const acctFor = (st, id, method) => { const L = ensureAcct(st); const a = id != null && byId(L, +id); if (a) return a; const k = method === 'bank' || method === 'card' || method === 'cheque' ? 'bank' : 'cash'; const f = L.find(x => x.kind === k && !x.archived); if (f) return f; if (k === 'bank') { const b = { id: nid(st), kind: 'bank', name: 'حساب بانکی', bank: '', accNo: '', card: '', sheba: '', opening: 0 }; L.push(b); return b; } return L.find(x => !x.archived) || L[0]; };
  Core.acctFor = acctFor;
  const methodOf = a => (a && a.kind === 'bank' ? 'bank' : 'cash');
  Core.addAccount = function (st, d) {
    ensureAcct(st); const kind = d.kind === 'bank' ? 'bank' : 'cash';
    const name = String(d.name || '').trim(), bank = String(d.bank || '').trim();
    if (kind === 'cash' && !name) return err('نام صندوق را وارد کنید.'); if (kind === 'bank' && !bank && !name) return err('نام بانک را وارد کنید.');
    const opening = Math.round(Number(d.opening) || 0); if (!isFinite(opening) || Math.abs(opening) > MAX_MONEY) return err('موجودی اول دوره نامعتبر است.');
    const digits = v => Core.toEn(String(v || '')).replace(/[^\dA-Za-z]/g, '').toUpperCase();
    const a = { id: nid(st), kind, name: name || (kind === 'bank' ? bank : 'صندوق'), opening };
    if (kind === 'bank') Object.assign(a, { bank, accNo: digits(d.accNo), card: digits(d.card).replace(/\D/g, ''), sheba: digits(d.sheba), branch: String(d.branch || '').trim(), owner: String(d.owner || '').trim() });
    if (a.card && a.card.length !== 16) return err('شماره کارت باید ۱۶ رقم باشد.');
    if (a.sheba && !/^(IR)?\d{24}$/.test(a.sheba)) return err('شماره شبا باید ۲۴ رقم باشد (با یا بدون IR).');
    if (a.sheba && !/^IR/.test(a.sheba)) a.sheba = 'IR' + a.sheba;
    st.accounts.push(a); return ok({ account: a });
  };
  Core.editAccount = function (st, id, d) {
    const a = byId(ensureAcct(st), id); if (!a) return err('حساب پیدا نشد.');
    const tmp = { accounts: [], seq: 1 }; const r = Core.addAccount(Object.assign(tmp, { accounts: [{ id: 0, kind: 'cash', name: 'x', opening: 0 }] }), Object.assign({ kind: a.kind }, d)); if (!r.ok) return r;
    const n = r.account; delete n.id; Object.assign(a, n); if (d.archived != null) a.archived = !!d.archived; return ok({ account: a });
  };
  Core.acctUsed = (st, id) => st.tx.some(t => t.acct === id) || st.expenses.some(e => e.acct === id) || (st.acctTx || []).some(x => x.from === id || x.to === id) || st.cheques.some(c => c.acct === id || (c.hist || []).some(h => h.acct === id)) || (st.vouchers || []).some(v => v.lines.some(l => l.acc === '1101:' + id || l.acc === '1102:' + id));
  Core.deleteAccount = function (st, id) { const L = ensureAcct(st); if (L.length <= 1) return err('حداقل یک صندوق یا حساب لازم است.'); if (Core.acctUsed(st, id)) return err('این حساب گردش دارد؛ به‌جای حذف، بایگانی‌اش کنید.'); st.accounts = L.filter(a => a.id !== id); return ok(); };
  // money between your own accounts (deposit cash to the bank, withdraw, bank to bank); an optional bank fee is an expense of the source
  Core.addAcctTx = function (st, d) {
    const L = ensureAcct(st), A = byId(L, +d.from), B = byId(L, +d.to);
    if (!A || !B) return err('حساب مبدأ و مقصد را انتخاب کنید.'); if (A === B) return err('مبدأ و مقصد نمی‌تواند یکی باشد.');
    if (!(d.amount > 0) || !Number.isInteger(d.amount) || d.amount > MAX_MONEY) return err('مبلغ نامعتبر است.');
    const de = checkDate(d.date); if (de) return err(de);
    const fee = Math.max(0, Math.round(Number(d.fee) || 0));
    const x = { id: nid(st), from: A.id, to: B.id, amount: d.amount, fee, date: d.date, desc: String(d.desc || '').trim() };
    st.acctTx.push(x); return ok({ xfer: x });
  };
  Core.deleteAcctTx = function (st, id) { st.acctTx = (st.acctTx || []).filter(x => x.id !== id); return ok(); };
  // every movement of money, oldest first: { date, acct, amt (+in / −out), kind, ref, personId, desc }
  Core.moneyMoves = function (st) {
    ensureAcct(st); const out = [];
    st.tx.forEach(t => { if ((t.type === 'receipt' || t.type === 'payment') && t.acct != null) out.push({ date: t.date, acct: t.acct, amt: t.type === 'receipt' ? t.amount : -t.amount, kind: t.type, id: 't' + t.id, tx: t, personId: t.personId, desc: t.desc, rec: t.rec }); });
    st.expenses.forEach(e => { if (e.acct != null) out.push({ date: e.date, acct: e.acct, amt: -e.amount, kind: 'expense', id: 'e' + e.id, exp: e, desc: e.title + (e.category ? ' (' + e.category + ')' : ''), rec: e.rec }); });
    (st.acctTx || []).forEach(x => {
      out.push({ date: x.date, acct: x.from, amt: -x.amount, kind: 'xfer', id: 'x' + x.id + 'o', xfer: x, desc: 'انتقال به ' + acctName(byId(st.accounts, x.to)) + (x.desc ? ' - ' + x.desc : ''), rec: x.recO });
      out.push({ date: x.date, acct: x.to, amt: x.amount, kind: 'xfer', id: 'x' + x.id + 'i', xfer: x, desc: 'انتقال از ' + acctName(byId(st.accounts, x.from)) + (x.desc ? ' - ' + x.desc : ''), rec: x.recI });
      if (x.fee) out.push({ date: x.date, acct: x.from, amt: -x.fee, kind: 'fee', id: 'x' + x.id + 'f', xfer: x, desc: 'کارمزد انتقال', rec: x.recF });
    });
    (st.vouchers || []).forEach(v => { if (v.kind === 'manual') v.lines.forEach((l, k) => { const m = /^110[12]:(\d+)$/.exec(l.acc); if (m) out.push({ date: v.date, acct: +m[1], amt: l.dr - l.cr, kind: 'vch', id: 'v' + v.id + '_' + k, vch: v, line: k, desc: 'سند ' + v.no + (l.note || v.desc ? ' - ' + (l.note || v.desc) : ''), rec: l.rec }); }); });
    Core.chequeMoves(st).forEach(v => out.push(v));
    return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  };
  Core.accountBalances = function (st, upto) {
    const m = {}; ensureAcct(st).forEach(a => { m[a.id] = a.opening || 0; });
    Core.moneyMoves(st).forEach(v => { if ((!upto || v.date <= upto) && v.acct in m) m[v.acct] += v.amt; });
    return m;
  };
  Core.accountLedger = function (st, id, from, to) {
    const a = byId(ensureAcct(st), id); let bal = a ? a.opening || 0 : 0, carry = bal; const rows = [];
    Core.moneyMoves(st).forEach(v => { if (v.acct !== id) return; if (from && v.date < from) { bal += v.amt; carry = bal; return; } if (to && v.date > to) return; bal += v.amt; rows.push(Object.assign({ bal }, v)); });
    return { account: a, carry, rows, balance: bal };
  };
  Core.addTx = function (st, d) {
    if (!byId(st.people, d.personId)) return err('شخص انتخاب نشده است.');
    if (!(d.amount > 0) || !Number.isInteger(d.amount) || d.amount > MAX_MONEY) return err('مبلغ نامعتبر است.');
    const de = checkDate(d.date); if (de) return err(de);
    let kind = d.kind, type = d.type || 'manual';
    if (type === 'receipt') kind = 'credit'; else if (type === 'payment') kind = 'debit';
    if (kind !== 'debit' && kind !== 'credit') return err('نوع تراکنش نامعتبر است.');
    const pay = type === 'receipt' || type === 'payment', A = pay ? acctFor(st, d.acct, d.method) : null;
    const t = { id: nid(st), personId: d.personId, kind, amount: d.amount, type, desc: String(d.desc || '').trim(), date: d.date, ref: d.ref || null, group: null, method: pay ? methodOf(A) : null };
    // Manual person balances are not automatically profit/loss. Existing historic tx retain their original journal treatment.
    if (type === 'manual') t.manualPosting = 'suspense';
    if (A) t.acct = A.id;
    st.tx.push(t); return ok({ tx: t });
  };
  Core.editTx = function (st, id, d) {
    const t = byId(st.tx, id); if (!t) return err('تراکنش پیدا نشد.');
    if (t.type === 'invoice' || t.type === 'transfer') return err('این تراکنش از طریق فاکتور/حواله ثبت شده و اینجا قابل ویرایش نیست.');
    if (t.type === 'voucher') return err('این ردیف از سند حسابداری شماره ' + Core.toFa((byId(st.vouchers || [], t.vch) || {}).no || '') + ' است؛ خود سند را ویرایش کنید.');
    if (t.type === 'chq') return err('این ردیف مربوط به چک است؛ از بخش چک‌ها تغییرش دهید.');
    if (!(d.amount > 0) || !Number.isInteger(d.amount) || d.amount > MAX_MONEY) return err('مبلغ نامعتبر است.');
    const de = checkDate(d.date); if (de) return err(de);
    t.amount = d.amount; t.date = d.date; t.desc = String(d.desc || '').trim();
    if (t.type === 'manual' || t.type === 'opening') { if (d.kind === 'debit' || d.kind === 'credit') t.kind = d.kind; }
    if ((t.type === 'receipt' || t.type === 'payment') && (d.acct != null || METHODS[d.method])) { const A = acctFor(st, d.acct != null ? d.acct : null, d.acct != null ? null : d.method); t.acct = A.id; t.method = methodOf(A); }
    return ok();
  };
  Core.deleteTx = function (st, id) {
    const t = byId(st.tx, id); if (!t) return err('تراکنش پیدا نشد.');
    if (t.type === 'invoice') return err('این ردیف مربوط به فاکتور است؛ برای حذف، خود فاکتور را حذف کنید.');
    if (t.type === 'voucher') return err('این ردیف از سند حسابداری است؛ خود سند را حذف کنید.');
    if (t.type === 'chq') return err('این ردیف مربوط به چک است؛ از بخش چک‌ها تغییرش دهید.');
    if (t.group) st.tx = st.tx.filter(x => x.group !== t.group); else st.tx = st.tx.filter(x => x.id !== id);
    return ok();
  };
  // حواله: from pays (credit), to receives (debit)
  Core.addTransfer = function (st, d) {
    if (!byId(st.people, d.fromId) || !byId(st.people, d.toId)) return err('هر دو شخص را انتخاب کنید.');
    if (d.fromId === d.toId) return err('مبدأ و مقصد نمی‌تواند یکی باشد.');
    if (!(d.amount > 0) || !Number.isInteger(d.amount) || d.amount > MAX_MONEY) return err('مبلغ نامعتبر است.');
    const de = checkDate(d.date); if (de) return err(de);
    const g = nid(st); const a = byId(st.people, d.fromId).name, b = byId(st.people, d.toId).name; const note = d.desc ? ' - ' + String(d.desc).trim() : '';
    st.tx.push({ id: nid(st), personId: d.fromId, kind: 'credit', amount: d.amount, type: 'transfer', desc: 'حواله به ' + b + note, date: d.date, ref: null, group: g, method: null });
    st.tx.push({ id: nid(st), personId: d.toId, kind: 'debit', amount: d.amount, type: 'transfer', desc: 'حواله از ' + a + note, date: d.date, ref: null, group: g, method: null });
    return ok();
  };

  Core.editTransfer = function (st, group, d) {
    const pair = st.tx.filter(t => t.type === 'transfer' && t.group === group); if (pair.length !== 2) return err('حواله پیدا نشد.');
    if (!byId(st.people, d.fromId) || !byId(st.people, d.toId)) return err('هر دو شخص را انتخاب کنید.');
    if (d.fromId === d.toId) return err('مبدأ و مقصد نمی‌تواند یکی باشد.');
    if (!(d.amount > 0) || !Number.isInteger(d.amount) || d.amount > MAX_MONEY) return err('مبلغ نامعتبر است.');
    const de = checkDate(d.date); if (de) return err(de);
    const a = byId(st.people, d.fromId).name, b = byId(st.people, d.toId).name, note = d.desc ? ' - ' + String(d.desc).trim() : '';
    const out = pair.find(t => t.kind === 'credit'), inn = pair.find(t => t.kind === 'debit');
    Object.assign(out, { personId: d.fromId, amount: d.amount, date: d.date, desc: 'حواله به ' + b + note });
    Object.assign(inn, { personId: d.toId, amount: d.amount, date: d.date, desc: 'حواله از ' + a + note });
    return ok();
  };
  Core.transferInfo = function (st, group) {
    const pair = st.tx.filter(t => t.type === 'transfer' && t.group === group); const out = pair.find(t => t.kind === 'credit'), inn = pair.find(t => t.kind === 'debit');
    if (!out || !inn) return null; const m = (out.desc || '').match(/ - (.*)$/);
    return { fromId: out.personId, toId: inn.personId, amount: out.amount, date: out.date, desc: m ? m[1] : '' };
  };

  /* ───────────── products ───────────── */
  Core.addProduct = function (st, d) {
    const name = String(d.name || '').trim(); if (!name) return err('نام کالا را وارد کنید.');
    if (st.products.some(p => p.name === name)) return err('کالایی با این نام وجود دارد.');
    const bc = String(d.barcode || '').trim(); if (bc && st.products.some(p => p.barcode === bc)) return err('این بارکد برای کالای دیگری ثبت شده است.');
    const sku = Core.toEn(String(d.sku || '').trim()); if (sku && st.products.some(x => x.sku && Core.norm(x.sku) === Core.norm(sku))) return err('این کد برای کالای دیگری ثبت شده است.');
    const p = { id: nid(st), name, barcode: bc, sku, unit: String(d.unit || 'عدد').trim() || 'عدد', minStock: Math.max(0, Number(d.minStock) || 0), salePrice: Math.max(0, Math.round(d.salePrice) || 0), buyPrice: Math.max(0, Math.round(d.buyPrice) || 0) };
    const cat = String(d.category || '').trim(); if (cat && cat !== Core.guessCategory(name)) p.category = cat;
    if (d.serialReq === true || d.serialReq === false) p.serialReq = d.serialReq;
    st.products.push(p); return ok({ product: p });
  };
  Core.editProduct = function (st, id, d) {
    Core._pv++;
    const p = byId(st.products, id); if (!p) return err('کالا پیدا نشد.');
    const name = String(d.name || '').trim(); if (!name) return err('نام کالا را وارد کنید.');
    if (st.products.some(x => x.id !== id && x.name === name)) return err('کالایی با این نام وجود دارد.');
    const bc = String(d.barcode || '').trim(); if (bc && st.products.some(x => x.id !== id && x.barcode === bc)) return err('این بارکد برای کالای دیگری ثبت شده است.');
    const sku = Core.toEn(String(d.sku || '').trim()); if (sku && st.products.some(x => x.id !== id && x.sku && Core.norm(x.sku) === Core.norm(sku))) return err('این کد برای کالای دیگری ثبت شده است.');
    Object.assign(p, { name, barcode: bc, sku, unit: String(d.unit || 'عدد').trim() || 'عدد', minStock: Math.max(0, Number(d.minStock) || 0), salePrice: Math.max(0, Math.round(d.salePrice) || 0), buyPrice: Math.max(0, Math.round(d.buyPrice) || 0) });
    if (d.category !== undefined) { const cat = String(d.category || '').trim(); if (cat && cat !== Core.guessCategory(name)) p.category = cat; else delete p.category; }
    if (d.serialReq === true || d.serialReq === false) p.serialReq = d.serialReq; else if (d.serialReq === null) delete p.serialReq;
    return ok();
  };
  /* ───────────── smart product categories ─────────────
   * A product's category is guessed from its name (rules below) unless the user picked one by hand (p.category).
   * The guess is computed on the fly, so better rules apply to every product automatically. */
  const simKey = s => Core.toEn(String(s || '')).toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]/g, '');
  const levDist = (a, b) => { let p = [...Array(b.length + 1).keys()]; for (let i = 1; i <= a.length; i++) { const c = [i]; for (let j = 1; j <= b.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[b.length]; };
  // products whose name looks like the given one (not the same name): used to ask before creating a near-duplicate
  Core.similarProducts = function (st, name) {
    const a = simKey(name), na = Core.norm(name); if (a.length < 4) return [];
    return st.products.filter(p => {
      if (p.archived || Core.norm(p.name) === na) return false;
      const b = simKey(p.name); if (Math.min(a.length, b.length) < 5) return false;
      return a.includes(b) || b.includes(a) || levDist(a, b) <= 2;
    }).slice(0, 5);
  };
  Core.norm = s => Core.toEn(String(s == null ? '' : s)).replace(/[يىئ]/g, 'ی').replace(/ك/g, 'ک').replace(/[ۀة]/g, 'ه').replace(/[أإآ]/g, 'ا').replace(/[‌‏‎_\-()\/،,+]/g, ' ').replace(/\s+/g, ' ').toLowerCase().trim();
  Core.OTHER_CAT = 'سایر لوازم جانبی';
  // [category, keywords, strength]  strength: 1 strong (wins even when it comes later in the name), 0 normal, -1 weak (only when nothing else matches)
  const CAT_RULES = [
    ['آیفون', 'آیفون|ایفون|iphone', -1],
    ['گوشی سامسونگ', 'سامسونگ|گلکسی|galaxy|samsung', -1],
    ['گوشی شیائومی', 'شیائومی|شیاومی|ردمی|پوکو|xiaomi|redmi|poco', -1],
    ['سایر گوشی‌ها', 'گوشی|موبایل|تلفن همراه|هواوی|انر|نوکیا|موتورولا|ریلمی|اوپو|وان پلاس|وانپلاس|پیکسل|گوگل پیکسل|ویوو|تکنو|اینفینیکس|جی ال ایکس|ناتینگ|ناتینگ فون|سی ام اف|سونی|اکسپریا|زد تی ای|لنوو|ال جی|ایسوس|میزو|بلک بری|داریا|huawei|honor|nokia|motorola|moto|realme|oppo|oneplus|pixel|vivo|tecno|infinix|glx|nothing|nothing phone|cmf|sony|xperia|zte|lenovo|lg|asus|meizu|blackberry|daria|phone|mobile|smartphone', -1],
    ['تبلت و آیپد', 'ایپد|ipad|تبلت|tablet|گلکسی تب|galaxy tab', 0],
    ['ساعت هوشمند', 'اپل واچ|ساعت هوشمند|ساعت|واچ|watch|مچ بند|بند ساعت', 0],
    ['هندزفری و هدفون', 'هندزفری|هندز فری|هدفون|هدست|ایرپاد|ایر پاد|ایربادز|ایرباد|ایرفون|airpods|airpod|earbuds|buds|headphone|headset|earphone|tws', 0],
    ['کابل شارژ و داده', 'کابل|cable|سیم شارژ', 0],
    ['شارژر فندکی', 'فندکی|شارژر ماشین|car charger', 1],
    ['شارژر وایرلس و مگ‌سیف', 'وایرلس|wireless|مگ سیف|مگسیف|magsafe|شارژر بی سیم|پد شارژ', 1],
    ['پاوربانک', 'پاوربانک|پاور بانک|power bank|powerbank|شارژر همراه', 1],
    ['آداپتور و شارژر', 'اداپتور|شارژر|کلگی|adapter|charger', 0],
    ['قاب و کاور', 'قاب|کاور|کیف|کیس|case|cover', 0],
    ['گلس و محافظ صفحه', 'گلس|محافظ صفحه|محافظ لنز|محافظ|glass|هیدروژل|screen protector', 0],
    ['اسپیکر و صوتی', 'اسپیکر|speaker|بلندگو|میکروفن|میکروفون|مایک', 0],
    ['هولدر و پایه', 'هولدر|پایه|نگهدارنده|holder|stand|استند|مونوپاد|سه پایه|پاپ سوکت', 0],
    ['مبدل، هاب و گیرنده', 'مبدل|تبدیل|هاب|otg|دانگل|گیرنده|hub|رابط', 0],
    ['حافظه و فلش', 'فلش مموری|فلش|مموری|کارت حافظه|رم|memory|flash|میکرو اس دی|micro sd|هارد|ssd', 0],
    ['قطعات و تعمیرات', 'ال سی دی|lcd|ال ای دی|oled|تاچ|باتری|battery|برد|فلت|سوکت|درب پشت|شیشه دوربین|هویه|پیچ گوشتی|ابزار', 0],
    [Core.OTHER_CAT, 'قلم|pencil|stylus|لوازم جانبی|جاکارتی|کیف پول|استرپ|بند موبایل|بند گوشی|تگ|ایرتگ|airtag', 0],
    ['قطعات و تعمیرات', 'تعمیر|تعمیرات|اجرت|تعویض', 1] // «تعمیر گوشی سامسونگ» is a repair service, not a phone
  ];
  const HEADS = new Set(['قاب', 'کاور', 'کیف', 'گلس', 'محافظ', 'هولدر', 'پایه', 'نگهدارنده', 'کابل', 'باتری', 'جاکارتی', 'کیس', 'تگ', 'هدفون', 'هندزفری', 'اسپیکر', 'مبدل', 'پاوربانک', 'فلش']);
  Core.CATS = [...new Set(CAT_RULES.map(r => r[0]))];
  const catRx = CAT_RULES.map(([cat, kws, str]) => ({ cat, str, rx: kws.split('|').map(k => new RegExp('(^|\\s)' + Core.norm(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=\\s|$)')) }));
  const STORAGE = /(^|\s)(\d+ ?(گیگ|گیگابایت|ترابایت|ترا|gb|tb)|گیگ|ترابایت)(\s|$)/;
  const guessCache = new Map();
  Core.guessCategory = function (name) {
    const n = Core.norm(name); if (!n) return Core.OTHER_CAT;
    if (guessCache.has(n)) return guessCache.get(n);
    let best = null, bestScore = Infinity;
    catRx.forEach((r, order) => {
      for (const rx of r.rx) {
        const m = rx.exec(n); if (!m) continue;
        const pos = m.index + m[1].length, word = n.slice(pos).split(' ')[0];
        if (order < 4 && pos > 0 && !STORAGE.test(n) && !/^(گوشی|موبایل) /.test(n)) continue; // a phone/brand word inside an accessory name ("تگ گوشی", "قاب سامسونگ") is not a phone
        let sc = pos + (r.str > 0 ? -1000 : r.str < 0 ? 1000 : 0);
        if (order === 3 && (word === 'گوشی' || word === 'موبایل')) sc += 500; // "گوشی سامسونگ …": the brand decides
        if (order < 4 && /^(گوشی|موبایل)( |$)/.test(n)) sc -= 3000; // name starts with «گوشی»: it is a phone
        if (pos === 0 && HEADS.has(word)) sc = -2000; // "قاب …", "کابل …": the first word decides
        sc += order / 100;
        if (sc < bestScore) { bestScore = sc; best = r.cat; }
      }
    });
    const c = best || Core.OTHER_CAT; if (guessCache.size > 20000) guessCache.clear(); guessCache.set(n, c); return c;
  };
  Core.catOf = p => (p.category && String(p.category).trim()) || Core.guessCategory(p.name);
  // categories in use, in the standard order, with counts
  Core.categoryCounts = function (st) {
    const m = new Map(); for (const p of st.products) { const c = Core.catOf(p); m.set(c, (m.get(c) || 0) + 1); }
    const rank = c => { const i = Core.CATS.indexOf(c); return i < 0 ? 900 : c === Core.OTHER_CAT ? 999 : i; };
    return [...m.entries()].map(([cat, n]) => ({ cat, n })).sort((a, b) => rank(a.cat) - rank(b.cat) || a.cat.localeCompare(b.cat, 'fa'));
  };
  Core.catRank = c => { const i = Core.CATS.indexOf(c); return c === Core.OTHER_CAT ? 999 : i < 0 ? 900 : i; };

  /* ───────────── insights (all computed from the data, cached per data version) ───────────── */
  const memo = (fn) => { let k = null, v = null; return (st, ...args) => { const key = [st.invoices, st.invoices.length, st.invoices[st.invoices.length - 1], st.adjusts, st.adjusts.length, st.products, st.products.length].concat(args); if (k && k.length === key.length && k.every((x, i) => x === key[i])) return v; k = key; v = fn(st, ...args); return v; }; };
  const invOrder = (a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id;
  // last price per (type, person, product) and how often each person bought each product
  const priceIndex = memo(st => {
    const last = new Map(), freq = new Map(), typ = new Map();
    st.invoices.slice().sort(invOrder).forEach(inv => inv.items.forEach(l => {
      last.set(inv.type + '|' + inv.personId + '|' + l.productId, { price: l.price, date: inv.date, no: inv.no });
      const fk = inv.type + '|' + inv.personId, m = freq.get(fk) || new Map(); m.set(l.productId, (m.get(l.productId) || 0) + 1); freq.set(fk, m);
      if (l.price > 0) { const tk = (inv.type === 'sale' || inv.type === 'sale_return' ? 'sale' : 'purchase') + '|' + l.productId, arr = typ.get(tk) || []; arr.push(l.price); if (arr.length > 7) arr.shift(); typ.set(tk, arr); }
    }));
    return { last, freq, typ };
  });
  // the price this person last paid/got for this product on the same kind of invoice (sale ↔ sale, purchase ↔ purchase)
  Core.lastPrice = function (st, type, personId, productId) { if (!personId || !productId) return null; return priceIndex(st).last.get(type + '|' + personId + '|' + productId) || null; };
  // the usual price of a product (median of its last few invoices of that side, else its default price), for the «possible typo» hint
  Core.typicalPrice = function (st, type, productId, excludeId) {
    const side = type === 'sale' || type === 'sale_return' ? 'sale' : 'purchase', arr = (priceIndex(st).typ.get(side + '|' + productId) || []).slice();
    if (arr.length) { arr.sort((a, b) => a - b); return arr[Math.floor(arr.length / 2)]; }
    const p = byId(st.products, productId); return p ? (side === 'sale' ? p.salePrice : p.buyPrice) || 0 : 0;
  };
  Core.priceOdd = function (price, usual) { if (!(price > 0) || !(usual > 0)) return false; const r = price / usual; return r >= 4 || r <= 0.25; };
  // same person, same day, same items → probably saved twice
  Core.findDuplicateInvoice = function (st, d, editId) {
    const key = it => it.map(l => l.productId + ':' + l.qty + ':' + l.price).sort().join('|'), k = key(d.items || []);
    return st.invoices.find(i => i.id !== editId && i.type === d.type && i.personId === d.personId && i.date === d.date && key(i.items) === k) || null;
  };
  // phones / tablets need one serial (IMEI) per unit; a product can switch it on or off by hand
  const SERIAL_CATS = new Set(['آیفون', 'گوشی سامسونگ', 'گوشی شیائومی', 'سایر گوشی‌ها', 'تبلت و آیپد']);
  const PHONE_CATS = new Set(['آیفون', 'گوشی سامسونگ', 'گوشی شیائومی', 'سایر گوشی‌ها']);
  // a phone category, also one the user named himself («گوشی ناتینگ»، «موبایل دست دوم») but not accessories («لوازم جانبی گوشی»)
  const ACC_WORDS = /قاب|کاور|گلس|محافظ|کابل|شارژ|لوازم|جانبی|هولدر|کیف|هندزفری|هدفون|قطعات|تعمیر|باتری|ال سی دی|بند|استند|پایه/;
  Core.isPhoneCat = cat => { if (PHONE_CATS.has(cat)) return true; const c = Core.norm(cat || ''); return /گوشی|موبایل|ایفون|phone|mobile/.test(c) && !ACC_WORDS.test(c); };
  const isSerialCat = cat => SERIAL_CATS.has(cat) || Core.isPhoneCat(cat) || /تبلت|ایپد|tablet|ipad/.test(Core.norm(cat || '')) && !ACC_WORDS.test(Core.norm(cat || ''));
  Core.serialAuto = (st, cat) => st.settings.serialAuto !== false && isSerialCat(cat);
  Core.serialRequired = function (st, p) { if (!p) return false; if (p.serialReq === true || p.serialReq === false) return p.serialReq; return st.settings.serialAuto !== false && isSerialCat(Core.catOf(p)); };
  Core.serialProblems = function (st, items) {
    const out = [];
    const seen = new Set();
    (items || []).forEach(l => { const p = byId(st.products, l.productId); if (!Core.serialRequired(st, p)) return; const sn = Core.extractSerials(l.note), n = sn.length;
      if (!Number.isInteger(l.qty)) out.push('«' + p.name + '» سریال‌دار است؛ تعداد باید عدد صحیح باشد.'); else if (n !== l.qty) out.push('«' + p.name + '»: ' + Core.toFa(l.qty) + ' عدد است ولی ' + Core.toFa(n) + ' سریال/IMEI وارد شده.');
      for (const x of sn) { const key = p.id + ':' + x; if (seen.has(key)) out.push('سریال تکراری در فاکتور: ' + x); seen.add(key); }
    });
    return out;
  };
  Core.frequentProducts = function (st, type, personId, n) {
    const m = personId && priceIndex(st).freq.get(type + '|' + personId); if (!m) return [];
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n || 8).map(x => x[0]).filter(id => byId(st.products, id));
  };
  // sales speed per product over the last `days`, plus last sale / last incoming date
  const salesStats = memo((st, today, days) => {
    const from = Core.addDays(today, -days + 1), m = {};
    const g = id => m[id] || (m[id] = { sold: 0, lastSale: null, lastIn: null });
    st.invoices.forEach(inv => inv.items.forEach(l => {
      const x = g(l.productId);
      if (inv.type === 'sale') { if (inv.date >= from && inv.date <= today) x.sold += l.qty; if (!x.lastSale || inv.date > x.lastSale) x.lastSale = inv.date; }
      else if (inv.type === 'sale_return') { if (inv.date >= from && inv.date <= today) x.sold -= l.qty; }
      else if (inv.type === 'purchase') { if (!x.lastIn || inv.date > x.lastIn) x.lastIn = inv.date; }
    }));
    st.adjusts.forEach(a => { if (a.qty > 0) { const x = g(a.productId); if (!x.lastIn || a.date > x.lastIn) x.lastIn = a.date; } });
    return m;
  });
  // o: { days: window for sales speed, lead: days you need to restock, cover: days a purchase should last, stale: days without sale }
  Core.stockInsights = function (st, today, o) {
    o = Object.assign({ days: 60, lead: 7, cover: 30, stale: 60 }, o || {}); today = today || Core.todayISO();
    const ss = salesStats(st, today, o.days), rows = Core.productStats(st), reorder = [], stale = [];
    for (const x of rows) {
      const s = ss[x.product.id] || { sold: 0, lastSale: null, lastIn: null }, rate = Math.max(0, s.sold) / o.days;
      const autoMin = rate > 0 ? Math.max(1, Math.ceil(rate * o.lead)) : 0, min = x.product.minStock > 0 ? x.product.minStock : autoMin;
      const daysLeft = rate > 0 ? x.stock / rate : Infinity;
      x.rate = rate; x.autoMin = autoMin; x.min = min; x.daysLeft = daysLeft; x.lastSale = s.lastSale; x.lastIn = s.lastIn;
      if (rate > 0 && (x.stock <= min || daysLeft <= o.lead)) reorder.push(Object.assign(x, { suggest: Math.max(1, Math.ceil(rate * o.cover - Math.max(0, x.stock))) }));
      const idle = s.lastSale ? Core.diffDays(s.lastSale, today) : (s.lastIn ? Core.diffDays(s.lastIn, today) : 0);
      if (x.stock > 0 && idle >= o.stale && (!s.lastIn || Core.diffDays(s.lastIn, today) >= o.stale)) stale.push(Object.assign(x, { idle }));
    }
    reorder.sort((a, b) => a.daysLeft - b.daysLeft || b.rate - a.rate);
    stale.sort((a, b) => b.value - a.value);
    return { reorder, stale, staleValue: stale.reduce((t, x) => t + x.value, 0) };
  };
  // effective low-stock limit: the one the user set, otherwise ~a week of sales
  Core.autoMins = function (st, today) { const ss = salesStats(st, today || Core.todayISO(), 60), m = {}; for (const id in ss) { const r = Math.max(0, ss[id].sold) / 60; if (r > 0) m[id] = Math.max(1, Math.ceil(r * 7)); } return m; };
  Core.prevRange = function (from, to) { const n = Core.diffDays(from, to) + 1; return { from: Core.addDays(from, -n), to: Core.addDays(from, -1) }; };
  Core.pctChange = (now, before) => (before ? Math.round((now - before) / Math.abs(before) * 100) : (now ? null : 0));
  // revenue / cost / profit per product category (sales minus sale returns, VAT excluded)
  Core.categoryProfit = function (st, from, to) {
    const m = {};
    Core.replay(st, h => {
      if (!h.invoiceId || (from && h.date < from) || (to && h.date > to)) return;
      if (h.type !== 'sale' && h.type !== 'sale_return') return;
      const p = byId(st.products, h.productId), c = p ? Core.catOf(p) : '—', q = Math.abs(h.delta), sg = h.type === 'sale' ? 1 : -1;
      const x = m[c] || (m[c] = { cat: c, qty: 0, rev: 0, cost: 0 }); x.qty += sg * q; x.rev += sg * q * h.unit; x.cost += sg * q * (h.cost != null ? h.cost : h.avg);
    });
    return Object.values(m).map(x => ({ cat: x.cat, qty: r3(x.qty), rev: Math.round(x.rev), cost: Math.round(x.cost), profit: Math.round(x.rev - x.cost), margin: x.rev ? Math.round((x.rev - x.cost) / x.rev * 100) : 0 })).sort((a, b) => b.profit - a.profit);
  };
  // cost of each sale line (for the margin warning on the invoice form): the current average cost,
  // or for a phone with chosen IMEIs the cost of exactly those units
  Core.unitCost = function (st, productId, note, qty) {
    const rp = Core.replay(st), s = rp.stock[productId]; if (!s) return 0;
    const sers = note ? Core.extractSerials(note) : []; if (!sers.length || !s.serialCost || !Core.serialRequired(st, byId(st.products, productId))) return s.avg;
    const n = Math.max(1, qty || sers.length); let cost = 0, k = 0;
    for (const sn of sers) { if (k >= n) break; const c = s.serialCost.has(sn) ? s.serialCost.get(sn) : rp.snCost.get(sn); if (c != null) { cost += c; k++; } }
    return k ? (cost + (n - k) * s.avg) / n : s.avg;
  };

  /* ───────────── serial numbers / IMEI ───────────── */
  Core.luhnOk = function (d) { d = Core.toEn(d); if (!/^\d{15}$/.test(d)) return false; let s = 0; for (let i = 0; i < 15; i++) { let x = +d[14 - i]; if (i % 2) { x *= 2; if (x > 9) x -= 9; } s += x; } return s % 10 === 0; };
  // serial-like tokens in a note: 6–20 letters/digits with at least 4 digits (IMEI, S/N)
  Core.extractSerials = function (text) { const out = []; Core.toEn(String(text || '')).toUpperCase().split(/[^A-Z0-9]+/).forEach(t => { if (t.length >= 6 && t.length <= 20 && (t.match(/\d/g) || []).length >= 4 && out.indexOf(t) < 0) out.push(t); }); return out; };
  const serialIndex = memo(st => {
    const m = new Map();
    st.invoices.slice().sort(invOrder).forEach(inv => inv.items.forEach(l => {
      Core.extractSerials(l.note).forEach(sn => { const a = m.get(sn) || []; a.push({ serial: sn, date: inv.date, type: inv.type, invoiceId: inv.id, no: inv.no, personId: inv.personId, productId: l.productId, price: l.price }); m.set(sn, a); });
    }));
    return m;
  });
  // serials of this product that are in the shop now (last move: bought, or returned by a customer); the invoice being edited doesn't count
  // every product's in-stock serials in one pass (same rows as serialsInStock without editId/wh); used by reports
  const serialsByProduct = memo(st => {
    const m = new Map();
    for (const [sn, ev] of serialIndex(st)) { const last = ev[ev.length - 1]; if (last.type !== 'purchase' && last.type !== 'sale_return') continue; if (!m.has(last.productId)) m.set(last.productId, []); m.get(last.productId).push(sn); }
    return m;
  });
  Core.serialsInStockAll = function (st) { const out = []; st.products.forEach(p => { if (serialsByProduct(st).has(p.id)) Core.serialsInStock(st, p.id).forEach(x => out.push(Object.assign({ p }, x))); }); return out; };
  Core.serialsInStock = function (st, productId, editId, wh) {
    const out = [], loc = wh != null && Core.multiWh(st) ? Core.serialWh(st) : null, idx = serialIndex(st);
    const cand = editId ? idx.keys() : (serialsByProduct(st).get(productId) || []);
    for (const sn of cand) {
      const all = idx.get(sn);
      const ev = editId ? all.filter(e => e.invoiceId !== editId) : all; if (!ev.length) continue;
      const last = ev[ev.length - 1]; if (last.productId !== productId || (last.type !== 'purchase' && last.type !== 'sale_return')) continue;
      const buy = ev.slice().reverse().find(e => e.type === 'purchase') || last;
      if (loc && loc.has(sn) && loc.get(sn) !== +wh) continue;
      out.push({ serial: sn, date: last.date, type: last.type, no: last.no, invoiceId: last.invoiceId, personId: last.type === 'sale_return' ? last.personId : buy.personId, buyFrom: buy.personId, price: buy.price, luhn: sn.length === 15 && /^\d+$/.test(sn) ? Core.luhnOk(sn) : null });
    }
    return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)); // oldest first
  };
  Core.SERIAL_STATE = { purchase: 'در انبار', sale_return: 'در انبار (مرجوع از مشتری)', sale: 'فروخته شده', purchase_return: 'برگشت به تأمین‌کننده' };
  // A serial/IMEI may be searched by the first 3+ characters, last 4+, or middle 6+.
  // Three-digit prefix is intentionally NOT a three-digit substring: it would create too many false hits.
  Core.serialQuery = function (query) {
    const s = Core.toEn(String(query || '')).trim().toUpperCase();
    const m = s.match(/^(?:IMEI|سریال|ایمی)\s*[:：#-]?\s*([A-Z0-9\s-]+)$/i);
    const q = m ? m[1] : s;
    const token = q.replace(/[\s-]/g, '');
    return /^[A-Z0-9]{3,20}$/.test(token) && /\d/.test(token) ? token : '';
  };
  Core.serialMatches = function (serial, query) {
    const q = Core.serialQuery(query); if (!q) return false;
    const sn = Core.toEn(String(serial || '')).toUpperCase().replace(/[^A-Z0-9]/g, '');
    return sn === q || sn.startsWith(q) || (q.length >= 4 && sn.endsWith(q)) || (q.length >= 6 && sn.includes(q));
  };
  Core.serialProductIds = function (st, query) {
    const q = Core.serialQuery(query), ids = new Set(); if (!q) return ids;
    for (const [sn, ev] of serialIndex(st)) if (Core.serialMatches(sn, q) && ev.length) ids.add(ev[ev.length - 1].productId);
    return ids;
  };
  Core.serialHistory = function (st, q, limit) {
    q = Core.serialQuery(q); if (!q) return [];
    const out = [];
    for (const [sn, ev] of serialIndex(st)) {
      if (!Core.serialMatches(sn,q)) continue;
      const last = ev[ev.length - 1]; let buy = null, sale = null;
      ev.forEach(e => { if (e.type === 'purchase') buy = e; if (e.type === 'sale') sale = e; });
      out.push({ serial: sn, events: ev, state: Core.SERIAL_STATE[last.type], inStock: last.type === 'purchase' || last.type === 'sale_return', productId: last.productId, profit: buy && sale && sale.date >= buy.date ? sale.price - buy.price : null, luhn: sn.length === 15 && /^\d+$/.test(sn) ? Core.luhnOk(sn) : null });
      if (out.length >= (limit || 50)) break;
    }
    return out.sort((a, b) => (a.serial === q ? -1 : 0) - (b.serial === q ? -1 : 0));
  };
  // warning for a serial typed on an invoice line (excluding the invoice being edited)
  Core.serialWarning = function (st, serial, type, editId) {
    const ev = (serialIndex(st).get(serial) || []).filter(e => e.invoiceId !== editId); if (!ev.length) return null;
    const last = ev[ev.length - 1], who = (byId(st.people, last.personId) || {}).name || '—', where = ' (فاکتور ' + Core.TYPE_FA[last.type] + ' ' + last.no + '، ' + who + '، ' + Core.fmtDate(last.date) + ')';
    if (type === 'sale' && last.type === 'sale') return 'سریال ' + serial + ' قبلاً فروخته شده است' + where + '.';
    if (type === 'purchase' && (last.type === 'purchase' || last.type === 'sale_return')) return 'سریال ' + serial + ' همین الان در انبار است' + where + '.';
    if (type === 'sale_return' && last.type !== 'sale') return 'سریال ' + serial + ' فروخته نشده که مرجوع شود' + where + '.';
    return null;
  };

  /* ───────────── smart search helpers ───────────── */
  const FINGLISH = { iphone: 'ایفون', ifon: 'ایفون', aifon: 'ایفون', apple: 'اپل', samsung: 'سامسونگ', galaxy: 'گلکسی', xiaomi: 'شیائومی', redmi: 'ردمی', poco: 'پوکو', pro: 'پرو', max: 'مکس', plus: 'پلاس', mini: 'مینی', ultra: 'الترا', cable: 'کابل', kabl: 'کابل', charger: 'شارژر', sharjer: 'شارژر', adapter: 'اداپتور', case: 'قاب', ghab: 'قاب', cover: 'کاور', glass: 'گلس', airpods: 'ایرپاد', airpod: 'ایرپاد', watch: 'واچ', ipad: 'ایپد', gig: 'گیگ', gb: 'گیگ', tb: 'ترابایت', powerbank: 'پاوربانک', holder: 'هولدر', speaker: 'اسپیکر', handsfree: 'هندزفری', headphone: 'هدفون', magsafe: 'مگ سیف', mcdodo: 'مک دودو', anker: 'انکر', lightning: 'لایتنینگ' };
  Core.ALIASES = { 'ایرپاد': 'airpods', 'ایفون': 'iphone', 'اولترا': 'الترا', 'الترا': 'اولترا', 'تایپ سی': 'c', 'شارژ': 'شارژر' };
  // query → normalised words; letters/digits split ("iphone13" → "iphone 13"); Finglish words also get their Persian form
  Core.searchWords = function (q) {
    const n = Core.norm(q).replace(/([a-z])(\d)/g, '$1 $2').replace(/(\d)([a-z])/g, '$1 $2').replace(/([؀-ۿ])(\d)/g, '$1 $2').replace(/(\d)([؀-ۿ])/g, '$1 $2');
    return n.split(' ').filter(Boolean).map(w => [w].concat(FINGLISH[w] ? [FINGLISH[w]] : [], Core.ALIASES[w] ? [Core.ALIASES[w]] : []));
  };
  const lev1 = (a, b, max) => { if (Math.abs(a.length - b.length) > max) return false; const d = []; for (let i = 0; i <= a.length; i++) { d[i] = [i]; } for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) { let rowMin = Infinity; for (let j = 1; j <= b.length; j++) { d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); rowMin = Math.min(rowMin, d[i][j]); } if (rowMin > max) return false; } return d[a.length][b.length] <= max; };
  const normCache = new Map();
  // 0 = no match; higher = better. Every query word must match a word of the text (prefix, inside, or a small typo)
  Core.fuzzyScore = function (text, words) {
    if (!words.length) return 0; let c = normCache.get(text); if (!c) { if (normCache.size > 60000) normCache.clear(); const t0 = Core.norm(text); c = [t0, t0.split(' ')]; normCache.set(text, c); } const t = c[0], tw = c[1]; let score = 0;
    for (const alts of words) {
      let best = 0;
      for (const w of alts) {
        for (const x of tw) {
          if (x === w) best = Math.max(best, 4); else if (x.startsWith(w)) best = Math.max(best, 3); else if (w.length >= 3 && x.includes(w)) best = Math.max(best, 2);
          else if (w.length >= 4 && !/^\d+$/.test(w) && lev1(w, x.slice(0, w.length + 1), w.length >= 7 ? 2 : 1)) best = Math.max(best, 1);
        }
        if (best < 2 && w.length >= 3 && t.includes(w)) best = Math.max(best, 2);
      }
      if (!best) return 0; score += best;
    }
    return score + (words[0].some(w => t.startsWith(w)) ? 1 : 0);
  };

  /* ───────────── smart search engine ─────────────
   * Understands short Persian questions ("چند تا کابل دارم", "قیمت آیفون ۱۳", "علی چقدر بدهکاره", "فروش آیفون این ماه"),
   * Finglish, typos, synonyms (لایتنینگ = Li, تایپ سی = C), number+unit ("1 متر" ≠ "1.2 متر") and ranks by how rare the
   * matched words are (a model code like CA-2261 weighs more than "کابل"). */
  const UNITS = { 'متر': 'متر', 'متری': 'متر', 'm': 'متر', 'سانت': 'سانت', 'سانتی متر': 'سانت', 'cm': 'سانت', 'وات': 'وات', 'w': 'وات', 'گیگ': 'گیگ', 'گیگابایت': 'گیگ', 'gb': 'گیگ', 'g': 'گیگ', 'ترابایت': 'ترا', 'ترا': 'ترا', 'tb': 'ترا', 'امپر': 'امپر', 'a': 'امپر', 'میلی امپر': 'mah', 'mah': 'mah', 'اینچ': 'اینچ', 'inch': 'اینچ', 'پورت': 'پورت', 'کاره': 'کاره' };
  const UNIT_RX = new RegExp('(^|\\s)(\\d+(?:\\.\\d+)?)\\s?(' + Object.keys(UNITS).sort((a, b) => b.length - a.length).join('|') + ')(?=\\s|$)', 'g');
  const PHRASES = [['تایپ سی', 'c'], ['تایپسی', 'c'], ['سی به', 'c به'], ['به سی', 'به c'], ['type c', 'c'], ['typec', 'c'], ['یو اس بی', 'usb'], ['یواس بی', 'usb'], ['پاور بانک', 'پاوربانک'], ['power bank', 'پاوربانک'], ['هندز فری', 'هندزفری'], ['ایر پاد', 'ایرپاد'], ['مگ سیف', 'مگسیف'], ['اپل واچ', 'واچ'], ['ای پد', 'ایپد'], ['مک دودو', 'مکدودو'], ['بی سیم', 'بیسیم'], ['چند تا', 'چندتا'], ['تمام شده', 'تمامشده'], ['این ماه', 'اینماه'], ['ماه قبل', 'ماهقبل'], ['ماه پیش', 'ماهقبل'], ['هفته قبل', 'هفتهقبل'], ['هفته پیش', 'هفتهقبل'], ['این هفته', 'اینهفته'], ['کم دارم', 'کمبود'], ['فروش نرفته', 'نفروخته']];
  const SYN = { lightning: 'li', 'لایتنینگ': 'li', 'لایتنینگی': 'li', 'ایفونی': 'li', 'میکرو': 'micro', 'iphone': 'ایفون', 'ifon': 'ایفون', 'aifon': 'ایفون', 'samsung': 'سامسونگ', 'galaxy': 'گلکسی', 'xiaomi': 'شیائومی', 'شیاومی': 'شیائومی', 'redmi': 'ردمی', 'poco': 'پوکو', 'pro': 'پرو', 'max': 'مکس', 'plus': 'پلاس', 'mini': 'مینی', 'ultra': 'اولترا', 'الترا': 'اولترا', 'cable': 'کابل', 'kabl': 'کابل', 'وایرلس': 'بیسیم', 'wireless': 'بیسیم', 'case': 'قاب', 'cover': 'قاب', 'کاور': 'قاب', 'کیس': 'قاب', 'ghab': 'قاب', 'glass': 'گلس', 'شارژر': 'شارژ', 'اداپتور': 'شارژ', 'کلگی': 'شارژ', 'charger': 'شارژ', 'adapter': 'شارژ', 'sharjer': 'شارژ', 'handsfree': 'هندزفری', 'headphone': 'هدفون', 'هدست': 'هدفون', 'airpods': 'ایرپاد', 'airpod': 'ایرپاد', 'ایربادز': 'ایرپاد', 'powerbank': 'پاوربانک', 'magsafe': 'مگسیف', 'apple': 'اپل', 'watch': 'واچ', 'ipad': 'ایپد', 'آیپد': 'ایپد', 'speaker': 'اسپیکر', 'holder': 'هولدر', 'mcdodo': 'مکدودو', 'white': 'سفید', 'black': 'مشکی', 'سیاه': 'مشکی', 'یواسبی': 'usb', 'تایپسی': 'c', 'موبایل': 'گوشی', 'موبایلها': 'گوشی', 'گوشیها': 'گوشی', 'گوشیهای': 'گوشی', 'موبایلهای': 'گوشی', 'mobile': 'گوشی', 'phone': 'گوشی', 'phones': 'گوشی', 'تلفن': 'گوشی', 'ناتینگ': 'nothing' };
  const STOP = new Set(['چند', 'چندتا', 'چقدر', 'چنده', 'دارم', 'داریم', 'داره', 'دارد', 'هست', 'است', 'هستن', 'کو', 'کجاست', 'لطفا', 'نشون', 'نشان', 'بده', 'بگو', 'ببینم', 'کدوم', 'کدام', 'چی', 'چه', 'همه', 'لیست', 'فهرست', 'ها', 'های', 'رو', 'را', 'از', 'برای', 'با', 'و', 'یه', 'در', 'به', 'تو', 'من', 'مون', 'ام', 'شده', 'اند', 'میخوام', 'می', 'خواهم', 'کن', 'بیار', 'اون', 'این', 'عدد', 'تومن', 'تومان', 'ریال', 'کجا', 'چطور', 'کالا', 'کالاها', 'کالاهای', 'جنس', 'اجناس', 'محصول', 'محصولات', 'مشتری', 'مشتریان', 'شخص', 'اقای', 'اقا', 'خانم', 'اخرین', 'جدید', 'جدیدترین', 'لطفاً', 'باید', 'بدم', 'بدیم', 'کنم', 'کنیم', 'کالاهایی', 'چیزهایی', 'چیا', 'چیه', 'کدومها', 'هایی', 'ای', 'بیشتر', 'کمتر', 'تایپ', 'چقدره', 'چقد', 'چقدری', 'کیه', 'هستش', 'میشه', 'شد', 'بود', 'بوده', 'الان', 'فعلا', 'فعلی', 'کل', 'جمع', 'که', 'نیست', 'نیستن', 'نیستند', 'نداره', 'ندارن', 'ندارم', 'نداریم', 'باشه', 'بودیم', 'بودم', 'زدیم', 'زدم', 'شماره', 'شمارهی', 'یعنی', 'همون', 'همین', 'اینا', 'اونا', 'چیزی', 'چیزایی']);
  const INTENT = {
    stock: ['موجودی', 'موجود', 'انبار', 'مونده', 'باقی', 'تعداد', 'چندتا'], out: ['ناموجود', 'تمامشده', 'تموم', 'تمام', 'نداریم', 'صفر'], price: ['قیمت', 'نرخ', 'فی', 'چنده'],
    balance: ['طلب', 'طلبکار', 'طلبکاره', 'طلبکارها', 'بدهی', 'بدهکار', 'بدهکاره', 'بدهکارها', 'بستانکار', 'بستانکارها', 'مانده', 'حساب', 'بدهیها'],
    invoice: ['فاکتور', 'فاکتورهای', 'فاکتورها', 'خریدهای', 'فروشهای', 'خریدها', 'فروشها'], metric: ['فروش', 'سود', 'درآمد', 'خرید', 'هزینه', 'هزینهها', 'دریافت', 'پرداخت', 'گزارش', 'خلاصه'],
    top: ['پرفروش', 'پرفروشترین', 'بیشترین', 'پرفروشها'], reorder: ['سفارش', 'کمبود', 'کسری'], stale: ['راکد', 'نفروخته', 'خوابیده'], cheque: ['چک', 'چکها', 'سررسید', 'قسط', 'اقساط'],
    period: { 'امروز': 'today', 'دیروز': 'yesterday', 'هفته': 'week', 'اینهفته': 'week', 'هفتهقبل': 'prevweek', 'اینماه': 'mtd', 'ماه': 'mtd', 'ماهقبل': 'prevmonth', 'امسال': 'fytd', 'سال': 'fytd' }
  };
  Core.sTokens = function (text) {
    let s = ' ' + Core.norm(text).replace(/([a-z])(\d)/g, '$1 $2').replace(/(\d)([a-z])/g, '$1 $2').replace(/([؀-ۿ])(\d)/g, '$1 $2').replace(/(\d)([؀-ۿ])/g, '$1 $2') + ' ';
    for (const [a, b] of PHRASES) s = s.split(' ' + a + ' ').join(' ' + b + ' ');
    s = s.replace(/(^|\s)(\d+(?:\.\d+)?)\s(هزار|هزارتایی)(?=\s|$)/g, (m, sp, n) => sp + Math.round(parseFloat(n) * 1000));
    s = s.replace(UNIT_RX, (m, sp, n, u) => sp + n + UNITS[u]);
    return s.trim().split(' ').filter(Boolean).map(t => SYN[t] || t);
  };
  const isNumTok = t => /^\d/.test(t);
  const ACC_HEADS = new Set(['قاب', 'گلس', 'محافظ', 'کابل', 'شارژ', 'هولدر', 'پایه', 'نگهدارنده', 'باتری', 'بند', 'کیف', 'جاکارتی', 'مبدل', 'پاپ']);
  function editLe(a, b, max) { if (Math.abs(a.length - b.length) > max) return false; let prev = Array.from({ length: b.length + 1 }, (_, j) => j); for (let i = 1; i <= a.length; i++) { const cur = [i]; let mn = i; for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (cur[j] < mn) mn = cur[j]; } if (mn > max) return false; prev = cur; } return prev[b.length] <= max; }
  // how well one query word matches one indexed word (0..1)
  function tokMatch(q, t) {
    if (q === t) return 1;
    if (/^\d+(\.\d+)?$/.test(q) && t.startsWith(q) && /^[^\d.]/.test(t.slice(q.length))) return 0.9; // "256" → "256گیگ"
    if (isNumTok(q) || isNumTok(t)) { if (/^\d+$/.test(q) && q.length >= 3 && /^\d+$/.test(t) && t.startsWith(q)) return 0.6; return 0; }
    if (q.length >= 2 && t.startsWith(q)) return q.length >= 3 ? 0.8 : 0.55;
    if (t.length >= 3 && q.startsWith(t) && q.length - t.length <= 3) return 0.6; // "کابلهای" → "کابل"
    if (q.length >= 3 && t.includes(q)) return 0.45;
    if (q.length >= 4 && editLe(q, t.slice(0, q.length + 2), q.length >= 7 ? 2 : 1)) return 0.42;
    return 0;
  }
  // invoice and line notes, tokenised once per data version; a word's matching vocabulary is cached while you type
  const noteIndex = memo(st => {
    const units = [], vocab = new Set(), mc = new Map();
    st.invoices.forEach(inv => { const one = txt => { const toks = Core.sTokens(txt); toks.forEach(t => vocab.add(t)); units.push({ inv, toks }); }; if (inv.note) one(inv.note); inv.items.forEach(l => { if (l.note) one(l.note); }); });
    const match = t => { let m = mc.get(t); if (!m) { if (mc.size > 200) mc.clear(); m = new Set(); for (const x of vocab) if (tokMatch(t, x) >= 0.55) m.add(x); mc.set(t, m); } return m; };
    return { units, match };
  });
  // index over products / people, rebuilt only when the data changes
  Core._pv = 0; // bumped when a product or person is edited in place
  let sixKey = null, sixVal = null;
  const searchIndex = st => { const k = [st.products, st.products.length, st.people, st.people.length, Core._pv]; if (sixKey && k.every((x, i) => x === sixKey[i])) return sixVal; sixKey = k; sixVal = buildIndex(st); return sixVal; };
  const buildIndex = (st => {
    const df = new Map(), add = toks => new Set(toks).forEach(t => df.set(t, (df.get(t) || 0) + 1));
    const prods = st.products.map(p => { const cat = Core.catOf(p), toks = Core.sTokens(p.name + ' ' + (p.sku || '') + ' ' + (p.barcode || '')), ctoks = Core.sTokens(cat).concat(Core.isPhoneCat(cat) ? ['گوشی'] : []); add(toks.concat(ctoks)); return { p, cat, toks, ctoks, str: ' ' + toks.join(' ') + ' ' }; });
    const people = st.people.map(p => { const toks = Core.sTokens(p.name + ' ' + (p.note || '') + ' ' + (p.code || '')); add(toks); return { p, toks, phone: Core.toEn(p.phone || '').replace(/\D/g, ''), str: ' ' + toks.join(' ') + ' ' }; });
    const vocab = [...df.keys()].filter(t => t.length >= 3 && !isNumTok(t));
    return { df, n: Math.max(1, prods.length + people.length), prods, people, vocab };
  });
  const idf = (ix, t) => Math.log(1 + ix.n / (ix.df.get(t) || 1));
  // close meanings, used at a lower weight: «شارژر آیفون» also finds «… اپل»
  const ALT = { 'ایفون': ['اپل', 'li'], 'اپل': ['ایفون'], 'سامسونگ': ['گلکسی'], 'گلکسی': ['سامسونگ'], 'li': ['ایفون'], 'ایرپاد': ['هندزفری'], 'هندزفری': ['ایرپاد', 'هدفون'], 'هدفون': ['هندزفری'], 'شارژ': ['کابل'] };
  function scoreDoc(ix, terms, toks, extra, alt) {
    let sc = 0, hit = 0; const all = extra ? toks.concat(extra) : toks, nt = toks.length;
    if (!ix.tm) ix.tm = new Map(); if (ix.tm.size > 300) ix.tm.clear();
    for (const q of terms) { let best = 0, mq = ix.tm.get(q); if (!mq) { mq = new Map(); ix.tm.set(q, mq); } for (let i = 0; i < all.length; i++) { const t = all[i]; let m = mq.get(t); if (m === undefined) { m = tokMatch(q, t); mq.set(t, m); } if (m) { const v = m * idf(ix, t) * (i < nt ? 1 : 0.6); if (v > best) best = v; } }
      if (!best && alt && ALT[q]) for (const a of ALT[q]) for (const t of all) if (t === a) { const v = 0.55 * idf(ix, t); if (v > best) best = v; }
      if (best) { hit++; sc += best; } }
    return { sc, hit };
  }
  function rankProducts(st, ix, terms, qcats, stockOf, alt) {
    if (!terms.length) return { full: [], partial: [] };
    const phrase = ' ' + terms.join(' ') + ' ', full = [], partial = [];
    for (const d of ix.prods) {
      const r = scoreDoc(ix, terms, d.toks, d.ctoks, alt); if (!r.hit) continue;
      let sc = r.sc;
      if (terms.length > 1 && d.str.includes(phrase)) sc += 1.5;
      if (qcats.size && !qcats.has(d.cat)) sc -= ACC_HEADS.has(d.toks[0]) ? 1.6 : 1; // «قاب سامسونگ A15» when the question was the phone itself
      if (d.toks[0] === terms[0]) sc += 0.6;
      if (qcats.has(d.cat)) sc += 1.8;
      if (stockOf(d.p.id) > 0) sc += 0.35;
      sc -= d.toks.length * 0.02;
      sc += boostOf('p', d.p.id);
      (r.hit === terms.length ? full : partial).push({ p: d.p, cat: d.cat, sc, hit: r.hit });
    }
    const by = (a, b) => b.sc - a.sc || faCmpCore(a.p.name, b.p.name);
    return { full: full.sort(by), partial: partial.filter(x => x.hit >= Math.ceil(terms.length / 2)).sort((a, b) => b.hit - a.hit || by(a, b)) };
  }
  const collator = typeof Intl !== 'undefined' && Intl.Collator ? new Intl.Collator('fa', { numeric: true }) : null;
  const faCmpCore = (a, b) => (collator ? collator.compare(a, b) : String(a).localeCompare(String(b)));
  function rankPeople(ix, terms, digits) {
    const out = [];
    for (const d of ix.people) {
      let sc = 0, hit = 0;
      if (digits && digits.length >= 3 && d.phone && (d.phone.includes(digits) || d.phone.includes(digits.replace(/^(0098|98)/, '0')))) { sc += 5; hit = Math.max(1, terms.length); }
      else { const r = scoreDoc(ix, terms, d.toks); sc = r.sc; hit = r.hit; if (terms.length > 1 && d.str.includes(' ' + terms.join(' ') + ' ')) sc += 2; if (d.toks[0] === terms[0]) sc += 0.5; }
      if (hit && hit >= terms.length) out.push({ p: d.p, sc: sc + boostOf('u', d.p.id) });
    }
    return out.sort((a, b) => b.sc - a.sc || faCmpCore(a.p.name, b.p.name));
  }
  // the categories a query word points at ("کابل" → cables, "شارژر" → chargers)
  const CANON_CAT = { 'شارژ': 'آداپتور و شارژر', 'قاب': 'قاب و کاور', 'گلس': 'گلس و محافظ صفحه', 'هندزفری': 'هندزفری و هدفون', 'هدفون': 'هندزفری و هدفون', 'ایرپاد': 'هندزفری و هدفون', 'مگسیف': 'شارژر وایرلس و مگ‌سیف', 'واچ': 'ساعت هوشمند', 'ایپد': 'تبلت و آیپد' };
  function queryCats(terms, st) { const s = new Set(); if (terms.includes('کابل')) { s.add('کابل شارژ و داده'); return s; } if (terms.includes('گوشی')) { PHONE_CATS.forEach(c => s.add(c)); if (st) st.products.forEach(p => { const c = Core.catOf(p); if (Core.isPhoneCat(c)) s.add(c); }); if (terms.length === 1) return s; } terms.forEach(t => { if (CANON_CAT[t]) { s.add(CANON_CAT[t]); return; } if (t.length < 2 || isNumTok(t)) return; const c = Core.guessCategory(t); if (c !== Core.OTHER_CAT || /قلم|لوازم/.test(t)) s.add(c); }); return s; }
  function didYouMean(ix, terms) { let changed = false; const out = terms.map(t => { if (isNumTok(t) || t.length < 3 || ix.df.has(t) || ix.vocab.some(v => v.startsWith(t))) return t; let best = null, bd = 9; for (const v of ix.vocab) { if (Math.abs(v.length - t.length) > 2) continue; for (let k = 1; k <= 2; k++) if (k < bd && editLe(t, v, k)) { bd = k; best = v; break; } } if (best) { changed = true; return best; } return t; }); return changed ? out.join(' ') : null; }

  // smart match for list filters (pickers, product/people lists): every query word must match; returns a score (0 = no match)
  const mtCache = new Map();
  Core.matchScore = function (text, q) {
    const qt = Core.sTokens(q).filter(t => !STOP.has(t)); if (!qt.length) return 1;
    let tt = mtCache.get(text); if (!tt) { if (mtCache.size > 50000) mtCache.clear(); tt = Core.sTokens(text); mtCache.set(text, tt); }
    let sc = 0;
    for (const x of qt) { let b = 0; for (const t of tt) { const m = tokMatch(x, t); if (m > b) b = m; } if (!b && ALT[x]) for (const a of ALT[x]) if (tt.includes(a)) b = 0.5; if (!b) return 0; sc += b; }
    return sc + (tt[0] === qt[0] ? 0.5 : 0);
  };
  const PRETTY = { li: 'لایتنینگ', c: 'C', 'ایفون': 'آیفون', 'ایپد': 'آیپد', 'شارژ': 'شارژر', 'اداپتور': 'آداپتور', 'ایرپاد': 'ایرپاد', 'مگسیف': 'مگ‌سیف', 'مکدودو': 'مک‌دودو', 'بیسیم': 'بی‌سیم', 'امپر': 'آمپر' };
  Core.prettyTerms = terms => terms.map(t => PRETTY[t] || t.replace(/^(\d+(?:\.\d+)?)(\D+)$/, (m, n, u) => n + ' ' + (u === 'امپر' ? 'آمپر' : u))).join(' ');
  /* ───────────── question understanding (works offline, on the phone) ─────────────
   * Before searching, a question is broken into parts:
   *  · number words → digits («سه تا» → 3 تا، «پنجاه میلیون» → 50000000)
   *  · dates («دیروز»، «هفته پیش»، «۱۵ مهر»، «مهر ۱۴۰۴»، «از اول ماه تا امروز»، «۳ روز اخیر»، «۲ ماه پیش»)
   *  · limits («بالای ۵۰ میلیون»، «کمتر از ۵ تا»، «بیشتر از ۳۰ روز»)
   *  · quantity / amount («۳ تا»، «۵ میلیون تومن»)
   * Verbs keep their person («خریدیم» = we bought, «خریدن» = they bought) and question words decide what is asked («از کی»، «کی»، «چند تا»، «چقدر»). */
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const NUMW = { 'صفر': 0, 'یک': 1, 'یه': 1, 'دو': 2, 'سه': 3, 'چهار': 4, 'پنج': 5, 'شش': 6, 'شیش': 6, 'هفت': 7, 'هشت': 8, 'نه': 9, 'ده': 10, 'یازده': 11, 'دوازده': 12, 'سیزده': 13, 'چهارده': 14, 'پانزده': 15, 'پونزده': 15, 'شانزده': 16, 'شونزده': 16, 'هفده': 17, 'هیفده': 17, 'هجده': 18, 'هیجده': 18, 'نوزده': 19, 'بیست': 20, 'سی': 30, 'چهل': 40, 'پنجاه': 50, 'شصت': 60, 'هفتاد': 70, 'هشتاد': 80, 'نود': 90, 'صد': 100, 'یکصد': 100, 'دویست': 200, 'سیصد': 300, 'چهارصد': 400, 'پانصد': 500, 'پونصد': 500, 'ششصد': 600, 'هفتصد': 700, 'هشتصد': 800, 'نهصد': 900 };
  const NUM_AMBIG = new Set(['یک', 'یه', 'سی', 'نه', 'دو', 'صد', 'ده']);
  const NUM_MULT = { 'هزار': 1e3, 'میلیون': 1e6, 'ملیون': 1e6, 'میلیارد': 1e9, 'ملیارد': 1e9 };
  const COUNTERS = new Set(['تا', 'عدد', 'دستگاه', 'روز', 'روزه', 'هفته', 'ماه', 'ماهه', 'سال', 'متر', 'متری', 'سانت', 'تومن', 'تومان', 'ریال', 'گیگ', 'وات', 'ساعت', 'درصد']);
  const T_UNITS = { 'روز': 1, 'روزه': 1, 'هفته': 7, 'ماه': 30, 'ماهه': 30, 'سال': 365 };
  const T_NAME = { 1: 'روز', 7: 'هفته', 30: 'ماه', 365: 'سال' };
  const OP_GT = new Set(['بالای', 'بالاتر', 'بیشتر', 'بیش', 'بزرگتر', 'حداقل', 'over']), OP_LT = new Set(['زیر', 'کمتر', 'پایینتر', 'پایین', 'کوچکتر', 'حداکثر']);
  const MONEY_U = { 'تومن': 10, 'تومان': 10, 'ریال': 1 }, QTY_U = new Set(['تا', 'عدد', 'دستگاه']);
  const PREV_W = new Set(['قبل', 'پیش', 'گذشته', 'قبلی']);
  const MON = {}; ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'ابان', 'اذر', 'دی', 'بهمن', 'اسفند'].forEach((m, i) => { MON[m] = i + 1; });
  Object.assign(MON, { 'امرداد': 5, 'اردیبهشتماه': 2, 'فروردینماه': 1 });
  const JOIN2 = { 'اردی بهشت': 'اردیبهشت', 'تامین کننده': 'تامینکننده', 'تامین کنندگان': 'تامینکننده', 'تامین کننده ها': 'تامینکننده', 'سود اور': 'سوداور', 'پر سود': 'پرسود', 'پر فروش': 'پرفروش', 'کم فروش': 'کمفروش', 'کم سود': 'کمسود', 'بی حساب': 'بیحساب', 'تسویه نشده': 'تسویهنشده', 'پرداخت نشده': 'تسویهنشده', 'پرداخت نکرده': 'نداده', 'تسویه نکرده': 'نداده', 'پول نداده': 'نداده', 'پول ندادن': 'نداده', 'پول ندادند': 'نداده', 'پس نداده': 'نداده', 'فروش رفته': 'فروختیم', 'فروش رفت': 'فروختیم', 'خرید کرده': 'خریده', 'خرید کردن': 'خریدن', 'خرید کردند': 'خریدن', 'خرید کردیم': 'خریدیم', 'پرداخت کرده': 'داده', 'پرداخت کردیم': 'دادیم', 'واریز کرده': 'داده', 'واریز کردیم': 'دادیم', 'پول داده': 'داده', 'پول دادیم': 'دادیم', 'پول گرفتیم': 'گرفتیم', 'چه کسی': 'کی', 'چه کسانی': 'کیا', 'چه زمانی': 'کی', 'چه وقت': 'کی', 'چه موقع': 'کی', 'کی ها': 'کیا', 'از کجا': 'از کی', 'اخرین بار': 'اخرین', 'چند بار': 'چندبار', 'کم داریم': 'کمبود', 'کم دارم': 'کمبود', 'کم داره': 'کمبود', 'کم اومده': 'کمبود', 'پس فردا': 'پسفردا', 'از ما': 'ازما', 'می ارزه': 'میارزه', 'می ارزد': 'میارزه', 'طرف حساب': 'طرفحساب', 'طرف حسابها': 'طرفحساب' };

  // run of number words / digits → one number
  function numWords(tk) {
    const out = [], isW = t => own(NUMW, t), isD = t => /^\d+(\.\d+)?$/.test(t), isM = t => own(NUM_MULT, t);
    for (let i = 0; i < tk.length;) {
      const t = tk[i]; if (!isW(t) && !isD(t)) { out.push(t); i++; continue; }
      let j = i, total = 0, cur = 0, words = 0, mult = 0, big = 1;
      while (j < tk.length) {
        const x = tk[j];
        if (isW(x) && (j === i || tk[j - 1] === 'و' || isW(tk[j - 1]) || isM(tk[j - 1]))) { cur += NUMW[x]; words++; j++; }
        else if (isD(x) && (j === i || (tk[j - 1] === 'و' && mult))) { cur += parseFloat(x); j++; }
        else if (isM(x) && j > i && !isM(tk[j - 1])) { cur = (cur || 1) * NUM_MULT[x]; total += cur; cur = 0; mult++; big = Math.max(big, NUM_MULT[x]); j++; }
        else if (x === 'و' && j > i && j + 1 < tk.length && (isW(tk[j + 1]) || (isD(tk[j + 1]) && mult))) j++;
        else break;
      }
      if (tk[j - 1] === 'و') j--;
      const accept = mult > 0 || words > 1 || (words === 1 && (!NUM_AMBIG.has(t) || COUNTERS.has(tk[j]) || own(NUM_MULT, tk[j])));
      if (!accept || (words === 0 && mult === 0)) { out.push(t); i++; continue; }
      out.push(String(Math.round((total + cur) * 1000) / 1000)); if (big >= 1e6) out.push('m$'); i = j;
    }
    return out;
  }
  const jRange = (jy, jm) => ({ from: Core.partsToIso(jy, jm, 1), to: Core.partsToIso(jy, jm, Core.monthLenJ(jy, jm)) });
  const shiftM = (jy, jm, n) => { const m = jm - 1 + n; return [jy + Math.floor(m / 12), ((m % 12) + 12) % 12 + 1]; };
  const isNum = t => /^\d+$/.test(t || '');
  // one date expression starting at tk[i] → { from, to, label, k, len } or null
  function dateAtom(tk, i, today, fy) {
    const t = tk[i], n1 = tk[i + 1], n2 = tk[i + 2], p = Core.isoToParts(today), F = Core.toFa;
    const R = (from, to, label, k, len) => ({ from, to, label, k: k || 'custom', len });
    if (!t) return null;
    if (/^dl\d{8}$/.test(t)) { const iso = t.slice(2, 6) + '-' + t.slice(6, 8) + '-' + t.slice(8); return R(iso, iso, Core.fmtDate(iso), 'custom', 1); }
    if (t === 'امروز' || t === 'امشب') return R(today, today, 'امروز', 'today', 1);
    if (t === 'دیروز') { const y = Core.addDays(today, -1); return R(y, y, 'دیروز', 'yesterday', 1); }
    if (t === 'پریروز') { const y = Core.addDays(today, -2); return R(y, y, 'پریروز', 'custom', 1); }
    const fyr = Core.periodRange('fytd', today, fy), fyp = Core.isoToParts(fyr.from);
    const yearBack = n => { const from = Core.partsToIso(fyp.jy - n, fyp.jm, 1), to = Core.addDays(Core.partsToIso(fyp.jy - n + 1, fyp.jm, 1), -1); return [from, to]; };
    if (t === 'فردا') { const y = Core.addDays(today, 1); return R(y, y, 'فردا', 'custom', 1); }
    if (t === 'پسفردا') { const y = Core.addDays(today, 2); return R(y, y, 'پس‌فردا', 'custom', 1); }
    if (t === 'امسال') return R(fyr.from, fyr.to, 'امسال', 'fytd', 1);
    if (t === 'پارسال') { const y = yearBack(1); return R(y[0], y[1], 'پارسال', 'custom', 1); }
    const U = { 'هفته': 7, 'ماه': 30, 'سال': 365 };
    const cur = (u, len, label) => { const k = u === 7 ? 'week' : u === 30 ? 'mtd' : 'fytd', r = Core.periodRange(k, today, fy); return R(r.from, r.to, label || (u === 7 ? 'این هفته' : u === 30 ? 'این ماه' : 'امسال'), k, len); };
    const prev = (u, n, len) => {
      if (u === 7) { const w = Core.weekdayIdx(today), from = Core.addDays(today, -w - 7 * n); return R(from, Core.addDays(from, 6), n === 1 ? 'هفته قبل' : F(n) + ' هفته پیش', n === 1 ? 'prevweek' : 'custom', len); }
      if (u === 30) { const [y, m] = shiftM(p.jy, p.jm, -n), r = jRange(y, m); return R(r.from, r.to, n === 1 ? 'ماه قبل' : Core.MONTHS[m - 1] + ' ' + F(y), n === 1 ? 'prevmonth' : 'custom', len); }
      if (u === 1) { const d = Core.addDays(today, -n); return R(d, d, n === 1 ? 'دیروز' : F(n) + ' روز پیش', n === 1 ? 'yesterday' : 'custom', len); }
      const y = yearBack(n); return R(y[0], y[1], n === 1 ? 'پارسال' : F(n) + ' سال پیش', 'custom', len);
    };
    const last = (days, label, len) => R(Core.addDays(today, -days + 1), today, label, 'custom', len);
    if (t === 'این' && U[n1]) return cur(U[n1], 2 + (n2 === 'جاری' ? 1 : 0));
    if (U[t] && n1 === 'جاری') return cur(U[t], 2);
    if (U[t] && PREV_W.has(n1)) return prev(U[t] === 365 ? 365 : U[t], 1, 2);
    if (U[t] && ['بعد', 'اینده', 'بعدی', 'دیگه'].includes(n1)) { if (U[t] === 7) { const w = Core.weekdayIdx(today), from = Core.addDays(today, 7 - w); return R(from, Core.addDays(from, 6), 'هفته بعد', 'custom', 2); } if (U[t] === 30) { const [y, m] = shiftM(p.jy, p.jm, 1), r = jRange(y, m); return R(r.from, r.to, 'ماه بعد', 'custom', 2); } const a = Core.addDays(Core.partsToIso(fyp.jy + 1, fyp.jm, 1), 0); return R(a, Core.addDays(Core.partsToIso(fyp.jy + 2, fyp.jm, 1), -1), 'سال بعد', 'custom', 2); }
    if (U[t] && n1 === 'اخیر') return last(U[t], U[t] === 7 ? 'هفت روز اخیر' : U[t] === 30 ? 'سی روز اخیر' : 'یک سال اخیر', 2);
    if (t === 'اول' && (U[n1] || (n1 === 'این' && U[n2]))) { const u = U[n1] || U[n2], r = cur(u, n1 === 'این' ? 3 : 2); r.to = today; r.label = 'از اول ' + T_NAME[u === 365 ? 365 : u].replace('سال', 'سال'); return r; }
    if (t === 'اول' && MON[n1]) { const a = dateAtom(tk, i + 1, today, fy); if (a) { a.to = a.from; a.label = 'اول ' + a.label; a.len += 1; return a; } }
    if (isNum(t) && own(T_UNITS, n1) && +t > 0 && +t < 4000) {
      const N = +t, d = T_UNITS[n1];
      if (n2 === 'اخیر' || n2 === 'گذشته') return last(N * d, F(N) + ' ' + T_NAME[d] + ' اخیر', 3);
      if (PREV_W.has(n2)) return prev(d, N, 3);
      return null;
    }
    let j = i, day = null;
    if (isNum(t) && MON[n1] && +t >= 1 && +t <= 31) { day = +t; j = i + 1; }
    const m = tk[j];
    if (MON[m] && !(curIsName && curIsName(m) && !day && tk[j + 1] !== 'ماه' && !['از', 'تا', 'در', 'اول'].includes(tk[i - 1])) && (m !== 'دی' || day || tk[j + 1] === 'ماه' || ['از', 'تا', 'در', 'اول', 'توی', 'تو', 'برای'].includes(tk[i - 1]))) {
      const jm = MON[m]; let k = j + 1; if (tk[k] === 'ماه') k++;
      let jy = p.jy, yGiven = false; if (/^1[34]\d\d$/.test(tk[k] || '')) { jy = +tk[k]; k++; yGiven = true; }
      if (!yGiven && (jm > p.jm || (jm === p.jm && day && day > p.jd))) jy--;
      if (day) { const iso = Core.partsToIso(jy, jm, Math.min(day, Core.monthLenJ(jy, jm))); return R(iso, iso, F(day) + ' ' + Core.MONTHS[jm - 1] + (yGiven || jy !== p.jy ? ' ' + F(jy) : ''), 'custom', k - i); }
      const r = jRange(jy, jm); return R(r.from, r.to, Core.MONTHS[jm - 1] + (yGiven || jy !== p.jy ? ' ' + F(jy) : ''), 'custom', k - i);
    }
    if (U[t] && !isNum(tk[i - 1])) return cur(U[t], 1);
    return null;
  }
  // question → { clean, range, range2, days, cond, qty, amount, dateText }
  Core.understand = function (q, o) {
    o = o || {}; const today = o.today || Core.todayISO(), fy = o.fyMonth || 1;
    let s = Core.toEn(String(q || '')).replace(/(1[34]\d\d)\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{1,2})/g, (x, y, m, d) => { const iso = Core.jalaliToIso(y + '/' + m + '/' + d); return iso ? ' dl' + iso.replace(/-/g, '') + ' ' : x; });
    s = ' ' + Core.norm(s).replace(/[?؟!]|\.(?!\d)|(?<!\d)\./g, ' ').replace(/\s+/g, ' ') + ' ';
    for (const a in JOIN2) s = s.split(' ' + a + ' ').join(' ' + JOIN2[a] + ' ');
    let tk = s.trim().split(' ').filter(Boolean);
    // «گران ترین» → «گرانترین»، «کم سودترین» → «کمسودترین»، «می خریم» → «میخریم»
    const j1 = []; tk.forEach(t => { if ((t === 'ترین' || t === 'تر') && j1.length) j1[j1.length - 1] += t; else j1.push(t); });
    tk = []; j1.forEach((t, i) => { if ((t === 'کم' || t === 'پر') && /ترین$/.test(j1[i + 1] || '')) { j1[i + 1] = t + j1[i + 1]; return; } if ((t === 'می' || t === 'نمی') && j1[i + 1] && /^(خر|فروش|فروخت|د[اه]|ارز)/.test(j1[i + 1])) { j1[i + 1] = t + j1[i + 1]; return; } tk.push(t); });
    tk = numWords(tk);
    const out = { range: null, range2: null, days: null, cond: null, qty: null, amount: null, dateText: '' };
    const money = (v, u) => (u && own(MONEY_U, u) ? Math.round(v * MONEY_U[u]) : Core.parseMoney(String(v)));
    // limits: «بالای ۵۰ میلیون»، «کمتر از ۵ تا»، «بیشتر از ۳۰ روز»
    let k2 = [];
    for (let i = 0; i < tk.length; i++) {
      const t = tk[i]; let op = OP_GT.has(t) ? '>' : OP_LT.has(t) ? '<' : null;
      if (op) { let j = i + 1; if (tk[j] === 'از') j++; if (isNum(tk[j]) || /^\d+\.\d+$/.test(tk[j] || '')) {
        const v = parseFloat(tk[j]); let u = tk[j + 1], used = j + 1;
        if (u === 'm$') { u = null; used++; if (own(MONEY_U, tk[used])) { u = tk[used]; used++; } out.cond = { op, v: money(v, u), money: true }; }
        else if (own(T_UNITS, u)) { out.days = Math.round(v * T_UNITS[u]); used++; out.daysOp = op; }
        else if (own(MONEY_U, u) || (v >= 1000 && !QTY_U.has(u))) { if (own(MONEY_U, u)) used++; out.cond = { op, v: money(v, u), money: true }; }
        else { if (QTY_U.has(u)) used++; out.cond = { op, v, money: false }; }
        out.condText = tk.slice(i, used).join(' '); i = used - 1; continue;
      } }
      k2.push(t);
    }
    tk = k2;
    // dates
    const ranges = [], rest = [], used = [];
    for (let i = 0; i < tk.length;) {
      let a = null, b = null;
      if (tk[i] === 'از' && (a = dateAtom(tk, i + 1, today, fy))) {
        let e = i + 1 + a.len, to = today, label = 'از ' + a.label.replace(/^از /, '');
        if (tk[e] === 'تا' && (b = dateAtom(tk, e + 1, today, fy))) { to = b.to; label += ' تا ' + b.label; e += 1 + b.len; }
        else { if (tk[e] === 'تا' && (tk[e + 1] === 'الان' || tk[e + 1] === 'حالا')) e += 2; if (a.k !== 'mtd' && a.k !== 'week' && a.k !== 'fytd') label += ' تا امروز'; }
        ranges.push({ from: a.from, to: to < a.from ? a.to : to, label, k: b ? 'custom' : (['mtd', 'week', 'fytd', 'today'].includes(a.k) ? a.k : 'custom') }); used.push(tk.slice(i, e).join(' ')); i = e; continue;
      }
      if (tk[i] === 'تا' && !isNum(tk[i - 1]) && (b = dateAtom(tk, i + 1, today, fy))) { ranges.push({ from: null, to: b.to, label: 'تا ' + b.label, k: 'custom' }); used.push(tk.slice(i, i + 1 + b.len).join(' ')); i += 1 + b.len; continue; }
      if ((a = dateAtom(tk, i, today, fy))) { ranges.push(a); used.push(tk.slice(i, i + a.len).join(' ')); i += a.len; continue; }
      // «۳۰ روز» without «اخیر/پیش» = a number of days
      if (isNum(tk[i]) && own(T_UNITS, tk[i + 1])) { out.days = (+tk[i]) * T_UNITS[tk[i + 1]]; used.push(tk[i] + ' ' + tk[i + 1]); i += 2; continue; }
      rest.push(tk[i]); i++;
    }
    out.range = ranges[0] || null; out.range2 = ranges[1] || null; out.dateText = used.join(' ');
    // quantities and amounts
    const r2 = [];
    for (let i = 0; i < rest.length; i++) {
      const t = rest[i], n = rest[i + 1];
      if ((isNum(t) || /^\d+\.\d+$/.test(t)) && QTY_U.has(n) && out.qty == null) { out.qty = parseFloat(t); out.qtyText = t + ' ' + n; i++; continue; }
      if ((isNum(t) || /^\d+\.\d+$/.test(t)) && (n === 'm$' || own(MONEY_U, n))) { let j = i + 1, u = null; if (rest[j] === 'm$') j++; if (own(MONEY_U, rest[j])) { u = rest[j]; j++; } out.amount = money(parseFloat(t), u); out.amountText = rest.slice(i, j).join(' '); i = j - 1; continue; }
      if (t === 'm$') continue;
      r2.push(t);
    }
    out.tokens = r2; out.clean = r2.join(' ');
    return out;
  };
  // what the question asks, from its words
  const W = {
    buy1: ['بخرم', 'بخریم', 'خریدیم', 'خریدم', 'خریدی', 'خریدین', 'خریدید', 'میخریم', 'میخرم', 'بخریم', 'بخرم', 'خریدیمش', 'خریدمش', 'خریدمشون', 'خریدیمشون', 'اوردیم'],
    buy3: ['خریدن', 'خریدند', 'خریده', 'خریدهاند', 'میخره', 'میخرن', 'خریدار', 'خریدارها', 'خریداران', 'خریدش', 'خریداش'],
    sell: ['فروختیم', 'فروختم', 'فروختی', 'فروختین', 'فروختید', 'میفروشیم', 'میفروشم', 'فروختیمش', 'فروختمش', 'فروخته', 'فروختن', 'فروختند', 'فروختیمشون', 'بفروشیم'],
    got: ['گرفتیم', 'گرفتم', 'گرفتی'], gave: ['دادیم', 'دادم', 'دادی'], recv: ['داده', 'دادن', 'دادند', 'پرداخته', 'ریخته', 'داد'],
    unpaid: ['نداده', 'ندادن', 'ندادند', 'نپرداخته', 'نریخته', 'تسویهنشده', 'نسیه', 'نسیهها', 'باز'],
    cmd: ['ثبت', 'بزن', 'بساز', 'صادر', 'بنویس', 'بفروش', 'بخر', 'ایجاد'],
    cmp: ['مقایسه', 'مقایسش', 'نسبت', 'مقایسهی', 'vs'],
    cash: ['صندوق', 'نقدینگی', 'نقد', 'صندوقم'],
    txin: ['دریافتی', 'دریافتیها', 'دریافتها', 'دریافتیهای', 'واریزی', 'واریزیها', 'وصولی'], txout: ['پرداختی', 'پرداختیها', 'پرداختها', 'پرداختیهای'],
    exp: ['هزینه', 'هزینهها', 'هزینههای', 'خرج', 'خرجها', 'مخارج', 'خرجی'],
    hist: ['تاریخچه', 'روند', 'تغییرات', 'تغییر', 'نوسان'],
    supp: ['تامینکننده', 'تامینکنندههای', 'فروشنده', 'فروشندهها', 'بنکدار', 'عمده', 'عمدهفروش'],
    cust: ['مشتری', 'مشتریها', 'مشتریهای', 'مشتریان', 'مشتریام', 'خریدارها'],
    value: ['ارزش', 'میارزه', 'ارزه', 'میارزد'],
    profit: ['سود', 'سودش', 'سودی', 'ضرر', 'سوداوری', 'سوددهی', 'منفعت']
  };
  const SUPERL = { 'گرانترین': ['price', -1], 'گرونترین': ['price', -1], 'ارزانترین': ['price', 1], 'ارزونترین': ['price', 1], 'پرسودترین': ['profit', -1], 'سوداورترین': ['profit', -1], 'کمسودترین': ['profit', 1], 'ضررده': ['profit', 1], 'بدترین': ['profit', 1], 'کمفروشترین': ['sales', 1], 'بهترین': ['best', -1], 'پرفروشترین': ['top', -1], 'بیشترین': ['most', -1], 'کمترین': ['most', 1], 'کمتر': ['most', 1], 'بیشتر': ['most', -1], 'بدهکارترین': ['debt', -1], 'قدیمیترین': ['old', 1] };
  const Q_WORDS = new Set(['کی', 'کیا', 'کسی', 'کسانی', 'زمانی', 'وقت', 'موقع', 'تاریخ', 'چندبار', 'اخرین', 'اولین', 'تعداد', 'مبلغ', 'جوری', 'چطوری', 'نفر', 'کدوما', 'شده', 'رفته', 'کرده', 'کردیم', 'کردن', 'کردند', 'بوده', 'هستند', 'شدن', 'نشده', 'بهمون', 'بهش', 'ازش', 'ازشون', 'بهشون', 'ما', 'مغازه', 'کدامیک', 'کدومشون', 'بیشتری', 'زیاد', 'زیادی', 'خیلی', 'جاری', 'اخیر', 'تا', 'تر', 'ترین', 'الان', 'حالا', 'پول', 'دیگه', 'بعد', 'قبل', 'باهاش']);
  const ALL_W = new Set([].concat(...Object.values(W), Object.keys(SUPERL), [...Q_WORDS]));
  const INTENT_WORDS = new Set([].concat(INTENT.stock, INTENT.out, INTENT.price, INTENT.balance, INTENT.invoice, INTENT.metric, INTENT.top, INTENT.reorder, INTENT.stale, INTENT.cheque, Object.keys(INTENT.period), ['سریال', 'imei', 'ایمی']));
  const PLURAL = /(هایی|های|ها|ای|ان|ا|مون|تون|شون|یم|ید|ند|م|ی|ن|ه|ش)$/;
  function flagsOf(tk) {
    const h = l => tk.some(t => l.includes(t) || (t.length > 3 && !ALL_W.has(t) && !INTENT_WORDS.has(t) && !STOP.has(t) && l.includes(t.replace(PLURAL, '')))), i = tk.indexOf('کی');
    const f = {
      buy1: h(W.buy1), buy3: h(W.buy3), sell: h(W.sell), got: h(W.got), gave: h(W.gave), recv: h(W.recv), unpaid: h(W.unpaid),
      whoFrom: i >= 0 && (tk[i - 1] === 'از' || tk[i - 1] === 'ازما'), whoTo: i >= 0 && ['به', 'برای'].includes(tk[i - 1]),
      who: (i >= 0 && ['از', 'به', 'برای', 'با'].includes(tk[i - 1])) || h(['کیا', 'کسی', 'کسانی']) || tk.some((t, k) => (t === 'کدوم' || t === 'کدام') && (W.cust.includes(tk[k + 1]) || W.supp.includes(tk[k + 1]) || ['شخص', 'نفر', 'مغازه', 'همکار'].includes(tk[k + 1]))),
      when: false, last: h(['اخرین']), first: h(['اولین']),
      howmany: h(['چندتا', 'تعداد', 'چندبار']) || tk.some((t, k) => t === 'چند' && QTY_U.has(tk[k + 1])),
      howmuch: h(['چقدر', 'چقد', 'چقدره', 'مبلغ']) || tk.some((t, k) => t === 'چند' && !QTY_U.has(tk[k + 1]) && tk[k + 1] !== 'بار'),
      cmd: h(W.cmd), cmp: h(W.cmp), cash: h(W.cash) || (h(['پول']) && h(['دارم', 'داریم', 'موجود', 'مونده'])), txin: h(W.txin), txout: h(W.txout), exp: h(W.exp), hist: h(W.hist), supp: h(W.supp), cust: h(W.cust), profit: h(W.profit),
      superl: null
    };
    // «کی» alone: with «خریده/داده» (he/she) = who, with «خریدیم/فروختیم» (we) = when
    if (i >= 0 && !f.who) { const we = f.buy1 || f.sell || h(['بودیم', 'بودم']); if (!we && (f.buy3 || f.recv || f.unpaid || h(['ازما', 'ازمون']))) f.who = true; else f.when = true; }
    if (h(['بودیم', 'بودم']) && f.buy3) { f.buy3 = false; f.buy1 = true; }
    if (f.whoFrom && f.buy3) { f.buy3 = false; f.buy1 = true; }
    if (h(['ازما', 'ازمون'])) { f.who = true; if (f.buy1) { f.buy1 = false; f.buy3 = true; } }
    f.value = h(['ارزش', 'میارزه', 'ارزه', 'میارزد']);
    f.need = h(['باید']) && (f.buy1 || h(['بخرم', 'بخریم', 'سفارش', 'بیارم', 'بیاریم']));
    for (let k = 0; k < tk.length; k++) { const s = SUPERL[tk[k]]; if (s) { f.superl = { by: s[0], dir: s[1], next: tk[k + 1] || '', prev: tk[k - 1] || '' }; break; } }
    return f;
  }
  // invoice lines that match, newest first
  function invLines(st, types, prodIds, persIds, rg) {
    const out = [];
    for (const inv of st.invoices) {
      if (!types.includes(inv.type) || (persIds && !persIds.has(inv.personId)) || (rg && ((rg.from && inv.date < rg.from) || (rg.to && inv.date > rg.to)))) continue;
      Core.invoiceTotals(inv).lines.forEach(l => { if (!prodIds || prodIds.has(l.productId)) out.push({ inv, l }); });
    }
    return out.sort((a, b) => (a.inv.date < b.inv.date ? 1 : a.inv.date > b.inv.date ? -1 : b.inv.id - a.inv.id));
  }
  function groupLines(rows, key) {
    const m = new Map();
    rows.forEach(({ inv, l }) => {
      const sg = /return$/.test(inv.type) ? -1 : 1, id = key === 'product' ? l.productId : inv.personId;
      const x = m.get(id) || { id, qty: 0, amount: 0, inv: new Set(), last: null, lastPrice: 0 };
      x.qty += sg * l.qty; x.amount += sg * l.net; x.inv.add(inv.id); if (sg > 0 && (!x.last || inv.date > x.last)) { x.last = inv.date; x.lastPrice = l.price; }
      m.set(id, x);
    });
    return [...m.values()].map(x => ({ id: x.id, qty: r3(x.qty), amount: Math.round(x.amount), n: x.inv.size, last: x.last, lastPrice: x.lastPrice }));
  }
  // sales, cost and profit per product (sales minus returns, VAT excluded)
  Core.productProfit = function (st, from, to) {
    const m = {};
    Core.replay(st, h => {
      if (!h.invoiceId || (h.type !== 'sale' && h.type !== 'sale_return') || (from && h.date < from) || (to && h.date > to)) return;
      const q = Math.abs(h.delta), sg = h.type === 'sale' ? 1 : -1, x = m[h.productId] || (m[h.productId] = { qty: 0, rev: 0, cost: 0 });
      x.qty += sg * q; x.rev += sg * q * h.unit; x.cost += sg * q * (h.cost != null ? h.cost : h.avg);
    });
    for (const id in m) { const x = m[id]; x.qty = r3(x.qty); x.rev = Math.round(x.rev); x.cost = Math.round(x.cost); x.profit = x.rev - x.cost; x.margin = x.rev ? Math.round(x.profit / x.rev * 100) : 0; }
    return m;
  };
  // the period before a period, of the same kind (for comparisons)
  Core.prevPeriod = function (rg, today) {
    const k = rg.k, t = today;
    if (k === 'today') { const y = Core.addDays(t, -1); return { from: y, to: y, label: 'دیروز', k: 'yesterday' }; }
    if (k === 'yesterday') { const y = Core.addDays(t, -2); return { from: y, to: y, label: 'پریروز', k: 'custom' }; }
    if (k === 'week') { const r = Core.periodRange('prevweek', t); return { from: r.from, to: Core.addDays(r.from, Core.diffDays(rg.from, rg.to < t ? rg.to : t)), label: 'هفته قبل (همین روزها)', k: 'prevweek' }; }
    if (k === 'mtd') { const r = Core.periodRange('prevmonth', t), n = Core.diffDays(rg.from, t), to = Core.addDays(r.from, n); return { from: r.from, to: to > r.to ? r.to : to, label: 'ماه قبل (تا همین روز)', k: 'custom' }; }
    if (k === 'prevmonth') { const p = Core.isoToParts(rg.from), [y, m] = shiftM(p.jy, p.jm, -1), r = jRange(y, m); return Object.assign(r, { label: Core.MONTHS[m - 1], k: 'custom' }); }
    if (k === 'fytd') { const a = Core.isoToParts(rg.from), b = Core.isoToParts(t); const from = Core.partsToIso(a.jy - 1, a.jm, 1), to = Core.partsToIso(b.jy - 1, b.jm, Math.min(b.jd, Core.monthLenJ(b.jy - 1, b.jm))); return { from, to, label: 'سال قبل (تا همین روز)', k: 'custom' }; }
    const from = rg.from || t, to = rg.to && rg.to < t ? rg.to : t, p = Core.prevRange(from, to);
    const fp = Core.isoToParts(from), tp = Core.isoToParts(rg.to || t);
    if (fp.jd === 1 && rg.to && tp.jd === Core.monthLenJ(tp.jy, tp.jm) && fp.jm === tp.jm) { const [y, m] = shiftM(fp.jy, fp.jm, -1), r = jRange(y, m); return Object.assign(r, { label: Core.MONTHS[m - 1], k: 'custom' }); }
    return { from: p.from, to: p.to, label: 'دوره قبل', k: 'custom' };
  };
  function periodNumbers(st, rg, prodIds, persIds) {
    const r = Core.report(st, rg.from, rg.to), o = { revenue: r.revenue, gross: r.gross, net: r.net, expenses: r.expenses, purchases: r.purchases - r.purchaseReturns, n: st.invoices.filter(i => i.type === 'sale' && (!rg.from || i.date >= rg.from) && (!rg.to || i.date <= rg.to)).length };
    if (prodIds || persIds) { const g = invLines(st, ['sale', 'sale_return'], prodIds, persIds, rg); o.qty = r3(g.reduce((t, x) => t + (/return$/.test(x.inv.type) ? -1 : 1) * x.l.qty, 0)); o.itemRev = Math.round(g.reduce((t, x) => t + (/return$/.test(x.inv.type) ? -1 : 1) * x.l.net, 0)); }
    return o;
  }
  let curIsName = null;
  let curBoost = null; // clicks the user made on earlier results: { p: {id: n}, u: {id: n} }
  const boostOf = (kind, id) => { const m = curBoost && curBoost[kind]; const n = m && m[id]; return n ? Math.min(1.2, Math.log(1 + n) * 0.45) : 0; };
  Core.searchKey = q => Core.sTokens(Core.understand(q).clean).filter(t => !STOP.has(t) && !ALL_W.has(t)).sort().join(' ');

  function searchCore(st, q, o) {
    o = o || {}; const today = o.today || Core.todayISO();
    const res = { q, intent: null, terms: [], products: [], partial: false, people: [], cats: [], invoices: [], tx: [], serials: [], answer: null, suggestion: null, ctx: null };
    const raw = Core.toEn(String(q || '')).trim(); if (!raw) return res;
    const ix = searchIndex(st), rp = Core.replay(st), stockOf = id => { const s = rp.stock[id]; return s ? s.stock : 0; };
    const digits = raw.replace(/[\s\-+]/g, '');
    // ── pure numbers: IMEI / serial tail, phone, invoice number, amount, barcode ──
    if (/^\d{3,}$/.test(digits)) {
      res.intent = 'number';
      if (digits.length >= 3) res.serials = Core.serialHistory(st, digits, 10);
      if (/^(0098|98|0)?9\d{1,9}$/.test(digits)) res.people = rankPeople(ix, [], digits).slice(0, 10).map(x => x.p);
      if (digits.length <= 7) res.invoices = st.invoices.filter(i => Core.toEn(i.no) === digits);
      if (digits.length >= 4) { const amt = Core.parseMoney(digits); if (amt) { st.invoices.forEach(i => { if (Core.invoiceTotals(i).total === amt && !res.invoices.includes(i)) res.invoices.push(i); }); res.tx = st.tx.filter(t => t.amount === amt && t.type !== 'invoice').slice(-10); } }
      res.products = st.products.filter(p => (p.barcode && Core.toEn(p.barcode).includes(digits)) || (p.sku && Core.toEn(p.sku).replace(/\D/g, '') === digits)).slice(0, 10).map(p => ({ p, cat: Core.catOf(p), stock: stockOf(p.id) }));
      const byCode = st.people.filter(p => p.code && Core.toEn(p.code).replace(/\D/g, '') === digits); if (byCode.length) res.people = byCode.concat(res.people.filter(p => !byCode.includes(p)));
      if (byCode.length || res.products.some(x => Core.toEn(x.p.sku || '') === digits)) res.codeHit = true;
      return res;
    }
    if (/^(سریال|imei|ایمی)(\s|$)/i.test(raw) || (/[a-z]/i.test(raw) && /\d{4,}/.test(raw) && raw.replace(/\s/g, '').length >= 8 && !/[؀-ۿ]{3,}/.test(raw.replace(/^(سریال|imei|ایمی)/i, '')))) { const sn = raw.replace(/^(سریال|imei|ایمی)\s*/i, ''); res.serials = Core.serialHistory(st, sn, 20); if (res.serials.length) { res.intent = 'serial'; return res; } }
    { // a serial / IMEI inside a sentence («گوشی 490154203237518 کجاست»، «سریال ۷۵۱۸ رو به کی فروختیم»)
      const cand = Core.extractSerials(raw).concat(/(سریال|imei|ایمی)/i.test(raw) ? (raw.match(/\d{3,}/g) || []) : []);
      for (const c of cand) { const h = Core.serialHistory(st, c, 20); if (h.length) { res.serials = h; res.intent = 'serial'; return res; } }
    }
    { // exact code of a person or a product («A-120», «1003»)
      const lc = v => Core.toEn(String(v || '')).trim().toLowerCase(), k = lc(raw); if (k.length >= 2 && !/\s/.test(k)) { const pp = st.people.filter(p => p.code && lc(p.code) === k), pr = st.products.filter(p => p.sku && lc(p.sku) === k); if (pp.length || pr.length) { res.intent = 'find'; res.codeHit = true; res.people = pp; res.products = pr.map(p => ({ p, cat: Core.catOf(p), stock: stockOf(p.id), avg: rp.stock[p.id] ? Math.round(rp.stock[p.id].avg) : 0 })); return res; } }
    }
    // ── understand the question ──
    curIsName = t => ix.people.some(d => d.toks.includes(t));
    const U = Core.understand(raw, o), F = flagsOf(U.tokens);
    const toks = Core.sTokens(U.clean);
    if (F.buy1 || F.buy3) toks.push('خرید'); if (F.sell) toks.push('فروش');
    const rg = U.range ? { from: U.range.from, to: U.range.to } : null, period = U.range ? U.range.k : null, periodLabel = U.range ? U.range.label : null;
    const intentWords = INTENT_WORDS, isWord = t => intentWords.has(t) || ALL_W.has(t) || STOP.has(t);
    const has = list => toks.some(t => list.includes(t) || (t.length > 3 && !isWord(t) && list.includes(t.replace(PLURAL, ''))));
    const terms = [];
    const strip = t => (t.length > 3 ? t.replace(PLURAL, '') : t);
    toks.filter(t => !STOP.has(t) && !intentWords.has(t) && !ALL_W.has(t) && !(t.length > 3 && (intentWords.has(strip(t)) || ALL_W.has(strip(t))))).forEach(t => {
      if (t.length >= 5 && !isNumTok(t) && !ix.df.has(t) && !ix.vocab.some(v => v.startsWith(t))) { for (let k = 2; k <= t.length - 2; k++) { const a = t.slice(0, k), b = t.slice(k); if (ix.df.has(a) && ix.df.has(b)) { terms.push(a, b); return; } } }
      terms.push(t);
    });
    // words that match nothing in the shop's data are treated as filler ("حساب پوریا چقدره" → «پوریا»)
    const known = t => isNumTok(t) || ix.df.has(t) || ix.vocab.some(v => tokMatch(t, v) >= 0.42) || !!ALT[t];
    if (terms.length > 1) { const kept = terms.filter(known); if (kept.length) { terms.length = 0; kept.forEach(t => terms.push(t)); } }
    res.terms = terms; res.range = U.range; res.ctx = { base: U.tokens.filter(t => !Core.sTokens(t).some(x => terms.includes(x))).join(' '), date: U.dateText, extra: [U.condText, U.qtyText, U.amountText].filter(Boolean).join(' '), terms: terms.slice() };
    // a person and a product in one question («آیفون از آرین خریدیم»): split the words
    let pTerms = terms, ppl = terms.length ? rankPeople(ix, terms) : [], split = false;
    if (!ppl.length && terms.length > 1) {
      const pt = terms.filter(t => !isNumTok(t) && t.length >= 2 && ix.people.some(d => d.toks.some(x => tokMatch(t, x) >= 0.8)));
      if (pt.length && pt.length < terms.length) { const pp = rankPeople(ix, pt); if (pp.length) { ppl = pp; pTerms = terms.filter(t => !pt.includes(t)); split = true; } }
    }
    const qcats = queryCats(pTerms, st); let pr = rankProducts(st, ix, pTerms, qcats, stockOf); if (!pr.full.length) { const p2 = rankProducts(st, ix, pTerms, qcats, stockOf, true); if (p2.full.length) pr = p2; }
    let prods = pr.full; if (!prods.length && pr.partial.length) { prods = pr.partial; res.partial = true; }
    // «گوشی» / «موبایل» alone = every phone (iPhone, Samsung, Nothing…), not accessories that mention a phone
    if (pTerms.length && pTerms.every(t => t === 'گوشی')) { const ph = prods.filter(x => Core.isPhoneCat(x.cat)); if (ph.length) prods = ph; }
    if (split && !prods.length) { ppl = []; pTerms = terms; } // the «person» words were part of a product name after all
    const decorate = list => list.map(x => Object.assign(x, { stock: stockOf(x.p.id), avg: rp.stock[x.p.id] ? Math.round(rp.stock[x.p.id].avg) : 0 }));
    const personFirst = ppl.length && (split || !prods.length || ppl[0].sc >= prods[0].sc);
    const persIds = personFirst ? new Set(ppl.slice(0, split ? 1 : 3).map(x => x.p.id)) : null;
    const prodIds = prods.length && (!personFirst || split) ? new Set(prods.slice(0, 80).map(x => x.p.id)) : null;
    res.prodTerms = prodIds ? pTerms : []; res.personIds = persIds ? [...persIds] : [];
    const label = periodLabel;
    const tradeBuy = F.buy1 || (F.got && prodIds) || has(['خرید', 'خریدها', 'خریدهای']) && !F.buy3 && !F.sell;
    const tradeSell = F.sell || F.buy3 || (F.gave && prodIds) || (has(['فروش', 'فروشها', 'فروشهای']) && !F.buy1);
    const haveQ = has(['داریم', 'دارم', 'موجوده', 'داره', 'هست']) && !has(INTENT.price) && !has(INTENT.balance) && !has(INTENT.invoice);
    const outQ = has(INTENT.out) || (has(['موجود', 'موجودی']) && has(['نیست', 'نیستن', 'نیستند', 'نداریم', 'ندارم', 'نداره', 'ندارن']));
    const q3 = (intent, ans) => { res.intent = intent; res.answer = ans; res.people = ppl.slice(0, 3).map(x => x.p); return res; };

    // ── commands: «فاکتور فروش ۲ تا آیفون ۱۶ برای علی»، «دریافت ۵ میلیون از رضا» ──
    const moneyCmd = (has(['دریافت']) || has(['پرداخت'])) && persIds && (U.amount || (terms.length && U.tokens.some(t => /^\d{4,}$/.test(t)))) && !F.howmuch && !F.howmany && !F.who && !rg;
    if ((F.cmd && !F.howmany && !F.howmuch && !F.who && !F.last && !has(['فاکتورها', 'فاکتورهای', 'شده']) && (has(['فاکتور', 'فروش', 'خرید', 'دریافت', 'پرداخت']) || F.buy1 || F.sell || has(['بفروش', 'بخر']))) || moneyCmd) {
      const act = has(['دریافت']) ? 'receipt' : has(['پرداخت']) ? 'payment' : (has(['خرید']) || has(['بخر']) || F.buy1) && !has(['فروش', 'بفروش']) ? 'purchase' : 'sale';
      let amount = U.amount; if (!amount && (act === 'receipt' || act === 'payment')) { const n = U.tokens.find(t => /^\d{4,}$/.test(t)); if (n) amount = Core.parseMoney(n); }
      const items = act === 'sale' || act === 'purchase' ? (prods.length && pTerms.length ? [{ p: prods[0].p, qty: U.qty || 1 }] : []) : [];
      return q3('cmd', { kind: 'cmd', act, person: ppl.length && (personFirst || split) ? ppl[0].p : null, items, amount: amount || 0, alts: prods.slice(1, 4).map(x => x.p) });
    }
    // ── compare two periods ──
    if (F.cmp || (U.range && U.range2)) {
      const a = U.range || Object.assign(Core.periodRange('mtd', today), { label: 'این ماه', k: 'mtd' }), b = U.range2 || Core.prevPeriod(a, today);
      const A = periodNumbers(st, a, prodIds, persIds), B = periodNumbers(st, b, prodIds, persIds);
      return q3('compare', { kind: 'compare', a: { label: a.label, from: a.from, to: a.to, m: A }, b: { label: b.label, from: b.from, to: b.to, m: B }, items: !!(prodIds || persIds), who: persIds ? ppl[0].p : null });
    }
    // ── people who owe for a long time ──
    if ((F.unpaid && !has(INTENT.invoice)) || has(['معوق', 'معوقه', 'دیرکرد', 'بدحساب', 'بدقول']) || (U.days && has(INTENT.balance))) {
      const days = U.days || 30, bal = Core.balances(st), lastPay = {}, firstDebt = {};
      st.tx.forEach(t => { if (t.kind === 'credit') { if (!lastPay[t.personId] || t.date > lastPay[t.personId]) lastPay[t.personId] = t.date; } else if (!firstDebt[t.personId] || t.date < firstDebt[t.personId]) firstDebt[t.personId] = t.date; });
      const rows = st.people.filter(p => (bal[p.id] || 0) > 0 && (!persIds || persIds.has(p.id))).map(p => { const last = lastPay[p.id] || firstDebt[p.id]; return { p, b: bal[p.id], last, paid: !!lastPay[p.id], idle: last ? Core.diffDays(last, today) : 0 }; }).filter(x => x.idle >= days).sort((x, y) => y.b - x.b);
      return q3('overdue', { kind: 'overdue', days, rows: rows.slice(0, 40), total: rows.reduce((t, x) => t + x.b, 0), n: rows.length });
    }
    // ── cash / bank ──
    if (F.cash || (has(['بانک', 'کارت']) && (has(['موجودی', 'مونده']) || F.howmuch))) {
      const c = Core.cashSummary(st), r = rg ? Core.cashSummary(st, rg.from, rg.to) : null;
      const ab = Core.accountBalances(st);
      return q3('cash', { kind: 'cash', bal: Core.cashBalance(st), accts: st.accounts.filter(x => !x.archived || ab[x.id]).map(x => ({ name: acctName(x), bal: ab[x.id], kind: x.kind, id: x.id })), label, period: r });
    }
    // ── list of receipts / payments ──
    const wantIn = F.txin || (persIds && !prodIds && (F.recv || F.got) && (F.howmuch || rg || F.last)) || (has(['دریافت']) && (rg || F.howmuch || persIds) && !tradeBuy && !tradeSell);
    const wantOut = F.txout || (persIds && !prodIds && F.gave && (F.howmuch || rg || F.last)) || (has(['پرداخت']) && (rg || F.howmuch || persIds) && !tradeBuy && !tradeSell);
    if (wantIn || wantOut) {
      const types = wantIn && wantOut ? ['receipt', 'payment'] : wantIn ? ['receipt'] : ['payment'];
      let list = st.tx.filter(t => types.includes(t.type) && (!persIds || persIds.has(t.personId)) && (!rg || ((!rg.from || t.date >= rg.from) && (!rg.to || t.date <= rg.to))));
      if (U.cond && U.cond.money) list = list.filter(t => (U.cond.op === '>' ? t.amount >= U.cond.v : t.amount <= U.cond.v));
      list.sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : y.id - x.id));
      const sum = ty => list.filter(t => t.type === ty).reduce((s, t) => s + t.amount, 0);
      return q3('tx', { kind: 'tx', types, rows: list.slice(0, 40), n: list.length, inSum: sum('receipt'), outSum: sum('payment'), label, who: persIds ? ppl[0].p : null });
    }
    // ── expenses ──
    if (F.exp && !prodIds) {
      const et = pTerms.filter(t => !isNumTok(t)), r = rg || (et.length ? {} : Core.periodRange('mtd', today)), lbl = label || (et.length ? 'از ابتدا' : 'این ماه');
      let list = st.expenses.filter(e => (!r.from || e.date >= r.from) && (!r.to || e.date <= r.to));
      if (et.length) { const f2 = list.filter(e => et.every(t => Core.sTokens(e.title + ' ' + (e.category || '') + ' ' + (e.note || '')).some(x => tokMatch(t, x) >= 0.55))); if (f2.length) list = f2; }
      const cats = {}; list.forEach(e => { const c = e.category || e.title; cats[c] = (cats[c] || 0) + e.amount; });
      list.sort((x, y) => (x.date < y.date ? 1 : -1));
      return q3('expenses', { kind: 'expenses', rows: list.slice(0, 40), n: list.length, total: list.reduce((t, e) => t + e.amount, 0), cats: Object.keys(cats).map(c => ({ c, v: cats[c] })).sort((x, y) => y.v - x.v).slice(0, 8), label: lbl, from: r.from, to: r.to });
    }
    // ── price history of a product ──
    if (F.hist && prodIds && (has(INTENT.price) || tradeBuy || tradeSell || has(['قیمتها', 'قیمتهای']))) {
      const types = tradeSell && !tradeBuy ? ['sale'] : tradeBuy && !tradeSell ? ['purchase'] : ['purchase', 'sale'];
      const rows = invLines(st, types, prodIds, persIds, rg);
      return q3('pricehist', { kind: 'pricehist', types, rows: rows.slice(0, 40), n: rows.length, products: prods.slice(0, 5).map(x => x.p), label });
    }
    // ── who we bought from / who bought from us ──
    const bestCust = !(F.superl && F.superl.by === 'debt') && (F.superl && (F.superl.by === 'best' || F.superl.by === 'most') && (F.cust || F.buy3 || (F.who && tradeSell))) || (F.cust && ((F.superl && F.superl.by !== 'debt' && F.superl.by !== 'price') || has(INTENT.top) || has(['برتر', 'خوب', 'وفادار', 'ثابت'])));
    const bestSupp = (F.superl && (F.superl.by === 'best' || F.superl.by === 'most') && (F.supp || (F.who && F.buy1))) || (F.supp && (F.superl || has(INTENT.top) || has(['برتر', 'اصلی'])));
    const askSupp = bestSupp || (F.who && (F.buy1 || (F.got && prodIds) || (tradeBuy && !F.buy3 && !F.sell))) || (F.supp && prodIds && !F.cust);
    const askCust = bestCust || (F.who && (F.sell || F.buy3 || (F.gave && prodIds) || (has(['فروش']) && !F.buy1))) || (F.cust && prodIds && (tradeSell || F.who));
    if (askSupp || askCust) {
      const type = askSupp && !askCust ? 'purchase' : 'sale', rows = invLines(st, [type, type === 'sale' ? 'sale_return' : 'purchase_return'], prodIds, persIds, rg);
      const g = groupLines(rows, 'person').filter(x => x.qty > 0 || x.amount > 0).sort((x, y) => (bestCust || bestSupp || !prodIds ? y.amount - x.amount : (x.last < y.last ? 1 : x.last > y.last ? -1 : y.amount - x.amount)));
      return q3(type === 'purchase' ? 'suppliers' : 'buyers', { kind: type === 'purchase' ? 'suppliers' : 'buyers', type, rows: g.slice(0, 30).map(x => Object.assign(x, { p: byId(st.people, x.id) })).filter(x => x.p), lines: rows.filter(x => !/return$/.test(x.inv.type)).slice(0, 12), qty: r3(g.reduce((t, x) => t + x.qty, 0)), amount: g.reduce((t, x) => t + x.amount, 0), nProd: prodIds ? prodIds.size : 0, label, best: !!(bestCust || bestSupp) });
    }
    // ── when / last price we bought or sold ──
    const askLast = (F.last || F.when || F.first || (F.howmuch && !F.howmany && (F.buy1 || F.sell) && prodIds && !persIds) || (has(INTENT.price) && has(['خرید']) && !F.howmany)) && (tradeBuy || tradeSell) && (prodIds || persIds);
    if (askLast) {
      const type = tradeBuy && !(F.sell || F.buy3) ? 'purchase' : 'sale', rows = invLines(st, [type], prodIds, persIds, rg);
      if (F.first) rows.reverse();
      const prices = rows.map(x => x.l.price), avgP = prices.length ? Math.round(prices.reduce((t, v) => t + v, 0) / prices.length) : 0;
      return q3('last', { kind: 'last', type, rows: rows.slice(0, 15), n: rows.length, qty: r3(rows.reduce((t, x) => t + x.l.qty, 0)), sum: rows.reduce((t, x) => t + x.l.net, 0), avg: avgP, min: prices.length ? Math.min(...prices) : 0, max: prices.length ? Math.max(...prices) : 0, first: F.first, label, who: persIds ? ppl[0].p : null, products: prods.slice(0, 3).map(x => x.p) });
    }
    // ── how many / how much we sold or bought ──
    if ((F.howmany || F.howmuch || (persIds && (F.buy3 || F.buy1 || F.sell))) && (tradeBuy || tradeSell) && (prodIds || persIds) && !has(INTENT.balance)) {
      const type = tradeBuy && !(F.sell || F.buy3) ? 'purchase' : 'sale', rows = invLines(st, [type, type + '_return'], prodIds, persIds, rg);
      const g = groupLines(rows, 'product').sort((x, y) => y.qty - x.qty);
      return q3('moved', { kind: 'moved', type, qty: r3(g.reduce((t, x) => t + x.qty, 0)), amount: g.reduce((t, x) => t + x.amount, 0), n: new Set(rows.map(x => x.inv.id)).size, rows: g.slice(0, 20).map(x => Object.assign(x, { p: byId(st.products, x.id) })).filter(x => x.p), label: label || 'از ابتدا', who: persIds ? ppl[0].p : null, ask: F.howmany ? 'qty' : 'amount' });
    }
    // ── profit of products ──
    const sup = F.superl;
    if ((F.profit || (sup && sup.by === 'profit')) && (prodIds || (sup && sup.by !== 'top' && sup.by !== 'best')) && !persIds) {
      const r = rg || {}, pp = Core.productProfit(st, r.from, r.to), dir = sup ? (sup.by === 'profit' ? sup.dir : sup.by === 'most' ? sup.dir : -1) : -1;
      let rows = Object.keys(pp).map(id => Object.assign({ p: byId(st.products, +id) }, pp[id])).filter(x => x.p && (!prodIds || prodIds.has(x.p.id)) && (x.qty || x.rev));
      if (F.profit && has(['ضرر']) && !sup) rows = rows.filter(x => x.profit < 0);
      rows.sort((x, y) => dir * (x.profit - y.profit));
      const tot = rows.reduce((t, x) => ({ rev: t.rev + x.rev, cost: t.cost + x.cost, profit: t.profit + x.profit, qty: t.qty + x.qty }), { rev: 0, cost: 0, profit: 0, qty: 0 });
      return q3('pprofit', { kind: 'pprofit', rows: rows.slice(0, 30), n: rows.length, tot, label: label || 'از ابتدا', dir, sup: !!sup });
    }
    // ── superlatives on products: price, stock, slow sellers ──
    if (sup && (sup.by === 'price' || sup.by === 'sales' || (sup.by === 'most' && (has(['موجودی', 'موجود', 'انبار']) || has(INTENT.price) || has(['فروش']))))) {
      const by = sup.by === 'price' || (sup.by === 'most' && has(INTENT.price) && !has(['موجودی'])) ? 'price' : sup.by === 'sales' || (sup.by === 'most' && has(['فروش'])) ? 'sales' : 'stock';
      if (!(by === 'sales' && sup.dir < 0)) {
        let list = (prodIds ? prods.map(x => x.p) : st.products).map(p => ({ p, cat: Core.catOf(p), sc: 0, stock: stockOf(p.id), avg: rp.stock[p.id] ? Math.round(rp.stock[p.id].avg) : 0 }));
        if (by === 'price') list = list.filter(x => x.p.salePrice > 0).sort((a, b) => sup.dir * (a.p.salePrice - b.p.salePrice));
        else if (by === 'stock') list.sort((a, b) => sup.dir * (a.stock - b.stock));
        else { const r = rg || { from: Core.addDays(today, -59), to: today }, sold = {}; invLines(st, ['sale', 'sale_return'], null, null, r).forEach(x => { sold[x.l.productId] = (sold[x.l.productId] || 0) + (/return$/.test(x.inv.type) ? -1 : 1) * x.l.qty; }); list = list.filter(x => x.stock > 0).map(x => Object.assign(x, { sold: r3(sold[x.p.id] || 0) })).sort((a, b) => a.sold - b.sold || b.stock - a.stock); }
        res.products = list.slice(0, 200);
        return q3('super', { kind: 'super', by, dir: sup.dir, label: label || (by === 'sales' ? '۶۰ روز اخیر' : '') });
      }
    }
    // ── what to buy, value of the warehouse, how many people ──
    if ((F.need || has(['کمبود'])) && !prodIds && !persIds) { res.intent = 'reorder'; res.answer = { kind: 'reorder', rows: Core.stockInsights(st, today).reorder.slice(0, 30) }; return res; }
    if (F.value && (has(['انبار', 'موجودی', 'کالا', 'کالاها', 'جنس', 'اجناس']) || prodIds)) {
      const ps = Core.productStats(st).filter(x => (!prodIds || prodIds.has(x.product.id)) && x.stock > 0), cats = {};
      ps.forEach(x => { const c = Core.catOf(x.product); cats[c] = (cats[c] || 0) + x.value; });
      return q3('invvalue', { kind: 'invvalue', value: ps.reduce((t, x) => t + x.value, 0), kinds: ps.length, qty: r3(ps.reduce((t, x) => t + x.stock, 0)), cats: Object.keys(cats).map(c => ({ c, v: cats[c] })).sort((a, b) => b.v - a.v).slice(0, 8), part: !!prodIds });
    }
    if (F.howmany && (F.cust || has(['شخص', 'اشخاص', 'طرفحساب', 'نفر', 'تامینکننده'])) && !pTerms.length && !tradeBuy && !tradeSell) {
      const bal = Core.balances(st), act = st.people.filter(p => !p.archived);
      return q3('pcount', { kind: 'pcount', n: act.length, debtors: act.filter(p => (bal[p.id] || 0) > 0).length, creditors: act.filter(p => (bal[p.id] || 0) < 0).length, archived: st.people.length - act.length });
    }
    // ── balances ──
    if (has(INTENT.balance) || (sup && sup.by === 'debt')) {
      res.intent = 'balance'; const bal = Core.balances(st);
      const list = ppl.length ? ppl.map(x => x.p) : st.people.slice().filter(p => (has(['طلبکار', 'طلبکاره', 'طلبکارها', 'بستانکار', 'بستانکارها']) ? bal[p.id] < 0 : bal[p.id] > 0)).sort((a, b) => Math.abs(bal[b.id] || 0) - Math.abs(bal[a.id] || 0));
      if (U.cond && U.cond.money) { const v = U.cond.v; for (let i = list.length - 1; i >= 0; i--) { const b = Math.abs(bal[list[i].id] || 0); if (U.cond.op === '>' ? b < v : b > v) list.splice(i, 1); } }
      res.answer = { kind: 'balance', rows: list.slice(0, 30).map(p => ({ p, b: bal[p.id] || 0 })), total: list.length, sum: list.reduce((t, p) => t + Math.abs(bal[p.id] || 0), 0) };
      return res;
    }
    if (has(INTENT.cheque)) { res.intent = 'cheque'; const open = st.cheques.filter(c => !c.done).sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1)); res.answer = { kind: 'cheque', rows: (ppl.length ? open.filter(c => ppl.some(x => x.p.id === c.personId)) : open).filter(c => !rg || ((!rg.from || c.dueDate >= rg.from) && (!rg.to || c.dueDate <= rg.to))).slice(0, 30) }; return res; }
    if (has(INTENT.reorder) && (!terms.length || !prods.length)) { res.intent = 'reorder'; res.answer = { kind: 'reorder', rows: Core.stockInsights(st, today).reorder.slice(0, 30) }; return res; }
    if (has(INTENT.stale) && (!terms.length || !prods.length)) { res.intent = 'stale'; res.answer = { kind: 'stale', rows: Core.stockInsights(st, today).stale.slice(0, 30) }; return res; }
    if (has(INTENT.top) || (sup && sup.by === 'top') || (sup && sup.by === 'sales' && sup.dir < 0)) { res.intent = 'top'; const r2 = rg || Core.periodRange('mtd', today); res.answer = { kind: 'top', label: label || 'این ماه', rows: Core.topProducts(st, r2.from, r2.to, 15).filter(x => x.product && (!prodIds || prodIds.has(x.product.id))) }; return res; }
    const unpaidInv = F.unpaid && has(INTENT.invoice);
    if (has(INTENT.invoice) || unpaidInv || (U.cond && U.cond.money && !terms.length) || (has(['خرید', 'فروش']) && !has(INTENT.price) && !period && (ppl.length || prods.length) && terms.length) || (has(['خرید', 'فروش']) && period && terms.length && ppl.length && (split || !prods.length || ppl[0].sc >= prods[0].sc))) {
      res.intent = 'invoices'; const type = has(['خریدهای', 'خریدها', 'خرید']) ? 'purchase' : has(['فروشهای', 'فروشها', 'فروش']) ? 'sale' : null;
      let list = st.invoices.filter(i => (!type || i.type === type) && (!rg || ((!rg.from || i.date >= rg.from) && (!rg.to || i.date <= rg.to))));
      const no = terms.length === 1 && /^\d+$/.test(terms[0]) && (has(['فاکتور', 'شماره']) || !prodIds) ? terms[0] : null; if (no) list = list.filter(i => Core.toEn(i.no) === no);
      else { if (persIds) list = list.filter(i => persIds.has(i.personId)); if (prodIds) list = list.filter(i => i.items.some(l => prodIds.has(l.productId))); }
      if (U.cond && U.cond.money) list = list.filter(i => { const t = Core.invoiceTotals(i).total; return U.cond.op === '>' ? t >= U.cond.v : t <= U.cond.v; });
      if (unpaidInv) list = list.filter(i => Core.invoiceInfo(st, i).remaining > 0);
      res.invoices = list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id)).slice(0, 30);
      res.people = ppl.slice(0, 3).map(x => x.p); res.invType = type; res.invCount = list.length; res.invSum = list.reduce((t, i) => t + Core.invoiceTotals(i).total, 0); res.invLabel = label; res.invUnpaid = unpaidInv; res.invCond = U.cond;
      return res;
    }
    if (rg && (has(INTENT.metric) || !terms.length)) {
      res.intent = 'report'; const r = Core.report(st, rg.from, rg.to);
      const ans = { kind: 'report', label, k: period, rg: { from: rg.from || (st.invoices.length ? st.invoices.reduce((m, i) => (i.date < m ? i.date : m), today) : today), to: rg.to || today }, r, n: st.invoices.filter(i => i.type === 'sale' && (!rg.from || i.date >= rg.from) && (!rg.to || i.date <= rg.to)).length };
      if (terms.length && prods.length) { // sales of these products in the period
        const ids = new Set(prods.map(x => x.p.id)); let qty = 0, rev = 0;
        st.invoices.forEach(i => { if ((rg.from && i.date < rg.from) || (rg.to && i.date > rg.to) || (i.type !== 'sale' && i.type !== 'sale_return')) return; const sg = i.type === 'sale' ? 1 : -1; Core.invoiceTotals(i).lines.forEach(l => { if (ids.has(l.productId)) { qty += sg * l.qty; rev += sg * l.net; } }); });
        ans.items = { qty: r3(qty), rev: Math.round(rev), count: ids.size };
      }
      res.answer = ans; res.products = decorate(prods.slice(0, 10)); return res;
    }
    if ((has(INTENT.stock) || outQ || (U.cond && !U.cond.money)) && !pTerms.length) {
      res.intent = 'stock'; const out = outQ; let list = st.products.map(p => ({ p, cat: Core.catOf(p), sc: 0, stock: stockOf(p.id), avg: rp.stock[p.id] ? Math.round(rp.stock[p.id].avg) : 0 }));
      if (U.cond && !U.cond.money) list = list.filter(x => (U.cond.op === '>' ? x.stock > U.cond.v : x.stock < U.cond.v)); else list = list.filter(x => (out ? x.stock <= 0 : x.stock > 0));
      list.sort((a, b) => (out ? faCmpCore(a.p.name, b.p.name) : U.cond && U.cond.op === '<' ? a.stock - b.stock : b.stock - a.stock)); res.products = list;
      res.answer = { kind: 'stock', total: list.length, inStock: out ? 0 : list.filter(x => x.stock > 0).length, qty: out ? 0 : r3(list.reduce((t, x) => t + Math.max(0, x.stock), 0)), out, all: true, cond: U.cond }; return res;
    }
    if ((has(INTENT.stock) || outQ || has(INTENT.price) || haveQ || (U.cond && !U.cond.money)) && pTerms.length) {
      res.intent = has(INTENT.price) ? 'price' : 'stock';
      let list = decorate(prods);
      if (U.cond && !U.cond.money) list = list.filter(x => (U.cond.op === '>' ? x.stock > U.cond.v : x.stock < U.cond.v));
      else if (outQ) list = list.filter(x => x.stock <= 0); else if (res.intent === 'stock' && (has(['موجود']) || haveQ) && list.some(x => x.stock > 0)) list = list.filter(x => x.stock > 0);
      if (res.intent === 'stock') list.sort((a, b) => (b.stock > 0) - (a.stock > 0) || (b.stock - a.stock) || b.sc - a.sc);
      const inStock = list.filter(x => x.stock > 0); let hidden = 0;
      // a broad question («موجودی گوشی»): show what is in stock; the models at zero are one tap away
      if (res.intent === 'stock' && !outQ && !(U.cond && !U.cond.money) && list.length > 10 && inStock.length) { hidden = list.length - inStock.length; list = inStock; }
      const byCat = {}; inStock.forEach(x => { byCat[x.cat] = r3((byCat[x.cat] || 0) + x.stock); });
      res.answer = { kind: res.intent, total: list.length + hidden, inStock: inStock.length, qty: r3(inStock.reduce((t, x) => t + x.stock, 0)), out: outQ, cond: U.cond, hidden, byCat: Object.keys(byCat).length > 1 ? Object.keys(byCat).map(c => ({ c, q: byCat[c] })).sort((x, y) => y.q - x.q) : null };
      res.products = list; if (!list.length) res.suggestion = didYouMean(ix, terms); return res;
    }
    // ── plain search ──
    res.intent = 'find';
    res.products = decorate(prods); res.people = ppl.slice(0, 10).map(x => x.p);
    const cc = Core.categoryCounts(st); res.cats = cc.filter(c => qcats.has(c.cat) || (terms.length && terms.every(t => Core.sTokens(c.cat).some(x => tokMatch(t, x) >= 0.55))));
    if (raw.length >= 3 && terms.length) { const NI = noteIndex(st), ms = terms.map(t => NI.match(t)); for (const u of NI.units) { if (res.invoices.length >= 10) break; if (res.invoices[res.invoices.length - 1] === u.inv) continue; if (ms.every(m => u.toks.some(x => m.has(x)))) res.invoices.push(u.inv); } }
    if (!res.products.length && !res.people.length && !res.cats.length && !res.invoices.length) res.suggestion = didYouMean(ix, terms);
    return res;
  }

  // follow-up questions: «موجودی آیفون ۱۶» → «۱۷ چی؟» = «موجودی آیفون ۱۷»; «فروش امروز» → «دیروز چی؟»
  const FOLLOW_END = new Set(['چی', 'چطور', 'چطوره', 'چه', 'چیا', 'چطوری']), FOLLOW_START = new Set(['و', 'اون', 'همین', 'حالا', 'پس', 'اونم', 'اینم']);
  function followUp(st, prev, q, o) {
    const tk = Core.norm(q).replace(/[?؟!]|\.(?!\d)|(?<!\d)\./g, ' ').trim().split(' ').filter(Boolean); if (!tk.length || tk.length > 6) return null;
    const isF = FOLLOW_END.has(tk[tk.length - 1]) || FOLLOW_START.has(tk[0]); if (!isF) return null;
    const body = tk.filter((t, i) => !(i === tk.length - 1 && FOLLOW_END.has(t)) && !(i === 0 && FOLLOW_START.has(t))).join(' '); if (!body) return null;
    const U = Core.understand(body, o), F = flagsOf(U.tokens), nt = Core.sTokens(U.clean).filter(t => !STOP.has(t) && !ALL_W.has(t));
    // a full new question is not a follow-up
    const intentish = nt.some(t => INTENT.balance.includes(t) || INTENT.price.includes(t) || INTENT.stock.includes(t) || INTENT.invoice.includes(t)) || F.who || F.howmany || F.howmuch || F.cmp;
    if (intentish) return null;
    const pc = prev.ctx; let terms = pc.terms.slice();
    if (nt.length) {
      if (nt.every(isNumTok)) nt.forEach(n => { const plain = /^\d+(\.\d+)?$/.test(n), k = terms.findIndex(t => (plain ? /^\d+(\.\d+)?$/.test(t) : t.replace(/^[\d.]+/, '') === n.replace(/^[\d.]+/, '') && isNumTok(t))); if (k >= 0) terms[k] = n; else terms.push(n); });
      else {
        const ix = searchIndex(st), rp = Core.replay(st), stockOf = id => (rp.stock[id] ? rp.stock[id].stock : 0);
        const app = terms.concat(nt), qc = queryCats(nt);
        const isPerson = rankPeople(ix, nt).length && !rankProducts(st, ix, nt, qc, stockOf).full.length;
        terms = !isPerson && !qc.size && terms.length && rankProducts(st, ix, app, queryCats(app), stockOf).full.length ? app : nt;
      }
    }
    const merged = [pc.base, U.dateText || pc.date, pc.extra, terms.join(' ')].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    return merged && Core.norm(merged) !== Core.norm(prev.q) ? merged : (U.dateText ? merged : null);
  }
  // related questions to offer under the answer
  function related(r) {
    const T = r.prodTerms && r.prodTerms.length ? Core.toFa(Core.prettyTerms(r.prodTerms)) : '';
    const P = r.personIds && r.personIds.length && r.people[0] ? r.people[0].name : (r.intent === 'find' && r.people.length === 1 && !r.products.length ? r.people[0].name : '');
    let a = [];
    if (T && (r.products.length || r.answer)) {
      const m = { stock: ['قیمت ' + T, T + ' از کی خریدیم', 'چند تا ' + T + ' فروختیم', 'سود ' + T + ' امسال'], price: ['آخرین قیمت خرید ' + T, 'تاریخچه قیمت ' + T, 'موجودی ' + T, T + ' به کی فروختیم'], suppliers: ['آخرین خرید ' + T, 'تاریخچه قیمت ' + T, T + ' به کی فروختیم', 'موجودی ' + T], buyers: [T + ' از کی خریدیم', 'چند تا ' + T + ' فروختیم', 'سود ' + T + ' امسال', 'موجودی ' + T], last: [T + ' از کی خریدیم', 'تاریخچه قیمت ' + T, 'موجودی ' + T], moved: ['سود ' + T + ' امسال', T + ' به کی فروختیم', 'مقایسه فروش ' + T + ' این ماه با ماه قبل'], pprofit: ['چند تا ' + T + ' فروختیم', T + ' به کی فروختیم', 'تاریخچه قیمت ' + T], pricehist: [T + ' از کی خریدیم', 'موجودی ' + T, 'سود ' + T + ' امسال'] };
      a = m[r.intent] || ['موجودی ' + T, 'قیمت ' + T, T + ' از کی خریدیم', T + ' به کی فروختیم', 'سود ' + T + ' امسال'];
    } else if (P) a = ['حساب ' + P, 'فاکتورهای ' + P, P + ' امسال چقدر خرید کرده', 'دریافتی‌های ' + P, 'از ' + P + ' چقدر خریدیم'];
    else if (['report', 'compare', 'top', 'expenses', 'cash'].includes(r.intent)) a = ['مقایسه این ماه با ماه قبل', 'پرسودترین کالاهای این ماه', 'هزینه‌های این ماه', 'بهترین مشتری‌های امسال', 'موجودی صندوق'];
    else if (['balance', 'overdue', 'tx'].includes(r.intent)) a = ['کیا بیشتر از ۳۰ روزه پول ندادن', 'بدهکارها', 'دریافتی‌های این هفته', 'فاکتورهای تسویه نشده'];
    const nq = Core.norm(r.q || '');
    return a.filter(x => Core.norm(x) !== nq).slice(0, 4);
  }
  Core.search = function (st, q, o) {
    o = o || {}; curBoost = o.boost || null;
    try {
      const prev = o.prev; let r = null;
      if (prev && prev.ctx && prev.q && Core.norm(prev.q) !== Core.norm(q)) { const m = followUp(st, prev, q, o); if (m) { r = searchCore(st, m, o); if (r.intent && r.intent !== 'find' || r.products.length || r.people.length) { r.followup = m; r.q = q; } else r = null; } }
      if (!r) r = searchCore(st, q, o);
      r.alts = related(r); return r;
    } finally { curBoost = null; curIsName = null; }
  };

  /* products backup (export / import), for moving or rebuilding the warehouse */
  Core.exportProducts = function (st) {
    const rp = Core.replay(st);
    const products = st.products.map(p => { const s = rp.stock[p.id] || { stock: 0, avg: 0 }; return { name: p.name, category: Core.catOf(p), catManual: !!p.category, sku: p.sku || '', barcode: p.barcode || '', unit: p.unit, salePrice: p.salePrice, buyPrice: p.buyPrice, minStock: p.minStock, stock: Math.max(0, s.stock), avg: Math.round(s.avg) }; });
    return JSON.stringify({ app: 'fixquick-products', version: 1, exportedAt: new Date().toISOString(), products });
  };
  // accepts the products backup (JSON), a full app backup, or plain text with one product name per line
  Core.parseProducts = function (text) {
    text = String(text || '').replace(/^﻿/, '');
    let o = null; try { o = JSON.parse(text); } catch (e) { o = null; }
    const num = v => { const n = Core.parseNum(v); return isFinite(n) && n > 0 ? n : 0; };
    if (o && typeof o === 'object') {
      let list = null, full = null;
      if (o.app === 'fixquick-products' && Array.isArray(o.products)) list = o.products;
      else if (o.app === 'fixquick-accounting' && o.data && Array.isArray(o.data.products)) { full = o.data; list = o.data.products; }
      else return err('این فایل، پشتیبان کالاهای این برنامه نیست.');
      if (full) { const rp = Core.replay(Object.assign(Core.emptyState(), full)); list = list.map(p => { const s = rp.stock[p.id] || { stock: 0, avg: 0 }; return Object.assign({}, p, { catManual: !!p.category, stock: Math.max(0, s.stock), avg: Math.round(s.avg) }); }); }
      const items = list.filter(p => p && String(p.name || '').trim()).map(p => ({ name: String(p.name).trim(), category: p.catManual ? String(p.category || '').trim() : '', sku: String(p.sku || ''), barcode: String(p.barcode || ''), unit: String(p.unit || 'عدد'), salePrice: Math.round(num(p.salePrice)), buyPrice: Math.round(num(p.buyPrice)), minStock: num(p.minStock), stock: Math.round(num(p.stock) * 1000) / 1000, avg: Math.round(num(p.avg)) }));
      return ok({ items });
    }
    const items = Array.from(new Set(text.split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean))).map(name => ({ name }));
    if (!items.length) return err('فایل خالی است.');
    return ok({ items });
  };
  // adds products that don't exist yet (same name = skipped); stock comes in as opening stock at its average cost
  Core.importProducts = function (st, items, o) {
    o = o || {}; const names = new Set(st.products.map(p => p.name)), codes = new Set(st.products.map(p => p.barcode).filter(Boolean));
    let added = 0, dup = 0, withStock = 0; const date = o.date || Core.todayISO();
    for (const it of items) {
      const name = String(it.name || '').trim(); if (!name) continue;
      if (names.has(name)) { dup++; continue; }
      const bc = it.barcode && !codes.has(it.barcode) ? it.barcode : '';
      const p = { id: nid(st), name, barcode: bc, sku: String(it.sku || '').trim(), unit: String(it.unit || 'عدد').trim() || 'عدد', minStock: Math.max(0, Number(it.minStock) || 0), salePrice: Math.max(0, Math.round(it.salePrice) || 0), buyPrice: Math.max(0, Math.round(it.buyPrice) || 0) };
      if (it.category && Core.guessCategory(name) !== it.category) p.category = it.category;
      st.products.push(p); names.add(name); if (bc) codes.add(bc); added++;
      if (o.stock && it.stock > 0) { st.adjusts.push({ id: nid(st), productId: p.id, qty: Math.round(it.stock * 1000) / 1000, cost: Math.round(it.avg || it.buyPrice || 0), date, note: 'موجودی اولیه (ورود از فایل)', opening: true }); withStock++; }
    }
    return ok({ added, dup, withStock });
  };
  // empty the warehouse: o.products → also delete the products themselves; stock always goes (stock entries + the invoices that moved it)
  Core.clearWarehouse = function (st, o) {
    o = o || {};
    const r = Core.resetData(st, { adjusts: true, invoices: true });
    if (!r.ok) return r;
    if (o.products) r.state.products = [];
    return ok({ state: r.state, removed: Object.assign(r.removed, { products: o.products ? st.products.length : 0 }) });
  };

  Core.productUsed = (st, id) => st.invoices.some(i => i.items.some(l => l.productId === id)) || (st.whTx || []).some(x => x.items.some(l => l.productId === id)) || st.adjusts.some(a => a.productId === id);
  Core.deleteProduct = function (st, id) {
    if (Core.productUsed(st, id)) return err('این کالا در فاکتور یا تعدیل انبار استفاده شده و حذف نمی‌شود.');
    st.products = st.products.filter(p => p.id !== id); return ok();
  };

  /* ───────────── invoices ───────────── */
  Core.invoiceTotals = function (inv) {
    const lines = inv.items.map(l => ({ productId: l.productId, qty: l.qty, price: l.price, note: l.note || '', gross: Math.round(l.qty * l.price) }));
    const sub = lines.reduce((s, l) => s + l.gross, 0);
    const discount = Math.min(inv.discount || 0, sub);
    let left = discount;
    lines.forEach((l, i) => { // proportional discount allocation, remainder on last line
      const share = i === lines.length - 1 ? left : (sub ? Math.round(discount * l.gross / sub) : 0);
      l.discount = Math.min(share, l.gross); left -= l.discount; l.net = l.gross - l.discount;
    });
    const vatRate = Math.max(0, Number(inv.vatRate) || 0), vat = Math.round((sub - discount) * vatRate / 100);
    return { sub, discount, vatRate, vat, total: sub - discount + vat, lines };
  };

  // Chronological replay with moving weighted-average cost.
  let replayCache = null;
  Core.replay = function (st, hook) {
    if (!hook) {
      const k = [st.invoices, st.invoices.length, st.invoices[st.invoices.length - 1], st.adjusts, st.adjusts.length, st.adjusts[st.adjusts.length - 1], st.products, st.products.length, Core._pv, st.settings && st.settings.serialCostFrom, st.settings && st.settings.serialAuto];
      if (replayCache && replayCache.k.every((v, i) => v === k[i])) return replayCache.r;
      const r = replayRaw(st); replayCache = { k, r }; return r;
    }
    return replayRaw(st, hook);
  };
  /* Costing. Ordinary goods: moving weighted average. Goods sold by serial / IMEI (phones): specific identification —
     selling a given IMEI costs exactly what that unit was bought for; a unit sold without a known serial leaves from the
     un-numbered stock at its average, otherwise the oldest numbered unit goes first. From settings.serialCostFrom on
     (empty = from the start); before that date everything is averaged, so closed years never change. */
  const snCache = new Map(); let ssKey = null, ssVal = null;
  const serialSet = st => { if (!st.settings) return new Set(); const k = [st.products, st.products.length, Core._pv, st.settings.serialAuto]; if (ssKey && k.every((x, i) => x === ssKey[i])) return ssVal; ssKey = k; ssVal = new Set(st.products.filter(p => Core.serialRequired(st, p)).map(p => p.id)); return ssVal; };
  function replayRaw(st, hook) {
    const S = {}; const get = id => S[id] || (S[id] = { stock: 0, avg: 0 });
    const cogs = {}, adjEffect = {}, errors = [], snCost = new Map();
    const from = (st.settings && st.settings.serialCostFrom) || '', serialP = serialSet(st);
    const ev = [];
    st.invoices.forEach(inv => ev.push({ date: inv.date, id: inv.id, inv }));
    st.adjusts.forEach(a => ev.push({ date: a.date, id: a.id, adj: a }));
    const op = e => (e.adj && e.adj.opening ? 0 : 1); // opening stock first on its day
    ev.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : op(a) - op(b) || a.id - b.id);
    // numbered units of a serial product: s.units = Map(serial → unit cost, null before the cut-over date)
    const unitsOf = s => s.units || (s.units = new Map());
    const trim = s => { const u = unitsOf(s), max = Math.max(0, Math.floor(s.stock + 1e-9)); while (u.size > max) u.delete(u.keys().next().value); };
    const toSpec = s => { if (s.spec) return; s.spec = true; s.val = Math.max(s.stock, 0) * s.avg; const u = unitsOf(s); for (const k of u.keys()) u.set(k, s.avg); s.idv = u.size * s.avg; }; // cut-over: units in stock keep the average they had
    const settle = s => { if (s.stock <= 1e-9) { if (s.stock > -1e-9) { s.stock = 0; s.val = 0; } unitsOf(s).clear(); s.idv = 0; } else s.avg = s.val / s.stock; };
    const sersOf = note => { if (!note) return []; let r = snCache.get(note); if (!r) { if (snCache.size > 20000) snCache.clear(); r = Core.extractSerials(note); snCache.set(note, r); } return r; };
    // take q units out of a specific-cost product: the named serials first, then un-numbered stock at its average, then the oldest numbered units
    const takeOut = (s, q, sers) => {
      const u = unitsOf(s); let cost = 0, left = q;
      for (const sn of sers) { if (left < 1 - 1e-9) break; if (u.has(sn)) { const k = u.get(sn); cost += k; s.idv -= k; u.delete(sn); left = r3(left - 1); } }
      if (left > 1e-9) { const aq = Math.max(0, r3(s.stock - (q - left) - u.size)), av = Math.max(0, s.val - cost - s.idv), fromAnon = Math.min(left, aq); if (fromAnon > 0) { cost += aq > 0 ? av * fromAnon / aq : 0; left = r3(left - fromAnon); } }
      while (left > 1e-9 && u.size) { const k = u.keys().next().value, take = Math.min(1, left), c0 = u.get(k); cost += c0 * take; if (take >= 1 - 1e-9) { u.delete(k); s.idv -= c0; } left = r3(left - take); }
      if (left > 1e-9) cost += left * s.avg; // more out than in (refused elsewhere): last known cost
      return cost;
    };
    for (const e of ev) {
      if (e.inv) {
        const inv = e.inv, tot = Core.invoiceTotals(inv); let c = 0;
        for (const l of tot.lines) {
          const s = get(l.productId), isSer = serialP.has(l.productId), sers = isSer ? sersOf(l.note) : [];
          if (isSer && inv.date >= from && s.stock >= -1e-9) {
            toSpec(s); const u = unitsOf(s); let unitCost = 0;
            if (inv.type === 'purchase') {
              const unit = l.qty > 0 ? l.net / l.qty : 0; let n = Math.floor(l.qty + 1e-9);
              for (const sn of sers) { if (!n) break; if (!u.has(sn)) { u.set(sn, unit); s.idv += unit; snCost.set(sn, unit); n--; } }
              s.stock = r3(s.stock + l.qty); s.val += l.net; settle(s); unitCost = unit;
              if (hook) hook({ date: inv.date, productId: l.productId, delta: l.qty, stock: s.stock, avg: s.avg, cost: unit, label: 'خرید - فاکتور ' + inv.no, invoiceId: inv.id, type: inv.type, unit });
            } else if (inv.type === 'sale' || inv.type === 'purchase_return') {
              if (s.stock < l.qty - 1e-9) errors.push({ invoiceId: inv.id, productId: l.productId, need: l.qty, have: s.stock });
              const cost = takeOut(s, l.qty, sers); unitCost = l.qty ? cost / l.qty : 0;
              if (inv.type === 'sale') sers.forEach(sn => snCost.has(sn) || snCost.set(sn, unitCost));
              c += inv.type === 'sale' ? Math.round(cost) : Math.round(cost) - l.net; s.val -= cost; s.stock = r3(s.stock - l.qty); settle(s);
              if (hook) hook({ date: inv.date, productId: l.productId, delta: -l.qty, stock: s.stock, avg: s.avg, cost: unitCost, label: (inv.type === 'sale' ? 'فروش' : 'برگشت از خرید') + ' - فاکتور ' + inv.no, invoiceId: inv.id, type: inv.type, unit: l.net / l.qty });
            } else if (inv.type === 'sale_return') {
              let cost = 0, n = Math.floor(l.qty + 1e-9), back = 0; // a returned IMEI comes back at the cost it was bought for
              for (const sn of sers) { if (!n) break; if (!u.has(sn)) { const k = snCost.has(sn) ? snCost.get(sn) : s.avg; u.set(sn, k); s.idv += k; cost += k; n--; back++; } }
              cost += (l.qty - back) * s.avg; unitCost = l.qty ? cost / l.qty : 0;
              c -= Math.round(cost); s.val += cost; s.stock = r3(s.stock + l.qty); settle(s);
              if (hook) hook({ date: inv.date, productId: l.productId, delta: l.qty, stock: s.stock, avg: s.avg, cost: unitCost, label: 'برگشت از فروش - فاکتور ' + inv.no, invoiceId: inv.id, type: inv.type, unit: l.net / l.qty });
            }
            continue;
          }
          if (isSer) { // before the cut-over: average cost, but remember which numbered units are in stock
            const u = unitsOf(s); s.spec = false;
            if (inv.type === 'purchase' || inv.type === 'sale_return') { let n = Math.floor(l.qty + 1e-9); for (const sn of sers) { if (!n) break; if (!u.has(sn)) { u.set(sn, null); n--; } } }
            else sers.forEach(sn => u.delete(sn));
          }
          if (inv.type === 'purchase') {
            const base = Math.max(s.stock, 0), ns = r3(base + l.qty);
            s.avg = ns > 0 ? (base * s.avg + l.net) / ns : s.avg; s.stock = r3(s.stock + l.qty);
            if (hook) hook({ date: inv.date, productId: l.productId, delta: l.qty, stock: s.stock, avg: s.avg, cost: l.net / l.qty, label: 'خرید - فاکتور ' + inv.no, invoiceId: inv.id, type: inv.type, unit: l.net / l.qty });
          } else if (inv.type === 'sale') {
            if (s.stock < l.qty - 1e-9) errors.push({ invoiceId: inv.id, productId: l.productId, need: l.qty, have: s.stock });
            c += Math.round(l.qty * s.avg); s.stock = r3(s.stock - l.qty);
            if (hook) hook({ date: inv.date, productId: l.productId, delta: -l.qty, stock: s.stock, avg: s.avg, cost: s.avg, label: 'فروش - فاکتور ' + inv.no, invoiceId: inv.id, type: inv.type, unit: l.net / l.qty });
          } else if (inv.type === 'sale_return') {
            c -= Math.round(l.qty * s.avg); s.stock = r3(s.stock + l.qty);
            if (hook) hook({ date: inv.date, productId: l.productId, delta: l.qty, stock: s.stock, avg: s.avg, cost: s.avg, label: 'برگشت از فروش - فاکتور ' + inv.no, invoiceId: inv.id, type: inv.type, unit: l.net / l.qty });
          } else if (inv.type === 'purchase_return') {
            if (s.stock < l.qty - 1e-9) errors.push({ invoiceId: inv.id, productId: l.productId, need: l.qty, have: s.stock });
            c += Math.round(l.qty * s.avg) - l.net; s.stock = r3(s.stock - l.qty);
            if (hook) hook({ date: inv.date, productId: l.productId, delta: -l.qty, stock: s.stock, avg: s.avg, cost: s.avg, label: 'برگشت از خرید - فاکتور ' + inv.no, invoiceId: inv.id, type: inv.type, unit: l.net / l.qty });
          }
          if (isSer) trim(s);
        }
        cogs[inv.id] = c;
      } else {
        const a = e.adj, s = get(a.productId), isSer = serialP.has(a.productId);
        if (isSer && a.date >= from && s.stock >= -1e-9) { // stock count / opening stock of a phone: un-numbered units
          toSpec(s);
          if (a.qty > 0) { const unit = a.cost > 0 ? a.cost : s.avg; s.val += a.qty * unit; s.stock = r3(s.stock + a.qty); adjEffect[a.id] = -Math.round(a.qty * unit); settle(s); if (hook) hook({ date: a.date, productId: a.productId, delta: a.qty, stock: s.stock, avg: s.avg, cost: unit, label: 'تعدیل موجودی' + (a.note ? ' - ' + a.note : ''), adjId: a.id, unit }); }
          else { const q = -a.qty; if (s.stock < q - 1e-9) errors.push({ adjId: a.id, productId: a.productId, need: q, have: s.stock }); const cost = takeOut(s, q, []); adjEffect[a.id] = Math.round(cost); s.val -= cost; s.stock = r3(s.stock - q); settle(s); if (hook) hook({ date: a.date, productId: a.productId, delta: -q, stock: s.stock, avg: s.avg, cost: q ? cost / q : 0, label: 'تعدیل موجودی' + (a.note ? ' - ' + a.note : ''), adjId: a.id, unit: q ? cost / q : 0 }); }
          continue;
        }
        if (isSer) s.spec = false;
        if (a.qty > 0) {
          const unit = a.cost > 0 ? a.cost : s.avg, base = Math.max(s.stock, 0), ns = r3(base + a.qty);
          if (a.cost > 0) s.avg = ns > 0 ? (base * s.avg + a.qty * unit) / ns : unit;
          s.stock = r3(s.stock + a.qty); adjEffect[a.id] = -Math.round(a.qty * unit);
          if (hook) hook({ date: a.date, productId: a.productId, delta: a.qty, stock: s.stock, avg: s.avg, cost: unit, label: 'تعدیل موجودی' + (a.note ? ' - ' + a.note : ''), adjId: a.id, unit });
        } else {
          const q = -a.qty; if (s.stock < q - 1e-9) errors.push({ adjId: a.id, productId: a.productId, need: q, have: s.stock });
          adjEffect[a.id] = Math.round(q * s.avg); s.stock = r3(s.stock - q);
          if (hook) hook({ date: a.date, productId: a.productId, delta: -q, stock: s.stock, avg: s.avg, cost: s.avg, label: 'تعدیل موجودی' + (a.note ? ' - ' + a.note : ''), adjId: a.id, unit: s.avg });
        }
        if (isSer) trim(s);
      }
    }
    st.products.forEach(p => get(p.id));
    for (const id in S) { const s = S[id]; if (s.units) { s.serialCost = new Map(s.units); delete s.units; } delete s.val; delete s.spec; delete s.idv; }
    return { stock: S, cogs, adjEffect, errors, snCost };
  }
  const stockErrText = (st, e) => { const p = byId(st.products, e.productId); return 'موجودی «' + (p ? p.name : '؟') + '» کافی نیست (موجودی: ' + Core.fmtQty(Math.max(e.have, 0)) + '، نیاز: ' + Core.fmtQty(e.need) + ').'; };
  Core.stockErrText = stockErrText;

  Core.nextInvoiceNo = function (st, type) { let m = 0; st.invoices.forEach(i => { if (type && i.type !== type) return; const n = parseInt(Core.toEn(i.no), 10); if (n > m) m = n; }); return String(m + 1); };

  Core.addInvoice = function (st, d) {
    if (!INV_KIND[d.type]) return err('نوع فاکتور نامعتبر است.');
    if (!byId(st.people, d.personId)) return err('شخص را انتخاب کنید.');
    const de = checkDate(d.date); if (de) return err(de);
    if (!d.items || !d.items.length) return err('حداقل یک قلم کالا لازم است.');
    const items = [];
    for (const l of d.items) {
      if (!byId(st.products, l.productId)) return err('کالای انتخاب‌شده معتبر نیست.');
      if (!(l.qty > 0)) return err('تعداد باید بزرگ‌تر از صفر باشد.');
      if (!Number.isInteger(l.price) || l.price < 0 || l.price > MAX_MONEY) return err('قیمت واحد نامعتبر است.');
      items.push({ productId: l.productId, qty: r3(l.qty), price: l.price, note: String(l.note || '').trim().slice(0, 500) });
    }
    const serialProblems = st.settings && st.settings.serialCoreStrict ? Core.serialProblems(st, items) : [];
    if (serialProblems.length) return err(serialProblems[0]);
    const discount = d.discount || 0;
    if (!Number.isInteger(discount) || discount < 0) return err('تخفیف نامعتبر است.');
    const no = String(d.no || '').trim() || Core.nextInvoiceNo(st, d.type);
    if (st.invoices.some(i => i.no === no && i.type === d.type)) return err('شماره فاکتور تکراری است.');
    const vr = Number(d.vatRate) || 0; if (!(vr >= 0 && vr <= 100)) return err('درصد ارزش افزوده نامعتبر است.');
    const inv = { id: nid(st), no, type: d.type, personId: d.personId, date: d.date, items, discount, note: String(d.note || '').trim() }; if (vr > 0) inv.vatRate = vr;
    const wh = validWh(st, d.wh); if (wh === undefined) return err('انبار انتخاب‌شده معتبر نیست.'); if (wh != null && wh !== mainWh(st)) inv.wh = wh;
    const tot = Core.invoiceTotals(inv);
    if (tot.total <= 0 && tot.sub <= 0) return err('جمع فاکتور صفر است.');
    if (discount > tot.sub) return err('تخفیف از جمع فاکتور بیشتر است.');
    const paid = d.paid || 0;
    if (!Number.isInteger(paid) || paid < 0 || paid > tot.total) return err('مبلغ پرداخت/دریافت نباید از جمع فاکتور بیشتر باشد.');
    st.invoices.push(inv);
    const rp = Core.replay(st);
    if (rp.errors.length) { st.invoices.pop(); st.seq = inv.id; return err(stockErrText(st, rp.errors[0])); }
    const we = whCheck(st); if (we) { st.invoices.pop(); st.seq = inv.id; return err(we); }
    const label = Core.TYPE_FA[inv.type] + ' - فاکتور ' + no;
    st.tx.push({ id: nid(st), personId: inv.personId, kind: INV_KIND[inv.type], amount: tot.total, type: 'invoice', desc: label, date: inv.date, ref: inv.id, group: null, method: null });
    if (paid > 0) { const A = acctFor(st, d.acct, d.method); st.tx.push({ id: nid(st), personId: inv.personId, kind: PAY_KIND[inv.type], amount: paid, type: (PAY_KIND[inv.type] === 'credit' ? 'receipt' : 'payment'), desc: 'تسویه همزمان - فاکتور ' + no, date: inv.date, ref: inv.id, group: null, initPay: true, method: methodOf(A), acct: A.id }); }
    return ok({ invoice: inv });
  };
  // edit an invoice in place (same id and number): items, person, date, discount, VAT, first payment.
  // Stock, balances and profit are recalculated from the data, so the change flows everywhere.
  Core.editInvoice = function (st, id, d) {
    const old = byId(st.invoices, id); if (!old) return err('فاکتور پیدا نشد.');
    if (!byId(st.people, d.personId)) return err('شخص را انتخاب کنید.');
    const de = checkDate(d.date); if (de) return err(de);
    if (!d.items || !d.items.length) return err('حداقل یک قلم کالا لازم است.');
    const items = [];
    for (const l of d.items) {
      if (!byId(st.products, l.productId)) return err('کالای انتخاب‌شده معتبر نیست.');
      if (!(l.qty > 0)) return err('تعداد باید بزرگ‌تر از صفر باشد.');
      if (!Number.isInteger(l.price) || l.price < 0 || l.price > MAX_MONEY) return err('قیمت واحد نامعتبر است.');
      items.push({ productId: l.productId, qty: r3(l.qty), price: l.price, note: String(l.note || '').trim().slice(0, 500) });
    }
    const serialProblems = st.settings && st.settings.serialCoreStrict ? Core.serialProblems(st, items) : [];
    if (serialProblems.length) return err(serialProblems[0]);
    const discount = d.discount || 0; if (!Number.isInteger(discount) || discount < 0) return err('تخفیف نامعتبر است.');
    const vr = Number(d.vatRate) || 0; if (!(vr >= 0 && vr <= 100)) return err('درصد ارزش افزوده نامعتبر است.');
    const no = String(d.no || '').trim() || old.no;
    if (st.invoices.some(i => i.id !== id && i.no === no && i.type === old.type)) return err('شماره فاکتور تکراری است.');
    const inv = { id, no, type: old.type, personId: d.personId, date: d.date, items, discount, note: String(d.note || '').trim() }; if (vr > 0) inv.vatRate = vr;
    const wh = d.wh === undefined ? (old.wh != null ? old.wh : null) : validWh(st, d.wh); if (wh === undefined) return err('انبار انتخاب‌شده معتبر نیست.'); if (wh != null && wh !== mainWh(st)) inv.wh = wh;
    for (const k of Object.keys(old)) if (!(k in inv) && !['items', 'wh', 'vatRate'].includes(k)) inv[k] = old[k]; // keep other fields (who made it, …)
    const tot = Core.invoiceTotals(inv);
    if (tot.total <= 0 && tot.sub <= 0) return err('جمع فاکتور صفر است.');
    if (discount > tot.sub) return err('تخفیف از جمع فاکتور بیشتر است.');
    const linked = st.tx.filter(t => t.ref === id), main = linked.find(t => t.type === 'invoice');
    if (old.personId !== inv.personId && st.cheques.some(c => c.invoiceId === id || (c.hist || []).some(h => h.invoiceId === id))) return err('فاکتور دارای چک مرتبط است؛ پیش از تغییر شخص، ارتباط چک را اصلاح کنید.');
    const first = linked.find(t => t.type !== 'invoice' && (t.initPay || /^تسویه همزمان/.test(t.desc || '')));
    const paid = d.paid || 0; if (!Number.isInteger(paid) || paid < 0) return err('مبلغ پرداخت/دریافت نامعتبر است.');
    const otherPaid = linked.filter(t => t !== main && t !== first && (t.type === 'receipt' || t.type === 'payment')).reduce((s, t) => s + t.amount, 0)
      + linked.filter(t => t.type === 'chq').reduce((sum, t) => sum + (t.kind === PAY_KIND[old.type] ? t.amount : -t.amount), 0);
    if (paid + otherPaid > tot.total) return err('جمع پرداخت‌های این فاکتور (' + Core.fmt(paid + otherPaid) + ') از مبلغ جدید فاکتور بیشتر می‌شود.');
    const bakInv = st.invoices;
    st.invoices = st.invoices.map(i => i.id === id ? inv : i);
    const rp = Core.replay(st);
    if (rp.errors.length) { st.invoices = bakInv; return err('با این تغییر موجودی انبار منفی می‌شود. ' + stockErrText(st, rp.errors[0])); }
    const we = whCheck(st); if (we) { st.invoices = bakInv; return err('با این تغییر موجودی انبار منفی می‌شود. ' + we); }
    const label = Core.TYPE_FA[inv.type] + ' - فاکتور ' + no;
    if (main) Object.assign(main, { personId: inv.personId, amount: tot.total, date: inv.date, desc: label });
    else st.tx.push({ id: nid(st), personId: inv.personId, kind: INV_KIND[inv.type], amount: tot.total, type: 'invoice', desc: label, date: inv.date, ref: id, group: null, method: null });
    linked.forEach(t => { if (t !== main) t.personId = inv.personId; });
    if (paid > 0) {
      const A = acctFor(st, d.acct != null ? d.acct : (METHODS[d.method] ? null : first && first.acct), d.acct != null ? null : (d.method || (first && first.method)));
      if (first) Object.assign(first, { amount: paid, date: inv.date, method: methodOf(A), acct: A.id, desc: 'تسویه همزمان - فاکتور ' + no, initPay: true });
      else st.tx.push({ id: nid(st), personId: inv.personId, kind: PAY_KIND[inv.type], amount: paid, type: (PAY_KIND[inv.type] === 'credit' ? 'receipt' : 'payment'), desc: 'تسویه همزمان - فاکتور ' + no, date: inv.date, ref: id, group: null, initPay: true, method: methodOf(A), acct: A.id });
    } else if (first) st.tx = st.tx.filter(t => t !== first);
    return ok({ invoice: inv });
  };
  Core.firstPayment = (st, id) => (txByRef(st).get(id) || []).find(t => t.type !== 'invoice' && (t.initPay || /^تسویه همزمان/.test(t.desc || ''))) || null;
  Core.deleteInvoice = function (st, id) {
    const inv = byId(st.invoices, id); if (!inv) return err('فاکتور پیدا نشد.');
    if (st.cheques.some(c => c.invoiceId === id || (c.hist || []).some(h => h.invoiceId === id))) return err('چک به این فاکتور متصل است؛ اول ارتباط چک با فاکتور را اصلاح کنید.');
    const bakInv = st.invoices, bakTx = st.tx;
    st.invoices = st.invoices.filter(i => i.id !== id); st.tx = st.tx.filter(t => t.ref !== id);
    const rp = Core.replay(st);
    if (rp.errors.length) { st.invoices = bakInv; st.tx = bakTx; return err('با حذف این فاکتور موجودی انبار منفی می‌شود. ' + stockErrText(st, rp.errors[0])); }
    const we = whCheck(st); if (we) { st.invoices = bakInv; st.tx = bakTx; return err('با حذف این فاکتور موجودی انبار منفی می‌شود. ' + we); }
    return ok();
  };
  Core.invoiceInfo = function (st, inv) {
    const tot = Core.invoiceTotals(inv);
    const related = (txByRef(st).get(inv.id) || []);
    const moneyPaid = related.filter(t => t.type === 'receipt' || t.type === 'payment').reduce((s, t) => s + t.amount, 0);
    const expected = PAY_KIND[inv.type];
    const chequePaid = related.filter(t => t.type === 'chq').reduce((s, t) => s + (t.kind === expected ? t.amount : -t.amount), 0);
    const paid = moneyPaid + chequePaid;
    const chequePending = (st.cheques || []).reduce((sum, c) => {
      if (c.cyc && c.invoiceId === inv.id && !['bounced', 'returned', 'cancelled', 'cleared', 'paid'].includes(c.state)) sum += c.amount;
      for (const h of c.hist || []) if (h.s === 'spent' && h.invoiceId === inv.id && !((c.hist || []).some(x => x.s === 'bounced'))) sum += c.amount;
      return sum;
    }, 0);
    return Object.assign({ paid, moneyPaid, chequePaid, chequePending, remaining: tot.total - paid }, tot);
  };

  /* ───────────── inventory adjustments ───────────── */
  Core.addAdjust = function (st, d) {
    const p = byId(st.products, d.productId); if (!p) return err('کالا را انتخاب کنید.');
    if (!d.qty || !isFinite(d.qty)) return err('مقدار تعدیل نامعتبر است.');
    const de = checkDate(d.date); if (de) return err(de);
    const a = { id: nid(st), productId: d.productId, qty: r3(d.qty), cost: d.qty > 0 ? Math.max(0, Math.round(d.cost) || 0) : 0, date: d.date, note: String(d.note || '').trim() };
    if (d.opening && a.qty > 0) a.opening = true;
    const wh = validWh(st, d.wh); if (wh === undefined) return err('انبار انتخاب‌شده معتبر نیست.'); if (wh != null && wh !== mainWh(st)) a.wh = wh;
    st.adjusts.push(a); const rp = Core.replay(st);
    if (rp.errors.length) { st.adjusts.pop(); st.seq = a.id; return err(stockErrText(st, rp.errors[0])); }
    const we = whCheck(st); if (we) { st.adjusts.pop(); st.seq = a.id; return err(we); }
    return ok({ adjust: a });
  };
  // opening stock of a product (also after it was added): one «موجودی اولیه» record dated before its first movement
  Core.openingOf = (st, productId) => st.adjusts.find(a => a.productId === productId && a.opening) || null;
  Core.setOpeningStock = function (st, productId, qty, cost) {
    const p = byId(st.products, productId); if (!p) return err('کالا پیدا نشد.');
    qty = r3(Number(qty) || 0); if (qty < 0 || !isFinite(qty)) return err('موجودی اولیه نامعتبر است.');
    const cur = Core.openingOf(st, productId);
    if (!cur && !qty) return ok();
    cost = Math.max(0, Math.round(Number(cost) || 0));
    if (qty > 0 && !cost && !(cur && cur.cost)) return err('برای موجودی اولیه، قیمت خرید را هم وارد کنید.');
    const bak = st.adjusts.slice(), bakSeq = st.seq;
    if (cur) {
      if (!qty) st.adjusts = st.adjusts.filter(a => a !== cur);
      else { const i = st.adjusts.indexOf(cur); st.adjusts[i] = Object.assign({}, cur, { qty, cost: cost || cur.cost }); }
    } else {
      let first = Core.periodRange('fytd', Core.todayISO(), (st.settings && st.settings.fyMonth) || 1).from; // start of the fiscal year (or the first day of the books if earlier), so back-dated invoices still find the stock
      st.invoices.forEach(inv => { if (inv.date < first) first = inv.date; });
      st.adjusts.forEach(a => { if (a.date < first) first = a.date; });
      if (inClosed(st, first)) first = Core.addDays(closedTo(st), 1); // a closed year never changes
      st.adjusts.push({ id: nid(st), productId, qty, cost, date: first, note: 'موجودی اولیه', opening: true });
    }
    const rp = Core.replay(st);
    if (rp.errors.length) { st.adjusts = bak; st.seq = bakSeq; return err(stockErrText(st, rp.errors[0])); }
    const we = whCheck(st); if (we) { st.adjusts = bak; st.seq = bakSeq; return err(we); }
    return ok();
  };
  Core.deleteAdjust = function (st, id) {
    const bak = st.adjusts; st.adjusts = st.adjusts.filter(a => a.id !== id);
    const rp = Core.replay(st); if (rp.errors.length) { st.adjusts = bak; return err('با حذف این تعدیل موجودی منفی می‌شود.'); }
    const we = whCheck(st); if (we) { st.adjusts = bak; return err('با حذف این تعدیل موجودی منفی می‌شود. ' + we); }
    return ok();
  };

  /* ───────────── expenses & cheques ───────────── */
  Core.addExpense = function (st, d) {
    const title = String(d.title || '').trim(); if (!title) return err('عنوان هزینه را وارد کنید.');
    if (!(d.amount > 0) || !Number.isInteger(d.amount) || d.amount > MAX_MONEY) return err('مبلغ نامعتبر است.');
    const de = checkDate(d.date); if (de) return err(de);
    const A = acctFor(st, d.acct, d.method);
    const e = { id: nid(st), title, amount: d.amount, date: d.date, method: methodOf(A), acct: A.id, category: String(d.category || '').trim(), note: String(d.note || '').trim() };
    st.expenses.push(e); return ok({ expense: e });
  };
  Core.editExpense = function (st, id, d) {
    const e = byId(st.expenses, id); if (!e) return err('هزینه پیدا نشد.');
    const title = String(d.title || '').trim(); if (!title) return err('عنوان هزینه را وارد کنید.');
    if (!(d.amount > 0) || !Number.isInteger(d.amount)) return err('مبلغ نامعتبر است.');
    const de = checkDate(d.date); if (de) return err(de);
    const A = acctFor(st, d.acct != null ? d.acct : (METHODS[d.method] ? null : e.acct), d.acct != null ? null : (d.method || e.method));
    Object.assign(e, { title, amount: d.amount, date: d.date, method: methodOf(A), acct: A.id, category: String(d.category || '').trim(), note: String(d.note || '').trim() }); return ok();
  };
  Core.deleteExpense = function (st, id) { st.expenses = st.expenses.filter(e => e.id !== id); return ok(); };

  Core.addCheque = function (st, d) {
    if (d.cycle && d.kind !== 'installment') { const r = newCycleCheque(st, d); if (!r.ok) return r; const c = Object.assign({ id: nid(st) }, r.c); st.cheques.push(c); syncChequeTx(st, c); return ok({ cheque: c }); }
    const title = String(d.title || '').trim(); if (!title) return err('عنوان را وارد کنید.');
    if (!(d.amount > 0) || !Number.isInteger(d.amount) || d.amount > MAX_MONEY) return err('مبلغ نامعتبر است.');
    const de = checkDate(d.dueDate); if (de) return err(de);
    if (d.personId && !byId(st.people, d.personId)) return err('شخص نامعتبر است.');
    const c = { id: nid(st), kind: d.kind === 'installment' ? 'installment' : 'cheque', direction: d.direction === 'pay' ? 'pay' : 'receive', personId: d.personId || null, title, amount: d.amount, dueDate: d.dueDate, note: String(d.note || '').trim(), done: false, doneAt: null };
    st.cheques.push(c); return ok({ cheque: c });
  };
  Core.editCheque = function (st, id, d) {
    const c = byId(st.cheques, id); if (!c) return err('مورد پیدا نشد.');
    if (c.cyc) { // details always; amount, person, bank account and date only while it is still in its first state
      const first = c.hist.length === 1; if (inClosed(st, c.hist[0].date)) return closedErr(st);
      const r = newCycleCheque(Object.assign({}, st, { cheques: st.cheques.filter(x => x !== c) }), Object.assign({ direction: c.direction, _editingChequeId: c.id }, first ? d : Object.assign({}, d, { amount: c.amount, personId: c.personId, acct: c.acct, date: c.date })));
      if (!r.ok) return r; if (!first && ((d.amount != null && d.amount !== c.amount) || (d.personId != null && d.personId !== c.personId))) return err('چک مراحل بعدی دارد؛ برای تغییر مبلغ یا شخص، اول مراحل را برگردانید.');
      const n = r.c; Object.assign(c, { title: n.title, dueDate: n.dueDate, serial: n.serial, bank: n.bank, branch: n.branch, drawer: n.drawer, note: n.note });
      if (first) { Object.assign(c, { amount: n.amount, personId: n.personId, invoiceId: n.invoiceId, acct: n.acct, date: n.date }); c.hist[0].date = n.date; }
      syncChequeTx(st, c); return ok();
    }
    const title = String(d.title || '').trim(); if (!title) return err('عنوان را وارد کنید.');
    if (!(d.amount > 0) || !Number.isInteger(d.amount) || d.amount > MAX_MONEY) return err('مبلغ نامعتبر است.');
    const de = checkDate(d.dueDate); if (de) return err(de);
    if (d.personId && !byId(st.people, d.personId)) return err('شخص نامعتبر است.');
    const tx = c.txId ? byId(st.tx, c.txId) : null;
    if (tx && !d.personId) return err('این چک در حساب شخص ثبت شده است؛ شخص را خالی نگذارید.');
    Object.assign(c, { kind: d.kind === 'installment' ? 'installment' : 'cheque', direction: d.direction === 'pay' ? 'pay' : 'receive', personId: d.personId || null, title, amount: d.amount, dueDate: d.dueDate, note: String(d.note || '').trim() });
    if (tx) Object.assign(tx, { personId: c.personId, amount: c.amount, kind: c.direction === 'receive' ? 'credit' : 'debit', type: c.direction === 'receive' ? 'receipt' : 'payment', desc: (c.kind === 'cheque' ? 'چک' : 'قسط') + ' - ' + c.title });
    return ok();
  };
  Core.deleteCheque = function (st, id) {
    const c = byId(st.cheques, id); if (!c) return err('چک پیدا نشد.');
    if (c.cyc) {
      if (c.hist.length > 1) return err('این چک مراحل بعدی دارد؛ اول مراحل را برگردانید.');
      if (inClosed(st, c.hist[0].date)) return closedErr(st);
      st.tx = st.tx.filter(t => !(t.type === 'chq' && t.chq === id));
    } else {
      const linked = st.tx.filter(t => t.id === c.txId);
      if (linked.some(t => inClosed(st, t.date))) return closedErr(st);
      // Legacy cheques are reminders until completed; remove their financial effect as well.
      if (c.txId) st.tx = st.tx.filter(t => t.id !== c.txId);
    }
    st.cheques = st.cheques.filter(x => x.id !== id); return ok();
  };
  // mark done; optionally record the receipt/payment in the person's account
  Core.completeCheque = function (st, id, recordTx, date, acctId) {
    const c = byId(st.cheques, id); if (!c) return err('مورد پیدا نشد.'); if (c.cyc) return err('برای این چک از دکمه‌های وضعیت چک استفاده کنید.'); if (c.done) return err('قبلاً انجام شده است.');
    if (recordTx) {
      if (!c.personId) return err('برای ثبت در حساب، باید شخص مشخص باشد.');
      const r = Core.addTx(st, { personId: c.personId, type: c.direction === 'receive' ? 'receipt' : 'payment', amount: c.amount, date: date || Core.todayISO(), desc: (c.kind === 'cheque' ? 'چک' : 'قسط') + ' - ' + c.title, acct: acctId, method: 'bank' });
      if (!r.ok) return r; c.txId = r.tx.id;
    }
    c.done = true; c.doneAt = date || Core.todayISO(); return ok();
  };
  Core.reopenCheque = function (st, id) {
    const c = byId(st.cheques, id); if (!c) return err('مورد پیدا نشد.'); if (c.cyc) return Core.chequeUndo(st, id);
    const linked = c.txId ? byId(st.tx, c.txId) : null;
    if (linked && inClosed(st, linked.date)) return closedErr(st);
    if (c.txId) st.tx = st.tx.filter(t => t.id !== c.txId);
    c.done = false; c.doneAt = null; delete c.txId; return ok();
  };
  Core.chequeStatus = function (c, today) {
    if (c.done) return 'done'; const d = Core.diffDays(today, c.dueDate);
    return d < 0 ? 'overdue' : d <= 7 ? 'soon' : 'later';
  };

  /* ───────────── reports ───────────── */
  const inRange = (d, from, to) => (!from || d >= from) && (!to || d <= to);
  Core.report = function (st, from, to) {
    const rp = Core.replay(st); const r = { sales: 0, saleReturns: 0, purchases: 0, purchaseReturns: 0, cogs: 0, adjLoss: 0, expenses: 0, invoices: 0, discounts: 0, vatOut: 0, vatIn: 0 };
    for (const inv of st.invoices) {
      if (!inRange(inv.date, from, to)) continue; const t = Core.invoiceTotals(inv); r.invoices++;
      const ex = t.total - t.vat; // amounts without VAT (VAT is not income or cost)
      if (inv.type === 'sale') { r.sales += ex; r.vatOut += t.vat; r.discounts += t.discount; r.cogs += rp.cogs[inv.id] || 0; }
      else if (inv.type === 'sale_return') { r.saleReturns += ex; r.vatOut -= t.vat; r.cogs += rp.cogs[inv.id] || 0; }
      else if (inv.type === 'purchase') { r.purchases += ex; r.vatIn += t.vat; }
      else if (inv.type === 'purchase_return') { r.purchaseReturns += ex; r.vatIn -= t.vat; r.cogs += rp.cogs[inv.id] || 0; }
    }
    for (const a of st.adjusts) if (!a.opening && inRange(a.date, from, to)) r.adjLoss += rp.adjEffect[a.id] || 0;
    for (const e of st.expenses) if (inRange(e.date, from, to)) r.expenses += e.amount;
    for (const x of st.acctTx || []) if (x.fee && inRange(x.date, from, to)) r.expenses += x.fee; // bank fees of transfers
    r.vchIncome = 0; r.vchExpense = 0; // manual vouchers on income (4…) and cost/expense (5…, 6…) accounts
    for (const v of st.vouchers || []) if (v.kind === 'manual' && inRange(v.date, from, to)) for (const l of v.lines) { const g = l.acc[0]; if (g === '4') r.vchIncome += l.cr - l.dr; else if (g === '5' || g === '6') r.vchExpense += l.dr - l.cr; }
    r.expenses += r.vchExpense;
    // Legacy manual documents were booked to 4201/6900. Match the ledger without modifying old records.
    for (const t of st.tx) if (t.type === 'manual' && t.manualPosting !== 'suspense' && inRange(t.date, from, to)) {
      if (t.kind === 'debit') r.vchIncome += t.amount; else r.expenses += t.amount;
    }
    r.vatNet = r.vatOut - r.vatIn;
    r.revenue = r.sales - r.saleReturns; r.cogsTotal = r.cogs + r.adjLoss; r.gross = r.revenue - r.cogsTotal; r.net = r.gross - r.expenses + r.vchIncome;
    return r;
  };
  Core.cashSummary = function (st, from, to) {
    const m = { cash: 0, bank: 0, cheque: 0 }, by = {}; let inn = 0, out = 0;
    ensureAcct(st).forEach(a => { by[a.id] = { in: 0, out: 0 }; });
    Core.moneyMoves(st).forEach(v => {
      if (!inRange(v.date, from, to)) return; const a = byId(st.accounts, v.acct), b = by[v.acct] || (by[v.acct] = { in: 0, out: 0 });
      if (v.amt > 0) b.in += v.amt; else b.out -= v.amt;
      if (v.kind === 'xfer') return; // own money moving between accounts
      m[a && a.kind === 'bank' ? 'bank' : 'cash'] += v.amt; if (v.amt > 0) inn += v.amt; else out -= v.amt;
    });
    return { byMethod: m, byAcct: by, in: inn, out, net: inn - out };
  };
  Core.cashBalance = function (st) { const b = Core.accountBalances(st); return Object.values(b).reduce((t, v) => t + v, 0) + (st.settings.openingCash || 0); };
  Core.receivablePayable = function (st) {
    const b = Core.balances(st); let rec = 0, pay = 0;
    st.people.forEach(p => { const v = b[p.id] || 0; if (v > 0) rec += v; else pay -= v; });
    return { receivable: rec, payable: pay };
  };
  Core.inventoryValue = function (st) { const rp = Core.replay(st); let v = 0; for (const id in rp.stock) v += Math.max(rp.stock[id].stock, 0) * rp.stock[id].avg; return Math.round(v); };
  Core.soldQty = function (st) { const m = {}; st.invoices.forEach(i => { const sg = i.type === 'sale' ? 1 : i.type === 'sale_return' ? -1 : 0; if (sg) i.items.forEach(l => { m[l.productId] = (m[l.productId] || 0) + sg * l.qty; }); }); return m; };
  Core.productStats = function (st) {
    const rp = Core.replay(st);
    const am = Core.autoMins(st);
    return st.products.map(p => { const s = rp.stock[p.id] || { stock: 0, avg: 0 }, min = p.minStock > 0 ? p.minStock : (am[p.id] || 0); return { product: p, stock: s.stock, avg: Math.round(s.avg), value: Math.round(Math.max(s.stock, 0) * s.avg), low: min > 0 && s.stock <= min, minAuto: !(p.minStock > 0) && !!am[p.id] }; });
  };
  Core.productMoves = function (st, pid) { const rows = []; Core.replay(st, m => { if (m.productId === pid) rows.push(m); }); return rows; };
  Core.topPeople = function (st, type, from, to, n) {
    const m = {}; st.invoices.forEach(i => { if (i.type === type && inRange(i.date, from, to)) m[i.personId] = (m[i.personId] || 0) + Core.invoiceTotals(i).total; });
    return Object.keys(m).map(id => ({ person: byId(st.people, +id), total: m[id] })).sort((a, b) => b.total - a.total).slice(0, n || 5);
  };
  Core.topProducts = function (st, from, to, n) {
    const m = {}; st.invoices.forEach(i => { if (i.type === 'sale' && inRange(i.date, from, to)) Core.invoiceTotals(i).lines.forEach(l => { const o = m[l.productId] || (m[l.productId] = { qty: 0, total: 0 }); o.qty += l.qty; o.total += l.net; }); });
    return Object.keys(m).map(id => ({ product: byId(st.products, +id), qty: r3(m[id].qty), total: m[id].total })).sort((a, b) => b.total - a.total).slice(0, n || 5);
  };

  /* ───────────── bank statement import & reconciliation ─────────────
   * Bank statements arrive as Excel (xlsx), «Excel» files that are really HTML tables, or CSV/text.
   * Columns are found from their titles (تاریخ، شرح، برداشت/بدهکار، واریز/بستانکار، مانده، شماره پیگیری) and can be fixed by hand. */
  Core.parseCSV = function (text) {
    text = String(text || '').replace(/^﻿/, ''); const first = text.split(/\r?\n/)[0] || '';
    const sep = [',', ';', '\t', '|'].map(c => [c, first.split(c).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; continue; }
      if (ch === '"') q = true; else if (ch === sep) { row.push(cur); cur = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; } else cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.map(r => r.map(c => c.trim())).filter(r => r.some(c => c !== ''));
  };
  const unent = s => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n));
  Core.parseHTMLTable = function (html) {
    const rows = []; String(html).replace(/<tr[\s\S]*?<\/tr>/gi, tr => { const r = []; tr.replace(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi, (m, c) => { r.push(unent(c.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()); return m; }); if (r.some(x => x)) rows.push(r); return tr; });
    return rows;
  };
  // minimal xlsx reader: zip (stored/deflate) → first worksheet + shared strings
  Core.readXlsx = async function (buf) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let eocd = -1; for (let i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('فایل اکسل معتبر نیست.');
    const n = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true); const files = {};
    for (let k = 0; k < n; k++) {
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl)); files[name] = { method, csize, lo }; p += 46 + nl + el + cl;
    }
    const get = async name => {
      const f = files[name]; if (!f) return null; const o = f.lo, nl = dv.getUint16(o + 26, true), el = dv.getUint16(o + 28, true), data = u8.subarray(o + 30 + nl + el, o + 30 + nl + el + f.csize);
      if (f.method === 0) return new TextDecoder().decode(data);
      if (typeof DecompressionStream === 'undefined') throw new Error('این دستگاه فایل اکسل فشرده را باز نمی‌کند؛ فایل را CSV ذخیره کنید.');
      const ds = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')); return new TextDecoder().decode(await new Response(ds).arrayBuffer());
    };
    const ss = []; const sx = await get('xl/sharedStrings.xml');
    if (sx) sx.replace(/<si>([\s\S]*?)<\/si>/g, (m, c) => { let t = ''; c.replace(/<t[^>]*>([\s\S]*?)<\/t>/g, (mm, x) => { t += x; return mm; }); ss.push(unent(t)); return m; });
    const sheetName = Object.keys(files).filter(f => /^xl\/worksheets\/sheet\d+\.xml$/.test(f)).sort()[0]; if (!sheetName) throw new Error('برگه‌ای در فایل اکسل پیدا نشد.');
    const xml = await get(sheetName), rows = [];
    const colIdx = ref => { const m = /^([A-Z]+)/.exec(ref); let v = 0; for (const ch of m[1]) v = v * 26 + ch.charCodeAt(0) - 64; return v - 1; };
    xml.replace(/<row[^>]*>([\s\S]*?)<\/row>/g, (m, body) => {
      const r = []; body.replace(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, (mm, attrs, inner) => {
        const ref = (/r="([A-Z]+\d+)"/.exec(attrs) || [])[1], t = (/t="(\w+)"/.exec(attrs) || [])[1]; let v = '';
        if (inner) { if (t === 'inlineStr') { inner.replace(/<t[^>]*>([\s\S]*?)<\/t>/g, (q, x) => { v += unent(x); return q; }); } else { const vm = /<v>([\s\S]*?)<\/v>/.exec(inner); v = vm ? vm[1] : ''; if (t === 's') v = ss[+v] || ''; else v = unent(v); } }
        r[ref ? colIdx(ref) : r.length] = v; return mm;
      });
      for (let i = 0; i < r.length; i++) if (r[i] == null) r[i] = '';
      if (r.some(x => String(x).trim())) rows.push(r.map(x => String(x).trim())); return m;
    });
    return rows;
  };
  Core.readStatementFile = async function (name, buf) {
    const u8 = new Uint8Array(buf);
    if (u8[0] === 0x50 && u8[1] === 0x4b) return Core.readXlsx(u8);
    if (u8[0] === 0xd0 && u8[1] === 0xcf) throw new Error('این فایل اکسل قدیمی (xls) است. در اکسل با «Save As» آن را به xlsx یا CSV ذخیره کنید و دوباره انتخاب کنید.');
    if (u8[0] === 0x25 && u8[1] === 0x50) throw new Error('فایل PDF قابل خواندن نیست. از اینترنت‌بانک خروجی «اکسل» یا CSV بگیرید.');
    let text = new TextDecoder('utf-8').decode(u8); if (/�/.test(text.slice(0, 2000))) { try { text = new TextDecoder('windows-1256').decode(u8); } catch (e) { /* keep utf-8 */ } }
    return /<t(able|r)[\s>]/i.test(text) ? Core.parseHTMLTable(text) : Core.parseCSV(text);
  };
  const COLS = { date: /تاریخ|date/i, desc: /شرح|توضیح|عنوان|بابت|description|narration|memo/i, wd: /برداشت|بدهکار|withdraw|debit|خروج/i, dep: /واریز|بستانکار|deposit|credit|ورود/i, amt: /^(مبلغ|amount|مبلغ تراکنش)$/i, bal: /مانده|موجودی|balance/i, ref: /پیگیری|سند|ارجاع|شماره|سریال|ref|trace|reference/i, time: /^(ساعت|زمان|time)$/i };
  Core.statementMap = function (rows) {
    let best = { score: 0, i: 0 };
    rows.slice(0, 20).forEach((r, i) => { const sc = r.filter(c => Object.values(COLS).some(rx => rx.test(Core.norm(c)))).length; if (sc > best.score) best = { score: sc, i }; });
    const head = rows[best.i] || [], cols = {};
    const find = (k, skip) => head.findIndex((c, j) => !skip.includes(j) && COLS[k].test(Core.norm(c)));
    const used = [];
    for (const k of ['time', 'date', 'wd', 'dep', 'bal', 'amt', 'desc', 'ref']) { const j = find(k, used); if (j >= 0) { cols[k] = j; used.push(j); } }
    return { header: best.score >= 2 ? best.i : -1, cols, head };
  };
  // "1405/07/19", "14050719", "1405-07-19 10:21", "2026/10/11" → ISO
  Core.parseAnyDate = function (v) {
    const s = Core.toEn(String(v || '')).trim(); let m = /(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/.exec(s) || /^(\d{4})(\d{2})(\d{2})/.exec(s.replace(/\D/g, '').length >= 8 ? s.replace(/\D/g, '') : '');
    if (!m) { const n = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(s); if (n) m = [0, n[3], n[2], n[1]]; }
    if (!m) { const x = +s; if (x > 30000 && x < 60000) { const d = new Date(Date.UTC(1899, 11, 30) + x * 864e5); return d.toISOString().slice(0, 10); } return null; } // Excel serial date
    const y = +m[1], mo = +m[2], d = +m[3];
    if (y >= 1300 && y < 1500) return Core.validIso(Core.partsToIso(y, mo, d)) && mo <= 12 && d <= 31 ? Core.partsToIso(y, mo, d) : null;
    if (y >= 1900 && y < 2200) { const iso = y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0'); return Core.validIso(iso) ? iso : null; }
    return null;
  };
  const amtOf = v => { let s = Core.toEn(String(v == null ? '' : v)).replace(/[٬،,\s]/g, '').replace(/٫/g, '.'); let neg = false; if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); } if (/-$/.test(s)) { neg = true; s = s.slice(0, -1); } if (/^-/.test(s)) { neg = true; s = s.slice(1); } s = s.replace(/[^\d.]/g, ''); if (!s) return 0; const n = Math.round(parseFloat(s)); return neg ? -n : n; };
  Core.statementItems = function (rows, map) {
    const c = map.cols, out = [];
    rows.forEach((r, i) => {
      if (i <= map.header) return; const date = c.date != null ? Core.parseAnyDate(r[c.date]) : null; if (!date) return;
      let amt = 0; if (c.dep != null || c.wd != null) amt = Math.abs(amtOf(c.dep != null ? r[c.dep] : 0)) - Math.abs(amtOf(c.wd != null ? r[c.wd] : 0)); else if (c.amt != null) amt = amtOf(r[c.amt]);
      if (!amt) return;
      out.push({ i, date, amt, desc: c.desc != null ? r[c.desc] : '', ref: c.ref != null ? Core.toEn(r[c.ref]) : '', bal: c.bal != null && r[c.bal] !== '' ? amtOf(r[c.bal]) : null });
    });
    return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.i - b.i));
  };
  // match bank rows with the app's movements of that account: same direction and amount, nearest date within `days`
  Core.reconcile = function (st, acctId, items, o) {
    o = o || {}; const days = o.days == null ? 3 : o.days; if (!items.length) return { matched: [], bankOnly: [], appOnly: [], from: null, to: null };
    const from = items[0].date, to = items[items.length - 1].date;
    const moves = Core.moneyMoves(st).filter(v => v.acct === acctId && v.date >= Core.addDays(from, -days) && v.date <= Core.addDays(to, days)).map(v => Object.assign({ used: false }, v));
    const matched = [], bankOnly = [];
    const refHit = (it, v) => it.ref && it.ref.length >= 4 && (String(v.desc || '').includes(it.ref) || String((v.tx && v.tx.ref) || '').includes(it.ref));
    // pass 1: same amount, same day or a reference number written in the app; pass 2: nearest date within the window
    for (const pass of [0, 1]) for (const it of items) {
      if (it.m) continue; let best = null, bd = 1e9;
      for (const v of moves) { if (v.used || v.amt !== it.amt) continue; const dd = Math.abs(Core.diffDays(v.date, it.date)); if (pass === 0 && !(dd === 0 || refHit(it, v))) continue; if (dd > days) continue; if (dd < bd) { bd = dd; best = v; } }
      if (best) { best.used = true; it.m = true; matched.push({ item: it, move: best, gap: bd }); }
    }
    items.forEach(it => { if (!it.m) bankOnly.push(it); delete it.m; });
    const appOnly = moves.filter(v => !v.used && v.date >= from && v.date <= to);
    const bal = Core.accountBalances(st, to)[acctId], first = items.find(x => x.bal != null), last = items.slice().reverse().find(x => x.bal != null);
    const stmtOpen = first ? first.bal - first.amt : null, stmtClose = last ? last.bal : null;
    return { matched, bankOnly, appOnly, from, to, appClose: bal, appOpen: Core.accountBalances(st, Core.addDays(from, -1))[acctId], stmtOpen, stmtClose, diff: stmtClose == null ? null : stmtClose - bal, sumBank: items.reduce((t, x) => t + x.amt, 0) };
  };
  // remember a reconciliation: matched app movements get a ✓ in the account's ledger
  Core.saveRecon = function (st, acctId, res, note) {
    const r = { id: nid(st), acct: acctId, at: Core.todayISO(), from: res.from, to: res.to, matched: res.matched.length, bankOnly: res.bankOnly.length, appOnly: res.appOnly.length, stmtClose: res.stmtClose, appClose: res.appClose, diff: res.diff, note: String(note || '') };
    st.recons.push(r);
    res.matched.forEach(m => { const v = m.move; if (v.tx) { const t = byId(st.tx, v.tx.id); if (t) t.rec = r.id; } else if (v.exp) { const e = byId(st.expenses, v.exp.id); if (e) e.rec = r.id; } else if (v.xfer) { const x = byId(st.acctTx, v.xfer.id); if (x) x[v.id.endsWith('o') ? 'recO' : v.id.endsWith('i') ? 'recI' : 'recF'] = r.id; } else if (v.vch) { const l = (byId(st.vouchers || [], v.vch.id) || { lines: [] }).lines[v.line]; if (l) l.rec = r.id; } else if (v.chq) { const h = ((byId(st.cheques, v.chq.id) || {}).hist || [])[v.step]; if (h) h.rec = r.id; } });
    return ok({ recon: r });
  };

  // age of what each person owes (first in, first out): 0–30, 31–60, 61–90 and over 90 days
  Core.aging = function (st, today) {
    today = today || Core.todayISO(); const by = new Map();
    st.tx.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id)).forEach(t => { const x = by.get(t.personId) || { open: [], credit: 0 }; if (t.kind === 'debit') x.open.push({ date: t.date, left: t.amount }); else x.credit += t.amount; by.set(t.personId, x); });
    const rows = [];
    by.forEach((x, pid) => {
      let c = x.credit; for (const d of x.open) { const u = Math.min(c, d.left); d.left -= u; c -= u; if (!c) break; }
      const b = [0, 0, 0, 0]; let oldest = null; x.open.forEach(d => { if (!d.left) return; const age = Core.diffDays(d.date, today); b[age <= 30 ? 0 : age <= 60 ? 1 : age <= 90 ? 2 : 3] += d.left; if (!oldest || d.date < oldest) oldest = d.date; });
      const total = b[0] + b[1] + b[2] + b[3]; if (total > 0) rows.push({ p: byId(st.people, pid), b, total, oldest, days: oldest ? Core.diffDays(oldest, today) : 0 });
    });
    return rows.filter(r => r.p).sort((a, b) => b.days - a.days || b.total - a.total);
  };
  // sales by day or by Jalali month: count, revenue, profit
  Core.salesBy = function (st, from, to, unit) {
    const rp = Core.replay(st), m = new Map();
    st.invoices.forEach(i => {
      if ((i.type !== 'sale' && i.type !== 'sale_return') || (from && i.date < from) || (to && i.date > to)) return;
      const p = Core.isoToParts(i.date), k = unit === 'month' ? p.jy + '/' + String(p.jm).padStart(2, '0') : i.date, t = Core.invoiceTotals(i), sg = i.type === 'sale' ? 1 : -1;
      const x = m.get(k) || { key: k, n: 0, rev: 0, cost: 0 }; if (sg > 0) x.n++; x.rev += sg * (t.total - t.vat); x.cost += rp.cogs[i.id] || 0; m.set(k, x);
    });
    return [...m.values()].map(x => Object.assign(x, { profit: x.rev - x.cost })).sort((a, b) => (a.key < b.key ? 1 : -1));
  };

  /* ───────────── double-entry accounting (journal, trial balance, balance sheet) ─────────────
   * Every document of the app becomes a balanced journal entry (perpetual inventory at moving average cost):
   *  sale: Dr customer / Cr sales, Dr sales discounts, Cr VAT payable · Dr cost of goods sold / Cr inventory
   *  purchase: Dr inventory, Dr VAT receivable / Cr supplier · receipt: Dr cash or bank / Cr person · payment: the reverse
   *  expense: Dr expense / Cr cash or bank · opening balances: against owner's capital. Debits always equal credits. */
  const CHART = {
    '1101': ['صندوق', 'asset'], '1102': ['بانک‌ها', 'asset'], '1103': ['حساب‌های دریافتنی (بدهکاران)', 'asset'], '1104': ['موجودی کالا', 'asset'], '1105': ['ارزش افزوده خرید', 'asset'],
    '1106': ['اسناد دریافتنی (چک‌های دریافتی)', 'asset'], '1107': ['اسناد در جریان وصول', 'asset'],
    '2101': ['حساب‌های پرداختنی (بستانکاران)', 'liability'], '2102': ['ارزش افزوده فروش', 'liability'], '2103': ['اسناد پرداختنی (چک‌های صادره)', 'liability'],
    '2190': ['حساب واسط ثبت‌های دستی (نیازمند تعیین ماهیت)', 'liability'],
    '3101': ['سرمایه (مانده‌های اول دوره)', 'equity'], '3102': ['سود (زیان) انباشته', 'equity'], '3103': ['حساب جاری شرکا (برداشت)', 'equity'], '3104': ['خلاصه سود و زیان', 'equity'],
    '4101': ['فروش کالا', 'income'], '4102': ['برگشت از فروش', 'contra'], '4103': ['تخفیفات فروش', 'contra'], '4201': ['سایر درآمدها', 'income'],
    '5101': ['بهای تمام‌شده کالای فروش‌رفته', 'cost'], '5102': ['ضایعات و کسری انبار', 'cost'],
    '6100': ['هزینه‌های عملیاتی', 'expense'], '6200': ['کارمزد بانکی', 'expense'], '6900': ['سایر هزینه‌ها', 'expense']
  };
  Core.CHART = CHART;
  /* chart of accounts (کدینگ حساب‌ها): گروه (1 digit) › کل (2 digits) › معین (4 digits) › تفصیلی.
   * The system accounts above are the معین level; persons, cash boxes, banks, expense groups and user detail accounts are تفصیلی.
   * User changes live in st.coa = { names: {code: name}, kols: [{code, name}], moins: [{code, name}] } and st.tafsil = [{ id, code, name }]; nothing is stored until the user edits. */
  const GROUPS = { 1: 'دارایی‌ها', 2: 'بدهی‌ها', 3: 'حقوق صاحبان سرمایه', 4: 'درآمدها', 5: 'بهای تمام‌شده', 6: 'هزینه‌ها' };
  const KOLS = { '11': 'دارایی‌های جاری', '12': 'دارایی‌های غیرجاری', '21': 'بدهی‌های جاری', '22': 'بدهی‌های غیرجاری', '31': 'سرمایه و سود انباشته', '41': 'درآمدهای عملیاتی', '42': 'درآمدهای غیرعملیاتی', '51': 'بهای تمام‌شده', '61': 'هزینه‌های عملیاتی', '62': 'هزینه‌های مالی', '69': 'سایر هزینه‌ها' };
  // why an account cannot take a manual voucher line (it is kept by its own module), or which detail it needs
  const SYS_LOCK = { '1104': 'موجودی کالا فقط با فاکتور خرید و فروش و تعدیل انبار تغییر می‌کند.', '5101': 'بهای تمام‌شده خودکار از روی فروش حساب می‌شود.', '5102': 'ضایعات و کسری فقط با تعدیل انبار ثبت می‌شود.', '1106': 'چک‌های دریافتی فقط از بخش چک‌ها ثبت و جابه‌جا می‌شوند.', '1107': 'چک‌های در جریان وصول فقط از بخش چک‌ها جابه‌جا می‌شوند.', '2103': 'چک‌های صادره فقط از بخش چک‌ها ثبت می‌شوند.' };
  const SYS_NEED = { '1101': 'cash', '1102': 'bank', '1103': 'person', '2101': 'person' };
  Core.GROUPS = GROUPS; Core.KOLS = KOLS; Core.SYS_LOCK = SYS_LOCK;
  const coaData = st => st.coa || { names: {}, kols: [], moins: [] };
  Core.coaName = function (st, code) {
    const c = coaData(st); if (c.names && c.names[code]) return c.names[code];
    if (code.length === 1) return GROUPS[code] || code;
    if (code.length === 2) { const k = (c.kols || []).find(x => x.code === code); return k ? k.name : KOLS[code] || ('کل ' + code); }
    const m = (c.moins || []).find(x => x.code === code); return m ? m.name : (CHART[code] || ['حساب ' + code])[0];
  };
  // the whole chart: { groups: [{code, name, kols: [{code, name, sys, moins: [{code, name, sys, lock, need}]}]}] }
  Core.coa = function (st) {
    const c = coaData(st), kols = new Map(), moins = new Map();
    Object.keys(KOLS).forEach(k => kols.set(k, { code: k, name: Core.coaName(st, k), sys: true, moins: [] }));
    (c.kols || []).forEach(k => kols.set(k.code, { code: k.code, name: Core.coaName(st, k.code), sys: false, moins: [] }));
    Object.keys(CHART).forEach(m => moins.set(m, { code: m, name: Core.coaName(st, m), sys: true, lock: SYS_LOCK[m] || '', need: SYS_NEED[m] || '' }));
    (c.moins || []).forEach(m => moins.set(m.code, { code: m.code, name: Core.coaName(st, m.code), sys: false, lock: '', need: '' }));
    moins.forEach(m => { const k = kols.get(m.code.slice(0, 2)); if (k) k.moins.push(m); });
    const groups = Object.keys(GROUPS).map(g => ({ code: g, name: Core.coaName(st, g), kols: [...kols.values()].filter(k => k.code[0] === g).sort((a, b) => (a.code < b.code ? -1 : 1)) }));
    groups.forEach(g => g.kols.forEach(k => k.moins.sort((a, b) => (a.code < b.code ? -1 : 1))));
    return { groups, tafsil: (st.tafsil || []).slice() };
  };
  const coaMoin = (st, code) => { for (const g of Core.coa(st).groups) for (const k of g.kols) { const m = k.moins.find(x => x.code === code); if (m) return m; } return null; };
  Core.coaMoin = coaMoin;
  const coaUsed = (st, code) => (st.vouchers || []).some(v => v.lines.some(l => l.acc === code || l.acc.startsWith(code + ':'))) || ((st.coa || {}).moins || []).some(m => code.length === 2 && m.code.slice(0, 2) === code);
  Core.coaUsed = coaUsed;
  Core.addCoa = function (st, d) {
    const code = Core.toEn(String(d.code || '').trim()), name = String(d.name || '').trim();
    if (!name) return err('نام حساب را وارد کنید.');
    const c = st.coa || (st.coa = { names: {}, kols: [], moins: [] }); c.names = c.names || {}; c.kols = c.kols || []; c.moins = c.moins || [];
    if (d.level === 'kol') {
      if (!/^[1-6]\d$/.test(code)) return err('کد حساب کل دو رقم است و رقم اول آن شماره گروه (۱ تا ۶) است.');
      if (KOLS[code] || c.kols.some(k => k.code === code)) return err('این کد حساب کل قبلاً تعریف شده است.');
      c.kols.push({ code, name }); return ok({ code });
    }
    if (!/^[1-6]\d{3}$/.test(code)) return err('کد حساب معین چهار رقم است و دو رقم اول آن کد حساب کل است.');
    const kol = code.slice(0, 2); if (!KOLS[kol] && !c.kols.some(k => k.code === kol)) return err('حساب کل ' + Core.toFa(kol) + ' تعریف نشده است.');
    if (CHART[code] || c.moins.some(m => m.code === code)) return err('این کد حساب معین قبلاً تعریف شده است.');
    c.moins.push({ code, name }); return ok({ code });
  };
  Core.renameCoa = function (st, code, name) {
    name = String(name || '').trim(); if (!name) return err('نام حساب را وارد کنید.');
    const c = st.coa || (st.coa = { names: {}, kols: [], moins: [] }); c.names = c.names || {};
    const own = (c.kols || []).find(k => k.code === code) || (c.moins || []).find(m => m.code === code);
    if (own) own.name = name; else if (GROUPS[code] || KOLS[code] || CHART[code]) c.names[code] = name; else return err('حساب پیدا نشد.');
    return ok();
  };
  Core.deleteCoa = function (st, code) {
    const c = st.coa || {}; if (GROUPS[code] || KOLS[code] || CHART[code]) return err('حساب‌های اصلی برنامه حذف نمی‌شوند؛ فقط نامشان قابل تغییر است.');
    if (coaUsed(st, code)) return err('این حساب در اسناد استفاده شده (یا زیرمجموعه دارد) و حذف نمی‌شود.');
    const n0 = (c.kols || []).length + (c.moins || []).length;
    c.kols = (c.kols || []).filter(k => k.code !== code); c.moins = (c.moins || []).filter(m => m.code !== code);
    return n0 === c.kols.length + c.moins.length ? err('حساب پیدا نشد.') : ok();
  };
  // detail accounts (تفصیلی) of your own: a loan, a partner, a project… usable under any open معین in manual vouchers
  Core.nextTafsilCode = st => String(Math.max(5000, ...(st.tafsil || []).map(t => +Core.toEn(t.code) || 0)) + 1);
  Core.addTafsil = function (st, d) {
    const name = String(d.name || '').trim(); if (!name) return err('نام حساب تفصیلی را وارد کنید.');
    const L = st.tafsil || (st.tafsil = []); const code = Core.toEn(String(d.code || '').trim()) || Core.nextTafsilCode(st);
    if (L.some(t => t.code === code)) return err('این کد تفصیلی قبلاً ثبت شده است.'); if (L.some(t => t.name === name && !t.archived)) return err('حساب تفصیلی با این نام وجود دارد.');
    const t = { id: nid(st), code, name }; L.push(t); return ok({ tafsil: t });
  };
  Core.editTafsil = function (st, id, d) {
    const t = byId(st.tafsil || [], id); if (!t) return err('حساب تفصیلی پیدا نشد.');
    const name = String(d.name || '').trim(); if (!name) return err('نام حساب تفصیلی را وارد کنید.');
    const code = Core.toEn(String(d.code || '').trim()) || t.code; if (st.tafsil.some(x => x !== t && x.code === code)) return err('این کد تفصیلی قبلاً ثبت شده است.');
    Object.assign(t, { name, code }); if (d.archived != null) t.archived = !!d.archived; return ok();
  };
  Core.deleteTafsil = function (st, id) {
    if ((st.vouchers || []).some(v => v.lines.some(l => l.acc.endsWith(':T' + id)))) return err('این حساب تفصیلی در اسناد استفاده شده؛ به‌جای حذف، بایگانی‌اش کنید.');
    st.tafsil = (st.tafsil || []).filter(t => t.id !== id); return ok();
  };
  // group (1–6) of a ledger key; persons by the sign of their balance
  const keyCode = (k, bal) => (k[0] === 'P' ? (bal >= 0 ? '1103' : '2101') : k.split(':')[0]);
  Core.keyCode = keyCode;
  Core.journal = function (st, to, o) {
    o = o || {}; ensureAcct(st); const rp = Core.replay(st), E = [], P = id => 'P' + id, only = o.only, pick = o.pick, want = (k, id) => (pick ? pick(k, id) : !only || only[k] === id); // o.only = { inv: 12 } → just that document's entries
    const add = (date, desc, lines, ref, rk) => { const L = lines.filter(l => l && (l[1] || l[2])).map(l => ({ acc: l[0], dr: Math.round(l[1] || 0), cr: Math.round(l[2] || 0) })); if (L.length && (!to || date <= to)) { const e = { date, desc, lines: L, ref }; if (rk) e.rk = rk; E.push(e); } };
    const acc = id => { const a = byId(st.accounts, id); return (a && a.kind === 'bank' ? '1102:' : '1101:') + id; };
    // opening balances
    st.accounts.forEach(a => { if (a.opening && want('acct', a.id)) add('0000-00-00', 'موجودی اول دوره ' + acctName(a), a.opening > 0 ? [[acc(a.id), a.opening, 0], ['3101', 0, a.opening]] : [['3101', -a.opening, 0], [acc(a.id), 0, -a.opening]], { acct: a.id }); });
    if (st.settings && st.settings.openingCash && !only) { const c = st.accounts.find(a => a.kind === 'cash'); add('0000-00-00', 'موجودی اول دوره صندوق', [[acc(c.id), st.settings.openingCash, 0], ['3101', 0, st.settings.openingCash]]); }
    st.invoices.forEach(inv => {
      if (!want('inv', inv.id)) return;
      const t = Core.invoiceTotals(inv), c = rp.cogs[inv.id] || 0, ex = t.total - t.vat, lbl = Core.TYPE_FA[inv.type] + ' - فاکتور ' + inv.no, ref = { inv: inv.id };
      if (inv.type === 'sale') { add(inv.date, lbl, [[P(inv.personId), t.total, 0], ['4103', t.discount, 0], ['4101', 0, t.sub], ['2102', 0, t.vat]], ref); add(inv.date, 'بهای تمام‌شده ' + lbl, [['5101', c, 0], ['1104', 0, c]], ref); }
      else if (inv.type === 'purchase') add(inv.date, lbl, [['1104', ex, 0], ['1105', t.vat, 0], [P(inv.personId), 0, t.total]], ref);
      else if (inv.type === 'sale_return') { add(inv.date, lbl, [['4102', ex, 0], ['2102', t.vat, 0], [P(inv.personId), 0, t.total]], ref); add(inv.date, 'برگشت بهای تمام‌شده ' + lbl, [['1104', -c, 0], ['5101', 0, -c]], ref); }
      else if (inv.type === 'purchase_return') add(inv.date, lbl, [[P(inv.personId), t.total, 0], ['5101', Math.max(c, 0), Math.max(-c, 0)], ['1105', 0, t.vat], ['1104', 0, c + ex]], ref); // a return below average cost is a loss
    });
    st.adjusts.forEach(a => {
      if (!want('adj', a.id)) return;
      const eff = rp.adjEffect[a.id] || 0, p = byId(st.products, a.productId), lbl = (a.opening ? 'موجودی اولیه ' : 'تعدیل انبار ') + (p ? p.name : '');
      if (a.opening) add(a.date, lbl, [['1104', -eff, 0], ['3101', 0, -eff]], { adj: a.id });
      else if (eff < 0) add(a.date, lbl, [['1104', -eff, 0], ['5102', 0, -eff]], { adj: a.id }); else add(a.date, lbl, [['5102', eff, 0], ['1104', 0, eff]], { adj: a.id });
    });
    const groups = new Map();
    st.tx.forEach(t => {
      if (t.type === 'invoice' || t.type === 'voucher' || t.type === 'chq') return; // vouchers and cheques post their own lines below
      if (t.type === 'transfer') { const g = groups.get(t.group) || []; g.push(t); groups.set(t.group, g); return; }
      if (!want('tx', t.id)) return;
      const pr = P(t.personId), ref = { tx: t.id };
      if (t.type === 'receipt') add(t.date, t.desc || 'دریافت', [[acc(t.acct != null ? t.acct : acctFor(st, null, t.method).id), t.amount, 0], [pr, 0, t.amount]], ref);
      else if (t.type === 'payment') add(t.date, t.desc || 'پرداخت', [[pr, t.amount, 0], [acc(t.acct != null ? t.acct : acctFor(st, null, t.method).id), 0, t.amount]], ref);
      else if (t.type === 'opening') add(t.date, 'مانده اول دوره ' + ((byId(st.people, t.personId) || {}).name || ''), t.kind === 'debit' ? [[pr, t.amount, 0], ['3101', 0, t.amount]] : [['3101', t.amount, 0], [pr, 0, t.amount]], ref);
      else if (t.manualPosting === 'suspense') add(t.date, t.desc || 'ثبت دستی', t.kind === 'debit' ? [[pr, t.amount, 0], ['2190', 0, t.amount]] : [['2190', t.amount, 0], [pr, 0, t.amount]], ref);
      // Old manual documents keep their historical accounting treatment; never silently rewrite a closed year's P&L.
      else add(t.date, t.desc || 'ثبت دستی (قدیمی)', t.kind === 'debit' ? [[pr, t.amount, 0], ['4201', 0, t.amount]] : [['6900', t.amount, 0], [pr, 0, t.amount]], ref);
    });
    groups.forEach(g => { const dr = g.find(t => t.kind === 'debit'), cr = g.find(t => t.kind === 'credit'); if (dr && cr && (want('tx', dr.id) || want('tx', cr.id))) add(dr.date, dr.desc || 'حواله', [[P(dr.personId), dr.amount, 0], [P(cr.personId), 0, cr.amount]], { tx: dr.id }); });
    st.expenses.forEach(e => want('exp', e.id) && add(e.date, 'هزینه: ' + e.title, [['6100' + (e.category ? ':' + e.category : ''), e.amount, 0], [acc(e.acct != null ? e.acct : acctFor(st, null, e.method).id), 0, e.amount]], { exp: e.id }));
    (st.acctTx || []).forEach(x => { if (!want('xfer', x.id)) return; add(x.date, 'انتقال وجه' + (x.desc ? ' - ' + x.desc : ''), [[acc(x.to), x.amount, 0], [acc(x.from), 0, x.amount]], { xfer: x.id }); if (x.fee) add(x.date, 'کارمزد انتقال وجه', [['6200', x.fee, 0], [acc(x.from), 0, x.fee]], { xfer: x.id }); });
    // «اختتامیه» and «افتتاحیه» cancel each other and are listed (o.yearEnd) but never summed: every balance is the balance before the closing entry, as in any standard ledger
    (st.vouchers || []).forEach(v => { const ye = v.kind === 'yclose' || v.kind === 'yopen'; if ((ye && !o.yearEnd) || (o.noClosing && v.kind === 'closing') || !want('vch', v.id)) return; add(v.date, (v.kind === 'manual' ? 'سند دستی ' + v.no + ' - ' : '') + (v.desc || ''), v.lines.map(l => [l.acc, l.dr, l.cr]), { vch: v.id }, v.kind === 'yopen' ? -1 : v.kind === 'closing' ? (v.step || 1) : v.kind === 'yclose' ? 3 : 0); });
    st.cheques.forEach(c => { if (c.cyc && want('chq', c.id)) chequeEntries(st, c).forEach(e => add(e.date, e.desc, e.lines, { chq: c.id })); });
    // same day: the opening entry first; closing temporary accounts, moving the profit, then the closing entry last
    return E.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.rk || 0) - (b.rk || 0)));
  };
  // ── accounting documents (اسناد حسابداری): journal entries grouped by the document that made them ──
  Core.DOC_KIND = { sale: 'فاکتور فروش', purchase: 'فاکتور خرید', sale_return: 'برگشت از فروش', purchase_return: 'برگشت از خرید', receipt: 'دریافت', payment: 'پرداخت', transfer: 'حواله', opening: 'اول دوره', manual: 'ثبت دستی', expense: 'هزینه', xfer: 'انتقال وجه', adjust: 'انبار', voucher: 'سند دستی', closing: 'بستن حساب‌های موقت', yclose: 'سند اختتامیه', yopen: 'سند افتتاحیه', cheque: 'چک' };
  const refKey = r => (r.inv ? 'inv' + r.inv : r.tx ? 'tx' + r.tx : r.exp ? 'exp' + r.exp : r.xfer ? 'xfer' + r.xfer : r.adj ? 'adj' + r.adj : r.vch ? 'vch' + r.vch : r.chq ? 'chq' + r.chq : r.acct ? 'acct' + r.acct : 'open');
  const docKind = (st, r) => {
    if (r.inv) { const i = byId(st.invoices, r.inv); return i ? i.type : 'sale'; }
    if (r.tx) { const t = byId(st.tx, r.tx); return !t ? 'manual' : t.type === 'receipt' || t.type === 'payment' || t.type === 'transfer' || t.type === 'opening' ? t.type : 'manual'; }
    if (r.exp) return 'expense'; if (r.xfer) return 'xfer'; if (r.adj) { const a = byId(st.adjusts, r.adj); return a && a.opening ? 'opening' : 'adjust'; }
    if (r.vch) { const v = byId(st.vouchers || [], r.vch); return v && (v.kind === 'closing' || v.kind === 'yclose' || v.kind === 'yopen') ? v.kind : 'voucher'; }
    if (r.chq) return 'cheque'; return 'opening';
  };
  const groupDocs = (st, J) => { const m = new Map(), out = []; J.forEach(e => { const r = e.ref || {}, k = refKey(r) + '|' + e.date; let d = m.get(k); if (!d) { d = { key: k, date: e.date, desc: e.desc, ref: r, kind: docKind(st, r), entries: [], dr: 0 }; m.set(k, d); out.push(d); } d.entries.push(e); e.lines.forEach(l => { d.dr += l.dr; }); }); return out; };
  // fixed document numbers (شماره سند): given once, in the order the documents were entered, and never changed —
  // editing keeps the number, deleting leaves a gap. Stored compactly as st.docNo = { k: "key1 key2 …" } (number = position);
  // figures are not touched.
  const noKey = d => (d.ref.chq ? d.key : d.key.split('|')[0]);
  let noCache = { k: null, m: null };
  const noMap = st => { const k = (st.docNo && typeof st.docNo.k === 'string') ? st.docNo.k : ''; if (noCache.k !== k) { const m = new Map(); if (k) k.split(' ').forEach((x, i) => m.set(x, i + 1)); noCache = { k, m }; } return noCache.m; };
  const applyNos = (st, D) => { const m = noMap(st); D.forEach(d => { d.no = m.get(noKey(d)) || 0; }); return D; };
  Core.docNoCount = st => noMap(st).size;
  Core.assignDocNos = function (st, D) {
    const miss = D.filter(d => !d.no); if (!miss.length) return 0;
    const m = noMap(st), idOf = d => +(/\d+/.exec(d.key.split('|')[0]) || [0])[0], id = new Map(miss.map(d => [d, idOf(d)])), add = [];
    miss.sort((a, b) => id.get(a) - id.get(b) || (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    let n = m.size; miss.forEach(d => { const k = noKey(d); if (!m.has(k)) { add.push(k); m.set(k, ++n); } d.no = m.get(k); });
    let w = (st.docNo && st.docNo.w) || 0; for (const d of miss) { const x = id.get(d); if (x > w) w = x; }
    if (add.length || w !== ((st.docNo && st.docNo.w) || 0)) { const k = add.length ? ((st.docNo && st.docNo.k) ? st.docNo.k + ' ' : '') + add.join(' ') : st.docNo.k; st.docNo = { k, w }; noCache = { k, m }; }
    return miss.length;
  };
  Core.documents = function (st, o) { const D = applyNos(st, groupDocs(st, Core.journal(st, null, Object.assign({ yearEnd: true }, o)))); D.assigned = Core.assignDocNos(st, D); return D; }; // oldest first
  // the document(s) of one invoice / receipt / expense …: ref = { inv: 12 } (a cheque gives one document per step)
  Core.docsOf = function (st, ref) {
    let D = applyNos(st, groupDocs(st, Core.journal(st, null, { only: ref, yearEnd: true }))), assigned = 0;
    if (D.some(d => !d.no)) { // number everything entered since the last numbering first (in entry order), not the whole book
      const w = (st.docNo && st.docNo.w) || 0, rk = Object.keys(ref)[0], rid = ref[rk];
      const N = applyNos(st, groupDocs(st, Core.journal(st, null, { pick: (k, id) => id > w || (k === rk && id === rid), yearEnd: true })));
      assigned = Core.assignDocNos(st, N); D = applyNos(st, D);
    }
    D.assigned = assigned; return D;
  };
  // every word and number in a document, for the documents page search
  const tgCache = new WeakMap(), txGroups = st => { let c = tgCache.get(st.tx); if (!c || c.len !== st.tx.length) { const m = new Map(); st.tx.forEach(x => { if (x.group) { if (!m.has(x.group)) m.set(x.group, []); m.get(x.group).push(x); } }); c = { len: st.tx.length, m }; tgCache.set(st.tx, c); } return c.m; };
  Core.docText = function (st, d) {
    const r = d.ref, P = id => (byId(st.people, id) || {}).name || '', parts = [Core.DOC_KIND[d.kind], d.no ? 'سند ' + d.no : ''];
    d.entries.forEach(e => { parts.push(e.desc); e.lines.forEach(l => { parts.push(Core.accName(st, l.acc), keyCode(l.acc, l.dr - l.cr), l.dr || '', l.cr || ''); }); });
    if (r.inv) { const i = byId(st.invoices, r.inv); if (i) { const t = Core.invoiceTotals(i); parts.push(i.no, P(i.personId), i.note || '', t.total, i.discount || '', i.paid || '', i.by || ''); i.items.forEach(l => parts.push((byId(st.products, l.productId) || {}).name || '', l.note || '', l.price, l.qty)); } }
    if (r.tx) { const t = byId(st.tx, r.tx); if (t) { parts.push(P(t.personId), t.desc || '', t.note || '', t.amount, t.by || ''); if (t.group) (txGroups(st).get(t.group) || []).forEach(x => { if (x !== t) parts.push(P(x.personId)); }); } }
    if (r.exp) { const e = byId(st.expenses, r.exp); if (e) parts.push(e.title, e.category || '', e.note || '', e.amount, e.by || ''); }
    if (r.xfer) { const x = byId(st.acctTx || [], r.xfer); if (x) parts.push(x.desc || '', x.amount, x.fee || ''); }
    if (r.vch) { const v = byId(st.vouchers || [], r.vch); if (v) { parts.push(v.no, v.desc || '', v.by || ''); v.lines.forEach(l => parts.push(l.desc || '')); } }
    if (r.chq) { const c = byId(st.cheques, r.chq); if (c) parts.push(c.serial || '', c.bank || '', c.title || '', P(c.personId), c.amount, c.note || '', c.dueDate ? Core.isoToJalali(c.dueDate) : ''); }
    if (r.adj) { const a = byId(st.adjusts, r.adj); if (a) parts.push((byId(st.products, a.productId) || {}).name || '', a.note || '', a.qty); }
    const dates = []; if (d.date !== '0000-00-00') dates.push(Core.isoToJalali(d.date)); if (r.chq) { const c = byId(st.cheques, r.chq); if (c && c.dueDate) dates.push(Core.isoToJalali(c.dueDate)); }
    const notes = []; if (r.inv) { const i = byId(st.invoices, r.inv); if (i) { notes.push(i.note || ''); i.items.forEach(l => notes.push(l.note || '')); } }
    return ' ' + Core.norm(Core.toEn(parts.filter(x => x !== '' && x != null).join(' '))) + ' ' + dates.join(' ') + ' ' + snPart(notes);
  };
  // query → words; "5,000,000" and "۵٬۰۰۰٬۰۰۰" become 5000000, "1404/07/12" stays one word
  // dates (1404/7/12) are matched whole, numbers as whole numbers (215 does not find 32150000), words anywhere in a word
  Core.docQuery = q => {
    let s = Core.toEn(String(q || '')).replace(/(\d)[,٬،](?=\d{3}(?!\d))/g, '$1'); const out = [];
    s = s.replace(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/g, (m, y, mo, d) => { out.push({ d: y + '/' + mo.padStart(2, '0') + '/' + d.padStart(2, '0') }); return ' '; });
    Core.norm(s).split(' ').filter(Boolean).forEach(w => out.push(/^\d+$/.test(w) ? { n: ' ' + w + ' ' } : { w }));
    return out;
  };
  // The distinct serial field allows short prefixes without treating amounts as partial matches.
  Core.docMatch = (text, q) => { const k = text.indexOf('¦'), sn = k < 0 ? '' : text.slice(k + 1); return q.every(x => (x.n ? text.includes(x.n) || (x.n.trim().length >= 3 && sn.split(/\s+/).some(v => Core.serialMatches(v, x.n.trim()))) : x.d ? text.includes(' ' + x.d + ' ') : text.includes(x.w))); };
  const snPart = notes => { const L = []; notes.forEach(n => Core.extractSerials(n).forEach(x => L.push(x.toLowerCase()))); return L.length ? ' ¦ ' + L.join(' ') + ' ' : ''; };
  // every word and number of an invoice, for the invoices search (same rules as the documents search)
  Core.invText = function (st, inv) {
    const t = Core.invoiceTotals(inv), p = byId(st.people, inv.personId) || {}, parts = [Core.TYPE_FA[inv.type], 'فاکتور', inv.no, p.name || '', p.phone ? Core.toEn(p.phone) : '', t.total, t.sub, inv.discount || '', inv.paid || '', inv.note || '', inv.by || ''];
    inv.items.forEach(l => { const pr = byId(st.products, l.productId) || {}; parts.push(pr.name || '', pr.sku || '', l.note || '', l.price, l.qty, Math.round(l.qty * l.price)); });
    return ' ' + Core.norm(Core.toEn(parts.filter(x => x !== '' && x != null).join(' '))) + ' ' + Core.isoToJalali(inv.date) + ' ' + (snPart([inv.note || ''].concat(inv.items.map(l => l.note || ''))) || ' ¦ ') + (p.phone ? Core.toEn(p.phone).replace(/\D/g, '') + ' ' : '');
  };
  // name of a ledger account: "1101:5" = a cash box, "P12" = a person, "6100:اجاره" = an expense group
  Core.accName = function (st, k) {
    if (k[0] === 'P') { const p = byId(st.people, +k.slice(1)); return p ? p.name : 'شخص'; }
    const i = k.indexOf(':'), code = i < 0 ? k : k.slice(0, i), sub = i < 0 ? '' : k.slice(i + 1);
    if ((code === '1101' || code === '1102') && sub) return acctName(byId(st.accounts, +sub));
    if (sub && /^T\d+$/.test(sub)) { const t = byId(st.tafsil || [], +sub.slice(1)); return (t ? t.name : 'تفصیلی') + ' (' + Core.coaName(st, code) + ')'; }
    if (code === '6100' && sub) return 'هزینه ' + sub;
    return Core.coaName(st, code);
  };
  // trial balance: turnover in the period and the balance at its end, by group account (persons split into debtors / creditors)
  Core.trialBalance = function (st, from, to, detail, o) {
    o = o || {}; const lvl = detail === true || detail === 'detail' ? 'detail' : detail === 'kol' ? 'kol' : 'moin';
    const J = Core.journal(st, to, o), m = new Map();
    const get = k => { let x = m.get(k); if (!x) { x = { key: k, dr: 0, cr: 0, odr: 0, ocr: 0 }; m.set(k, x); } return x; };
    J.forEach(e => e.lines.forEach(l => { const x = get(l.acc); if (from && e.date < from) { x.odr += l.dr; x.ocr += l.cr; } else { x.dr += l.dr; x.cr += l.cr; } }));
    let rows = [...m.values()].map(x => { const bal = x.odr + x.dr - x.ocr - x.cr; return Object.assign(x, { bal, name: Core.accName(st, x.key), code: keyCode(x.key, bal) }); });
    if (lvl !== 'detail') { // group by معین (4 digits) or کل (2 digits)
      const cut = lvl === 'kol' ? 2 : 4, g = new Map(); rows.forEach(r => { const c = r.code.slice(0, cut), y = g.get(c) || { key: c, code: c, name: Core.coaName(st, c), dr: 0, cr: 0, bal: 0, n: 0 }; y.dr += r.dr; y.cr += r.cr; y.bal += r.bal; y.n++; g.set(c, y); });
      rows = [...g.values()];
    }
    rows = rows.filter(r => r.dr || r.cr || r.bal).sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : (a.name < b.name ? -1 : 1)));
    const tot = rows.reduce((t, r) => ({ dr: t.dr + r.dr, cr: t.cr + r.cr, bd: t.bd + Math.max(r.bal, 0), bc: t.bc + Math.max(-r.bal, 0) }), { dr: 0, cr: 0, bd: 0, bc: 0 });
    return { rows, tot, balanced: tot.dr === tot.cr && tot.bd === tot.bc, entries: J.filter(e => !from || e.date >= from).length };
  };
  // general ledger (دفتر کل / معین): every line of one account (or a group: '1102' = all banks, 'P' = all persons) with a running balance
  Core.glMatch = (key, acc) => (key === 'P' ? acc[0] === 'P' : acc === key || acc.startsWith(key + ':'));
  Core.generalLedger = function (st, key, from, to) {
    const J = Core.journal(st, to); let carry = 0, dr = 0, cr = 0; const rows = [];
    J.forEach(e => e.lines.forEach(l => { if (!Core.glMatch(key, l.acc)) return; if (from && e.date < from) { carry += l.dr - l.cr; return; } dr += l.dr; cr += l.cr; rows.push({ date: e.date, desc: e.desc, acc: l.acc, dr: l.dr, cr: l.cr, ref: e.ref }); }));
    rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)); let b = carry; rows.forEach(r => { b += r.dr - r.cr; r.bal = b; });
    return { key, carry, rows, dr, cr, bal: carry + dr - cr };
  };
  // the accounts that have any movement, for the ledger picker: [{ key, name, sub: [{ key, name }] }]
  Core.glAccounts = function (st, to) {
    const seen = new Map(); Core.journal(st, to).forEach(e => e.lines.forEach(l => seen.set(l.acc, 1)));
    const groups = new Map(), add = (gk, gname, k) => { let g = groups.get(gk); if (!g) { g = { key: gk, name: gname, sub: [] }; groups.set(gk, g); } if (k !== gk) g.sub.push({ key: k, name: Core.accName(st, k) }); };
    [...seen.keys()].forEach(k => { if (k[0] === 'P') add('P', 'اشخاص (دریافتنی و پرداختنی)', k); else { const c = k.split(':')[0]; add(c, (CHART[c] || [c])[0], k); } });
    return [...groups.values()].sort((a, b) => (a.key === 'P' ? '1103' : a.key) < (b.key === 'P' ? '1103' : b.key) ? -1 : 1).map(g => (g.sub.sort((a, b) => (a.name < b.name ? -1 : 1)), g));
  };
  // profit and loss from the ledger, and the balance sheet at a date
  Core.ledgerPL = function (st, from, to) {
    const tb = Core.trialBalance(st, from, to, false, { noClosing: true }), v = f => tb.rows.filter(r => f(r.code)).reduce((t, r) => t + r.dr - r.cr, 0);
    const sales = -v(c => c === '4101'), ret = v(c => c === '4102'), disc = v(c => c === '4103'), other = -v(c => c[0] === '4' && !['4101', '4102', '4103'].includes(c));
    const cogs = v(c => c === '5101'), waste = v(c => c[0] === '5' && c !== '5101');
    const opex = v(c => c.slice(0, 2) === '61'), fee = v(c => c.slice(0, 2) === '62'), otherExp = v(c => c[0] === '6' && !['61', '62'].includes(c.slice(0, 2)));
    const netSales = sales - ret - disc, gross = netSales - cogs - waste, net = gross + other - opex - fee - otherExp;
    const lines = tb.rows.filter(r => '456'.includes(r.code[0])).map(r => ({ code: r.code, name: r.name, amt: r.code[0] === '4' ? r.cr - r.dr : r.dr - r.cr }));
    const z = v => v + 0 || 0; // never -0
    return { sales: z(sales), ret: z(ret), disc: z(disc), netSales: z(netSales), cogs: z(cogs), waste: z(waste), gross: z(gross), other: z(other), opex: z(opex), fee: z(fee), otherExp: z(otherExp), net: z(net), lines };
  };
  Core.balanceSheet = function (st, to) {
    const tb = Core.trialBalance(st, null, to, true), sum = f => tb.rows.filter(f).reduce((t, r) => t + r.bal, 0);
    const cash = sum(r => r.code === '1101'), bank = sum(r => r.code === '1102'), recv = sum(r => r.code === '1103'), inv = sum(r => r.code === '1104'), vatIn = sum(r => r.code === '1105');
    const chqIn = sum(r => r.code === '1106' || r.code === '1107'), otherA = sum(r => r.code[0] === '1' && !['1101', '1102', '1103', '1104', '1105', '1106', '1107'].includes(r.code));
    const pay = -sum(r => r.code === '2101'), vatOut = -sum(r => r.code === '2102'), chqOut = -sum(r => r.code === '2103'), otherL = -sum(r => r.code[0] === '2' && !['2101', '2102', '2103'].includes(r.code));
    const capital = -sum(r => r.code === '3101'), retained = -sum(r => r.code === '3102'), otherE = -sum(r => r.code[0] === '3' && !['3101', '3102'].includes(r.code));
    const pl = -sum(r => '456'.includes(r.code[0])), vatNet = vatOut - vatIn; // this period's profit: what the temporary accounts still hold (after any year-end closing)
    const assets = cash + bank + recv + inv + chqIn + otherA + (vatNet < 0 ? -vatNet : 0), liab = pay + chqOut + otherL + (vatNet > 0 ? vatNet : 0), equity = capital + retained + otherE + pl;
    const z = v => v + 0 || 0;
    const others = (g, sign) => tb.rows.filter(r => r.code[0] === g && r.bal && !CHART[r.code]).reduce((m, r) => { m[r.code] = (m[r.code] || 0) + sign * r.bal; return m; }, {});
    return { cash: z(cash), bank: z(bank), recv: z(recv), inv: z(inv), vatIn: z(vatIn), vatOut: z(vatOut), vatNet: z(vatNet), pay: z(pay), capital: z(capital), profit: z(pl), chqIn: z(chqIn), chqOut: z(chqOut), otherA: z(otherA), otherL: z(otherL), retained: z(retained), otherE: z(otherE), extraA: others('1', 1), extraL: others('2', -1), extraE: others('3', -1), assets: z(assets), liab: z(liab), equity: z(equity), balanced: assets === liab + equity };
  };

  /* ───────────── manual vouchers (سند حسابداری دستی) ─────────────
   * st.vouchers = [{ id, no, date, desc, kind: 'manual' | 'closing', lines: [{ acc, dr, cr, note }] }]
   * acc keys: '4201' (a معین), '2105:T7' (معین + your detail account), 'P12' (a person), '1101:3' / '1102:4' (a cash box / bank), '6100:اجاره' (an expense group).
   * A person line also goes on the person's account (tx type 'voucher'); a cash/bank line moves that account's balance. */
  const acctKey = (st, id) => { const a = byId(ensureAcct(st), id); return (a && a.kind === 'bank' ? '1102:' : '1101:') + id; };
  Core.acctKey = acctKey;
  // the latest day of a closed fiscal year ('' when none) — nothing on or before it may change
  const closedTo = st => (st.fyClosed || []).reduce((m, y) => (y.to > m ? y.to : m), '');
  Core.closedTo = closedTo;
  const inClosed = (st, d) => { const c = closedTo(st); return !!(c && d && d <= c); };
  Core.inClosed = inClosed;
  const closedErr = st => err('این تاریخ در سال مالی بسته‌شده است (تا ' + Core.fmtDate(closedTo(st)) + '). برای تغییر، اول بستن آن سال را برگردانید.');
  // is a key a valid place for a manual voucher line? → '' or the reason
  Core.postable = function (st, acc) {
    acc = String(acc || '');
    if (acc[0] === 'P') return byId(st.people, +acc.slice(1)) ? '' : 'شخص پیدا نشد.';
    const i = acc.indexOf(':'), code = i < 0 ? acc : acc.slice(0, i), sub = i < 0 ? '' : acc.slice(i + 1);
    const m = coaMoin(st, code); if (!m) return 'حساب ' + Core.toFa(code) + ' در کدینگ نیست.';
    if (m.lock) return m.lock;
    if (m.need === 'person') return 'برای ' + m.name + ' شخص را انتخاب کنید.';
    if (m.need === 'cash' || m.need === 'bank') { const a = sub && byId(ensureAcct(st), +sub); return a && a.kind === m.need ? '' : (m.need === 'cash' ? 'صندوق را انتخاب کنید.' : 'حساب بانکی را انتخاب کنید.'); }
    if (sub && /^T\d+$/.test(sub)) return byId(st.tafsil || [], +sub.slice(1)) ? '' : 'حساب تفصیلی پیدا نشد.';
    if (sub && code !== '6100') return 'حساب تفصیلی نامعتبر است.';
    return '';
  };
  Core.nextVoucherNo = st => String((st.vouchers || []).reduce((m, v) => Math.max(m, +v.no || 0), 0) + 1);
  function cleanLines(st, lines) {
    const L = [];
    for (const l of lines || []) {
      const dr = Math.round(+l.dr || 0), cr = Math.round(+l.cr || 0);
      if (!l.acc && !dr && !cr) continue;
      if (!l.acc) return { error: 'برای همه ردیف‌ها حساب را انتخاب کنید.' };
      const why = Core.postable(st, l.acc); if (why) return { error: why };
      if (dr < 0 || cr < 0 || dr > MAX_MONEY || cr > MAX_MONEY) return { error: 'مبلغ نامعتبر است.' };
      if ((dr > 0) === (cr > 0)) return { error: 'هر ردیف باید فقط بدهکار یا فقط بستانکار داشته باشد (ردیف «' + Core.accName(st, l.acc) + '»).' };
      L.push({ acc: String(l.acc), dr, cr, note: String(l.note || '').trim().slice(0, 200) });
    }
    if (L.length < 2) return { error: 'سند حسابداری حداقل دو ردیف (یک بدهکار و یک بستانکار) لازم دارد.' };
    const dr = L.reduce((t, l) => t + l.dr, 0), cr = L.reduce((t, l) => t + l.cr, 0);
    if (dr !== cr) return { error: 'سند تراز نیست: جمع بدهکار ' + Core.fmt(dr) + ' و جمع بستانکار ' + Core.fmt(cr) + '؛ اختلاف ' + Core.fmt(Math.abs(dr - cr)) + '.' };
    return { lines: L, total: dr };
  }
  Core.voucherCheck = (st, lines) => cleanLines(st, lines);
  // the person-account side of a voucher
  function syncVoucherTx(st, v) {
    st.tx = st.tx.filter(t => !(t.type === 'voucher' && t.vch === v.id));
    if (v.kind !== 'manual') return;
    v.lines.forEach((l, k) => { if (l.acc[0] !== 'P') return; st.tx.push({ id: nid(st), personId: +l.acc.slice(1), kind: l.dr ? 'debit' : 'credit', amount: l.dr || l.cr, type: 'voucher', desc: 'سند ' + v.no + (l.note || v.desc ? ' - ' + (l.note || v.desc) : ''), date: v.date, ref: null, group: null, method: null, vch: v.id, line: k }); });
  }
  Core.addVoucher = function (st, d) {
    const de = checkDate(d.date); if (de) return err(de); if (inClosed(st, d.date)) return closedErr(st);
    const c = cleanLines(st, d.lines); if (c.error) return err(c.error);
    const V = st.vouchers || (st.vouchers = []);
    const no = String(d.no || '').trim() ? Core.toEn(String(d.no).trim()) : Core.nextVoucherNo(st); if (V.some(v => v.no === no)) return err('شماره سند تکراری است.');
    const v = { id: nid(st), no, date: d.date, desc: String(d.desc || '').trim().slice(0, 300), kind: 'manual', lines: c.lines };
    V.push(v); syncVoucherTx(st, v); return ok({ voucher: v });
  };
  Core.editVoucher = function (st, id, d) {
    const v = byId(st.vouchers || [], id); if (!v) return err('سند پیدا نشد.'); if (v.kind !== 'manual') return err('این سند خودکار است و دستی ویرایش نمی‌شود.');
    const de = checkDate(d.date); if (de) return err(de); if (inClosed(st, v.date) || inClosed(st, d.date)) return closedErr(st);
    const c = cleanLines(st, d.lines); if (c.error) return err(c.error);
    const no = String(d.no || '').trim() ? Core.toEn(String(d.no).trim()) : v.no; if (st.vouchers.some(x => x !== v && x.no === no)) return err('شماره سند تکراری است.');
    Object.assign(v, { no, date: d.date, desc: String(d.desc || '').trim().slice(0, 300), lines: c.lines }); syncVoucherTx(st, v); return ok({ voucher: v });
  };
  Core.deleteVoucher = function (st, id) {
    const v = byId(st.vouchers || [], id); if (!v) return err('سند پیدا نشد.'); if (v.kind !== 'manual') return err('سند بستن حساب‌ها فقط با «برگرداندن بستن سال» حذف می‌شود.');
    if (inClosed(st, v.date)) return closedErr(st);
    st.vouchers = st.vouchers.filter(x => x !== v); st.tx = st.tx.filter(t => !(t.type === 'voucher' && t.vch === id)); return ok();
  };

  /* ───────────── fiscal years and year-end closing (بستن سال مالی) ─────────────
   * Closing a year posts four documents, in the order of the accounting rules:
   *  1. «سند بستن حساب‌های موقت» (last day): every income, cost and expense account to zero, against «خلاصه سود و زیان» (3104);
   *  2. «سند انتقال سود و زیان» (last day): «خلاصه سود و زیان» to zero, against «سود (زیان) انباشته» (3102);
   *  3. «سند اختتامیه» (last day): every asset, liability and equity account to zero, down to each person, cash box and bank;
   *  4. «سند افتتاحیه» (first day of the next year): the same balances opened again.
   * 3 and 4 cancel each other; they are documents to see and print, and balances everywhere are taken before the closing entry (one continuous book).
   * Before closing, the books must balance and the year must have no negative stock. Documents of a closed year can no longer change;
   * the closing can be undone (latest year first). Years closed by an older version keep their single closing document. */
  Core.fyRange = function (label, fyMonth) { const jy = +label, m = fyMonth || 1; const from = Core.partsToIso(jy, m, 1), to = Core.addDays(Core.partsToIso(jy + 1, m, 1), -1); return { label: String(jy), from, to }; };
  Core.fyOf = function (date, fyMonth) { const p = Core.isoToParts(date), m = fyMonth || 1; return Core.fyRange(p.jm >= m ? p.jy : p.jy - 1, m); };
  const firstDocDate = st => { let f = ''; const see = d => { if (d && d !== '0000-00-00' && (!f || d < f)) f = d; }; st.invoices.forEach(i => see(i.date)); st.tx.forEach(t => see(t.date)); st.expenses.forEach(e => see(e.date)); st.adjusts.forEach(a => see(a.date)); (st.acctTx || []).forEach(x => see(x.date)); (st.vouchers || []).forEach(v => see(v.date)); return f; };
  Core.fiscalYears = function (st, today) {
    const fm = (st.settings && st.settings.fyMonth) || 1, t = today || Core.todayISO(), first = firstDocDate(st) || t, out = [];
    for (let y = Core.fyOf(first, fm); y.from <= t; y = Core.fyRange(+y.label + 1, fm)) { const c = (st.fyClosed || []).find(x => x.label === y.label) || null; out.push(Object.assign(y, { closed: c, ended: y.to < t })); }
    return out;
  };
  // balances of temporary accounts (groups 4, 5, 6) at the end of a year → the closing documents
  Core.closingPreview = function (st, label, today, o) {
    o = o || {}; const fm = (st.settings && st.settings.fyMonth) || 1, y = Core.fyRange(label, fm), t = today || Core.todayISO(), problems = [];
    const years = Core.fiscalYears(st, t), i = years.findIndex(x => x.label === String(label));
    if (i < 0) problems.push('این سال مالی در محدوده اسناد نیست.');
    else { if (years[i].closed) problems.push('این سال قبلاً بسته شده است.'); if (years.slice(0, i).some(x => !x.closed)) problems.push('اول سال‌های قبل را به ترتیب ببندید.'); }
    if (y.to >= t) problems.push('سال مالی هنوز تمام نشده است (پایان: ' + Core.fmtDate(y.to) + ').');
    const tb = Core.trialBalance(st, null, y.to, true), lines = [], sum = []; let profit = 0;
    tb.rows.filter(r => '456'.includes(r.code[0]) && r.bal).forEach(r => { lines.push({ acc: r.key, dr: r.bal < 0 ? -r.bal : 0, cr: r.bal > 0 ? r.bal : 0 }); profit -= r.bal; });
    if (profit) { lines.push({ acc: '3104', dr: profit < 0 ? -profit : 0, cr: profit > 0 ? profit : 0 }); sum.push({ acc: '3104', dr: profit > 0 ? profit : 0, cr: profit < 0 ? -profit : 0 }, { acc: '3102', dr: profit < 0 ? -profit : 0, cr: profit > 0 ? profit : 0 }); }
    const warn = [];
    // strict rules: the trial balance must balance, and the cost of every sale of the year must be known (no negative stock inside the year)
    const dr = tb.rows.reduce((a, r) => a + r.dr, 0), cr = tb.rows.reduce((a, r) => a + r.cr, 0); if (dr !== cr) problems.push('تراز آزمایشی تا پایان سال تراز نیست (اختلاف ' + Core.fmt(Math.abs(dr - cr)) + ')؛ اول اسناد را اصلاح کنید.');
    if (!o.quick) { const au = Core.audit(st); if (au.length) problems.push('بررسی اسناد ' + Core.toFa(au.length) + ' مشکل پیدا کرد (مثلاً: ' + au[0] + ')؛ اول از «بررسی سلامت اطلاعات» اصلاح کنید.'); }
    const dateOf = e => (e.invoiceId ? (byId(st.invoices, e.invoiceId) || {}).date : e.adjId ? (byId(st.adjusts, e.adjId) || {}).date : '') || '';
    const neg = Core.replay(st).errors, inYear = neg.filter(e => dateOf(e) <= y.to);
    if (inYear.length) problems.push('در این سال ' + Core.toFa(inYear.length) + ' مورد موجودی منفی هست (' + stockErrText(st, inYear[0]) + ')؛ تا بهای تمام‌شده درست نباشد سال بسته نمی‌شود. اول خریدها یا موجودی اول دوره را ثبت کنید.');
    else if (neg.length) warn.push('بعد از این سال ' + Core.toFa(neg.length) + ' مورد موجودی منفی هست؛ قبل از بستن سال بعد اصلاح شود.');
    const open = st.cheques.filter(c => c.cyc && !c.done && c.dueDate <= y.to).length; if (open) warn.push(Core.toFa(open) + ' چک با سررسید داخل این سال هنوز تعیین تکلیف نشده (در سال بعد باقی می‌ماند).');
    return Object.assign(y, { lines, sum, profit, problems, warn, pl: Core.ledgerPL(st, y.from, y.to) });
  };
  // the closing (اختتامیه) lines: every permanent account at its detail level, after the temporary accounts are closed
  const permLines = (st, to) => Core.trialBalance(st, null, to, true).rows.filter(r => '123'.includes(r.code[0]) && r.bal).map(r => ({ acc: r.key, dr: r.bal < 0 ? -r.bal : 0, cr: r.bal > 0 ? r.bal : 0, note: '' }));
  Core.closeYear = function (st, label, today, o) {
    const pv = Core.closingPreview(st, label, today, o); if (pv.problems.length) return err(pv.problems[0]);
    const V = st.vouchers || (st.vouchers = []), bak = V.slice(), seq0 = st.seq, ids = [], L = l => Object.assign({ note: '' }, l);
    const post = (kind, date, desc, lines, step) => { if (!lines.length) return null; const v = { id: nid(st), no: Core.nextVoucherNo(st), date, desc, kind, fy: pv.label, lines: lines.map(L) }; if (step) v.step = step; V.push(v); ids.push(v.id); return v; };
    const fa = Core.toFa(pv.label);
    const v1 = post('closing', pv.to, 'سند بستن حساب‌های موقت (درآمد، بهای تمام‌شده و هزینه) به خلاصه سود و زیان - سال مالی ' + fa, pv.lines, 1);
    post('closing', pv.to, 'سند انتقال خلاصه سود و زیان به سود (زیان) انباشته - سال مالی ' + fa, pv.sum, 2);
    const close = permLines(st, pv.to), sum = x => x.reduce((t, l) => t + l.dr - l.cr, 0);
    if (sum(close) !== 0) { st.vouchers = bak; st.seq = seq0; return err('سند اختتامیه تراز نشد؛ بستن سال انجام نشد.'); }
    post('yclose', pv.to, 'سند اختتامیه سال مالی ' + fa, close);
    post('yopen', Core.addDays(pv.to, 1), 'سند افتتاحیه پس از سال مالی ' + fa, close.map(l => ({ acc: l.acc, dr: l.cr, cr: l.dr, note: '' })));
    const s0 = st.settings || (st.settings = {}), prevLock = s0.lockDate || null;
    (st.fyClosed || (st.fyClosed = [])).push({ label: pv.label, from: pv.from, to: pv.to, at: Date.now(), vch: v1 ? v1.id : null, vchs: ids, profit: pv.profit, prevLock });
    if (!s0.lockDate || s0.lockDate < pv.to) s0.lockDate = pv.to;
    return ok({ profit: pv.profit, voucherId: v1 ? v1.id : null, ids });
  };
  Core.reopenYear = function (st, label) {
    const L = st.fyClosed || []; const y = L.find(x => x.label === String(label)); if (!y) return err('این سال بسته نشده است.');
    if (L.some(x => x.to > y.to)) return err('اول سال‌های بعدی را برگردانید (از آخرین سال بسته‌شده).');
    const mine = v => (v.kind === 'closing' || v.kind === 'yclose' || v.kind === 'yopen') && (v.id === y.vch || v.fy === y.label || (y.vchs || []).includes(v.id));
    st.vouchers = (st.vouchers || []).filter(v => !mine(v));
    st.fyClosed = L.filter(x => x !== y);
    const s0 = st.settings || {}; if (s0.lockDate === y.to) { if (y.prevLock) s0.lockDate = y.prevLock; else delete s0.lockDate; }
    return ok();
  };
  // the closing (اختتامیه) and opening (افتتاحیه) entries of a year, for viewing and printing — not posted
  Core.yearEndEntries = function (st, label) {
    const fm = (st.settings && st.settings.fyMonth) || 1, y = Core.fyRange(label, fm), tb = Core.trialBalance(st, null, y.to, true);
    const perm = tb.rows.filter(r => '123'.includes(r.code[0]) && r.bal);
    const opening = perm.map(r => ({ acc: r.key, dr: r.bal > 0 ? r.bal : 0, cr: r.bal < 0 ? -r.bal : 0 }));
    const closing = opening.map(l => ({ acc: l.acc, dr: l.cr, cr: l.dr }));
    const tempLeft = tb.rows.filter(r => '456'.includes(r.code[0])).reduce((t, r) => t + r.bal, 0);
    if (tempLeft) { closing.push({ acc: '3102', dr: tempLeft < 0 ? 0 : tempLeft, cr: tempLeft < 0 ? -tempLeft : 0, note: 'سود (زیان) سال که هنوز بسته نشده' }); opening.push({ acc: '3102', dr: tempLeft < 0 ? 0 : tempLeft, cr: tempLeft < 0 ? -tempLeft : 0, note: 'سود (زیان) سال قبل' }); }
    return { label: y.label, closingDate: y.to, openingDate: Core.addDays(y.to, 1), closing, opening };
  };

  /* ───────────── cheque lifecycle (چرخه کامل چک) ─────────────
   * Cheques registered from this version (c.cyc = 1) are real documents:
   *  received: «در صندوق» (اسناد دریافتنی) → «واگذار به بانک» (در جریان وصول) → «وصول شد» | «برگشت خورد»; from the box also «خرج شد» (to a supplier) or «عودت»;
   *  issued:   «صادر شده» (اسناد پرداختنی) → «پاس شد» | «برگشت خورد» | «باطل/عودت».
   * c.hist = [{ s, date, acct?, to? }] (s: state reached). Person effects are tx of type 'chq'; money effects show in moneyMoves; ledger lines come from chequeEntries.
   * Older cheques (no c.cyc) keep working exactly as before (a reminder that may record a receipt/payment when done). */
  const CHQ_FA = { box: 'در صندوق', bank: 'واگذار به بانک', cleared: 'وصول شد', spent: 'خرج شد', bounced: 'برگشت خورد', returned: 'عودت داده شد', issued: 'صادر شده', paid: 'پاس شد', cancelled: 'باطل / عودت' };
  Core.CHQ_FA = CHQ_FA;
  const CHQ_DONE = { cleared: 1, spent: 1, bounced: 1, returned: 1, paid: 1, cancelled: 1 };
  // what can happen next, by state
  Core.chequeNext = function (c) {
    if (!c.cyc) return [];
    return ({ box: ['bank', 'cleared', 'spent', 'returned'], bank: ['cleared', 'bounced'], spent: ['bounced'], issued: ['paid', 'bounced', 'cancelled'] })[c.state] || [];
  };
  // Read-only cheque recommendations. Never posts a transaction or changes the user's records.
  // Amounts are integer Rials; never recommend a total larger than the requested debt.
  // 1, 2 and 3-cheque combinations are searched with a bounded O(n^2) two-pointer pass.
  Core.suggestCheques = function (cheques, targetRial, options) {
    const opt = options || {}, target = Number(targetRial), limit = Math.max(1, Math.min(8, Number(opt.limit) || 5));
    if (!Number.isSafeInteger(target) || target <= 0 || !Array.isArray(cheques)) return [];
    const pool = cheques.filter(c => c && c.cyc && c.direction === 'receive' && c.state === 'box' &&
      Number.isSafeInteger(c.amount) && c.amount > 0 && c.amount <= target && Core.chequeNext(c).includes('spent'))
      .slice().sort((a, b) => a.amount - b.amount || String(a.dueDate || '').localeCompare(String(b.dueDate || '')) || a.id - b.id);
    // The selection is bounded for predictable performance on older Android devices.
    // Prioritise smaller amounts + amounts close to the requested debt.
    const max = Math.max(12, Math.min(240, Number(opt.maxCandidates) || 200));
    let A = pool;
    if (pool.length > max) {
      const small = pool.slice(0, Math.ceil(max / 2)), large = pool.slice(-Math.floor(max / 2));
      const ids = new Set(); A = small.concat(large).filter(c => { if (ids.has(c.id)) return false; ids.add(c.id); return true; })
        .sort((a, b) => a.amount - b.amount || a.id - b.id);
    }
    const ranked = [], seen = new Set();
    const keep = (items, sum) => {
      if (sum > target || sum <= 0 || !Number.isSafeInteger(sum)) return;
      const ids = items.map(c => c.id).sort((a, b) => a - b), k = ids.join(':');
      if (seen.has(k)) return; seen.add(k);
      const row = { ids, total: sum, difference: target - sum, exact: sum === target, count: ids.length,
        nextDue: items.map(c => c.dueDate || '9999-12-31').sort()[0] };
      ranked.push(row);
      ranked.sort((a, b) => a.difference - b.difference || a.count - b.count || a.nextDue.localeCompare(b.nextDue) || a.ids.join().localeCompare(b.ids.join()));
      if (ranked.length > limit) ranked.length = limit;
    };
    A.forEach(c => keep([c], c.amount));
    // Closest pair not exceeding target.
    for (let l = 0, r = A.length - 1; l < r;) {
      const sum = A[l].amount + A[r].amount;
      if (sum > target) { r--; continue; }
      keep([A[l], A[r]], sum); l++;
    }
    // Closest triple not exceeding target. Never spend cheques automatically.
    for (let i = 0; i < A.length - 2; i++) {
      let l = i + 1, r = A.length - 1;
      while (l < r) {
        const sum = A[i].amount + A[l].amount + A[r].amount;
        if (sum > target) { r--; continue; }
        keep([A[i], A[l], A[r]], sum); l++;
      }
    }
    return ranked;
  };
  const chqLabel = c => 'چک ' + (c.serial ? Core.toFa(c.serial) + ' ' : '') + (c.title ? '- ' + c.title : '');
  // ledger lines of one cheque, from its history
  function chequeEntries(st, c) {
    const P = id => 'P' + id, out = [], A = c.amount, lbl = chqLabel(c);
    let prev = null;
    for (const h of c.hist || []) {
      let lines = null, d = '';
      if (h.s === 'box') { lines = [['1106', A, 0], [P(c.personId), 0, A]]; d = 'دریافت ' + lbl; }
      else if (h.s === 'issued') { lines = [[P(c.personId), A, 0], ['2103', 0, A]]; d = 'صدور ' + lbl; }
      else if (h.s === 'bank') { lines = [['1107', A, 0], ['1106', 0, A]]; d = 'واگذاری به بانک ' + lbl; }
      else if (h.s === 'cleared') { lines = [[acctKey(st, h.acct), A, 0], [prev === 'bank' ? '1107' : '1106', 0, A]]; d = 'وصول ' + lbl; }
      else if (h.s === 'spent') { lines = [[P(h.to), A, 0], ['1106', 0, A]]; d = 'خرج ' + lbl; }
      else if (h.s === 'returned') { lines = [[P(c.personId), A, 0], ['1106', 0, A]]; d = 'عودت ' + lbl; }
      else if (h.s === 'bounced' && c.direction === 'receive') { lines = [[P(c.personId), A, 0], [prev === 'bank' ? '1107' : prev === 'spent' ? P(spentTo(c)) : '1106', 0, A]]; d = 'برگشت ' + lbl; }
      else if (h.s === 'paid') { lines = [['2103', A, 0], [acctKey(st, c.acct), 0, A]]; d = 'پاس شدن ' + lbl; }
      else if (h.s === 'bounced' || h.s === 'cancelled') { lines = [['2103', A, 0], [P(c.personId), 0, A]]; d = (h.s === 'bounced' ? 'برگشت ' : 'ابطال ') + lbl; }
      if (lines) out.push({ date: h.date, desc: d, lines });
      prev = h.s;
    }
    return out;
  }
  const spentTo = c => { const h = (c.hist || []).find(x => x.s === 'spent'); return h ? h.to : null; };
  Core.chequeEntries = chequeEntries;
  // person-account side of the history → tx of type 'chq' (rebuilt on every change)
  function syncChequeTx(st, c) {
    st.tx = st.tx.filter(t => !(t.type === 'chq' && t.chq === c.id));
    const lbl = chqLabel(c), push = (pid, kind, date, desc, inv) => st.tx.push({ id: nid(st), personId: pid, kind, amount: c.amount, type: 'chq', desc: desc + ' ' + lbl + (c.dueDate ? ' (سررسید ' + Core.fmtDate(c.dueDate) + ')' : ''), date, ref: inv || null, group: null, method: null, chq: c.id });
    let prev = null;
    for (const h of c.hist || []) {
      if (h.s === 'box') push(c.personId, 'credit', h.date, 'دریافت', c.invoiceId);
      else if (h.s === 'issued') push(c.personId, 'debit', h.date, 'پرداخت با', c.invoiceId);
      else if (h.s === 'spent') push(h.to, 'debit', h.date, 'خرج', h.invoiceId);
      else if (h.s === 'returned') push(c.personId, 'debit', h.date, 'عودت', c.invoiceId);
      else if (h.s === 'bounced' && c.direction === 'receive') { push(c.personId, 'debit', h.date, 'برگشت', c.invoiceId); if (prev === 'spent') push(spentTo(c), 'credit', h.date, 'برگشت (خرج‌شده)', (c.hist || []).find(x => x.s === 'spent')?.invoiceId); }
      else if (h.s === 'bounced' || h.s === 'cancelled') push(c.personId, 'credit', h.date, h.s === 'bounced' ? 'برگشت' : 'ابطال', c.invoiceId);
      prev = h.s;
    }
    const last = (c.hist || [])[(c.hist || []).length - 1];
    c.state = last ? last.s : null; c.done = !!CHQ_DONE[c.state]; c.doneAt = c.done ? last.date : null;
  }
  Core.chequeMoves = function (st) {
    const out = [];
    st.cheques.forEach(c => { if (!c.cyc) return; (c.hist || []).forEach((h, k) => {
      if (h.s === 'cleared') out.push({ date: h.date, acct: h.acct, amt: c.amount, kind: 'chq', id: 'c' + c.id + '_' + k, chq: c, step: k, personId: c.personId, desc: 'وصول ' + chqLabel(c), rec: h.rec });
      else if (h.s === 'paid') out.push({ date: h.date, acct: c.acct, amt: -c.amount, kind: 'chq', id: 'c' + c.id + '_' + k, chq: c, step: k, personId: c.personId, desc: 'پاس شدن ' + chqLabel(c), rec: h.rec });
    }); });
    return out;
  };
  function newCycleCheque(st, d) {
    const title = String(d.title || '').trim();
    if (!(d.amount > 0) || !Number.isInteger(d.amount) || d.amount > MAX_MONEY) return err('مبلغ نامعتبر است.');
    let de = checkDate(d.dueDate); if (de) return err('تاریخ سررسید نامعتبر است.');
    const date = d.date || Core.todayISO(); de = checkDate(date); if (de) return err('تاریخ ثبت نامعتبر است.'); if (inClosed(st, date)) return closedErr(st);
    if (!byId(st.people, d.personId)) return err(d.direction === 'pay' ? 'گیرنده چک را انتخاب کنید.' : 'صاحب چک (پرداخت‌کننده) را انتخاب کنید.');
    const pay = d.direction === 'pay'; let acct = null;
    if (pay) { const a = byId(ensureAcct(st), +d.acct); if (!a || a.kind !== 'bank') return err('حساب بانکی صادرکننده چک را انتخاب کنید.'); acct = a.id; }
    const invoiceId = d.invoiceId ? +d.invoiceId : null;
    if (invoiceId) {
      const i = byId(st.invoices, invoiceId);
      if (!i || i.personId !== d.personId || !((i.type === 'sale' || i.type === 'purchase_return') === !pay)) return err('فاکتور مرتبط با این چک معتبر نیست.');
      // On edit, the cheque is excluded from the duplicate-check list but its historical tx is still in the account.
      // Credit it back only for validating this edit, without changing any stored transaction.
      const previousAmt = d._editingChequeId ? st.tx.filter(t => t.type === 'chq' && t.chq === d._editingChequeId && t.ref === invoiceId && t.kind === PAY_KIND[i.type]).reduce((sum,t) => sum + t.amount, 0) : 0;
      if (d.amount > Core.invoiceInfo(st, i).remaining + previousAmt) return err('مبلغ چک از مانده فاکتور بیشتر است.');
    }
    const serial = Core.toEn(String(d.serial || '').trim()).slice(0, 30);
    if (serial && st.cheques.some(x => x.cyc && x.direction === (pay ? 'pay' : 'receive') && x.serial === serial && (pay ? x.acct === acct : x.bank === String(d.bank || '').trim()))) return err('چکی با همین شماره قبلاً ثبت شده است.');
    return ok({ c: { kind: 'cheque', cyc: 1, direction: pay ? 'pay' : 'receive', personId: d.personId, invoiceId, title: title || (byId(st.people, d.personId) || {}).name || 'چک', amount: d.amount, dueDate: d.dueDate, date, serial, bank: String(d.bank || '').trim().slice(0, 60), branch: String(d.branch || '').trim().slice(0, 60), drawer: String(d.drawer || '').trim().slice(0, 80), acct, note: String(d.note || '').trim(), hist: [{ s: pay ? 'issued' : 'box', date }] } });
  }
  Core.chequeAct = function (st, id, act, d) {
    d = d || {}; const c = byId(st.cheques, id); if (!c) return err('چک پیدا نشد.'); if (!c.cyc) return err('این چک با روش قدیم ثبت شده است.');
    if (!Core.chequeNext(c).includes(act)) return err('این کار در وضعیت «' + CHQ_FA[c.state] + '» ممکن نیست.');
    const date = d.date || Core.todayISO(), de = checkDate(date); if (de) return err(de);
    const lastDate = c.hist[c.hist.length - 1].date; if (date < lastDate) return err('تاریخ این مرحله نمی‌تواند قبل از مرحله قبل (' + Core.fmtDate(lastDate) + ') باشد.');
    if (inClosed(st, date)) return closedErr(st);
    const h = { s: act, date };
    if (act === 'bank') { const a = byId(ensureAcct(st), +d.acct); if (!a || a.kind !== 'bank') return err('بانک را انتخاب کنید.'); h.acct = a.id; }
    if (act === 'cleared') { const prevBank = c.state === 'bank' ? c.hist[c.hist.length - 1].acct : null; const a = byId(ensureAcct(st), +(d.acct || prevBank)); if (!a) return err('صندوق یا بانکی را که پول به آن رسید انتخاب کنید.'); h.acct = a.id; }
    if (act === 'spent') {
      if (!byId(st.people, +d.to)) return err('شخصی را که چک به او داده شد انتخاب کنید.');
      if (+d.to === c.personId) return err('برای پس دادن چک به خود صاحب چک، «عودت» را بزنید.');
      h.to = +d.to;
      if (d.invoiceId) { const i = byId(st.invoices, +d.invoiceId); if (!i || i.personId !== h.to || !['purchase', 'sale_return'].includes(i.type)) return err('فاکتور مرتبط با خرج چک معتبر نیست.'); if (c.amount > Core.invoiceInfo(st, i).remaining) return err('مبلغ چک از مانده فاکتور بیشتر است.'); h.invoiceId = i.id; }
    }
    if (d.note) h.note = String(d.note).trim().slice(0, 200);
    c.hist.push(h); syncChequeTx(st, c); return ok({ cheque: c });
  };
  Core.chequeUndo = function (st, id) {
    const c = byId(st.cheques, id); if (!c || !c.cyc) return err('چک پیدا نشد.'); if (c.hist.length < 2) return err('این اولین مرحله است؛ برای حذف، خود چک را حذف کنید.');
    const h = c.hist[c.hist.length - 1]; if (inClosed(st, h.date)) return closedErr(st);
    if (h.rec) return err('این مرحله در مغایرت‌گیری بانک تطبیق داده شده است؛ اول آن مغایرت‌گیری را بررسی کنید.');
    c.hist.pop(); syncChequeTx(st, c); return ok();
  };

  /* ───────────── warehouses (چند انبار) and transfers (انتقال بین انبارها) ─────────────
   * Nothing changes until a second warehouse is made: then «انبار اصلی» is created and every older document belongs to it (doc.wh missing = main).
   * Stock value and average cost stay per product (one inventory account); a transfer only moves quantity. */
  Core.whList = st => (st.warehouses && st.warehouses.length ? st.warehouses : [{ id: 0, name: 'انبار اصلی', main: true }]);
  Core.multiWh = st => !!(st.warehouses && st.warehouses.filter(w => !w.archived).length > 1);
  const mainWh = st => { const L = Core.whList(st); return (L.find(w => w.main) || L[0]).id; };
  Core.mainWh = mainWh;
  const whOf = (st, doc) => (doc.wh != null && st.warehouses && byId(st.warehouses, doc.wh) ? doc.wh : mainWh(st));
  Core.whOf = whOf;
  Core.addWarehouse = function (st, d) {
    const name = String(d.name || '').trim(); if (!name) return err('نام انبار را وارد کنید.');
    if (!st.warehouses || !st.warehouses.length) st.warehouses = [{ id: nid(st), name: 'انبار اصلی', main: true }];
    if (st.warehouses.some(w => w.name === name)) return err('انباری با این نام وجود دارد.');
    const w = { id: nid(st), name, keeper: String(d.keeper || '').trim(), note: String(d.note || '').trim() }; st.warehouses.push(w); return ok({ warehouse: w });
  };
  Core.editWarehouse = function (st, id, d) {
    const w = byId(st.warehouses || [], id); if (!w) return err('انبار پیدا نشد.');
    const name = String(d.name || '').trim(); if (!name) return err('نام انبار را وارد کنید.'); if (st.warehouses.some(x => x !== w && x.name === name)) return err('انباری با این نام وجود دارد.');
    if (d.archived && w.main) return err('انبار اصلی بایگانی نمی‌شود.');
    if (d.archived && !w.archived) { const q = Core.whStock(st)[w.id] || {}; if (Object.values(q).some(v => Math.abs(v) > 1e-9)) return err('این انبار هنوز کالا دارد؛ اول موجودی را به انبار دیگری منتقل کنید.'); }
    Object.assign(w, { name, keeper: String(d.keeper || '').trim(), note: String(d.note || '').trim() }); if (d.archived != null) w.archived = !!d.archived; return ok();
  };
  Core.whUsed = (st, id) => st.invoices.some(i => i.wh === id) || st.adjusts.some(a => a.wh === id) || (st.whTx || []).some(x => x.from === id || x.to === id);
  Core.deleteWarehouse = function (st, id) {
    const w = byId(st.warehouses || [], id); if (!w) return err('انبار پیدا نشد.'); if (w.main) return err('انبار اصلی حذف نمی‌شود.');
    if (Core.whUsed(st, id)) return err('این انبار سند دارد؛ به‌جای حذف، بایگانی‌اش کنید.');
    st.warehouses = st.warehouses.filter(x => x !== w); return ok();
  };
  // quantities per warehouse, replayed in the same order as the stock card; errors = a warehouse going below zero
  function whReplay(st) {
    const Q = {}, errors = [], add = (w, p, q) => { const m = Q[w] || (Q[w] = {}); m[p] = r3((m[p] || 0) + q); return m[p]; }, ev = [];
    st.invoices.forEach(inv => ev.push({ date: inv.date, id: inv.id, inv }));
    st.adjusts.forEach(a => ev.push({ date: a.date, id: a.id, adj: a }));
    (st.whTx || []).forEach(x => ev.push({ date: x.date, id: x.id, wt: x }));
    const op = e => (e.adj && e.adj.opening ? 0 : 1);
    ev.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : op(a) - op(b) || a.id - b.id);
    for (const e of ev) {
      if (e.inv) { const w = whOf(st, e.inv), sg = e.inv.type === 'purchase' || e.inv.type === 'sale_return' ? 1 : -1; e.inv.items.forEach(l => { const v = add(w, l.productId, sg * l.qty); if (sg < 0 && v < -1e-9) errors.push({ wh: w, productId: l.productId, need: l.qty, have: r3(v + l.qty), invoiceId: e.inv.id }); }); }
      else if (e.adj) { const w = whOf(st, e.adj), v = add(w, e.adj.productId, e.adj.qty); if (e.adj.qty < 0 && v < -1e-9) errors.push({ wh: w, productId: e.adj.productId, need: -e.adj.qty, have: r3(v - e.adj.qty), adjId: e.adj.id }); }
      else e.wt.items.forEach(l => { const v = add(e.wt.from, l.productId, -l.qty); add(e.wt.to, l.productId, l.qty); if (v < -1e-9) errors.push({ wh: e.wt.from, productId: l.productId, need: l.qty, have: r3(v + l.qty), whTx: e.wt.id }); });
    }
    return { qty: Q, errors };
  }
  Core.whReplay = whReplay;
  Core.whStock = st => whReplay(st).qty;
  const whErrText = (st, e) => { const p = byId(st.products, e.productId), w = Core.whList(st).find(x => x.id === e.wh); return 'موجودی «' + (p ? p.name : '؟') + '» در «' + (w ? w.name : 'انبار') + '» کافی نیست (موجودی: ' + Core.fmtQty(Math.max(e.have, 0)) + '، نیاز: ' + Core.fmtQty(e.need) + ').'; };
  Core.whErrText = whErrText;
  // with more than one warehouse, a change that leaves any warehouse below zero is refused (same as the one-warehouse rule)
  const whCheck = st => { if (!Core.multiWh(st)) return null; const e = whReplay(st).errors; return e.length ? whErrText(st, e[0]) : null; };
  Core.whCheck = whCheck;
  const validWh = (st, id) => { if (id == null || id === '') return null; const w = byId(st.warehouses || [], +id); return w ? w.id : undefined; };
  Core.nextWhTxNo = st => String((st.whTx || []).reduce((m, x) => Math.max(m, +x.no || 0), 0) + 1);
  function cleanWhTx(st, d) {
    const de = checkDate(d.date); if (de) return { error: de }; if (inClosed(st, d.date)) return { error: closedErr(st).error };
    const from = validWh(st, d.from), to = validWh(st, d.to); if (from == null || to == null || from === undefined || to === undefined) return { error: 'انبار مبدأ و مقصد را انتخاب کنید.' }; if (from === to) return { error: 'انبار مبدأ و مقصد نمی‌تواند یکی باشد.' };
    const items = [];
    for (const l of d.items || []) { if (!l.productId && !l.qty) continue; const p = byId(st.products, l.productId); if (!p) return { error: 'کالای انتخاب‌شده معتبر نیست.' }; if (!(l.qty > 0)) return { error: 'تعداد «' + p.name + '» باید بزرگ‌تر از صفر باشد.' }; items.push({ productId: p.id, qty: r3(l.qty), note: String(l.note || '').trim().slice(0, 500) }); }
    if (!items.length) return { error: 'حداقل یک کالا برای انتقال انتخاب کنید.' };
    for (const l of items) { const p = byId(st.products, l.productId); if (Core.serialRequired(st, p) && Core.extractSerials(l.note).length !== Math.round(l.qty)) return { error: 'برای «' + p.name + '» به تعداد ' + Core.fmtQty(l.qty) + ' شماره سریال/IMEI لازم است.' }; }
    return { from, to, items };
  }
  Core.addWhTx = function (st, d) {
    const c = cleanWhTx(st, d); if (c.error) return err(c.error);
    const L = st.whTx || (st.whTx = []); const x = { id: nid(st), no: Core.nextWhTxNo(st), date: d.date, from: c.from, to: c.to, items: c.items, desc: String(d.desc || '').trim().slice(0, 300) };
    L.push(x); const e = whReplay(st).errors.find(y => y.wh === c.from || y.whTx === x.id) || whReplay(st).errors[0];
    if (e) { st.whTx = L.filter(y => y !== x); st.seq = x.id; return err(whErrText(st, e)); }
    const se = serialMoveError(st, x); if (se) { st.whTx = st.whTx.filter(y => y !== x); st.seq = x.id; return err(se); }
    return ok({ whTx: x });
  };
  Core.editWhTx = function (st, id, d) {
    const x = byId(st.whTx || [], id); if (!x) return err('سند انتقال پیدا نشد.'); if (inClosed(st, x.date)) return closedErr(st);
    const c = cleanWhTx(st, d); if (c.error) return err(c.error);
    const bak = Object.assign({}, x); Object.assign(x, { date: d.date, from: c.from, to: c.to, items: c.items, desc: String(d.desc || '').trim().slice(0, 300) });
    const e = whReplay(st).errors[0] || null, se = e ? null : serialMoveError(st, x); if (e || se) { Object.assign(x, bak); return err(e ? whErrText(st, e) : se); }
    return ok({ whTx: x });
  };
  Core.deleteWhTx = function (st, id) {
    const x = byId(st.whTx || [], id); if (!x) return err('سند انتقال پیدا نشد.'); if (inClosed(st, x.date)) return closedErr(st);
    const bak = st.whTx; st.whTx = st.whTx.filter(y => y !== x); const e = whReplay(st).errors[0];
    if (e) { st.whTx = bak; return err('با حذف این انتقال موجودی منفی می‌شود. ' + whErrText(st, e)); }
    return ok();
  };
  // where each serial / IMEI is now: { serial: warehouse id } (only serials still in stock)
  Core.serialWh = function (st) {
    const at = new Map(), ev = [];
    st.invoices.forEach(inv => ev.push({ date: inv.date, id: inv.id, inv })); (st.whTx || []).forEach(x => ev.push({ date: x.date, id: x.id, wt: x }));
    ev.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id);
    for (const e of ev) {
      if (e.inv) { const w = whOf(st, e.inv), inn = e.inv.type === 'purchase' || e.inv.type === 'sale_return'; e.inv.items.forEach(l => Core.extractSerials(l.note).forEach(sn => { if (inn) at.set(sn, w); else at.delete(sn); })); }
      else e.wt.items.forEach(l => Core.extractSerials(l.note).forEach(sn => { if (at.has(sn)) at.set(sn, e.wt.to); }));
    }
    return at;
  };
  // a transfer may only move serials that are in its source warehouse at that moment
  function serialMoveError(st, x) {
    const at = new Map(), ev = [];
    st.invoices.forEach(inv => ev.push({ date: inv.date, id: inv.id, inv })); (st.whTx || []).forEach(y => ev.push({ date: y.date, id: y.id, wt: y }));
    ev.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id);
    for (const e of ev) {
      if (e.inv) { const w = whOf(st, e.inv), inn = e.inv.type === 'purchase' || e.inv.type === 'sale_return'; e.inv.items.forEach(l => Core.extractSerials(l.note).forEach(sn => { if (inn) at.set(sn, w); else at.delete(sn); })); continue; }
      for (const l of e.wt.items) for (const sn of Core.extractSerials(l.note)) {
        if (e.wt === x && !at.has(sn)) return 'سریال ' + sn + ' در این تاریخ در انبار موجود نیست (خریده نشده یا فروخته شده).';
        if (e.wt === x && at.get(sn) !== x.from) { const w = Core.whList(st).find(z => z.id === at.get(sn)); return 'سریال ' + sn + ' در این تاریخ در «' + (w ? w.name : 'انبار دیگر') + '» است، نه در انبار مبدأ.'; }
        if (at.has(sn)) at.set(sn, e.wt.to);
      }
    }
    return '';
  }

  /* ───────────── integrity / backup ───────────── */
  Core.audit = function (st) {
    const p = [];
    const ids = new Set(); const all = [].concat(st.people, st.products, st.invoices, st.tx, st.expenses, st.cheques, st.adjusts, st.accounts || [], st.acctTx || [], st.recons || [], st.vouchers || [], st.whTx || [], st.warehouses || [], st.tafsil || []);
    all.forEach(x => { if (!Number.isInteger(x.id)) p.push('شناسه نامعتبر'); else if (ids.has(x.id)) p.push('شناسه تکراری: ' + x.id); else ids.add(x.id); if (x.id >= st.seq) p.push('شمارنده شناسه عقب است'); });
    st.tx.forEach(t => { if (!byId(st.people, t.personId)) p.push('تراکنش بدون شخص: ' + t.id); if (!(t.amount > 0)) p.push('مبلغ نامعتبر در تراکنش ' + t.id); if (t.kind !== 'debit' && t.kind !== 'credit') p.push('نوع نامعتبر در تراکنش ' + t.id); if (!Core.validIso(t.date)) p.push('تاریخ نامعتبر در تراکنش ' + t.id); if (t.ref && !byId(st.invoices, t.ref)) p.push('تراکنش یتیم فاکتور: ' + t.id); });
    st.invoices.forEach(i => {
      if (!byId(st.people, i.personId)) p.push('فاکتور بدون شخص: ' + i.no);
      i.items.forEach(l => { if (!byId(st.products, l.productId)) p.push('قلم بدون کالا در فاکتور ' + i.no); });
      const main = (txByRef(st).get(i.id) || []).filter(t => t.type === 'invoice'); const tot = Core.invoiceTotals(i).total;
      if (main.length !== 1 || main[0].amount !== tot) p.push('عدم تطابق حساب با فاکتور ' + i.no);
    });
    Core.replay(st).errors.forEach(e => p.push('موجودی منفی: ' + stockErrText(st, e)));
    (st.vouchers || []).forEach(v => { const dr = v.lines.reduce((t, l) => t + l.dr, 0), cr = v.lines.reduce((t, l) => t + l.cr, 0); if (dr !== cr) p.push('سند ' + v.no + ' تراز نیست'); if (!Core.validIso(v.date)) p.push('تاریخ نامعتبر در سند ' + v.no); v.lines.forEach(l => { if (l.acc[0] === 'P' && !byId(st.people, +l.acc.slice(1))) p.push('سند ' + v.no + ' با شخص نامعتبر'); const m = /^110[12]:(\d+)$/.exec(l.acc); if (m && !byId(st.accounts || [], +m[1])) p.push('سند ' + v.no + ' با حساب نامعتبر'); }); });
    st.tx.forEach(t => { if (t.type === 'voucher' && !byId(st.vouchers || [], t.vch)) p.push('ردیف بدون سند: ' + t.id); if (t.type === 'chq' && !byId(st.cheques, t.chq)) p.push('ردیف بدون چک: ' + t.id); });
    st.cheques.forEach(c => {
      if (!c.cyc) {
        if (c.txId && !byId(st.tx, c.txId)) p.push('چک قدیمی بدون تراکنش مرتبط: ' + c.id);
        return;
      }
      if (c.invoiceId) { const inv = byId(st.invoices, c.invoiceId); if (!inv || inv.personId !== c.personId) p.push('چک با فاکتور نامعتبر: ' + c.id); }
      if (!byId(st.people, c.personId)) p.push('چک بدون شخص: ' + c.id); if (!Array.isArray(c.hist) || !c.hist.length) p.push('چک بدون سابقه: ' + c.id); else c.hist.forEach(h => { if ((h.s === 'cleared' || h.s === 'bank') && !byId(st.accounts || [], h.acct)) p.push('چک با حساب نامعتبر: ' + c.id); if (h.s === 'spent' && !byId(st.people, h.to)) p.push('چک خرج‌شده بدون شخص: ' + c.id); }); if (c.direction === 'pay' && !byId(st.accounts || [], c.acct)) p.push('چک صادره بدون حساب: ' + c.id); });
    if (st.warehouses) { const has = id => byId(st.warehouses, id); st.invoices.forEach(i => { if (i.wh != null && !has(i.wh)) p.push('فاکتور با انبار نامعتبر: ' + i.no); }); st.adjusts.forEach(a => { if (a.wh != null && !has(a.wh)) p.push('تعدیل با انبار نامعتبر: ' + a.id); }); (st.whTx || []).forEach(x => { if (!has(x.from) || !has(x.to)) p.push('انتقال انبار با انبار نامعتبر: ' + x.no); }); whReplay(st).errors.forEach(e => p.push('موجودی منفی انبار: ' + whErrText(st, e))); }
    if (st.accounts) { st.tx.forEach(t => { if (t.acct != null && !byId(st.accounts, t.acct)) p.push('تراکنش با حساب نامعتبر: ' + t.id); }); st.expenses.forEach(e => { if (e.acct != null && !byId(st.accounts, e.acct)) p.push('هزینه با حساب نامعتبر: ' + e.id); }); (st.acctTx || []).forEach(x => { if (!byId(st.accounts, x.from) || !byId(st.accounts, x.to)) p.push('انتقال با حساب نامعتبر: ' + x.id); }); }
    // An unbalanced journal is a serious integrity fault; include it in the audit.
    for (const e of Core.journal(st)) { const d = e.lines.reduce((a, x) => a + x.dr, 0), c = e.lines.reduce((a, x) => a + x.cr, 0); if (d !== c) p.push('سند نامتوازن در تاریخ ' + e.date + ': ' + e.desc); }
    return p;
  };
  // "start fresh": clears documents but never people or products. o: { invoices, adjusts, people, expenses, cheques }
  // returns a new state (the original is untouched) or an error when the result would be inconsistent (e.g. sales left without stock)
  Core.resetData = function (st, o) {
    o = o || {}; const nx = Object.assign({}, st);
    if ((st.fyClosed || []).length) return err('سال مالی بسته‌شده دارید؛ اول از «سال مالی و بستن حساب‌ها» بستن سال‌ها را برگردانید.');
    const gone = new Set(o.invoices ? st.invoices.map(i => i.id) : []);
    if (o.invoices) { nx.invoices = []; nx.whTx = []; } // transfers only make sense with the purchases behind them
    if (o.people) nx.vouchers = []; // manual vouchers go with the other money documents
    if (o.adjusts) nx.adjusts = [];
    if (o.expenses) nx.expenses = [];
    nx.tx = st.tx.filter(t => (t.type === 'chq' ? !o.cheques : t.type === 'voucher' ? !o.people : !(t.ref != null ? gone.has(t.ref) : o.people)));
    const keptTx = new Set(nx.tx.map(t => t.id));
    nx.cheques = o.cheques ? [] : st.cheques.map(c => { if (c.txId && !keptTx.has(c.txId)) { const d = Object.assign({}, c); delete d.txId; return d; } return c; });
    if (!nx.invoices.length && !nx.tx.length && !nx.expenses.length && !nx.cheques.length && !(nx.vouchers || []).length && !(nx.acctTx || []).length && !nx.adjusts.length) delete nx.docNo; // nothing left: numbering starts again from 1
    const probs = Core.audit(nx);
    if (probs.length) return err('با این انتخاب، اطلاعات ناسازگار می‌شود (' + probs[0] + '). ' + (o.adjusts && !o.invoices ? 'اگر ورود کالا را پاک می‌کنید، فاکتورها را هم انتخاب کنید.' : ''));
    return ok({ state: nx, removed: { invoices: st.invoices.length - nx.invoices.length, tx: st.tx.length - nx.tx.length, adjusts: st.adjusts.length - nx.adjusts.length, expenses: st.expenses.length - nx.expenses.length, cheques: st.cheques.length - nx.cheques.length } });
  };
  Core.exportJSON = function (st) { return JSON.stringify({ app: 'fixquick-accounting', version: 1, exportedAt: new Date().toISOString(), data: st }); };
  Core.parseBackup = function (text) {
    let o; try { o = JSON.parse(text); } catch (e) { return err('فایل پشتیبان معتبر نیست (JSON خراب).'); }
    if (!o || o.app !== 'fixquick-accounting' || !o.data) return err('این فایل، پشتیبان این برنامه نیست.');
    const d = o.data, base = Core.emptyState();
    for (const k of ['people', 'products', 'invoices', 'tx', 'expenses', 'cheques', 'adjusts', 'acctTx', 'recons', 'vouchers', 'whTx']) { if (d[k] === undefined) d[k] = []; if (!Array.isArray(d[k])) return err('ساختار فایل پشتیبان خراب است.'); }
    for (const k of ['accounts', 'warehouses', 'tafsil', 'fyClosed']) if (d[k] !== undefined && !Array.isArray(d[k])) return err('ساختار فایل پشتیبان خراب است.');
    if (d.coa !== undefined && (typeof d.coa !== 'object' || !d.coa)) return err('ساختار فایل پشتیبان خراب است.');
    d.settings = Object.assign(base.settings, d.settings || {}); d.v = 1;
    if (d.docNo !== undefined && !(d.docNo && typeof d.docNo === 'object' && typeof d.docNo.k === 'string' && !/\s\s|^\s|\s$/.test(d.docNo.k) && (d.docNo.w === undefined || Number.isFinite(d.docNo.w)))) delete d.docNo;
    const fixM = m => (METHODS[m] ? m : m === 'card' ? 'bank' : 'cash'); // unknown payment methods from other files
    for (const t of d.tx) if (t.method != null && !METHODS[t.method]) t.method = fixM(t.method);
    for (const e of d.expenses) if (!METHODS[e.method]) e.method = fixM(e.method);
    if (!Number.isInteger(d.seq)) d.seq = 1;
    let maxId = 0; for (const k of ['people', 'products', 'invoices', 'tx', 'expenses', 'cheques', 'adjusts', 'accounts', 'acctTx', 'recons', 'vouchers', 'whTx', 'warehouses', 'tafsil']) for (const x of (d[k] || [])) { const v = +x.id || 0; if (v > maxId) maxId = v; }
    if (d.seq <= maxId) d.seq = maxId + 1;
    Core.migrate(d);
    const probs = Core.audit(d); if (probs.length) return err('فایل پشتیبان ناسازگار است: ' + probs[0]);
    return ok({ state: d });
  };

  /* ───────────── CSV / text helpers ───────────── */
  Core.csv = rows => rows.map(r => r.map(c => { c = String(c == null ? '' : c); return /[",\n\r]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(',')).join('\r\n');
  Core.statementText = function (st, pid, from, to) {
    const p = byId(st.people, pid); const L = Core.ledger(st, pid, from, to);
    const lines = ['صورت‌حساب ' + p.name + (st.settings.business ? ' — ' + st.settings.business : ''), 'تاریخ: ' + Core.fmtDate(Core.todayISO()), ''];
    const who = v => v > 0 ? ' (شما بدهکارید)' : v < 0 ? ' (ما بدهکاریم)' : '';
    if (from) lines.push('مانده از قبل: ' + Core.fmt(Math.abs(L.carry)) + who(L.carry));
    L.rows.forEach(r => lines.push(Core.fmtDate(r.tx.date) + ' | ' + (r.tx.desc || '—') + ' | ' + (r.debit ? 'اضافه ' + Core.fmt(r.debit) : 'کم ' + Core.fmt(r.credit)) + ' | مانده ' + Core.fmt(Math.abs(r.balance)) + who(r.balance)));
    lines.push('', 'مانده نهایی: ' + Core.fmt(Math.abs(L.closing)) + ' ' + Core.unitName() + ' ' + (L.closing > 0 ? '(شما بدهکارید)' : L.closing < 0 ? '(ما بدهکاریم)' : '(تسویه)'));
    return lines.join('\n');
  };

  /* ───────────── opening lists ─────────────
   * People with their opening balance, goods with their opening stock, many at once: lines typed from paper, columns pasted from Excel, or a CSV / xlsx file.
   * The parsers write nothing. The import functions change the state they are given; the screen passes a copy and keeps it only if the audit stays clean.
   * Whatever already has an opening record is skipped, so the same list entered twice never doubles a balance or a stock. */
  const OPEN_HEAD = /نام|شخص|طرف|کالا|شرح|تعداد|موجودی|مبلغ|مانده|نوع|قیمت|فی|تلفن|موبایل|بدهکار|بستانکار|name|qty|amount|price/i;
  const OPEN_KIND = { 'بدهکار': 1, 'بد': 1, 'بستانکار': -1, 'بس': -1 };
  const OPEN_MUL = { 'هزار': 1e3, 'میلیون': 1e6, 'ملیون': 1e6, 'میلیارد': 1e9, 'ملیارد': 1e9 };
  const OPEN_SKIP = /^(است|هست|میباشد|می باشد|عدد|عددی|تا|دستگاه|دانه|بسته)$/;
  const openTok = t => Core.norm(t).replace(/[:.؛;]/g, '').replace(/\s/g, '');
  const openNum = c => { let s = Core.toEn(String(c == null ? '' : c)).trim().replace(/[٬،,\s]/g, '').replace(/٫/g, '.'); if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN; };
  const openUnit = t => { const s = openTok(t); return s === 'ریال' ? 'rial' : s === 'تومان' || s === 'تومن' ? 'toman' : ''; };
  // a number written in the app's unit (or with «ریال» / «تومان» after it) → internal rials
  const openMoney = (v, unit) => { if (!isFinite(v) || v < 0) return NaN; const r = Math.round(v * ((unit || Core.unit) === 'toman' ? 10 : 1)); return r > MAX_MONEY ? NaN : r; };
  const isMobile = t => /^(\+98|0098|0)?9\d{9}$/.test(Core.toEn(t).replace(/[\s-]/g, ''));
  Core.openingRows = text => String(text || '').replace(/^﻿/, '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => (/[\t|;]/.test(l) ? l.split(/[\t|;]/).map(c => c.trim()) : [l]));
  // tokens of one line: numbers keep their position; «۵ میلیون» becomes one number; a unit word after a number is kept with it
  const openTokens = line => {
    const out = [];
    String(line).split(/\s+/).filter(Boolean).forEach(w => {
      const k = openTok(w), last = out[out.length - 1], v = openNum(w);
      if (OPEN_MUL[k] && last && last.n != null) { last.n *= OPEN_MUL[k]; return; }
      if (openUnit(w) && last && last.n != null) { last.unit = openUnit(w); return; }
      if (isFinite(v) && !isMobile(w)) out.push({ w, n: v }); else out.push({ w });
    });
    return out;
  };
  const personRow = (cells, m) => {
    const it = { name: '', phone: '', amount: 0, kind: 0, err: '' };
    if (m) {
      it.name = (cells[m.name] || '').trim(); if (m.phone >= 0 && cells[m.phone]) it.phone = Core.toEn(cells[m.phone]).replace(/[^\d+]/g, '');
      if (m.dr >= 0 || m.cr >= 0) {
        const d = m.dr >= 0 ? openNum(cells[m.dr]) : NaN, c = m.cr >= 0 ? openNum(cells[m.cr]) : NaN;
        if (d > 0 && c > 0) it.err = 'هم بدهکار دارد و هم بستانکار'; else if (d > 0) { it.amount = openMoney(d); it.kind = 1; } else if (c > 0) { it.amount = openMoney(c); it.kind = -1; }
      } else {
        const a = openNum(cells[m.amt]); if (a > 0) it.amount = openMoney(a); else if (cells[m.amt] && isNaN(a)) it.err = 'مبلغ خوانا نیست';
        if (m.kind >= 0) it.kind = OPEN_KIND[openTok(cells[m.kind] || '')] || 0;
      }
    } else {
      const tk = openTokens(cells.join(' ')); let ai = -1;
      for (let i = tk.length - 1; i >= 0; i--) if (tk[i].n != null) { ai = i; break; }
      const name = [];
      tk.forEach((x, i) => {
        if (i === ai) { it.amount = openMoney(x.n, x.unit); return; }
        const k = openTok(x.w);
        if (OPEN_KIND[k] && !it.kind) { it.kind = OPEN_KIND[k]; return; }
        if (isMobile(x.w) && !it.phone) { it.phone = Core.toEn(x.w).replace(/[\s-]/g, ''); return; }
        if (OPEN_SKIP.test(k) || openUnit(x.w)) return;
        name.push(x.w);
      });
      it.name = name.join(' ').replace(/[\s:،,\-]+$/, '').trim();
    }
    if (!it.err && isNaN(it.amount)) it.err = 'مبلغ نامعتبر است';
    if (!it.err && !it.name) it.err = 'نام ندارد';
    if (!it.err && it.amount > 0 && !it.kind) it.err = 'معلوم نیست بدهکار است یا بستانکار';
    if (!it.amount) it.kind = 0;
    return it;
  };
  const stockRow = (cells, m) => {
    const it = { name: '', qty: NaN, price: 0, sale: 0, err: '' };
    if (m) {
      it.name = (cells[m.name] || '').trim(); it.qty = cells[m.qty] === '' || cells[m.qty] == null ? 0 : openNum(cells[m.qty]);
      if (m.buy >= 0 && cells[m.buy]) { const v = openNum(cells[m.buy]); it.price = isNaN(v) ? NaN : openMoney(v); }
      if (m.sale >= 0 && cells[m.sale]) { const v = openNum(cells[m.sale]); it.sale = isNaN(v) ? 0 : openMoney(v); }
    } else {
      const tk = openTokens(cells.join(' ')); let end = tk.length; const trail = [];
      while (end > 0) { const x = tk[end - 1]; if (x.n != null) { trail.unshift(x); end--; } else if (OPEN_SKIP.test(openTok(x.w))) end--; else break; }
      // the last numbers are the stock and, if a money amount follows it, the purchase price; numbers before them belong to the name («آیفون ۱۳ ۱۲۸»)
      if (trail.length >= 2 && (trail[trail.length - 1].n >= 1000 || trail[trail.length - 1].unit)) { const pr = trail.pop(); it.price = openMoney(pr.n, pr.unit); it.qty = trail.pop().n; }
      else if (trail.length) it.qty = trail.pop().n;
      it.name = tk.slice(0, end).map(x => x.w).concat(trail.map(x => x.w)).join(' ').replace(/[\s:،,\-]+$/, '').trim();
    }
    if (!it.name) it.err = 'نام کالا ندارد';
    else if (!isFinite(it.qty)) it.err = 'تعداد ندارد';
    else if (it.qty < 0 || it.qty > 1e7) it.err = 'تعداد نامعتبر است';
    else if (isNaN(it.price)) it.err = 'قیمت خرید خوانا نیست';
    if (isFinite(it.qty)) it.qty = r3(it.qty);
    return it;
  };
  const openHead = (kind, head) => {
    const f = rx => head.findIndex(c => rx.test(Core.norm(c)));
    if (kind === 'people') {
      const m = { dr: f(/بدهکار|debit/), cr: f(/بستانکار|credit/), phone: f(/تلفن|موبایل|همراه|phone|mobile/), kind: f(/^نوع|وضعیت|بد بس/), amt: f(/مبلغ|مانده|amount|balance/), name: f(/نام|شخص|طرف|name/) };
      if (m.name < 0) m.name = 0; if (m.dr < 0 && m.cr < 0 && m.amt < 0) return null; return m;
    }
    const m = { name: f(/نام|کالا|شرح|name|item/), qty: f(/تعداد|موجودی|qty|quantity|stock/), sale: f(/فروش|sale/), buy: -1 };
    m.buy = head.findIndex((c, i) => i !== m.sale && /خرید|فی|قیمت|price|cost/.test(Core.norm(c)));
    if (m.name < 0) m.name = 0; if (m.qty < 0) return null; return m;
  };
  // kind: 'people' | 'stock'; rows: arrays of cells (Core.openingRows for typed text, Core.readStatementFile for a file)
  Core.parseOpening = function (kind, rows) {
    rows = (rows || []).map(r => (Array.isArray(r) ? r : [r]).map(c => String(c == null ? '' : c).trim())).filter(r => r.some(Boolean));
    let m = null, start = 0;
    const h0 = rows[0] || [], words = (Core.norm(h0.join(' ')).match(new RegExp(OPEN_HEAD.source, 'gi')) || []).length;
    // a header row has no digits at all; typed on one line it needs at least two header words («نام کالا تعداد»), so «علی بدهکار» is never taken for one
    if (rows.length && !h0.some(c => /\d/.test(Core.toEn(c))) && (h0.filter(Boolean).length > 1 ? words >= 1 : words >= 2)) { m = h0.filter(Boolean).length > 1 ? openHead(kind, h0) : null; start = 1; }
    return rows.slice(start).map((r, i) => Object.assign({ line: i + start + 1, raw: r.filter(Boolean).join(' ') }, kind === 'people' ? personRow(r, m) : stockRow(r, m)));
  };
  // date of opening records: start of the fiscal year, or the first day of the books if earlier; never inside a closed year
  Core.openingDate = function (st) {
    let first = Core.periodRange('fytd', Core.todayISO(), (st.settings && st.settings.fyMonth) || 1).from;
    st.invoices.forEach(x => { if (x.date < first) first = x.date; }); st.tx.forEach(x => { if (x.date < first) first = x.date; }); st.adjusts.forEach(x => { if (x.date < first) first = x.date; });
    if (inClosed(st, first)) first = Core.addDays(closedTo(st), 1);
    return first;
  };
  Core.importOpeningPeople = function (st, items, o) {
    o = o || {}; const date = Core.openingDate(st), res = { added: 0, updated: 0, rows: [], skipped: [], date };
    const byName = new Map(); st.people.forEach(p => { if (!p.archived) byName.set(Core.norm(p.name), p); });
    const hasOpen = new Set(); st.tx.forEach(t => { if (t.type === 'opening' && t.personId != null) hasOpen.add(t.personId); });
    const seen = new Set(), skip = (it, why) => res.skipped.push({ line: it.line, name: it.name || it.raw, why });
    for (const it of items) {
      if (it.err) { skip(it, it.err); continue; }
      const k = Core.norm(it.name); if (seen.has(k)) { skip(it, 'در همین فهرست تکراری است'); continue; } seen.add(k);
      const signed = it.amount * it.kind, p = byName.get(k);
      if (p) {
        if (hasOpen.has(p.id)) { skip(it, 'از قبل مانده اول دوره دارد'); continue; }
        if (!signed) { skip(it, 'این شخص از قبل هست و مبلغی ندارد'); continue; }
        st.tx.push({ id: nid(st), personId: p.id, kind: signed > 0 ? 'debit' : 'credit', amount: Math.abs(signed), type: 'opening', desc: 'مانده اول دوره', date, ref: null, group: null, method: null });
        if (it.phone && !p.phone) { st.people[st.people.indexOf(p)] = Object.assign({}, p, { phone: it.phone }); Core._pv++; }
        hasOpen.add(p.id); res.updated++; res.rows.push({ name: p.name, amount: Math.abs(signed), kind: it.kind, isNew: false });
      } else if (o.create === false) skip(it, 'این نام در اشخاص نیست');
      else {
        const r = Core.addPerson(st, { name: it.name, phone: it.phone, opening: signed, date }); if (!r.ok) { skip(it, r.error); continue; }
        byName.set(k, r.person); if (signed) hasOpen.add(r.person.id); res.added++; res.rows.push({ name: r.person.name, amount: Math.abs(signed), kind: it.kind, isNew: true });
      }
    }
    return ok(res);
  };
  Core.importOpeningStock = function (st, items, o) {
    o = o || {}; const date = Core.openingDate(st), res = { added: 0, updated: 0, rows: [], skipped: [], date };
    const byName = new Map(); st.products.forEach(p => byName.set(Core.norm(p.name), p));
    const hasOpen = new Set(); st.adjusts.forEach(a => { if (a.opening) hasOpen.add(a.productId); });
    const seen = new Set(), skip = (it, why) => res.skipped.push({ line: it.line, name: it.name || it.raw, why });
    const adj0 = st.adjusts; st.adjusts = st.adjusts.slice(); const prod0 = st.products; st.products = st.products.slice(); const seq0 = st.seq;
    for (const it of items) {
      if (it.err) { skip(it, it.err); continue; }
      const k = Core.norm(it.name); if (seen.has(k)) { skip(it, 'در همین فهرست تکراری است'); continue; } seen.add(k);
      let p = byName.get(k); if (!p && it.mergeId != null) { p = st.products.find(x => x.id === it.mergeId) || null; if (p) byName.set(k, p); } const isNew = !p;
      if (p && hasOpen.has(p.id)) { skip(it, 'از قبل موجودی اولیه دارد'); continue; }
      if (p && !it.qty) { skip(it, 'این کالا از قبل هست و تعدادی ندارد'); continue; }
      if (!p && o.create === false) { skip(it, 'این کالا در انبار نیست'); continue; }
      const cost = it.price || (p ? p.buyPrice : 0) || 0;
      if (it.qty > 0 && !cost) { skip(it, 'قیمت خرید ندارد؛ قیمت هر عدد را بعد از تعداد بنویسید'); continue; }
      if (!p) { const r = Core.addProduct(st, { name: it.name, buyPrice: it.price, salePrice: it.sale }); if (!r.ok) { skip(it, r.error); continue; } p = r.product; byName.set(k, p); }
      if (it.qty > 0) { st.adjusts.push({ id: nid(st), productId: p.id, qty: it.qty, cost, date, note: 'موجودی اولیه', opening: true }); hasOpen.add(p.id); }
      if (isNew) res.added++; else res.updated++;
      res.rows.push({ name: p.name, qty: it.qty, cost, isNew });
    }
    // one replay for the whole list (adding stock at the first day cannot make anything negative, but the warehouses are checked all the same)
    const rp = Core.replay(st), we = rp.errors.length ? stockErrText(st, rp.errors[0]) : whCheck(st);
    if (we) { st.adjusts = adj0; st.products = prod0; st.seq = seq0; return err(we); }
    return ok(res);
  };


  /* Vol 002 — central fiscal safeguards for legacy modules.
     Both the original date and the new date must be open; a closed period is immutable. */
  const protect = (name, oldDates, newDates) => {
    const original = Core[name]; if (!original) return;
    Core[name] = function (st, ...args) {
      const dates = [].concat(oldDates ? oldDates(st, ...args) : [], newDates ? newDates(st, ...args) : []).filter(Boolean);
      if (dates.some(d => inClosed(st, d))) return closedErr(st);
      return original(st, ...args);
    };
  };
  const old = (list, idx) => (st, id) => { const x = byId(st[list] || [], id); return x ? [x[idx || 'date']] : []; };
  const nd = (st, d) => [d && d.date];
  for (const [name, list] of [
    ['Invoice', 'invoices'], ['Tx', 'tx'], ['Transfer', 'tx'], ['Expense', 'expenses'],
    ['Adjust', 'adjusts'], ['AcctTx', 'acctTx'], ['WhTx', 'whTx']
  ]) {
    protect('add' + name, null, nd);
    if (name !== 'Transfer') {
      protect('edit' + name, old(list), (st, id, d) => [d && d.date]);
      protect('delete' + name, old(list));
    }
  }
  // Transfers are paired by group, not by an individual transaction id.
  protect('editTransfer', (st, group) => st.tx.filter(x => x.group === group).map(x => x.date), (st, group, d) => [d && d.date]);
  protect('deleteTx', (st, id) => { const x = byId(st.tx, id); return x && x.group ? st.tx.filter(y => y.group === x.group).map(y => y.date) : x ? [x.date] : []; });
  protect('deleteAcctTx', old('acctTx'));
  protect('deleteExpense', old('expenses'));
  protect('editCheque', (st, id) => { const c = byId(st.cheques, id); return c ? c.cyc ? (c.hist || []).map(x => x.date) : c.txId ? [(byId(st.tx, c.txId) || {}).date] : [] : []; }, (st, id, d) => [d && d.date]);
  protect('completeCheque', null, (st, id, flag, date) => [date || Core.todayISO()]);
  protect('addCheque', null, (st, d) => [d && (d.date || (d.cycle ? Core.todayISO() : null))]);
  protect('reopenCheque', (st, id) => { const c = byId(st.cheques, id); return c ? [(c.doneAt || (c.hist || []).slice(-1)[0]?.date), (c.txId ? (byId(st.tx, c.txId) || {}).date : null)] : []; });
  protect('deleteCheque', (st, id) => { const c = byId(st.cheques, id); return c ? [(c.date || c.doneAt), ...(c.hist || []).map(h => h.date), ...(c.txId ? [(byId(st.tx, c.txId) || {}).date] : [])] : []; });
  protect('saveRecon', null, (st, id, result) => [result && result.to]);
  protect('setOpeningStock', (st, productId) => { const a = Core.openingOf(st, productId); return a ? [a.date] : []; }, (st) => (st.fyClosed || []).length ? [closedTo(st)] : []);
  // The opening balance must never be rewritten after any fiscal year is closed.
  const prevAddAccount = Core.addAccount;
  Core.addAccount = function (st, d) { if ((st.fyClosed || []).length && Math.round(Number(d.opening) || 0)) return closedErr(st); return prevAddAccount(st, d); };
  const prevEditAccount = Core.editAccount;
  Core.editAccount = function (st, id, d) {
    const a = byId(ensureAcct(st), id);
    if (a && (st.fyClosed || []).length && d.opening != null && Math.round(Number(d.opening) || 0) !== (a.opening || 0)) return closedErr(st);
    return prevEditAccount(st, id, d);
  };
  protect('addPerson', null, (st, d) => d && d.opening ? [d.date || Core.todayISO()] : []);
  protect('addAdjust', null, (st, d) => d && d.opening && (st.fyClosed || []).length ? [closedTo(st)] : []);
  const prevImportProducts = Core.importProducts;
  Core.importProducts = function (st, items, o) { if (o && o.stock && (st.fyClosed || []).length && items.some(x => x.stock > 0)) return closedErr(st); return prevImportProducts(st, items, o); };
  const prevDeleteAccount = Core.deleteAccount;
  Core.deleteAccount = function (st, id) { if ((st.fyClosed || []).length) return closedErr(st); return prevDeleteAccount(st, id); };

  if (typeof module !== 'undefined' && module.exports) module.exports = Core; else root.Core = Core;
})(typeof window !== 'undefined' ? window : globalThis);
