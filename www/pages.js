/* Pages, forms and actions */
'use strict';
const UI = { peopleQ: '', chqQ: '', expenseQ: '', acctQ: '', peopleF: 'all', invQ: '', invF: 'all', prodQ: '', prodCat: '', pickCat: '', stockTab: 'reorder', searchQ: '', chqTab: 'open', rep: 'mtd', repTab: 'sum', repPSort: 'debit_desc', repGSort: 'rev', repPQ: '', limRep: 60, repFrom: null, repTo: null, stmtFrom: null, stmtTo: null, showArchived: false, limPeople: 150, limInv: 100, limProd: 100, limChq: 150, limLedger: 200, limAcct: 150, limExp: 150, acctRange: 'mtd', accView: 'tb', moreRep: 'daily' };
// long lists show the first N rows; «نمایش بیشتر» adds more (keeps phones fast with thousands of records)
function moreBtn(k, shown, total) { return total > shown ? '<button class="btn ghost" data-act="more" data-k="' + k + '">نمایش بیشتر (' + fa(shown) + ' از ' + fa(total) + ')</button>' : ''; }
const today = () => Core.todayISO();
const personName = id => { const p = Core.byId(S.people, id); return p ? p.name : '—'; };
const prodName = id => { const p = Core.byId(S.products, id); return p ? p.name : '—'; };
const unitOf = id => { const p = Core.byId(S.products, id); return p ? p.unit : ''; };
const stat = (label, val, cls, sub) => '<div class="stat"><small>' + label + '</small><b class="' + (cls || '') + '">' + val + '</b>' + (sub ? '<em>' + sub + '</em>' : '') + '</div>';
const empty = (icon, text, btn) => '<div class="empty big"><div class="eic">' + icon + '</div><p>' + text + '</p>' + (btn || '') + '</div>';
const chips = (name, cur, opts) => '<div class="chips">' + opts.map(o => '<button type="button" class="chip' + (cur === o[0] ? ' on' : '') + '" data-act="chip" data-k="' + name + '" data-v="' + o[0] + '">' + o[1] + '</button>').join('') + '</div>';
const vatRateSet = () => { const v = Number(S.settings.vatRate); return v >= 0 && v <= 100 && S.settings.vatRate !== undefined && S.settings.vatRate !== null && S.settings.vatRate !== '' ? v : 10; };
const fyMonth = () => Math.min(12, Math.max(1, +S.settings.fyMonth || 1));
const methodSel = (cur) => '<label class="fld"><span>روش</span><select class="inp" name="method">' + Object.keys(Core.METHODS).map(k => '<option value="' + k + '"' + (k === (cur || 'cash') ? ' selected' : '') + '>' + Core.METHODS[k] + '</option>').join('') + '</select></label>';
const backTo = h => '<button class="back" data-act="go" data-h="' + h + '">‹ بازگشت</button>';

/* ─────────── HOME ─────────── */
function pageHome() {
  const t = today(), hide = homeHidden();
  const days = S.settings.lastBackup ? Core.diffDays(S.settings.lastBackup, t) : null;
  const hasData = S.people.length || S.invoices.length || S.tx.length;
  let h = '';
  h += guideCard();
  if (S.settings.auditIssues > 0 && isAdmin()) h += '<div class="alert warn">' + ico('alert') + 'بررسی خودکار هفتگی ' + fa(S.settings.auditIssues) + ' ناهماهنگی در اطلاعات پیدا کرد. <button class="lnk" data-act="audit">جزئیات</button></div>';
  if (can('backup') && hasData && (days === null || days > 7)) h += '<div class="alert warn">' + ico('save') + (days === null ? 'هنوز پشتیبان نگرفته‌اید.' : 'آخرین پشتیبان ' + fa(days) + ' روز پیش بوده.') + ' <button class="lnk" data-act="saveLocal">ذخیره کن</button></div>';
  h += '<button class="gsbar" data-act="go" data-h="#/search">' + ico('search') + '<span>جستجو یا سؤال: «آیفون ۱۶ از کی خریدیم»…</span></button>';
  // one tap to every everyday job
  const big = [[true, 'newInv', 'sale', 'receipt', 'فروش', 'green'], [can('purchase'), 'newInv', 'purchase', 'cart', 'خرید', 'blue']].filter(x => x[0]);
  const small = [[can('money'), 'quickTx', 'receipt', 'in', 'دریافت'], [can('money'), 'quickTx', 'payment', 'out', 'پرداخت'], [can('money') && feat('cheques'), 'addCheque', '', 'cheque', 'ثبت چک'], [can('money') && feat('cheques'), 'spendChequeHome', '', 'cheque', 'خرج چک'], [can('money') && feat('transfer'), 'transfer', '', 'transfer', 'حواله'], [can('money') && feat('expenses'), 'addExpense', '', 'wallet', 'هزینه'], [true, 'newInv', 'sale_return', 'ret', 'برگشتی']].filter(x => x[0]);
  const btn = (x, cls) => '<button class="hq2 ' + (cls || '') + '" data-act="' + x[1] + '"' + (x[2] ? ' data-t="' + x[2] + '"' : '') + '>' + ico(x[3]) + '<span>' + x[4] + '</span></button>';
  h += '<div class="hact">' + (big.length ? '<div class="hbig">' + big.map(x => btn(x, x[5])).join('') + '</div>' : '') + (small.length ? '<div class="hsmall">' + small.map(x => btn(x)).join('') + '</div>' : '') + '</div>';
  // short summary; numbers can be hidden with the eye
  const n = v => (hide ? '<span class="mask">••••••</span>' : fmt(v));
  const tr = Core.report(S, t, t), sales = S.invoices.filter(i => i.date === t && i.type === 'sale').length, rows = [];
  rows.push(['#/invoices', 'receipt', 'فروش امروز', fa(sales) + ' فاکتور', sales ? n(tr.revenue) : '', '']);
  if (can('cost') && can('reports')) rows.push(['plGo', 'up', 'سود امروز', '', n(tr.net), tr.net < 0 ? 'debit' : tr.net > 0 ? 'credit' : '']);
  if (can('balances')) { const rp = Core.receivablePayable(S); rows.push(['debit', 'in', 'حساب‌های دریافتنی', 'طلب از مشتریان', n(rp.receivable), '']); rows.push(['credit', 'out', 'حساب‌های پرداختنی', 'بدهی به دیگران', n(rp.payable), '']); }
  if (can('reports')) { const c = Core.cashBalance(S); rows.push(['#/accounts', 'wallet', 'موجودی صندوق و بانک', '', n(c), c < 0 ? 'debit' : '']); }
  h += '<div class="card hsum"><div class="ch">' + ico('calendar') + 'خلاصه حساب<button class="eye" data-act="homeHide" aria-label="' + (hide ? 'نمایش مبالغ' : 'پنهان کردن مبالغ') + '">' + ico(hide ? 'eyeoff' : 'eye') + '</button></div>' +
    rows.map(r => '<button class="hrow" ' + (r[0][0] === '#' ? 'data-act="go" data-h="' + r[0] + '"' : r[0] === 'plGo' ? 'data-act="plGo" data-k="today"' : 'data-act="homePeople" data-f="' + r[0] + '"') + '>' + ico(r[1]) + '<span>' + r[2] + (r[3] ? ' <small>' + r[3] + '</small>' : '') + '</span><b class="' + r[5] + '">' + r[4] + '</b></button>').join('') + '</div>';
  // only what needs attention
  const chq = feat('cheques') ? S.cheques.filter(c => !c.done && c.dueDate <= Core.addDays(t, 2)) : [], od = chq.filter(c => c.dueDate < t).length, re = Core.stockInsights(S, t).reorder.length;
  const todo = [];
  if (chq.length) todo.push('<button class="chip warn" data-act="go" data-h="#/cheques">' + ico('clock') + fa(chq.length) + ' چک/قسط تا پس‌فردا' + (od ? ' (' + fa(od) + ' معوق)' : '') + '</button>');
  if (re) todo.push('<button class="chip" data-act="go" data-h="#/stock">' + ico('package') + fa(re) + ' کالا نیاز به سفارش</button>');
  if (todo.length) h += '<div class="chips wrap htodo">' + todo.join('') + '</div>';
  // more shortcuts
  const sc = [[can('backup'), 'saveLocal', '', 'save', 'ذخیره اطلاعات'], [can('reports'), 'go', '#/reports', 'chart', 'گزارش‌ها'], [routeAllowed('vouchers'), 'docGo', 'money', 'file', 'اسناد دریافت و پرداخت'], [routeAllowed('vouchers'), 'docGo', 'all', 'listplus', 'اسناد حسابداری'], [feat('cheques'), 'go', '#/cheques', 'cheque', 'چک‌ها'], [true, 'go', '#/stock', 'up', 'تحلیل انبار'], [can('people'), 'addPerson', '', 'user', 'شخص جدید'], [can('warehouse'), 'addProduct', '', 'package', 'کالای جدید'], [can('purchase'), 'newInv', 'purchase_return', 'ret', 'برگشت از خرید']].filter(x => x[0]);
  h += '<div class="hsc">' + sc.map(x => '<button class="chip" data-act="' + x[1] + '"' + (x[1] === 'go' ? ' data-h="' + x[2] + '"' : x[1] === 'docGo' ? ' data-f="' + x[2] + '"' : x[2] ? ' data-t="' + x[2] + '"' : '') + '>' + ico(x[3]) + x[4] + '</button>').join('') + '</div>';
  const recent = S.invoices.slice().sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id).slice(0, 3);
  if (recent.length) h += '<div class="card flush hrec"><div class="ch">آخرین فاکتورها <button class="lnk" data-act="go" data-h="#/invoices">همه</button></div>' + recent.map(i => invRow(i)).join('') + '</div>';
  if (licExpired()) h = '<div class="alert warn">' + ico('star') + 'اعتبار یک‌ساله نسخه نامحدود تمام شده است. اطلاعات سالم است؛ برای ثبت سند جدید تمدید کنید. <button class="lnk" data-act="activate">تمدید</button></div>' + h;
  else if (licOk && licInfo.exp && licDaysLeft() <= 30) h = '<div class="alert">' + ico('star') + 'اعتبار نسخه نامحدود ' + (licDaysLeft() ? fa(licDaysLeft()) + ' روز دیگر' : 'امروز') + ' تمام می‌شود (' + fmtDate(licInfo.exp) + '). <button class="lnk" data-act="activate">تمدید</button></div>' + h;
  if (!licOk && !licExpired()) { const left = freeLeft(); if (left <= 10) h = '<div class="alert' + (left ? '' : ' warn') + '">' + (left ? ico('star') + fa(left) + ' فاکتور و سند رایگان باقی مانده است.' : ico('star') + 'ثبت رایگان تمام شده است.') + ' <button class="lnk" data-act="activate">نسخه نامحدود</button></div>' + h; }
  const errs = diagLoad(); let seen = 0; try { seen = +localStorage.getItem('fq_err_seen') || 0; } catch (e) { /* ignore */ }
  if (errs.length > seen) h = '<div class="alert warn">' + ico('alert') + 'برنامه با خطا روبه‌رو شده است. لطفاً گزارش را بفرستید تا برطرف شود. <button class="lnk" data-act="reportWa">ارسال گزارش</button> <button class="lnk" data-act="errSeen">بستن</button></div>' + h;
  return { title: S.settings.business || 'حسابداری فیکس کوییک', html: h };
}
function homeHidden() { try { return localStorage.getItem('fq_hide') === '1'; } catch (e) { return false; } }
function invNotes(i) { return [i.note].concat((i.items || []).map(l => l.note)).filter(Boolean); }
const INV_TONE = { sale: 'credit', purchase: 'debit', sale_return: 'ora', purchase_return: 'ora' }; // money in green, out red, returns orange
function invRow(i, q) {
  const hit = q ? (invNotes(i).find(x => matchQ(x, q)) || '') : '';
  const info = Core.invoiceInfo(S, i); const badge = info.remaining === 0 ? '<span class="bd ok">تسویه</span>' : info.paid > 0 ? '<span class="bd mid">مانده ' + fmt(info.remaining) + '</span>' : '<span class="bd no">تسویه نشده</span>';
  return '<button class="row" data-act="go" data-h="#/inv/' + i.id + '"><span><b>' + esc(personName(i.personId)) + '</b><small>' + Core.TYPE_FA[i.type] + ' · شماره ' + fa(i.no) + ' · ' + fmtDate(i.date) + '</small>' + (hit ? '<small class="hit">' + ico('search') + esc(hit) + '</small>' : '') + '</span><span class="end"><em class="' + INV_TONE[i.type] + '">' + fmt(info.total) + '</em>' + badge + '</span></button>';
}

/* ─────────── PEOPLE ─────────── */
function pagePeople() {
  const b = Core.balances(S), rawQ = Core.toEn(UI.peopleQ).trim().toLowerCase(), debtorQuery = /بدهکار/.test(rawQ), creditorQuery = /طلبکار|بستانکار/.test(rawQ), q = rawQ.replace(/بدهکار(?:ان|ها|های)?|طلبکار(?:ان|ها|های)?|بستانکار(?:ان|ها|های)?/g, '').trim();
  let list = S.people.filter(p => UI.showArchived ? p.archived : !p.archived);
  if (q) list = list.filter(p => matchQ(p.name + ' ' + p.phone + ' ' + (p.note || '') + ' ' + (p.code || ''), q));
  if (debtorQuery) list = list.filter(p => b[p.id] > 0); if (creditorQuery) list = list.filter(p => b[p.id] < 0);
  const rg = rangeOf('people'), mv = rg.on ? Core.peopleMoves(S, rg.from, rg.to) : null; if (rg.on) { const at = Core.balancesAt(S, rg.to); Object.keys(b).forEach(k => { b[k] = at[k] || 0; }); list = list.filter(p => mv[p.id]); }
  if (UI.peopleF === 'debit') list = list.filter(p => b[p.id] > 0); else if (UI.peopleF === 'credit') list = list.filter(p => b[p.id] < 0); else if (UI.peopleF === 'zero') list = list.filter(p => !b[p.id]);
  list.sort((x, y) => UI.peopleF === 'debit' ? b[y.id] - b[x.id] : UI.peopleF === 'credit' ? b[x.id] - b[y.id] : (q ? Core.matchScore(y.name + ' ' + (y.code || '') + ' ' + (y.phone || ''), q) - Core.matchScore(x.name + ' ' + (x.code || '') + ' ' + (x.phone || ''), q) : 0) || faCmp(x.name, y.name));
  const rp = rg.on ? Object.values(b).reduce((o, v) => { if (v > 0) o.receivable += v; else o.payable -= v; return o; }, { receivable: 0, payable: 0 }) : Core.receivablePayable(S);
  let h = can('balances') ? '<div class="stats">' + stat('جمع طلب‌های من' + (rg.on ? ' تا ' + fmtDate(rg.to || today()) : ''), fmt(rp.receivable), rp.receivable ? 'debit' : 'zero') + stat('جمع بدهی‌های من' + (rg.on ? ' تا ' + fmtDate(rg.to || today()) : ''), fmt(rp.payable), rp.payable ? 'credit' : 'zero') + '</div>' : '';
  h += '<div class="toolbar ptools"><button class="btn blue sm" data-act="openImport" data-k="people">' + ico('file') + 'ورود فهرست با مانده</button><button class="btn ghost sm" data-act="bulkPeople">' + ico('listplus') + 'افزودن چند شخص</button></div>';
  h += sbox('people-q', 'peopleQ', 'جستجوی نام یا تلفن…', UI.peopleQ) + rangeBar('people') + (rg.on ? '<p class="hint">' + fa(list.length) + ' شخص در این بازه حساب داشته‌اند؛ مانده‌ها تا پایان بازه است.</p>' : '') + chips('peopleF', UI.peopleF, [['all', 'همه'], ['debit', 'طلب من'], ['credit', 'بدهی من'], ['zero', 'تسویه']]);
  h += list.length ? '<div class="card flush">' + list.slice(0, UI.limPeople).map(p => '<button class="row" data-act="go" data-h="#/person/' + p.id + '"><span><b>' + esc(p.name) + '</b><small>' + (mv && can('balances') ? 'گردش بازه: بدهکار ' + fmt(mv[p.id].dr) + ' · بستانکار ' + fmt(mv[p.id].cr) : (esc(p.phone) || '&nbsp;')) + '</small></span><span class="end">' + (can('balances') ? bal(b[p.id]) + '<small>' + (b[p.id] ? sign(b[p.id]) : '') + '</small>' : '') + '</span></button>').join('') + '</div>' + moreBtn('limPeople', Math.min(UI.limPeople, list.length), list.length)
    : empty(ico('users'), q || UI.peopleF !== 'all' ? 'موردی پیدا نشد.' : 'هنوز شخصی ثبت نکرده‌اید.', q ? '' : '<button class="btn blue" data-act="addPerson">+ افزودن شخص</button>');
  if (S.people.some(p => p.archived)) h += '<button class="lnk center" data-act="toggleArchived">' + (UI.showArchived ? 'نمایش فعال‌ها' : 'نمایش بایگانی‌شده‌ها') + '</button>';
  return { title: 'اشخاص', html: h, fab: ['addPerson', '+'] };
}

function bulkPeople() {
  const sh = sheet('افزودن چند شخص یک‌جا', '<form id="bpf"><p class="hint">هر شخص را در یک خط بنویسید. اگر خواستید، شماره موبایل را بعد از نام بنویسید؛ مثلاً «علی رضایی ۰۹۱۲۱۲۳۴۵۶۷». نام‌های تکراری نادیده گرفته می‌شوند.</p><textarea class="inp" name="t" rows="9" style="height:auto;padding:10px" placeholder="رضا احمدی ۰۹۱۲۳۴۵۶۷۸۹&#10;مهدی کریمی&#10;فروشگاه نور"></textarea><button class="btn blue" type="submit">افزودن اشخاص</button></form>');
  sh.q('#bpf').onsubmit = async e => {
    e.preventDefault(); const lines = Array.from(new Set(e.target.t.value.split(/\n/).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean)));
    if (!lines.length) return toast('نامی نوشته نشده است.', true);
    let add = 0, dup = 0;
    for (const ln of lines) { const { name, phone } = splitNamePhone(ln); const r = Core.addPerson(S, { name, phone }); if (r.ok) add++; else dup++; }
    if (add) await save(); sh.close(); toast(fa(add) + ' شخص اضافه شد' + (dup ? ' (' + fa(dup) + ' مورد تکراری بود)' : '') + '.', !add); render();
  };
  autoFocus(() => sh.q('[name=t]'));
}
/* opening list: people with their opening balance, or goods with their opening stock, many at once.
   Typed from paper, pasted from Excel, or read from an xlsx / CSV file; checked on a copy and shown before anything is saved. */
function openingImport(kind) {
  const ppl = kind === 'people', U = UNIT();
  const ex = ppl ? 'علی رضایی بدهکار ۱۲٬۰۰۰٬۰۰۰&#10;فروشگاه نور ۰۹۱۲۱۲۳۴۵۶۷ بستانکار ۵ میلیون&#10;مهدی کریمی ۰' : 'آیفون ۱۳ ۱۲۸ گیگ ۲ ۴۵٬۰۰۰٬۰۰۰&#10;کابل شارژ تایپ‌سی ۲۰ ۱۵۰٬۰۰۰&#10;قاب ژله‌ای ۵۰ ۸۰٬۰۰۰';
  const hint = ppl ? 'هر شخص در یک خط: نام، «بدهکار» یا «بستانکار»، و مبلغ به ' + U + '. موبایل اختیاری است. «بدهکار» یعنی او به شما بدهکار است (طلب شما)؛ «بستانکار» یعنی شما به او بدهکارید.'
    : 'هر کالا در یک خط: نام کالا، تعداد موجودی، و قیمت خرید هر عدد به ' + U + '. اگر کالا از قبل در انبار هست و قیمت خرید دارد، نوشتن قیمت لازم نیست.';
  const sh = sheet(ppl ? 'ورود اشخاص با مانده اول دوره' : 'ورود موجودی اول دوره کالاها', '<p class="hint">' + hint + ' می‌توانید ستون‌ها را از اکسل کپی کنید، یا فایل اکسل (xlsx) یا CSV انتخاب کنید.</p><textarea class="inp" id="oi-t" rows="8" style="height:auto;padding:10px" placeholder="' + ex + '"></textarea><div class="row2"><button type="button" class="btn ghost" id="oi-f">' + ico('folder') + 'انتخاب فایل اکسل</button><button type="button" class="btn blue" id="oi-c">بررسی فهرست</button></div><input type="file" id="oi-file" accept=".xlsx,.csv,.txt,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden><label class="chk"><input type="checkbox" id="oi-new" checked> ' + (ppl ? 'شخصی که در برنامه نیست، ساخته شود' : 'کالایی که در انبار نیست، ساخته شود') + '</label><div id="oi-res"></div>');
  const ta = sh.q('#oi-t'), out = sh.q('#oi-res');
  const decisions = new Map(); // normalized name -> product id to merge into, or null = new product
  const askSimilar = async () => {
    const items = Core.parseOpening(kind, Core.openingRows(ta.value)), seen = new Set(), todo = [];
    for (const it of items) {
      if (it.err || !it.name) continue; const k = Core.norm(it.name);
      if (seen.has(k) || decisions.has(k) || S.products.some(p => Core.norm(p.name) === k)) continue; seen.add(k);
      const c = Core.similarProducts(S, it.name); if (c.length) todo.push({ k, name: it.name, c });
    }
    for (let i = 0; i < todo.length; i++) {
      const t = todo[i];
      const choice = await new Promise(res => {
        let done = false; const fin = v => { if (!done) { done = true; res(v); } };
        const sh2 = sheet('کالای مشابه ' + fa(i + 1) + ' از ' + fa(todo.length), '<p class="hint">«' + esc(t.name) + '» در انبار نیست، اما شبیه این کالاهای موجود است. اگر همان کالاست، موجودی به آن اضافه می‌شود.</p>' + t.c.map((p, j) => '<button type="button" class="btn green" data-j="' + j + '" style="width:100%;margin:4px 0">بله، همان «' + esc(p.name) + '» است</button>').join('') + '<button type="button" class="btn ghost" data-j="new" style="width:100%;margin:4px 0">نه، کالای جدید است</button>', { onClose: () => fin('cancel') });
        sh2.qa('[data-j]').forEach(b => b.onclick = () => { const j = b.dataset.j; fin(j === 'new' ? null : t.c[+j].id); sh2.close(); });
      });
      if (choice === 'cancel') return false;
      decisions.set(t.k, choice);
    }
    return true;
  };
  const copy = () => Object.assign({}, S, { people: S.people.slice(), tx: S.tx.slice(), products: S.products.slice(), adjusts: S.adjusts.slice() });
  const run = () => { const st2 = copy(), items = Core.parseOpening(kind, Core.openingRows(ta.value)); items.forEach(it => { if (!it.err && it.name && decisions.has(Core.norm(it.name))) it.mergeId = decisions.get(Core.norm(it.name)); }); const o = { create: sh.q('#oi-new').checked }; const r = ppl ? Core.importOpeningPeople(st2, items, o) : Core.importOpeningStock(st2, items, o); return { st2, items, r }; };
  const check = async () => {
    if (!ta.value.trim()) { out.innerHTML = ''; return toast('فهرست خالی است.', true); }
    if (!ppl && !(await askSimilar())) return;
    const { items, r } = run(); if (!r.ok) { out.innerHTML = '<div class="alert bad">' + esc(r.error) + '</div>'; return; }
    const n = r.added + r.updated, sum = ppl ? r.rows.reduce((t, x) => t + x.amount * x.kind, 0) : r.rows.reduce((t, x) => t + Math.round(x.qty * x.cost), 0);
    let h = '<div class="card"><div class="ch">' + ico('check') + 'نتیجه بررسی</div><div class="rr"><span>خطوط خوانده‌شده</span><b>' + fa(items.length) + '</b></div><div class="rr"><span>' + (ppl ? 'شخص جدید' : 'کالای جدید') + '</span><b>' + fa(r.added) + '</b></div><div class="rr"><span>' + (ppl ? 'شخص موجود (فقط مانده اضافه می‌شود)' : 'کالای موجود (فقط موجودی اضافه می‌شود)') + '</span><b>' + fa(r.updated) + '</b></div>' + (r.skipped.length ? '<div class="rr"><span>رد شده</span><b class="debit">' + fa(r.skipped.length) + '</b></div>' : '') +
      (ppl ? '<div class="rr"><span>جمع طلب‌ها</span><b class="debit">' + fmt(r.rows.reduce((t, x) => t + (x.kind > 0 ? x.amount : 0), 0)) + '</b></div><div class="rr"><span>جمع بدهی‌ها</span><b class="credit">' + fmt(r.rows.reduce((t, x) => t + (x.kind < 0 ? x.amount : 0), 0)) + '</b></div>' : (can('cost') ? '<div class="rr"><span>ارزش موجودی واردشده</span><b>' + fmt(sum) + '</b></div>' : '')) +
      '<div class="rr"><span>تاریخ ثبت (اول دوره)</span><b>' + fmtDate(r.date) + '</b></div></div>';
    if (r.skipped.length) h += '<div class="card"><div class="ch debit">' + ico('help') + 'این خطوط وارد نمی‌شوند</div>' + r.skipped.slice(0, 100).map(x => '<div class="rr"><span>خط ' + fa(x.line) + ': ' + esc(fa(x.name || '')) + '</span><small class="debit">' + esc(x.why) + '</small></div>').join('') + (r.skipped.length > 100 ? '<p class="hint">و ' + fa(r.skipped.length - 100) + ' خط دیگر…</p>' : '') + '</div>';
    if (n) h += '<div class="card"><div class="ch">' + ico('listplus') + 'این موارد ثبت می‌شوند</div>' + r.rows.slice(0, 150).map(x => '<div class="rr"><span>' + esc(x.name) + (x.isNew ? ' <small class="info">جدید</small>' : '') + '</span><b class="' + (ppl ? (x.kind > 0 ? 'debit' : x.kind < 0 ? 'credit' : 'zero') : '') + '">' + (ppl ? (x.amount ? fmt(x.amount) + ' ' + (x.kind > 0 ? 'بدهکار' : 'بستانکار') : '۰') : Core.fmtQty(x.qty) + (x.qty && can('cost') ? ' × ' + fmt(x.cost) : '')) + '</b></div>').join('') + (r.rows.length > 150 ? '<p class="hint">و ' + fa(r.rows.length - 150) + ' مورد دیگر…</p>' : '') + '</div>';
    h += '<button type="button" class="btn green" id="oi-ok"' + (n ? '' : ' disabled') + '>' + (n ? 'ثبت ' + fa(n) + ' مورد' : 'موردی برای ثبت نیست') + '</button>';
    out.innerHTML = h; const okb = sh.q('#oi-ok'); if (okb) okb.onclick = commit; okb.scrollIntoView({ block: 'nearest' });
  };
  const commit = async () => {
    if (!gate()) return;
    const { st2, r } = run(); if (!r.ok) return toast(r.error, true); if (!(r.added + r.updated)) return toast('موردی برای ثبت نیست.', true);
    if (isLocked(r.date) && Date.now() > unlockUntil) { setTimeout(promptUnlock, 60); return toast('تاریخ اول دوره (' + fmtDate(r.date) + ') در دوره قفل‌شده است.', true); }
    const a0 = Core.audit(S).length, a = Core.audit(st2); if (a.length > a0) return toast('ثبت انجام نشد: ' + a[a.length - 1], true);
    S = st2; Core._pv++; await save(); sh.close(); bumpUsage();
    toast(ppl ? fa(r.added) + ' شخص جدید و مانده ' + fa(r.updated) + ' شخص موجود ثبت شد.' : fa(r.added) + ' کالای جدید و موجودی ' + fa(r.updated) + ' کالای موجود ثبت شد.'); render();
  };
  ta.addEventListener('input', () => { out.innerHTML = ''; }); sh.q('#oi-new').addEventListener('change', () => { out.innerHTML = ''; });
  sh.q('#oi-c').onclick = check; sh.q('#oi-f').onclick = () => sh.q('#oi-file').click();
  sh.q('#oi-file').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { const rows = await Core.readStatementFile(f.name, await f.arrayBuffer()); ta.value = rows.map(r => r.join('\t')).join('\n'); check(); } catch (x) { toast(x.message || String(x), true); } };
  autoFocus(() => ta);
}
function splitNamePhone(ln) {
  const en = Core.toEn(ln), m = en.match(/^(.*?)[\s,،:\-]*((?:\+98|0098|0)?9\d{9})\s*$/);
  if (!m || !m[1].trim()) return { name: ln, phone: '' };
  return { name: ln.slice(0, m[1].length).replace(/[\s,،:\-]+$/, '').trim(), phone: m[2] };
}
function personForm(p) {
  const sh = sheet(p ? 'ویرایش شخص' : 'شخص جدید', '<form id="pf"><label class="fld"><span>نام</span><input class="inp" name="name" value="' + esc(p ? p.name : '') + '" autocomplete="off"></label><label class="fld"><span>کد شخص <small class="hint">(برای جستجوی سریع با کد)</small></span><input class="inp ltr" name="code" value="' + esc(p ? (p.code || '') : Core.nextCode(S, 'person')) + '" autocomplete="off"></label><label class="fld"><span>تلفن</span><input class="inp ltr" name="phone" inputmode="tel" value="' + esc(p ? p.phone : '') + '"></label><label class="fld"><span>توضیحات</span><input class="inp" name="note" value="' + esc(p ? p.note : '') + '"></label>' +
    (p ? '' : '<div class="fld"><span>مانده اول دوره (اختیاری) ' + help('opening') + '</span><div class="row2"><select class="inp" name="obk"><option value="1">او به من بدهکار است (طلب من)</option><option value="-1">من به او بدهکارم (بدهی من)</option></select><input class="inp ltr" name="ob" data-money inputmode="numeric" placeholder="مبلغ" autocomplete="off"></div></div>') +
    '<button class="btn blue" type="submit">ذخیره</button>' + (p ? '' : '<button type="button" class="lnk center" id="pf-list">' + ico('file') + 'چند نفر دارید؟ ورود فهرست اشخاص با مانده یک‌جا</button>') + '</form>');
  const pl = sh.q('#pf-list'); if (pl) { if (!can('people')) pl.remove(); else pl.onclick = () => { sh.close(); openingImport('people'); }; }
  sh.q('#pf').onsubmit = async e => {
    e.preventDefault(); const f = sh.q('#pf'); const d = { name: f.name.value, phone: f.phone.value, note: f.note.value, code: f.code.value };
    if (!p) { const ob = f.ob.value.trim() === '' ? 0 : Core.parseMoney(f.ob.value); if (isNaN(ob)) return toast('مبلغ مانده نامعتبر است.', true); d.opening = ob * (+f.obk.value); d.date = today(); }
    const r = p ? Core.editPerson(S, p.id, d) : Core.addPerson(S, d);
    if (await done(r, 'ذخیره شد.')) { sh.close(); if (!p && r.person) goHash('#/person/' + r.person.id); }
  };
  autoFocus(() => sh.q('[name=name]'));
}

function pagePerson(id) {
  if (UI.ledgerFor !== id) { UI.ledgerFor = id; UI.limLedger = 200; }
  const p = Core.byId(S.people, +id); if (!p) return { title: 'شخص', html: empty(ico('help'), 'شخص پیدا نشد.', backTo('#/people')), back: '#/people' };
  const from = UI.stmtFrom, to = UI.stmtTo, L = Core.ledger(S, p.id, from, to), b = Core.balanceOf(S, p.id);
  let h = '<div class="card hero ' + (b > 0 ? 'd' : b < 0 ? 'c' : '') + '"><small>' + (!can('balances') ? 'مانده حساب' : b > 0 ? 'این شخص به شما بدهکار است' : b < 0 ? 'شما به این شخص بدهکارید' : 'حساب تسویه است') + '</small>' + (can('balances') ? '<b>' + fmt(Math.abs(b)) + ' <i>' + UNIT() + '</i></b>' : '<b>—</b>') + (p.phone ? '<a class="tel" href="tel:' + esc(Core.toEn(p.phone)) + '">' + ico('phone') + esc(p.phone) + '</a>' : '') + (p.note ? '<small>' + esc(p.note) + '</small>' : '') + '</div>';
  h += '<div class="quick four"><button class="q" data-act="txForm" data-t="receipt" data-p="' + p.id + '">' + ico('in') + '<span>دریافت</span></button><button class="q" data-act="txForm" data-t="payment" data-p="' + p.id + '">' + ico('out') + '<span>پرداخت</span></button><button class="q green" data-act="newInv" data-t="sale" data-p="' + p.id + '">' + ico('receipt') + '<span>فروش</span></button><button class="q blue" data-act="newInv" data-t="purchase" data-p="' + p.id + '">' + ico('cart') + '<span>خرید</span></button></div>';
  h += '<div class="quick four">' + (can('money') && feat('cheques') ? '<button class="q" data-act="personChequeReceive" data-p="' + p.id + '">' + ico('cheque') + '<span>دریافت چک</span></button><button class="q" data-act="personChequePay" data-p="' + p.id + '">' + ico('cheque') + '<span>پرداخت چک</span></button>' : '') + '</div>';
  h += '<div class="toolbar"><button class="btn ghost sm" data-act="txForm" data-t="manual" data-p="' + p.id + '">+ ثبت دستی</button><button class="btn ghost sm" data-act="transfer" data-p="' + p.id + '">' + ico('transfer') + 'حواله</button><button class="btn ghost sm" data-act="stmtRange" data-p="' + p.id + '">' + ico('calendar') + 'بازه و PDF</button><button class="btn ghost sm" data-act="shareStmt" data-p="' + p.id + '">' + ico('share') + 'ارسال</button><button class="btn ghost sm" data-act="csvStmt" data-p="' + p.id + '">' + ico('file') + 'CSV</button><button class="btn ghost sm" data-act="editPerson" data-p="' + p.id + '">' + ico('edit') + 'ویرایش</button></div>';
  if (from || to) h += '<div class="alert">بازه: ' + (from ? fmtDate(from) : 'ابتدا') + ' تا ' + (to ? fmtDate(to) : 'انتها') + ' <button class="lnk" data-act="stmtClear">حذف فیلتر</button></div>';
  h += tipBox('ledger');
  h += '<div class="card flush ledger"><div class="lh"><span>تاریخ / شرح</span><span>بدهکار</span><span>بستانکار</span><span>مانده</span></div>';
  if (from && L.carry) h += '<div class="lr muted"><span>مانده از قبل</span><span></span><span></span><span>' + bal(L.carry) + '</span></div>';
  const lrows = L.rows.slice().reverse(), lshow = lrows.slice(0, UI.limLedger);
  h += L.rows.length ? lshow.map(r => '<button class="lr" data-act="txOpen" data-id="' + r.tx.id + '"><span><b>' + esc(fa(r.tx.desc || Core.TYPE_FA[r.tx.type] || 'ثبت دستی')) + '</b><small>' + fmtDate(r.tx.date) + (r.tx.method ? ' · ' + payWhere(r.tx) : '') + '</small></span><span class="debit">' + (r.debit ? fmt(r.debit) : '') + '</span><span class="credit">' + (r.credit ? fmt(r.credit) : '') + '</span><span>' + (can('balances') ? bal(r.balance) : '') + '</span></button>').join('') : '<div class="empty">تراکنشی ثبت نشده است.</div>';
  h += moreBtn('limLedger', lshow.length, lrows.length);
  h += '</div><p class="hint">' + help('ledger') + ' «بدهکار» یعنی طلب شما از او بیشتر شد (مثلاً فروش به او). «بستانکار» یعنی کمتر شد (دریافت پول از او یا خرید از او). مانده «بد» یعنی او بدهکار است و «بس» یعنی شما بدهکارید.</p><div class="toolbar"><button class="btn ghost sm" data-act="archive" data-p="' + p.id + '">' + (p.archived ? ico('restore') + 'فعال‌سازی' : ico('archive') + 'بایگانی') + '</button><button class="btn ghost sm red" data-act="delPerson" data-p="' + p.id + '">' + ico('trash') + 'حذف شخص</button></div>';
  return { title: p.name, html: h, back: '#/people' };
}

/* tx forms */
function txForm(type, personId, tx, pre) {
  const titles = { receipt: 'دریافت از شخص', payment: 'پرداخت به شخص', manual: 'ثبت دستی در حساب' };
  const t = tx ? tx.type : type; const isPay = t === 'receipt' || t === 'payment';
  const sh = sheet(tx ? 'ویرایش تراکنش' : titles[t], '<form id="tf"><label class="fld"><span>شخص</span><button type="button" class="inp pick" id="tf-p">' + esc(personId ? personName(personId) : 'انتخاب شخص…') + '</button></label>' +
    (t === 'manual' ? '<label class="fld"><span>نوع</span><select class="inp" name="kind"><option value="debit">او به من بدهکار شد (طلب من زیاد شود)</option><option value="credit">من به او بدهکار شدم (بدهی من زیاد شود)</option></select></label>' : '') +
    moneyField('amount', tx ? tx.amount : 0, 'مبلغ (' + UNIT() + ')') + (personId && !tx && isPay ? '<button type="button" class="lnk" id="tf-full">تسویه کامل مانده</button>' : '') +
    (isPay ? acctSel(tx ? tx.acct : (pre && pre.acct)) : '') + dateField('date', tx ? tx.date : today()) + '<label class="fld"><span>شرح</span><input class="inp" name="desc" value="' + esc(tx ? tx.desc : '') + '"></label>' +
    (isPay && !tx ? '<div class="receipt-zone"><b>فیش بانکی هوشمند</b><p class="hint">عکس بگیرید، از گالری انتخاب کنید یا متن پیامک بانکی را جای‌گذاری کنید. اطلاعات قبل از ثبت باید تأیید شوند.</p>' +
      '<div class="row2"><button type="button" class="btn ghost" id="tf-camera">📷 گرفتن عکس</button><button type="button" class="btn ghost" id="tf-gallery">🖼 انتخاب از گالری</button></div>' +
      '<input id="tf-camera-file" type="file" accept="image/*" capture="environment" hidden><input id="tf-gallery-file" type="file" accept="image/*" hidden>' +
      '<div id="tf-ocr-status" class="hint" role="status" aria-live="polite"></div><button type="button" class="btn ghost sm" id="tf-persian-ocr">خواندن تکمیلی متن فارسی (کندتر)</button>' +
      '<details class="receipt-manual"><summary>متن فیش یا پیامک بانکی / اصلاح دستی اطلاعات</summary><textarea id="tf-ocr-text" class="inp" rows="5" placeholder="متن پیامک بانکی را اینجا جای‌گذاری کنید یا متن فیش را اصلاح کنید…"></textarea><button type="button" id="tf-ocr-paste" class="btn ghost sm">📋 جای‌گذاری پیامک</button><button type="button" id="tf-ocr-analyze" class="btn ghost sm">بررسی متن فیش یا پیامک</button></details>' +
      '<div id="tf-ocr-review" hidden></div></div>' : '') + '<button class="btn blue" type="submit">ثبت</button></form>');
  const f = sh.q('#tf'); if (tx && f.kind) f.kind.value = tx.kind;
  const setP = id => { personId = id; sh.q('#tf-p').textContent = personName(id); };
  if (tx) sh.q('#tf-p').disabled = true; else sh.q('#tf-p').onclick = () => pickList('انتخاب شخص', personItems(), v => setP(+v));
  const full = sh.q('#tf-full'); if (full) full.onclick = () => { const b = Core.balanceOf(S, personId); if (!b) return toast('مانده صفر است.'); f.amount.value = Core.fmtInput((Math.abs(b))); mwUpdate(f.amount); };
  // The OCR result is a draft only: no transaction is written before the normal form submit.
  let verifiedReceipt = null;
  const review = sh.q('#tf-ocr-review'), status = sh.q('#tf-ocr-status'), rawText = sh.q('#tf-ocr-text');
  if (review) {
    const setStatus = msg => { status.textContent = msg; };
    const analyzeText = text => {
      const r = Core.analyzeBankReceipt(text, S);
      verifiedReceipt = null;
      review.hidden = false;
      review.innerHTML = '<p class="hint">متن تشخیص‌داده‌شده را بررسی کنید. با دکمه زیر فقط فرم تکمیل می‌شود؛ ثبت نهایی جداگانه است.</p>' +
        '<div class="kv"><span>مبلغ</span><b>' + (r.amountRial ? esc(Core.toFa(String(r.amountRial))) + ' ریال' : 'نامشخص') + '</b>' +
        '<span>تاریخ</span><b>' + esc(fa(r.date || 'نامشخص')) + '</b><span>ساعت</span><b>' + esc(fa(r.time || 'نامشخص')) + '</b>' +
        '<span>وضعیت فیش</span><b>' + esc(({pending:'در انتظار / تأییدنشده',registered:'ثبت درخواست، وصول نامشخص',reported_success:'موفق طبق رسید؛ نیازمند تطبیق',unknown:'نامشخص'})[r.status]) + '</b><span>بانک مبدأ</span><b>' + esc(r.sourceBank || 'نامشخص') + '</b><span>بانک مقصد</span><b>' + esc(r.destinationBank || 'نامشخص') + '</b></div>' +
        '<label class="fld"><span>مبلغ فیش (ریال، قابل اصلاح)</span><input class="inp ltr" inputmode="numeric" id="tf-ocr-amount" value="' + esc(r.amountRial || '') + '" placeholder="مثلاً 183000000"></label>' +
        '<label class="fld"><span>تاریخ تراکنش (قابل اصلاح)</span><input class="inp ltr" id="tf-ocr-date" value="' + esc(r.date || '') + '" placeholder="1405/08/21"></label>' +
        '<label class="fld"><span>کد رهگیری (قابل اصلاح)</span><input class="inp ltr" id="tf-ocr-code" value="' + esc(r.trackingCode || '') + '" placeholder="کد رهگیری"></label>' +
        '<label class="fld"><span>ساعت (قابل اصلاح)</span><input class="inp ltr" id="tf-ocr-time" value="' + esc(r.time || '') + '" placeholder="مثلاً 14:05"></label>' +
        '<label class="fld"><span>بانک مبدأ (قابل اصلاح)</span><input class="inp" id="tf-ocr-source" value="' + esc(r.sourceBank || '') + '"></label>' +
        '<label class="fld"><span>بانک مقصد (قابل اصلاح)</span><input class="inp" id="tf-ocr-dest" value="' + esc(r.destinationBank || '') + '"></label>' +
        (r.warnings.length ? '<div class="receipt-warnings">' + r.warnings.map(x => '<p>⚠ ' + esc(x) + '</p>').join('') + '</div>' : '') +
        '<label class="fld"><span><input type="checkbox" id="tf-ocr-settled"> وصول وجه را مستقلاً از حساب مقصد یا گردش حساب تأیید کرده‌ام</span></label>' +
        '<button type="button" class="btn green" id="tf-ocr-apply">تأیید اطلاعات و انتقال به فرم</button>';
      sh.q('#tf-ocr-apply').onclick = () => {
        const trackingCode = Core.toEn(sh.q('#tf-ocr-code').value).replace(/\s/g, '').trim();
        const enteredAmount = Number(Core.toEn(sh.q('#tf-ocr-amount').value).replace(/[,٬،\s]/g, ''));
        if (!Number.isSafeInteger(enteredAmount) || enteredAmount <= 0) return toast('مبلغ ریالی فیش را بررسی کنید.', true);
        // The main form uses the user's configured unit (rial or toman), while OCR always returns rial.
        const formAmount = UNIT() === 'تومان' ? enteredAmount / 10 : enteredAmount;
        if (!Number.isSafeInteger(formAmount)) return toast('مبلغ ریالی به تومان صحیح قابل تبدیل نیست.', true);
        f.amount.value = Core.fmtInput(formAmount); mwUpdate(f.amount);
        const reviewedDate = Core.toEn(sh.q('#tf-ocr-date').value.trim());
        if (!/^(?:1[34]\d{2}|20\d{2})\/(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12]\d|3[01])$/.test(reviewedDate))
          return toast('تاریخ فیش را به شکل 1405/08/21 وارد کنید.', true);
        if (reviewedDate) {
          if (/^1[34]\d{2}\//.test(reviewedDate)) f.date.value = fa(reviewedDate);
          else if (/^20\d{2}\//.test(reviewedDate)) {
            const date = reviewedDate.replace(/\//g, '-');
            try { f.date.value = fa(Core.isoToJalali(date)); } catch (e) { /* user can enter date */ }
          }
        }
        // Don't auto-select bank based on bank name: an owner can have multiple accounts at the same bank.
        // Track code and bank references within the normal transaction description, which is included in backups.
        verifiedReceipt = { trackingCode, status: r.status, independentlySettled: sh.q('#tf-ocr-settled').checked, time: sh.q('#tf-ocr-time').value.trim().slice(0, 12), sourceBank: sh.q('#tf-ocr-source').value.trim().slice(0, 100), destinationBank: sh.q('#tf-ocr-dest').value.trim().slice(0, 100) };
        setStatus('اطلاعات به فرم منتقل شد. حساب بانکی و مبلغ را بررسی کنید و برای ثبت نهایی دکمه «ثبت» را بزنید.');
        review.hidden = true;
      };
    };
    sh.q('#tf-ocr-analyze').onclick = () => analyzeText(rawText.value);
    sh.q('#tf-ocr-paste').onclick = async () => { try { if (!navigator.clipboard || !navigator.clipboard.readText) throw Error('دسترسی کلیپ‌بورد موجود نیست'); const text = await navigator.clipboard.readText(); if (!text.trim()) throw Error('متن کپی‌شده خالی است'); rawText.value = text; rawText.dataset.userEdited = '1'; analyzeText(text); } catch (e) { setStatus('پیامک را کپی کرده و در کادر متن نگه‌دارید و Paste را انتخاب کنید؛ سپس «بررسی متن» را بزنید.'); rawText.focus(); } };
    // Native APK never prewarms WASM. Browser-only builds may initialize in the background.
    if (!ReceiptOCR.nativePlugin()) ReceiptOCR.prewarm();
    let photoRun = 0;
    let selectedPhoto = null;
    const processPhoto = async (input, persianMode = false) => {
      const file = persianMode ? selectedPhoto : (input.files && input.files[0]); if (!persianMode) input.value = ''; if (!file) return;
      selectedPhoto = file;
      const runId = ++photoRun;
      rawText.dataset.userEdited = '0';
      review.hidden = true; verifiedReceipt = null;
      let slowTimer;
      try {
        setStatus('در حال آماده‌سازی و خواندن عکس…');
        // Never leave the user staring at a frozen 0%. If the two-second
        // target is exceeded, expose the manual path while OCR continues.
        slowTimer = setTimeout(() => {
          if (runId !== photoRun || !sh.el.isConnected) return;
          setStatus('پردازش بیشتر از ۲ ثانیه طول کشید. می‌توانید هم‌زمان متن را دستی وارد کنید؛ نتیجه عکس پس از آماده‌شدن نمایش داده می‌شود.');
        }, 2000);
        const result = await (persianMode ? ReceiptOCR.recognize : ReceiptOCR.fastRecognize)(file, (msg, progress) => {
          if (runId !== photoRun || !sh.el.isConnected) return;
          // Initialization is not progress; 0% during model loading is misleading.
          if (msg === 'خواندن متن عکس' && progress > 0) setStatus('در حال خواندن متن فیش… ' + fa(Math.round(progress * 100)) + '٪');
          else if (msg !== 'خواندن متن عکس') setStatus(msg + '…');
        });
        if (runId !== photoRun || !sh.el.isConnected) return;
        if (rawText.dataset.userEdited === '1') {
          setStatus('متن فیش را دستی ویرایش کرده‌اید؛ نتیجه OCR برای جلوگیری از جایگزینی تغییرات شما اعمال نشد.');
          return;
        }
        rawText.value = result.text;
        analyzeText(result.text);
        const parsed = Core.analyzeBankReceipt(result.text, S);
        if (!persianMode && (!parsed.amountRial || !parsed.date || !parsed.trackingCode)) {
          setStatus('موتور سریع لاتین نتوانست فیش فارسی را کامل بخواند. این نتیجه قابل ثبت بدون بررسی نیست. «خواندن تکمیلی متن فارسی» را بزنید یا مبلغ و تاریخ را دستی اصلاح کنید.');
        } else {
          setStatus('خواندن ' + (persianMode ? 'تکمیلی فارسی' : 'سریع عددی') + ' انجام شد. اطلاعات شناسایی‌شده را با تصویر تطبیق دهید.');
        }
      } catch (err) {
        if (runId === photoRun && sh.el.isConnected)
          setStatus('خواندن عکس انجام نشد: ' + (err.message || String(err)) + '؛ می‌توانید OCR فارسی تکمیلی را انتخاب یا اطلاعات را دستی وارد کنید.');
      } finally { clearTimeout(slowTimer); }
    };
    const camera = sh.q('#tf-camera-file'), gallery = sh.q('#tf-gallery-file');
    sh.q('#tf-camera').onclick = () => camera.click();
    sh.q('#tf-gallery').onclick = () => gallery.click();
    camera.onchange = () => processPhoto(camera);
    gallery.onchange = () => processPhoto(gallery);
    sh.q('#tf-persian-ocr').onclick = () => { if (!selectedPhoto) return setStatus('ابتدا عکس فیش را از دوربین یا گالری انتخاب کنید.'); processPhoto(null, true); };
    rawText.oninput = () => { rawText.dataset.userEdited = '1'; verifiedReceipt = null; review.hidden = true; setStatus('متن فیش تغییر کرد؛ دوباره «بررسی متن فیش» را بزنید.'); };
  }
  f.onsubmit = async e => {
    e.preventDefault(); const amount = Core.parseMoney(f.amount.value), date = readDate(f, 'date');
    if (!date) return toast('تاریخ نامعتبر است.', true); if (!amount) return toast('مبلغ را درست وارد کنید.', true);
    if (!tx && !gate()) return;
    if (verifiedReceipt && ['pending','registered','unknown'].includes(verifiedReceipt.status) && !verifiedReceipt.independentlySettled) return toast('وصول این فیش تأیید نشده است. ابتدا گردش حساب مقصد را بررسی کنید.', true);
    if (verifiedReceipt && verifiedReceipt.trackingCode) {
      const duplicate = Core.analyzeBankReceipt('کد رهگیری: ' + verifiedReceipt.trackingCode, S).duplicateCandidates;
      if (duplicate.length && !(await confirmBox('این کد رهگیری قبلاً در ' + fa(duplicate.length) + ' تراکنش ثبت شده است. احتمال ثبت فیش تکراری وجود دارد. باز هم ثبت شود؟', 'با وجود تکراری بودن ثبت کن'))) return;
    }
    if (f.acct && t === 'payment' && !(await cashGuard(+f.acct.value, amount - (tx && tx.acct === +f.acct.value ? tx.amount : 0), date))) return;
    const receiptNote = verifiedReceipt ? [verifiedReceipt.trackingCode ? 'کد رهگیری ' + verifiedReceipt.trackingCode : '', verifiedReceipt.time ? 'ساعت ' + verifiedReceipt.time : '', verifiedReceipt.status ? 'وضعیت فیش ' + verifiedReceipt.status : '', verifiedReceipt.sourceBank ? 'بانک مبدأ ' + verifiedReceipt.sourceBank : '', verifiedReceipt.destinationBank ? 'بانک مقصد ' + verifiedReceipt.destinationBank : ''].filter(Boolean).join(' | ') : '';
    const desc = [f.desc.value.trim() || titles[t], receiptNote].filter(Boolean).join(' | ');
    const r = tx ? Core.editTx(S, tx.id, { amount, date, desc: f.desc.value, kind: f.kind ? f.kind.value : tx.kind, acct: f.acct ? +f.acct.value : null })
      : Core.addTx(S, { personId, type: t, kind: f.kind ? f.kind.value : null, amount, date, desc, acct: f.acct ? +f.acct.value : null, ref: pre && pre.ref || null });
    if (await done(r, 'ثبت شد.')) { if (!tx) bumpUsage(); sh.close(); }
  };
}
function transferForm(fromId, group) {
  const ti = group ? Core.transferInfo(S, group) : null;
  let from = ti ? ti.fromId : (fromId || null), to = ti ? ti.toId : null;
  const sh = sheet(ti ? 'ویرایش حواله' : 'حواله بین دو شخص', '<form id="xf"><label class="fld"><span>از حساب (پرداخت‌کننده)</span><button type="button" class="inp pick" id="xf-a">' + esc(from ? personName(from) : 'انتخاب…') + '</button></label><label class="fld"><span>به حساب (دریافت‌کننده)</span><button type="button" class="inp pick" id="xf-b">' + esc(to ? personName(to) : 'انتخاب…') + '</button></label>' + moneyField('amount', ti ? ti.amount : 0, 'مبلغ') + dateField('date', ti ? ti.date : today()) + '<label class="fld"><span>شرح</span><input class="inp" name="desc" value="' + esc(ti ? ti.desc : '') + '"></label><p class="hint">مبلغ از حساب مبدأ کم و به حساب مقصد اضافه می‌شود.</p><button class="btn blue" type="submit">' + (ti ? 'ذخیره تغییرات' : 'ثبت حواله') + '</button></form>');
  sh.q('#xf-a').onclick = () => pickList('از حساب', personItems(), v => { from = +v; sh.q('#xf-a').textContent = personName(from); });
  sh.q('#xf-b').onclick = () => pickList('به حساب', personItems(), v => { to = +v; sh.q('#xf-b').textContent = personName(to); });
  const f = sh.q('#xf'); f.onsubmit = async e => { e.preventDefault(); const date = readDate(f, 'date'), amount = Core.parseMoney(f.amount.value); if (!date) return toast('تاریخ نامعتبر است.', true); if (!amount) return toast('مبلغ را درست وارد کنید.', true); if (ti) { if (await done(Core.editTransfer(S, group, { fromId: from, toId: to, amount, date, desc: f.desc.value }), 'حواله اصلاح شد.')) sh.close(); return; } if (!gate()) return; if (await done(Core.addTransfer(S, { fromId: from, toId: to, amount, date, desc: f.desc.value }), 'حواله ثبت شد.')) { bumpUsage(); sh.close(); } };
}
function txOpen(id) {
  const t = Core.byId(S.tx, id); if (!t) return;
  if (t.type === 'voucher') return voucherView(t.vch);
  if (t.type === 'chq') return chequeView(t.chq);
  const inv = t.ref ? Core.byId(S.invoices, t.ref) : null;
  const sh = sheet('جزئیات تراکنش', '<div class="kv"><span>شخص</span><b>' + esc(personName(t.personId)) + '</b><span>تاریخ</span><b>' + fmtDate(t.date) + '</b><span>مبلغ</span><b class="' + (t.kind === 'debit' ? 'debit' : 'credit') + '">' + fmt(t.amount) + ' ' + (t.kind === 'debit' ? 'اضافه به حساب او' : 'کم از حساب او') + '</b>' + (t.method ? '<span>روش</span><b>' + payWhere(t) + '</b>' : '') + '<span>شرح</span><b>' + esc(fa(t.desc || '—')) + '</b></div><div class="row2">' + (inv ? '<button class="btn blue" data-go="#/inv/' + inv.id + '">مشاهده فاکتور</button>' : '') + (inv && t.type === 'invoice' ? '<button class="btn ghost" data-go="#/edit/' + inv.id + '">' + ico('edit') + 'ویرایش فاکتور</button>' : '') + (t.type === 'transfer' ? '<button class="btn ghost" data-xedit>' + ico('edit') + 'ویرایش حواله</button>' : '') + (t.type !== 'invoice' && t.type !== 'transfer' ? '<button class="btn ghost" data-edit>' + ico('edit') + 'ویرایش</button>' : '') + (t.type !== 'invoice' ? '<button class="btn red" data-del>' + ico('trash') + 'حذف</button>' : '') + '</div>' + (routeAllowed('vouchers') && (t.type !== 'invoice' || inv) ? '<button class="btn ghost" data-doc>' + ico('file') + (t.type === 'invoice' ? 'سند حسابداری فاکتور' : 'سند حسابداری') + '</button>' : ''));
  const dc = sh.q('[data-doc]'); if (dc) dc.onclick = () => { sh.close(); actions.docOf(t.type === 'invoice' ? { k: 'inv', id: String(inv.id) } : { k: 'tx', id: String(t.id) }); };
  if (!can('edit')) sh.el.querySelectorAll('[data-xedit],[data-edit],[data-del]').forEach(x => x.remove()); if (!can('edit')) sh.el.querySelectorAll('[data-go^="#/edit/"]').forEach(x => x.remove());
  sh.el.querySelectorAll('[data-go]').forEach(g => g.onclick = () => { sh.close(); goHash(g.dataset.go); });
  const xe = sh.q('[data-xedit]'); if (xe) xe.onclick = () => { sh.close(); transferForm(null, t.group); };
  const ed = sh.q('[data-edit]'); if (ed) ed.onclick = () => { sh.close(); txForm(t.type, t.personId, t); };
  const dl = sh.q('[data-del]'); if (dl) dl.onclick = async () => { if (await confirmBox(t.group ? 'هر دو سمت این حواله حذف می‌شود. ادامه می‌دهید؟' : 'این تراکنش حذف شود؟', 'حذف', true)) { sh.close(); await done(Core.deleteTx(S, t.id), 'حذف شد.'); } };
}

/* ─────────── INVOICES ─────────── */
// sorting menu shared by invoices, documents and products
/* date range (از تاریخ … تا تاریخ) for documents, people and goods; kept in UI[key + 'From'] / UI[key + 'To'] */
const rangeOf = key => ({ from: UI[key + 'From'] || null, to: UI[key + 'To'] || null, on: !!(UI[key + 'From'] || UI[key + 'To']) });
function rangeBar(key) {
  const r = rangeOf(key);
  return r.on ? '<div class="pwrap rbar"><button type="button" class="inp pick" data-act="rangeSet" data-k="' + key + '">' + ico('calendar') + ' از ' + (r.from ? fmtDate(r.from) : 'ابتدا') + ' تا ' + (r.to ? fmtDate(r.to) : 'امروز') + '</button><button type="button" class="pclr" data-act="rangeClr" data-k="' + key + '" aria-label="حذف بازه تاریخ">' + ico('x') + '</button></div>'
    : '<button type="button" class="lnk rlnk" data-act="rangeSet" data-k="' + key + '">' + ico('calendar') + 'جستجو در بازه تاریخ</button>';
}
const RANGE_LIM = { doc: ['limDoc', 60], people: ['limPeople', 150], prod: ['limProd', 100] };
function rangeSheet(key) {
  const QK = [['today', 'امروز'], ['yesterday', 'دیروز'], ['week', 'این هفته'], ['mtd', 'این ماه'], ['prevmonth', 'ماه قبل'], ['fytd', 'امسال']];
  const sh = sheet('جستجو در بازه تاریخ', '<div class="chips">' + QK.map(q => '<button type="button" class="chip" data-p="' + q[0] + '">' + q[1] + '</button>').join('') + '</div><form id="rg">' + dateField('rgf', UI[key + 'From'] || Core.periodRange('mtd', today()).from, 'از تاریخ') + dateField('rgt', UI[key + 'To'] || today(), 'تا تاریخ') + '<button class="btn blue" type="submit">اعمال</button></form>');
  const apply = (f, t) => { if (!f || !t) return toast('تاریخ نامعتبر است.', true); if (f > t) return toast('تاریخ شروع بعد از پایان است.', true); UI[key + 'From'] = f; UI[key + 'To'] = t; const l = RANGE_LIM[key]; if (l) UI[l[0]] = l[1]; sh.close(); render(); };
  sh.qa('[data-p]').forEach(b => { b.onclick = () => { const r = Core.periodRange(b.dataset.p, today(), fyMonth()); apply(r.from, r.to > today() ? today() : r.to); }; });
  sh.q('#rg').onsubmit = e => { e.preventDefault(); apply(readDate(sh.q('#rg'), 'rgf'), readDate(sh.q('#rg'), 'rgt')); };
}
// search box with a × that clears it in one tap
function sbox(id, key, ph, val) { return '<div class="pwrap sbox"><input class="inp" id="' + id + '" placeholder="' + ph + '" value="' + esc(val || '') + '" autocomplete="off"><button type="button" class="pclr" data-act="clrQ" data-k="' + key + '" data-id="' + id + '" aria-label="پاک‌کردن جستجو">' + ico('x') + '</button></div>'; }
// date range for a person's statement; the same range is used on the page and in the PDF
function stmtSheet(pid) {
  const sh = sheet('بازه صورت‌حساب', '<form id="sr">' + dateField('f', UI.stmtFrom || Core.periodRange('month').from, 'از تاریخ') + dateField('t', UI.stmtTo || today(), 'تا تاریخ') + '<div class="row2"><button class="btn ghost" type="button" id="sr-ok">اعمال روی صفحه</button><button class="btn blue" type="button" id="sr-pdf">' + ico('file') + 'ساخت PDF</button></div><p class="hint">PDF همین بازه را می‌سازد. برای همه تراکنش‌ها، تاریخ اول را خیلی قدیمی بگذارید.</p></form>');
  const range = () => { const f = readDate(sh.q('#sr'), 'f'), t = readDate(sh.q('#sr'), 't'); if (!f || !t) { toast('تاریخ نامعتبر است.', true); return null; } if (f > t) { toast('تاریخ شروع بعد از پایان است.', true); return null; } return { f, t }; };
  sh.q('#sr-ok').onclick = () => { const r = range(); if (!r) return; UI.stmtFrom = r.f; UI.stmtTo = r.t; sh.close(); render(); };
  sh.q('#sr-pdf').onclick = () => { const r = range(); if (!r) return; UI.stmtFrom = r.f; UI.stmtTo = r.t; const p = Core.byId(S.people, pid); sh.close(); render(); if (p) printStatement(p, r.f, r.t); };
}
function sortSel(key, cur, opts) { return '<label class="sortbar">' + ico('listplus') + '<span>مرتب‌سازی</span><select data-sort="' + key + '">' + opts.map(o => '<option value="' + o[0] + '"' + (o[0] === cur ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></label>'; }
document.addEventListener('change', e => { const t = e.target; if (t instanceof HTMLSelectElement && t.dataset.sort) { UI[t.dataset.sort] = t.value; UI.limInv = 100; UI.limDoc = 60; UI.limProd = 100; render(); } });
let invTC = null;
// search text per invoice object (an edit makes a new object); thrown away only when names of people or goods change
const invTextOf = i => { const k = [S.people, S.people.length, S.products, S.products.length, Core._pv]; if (!invTC || invTC.k.some((x, j) => x !== k[j])) invTC = { k, m: new WeakMap() }; let t = invTC.m.get(i); if (t === undefined) { t = Core.invText(S, i); invTC.m.set(i, t); } return t; };
const INV_SORT = [['new', 'جدیدترین'], ['old', 'قدیمی‌ترین'], ['amt_desc', 'بیشترین مبلغ'], ['amt_asc', 'کمترین مبلغ'], ['rem_desc', 'بیشترین مانده (تسویه نشده)'], ['name', 'نام شخص (الفبا)'], ['no_desc', 'شماره فاکتور (بزرگ به کوچک)'], ['no_asc', 'شماره فاکتور (کوچک به بزرگ)']];
function pageInvoices() {
  const q = UI.invQ.trim(), srt = INV_SORT.some(x => x[0] === UI.invSort) ? UI.invSort : 'new';
  let list = S.invoices.slice();
  if (UI.invF !== 'all') list = list.filter(i => i.type === UI.invF);
  if (q) { const qq = Core.docQuery(q); list = list.filter(i => Core.docMatch(invTextOf(i), qq) || Core.smartInvoiceMatch(S, i, q)); }
  const tot = new Map(), info = i => { let x = tot.get(i); if (!x) { x = Core.invoiceInfo(S, i); tot.set(i, x); } return x; }, num = i => parseInt(Core.toEn(i.no), 10) || 0, byDate = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id);
  const cmp = { new: byDate, old: (a, b) => -byDate(a, b), amt_desc: (a, b) => info(b).total - info(a).total || byDate(a, b), amt_asc: (a, b) => info(a).total - info(b).total || byDate(a, b), rem_desc: (a, b) => info(b).remaining - info(a).remaining || byDate(a, b), name: (a, b) => faCmp(personName(a.personId), personName(b.personId)) || byDate(a, b), no_desc: (a, b) => num(b) - num(a) || byDate(a, b), no_asc: (a, b) => num(a) - num(b) || -byDate(a, b) }[srt];
  list.sort(cmp);
  const sum = list.reduce((s, i) => s + Core.invoiceTotals(i).total, 0);
  let h = sbox('inv-q', 'invQ', 'جستجو: نام، شماره، مبلغ، کالا، IMEI، تاریخ…', UI.invQ) + chips('invF', UI.invF, [['all', 'همه'], ['sale', 'فروش'], ['purchase', 'خرید'], ['sale_return', 'برگشت فروش'], ['purchase_return', 'برگشت خرید']]) + sortSel('invSort', srt, INV_SORT);
  h += list.length ? '<div class="card flush">' + list.slice(0, UI.limInv).map(i => invRow(i, q)).join('') + '</div>' + moreBtn('limInv', Math.min(UI.limInv, list.length), list.length) + '<p class="hint center">' + fa(list.length) + ' فاکتور · جمع: ' + fmt(sum) + ' ' + UNIT() + '</p>' : q ? empty(ico('search'), 'فاکتوری با این کلمه یا عدد پیدا نشد.') : empty(ico('receipt'), 'فاکتوری ثبت نشده است.', '<div class="row2"><button class="btn green" data-act="newInv" data-t="sale">فاکتور فروش</button><button class="btn blue" data-act="newInv" data-t="purchase">فاکتور خرید</button></div>');
  return { title: 'فاکتورها', html: h };
}

function pageInvoice(id) {
  const i = Core.byId(S.invoices, +id); if (!i) return { title: 'فاکتور', html: empty(ico('help'), 'فاکتور پیدا نشد.', backTo('#/invoices')), back: '#/invoices' };
  const info = Core.invoiceInfo(S, i); const pays = S.tx.filter(t => t.ref === i.id && (t.type === 'receipt' || t.type === 'payment'));
  const dirTxt = i.type === 'sale' || i.type === 'purchase_return' ? 'دریافت' : 'پرداخت';
  let h = '<div class="card"><div class="kv"><span>نوع</span><b>' + Core.TYPE_FA[i.type] + '</b><span>شماره</span><b>' + fa(i.no) + '</b><span>شخص</span><b><a data-act="go" data-h="#/person/' + i.personId + '">' + esc(personName(i.personId)) + '</a></b><span>تاریخ</span><b>' + fmtDate(i.date) + '</b>' + (S.warehouses && S.warehouses.length ? '<span>انبار</span><b>' + esc(whName(Core.whOf(S, i))) + '</b>' : '') + (i.note ? '<span>توضیحات</span><b>' + esc(i.note) + '</b>' : '') + '</div></div>';
  h += '<div class="card flush"><div class="lh it"><span>کالا</span><span>تعداد</span><span>قیمت</span><span>جمع</span></div>' + info.lines.map(l => '<div class="lr it"><span><b>' + esc(prodName(l.productId)) + '</b>' + (l.note ? '<small class="sn-t">' + ico('tag') + esc(l.note) + Core.extractSerials(l.note).map(sn => ' <button class="lnk snh" data-act="searchGo" data-q="' + esc(sn) + '">تاریخچه</button>').join('') + '</small>' : '') + '</span><span>' + Core.fmtQty(l.qty) + ' ' + esc(unitOf(l.productId)) + '</span><span>' + fmt(l.price) + '</span><span>' + fmt(l.gross) + '</span></div>').join('') + '</div>';
  h += '<div class="card"><div class="kv"><span>جمع اقلام</span><b>' + fmt(info.sub) + '</b>' + (info.discount ? '<span>تخفیف</span><b class="ora">' + fmt(info.discount) + '</b>' : '') + (info.vat ? '<span>ارزش افزوده (' + fa(info.vatRate) + '٪)</span><b>' + fmt(info.vat) + '</b>' : '') + '<span>جمع نهایی</span><b class="big">' + fmt(info.total) + ' ' + UNIT() + '</b><span></span><small class="mw kvw">' + Core.moneyWords(info.total) + '</small><span>' + (dirTxt === 'دریافت' ? 'دریافت‌شده' : 'پرداخت‌شده') + '</span><b>' + fmt(info.paid) + '</b><span>مانده این فاکتور</span><b class="' + (info.remaining ? 'debit' : 'credit') + '">' + fmt(info.remaining) + '</b></div></div>';
  if (pays.length) h += '<div class="card"><div class="ch">پرداخت‌ها</div>' + pays.map(t => '<button class="row" data-act="txOpen" data-id="' + t.id + '"><span><b>' + fmtDate(t.date) + '</b><small>' + payWhere(t) + '</small></span><em>' + fmt(t.amount) + '</em></button>').join('') + '</div>';
  h += docCard({ inv: i.id });
  h += '<div class="toolbar">' + (info.remaining > 0 ? '<button class="btn blue sm" data-act="payInv" data-id="' + i.id + '">' + (dirTxt === 'دریافت' ? ico('in') + 'ثبت دریافت' : ico('out') + 'ثبت پرداخت') + '</button>' : '') + '<button class="btn ghost sm" data-act="go" data-h="#/edit/' + i.id + '">' + ico('edit') + 'ویرایش</button><button class="btn ghost sm" data-act="shareInv" data-id="' + i.id + '">' + ico('share') + 'ارسال متن</button>' + '<button class="btn ghost sm" data-act="printInv" data-id="' + i.id + '">' + ico('printer') + 'چاپ فاکتور (A5)</button>' + '<button class="btn ghost sm red" data-act="delInv" data-id="' + i.id + '">' + ico('trash') + 'حذف</button></div>';
  return { title: Core.TYPE_FA[i.type] + ' ' + fa(i.no), html: h, back: '#/invoices' };
}
// the user's own name on invoices (settings → user settings); no brand fallback
function sellerName() { return String(S.settings.sellerName || S.settings.business || '').trim(); }
function invoiceText(i) {
  const info = Core.invoiceInfo(S, i);
  const weSell = i.type === 'sale' || i.type === 'sale_return', me = sellerName(), them = personName(i.personId);
  return ['فاکتور ' + Core.TYPE_FA[i.type] + ' شماره ' + fa(i.no), 'فروشنده: ' + ((weSell ? me : them) || '—'), 'خریدار: ' + ((weSell ? them : me) || '—'), 'تاریخ: ' + fmtDate(i.date), ''].concat(info.lines.map(l => '• ' + prodName(l.productId) + ' × ' + Core.fmtQty(l.qty) + ' × ' + fmt(l.price) + ' = ' + fmt(l.gross) + (l.note ? ' (' + l.note + ')' : '')), ['', 'جمع: ' + fmt(info.sub)], info.discount ? ['تخفیف: ' + fmt(info.discount)] : [], info.vat ? ['ارزش افزوده (' + fa(info.vatRate) + '٪): ' + fmt(info.vat)] : [], ['مبلغ نهایی: ' + fmt(info.total) + ' ' + UNIT(), '(به حروف: ' + Core.moneyWords(info.total) + ')', 'پرداخت‌شده: ' + fmt(info.paid), 'مانده: ' + fmt(info.remaining)], ['', '— حسابداری فیکس کوییک' + (licOk ? '' : ' · fixq.ir')]).join('\n');
}

/* new invoice page */
function pageNewInvoice(type, preset) {
  const ed = preset && preset.edit ? preset.edit : null;
  if (ed) type = ed.type;
  if (!Core.TYPE_FA[type]) type = 'sale';
  const personId = ed ? ed.personId : (preset && preset.p ? +preset.p : null);
  const isSaleSide = type === 'sale' || type === 'sale_return';
  const payLabel = type === 'sale' ? 'دریافتی همزمان' : type === 'purchase' ? 'پرداختی همزمان' : type === 'sale_return' ? 'مبلغ بازپرداخت‌شده به مشتری' : 'مبلغ دریافتی از تأمین‌کننده';
  const first = ed ? Core.firstPayment(S, ed.id) : null;
  const vatOn = ed ? (ed.vatRate > 0) : (feat('vat') && S.settings.vatOn !== false), vr = ed && ed.vatRate > 0 ? ed.vatRate : vatRateSet();
  let h = ed ? '<div class="alert">' + ico('edit') + 'در حال ویرایش فاکتور ' + Core.TYPE_FA[type] + ' شماره ' + fa(ed.no) + '. بعد از ذخیره، حساب شخص، انبار و سود و زیان خودکار اصلاح می‌شوند.</div>' : '<div class="chips">' + Object.keys(Core.TYPE_FA).map(k => '<button type="button" class="chip' + (k === type ? ' on' : '') + '" data-act="newInv" data-t="' + k + '"' + (personId ? ' data-p="' + personId + '"' : '') + '>' + Core.TYPE_FA[k] + '</button>').join('') + '</div>';
  h += '<form id="nf" class="card"' + (ed ? ' data-edit="' + ed.id + '"' : '') + '><input type="hidden" name="type" value="' + type + '"><input type="hidden" name="pid" value="' + (personId || '') + '"><input type="hidden" name="vr" value="' + vr + '"><div class="fld"><span>' + (isSaleSide ? 'مشتری' : 'تأمین‌کننده / فروشنده') + '</span><div class="pwrap"><button type="button" class="inp pick" id="nf-p" data-act="pickInvPerson">' + (personId ? esc(personName(personId)) : 'انتخاب شخص…') + '</button><button type="button" class="pclr" id="nf-px" data-act="clrInvPerson" aria-label="حذف شخص انتخاب‌شده"' + (personId ? '' : ' hidden') + '>' + ico('x') + '</button></div></div><div class="row2">' + dateField('date', ed ? ed.date : today()) + '<label class="fld"><span>شماره فاکتور</span><input class="inp ltr" name="no" inputmode="numeric" value="' + fa(ed ? ed.no : Core.nextInvoiceNo(S, type)) + '"></label></div>' +
    (Core.multiWh(S) ? whSel(ed ? Core.whOf(S, ed) : (UI.lastWh != null && Core.whList(S).some(w => w.id === UI.lastWh && !w.archived) ? UI.lastWh : Core.mainWh(S)), 'wh', type === 'purchase' || type === 'sale_return' ? 'ورود به انبار' : 'خروج از انبار') : '') +
    '<div class="ch">اقلام</div><div id="rows"></div><div class="row2"><button type="button" class="btn ghost" data-act="addRow">+ افزودن قلم</button><button type="button" class="btn ghost" data-act="scanInv">' + ico('scan') + 'اسکن کالا</button></div>' +
    '<div class="sumbox"><div class="kv"><span>جمع اقلام</span><b id="s-sub">۰</b></div></div>' + moneyField('discount', ed ? ed.discount : 0, 'تخفیف (' + UNIT() + ')').replace('</span>', ' ' + help('discount') + '</span>') +
    '<label class="chk vatchk"' + (feat('vat') || vatOn ? '' : ' hidden') + '><input type="checkbox" name="vat"' + (vatOn ? ' checked' : '') + '> ارزش افزوده (' + fa(vr) + '٪) ' + help('vat') + '</label><div class="sumbox" id="s-vatbox"><div class="kv"><span>ارزش افزوده</span><b id="s-vat">۰</b></div></div>' +
    '<div class="sumbox"><div class="kv"><span>مبلغ نهایی</span><b class="big" id="s-tot">۰ ' + UNIT() + '</b></div><small class="mw tot" id="s-totw"></small></div>' + moneyField('paid', first ? first.amount : 0, payLabel) + '<div class="row2"><button type="button" class="lnk" data-act="payFull">تسویه کامل</button></div>' + acctSel(first ? first.acct : null) +
    '<div class="kv small"><span>' + ({ sale: 'او هنوز باید به من بدهد', purchase: 'من هنوز باید به او بدهم', sale_return: 'مانده‌ای که باید به او برگردانم', purchase_return: 'مانده‌ای که او باید به من برگرداند' }[type]) + '</span><b id="s-rem">۰</b></div><label class="fld"><span>توضیحات</span><input class="inp" name="note" value="' + esc(ed ? ed.note : '') + '"></label><button class="btn ' + (isSaleSide ? 'green' : 'blue') + '" type="submit" id="nf-save">' + (ed ? 'ذخیره تغییرات فاکتور' : 'ثبت فاکتور ' + Core.TYPE_FA[type]) + '</button></form>';
  return { title: ed ? 'ویرایش فاکتور ' + fa(ed.no) : 'فاکتور ' + Core.TYPE_FA[type], html: h, back: ed ? '#/inv/' + ed.id : '#/invoices', mount: () => {
    if (ed) ed.items.forEach(l => { addRow(); const rows = $$('.it-row'), r = rows[rows.length - 1], pr = Core.byId(S.products, l.productId); r.dataset.pid = l.productId; $('.pick', r).textContent = pr ? pr.name : '—'; $('[name=qty]', r).value = fa(l.qty); $('[name=price]', r).value = Core.fmtInput((l.price)); $('[name=sn]', r).value = l.note || ''; });
    else { addRow(); if (preset && preset.i) String(preset.i).split(',').forEach((x, k) => { const [id, q] = x.split(':'), pr = Core.byId(S.products, +id); if (!pr) return; if (k) addRow(); const rows = $$('.it-row'), r = rows[rows.length - 1]; fillRowProduct(r, pr); if (+q > 0) $('[name=qty]', r).value = fa(+q); }); }
    calcInvoice(); const f = $('#nf'); f.addEventListener('input', calcInvoice); f.addEventListener('change', calcInvoice); f.onsubmit = submitInvoice; } };
}
function addRow() {
  const rows = $('#rows'), d = document.createElement('div'); d.className = 'it-row'; d.dataset.pid = '';
  d.innerHTML = '<button type="button" class="inp pick" data-act="pickProd">انتخاب کالا…</button><small class="hint stk"></small><div class="g3"><label><span>تعداد</span><input class="inp ltr" name="qty" inputmode="decimal" value="' + fa(1) + '"></label><label><span>قیمت واحد</span><input class="inp ltr" name="price" data-money inputmode="numeric" placeholder="۰"></label><label><span>جمع</span><b class="lt">۰</b></label></div><button type="button" class="btn ghost sm snpick" data-act="pickSerial" hidden></button><label class="fld sn"><span>توضیحات / سریال (اختیاری)</span><input class="inp" name="sn" dir="auto" placeholder="مثلاً سریال دستگاه" autocomplete="off"></label><small class="rw"></small><button type="button" class="rm" data-act="rmRow" aria-label="حذف قلم">✕</button>';
  rows.appendChild(d); enhanceMoney(d);
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
  const disc = isNaN(rd.discount) ? 0 : Math.min(rd.discount, sub), vat = f.vat && f.vat.checked ? Math.round((sub - disc) * (+f.vr.value || 0) / 100) : 0, tot = sub - disc + vat, paid = isNaN(rd.paid) ? 0 : rd.paid;
  $('#s-sub').textContent = fmt(sub); $('#s-vat').textContent = fmt(vat); $('#s-vatbox').hidden = !vat; $('#s-tot').textContent = fmt(tot) + ' ' + UNIT(); $('#s-rem').textContent = fmt(tot - paid);
  f.dataset.total = tot;
  rowChecks(rd, sub, disc); $$('.it-row', f).forEach(syncSerialBtn); $$('input[data-money]', f).forEach(mwUpdate); const tw = $('#s-totw'); if (tw) tw.textContent = tot > 0 ? Core.moneyWords(tot) : '';
}
const minMargin = () => (S.settings.minMargin == null ? 5 : +S.settings.minMargin || 0);
// per-row hints: thin or negative margin on sales, invalid IMEI, serial already sold / already in stock
function rowChecks(rd, sub, disc) {
  const f = $('#nf'), type = f.type.value, editId = +f.dataset.edit || 0, out = [];
  $$('.it-row', f).forEach((r, i) => {
    const it = rd.items[i], w = []; if (!it) return;
    if (type === 'sale' && it.productId && it.price > 0) {
      const p = Core.byId(S.products, it.productId), cost = Core.unitCost(S, it.productId, it.note, it.qty) || (p && p.buyPrice) || 0, unit = sub ? it.price * (1 - disc / sub) : it.price;
      if (cost > 0) { const m = Math.round((unit - cost) / unit * 100); if (unit < cost - 0.5) w.push(['bad', 'زیر قیمت خرید' + (can('cost') ? ' (زیان هر عدد ' + fmt(Math.round(cost - unit)) + ')' : '')]); else if (m < minMargin()) w.push(['mid', 'سود کم' + (can('cost') ? ': ' + fa(m) + '٪ (' + fmt(Math.round(unit - cost)) + ' هر عدد)' : '')]); else if (can('cost')) w.push(['ok', 'سود: ' + fa(m) + '٪ (' + fmt(Math.round(unit - cost)) + ' هر عدد)']); }
    }
    if (it.productId && it.price > 0) { const usual = Core.typicalPrice(S, type, it.productId); if (Core.priceOdd(it.price, usual)) w.push(['mid', 'احتمال خطا در قیمت: معمولاً حدود ' + fmt(usual) + ' ' + UNIT()]); }
    if (it.productId && !isNaN(it.qty)) { const sp = Core.serialProblems(S, [it]); if (sp.length) w.push(['bad', sp[0] + ' برای هر دستگاه یک سریال بنویسید (با فاصله جدا کنید).']); }
    Core.extractSerials(it.note).forEach(sn => {
      if (/^\d{15}$/.test(sn) && !Core.luhnOk(sn)) { w.push(['bad', 'IMEI ' + sn + ' معتبر نیست؛ احتمالاً یک رقم اشتباه است.']); out.push('IMEI ' + sn + ' معتبر نیست.'); }
      const sw = Core.serialWarning(S, sn, type, editId); if (sw) { w.push(['bad', sw]); out.push(sw); }
      else if ((type === 'sale' || type === 'purchase_return') && it.productId) { const inStock = Core.serialsInStock(S, it.productId, editId); if (inStock.length && !inStock.some(x => x.serial === sn)) w.push(['mid', 'سریال ' + sn + ' در خریدهای این کالا ثبت نشده؛ از «انتخاب سریال از موجودی» استفاده کنید تا اشتباه تایپی پیش نیاید.']); }
    });
    const el = $('.rw', r); if (el) { el.innerHTML = w.map(x => '<span class="' + x[0] + '">' + esc(x[1]) + '</span>').join(''); }
    r.classList.toggle('warn', w.some(x => x[0] !== 'ok'));
  });
  f.dataset.serialWarn = JSON.stringify(out);
}
async function submitInvoice(e) {
  e.preventDefault(); const f = $('#nf'), rd = readInvoice(); const date = readDate(f, 'date'), editId = +f.dataset.edit || 0;
  if (!f.pid.value) return toast('شخص را انتخاب کنید.', true); if (!date) return toast('تاریخ نامعتبر است.', true); if (rd.bad) return toast(rd.bad, true);
  if (isNaN(rd.discount)) return toast('تخفیف نامعتبر است.', true); if (isNaN(rd.paid)) return toast('مبلغ پرداخت/دریافت نامعتبر است.', true);
  if (!editId && !gate()) return;
  const type = f.type.value;
  const sreq = Core.serialProblems(S, rd.items); if (sreq.length) return toast(sreq[0] + ' برای هر دستگاه سریال یا IMEI را در «توضیحات / سریال» بنویسید.', true);
  if (!editId) { const dup = Core.findDuplicateInvoice(S, { type: f.type.value, personId: +f.pid.value, date, items: rd.items }); if (dup && !(await confirmBox('فاکتوری با همین شخص، همین اقلام و همین تاریخ قبلاً ثبت شده است (فاکتور ' + Core.TYPE_FA[dup.type] + ' شماره ' + fa(dup.no) + ').\nممکن است دو بار ثبت شود. باز هم ثبت شود؟', 'بله، دوباره ثبت کن', true))) return; }
  const sw = JSON.parse(f.dataset.serialWarn || '[]'); if (sw.length && !(await confirmBox('هشدار سریال:\n' + sw.join('\n') + '\nبا این حال ثبت شود؟', 'بله، ثبت کن', true))) return;
  // selling below cost: ask first
  if (type === 'sale') {
    const sub = rd.items.reduce((s, l) => s + Math.round(l.qty * l.price), 0), disc = Math.min(rd.discount || 0, sub), rp = Core.replay(S), low = [];
    rd.items.forEach(l => { const p = Core.byId(S.products, l.productId); if (!p) return; const cost = Core.unitCost(S, p.id, l.note, l.qty) || p.buyPrice || 0; const unit = sub ? l.price * (1 - disc / sub) : l.price; if (cost > 0 && unit < cost - 0.5) low.push('«' + p.name + '»' + (can('cost') ? ': فروش ' + fmt(Math.round(unit)) + ' — خرید ' + fmt(Math.round(cost)) + ' (زیان ' + fmt(Math.round((cost - unit) * l.qty)) + ')' : '')); });
    if (low.length && !(await confirmBox('⚠️ این فروش زیر قیمت خرید است:\n' + low.join('\n') + '\nبا زیان ثبت شود؟', 'بله، ثبت کن', true))) return;
  }
  const d = { type, personId: +f.pid.value, date, no: Core.toEn(f.no.value).trim(), items: rd.items, discount: rd.discount, paid: rd.paid, acct: +f.acct.value, note: f.note.value, vatRate: f.vat.checked ? (+f.vr.value || 0) : 0 };
  if (f.wh) { d.wh = +f.wh.value; UI.lastWh = d.wh; }
  const r = editId ? Core.editInvoice(S, editId, d) : Core.addInvoice(S, d);
  if (!r.ok) return toast(r.error, true);
  S.settings.vatOn = f.vat.checked; if (!editId) bumpUsage(); if (!(await save())) return; toast(editId ? 'تغییرات فاکتور ذخیره شد.' : 'فاکتور ثبت شد.'); goHash('#/inv/' + r.invoice.id);
}

/* ─────────── PRODUCTS ─────────── */
function catChips(cats, cur, total) {
  return '<div class="chips cats">' + [['', 'همه', total]].concat(cats.map(c => [c.cat, c.cat, c.n])).map(o => '<button type="button" class="chip' + (cur === o[0] ? ' on' : '') + '" data-act="chip" data-k="prodCat" data-v="' + esc(o[0]) + '">' + esc(o[1]) + ' <i>' + fa(o[2]) + '</i></button>').join('') + '</div>';
}
// «فقط کالاهای موجود»: one switch shared by the warehouse list and the search page, remembered on this device
function inStockOnly() { if (UI.prodStock == null) { try { UI.prodStock = localStorage.getItem('fq_instock') === '1'; } catch (e) { UI.prodStock = false; } } return UI.prodStock; }
function stockSwitch(info) { const on = inStockOnly(); return '<div class="stkbar"><button type="button" class="stk' + (on ? ' on' : '') + '" data-act="prodStock" role="switch" aria-checked="' + on + '"><i></i>فقط کالاهای موجود</button>' + (info ? '<small>' + info + '</small>' : '') + '</div>'; }
function prodFiltered() {
  const q = UI.prodQ.trim(); let list = S.products;
  if (inStockOnly()) { const stk = Core.replay(S).stock; list = list.filter(p => stk[p.id] && stk[p.id].stock > 0); }
  if (UI.prodCat) list = list.filter(p => Core.catOf(p) === UI.prodCat);
  if (q) {
    // A partial IMEI belongs to an invoice item, not to a product's own name/sku.
    // Include products linked to matching IMEIs, even if that device was already sold.
    const serialIds = Core.serialProductIds(S, q);
    list = list.filter(p => serialIds.has(p.id) || matchQ(p.name + ' ' + p.sku + ' ' + (p.barcode || '') + ' ' + Core.catOf(p), q));
  }
  return list;
}
const PROD_SORT = [['cat', 'دسته‌بندی'], ['name', 'نام (الفبا)'], ['stock_desc', 'بیشترین موجودی'], ['stock_asc', 'کمترین موجودی'], ['value_desc', 'بیشترین ارزش موجودی'], ['sold', 'پرفروش‌ترین'], ['price_desc', 'گران‌ترین (قیمت فروش)'], ['price_asc', 'ارزان‌ترین (قیمت فروش)'], ['new', 'تازه‌ترین کالا']];
function pageProducts() {
  const all = Core.productStats(S), only = inStockOnly(); let cats = Core.categoryCounts(S);
  if (UI.prodCat && !cats.some(c => c.cat === UI.prodCat)) UI.prodCat = '';
  const inS = all.filter(x => x.stock > 0);
  if (only) { const m = {}; inS.forEach(x => { const c = Core.catOf(x.product); m[c] = (m[c] || 0) + 1; }); cats = cats.filter(c => m[c.cat] || c.cat === UI.prodCat).map(c => ({ cat: c.cat, n: m[c.cat] || 0 })); }
  const rgp = rangeOf('prod'), pmv = rgp.on ? Core.productMovesIn(S, rgp.from, rgp.to) : null;
  const keep = new Set(prodFiltered().map(p => p.id)); const st = all.filter(x => keep.has(x.product.id) && (!pmv || pmv[x.product.id]));
  const PS = PROD_SORT.some(x => x[0] === UI.prodSort) ? UI.prodSort : 'cat';
  st.forEach(x => { x.cat = Core.catOf(x.product); }); if (PS !== 'cat') { const sold = PS === 'sold' ? Core.soldQty(S) : null, nm = (a, b) => faCmp(a.product.name, b.product.name); st.sort({ name: nm, stock_desc: (a, b) => b.stock - a.stock || nm(a, b), stock_asc: (a, b) => a.stock - b.stock || nm(a, b), value_desc: (a, b) => b.value - a.value || nm(a, b), price_desc: (a, b) => (b.product.salePrice || 0) - (a.product.salePrice || 0) || nm(a, b), price_asc: (a, b) => (a.product.salePrice || 0) - (b.product.salePrice || 0) || nm(a, b), sold: (a, b) => (sold[b.product.id] || 0) - (sold[a.product.id] || 0) || nm(a, b), new: (a, b) => b.product.id - a.product.id }[PS]); } else if (UI.prodQ.trim()) { const q = UI.prodQ; const serialIds = Core.serialProductIds(S, q); st.forEach(x => { x.qs = serialIds.has(x.product.id) ? 12 : Core.matchScore(x.product.name + ' ' + (x.product.sku || '') + ' ' + x.cat, q); }); st.sort((a, b) => b.qs - a.qs || faCmp(a.product.name, b.product.name)); } else st.sort((a, b) => (UI.prodCat ? 0 : Core.catRank(a.cat) - Core.catRank(b.cat) || faCmp(a.cat, b.cat)) || faCmp(a.product.name, b.product.name));
  let h = '<div class="stats">' + stat('تعداد کالا', fa(all.length), '', fa(cats.length) + ' دسته') + (can('cost') ? stat('ارزش کل انبار', fmt(Core.inventoryValue(S)), '', UNIT()) : stat('دسته‌ها', fa(cats.length))) + '</div>';
  h += '<div class="toolbar ptools"><button class="btn blue sm" data-act="bulkProducts">' + ico('listplus') + 'افزودن چند کالا</button><button class="btn ghost sm" data-act="scanProd">' + ico('scan') + 'اسکن</button><button class="btn ghost sm" data-act="labelsAll">' + ico('qr') + 'برچسب</button><button class="btn ghost sm" data-act="go" data-h="#/stock">' + ico('up') + 'تحلیل انبار</button><button class="btn ghost sm" data-act="whTools">' + ico('archive') + 'پشتیبان و حذف</button><button class="btn ghost sm" data-act="openImport" data-k="stock">' + ico('file') + 'ورود موجودی اول دوره</button></div>';
  h += sbox('prod-q', 'prodQ', 'جستجوی کالا یا دسته…', UI.prodQ) + rangeBar('prod') + (pmv ? '<p class="hint">' + fa(st.length) + ' کالا در این بازه گردش داشته است.</p>' : '') + stockSwitch(only ? fa(inS.length) + ' کالا موجود · جمع ' + Core.fmtQty(Math.round(inS.reduce((t, x) => t + x.stock, 0) * 1000) / 1000) + ' عدد' : fa(inS.length) + ' کالا از ' + fa(all.length) + ' موجودی دارد') + (cats.length ? catChips(cats, UI.prodCat || '', only ? inS.length : all.length) : '') + sortSel('prodSort', PS, PROD_SORT.filter(x => x[0] !== 'value_desc' || can('cost')));
  if (st.length) {
    let last = null, rows = '';
    st.slice(0, UI.limProd).forEach(x => {
      if (!UI.prodCat && PS === 'cat' && !UI.prodQ.trim() && x.cat !== last) { last = x.cat; rows += '<div class="grp">' + esc(x.cat) + '</div>'; }
      rows += '<button class="row" data-act="prodOpen" data-id="' + x.product.id + '"><span><b>' + esc(x.product.name) + '</b><small>' + (pmv ? 'در بازه: فروش ' + Core.fmtQty(pmv[x.product.id].sold) + ' · خرید ' + Core.fmtQty(pmv[x.product.id].bought) + (pmv[x.product.id].adj ? ' · تعدیل ' + Core.fmtQty(pmv[x.product.id].adj) : '') : (x.product.sku ? esc(x.product.sku) + ' · ' : '') + (can('cost') ? 'میانگین خرید: ' + fmt(x.avg) : 'قیمت فروش: ' + fmt(x.product.salePrice))) + '</small></span><span class="end"><em class="' + (x.low ? 'debit' : '') + '">' + Core.fmtQty(x.stock) + ' ' + esc(x.product.unit) + '</em>' + (can('cost') ? '<small>' + fmt(x.value) + '</small>' : '') + '</span></button>';
    });
    h += '<div class="card flush">' + rows + '</div>' + moreBtn('limProd', Math.min(UI.limProd, st.length), st.length);
  } else h += empty(ico('package'), all.length ? (only ? 'کالای موجودی‌داری پیدا نشد.' : 'موردی پیدا نشد.') : 'کالایی ثبت نشده است.', all.length ? '' : '<div class="row2"><button class="btn blue" data-act="addProduct">+ افزودن کالا</button><button class="btn ghost" data-act="prodImport">' + ico('folder') + 'ورود از فایل</button></div>');
  return { title: 'انبار و کالاها', html: h, fab: ['addProduct', '+'] };
}
function productForm(p, o) {
  o = o || {};
  const sh = sheet(p ? 'ویرایش کالا' : o.inInvoice ? 'کالای جدید (به انبار هم اضافه می‌شود)' : 'کالای جدید', '<form id="gf"><label class="fld"><span>نام کالا</span><input class="inp" name="name" value="' + esc(p ? p.name : '') + '" autocomplete="off"></label><div class="row2"><label class="fld"><span>کد کالا</span><input class="inp ltr" name="sku" value="' + esc(p ? p.sku : Core.nextCode(S, 'product')) + '"></label><label class="fld"><span>واحد</span><input class="inp" name="unit" value="' + esc(p ? p.unit : 'عدد') + '"></label></div><label class="fld"><span>دسته‌بندی ' + help('category') + ' <small class="cat-auto">(خودکار از روی نام؛ در صورت نیاز عوض کنید)</small></span><input class="inp" name="cat" list="cat-list" autocomplete="off" value="' + esc(p ? Core.catOf(p) : (o.cat || '')) + '" data-auto="' + (p && p.category ? '0' : '1') + '"><datalist id="cat-list">' + Array.from(new Set(Core.CATS.concat(S.products.map(Core.catOf)))).map(c => '<option value="' + esc(c) + '">').join('') + '</datalist></label><label class="fld"><span>بارکد کارخانه (اختیاری)</span><div class="inrow"><input class="inp ltr" name="barcode" value="' + esc(p ? (p.barcode || '') : (o.barcode || '')) + '" autocomplete="off"><button type="button" class="btn ghost sm" id="gf-scan">' + ico('scan') + '</button></div></label>' + moneyField('salePrice', p ? p.salePrice : 0, 'قیمت فروش پیش‌فرض') + moneyField('buyPrice', p ? p.buyPrice : 0, 'قیمت خرید پیش‌فرض') + (o.inInvoice || (p && !can('warehouse')) ? '' : '<label class="fld"><span>موجودی اولیه (اختیاری)</span><input class="inp ltr" name="openQty" inputmode="decimal" placeholder="۰" autocomplete="off" value="' + (p && Core.openingOf(S, p.id) ? fa(Core.openingOf(S, p.id).qty) : '') + '"></label>' + (p ? '<p class="hint">' + (Core.openingOf(S, p.id) ? 'این کالا ' + fa(Core.openingOf(S, p.id).qty) + ' عدد موجودی اولیه دارد؛ برای اصلاح، عدد را عوض کنید (صفر = حذف موجودی اولیه).' : 'اگر از قبل از این کالا دارید (مثلاً کالایی که با «افزودن چند کالا» یا دسته‌بندی وارد شده)، تعدادش را بنویسید.') + ' موجودی اولیه قبل از همه خرید و فروش‌های این کالا حساب می‌شود.</p>' : '') + (p ? '' : '<p class="hint">اگر همین الان از این کالا دارید، تعدادش را بنویسید. با «قیمت خرید» بالا در انبار ثبت می‌شود و در سود و زیان حساب نمی‌شود. اگر فقط می‌خواهید نام کالا در فهرست باشد، فقط «نام کالا» را بنویسید و بقیه را خالی بگذارید.</p>')) + '<label class="fld"><span>حداقل موجودی (هشدار) ' + help('minstock') + '</span><input class="inp ltr" name="minStock" inputmode="decimal" value="' + fa(p ? p.minStock : 0) + '"></label><label class="chk"><input type="checkbox" name="sreq"' + (p ? (Core.serialRequired(S, p) ? ' checked' : '') : '') + '> سریال‌دار (برای هر عدد، سریال یا IMEI در فاکتور الزامی است) ' + help('serial') + '</label><button class="btn blue" type="submit">ذخیره</button></form>');
  const f = sh.q('#gf'); if (!feat('qr')) sh.q('#gf-scan').remove(); let sreqTouched = !!p; f.sreq.addEventListener('change', () => { sreqTouched = true; }); const syncSreq = () => { if (!sreqTouched) f.sreq.checked = Core.serialAuto(S, f.cat.value.trim() || Core.guessCategory(f.name.value)); }; f.name.addEventListener('input', () => { if (f.cat.dataset.auto === '1') f.cat.value = f.name.value.trim() ? Core.guessCategory(f.name.value) : ''; syncSreq(); }); f.cat.addEventListener('input', syncSreq); f.cat.addEventListener('input', () => { f.cat.dataset.auto = f.cat.value.trim() ? '0' : '1'; }); if (sh.q('#gf-scan')) sh.q('#gf-scan').onclick = () => openScanner({ title: 'اسکن بارکد کالا', onCode: t => { f.barcode.value = t; } }); f.onsubmit = async e => { e.preventDefault(); const d = { name: f.name.value, barcode: f.barcode.value, sku: f.sku.value, unit: f.unit.value, salePrice: Core.parseMoney(f.salePrice.value || '0'), buyPrice: Core.parseMoney(f.buyPrice.value || '0'), minStock: Core.parseNum(f.minStock.value || '0'), category: f.cat.value.trim() }; const autoS = Core.serialAuto(S, d.category || Core.guessCategory(d.name)); d.serialReq = f.sreq.checked === autoS ? null : f.sreq.checked; if (isNaN(d.salePrice) || isNaN(d.buyPrice) || isNaN(d.minStock)) return toast('مقادیر عددی نامعتبر است.', true); const oq = (f.openQty && f.openQty.value.trim() !== '') ? Core.parseNum(f.openQty.value) : 0; if (isNaN(oq) || oq < 0) return toast('موجودی اولیه نامعتبر است.', true); const oc = p && Core.openingOf(S, p.id); if (oq > 0 && !(d.buyPrice > 0) && !(oc && oc.cost > 0)) return toast('برای موجودی اولیه، قیمت خرید را هم وارد کنید.', true); const bakP = p ? Object.assign({}, p) : null; let r = p ? Core.editProduct(S, p.id, d) : Core.addProduct(S, d); if (o.onSaved && r.ok && !p) { await save(); sh.close(); toast('کالا به انبار اضافه شد.'); o.onSaved(r.product); return; } if (r.ok && p && f.openQty && (oq !== (oc ? oc.qty : 0) || (oc && oq > 0 && d.buyPrice > 0 && d.buyPrice !== oc.cost))) { const a = Core.setOpeningStock(S, p.id, oq, d.buyPrice); if (!a.ok) { Object.keys(p).forEach(k => delete p[k]); Object.assign(p, bakP); Core._pv++; toast(a.error, true); return; } }
 if (r.ok && !p && oq > 0) { const a = Core.setOpeningStock(S, r.product.id, oq, d.buyPrice); if (!a.ok) { Core.deleteProduct(S, r.product.id); r = a; } } if (await done(r, 'ذخیره شد.')) sh.close(); };
  autoFocus(() => f.name);
}
function bulkProducts() {
  const sh = sheet('افزودن چند کالا با نام', '<form id="bf"><p class="hint">هر نام کالا را در یک خط بنویسید. فقط نام ثبت می‌شود؛ قیمت و موجودی را بعداً (مثلاً با فاکتور خرید) وارد می‌کنید. هر کالا خودکار در دسته خودش (آیفون، کابل، شارژر، قاب و…) قرار می‌گیرد. نام‌های تکراری نادیده گرفته می‌شوند.</p><textarea class="inp" name="t" rows="8" style="height:auto;padding:10px" placeholder="گوشی سامسونگ A15&#10;کابل شارژ تایپ‌سی&#10;قاب ژله‌ای"></textarea><button class="btn blue" type="submit">افزودن به انبار</button></form>');
  sh.q('#bf').onsubmit = async e => { e.preventDefault(); const names = Array.from(new Set(e.target.t.value.split(/\n/).map(s => s.trim()).filter(Boolean))); if (!names.length) return toast('نامی نوشته نشده است.', true); let add = 0, dup = 0; for (const n of names) { const r = Core.addProduct(S, { name: n }); if (r.ok) add++; else dup++; } if (add) await save(); sh.close(); toast(fa(add) + ' کالا اضافه شد و در دسته خودش قرار گرفت' + (dup ? ' (' + fa(dup) + ' مورد تکراری بود)' : '') + '.', !add); render(); };
  autoFocus(() => sh.q('[name=t]'));
}
function labelSheet(list) {
  const one = list.length === 1;
  const sh = sheet('چاپ برچسب کیو آر', '<form id="lf"><p class="hint">برگه A4 با ۲۴ برچسب (۷۰ × ۳۷ میلی‌متر، اندازه برگه‌های برچسب آماده). ' + (one ? '' : fa(list.length) + ' کالا انتخاب شده است.') + '</p><label class="fld"><span>' + (one ? 'تعداد برچسب' : 'تعداد برچسب از هر کالا') + '</span><input class="inp ltr" name="n" inputmode="numeric" value="' + fa(one ? 24 : 1) + '"></label><label class="chk"><input type="checkbox" name="price" checked> قیمت فروش روی برچسب باشد</label><label class="chk"><input type="checkbox" name="guides"> خط برش دور برچسب‌ها (برای کاغذ معمولی)</label><button class="btn blue" type="submit">ساخت فایل چاپ</button></form>');
  sh.q('#lf').onsubmit = e => { e.preventDefault(); const f = e.target, n = Core.parseNum(f.n.value); if (!(n >= 1 && n <= 480)) return toast('تعداد نامعتبر است.', true); sh.close(); printLabels(list, Math.round(n), { price: f.price.checked, guides: f.guides.checked }); };
}
function prodOpen(id) {
  const x = Core.productStats(S).find(s => s.product.id === id); if (!x) return; const p = x.product;
  const sh = sheet(p.name, '<div class="qrbox"><div id="pq-qr"></div><div><b>کیو آر کد کالا</b><small>برای ثبت سریع در فاکتور، این کد را روی کالا بچسبانید و اسکن کنید.</small>' + (p.barcode ? '<small class="ltr">بارکد: ' + esc(p.barcode) + '</small>' : '') + '<button class="btn ghost sm" data-l>' + ico('qr') + 'چاپ برچسب</button></div></div><div class="kv"><span>دسته</span><b>' + esc(Core.catOf(p)) + '</b><span>موجودی</span><b>' + Core.fmtQty(x.stock) + ' ' + esc(p.unit) + '</b>' + (can('cost') ? '<span>میانگین قیمت خرید</span><b>' + fmt(x.avg) + '</b><span>ارزش موجودی</span><b>' + fmt(x.value) + '</b>' : '') + '<span>قیمت فروش پیش‌فرض</span><b>' + fmt(p.salePrice) + '</b></div><div class="row2"><button class="btn blue" data-k>' + ico('book') + 'کاردکس</button><button class="btn ghost" data-a>' + ico('scale') + 'تعدیل موجودی</button><button class="btn ghost" data-e>' + ico('edit') + 'ویرایش</button><button class="btn red" data-d>' + ico('trash') + 'حذف</button></div>');
  if (!feat('qr')) { const qb = sh.q('.qrbox'); if (qb) qb.remove(); }
  if (Core.multiWh(S)) { const Q = Core.whStock(S), box = document.createElement('div'); box.className = 'card'; box.innerHTML = '<div class="ch">' + ico('package') + 'موجودی در هر انبار</div>' + Core.whList(S).filter(w => !w.archived || (Q[w.id] || {})[p.id]).map(w => '<div class="rr"><span>' + esc(w.name) + '</span><b>' + Core.fmtQty((Q[w.id] || {})[p.id] || 0) + '</b></div>').join(''); sh.q('.kv').after(box); }
  const sns = Core.serialsInStock(S, p.id); if (sns.length) { const box = document.createElement('div'); box.className = 'card snbox'; box.innerHTML = '<div class="ch">' + ico('tag') + 'سریال‌های موجود در انبار (' + fa(sns.length) + ')</div>' + sns.slice(0, 30).map(x => '<button type="button" class="rr" data-act="searchGo" data-q="' + esc(x.serial) + '"><span class="ltr">' + esc(x.serial) + '</span><small>' + fmtDate(x.date) + '</small></button>').join(''); sh.q('.kv').after(box); box.addEventListener('click', () => sh.close(true)); }
  const qc = feat('qr') ? qrCanvas(prodQrText(p), 220) : null; if (qc) { qc.style.width = '110px'; qc.style.height = '110px'; sh.q('#pq-qr').appendChild(qc); }
  if (!can('cost')) sh.q('[data-k]').remove(); if (!can('warehouse')) ['[data-a]', '[data-e]', '[data-d]'].forEach(k => sh.q(k).remove());
  if (sh.q('[data-l]')) sh.q('[data-l]').onclick = () => labelSheet([p]);
  if (sh.q('[data-k]')) sh.q('[data-k]').onclick = () => { sh.close(); goHash('#/kardex/' + p.id); }; if (sh.q('[data-a]')) { sh.q('[data-a]').onclick = () => { sh.close(); adjustForm(p); }; sh.q('[data-e]').onclick = () => { sh.close(); productForm(p); }; }
  if (sh.q('[data-d]')) sh.q('[data-d]').onclick = async () => { if (await confirmBox('کالای «' + p.name + '» حذف شود؟', 'حذف', true)) { sh.close(); await done(Core.deleteProduct(S, p.id), 'حذف شد.'); } };
}
function adjustForm(p) {
  const sh = sheet('تعدیل موجودی: ' + p.name, '<form id="af"><p class="hint">برای کم‌کردن موجودی (ضایعات، شمارش انبار) علامت منفی بگذارید؛ مثلاً ‎-۲‎. مقدار مثبت به موجودی اضافه می‌کند.</p><label class="fld"><span>مقدار تعدیل</span><input class="inp ltr" name="qty" inputmode="decimal" placeholder="-۲ یا ۵"></label>' + moneyField('cost', 0, 'قیمت واحد (فقط برای افزایش، اختیاری)') + dateField('date', today()) + (Core.multiWh(S) ? whSel(Core.mainWh(S), 'wh', 'انبار') : '') + '<label class="fld"><span>علت</span><input class="inp" name="note"></label><label class="hint"><input type="checkbox" name="opening"> موجودی اولیه است (در سود و زیان حساب نشود)</label><button class="btn blue" type="submit">ثبت تعدیل</button></form>');
  const f = sh.q('#af'); f.onsubmit = async e => { e.preventDefault(); const q = Core.parseNum(f.qty.value.replace(/[−–]/g, '-')), date = readDate(f, 'date'); if (isNaN(q) || !q) return toast('مقدار نامعتبر است.', true); if (!date) return toast('تاریخ نامعتبر است.', true); if (await done(Core.addAdjust(S, { productId: p.id, qty: q, cost: Core.parseMoney(f.cost.value || '0') || 0, date, note: f.note.value, opening: f.opening.checked, wh: f.wh ? +f.wh.value : undefined }), 'تعدیل ثبت شد.')) sh.close(); };
}
function pageKardex(id) {
  const p = Core.byId(S.products, +id); if (!p) return { title: 'کاردکس', html: empty(ico('help'), 'کالا پیدا نشد.'), back: '#/products' };
  const mv = Core.productMoves(S, p.id);
  let h = '<div class="card flush"><div class="lh it"><span>شرح</span><span>ورود</span><span>خروج</span><span>موجودی</span></div>' + (mv.length ? mv.slice().reverse().map(m => '<div class="lr it"><span><b>' + esc(fa(m.label)) + '</b><small>' + fmtDate(m.date) + '</small></span><span class="credit">' + (m.delta > 0 ? Core.fmtQty(m.delta) : '') + '</span><span class="debit">' + (m.delta < 0 ? Core.fmtQty(-m.delta) : '') + '</span><span>' + Core.fmtQty(m.stock) + '</span></div>').join('') : '<div class="empty">حرکتی ثبت نشده است.</div>') + '</div>';
  return { title: 'کاردکس: ' + p.name, html: h, back: '#/products' };
}

/* ─────────── CHEQUES ─────────── */
/* ── warehouse analysis: what to reorder, what is not selling ── */
function pageStock() {
  const tab = UI.stockTab || 'reorder', t = today(), ins = Core.stockInsights(S, t);
  const wk = r => { const w = r * 7; return w >= 1 ? fa(Math.round(w)) : w > 0 ? 'کمتر از ۱' : '۰'; };
  let h = '<div class="stats">' + stat('نیاز به سفارش', fa(ins.reorder.length), ins.reorder.length ? 'debit' : 'zero', 'کالا') + stat('کالای راکد', fa(ins.stale.length), ins.stale.length ? 'debit' : 'zero', can('cost') ? 'سرمایه خوابیده: ' + fmt(ins.staleValue) : 'کالا') + '</div>';
  h += chips('stockTab', tab, [['reorder', 'پیشنهاد سفارش'], ['stale', 'کالاهای راکد']]);
  if (tab === 'reorder') {
    h += '<p class="hint">' + help('reorder') + ' بر اساس فروش ۶۰ روز گذشته: کالاهایی که کمتر از یک هفته دیگر تمام می‌شوند یا به حداقل موجودی رسیده‌اند. مقدار پیشنهادی برای حدود ۳۰ روز فروش است.</p>';
    h += ins.reorder.length ? '<div class="card flush">' + ins.reorder.slice(0, 300).map(x => '<button class="row" data-act="prodOpen" data-id="' + x.product.id + '"><span><b>' + esc(x.product.name) + '</b><small>موجودی ' + Core.fmtQty(x.stock) + ' · فروش هفتگی حدود ' + wk(x.rate) + ' · ' + (x.stock <= 0 ? '<span class="debit">تمام شده</span>' : 'حدود ' + fa(Math.max(0, Math.floor(x.daysLeft))) + ' روز دیگر تمام می‌شود') + (x.minAuto || !(x.product.minStock > 0) ? '' : ' · حداقل: ' + Core.fmtQty(x.product.minStock)) + '</small></span><span class="end"><em class="credit">+' + Core.fmtQty(x.suggest) + '</em><small>پیشنهاد خرید</small></span></button>').join('') + '</div><button class="btn green" data-act="shareReorder">' + ico('share') + 'ارسال فهرست خرید</button>' : empty(ico('check'), 'فعلاً کالایی نیاز به سفارش ندارد.');
  } else {
    h += '<p class="hint">کالاهایی که موجودی دارند ولی ۶۰ روز یا بیشتر فروش نرفته‌اند (و در این مدت هم خریده نشده‌اند). با تخفیف یا فروش به همکار، سرمایه را آزاد کنید.</p>';
    h += ins.stale.length ? '<div class="card flush">' + ins.stale.slice(0, 300).map(x => '<button class="row" data-act="prodOpen" data-id="' + x.product.id + '"><span><b>' + esc(x.product.name) + '</b><small>' + (x.lastSale ? 'آخرین فروش: ' + fmtDate(x.lastSale) + ' (' + fa(x.idle) + ' روز پیش)' : 'هنوز فروش نرفته · ' + fa(x.idle) + ' روز در انبار') + '</small></span><span class="end"><em>' + Core.fmtQty(x.stock) + ' ' + esc(x.product.unit) + '</em>' + (can('cost') ? '<small>' + fmt(x.value) + '</small>' : '') + '</span></button>').join('') + '</div>' : empty(ico('check'), 'کالای راکدی ندارید.');
  }
  return { title: 'تحلیل انبار', html: h, back: '#/products' };
}
function shareReorder() {
  const ins = Core.stockInsights(S, today()); if (!ins.reorder.length) return toast('فهرستی برای ارسال نیست.');
  const by = {}; ins.reorder.forEach(x => { const c = Core.catOf(x.product); (by[c] = by[c] || []).push(x); });
  const lines = ['فهرست خرید پیشنهادی — ' + fmtDate(today()), ''];
  Object.keys(by).sort((a, b) => Core.catRank(a) - Core.catRank(b)).forEach(c => { lines.push('▪️ ' + c); by[c].forEach(x => lines.push('  • ' + x.product.name + ' — ' + Core.fmtQty(x.suggest) + ' ' + x.product.unit)); lines.push(''); });
  shareText(lines.join('\n').trim(), 'فهرست خرید');
}

/* ── warehouse: products backup, import, emptying ── */
function warehouseTools() {
  const n = S.products.length, adj = S.adjusts.length, inv = S.invoices.length;
  const sh = sheet('پشتیبان و حذف کالاها', '<div class="card"><div class="ch">' + ico('save') + 'پشتیبان کالاها</div><p class="hint">فهرست همه کالاها با دسته، قیمت‌ها، بارکد و <b>موجودی فعلی و میانگین قیمت خرید</b> در یک فایل ذخیره می‌شود. بعداً می‌توانید همین فایل را دوباره وارد کنید.</p><div class="row2"><button class="btn green" data-x>' + ico('share') + 'خروجی کالاها</button><button class="btn ghost" data-i>' + ico('folder') + 'ورود کالا از فایل</button></div><p class="hint">برای ورود، فایل پشتیبان کالاها، پشتیبان کامل برنامه، یا یک فایل متنی (هر خط یک نام کالا) را انتخاب کنید.</p></div>' +
    '<div class="card"><div class="ch">' + ico('trash') + 'حذف موجودی یا کالاها</div><label class="chk rs"><input type="radio" name="wm" value="stock" checked><span><b>فقط موجودی‌ها پاک شود</b><small>همه ' + fa(n) + ' کالا با نام، دسته و قیمت می‌مانند؛ موجودی همه صفر می‌شود.</small></span></label><label class="chk rs"><input type="radio" name="wm" value="all"><span><b>انبار کاملاً خالی شود</b><small>همه کالاها و موجودی‌شان حذف می‌شوند.</small></span></label>' +
    '<p class="hint">پاک می‌شود: ' + fa(adj) + ' ورود و تعدیل انبار' + (inv ? ' و <b class="debit">' + fa(inv) + ' فاکتور خرید و فروش</b> (چون موجودی را جابه‌جا کرده‌اند؛ حساب اشخاص هم به همان اندازه تغییر می‌کند)' : '') + '. اشخاص، دریافت و پرداخت‌ها، چک‌ها و هزینه‌ها دست نمی‌خورند.</p><label class="fld"><span>برای تأیید، کلمه «حذف» را بنویسید</span><input class="inp" name="cf" autocomplete="off"></label><button class="btn red" data-del>حذف</button></div>', { tall: true });
  sh.q('[data-x]').onclick = () => productExport();
  sh.q('[data-i]').onclick = () => { sh.close(); productImportPick(); };
  sh.q('[data-del]').onclick = async () => {
    const mode = sh.q('[name=wm]:checked').value;
    if (sh.q('[name=cf]').value.trim() !== 'حذف') return toast('کلمه تأیید درست نیست.', true);
    const r = Core.clearWarehouse(S, { products: mode === 'all', invoices: true }); if (!r.ok) return toast(r.error, true);
    sh.close(true);
    if (!(await backupFirst('پشتیبان قبل از حذف', 'پیشنهاد: اول «خروجی کالاها» را از همین صفحه بگیرید تا بتوانید کالاها را دوباره وارد کنید. پشتیبان کامل برنامه هم همه‌چیز (کالاها، فاکتورها و حساب‌ها) را نگه می‌دارد.', mode === 'all' ? 'انبار را خالی کن' : 'موجودی‌ها را پاک کن', true))) return;
    try { await kvSet('state_before_reset', JSON.stringify(S)); } catch (x) { /* ignore */ }
    S = r.state; S.settings.serialCoreStrict = true; UI.prodCat = ''; await save(); toast(mode === 'all' ? 'انبار خالی شد.' : 'موجودی همه کالاها صفر شد.'); render();
  };
}
async function productExport() {
  if (!S.products.length) return toast('کالایی برای خروجی وجود ندارد.', true);
  if (await exportFile('fixquick-products-' + stamp() + '.json', Core.exportProducts(S), 'application/json')) toast(fa(S.products.length) + ' کالا در فایل ذخیره شد.');
}
function productImportPick() {
  const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,.txt,.csv,application/json,text/plain'; i.style.display = 'none'; document.body.appendChild(i);
  i.onchange = async () => { const f = i.files[0]; i.remove(); if (f) productImportText(await f.text()); };
  i.click();
}
async function productImportText(text) {
  const r = Core.parseProducts(text); if (!r.ok) return toast(r.error, true);
  const items = r.items, names = new Set(S.products.map(p => p.name)), fresh = items.filter(x => !names.has(String(x.name).trim()));
  const withStock = fresh.filter(x => x.stock > 0).length, cats = {}; fresh.forEach(x => { const c = x.category || Core.guessCategory(x.name); cats[c] = (cats[c] || 0) + 1; });
  const catList = Object.keys(cats).sort((a, b) => Core.catRank(a) - Core.catRank(b)).map(c => '<li>' + esc(c) + ': ' + fa(cats[c]) + '</li>').join('');
  const sh = sheet('ورود کالا از فایل', '<p class="msg">در فایل ' + fa(items.length) + ' کالا هست؛ <b>' + fa(fresh.length) + ' کالای جدید</b> اضافه می‌شود' + (items.length - fresh.length ? ' و ' + fa(items.length - fresh.length) + ' کالا چون هم‌نامش از قبل هست، رد می‌شود' : '') + '.</p>' + (catList ? '<div class="card"><div class="ch">دسته‌بندی خودکار</div><ul class="catsum">' + catList + '</ul></div>' : '') +
    (withStock ? '<label class="chk"><input type="checkbox" name="stk" checked> موجودی ' + fa(withStock) + ' کالا هم با میانگین قیمت خریدش وارد شود (موجودی اول دوره)</label>' : '') + '<button class="btn blue" data-ok' + (fresh.length ? '' : ' disabled') + '>وارد کن</button>');
  sh.q('[data-ok]').onclick = async () => {
    const stk = !!(sh.q('[name=stk]') && sh.q('[name=stk]').checked);
    const st2 = Object.assign({}, S, { products: S.products.slice(), adjusts: S.adjusts.slice() });
    const res = Core.importProducts(st2, fresh, { stock: stk }); const a = Core.audit(st2);
    if (a.length) { toast('ورود انجام نشد: ' + a[0], true); return; }
    S = st2; await save(); sh.close(); toast(fa(res.added) + ' کالا وارد شد' + (res.withStock ? ' (' + fa(res.withStock) + ' با موجودی)' : '') + '.'); UI.prodCat = ''; goHash('#/products'); render();
  };
}
/* ─────────── EXPENSES ─────────── */
function pageExpenses() {
  const all = S.expenses.slice(); const q = (UI.expenseQ || '').trim(); const list = (q ? all.filter(e => Core.smartExpenseMatch(e, q)) : all).sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id); const m = Core.periodRange('month'); const mt = all.filter(e => e.date >= m.from && e.date <= m.to).reduce((s, e) => s + e.amount, 0);
  let h = '<div class="stats">' + stat('هزینه این ماه', fmt(mt), 'debit', UNIT()) + stat('جمع کل هزینه‌ها', fmt(all.reduce((s, e) => s + e.amount, 0)), '', UNIT()) + '</div>';
  const lim = UI.limExp || 150; h += sbox('expense-q', 'expenseQ', 'جستجوی عنوان، مبلغ، دسته، تاریخ…', q); if (q) h += '<p class="hint">' + fa(list.length) + ' هزینه پیدا شد · جمع نتایج ' + fmt(list.reduce((t,e)=>t+e.amount,0)) + ' ' + UNIT() + '</p>'; h += list.length ? '<div class="card flush">' + list.slice(0, lim).map(e => '<button class="row" data-act="expOpen" data-id="' + e.id + '"><span><b>' + esc(e.title) + '</b><small>' + fmtDate(e.date) + (e.category ? ' · ' + esc(e.category) : '') + ' · ' + payWhere(e) + '</small></span><em class="debit">' + fmt(e.amount) + '</em></button>').join('') + '</div>' + moreBtn('limExp', Math.min(lim, list.length), list.length) : empty(ico('cash'), q ? 'هزینه‌ای مطابق جستجو پیدا نشد.' : 'هزینه‌ای ثبت نشده است. (اجاره، حقوق، قبض و…)', '<button class="btn blue" data-act="addExpense">+ ثبت هزینه</button>');
  return { title: 'هزینه‌ها', html: h, fab: ['addExpense', '+'], back: '#/more' };
}
function expenseForm(e, pre) {
  const sh = sheet(e ? 'ویرایش هزینه' : 'هزینه جدید', '<form id="ef"><label class="fld"><span>عنوان</span><input class="inp" name="title" value="' + esc(e ? e.title : '') + '"></label>' + moneyField('amount', e ? e.amount : 0, 'مبلغ') + '<div class="row2"><label class="fld"><span>دسته (اختیاری)</span><input class="inp" name="cat" value="' + esc(e ? e.category : '') + '" list="cats"><datalist id="cats">' + [...new Set(S.expenses.map(x => x.category).filter(Boolean))].map(c => '<option value="' + esc(c) + '">').join('') + '</datalist></label>' + acctSel(e ? e.acct : (pre && pre.acct)) + '</div>' + dateField('date', e ? e.date : today()) + '<div class="row2"><button class="btn blue" type="submit">ذخیره</button>' + (e ? '<button class="btn red" type="button" data-del>حذف</button>' : '') + '</div></form>' + (e && routeAllowed('vouchers') ? '<button class="btn ghost" data-doc>' + ico('file') + 'سند حسابداری این هزینه</button>' : ''));
  const dc = sh.q('[data-doc]'); if (dc) dc.onclick = () => { sh.close(); actions.docOf({ k: 'exp', id: String(e.id) }); };
  const f = sh.q('#ef'); f.onsubmit = async ev => { ev.preventDefault(); const date = readDate(f, 'date'), amount = Core.parseMoney(f.amount.value); if (!date) return toast('تاریخ نامعتبر است.', true); if (!amount) return toast('مبلغ را درست وارد کنید.', true); const d = { title: f.title.value, amount, date, acct: +f.acct.value, category: f.cat.value }; if (!e && !gate()) return; if (!(await cashGuard(d.acct, amount - (e && e.acct === d.acct ? e.amount : 0), date))) return; if (await done(e ? Core.editExpense(S, e.id, d) : Core.addExpense(S, d), 'ذخیره شد.')) { if (!e) bumpUsage(); sh.close(); } };
  const dl = sh.q('[data-del]'); if (dl) dl.onclick = async () => { if (await confirmBox('این هزینه حذف شود؟', 'حذف', true)) { sh.close(); await done(Core.deleteExpense(S, e.id), 'حذف شد.'); } };
}

/* ─────────── REPORTS ─────────── */
function repRange() { if (UI.rep === 'custom') return { from: UI.repFrom, to: UI.repTo }; return Core.periodRange(UI.rep, today(), fyMonth()); }
function pageReports(arg) { return arg ? repPage(arg) : repHub(); }
const rrow = (l, v, c, b) => '<div class="rr' + (b ? ' b' : '') + '"><span>' + l + '</span><b class="' + (v ? c || '' : 'zero') + '">' + fmt(v) + '</b></div>';
function repSummary(from, to, r) {
  const cost = can('cost') && can('reports'), n = S.invoices.filter(i => i.type === 'sale' && (!from || i.date >= from) && (!to || i.date <= to)).length;
  let r0 = null, pr = null; if (from && to) { pr = Core.prevRange(from, to); r0 = Core.report(S, pr.from, pr.to); }
  const chg = (now, was) => { if (!r0) return ''; const c = Core.pctChange(now, was); return '<em class="' + (c == null ? '' : c > 0 ? 'credit' : c < 0 ? 'debit' : 'zero') + '">' + (c == null ? 'تازه' : (c > 0 ? '▲ ' : c < 0 ? '▼ ' : '') + fa(Math.abs(c)) + '٪') + '</em>'; };
  const n0 = r0 ? S.invoices.filter(i => i.type === 'sale' && i.date >= pr.from && i.date <= pr.to).length : 0;
  const kpi = (l, v, c, ch, money) => '<div class="kpi"><small>' + l + '</small><b class="' + (c || '') + '">' + (money === false ? fa(v) : fmt(v)) + '</b>' + ch + '</div>';
  let h = '<div class="kpis">' + kpi('فروش خالص', r.revenue, '', chg(r.revenue, r0 && r0.revenue)) + (cost ? kpi('سود خالص', r.net, r.net < 0 ? 'debit' : 'credit', chg(r.net, r0 && r0.net)) : '') + kpi('فاکتور فروش', n, '', chg(n, n0), false) + kpi('میانگین هر فاکتور', n ? Math.round(r.revenue / n) : 0, '', '') + '</div>';
  if (r0) h += '<p class="hint center">درصدها در مقایسه با دوره قبل: ' + fmtDate(pr.from) + ' تا ' + fmtDate(pr.to) + '</p>';
  if (cost) h += '<div class="card"><div class="ch">' + ico('chart') + 'سود و زیان ' + help('profit') + '</div>' + rrow('فروش', r.sales) + (r.saleReturns ? rrow('کسر: برگشت از فروش', r.saleReturns, 'ora') : '') + rrow('فروش خالص', r.revenue, '', 1) + rrow('کسر: قیمت خرید کالاهای فروخته‌شده', r.cogs, 'debit') + (r.adjLoss ? rrow('کسر: ضایعات / تعدیل انبار', r.adjLoss, 'debit') : '') + rrow('سود ناخالص', r.gross, r.gross < 0 ? 'debit' : 'credit', 1) + rrow('کسر: هزینه‌ها', r.expenses, 'debit') + rrow('سود خالص', r.net, r.net < 0 ? 'debit' : 'credit', 1) + (r.revenue ? '<p class="hint">حاشیه سود ناخالص: ' + fa(Math.round(r.gross / r.revenue * 100)) + '٪' + (r.discounts ? ' · تخفیف‌های داده‌شده: ' + fmt(r.discounts) : '') + '</p>' : '') + '</div>';
  if (r.vatOut || r.vatIn) h += '<div class="card"><div class="ch">ارزش افزوده ' + help('vat') + '</div>' + rrow('ارزش افزوده فروش (دریافتی از مشتری)', r.vatOut) + rrow('ارزش افزوده خرید (پرداختی)', r.vatIn) + rrow('خالص قابل پرداخت', r.vatNet, r.vatNet > 0 ? 'debit' : 'credit', 1) + '</div>';
  const us = staffReport(from, to); if (us) h += us;
  const rp = Core.receivablePayable(S);
  h += '<div class="card"><div class="ch">' + ico('scale') + 'وضعیت کلی (تا امروز)</div>' + (can('balances') ? '<button class="rr" data-act="repPeople" data-s="debit_desc"><span>حساب‌های دریافتنی <small>(طلب از مشتریان)</small></span><b class="debit">' + fmt(rp.receivable) + '</b></button><button class="rr" data-act="repPeople" data-s="credit_desc"><span>حساب‌های پرداختنی <small>(بدهی به دیگران)</small></span><b class="credit">' + fmt(rp.payable) + '</b></button>' : '') + (can('cost') ? rrow('ارزش موجودی انبار', Core.inventoryValue(S)) : '') + (can('reports') ? rrow('موجودی صندوق و بانک', Core.cashBalance(S)) : '') + rrow('خرید در این دوره', r.purchases - r.purchaseReturns) + '</div>';
  h += repExport('sum', from, to, r);
  return h;
}
// people: who owes most / least, who we owe, best customers in the period
function repPeople(from, to) {
  const bal = Core.balances(S), sort = UI.repPSort || 'debit_desc', q = (UI.repPQ || '').trim();
  const opts = [['debit_desc', 'بیشترین بدهکار'], ['debit_asc', 'کمترین بدهکار'], ['credit_desc', 'بیشترین طلبکار'], ['credit_asc', 'کمترین طلبکار'], ['sales', 'بیشترین خرید از ما'], ['old', 'دیرترین پرداخت'], ['name', 'الفبا']];
  const lastPay = {}; S.tx.forEach(t => { if (t.kind === 'credit' && t.type !== 'opening' && (!lastPay[t.personId] || t.date > lastPay[t.personId])) lastPay[t.personId] = t.date; });
  const sales = {}; if (sort === 'sales') S.invoices.forEach(i => { if ((i.type === 'sale' || i.type === 'sale_return') && (!from || i.date >= from) && (!to || i.date <= to)) sales[i.personId] = (sales[i.personId] || 0) + (i.type === 'sale' ? 1 : -1) * Core.invoiceTotals(i).total; });
  let list = S.people.filter(p => !p.archived || bal[p.id]).map(p => ({ p, b: bal[p.id] || 0, s: sales[p.id] || 0, last: lastPay[p.id] || null }));
  if (sort.startsWith('debit') || sort === 'old') list = list.filter(x => x.b > 0); else if (sort.startsWith('credit')) list = list.filter(x => x.b < 0); else if (sort === 'sales') list = list.filter(x => x.s);
  if (q) list = list.filter(x => matchQ(x.p.name + ' ' + (x.p.phone || ''), q));
  const by = { debit_desc: (a, b) => b.b - a.b, debit_asc: (a, b) => a.b - b.b, credit_desc: (a, b) => a.b - b.b, credit_asc: (a, b) => b.b - a.b, sales: (a, b) => b.s - a.s, old: (a, b) => (a.last || '0') < (b.last || '0') ? -1 : (a.last || '0') > (b.last || '0') ? 1 : b.b - a.b, name: (a, b) => faCmp(a.p.name, b.p.name) }[sort];
  list.sort(by); UI._repList = list;
  const rp = Core.receivablePayable(S), nd = S.people.filter(p => bal[p.id] > 0).length, nc = S.people.filter(p => bal[p.id] < 0).length;
  let h = '<div class="kpis two"><button class="kpi" data-act="repPeople" data-s="debit_desc"><small>دریافتنی · ' + fa(nd) + ' بدهکار</small><b class="debit">' + fmt(rp.receivable) + '</b></button><button class="kpi" data-act="repPeople" data-s="credit_desc"><small>پرداختنی · ' + fa(nc) + ' بستانکار</small><b class="credit">' + fmt(rp.payable) + '</b></button></div>';
  h += '<div class="rsort"><label>' + ico('down') + 'مرتب‌سازی</label><select class="inp" data-repsort>' + opts.map(o => '<option value="' + o[0] + '"' + (o[0] === sort ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div>';
  if (sort === 'sales') { h += chips('rep', UI.rep, [['mtd', 'این ماه'], ['prevmonth', 'ماه قبل'], ['fytd', 'امسال'], ['all', 'همه']]); }
  h += '<input class="inp" id="rep-pq" placeholder="جستجوی نام یا تلفن…" value="' + esc(UI.repPQ || '') + '" autocomplete="off">';
  const sum = list.reduce((t, x) => t + (sort === 'sales' ? x.s : Math.abs(x.b)), 0);
  h += '<div class="rsum"><span>' + fa(list.length) + ' نفر</span><b>جمع ' + fmt(sum) + ' ' + UNIT() + '</b></div>';
  const lim = UI.limRep || 60;
  h += list.length ? '<div class="card flush">' + list.slice(0, lim).map((x, k) => { const v = sort === 'sales' ? x.s : x.b, idle = x.last ? Core.diffDays(x.last, today()) : null;
    return '<div class="row gsr rpr"><button class="gsl" data-act="go" data-h="#/person/' + x.p.id + '"><b><i class="rk">' + fa(k + 1) + '</i>' + esc(x.p.name) + '</b><small>' + (sort === 'sales' ? 'خرید در دوره' : (x.b > 0 ? (idle == null ? 'هنوز پرداختی نداشته' : 'آخرین پرداخت: ' + fa(idle) + ' روز پیش') : 'من به او بدهکارم')) + (x.p.phone ? ' · ' + esc(fa(x.p.phone)) : '') + '</small></button><span class="gsa"><b class="' + (sort === 'sales' ? '' : v > 0 ? 'debit' : 'credit') + '">' + fmt(Math.abs(v)) + '</b>' + (x.b > 0 && can('money') && sort !== 'sales' ? '<button class="mini" data-act="txForm" data-t="receipt" data-p="' + x.p.id + '">دریافت</button>' : '') + '</span></div>'; }).join('') + '</div>' + (list.length > lim ? '<button class="btn ghost" data-act="repMore">نمایش ' + fa(Math.min(list.length - lim, 100)) + ' نفر دیگر</button>' : '') : empty(ico('users'), 'کسی در این فهرست نیست.');
  h += '<div class="toolbar rexp"><button class="btn ghost sm" data-act="repShareList">' + ico('share') + 'ارسال فهرست</button><button class="btn ghost sm" data-act="repCsvList">' + ico('file') + 'خروجی اکسل (CSV)</button></div>';
  return h;
}
function repProducts(from, to) {
  const cost = can('cost') && can('reports'), sort = UI.repGSort || 'rev';
  const opts = [['rev', 'بیشترین فروش (مبلغ)'], ['qty', 'بیشترین فروش (تعداد)']].concat(cost ? [['profit', 'پرسودترین'], ['loss', 'کم‌سودترین / ضررده'], ['margin', 'بیشترین درصد سود']] : []).concat([['slow', 'کم‌فروش‌ترین (موجود در انبار)']]);
  const pp = Core.productProfit(S, from, to), stats = Core.productStats(S);
  let list;
  if (sort === 'slow') { list = stats.filter(x => x.stock > 0).map(x => Object.assign({ p: x.product, stock: x.stock }, pp[x.product.id] || { qty: 0, rev: 0, profit: 0, margin: 0 })).sort((a, b) => a.qty - b.qty || b.stock - a.stock); }
  else { list = Object.keys(pp).map(id => Object.assign({ p: Core.byId(S.products, +id) }, pp[id])).filter(x => x.p && (x.qty || x.rev)); list.sort({ rev: (a, b) => b.rev - a.rev, qty: (a, b) => b.qty - a.qty, profit: (a, b) => b.profit - a.profit, loss: (a, b) => a.profit - b.profit, margin: (a, b) => b.margin - a.margin }[sort] || ((a, b) => b.rev - a.rev)); }
  const tot = list.reduce((t, x) => ({ rev: t.rev + (x.rev || 0), qty: t.qty + (x.qty || 0), profit: t.profit + (x.profit || 0) }), { rev: 0, qty: 0, profit: 0 });
  let h = '<div class="kpis">' + '<div class="kpi"><small>فروش کالاها</small><b>' + fmt(tot.rev) + '</b></div><div class="kpi"><small>تعداد فروخته‌شده</small><b>' + Core.fmtQty(tot.qty) + '</b></div>' + (cost ? '<div class="kpi"><small>سود ناخالص</small><b class="' + (tot.profit < 0 ? 'debit' : 'credit') + '">' + fmt(tot.profit) + '</b></div><div class="kpi"><small>حاشیه سود</small><b>' + fa(tot.rev ? Math.round(tot.profit / tot.rev * 100) : 0) + '٪</b></div>' : '') + '</div>';
  h += '<div class="rsort"><label>' + ico('down') + 'مرتب‌سازی</label><select class="inp" data-repgsort>' + opts.map(o => '<option value="' + o[0] + '"' + (o[0] === sort ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div>';
  const lim = UI.limRep || 60;
  h += list.length ? '<div class="card flush">' + list.slice(0, lim).map((x, k) => '<button class="row" data-act="prodOpen" data-id="' + x.p.id + '"><span><b><i class="rk">' + fa(k + 1) + '</i>' + esc(x.p.name) + '</b><small>' + (sort === 'slow' ? 'موجودی ' + Core.fmtQty(x.stock) + ' · فروش در دوره: ' + Core.fmtQty(x.qty || 0) : 'فروش ' + Core.fmtQty(x.qty) + ' عدد' + (cost ? ' · سود ' + fmt(x.profit) + ' (' + fa(x.margin) + '٪)' : '')) + '</small></span><span class="end"><em class="' + ((sort === 'profit' || sort === 'loss' || sort === 'margin') && x.profit < 0 ? 'debit' : '') + '">' + (sort === 'qty' || sort === 'slow' ? Core.fmtQty(sort === 'slow' ? x.stock : x.qty) : sort === 'profit' || sort === 'loss' ? fmt(x.profit) : sort === 'margin' ? fa(x.margin) + '٪' : fmt(x.rev)) + '</em></span></button>').join('') + '</div>' + (list.length > lim ? '<button class="btn ghost" data-act="repMore">نمایش کالاهای بیشتر</button>' : '') : empty(ico('package'), 'در این دوره فروشی ثبت نشده است.');
  const cp = cost ? Core.categoryProfit(S, from, to) : [];
  if (cp.length > 1) h += '<div class="card"><div class="ch">' + ico('package') + 'سود هر دسته</div>' + cp.map(x => '<button class="rr" data-act="catGo" data-c="' + esc(x.cat) + '"><span>' + esc(x.cat) + '<small> · فروش ' + fmt(x.rev) + ' · ' + fa(x.margin) + '٪</small></span><b class="' + (x.profit < 0 ? 'debit' : 'credit') + '">' + fmt(x.profit) + '</b></button>').join('') + '</div>';
  UI._repProd = list;
  h += '<div class="toolbar rexp"><button class="btn ghost sm" data-act="repCsvProd">' + ico('file') + 'خروجی اکسل (CSV)</button><button class="btn ghost sm" data-act="go" data-h="#/stock">' + ico('up') + 'تحلیل انبار</button></div>';
  return h;
}
function repCash(from, to) {
  const cs = Core.cashSummary(S, from, to), ok = can('reports') || can('money');
  if (!ok) return empty(ico('lock'), 'دیدن صندوق برای این کاربر مجاز نیست.');
  let h = '<div class="kpis"><div class="kpi"><small>دریافت‌ها</small><b class="credit">' + fmt(cs.in) + '</b></div><div class="kpi"><small>پرداخت‌ها و هزینه‌ها</small><b class="debit">' + fmt(cs.out) + '</b></div><div class="kpi"><small>خالص گردش</small><b class="' + (cs.net < 0 ? 'debit' : 'credit') + '">' + fmt(cs.net) + '</b></div><div class="kpi"><small>موجودی فعلی صندوق و بانک</small><b>' + fmt(Core.cashBalance(S)) + '</b></div></div>';
  const bal = Core.accountBalances(S);
  h += '<div class="card"><div class="ch">' + ico('wallet') + 'صندوق و بانک‌ها <button class="lnk" data-act="go" data-h="#/accounts">مدیریت</button></div>' + acctList().map(a => { const b = cs.byAcct[a.id] || { in: 0, out: 0 }; return '<button class="rr" data-act="go" data-h="#/acct/' + a.id + '"><span>' + esc(Core.acctName(a)) + '<small> · ورود ' + fmt(b.in) + ' · خروج ' + fmt(b.out) + '</small></span><b class="' + (bal[a.id] < 0 ? 'debit' : '') + '">' + fmt(bal[a.id]) + '</b></button>'; }).join('') + '<p class="hint">ورود و خروج مربوط به بازه انتخاب‌شده است؛ عدد سمت چپ موجودی فعلی است.</p></div>';
  const ex = S.expenses.filter(e => (!from || e.date >= from) && (!to || e.date <= to)), cats = {};
  ex.forEach(e => { const c = e.category || e.title; cats[c] = (cats[c] || 0) + e.amount; });
  const ct = Object.keys(cats).map(c => ({ c, v: cats[c] })).sort((a, b) => b.v - a.v), et = ex.reduce((t, e) => t + e.amount, 0);
  if (feat('expenses')) h += '<div class="card"><div class="ch">' + ico('cash') + 'هزینه‌ها به تفکیک <button class="lnk" data-act="go" data-h="#/expenses">همه</button></div>' + (ct.length ? ct.map(x => '<div class="rr"><span>' + esc(x.c) + '<small> · ' + fa(et ? Math.round(x.v / et * 100) : 0) + '٪</small></span><b class="debit">' + fmt(x.v) + '</b></div>').join('') + rrow('جمع هزینه‌ها', et, 'debit', 1) : '<p class="hint">در این دوره هزینه‌ای ثبت نشده.</p>') + '</div>';
  const days = {}; S.tx.forEach(t => { if ((t.type === 'receipt' || t.type === 'payment') && (!from || t.date >= from) && (!to || t.date <= to)) { const d = days[t.date] || (days[t.date] = { in: 0, out: 0 }); if (t.type === 'receipt') d.in += t.amount; else d.out += t.amount; } });
  const dl = Object.keys(days).sort().reverse().slice(0, 14);
  if (dl.length) h += '<div class="card"><div class="ch">' + ico('calendar') + 'دریافت و پرداخت روزانه</div>' + dl.map(d => '<div class="rr"><span>' + fmtDate(d) + '</span><b><span class="credit">' + fmt(days[d].in) + '</span> / <span class="debit">' + fmt(days[d].out) + '</span></b></div>').join('') + '</div>';
  h += '<div class="toolbar rexp"><button class="btn ghost sm" data-act="csvLedger">' + ico('file') + 'CSV کل تراکنش‌ها</button></div>';
  return h;
}
function repExport(tab, from, to, r) {
  return '<div class="toolbar rexp"><button class="btn ghost sm" data-act="repShare">' + ico('share') + 'ارسال خلاصه گزارش</button><button class="btn ghost sm" data-act="csvInvoices">' + ico('file') + 'CSV فاکتورها</button>' + (can('balances') ? '<button class="btn ghost sm" data-act="csvPeople">' + ico('file') + 'CSV مانده اشخاص</button>' : '') + '</div>';
}
function repShareText() {
  const { from, to } = repRange(), r = Core.report(S, from, to), cost = can('cost') && can('reports');
  const L = ['گزارش ' + (S.settings.business || 'فیکس کوییک'), (from ? fmtDate(from) : 'از ابتدا') + ' تا ' + (to ? fmtDate(to) : 'امروز'), '', 'فروش خالص: ' + fmt(r.revenue) + ' ' + UNIT()];
  if (cost) L.push('سود ناخالص: ' + fmt(r.gross), 'هزینه‌ها: ' + fmt(r.expenses), 'سود خالص: ' + fmt(r.net));
  L.push('خرید: ' + fmt(r.purchases - r.purchaseReturns));
  if (can('balances')) { const rp = Core.receivablePayable(S); L.push('', 'طلب از مشتریان: ' + fmt(rp.receivable), 'بدهی به دیگران: ' + fmt(rp.payable)); }
  return L.join('\n');
}

/* ─────────── MORE / SETTINGS ─────────── */
function pageMore() {
  const row = (ic, t, act, sub) => '<button class="row" ' + (act[0] === '#' ? 'data-act="go" data-h="' + act + '"' : 'data-act="' + act + '"') + '><span><b>' + ico(ic) + ' ' + t + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</span><em>‹</em></button>';
  const open = S.cheques.filter(c => !c.done).length, cost = can('cost') && can('reports');
  const sec = (title, ic, items) => { items = items.filter(Boolean); return items.length ? '<div class="ch gs-h">' + ico(ic) + title + '</div><div class="card flush">' + items.join('') + '</div>' : ''; };
  let h = sec('اسناد و عملیات روزانه', 'receipt', [
    row('receipt', 'فاکتورها', '#/invoices', 'فروش، خرید و برگشتی‌ها'),
    feat('cheques') && row('cheque', 'چک‌ها (دریافتی و پرداختی)', '#/cheques', open ? fa(open) + ' مورد در جریان' : 'در صندوق، واگذار به بانک، وصول، خرج، برگشت'),
    feat('expenses') && row('cash', 'هزینه‌ها', '#/expenses', 'اجاره، حقوق، قبوض و…'),
    feat('transfer') && row('transfer', 'حواله بین اشخاص', 'transfer', 'انتقال بدهی از یک شخص به دیگری')]);
  if (routeAllowed('accounts')) h += sec('خزانه‌داری', 'wallet', [
    row('wallet', 'صندوق و بانک‌ها', '#/accounts', 'تعریف حساب، موجودی و گردش'),
    can('money') && row('transfer', 'انتقال وجه', 'acctXfer', 'بین صندوق و بانک‌های خودتان'),
    routeAllowed('recon') && row('scale', 'مغایرت‌گیری بانکی', 'reconGo', 'تطبیق با صورت‌حساب بانک')]);
  if (routeAllowed('vouchers') || isAdmin()) h += sec('حسابداری', 'file', [
    routeAllowed('vouchers') && row('file', 'اسناد حسابداری', '#/vouchers', 'سند همه فاکتورها، دریافت و پرداخت‌ها، چک‌ها و سند دستی'),
    isAdmin() && row('listplus', 'کدینگ حساب‌ها', '#/coa', 'گروه، کل، معین و تفصیلی'),
    isAdmin() && row('lock', 'سال مالی و بستن حساب‌ها', '#/fiscal', (S.fyClosed || []).length ? 'آخرین سال بسته‌شده: ' + fa((S.fyClosed || []).reduce((m, y) => (y.label > m ? y.label : m), '')) : 'بستن سال، اسناد اختتامیه و افتتاحیه')]);
  if (can('reports')) h += sec('گزارش‌ها', 'chart', [
    row('chart', 'همه گزارش‌ها', '#/reports', 'صورت‌های مالی، فروش، اشخاص، خزانه و انبار'),
    cost && row('chart', 'صورت سود و زیان', '#/reports/pl'),
    cost && row('scale', 'تراز آزمایشی', '#/reports/tb'),
    can('balances') && row('users', 'مانده حساب اشخاص', '#/reports/people')]);
  h += sec('اطلاعات پایه', 'users', [
    row('users', 'اشخاص (مشتریان و تأمین‌کنندگان)', '#/people'),
    row('package', 'کالاها و انبار', '#/products'),
    can('warehouse') && row('transfer', 'انبارها و انتقال بین انبارها', '#/warehouses', Core.multiWh(S) ? fa(Core.whList(S).filter(w => !w.archived).length) + ' انبار' : 'تعریف انبار دوم و انتقال کالا'),
    row('up', 'تحلیل انبار', '#/stock', 'کمبود، راکد و پیشنهاد سفارش')]);
  h += sec('سیستم', 'settings', [
    can('backup') && row('save', 'ذخیره اطلاعات', 'saveLocal', 'پشتیبان در پوشه Documents/FixQuick'),
    row('settings', 'تنظیمات و پشتیبان', '#/settings'),
    row('help', 'راهنما و واژه‌نامه حسابداری', 'helpAll'),
    (isNative() || DESK) && row('exit', 'خروج از برنامه', 'exitApp')]);
  return { title: 'بیشتر', html: h + aboutCard() + '<p class="hint center">حسابداری فیکس کوییک · نسخه ' + fa(APP_VER) + (curName() ? ' · کاربر: ' + esc(curName()) + (isAdmin() ? ' (مدیر)' : '') : '') + '</p>' };
}
function aboutCard() {
  const lnk = (ic, t, s, u) => '<a class="ab-row" href="' + u + '" target="_blank" rel="noopener"><i>' + ic + '</i><span><b>' + t + '</b><small>' + s + '</small></span><em>‹</em></a>';
  return '<div class="card about"><div class="ab-h"><img src="logo.png" alt=""><div><b>پشتیبانی فیکس کوییک</b><small>سؤال یا مشکلی داشتید؟ در واتساپ پیام بدهید؛ در خدمتیم.</small></div></div>' +
    lnk(ico('chat'), 'واتساپ پشتیبانی', Core.toFa('09999917199'), 'https://wa.me/989999917199') +
    lnk(ico('phone'), 'تماس تلفنی', Core.toFa('09999917199'), 'tel:09999917199') +
    lnk(ico('globe'), 'وب‌سایت', 'fixq.ir', 'https://fixq.ir') +
    lnk(ico('insta'), 'اینستاگرام', '@fixq.ir', 'https://instagram.com/fixq.ir') +
    '<div class="ab-f">با مدیریت <b>محمد صادق ربانی</b><small>طراح و صاحب امتیاز برنامه</small></div></div>';
}
function pageSettings() {
  const days = S.settings.lastBackup ? Core.diffDays(S.settings.lastBackup, today()) : null;
  let h = '';
  if (isAdmin()) h += '<form class="card" id="setf"><label class="fld"><span>نام کسب‌وکار (روی گزارش‌ها)</span><input class="inp" name="business" value="' + esc(S.settings.business) + '"></label>' + '<button type="button" class="btn ghost" data-act="go" data-h="#/accounts">' + ico('wallet') + 'صندوق و بانک‌ها (موجودی اول دوره، شماره حساب)</button>' + '<div class="row2"><label class="fld"' + (feat('vat') ? '' : ' hidden') + '><span>درصد ارزش افزوده</span><input class="inp ltr" name="vatRate" inputmode="decimal" value="' + fa(vatRateSet()) + '"></label><label class="fld"><span>شروع سال مالی ' + help('fy') + '</span><select class="inp" name="fyMonth">' + Core.MONTHS.map((m, i) => '<option value="' + (i + 1) + '"' + (i + 1 === fyMonth() ? ' selected' : '') + '>۱ ' + m + '</option>').join('') + '</select></label></div><p class="hint">درصد ارزش افزوده روی فاکتورهای جدید اعمال می‌شود؛ فاکتورهای قبلی با همان درصد خودشان می‌مانند.</p><label class="fld"><span>هشدار سود کم در فاکتور فروش (درصد) ' + help('minmargin') + '</span><input class="inp ltr" name="minMargin" inputmode="decimal" value="' + fa(minMargin()) + '"></label><button class="btn blue" type="submit">ذخیره تنظیمات</button></form>';
  if (isAdmin()) h += '<form class="card" id="usf"><div class="ch">' + ico('store') + 'تنظیمات کاربری</div><label class="fld"><span>نام فروشنده روی فاکتور (نام مجموعه یا نام خانوادگی شما)</span><input class="inp" name="seller" maxlength="60" placeholder="' + esc(S.settings.business || 'مثلاً: موبایل ربانی') + '" value="' + esc(S.settings.sellerName || '') + '"></label><label class="fld"><span>واحد پول ' + help('unit') + '</span><select class="inp" name="unit"><option value="rial"' + (Core.unit === 'rial' ? ' selected' : '') + '>ریال</option><option value="toman"' + (Core.unit === 'toman' ? ' selected' : '') + '>تومان</option></select></label><p class="hint">نام فروشنده بالای فاکتور خرید و فروش چاپ می‌شود. اگر خالی باشد، «نام کسب‌وکار» چاپ می‌شود.</p><button class="btn blue" type="submit">ذخیره تنظیمات کاربری</button></form>';
  const st = S.settings, th = st.theme || 'auto', ac = st.accent || 'blue', fs = Number(st.fontScale) || 1;
  h += '<div class="card"><div class="ch">' + ico('palette') + 'ظاهر برنامه</div><div class="seg">' + [['light', ico('sun') + 'روز'], ['dark', ico('moon') + 'شب'], ['auto', ico('phonecell') + 'خودکار']].map(x => '<button type="button" class="' + (th === x[0] ? 'on' : '') + '" data-act="setTheme" data-v="' + x[0] + '">' + x[1] + '</button>').join('') + '</div><div class="sw">' + Object.keys(ACCENTS).map(k => '<button type="button" title="' + ACCENTS[k][2] + '" class="' + (ac === k ? 'on' : '') + '" style="background:' + ACCENTS[k][0] + '" data-act="setAccent" data-v="' + k + '"></button>').join('') + '</div><div class="fsr"><button type="button" data-act="fontStep" data-v="-1">A−</button><span class="v">اندازه نوشته: ' + fa(Math.round(fs * 100)) + '٪</span><button type="button" data-act="fontStep" data-v="1">A+</button></div><button type="button" class="lnk center" data-act="fontStep" data-v="0">بازگشت به اندازه عادی</button></div>';
  if (can('backup')) h += '<div class="card"><div class="ch">' + ico('save') + 'پشتیبان‌گیری</div><p class="hint">' + (days === null ? 'هنوز پشتیبان نگرفته‌اید.' : 'آخرین پشتیبان: ' + fmtDate(S.settings.lastBackup) + ' (' + fa(days) + ' روز پیش)') + '</p><p class="hint">اطلاعات فقط روی همین گوشی است. با حذف برنامه یا پاک‌کردن اطلاعات مرورگر از بین می‌رود؛ پس مرتب پشتیبان بگیرید و فایل را برای خودتان (مثلاً تلگرام/Drive) بفرستید.</p><button class="btn green" data-act="saveLocal">' + ico('save') + 'ذخیره اطلاعات</button><p class="hint center">' + (fsP() ? 'مسیر ذخیره: ' + (S.settings.lastSave ? saveWhere(S.settings.lastSave.where) : saveWhere('DOCUMENTS')) + (S.settings.lastSave ? ' · آخرین ذخیره: ' + fmtDate(Core.todayISO(new Date(S.settings.lastSave.at))) : '') : 'در مرورگر، فایل در پوشه Downloads ذخیره می‌شود.') + '</p><div class="row2"><button class="btn blue" data-act="backup">' + ico('share') + 'ارسال فایل پشتیبان</button><button class="btn ghost" data-act="restore">بازیابی از فایل</button></div><input type="file" id="restore-file" accept=".json,application/json" hidden></div>';
  if (can('backup')) h += autoBackupCard();
  const au = S.settings.auth || {};
  if (isAdmin()) {
  h += '<div class="card"><div class="ch">' + ico('user') + 'حساب کاربری</div><p class="hint">نام کاربری: <b>' + esc(au.user || '') + '</b></p><div class="row2"><button class="btn ghost" data-act="changePass">تغییر رمز</button><button class="btn ghost" data-act="newCode">کد بازیابی جدید</button></div><button class="btn ghost" data-act="logout">' + ico('lock') + 'خروج و قفل برنامه</button>' + (isNative() ? '<button class="btn ghost" data-act="toggleBio">' + (S.settings.bio ? ico('finger') + 'اثر انگشت: فعال (غیرفعال کنم)' : ico('finger') + 'فعال‌سازی ورود با اثر انگشت') + '</button>' : '') + '</div>';
  h += featuresCard() + (feat('users') || (S.settings.users || []).length ? usersCard() : '') + lockCard();
  } else h += '<div class="card"><div class="ch">' + ico('user') + 'حساب کاربری</div><p class="hint">وارد شده با: <b>' + esc(CUR.user) + '</b> (کاربر زیرمجموعه)</p><button class="btn ghost" data-act="logout">' + ico('lock') + 'خروج و قفل برنامه</button></div>';
  const left = freeLeft();
  if (isAdmin()) h += '<div class="card"><div class="ch">' + ico('star') + 'نسخه برنامه</div>' + (licOk ? '<p class="hint">' + ico('check') + licStatus() + '</p>' : licExpired() ? '<p class="hint debit">' + licStatus() + '</p>' : '<p class="hint">نسخه رایگان: ' + fa(Math.min(usedDocs(), License.FREE_LIMIT)) + ' از ' + fa(License.FREE_LIMIT) + ' فاکتور و سند استفاده شده (' + fa(left) + ' باقی‌مانده).</p>') + '<button class="btn ' + (licOk ? 'ghost' : 'blue') + '" data-act="activate">' + (licOk ? 'جزئیات نسخه نامحدود' : ico('star') + 'فعال‌سازی نسخه نامحدود') + '</button></div>';
  const errN = diagLoad().length;
  h += '<div class="card"><div class="ch">' + ico('wrench') + 'گزارش خطا</div><p class="hint">اگر برنامه درست کار نکرد یا بسته شد، این گزارش را برای پشتیبانی بفرستید. فقط اطلاعات فنی (نسخه، گوشی، متن خطا) فرستاده می‌شود؛ نام اشخاص و مبالغ در آن نیست.</p><p class="hint">خطاهای ثبت‌شده: <b>' + fa(errN) + '</b></p><div class="row2"><button class="btn green" data-act="reportWa">ارسال در واتساپ</button><button class="btn ghost" data-act="reportShare">کپی / ارسال</button></div>' + (errN ? '<button class="lnk center" data-act="reportClear">پاک‌کردن خطاهای ثبت‌شده</button>' : '') + '</div>';
  h += '<div class="card"><div class="ch">' + ico('search') + 'بررسی سلامت اطلاعات</div><p class="hint">صحت ارتباط تراکنش‌ها، فاکتورها و موجودی انبار را بررسی می‌کند.</p><button class="btn ghost" data-act="audit">اجرای بررسی</button></div>';
  if (isAdmin()) h += '<div class="card"><div class="ch">' + ico('eraser') + 'خام کردن اطلاعات</div><p class="hint">فاکتورها، ورود کالا به انبار، دریافت و پرداخت‌ها، هزینه‌ها یا چک‌ها را پاک می‌کند تا از نو شروع کنید. <b>اشخاص و کالاها (نام، تلفن، قیمت، بارکد) پاک نمی‌شوند.</b></p><button class="btn ghost red" data-act="resetData">خام کردن اطلاعات…</button></div>';
  if (isAdmin()) h += '<div class="card"><div class="ch">' + ico('alert') + 'حذف همه اطلاعات</div><button class="btn red" data-act="wipe">پاک‌کردن کامل برنامه</button></div><p class="hint center">تعداد: ' + fa(S.people.length) + ' شخص · ' + fa(S.products.length) + ' کالا · ' + fa(S.invoices.length) + ' فاکتور · ' + fa(S.tx.length) + ' تراکنش</p>';
  return { title: 'تنظیمات', html: h, back: '#/more', mount: () => { bindLockCard(); if ($('#setf')) $('#setf').onsubmit = async e => { e.preventDefault(); const f = e.target, oc = S.settings.openingCash || 0; const vr = Core.parseNum(f.vatRate.value || '0'); if (isNaN(vr) || vr < 0 || vr > 100) return toast('درصد ارزش افزوده نامعتبر است.', true); S.settings.business = f.business.value.trim(); S.settings.openingCash = oc; S.settings.vatRate = vr; S.settings.fyMonth = +f.fyMonth.value || 1; const mm = Core.parseNum(f.minMargin.value || '0'); if (!isNaN(mm) && mm >= 0 && mm <= 100) S.settings.minMargin = mm; await save(); toast('ذخیره شد.'); render(); }; if ($('#restore-file')) $('#restore-file').onchange = restoreFile; if ($('#usf')) $('#usf').onsubmit = saveUserSettings; } };
}
async function doBackup(noRender) { const ok = await exportFile('fixquick-backup-' + stamp() + '.json', Core.exportJSON(S), 'application/json'); if (ok) { S.settings.lastBackup = today(); S.settings.lastBackupAt = Date.now(); await save(); toast('پشتیبان آماده شد.'); if (!noRender) render(); } return !!ok; }
const hasDocs = () => S.invoices.length + S.tx.length + S.expenses.length + S.cheques.length + S.adjusts.length > 0;
// a step that needs a fresh backup first: [backup and continue] [continue without backup] [cancel]
function backupFirst(title, msgHtml, goLabel, danger) {
  return new Promise(res => {
    let done = false; const fin = v => { if (done) return; done = true; res(v); };
    const sh = sheet(title, '<div class="msg">' + msgHtml + '</div><button class="btn green" data-bk>' + ico('save') + 'اول پشتیبان بگیر، بعد ' + esc(goLabel) + '</button><button class="btn ghost' + (danger ? ' red' : '') + '" data-go>بدون پشتیبان ' + esc(goLabel) + '</button><button class="btn ghost" data-close>انصراف</button>', { onClose: () => fin(false) });
    sh.q('[data-bk]').onclick = async () => { if (await doBackup(true)) { sh.close(true); fin(true); } else toast('پشتیبان گرفته نشد؛ تغییری اعمال نشد.', true); };
    sh.q('[data-go]').onclick = () => { sh.close(true); fin(true); };
  });
}
async function saveUserSettings(e) {
  e.preventDefault(); const f = e.target, seller = f.seller.value.trim().slice(0, 60), unit = f.unit.value === 'toman' ? 'toman' : 'rial';
  if (unit !== Core.unit && hasDocs()) {
    const from = Core.unitName(), to = Core.unitName(unit);
    const ok = await backupFirst('تغییر واحد پول', 'واحد پول از <b>' + from + '</b> به <b>' + to + '</b> تغییر می‌کند. پیش از ادامه، به این نکته‌ها توجه کنید:<ul>' +
      '<li>هیچ عددی در حساب‌ها عوض نمی‌شود؛ همه مبالغ قبلی خودکار به ' + to + ' نمایش داده می‌شوند (هر ۱ تومان = ۱۰ ریال).</li>' +
      '<li>از این به بعد <b>همه مبالغ را باید به ' + to + ' وارد کنید</b>' + (unit === 'toman' ? ' (یک صفر کمتر از ریال)' : ' (یک صفر بیشتر از تومان)') + '. اشتباه در ورود مبلغ، حساب‌ها را ده برابر کم یا زیاد می‌کند.</li>' +
      '<li>فاکتورها و صورت‌حساب‌هایی که قبلاً چاپ یا ارسال کرده‌اید به ' + from + ' هستند و ممکن است با نسخه‌های جدید اشتباه گرفته شوند.</li>' +
      (unit === 'toman' ? '<li>مبلغ‌هایی که رقم آخرشان صفر نیست، به نزدیک‌ترین تومان گرد نمایش داده می‌شوند.</li>' : '') +
      '<li>با بازیابی یک پشتیبان قدیمی، واحد پول همان پشتیبان برمی‌گردد.</li></ul>توصیه می‌شود اول پشتیبان بگیرید.', 'تغییر بده');
    if (!ok) { f.unit.value = Core.unit; return; }
  }
  S.settings.sellerName = seller; S.settings.unit = unit; applySettings(S.settings); await save(); toast('تنظیمات کاربری ذخیره شد.'); render();
}
async function resetDataFlow() {
  const opts = [['invoices', 'فاکتورهای خرید و فروش و برگشتی‌ها', 'با دریافت و پرداخت‌هایی که روی همان فاکتورها ثبت شده', S.invoices.length],
    ['adjusts', 'ورود کالا به انبار و تعدیل موجودی', 'موجودی اولیه کالاها، کسری و اضافی انبار', S.adjusts.length],
    ['people', 'دریافت، پرداخت، حواله و مانده اول دوره اشخاص', 'تراکنش‌هایی که جدا از فاکتور ثبت شده‌اند', S.tx.filter(t => t.ref == null).length],
    ['expenses', 'هزینه‌ها', '', S.expenses.length], ['cheques', 'چک و اقساط', '', S.cheques.length]];
  const sh = sheet('خام کردن اطلاعات', '<p class="hint">چه چیزهایی پاک شود؟ <b>اشخاص و کالاها پاک نمی‌شوند.</b></p><div class="rsl">' + opts.map(o => '<label class="chk rs"><input type="checkbox" name="' + o[0] + '"' + (o[3] ? '' : ' disabled') + '><span><b>' + o[1] + ' <em>(' + fa(o[3]) + ')</em></b>' + (o[2] ? '<small>' + o[2] + '</small>' : '') + '</span></label>').join('') + '</div><button type="button" class="lnk" data-all>انتخاب همه</button><label class="fld"><span>برای تأیید، کلمه «خام» را بنویسید</span><input class="inp" name="cf" autocomplete="off"></label><button class="btn red" data-ok>خام کن</button>', { tall: true });
  sh.q('[data-all]').onclick = () => sh.qa('.rs input:not(:disabled)').forEach(i => { i.checked = true; });
  sh.q('[data-ok]').onclick = async () => {
    const o = {}; let any = false; sh.qa('.rs input').forEach(i => { o[i.name] = i.checked; any = any || i.checked; });
    if (!any) return toast('حداقل یک مورد را انتخاب کنید.', true);
    if (sh.q('[name=cf]').value.trim() !== 'خام') return toast('کلمه تأیید درست نیست.', true);
    const r = Core.resetData(S, o); if (!r.ok) return toast(r.error, true);
    sh.close(true);
    if (!(await backupFirst('پشتیبان قبل از خام کردن', 'موارد انتخاب‌شده برای همیشه پاک می‌شوند. اگر از قبل پشتیبان بگیرید، هر وقت خواستید می‌توانید همه را برگردانید.', 'خام کن', true))) return;
    try { await kvSet('state_before_reset', JSON.stringify(S)); } catch (x) { /* ignore */ }
    S = r.state; S.settings.serialCoreStrict = true; await save(); toast('اطلاعات انتخاب‌شده پاک شد؛ اشخاص و کالاها سر جایشان هستند.'); render();
  };
}
async function restoreFile(e) { const file = e.target.files[0]; e.target.value = ''; if (!file) return; await restoreText(await file.text()); }
async function restoreText(text) {
  const r = Core.parseBackup(text); if (!r.ok) return toast(r.error, true);
  const st = r.state; if (!(await confirmBox('اطلاعات فعلی کاملاً با فایل پشتیبان جایگزین می‌شود (' + fa(st.people.length) + ' شخص، ' + fa(st.invoices.length) + ' فاکتور، ' + fa(st.tx.length) + ' تراکنش). ادامه می‌دهید؟', 'جایگزین کن', true))) return;
  try { await kvSet('state_before_restore', JSON.stringify(S)); } catch (x) { /* ignore */ }
  const au0 = S.settings.auth, wasAdmin = isAdmin(); S = Object.assign(Core.emptyState(), st); S.settings.serialCoreStrict = true; if (!S.settings.auth && au0) S.settings.auth = au0; applySettings(S.settings); await licCheck(); await save(); toast('بازیابی انجام شد.'); goHash('#/home'); render();
  if (!wasAdmin) authGate(); // the restored file may have other users: log in again
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
  chip: d => { UI[d.k] = d.v; if (d.k === 'prodCat') UI.limProd = 100; if (d.k === 'repTab' || d.k === 'rep') UI.limRep = 60; if (d.k === 'rep' && d.v === 'custom' && !UI.repFrom) { UI.repFrom = Core.periodRange('month').from; UI.repTo = today(); } render(); },
  addPerson: () => personForm(), editPerson: d => personForm(Core.byId(S.people, +d.p)),
  toggleArchived: () => { UI.showArchived = !UI.showArchived; render(); },
  archive: async d => { const p = Core.byId(S.people, +d.p); await done(Core.setArchived(S, p.id, !p.archived), p.archived ? 'فعال شد.' : 'بایگانی شد.'); goHash('#/people'); },
  delPerson: async d => { const p = Core.byId(S.people, +d.p); if (await confirmBox('«' + p.name + '» حذف شود؟', 'حذف', true)) { const r = Core.deletePerson(S, p.id); if (r.ok) { await save(); goHash('#/people'); toast('حذف شد.'); } else toast(r.error, true); } },
  txForm: d => { if (gate()) txForm(d.t, +d.p || null); }, quickTx: d => { if (gate()) txForm(d.t, null); }, txOpen: d => txOpen(+d.id), transfer: d => { if (gate()) transferForm(+d.p || null); },
  stmtRange: d => stmtSheet(+d.p || 0),
  stmtClear: () => { UI.stmtFrom = UI.stmtTo = null; render(); },
  rangeSet: d => rangeSheet(d.k), rangeClr: d => { UI[d.k + 'From'] = UI[d.k + 'To'] = null; const l = RANGE_LIM[d.k]; if (l) UI[l[0]] = l[1]; render(); },
  clrQ: d => { const lim = { peopleQ: ['limPeople', 150], invQ: ['limInv', 100], prodQ: ['limProd', 100], docQ: ['limDoc', 60] }[d.k]; if (!lim) return; UI[d.k] = ''; UI[lim[0]] = lim[1]; clearTimeout(searchT); const i0 = $('#' + d.id); if (i0) i0.value = ''; render({ keepId: d.id }); const i = $('#' + d.id); if (i) i.focus(); },
  shareStmt: d => shareText(Core.statementText(S, +d.p, UI.stmtFrom, UI.stmtTo)),
  csvStmt: async d => { const L = Core.ledger(S, +d.p, UI.stmtFrom, UI.stmtTo); await exportFile('statement-' + stamp() + '.csv', csvFile([['تاریخ', 'شرح', 'اضافه (' + UNIT() + ')', 'کم (' + UNIT() + ')', 'مانده (' + UNIT() + ')']].concat(L.rows.map(r => [Core.isoToJalali(r.tx.date), r.tx.desc, r.debit ? Core.shown(r.debit) : '', r.credit ? Core.shown(r.credit) : '', Core.shown(r.balance)]))), 'text/csv'); },
  newInv: d => { if (!gate()) return; const q = d.p ? '?p=' + d.p : ''; const h = '#/new/' + (d.t || 'sale') + q; goHash(h); },
  pickInvPerson: () => pickList('انتخاب شخص', personItems(), v => { $('#nf [name=pid]').value = v; $('#nf-p').textContent = personName(+v); $('#nf-px').hidden = false; }, { addNew: 'شخص جدید', onAdd: () => personFormInline() }),
  clrInvPerson: () => { $('#nf [name=pid]').value = ''; $('#nf-p').textContent = 'انتخاب شخص…'; $('#nf-px').hidden = true; },
  pickSerial: (d, el) => serialPicker(el.closest('.it-row')),
  pickProd: (d, el) => {
    const f = $('#nf'), type = f.type.value, row = el.closest('.it-row'), fill = p => fillRowProduct(row, p);
    const top = Core.frequentProducts(S, type, +f.pid.value || 0, 12);
    pickList('انتخاب کالا', Core.productStats(S).map(x => ({ value: x.product.id, label: x.product.name, sub: [x.product.sku, can('cost') && x.avg ? 'میانگین خرید ' + fmt(x.avg) : ''].filter(Boolean).join(' · '), cat: Core.catOf(x.product), right: Core.fmtQty(x.stock) + ' ' + x.product.unit, cls: x.stock <= 0 ? 'debit' : '' })).sort((a, b) => faCmp(a.label, b.label)), v => fill(Core.byId(S.products, +v)), { addNew: can('warehouse') ? 'کالای جدید' : '', cats: true, top, topLabel: (type === 'sale' || type === 'sale_return') ? 'پرخریدهای این مشتری' : 'پرتکرار از این فروشنده', onAdd: () => productForm(null, { inInvoice: true, onSaved: fill }) });
  },
  plGo: d => { UI.rep = d.k; goHash('#/reports/sum'); },
  more: d => { UI[d.k] = (UI[d.k] || 0) + ({ limInv: 100, limProd: 100, limLedger: 200 }[d.k] || 150); render(); },
  repGoR: d => { UI.rep = 'custom'; UI.repFrom = d.f; UI.repTo = d.to; goHash('#/reports/sum'); },
  cmdGo: d => {
    if (!gate()) return;
    if (d.a === 'receipt' || d.a === 'payment') { if (!can('money')) return toast('این کار برای شما مجاز نیست.', true); txForm(d.a, +d.p || null); if (d.amt) setTimeout(() => { const f = $('#tf'); if (f) { f.amount.value = Core.fmtInput(+d.amt); mwUpdate(f.amount); } }, 30); return; }
    if (d.a === 'purchase' && !can('purchase')) return toast('ثبت فاکتور خرید برای شما مجاز نیست.', true);
    goHash('#/new/' + d.a + '?' + new URLSearchParams(Object.assign(d.p ? { p: d.p } : {}, d.i ? { i: d.i } : {})).toString());
  },
  prodStock: () => { UI.prodStock = !inStockOnly(); try { localStorage.setItem('fq_instock', UI.prodStock ? '1' : '0'); } catch (e) { /* ignore */ } UI.limProd = 100; render(); },
  homeHide: () => { try { localStorage.setItem('fq_hide', homeHidden() ? '0' : '1'); } catch (e) { /* ignore */ } render(); },
  homePeople: d => { UI.peopleF = d.f; UI.peopleQ = ''; goHash('#/people'); },
  ...ACCOUNT_ACTIONS, ...REPORT_ACTIONS, ...LEDGER_ACTIONS,
  searchMore: () => { UI.searchLim = (UI.searchLim || 30) + 50; render(); },
  searchGo: d => { UI.searchLim = 30; UI.searchQ = d.q; rememberSearch(d.q); goHash('#/search'); if (location.hash === '#/search') render(); }, catGo: d => { UI.prodCat = d.c; UI.prodQ = ''; goHash('#/products'); }, repGo: d => { UI.rep = d.k; goHash('#/reports/sum'); },
  openImport: d => openingImport(d.k === 'stock' ? 'stock' : 'people'), bulkProducts: () => bulkProducts(), shareReorder: () => shareReorder(), whTools: () => warehouseTools(), prodImport: () => productImportPick(), prodExport: () => productExport(), bulkPeople: () => bulkPeople(),
  scanProd: () => openScanner({ title: 'اسکن کالا', onCode: t => { const p = findProductByCode(t); if (p) prodOpen(p.id); else confirmBox('کالایی با کد «' + t + '» پیدا نشد. کالای جدید با این بارکد ساخته شود؟', 'ساخت کالا').then(y => { if (y) productForm(null, { barcode: t }); }); } }),
  labelsAll: () => { const list = prodFiltered(); if (list.length > 960) return toast('اول با جستجو فهرست را کوتاه‌تر کنید (حداکثر ۹۶۰ کالا).', true); labelSheet(list); },
  scanInv: () => openScanner({ title: 'اسکن کالاها', hint: 'کالاها را پشت سر هم اسکن کنید؛ هر کد یک عدد به فاکتور اضافه می‌کند. برای پایان، ✕ را بزنید.', continuous: true, onCode: t => scanIntoInvoice(t) }),
  activate: () => paywall(),
  copyDev: async () => { const c = await myDeviceCode(); try { await navigator.clipboard.writeText(c); toast('کد دستگاه کپی شد.'); } catch (e) { shareText(c); } },
  reportWa: async () => { diagWhatsApp(await diagReport()); try { localStorage.setItem('fq_err_seen', String(diagLoad().length)); } catch (e) { /* ignore */ } },
  reportShare: async () => shareText(await diagReport(), 'گزارش خطا'),
  errSeen: () => { try { localStorage.setItem('fq_err_seen', String(diagLoad().length)); } catch (e) { /* ignore */ } render(); },
  reportClear: async () => { if (await confirmBox('خطاهای ثبت‌شده پاک شود؟', 'پاک کن')) { diagClear(); try { localStorage.setItem('fq_err_seen', '0'); } catch (e) { /* ignore */ } render(); } },
  printInv: d => printInvoice(+d.id),
  addRow: () => { addRow(); calcInvoice(); }, rmRow: (d, el) => { const only = $$('.it-row').length <= 1; el.closest('.it-row').remove(); if (only) addRow(); calcInvoice(); }, // the only row is emptied instead of staying stuck
  payFull: () => { const f = $('#nf'); f.paid.value = Core.fmtInput((+f.dataset.total || 0)); calcInvoice(); },
  payInv: d => { const i = Core.byId(S.invoices, +d.id), info = Core.invoiceInfo(S, i); const isRec = i.type === 'sale' || i.type === 'purchase_return'; txForm(isRec ? 'receipt' : 'payment', i.personId, null, { ref: i.id }); setTimeout(() => { const f = $('#tf'); f.amount.value = Core.fmtInput((info.remaining)); mwUpdate(f.amount); f.desc.value = 'تسویه فاکتور ' + fa(i.no); }, 30); },
  shareInv: d => shareText(invoiceText(Core.byId(S.invoices, +d.id))),
  delInv: async d => { const i = Core.byId(S.invoices, +d.id); if (await confirmBox('فاکتور ' + fa(i.no) + ' و همه پرداخت‌های ثبت‌شده‌اش حذف شود؟ اثر آن روی حساب و انبار برگردانده می‌شود.', 'حذف فاکتور', true)) { const r = Core.deleteInvoice(S, i.id); if (r.ok) { await save(); toast('حذف شد.'); goHash('#/invoices'); } else toast(r.error, true); } },
  addProduct: () => productForm(), prodOpen: d => prodOpen(+d.id),
  addCheque: () => chequeForm(), personChequeReceive: d => { if (gate()) chequeForm(null, { p: +d.p, dir: 'receive' }); }, personChequePay: d => { if (gate()) personChequePayment(+d.p); },
  chqDone: async d => { const c = Core.byId(S.cheques, +d.id); const sh = sheet('انجام شد', '<p class="msg">' + esc(c.title) + ' — ' + fmt(c.amount) + ' ' + UNIT() + '</p>' + (c.personId ? acctSel(defaultBankId(), 'chq-acct', c.direction === 'receive' ? 'واریز به' : 'برداشت از') + '<button class="btn blue" data-rec>ثبت در حساب ' + esc(personName(c.personId)) + ' (' + (c.direction === 'receive' ? 'دریافت' : 'پرداخت') + ')</button>' : '') + '<button class="btn ghost" data-only>فقط علامت‌گذاری (بدون ثبت در حساب)</button>'); const go = async rec => { const sel = sh.q('[name=chq-acct]'), ac = sel ? +sel.value : null; sh.close(); await done(Core.completeCheque(S, c.id, rec, today(), ac), 'ثبت شد.'); }; const r = sh.q('[data-rec]'); if (r) r.onclick = () => go(true); sh.q('[data-only]').onclick = () => go(false); },
  chqReopen: async d => { await done(Core.reopenCheque(S, +d.id), 'بازگردانده شد.'); },
  chqEdit: d => chequeForm(Core.byId(S.cheques, +d.id)),
  chqDel: async d => { if (await confirmBox('این مورد حذف شود؟', 'حذف', true)) await done(Core.deleteCheque(S, +d.id), 'حذف شد.'); },
  addExpense: () => { if (gate()) expenseForm(); }, expOpen: d => expenseForm(Core.byId(S.expenses, +d.id)),
  repApply: () => { const f = readDate(document, 'rf'), t = readDate(document, 'rt'); if (!f || !t) return toast('تاریخ نامعتبر است.', true); if (f > t) return toast('تاریخ شروع بعد از پایان است.', true); UI.repFrom = f; UI.repTo = t; render(); },
  repPeople: d => { UI.repPSort = d.s; UI.limRep = 60; goHash('#/reports/people'); render(); },
  repMore: () => { UI.limRep = (UI.limRep || 60) + 100; render(); },
  repShare: () => shareText(repShareText(), 'گزارش'),
  repShareList: () => { const l = UI._repList || [], sales = UI.repPSort === 'sales'; shareText(['فهرست ' + ({ debit_desc: 'بدهکاران (بیشترین)', debit_asc: 'بدهکاران (کمترین)', credit_desc: 'طلبکاران (بیشترین)', credit_asc: 'طلبکاران (کمترین)', sales: 'خرید مشتریان', old: 'بدهکاران (دیرترین پرداخت)', name: 'اشخاص' }[UI.repPSort || 'debit_desc'] || ''), ''].concat(l.slice(0, 300).map((x, k) => fa(k + 1) + '. ' + x.p.name + ': ' + fmt(Math.abs(sales ? x.s : x.b)) + ' ' + UNIT())).join('\n'), 'فهرست'); },
  repCsvList: async () => { const l = UI._repList || []; await exportFile('people-' + stamp() + '.csv', csvFile([['ردیف', 'نام', 'تلفن', 'مانده (' + UNIT() + ')', 'وضعیت', 'آخرین پرداخت']].concat(l.map((x, k) => [k + 1, x.p.name, x.p.phone || '', Core.shown(Math.abs(x.b)), x.b > 0 ? 'بدهکار' : x.b < 0 ? 'طلبکار' : 'تسویه', x.last ? Core.isoToJalali(x.last) : '']))), 'text/csv'); },
  repCsvProd: async () => { const l = UI._repProd || [], cost = can('cost'); await exportFile('products-report-' + stamp() + '.csv', csvFile([['ردیف', 'کالا', 'تعداد فروش', 'فروش (' + UNIT() + ')'].concat(cost ? ['سود', 'درصد سود'] : [])].concat(l.map((x, k) => [k + 1, x.p.name, x.qty || 0, Core.shown(x.rev || 0)].concat(cost ? [Core.shown(x.profit || 0), x.margin || 0] : [])))), 'text/csv'); },
  csvPeople: async () => { const b = Core.balances(S); await exportFile('balances-' + stamp() + '.csv', csvFile([['نام', 'تلفن', 'مانده (' + UNIT() + ')', 'وضعیت']].concat(S.people.map(p => [p.name, p.phone, Core.shown(Math.abs(b[p.id] || 0)), sign(b[p.id])]))), 'text/csv'); },
  csvInvoices: async () => { await exportFile('invoices-' + stamp() + '.csv', csvFile([['شماره', 'نوع', 'شخص', 'تاریخ', 'جمع (' + UNIT() + ')', 'تخفیف', 'ارزش افزوده', 'پرداخت‌شده', 'مانده', 'توضیحات / سریال']].concat(S.invoices.map(i => { const n = Core.invoiceInfo(S, i); return [i.no, Core.TYPE_FA[i.type], personName(i.personId), Core.isoToJalali(i.date), Core.shown(n.total), Core.shown(n.discount), Core.shown(n.vat), Core.shown(n.paid), Core.shown(n.remaining), invNotes(i).join(' | ')]; }))), 'text/csv'); },
  csvLedger: async () => { await exportFile('ledger-' + stamp() + '.csv', csvFile([['تاریخ', 'شخص', 'شرح', 'اضافه (' + UNIT() + ')', 'کم (' + UNIT() + ')']].concat(S.tx.slice().sort((a, b) => a.date < b.date ? -1 : 1).map(t => [Core.isoToJalali(t.date), personName(t.personId), t.desc, t.kind === 'debit' ? Core.shown(t.amount) : '', t.kind === 'credit' ? Core.shown(t.amount) : '']))), 'text/csv'); },
  toggleBio: () => toggleBio(), changePass: () => changePass(), newCode: () => newCode(), logout: () => authGate(),
  help: d => showHelp(d.k), helpAll: () => helpAll(), guideOff: async () => { S.settings.guideDone = true; await save(); render(); },
  userEdit: d => userForm(d.id ? +d.id : null), lockClear: () => askPass(async () => { delete S.settings.lockDate; await save(); toast('قفل برداشته شد.'); render(); }), autoRestore: () => autoRestoreFlow(),
  backup: () => doBackup(), saveLocal: () => saveLocal(), resetData: () => resetDataFlow(), exitApp: () => exitPrompt(), restore: () => $('#restore-file').click(), setPin: () => setPin(),
  setTheme: async d => { S.settings.theme = d.v; applyAppearance(S.settings); await save(); render(); },
  setAccent: async d => { S.settings.accent = d.v; applyAppearance(S.settings); await save(); render(); },
  fontStep: async d => { const v = Number(d.v); S.settings.fontScale = v === 0 ? 1 : Math.round(Math.min(FS_MAX, Math.max(FS_MIN, (Number(S.settings.fontScale) || 1) + v * 0.1)) * 100) / 100; applyAppearance(S.settings); await save(); render(); },
  audit: () => { const p = Core.audit(S); S.settings.auditAt = today(); S.settings.auditIssues = p.length; save(); alertBox('نتیجه بررسی', p.length ? '<b class="debit">' + fa(p.length) + ' مشکل پیدا شد:</b><ul>' + p.slice(0, 10).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : ico('check') + 'همه‌چیز سالم است. حساب اشخاص، فاکتورها و موجودی انبار کاملاً هماهنگ‌اند.'); },
  wipe: async () => { if (!(await confirmBox('همه اطلاعات برنامه برای همیشه پاک می‌شود. قبلش پشتیبان گرفته‌اید؟', 'ادامه', true))) return; const sh = sheet('تأیید نهایی', '<p class="msg">برای تأیید، کلمه «حذف» را بنویسید.</p><input class="inp" id="wp"><button class="btn red" id="wp-ok">پاک کن</button>'); sh.q('#wp-ok').onclick = async () => { if (sh.q('#wp').value.trim() !== 'حذف') return toast('کلمه تأیید درست نیست.', true); sh.close(); const keep = Object.assign({}, S.settings); delete keep.openingCash; delete keep.lastBackup; S = Core.emptyState(); Object.assign(S.settings, keep); await save(); toast('همه اطلاعات پاک شد.'); goHash('#/home'); render(); }; }
};
function personFormInline() { // quick-add from invoice picker
  const sh = sheet('شخص جدید', '<form id="pq"><label class="fld"><span>نام</span><input class="inp" name="name" autocomplete="off"></label><label class="fld"><span>تلفن</span><input class="inp ltr" name="phone" inputmode="tel"></label><button class="btn blue" type="submit">ذخیره و انتخاب</button></form>');
  sh.q('#pq').onsubmit = async e => { e.preventDefault(); const f = e.target; const r = Core.addPerson(S, { name: f.name.value, phone: f.phone.value }); if (!r.ok) return toast(r.error, true); await save(); sh.close(); $('#nf [name=pid]').value = r.person.id; $('#nf-p').textContent = r.person.name; if ($('#nf-px')) $('#nf-px').hidden = false; };
  autoFocus(() => sh.q('[name=name]'));
}

/* ─────────── router / shell ─────────── */
const routes = {
  home: pageHome, people: pagePeople, person: pagePerson, invoices: pageInvoices, inv: pageInvoice, edit: (a) => { const i = Core.byId(S.invoices, +a); return i ? pageNewInvoice(i.type, { edit: i }) : { title: 'ویرایش', html: empty(ico('help'), 'فاکتور پیدا نشد.'), back: '#/invoices' }; }, new: (a) => pageNewInvoice(a, Object.fromEntries(new URLSearchParams((location.hash.split('?')[1]) || ''))),
  search: pageSearch, products: pageProducts, stock: pageStock, kardex: pageKardex, cheques: pageCheques, expenses: pageExpenses, reports: pageReports, more: pageMore, settings: pageSettings, accounts: pageAccounts, acct: pageAcct, recon: pageRecon, vouchers: pageVouchers, coa: pageCoa, fiscal: pageFiscal, warehouses: pageWarehouses, wh: pageWh
};
const navMap = { vouchers: 'more', coa: 'more', fiscal: 'more', warehouses: 'products', wh: 'products', search: 'home', home: 'home', people: 'people', person: 'people', invoices: 'invoices', inv: 'invoices', edit: 'invoices', new: 'invoices', products: 'products', stock: 'products', kardex: 'products', more: 'more', cheques: 'more', expenses: 'more', reports: 'more', settings: 'more', accounts: 'more', acct: 'more', recon: 'more' };
let lastRoute = '';
// update the page around a text box the user is typing in, without ever touching that box
// (re-creating it drops letters on Android keyboards that are still composing a word)
function softSwap(main, html, id) {
  const live = document.getElementById(id); if (!live || !main.contains(live)) return false;
  const tmp = document.createElement('div'); tmp.innerHTML = html; const nk = tmp.querySelector('#' + id); if (!nk) return false;
  let anchor = live; while (anchor.parentNode !== main) anchor = anchor.parentNode;
  let na = nk; while (na.parentNode !== tmp) na = na.parentNode;
  if (anchor.tagName !== na.tagName) return false;
  Array.from(main.childNodes).forEach(n => { if (n !== anchor) main.removeChild(n); });
  const kids = Array.from(tmp.childNodes), at = kids.indexOf(na);
  kids.slice(0, at).forEach(n => main.insertBefore(n, anchor));
  const after = kids.slice(at + 1), ref = anchor.nextSibling; after.forEach(n => main.insertBefore(n, ref));
  return true;
}
function render(opt) {
  const hash = (location.hash || '#/home').split('?')[0]; const [, page, arg] = hash.split('/'); const fn = routes[page] || routes.home;
  let res; try { res = routeAllowed(page) ? fn(arg) : { title: 'دسترسی محدود', html: empty(ico('lock'), 'برای دیدن این بخش اجازه ندارید. از مدیر برنامه بخواهید.', backTo('#/home')), back: '#/home' }; } catch (e) { console.error(e); diagLog('render', e.message, e.stack, hash); res = { title: 'خطا', html: '<div class="card"><b class="debit">خطای برنامه</b><p class="hint">' + esc(e.message) + '</p><p class="hint">لطفاً گزارش خطا را بفرستید تا برطرف شود. اطلاعات شما سالم است.</p><button class="btn green" data-act="reportWa">ارسال گزارش در واتساپ</button><button class="btn blue" data-act="go" data-h="#/home">بازگشت به خانه</button></div>' }; }
  const main = $('#main'), keep = main.scrollTop, same = lastRoute === hash; if (!(opt && opt.keepId && softSwap(main, res.html, opt.keepId))) main.innerHTML = res.html; main.scrollTop = same ? keep : 0; lastRoute = hash; lastFull = location.hash || '#/home';
  $('#title').textContent = res.title; const bk = $('#back'); bk.hidden = !res.back; bk.dataset.h = res.back || '';
  $$('.nav [data-nav]').forEach(b => b.classList.toggle('on', b.dataset.nav === (navMap[page] || 'home')));
  const fab = $('#fab'); fab.hidden = !res.fab; if (res.fab) { fab.dataset.act = res.fab[0]; if (res.fab[1] === '+') fab.innerHTML = ico('plus'); else fab.textContent = res.fab[1]; fab.dataset.t = (res.fabData && res.fabData.t) || ''; }
  enhanceMoney(main);
  if (res.fab && !actAllowed(fab)) fab.hidden = true;
  $$('#main [data-act]').forEach(el => { if (!featAllowed(el) || !actAllowed(el)) el.remove(); }); if (res.fab && !featAllowed(fab)) fab.hidden = true;
  if (res.mount) res.mount();
}
// what a sub-user may open / press
function routeAllowed(page) {
  page = page || ((location.hash || '#/home').split('?')[0].split('/')[1] || 'home');
  if (FEAT_ROUTE[page] && !feat(FEAT_ROUTE[page])) return false;
  if (isAdmin()) return true;
  const arg = (location.hash || '').split('?')[0].split('/')[2] || '';
  if (page === 'reports') return can('reports');
  if (page === 'accounts' || page === 'acct') return can('reports');
  if (page === 'recon') return can('reports') && can('money');
  if (page === 'vouchers') return can('money') && can('cost');
  if (page === 'coa' || page === 'fiscal') return false; // admin only
  if (page === 'warehouses' || page === 'wh') return can('warehouse');
  if (page === 'kardex') return can('cost');
  if (page === 'edit') return can('edit');
  if (page === 'new' && (arg === 'purchase' || arg === 'purchase_return')) return can('purchase');
  return true;
}
const ACT_PERM = { openImport: d => (d.k === 'stock' ? 'warehouse' : 'people'), stmtRange: 'balances', vchNew: 'money', coaAdd: 'admin', coaRen: 'admin', coaDel: 'admin', tafNew: 'admin', tafEdit: 'admin', fyClose: 'admin', fyReopen: 'admin', whNew: 'warehouse', whEdit: 'warehouse', whTxNew: 'warehouse', reconGo: 'money', acctNew: 'money', acctEdit: 'money', acctXfer: 'money', acctTx: 'money', acctExp: 'money', reconAdd: 'money', reconSave: 'money', addPerson: 'people', editPerson: 'people', archive: 'people', delPerson: 'people', bulkPeople: 'people', txForm: 'money', quickTx: 'money', transfer: 'money', payInv: 'money', addCheque: 'money', personChequeReceive: 'money', personChequePay: 'money', spendChequeHome: 'money', chqDone: 'money', chqReopen: 'edit', chqEdit: 'edit', chqDel: 'edit', addExpense: 'money', delInv: 'edit', addProduct: 'warehouse', bulkProducts: 'warehouse', whTools: 'warehouse', prodImport: 'warehouse', csvPeople: 'balances', csvStmt: 'balances', shareStmt: 'balances', csvLedger: 'reports', csvInvoices: 'reports', backup: 'backup', saveLocal: 'backup', restore: 'backup', autoRestore: 'backup', plGo: 'reports', resetData: 'admin', wipe: 'admin', activate: 'admin', userEdit: 'admin', lockClear: 'admin', audit: 'admin' };
function actAllowed(el) {
  if (isAdmin()) return true; const a = el.dataset.act, np = ACT_PERM[a], need = typeof np === 'function' ? np(el.dataset) : np;
  if (need) return need === 'admin' ? false : can(need);
  if (a === 'go') { const h = el.dataset.h || ''; if (h.startsWith('#/reports')) return can('reports'); if (h.startsWith('#/edit/')) return can('edit'); if (h.startsWith('#/kardex/')) return can('cost'); if (/^#\/new\/purchase/.test(h)) return can('purchase'); }
  if (a === 'newInv' && (el.dataset.t === 'purchase' || el.dataset.t === 'purchase_return')) return can('purchase');
  return true;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return; const fn = actions[b.dataset.act]; if (fn) { e.preventDefault(); try { const r = fn(b.dataset, b, e); if (r && r.catch) r.catch(x => { diagLog('action', x && x.message || x, x && x.stack, b.dataset.act); toast('خطایی رخ داد؛ از تنظیمات «گزارش خطا» را بفرستید.', true); }); } catch (x) { diagLog('action', x.message, x.stack, b.dataset.act); toast('خطایی رخ داد؛ از تنظیمات «گزارش خطا» را بفرستید.', true); } }
});
let lastSearchMs = 0, searchT;
document.addEventListener('input', e => {
  const i = e.target; const m = { 'people-q': 'peopleQ', 'inv-q': 'invQ', 'prod-q': 'prodQ', 'expense-q': 'expenseQ', 'chq-q': 'chqQ', 'acct-q': 'acctQ', 'gs-q': 'searchQ', 'rep-pq': 'repPQ', 'doc-q': 'docQ' }[i.id]; if (!m) return; UI[m] = i.value; UI.limDoc = 60; UI.searchLim = 30; UI.limPeople = 150; UI.limInv = 100; UI.limProd = 100; clearTimeout(searchT); searchT = setTimeout(() => { if (!i.isConnected) return; const t0 = performance.now(); render({ keepId: i.id }); lastSearchMs = performance.now() - t0; }, i.id === 'gs-q' || lastSearchMs > 300 ? Math.min(1200, Math.max(i.id === 'gs-q' ? 250 : 180, lastSearchMs * 1.5)) : 180); // on a slow phone with a big file, wait a little longer so typing never piles up searches
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
let nextSession = null;
function authClose() { const o = $('#auth'); if (o) o.remove(); lockedNow = false; if (nextSession) { CUR = nextSession; nextSession = null; } else setAdminSession(); }
function pwField(name, label, ac) { return '<label class="fld"><span>' + label + '</span><input class="inp ltr" type="password" name="' + name + '" id="pw-' + name + '" autocomplete="' + (ac || 'current-password') + '"></label>'; }
function authGate(relock) {
  if (!S.settings.auth) { if (S.settings.pinHash && !legacyOk) { showLockLegacy(); return; } return authWelcome(); }
  lockedNow = true; bioCheck().then(() => { if (lockedNow) authLogin(); });
}
const restoreBtn = '<button type="button" class="btn ghost" id="a-rs">' + ico('folder') + 'بازیابی از فایل پشتیبان</button><input type="file" id="a-rf" accept=".json,application/json" hidden>';
function bindRestore(o) { const b = $('#a-rs', o), f = $('#a-rf', o); if (!b) return; b.onclick = () => f.click(); f.onchange = async e => { const file = e.target.files[0]; e.target.value = ''; if (file) await authRestore(await file.text()); }; }
function authWelcome() {
  lockedNow = true;
  const o = authOverlay('<h2>به فیکس کوییک خوش آمدید</h2><p class="hint center">اولین بار است که برنامه را باز می‌کنید؟</p><button type="button" class="btn blue" id="a-new">' + ico('user') + 'ثبت‌نام (کاربر جدید)</button><p class="hint center" style="margin-top:18px">قبلاً حساب داشته‌اید؟ فایل پشتیبان را انتخاب کنید تا اطلاعات، نام کاربری، رمز و کد بازیابی قبلی‌تان برگردد.</p>' + restoreBtn);
  $('#a-new', o).onclick = () => authRegister(); bindRestore(o);
}
async function authRestore(text) {
  const r = Core.parseBackup(text); if (!r.ok) return toast(r.error, true);
  const st = r.state, has = S.people.length + S.products.length + S.invoices.length + S.tx.length;
  const msg = 'این فایل شامل ' + fa(st.people.length) + ' شخص، ' + fa(st.products.length) + ' کالا و ' + fa(st.invoices.length) + ' فاکتور است' + (st.settings.auth ? ' (حساب کاربری «' + st.settings.auth.user + '»)' : '') + '.' + (has ? ' اطلاعات فعلی این گوشی با آن جایگزین می‌شود.' : '') + ' ادامه می‌دهید؟';
  if (!(await confirmBox(msg, 'بازیابی', !!has))) return;
  try { await kvSet('state_before_restore', JSON.stringify(S)); } catch (x) { /* ignore */ }
  const au0 = S.settings.auth; S = Object.assign(Core.emptyState(), st); S.settings.serialCoreStrict = true; if (!S.settings.auth && au0) S.settings.auth = au0; applySettings(S.settings); legacyOk = false; await licCheck(); await save();
  if (S.settings.auth) { toast('بازیابی شد. با نام کاربری و رمز قبلی وارد شوید.'); authGate(); }
  else if (S.settings.pinHash) { toast('بازیابی شد. رمز ۴ رقمی قبلی را بزنید.'); authGate(); }
  else { toast('اطلاعات بازیابی شد؛ این پشتیبان حساب کاربری نداشت. یک حساب بسازید.'); authRegister(); }
}
function authRegister() {
  lockedNow = true;
  const o = authOverlay('<h2>ثبت‌نام</h2><p class="hint center">یک نام کاربری و رمز برای ورود به برنامه بسازید. اطلاعات فعلی شما حفظ می‌شود.</p><form id="af"><label class="fld"><span>نام کاربری</span><input class="inp ltr" name="u" id="fq-user" autocomplete="username" autocapitalize="none"></label>' + pwField('p1', 'رمز (حداقل ۶ نویسه)', 'new-password') + pwField('p2', 'تکرار رمز', 'new-password') + '<label class="fld"><span>سؤال امنیتی (برای بازیابی رمز)</span><select class="inp" name="q">' + SEC_QS.map(q => '<option>' + q + '</option>').join('') + '</select></label><label class="fld"><span>پاسخ</span><input class="inp" name="a" autocomplete="off"></label><button class="btn blue" type="submit">ثبت‌نام</button></form>' + restoreBtn + (S.settings.auth ? '' : '<button type="button" class="lnk center" id="a-bk">بازگشت</button>'));
  bindRestore(o); const bk = $('#a-bk', o); if (bk) bk.onclick = authWelcome;
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
function lastUser() { let u = ''; try { u = localStorage.getItem('fq_lastuser') || ''; } catch (e) { /* ignore */ } const au = S.settings.auth || {}; return u && (findSubUser(u) || u.toLowerCase() === (au.user || '').toLowerCase()) ? u : (au.user || ''); }
function lastIsAdmin() { return lastUser().toLowerCase() === ((S.settings.auth || {}).user || '').toLowerCase(); }
function authLogin() {
  const au = S.settings.auth;
  const o = authOverlay('<h2>ورود</h2><form id="af"><label class="fld"><span>نام کاربری</span><input class="inp ltr" name="u" id="fq-user" value="' + esc(lastUser()) + '" autocomplete="username" autocapitalize="none"></label>' + pwField('p', 'رمز') + '<button class="btn blue" type="submit">ورود</button></form>' + (bioReady && lastIsAdmin() ? '<button class="btn ghost" id="bio" type="button">' + ico('finger') + 'ورود با اثر انگشت</button>' : '') + '<button class="lnk center" id="fg">رمز را فراموش کرده‌ام</button><button type="button" class="lnk center" id="a-rs">' + ico('folder') + 'بازیابی از فایل پشتیبان</button><input type="file" id="a-rf" accept=".json,application/json" hidden>');
  bindRestore(o);
  $('#af', o).onsubmit = async e => {
    e.preventDefault(); const f = e.target;
    if (Date.now() < failUntil) return toast('چند بار اشتباه زدید؛ ' + fa(Math.ceil((failUntil - Date.now()) / 1000)) + ' ثانیه صبر کنید.', true);
    const un = f.u.value.trim(), isAdm = un.toLowerCase() === au.user.toLowerCase();
    const ok = isAdm ? await hashPin(f.p.value, au.salt) === au.hash : await subLogin(un, f.p.value);
    if (ok) { failN = 0; try { localStorage.setItem('fq_lastuser', un); } catch (x) { /* ignore */ } if (!isAdm) { nextSession = CUR; } authClose(); if (!isAdm && !routeAllowed()) location.hash = '#/home'; render(); if (isAdm) offerBio(); return; }
    failN++; if (failN >= 5) { failUntil = Date.now() + Math.min(300, 15 * (failN - 4)) * 1000; } toast('نام کاربری یا رمز اشتباه است.', true); f.p.value = '';
  };
  $('#fg', o).onclick = authForgot;
  if (bioReady && lastIsAdmin()) { $('#bio', o).onclick = bioLogin; setTimeout(bioLogin, 350); }
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

/* ─────────── scanning into the invoice form ─────────── */
function scanIntoInvoice(text) {
  const f = $('#nf'); if (!f) return false;
  const p = findProductByCode(text);
  if (!p) {
    const type = f.type.value;
    if (type === 'purchase') { scanStop(); productForm(null, { inInvoice: true, barcode: /^FQP-/i.test(text) ? '' : text, onSaved: np => { putProductInRow(np); } }); return false; }
    toast('کالایی با کد «' + text + '» پیدا نشد.', true); return true;
  }
  putProductInRow(p); toast('➕ ' + p.name); return true;
}
// put a product into an invoice row: price = what this person paid last time (same kind of invoice), else the product's default price
function fillRowProduct(row, p) {
  const f = $('#nf'), type = f.type.value, pid = +f.pid.value || 0, saleSide = type === 'sale' || type === 'sale_return';
  row.dataset.pid = p.id; $('.pick', row).textContent = p.name; const pr = $('[name=price]', row);
  const last = Core.lastPrice(S, type, pid, p.id) || (type === 'sale_return' ? Core.lastPrice(S, 'sale', pid, p.id) : type === 'purchase_return' ? Core.lastPrice(S, 'purchase', pid, p.id) : null);
  if (!pr.value) { const dp = last ? last.price : saleSide ? p.salePrice : p.buyPrice; if (dp) pr.value = Core.fmtInput(dp); }
  const stk = Core.replay(S).stock[p.id], have = stk ? stk.stock : 0;
  const avgC = can('cost') ? Math.round((Core.replay(S).stock[p.id] || { avg: 0 }).avg) : 0;
  $('.stk', row).innerHTML = esc('موجودی فعلی: ' + Core.fmtQty(have) + ' ' + p.unit) + (avgC ? ' · میانگین خرید: <b>' + fmt(avgC) + '</b>' : '') + (last ? ' · <b class="lastp">آخرین قیمت ' + (saleSide ? 'به' : 'از') + ' همین شخص: ' + fmt(last.price) + ' (' + fmtDate(last.date) + ')</b>' : '');
  $('.stk', row).classList.toggle('debit', have <= 0);
  if (have <= 0 && (type === 'sale' || type === 'purchase_return')) toast('«' + p.name + '» موجودی ندارد؛ فاکتور بدون موجودی ثبت نمی‌شود.', true);
  const n = syncSerialBtn(row);
  calcInvoice();
  if (n && !$('[name=sn]', row).value.trim() && Core.serialRequired(S, p)) setTimeout(() => serialPicker(row), 120); // phones: choose the device right away
}
// «انتخاب از موجودی»: the serials of this product that are in stock, for sales and returns to the supplier
function serialStockFor(row) {
  const f = $('#nf'), type = f.type.value, pid = +row.dataset.pid; if (!pid || (type !== 'sale' && type !== 'purchase_return')) return [];
  const editId = +f.dataset.edit || 0, used = new Set();
  $$('.it-row', f).forEach(r => { if (r !== row) Core.extractSerials($('[name=sn]', r).value).forEach(x => used.add(x)); });
  return Core.serialsInStock(S, pid, editId, f.wh ? +f.wh.value : null).filter(x => !used.has(x.serial));
}
function syncSerialBtn(row) {
  const b = $('.snpick', row); if (!b) return 0; const list = serialStockFor(row);
  b.hidden = !list.length; const have = new Set(list.map(x => x.serial)), k = Core.extractSerials($('[name=sn]', row).value).filter(x => have.has(x)).length;
  b.innerHTML = ico('tag') + (k ? fa(k) + ' سریال انتخاب شده از ' + fa(list.length) + ' · تغییر' : 'انتخاب سریال از موجودی (' + fa(list.length) + ')'); return list.length;
}
function serialPicker(row) {
  const list = serialStockFor(row); if (!list.length) return toast('سریالی از این کالا در انبار ثبت نشده است.', true);
  const p = Core.byId(S.products, +row.dataset.pid), cur = new Set(Core.extractSerials($('[name=sn]', row).value));
  const sh = sheet('انتخاب سریال / IMEI', '<p class="hint"><b>' + esc(p ? p.name : '') + '</b> · ' + fa(list.length) + ' دستگاه در انبار. دستگاه‌هایی را که می‌فروشید انتخاب کنید؛ تعداد خودکار تنظیم می‌شود.</p>' + (list.length > 6 ? '<input class="inp" id="snq" inputmode="numeric" placeholder="جستجو با چند رقم اول یا آخر…" autocomplete="off">' : '') +
    '<div class="snlist">' + list.map(x => '<label class="chk rs sni" data-s="' + esc(x.serial) + '"><input type="checkbox" value="' + esc(x.serial) + '"' + (cur.has(x.serial) ? ' checked' : '') + '><span><b class="ltr snum">' + esc(x.serial) + '</b><small>' + (x.type === 'sale_return' ? 'مرجوعی از ' : 'خرید از ') + esc(personName(x.personId)) + ' · ' + fmtDate(x.date) + ' · فاکتور ' + fa(x.no) + (can('cost') && x.price ? ' · ' + fmt(x.price) : '') + (x.luhn === false ? ' · <span class="debit">IMEI نامعتبر</span>' : '') + '</small></span></label>').join('') + '</div>' +
    '<div class="row2"><button type="button" class="btn blue" data-ok>تأیید</button><button type="button" class="btn ghost" data-close>انصراف</button></div>', { tall: list.length > 5 });
  const q = sh.q('#snq'); if (q) q.addEventListener('input', () => { const v = Core.toEn(q.value).replace(/\D/g, ''); sh.qa('.sni').forEach(el => { el.hidden = !!v && !el.dataset.s.includes(v); }); });
  sh.q('[data-ok]').onclick = () => {
    const pick = sh.qa('.sni input:checked').map(i => i.value); sh.close();
    const sn = $('[name=sn]', row), other = sn.value.replace(/[A-Za-z0-9۰-۹]{6,20}/g, t => (Core.extractSerials(t).length ? '' : t)).replace(/\s+/g, ' ').trim(); // keep any words that are not serials
    sn.value = (pick.join(' ') + (other ? ' ' + other : '')).trim();
    if (pick.length) $('[name=qty]', row).value = fa(pick.length);
    calcInvoice(); syncSerialBtn(row);
  };
}
function putProductInRow(p) {
  const rows = $$('.it-row');
  const same = rows.find(r => +r.dataset.pid === p.id && !$('[name=sn]', r).value.trim());
  if (same) { const q = $('[name=qty]', same); q.value = fa(Core.toEn(q.value) * 1 + 1 || 1); calcInvoice(); return; }
  let row = rows.find(r => !r.dataset.pid); if (!row) { addRow(); const all = $$('.it-row'); row = all[all.length - 1]; }
  fillRowProduct(row, p);
}

/* ─────────── free limit & unlimited version ─────────── */
let licOk = false, licInfo = { ok: false, exp: null }, devCodeCache = null;
async function myDeviceCode() {
  if (devCodeCache) return devCodeCache;
  let raw = null;
  try { const P = window.Capacitor && window.Capacitor.Plugins; if (isNative() && P && P.Device && P.Device.getId) { const r = await P.Device.getId(); raw = r && (r.identifier || r.uuid); } } catch (e) { /* ignore */ }
  if (!raw) { try { raw = await kvGet('device_id'); } catch (e) { /* ignore */ } if (!raw) { raw = 'w-' + Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join(''); try { await kvSet('device_id', raw); } catch (e) { /* ignore */ } } }
  devCodeCache = await License.deviceCodeFrom(raw); return devCodeCache;
}
async function licCheck() {
  const l = S.settings.license; licOk = false; licInfo = { ok: false, exp: null };
  if (l && l.code) licInfo = await License.check(l.code, await myDeviceCode());
  licOk = licInfo.ok && (!licInfo.exp || licNow() <= licInfo.exp);
  return licOk;
}
// today for the license, never earlier than the latest day the app has seen (moving the phone's clock back does not extend it)
function licNow() { let ls = ''; try { ls = localStorage.getItem('fq_seen') || ''; } catch (e) { /* ignore */ } const m = [today(), S.settings.licSeen || '', ls].sort().pop(); S.settings.licSeen = m; try { localStorage.setItem('fq_seen', m); } catch (e) { /* ignore */ } return m; }
const licDaysLeft = () => (licInfo.ok && licInfo.exp ? Core.diffDays(licNow(), licInfo.exp) : null);
const licExpired = () => !!(licInfo.ok && licInfo.exp && licNow() > licInfo.exp);
function licStatus() { if (licExpired()) return 'اعتبار نسخه نامحدود در ' + fmtDate(licInfo.exp) + ' تمام شده است.'; if (!licOk) return ''; if (!licInfo.exp) return 'نسخه نامحدود فعال است (بدون تاریخ انقضا).'; return 'نسخه نامحدود فعال است تا ' + fmtDate(licInfo.exp) + ' (' + fa(licDaysLeft()) + ' روز مانده).'; }
function usedDocs() { let ls = 0; try { ls = +localStorage.getItem('fq_used') || 0; } catch (e) { /* ignore */ } return Math.max(License.countDocs(S), S.settings.usedDocs || 0, ls); }
function bumpUsage() { const n = usedDocs(); S.settings.usedDocs = n; try { localStorage.setItem('fq_used', String(n)); } catch (e) { /* ignore */ } }
function freeLeft() { return Math.max(0, License.FREE_LIMIT - usedDocs()); }
// call before creating a new invoice / receipt / payment / transfer / expense
function gate() { if (licOk || freeLeft() > 0) return true; paywall(true); return false; }
async function paywall(blocked) {
  const dev = await myDeviceCode(), used = usedDocs();
  const renew = licExpired() || (licOk && licInfo.exp && licDaysLeft() <= 30), done = licOk && !renew;
  const msg = 'سلام، درخواست ' + (renew ? 'تمدید' : 'فعال‌سازی') + ' نسخه نامحدود حسابداری فیکس کوییک را دارم.\nکد دستگاه: ' + dev + '\n(تصویر رسید واریز را هم می‌فرستم)';
  const sh = sheet(done ? 'نسخه نامحدود' : renew ? 'تمدید نسخه نامحدود' : 'فعال‌سازی نسخه نامحدود', done ? '<div class="alert">' + ico('check') + licStatus() + '</div><p class="hint">' + esc(License.TERM_TEXT) + '</p><p class="hint">کد دستگاه: <b class="ltr">' + dev + '</b></p>' :
    (renew ? '<div class="alert' + (licExpired() ? ' warn' : '') + '">' + licStatus() + (licExpired() ? ' اطلاعات شما سالم است و می‌توانید همه را ببینید، پشتیبان بگیرید و چاپ کنید؛ برای ثبت سند جدید تمدید کنید.' : ' برای ادامه بدون وقفه، از همین حالا تمدید کنید؛ اعتبار تازه از روز صدور کد حساب می‌شود.') + '</div>' : blocked ? '<div class="alert warn">ثبت رایگان شما (' + fa(License.FREE_LIMIT) + ' فاکتور و سند) تمام شده است. اطلاعات شما سالم است و می‌توانید همه را ببینید، پشتیبان بگیرید و چاپ کنید؛ برای ثبت جدید، نسخه نامحدود را فعال کنید.</div>' : '<p class="hint">تا الان ' + fa(Math.min(used, License.FREE_LIMIT)) + ' از ' + fa(License.FREE_LIMIT) + ' سند رایگان استفاده شده است.</p>') +
    '<div class="paybox"><div class="step"><b>۱</b><span>مبلغ <b>' + esc(License.PRICE_TEXT) + '</b> را به کارت زیر واریز کنید:<br><b class="ltr cardno">' + esc(License.CARD_NO) + '</b><br>به نام ' + esc(License.CARD_OWNER) + ' · ' + esc(License.CARD_BANK) + '<br><button type="button" class="lnk" id="pw-card">کپی شماره کارت</button><br><small class="hint">' + esc(License.TERM_TEXT) + '</small></span></div>' +
    '<div class="step"><b>۲</b><span>تصویر رسید و کد دستگاه زیر را در واتساپ بفرستید:<br><b class="ltr devc">' + dev + '</b></span></div><div class="row2"><button type="button" class="btn green" id="pw-wa">ارسال در واتساپ</button><button type="button" class="btn ghost" data-act="copyDev">کپی کد دستگاه</button></div>' +
    '<div class="step"><b>۳</b><span>کد فعال‌سازی را که برایتان فرستاده می‌شود اینجا بچسبانید:</span></div><textarea class="inp ltr" id="pw-code" rows="3" style="height:auto;padding:10px" placeholder="XXXXX-XXXXX-…"></textarea><button type="button" class="btn blue" id="pw-ok">فعال‌سازی</button></div><p class="hint">کد فعال‌سازی فقط روی همین گوشی کار می‌کند.</p>');
  if (done) return;
  sh.q('#pw-card').onclick = async () => { try { await navigator.clipboard.writeText(License.CARD_NO.replace(/-/g, '')); toast('شماره کارت کپی شد.'); } catch (e) { toast(License.CARD_NO); } };
  sh.q('#pw-wa').onclick = () => { const a = document.createElement('a'); a.href = 'https://wa.me/' + License.SUPPORT_WA + '?text=' + encodeURIComponent(msg); a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); };
  sh.q('#pw-ok').onclick = async () => {
    const code = sh.q('#pw-code').value; if (!License.normCode(code)) return toast('کد فعال‌سازی را وارد کنید.', true);
    const r = await License.check(code, dev);
    if (r.ok && r.exp && licNow() > r.exp) return toast('تاریخ اعتبار این کد (' + fmtDate(r.exp) + ') گذشته است. کد تازه بگیرید.', true);
    if (r.ok) { S.settings.license = { code: License.normCode(code), dev, at: Date.now() }; licInfo = r; licOk = true; await save(); sh.close(); alertBox('🎉 فعال شد', 'نسخه نامحدود روی این ' + DEV + ' فعال شد' + (r.exp ? ' و تا ' + fmtDate(r.exp) + ' معتبر است' : '') + '. از اعتماد شما سپاسگزاریم.'); render(); }
    else toast('کد فعال‌سازی درست نیست یا برای ' + DEV + ' دیگری صادر شده است.', true);
  };
}

/* ─────────── Android back button / leaving the app ─────────── */
const capApp = () => { const P = window.Capacitor && window.Capacitor.Plugins; return isNative() && P ? (P.App || null) : null; };
let exitOpen = false;
function exitPrompt() {
  if (exitOpen) return; exitOpen = true;
  const days = S.settings.lastBackup ? Core.diffDays(S.settings.lastBackup, today()) : null;
  const last = days === null ? 'هنوز هیچ پشتیبانی نگرفته‌اید.' : days === 0 ? 'آخرین پشتیبان: امروز' : 'آخرین پشتیبان: ' + fa(days) + ' روز پیش (' + fmtDate(S.settings.lastBackup) + ')';
  const quit = () => { if (DESK) return window.fqDesktop.exit(); const A = capApp(); if (A && A.exitApp) A.exitApp(); else toast('برای خروج، برنامه را ببندید.'); };
  const sh = sheet('خروج از برنامه', '<div class="exitbox">' + ico('save', 'big') + '<p class="msg">قبل از خروج، از اطلاعات پشتیبان بگیرید تا اگر ' + DEV + ' خراب یا گم شد، حساب‌هایتان از بین نرود.</p><p class="hint center">' + last + '</p></div><button class="btn green" data-bk>' + ico('save') + 'پشتیبان بگیر و خارج شو</button><button class="btn ghost" data-q>' + ico('exit') + 'خروج بدون پشتیبان</button><button class="btn ghost" data-close>انصراف (ماندن در برنامه)</button>', { onClose: () => { exitOpen = false; if (DESK) window.fqDesktop.cancelClose(); } });
  if (!can('backup')) sh.q('[data-bk]').remove(); else sh.q('[data-bk]').onclick = async () => { if (await doBackup(true)) { sh.close(true); exitOpen = false; quit(); } else toast('پشتیبان گرفته نشد.', true); };
  sh.q('[data-q]').onclick = () => { sh.close(true); exitOpen = false; quit(); };
}
function onBackButton() {
  if (document.getElementById('scan')) return scanStop();
  if (lockedNow) { const A = capApp(); if (A) A.exitApp(); return; }
  const top = sheetStack[sheetStack.length - 1];
  if (top) { if (!top.o.lock) top.close(); return; }
  const bk = $('#back'); const page = (location.hash || '#/home').split('?')[0].split('/')[1] || 'home';
  if (bk && !bk.hidden && bk.dataset.h) return goHash(bk.dataset.h);
  if (page !== 'home') return goHash('#/home');
  exitPrompt();
}
async function boot() {
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ignore */ }
  try { await loadState(); } catch (e) {
    const message = e && e.message || String(e);
    document.body.innerHTML = '<div style="direction:rtl;padding:24px;max-width:550px;margin:12vh auto;font:16px/2 sans-serif"><h2>محافظت از اطلاعات حسابداری</h2><p>خواندن اطلاعات قبلی با مشکل روبه‌رو شد و برنامه برای جلوگیری از جایگزینی آن‌ها با اطلاعات خالی متوقف شده است.</p><p>' + esc(message) + '</p><b>برنامه را حذف نکنید و داده‌های آن را پاک نکنید. برای بررسی و بازیابی، از فایل پشتیبان موجود استفاده کنید.</b></div>';
    return;
  }
  try { await licCheck(); } catch (e) { /* ignore */ } render(); $('#splash').remove();
  authGate();
  try { const A = capApp(); if (A && A.addListener) A.addListener('backButton', onBackButton); } catch (e) { /* older build without the App plugin: Android's default back */ }
  if (DESK) window.fqDesktop.onClose(() => { if (lockedNow || !S.settings.auth) return window.fqDesktop.exit(); exitPrompt(); });
  // heavy background jobs are spread out, so the first seconds after opening stay responsive even with a very large file
  setTimeout(() => { try { Core.search(S, 'ا'); } catch (e) { /* warm up the search index */ } }, 6000); setTimeout(() => weeklyAudit(), 12000); setTimeout(() => autoBackup(), 20000);
  let hiddenAt = 0; document.addEventListener('visibilitychange', () => { if (document.hidden) { hiddenAt = Date.now(); if (Date.now() - autoBkAt > 30 * 60e3) autoBackup(true); return; } autoBackup(); if (hiddenAt && Date.now() - hiddenAt > 60e3 && !lockedNow) authGate(true); });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !isNative()) navigator.serviceWorker.register('sw.js').catch(() => { });
}
window.addEventListener('DOMContentLoaded', boot);

document.addEventListener('change', e => {
  const t = e.target; if (!(t instanceof HTMLSelectElement)) return;
  if (t.hasAttribute('data-repsort')) { UI.repPSort = t.value; UI.limRep = 60; render(); }
  else if (t.hasAttribute('data-repgsort')) { UI.repGSort = t.value; UI.limRep = 60; render(); }
});
