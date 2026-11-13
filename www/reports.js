/* Reports centre: every report grouped under standard accounting headings, one page per report with a short guide. */
'use strict';

// [key, title, icon, one-line description]; keys starting with '#' are links to other pages
function repGroups() {
  const cost = can('cost') && can('reports'), bal = can('balances');
  return [
    ['صورت‌های مالی', 'scale', [
      cost && ['pl', 'صورت سود و زیان', 'chart', 'فروش خالص، بهای تمام‌شده، هزینه‌ها و سود خالص'],
      cost && ['bs', 'ترازنامه', 'scale', 'دارایی‌ها، بدهی‌ها و سرمایه در یک تاریخ'],
      cost && ['tb', 'تراز آزمایشی', 'scale', 'گردش و مانده همه حساب‌ها؛ کنترل درستی ثبت‌ها'],
      cost && ['gl', 'دفتر کل و معین', 'file', 'ریز گردش هر حساب با مانده لحظه‌ای'],
      cost && ['jr', 'دفتر روزنامه', 'listplus', 'همه اسناد حسابداری به ترتیب تاریخ'],
      routeAllowed('vouchers') && ['#/vouchers', 'اسناد حسابداری (سند دستی)', 'file', 'ثبت و فهرست سندهای دستی'],
      isAdmin() && ['#/fiscal', 'سال مالی، اختتامیه و افتتاحیه', 'lock', 'بستن سال و اسناد پایان سال']]],
    ['فروش و عملکرد', 'chart', [
      ['sum', 'خلاصه عملکرد', 'chart', 'فروش و سود دوره و مقایسه با دوره قبل'],
      ['daily', 'فروش روزانه', 'calendar', 'فروش و سود هر روز'],
      ['monthly', 'فروش ماهانه', 'calendar', 'روند فروش ماه به ماه'],
      ['prod', 'فروش و سود کالاها', 'package', 'پرفروش، پرسود، کم‌سود و کم‌فروش'],
      ['discounts', 'تخفیفات فروش', 'receipt', 'فاکتورهای دارای تخفیف']]],
    ['اشخاص (بدهکاران و بستانکاران)', 'users', [
      bal && ['people', 'مانده حساب اشخاص', 'users', 'حساب‌های دریافتنی و پرداختنی، مرتب‌شده'],
      bal && ['aging', 'سن مطالبات', 'clock', 'طلب‌ها به تفکیک ۳۰، ۶۰، ۹۰ روز'],
      ['unpaid', 'فاکتورهای تسویه‌نشده', 'receipt', 'فروش و خرید نسیه باز'],
      ['suppliers', 'خرید از تأمین‌کنندگان', 'cart', 'جمع خرید از هر فروشنده']]],
    ['خزانه‌داری (صندوق، بانک، چک)', 'wallet', [
      ['cash', 'گردش وجوه', 'wallet', 'دریافت‌ها، پرداخت‌ها و هزینه‌ها به تفکیک حساب'],
      can('reports') && ['accounts', 'مانده صندوق و بانک‌ها', 'wallet', 'موجودی فعلی هر حساب'],
      feat('cheques') && ['cheques', 'چک‌های در جریان', 'cheque', 'دریافتی و پرداختی به ترتیب سررسید'],
      routeAllowed('recon') && ['#reconGo', 'مغایرت‌گیری بانکی', 'scale', 'تطبیق با صورت‌حساب بانک']]],
    ['انبار و کالا', 'package', [
      cost && ['stockval', 'ارزش موجودی کالا', 'package', 'به قیمت خرید و فروش، به تفکیک دسته'],
      ['imei', 'گوشی‌ها و IMEI', 'search', 'دستگاه‌های موجود و فروخته‌شده'],
      Core.multiWh(S) && can('warehouse') && ['#/warehouses', 'موجودی به تفکیک انبار', 'package', 'هر انبار جدا و حواله‌های انتقال'],
      ['#/stock', 'تحلیل انبار و پیشنهاد سفارش', 'up', 'کمبود، راکد و مقدار خرید پیشنهادی']]]
  ].map(g => [g[0], g[1], g[2].filter(Boolean)]).filter(g => g[2].length);
}
const repFind = k => { for (const g of repGroups()) { const it = g[2].find(x => x[0] === k); if (it) return it; } return null; };
const REP_PERIOD = { pl: 1, bs: 1, tb: 1, gl: 1, jr: 1, sum: 1, daily: 1, prod: 1, discounts: 1, suppliers: 1, cash: 1, imei: 1 };
const REP_RELATED = { pl: ['sum', 'bs', 'prod'], bs: ['pl', 'tb', 'accounts'], tb: ['gl', 'bs', 'jr'], gl: ['tb', 'jr'], jr: ['gl', 'tb'], sum: ['pl', 'daily', 'prod'], daily: ['monthly', 'sum'], monthly: ['daily', 'sum'], prod: ['stockval', 'sum'], discounts: ['sum', 'pl'], people: ['aging', 'unpaid'], aging: ['people', 'unpaid'], unpaid: ['aging', 'people'], suppliers: ['unpaid', 'people'], cash: ['accounts', 'cheques'], accounts: ['cash', 'bs'], cheques: ['cash', 'aging'], stockval: ['prod', 'imei'], imei: ['stockval'] };
function repRecent(k) { let a = []; try { a = JSON.parse(localStorage.getItem('fq_reprec') || '[]'); } catch (e) { /* ignore */ } if (k) { a = [k].concat(a.filter(x => x !== k)).slice(0, 4); try { localStorage.setItem('fq_reprec', JSON.stringify(a)); } catch (e) { /* ignore */ } } return a; }
const repLink = it => (it[0][0] === '#' ? (it[0][1] === '/' ? 'data-act="go" data-h="' + it[0] + '"' : 'data-act="' + it[0].slice(1) + '"') : 'data-act="go" data-h="#/reports/' + it[0] + '"');

function repHub() {
  let h = tipBox('hub');
  const rec = repRecent().map(repFind).filter(Boolean);
  if (rec.length) h += '<div class="chips wrap rrec"><small class="hint">اخیر:</small>' + rec.map(it => '<button class="chip" ' + repLink(it) + '>' + ico(it[2]) + it[1] + '</button>').join('') + '</div>';
  repGroups().forEach(g => {
    h += '<div class="ch gs-h">' + ico(g[1]) + g[0] + '</div><div class="card flush rhub">' + g[2].map(it => '<button class="row" ' + repLink(it) + '><span><b>' + ico(it[2]) + ' ' + it[1] + '</b><small>' + it[3] + '</small></span><em>‹</em></button>').join('') + '</div>';
  });
  return { title: 'گزارش‌ها', html: h, back: '#/more' };
}

function repPage(k) {
  const it = repFind(k); if (!it || it[0][0] === '#') return repHub();
  repRecent(k);
  if (['pl', 'bs', 'tb', 'jr'].includes(k)) UI.accView = k;
  if (['daily', 'monthly', 'aging', 'unpaid', 'suppliers', 'stockval', 'imei', 'discounts', 'accounts', 'cheques'].includes(k)) UI.moreRep = k;
  const map = { sum: 'sum', people: 'people', prod: 'prod', cash: 'cash', pl: 'acc', bs: 'acc', tb: 'acc', jr: 'acc', gl: 'gl' };
  UI.repTab = map[k] || 'more';
  const { from, to } = repRange(), r = k === 'sum' ? Core.report(S, from, to) : null;
  let h = tipBox(k);
  if (REP_PERIOD[k] || (k === 'people' && UI.repPSort === 'sales')) {
    if (k !== 'people') h += chips('rep', UI.rep, [['today', 'امروز'], ['yesterday', 'دیروز'], ['week', 'این هفته'], ['mtd', 'این ماه'], ['prevmonth', 'ماه قبل'], ['fytd', 'امسال'], ['all', 'همه'], ['custom', 'دلخواه']]);
    if (UI.rep === 'custom' && k !== 'people') h += '<div class="card row2f">' + dateField('rf', UI.repFrom || today(), 'از') + dateField('rt', UI.repTo || today(), 'تا') + '<button class="btn blue sm" data-act="repApply">اعمال</button></div>';
    h += '<div class="hint center rper">' + ico('calendar') + (k === 'bs' ? 'وضعیت در پایان: ' + (to ? fmtDate(to) : 'امروز') : (from ? fmtDate(from) : 'از ابتدا') + ' تا ' + (to ? fmtDate(to) : 'امروز')) + '</div>';
  }
  h += ({ sum: repSummary, people: repPeople, prod: repProducts, cash: repCash, acc: repAccounting, more: repMore, gl: repGL }[UI.repTab])(from, to, r);
  const rel = (REP_RELATED[k] || []).map(repFind).filter(Boolean);
  if (rel.length) h += '<div class="chips wrap rrel"><small class="hint">گزارش‌های مرتبط:</small>' + rel.map(x => '<button class="chip" ' + repLink(x) + '>' + ico(x[2]) + x[1] + '</button>').join('') + '</div>';
  return { title: it[1], html: h, back: '#/reports' };
}

/* ── دفتر کل و معین ── */
function repGL(from, to) {
  if (!(can('reports') && can('cost'))) return empty(ico('lock'), 'گزارش‌های حسابداری برای این کاربر مجاز نیست.');
  const G = Core.glAccounts(S, to), keys = new Set(); G.forEach(g => { keys.add(g.key); g.sub.forEach(s => keys.add(s.key)); });
  if (!G.length) return empty(ico('file'), 'هنوز سندی ثبت نشده است.');
  const key = keys.has(UI.glAcc) ? UI.glAcc : (keys.has('1101') ? '1101' : G[0].key), L = Core.generalLedger(S, key, from, to);
  const sideW = v => (v > 0 ? ' (بدهکار)' : v < 0 ? ' (بستانکار)' : ''), side = v => fmt(Math.abs(v)) + '<small>' + (v > 0 ? ' بد' : v < 0 ? ' بس' : '') + '</small>';
  let h = '<div class="rsort"><label>' + ico('file') + 'حساب</label><select class="inp" data-glacc>' + G.map(g => '<optgroup label="' + esc(g.name) + '"><option value="' + g.key + '"' + (g.key === key ? ' selected' : '') + '>' + esc(g.name) + (g.sub.length ? ' — کل' : '') + '</option>' + g.sub.map(s => '<option value="' + esc(s.key) + '"' + (s.key === key ? ' selected' : '') + '>   ' + esc(s.name) + '</option>').join('') + '</optgroup>').join('') + '</select></div>';
  h += '<div class="kpis"><div class="kpi"><small>مانده اول بازه' + sideW(L.carry) + '</small><b>' + fmt(Math.abs(L.carry)) + '</b></div><div class="kpi"><small>گردش بدهکار</small><b>' + fmt(L.dr) + '</b></div><div class="kpi"><small>گردش بستانکار</small><b>' + fmt(L.cr) + '</b></div><div class="kpi"><small>مانده پایان' + sideW(L.bal) + '</small><b class="' + (L.bal < 0 ? 'credit' : '') + '">' + fmt(Math.abs(L.bal)) + '</b></div></div>';
  const lim = UI.limRep || 60, rows = L.rows.slice().reverse(), many = key.indexOf(':') < 0 && key[0] !== 'P';
  h += rows.length ? '<div class="card flush aled">' + rows.slice(0, lim).map(r => '<div class="xr"><span><b>' + esc(fa(r.desc)) + '</b><small>' + (r.date === '0000-00-00' ? 'اول دوره' : fmtDate(r.date)) + (many || key === 'P' ? ' · ' + esc(Core.accName(S, r.acc)) : '') + '</small></span><em class="' + (r.dr ? 'debit' : 'credit') + '">' + (r.dr ? fmt(r.dr) + ' بد' : fmt(r.cr) + ' بس') + '</em><b>' + side(r.bal) + '</b></div>').join('') + '</div>' + (rows.length > lim ? '<button class="btn ghost" data-act="repMore">نمایش بیشتر</button>' : '') : empty(ico('file'), 'در این بازه گردشی ندارد.');
  h += '<p class="hint">' + help('gl') + ' ردیف‌ها از جدید به قدیم است. «بد» = بدهکار، «بس» = بستانکار؛ ستون آخر مانده حساب بعد از همان سند است.</p>';
  h += '<div class="toolbar rexp"><button class="btn ghost sm" data-act="glCsv" data-k="' + esc(key) + '">' + ico('file') + 'خروجی اکسل دفتر</button></div>';
  return h;
}
document.addEventListener('change', e => { const t = e.target; if (t instanceof HTMLSelectElement && t.hasAttribute('data-glacc')) { UI.glAcc = t.value; UI.limRep = 60; render(); } });
const REPORT_ACTIONS = {
  tipToggle: d => tipToggle(d.k),
  glCsv: d => { const { from, to } = repRange(), L = Core.generalLedger(S, d.k, from, to); exportFile('daftar-' + stamp() + '.csv', csvFile([['تاریخ', 'شرح', 'حساب', 'بدهکار', 'بستانکار', 'مانده']].concat([['', 'مانده اول بازه', '', '', '', L.carry]]).concat(L.rows.map(r => [r.date === '0000-00-00' ? 'اول دوره' : Core.isoToJalali(r.date), r.desc, Core.accName(S, r.acc), r.dr, r.cr, r.bal]))), 'text/csv'); }
};
