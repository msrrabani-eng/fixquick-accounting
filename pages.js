/* Pages, forms and actions */
'use strict';
const UI = { peopleQ: '', peopleF: 'all', invQ: '', invF: 'all', prodQ: '', chqTab: 'open', rep: 'month', repFrom: null, repTo: null, stmtFrom: null, stmtTo: null, showArchived: false };
const today = () => Core.todayISO();
const personName = id => { const p = Core.byId(S.people, id); return p ? p.name : '—'; };
const prodName = id => { const p = Core.byId(S.products, id); return p ? p.name : '—'; };
const unitOf = id => { const p = Core.byId(S.products, id); return p ? p.unit : ''; };
const stat = (label, val, cls, sub) => '<div class="stat"><small>' + label + '</small><b class="' + (cls || '') + '">' + val + '</b>' + (sub ? '<em>' + sub + '</em>' : '') + '</div>';
const empty = (icon, text, btn) => '<div class="empty big"><div class="ic">' + icon + '</div><p>' + text + '</p>' + (btn || '') + '</div>';
const chips = (name, cur, opts) => '<div class="chips">' + opts.map(o => '<button type="button" class="chip' + (cur === o[0] ? ' on' : '') + '" data-act="chip" data-k="' + name + '" data-v="' + o[0] + '">' + o[1] + '</button>').join('') + '</div>';
const methodSel = (cur) => '<label class="fld"><span>روش</span><select class="inp" name="method">' + Object.keys(Core.METHODS).map(k => '<option value="' + k + '"' + (k === (cur || 'cash') ? ' selected' : '') + '>' + Core.METHODS[k] + '</option>').join('') + '</select></label>';
const backTo = h => '<button class="back" data-act="go" data-h="' + h + '">‹ بازگشت</button>';

/* ─────────── HOME ─────────── */
function pageHome() {
  const rp = Core.receivablePayable(S), cash = Core.cashBalance(S), inv = Core.inventoryValue(S);
  const t = today(), tr = Core.report(S, t, t), mr = Core.report(S, ...Object.values(Core.periodRange('month')));
  const chq = S.cheques.filter(c => !c.done).map(c => ({ c, st: Core.chequeStatus(c, t) })).filter(x => x.st !== 'later').sort((a, b) => a.c.dueDate < b.c.dueDate ? -1 : 1);
  const low = Core.productStats(S).filter(x => x.low);
  const days = S.settings.lastBackup ? Core.diffDays(S.settings.lastBackup, t) : null;
  const hasData = S.people.length || S.invoices.length || S.tx.length;
  let h = '';
  if (!hasData && !S.products.length) h += '<div class="card welcome"><b>به حسابداری فیکس کوییک خوش آمدید 👋</b><p>برای شروع: اول <a data-act="go" data-h="#/people">اشخاص</a> (مشتری/تأمین‌کننده) و <a data-act="go" data-h="#/products">کالاها</a> را ثبت کنید، بعد فاکتور بزنید. همه اطلاعات روی همین گوشی ذخیره می‌شود؛ حتماً گاهی از «بیشتر ← پشتیبان» نسخه بگیرید.</p></div>';
  if (hasData && (days === null || days > 14)) h += '<div class="alert warn">💾 ' + (days === null ? 'هنوز پشتیبان نگرفته‌اید.' : 'آخرین پشتیبان ' + fa(days) + ' روز پیش بوده.') + ' <button class="lnk" data-act="backup">پشتیبان بگیر</button></div>';
  h += '<div class="stats">' + stat('طلب من از مشتریان', fmt(rp.receivable), rp.receivable ? 'debit' : 'zero', 'ریال') + stat('بدهی من به دیگران', fmt(rp.payable), rp.payable ? 'credit' : 'zero', 'ریال') + stat('موجودی صندوق/بانک', fmt(cash), cash < 0 ? 'debit' : '', 'ریال') + stat('ارزش انبار', fmt(inv), '', 'ریال') + '</div>';
  h += '<div class="quick"><button class="q green" data-act="newInv" data-t="sale">🧾<span>فروش</span></button><button class="q blue" data-act="newInv" data-t="purchase">🛒<span>خرید</span></button><button class="q" data-act="quickTx" data-t="receipt">⬇️<span>دریافت</span></button><button class="q" data-act="quickTx" data-t="payment">⬆️<span>پرداخت</span></button></div>';
  h += '<div class="stats">' + stat('فروش امروز', fmt(tr.revenue), '', 'ریال') + stat('سود خالص این ماه', fmt(mr.net), mr.net < 0 ? 'debit' : mr.net > 0 ? 'credit' : 'zero', 'ریال') + '</div>';
  if (chq.length) h += '<div class="card"><div class="ch">⏰ چک و اقساط نزدیک/معوق</div>' + chq.slice(0, 5).map(x => '<button class="row" data-act="go" data-h="#/cheques"><span><b>' + esc(x.c.title) + '</b><small>' + (x.c.personId ? esc(personName(x.c.personId)) + ' · ' : '') + (x.c.direction === 'receive' ? 'دریافتی' : 'پرداختی') + ' · ' + fmtDate(x.c.dueDate) + '</small></span><em class="' + (x.st === 'overdue' ? 'debit' : '') + '">' + fmt(x.c.amount) + (x.st === 'overdue' ? ' ⚠️' : '') + '</em></button>').join('') + '</div>';
  if (low.length) h += '<div class="card"><div class="ch">📉 کمبود موجودی</div>' + low.slice(0, 5).map(x => '<button class="row" data-act="go" data-h="#/products"><span><b>' + esc(x.product.name) + '</b></span><em class="debit">' + Core.fmtQty(x.stock) + ' ' + esc(x.product.unit) + '</em></button>').join('') + '</div>';
  const recent = S.invoices.slice().sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id).slice(0, 4);
  if (recent.length) h += '<div class="card"><div class="ch">آخرین فاکتورها <button class="lnk" data-act="go" data-h="#/invoices">همه</button></div>' + recent.map(i => invRow(i)).join('') + '</div>';
  return { title: S.settings.business || 'حسابداری فیکس کوییک', html: h };
}
function invNotes(i) { return [i.note].concat((i.items || []).map(l => l.note)).filter(Boolean); }
function invRow(i, q) {
  const hit = q ? (invNotes(i).find(x => Core.toEn(x).toLowerCase().includes(q)) || '') : '';
  const info = Core.invoiceInfo(S, i); const badge = info.remaining === 0 ? '<span class="bd ok">تسویه</span>' : info.paid > 0 ? '<span class="bd mid">مانده ' + fmt(info.remaining) + '</span>' : '<span class="bd no">تسویه نشده</span>';
  return '<button class="row" data-act="go" data-h="#/inv/' + i.id + '"><span><b>' + esc(personName(i.personId)) + '</b><small>' + Core.TYPE_FA[i.type] + ' · شماره ' + fa(i.no) + ' · ' + fmtDate(i.date) + '</small>' + (hit ? '<small class="hit">🔎 ' + esc(hit) + '</small>' : '') + '</span><span class="end"><em>' + fmt(info.total) + '</em>' + badge + '</span></button>';
}

/* ─────────── PEOPLE ─────────── */
function pagePeople() {
  const b = Core.balances(S), q = Core.toEn(UI.peopleQ).trim().toLowerCase();
  let list = S.people.filter(p => UI.showArchived ? p.archived : !p.archived);
  if (q) list = list.filter(p => (p.name + ' ' + p.phone).toLowerCase().includes(q));
  if (UI.peopleF === 'debit') list = list.filter(p => b[p.id] > 0); else if (UI.peopleF === 'credit') list = list.filter(p => b[p.id] < 0); else if (UI.peopleF === 'zero') list = list.filter(p => !b[p.id]);
  list.sort((x, y) => UI.peopleF === 'debit' ? b[y.id] - b[x.id] : UI.peopleF === 'credit' ? b[x.id] - b[y.id] : x.name.localeCompare(y.name, 'fa'));
  const rp = Core.receivablePayable(S);
  let h = '<div class="stats">' + stat('جمع طلب‌های من', fmt(rp.receivable), rp.receivable ? 'debit' : 'zero') + stat('جمع بدهی‌های من', fmt(rp.payable), rp.payable ? 'credit' : 'zero') + '</div>';
  h += '<input class="inp" id="people-q" placeholder="جستجوی نام یا تلفن…" value="' + esc(UI.peopleQ) + '" autocomplete="off">' + chips('peopleF', UI.peopleF, [['all', 'همه'], ['debit', 'طلب من'], ['credit', 'بدهی من'], ['zero', 'تسویه']]);
  h += list.length ? '<div class="card flush">' + list.map(p => '<button class="row" data-act="go" data-h="#/person/' + p.id + '"><span><b>' + esc(p.name) + '</b><small>' + (esc(p.phone) || '&nbsp;') + '</small></span><span class="end">' + bal(b[p.id]) + '<small>' + (b[p.id] ? sign(b[p.id]) : '') + '</small></span></button>').join('') + '</div>'
    : empty('👥', q || UI.peopleF !== 'all' ? 'موردی پیدا نشد.' : 'هنوز شخصی ثبت نکرده‌اید.', q ? '' : '<button class="btn blue" data-act="addPerson">+ افزودن شخص</button>');
  if (S.people.some(p => p.archived)) h += '<button class="lnk center" data-act="toggleArchived">' + (UI.showArchived ? 'نمایش فعال‌ها' : 'نمایش بایگانی‌شده‌ها') + '</button>';
  return { title: 'اشخاص', html: h, fab: ['addPerson', '+'] };
}

function personForm(p) {
  const sh = sheet(p ? 'ویرایش شخص' : 'شخص جدید', '<form id="pf"><label class="fld"><span>نام</span><input class="inp" name="name" value="' + esc(p ? p.name : '') + '" autocomplete="off"></label><label class="fld"><span>تلفن</span><input class="inp ltr" name="phone" inputmode="tel" value="' + esc(p ? p.phone : '') + '"></label><label class="fld"><span>توضیحات</span><input class="inp" name="note" value="' + esc(p ? p.note : '') + '"></label>' +
    (p ? '' : '<div class="fld"><span>مانده اول دوره (اختیاری)</span><div class="row2"><select class="inp" name="obk"><option value="1">او به من بدهکار است (طلب من)</option><option value="-1">من به او بدهکارم (بدهی من)</option></select><input class="inp ltr" name="ob" data-money inputmode="numeric" placeholder="مبلغ" autocomplete="off"></div></div>') +
    '<button class="btn blue" type="submit">ذخیره</button></form>');
  sh.q('#pf').onsubmit = async e => {
    e.preventDefault(); const f = sh.q('#pf'); const d = { name: f.name.value, phone: f.phone.value, note: f.note.value };
    if (!p) { const ob = f.ob.value.trim() === '' ? 0 : Core.parseMoney(f.ob.value); if (isNaN(ob)) return toast('مبلغ مانده نامعتبر است.', true); d.opening = ob * (+f.obk.value); d.date = today(); }
    const r = p ? Core.editPerson(S, p.id, d) : Core.addPerson(S, d);
    if (await done(r, 'ذخیره شد.')) { sh.close(); if (!p && r.person) goHash('#/person/' + r.person.id); }
  };
  autoFocus(() => sh.q('[name=name]'));
}

function pagePerson(id) {
  const p = Core.byId(S.people, +id); if (!p) return { title: 'شخص', html: empty('❓', 'شخص پیدا نشد.', backTo('#/people')), back: '#/people' };
  const from = UI.stmtFrom, to = UI.stmtTo, L = Core.ledger(S, p.id, from, to), b = Core.balanceOf(S, p.id);
  let h = '<div class="card hero ' + (b > 0 ? 'd' : b < 0 ? 'c' : '') + '"><small>' + (b > 0 ? 'این شخص به شما بدهکار است' : b < 0 ? 'شما به این شخص بدهکارید' : 'حساب تسویه است') + '</small><b>' + fmt(Math.abs(b)) + ' <i>ریال</i></b>' + (p.phone ? '<a class="tel" href="tel:' + esc(Core.toEn(p.phone)) + '">📞 ' + esc(p.phone) + '</a>' : '') + (p.note ? '<small>' + esc(p.note) + '</small>' : '') + '</div>';
  h += '<div class="quick four"><button class="q" data-act="txForm" data-t="receipt" data-p="' + p.id + '">⬇️<span>دریافت</span></button><button class="q" data-act="txForm" data-t="payment" data-p="' + p.id + '">⬆️<span>پرداخت</span></button><button class="q green" data-act="newInv" data-t="sale" data-p="' + p.id + '">🧾<span>فروش</span></button><button class="q blue" data-act="newInv" data-t="purchase" data-p="' + p.id + '">🛒<span>خرید</span></button></div>';
  h += '<div class="toolbar"><button class="btn ghost sm" data-act="txForm" data-t="manual" data-p="' + p.id + '">+ ثبت دستی</button><button class="btn ghost sm" data-act="transfer" data-p="' + p.id + '">↔ حواله</button><button class="btn ghost sm" data-act="stmtRange">📅 بازه</button><button class="btn ghost sm" data-act="shareStmt" data-p="' + p.id + '">📤 ارسال</button><button class="btn ghost sm" data-act="csvStmt" data-p="' + p.id + '">📄 CSV</button><button class="btn ghost sm" data-act="editPerson" data-p="' + p.id + '">✏️ ویرایش</button></div>';
  if (from || to) h += '<div class="alert">بازه: ' + (from ? fmtDate(from) : 'ابتدا') + ' تا ' + (to ? fmtDate(to) : 'انتها') + ' <button class="lnk" data-act="stmtClear">حذف فیلتر</button></div>';
  h += '<div class="card flush ledger"><div class="lh"><span>تاریخ / شرح</span><span>اضافه</span><span>کم</span><span>مانده</span></div>';
  if (from && L.carry) h += '<div class="lr muted"><span>مانده از قبل</span><span></span><span></span><span>' + bal(L.carry) + '</span></div>';
  h += L.rows.length ? L.rows.slice().reverse().map(r => '<button class="lr" data-act="txOpen" data-id="' + r.tx.id + '"><span><b>' + esc(fa(r.tx.desc || Core.TYPE_FA[r.tx.type] || 'ثبت دستی')) + '</b><small>' + fmtDate(r.tx.date) + (r.tx.method ? ' · ' + Core.METHODS[r.tx.method] : '') + '</small></span><span class="debit">' + (r.debit ? fmt(r.debit) : '') + '</span><span class="credit">' + (r.credit ? fmt(r.credit) : '') + '</span><span>' + bal(r.balance) + '</span></button>').join('') : '<div class="empty">تراکنشی ثبت نشده است.</div>';
  h += '</div><p class="hint">«اضافه» یعنی طلب شما از او بیشتر شد (مثلاً فروش به او). «کم» یعنی کمتر شد (مثلاً گرفتن پول از او، یا خرید از او).</p><div class="toolbar"><button class="btn ghost sm" data-act="archive" data-p="' + p.id + '">' + (p.archived ? '♻️ فعال‌سازی' : '🗄 بایگانی') + '</button><button class="btn ghost sm red" data-act="delPerson" data-p="' + p.id + '">🗑 حذف شخص</button></div>';
  return { title: p.name, html: h, back: '#/people' };
}

/* tx forms */
function txForm(type, personId, tx) {
  const titles = { receipt: 'دریافت از شخص', payment: 'پرداخت به شخص', manual: 'ثبت دستی در حساب' };
  const t = tx ? tx.type : type; const isPay = t === 'receipt' || t === 'payment';
  const sh = sheet(tx ? 'ویرایش تراکنش' : titles[t], '<form id="tf"><label class="fld"><span>شخص</span><button type="button" class="inp pick" id="tf-p">' + esc(personId ? personName(personId) : 'انتخاب شخص…') + '</button></label>' +
    (t === 'manual' ? '<label class="fld"><span>نوع</span><select class="inp" name="kind"><option value="debit">او به من بدهکار شد (طلب من زیاد شود)</option><option value="credit">من به او بدهکار شدم (بدهی من زیاد شود)</option></select></label>' : '') +
    moneyField('amount', tx ? tx.amount : 0, 'مبلغ (ریال)') + (personId && !tx && isPay ? '<button type="button" class="lnk" id="tf-full">تسویه کامل مانده</button>' : '') +
    (isPay ? methodSel(tx && tx.method) : '') + dateField('date', tx ? tx.date : today()) + '<label class="fld"><span>شرح</span><input class="inp" name="desc" value="' + esc(tx ? tx.desc : '') + '"></label><button class="btn blue" type="submit">ثبت</button></form>');
  const f = sh.q('#tf'); if (tx && f.kind) f.kind.value = tx.kind;
  const setP = id => { personId = id; sh.q('#tf-p').textContent = personName(id); };
  if (tx) sh.q('#tf-p').disabled = true; else sh.q('#tf-p').onclick = () => pickList('انتخاب شخص', personItems(), v => setP(+v));
  const full = sh.q('#tf-full'); if (full) full.onclick = () => { const b = Core.balanceOf(S, personId); if (!b) return toast('مانده صفر است.'); f.amount.value = fa(Core.group(Math.abs(b))); };
  f.onsubmit = async e => {
    e.preventDefault(); const amount = Core.parseMoney(f.amount.value), date = readDate(f, 'date');
    if (!date) return toast('تاریخ نامعتبر است.', true); if (!amount) return toast('مبلغ را درست وارد کنید.', true);
    const r = tx ? Core.editTx(S, tx.id, { amount, date, desc: f.desc.value, kind: f.kind ? f.kind.value : tx.kind, method: f.method ? f.method.value : null })
      : Core.addTx(S, { personId, type: t, kind: f.kind ? f.kind.value : null, amount, date, desc: f.desc.value || titles[t], method: f.method ? f.method.value : null });
    if (await done(r, 'ثبت شد.')) sh.close();
  };
}
function transferForm(fromId) {
  let from = fromId || null, to = null;
  const sh = sheet('حواله بین دو شخص', '<form id="xf"><label class="fld"><span>از حساب (پرداخت‌کننده)</span><button type="button" class="inp pick" id="xf-a">' + esc(from ? personName(from) : 'انتخاب…') + '</button></label><label class="fld"><span>به حساب (دریافت‌کننده)</span><button type="button" class="inp pick" id="xf-b">انتخاب…</button></label>' + moneyField('amount', 0, 'مبلغ') + dateField('date', today()) + '<label class="fld"><span>شرح</span><input class="inp" name="desc"></label><p class="hint">مبلغ از حساب مبدأ کم و به حساب مقصد اضافه می‌شود.</p><button class="btn blue" type="submit">ثبت حواله</button></form>');
  sh.q('#xf-a').onclick = () => pickList('از حساب', personItems(), v => { from = +v; sh.q('#xf-a').textContent = personName(from); });
  sh.q('#xf-b').onclick = () => pickList('به حساب', personItems(), v => { to = +v; sh.q('#xf-b').textContent = personName(to); });
  const f = sh.q('#xf'); f.onsubmit = async e => { e.preventDefault(); const date = readDate(f, 'date'), amount = Core.parseMoney(f.amount.value); if (!date) return toast('تاریخ نامعتبر است.', true); if (!amount) return toast('مبلغ را درست وارد کنید.', true); if (await done(Core.addTransfer(S, { fromId: from, toId: to, amount, date, desc: f.desc.value }), 'حواله ثبت شد.')) sh.close(); };
}
function txOpen(id) {
  const t = Core.byId(S.tx, id); if (!t) return;
  const inv = t.ref ? Core.byId(S.invoices, t.ref) : null;
  const sh = sheet('جزئیات تراکنش', '<div class="kv"><span>شخص</span><b>' + esc(personName(t.personId)) + '</b><span>تاریخ</span><b>' + fmtDate(t.date) + '</b><span>مبلغ</span><b class="' + (t.kind === 'debit' ? 'debit' : 'credit') + '">' + fmt(t.amount) + ' ' + (t.kind === 'debit' ? 'اضافه به حساب او' : 'کم از حساب او') + '</b>' + (t.method ? '<span>روش</span><b>' + Core.METHODS[t.method] + '</b>' : '') + '<span>شرح</span><b>' + esc(fa(t.desc || '—')) + '</b></div><div class="row2">' + (inv ? '<button class="btn blue" data-go="#/inv/' + inv.id + '">مشاهده فاکتور</button>' : '') + (t.type !== 'invoice' && t.type !== 'transfer' ? '<button class="btn ghost" data-edit>✏️ ویرایش</button>' : '') + (t.type !== 'invoice' ? '<button class="btn red" data-del>🗑 حذف</button>' : '') + '</div>');
  const g = sh.q('[data-go]'); if (g) g.onclick = () => { sh.close(); goHash(g.dataset.go); };
  const ed = sh.q('[data-edit]'); if (ed) ed.onclick = () => { sh.close(); txForm(t.type, t.personId, t); };
  const dl = sh.q('[data-del]'); if (dl) dl.onclick = async () => { if (await confirmBox(t.group ? 'هر دو سمت این حواله حذف می‌شود. ادامه می‌دهید؟' : 'این تراکنش حذف شود؟', 'حذف', true)) { sh.close(); await done(Core.deleteTx(S, t.id), 'حذف شد.'); } };
}

/* ─────────── INVOICES ─────────── */
function pageInvoices() {
  const q = Core.toEn(UI.invQ).trim().toLowerCase();
  let list = S.invoices.slice().sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id);
  if (UI.invF !== 'all') list = list.filter(i => i.type === UI.invF);
  if (q) list = list.filter(i => Core.toEn(personName(i.personId) + ' ' + i.no + ' ' + invNotes(i).join(' ') + ' ' + i.items.map(l => prodName(l.productId)).join(' ')).toLowerCase().includes(q));
  const sum = list.reduce((s, i) => s + Core.invoiceTotals(i).total, 0);
  let h = '<input class="inp" id="inv-q" placeholder="جستجوی نام، شماره فاکتور یا سریال…" value="' + esc(UI.invQ) + '" autocomplete="off">' + chips('invF', UI.invF, [['all', 'همه'], ['sale', 'فروش'], ['purchase', 'خرید'], ['sale_return', 'برگشت فروش'], ['purchase_return', 'برگشت خرید']]);
  h += list.length ? '<div class="card flush">' + list.map(i => invRow(i, q)).join('') + '</div><p class="hint center">' + fa(list.length) + ' فاکتور · جمع: ' + fmt(sum) + ' ریال</p>' : empty('🧾', 'فاکتوری ثبت نشده است.', '<div class="row2"><button class="btn green" data-act="newInv" data-t="sale">فاکتور فروش</button><button class="btn blue" data-act="newInv" data-t="purchase">فاکتور خرید</button></div>');
  return { title: 'فاکتورها', html: h, fab: ['newInv', '+'], fabData: { t: 'sale' } };
}

function pageInvoice(id) {
  const i = Core.byId(S.invoices, +id); if (!i) return { title: 'فاکتور', html: empty('❓', 'فاکتور پیدا نشد.', backTo('#/invoices')), back: '#/invoices' };
  const info = Core.invoiceInfo(S, i); const pays = S.tx.filter(t => t.ref === i.id && (t.type === 'receipt' || t.type === 'payment'));
  const dirTxt = i.type === 'sale' || i.type === 'purchase_return' ? 'دریافت' : 'پرداخت';
  let h = '<div class="card"><div class="kv"><span>نوع</span><b>' + Core.TYPE_FA[i.type] + '</b><span>شماره</span><b>' + fa(i.no) + '</b><span>شخص</span><b><a data-act="go" data-h="#/person/' + i.personId + '">' + esc(personName(i.personId)) + '</a></b><span>تاریخ</span><b>' + fmtDate(i.date) + '</b>' + (i.note ? '<span>توضیحات</span><b>' + esc(i.note) + '</b>' : '') + '</div></div>';
  h += '<div class="card flush"><div class="lh it"><span>کالا</span><span>تعداد</span><span>قیمت</span><span>جمع</span></div>' + info.lines.map(l => '<div class="lr it"><span><b>' + esc(prodName(l.productId)) + '</b>' + (l.note ? '<small class="sn-t">🔖 ' + esc(l.note) + '</small>' : '') + '</span><span>' + Core.fmtQty(l.qty) + ' ' + esc(unitOf(l.productId)) + '</span><span>' + fmt(l.price) + '</span><span>' + fmt(l.gross) + '</span></div>').join('') + '</div>';
  h += '<div class="card"><div class="kv"><span>جمع اقلام</span><b>' + fmt(info.sub) + '</b>' + (info.discount ? '<span>تخفیف</span><b>' + fmt(info.discount) + '</b>' : '') + '<span>جمع نهایی</span><b class="big">' + fmt(info.total) + ' ریال</b><span>' + (dirTxt === 'دریافت' ? 'دریافت‌شده' : 'پرداخت‌شده') + '</span><b>' + fmt(info.paid) + '</b><span>مانده این فاکتور</span><b class="' + (info.remaining ? 'debit' : 'credit') + '">' + fmt(info.remaining) + '</b></div></div>';
  if (pays.length) h += '<div class="card"><div class="ch">پرداخت‌ها</div>' + pays.map(t => '<button class="row" data-act="txOpen" data-id="' + t.id + '"><span><b>' + fmtDate(t.date) + '</b><small>' + Core.METHODS[t.method] + '</small></span><em>' + fmt(t.amount) + '</em></button>').join('') + '</div>';
  h += '<div class="toolbar">' + (info.remaining > 0 ? '<button class="btn blue sm" data-act="payInv" data-id="' + i.id + '">' + (dirTxt === 'دریافت' ? '⬇️ ثبت دریافت' : '⬆️ ثبت پرداخت') + '</button>' : '') + '<button class="btn ghost sm" data-act="shareInv" data-id="' + i.id + '">📤 ارسال متن</button>' + '<button class="btn ghost sm" data-act="printInv" data-id="' + i.id + '">🖨 چاپ فاکتور (A5)</button>' + '<button class="btn ghost sm red" data-act="delInv" data-id="' + i.id + '">🗑 حذف</button></div>';
  return { title: Core.TYPE_FA[i.type] + ' ' + fa(i.no), html: h, back: '#/invoices' };
}
function invoiceText(i) {
  const info = Core.invoiceInfo(S, i);
  return [(S.settings.business || 'فیکس کوییک') + ' — فاکتور ' + Core.TYPE_FA[i.type] + ' شماره ' + fa(i.no), 'شخص: ' + personName(i.personId), 'تاریخ: ' + fmtDate(i.date), ''].concat(info.lines.map(l => '• ' + prodName(l.productId) + ' × ' + Core.fmtQty(l.qty) + ' × ' + fmt(l.price) + ' = ' + fmt(l.gross) + (l.note ? ' (' + l.note + ')' : '')), ['', 'جمع: ' + fmt(info.sub)], info.discount ? ['تخفیف: ' + fmt(info.discount)] : [], ['مبلغ نهایی: ' + fmt(info.total) + ' ریال', 'پرداخت‌شده: ' + fmt(info.paid), 'مانده: ' + fmt(info.remaining)]).join('\n');
}

/* new invoice page */
function pageNewInvoice(type, preset) {
  if (!Core.TYPE_FA[type]) type = 'sale';
  const personId = preset && preset.p ? +preset.p : null;
  const isSaleSide = type === 'sale' || type === 'sale_return';
  const payLabel = type === 'sale' ? 'دریافتی همزمان' : type === 'purchase' ? 'پرداختی همزمان' : type === 'sale_return' ? 'مبلغ بازپرداخت‌شده به مشتری' : 'مبلغ دریافتی از تأمین‌کننده';
  let h = '<div class="chips">' + Object.keys(Core.TYPE_FA).map(k => '<button type="button" class="chip' + (k === type ? ' on' : '') + '" data-act="newInv" data-t="' + k + '"' + (personId ? ' data-p="' + personId + '"' : '') + '>' + Core.TYPE_FA[k] + '</button>').join('') + '</div>';
  h += '<form id="nf" class="card"><input type="hidden" name="type" value="' + type + '"><input type="hidden" name="pid" value="' + (personId || '') + '"><label class="fld"><span>' + (isSaleSide ? 'مشتری' : 'تأمین‌کننده / فروشنده') + '</span><button type="button" class="inp pick" id="nf-p" data-act="pickInvPerson">' + (personId ? esc(personName(personId)) : 'انتخاب شخص…') + '</button></label><div class="row2">' + dateField('date', today()) + '<label class="fld"><span>شماره فاکتور</span><input class="inp ltr" name="no" inputmode="numeric" value="' + fa(Core.nextInvoiceNo(S)) + '"></label></div>' +
    '<div class="ch">اقلام</div><div id="rows"></div><button type="button" class="btn ghost" data-act="addRow">+ افزودن قلم</button>' +
    '<div class="sumbox"><div class="kv"><span>جمع اقلام</span><b id="s-sub">۰</b></div></div>' + moneyField('discount', 0, 'تخفیف (ریال)') +
    '<div class="sumbox"><div class="kv"><span>مبلغ نهایی</span><b class="big" id="s-tot">۰ ریال</b></div></div>' + moneyField('paid', 0, payLabel) + '<div class="row2"><button type="button" class="lnk" data-act="payFull">تسویه کامل</button></div>' + methodSel('cash') +
    '<div class="kv small"><span>' + ({ sale: 'او هنوز باید به من بدهد', purchase: 'من هنوز باید به او بدهم', sale_return: 'مانده‌ای که باید به او برگردانم', purchase_return: 'مانده‌ای که او باید به من برگرداند' }[type]) + '</span><b id="s-rem">۰</b></div><label class="fld"><span>توضیحات</span><input class="inp" name="note"></label><button class="btn ' + (isSaleSide ? 'green' : 'blue') + '" type="submit" id="nf-save">ثبت فاکتور ' + Core.TYPE_FA[type] + '</button></form>';
  return { title: 'فاکتور ' + Core.TYPE_FA[type], html: h, back: '#/invoices', mount: () => { addRow(); calcInvoice(); const f = $('#nf'); f.addEventListener('input', calcInvoice); f.onsubmit = submitInvoice; } };
}
function addRow() {
  const rows = $('#rows'), d = document.createElement('div'); d.className = 'it-row'; d.dataset.pid = '';
  d.innerHTML = '<button type="button" class="inp pick" data-act="pickProd">انتخاب کالا…</button><small class="hint stk"></small><div class="g3"><label><span>تعداد</span><input class="inp ltr" name="qty" inputmode="decimal" value="' + fa(1) + '"></label><label><span>قیمت واحد</span><input class="inp ltr" name="price" data-money inputmode="numeric" placeholder="۰"></label><label><span>جمع</span><b class="lt">۰</b></label></div><label class="fld sn"><span>توضیحات / سریال (اختیاری)</span><input class="inp" name="sn" placeholder="مثلاً سریال دستگاه" autocomplete="off"></label><button type="button" class="rm" data-act="rmRow" aria-label="حذف قلم">✕</button>';
  rows.appendChild(d);
}
function readInvoice() {
  const f = $('#nf'); const items = []; let bad = null;
  $$('.it-row', f).forEach((r, idx) => {
    const pid = +r.dataset.pid, qty = Core.parseQty($('[name=qty]', r).value), ps = $('[name=price]', r).value.trim(), price = ps === '' ? NaN : Core.parseMoney(ps);
    if (!pid) bad = bad || ('قلم ' + fa(idx + 1) + ': کالا را انتخاب کنید.'); else if (isNaN(qty)) bad = bad || ('قلم ' + fa(idx + 1) + ': تعداد نامعتبر است.'); else if (isNaN(price)) bad = bad || ('قلم ' + fa(idx + 1) + ': قیمت را وارد کنید.');
    items.push({ productId: pid, qty, price, note: $('[name=sn]', r).value.trim() });
  });
  return { items, bad, discount: readMoney(f, 'discount'), paid: readMoney(f, 'paid') };
}
function calcInvoice() {
  const f = $('#nf'); if (!f) return; const rd = readInvoice(); let sub = 0;
  $$('.it-row', f).forEach((r, i) => { const it = rd.items[i]; const t = (it.qty > 0 && it.price >= 0) ? Math.round(it.qty * it.price) : 0; sub += t; $('.lt', r).textContent = fmt(t); });
  const disc = isNaN(rd.discount) ? 0 : Math.min(rd.discount, sub), tot = sub - disc, paid = isNaN(rd.paid) ? 0 : rd.paid;
  $('#s-sub').textContent = fmt(sub); $('#s-tot').textContent = fmt(tot) + ' ریال'; $('#s-rem').textContent = fmt(tot - paid);
  f.dataset.total = tot;
}
async function submitInvoice(e) {
  e.preventDefault(); const f = $('#nf'), rd = readInvoice(); const date = readDate(f, 'date');
  if (!f.pid.value) return toast('شخص را انتخاب کنید.', true); if (!date) return toast('تاریخ نامعتبر است.', true); if (rd.bad) return toast(rd.bad, true);
  if (isNaN(rd.discount)) return toast('تخفیف نامعتبر است.', true); if (isNaN(rd.paid)) return toast('مبلغ پرداخت/دریافت نامعتبر است.', true);
  const r = Core.addInvoice(S, { type: f.type.value, personId: +f.pid.value, date, no: Core.toEn(f.no.value).trim(), items: rd.items, discount: rd.discount, paid: rd.paid, method: f.method.value, note: f.note.value });
  if (!r.ok) return toast(r.error, true); await save(); toast('فاکتور ثبت شد.'); goHash('#/inv/' + r.invoice.id);
}

/* ─────────── PRODUCTS ─────────── */
function pageProducts() {
  const q = Core.toEn(UI.prodQ).trim().toLowerCase(); let st = Core.productStats(S);
  if (q) st = st.filter(x => (x.product.name + ' ' + x.product.sku).toLowerCase().includes(q)); st.sort((a, b) => a.product.name.localeCompare(b.product.name, 'fa'));
  const all = Core.productStats(S);
  let h = '<div class="stats">' + stat('تعداد کالا', fa(all.length)) + stat('ارزش کل انبار', fmt(Core.inventoryValue(S)), '', 'ریال') + '</div><input class="inp" id="prod-q" placeholder="جستجوی کالا…" value="' + esc(UI.prodQ) + '" autocomplete="off">';
  h += st.length ? '<div class="card flush">' + st.map(x => '<button class="row" data-act="prodOpen" data-id="' + x.product.id + '"><span><b>' + esc(x.product.name) + '</b><small>' + (x.product.sku ? esc(x.product.sku) + ' · ' : '') + 'میانگین خرید: ' + fmt(x.avg) + '</small></span><span class="end"><em class="' + (x.low ? 'debit' : '') + '">' + Core.fmtQty(x.stock) + ' ' + esc(x.product.unit) + '</em><small>' + fmt(x.value) + '</small></span></button>').join('') + '</div>' : empty('📦', 'کالایی ثبت نشده است.', '<button class="btn blue" data-act="addProduct">+ افزودن کالا</button>');
  h += '<button class="lnk center" data-act="bulkProducts">📝 افزودن چند کالا فقط با نام</button>';
  return { title: 'انبار و کالاها', html: h, fab: ['addProduct', '+'] };
}
function productForm(p, o) {
  o = o || {};
  const sh = sheet(p ? 'ویرایش کالا' : o.inInvoice ? 'کالای جدید (به انبار هم اضافه می‌شود)' : 'کالای جدید', '<form id="gf"><label class="fld"><span>نام کالا</span><input class="inp" name="name" value="' + esc(p ? p.name : '') + '" autocomplete="off"></label><div class="row2"><label class="fld"><span>کد (اختیاری)</span><input class="inp ltr" name="sku" value="' + esc(p ? p.sku : '') + '"></label><label class="fld"><span>واحد</span><input class="inp" name="unit" value="' + esc(p ? p.unit : 'عدد') + '"></label></div>' + moneyField('salePrice', p ? p.salePrice : 0, 'قیمت فروش پیش‌فرض') + moneyField('buyPrice', p ? p.buyPrice : 0, 'قیمت خرید پیش‌فرض') + (p || o.inInvoice ? '' : '<label class="fld"><span>موجودی اولیه (اختیاری)</span><input class="inp ltr" name="openQty" inputmode="decimal" placeholder="۰" autocomplete="off"></label><p class="hint">اگر همین الان از این کالا دارید، تعدادش را بنویسید. با «قیمت خرید» بالا در انبار ثبت می‌شود و در سود و زیان حساب نمی‌شود. اگر فقط می‌خواهید نام کالا در فهرست باشد، فقط «نام کالا» را بنویسید و بقیه را خالی بگذارید.</p>') + '<label class="fld"><span>حداقل موجودی (هشدار)</span><input class="inp ltr" name="minStock" inputmode="decimal" value="' + fa(p ? p.minStock : 0) + '"></label><button class="btn blue" type="submit">ذخیره</button></form>');
  const f = sh.q('#gf'); f.onsubmit = async e => { e.preventDefault(); const d = { name: f.name.value, sku: f.sku.value, unit: f.unit.value, salePrice: Core.parseMoney(f.salePrice.value || '0'), buyPrice: Core.parseMoney(f.buyPrice.value || '0'), minStock: Core.parseNum(f.minStock.value || '0') }; if (isNaN(d.salePrice) || isNaN(d.buyPrice) || isNaN(d.minStock)) return toast('مقادیر عددی نامعتبر است.', true); const oq = (!p && f.openQty && f.openQty.value.trim() !== '') ? Core.parseNum(f.openQty.value) : 0; if (isNaN(oq) || oq < 0) return toast('موجودی اولیه نامعتبر است.', true); if (oq > 0 && !(d.buyPrice > 0)) return toast('برای موجودی اولیه، قیمت خرید را هم وارد کنید.', true); let r = p ? Core.editProduct(S, p.id, d) : Core.addProduct(S, d); if (o.onSaved && r.ok && !p) { await save(); sh.close(); toast('کالا به انبار اضافه شد.'); o.onSaved(r.product); return; } if (r.ok && !p && oq > 0) { const a = Core.addAdjust(S, { productId: r.product.id, qty: oq, cost: d.buyPrice, date: today(), note: 'موجودی اولیه', opening: true }); if (!a.ok) { Core.deleteProduct(S, r.product.id); r = a; } } if (await done(r, 'ذخیره شد.')) sh.close(); };
  autoFocus(() => f.name);
}
function bulkProducts() {
  const sh = sheet('افزودن چند کالا با نام', '<form id="bf"><p class="hint">هر نام کالا را در یک خط بنویسید. فقط نام ثبت می‌شود؛ قیمت و موجودی را بعداً (مثلاً با فاکتور خرید) وارد می‌کنید. نام‌های تکراری نادیده گرفته می‌شوند.</p><textarea class="inp" name="t" rows="8" style="height:auto;padding:10px" placeholder="گوشی سامسونگ A15&#10;کابل شارژ تایپ‌سی&#10;قاب ژله‌ای"></textarea><button class="btn blue" type="submit">افزودن به انبار</button></form>');
  sh.q('#bf').onsubmit = async e => { e.preventDefault(); const names = Array.from(new Set(e.target.t.value.split(/\n/).map(s => s.trim()).filter(Boolean))); if (!names.length) return toast('نامی نوشته نشده است.', true); let add = 0, dup = 0; for (const n of names) { const r = Core.addProduct(S, { name: n }); if (r.ok) add++; else dup++; } if (add) await save(); sh.close(); toast(fa(add) + ' کالا اضافه شد' + (dup ? ' (' + fa(dup) + ' مورد تکراری بود)' : '') + '.', !add); render(); };
  autoFocus(() => sh.q('[name=t]'));
}
function prodOpen(id) {
  const x = Core.productStats(S).find(s => s.product.id === id); if (!x) return; const p = x.product;
  const sh = sheet(p.name, '<div class="kv"><span>موجودی</span><b>' + Core.fmtQty(x.stock) + ' ' + esc(p.unit) + '</b><span>میانگین قیمت خرید</span><b>' + fmt(x.avg) + '</b><span>ارزش موجودی</span><b>' + fmt(x.value) + '</b><span>قیمت فروش پیش‌فرض</span><b>' + fmt(p.salePrice) + '</b></div><div class="row2"><button class="btn blue" data-k>📒 کاردکس</button><button class="btn ghost" data-a>⚖️ تعدیل موجودی</button><button class="btn ghost" data-e>✏️ ویرایش</button><button class="btn red" data-d>🗑 حذف</button></div>');
  sh.q('[data-k]').onclick = () => { sh.close(); goHash('#/kardex/' + p.id); }; sh.q('[data-a]').onclick = () => { sh.close(); adjustForm(p); }; sh.q('[data-e]').onclick = () => { sh.close(); productForm(p); };
  sh.q('[data-d]').onclick = async () => { if (await confirmBox('کالای «' + p.name + '» حذف شود؟', 'حذف', true)) { sh.close(); await done(Core.deleteProduct(S, p.id), 'حذف شد.'); } };
}
function adjustForm(p) {
  const sh = sheet('تعدیل موجودی: ' + p.name, '<form id="af"><p class="hint">برای کم‌کردن موجودی (ضایعات، شمارش انبار) علامت منفی بگذارید؛ مثلاً ‎-۲‎. مقدار مثبت به موجودی اضافه می‌کند.</p><label class="fld"><span>مقدار تعدیل</span><input class="inp ltr" name="qty" inputmode="decimal" placeholder="-۲ یا ۵"></label>' + moneyField('cost', 0, 'قیمت واحد (فقط برای افزایش، اختیاری)') + dateField('date', today()) + '<label class="fld"><span>علت</span><input class="inp" name="note"></label><label class="hint"><input type="checkbox" name="opening"> موجودی اولیه است (در سود و زیان حساب نشود)</label><button class="btn blue" type="submit">ثبت تعدیل</button></form>');
  const f = sh.q('#af'); f.onsubmit = async e => { e.preventDefault(); const q = Core.parseNum(f.qty.value.replace(/[−–]/g, '-')), date = readDate(f, 'date'); if (isNaN(q) || !q) return toast('مقدار نامعتبر است.', true); if (!date) return toast('تاریخ نامعتبر است.', true); if (await done(Core.addAdjust(S, { productId: p.id, qty: q, cost: Core.parseMoney(f.cost.value || '0') || 0, date, note: f.note.value, opening: f.opening.checked }), 'تعدیل ثبت شد.')) sh.close(); };
}
function pageKardex(id) {
  const p = Core.byId(S.products, +id); if (!p) return { title: 'کاردکس', html: empty('❓', 'کالا پیدا نشد.'), back: '#/products' };
  const mv = Core.productMoves(S, p.id);
  let h = '<div class="card flush"><div class="lh it"><span>شرح</span><span>ورود</span><span>خروج</span><span>موجودی</span></div>' + (mv.length ? mv.slice().reverse().map(m => '<div class="lr it"><span><b>' + esc(fa(m.label)) + '</b><small>' + fmtDate(m.date) + '</small></span><span class="credit">' + (m.delta > 0 ? Core.fmtQty(m.delta) : '') + '</span><span class="debit">' + (m.delta < 0 ? Core.fmtQty(-m.delta) : '') + '</span><span>' + Core.fmtQty(m.stock) + '</span></div>').join('') : '<div class="empty">حرکتی ثبت نشده است.</div>') + '</div>';
  return { title: 'کاردکس: ' + p.name, html: h, back: '#/products' };
}

/* ─────────── CHEQUES ─────────── */
function pageCheques() {
  const t = today(); const list = S.cheques.filter(c => UI.chqTab === 'open' ? !c.done : c.done).sort((a, b) => UI.chqTab === 'open' ? (a.dueDate < b.dueDate ? -1 : 1) : (a.doneAt < b.doneAt ? 1 : -1));
  const open = S.cheques.filter(c => !c.done), rec = open.filter(c => c.direction === 'receive').reduce((s, c) => s + c.amount, 0), pay = open.filter(c => c.direction === 'pay').reduce((s, c) => s + c.amount, 0);
  let h = '<div class="stats">' + stat('چک/قسط دریافتنی', fmt(rec), rec ? 'credit' : 'zero') + stat('چک/قسط پرداختنی', fmt(pay), pay ? 'debit' : 'zero') + '</div>' + chips('chqTab', UI.chqTab, [['open', 'در انتظار'], ['done', 'انجام‌شده']]);
  h += list.length ? '<div class="card flush">' + list.map(c => { const st = Core.chequeStatus(c, t), dd = Core.diffDays(t, c.dueDate); return '<div class="row static"><span><b>' + (c.kind === 'cheque' ? '🧾 ' : '📆 ') + esc(c.title) + '</b><small>' + (c.personId ? esc(personName(c.personId)) + ' · ' : '') + (c.direction === 'receive' ? 'دریافتی' : 'پرداختی') + ' · ' + fmtDate(c.dueDate) + (st === 'overdue' ? ' · <u class="debit">' + fa(-dd) + ' روز گذشته</u>' : st === 'soon' ? ' · ' + (dd === 0 ? 'امروز' : fa(dd) + ' روز دیگر') : '') + '</small></span><span class="end"><em>' + fmt(c.amount) + '</em>' + (c.done ? '<button class="mini" data-act="chqReopen" data-id="' + c.id + '">بازگردانی</button>' : '<button class="mini ok" data-act="chqDone" data-id="' + c.id + '">انجام شد</button>') + '<button class="mini" data-act="chqDel" data-id="' + c.id + '">حذف</button></span></div>'; }).join('') + '</div>' : empty('📆', UI.chqTab === 'open' ? 'موردی در انتظار نیست.' : 'موردی انجام نشده است.', '<button class="btn blue" data-act="addCheque">+ ثبت چک / قسط</button>');
  return { title: 'چک و اقساط', html: h, fab: ['addCheque', '+'], back: '#/more' };
}
function chequeForm() {
  let pid = null;
  const sh = sheet('ثبت چک / قسط', '<form id="cf"><div class="row2"><label class="fld"><span>نوع</span><select class="inp" name="kind"><option value="cheque">چک</option><option value="installment">قسط</option></select></label><label class="fld"><span>جهت</span><select class="inp" name="dir"><option value="receive">دریافتی (از شخص)</option><option value="pay">پرداختی (به شخص)</option></select></label></div><label class="fld"><span>شخص (اختیاری)</span><button type="button" class="inp pick" id="cf-p">انتخاب…</button></label><label class="fld"><span>عنوان / شماره چک</span><input class="inp" name="title"></label>' + moneyField('amount', 0, 'مبلغ') + dateField('due', today(), 'تاریخ سررسید') + '<label class="fld"><span>یادداشت</span><input class="inp" name="note"></label><button class="btn blue" type="submit">ثبت</button></form>');
  sh.q('#cf-p').onclick = () => pickList('انتخاب شخص', personItems(), v => { pid = +v; sh.q('#cf-p').textContent = personName(pid); });
  const f = sh.q('#cf'); f.onsubmit = async e => { e.preventDefault(); const due = readDate(f, 'due'), amount = Core.parseMoney(f.amount.value); if (!due) return toast('تاریخ نامعتبر است.', true); if (!amount) return toast('مبلغ را درست وارد کنید.', true); if (await done(Core.addCheque(S, { kind: f.kind.value, direction: f.dir.value, personId: pid, title: f.title.value, amount, dueDate: due, note: f.note.value }), 'ثبت شد.')) sh.close(); };
}

/* ─────────── EXPENSES ─────────── */
function pageExpenses() {
  const list = S.expenses.slice().sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id); const m = Core.periodRange('month'); const mt = list.filter(e => e.date >= m.from && e.date <= m.to).reduce((s, e) => s + e.amount, 0);
  let h = '<div class="stats">' + stat('هزینه این ماه', fmt(mt), 'debit', 'ریال') + stat('جمع کل هزینه‌ها', fmt(list.reduce((s, e) => s + e.amount, 0)), '', 'ریال') + '</div>';
  h += list.length ? '<div class="card flush">' + list.map(e => '<button class="row" data-act="expOpen" data-id="' + e.id + '"><span><b>' + esc(e.title) + '</b><small>' + fmtDate(e.date) + (e.category ? ' · ' + esc(e.category) : '') + ' · ' + Core.METHODS[e.method] + '</small></span><em class="debit">' + fmt(e.amount) + '</em></button>').join('') + '</div>' : empty('💸', 'هزینه‌ای ثبت نشده است. (اجاره، حقوق، قبض و…)', '<button class="btn blue" data-act="addExpense">+ ثبت هزینه</button>');
  return { title: 'هزینه‌ها', html: h, fab: ['addExpense', '+'], back: '#/more' };
}
function expenseForm(e) {
  const sh = sheet(e ? 'ویرایش هزینه' : 'هزینه جدید', '<form id="ef"><label class="fld"><span>عنوان</span><input class="inp" name="title" value="' + esc(e ? e.title : '') + '"></label>' + moneyField('amount', e ? e.amount : 0, 'مبلغ') + '<div class="row2"><label class="fld"><span>دسته (اختیاری)</span><input class="inp" name="cat" value="' + esc(e ? e.category : '') + '" list="cats"><datalist id="cats">' + [...new Set(S.expenses.map(x => x.category).filter(Boolean))].map(c => '<option value="' + esc(c) + '">').join('') + '</datalist></label>' + methodSel(e && e.method) + '</div>' + dateField('date', e ? e.date : today()) + '<div class="row2"><button class="btn blue" type="submit">ذخیره</button>' + (e ? '<button class="btn red" type="button" data-del>حذف</button>' : '') + '</div></form>');
  const f = sh.q('#ef'); f.onsubmit = async ev => { ev.preventDefault(); const date = readDate(f, 'date'), amount = Core.parseMoney(f.amount.value); if (!date) return toast('تاریخ نامعتبر است.', true); if (!amount) return toast('مبلغ را درست وارد کنید.', true); const d = { title: f.title.value, amount, date, method: f.method.value, category: f.cat.value }; if (await done(e ? Core.editExpense(S, e.id, d) : Core.addExpense(S, d), 'ذخیره شد.')) sh.close(); };
  const dl = sh.q('[data-del]'); if (dl) dl.onclick = async () => { if (await confirmBox('این هزینه حذف شود؟', 'حذف', true)) { sh.close(); await done(Core.deleteExpense(S, e.id), 'حذف شد.'); } };
}

/* ─────────── REPORTS ─────────── */
function repRange() { if (UI.rep === 'custom') return { from: UI.repFrom, to: UI.repTo }; return Core.periodRange(UI.rep); }
function pageReports() {
  const { from, to } = repRange(), r = Core.report(S, from, to), cs = Core.cashSummary(S, from, to), rp = Core.receivablePayable(S);
  const row = (l, v, c, b) => '<div class="rr' + (b ? ' b' : '') + '"><span>' + l + '</span><b class="' + (c || '') + '">' + fmt(v) + '</b></div>';
  let h = chips('rep', UI.rep, [['today', 'امروز'], ['week', 'این هفته'], ['month', 'این ماه'], ['year', 'امسال'], ['all', 'همه'], ['custom', 'دلخواه']]);
  if (UI.rep === 'custom') h += '<div class="card row2f">' + dateField('rf', UI.repFrom || today(), 'از') + dateField('rt', UI.repTo || today(), 'تا') + '<button class="btn blue sm" data-act="repApply">اعمال</button></div>';
  h += '<div class="hint center">' + (from ? fmtDate(from) : 'ابتدا') + ' تا ' + (to ? fmtDate(to) : 'امروز') + '</div>';
  h += '<div class="card"><div class="ch">سود و زیان</div>' + row('فروش', r.sales) + (r.saleReturns ? row('کسر: برگشت از فروش', r.saleReturns, 'debit') : '') + row('فروش خالص', r.revenue, '', 1) + row('کسر: بهای تمام‌شده کالای فروش‌رفته', r.cogs, 'debit') + (r.adjLoss ? row('کسر: ضایعات / تعدیل انبار', r.adjLoss, 'debit') : '') + row('سود ناخالص', r.gross, r.gross < 0 ? 'debit' : 'credit', 1) + row('کسر: هزینه‌ها', r.expenses, 'debit') + row('سود خالص', r.net, r.net < 0 ? 'debit' : 'credit', 1) + (r.discounts ? '<p class="hint">تخفیف‌های فروش در همین دوره: ' + fmt(r.discounts) + ' (در فروش خالص لحاظ شده)</p>' : '') + '</div>';
  h += '<div class="card"><div class="ch">گردش وجه نقد و بانک</div>' + row('دریافت‌ها', cs.in, 'credit') + row('پرداخت‌ها و هزینه‌ها', cs.out, 'debit') + row('خالص گردش', cs.net, cs.net < 0 ? 'debit' : 'credit', 1) + '<div class="rr sub"><span>نقد</span><b>' + fmt(cs.byMethod.cash) + '</b></div><div class="rr sub"><span>کارت/بانک</span><b>' + fmt(cs.byMethod.bank) + '</b></div><div class="rr sub"><span>چک</span><b>' + fmt(cs.byMethod.cheque) + '</b></div><div class="rr b"><span>موجودی فعلی صندوق/بانک</span><b>' + fmt(Core.cashBalance(S)) + '</b></div></div>';
  h += '<div class="card"><div class="ch">وضعیت کلی (تا امروز)</div>' + row('مطالبات از مشتریان', rp.receivable, 'debit') + row('بدهی به دیگران', rp.payable, 'credit') + row('ارزش موجودی انبار', Core.inventoryValue(S)) + row('خرید در دوره', r.purchases) + '</div>';
  const tc = Core.topPeople(S, 'sale', from, to, 5), tp = Core.topProducts(S, from, to, 5);
  if (tc.length) h += '<div class="card"><div class="ch">بهترین مشتریان</div>' + tc.map(x => row(esc(x.person ? x.person.name : '—'), x.total)).join('') + '</div>';
  if (tp.length) h += '<div class="card"><div class="ch">پرفروش‌ترین کالاها</div>' + tp.map(x => '<div class="rr"><span>' + esc(x.product ? x.product.name : '—') + '<small> ×' + Core.fmtQty(x.qty) + '</small></span><b>' + fmt(x.total) + '</b></div>').join('') + '</div>';
  const deb = S.people.map(p => ({ p, b: Core.balanceOf(S, p.id) })).filter(x => x.b > 0).sort((a, b) => b.b - a.b).slice(0, 8);
  if (deb.length) h += '<div class="card"><div class="ch">بیشترین طلب‌های من</div>' + deb.map(x => '<button class="rr" data-act="go" data-h="#/person/' + x.p.id + '"><span>' + esc(x.p.name) + '</span><b class="debit">' + fmt(x.b) + '</b></button>').join('') + '</div>';
  h += '<div class="toolbar"><button class="btn ghost sm" data-act="csvPeople">📄 CSV مانده اشخاص</button><button class="btn ghost sm" data-act="csvInvoices">📄 CSV فاکتورها</button><button class="btn ghost sm" data-act="csvLedger">📄 CSV کل تراکنش‌ها</button></div>';
  return { title: 'گزارش‌ها', html: h, back: '#/more' };
}

/* ─────────── MORE / SETTINGS ─────────── */
function pageMore() {
  const item = (ic, t, h, sub) => '<button class="row" data-act="go" data-h="' + h + '"><span><b>' + ic + ' ' + t + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</span><em>‹</em></button>';
  const open = S.cheques.filter(c => !c.done).length;
  return { title: 'بیشتر', html: '<div class="card flush">' + item('📊', 'گزارش‌ها و سود و زیان', '#/reports') + item('📆', 'چک و اقساط', '#/cheques', open ? fa(open) + ' مورد در انتظار' : '') + item('💸', 'هزینه‌ها', '#/expenses') + item('🧾', 'همه فاکتورها', '#/invoices') + '<button class="row" data-act="transfer"><span><b>↔️ حواله بین اشخاص</b></span><em>‹</em></button>' + item('⚙️', 'تنظیمات و پشتیبان', '#/settings') + '</div>' + aboutCard() + '<p class="hint center">حسابداری فیکس کوییک · نسخه ۱.۴</p>' };
}
function aboutCard() {
  const lnk = (ic, t, s, u) => '<a class="ab-row" href="' + u + '" target="_blank" rel="noopener"><i>' + ic + '</i><span><b>' + t + '</b><small>' + s + '</small></span><em>‹</em></a>';
  return '<div class="card about"><div class="ab-h"><img src="logo.png" alt=""><div><b>پشتیبانی فیکس کوییک</b><small>سؤال یا مشکلی داشتید؟ در واتساپ پیام بدهید؛ در خدمتیم.</small></div></div>' +
    lnk('💬', 'واتساپ پشتیبانی', Core.toFa('09999917199'), 'https://wa.me/989999917199') +
    lnk('📞', 'تماس تلفنی', Core.toFa('09999917199'), 'tel:09999917199') +
    lnk('🌐', 'وب‌سایت', 'fixq.ir', 'https://fixq.ir') +
    lnk('📸', 'اینستاگرام', '@fixq.ir', 'https://instagram.com/fixq.ir') +
    '<div class="ab-f">با مدیریت <b>محمد صادق ربانی</b><small>طراح و صاحب امتیاز برنامه</small></div></div>';
}
function pageSettings() {
  const days = S.settings.lastBackup ? Core.diffDays(S.settings.lastBackup, today()) : null;
  let h = '<form class="card" id="setf"><label class="fld"><span>نام کسب‌وکار (روی گزارش‌ها)</span><input class="inp" name="business" value="' + esc(S.settings.business) + '"></label>' + moneyField('openingCash', S.settings.openingCash, 'موجودی اولیه صندوق/بانک') + '<button class="btn blue" type="submit">ذخیره تنظیمات</button></form>';
  const st = S.settings, th = st.theme || 'auto', ac = st.accent || 'blue', fs = Number(st.fontScale) || 1;
  h += '<div class="card"><div class="ch">🎨 ظاهر برنامه</div><div class="seg">' + [['light', '☀️ روز'], ['dark', '🌙 شب'], ['auto', '📱 خودکار']].map(x => '<button type="button" class="' + (th === x[0] ? 'on' : '') + '" data-act="setTheme" data-v="' + x[0] + '">' + x[1] + '</button>').join('') + '</div><div class="sw">' + Object.keys(ACCENTS).map(k => '<button type="button" title="' + ACCENTS[k][2] + '" class="' + (ac === k ? 'on' : '') + '" style="background:' + ACCENTS[k][0] + '" data-act="setAccent" data-v="' + k + '"></button>').join('') + '</div><div class="fsr"><button type="button" data-act="fontStep" data-v="-1">A−</button><span class="v">اندازه نوشته: ' + fa(Math.round(fs * 100)) + '٪</span><button type="button" data-act="fontStep" data-v="1">A+</button></div><button type="button" class="lnk center" data-act="fontStep" data-v="0">بازگشت به اندازه عادی</button></div>';
  h += '<div class="card"><div class="ch">💾 پشتیبان‌گیری</div><p class="hint">' + (days === null ? 'هنوز پشتیبان نگرفته‌اید.' : 'آخرین پشتیبان: ' + fmtDate(S.settings.lastBackup) + ' (' + fa(days) + ' روز پیش)') + '</p><p class="hint">اطلاعات فقط روی همین گوشی است. با حذف برنامه یا پاک‌کردن اطلاعات مرورگر از بین می‌رود؛ پس مرتب پشتیبان بگیرید و فایل را برای خودتان (مثلاً تلگرام/Drive) بفرستید.</p><div class="row2"><button class="btn green" data-act="backup">دریافت پشتیبان</button><button class="btn ghost" data-act="restore">بازیابی از فایل</button></div><input type="file" id="restore-file" accept=".json,application/json" hidden></div>';
  const au = S.settings.auth || {};
  h += '<div class="card"><div class="ch">👤 حساب کاربری</div><p class="hint">نام کاربری: <b>' + esc(au.user || '') + '</b></p><div class="row2"><button class="btn ghost" data-act="changePass">تغییر رمز</button><button class="btn ghost" data-act="newCode">کد بازیابی جدید</button></div><button class="btn ghost" data-act="logout">🔒 خروج و قفل برنامه</button>' + (isNative() ? '<button class="btn ghost" data-act="toggleBio">' + (S.settings.bio ? '👆 اثر انگشت: فعال (غیرفعال کنم)' : '👆 فعال‌سازی ورود با اثر انگشت') + '</button>' : '') + '</div>';
  h += '<div class="card"><div class="ch">🔎 بررسی سلامت اطلاعات</div><p class="hint">صحت ارتباط تراکنش‌ها، فاکتورها و موجودی انبار را بررسی می‌کند.</p><button class="btn ghost" data-act="audit">اجرای بررسی</button></div>';
  h += '<div class="card"><div class="ch">⚠️ حذف همه اطلاعات</div><button class="btn red" data-act="wipe">پاک‌کردن کامل برنامه</button></div><p class="hint center">تعداد: ' + fa(S.people.length) + ' شخص · ' + fa(S.products.length) + ' کالا · ' + fa(S.invoices.length) + ' فاکتور · ' + fa(S.tx.length) + ' تراکنش</p>';
  return { title: 'تنظیمات', html: h, back: '#/more', mount: () => { $('#setf').onsubmit = async e => { e.preventDefault(); const f = e.target, oc = f.openingCash.value.trim() === '' ? 0 : Core.parseMoney(f.openingCash.value); if (isNaN(oc)) return toast('مبلغ نامعتبر است.', true); S.settings.business = f.business.value.trim(); S.settings.openingCash = oc; await save(); toast('ذخیره شد.'); render(); }; $('#restore-file').onchange = restoreFile; } };
}
async function doBackup() { const ok = await exportFile('fixquick-backup-' + stamp() + '.json', Core.exportJSON(S), 'application/json'); if (ok) { S.settings.lastBackup = today(); await save(); toast('پشتیبان آماده شد.'); render(); } }
async function restoreFile(e) {
  const file = e.target.files[0]; e.target.value = ''; if (!file) return; const text = await file.text(); const r = Core.parseBackup(text); if (!r.ok) return toast(r.error, true);
  const st = r.state; if (!(await confirmBox('اطلاعات فعلی کاملاً با فایل پشتیبان جایگزین می‌شود (' + fa(st.people.length) + ' شخص، ' + fa(st.invoices.length) + ' فاکتور، ' + fa(st.tx.length) + ' تراکنش). ادامه می‌دهید؟', 'جایگزین کن', true))) return;
  try { await kvSet('state_before_restore', JSON.stringify(S)); } catch (x) { /* ignore */ }
  const au0 = S.settings.auth; S = Object.assign(Core.emptyState(), st); if (!S.settings.auth && au0) S.settings.auth = au0; applyAppearance(S.settings); await save(); toast('بازیابی انجام شد.'); goHash('#/home'); render();
}

/* ─────────── PIN lock ─────────── */
async function hashPin(pin, salt) { const data = new TextEncoder().encode(salt + ':' + pin); if (window.crypto && crypto.subtle) { const h = await crypto.subtle.digest('SHA-256', data); return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join(''); } let x = 5381; for (const b of data) x = ((x << 5) + x + b) >>> 0; return 'f' + x; }
function pinPad(title, cb, o) {
  o = o || {}; let v = ''; const sh = sheet(title, '<div class="pin-dots" id="pd"></div><div class="pin-pad">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map(k => k === '' ? '<i></i>' : '<button type="button" data-k="' + k + '">' + (k === '⌫' ? k : fa(k)) + '</button>').join('') + '</div>' + (o.extra || ''), { lock: !!o.lock });
  if (o.lock) { sh.el.classList.add('lock'); sh.q('[data-close]').remove(); }
  const dots = () => sh.q('#pd').innerHTML = [0, 1, 2, 3].map(i => '<span class="' + (i < v.length ? 'on' : '') + '"></span>').join(''); dots();
  sh.el.addEventListener('click', async e => { const b = e.target.closest('[data-k]'); if (!b) return; const k = b.dataset.k; if (k === '⌫') v = v.slice(0, -1); else if (v.length < 4) v += k; dots(); if (v.length === 4) { const res = await cb(v, sh); if (res === false) { v = ''; dots(); sh.q('#pd').classList.add('shake'); setTimeout(() => sh.q('#pd') && sh.q('#pd').classList.remove('shake'), 400); } } });
  return sh;
}
let lockedNow = false;
function showLockLegacy() {
  if (!S.settings.pinHash) return; lockedNow = true;
  pinPad('رمز برنامه را وارد کنید', async v => { if (await hashPin(v, S.settings.pinSalt) === S.settings.pinHash) { lockedNow = false; legacyOk = true; sheetStack.filter(s => s.o.lock).forEach(s => s.close(true)); setTimeout(() => authGate(), 50); return true; } return false; }, { lock: true, extra: '<button class="lnk center" id="forgot">رمز را فراموش کرده‌ام</button>' });
  const fg = $('#forgot'); if (fg) fg.onclick = async () => { alertBox('فراموشی رمز', 'رمز قابل بازیابی نیست. تنها راه، پاک‌کردن اطلاعات برنامه از تنظیمات گوشی (یا حذف و نصب مجدد) و سپس «بازیابی از فایل پشتیبان» است. اگر پشتیبان ندارید اطلاعات از دست می‌رود.'); };
}
function setPin() {
  let first = null; const sh = pinPad('رمز جدید (۴ رقم)', async (v, s) => {
    if (first === null) { first = v; s.q('b').textContent = 'تکرار رمز'; return false; }
    if (v !== first) { first = null; s.q('b').textContent = 'رمز جدید (۴ رقم)'; toast('تکرار رمز یکسان نبود.', true); return false; }
    const salt = String(Math.random()).slice(2); S.settings.pinSalt = salt; S.settings.pinHash = await hashPin(v, salt); await save(); s.close(); toast('رمز فعال شد.'); render(); return true;
  });
}

/* ─────────── actions ─────────── */
const actions = {
  go: d => { goHash(d.h); },
  chip: d => { UI[d.k] = d.v; if (d.k === 'rep' && d.v === 'custom' && !UI.repFrom) { UI.repFrom = Core.periodRange('month').from; UI.repTo = today(); } render(); },
  addPerson: () => personForm(), editPerson: d => personForm(Core.byId(S.people, +d.p)),
  toggleArchived: () => { UI.showArchived = !UI.showArchived; render(); },
  archive: async d => { const p = Core.byId(S.people, +d.p); await done(Core.setArchived(S, p.id, !p.archived), p.archived ? 'فعال شد.' : 'بایگانی شد.'); goHash('#/people'); },
  delPerson: async d => { const p = Core.byId(S.people, +d.p); if (await confirmBox('«' + p.name + '» حذف شود؟', 'حذف', true)) { const r = Core.deletePerson(S, p.id); if (r.ok) { await save(); goHash('#/people'); toast('حذف شد.'); } else toast(r.error, true); } },
  txForm: d => txForm(d.t, +d.p || null), quickTx: d => txForm(d.t, null), txOpen: d => txOpen(+d.id), transfer: d => transferForm(+d.p || null),
  stmtRange: () => { const sh = sheet('بازه صورت‌حساب', '<form id="sr">' + dateField('f', UI.stmtFrom || Core.periodRange('month').from, 'از تاریخ') + dateField('t', UI.stmtTo || today(), 'تا تاریخ') + '<button class="btn blue" type="submit">اعمال</button></form>'); sh.q('#sr').onsubmit = e => { e.preventDefault(); const f = readDate(sh.q('#sr'), 'f'), t = readDate(sh.q('#sr'), 't'); if (!f || !t) return toast('تاریخ نامعتبر است.', true); if (f > t) return toast('تاریخ شروع بعد از پایان است.', true); UI.stmtFrom = f; UI.stmtTo = t; sh.close(); render(); }; },
  stmtClear: () => { UI.stmtFrom = UI.stmtTo = null; render(); },
  shareStmt: d => shareText(Core.statementText(S, +d.p, UI.stmtFrom, UI.stmtTo)),
  csvStmt: async d => { const L = Core.ledger(S, +d.p, UI.stmtFrom, UI.stmtTo); await exportFile('statement-' + stamp() + '.csv', csvFile([['تاریخ', 'شرح', 'اضافه', 'کم', 'مانده']].concat(L.rows.map(r => [Core.isoToJalali(r.tx.date), r.tx.desc, r.debit || '', r.credit || '', r.balance]))), 'text/csv'); },
  newInv: d => { const q = d.p ? '?p=' + d.p : ''; const h = '#/new/' + (d.t || 'sale') + q; goHash(h); },
  pickInvPerson: () => pickList('انتخاب شخص', personItems(), v => { $('#nf [name=pid]').value = v; $('#nf-p').textContent = personName(+v); }, { addNew: 'شخص جدید', onAdd: () => personFormInline() }),
  pickProd: (d, el) => {
    const type = $('#nf [name=type]').value, row = el.closest('.it-row');
    const fill = p => { row.dataset.pid = p.id; el.textContent = p.name; const pr = $('[name=price]', row); if (!pr.value) { const dp = (type === 'sale' || type === 'sale_return') ? p.salePrice : p.buyPrice; if (dp) pr.value = fa(Core.group(dp)); } const stk = Core.replay(S).stock[p.id]; $('.stk', row).textContent = 'موجودی فعلی: ' + Core.fmtQty(stk ? stk.stock : 0) + ' ' + p.unit; calcInvoice(); };
    pickList('انتخاب کالا', Core.productStats(S).map(x => ({ value: x.product.id, label: x.product.name, sub: x.product.sku, right: Core.fmtQty(x.stock) + ' ' + x.product.unit, cls: x.stock <= 0 ? 'debit' : '' })), v => fill(Core.byId(S.products, +v)), { addNew: 'کالای جدید', onAdd: () => productForm(null, { inInvoice: true, onSaved: fill }) });
  },
  bulkProducts: () => bulkProducts(),
  printInv: d => printInvoice(+d.id),
  addRow: () => { addRow(); calcInvoice(); }, rmRow: (d, el) => { if ($$('.it-row').length > 1) { el.closest('.it-row').remove(); calcInvoice(); } },
  payFull: () => { const f = $('#nf'); f.paid.value = fa(Core.group(+f.dataset.total || 0)); calcInvoice(); },
  payInv: d => { const i = Core.byId(S.invoices, +d.id), info = Core.invoiceInfo(S, i); const isRec = i.type === 'sale' || i.type === 'purchase_return'; txForm(isRec ? 'receipt' : 'payment', i.personId); setTimeout(() => { const f = $('#tf'); f.amount.value = fa(Core.group(info.remaining)); f.desc.value = 'تسویه فاکتور ' + fa(i.no); }, 30); },
  shareInv: d => shareText(invoiceText(Core.byId(S.invoices, +d.id))),
  delInv: async d => { const i = Core.byId(S.invoices, +d.id); if (await confirmBox('فاکتور ' + fa(i.no) + ' و همه پرداخت‌های ثبت‌شده‌اش حذف شود؟ اثر آن روی حساب و انبار برگردانده می‌شود.', 'حذف فاکتور', true)) { const r = Core.deleteInvoice(S, i.id); if (r.ok) { await save(); toast('حذف شد.'); goHash('#/invoices'); } else toast(r.error, true); } },
  addProduct: () => productForm(), prodOpen: d => prodOpen(+d.id),
  addCheque: () => chequeForm(),
  chqDone: async d => { const c = Core.byId(S.cheques, +d.id); const sh = sheet('انجام شد', '<p class="msg">' + esc(c.title) + ' — ' + fmt(c.amount) + ' ریال</p>' + (c.personId ? '<button class="btn blue" data-rec>ثبت در حساب ' + esc(personName(c.personId)) + ' (' + (c.direction === 'receive' ? 'دریافت' : 'پرداخت') + ')</button>' : '') + '<button class="btn ghost" data-only>فقط علامت‌گذاری (بدون ثبت در حساب)</button>'); const go = async rec => { sh.close(); await done(Core.completeCheque(S, c.id, rec, today()), 'ثبت شد.'); }; const r = sh.q('[data-rec]'); if (r) r.onclick = () => go(true); sh.q('[data-only]').onclick = () => go(false); },
  chqReopen: async d => { await done(Core.reopenCheque(S, +d.id), 'بازگردانده شد.'); },
  chqDel: async d => { if (await confirmBox('این مورد حذف شود؟', 'حذف', true)) await done(Core.deleteCheque(S, +d.id), 'حذف شد.'); },
  addExpense: () => expenseForm(), expOpen: d => expenseForm(Core.byId(S.expenses, +d.id)),
  repApply: () => { const f = readDate(document, 'rf'), t = readDate(document, 'rt'); if (!f || !t) return toast('تاریخ نامعتبر است.', true); if (f > t) return toast('تاریخ شروع بعد از پایان است.', true); UI.repFrom = f; UI.repTo = t; render(); },
  csvPeople: async () => { const b = Core.balances(S); await exportFile('balances-' + stamp() + '.csv', csvFile([['نام', 'تلفن', 'مانده', 'وضعیت']].concat(S.people.map(p => [p.name, p.phone, Math.abs(b[p.id]), sign(b[p.id])]))), 'text/csv'); },
  csvInvoices: async () => { await exportFile('invoices-' + stamp() + '.csv', csvFile([['شماره', 'نوع', 'شخص', 'تاریخ', 'جمع', 'تخفیف', 'پرداخت‌شده', 'مانده', 'توضیحات / سریال']].concat(S.invoices.map(i => { const n = Core.invoiceInfo(S, i); return [i.no, Core.TYPE_FA[i.type], personName(i.personId), Core.isoToJalali(i.date), n.total, n.discount, n.paid, n.remaining, invNotes(i).join(' | ')]; }))), 'text/csv'); },
  csvLedger: async () => { await exportFile('ledger-' + stamp() + '.csv', csvFile([['تاریخ', 'شخص', 'شرح', 'اضافه', 'کم']].concat(S.tx.slice().sort((a, b) => a.date < b.date ? -1 : 1).map(t => [Core.isoToJalali(t.date), personName(t.personId), t.desc, t.kind === 'debit' ? t.amount : '', t.kind === 'credit' ? t.amount : '']))), 'text/csv'); },
  toggleBio: () => toggleBio(), changePass: () => changePass(), newCode: () => newCode(), logout: () => authGate(),
  backup: () => doBackup(), restore: () => $('#restore-file').click(), setPin: () => setPin(),
  setTheme: async d => { S.settings.theme = d.v; applyAppearance(S.settings); await save(); render(); },
  setAccent: async d => { S.settings.accent = d.v; applyAppearance(S.settings); await save(); render(); },
  fontStep: async d => { const v = Number(d.v); S.settings.fontScale = v === 0 ? 1 : Math.round(Math.min(FS_MAX, Math.max(FS_MIN, (Number(S.settings.fontScale) || 1) + v * 0.1)) * 100) / 100; applyAppearance(S.settings); await save(); render(); },
  audit: () => { const p = Core.audit(S); alertBox('نتیجه بررسی', p.length ? '<b class="debit">' + fa(p.length) + ' مشکل پیدا شد:</b><ul>' + p.slice(0, 10).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '✅ همه‌چیز سالم است. حساب اشخاص، فاکتورها و موجودی انبار کاملاً هماهنگ‌اند.'); },
  wipe: async () => { if (!(await confirmBox('همه اطلاعات برنامه برای همیشه پاک می‌شود. قبلش پشتیبان گرفته‌اید؟', 'ادامه', true))) return; const sh = sheet('تأیید نهایی', '<p class="msg">برای تأیید، کلمه «حذف» را بنویسید.</p><input class="inp" id="wp"><button class="btn red" id="wp-ok">پاک کن</button>'); sh.q('#wp-ok').onclick = async () => { if (sh.q('#wp').value.trim() !== 'حذف') return toast('کلمه تأیید درست نیست.', true); sh.close(); const au = S.settings.auth; S = Core.emptyState(); if (au) S.settings.auth = au; await save(); toast('همه اطلاعات پاک شد.'); goHash('#/home'); render(); }; }
};
function personFormInline() { // quick-add from invoice picker
  const sh = sheet('شخص جدید', '<form id="pq"><label class="fld"><span>نام</span><input class="inp" name="name" autocomplete="off"></label><label class="fld"><span>تلفن</span><input class="inp ltr" name="phone" inputmode="tel"></label><button class="btn blue" type="submit">ذخیره و انتخاب</button></form>');
  sh.q('#pq').onsubmit = async e => { e.preventDefault(); const f = e.target; const r = Core.addPerson(S, { name: f.name.value, phone: f.phone.value }); if (!r.ok) return toast(r.error, true); await save(); sh.close(); $('#nf [name=pid]').value = r.person.id; $('#nf-p').textContent = r.person.name; };
  autoFocus(() => sh.q('[name=name]'));
}

/* ─────────── router / shell ─────────── */
const routes = {
  home: pageHome, people: pagePeople, person: pagePerson, invoices: pageInvoices, inv: pageInvoice, new: (a) => pageNewInvoice(a, Object.fromEntries(new URLSearchParams((location.hash.split('?')[1]) || ''))),
  products: pageProducts, kardex: pageKardex, cheques: pageCheques, expenses: pageExpenses, reports: pageReports, more: pageMore, settings: pageSettings
};
const navMap = { home: 'home', people: 'people', person: 'people', invoices: 'invoices', inv: 'invoices', new: 'invoices', products: 'products', kardex: 'products', more: 'more', cheques: 'more', expenses: 'more', reports: 'more', settings: 'more' };
let lastRoute = '';
function render() {
  const hash = (location.hash || '#/home').split('?')[0]; const [, page, arg] = hash.split('/'); const fn = routes[page] || routes.home;
  let res; try { res = fn(arg); } catch (e) { console.error(e); res = { title: 'خطا', html: '<div class="card"><b class="debit">خطای برنامه</b><p class="hint">' + esc(e.message) + '</p><button class="btn blue" data-act="go" data-h="#/home">بازگشت به خانه</button></div>' }; }
  const main = $('#main'), keep = main.scrollTop, same = lastRoute === hash; main.innerHTML = res.html; main.scrollTop = same ? keep : 0; lastRoute = hash; lastFull = location.hash || '#/home';
  $('#title').textContent = res.title; const bk = $('#back'); bk.hidden = !res.back; bk.dataset.h = res.back || '';
  $$('.nav [data-nav]').forEach(b => b.classList.toggle('on', b.dataset.nav === (navMap[page] || 'home')));
  const fab = $('#fab'); fab.hidden = !res.fab; if (res.fab) { fab.dataset.act = res.fab[0]; fab.textContent = res.fab[1]; fab.dataset.t = (res.fabData && res.fabData.t) || ''; }
  if (res.mount) res.mount();
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return; const fn = actions[b.dataset.act]; if (fn) { e.preventDefault(); fn(b.dataset, b, e); }
});
document.addEventListener('input', e => {
  const i = e.target; const m = { 'people-q': 'peopleQ', 'inv-q': 'invQ', 'prod-q': 'prodQ' }[i.id]; if (!m) return; UI[m] = i.value; const pos = i.selectionStart; render(); const n = $('#' + i.id); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) { /* ignore */ } }
});
let lastFull = '';
window.addEventListener('hashchange', () => { if ((location.hash || '#/home') !== lastFull) render(); }); // ignore duplicate events for the same address (would wipe an open form)

/* ─────────── account: register / login / recovery ─────────── */
/* ── fingerprint (native biometric prompt, Android) ── */
let bioReady = false, bioBusy = false;
const bioPlugin = () => { const P = window.Capacitor && window.Capacitor.Plugins; return isNative() && P ? (P.BiometricAuthNative || P.BiometricAuth || null) : null; };
async function bioAvail() { const b = bioPlugin(); if (!b) return false; try { const r = await b.checkBiometry(); return !!(r && r.isAvailable); } catch (e) { return false; } }
async function bioCheck() { bioReady = !!(S.settings.bio && await bioAvail()); }
async function bioAsk(reason) {
  const b = bioPlugin(); if (!b) return false;
  try { await b.internalAuthenticate({ reason: reason || 'برای ورود به برنامه اثر انگشت خود را بگذارید', cancelTitle: 'استفاده از رمز', allowDeviceCredential: false, androidTitle: 'فیکس کوییک', androidSubtitle: 'ورود با اثر انگشت', androidConfirmationRequired: false }); return true; } catch (e) { return false; }
}
async function bioLogin() {
  if (bioBusy || !lockedNow || !$('#bio')) return; bioBusy = true;
  try { if (await bioAsk()) { authClose(); render(); } } finally { bioBusy = false; }
}
async function offerBio() {
  if (S.settings.bio || S.settings.bioAsked || !(await bioAvail())) return;
  S.settings.bioAsked = true; await save();
  if (await confirmBox('از این به بعد با اثر انگشت وارد برنامه شوید و هر بار رمز نزنید؟', 'فعال‌سازی')) { if (await bioAsk('برای فعال‌سازی، اثر انگشت خود را بگذارید')) { S.settings.bio = true; await save(); toast('ورود با اثر انگشت فعال شد.'); render(); } else toast('فعال نشد. بعداً از تنظیمات می‌توانید فعال کنید.', true); }
}
async function toggleBio() {
  if (S.settings.bio) { S.settings.bio = false; await save(); toast('ورود با اثر انگشت غیرفعال شد.'); render(); return; }
  if (!(await bioAvail())) return toast('اثر انگشتی روی این گوشی فعال نیست. ابتدا در تنظیمات گوشی اثر انگشت اضافه کنید.', true);
  if (await bioAsk('برای فعال‌سازی، اثر انگشت خود را بگذارید')) { S.settings.bio = true; await save(); toast('ورود با اثر انگشت فعال شد.'); render(); } else toast('تأیید نشد.', true);
}

let legacyOk = false, failN = 0, failUntil = 0;
const SEC_QS = ['نام اولین مدرسه‌ی من چه بود؟', 'نام شهر تولد من چیست؟', 'نام بهترین دوست دوران کودکی من؟', 'مدل اولین گوشی من چه بود؟', 'نام حیوان خانگی (یا مورد علاقه) من؟'];
const normAns = s => Core.toEn(String(s || '')).replace(/[\s‌\-]+/g, '').toLowerCase();
const normCode = s => Core.toEn(String(s || '')).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
function genCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', b = new Uint8Array(12); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(b) : b.forEach((_, i) => b[i] = Math.floor(Math.random() * 256)); const s = Array.from(b).map(x => A[x % A.length]).join(''); return s.slice(0, 4) + '-' + s.slice(4, 8) + '-' + s.slice(8, 12); }
const newSalt = () => String(Math.random()).slice(2) + Date.now();
async function mkAuth(user, pass, q, ans, code, old) {
  const a = Object.assign({}, old || {}); a.user = user; if (pass !== null) { a.salt = newSalt(); a.hash = await hashPin(pass, a.salt); }
  if (q !== undefined) { a.q = q; a.asalt = newSalt(); a.ahash = await hashPin(normAns(ans), a.asalt); }
  if (code) { a.rsalt = newSalt(); a.rhash = await hashPin(normCode(code), a.rsalt); }
  return a;
}
function authOverlay(html) {
  let o = $('#auth'); if (!o) { o = document.createElement('div'); o.id = 'auth'; document.body.appendChild(o); }
  o.innerHTML = '<div class="auth-box"><img class="auth-logo" src="logo.png" alt="">' + html + '</div>'; return o;
}
function authClose() { const o = $('#auth'); if (o) o.remove(); lockedNow = false; }
function pwField(name, label, ac) { return '<label class="fld"><span>' + label + '</span><input class="inp ltr" type="password" name="' + name + '" id="pw-' + name + '" autocomplete="' + (ac || 'current-password') + '"></label>'; }
function authGate(relock) {
  if (!S.settings.auth) { if (S.settings.pinHash && !legacyOk) { showLockLegacy(); return; } return authRegister(); }
  lockedNow = true; bioCheck().then(() => { if (lockedNow) authLogin(); });
}
function authRegister() {
  lockedNow = true;
  const o = authOverlay('<h2>ثبت‌نام</h2><p class="hint center">یک نام کاربری و رمز برای ورود به برنامه بسازید. اطلاعات فعلی شما حفظ می‌شود.</p><form id="af"><label class="fld"><span>نام کاربری</span><input class="inp ltr" name="u" id="fq-user" autocomplete="username" autocapitalize="none"></label>' + pwField('p1', 'رمز (حداقل ۶ نویسه)', 'new-password') + pwField('p2', 'تکرار رمز', 'new-password') + '<label class="fld"><span>سؤال امنیتی (برای بازیابی رمز)</span><select class="inp" name="q">' + SEC_QS.map(q => '<option>' + q + '</option>').join('') + '</select></label><label class="fld"><span>پاسخ</span><input class="inp" name="a" autocomplete="off"></label><button class="btn blue" type="submit">ثبت‌نام</button></form>');
  $('#af', o).onsubmit = async e => {
    e.preventDefault(); const f = e.target, u = f.u.value.trim(), p1 = f.p1.value, p2 = f.p2.value, a = f.a.value.trim();
    if (u.length < 3) return toast('نام کاربری حداقل ۳ نویسه باشد.', true);
    if (p1.length < 6) return toast('رمز حداقل ۶ نویسه باشد.', true);
    if (p1 !== p2) return toast('تکرار رمز یکسان نیست.', true);
    if (normAns(a).length < 2) return toast('پاسخ سؤال امنیتی را بنویسید.', true);
    const code = genCode(); S.settings.auth = await mkAuth(u, p1, f.q.value, a, code); delete S.settings.pinHash; delete S.settings.pinSalt; await save();
    showCode(code, () => { authClose(); toast('خوش آمدید.'); render(); offerBio(); });
  };
}
function showCode(code, next) {
  const o = authOverlay('<h2>کد بازیابی شما</h2><p class="hint center">اگر رمز را فراموش کردید، با این کد می‌توانید رمز جدید بسازید. آن را جای امن (عکس صفحه، پیام به خودتان) نگه دارید. این کد دوباره نمایش داده نمی‌شود.</p><div class="rcode">' + code + '</div><div class="row2"><button class="btn ghost" id="cc">کپی / ارسال</button></div><label class="chk"><input type="checkbox" id="sv"> کد را ذخیره کردم</label><button class="btn blue" id="cn">ادامه</button>');
  $('#cc', o).onclick = () => shareText('کد بازیابی فیکس کوییک: ' + code);
  $('#cn', o).onclick = () => { if (!$('#sv', o).checked) return toast('ابتدا کد را ذخیره کنید و تیک را بزنید.', true); next(); };
}
function authLogin() {
  const au = S.settings.auth;
  const o = authOverlay('<h2>ورود</h2><form id="af"><label class="fld"><span>نام کاربری</span><input class="inp ltr" name="u" id="fq-user" value="' + esc(au.user) + '" autocomplete="username" autocapitalize="none"></label>' + pwField('p', 'رمز') + '<button class="btn blue" type="submit">ورود</button></form>' + (bioReady ? '<button class="btn ghost" id="bio" type="button">👆 ورود با اثر انگشت</button>' : '') + '<button class="lnk center" id="fg">رمز را فراموش کرده‌ام</button>');
  $('#af', o).onsubmit = async e => {
    e.preventDefault(); const f = e.target;
    if (Date.now() < failUntil) return toast('چند بار اشتباه زدید؛ ' + fa(Math.ceil((failUntil - Date.now()) / 1000)) + ' ثانیه صبر کنید.', true);
    const ok = f.u.value.trim().toLowerCase() === au.user.toLowerCase() && await hashPin(f.p.value, au.salt) === au.hash;
    if (ok) { failN = 0; authClose(); render(); offerBio(); return; }
    failN++; if (failN >= 5) { failUntil = Date.now() + Math.min(300, 15 * (failN - 4)) * 1000; } toast('نام کاربری یا رمز اشتباه است.', true); f.p.value = '';
  };
  $('#fg', o).onclick = authForgot;
  if (bioReady) { $('#bio', o).onclick = bioLogin; setTimeout(bioLogin, 350); }
}
function authForgot() {
  const au = S.settings.auth;
  const o = authOverlay('<h2>بازیابی رمز</h2><p class="hint center">یکی از دو راه را انتخاب کنید.</p><form id="af"><label class="fld"><span>کد بازیابی (مثل ABCD-EFGH-JKLM)</span><input class="inp ltr" name="c" autocomplete="off"></label><p class="hint center">— یا —</p><div class="hint">' + esc(au.q || '') + '</div><input class="inp" name="a" placeholder="پاسخ سؤال امنیتی" autocomplete="off"><button class="btn blue" type="submit">تأیید</button></form><button class="lnk center" id="bk">بازگشت</button><p class="hint center">اگر هر دو را ندارید، تنها راه، حذف برنامه و نصب دوباره و «بازیابی از فایل پشتیبان» است.</p>');
  $('#bk', o).onclick = authLogin;
  $('#af', o).onsubmit = async e => {
    e.preventDefault(); const f = e.target, c = normCode(f.c.value), a = normAns(f.a.value);
    if (Date.now() < failUntil) return toast('کمی صبر کنید و دوباره تلاش کنید.', true);
    let ok = false;
    if (c && au.rhash && await hashPin(c, au.rsalt) === au.rhash) ok = true;
    else if (!c && a && au.ahash && await hashPin(a, au.asalt) === au.ahash) ok = true;
    if (!ok) { failN++; if (failN >= 5) failUntil = Date.now() + 60e3; return toast('کد یا پاسخ درست نیست.', true); }
    failN = 0; authReset();
  };
}
function authReset() {
  const o = authOverlay('<h2>رمز جدید</h2><form id="af">' + pwField('p1', 'رمز جدید (حداقل ۶ نویسه)', 'new-password') + pwField('p2', 'تکرار رمز', 'new-password') + '<button class="btn blue" type="submit">ذخیره و ورود</button></form>');
  $('#af', o).onsubmit = async e => {
    e.preventDefault(); const f = e.target; if (f.p1.value.length < 6) return toast('رمز حداقل ۶ نویسه باشد.', true); if (f.p1.value !== f.p2.value) return toast('تکرار رمز یکسان نیست.', true);
    const code = genCode(); S.settings.auth = await mkAuth(S.settings.auth.user, f.p1.value, undefined, undefined, code, S.settings.auth); await save();
    showCode(code, () => { authClose(); toast('رمز جدید فعال شد.'); render(); });
  };
}
// ask for the current password before sensitive account changes
function askPass(then) {
  const sh = sheet('رمز فعلی', '<form id="pf">' + pwField('p', 'رمز فعلی را وارد کنید') + '<button class="btn blue" type="submit">تأیید</button></form>');
  sh.q('#pf').onsubmit = async e => { e.preventDefault(); const au = S.settings.auth; if (await hashPin(e.target.p.value, au.salt) !== au.hash) return toast('رمز اشتباه است.', true); sh.close(); then(); };
}
function changePass() {
  askPass(() => { const sh = sheet('تغییر رمز', '<form id="pf">' + pwField('p1', 'رمز جدید (حداقل ۶ نویسه)') + pwField('p2', 'تکرار رمز') + '<button class="btn blue" type="submit">ذخیره</button></form>');
    sh.q('#pf').onsubmit = async e => { e.preventDefault(); const f = e.target; if (f.p1.value.length < 6) return toast('رمز حداقل ۶ نویسه باشد.', true); if (f.p1.value !== f.p2.value) return toast('تکرار رمز یکسان نیست.', true); S.settings.auth = await mkAuth(S.settings.auth.user, f.p1.value, undefined, undefined, null, S.settings.auth); await save(); sh.close(); toast('رمز تغییر کرد.'); }; });
}
function newCode() {
  askPass(async () => { const code = genCode(); S.settings.auth = await mkAuth(S.settings.auth.user, null, undefined, undefined, code, S.settings.auth); await save(); showCode(code, () => { authClose(); toast('کد جدید فعال شد؛ کد قبلی باطل شد.'); }); });
}

async function boot() {
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ignore */ }
  await loadState(); render(); $('#splash').remove();
  authGate();
  let hiddenAt = 0; document.addEventListener('visibilitychange', () => { if (document.hidden) hiddenAt = Date.now(); else if (hiddenAt && Date.now() - hiddenAt > 60e3 && !lockedNow) authGate(true); });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !isNative()) navigator.serviceWorker.register('sw.js').catch(() => { });
}
window.addEventListener('DOMContentLoaded', boot);
