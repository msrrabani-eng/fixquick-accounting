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
    if (!isFinite(n) || n < 0 || n > MAX_MONEY) return NaN;
    return Math.round(n);
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
  Core.fmt = n => Core.toFa(Core.group(n));
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
  Core.periodRange = function (kind, todayIso) {
    const t = todayIso || Core.todayISO(); const p = Core.isoToParts(t);
    if (kind === 'today') return { from: t, to: t };
    if (kind === 'week') { const w = Core.weekdayIdx(t); const from = Core.addDays(t, -w); return { from, to: Core.addDays(from, 6) }; }
    if (kind === 'month') return { from: Core.partsToIso(p.jy, p.jm, 1), to: Core.partsToIso(p.jy, p.jm, Core.monthLenJ(p.jy, p.jm)) };
    if (kind === 'year') return { from: Core.partsToIso(p.jy, 1, 1), to: Core.partsToIso(p.jy, 12, Core.monthLenJ(p.jy, 12)) };
    return { from: null, to: null };
  };

  /* ───────────── state ───────────── */
  Core.emptyState = () => ({
    v: 1, seq: 1, people: [], products: [], invoices: [], tx: [], expenses: [], cheques: [], adjusts: [],
    settings: { business: '', openingCash: 0, lastBackup: null }
  });
  const nid = st => st.seq++;
  const byId = (arr, id) => arr.find(x => x.id === id);
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
    const p = { id: nid(st), name, phone: String(d.phone || '').trim(), note: String(d.note || '').trim(), archived: false, createdAt: d.createdAt || Date.now() };
    st.people.push(p);
    const ob = d.opening || 0;
    if (ob) { // opening balance: positive => owes us (debit), negative => we owe (credit)
      st.tx.push({ id: nid(st), personId: p.id, kind: ob > 0 ? 'debit' : 'credit', amount: Math.abs(ob), type: 'opening', desc: 'مانده اول دوره', date: d.date || Core.todayISO(), ref: null, group: null, method: null });
    }
    return ok({ person: p });
  };
  Core.editPerson = function (st, id, d) {
    const p = byId(st.people, id); if (!p) return err('شخص پیدا نشد.');
    const name = String(d.name || '').trim(); if (!name) return err('نام را وارد کنید.');
    if (st.people.some(x => x.id !== id && !x.archived && x.name === name)) return err('شخصی با این نام قبلاً ثبت شده است.');
    p.name = name; p.phone = String(d.phone || '').trim(); p.note = String(d.note || '').trim(); return ok();
  };
  Core.personHasActivity = (st, id) => st.tx.some(t => t.personId === id) || st.invoices.some(i => i.personId === id) || st.cheques.some(c => c.personId === id);
  Core.deletePerson = function (st, id) {
    if (Core.personHasActivity(st, id)) return err('این شخص سابقه مالی دارد و حذف نمی‌شود. می‌توانید او را بایگانی کنید.');
    st.people = st.people.filter(p => p.id !== id); return ok();
  };
  Core.setArchived = function (st, id, v) { const p = byId(st.people, id); if (!p) return err('شخص پیدا نشد.'); p.archived = !!v; return ok(); };

  /* ───────────── ledger ───────────── */
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
  Core.addTx = function (st, d) {
    if (!byId(st.people, d.personId)) return err('شخص انتخاب نشده است.');
    if (!(d.amount > 0) || !Number.isInteger(d.amount) || d.amount > MAX_MONEY) return err('مبلغ نامعتبر است.');
    const de = checkDate(d.date); if (de) return err(de);
    let kind = d.kind, type = d.type || 'manual';
    if (type === 'receipt') kind = 'credit'; else if (type === 'payment') kind = 'debit';
    if (kind !== 'debit' && kind !== 'credit') return err('نوع تراکنش نامعتبر است.');
    const method = (type === 'receipt' || type === 'payment') ? (METHODS[d.method] ? d.method : 'cash') : null;
    const t = { id: nid(st), personId: d.personId, kind, amount: d.amount, type, desc: String(d.desc || '').trim(), date: d.date, ref: d.ref || null, group: null, method };
    st.tx.push(t); return ok({ tx: t });
  };
  Core.editTx = function (st, id, d) {
    const t = byId(st.tx, id); if (!t) return err('تراکنش پیدا نشد.');
    if (t.type === 'invoice' || t.type === 'transfer') return err('این تراکنش از طریق فاکتور/حواله ثبت شده و اینجا قابل ویرایش نیست.');
    if (!(d.amount > 0) || !Number.isInteger(d.amount) || d.amount > MAX_MONEY) return err('مبلغ نامعتبر است.');
    const de = checkDate(d.date); if (de) return err(de);
    t.amount = d.amount; t.date = d.date; t.desc = String(d.desc || '').trim();
    if (t.type === 'manual' || t.type === 'opening') { if (d.kind === 'debit' || d.kind === 'credit') t.kind = d.kind; }
    if ((t.type === 'receipt' || t.type === 'payment') && METHODS[d.method]) t.method = d.method;
    return ok();
  };
  Core.deleteTx = function (st, id) {
    const t = byId(st.tx, id); if (!t) return err('تراکنش پیدا نشد.');
    if (t.type === 'invoice') return err('این ردیف مربوط به فاکتور است؛ برای حذف، خود فاکتور را حذف کنید.');
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

  /* ───────────── products ───────────── */
  Core.addProduct = function (st, d) {
    const name = String(d.name || '').trim(); if (!name) return err('نام کالا را وارد کنید.');
    if (st.products.some(p => p.name === name)) return err('کالایی با این نام وجود دارد.');
    const p = { id: nid(st), name, sku: String(d.sku || '').trim(), unit: String(d.unit || 'عدد').trim() || 'عدد', minStock: Math.max(0, Number(d.minStock) || 0), salePrice: Math.max(0, Math.round(d.salePrice) || 0), buyPrice: Math.max(0, Math.round(d.buyPrice) || 0) };
    st.products.push(p); return ok({ product: p });
  };
  Core.editProduct = function (st, id, d) {
    const p = byId(st.products, id); if (!p) return err('کالا پیدا نشد.');
    const name = String(d.name || '').trim(); if (!name) return err('نام کالا را وارد کنید.');
    if (st.products.some(x => x.id !== id && x.name === name)) return err('کالایی با این نام وجود دارد.');
    Object.assign(p, { name, sku: String(d.sku || '').trim(), unit: String(d.unit || 'عدد').trim() || 'عدد', minStock: Math.max(0, Number(d.minStock) || 0), salePrice: Math.max(0, Math.round(d.salePrice) || 0), buyPrice: Math.max(0, Math.round(d.buyPrice) || 0) });
    return ok();
  };
  Core.productUsed = (st, id) => st.invoices.some(i => i.items.some(l => l.productId === id)) || st.adjusts.some(a => a.productId === id);
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
    return { sub, discount, total: sub - discount, lines };
  };

  // Chronological replay with moving weighted-average cost.
  Core.replay = function (st, hook) {
    const S = {}; const get = id => S[id] || (S[id] = { stock: 0, avg: 0 });
    const cogs = {}, adjEffect = {}, errors = [];
    const ev = [];
    st.invoices.forEach(inv => ev.push({ date: inv.date, id: inv.id, inv }));
    st.adjusts.forEach(a => ev.push({ date: a.date, id: a.id, adj: a }));
    ev.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id);
    for (const e of ev) {
      if (e.inv) {
        const inv = e.inv, tot = Core.invoiceTotals(inv); let c = 0;
        for (const l of tot.lines) {
          const s = get(l.productId);
          if (inv.type === 'purchase') {
            const base = Math.max(s.stock, 0), ns = r3(base + l.qty);
            s.avg = ns > 0 ? (base * s.avg + l.net) / ns : s.avg; s.stock = r3(s.stock + l.qty);
            if (hook) hook({ date: inv.date, productId: l.productId, delta: l.qty, stock: s.stock, avg: s.avg, label: 'خرید - فاکتور ' + inv.no, invoiceId: inv.id, unit: l.net / l.qty });
          } else if (inv.type === 'sale') {
            if (s.stock < l.qty - 1e-9) errors.push({ invoiceId: inv.id, productId: l.productId, need: l.qty, have: s.stock });
            c += Math.round(l.qty * s.avg); s.stock = r3(s.stock - l.qty);
            if (hook) hook({ date: inv.date, productId: l.productId, delta: -l.qty, stock: s.stock, avg: s.avg, label: 'فروش - فاکتور ' + inv.no, invoiceId: inv.id, unit: l.net / l.qty });
          } else if (inv.type === 'sale_return') {
            c -= Math.round(l.qty * s.avg); s.stock = r3(s.stock + l.qty);
            if (hook) hook({ date: inv.date, productId: l.productId, delta: l.qty, stock: s.stock, avg: s.avg, label: 'برگشت از فروش - فاکتور ' + inv.no, invoiceId: inv.id, unit: l.net / l.qty });
          } else if (inv.type === 'purchase_return') {
            if (s.stock < l.qty - 1e-9) errors.push({ invoiceId: inv.id, productId: l.productId, need: l.qty, have: s.stock });
            c += Math.round(l.qty * s.avg) - l.net; s.stock = r3(s.stock - l.qty);
            if (hook) hook({ date: inv.date, productId: l.productId, delta: -l.qty, stock: s.stock, avg: s.avg, label: 'برگشت از خرید - فاکتور ' + inv.no, invoiceId: inv.id, unit: l.net / l.qty });
          }
        }
        cogs[inv.id] = c;
      } else {
        const a = e.adj, s = get(a.productId);
        if (a.qty > 0) {
          const unit = a.cost > 0 ? a.cost : s.avg, base = Math.max(s.stock, 0), ns = r3(base + a.qty);
          if (a.cost > 0) s.avg = ns > 0 ? (base * s.avg + a.qty * unit) / ns : unit;
          s.stock = r3(s.stock + a.qty); adjEffect[a.id] = -Math.round(a.qty * unit);
          if (hook) hook({ date: a.date, productId: a.productId, delta: a.qty, stock: s.stock, avg: s.avg, label: 'تعدیل موجودی' + (a.note ? ' - ' + a.note : ''), adjId: a.id, unit });
        } else {
          const q = -a.qty; if (s.stock < q - 1e-9) errors.push({ adjId: a.id, productId: a.productId, need: q, have: s.stock });
          adjEffect[a.id] = Math.round(q * s.avg); s.stock = r3(s.stock - q);
          if (hook) hook({ date: a.date, productId: a.productId, delta: -q, stock: s.stock, avg: s.avg, label: 'تعدیل موجودی' + (a.note ? ' - ' + a.note : ''), adjId: a.id, unit: s.avg });
        }
      }
    }
    st.products.forEach(p => get(p.id));
    return { stock: S, cogs, adjEffect, errors };
  };
  const stockErrText = (st, e) => { const p = byId(st.products, e.productId); return 'موجودی «' + (p ? p.name : '؟') + '» کافی نیست (موجودی: ' + Core.fmtQty(Math.max(e.have, 0)) + '، نیاز: ' + Core.fmtQty(e.need) + ').'; };
  Core.stockErrText = stockErrText;

  Core.nextInvoiceNo = function (st) { let m = 0; st.invoices.forEach(i => { const n = parseInt(Core.toEn(i.no), 10); if (n > m) m = n; }); return String(m + 1); };

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
    const discount = d.discount || 0;
    if (!Number.isInteger(discount) || discount < 0) return err('تخفیف نامعتبر است.');
    const no = String(d.no || '').trim() || Core.nextInvoiceNo(st);
    if (st.invoices.some(i => i.no === no && i.type === d.type)) return err('شماره فاکتور تکراری است.');
    const inv = { id: nid(st), no, type: d.type, personId: d.personId, date: d.date, items, discount, note: String(d.note || '').trim() };
    const tot = Core.invoiceTotals(inv);
    if (tot.total <= 0 && tot.sub <= 0) return err('جمع فاکتور صفر است.');
    if (discount > tot.sub) return err('تخفیف از جمع فاکتور بیشتر است.');
    const paid = d.paid || 0;
    if (!Number.isInteger(paid) || paid < 0 || paid > tot.total) return err('مبلغ پرداخت/دریافت نباید از جمع فاکتور بیشتر باشد.');
    st.invoices.push(inv);
    const rp = Core.replay(st);
    if (rp.errors.length) { st.invoices.pop(); st.seq = inv.id; return err(stockErrText(st, rp.errors[0])); }
    const label = Core.TYPE_FA[inv.type] + ' - فاکتور ' + no;
    st.tx.push({ id: nid(st), personId: inv.personId, kind: INV_KIND[inv.type], amount: tot.total, type: 'invoice', desc: label, date: inv.date, ref: inv.id, group: null, method: null });
    if (paid > 0) st.tx.push({ id: nid(st), personId: inv.personId, kind: PAY_KIND[inv.type], amount: paid, type: (PAY_KIND[inv.type] === 'credit' ? 'receipt' : 'payment'), desc: 'تسویه همزمان - فاکتور ' + no, date: inv.date, ref: inv.id, group: null, method: METHODS[d.method] ? d.method : 'cash' });
    return ok({ invoice: inv });
  };
  Core.deleteInvoice = function (st, id) {
    const inv = byId(st.invoices, id); if (!inv) return err('فاکتور پیدا نشد.');
    const bakInv = st.invoices, bakTx = st.tx;
    st.invoices = st.invoices.filter(i => i.id !== id); st.tx = st.tx.filter(t => t.ref !== id);
    const rp = Core.replay(st);
    if (rp.errors.length) { st.invoices = bakInv; st.tx = bakTx; return err('با حذف این فاکتور موجودی انبار منفی می‌شود. ' + stockErrText(st, rp.errors[0])); }
    return ok();
  };
  Core.invoiceInfo = function (st, inv) {
    const tot = Core.invoiceTotals(inv);
    const paid = st.tx.filter(t => t.ref === inv.id && (t.type === 'receipt' || t.type === 'payment')).reduce((s, t) => s + t.amount, 0);
    return Object.assign({ paid, remaining: tot.total - paid }, tot);
  };

  /* ───────────── inventory adjustments ───────────── */
  Core.addAdjust = function (st, d) {
    const p = byId(st.products, d.productId); if (!p) return err('کالا را انتخاب کنید.');
    if (!d.qty || !isFinite(d.qty)) return err('مقدار تعدیل نامعتبر است.');
    const de = checkDate(d.date); if (de) return err(de);
    const a = { id: nid(st), productId: d.productId, qty: r3(d.qty), cost: d.qty > 0 ? Math.max(0, Math.round(d.cost) || 0) : 0, date: d.date, note: String(d.note || '').trim() };
    if (d.opening && a.qty > 0) a.opening = true;
    st.adjusts.push(a); const rp = Core.replay(st);
    if (rp.errors.length) { st.adjusts.pop(); st.seq = a.id; return err(stockErrText(st, rp.errors[0])); }
    return ok({ adjust: a });
  };
  Core.deleteAdjust = function (st, id) {
    const bak = st.adjusts; st.adjusts = st.adjusts.filter(a => a.id !== id);
    const rp = Core.replay(st); if (rp.errors.length) { st.adjusts = bak; return err('با حذف این تعدیل موجودی منفی می‌شود.'); }
    return ok();
  };

  /* ───────────── expenses & cheques ───────────── */
  Core.addExpense = function (st, d) {
    const title = String(d.title || '').trim(); if (!title) return err('عنوان هزینه را وارد کنید.');
    if (!(d.amount > 0) || !Number.isInteger(d.amount) || d.amount > MAX_MONEY) return err('مبلغ نامعتبر است.');
    const de = checkDate(d.date); if (de) return err(de);
    const e = { id: nid(st), title, amount: d.amount, date: d.date, method: METHODS[d.method] ? d.method : 'cash', category: String(d.category || '').trim(), note: String(d.note || '').trim() };
    st.expenses.push(e); return ok({ expense: e });
  };
  Core.editExpense = function (st, id, d) {
    const e = byId(st.expenses, id); if (!e) return err('هزینه پیدا نشد.');
    const title = String(d.title || '').trim(); if (!title) return err('عنوان هزینه را وارد کنید.');
    if (!(d.amount > 0) || !Number.isInteger(d.amount)) return err('مبلغ نامعتبر است.');
    const de = checkDate(d.date); if (de) return err(de);
    Object.assign(e, { title, amount: d.amount, date: d.date, method: METHODS[d.method] ? d.method : e.method, category: String(d.category || '').trim(), note: String(d.note || '').trim() }); return ok();
  };
  Core.deleteExpense = function (st, id) { st.expenses = st.expenses.filter(e => e.id !== id); return ok(); };

  Core.addCheque = function (st, d) {
    const title = String(d.title || '').trim(); if (!title) return err('عنوان را وارد کنید.');
    if (!(d.amount > 0) || !Number.isInteger(d.amount) || d.amount > MAX_MONEY) return err('مبلغ نامعتبر است.');
    const de = checkDate(d.dueDate); if (de) return err(de);
    if (d.personId && !byId(st.people, d.personId)) return err('شخص نامعتبر است.');
    const c = { id: nid(st), kind: d.kind === 'installment' ? 'installment' : 'cheque', direction: d.direction === 'pay' ? 'pay' : 'receive', personId: d.personId || null, title, amount: d.amount, dueDate: d.dueDate, note: String(d.note || '').trim(), done: false, doneAt: null };
    st.cheques.push(c); return ok({ cheque: c });
  };
  Core.deleteCheque = function (st, id) { st.cheques = st.cheques.filter(c => c.id !== id); return ok(); };
  // mark done; optionally record the receipt/payment in the person's account
  Core.completeCheque = function (st, id, recordTx, date) {
    const c = byId(st.cheques, id); if (!c) return err('مورد پیدا نشد.'); if (c.done) return err('قبلاً انجام شده است.');
    if (recordTx) {
      if (!c.personId) return err('برای ثبت در حساب، باید شخص مشخص باشد.');
      const r = Core.addTx(st, { personId: c.personId, type: c.direction === 'receive' ? 'receipt' : 'payment', amount: c.amount, date: date || Core.todayISO(), desc: (c.kind === 'cheque' ? 'چک' : 'قسط') + ' - ' + c.title, method: c.kind === 'cheque' ? 'cheque' : 'bank' });
      if (!r.ok) return r; c.txId = r.tx.id;
    }
    c.done = true; c.doneAt = date || Core.todayISO(); return ok();
  };
  Core.reopenCheque = function (st, id) {
    const c = byId(st.cheques, id); if (!c) return err('مورد پیدا نشد.');
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
    const rp = Core.replay(st); const r = { sales: 0, saleReturns: 0, purchases: 0, purchaseReturns: 0, cogs: 0, adjLoss: 0, expenses: 0, invoices: 0, discounts: 0 };
    for (const inv of st.invoices) {
      if (!inRange(inv.date, from, to)) continue; const t = Core.invoiceTotals(inv); r.invoices++;
      if (inv.type === 'sale') { r.sales += t.total; r.discounts += t.discount; r.cogs += rp.cogs[inv.id] || 0; }
      else if (inv.type === 'sale_return') { r.saleReturns += t.total; r.cogs += rp.cogs[inv.id] || 0; }
      else if (inv.type === 'purchase') r.purchases += t.total;
      else if (inv.type === 'purchase_return') { r.purchaseReturns += t.total; r.cogs += rp.cogs[inv.id] || 0; }
    }
    for (const a of st.adjusts) if (!a.opening && inRange(a.date, from, to)) r.adjLoss += rp.adjEffect[a.id] || 0;
    for (const e of st.expenses) if (inRange(e.date, from, to)) r.expenses += e.amount;
    r.revenue = r.sales - r.saleReturns; r.cogsTotal = r.cogs + r.adjLoss; r.gross = r.revenue - r.cogsTotal; r.net = r.gross - r.expenses;
    return r;
  };
  Core.cashSummary = function (st, from, to) {
    const m = { cash: 0, bank: 0, cheque: 0 }; let inn = 0, out = 0;
    const add = (method, v) => { m[METHODS[method] ? method : 'cash'] += v; };
    for (const t of st.tx) {
      if (!inRange(t.date, from, to)) continue;
      if (t.type === 'receipt') { add(t.method, t.amount); inn += t.amount; } else if (t.type === 'payment') { add(t.method, -t.amount); out += t.amount; }
    }
    for (const e of st.expenses) if (inRange(e.date, from, to)) { add(e.method, -e.amount); out += e.amount; }
    return { byMethod: m, in: inn, out, net: inn - out };
  };
  Core.cashBalance = function (st) { const c = Core.cashSummary(st); return (st.settings.openingCash || 0) + c.net; };
  Core.receivablePayable = function (st) {
    const b = Core.balances(st); let rec = 0, pay = 0;
    st.people.forEach(p => { const v = b[p.id] || 0; if (v > 0) rec += v; else pay -= v; });
    return { receivable: rec, payable: pay };
  };
  Core.inventoryValue = function (st) { const rp = Core.replay(st); let v = 0; for (const id in rp.stock) v += Math.max(rp.stock[id].stock, 0) * rp.stock[id].avg; return Math.round(v); };
  Core.productStats = function (st) {
    const rp = Core.replay(st);
    return st.products.map(p => { const s = rp.stock[p.id] || { stock: 0, avg: 0 }; return { product: p, stock: s.stock, avg: Math.round(s.avg), value: Math.round(Math.max(s.stock, 0) * s.avg), low: p.minStock > 0 && s.stock <= p.minStock }; });
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

  /* ───────────── integrity / backup ───────────── */
  Core.audit = function (st) {
    const p = [];
    const ids = new Set(); const all = [].concat(st.people, st.products, st.invoices, st.tx, st.expenses, st.cheques, st.adjusts);
    all.forEach(x => { if (!Number.isInteger(x.id)) p.push('شناسه نامعتبر'); else if (ids.has(x.id)) p.push('شناسه تکراری: ' + x.id); else ids.add(x.id); if (x.id >= st.seq) p.push('شمارنده شناسه عقب است'); });
    st.tx.forEach(t => { if (!byId(st.people, t.personId)) p.push('تراکنش بدون شخص: ' + t.id); if (!(t.amount > 0)) p.push('مبلغ نامعتبر در تراکنش ' + t.id); if (t.kind !== 'debit' && t.kind !== 'credit') p.push('نوع نامعتبر در تراکنش ' + t.id); if (!Core.validIso(t.date)) p.push('تاریخ نامعتبر در تراکنش ' + t.id); if (t.ref && !byId(st.invoices, t.ref)) p.push('تراکنش یتیم فاکتور: ' + t.id); });
    st.invoices.forEach(i => {
      if (!byId(st.people, i.personId)) p.push('فاکتور بدون شخص: ' + i.no);
      i.items.forEach(l => { if (!byId(st.products, l.productId)) p.push('قلم بدون کالا در فاکتور ' + i.no); });
      const main = st.tx.filter(t => t.ref === i.id && t.type === 'invoice'); const tot = Core.invoiceTotals(i).total;
      if (main.length !== 1 || main[0].amount !== tot) p.push('عدم تطابق حساب با فاکتور ' + i.no);
    });
    Core.replay(st).errors.forEach(e => p.push('موجودی منفی: ' + stockErrText(st, e)));
    return p;
  };
  Core.exportJSON = function (st) { return JSON.stringify({ app: 'fixquick-accounting', version: 1, exportedAt: new Date().toISOString(), data: st }); };
  Core.parseBackup = function (text) {
    let o; try { o = JSON.parse(text); } catch (e) { return err('فایل پشتیبان معتبر نیست (JSON خراب).'); }
    if (!o || o.app !== 'fixquick-accounting' || !o.data) return err('این فایل، پشتیبان این برنامه نیست.');
    const d = o.data, base = Core.emptyState();
    for (const k of ['people', 'products', 'invoices', 'tx', 'expenses', 'cheques', 'adjusts']) { if (d[k] === undefined) d[k] = []; if (!Array.isArray(d[k])) return err('ساختار فایل پشتیبان خراب است.'); }
    d.settings = Object.assign(base.settings, d.settings || {}); d.v = 1;
    if (!Number.isInteger(d.seq)) d.seq = 1;
    const maxId = Math.max(0, ...[].concat(d.people, d.products, d.invoices, d.tx, d.expenses, d.cheques, d.adjusts).map(x => +x.id || 0));
    if (d.seq <= maxId) d.seq = maxId + 1;
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
    lines.push('', 'مانده نهایی: ' + Core.fmt(Math.abs(L.closing)) + ' ریال ' + (L.closing > 0 ? '(شما بدهکارید)' : L.closing < 0 ? '(ما بدهکاریم)' : '(تسویه)'));
    return lines.join('\n');
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Core; else root.Core = Core;
})(typeof window !== 'undefined' ? window : globalThis);
