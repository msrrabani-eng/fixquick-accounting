/* Accounting screens: manual vouchers (سند حسابداری), chart of accounts (کدینگ حساب‌ها), fiscal year closing,
 * the full cheque lifecycle (خزانه‌داری چک) and warehouses with transfers. Loaded before pages.js. */
'use strict';

const vSum = L => L.reduce((t, l) => ({ dr: t.dr + l.dr, cr: t.cr + l.cr }), { dr: 0, cr: 0 });
const accLabel = k => esc(Core.accName(S, k)) + ' <small class="hint">' + fa(Core.keyCode(k, 1)) + '</small>';
const whName = id => { const w = Core.whList(S).find(x => x.id === id); return w ? w.name : '—'; };
function whSel(cur, name, label, o) {
  o = o || {}; const L = Core.whList(S).filter(w => !w.archived || w.id === cur);
  return '<label class="fld"><span>' + (label || 'انبار') + '</span><select class="inp" name="' + (name || 'wh') + '">' + L.map(w => '<option value="' + w.id + '"' + (w.id === cur ? ' selected' : '') + '>' + esc(w.name) + (w.main ? ' (اصلی)' : '') + '</option>').join('') + '</select></label>';
}

/* ═════════════ manual vouchers ═════════════ */
function voucherAccItems() {
  const items = [];
  S.people.filter(p => !p.archived).forEach(p => items.push({ value: 'P' + p.id, label: p.name, sub: (p.code ? 'کد ' + p.code + ' · ' : '') + 'حساب اشخاص', cat: 'اشخاص' }));
  acctList().forEach(a => items.push({ value: Core.acctKey(S, a.id), label: Core.acctName(a), sub: a.kind === 'bank' ? 'بانک‌ها · ۱۱۰۲' : 'صندوق · ۱۱۰۱', cat: 'صندوق و بانک' }));
  items.push({ value: '6100', label: 'هزینه‌های عملیاتی (بدون گروه)', sub: '۶۱۰۰', cat: 'هزینه‌ها' });
  [...new Set(S.expenses.map(e => e.category).filter(Boolean))].sort(faCmp).forEach(c => items.push({ value: '6100:' + c, label: 'هزینه ' + c, sub: 'هزینه‌های عملیاتی · ۶۱۰۰', cat: 'هزینه‌ها' }));
  Core.coa(S).groups.forEach(g => g.kols.forEach(k => k.moins.forEach(m => { if (!m.lock && !m.need && m.code !== '6100') items.push({ value: m.code, label: m.name, sub: 'معین ' + fa(m.code) + ' · ' + k.name, cat: g.name }); })));
  (S.tafsil || []).filter(t => !t.archived).forEach(t => items.push({ value: 'T' + t.id, label: t.name, sub: 'تفصیلی ' + fa(t.code), cat: 'تفصیلی‌ها' }));
  return items;
}
// pick a ledger account for a voucher line; a detail account (تفصیلی) asks which معین it belongs to
function pickVoucherAcc(onPick) {
  pickList('انتخاب حساب', voucherAccItems(), v => {
    if (v[0] !== 'T') return onPick(v);
    const moins = []; Core.coa(S).groups.forEach(g => g.kols.forEach(k => k.moins.forEach(m => { if (!m.lock && !m.need) moins.push({ value: m.code, label: m.name, sub: 'معین ' + fa(m.code), cat: g.name }); })));
    setTimeout(() => pickList('زیر کدام حساب معین؟', moins, m => onPick(m + ':' + v)), 50);
  }, { cats: true });
}
function voucherRow(box, l) {
  const d = document.createElement('div'); d.className = 'vrow'; d.dataset.acc = l && l.acc || '';
  d.innerHTML = '<div class="vr1"><button type="button" class="inp pick vacc">' + (l && l.acc ? Core.accName(S, l.acc) : 'انتخاب حساب…') + '</button><button type="button" class="x vdel" aria-label="حذف ردیف">×</button></div><div class="row2"><label class="fld"><span>بدهکار</span><input class="inp ltr" name="dr" data-money inputmode="numeric" placeholder="۰" value="' + (l && l.dr ? Core.fmtInput(l.dr) : '') + '"></label><label class="fld"><span>بستانکار</span><input class="inp ltr" name="cr" data-money inputmode="numeric" placeholder="۰" value="' + (l && l.cr ? Core.fmtInput(l.cr) : '') + '"></label></div><input class="inp vnote" name="note" placeholder="شرح ردیف (اختیاری)" value="' + esc(l && l.note || '') + '">';
  box.appendChild(d); enhanceMoney(d); return d;
}
function readVoucherRows(box) { return $$('.vrow', box).map(r => ({ acc: r.dataset.acc, dr: Core.parseMoney($('[name=dr]', r).value || '0') || 0, cr: Core.parseMoney($('[name=cr]', r).value || '0') || 0, note: $('[name=note]', r).value })); }
function voucherForm(v, copy) {
  const src = v; if (copy) v = null;
  const sh = sheet(v ? 'ویرایش سند ' + fa(v.no) : 'سند حسابداری جدید', '<form id="vf">' + tipBox('voucher') +
    '<div class="row2">' + dateField('date', v ? v.date : today(), 'تاریخ سند') + '<label class="fld"><span>شماره سند</span><input class="inp ltr" name="no" inputmode="numeric" value="' + fa(v ? v.no : Core.nextVoucherNo(S)) + '"></label></div>' +
    '<label class="fld"><span>شرح سند</span><input class="inp" name="desc" value="' + esc(src ? src.desc : '') + '" placeholder="مثلاً: دریافت وام، افزایش سرمایه، اصلاح حساب"></label>' +
    '<div class="ch">ردیف‌های سند</div><div id="vrows"></div><button type="button" class="btn ghost" id="v-add">+ افزودن ردیف</button>' +
    '<div class="vsum"><div><small>جمع بدهکار</small><b id="v-dr">۰</b></div><div><small>جمع بستانکار</small><b id="v-cr">۰</b></div><div><small>اختلاف</small><b id="v-df">۰</b></div></div>' +
    '<button class="btn blue" type="submit">' + ico('save') + 'ذخیره سند</button></form>', { tall: true });
  const box = sh.q('#vrows'), calc = () => { const t = vSum(readVoucherRows(box)), df = t.dr - t.cr; sh.q('#v-dr').textContent = fmt(t.dr); sh.q('#v-cr').textContent = fmt(t.cr); const e = sh.q('#v-df'); e.textContent = df ? fmt(Math.abs(df)) + (df > 0 ? ' بد' : ' بس') : 'تراز ✓'; e.className = df ? 'debit' : 'credit'; };
  (src ? src.lines : [{}, {}]).forEach(l => voucherRow(box, l));
  sh.q('#v-add').onclick = () => { const t = vSum(readVoucherRows(box)), df = t.dr - t.cr, r = voucherRow(box, df ? { dr: df < 0 ? -df : 0, cr: df > 0 ? df : 0 } : null); calc(); $('.vacc', r).click(); };
  box.addEventListener('click', e => {
    const r = e.target.closest('.vrow'); if (!r) return;
    if (e.target.closest('.vdel')) { if ($$('.vrow', box).length > 2) { r.remove(); calc(); } else toast('سند حداقل دو ردیف دارد.', true); return; }
    if (e.target.closest('.vacc')) pickVoucherAcc(k => { r.dataset.acc = k; $('.vacc', r).textContent = Core.accName(S, k); Drafts.touch(sh.q('#vf')); });
  });
  box.addEventListener('input', e => { const i = e.target; if (i.name === 'dr' && i.value.trim()) $('[name=cr]', i.closest('.vrow')).value = ''; if (i.name === 'cr' && i.value.trim()) $('[name=dr]', i.closest('.vrow')).value = ''; calc(); });
  calc();
  const voucherDraft=Drafts.attachSheet(sh,'voucher:'+(v ? 'edit:'+v.id : 'new'),{
    getExtra:()=>({rows:$$('.vrow',box).map(r=>({acc:r.dataset.acc || '',dr:$('[name=dr]',r).value,cr:$('[name=cr]',r).value,note:$('[name=note]',r).value}))}),
    beforeRestore:ex=>{
      if(!Array.isArray(ex.rows))return;
      box.innerHTML='';
      ex.rows.slice(0,100).forEach(l=>{const r=voucherRow(box,{acc:l.acc,dr:0,cr:0,note:l.note});
        $('[name=dr]',r).value=String(l.dr??''); $('[name=cr]',r).value=String(l.cr??'');
      });
      while($$('.vrow',box).length<2)voucherRow(box,{});
    },afterRestore:()=>calc()
  });
  sh.q('#vf').onsubmit = async e => {
    e.preventDefault(); const f = e.target, date = readDate(f, 'date'); if (!date) return toast('تاریخ نامعتبر است.', true);
    const d = { date, no: Core.toEn(f.no.value).trim(), desc: f.desc.value, lines: readVoucherRows(box) };
    if (!v && !gate()) return;
    const r = v ? Core.editVoucher(S, v.id, d) : Core.addVoucher(S, d); if (!r.ok) return toast(r.error, true);
    if (!v) bumpUsage(); if (!(await save())) return; voucherDraft.clear(); sh.close(); toast(v ? 'سند اصلاح شد.' : 'سند ' + fa(r.voucher.no) + ' ثبت شد.'); render();
  };
}
function voucherView(id) {
  const v = Core.byId(S.vouchers || [], id); if (!v) return toast('سند پیدا نشد.', true); const t = vSum(v.lines);
  const sh = sheet('سند حسابداری شماره ' + fa(v.no), '<div class="kv"><span>تاریخ</span><b>' + fmtDate(v.date) + '</b></div><div class="kv"><span>نوع</span><b>' + FY_DOC(v) + '</b></div>' + (v.desc ? '<p class="hint">' + esc(v.desc) + '</p>' : '') +
    '<div class="card flush vlines"><div class="vlh"><span>حساب</span><span>بدهکار</span><span>بستانکار</span></div>' + v.lines.map(l => '<div class="vl"><span><b>' + esc(Core.accName(S, l.acc)) + '</b><small>' + fa(Core.keyCode(l.acc, 1)) + (l.note ? ' · ' + esc(l.note) : '') + (l.rec ? ' · ✓ تطبیق با بانک' : '') + '</small></span><em>' + (l.dr ? fmt(l.dr) : '') + '</em><em>' + (l.cr ? fmt(l.cr) : '') + '</em></div>').join('') + '<div class="vl tot"><span><b>جمع</b></span><em>' + fmt(t.dr) + '</em><em>' + fmt(t.cr) + '</em></div></div>' +
    (v.kind === 'manual' ? '<div class="row2"><button class="btn blue" data-e>' + ico('edit') + 'ویرایش</button><button class="btn ghost" data-c>' + ico('file') + 'کپی به سند جدید</button></div><button class="btn ghost red" data-d>حذف سند</button>' : '<p class="hint">این سند هنگام بستن سال مالی خودکار ساخته شده و فقط با «برگرداندن بستن سال» حذف می‌شود.</p>') +
    '<button class="btn ghost" data-s>' + ico('share') + 'ارسال متن سند</button>');
  const q = s => sh.q(s);
  if (q('[data-e]')) q('[data-e]').onclick = () => { sh.close(); voucherForm(v); };
  if (q('[data-c]')) q('[data-c]').onclick = () => { sh.close(); voucherForm(v, true); };
  if (q('[data-d]')) q('[data-d]').onclick = async () => { if (!(await confirmBox('سند ' + fa(v.no) + ' حذف شود؟ اثر آن از حساب اشخاص، صندوق و بانک و گزارش‌ها برداشته می‌شود.', 'حذف', true))) return; if (await done(Core.deleteVoucher(S, v.id), 'سند حذف شد.')) sh.close(); };
  q('[data-s]').onclick = () => shareText(['سند حسابداری شماره ' + fa(v.no) + ' — ' + fmtDate(v.date), v.desc || ''].concat(v.lines.map(l => Core.accName(S, l.acc) + ': ' + (l.dr ? 'بدهکار ' + fmt(l.dr) : 'بستانکار ' + fmt(l.cr)))).concat(['جمع: ' + fmt(t.dr)]).filter(Boolean).join('\n'), 'سند ' + v.no);
}
/* ═════════════ accounting documents: every document the app has posted, plus manual vouchers ═════════════ */
const DOC_F = [['all', 'همه'], ['sale', 'فروش'], ['purchase', 'خرید'], ['money', 'دریافت و پرداخت'], ['cheque', 'چک'], ['expense', 'هزینه'], ['voucher', 'سند دستی'], ['other', 'سایر']];
const DOC_IN = { sale: ['sale', 'sale_return'], purchase: ['purchase', 'purchase_return'], money: ['receipt', 'payment', 'transfer'], cheque: ['cheque'], expense: ['expense'], voucher: ['voucher', 'manual'], other: ['opening', 'xfer', 'adjust', 'closing', 'yclose', 'yopen'] };
const DOC_SORT = [['new', 'جدیدترین'], ['old', 'قدیمی‌ترین'], ['amt_desc', 'بیشترین مبلغ'], ['amt_asc', 'کمترین مبلغ'], ['no_desc', 'شماره سند (بزرگ به کوچک)'], ['no_asc', 'شماره سند (کوچک به بزرگ)']];
let docCache = null;
function docsAll() { if (!docCache || docCache.ver !== dataVer || docCache.st !== S) { const D = Core.documents(S); if (D.assigned) save(); docCache = { ver: dataVer, st: S, docs: D.reverse(), texts: [], building: false }; } return docCache; }
const docsOfSaved = ref => { const D = Core.docsOf(S, ref); if (D.assigned) { save(); docCache = null; } return D; };
const docNoTxt = d => (d.no ? 'سند ' + fa(d.no) : 'سند');
// the search text of every document is prepared in small steps so a big file never freezes the phone
function docTextsReady(c) {
  if (c.texts.length === c.docs.length) return true; if (c.building) return false; c.building = true;
  const step = () => { if (docCache !== c) return; const end = Math.min(c.docs.length, c.texts.length + 1500); for (let i = c.texts.length; i < end; i++) c.texts.push(Core.docText(S, c.docs[i])); if (end < c.docs.length) { const pr = $('#doc-prog'); if (pr) pr.textContent = fa(Math.round(end / c.docs.length * 100)) + '٪'; setTimeout(step, 0); } else { c.building = false; if ((location.hash || '').startsWith('#/vouchers')) render({ keepId: 'doc-q' }); } };
  setTimeout(step, 0); return false;
}
function docTitle(d) {
  const r = d.ref;
  if (r.inv) { const i = Core.byId(S.invoices, r.inv); if (i) return Core.DOC_KIND[i.type] + ' ' + fa(i.no) + ' · ' + esc(personName(i.personId)); }
  if (r.vch) { const v = Core.byId(S.vouchers || [], r.vch); if (v) return (v.kind === 'manual' ? 'سند دستی ' : FY_DOC(v) + ' ') + fa(v.no) + (v.desc ? ' · ' + esc(v.desc) : ''); }
  if (r.tx) { const t = Core.byId(S.tx, r.tx); if (t && (t.type === 'receipt' || t.type === 'payment')) return Core.DOC_KIND[t.type] + ' · ' + esc(personName(t.personId)); }
  if (r.exp) { const e = Core.byId(S.expenses, r.exp); if (e) return 'هزینه · ' + esc(e.title); }
  return esc(fa(d.desc));
}
function docRow(d) {
  const sub = [d.date === '0000-00-00' ? 'اول دوره' : fmtDate(d.date), Core.DOC_KIND[d.kind]]; if (d.entries[0].desc && !/^(فروش|خرید|برگشت)/.test(d.entries[0].desc) && !d.ref.vch) sub.push(esc(fa(d.entries[0].desc)));
  return '<button class="row" data-act="docOpen" data-k="' + esc(d.key) + '"><span><b><i class="dno">' + docNoTxt(d) + '</i> ' + docTitle(d) + '</b><small>' + sub.join(' · ') + '</small></span><em>' + fmt(d.dr) + '</em></button>';
}
// the debit / credit lines of one or more documents
function docLines(docs) {
  let h = '<div class="card flush vlines"><div class="vlh"><span>حساب</span><span>بدهکار</span><span>بستانکار</span></div>', dr = 0, cr = 0; const pb = Core.balances(S), code = k => fa(Core.keyCode(k, k[0] === 'P' ? (pb[+k.slice(1)] < 0 ? -1 : 1) : 1)); // a person sits under receivable or payable by their balance, as in the trial balance
  docs.forEach(d => d.entries.forEach(e => {
    if (docs.length > 1 || d.entries.length > 1) h += '<div class="vsub">' + (docs.length > 1 ? docNoTxt(d) + ' · ' : '') + esc(fa(e.desc)) + (docs.length > 1 ? ' · ' + (e.date === '0000-00-00' ? 'اول دوره' : fmtDate(e.date)) : '') + '</div>';
    e.lines.forEach(l => { dr += l.dr; cr += l.cr; h += '<div class="vl"><span><b>' + esc(Core.accName(S, l.acc)) + '</b><small>' + code(l.acc) + '</small></span><em>' + (l.dr ? fmt(l.dr) : '') + '</em><em>' + (l.cr ? fmt(l.cr) : '') + '</em></div>'; });
  }));
  return h + '<div class="vl tot"><span><b>جمع</b></span><em>' + fmt(dr) + '</em><em>' + fmt(cr) + '</em></div></div>';
}
// «سند حسابداری» card under an invoice; only for users who may see costs
function docCard(ref) {
  if (!routeAllowed('vouchers')) return ''; const D = docsOfSaved(ref); if (!D.length) return '';
  return '<div class="ch gs-h">' + ico('file') + 'سند حسابداری این فاکتور' + (D.length === 1 && D[0].no ? ' · شماره ' + fa(D[0].no) : '') + ' ' + help('doc') + '</div>' + docLines(D);
}
function docView(d) {
  if (d.ref.vch) return voucherView(d.ref.vch);
  const r = d.ref, src = r.inv ? ['go', '#/inv/' + r.inv, 'مشاهده فاکتور'] : r.tx ? ['txOpen', r.tx, 'مشاهده دریافت / پرداخت'] : r.exp ? ['expOpen', r.exp, 'مشاهده هزینه'] : r.chq ? ['chqView', r.chq, 'مشاهده چک'] : r.xfer ? ['acctXferOpen', r.xfer, 'مشاهده انتقال وجه'] : null;
  const sh = sheet((d.no ? 'سند حسابداری شماره ' + fa(d.no) : 'سند حسابداری') + ' · ' + Core.DOC_KIND[d.kind], '<div class="kv">' + (d.no ? '<span>شماره سند</span><b>' + fa(d.no) + '</b>' : '') + '<span>تاریخ</span><b>' + (d.date === '0000-00-00' ? 'اول دوره' : fmtDate(d.date)) + '</b><span>شرح</span><b>' + docTitle(d) + '</b></div>' + docLines([d]) +
    '<p class="hint">این سند خودکار از روی خود سند اصلی ساخته شده؛ برای تغییر، سند اصلی را ویرایش کنید.</p>' + (src ? '<button class="btn blue" data-src>' + esc(src[2]) + '</button>' : '') + '<button class="btn ghost" data-s>' + ico('share') + 'ارسال متن سند</button>');
  if (src) sh.q('[data-src]').onclick = () => { sh.close(); if (src[0] === 'go') goHash(src[1]); else actions[src[0]]({ id: String(src[1]) }); };
  sh.q('[data-s]').onclick = () => shareText([(d.no ? 'سند حسابداری شماره ' + fa(d.no) : 'سند حسابداری') + ' · ' + Core.DOC_KIND[d.kind] + ' — ' + (d.date === '0000-00-00' ? 'اول دوره' : fmtDate(d.date))].concat(...d.entries.map(e => [e.desc].concat(e.lines.map(l => Core.accName(S, l.acc) + ': ' + (l.dr ? 'بدهکار ' + fmt(l.dr) : 'بستانکار ' + fmt(l.cr)))))).concat(['جمع: ' + fmt(d.dr)]).join('\n'), 'سند حسابداری');
}
function pageVouchers() {
  const f = DOC_IN[UI.docF] ? UI.docF : 'all', c = docsAll(), q = Core.docQuery(UI.docQ || ''), lim = UI.limDoc || 60;
  const rg = rangeOf('doc');
  let h = tipBox('voucher') + sbox('doc-q', 'docQ', 'جستجو در همه اسناد: نام، شرح، مبلغ، شماره، کالا، تاریخ…', UI.docQ || '') + rangeBar('doc') + chips('docF', f, DOC_F);
  const want = f === 'all' ? null : new Set(DOC_IN[f]); let idx = [];
  const DS = DOC_SORT.some(x => x[0] === UI.docSort) ? UI.docSort : 'new'; h += sortSel('docSort', DS, DOC_SORT);
  for (let i = 0; i < c.docs.length; i++) { const d = c.docs[i]; if ((!want || want.has(d.kind)) && (!rg.on || (d.date !== '0000-00-00' && (!rg.from || d.date >= rg.from) && (!rg.to || d.date <= rg.to)))) idx.push(i); }
  if (q.length) { if (!docTextsReady(c)) return { title: 'اسناد حسابداری', html: h + '<div class="card"><p class="hint center">در حال آماده‌سازی جستجو در ' + fa(c.docs.length) + ' سند… <b id="doc-prog"></b></p></div>', fab: ['vchNew', '+'], back: '#/more' }; idx = idx.filter(i => Core.docMatch(c.texts[i], q)); }
  if (DS !== 'new') { const D = c.docs; idx.sort({ old: (a, b) => b - a, amt_desc: (a, b) => D[b].dr - D[a].dr || a - b, amt_asc: (a, b) => D[a].dr - D[b].dr || a - b, no_desc: (a, b) => D[b].no - D[a].no, no_asc: (a, b) => D[a].no - D[b].no }[DS]); }
  h += idx.length ? '<p class="hint">' + fa(idx.length) + ' سند' + (rg.on ? ' در این بازه' : '') + (q.length ? ' پیدا شد' : '') + '</p><div class="card flush">' + idx.slice(0, lim).map(i => docRow(c.docs[i])).join('') + '</div>' + moreBtn('limDoc', Math.min(lim, idx.length), idx.length)
    : q.length ? (f !== 'all' && c.texts.some(x => Core.docMatch(x, q)) ? '<div class="card"><p class="hint">در بخش «' + DOC_F.find(x => x[0] === f)[1] + '» پیدا نشد، ولی در اسناد دیگر هست.</p><button class="btn blue" data-act="chip" data-k="docF" data-v="all">نمایش در همه اسناد</button></div>' : empty(ico('search'), 'سندی با این کلمه یا عدد پیدا نشد.')) : f === 'voucher' ? empty(ico('file'), 'هنوز سند دستی ثبت نشده است. اسناد خرید و فروش، دریافت و پرداخت و هزینه‌ها خودکار ثبت می‌شوند؛ سند دستی برای موارد خاص است (وام، سرمایه، اصلاح حساب، …).', '<button class="btn blue" data-act="vchNew">+ سند جدید</button>') : empty(ico('file'), 'سندی در این بخش نیست.');
  h += '<div class="toolbar"><button class="btn ghost sm" data-act="go" data-h="#/reports/jr">' + ico('listplus') + 'دفتر روزنامه</button>' + (isAdmin() ? '<button class="btn ghost sm" data-act="go" data-h="#/coa">' + ico('file') + 'کدینگ حساب‌ها</button>' : '') + '</div>';
  return { title: 'اسناد حسابداری', html: h, fab: ['vchNew', '+'], back: '#/more' };
}

/* ═════════════ chart of accounts ═════════════ */
function pageCoa() {
  const C0 = Core.coa(S), tb = Core.trialBalance(S, null, null, false), bal = {}; tb.rows.forEach(r => { bal[r.code] = r.bal; });
  const tbd = Core.trialBalance(S, null, null, true), tbal = {}; tbd.rows.forEach(r => { const m = /:T(\d+)$/.exec(r.key); if (m) tbal[m[1]] = (tbal[m[1]] || 0) + r.bal; });
  const side = v => (v ? fmt(Math.abs(v)) + '<small>' + (v > 0 ? ' بد' : ' بس') + '</small>' : '<small class="hint">—</small>');
  let h = tipBox('coa') + '<div class="toolbar"><button class="btn blue sm" data-act="coaAdd" data-l="kol">+ حساب کل</button><button class="btn ghost sm" data-act="tafNew">+ حساب تفصیلی</button><button class="btn ghost sm" data-act="go" data-h="#/reports/tb">' + ico('scale') + 'تراز آزمایشی</button></div>';
  C0.groups.forEach(g => {
    h += '<div class="ch gs-h">' + fa(g.code) + ' · ' + esc(g.name) + ' <button class="lnk" data-act="coaRen" data-c="' + g.code + '">تغییر نام</button></div>';
    g.kols.forEach(k => {
      const kb = k.moins.reduce((t, m) => t + (bal[m.code] || 0), 0);
      h += '<div class="card flush coak"><div class="coah"><b>' + fa(k.code) + ' · ' + esc(k.name) + '</b><span class="end"><em>' + side(kb) + '</em><button class="mini" data-act="coaAdd" data-l="moin" data-k="' + k.code + '">+ معین</button><button class="mini" data-act="coaRen" data-c="' + k.code + '">نام</button>' + (k.sys ? '' : '<button class="mini" data-act="coaDel" data-c="' + k.code + '">حذف</button>') + '</span></div>' +
        (k.moins.length ? k.moins.map(m => '<div class="xr coam"><span><b>' + fa(m.code) + ' · ' + esc(m.name) + '</b><small>' + (m.sys ? 'حساب اصلی برنامه' : 'حساب تعریف‌شده شما') + (m.lock ? ' · ثبت خودکار' : m.need === 'person' ? ' · تفصیلی: اشخاص' : m.need === 'cash' ? ' · تفصیلی: صندوق‌ها' : m.need === 'bank' ? ' · تفصیلی: بانک‌ها' : m.code === '6100' ? ' · تفصیلی: گروه‌های هزینه' : '') + '</small></span><em>' + side(bal[m.code] || 0) + '</em><span class="end"><button class="mini" data-act="coaRen" data-c="' + m.code + '">نام</button>' + (m.sys ? '' : '<button class="mini" data-act="coaDel" data-c="' + m.code + '">حذف</button>') + '</span></div>').join('') : '<p class="hint" style="padding:8px 12px">هنوز حساب معینی ندارد.</p>') + '</div>';
    });
  });
  const T = (S.tafsil || []).slice().sort((a, b) => (+a.code || 0) - (+b.code || 0));
  h += '<div class="ch gs-h">' + ico('users') + 'حساب‌های تفصیلی شما <button class="lnk" data-act="tafNew">+ جدید</button></div>' + (T.length ? '<div class="card flush">' + T.map(t => '<button class="xr" data-act="tafEdit" data-id="' + t.id + '"><span><b>' + fa(t.code) + ' · ' + esc(t.name) + (t.archived ? ' <small class="hint">(بایگانی)</small>' : '') + '</b><small>قابل استفاده زیر هر حساب معین آزاد</small></span><em>' + side(tbal[t.id] || 0) + '</em></button>').join('') + '</div>' : '<p class="hint">اشخاص، صندوق‌ها، بانک‌ها و گروه‌های هزینه خودشان تفصیلی هستند. برای مواردی مثل «وام بانک ملت»، «شریک الف» یا «پروژه ب» حساب تفصیلی بسازید.</p>');
  return { title: 'کدینگ حساب‌ها', html: h, back: '#/more' };
}
function coaAddForm(level, kol) {
  let code = '';
  if (level === 'moin') { const used = new Set(); Core.coa(S).groups.forEach(g => g.kols.forEach(k => k.moins.forEach(m => used.add(m.code)))); for (let i = 1; i < 100; i++) { const c = kol + String(i).padStart(2, '0'); if (!used.has(c)) { code = c; break; } } }
  const sh = sheet(level === 'kol' ? 'حساب کل جدید' : 'حساب معین جدید زیر «' + Core.coaName(S, kol) + '»', '<form id="caf"><p class="hint">' + (level === 'kol' ? 'کد حساب کل دو رقم است؛ رقم اول، گروه: ۱ دارایی، ۲ بدهی، ۳ سرمایه، ۴ درآمد، ۵ بهای تمام‌شده، ۶ هزینه.' : 'کد حساب معین چهار رقم است و با کد حساب کل (' + fa(kol) + ') شروع می‌شود.') + '</p><label class="fld"><span>کد</span><input class="inp ltr" name="code" inputmode="numeric" value="' + fa(code) + '"></label><label class="fld"><span>نام حساب</span><input class="inp" name="name" placeholder="' + (level === 'kol' ? 'مثلاً: بدهی‌های بلندمدت' : 'مثلاً: وام‌های دریافتی') + '"></label><button class="btn blue">ثبت حساب</button></form>');
  sh.q('#caf').onsubmit = async e => { e.preventDefault(); const f = e.target; if (await done(Core.addCoa(S, { level, code: Core.toEn(f.code.value), name: f.name.value }), 'حساب ثبت شد.')) sh.close(); };
}
function tafsilForm(t) {
  const sh = sheet(t ? 'حساب تفصیلی' : 'حساب تفصیلی جدید', '<form id="tff"><label class="fld"><span>کد</span><input class="inp ltr" name="code" inputmode="numeric" value="' + fa(t ? t.code : Core.nextTafsilCode(S)) + '"></label><label class="fld"><span>نام</span><input class="inp" name="name" value="' + esc(t ? t.name : '') + '" placeholder="مثلاً: وام بانک ملت، شریک الف"></label>' + (t ? '<label class="chk"><input type="checkbox" name="arch"' + (t.archived ? ' checked' : '') + '> بایگانی (در انتخاب حساب نمایش داده نشود)</label>' : '') + '<button class="btn blue">ذخیره</button>' + (t ? '<button type="button" class="btn ghost red" data-del>حذف</button>' : '') + '</form>');
  sh.q('#tff').onsubmit = async e => { e.preventDefault(); const f = e.target, d = { code: Core.toEn(f.code.value), name: f.name.value, archived: f.arch ? f.arch.checked : undefined }; if (await done(t ? Core.editTafsil(S, t.id, d) : Core.addTafsil(S, d), 'ذخیره شد.')) sh.close(); };
  if (t) sh.q('[data-del]').onclick = async () => { if (await confirmBox('حساب تفصیلی «' + t.name + '» حذف شود؟', 'حذف', true) && await done(Core.deleteTafsil(S, t.id), 'حذف شد.')) sh.close(); };
}

/* ═════════════ fiscal years ═════════════ */
function pageFiscal() {
  const Y = Core.fiscalYears(S, today()).slice().reverse(), lastClosed = (S.fyClosed || []).reduce((m, y) => (!m || y.to > m.to ? y : m), null);
  let h = tipBox('fiscal') + '<p class="hint center">شروع سال مالی: ' + Core.MONTHS[fyMonth() - 1] + ' <button class="lnk" data-act="go" data-h="#/settings">تغییر</button></p>';
  h += Y.map(y => {
    const st = y.closed ? 'closed' : y.ended ? 'ended' : 'current', pl = Core.ledgerPL(S, y.from, y.to < today() ? y.to : today());
    return '<div class="card fyc ' + st + '"><div class="ch">' + ico('calendar') + 'سال مالی ' + fa(y.label) + ' <i class="tag ' + st + '">' + (st === 'closed' ? 'بسته شده' : st === 'ended' ? 'پایان یافته؛ آماده بستن' : 'سال جاری') + '</i></div>' +
      '<div class="kv"><span>از ' + fmtDate(y.from) + ' تا ' + fmtDate(y.to) + '</span><b class="' + (pl.net < 0 ? 'debit' : 'credit') + '">' + (pl.net < 0 ? 'زیان ' : 'سود ') + fmt(Math.abs(pl.net)) + '</b></div>' +
      (y.closed ? '<p class="hint">بسته شده در ' + fmtDate(Core.todayISO(new Date(y.closed.at))) + '؛ اسناد این سال قابل تغییر نیست.</p><div class="toolbar">' + (y.closed.vchs ? y.closed.vchs.map(id => Core.byId(S.vouchers || [], id)).filter(Boolean).map(v => '<button class="btn ghost sm" data-act="vchOpen" data-id="' + v.id + '">' + ico('file') + fa(v.no) + ' · ' + FY_DOC(v) + '</button>').join('') : (y.closed.vch ? '<button class="btn ghost sm" data-act="vchOpen" data-id="' + y.closed.vch + '">سند بستن حساب‌ها</button>' : '') + '<button class="btn ghost sm" data-act="fyEntries" data-y="' + y.label + '" data-k="closing">سند اختتامیه</button><button class="btn ghost sm" data-act="fyEntries" data-y="' + y.label + '" data-k="opening">سند افتتاحیه سال بعد</button>') + (lastClosed && lastClosed.label === y.label ? '<button class="btn ghost sm red" data-act="fyReopen" data-y="' + y.label + '">برگرداندن بستن</button>' : '') + '</div>'
        : st === 'ended' ? '<button class="btn blue" data-act="fyClose" data-y="' + y.label + '">' + ico('lock') + 'بستن سال مالی ' + fa(y.label) + '</button>' : '<p class="hint">بعد از پایان سال (' + fmtDate(y.to) + ') می‌توانید آن را ببندید.</p>') +
      '<button class="lnk" data-act="repGoR" data-f="' + y.from + '" data-to="' + y.to + '">گزارش عملکرد این سال</button></div>';
  }).join('');
  return { title: 'سال مالی و بستن حساب‌ها', html: h, back: '#/more' };
}
const FY_DOC = v => (v.kind === 'yclose' ? 'سند اختتامیه' : v.kind === 'yopen' ? 'سند افتتاحیه' : v.kind === 'closing' ? (v.step === 2 ? 'انتقال سود و زیان' : 'بستن حساب‌های موقت') : 'سند دستی');
async function fyCloseFlow(label) {
  toast('در حال بررسی اسناد سال…'); await new Promise(r => setTimeout(r, 60)); // let the message show before the checks run
  const pv = Core.closingPreview(S, label, today());
  if (pv.problems.length) return alertBox('بستن سال ' + fa(label) + ' ممکن نیست', '<ul>' + pv.problems.map(p => '<li>' + esc(p) + '</li>').join('') + '</ul>');
  const p = pv.pl, row = (l, v, c) => '<div class="rr"><span>' + l + '</span><b class="' + (c || '') + '">' + fmt(v) + '</b></div>';
  const sh = sheet('بستن سال مالی ' + fa(label), '<p class="hint">از ' + fmtDate(pv.from) + ' تا ' + fmtDate(pv.to) + '</p><div class="card">' + row('فروش خالص', p.netSales) + row('بهای تمام‌شده و ضایعات', p.cogs + p.waste, 'debit') + row('سایر درآمدها', p.other) + row('هزینه‌ها', p.opex + p.fee + p.otherExp, 'debit') + '<div class="rr b"><span>' + (pv.profit < 0 ? 'زیان' : 'سود') + ' خالص سال</span><b class="' + (pv.profit < 0 ? 'debit' : 'credit') + '">' + fmt(Math.abs(pv.profit)) + '</b></div></div>' +
    (pv.warn.length ? '<div class="alert warn">' + pv.warn.map(esc).join('<br>') + '</div>' : '') +
    '<div class="msg"><b>با بستن سال، این اسناد به ترتیب ثبت می‌شوند:</b><ol><li>«سند بستن حساب‌های موقت» (' + fmtDate(pv.to) + '): حساب‌های درآمد، بهای تمام‌شده و هزینه (' + fa(Math.max(0, pv.lines.length - 1)) + ' حساب) صفر و به «خلاصه سود و زیان» بسته می‌شوند.</li><li>«سند انتقال سود و زیان» (' + fmtDate(pv.to) + '): ' + (pv.profit < 0 ? 'زیان' : 'سود') + ' سال از «خلاصه سود و زیان» به «سود (زیان) انباشته» می‌رود.</li><li>«سند اختتامیه» (' + fmtDate(pv.to) + '): همه حساب‌های دارایی، بدهی و سرمایه (تا سطح هر شخص، صندوق و بانک) بسته می‌شوند.</li><li>«سند افتتاحیه» (' + fmtDate(Core.addDays(pv.to, 1)) + '): همان مانده‌ها در سال جدید باز می‌شوند.</li></ol><ul><li>همه اسناد تا ' + fmtDate(pv.to) + ' قفل می‌شوند و دیگر تغییر نمی‌کنند.</li><li>مانده اشخاص، صندوق و بانک، چک‌ها و موجودی کالا بدون تغییر به سال بعد ادامه پیدا می‌کنند.</li><li>هر وقت لازم شد، با «برگرداندن بستن» همه‌چیز به حالت قبل برمی‌گردد.</li></ul></div>' +
    '<label class="chk"><input type="checkbox" id="fy-ok"> اسناد این سال کامل و درست ثبت شده‌اند.</label><button class="btn blue" id="fy-go">' + ico('lock') + 'بستن سال</button>');
  sh.q('#fy-go').onclick = async () => {
    if (!sh.q('#fy-ok').checked) return toast('اول تأیید کنید که اسناد سال کامل است.', true);
    sh.close(); if (!(await backupFirst('بستن سال مالی ' + fa(label), 'قبل از بستن سال، یک پشتیبان بگیرید.', 'ببند'))) return;
    askPass(async () => { const r = Core.closeYear(S, label, today(), { quick: true }); if (!r.ok) return toast(r.error, true); await save(); alertBox('سال ' + fa(label) + ' بسته شد', esc(fa(r.ids.length) + ' سند ثبت شد (بستن حساب‌های موقت، انتقال سود و زیان، اختتامیه و افتتاحیه). ' + (r.profit < 0 ? 'زیان ' : 'سود ') + fmt(Math.abs(r.profit)) + ' ' + UNIT() + ' به «سود (زیان) انباشته» منتقل شد و اسناد تا ' + fmtDate(Core.closedTo(S)) + ' قفل شدند.')); render(); });
  };
}
function fyEntriesView(label, kind) {
  const E = Core.yearEndEntries(S, label), L = E[kind], t = vSum(L);
  const sh = sheet((kind === 'closing' ? 'سند اختتامیه سال ' : 'سند افتتاحیه پس از سال ') + fa(label), '<p class="hint">تاریخ: ' + fmtDate(kind === 'closing' ? E.closingDate : E.openingDate) + '. این سند برای نمایش و چاپ است و جداگانه ثبت نمی‌شود؛ مانده حساب‌های دائمی به‌طور پیوسته به سال بعد منتقل می‌شوند.</p>' +
    '<div class="card flush vlines"><div class="vlh"><span>حساب</span><span>بدهکار</span><span>بستانکار</span></div>' + L.map(l => '<div class="vl"><span><b>' + esc(Core.accName(S, l.acc)) + '</b><small>' + fa(Core.keyCode(l.acc, l.dr - l.cr)) + (l.note ? ' · ' + esc(l.note) : '') + '</small></span><em>' + (l.dr ? fmt(l.dr) : '') + '</em><em>' + (l.cr ? fmt(l.cr) : '') + '</em></div>').join('') + '<div class="vl tot"><span><b>جمع</b></span><em>' + fmt(t.dr) + '</em><em>' + fmt(t.cr) + '</em></div></div><button class="btn ghost" data-x>' + ico('file') + 'خروجی اکسل</button>');
  sh.q('[data-x]').onclick = () => exportFile((kind === 'closing' ? 'ekhtetamieh-' : 'eftetahieh-') + label + '.csv', csvFile([['کد', 'حساب', 'بدهکار', 'بستانکار']].concat(L.map(l => [Core.keyCode(l.acc, l.dr - l.cr), Core.accName(S, l.acc), l.dr, l.cr]))), 'text/csv');
}

/* ═════════════ cheques ═════════════ */
const CHQ_ACT = { bank: 'واگذاری به بانک', cleared: 'وصول شد', spent: 'خرج کردن (دادن به شخص دیگر)', returned: 'عودت به صاحب چک', bounced: 'برگشت خورد', paid: 'پاس شد', cancelled: 'ابطال / عودت از گیرنده' };
const CHQ_HINT = { bank: 'چک از «اسناد دریافتنی» به «اسناد در جریان وصول» می‌رود.', cleared: 'مبلغ به صندوق/بانک انتخابی واریز می‌شود.', spent: 'حساب شخص گیرنده بدهکار می‌شود (مثل پرداخت به او).', returned: 'چک به صاحبش برمی‌گردد و بدهی او دوباره زنده می‌شود.', bounced: 'بدهی صاحب چک دوباره زنده می‌شود.', paid: 'مبلغ از حساب بانکی صادرکننده برداشته می‌شود.', cancelled: 'بدهی شما به گیرنده دوباره زنده می‌شود.' };
// green = cleared/paid, blue = waiting, orange = due within 3 days, red = overdue or bounced, grey = returned / cancelled / passed on
const chqTone = c => { const st = c.state || (c.done ? 'cleared' : 'box'); if ((st === 'box' || st === 'bank' || st === 'issued') && c.dueDate) { const d = Core.diffDays(today(), c.dueDate); if (d < 0) return 'late'; if (d <= 3) return 'soon'; } return st; };
const chqTag = c => '<i class="ctag ' + chqTone(c) + '">' + (c.cyc ? Core.CHQ_FA[c.state] : c.done ? 'انجام‌شده' : 'در انتظار') + '</i>';
function pageCheques() {
  const t = today(), cyc = S.cheques.filter(c => c.cyc), legacy = S.cheques.filter(c => !c.cyc), sum = f => cyc.filter(f).reduce((s, c) => s + c.amount, 0);
  let tab = UI.chqDir || 'receive'; if (tab === 'other' && !legacy.length) tab = 'receive';
  const q = (UI.chqQ || '').trim(); let h = tipBox('cheque') + '<div class="kpis"><div class="kpi"><small>در صندوق (اسناد دریافتنی)</small><b class="credit">' + fmt(sum(c => c.state === 'box')) + '</b></div><div class="kpi"><small>در جریان وصول</small><b>' + fmt(sum(c => c.state === 'bank')) + '</b></div><div class="kpi"><small>صادره پاس‌نشده</small><b class="debit">' + fmt(sum(c => c.state === 'issued')) + '</b></div><div class="kpi"><small>سررسید گذشته</small><b class="' + (cyc.some(c => !c.done && c.dueDate < t) ? 'debit' : '') + '">' + fa(cyc.filter(c => !c.done && c.dueDate < t).length) + '</b></div></div>';
  h += sbox('chq-q', 'chqQ', 'جستجوی شماره چک، مبلغ، بانک، شخص، سررسید…', q);
  h += chips('chqDir', tab, [['receive', 'چک‌های دریافتی'], ['pay', 'چک‌های پرداختی']].concat(legacy.length ? [['other', 'اقساط و یادآورها']] : []));
  if (tab === 'other') {
    const list = legacy.filter(c => (UI.chqTab === 'open' ? !c.done : c.done) && (!q || Core.smartChequeMatch(c, q, c.personId ? personName(c.personId) : ''))).sort((a, b) => UI.chqTab === 'open' ? (a.dueDate < b.dueDate ? -1 : 1) : (a.doneAt < b.doneAt ? 1 : -1));
    h += chips('chqTab', UI.chqTab, [['open', 'در انتظار'], ['done', 'انجام‌شده']]);
    h += list.length ? '<div class="card flush">' + list.slice(0, UI.limChq).map(c => { const st = Core.chequeStatus(c, t), dd = Core.diffDays(t, c.dueDate); return '<div class="row static"><span><b>' + (c.kind === 'cheque' ? ico('receipt') : ico('cheque')) + esc(c.title) + '</b><small>' + (c.personId ? esc(personName(c.personId)) + ' · ' : '') + (c.direction === 'receive' ? 'دریافتی' : 'پرداختی') + ' · ' + fmtDate(c.dueDate) + (st === 'overdue' ? ' · <u class="debit">' + fa(-dd) + ' روز گذشته</u>' : st === 'soon' ? ' · ' + (dd === 0 ? 'امروز' : fa(dd) + ' روز دیگر') : '') + '</small></span><span class="end"><em>' + fmt(c.amount) + '</em>' + (c.done ? '<button class="mini" data-act="chqReopen" data-id="' + c.id + '">بازگردانی</button>' : '<button class="mini ok" data-act="chqDone" data-id="' + c.id + '">انجام شد</button>') + '<button class="mini" data-act="chqEdit" data-id="' + c.id + '">ویرایش</button><button class="mini" data-act="chqDel" data-id="' + c.id + '">حذف</button></span></div>'; }).join('') + '</div>' : empty(ico('cheque'), 'موردی نیست.');
    h += '<p class="hint">این‌ها اقساط و چک‌هایی هستند که قبل از نسخه جدید به‌صورت یادآور ثبت شده‌اند و مثل قبل کار می‌کنند. چک‌های تازه را از دکمه «+» با چرخه کامل ثبت کنید.</p>';
    return { title: 'چک‌ها', html: h, fab: ['addCheque', '+'], back: '#/more' };
  }
  const states = tab === 'receive' ? [['open', 'در جریان'], ['box', 'در صندوق'], ['bank', 'واگذار به بانک'], ['cleared', 'وصول‌شده'], ['spent', 'خرج‌شده'], ['bounced', 'برگشتی'], ['returned', 'عودتی'], ['all', 'همه']] : [['open', 'پاس‌نشده'], ['paid', 'پاس‌شده'], ['bounced', 'برگشتی'], ['cancelled', 'باطل‌شده'], ['all', 'همه']];
  const sf = states.some(s => s[0] === UI.chqSt) ? UI.chqSt : 'open';
  const list = cyc.filter(c => q ? Core.smartChequeMatch(c, q, personName(c.personId)) : c.direction === tab && (sf === 'all' || (sf === 'open' ? !c.done : c.state === sf))).sort((a, b) => (sf === 'open' ? (a.dueDate < b.dueDate ? -1 : 1) : (a.dueDate < b.dueDate ? 1 : -1)));
  h += '<div class="chips scroll">' + states.map(s => '<button type="button" class="chip' + (s[0] === sf ? ' on' : '') + '" data-act="chip" data-k="chqSt" data-v="' + s[0] + '">' + s[1] + ' <small>' + fa(cyc.filter(c => c.direction === tab && (s[0] === 'all' || (s[0] === 'open' ? !c.done : c.state === s[0]))).length) + '</small></button>').join('') + '</div>';
  if (q) h += '<p class="hint">جستجو در تمام چک‌های دریافتی و پرداختی، بدون محدودیت وضعیت. فیلترهای بالای صفحه هنگام پاک شدن جستجو دوباره اعمال می‌شوند.</p>';
  h += '<div class="rsum"><span>' + fa(list.length) + ' چک</span><b>جمع ' + fmt(list.reduce((s, c) => s + c.amount, 0)) + ' ' + UNIT() + '</b></div>';
  h += list.length ? '<div class="card flush">' + list.slice(0, UI.limChq || 100).map(c => { const dd = Core.diffDays(t, c.dueDate); return '<button class="xr" data-act="chqView" data-id="' + c.id + '"><span><b>' + esc(personName(c.personId)) + (c.serial ? ' <small class="ltr">#' + fa(c.serial) + '</small>' : '') + '</b><small>' + (c.direction === 'receive' ? (c.bank ? 'بانک ' + esc(c.bank) + ' · ' : '') : esc(Core.acctName(Core.byId(S.accounts, c.acct))) + ' · ') + 'سررسید ' + fmtDate(c.dueDate) + (!c.done && dd < 0 ? ' · <u class="debit">' + fa(-dd) + ' روز گذشته</u>' : !c.done && dd <= 7 ? ' · ' + (dd === 0 ? 'امروز' : fa(dd) + ' روز دیگر') : '') + '</small></span><em>' + fmt(c.amount) + '</em>' + chqTag(c) + '</button>'; }).join('') + '</div>' : empty(ico('cheque'), tab === 'receive' ? 'چک دریافتی در این وضعیت نیست.' : 'چک پرداختی در این وضعیت نیست.', '<button class="btn blue" data-act="addCheque">+ ثبت چک</button>');
  return { title: 'چک‌ها', html: h, fab: ['addCheque', '+'], back: '#/more' };
}
function chequeForm(c, o) {
  o = o || {};
  if (c && !c.cyc || o.legacy) return legacyChequeForm(c, o);
  let pid = c ? c.personId : (o.p || null), dir = c ? c.direction : (o.dir || (UI.chqDir === 'pay' ? 'pay' : 'receive'));
  const first = !c || c.hist.length === 1, banks = acctList().filter(a => a.kind === 'bank');
  const sh = sheet(c ? 'ویرایش چک' : 'ثبت چک', '<form id="cf">' + (c ? '' : '<div class="chips"><button type="button" class="chip" data-dir="receive">چک دریافتی</button><button type="button" class="chip" data-dir="pay">چک پرداختی</button><button type="button" class="chip" data-inst>قسط / یادآور</button></div>') +
    '<label class="fld"><span id="cf-pl"></span><button type="button" class="inp pick" id="cf-p"' + (first ? '' : ' disabled') + '>' + esc(pid ? personName(pid) : 'انتخاب شخص…') + '</button></label>' +
    (first ? '<label class="fld"><span>تخصیص چک به فاکتور (اختیاری)</span><select class="inp" id="cf-invoice"><option value="">بدون ارتباط با فاکتور مشخص</option></select><small>چک در مانده حساب شخص همیشه ثبت می‌شود؛ انتخاب فاکتور مانده همان فاکتور را نیز به‌روزرسانی می‌کند.</small></label>' : '') +
    '<div' + (first ? '' : ' hidden') + '>' + moneyField('amount', c ? c.amount : 0, 'مبلغ چک') + '</div>' +
    '<div class="row2"><label class="fld"><span>شماره چک (سریال)</span><input class="inp ltr" name="serial" inputmode="numeric" value="' + esc(c ? fa(c.serial || '') : '') + '"></label>' + dateField('due', c ? c.dueDate : today(), 'تاریخ سررسید') + '</div>' +
    '<div id="cf-recv"><div class="row2"><label class="fld"><span>بانک صادرکننده</span><input class="inp" name="bank" list="cf-banks" value="' + esc(c ? c.bank || '' : '') + '" placeholder="مثلاً ملت"></label><label class="fld"><span>شعبه (اختیاری)</span><input class="inp" name="branch" value="' + esc(c ? c.branch || '' : '') + '"></label></div><label class="fld"><span>صاحب حساب (اگر با شخص فرق دارد)</span><input class="inp" name="drawer" value="' + esc(c ? c.drawer || '' : '') + '"></label><datalist id="cf-banks">' + Core.BANKS.map(b => '<option value="' + esc(b) + '">').join('') + '</datalist></div>' +
    '<div id="cf-pay"' + (first ? '' : ' hidden') + '>' + (banks.length ? '<label class="fld"><span>از حساب بانکی (دسته‌چک)</span><select class="inp" name="acct">' + banks.map(a => '<option value="' + a.id + '"' + (c && c.acct === a.id ? ' selected' : '') + '>' + esc(Core.acctName(a)) + '</option>').join('') + '</select></label>' : '<div class="alert warn">برای صدور چک، اول حساب بانکی را در «صندوق و بانک‌ها» تعریف کنید. <button type="button" class="lnk" data-act="acctNew" data-k="bank">تعریف حساب بانکی</button></div>') + '</div>' +
    '<div' + (first ? '' : ' hidden') + '>' + dateField('date', c ? c.date : today(), 'تاریخ ثبت (دریافت / صدور)') + '</div>' +
    '<label class="fld"><span>شرح</span><input class="inp" name="note" value="' + esc(c ? c.note || '' : '') + '"></label>' +
    '<p class="hint" id="cf-h"></p><button class="btn blue" type="submit">' + (c ? 'ذخیره' : 'ثبت چک') + '</button></form>');
  let invoiceId = c ? (c.invoiceId || null) : (o.invoiceId || null);
  const drawInvoices = () => {
    const sel = sh.q('#cf-invoice'); if (!sel) return;
    const allowed = dir === 'receive' ? ['sale', 'purchase_return'] : ['purchase', 'sale_return'];
    const options = S.invoices.filter(i => i.personId === pid && allowed.includes(i.type) && (i.id === invoiceId || Core.invoiceInfo(S, i).remaining > 0));
    if (!options.some(i => i.id === invoiceId)) invoiceId = null;
    sel.innerHTML = '<option value="">بدون ارتباط با فاکتور مشخص</option>' + options.map(i => '<option value="' + i.id + '"' + (i.id === invoiceId ? ' selected' : '') + '>فاکتور ' + esc(fa(i.no)) + ' · ' + esc(Core.TYPE_FA[i.type]) + ' · مانده ' + esc(fmt(Core.invoiceInfo(S, i).remaining)) + '</option>').join('');
  };
  const setDir = d => { dir = d; sh.qa('[data-dir]').forEach(b => b.classList.toggle('on', b.dataset.dir === d)); sh.q('#cf-recv').hidden = d !== 'receive'; sh.q('#cf-pay').hidden = d !== 'pay' || !first; sh.q('#cf-pl').textContent = d === 'receive' ? 'از چه کسی (پرداخت‌کننده چک)' : 'به چه کسی (گیرنده چک)'; sh.q('#cf-h').textContent = d === 'receive' ? 'با ثبت، حساب شخص بستانکار و چک در «اسناد دریافتنی» (در صندوق) قرار می‌گیرد.' : 'با ثبت، حساب شخص بدهکار و چک در «اسناد پرداختنی» قرار می‌گیرد؛ با پاس شدن از بانک برداشت می‌شود.'; };
  setDir(dir); drawInvoices();
  const chequeDraft=Drafts.attachSheet(sh,'cheque:'+(c ? 'edit:'+c.id : 'new'),{
    getExtra:()=>({pid,dir,invoiceId}),
    setExtra:x=>{
      if(x.pid && Core.byId(S.people,+x.pid)) { pid=+x.pid;sh.q('#cf-p').textContent=personName(pid); }
      if(x.dir==='pay'||x.dir==='receive') {dir=x.dir;setDir(dir);}
      invoiceId=+x.invoiceId||null;drawInvoices();
    },afterRestore:()=>{setDir(dir);drawInvoices();}
  });
  sh.qa('[data-dir]').forEach(b => { b.onclick = () => { setDir(b.dataset.dir); drawInvoices(); Drafts.touch(sh.q('#cf')); }; });
  if (sh.q('#cf-invoice')) sh.q('#cf-invoice').onchange = e => { invoiceId = +e.target.value || null; };
  if (sh.q('[data-inst]')) sh.q('[data-inst]').onclick = () => { sh.close(); legacyChequeForm(null, { inst: true }); };
  sh.q('#cf-p').onclick = () => pickList('انتخاب شخص', personItems(), v => { pid = +v; sh.q('#cf-p').textContent = personName(pid); drawInvoices(); Drafts.touch(sh.q('#cf')); });
  sh.q('#cf').onsubmit = async e => {
    e.preventDefault(); const f = e.target, due = readDate(f, 'due'), date = readDate(f, 'date'), amount = Core.parseMoney(f.amount.value);
    if (!pid) return toast('شخص را انتخاب کنید.', true); if (!amount) return toast('مبلغ را درست وارد کنید.', true); if (!due) return toast('تاریخ سررسید نامعتبر است.', true); if (!date) return toast('تاریخ ثبت نامعتبر است.', true);
    const d = { cycle: true, kind: 'cheque', direction: dir, personId: pid, invoiceId, amount, dueDate: due, date, serial: Core.toEn(f.serial.value), bank: f.bank.value, branch: f.branch.value, drawer: f.drawer.value, acct: f.acct ? +f.acct.value : null, note: f.note.value, title: '' };
    if (await done(c ? Core.editCheque(S, c.id, d) : Core.addCheque(S, d), c ? 'چک اصلاح شد.' : 'چک ثبت شد.')) {chequeDraft.clear(); sh.close();}
  };
}
function legacyChequeForm(c, o) {
  o = o || {}; let pid = c ? c.personId : null;
  const sh = sheet(c ? 'ویرایش' : 'ثبت قسط / یادآور', '<form id="cf"><div class="row2"><label class="fld"><span>نوع</span><select class="inp" name="kind"><option value="installment">قسط</option><option value="cheque">چک (یادآور)</option></select></label><label class="fld"><span>جهت</span><select class="inp" name="dir"><option value="receive">دریافتی (از شخص)</option><option value="pay">پرداختی (به شخص)</option></select></label></div><label class="fld"><span>شخص (اختیاری)</span><button type="button" class="inp pick" id="cf-p">' + esc(pid ? personName(pid) : 'انتخاب…') + '</button></label><label class="fld"><span>عنوان</span><input class="inp" name="title" value="' + esc(c ? c.title : '') + '"></label>' + moneyField('amount', c ? c.amount : 0, 'مبلغ') + dateField('due', c ? c.dueDate : today(), 'سررسید') + '<label class="fld"><span>یادداشت</span><input class="inp" name="note" value="' + esc(c ? c.note || '' : '') + '"></label><p class="hint">یادآور در حساب شخص اثری ندارد؛ وقتی انجام شد، می‌توانید دریافت یا پرداخت را ثبت کنید.</p><button class="btn blue">' + (c ? 'ذخیره' : 'ثبت') + '</button></form>');
  if (c) { sh.q('[name=kind]').value = c.kind; sh.q('[name=dir]').value = c.direction; }
  const legacyDraft=Drafts.attachSheet(sh,'cheque:legacy:'+(c ? 'edit:'+c.id : 'new'),{getExtra:()=>({pid}),setExtra:x=>{if(x.pid && Core.byId(S.people,+x.pid)){pid=+x.pid;sh.q('#cf-p').textContent=personName(pid);}}});
  sh.q('#cf-p').onclick = () => pickList('انتخاب شخص', personItems(), v => { pid = +v; sh.q('#cf-p').textContent = personName(pid); Drafts.touch(sh.q('#cf')); });
  const f = sh.q('#cf'); f.onsubmit = async e => { e.preventDefault(); const due = readDate(f, 'due'), amount = Core.parseMoney(f.amount.value); if (!due) return toast('تاریخ نامعتبر است.', true); if (!amount) return toast('مبلغ را درست وارد کنید.', true); const dd = { kind: f.kind.value, direction: f.dir.value, personId: pid, title: f.title.value, amount, dueDate: due, note: f.note.value }; if (await done(c ? Core.editCheque(S, c.id, dd) : Core.addCheque(S, dd), c ? 'اصلاح شد.' : 'ثبت شد.')) {legacyDraft.clear(); sh.close();} };
}
function chequeView(id) {
  const c = Core.byId(S.cheques, id); if (!c) return toast('چک پیدا نشد.', true); if (!c.cyc) { UI.chqDir = 'other'; return goHash('#/cheques'); }
  const kv = (l, v) => (v ? '<div class="kv"><span>' + l + '</span><b>' + v + '</b></div>' : ''), nx = Core.chequeNext(c);
  const sh = sheet((c.direction === 'receive' ? 'چک دریافتی' : 'چک پرداختی') + (c.serial ? ' ' + fa(c.serial) : ''), '<div class="card hero ' + (c.direction === 'receive' ? 'c' : 'd') + '"><small>' + Core.CHQ_FA[c.state] + '</small><b>' + fmt(c.amount) + ' <i>' + UNIT() + '</i></b></div>' +
    kv(c.direction === 'receive' ? 'از' : 'به', '<a data-act="go" data-h="#/person/' + c.personId + '">' + esc(personName(c.personId)) + '</a>') + kv('شماره چک', c.serial ? '<span class="ltr">' + fa(c.serial) + '</span>' : '') + kv('بانک', esc((c.bank ? 'بانک ' + c.bank : '') + (c.branch ? ' - شعبه ' + c.branch : ''))) + kv('صاحب حساب', esc(c.drawer || '')) + kv('از حساب', c.acct ? esc(Core.acctName(Core.byId(S.accounts, c.acct))) : '') + kv('تاریخ ثبت', fmtDate(c.date)) + kv('سررسید', fmtDate(c.dueDate)) + (c.note ? '<p class="hint">' + esc(c.note) + '</p>' : '') +
    '<div class="ch">سابقه چک</div><div class="ctl">' + c.hist.map(h => '<div class="cst"><b>' + Core.CHQ_FA[h.s] + '</b><small>' + fmtDate(h.date) + (h.acct ? ' · ' + esc(Core.acctName(Core.byId(S.accounts, h.acct))) : '') + (h.to ? ' · به ' + esc(personName(h.to)) : '') + (h.note ? ' · ' + esc(h.note) : '') + (h.rec ? ' · ✓ تطبیق با بانک' : '') + '</small></div>').join('') + '</div>' +
    (nx.length ? '<div class="ch">مرحله بعد</div>' + nx.map(a => '<button class="btn ' + (a === 'cleared' || a === 'paid' ? 'green' : a === 'bounced' ? 'ghost red' : 'ghost') + '" data-a="' + a + '">' + CHQ_ACT[a] + '</button>').join('') : '') +
    '<div class="row2">' + (c.hist.length > 1 ? '<button class="btn ghost" data-u>' + ico('restore') + 'برگرداندن آخرین مرحله</button>' : '<button class="btn ghost red" data-d>حذف چک</button>') + '<button class="btn ghost" data-e>' + ico('edit') + 'ویرایش</button></div>');
  sh.qa('[data-a]').forEach(b => { b.onclick = () => { sh.close(); chequeActForm(c, b.dataset.a); }; });
  sh.q('[data-e]').onclick = () => { sh.close(); chequeForm(c); };
  if (sh.q('[data-u]')) sh.q('[data-u]').onclick = async () => { const l = c.hist[c.hist.length - 1]; if (!(await confirmBox('مرحله «' + Core.CHQ_FA[l.s] + '» (' + fmtDate(l.date) + ') برگردانده شود؟ اثر آن از حساب‌ها برداشته می‌شود.', 'برگردان'))) return; if (await done(Core.chequeUndo(S, c.id), 'برگردانده شد.')) sh.close(); };
  if (sh.q('[data-d]')) sh.q('[data-d]').onclick = async () => { if (!(await confirmBox('این چک حذف شود؟ اثر آن از حساب «' + personName(c.personId) + '» برداشته می‌شود.', 'حذف', true))) return; if (await done(Core.deleteCheque(S, c.id), 'چک حذف شد.')) sh.close(); };
}
// A single cheque-box picker is reused everywhere we spend a received cheque.
// Filters include serial, amount, person and bank; sorting never mutates saved data.
function pickBoxCheque(onPick, title, options) {
  options = options || {};
  const available = S.cheques.filter(c => c.cyc && c.direction === 'receive' && c.state === 'box' && Core.chequeNext(c).includes('spent'));
  if (!available.length) return alertBox('خرج چک', 'در حال حاضر چک دریافتی قابل خرج کردن در صندوق ندارید.');
  const person = options.personId && Core.byId(S.people, options.personId);
  const debt = person ? Math.max(0, -Core.balanceOf(S, person.id)) : 0;
  const sh = sheet(title || 'انتخاب چک از صندوق',
    '<div class="card"><label class="fld"><span>مبلغ هدف برای پیشنهاد هوشمند (' + UNIT() + ')</span><input class="inp" id="bx-target" inputmode="decimal" autocomplete="off" placeholder="مبلغ دلخواه را بنویسید" value="' + (debt ? esc(Core.fmtInput(debt)) : '') + '"></label>' +
    (person ? '<p class="hint">مانده بستانکاری ' + esc(personName(person.id)) + ': ' + fmt(debt) + ' ' + UNIT() + '. در صورت نیاز مبلغ هدف را تغییر دهید.</p>' : '<p class="hint">مبلغ موردنظر را وارد کنید تا چک‌های نزدیک به آن پیشنهاد شوند.</p>') +
    '<div id="bx-suggest" aria-live="polite"></div><p class="hint">پیشنهادها فقط برای انتخاب هستند؛ هر چک پس از بررسی و تأیید جداگانه خرج می‌شود.</p></div>' +
    '<label class="fld"><span>جستجوی سریال، مبلغ، نام شخص یا بانک</span><input class="inp" id="bx-search" autocomplete="off" inputmode="search" placeholder="مثلاً ۱۲۳۴۵ یا ۵٬۰۰۰٬۰۰۰"></label>' +
    '<div class="row2"><label class="fld"><span>مرتب‌سازی</span><select class="inp" id="bx-sort"><option value="dueAsc">نزدیک‌ترین سررسید</option><option value="dueDesc">دورترین سررسید</option><option value="amountDesc">بیشترین مبلغ</option><option value="amountAsc">کمترین مبلغ</option><option value="person">نام شخص</option><option value="serial">سریال چک</option></select></label><label class="fld"><span>بانک</span><select class="inp" id="bx-bank"><option value="">همه بانک‌ها</option>' +
    [...new Set(available.map(c => c.bank || '').filter(Boolean))].sort(faCmp).map(x => '<option value="' + esc(x) + '">' + esc(x) + '</option>').join('') + '</select></label></div>' +
    '<div id="bx-count" class="hint"></div><div id="bx-list" class="list"></div>', { tall: true });
  const draw = () => {
    const q = sh.q('#bx-search').value.trim();
    const bank = sh.q('#bx-bank').value, sort = sh.q('#bx-sort').value;
    const targetRaw = sh.q('#bx-target').value.trim(), target = targetRaw ? Core.parseMoney(targetRaw) : NaN;
    const items = available.filter(c => {
      if (bank && c.bank !== bank) return false;
      const txt = [c.serial || '', c.amount, Core.shown(c.amount), personName(c.personId), c.bank || '', c.drawer || ''].join(' ');
      // Numeric substring for partial cheque numbers, fuzzy Persian / Finglish for names and banks.
      const numeric = Core.toEn(q).replace(/[٬,،\s]/g, '');
      return !q || (numeric && Core.toEn(txt).replace(/[٬,،\s]/g, '').includes(numeric)) || Core.matchScore(txt, q) > 0;
    }).sort((a, b) => {
      if (sort === 'amountDesc') return b.amount - a.amount;
      if (sort === 'amountAsc') return a.amount - b.amount;
      if (sort === 'dueDesc') return b.dueDate.localeCompare(a.dueDate);
      if (sort === 'person') return faCmp(personName(a.personId), personName(b.personId));
      if (sort === 'serial') return faCmp(a.serial || '', b.serial || '');
      return a.dueDate.localeCompare(b.dueDate);
    });
    const box = sh.q('#bx-suggest');
    if (targetRaw && (!Number.isSafeInteger(target) || target <= 0)) {
      box.innerHTML = '<p class="alert warn">مبلغ هدف معتبر نیست؛ یک مبلغ مثبت وارد کنید.</p>';
    } else if (Number.isSafeInteger(target) && target > 0) {
      const offers = Core.suggestCheques(items, target, { limit: 4 });
      box.innerHTML = offers.length ? '<div class="ch">چک‌های پیشنهادی نزدیک به مبلغ هدف</div>' +
        offers.map((x, i) => '<div class="card"><div class="ch"><b>' + (x.exact ? '✓ مبلغ دقیق' : 'پیشنهاد ' + fa(i + 1)) + '</b><em>' + fmt(x.total) + ' ' + UNIT() + '</em></div>' +
          '<p class="hint">' + fa(x.count) + ' چک · ' + (x.difference ? 'اختلاف با هدف: ' + fmt(x.difference) + ' ' + UNIT() : 'بدون اختلاف') + '</p>' +
          '<p class="hint">' + x.ids.map(id => { const c = Core.byId(S.cheques, id); return c ? esc((c.serial ? 'چک ' + fa(c.serial) : 'بدون سریال') + ' (' + personName(c.personId) + ')') : ''; }).join(' + ') + '</p>' +
          '<button type="button" class="btn ghost sm" data-suggest="' + x.ids[0] + '">انتخاب اولین چک این پیشنهاد</button></div>').join('') :
        '<p class="hint">چکی با مبلغ کمتر یا مساوی هدف در صندوق پیدا نشد.</p>';
    } else box.innerHTML = '';
    sh.q('#bx-count').textContent = fa(items.length) + ' چک · جمع ' + fmt(items.reduce((t, c) => t + c.amount, 0)) + ' ' + UNIT();
    sh.q('#bx-list').innerHTML = items.length ? items.slice(0, 120).map(c =>
      '<button type="button" class="item" data-id="' + c.id + '"><span><b>' + esc(personName(c.personId)) +
      (c.serial ? ' · سریال ' + esc(fa(c.serial)) : '') + '</b><small>' + (c.bank ? esc(c.bank) + ' · ' : '') + 'سررسید ' + fmtDate(c.dueDate) + '</small></span><em>' + fmt(c.amount) + '</em></button>'
    ).join('') + (items.length > 120 ? '<p class="hint">برای نمایش دقیق‌تر، جستجو یا فیلتر کنید.</p>' : '') : '<div class="empty">چکی با این مشخصات در صندوق پیدا نشد.</div>';
  };
  sh.q('#bx-target').addEventListener('input', draw);
  sh.q('#bx-search').addEventListener('input', draw);
  sh.q('#bx-bank').addEventListener('change', draw);
  sh.q('#bx-sort').addEventListener('change', draw);
  const pick = id => {
    const c = Core.byId(S.cheques, +id);
    if (!c || c.state !== 'box' || !Core.chequeNext(c).includes('spent')) return toast('این چک دیگر قابل خرج کردن نیست.', true);
    sh.close(); onPick(c);
  };
  sh.q('#bx-suggest').addEventListener('click', e => {
    const b = e.target.closest('[data-suggest]'); if (b) pick(b.dataset.suggest);
  });
  sh.q('#bx-list').addEventListener('click', e => {
    const b = e.target.closest('[data-id]'); if (!b) return;
    pick(b.dataset.id);
  });
  draw();
}
function spendChequeFromHome() { pickBoxCheque(c => chequeActForm(c, 'spent'), 'خرج چک از صندوق'); }
function personChequePayment(personId) {
  if (!Core.byId(S.people, personId)) return toast('شخص پیدا نشد.', true);
  const sh = sheet('پرداخت چک به ' + personName(personId),
    '<p class="hint">یکی از دو روش زیر را انتخاب کنید. ثبت هر چک فقط یک‌بار در حساب شخص اثر می‌گذارد.</p>' +
    '<button class="btn blue" id="pc-existing">خرج چک دریافتی موجود در صندوق</button>' +
    '<button class="btn ghost" id="pc-new">صدور چک جدید از دسته‌چک خودم</button>');
  sh.q('#pc-existing').onclick = () => { sh.close(); pickBoxCheque(c => chequeActForm(c, 'spent', personId), 'پرداخت چک به ' + personName(personId), { personId }); };
  sh.q('#pc-new').onclick = () => { sh.close(); chequeForm(null, { p: personId, dir: 'pay' }); };
}
function chequeActForm(c, act, recipientId) {
  const last = c.hist[c.hist.length - 1], d0 = today() > last.date ? (act === 'cleared' || act === 'paid' ? (c.dueDate > last.date && c.dueDate <= today() ? c.dueDate : today()) : today()) : last.date;
  let to = recipientId || null, invoiceId = null; const prevBank = c.state === 'bank' ? last.acct : null;
  const accts = act === 'bank' ? acctList().filter(a => a.kind === 'bank') : acctList();
  const sh = sheet(CHQ_ACT[act], '<form id="caf"><p class="msg">' + esc(personName(c.personId)) + ' — ' + fmt(c.amount) + ' ' + UNIT() + (c.serial ? ' — چک ' + fa(c.serial) : '') + '</p>' + dateField('date', d0, 'تاریخ') +
    (act === 'bank' || act === 'cleared' ? (accts.length ? '<label class="fld"><span>' + (act === 'bank' ? 'واگذار به کدام بانک' : 'واریز به') + '</span><select class="inp" name="acct">' + accts.map(a => '<option value="' + a.id + '"' + (a.id === prevBank ? ' selected' : '') + '>' + esc(Core.acctName(a)) + '</option>').join('') + '</select></label>' : '<div class="alert warn">اول حساب بانکی تعریف کنید.</div>') : '') +
    (act === 'spent' ? '<label class="fld"><span>به چه کسی داده شد</span><button type="button" class="inp pick" id="ca-to">' + esc(to ? personName(to) : 'انتخاب شخص…') + '</button></label><label class="fld"><span>تسویه فاکتور این شخص (اختیاری)</span><select class="inp" id="ca-invoice"><option value="">بدون ارتباط با فاکتور مشخص</option></select></label>' : '') +
    '<label class="fld"><span>شرح (اختیاری)</span><input class="inp" name="note"></label><p class="hint">' + CHQ_HINT[act] + '</p><button class="btn blue">ثبت</button></form>');
  const drawSpentInvoices = () => {
    const sel = sh.q('#ca-invoice'); if (!sel) return;
    const options = S.invoices.filter(i => i.personId === to && ['purchase', 'sale_return'].includes(i.type) && Core.invoiceInfo(S, i).remaining > 0);
    if (!options.some(i => i.id === invoiceId)) invoiceId = null;
    sel.innerHTML = '<option value="">بدون ارتباط با فاکتور مشخص</option>' + options.map(i => '<option value="' + i.id + '">فاکتور ' + esc(fa(i.no)) + ' · مانده ' + esc(fmt(Core.invoiceInfo(S, i).remaining)) + '</option>').join('');
  };
  drawSpentInvoices();
  if (sh.q('#ca-invoice')) sh.q('#ca-invoice').onchange = e => { invoiceId = +e.target.value || null; };
  if (sh.q('#ca-to')) sh.q('#ca-to').onclick = () => pickList('انتخاب شخص', personItems().filter(x => x.value !== c.personId), v => { to = +v; sh.q('#ca-to').textContent = personName(to); drawSpentInvoices(); });
  sh.q('#caf').onsubmit = async e => { e.preventDefault(); const f = e.target, date = readDate(f, 'date'); if (!date) return toast('تاریخ نامعتبر است.', true); if (await done(Core.chequeAct(S, c.id, act, { date, acct: f.acct ? +f.acct.value : null, to, invoiceId, note: f.note.value }), Core.CHQ_FA[act] + '.')) sh.close(); };
}

/* ═════════════ warehouses ═════════════ */
function pageWarehouses() {
  const multi = Core.multiWh(S), L = Core.whList(S), Q = Core.whStock(S), rp = Core.replay(S), cost = can('cost');
  let h = tipBox('wh');
  if (!S.warehouses || !S.warehouses.length) h += '<div class="card"><p class="msg">الان همه کالاها در «انبار اصلی» هستند. اگر کالا را در چند جا نگه می‌دارید (مغازه، انبار پشتی، شعبه دوم)، انبار دوم را تعریف کنید تا موجودی هر جا جدا دیده شود و بین انبارها حواله انتقال بزنید.</p><button class="btn blue" data-act="whNew">+ تعریف انبار جدید</button></div>';
  else {
    h += '<div class="toolbar"><button class="btn blue sm" data-act="whNew">+ انبار جدید</button>' + (multi ? '<button class="btn ghost sm" data-act="whTxNew">' + ico('transfer') + 'انتقال بین انبارها</button>' : '') + '</div>';
    h += '<div class="card flush">' + L.map(w => { const m = Q[w.id] || {}, ids = Object.keys(m).filter(k => m[k] > 1e-9), qty = ids.reduce((t, k) => t + m[k], 0), val = ids.reduce((t, k) => t + m[k] * ((rp.stock[k] || {}).avg || 0), 0); return '<button class="row" data-act="go" data-h="#/wh/' + w.id + '"><span><b>' + ico('package') + esc(w.name) + (w.main ? ' <i class="tag">اصلی</i>' : '') + (w.archived ? ' <small class="hint">(بایگانی)</small>' : '') + '</b><small>' + fa(ids.length) + ' کالا · ' + Core.fmtQty(qty) + ' عدد' + (w.keeper ? ' · انباردار: ' + esc(w.keeper) : '') + '</small></span><em>' + (cost ? fmt(Math.round(val)) : '') + '</em></button>'; }).join('') + '</div>';
    const T = (S.whTx || []).slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
    h += '<div class="ch gs-h">' + ico('transfer') + 'حواله‌های انتقال بین انبارها</div>' + (T.length ? '<div class="card flush">' + T.slice(0, UI.limWhTx || 50).map(x => '<button class="xr" data-act="whTxView" data-id="' + x.id + '"><span><b>حواله ' + fa(x.no) + ': ' + esc(whName(x.from)) + ' ← ' + esc(whName(x.to)) + '</b><small>' + fmtDate(x.date) + ' · ' + fa(x.items.length) + ' قلم' + (x.desc ? ' · ' + esc(x.desc) : '') + '</small></span><em>' + Core.fmtQty(x.items.reduce((t, l) => t + l.qty, 0)) + '</em></button>').join('') + '</div>' : '<p class="hint">هنوز انتقالی ثبت نشده است.</p>');
  }
  return { title: 'انبارها', html: h, back: '#/products', fab: multi ? ['whTxNew', '+'] : null };
}
function pageWh(id) {
  const w = Core.whList(S).find(x => x.id === +id); if (!w) return { title: 'انبار', html: empty(ico('package'), 'انبار پیدا نشد.'), back: '#/warehouses' };
  const m = Core.whStock(S)[w.id] || {}, rp = Core.replay(S), cost = can('cost'), q = (UI.whQ || '').trim();
  const list = S.products.filter(p => (m[p.id] || 0) > 1e-9 && (!q || matchQ(p.name + ' ' + (p.sku || ''), q))).map(p => ({ p, q: m[p.id], v: m[p.id] * ((rp.stock[p.id] || {}).avg || 0) })).sort((a, b) => faCmp(a.p.name, b.p.name));
  let h = '<div class="kpis two"><div class="kpi"><small>تعداد کالا</small><b>' + fa(list.length) + '</b></div>' + (cost ? '<div class="kpi"><small>ارزش به قیمت خرید</small><b>' + fmt(Math.round(list.reduce((t, x) => t + x.v, 0))) + '</b></div>' : '') + '</div>';
  h += '<div class="toolbar">' + (Core.multiWh(S) ? '<button class="btn ghost sm" data-act="whTxNew" data-f="' + w.id + '">' + ico('transfer') + 'انتقال از این انبار</button>' : '') + (w.id ? '<button class="btn ghost sm" data-act="whEdit" data-id="' + w.id + '">' + ico('edit') + 'ویرایش انبار</button>' : '') + '</div>';
  h += '<input class="inp" id="wh-q" placeholder="جستجوی کالا…" value="' + esc(UI.whQ || '') + '" autocomplete="off">';
  h += list.length ? '<div class="card flush">' + list.slice(0, 300).map(x => '<button class="row" data-act="prodOpen" data-id="' + x.p.id + '"><span><b>' + esc(x.p.name) + '</b><small>' + esc(Core.catOf(x.p)) + (cost ? ' · ' + fmt(Math.round(x.v)) : '') + '</small></span><em>' + Core.fmtQty(x.q) + ' ' + esc(x.p.unit || '') + '</em></button>').join('') + '</div>' : empty(ico('package'), 'این انبار کالایی ندارد.');
  return { title: w.name, html: h, back: '#/warehouses' };
}
function warehouseForm(w) {
  const sh = sheet(w ? 'ویرایش انبار' : 'انبار جدید', '<form id="whf"><label class="fld"><span>نام انبار</span><input class="inp" name="name" value="' + esc(w ? w.name : '') + '" placeholder="مثلاً: انبار پشتی، شعبه دوم"></label><label class="fld"><span>انباردار (اختیاری)</span><input class="inp" name="keeper" value="' + esc(w ? w.keeper || '' : '') + '"></label><label class="fld"><span>توضیحات</span><input class="inp" name="note" value="' + esc(w ? w.note || '' : '') + '"></label>' + (w && !w.main ? '<label class="chk"><input type="checkbox" name="arch"' + (w.archived ? ' checked' : '') + '> بایگانی (فقط وقتی موجودی ندارد)</label>' : '') + (!w && (!S.warehouses || !S.warehouses.length) ? '<p class="hint">با ساختن اولین انبار جدید، «انبار اصلی» هم ساخته می‌شود و همه کالاها و فاکتورهای قبلی در آن می‌مانند؛ هیچ عددی تغییر نمی‌کند.</p>' : '') + '<button class="btn blue">ذخیره</button>' + (w && !w.main ? '<button type="button" class="btn ghost red" data-del>حذف انبار</button>' : '') + '</form>');
  const warehouseDraft=Drafts.attachSheet(sh,'warehouse:'+(w ? 'edit:'+w.id : 'new'));
  sh.q('#whf').onsubmit = async e => { e.preventDefault(); const f = e.target, d = { name: f.name.value, keeper: f.keeper.value, note: f.note.value, archived: f.arch ? f.arch.checked : undefined }; if (await done(w ? Core.editWarehouse(S, w.id, d) : Core.addWarehouse(S, d), 'ذخیره شد.')) {warehouseDraft.clear(); sh.close();} };
  if (sh.q('[data-del]')) sh.q('[data-del]').onclick = async () => { if (await confirmBox('انبار «' + w.name + '» حذف شود؟', 'حذف', true) && await done(Core.deleteWarehouse(S, w.id), 'حذف شد.')) { sh.close(); goHash('#/warehouses'); } };
}
function whTxRow(box, l, getFrom) {
  const d = document.createElement('div'); d.className = 'vrow wtr'; d.dataset.pid = l && l.productId || '';
  const p = l && Core.byId(S.products, l.productId);
  d.innerHTML = '<div class="vr1"><button type="button" class="inp pick wtp">' + (p ? esc(p.name) : 'انتخاب کالا…') + '</button><button type="button" class="x vdel" aria-label="حذف ردیف">×</button></div><div class="row2"><label class="fld"><span>تعداد</span><input class="inp ltr" name="qty" inputmode="decimal" value="' + fa(l ? l.qty : 1) + '"></label><button type="button" class="btn ghost sm wsn"' + (p && Core.serialRequired(S, p) ? '' : ' hidden') + '>انتخاب IMEI / سریال</button></div><input class="inp ltr" name="sn" placeholder="سریال / IMEI (برای کالاهای سریال‌دار)" value="' + esc(l ? l.note || '' : '') + '"' + (p && Core.serialRequired(S, p) ? '' : ' hidden') + '>';
  box.appendChild(d); return d;
}
function whTxForm(x, o) {
  o = o || {}; const L = Core.whList(S).filter(w => !w.archived), from0 = x ? x.from : (o.from != null ? +o.from : Core.mainWh(S)), to0 = x ? x.to : (L.find(w => w.id !== from0) || {}).id;
  const sh = sheet(x ? 'ویرایش حواله انتقال ' + fa(x.no) : 'حواله انتقال بین انبارها', '<form id="wtf">' + dateField('date', x ? x.date : today(), 'تاریخ') + '<div class="row2">' + whSel(from0, 'from', 'از انبار') + whSel(to0, 'to', 'به انبار') + '</div><div class="ch">کالاها</div><div id="wtrows"></div><button type="button" class="btn ghost" id="wt-add">+ افزودن کالا</button><label class="fld"><span>شرح</span><input class="inp" name="desc" value="' + esc(x ? x.desc || '' : '') + '"></label><p class="hint">انتقال فقط جای کالا را عوض می‌کند؛ موجودی کل، میانگین قیمت و سود تغییری نمی‌کند.</p><button class="btn blue">' + ico('transfer') + (x ? 'ذخیره' : 'ثبت انتقال') + '</button>' + (x ? '<button type="button" class="btn ghost red" data-del>حذف حواله</button>' : '') + '</form>', { tall: true });
  const box = sh.q('#wtrows'), from = () => +sh.q('[name=from]').value;
  (x ? x.items : [null]).forEach(l => whTxRow(box, l));
  const whTransferDraft=Drafts.attachSheet(sh,'warehouse-transfer:'+(x ? 'edit:'+x.id : 'new'),{
    getExtra:()=>({rows:$$('.vrow',box).map(r=>({productId:r.dataset.pid||'',qty:$('[name=qty]',r).value,note:$('[name=sn]',r).value}))}),
    beforeRestore:ex=>{
      if(!Array.isArray(ex.rows))return;
      box.innerHTML='';
      ex.rows.slice(0,150).forEach(l=>{const row=whTxRow(box,{productId:+l.productId||0,qty:1,note:String(l.note||'')});
        $('[name=qty]',row).value=String(l.qty??'1');
      });
      if(!$$('.vrow',box).length)whTxRow(box,null);
    }
  });
  sh.q('#wt-add').onclick = () => { const r = whTxRow(box, null); $('.wtp', r).click(); };
  box.addEventListener('click', e => {
    const r = e.target.closest('.vrow'); if (!r) return;
    if (e.target.closest('.vdel')) { if ($$('.vrow', box).length > 1) r.remove(); return; }
    if (e.target.closest('.wtp')) { const m = Core.whStock(S)[from()] || {}; pickList('کالا از «' + whName(from()) + '»', S.products.filter(p => (m[p.id] || 0) > 1e-9).map(p => ({ value: p.id, label: p.name, sub: p.sku || '', cat: Core.catOf(p), right: Core.fmtQty(m[p.id]) })).sort((a, b) => faCmp(a.label, b.label)), v => { const p = Core.byId(S.products, +v); r.dataset.pid = p.id; $('.wtp', r).textContent = p.name; Drafts.touch(sh.q('#wtf')); const sr = Core.serialRequired(S, p); $('.wsn', r).hidden = !sr; $('[name=sn]', r).hidden = !sr; }, { cats: true }); }
    if (e.target.closest('.wsn')) { const pid = +r.dataset.pid; if (!pid) return toast('اول کالا را انتخاب کنید.', true); const used = new Set(); $$('.vrow', box).forEach(o2 => { if (o2 !== r) Core.extractSerials($('[name=sn]', o2).value).forEach(s2 => used.add(s2)); }); const cur = new Set(Core.extractSerials($('[name=sn]', r).value)); const list = Core.serialsInStock(S, pid, null, from()).filter(s2 => !used.has(s2.serial)); if (!list.length) return toast('سریالی از این کالا در انبار مبدأ نیست.', true);
      const s2 = sheet('انتخاب سریال‌ها', '<div class="list">' + list.map(s3 => '<label class="chk rs"><input type="checkbox" value="' + esc(s3.serial) + '"' + (cur.has(s3.serial) ? ' checked' : '') + '><span><b class="ltr">' + esc(s3.serial) + '</b><small>خرید ' + fmtDate(s3.date) + '</small></span></label>').join('') + '</div><button class="btn blue" data-ok>تأیید</button>');
      s2.q('[data-ok]').onclick = () => { const sel = s2.qa('input:checked').map(i => i.value); $('[name=sn]', r).value = sel.join(' '); if (sel.length) $('[name=qty]', r).value = fa(sel.length); Drafts.touch(sh.q('#wtf')); s2.close(); }; }
  });
  sh.q('#wtf').onsubmit = async e => {
    e.preventDefault(); const f = e.target, date = readDate(f, 'date'); if (!date) return toast('تاریخ نامعتبر است.', true);
    const items = $$('.vrow', box).map(r => ({ productId: +r.dataset.pid, qty: Core.parseQty($('[name=qty]', r).value), note: $('[name=sn]', r).value.trim() })).filter(l => l.productId || l.note);
    const d = { date, from: +f.from.value, to: +f.to.value, items, desc: f.desc.value };
    if (!x && !gate()) return;
    const r = x ? Core.editWhTx(S, x.id, d) : Core.addWhTx(S, d); if (!r.ok) return toast(r.error, true);
    if (!x) bumpUsage(); if (!(await save())) return; whTransferDraft.clear(); sh.close(); toast(x ? 'حواله اصلاح شد.' : 'انتقال ثبت شد (حواله ' + fa(r.whTx.no) + ').'); render();
  };
  if (sh.q('[data-del]')) sh.q('[data-del]').onclick = async () => { if (await confirmBox('حواله انتقال ' + fa(x.no) + ' حذف شود؟', 'حذف', true) && await done(Core.deleteWhTx(S, x.id), 'حذف شد.')) sh.close(); };
}
function whTxView(id) {
  const x = Core.byId(S.whTx || [], id); if (!x) return;
  const sh = sheet('حواله انتقال ' + fa(x.no), '<div class="kv"><span>تاریخ</span><b>' + fmtDate(x.date) + '</b></div><div class="kv"><span>از انبار</span><b>' + esc(whName(x.from)) + '</b></div><div class="kv"><span>به انبار</span><b>' + esc(whName(x.to)) + '</b></div>' + (x.desc ? '<p class="hint">' + esc(x.desc) + '</p>' : '') + '<div class="card flush">' + x.items.map(l => { const p = Core.byId(S.products, l.productId); return '<div class="xr"><span><b>' + esc(p ? p.name : '—') + '</b>' + (l.note ? '<small class="ltr">' + esc(l.note) + '</small>' : '') + '</span><em>' + Core.fmtQty(l.qty) + '</em></div>'; }).join('') + '</div><button class="btn blue" data-e>' + ico('edit') + 'ویرایش</button>');
  sh.q('[data-e]').onclick = () => { sh.close(); whTxForm(x); };
}
document.addEventListener('input', e => { if (e.target.id === 'wh-q') { UI.whQ = e.target.value; clearTimeout(e.target._t); e.target._t = setTimeout(() => render({ keepId: 'wh-q' }), 180); } });

const LEDGER_ACTIONS = {
  vchNew: () => { if (gate()) voucherForm(null); }, vchOpen: d => voucherView(+d.id),
  docOpen: d => { const x = docsAll().docs.find(y => y.key === d.k); if (x) docView(x); else toast('سند پیدا نشد.', true); },
  docGo: d => { UI.docF = d.f || 'all'; UI.docQ = ''; UI.limDoc = 60; goHash('#/vouchers'); },
  docOf: d => { const D = docsOfSaved({ [d.k]: +d.id }); if (D.length === 1) docView(D[0]); else if (D.length) sheet('سند حسابداری', docLines(D)); else toast('سندی برای این مورد ثبت نشده است.', true); },
  coaAdd: d => coaAddForm(d.l, d.k), coaRen: d => { const code = d.c, sh = sheet('تغییر نام حساب ' + fa(code), '<form id="crf"><label class="fld"><span>نام جدید</span><input class="inp" name="name" value="' + esc(Core.coaName(S, code)) + '"></label><button class="btn blue">ذخیره</button></form>'); sh.q('#crf').onsubmit = async e => { e.preventDefault(); if (await done(Core.renameCoa(S, code, e.target.name.value), 'نام حساب تغییر کرد.')) sh.close(); }; },
  coaDel: async d => { if (await confirmBox('حساب ' + fa(d.c) + ' («' + Core.coaName(S, d.c) + '») حذف شود؟', 'حذف', true)) await done(Core.deleteCoa(S, d.c), 'حذف شد.'); },
  tafNew: () => tafsilForm(null), tafEdit: d => tafsilForm(Core.byId(S.tafsil || [], +d.id)),
  fyClose: d => fyCloseFlow(d.y), fyEntries: d => fyEntriesView(d.y, d.k),
  fyReopen: async d => { if (!(await confirmBox('بستن سال ' + fa(d.y) + ' برگردانده شود؟ سند بستن حساب‌ها حذف و قفل اسناد آن سال برداشته می‌شود.', 'برگردان', true))) return; askPass(async () => { await done(Core.reopenYear(S, d.y), 'بستن سال برگردانده شد.'); }); },
  chqView: d => chequeView(+d.id), spendChequeHome: () => spendChequeFromHome(),
  whNew: () => warehouseForm(null), whEdit: d => warehouseForm(Core.byId(S.warehouses || [], +d.id)), whTxNew: d => { if (gate()) whTxForm(null, { from: d.f }); }, whTxView: d => whTxView(+d.id)
};
