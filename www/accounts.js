/* Cash boxes and bank accounts: balances, ledgers, transfers, bank statement reconciliation; accounting reports (trial balance, balance sheet, journal). */
'use strict';

/* ── picking an account in forms ── */
function acctList() { Core.migrate(S); return S.accounts.filter(a => !a.archived); }
function defaultBankId() { const L = acctList(); const b = L.find(a => a.kind === 'bank'); return (b || L[0]).id; }
function acctSel(cur, name, label) {
  const L = acctList(), c = cur != null && L.some(a => a.id === +cur) ? +cur : (L.find(a => a.kind === 'cash') || L[0]).id;
  const grp = (k, t) => { const g = L.filter(a => a.kind === k); return g.length ? '<optgroup label="' + t + '">' + g.map(a => '<option value="' + a.id + '"' + (a.id === c ? ' selected' : '') + '>' + esc(Core.acctName(a)) + '</option>').join('') + '</optgroup>' : ''; };
  return '<label class="fld"><span>' + (label || 'صندوق / بانک') + '</span><select class="inp" name="' + (name || 'acct') + '">' + grp('cash', 'صندوق') + grp('bank', 'بانک') + '</select></label>';
}
// accounting rule: a cash box can't pay out more than it holds
async function cashGuard(acctId, amount, date) {
  const a = Core.byId(S.accounts || [], acctId); if (!a || a.kind !== 'cash' || !(amount > 0)) return true;
  const bal = Core.accountBalances(S)[acctId], after = bal - amount; if (after >= 0) return true;
  return confirmBox(can('reports') ? 'موجودی «' + Core.acctName(a) + '» ' + fmt(bal) + ' ' + UNIT() + ' است و با این پرداخت ' + fmt(Math.abs(after)) + ' منفی می‌شود. صندوق نباید منفی شود؛ شاید پول از بانک برداشته‌اید یا موجودی اول دوره ثبت نشده. باز هم ثبت شود؟' : 'موجودی «' + Core.acctName(a) + '» برای این پرداخت کافی نیست و منفی می‌شود. باز هم ثبت شود؟', 'ثبت کن');
}
const payWhere = x => { const a = x && x.acct != null && S.accounts ? Core.byId(S.accounts, x.acct) : null; return a ? Core.acctName(a) : (Core.METHODS[x && x.method] || ''); };
const maskCard = c => (c && c.length === 16 ? Core.toFa(c.slice(0, 4) + '-' + c.slice(4, 8) + '-' + c.slice(8, 12) + '-' + c.slice(12)) : Core.toFa(c || ''));

// a money movement row opens its own document: receipt/payment, expense, transfer between accounts, voucher, cheque
const moveOpen = r => (r.tx ? 'data-act="txOpen" data-id="' + r.tx.id + '"' : r.exp ? 'data-act="expOpen" data-id="' + r.exp.id + '"' : r.xfer ? 'data-act="acctXferOpen" data-id="' + r.xfer.id + '"' : r.vch ? 'data-act="vchOpen" data-id="' + r.vch.id + '"' : r.chq ? 'data-act="chqView" data-id="' + r.chq.id + '"' : '');
/* ── accounts list ── */
function pageAccounts() {
  const L = Core.migrate(S).accounts, bal = Core.accountBalances(S), q = (UI.acctQ || '').trim(), show = (UI.acctArch ? L : L.filter(a => !a.archived)).filter(a => !q || Core.smartMatchRecord([Core.acctName(a), a.accNo, a.card, a.sheba, a.owner, a.branch].join(' '), q));
  const sum = k => L.filter(a => a.kind === k).reduce((t, a) => t + bal[a.id], 0);
  let h = tipBox('acctlist') + '<div class="kpis"><div class="kpi"><small>جمع صندوق‌ها</small><b>' + fmt(sum('cash')) + '</b></div><div class="kpi"><small>جمع بانک‌ها</small><b>' + fmt(sum('bank')) + '</b></div></div>';
  h += '<div class="toolbar"><button class="btn blue sm" data-act="acctNew" data-k="bank">' + ico('plus') + 'حساب بانکی</button><button class="btn ghost sm" data-act="acctNew" data-k="cash">' + ico('plus') + 'صندوق</button><button class="btn ghost sm" data-act="acctXfer">' + ico('transfer') + 'انتقال وجه</button></div>' + (can('money') ? '<button class="btn green" data-act="reconGo">' + ico('scale') + 'مغایرت‌گیری بانک (آپلود صورت‌حساب)</button>' : '');
  h += sbox('acct-q', 'acctQ', 'جستجوی بانک، شماره کارت، حساب، شبا…', q);
  const row = a => { const last = S.recons.filter(r => r.acct === a.id).slice(-1)[0];
    return '<button class="row" data-act="go" data-h="#/acct/' + a.id + '"><span><b>' + ico(a.kind === 'bank' ? 'scale' : 'wallet') + esc(Core.acctName(a)) + (a.archived ? ' <small class="hint">(بایگانی)</small>' : '') + '</b><small>' + (a.kind === 'bank' ? [a.accNo ? 'حساب ' + Core.toFa(a.accNo) : '', a.card ? 'کارت …' + Core.toFa(a.card.slice(-4)) : ''].filter(Boolean).join(' · ') || 'بانک' : 'صندوق نقدی') + (last ? ' · مغایرت‌گیری: ' + fmtDate(last.at) + (last.diff ? ' (اختلاف ' + fmt(Math.abs(last.diff)) + ')' : ' ✓') : '') + '</small></span><em class="' + (bal[a.id] < 0 ? 'debit' : '') + '">' + fmt(bal[a.id]) + '</em></button>'; };
  h += '<div class="card flush">' + show.map(row).join('') + '</div>';
  if (L.some(a => a.archived)) h += '<button class="lnk" data-act="chip" data-k="acctArch" data-v="' + (UI.acctArch ? '' : '1') + '">' + (UI.acctArch ? 'پنهان کردن بایگانی‌شده‌ها' : 'نمایش بایگانی‌شده‌ها') + '</button>';
  h += '<p class="hint">موجودی هر حساب = موجودی اول دوره + دریافت‌ها و واریزها − پرداخت‌ها، هزینه‌ها و برداشت‌ها. انتقال بین حساب‌های خودتان درآمد یا هزینه نیست. هر دریافت، پرداخت و هزینه را روی همان صندوق یا بانکی ثبت کنید که پول واقعاً از آن جابه‌جا شده تا مغایرت‌گیری درست دربیاید.</p>';
  return { title: 'صندوق و بانک‌ها', html: h, back: '#/more' };
}
/* ── one account: details, ledger with running balance, reconciliations ── */
function pageAcct(arg) {
  Core.migrate(S); const a = Core.byId(S.accounts, +arg); if (!a) return { title: 'حساب', html: empty(ico('help'), 'حساب پیدا نشد.'), back: '#/accounts' };
  const k = UI.acctRange || 'mtd', rg = k === 'all' ? { from: null, to: null } : Core.periodRange(k, today(), fyMonth()), L = Core.accountLedger(S, a.id, rg.from, rg.to), now = Core.accountBalances(S)[a.id];
  let h = '<div class="card acct-h"><div class="ch">' + ico(a.kind === 'bank' ? 'scale' : 'wallet') + esc(Core.acctName(a)) + (can('money') ? '<button class="lnk" data-act="acctEdit" data-id="' + a.id + '">' + ico('edit') + 'ویرایش</button>' : '') + '</div>' +
    '<div class="kv">' + (a.kind === 'bank' ? (a.accNo ? '<span>شماره حساب</span><b class="ltr">' + Core.toFa(a.accNo) + '</b>' : '') + (a.card ? '<span>شماره کارت</span><b class="ltr">' + maskCard(a.card) + '</b>' : '') + (a.sheba ? '<span>شبا</span><b class="ltr">' + esc(a.sheba) + '</b>' : '') + (a.branch ? '<span>شعبه</span><b>' + esc(a.branch) + '</b>' : '') + (a.owner ? '<span>صاحب حساب</span><b>' + esc(a.owner) + '</b>' : '') : '') +
    '<span>موجودی اول دوره</span><b>' + fmt(a.opening || 0) + '</b><span>موجودی فعلی</span><b class="big ' + (now < 0 ? 'debit' : 'credit') + '">' + fmt(now) + ' ' + UNIT() + '</b></div>' +
    (a.kind === 'bank' && (a.card || a.sheba || a.accNo) ? '<button class="btn ghost sm" data-act="acctShare" data-id="' + a.id + '">' + ico('share') + 'ارسال مشخصات حساب</button>' : '') + '</div>';
  if (can('money') && a.kind === 'bank') h += '<button class="btn green" data-act="go" data-h="#/recon/' + a.id + '">' + ico('scale') + 'مغایرت‌گیری این بانک</button>';
  if (can('money')) h += '<div class="hsmall acts">' + [['acctXfer', 'transfer', 'انتقال وجه'], ['acctTx', 'in', 'دریافت', 'receipt'], ['acctTx', 'out', 'پرداخت', 'payment'], ['acctExp', 'wallet', 'هزینه']].map(x => '<button class="hq2" data-act="' + x[0] + '" data-id="' + a.id + '"' + (x[3] ? ' data-t="' + x[3] + '"' : '') + (x[4] ? ' data-h="' + x[4] + '"' : '') + '>' + ico(x[1]) + '<span>' + x[2] + '</span></button>').join('') + '</div>';
  h += chips('acctRange', k, [['today', 'امروز'], ['week', 'این هفته'], ['mtd', 'این ماه'], ['prevmonth', 'ماه قبل'], ['fytd', 'امسال'], ['all', 'همه']]);
  const inn = L.rows.reduce((t, r) => t + Math.max(r.amt, 0), 0), out = L.rows.reduce((t, r) => t + Math.max(-r.amt, 0), 0);
  h += '<div class="rsum"><span>ورودی <b class="credit">' + fmt(inn) + '</b> · خروجی <b class="debit">' + fmt(out) + '</b></span><span>' + fa(L.rows.length) + ' گردش</span></div>';
  const open = moveOpen;
  const lim = UI.limAcct || 150, rows = L.rows.slice().reverse();
  h += '<div class="card flush aled">' + (rows.length ? rows.slice(0, lim).map(r => '<button class="xr" ' + open(r) + '><span><b>' + esc(fa(r.desc || Core.TYPE_FA[r.kind] || '')) + (r.rec ? ' <i class="okc" title="مغایرت‌گیری شده">✓</i>' : '') + '</b><small>' + fmtDate(r.date) + (r.personId ? ' · ' + esc(personName(r.personId)) : '') + '</small></span><span class="end"><em class="' + (r.amt > 0 ? 'credit' : 'debit') + '">' + (r.amt > 0 ? '+' : '−') + fmt(Math.abs(r.amt)) + '</em><small>مانده ' + fmt(r.bal) + '</small></span></button>').join('') : '<div class="empty">در این بازه گردشی نیست.</div>') + (rg.from ? '<div class="xr carry"><span><b>مانده از قبل</b></span><span class="end"><em>' + fmt(L.carry) + '</em></span></div>' : '') + '</div>';
  if (rows.length > lim) h += '<button class="btn ghost" data-act="more" data-k="limAcct">نمایش بیشتر</button>';
  const rc = S.recons.filter(r => r.acct === a.id).slice(-8).reverse();
  if (rc.length) h += '<div class="card"><div class="ch">' + ico('scale') + 'مغایرت‌گیری‌های قبلی</div>' + rc.map(r => '<div class="rr"><span>' + fmtDate(r.from) + ' تا ' + fmtDate(r.to) + '<small> · ' + fa(r.matched) + ' تطبیق · ثبت ' + fmtDate(r.at) + '</small></span><b class="' + (r.diff ? 'debit' : 'credit') + '">' + (r.diff == null ? '—' : r.diff ? 'اختلاف ' + fmt(Math.abs(r.diff)) : 'بدون اختلاف ✓') + '</b></div>').join('') + '</div>';
  h += '<div class="toolbar rexp"><button class="btn ghost sm" data-act="acctCsv" data-id="' + a.id + '">' + ico('file') + 'خروجی اکسل گردش حساب</button></div>';
  return { title: Core.acctName(a), html: h, back: '#/accounts' };
}
function accountForm(a, kind) {
  kind = a ? a.kind : kind || 'bank'; const bank = kind === 'bank';
  const sh = sheet(a ? 'ویرایش ' + (bank ? 'حساب بانکی' : 'صندوق') : bank ? 'حساب بانکی جدید' : 'صندوق جدید', '<form id="acf">' +
    (bank ? '<label class="fld"><span>نام بانک</span><input class="inp" name="bank" list="bank-list" autocomplete="off" value="' + esc(a ? a.bank || '' : '') + '" placeholder="مثلاً ملت"></label><datalist id="bank-list">' + Core.BANKS.map(b => '<option value="' + esc(b) + '">').join('') + '</datalist>' : '') +
    '<label class="fld"><span>' + (bank ? 'عنوان (اختیاری، مثلاً «حساب جاری مغازه»)' : 'نام صندوق') + '</span><input class="inp" name="name" value="' + esc(a ? (bank && a.name === a.bank ? '' : a.name) : bank ? '' : 'صندوق') + '"></label>' +
    (bank ? '<label class="fld"><span>شماره حساب</span><input class="inp ltr" name="accNo" inputmode="numeric" value="' + esc(a ? Core.toFa(a.accNo || '') : '') + '"></label><label class="fld"><span>شماره کارت (۱۶ رقم)</span><input class="inp ltr" name="card" inputmode="numeric" value="' + esc(a ? Core.toFa(a.card || '') : '') + '"></label><label class="fld"><span>شماره شبا (بدون IR هم قبول است)</span><input class="inp ltr" name="sheba" value="' + esc(a ? a.sheba || '' : '') + '"></label><div class="row2"><label class="fld"><span>شعبه</span><input class="inp" name="branch" value="' + esc(a ? a.branch || '' : '') + '"></label><label class="fld"><span>به نام</span><input class="inp" name="owner" value="' + esc(a ? a.owner || '' : '') + '"></label></div>' : '') +
    moneyField('opening', a ? Math.abs(a.opening || 0) : 0, 'موجودی اول دوره (' + UNIT() + ')') + (bank ? '<label class="chk"><input type="checkbox" name="neg"' + (a && a.opening < 0 ? ' checked' : '') + '> موجودی اول دوره منفی است (اضافه‌برداشت)</label>' : '') +
    '<p class="hint">موجودی اول دوره = پولی که روز شروع کار با برنامه در این ' + (bank ? 'حساب' : 'صندوق') + ' بوده است؛ در موجودی، گزارش‌ها، تراز و مغایرت‌گیری حساب می‌شود.</p>' +
    (a ? '<label class="chk"><input type="checkbox" name="arch"' + (a.archived ? ' checked' : '') + '> بایگانی (در فرم‌ها نشان داده نشود)</label>' : '') +
    '<button class="btn blue" type="submit">ذخیره</button>' + (a ? '<button type="button" class="btn ghost red" data-del>' + ico('trash') + 'حذف</button>' : '') + '</form>');
  const f = sh.q('#acf'); const accountDraft=Drafts.attachSheet(sh,'account:'+kind+':'+(a ? 'edit:'+a.id : 'new'));
  f.onsubmit = async e => { e.preventDefault(); const op = f.opening.value.trim() === '' ? 0 : Core.parseMoney(f.opening.value); if (isNaN(op)) return toast('مبلغ نامعتبر است.', true);
    const d = { kind, name: f.name.value, opening: op * (f.neg && f.neg.checked ? -1 : 1) }; if (bank) Object.assign(d, { bank: f.bank.value, accNo: f.accNo.value, card: f.card.value, sheba: f.sheba.value, branch: f.branch.value, owner: f.owner.value }); if (a) d.archived = f.arch.checked;
    const r = a ? Core.editAccount(S, a.id, d) : Core.addAccount(S, d); if (await done(r, 'ذخیره شد.')) { accountDraft.clear(); sh.close(); } };
  const del = sh.q('[data-del]'); if (del) del.onclick = async () => { if (!(await confirmBox('این حساب حذف شود؟', 'حذف', true))) return; const r = Core.deleteAccount(S, a.id); if (await done(r, 'حذف شد.')) { sh.close(); goHash('#/accounts'); } };
  autoFocus(() => f.bank || f.name);
}
function acctTransferForm(fromId, x) {
  const sh = sheet(x ? 'انتقال وجه' : 'انتقال بین صندوق و بانک', '<form id="atf">' + acctSel(x ? x.from : fromId, 'from', 'از (مبدأ)') + acctSel(x ? x.to : (acctList().find(a => a.id !== +fromId) || {}).id, 'to', 'به (مقصد)') + moneyField('amount', x ? x.amount : 0, 'مبلغ (' + UNIT() + ')') + moneyField('fee', x ? x.fee : 0, 'کارمزد بانکی (اختیاری)') + dateField('date', x ? x.date : today()) + '<label class="fld"><span>شرح</span><input class="inp" name="desc" value="' + esc(x ? x.desc : '') + '" placeholder="مثلاً واریز نقدی به بانک"></label><p class="hint">برای واریز پول نقد صندوق به بانک، برداشت از بانک به صندوق یا انتقال بین دو بانک. درآمد یا هزینه حساب نمی‌شود؛ فقط کارمزد، هزینه است.</p><button class="btn blue" type="submit">ثبت</button>' + (x ? '<button type="button" class="btn ghost red" data-del>' + ico('trash') + 'حذف</button>' : '') + '</form>');
  const f = sh.q('#atf');
  const bankTransferDraft=Drafts.attachSheet(sh,'bank-transfer:'+(x ? 'edit:'+x.id : 'new'));
  f.onsubmit = async e => { e.preventDefault(); const date = readDate(f, 'date'), amount = Core.parseMoney(f.amount.value), fee = f.fee.value.trim() ? Core.parseMoney(f.fee.value) : 0; if (!date) return toast('تاریخ نامعتبر است.', true); if (!amount) return toast('مبلغ را وارد کنید.', true); if (isNaN(fee)) return toast('کارمزد نامعتبر است.', true);
    if (!(await cashGuard(+f.from.value, amount + fee - (x && x.from === +f.from.value ? x.amount + (x.fee || 0) : 0), date))) return;
    if (x) Core.deleteAcctTx(S, x.id); const r = Core.addAcctTx(S, { from: +f.from.value, to: +f.to.value, amount, fee, date, desc: f.desc.value }); if (!r.ok && x) S.acctTx.push(x); if (await done(r, 'انتقال ثبت شد.')) {bankTransferDraft.clear(); sh.close();} };
  const del = sh.q('[data-del]'); if (del) del.onclick = async () => { if (!(await confirmBox('این انتقال حذف شود؟', 'حذف', true))) return; Core.deleteAcctTx(S, x.id); await done({ ok: true }, 'حذف شد.'); sh.close(); };
}

/* ── bank statement reconciliation ── */
function pageRecon(arg) {
  Core.migrate(S); const a = Core.byId(S.accounts, +arg); if (!a) return { title: 'مغایرت‌گیری', html: empty(ico('help'), 'حساب پیدا نشد.'), back: '#/accounts' };
  const R = UI.recon && UI.recon.acct === a.id ? UI.recon : null;
  let h = tipBox('recon') + '<div class="card"><div class="ch">' + ico('scale') + 'مغایرت‌گیری ' + esc(Core.acctName(a)) + ' ' + help('recon') + '</div>' +
    '<label class="btn blue filebtn">' + ico('folder') + (R ? 'انتخاب فایل دیگر' : 'انتخاب فایل صورت‌حساب') + '<input type="file" id="recon-file" accept=".xlsx,.xls,.csv,.txt,.htm,.html" hidden></label>' + (R ? '<p class="hint center">' + esc(R.name) + ' · ' + fa(R.items.length) + ' ردیف</p>' : '') + '</div>';
  if (R) {
    const head = R.map.head || [], col = (k, t) => '<label class="fld"><span>' + t + '</span><select class="inp" data-rcol="' + k + '"><option value="">—</option>' + head.map((c, j) => '<option value="' + j + '"' + (R.map.cols[k] === j ? ' selected' : '') + '>' + esc(c || ('ستون ' + fa(j + 1))) + '</option>').join('') + '</select></label>';
    h += '<details class="card"' + (R.items.length ? '' : ' open') + '><summary class="ch">' + ico('settings') + 'ستون‌های فایل ' + (R.items.length ? '<small class="hint">(درست تشخیص داده شد؟)</small>' : '<small class="debit">ستون‌ها را مشخص کنید</small>') + '</summary><div class="g2">' + col('date', 'تاریخ') + col('desc', 'شرح') + col('wd', 'برداشت / بدهکار') + col('dep', 'واریز / بستانکار') + col('amt', 'مبلغ (+/−) اگر یک ستون است') + col('bal', 'مانده') + col('ref', 'شماره پیگیری') + '</div><label class="fld"><span>بازه تطبیق تاریخ</span><select class="inp" data-rdays>' + [0, 1, 2, 3, 5, 7].map(d => '<option value="' + d + '"' + (R.days === d ? ' selected' : '') + '>' + (d ? 'تا ' + fa(d) + ' روز اختلاف' : 'فقط همان روز') + '</option>').join('') + '</select></label></details>';
    if (R.items.length) {
      const res = Core.reconcile(S, a.id, R.items.slice(), { days: R.days }); UI.reconRes = res;
      const okB = res.diff === 0, tag = v => '<b class="' + (v ? 'debit' : 'credit') + '">' + (v ? fmt(Math.abs(v)) : 'صفر ✓') + '</b>';
      h += '<div class="card recon-sum"><div class="ch">' + ico('chart') + 'نتیجه · ' + fmtDate(res.from) + ' تا ' + fmtDate(res.to) + '</div><div class="kpis"><div class="kpi"><small>تطبیق‌شده</small><b class="credit">' + fa(res.matched.length) + '</b></div><div class="kpi"><small>فقط در بانک</small><b class="' + (res.bankOnly.length ? 'debit' : '') + '">' + fa(res.bankOnly.length) + '</b></div><div class="kpi"><small>فقط در برنامه</small><b class="' + (res.appOnly.length ? 'debit' : '') + '">' + fa(res.appOnly.length) + '</b></div><div class="kpi"><small>اختلاف مانده پایان</small>' + (res.diff == null ? '<b>—</b>' : tag(res.diff)) + '</div></div>' +
        (res.stmtClose != null ? '<div class="rr"><span>مانده پایان طبق بانک</span><b>' + fmt(res.stmtClose) + '</b></div>' : '') + '<div class="rr"><span>مانده پایان طبق برنامه</span><b>' + fmt(res.appClose) + '</b></div>' + (res.stmtOpen != null ? '<div class="rr sub"><span>مانده ابتدا: بانک ' + fmt(res.stmtOpen) + ' · برنامه ' + fmt(res.appOpen) + '</span>' + (res.stmtOpen !== res.appOpen ? '<b class="debit">اختلاف ' + fmt(Math.abs(res.stmtOpen - res.appOpen)) + '</b>' : '<b class="credit">✓</b>') + '</div>' : '') +
        (okB && !res.bankOnly.length && !res.appOnly.length ? '<div class="alert">' + ico('check') + 'حساب کاملاً با بانک یکی است.</div>' : res.stmtOpen != null && res.stmtOpen !== res.appOpen ? '<p class="hint">مانده ابتدای دوره هم فرق دارد: یا موجودی اول دوره این حساب درست نیست یا گردش‌های قبل از این صورت‌حساب کامل ثبت نشده.</p>' : '') + '</div>';
      if (res.bankOnly.length) h += '<div class="ch gs-h">در بانک هست، در برنامه نیست (' + fa(res.bankOnly.length) + ')</div><div class="card flush">' + res.bankOnly.map((it, k) => '<div class="row gsr rcn"><div class="gsl"><b class="' + (it.amt > 0 ? 'credit' : 'debit') + '">' + (it.amt > 0 ? 'واریز ' : 'برداشت ') + fmt(Math.abs(it.amt)) + '</b><small>' + fmtDate(it.date) + (it.desc ? ' · ' + esc(it.desc) : '') + (it.ref ? ' · پیگیری ' + esc(fa(it.ref)) : '') + '</small></div><span class="gsa">' + (it.amt > 0 ? '<button class="mini" data-act="reconAdd" data-k="' + k + '" data-t="receipt">ثبت دریافت</button>' : '<button class="mini" data-act="reconAdd" data-k="' + k + '" data-t="payment">پرداخت</button><button class="mini" data-act="reconAdd" data-k="' + k + '" data-t="expense">هزینه/کارمزد</button>') + '</span></div>').join('') + '</div>';
      if (res.appOnly.length) h += '<div class="ch gs-h">در برنامه هست، در بانک نیست (' + fa(res.appOnly.length) + ')</div><div class="card flush">' + res.appOnly.map(v => '<button class="xr" ' + moveOpen(v) + '><span><b>' + esc(fa(v.desc || '')) + '</b><small>' + fmtDate(v.date) + (v.personId ? ' · ' + esc(personName(v.personId)) : '') + ' · احتمالاً روی حساب دیگری ثبت شده یا هنوز به بانک نرسیده</small></span><span class="end"><em class="' + (v.amt > 0 ? 'credit' : 'debit') + '">' + (v.amt > 0 ? '+' : '−') + fmt(Math.abs(v.amt)) + '</em></span></button>').join('') + '</div>';
      if (res.matched.length) h += '<details class="card flush"><summary class="ch">' + ico('check') + 'تطبیق‌شده‌ها (' + fa(res.matched.length) + ')</summary>' + res.matched.map(m => '<div class="xr"><span><b>' + esc(fa(m.move.desc || '')) + '</b><small>بانک: ' + fmtDate(m.item.date) + (m.item.desc ? ' · ' + esc(m.item.desc) : '') + ' · برنامه: ' + fmtDate(m.move.date) + (m.gap ? ' (' + fa(m.gap) + ' روز فاصله)' : '') + '</small></span><span class="end"><em class="' + (m.item.amt > 0 ? 'credit' : 'debit') + '">' + fmt(Math.abs(m.item.amt)) + '</em></span></div>').join('') + '</details>';
      h += '<div class="toolbar rexp"><button class="btn blue sm" data-act="reconSave" data-id="' + a.id + '">' + ico('save') + 'ثبت نتیجه مغایرت‌گیری</button><button class="btn ghost sm" data-act="reconShare">' + ico('share') + 'ارسال گزارش مغایرت</button></div>';
    } else h += '<div class="alert warn">' + ico('alert') + 'ردیفی با تاریخ و مبلغ پیدا نشد. ستون‌های تاریخ و برداشت/واریز (یا مبلغ) را بالا مشخص کنید.</div>';
  }
  return { title: 'مغایرت‌گیری بانک', html: h, back: '#/acct/' + a.id, mount: () => {
    const inp = $('#recon-file'); if (inp) inp.onchange = async () => { const file = inp.files[0]; if (!file) return; try { toast('در حال خواندن فایل…'); const rows = await Core.readStatementFile(file.name, await file.arrayBuffer()); const map = Core.statementMap(rows); UI.recon = { acct: a.id, name: file.name, rows, map, days: 3, items: Core.statementItems(rows, map) }; render(); } catch (e) { toast(e.message || String(e), true); } inp.value = ''; };
  } };
}
document.addEventListener('change', e => {
  const t = e.target; if (!UI.recon || !(t instanceof HTMLSelectElement)) return;
  if (t.dataset.rcol) { const v = t.value === '' ? undefined : +t.value; if (v === undefined) delete UI.recon.map.cols[t.dataset.rcol]; else UI.recon.map.cols[t.dataset.rcol] = v; UI.recon.items = Core.statementItems(UI.recon.rows, UI.recon.map); render(); }
  else if (t.hasAttribute('data-rdays')) { UI.recon.days = +t.value; render(); }
});

const ACCOUNT_ACTIONS = {
  reconGo: () => { const B = acctList().filter(a => a.kind === 'bank'); if (!B.length) { confirmBox('برای مغایرت‌گیری اول باید حساب بانکی را تعریف کنید (نام بانک، شماره حساب و موجودی اول دوره). الان تعریف شود؟', 'تعریف حساب بانکی').then(y => { if (y) accountForm(null, 'bank'); }); return; } if (B.length === 1) { location.hash = '#/recon/' + B[0].id; return; } pickList('مغایرت‌گیری کدام بانک؟', B.map(a => ({ value: a.id, label: Core.acctName(a), sub: a.accNo ? 'حساب ' + Core.toFa(a.accNo) : '' })), v => { location.hash = '#/recon/' + v; }); },
  acctNew: d => accountForm(null, d.k),
  acctEdit: d => accountForm(Core.byId(S.accounts, +d.id)),
  acctXfer: d => { if (gate()) acctTransferForm(d.id ? +d.id : null); },
  acctXferOpen: d => { const x = Core.byId(S.acctTx, +d.id); if (x) acctTransferForm(x.from, x); },
  acctTx: d => { if (!gate()) return; txForm(d.t, null, null, { acct: +d.id }); },
  acctExp: d => { if (gate()) expenseForm(null, { acct: +d.id }); },
  acctShare: d => { const a = Core.byId(S.accounts, +d.id); shareText(['بانک ' + (a.bank || ''), a.owner ? 'به نام: ' + a.owner : '', a.card ? 'کارت: ' + a.card.replace(/(\d{4})(?=\d)/g, '$1-') : '', a.accNo ? 'حساب: ' + a.accNo : '', a.sheba ? 'شبا: ' + a.sheba : ''].filter(Boolean).join('\n'), 'مشخصات حساب'); },
  acctCsv: async d => { const a = Core.byId(S.accounts, +d.id), L = Core.accountLedger(S, a.id); await exportFile('account-' + stamp() + '.csv', csvFile([['تاریخ', 'شرح', 'شخص', 'واریز (' + UNIT() + ')', 'برداشت', 'مانده', 'مغایرت‌گیری']].concat([['', 'موجودی اول دوره', '', '', '', Core.shown(a.opening || 0), '']]).concat(L.rows.map(r => [Core.isoToJalali(r.date), r.desc, r.personId ? personName(r.personId) : '', r.amt > 0 ? Core.shown(r.amt) : '', r.amt < 0 ? Core.shown(-r.amt) : '', Core.shown(r.bal), r.rec ? '✓' : '']))), 'text/csv'); },
  reconAdd: d => {
    const res = UI.reconRes, it = res && res.bankOnly[+d.k]; if (!it || !gate()) return; const acct = UI.recon.acct, amount = Math.abs(it.amt), desc = (it.desc || '').slice(0, 80) + (it.ref ? ' (پیگیری ' + it.ref + ')' : '');
    const fill = sel => setTimeout(() => { const f = $(sel); if (!f) return; f.amount.value = Core.fmtInput(amount); mwUpdate(f.amount); const di = f.querySelector('[data-date]'); if (di) di.value = fa(Core.isoToJalali(it.date)); if (f.desc) f.desc.value = desc; if (f.title && !f.title.value) f.title.value = /کارمزد|fee/i.test(it.desc || '') ? 'کارمزد بانکی' : desc; if (f.cat && /کارمزد|fee/i.test(it.desc || '')) f.cat.value = 'کارمزد بانکی'; }, 40);
    if (d.t === 'expense') { expenseForm(null, { acct }); fill('#ef'); } else { txForm(d.t, null, null, { acct }); fill('#tf'); }
  },
  reconSave: async d => { const res = UI.reconRes; if (!res) return; const r = Core.saveRecon(S, +d.id, res); if (await done(r, 'نتیجه مغایرت‌گیری ثبت شد؛ ردیف‌های تطبیق‌شده در گردش حساب علامت ✓ دارند.')) goHash('#/acct/' + d.id); },
  reconShare: () => { const res = UI.reconRes, a = Core.byId(S.accounts, UI.recon.acct); if (!res) return; shareText(['مغایرت‌گیری ' + Core.acctName(a), fmtDate(res.from) + ' تا ' + fmtDate(res.to), '', 'تطبیق‌شده: ' + fa(res.matched.length), 'فقط در بانک: ' + fa(res.bankOnly.length) + ' (' + fmt(res.bankOnly.reduce((t, x) => t + x.amt, 0)) + ')', 'فقط در برنامه: ' + fa(res.appOnly.length), res.stmtClose != null ? 'مانده بانک: ' + fmt(res.stmtClose) : '', 'مانده برنامه: ' + fmt(res.appClose), res.diff != null ? 'اختلاف: ' + fmt(Math.abs(res.diff)) : ''].filter(Boolean).join('\n'), 'مغایرت‌گیری'); },
  accView: d => { UI.accView = d.v; render(); },
  moreRep: d => { UI.moreRep = d.v; UI.limRep = 60; render(); },
  jrCsv: async () => { const { from, to } = repRange(), J = Core.journal(S, to).filter(e => !from || e.date >= from); const rows = [['تاریخ', 'شرح', 'حساب', 'بدهکار (' + UNIT() + ')', 'بستانکار']]; J.forEach(e => e.lines.forEach(l => rows.push([e.date === '0000-00-00' ? 'اول دوره' : Core.isoToJalali(e.date), e.desc, Core.accName(S, l.acc), l.dr ? Core.shown(l.dr) : '', l.cr ? Core.shown(l.cr) : '']))); await exportFile('journal-' + stamp() + '.csv', csvFile(rows), 'text/csv'); },
  tbCsv: async () => { const { from, to } = repRange(), tb = Core.trialBalance(S, from, to, UI.tbLvl || 'moin'); await exportFile('trial-balance-' + stamp() + '.csv', csvFile([['کد', 'حساب', 'گردش بدهکار', 'گردش بستانکار', 'مانده بدهکار', 'مانده بستانکار']].concat(tb.rows.map(r => [r.code, r.name, Core.shown(r.dr), Core.shown(r.cr), r.bal > 0 ? Core.shown(r.bal) : '', r.bal < 0 ? Core.shown(-r.bal) : ''])).concat([['', 'جمع', Core.shown(tb.tot.dr), Core.shown(tb.tot.cr), Core.shown(tb.tot.bd), Core.shown(tb.tot.bc)]])), 'text/csv'); }
};

/* ── reports: accounting (trial balance, balance sheet, income statement, journal) ── */
function repAccounting(from, to) {
  if (!(can('reports') && can('cost'))) return empty(ico('lock'), 'گزارش‌های حسابداری برای این کاربر مجاز نیست.');
  const v = UI.accView || 'tb';
  let h = '';
  if (v === 'tb') {
    const lvl = UI.tbLvl || 'moin', tb = Core.trialBalance(S, from, to, lvl);
    h += chips('tbLvl', lvl, [['kol', 'سطح کل'], ['moin', 'سطح معین'], ['detail', 'سطح تفصیلی']]);
    h += '<div class="card tb"><div class="ch">' + ico('scale') + 'تراز آزمایشی چهارستونی · ' + ({ kol: 'کل', moin: 'معین', detail: 'تفصیلی' }[lvl]) + '</div>' +
      '<div class="tbh"><span>حساب</span><span>گردش بدهکار</span><span>گردش بستانکار</span><span>مانده</span></div>' +
      tb.rows.map(r => '<div class="tbr"><span><b>' + esc(r.name) + '</b><small>' + fa(r.code) + '</small></span><span>' + fmt(r.dr) + '</span><span>' + fmt(r.cr) + '</span><span class="' + (r.bal ? '' : 'zero') + '">' + fmt(Math.abs(r.bal)) + '<small>' + (r.bal > 0 ? ' بد' : r.bal < 0 ? ' بس' : '') + '</small></span></div>').join('') +
      '<div class="tbr tot"><span><b>جمع</b></span><span>' + fmt(tb.tot.dr) + '</span><span>' + fmt(tb.tot.cr) + '</span><span>' + fmt(tb.tot.bd) + (tb.tot.bd !== tb.tot.bc ? '<small> / ' + fmt(tb.tot.bc) + '</small>' : '') + '</span></div>' +
      '<div class="alert ' + (tb.balanced ? 'good' : 'bad') + '">' + ico(tb.balanced ? 'check' : 'alert') + (tb.balanced ? 'تراز است: جمع بدهکار با جمع بستانکار برابر است (' + fa(tb.entries) + ' سند حسابداری).' : 'تراز نیست! از «تنظیمات ← گزارش خطا» برای پشتیبانی بفرستید.') + '</div>' +
      '<p class="hint">مانده «بد» = بدهکار، «بس» = بستانکار. گردش‌ها مربوط به بازه انتخاب‌شده و مانده‌ها تا پایان آن است. اسناد حسابداری خودکار از روی فاکتورها، دریافت و پرداخت، هزینه‌ها، انتقال‌ها و مانده‌های اول دوره ساخته می‌شوند (روش دائمی انبار با میانگین موزون).</p></div>';
    h += '<div class="toolbar rexp"><button class="btn ghost sm" data-act="tbCsv">' + ico('file') + 'خروجی اکسل تراز</button></div>';
  } else if (v === 'bs') {
    const b = Core.balanceSheet(S, to), r = (l, x, c) => '<div class="rr' + (c ? ' b' : '') + '"><span>' + l + '</span><b>' + fmt(x) + '</b></div>';
    h += '<div class="card"><div class="ch">' + ico('scale') + 'ترازنامه · ' + (to ? fmtDate(to) : 'امروز') + '</div><div class="bsg"><div><div class="ch gs-h">دارایی‌ها</div>' + r('صندوق', b.cash) + r('بانک‌ها', b.bank) + r('حساب‌های دریافتنی', b.recv) + r('موجودی کالا', b.inv) + (b.chqIn ? r('اسناد دریافتنی (چک‌های در صندوق و در جریان وصول)', b.chqIn) : '') + Object.keys(b.extraA).map(c => r(esc(Core.coaName(S, c)), b.extraA[c])).join('') + (b.vatNet < 0 ? r('ارزش افزوده قابل بازیافت', -b.vatNet) : '') + r('جمع دارایی‌ها', b.assets, 1) + '</div><div><div class="ch gs-h">بدهی‌ها و حقوق صاحب کار</div>' + r('حساب‌های پرداختنی', b.pay) + (b.chqOut ? r('اسناد پرداختنی (چک‌های صادره پاس‌نشده)', b.chqOut) : '') + Object.keys(b.extraL).map(c => r(esc(Core.coaName(S, c)), b.extraL[c])).join('') + (b.vatNet > 0 ? r('ارزش افزوده پرداختنی', b.vatNet) : '') + r('جمع بدهی‌ها', b.liab, 1) + r('سرمایه (مانده‌های اول دوره)', b.capital) + Object.keys(b.extraE).map(c => r(esc(Core.coaName(S, c)), b.extraE[c])).join('') + ((S.fyClosed || []).length || b.retained ? r('سود (زیان) انباشته سال‌های قبل', b.retained) + r('سود (زیان) سال جاری', b.profit) : r('سود (زیان) انباشته', b.profit)) + r('جمع حقوق صاحب کار', b.equity, 1) + r('جمع بدهی‌ها و حقوق صاحب کار', b.liab + b.equity, 1) + '</div></div><div class="alert' + (b.balanced ? '' : ' warn') + '">' + ico(b.balanced ? 'check' : 'alert') + (b.balanced ? 'دارایی‌ها = بدهی‌ها + حقوق صاحب کار' : 'ترازنامه برابر نیست') + '</div></div>';
  } else if (v === 'pl') {
    const p = Core.ledgerPL(S, from, to), r = (l, x, c, b) => '<div class="rr' + (b ? ' b' : '') + '"><span>' + l + '</span><b class="' + (x ? c || '' : 'zero') + '">' + fmt(x) + '</b></div>';
    h += '<div class="card"><div class="ch">' + ico('chart') + 'صورت سود و زیان</div>' + r('فروش کالا', p.sales) + r('کسر: برگشت از فروش', p.ret, 'ora') + r('کسر: تخفیفات فروش', p.disc, 'ora') + r('فروش خالص', p.netSales, '', 1) + r('کسر: بهای تمام‌شده کالای فروش‌رفته', p.cogs, 'debit') + (p.waste ? r('کسر: ضایعات و کسری انبار', p.waste, 'debit') : '') + r('سود ناخالص', p.gross, p.gross < 0 ? 'debit' : 'credit', 1) + r('هزینه‌های عملیاتی', p.opex, 'debit') + (p.fee ? r('کارمزد بانکی', p.fee, 'debit') : '') + (p.other ? r('سایر درآمدها', p.other, 'credit') : '') + (p.otherExp ? r('سایر هزینه‌ها', p.otherExp, 'debit') : '') + r('سود (زیان) خالص', p.net, p.net < 0 ? 'debit' : 'credit', 1) + (p.lines.some(l => !Core.CHART[l.code] && l.amt) ? '<div class="ch gs-h">ریز حساب‌های تعریف‌شده شما</div>' + p.lines.filter(l => !Core.CHART[l.code] && l.amt).map(l => r(fa(l.code) + ' · ' + esc(l.name), l.amt, l.code[0] === '4' ? 'credit' : 'debit')).join('') : '') + (p.netSales ? '<p class="hint">حاشیه سود ناخالص ' + fa(Math.round(p.gross / p.netSales * 100)) + '٪ · حاشیه سود خالص ' + fa(Math.round(p.net / p.netSales * 100)) + '٪</p>' : '') + '</div>';
  } else {
    const J = Core.journal(S, to).filter(e => !from || e.date >= from).reverse(), lim = UI.limRep || 60;
    h += '<div class="card flush jr">' + (J.length ? J.slice(0, lim).map(e => '<div class="jre"' + (e.ref && e.ref.vch ? ' data-act="vchOpen" data-id="' + e.ref.vch + '"' : e.ref && e.ref.chq ? ' data-act="chqView" data-id="' + e.ref.chq + '"' : e.ref && e.ref.inv ? ' data-act="go" data-h="#/inv/' + e.ref.inv + '"' : '') + '><div class="jrh"><b>' + esc(fa(e.desc)) + '</b><small>' + (e.date === '0000-00-00' ? 'اول دوره' : fmtDate(e.date)) + '</small></div>' + e.lines.map(l => '<div class="jrl' + (l.cr ? ' cr' : '') + '"><span>' + esc(Core.accName(S, l.acc)) + '</span><b>' + (l.dr ? fmt(l.dr) : '') + '</b><b>' + (l.cr ? fmt(l.cr) : '') + '</b></div>').join('') + '</div>').join('') : '<div class="empty">سندی در این بازه نیست.</div>') + '</div>' + (J.length > lim ? '<button class="btn ghost" data-act="repMore">نمایش سندهای بیشتر</button>' : '');
    h += '<div class="toolbar rexp"><button class="btn ghost sm" data-act="jrCsv">' + ico('file') + 'خروجی اکسل دفتر روزنامه</button></div>';
  }
  return h;
}

/* ── reports: more report types ── */
function repMore(from, to) {
  const cost = can('cost') && can('reports'), v = UI.moreRep || 'daily';
  let h = '';
  const lim = UI.limRep || 60, more = n => (n > lim ? '<button class="btn ghost" data-act="repMore">نمایش بیشتر</button>' : '');
  if (v === 'daily' || v === 'monthly') {
    const L = Core.salesBy(S, v === 'monthly' ? null : from, v === 'monthly' ? null : to, v === 'monthly' ? 'month' : 'day'), max = Math.max(1, ...L.map(x => x.rev));
    h += L.length ? '<div class="card flush">' + L.slice(0, lim).map(x => { const [y, m] = x.key.split('/'); return '<div class="xr bar"><span><b>' + (v === 'monthly' ? Core.MONTHS[+m - 1] + ' ' + fa(y) : fmtDate(x.key) + ' · ' + Core.WEEKDAYS[Core.weekdayIdx(x.key)]) + '</b><small>' + fa(x.n) + ' فاکتور' + (cost ? ' · سود ' + fmt(x.profit) : '') + '</small><i style="width:' + Math.round(x.rev / max * 100) + '%"></i></span><span class="end"><em>' + fmt(x.rev) + '</em></span></div>'; }).join('') + '</div>' + more(L.length) : empty(ico('chart'), 'فروشی در این بازه نیست.');
  } else if (v === 'aging') {
    const A = Core.aging(S, today()), tot = [0, 1, 2, 3].map(i => A.reduce((t, r) => t + r.b[i], 0));
    h += '<div class="kpis">' + ['تا ۳۰ روز', '۳۱ تا ۶۰ روز', '۶۱ تا ۹۰ روز', 'بیش از ۹۰ روز'].map((l, i) => '<div class="kpi"><small>' + l + '</small><b class="' + (i ? 'debit' : '') + '">' + fmt(tot[i]) + '</b></div>').join('') + '</div>';
    h += A.length ? '<div class="card flush">' + A.slice(0, lim).map(r => '<button class="xr" data-act="go" data-h="#/person/' + r.p.id + '"><span><b>' + esc(r.p.name) + '</b><small>قدیمی‌ترین بدهی: ' + fa(r.days) + ' روز' + [0, 1, 2, 3].filter(i => r.b[i]).map(i => ' · ' + ['۰–۳۰', '۳۱–۶۰', '۶۱–۹۰', '۹۰+'][i] + ': ' + fmt(r.b[i])).join('') + '</small></span><span class="end"><em class="debit">' + fmt(r.total) + '</em></span></button>').join('') + '</div>' + more(A.length) : empty(ico('check'), 'طلب معوقی ندارید.');
  } else if (v === 'unpaid') {
    const L = S.invoices.filter(i => (i.type === 'sale' || i.type === 'purchase') && Core.invoiceInfo(S, i).remaining > 0).sort((a, b) => (a.date < b.date ? -1 : 1));
    const sum = t => L.filter(i => i.type === t).reduce((s, i) => s + Core.invoiceInfo(S, i).remaining, 0);
    h += '<div class="kpis two"><div class="kpi"><small>مانده فروش‌های نسیه</small><b class="debit">' + fmt(sum('sale')) + '</b></div><div class="kpi"><small>مانده خریدهای پرداخت‌نشده</small><b class="credit">' + fmt(sum('purchase')) + '</b></div></div>';
    h += L.length ? '<div class="card flush">' + L.slice(0, lim).map(i => invRow(i)).join('') + '</div>' + more(L.length) : empty(ico('check'), 'همه فاکتورها تسویه شده‌اند.');
  } else if (v === 'suppliers') {
    const m = {}; S.invoices.forEach(i => { if ((i.type !== 'purchase' && i.type !== 'purchase_return') || (from && i.date < from) || (to && i.date > to)) return; const x = m[i.personId] || (m[i.personId] = { n: 0, total: 0 }); const t = Core.invoiceTotals(i).total; if (i.type === 'purchase') { x.n++; x.total += t; } else x.total -= t; });
    const L = Object.keys(m).map(id => Object.assign({ p: Core.byId(S.people, +id), b: Core.balanceOf(S, +id) }, m[id])).filter(x => x.p).sort((a, b) => b.total - a.total);
    h += L.length ? '<div class="card flush">' + L.map(x => '<button class="xr" data-act="go" data-h="#/person/' + x.p.id + '"><span><b>' + esc(x.p.name) + '</b><small>' + fa(x.n) + ' فاکتور خرید' + (can('balances') && x.b < 0 ? ' · بدهی من ' + fmt(-x.b) : '') + '</small></span><span class="end"><em>' + fmt(x.total) + '</em></span></button>').join('') + '</div>' : empty(ico('cart'), 'خریدی در این بازه نیست.');
  } else if (v === 'stockval') {
    if (!can('cost')) return h + empty(ico('lock'), 'دیدن ارزش انبار برای این کاربر مجاز نیست.');
    const m = {}; Core.productStats(S).forEach(x => { if (x.stock <= 0) return; const c = Core.catOf(x.product), y = m[c] || (m[c] = { n: 0, qty: 0, value: 0, sale: 0 }); y.n++; y.qty += x.stock; y.value += x.value; y.sale += x.stock * (x.product.salePrice || 0); });
    const L = Object.keys(m).map(c => Object.assign({ c }, m[c])).sort((a, b) => b.value - a.value), tv = L.reduce((t, x) => t + x.value, 0), ts = L.reduce((t, x) => t + x.sale, 0);
    h += '<div class="kpis two"><div class="kpi"><small>ارزش به قیمت خرید</small><b>' + fmt(tv) + '</b></div><div class="kpi"><small>ارزش به قیمت فروش</small><b>' + fmt(Math.round(ts)) + '</b></div></div>';
    h += L.length ? '<div class="card flush">' + L.map(x => '<button class="xr" data-act="catGo" data-c="' + esc(x.c) + '"><span><b>' + esc(x.c) + '</b><small>' + fa(x.n) + ' کالا · ' + Core.fmtQty(Math.round(x.qty * 1000) / 1000) + ' عدد · ' + fa(tv ? Math.round(x.value / tv * 100) : 0) + '٪</small></span><span class="end"><em>' + fmt(x.value) + '</em></span></button>').join('') + '</div>' : empty(ico('package'), 'انبار خالی است.');
  } else if (v === 'imei') {
    const ins = Core.serialsInStockAll(S);
    const sold = []; S.invoices.forEach(i => { if (i.type !== 'sale' || (from && i.date < from) || (to && i.date > to)) return; i.items.forEach(l => Core.extractSerials(l.note).forEach(sn => sold.push({ sn, inv: i, p: Core.byId(S.products, l.productId), price: l.price }))); });
    h += '<div class="kpis two"><div class="kpi"><small>دستگاه در انبار (با IMEI)</small><b>' + fa(ins.length) + '</b></div><div class="kpi"><small>فروخته‌شده در این بازه</small><b>' + fa(sold.length) + '</b></div></div>';
    h += '<div class="ch gs-h">در انبار</div>' + (ins.length ? '<div class="card flush">' + ins.slice(0, lim).map(x => '<button class="xr" data-act="searchGo" data-q="' + esc(x.serial) + '"><span><b class="ltr">' + esc(x.serial) + '</b><small>' + esc(x.p.name) + ' · ' + (x.type === 'sale_return' ? 'مرجوعی' : 'خرید') + ' ' + fmtDate(x.date) + '</small></span><span class="end"><em>' + (can('cost') ? fmt(x.price) : '') + '</em></span></button>').join('') + '</div>' : '<p class="hint">دستگاهی با IMEI در انبار نیست.</p>');
    h += '<div class="ch gs-h">فروخته‌شده</div>' + (sold.length ? '<div class="card flush">' + sold.slice(0, lim).map(x => '<button class="xr" data-act="searchGo" data-q="' + esc(x.sn) + '"><span><b class="ltr">' + esc(x.sn) + '</b><small>' + esc(x.p ? x.p.name : '') + ' · ' + esc(personName(x.inv.personId)) + ' · ' + fmtDate(x.inv.date) + '</small></span><span class="end"><em>' + fmt(x.price) + '</em></span></button>').join('') + '</div>' : '<p class="hint">در این بازه گوشی‌ای فروخته نشده.</p>');
  } else if (v === 'discounts') {
    const L = S.invoices.filter(i => i.type === 'sale' && i.discount > 0 && (!from || i.date >= from) && (!to || i.date <= to)).sort((a, b) => b.discount - a.discount), tot = L.reduce((t, i) => t + i.discount, 0);
    h += '<div class="kpis two"><div class="kpi"><small>جمع تخفیف‌ها</small><b class="ora">' + fmt(tot) + '</b></div><div class="kpi"><small>تعداد فاکتور با تخفیف</small><b>' + fa(L.length) + '</b></div></div>';
    h += L.length ? '<div class="card flush">' + L.slice(0, lim).map(i => '<button class="xr" data-act="go" data-h="#/inv/' + i.id + '"><span><b>' + esc(personName(i.personId)) + '</b><small>فاکتور ' + fa(i.no) + ' · ' + fmtDate(i.date) + (i.by ? ' · ' + esc(i.by) : '') + '</small></span><span class="end"><em class="ora">' + fmt(i.discount) + '</em></span></button>').join('') + '</div>' + more(L.length) : empty(ico('check'), 'در این بازه تخفیفی داده نشده.');
  } else if (v === 'accounts') {
    const bal = Core.accountBalances(S), cs = Core.cashSummary(S, from, to);
    h += '<div class="card flush">' + acctList().map(a => '<button class="xr" data-act="go" data-h="#/acct/' + a.id + '"><span><b>' + esc(Core.acctName(a)) + '</b><small>در این بازه: ورود ' + fmt((cs.byAcct[a.id] || {}).in || 0) + ' · خروج ' + fmt((cs.byAcct[a.id] || {}).out || 0) + '</small></span><span class="end"><em class="' + (bal[a.id] < 0 ? 'debit' : '') + '">' + fmt(bal[a.id]) + '</em></span></button>').join('') + '</div>';
  } else if (v === 'cheques') {
    const L = S.cheques.filter(c => !c.done).sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1)), sum = d => L.filter(c => c.direction === d).reduce((t, c) => t + c.amount, 0);
    h += '<div class="kpis two"><div class="kpi"><small>چک و قسط دریافتنی</small><b class="credit">' + fmt(sum('receive')) + '</b></div><div class="kpi"><small>چک و قسط پرداختنی</small><b class="debit">' + fmt(sum('pay')) + '</b></div></div>';
    h += L.length ? '<div class="card flush">' + L.map(c => { const st2 = Core.chequeStatus(c, today()); return '<button class="xr" ' + (c.cyc ? 'data-act="chqView" data-id="' + c.id + '"' : 'data-act="go" data-h="#/cheques"') + '><span><b>' + esc(c.cyc ? personName(c.personId) + (c.serial ? ' · چک ' + fa(c.serial) : '') + ' · ' + Core.CHQ_FA[c.state] : c.title) + '</b><small>' + (c.personId ? esc(personName(c.personId)) + ' · ' : '') + (c.direction === 'receive' ? 'دریافتی' : 'پرداختی') + ' · سررسید ' + fmtDate(c.dueDate) + (st2 === 'overdue' ? ' · <span class="debit">سررسید گذشته</span>' : '') + '</small></span><span class="end"><em class="' + (c.direction === 'receive' ? 'credit' : 'debit') + '">' + fmt(c.amount) + '</em></span></button>'; }).join('') + '</div>' : empty(ico('check'), 'چک یا قسط در جریانی ندارید.');
  }
  return h;
}
document.addEventListener('change', e => { const t = e.target; if (t instanceof HTMLSelectElement && t.hasAttribute('data-morerep')) { UI.moreRep = t.value; UI.limRep = 60; render(); } });
