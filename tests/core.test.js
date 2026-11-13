const assert = require('assert'); const C = require('../www/core.js');
let n = 0; const t = (name, fn) => { try { fn(); n++; } catch (e) { console.error('FAIL', name, '\n ', e.message); process.exitCode = 1; } };

t('jalali matches independent reference for 70 years', () => {
  const ref = require('./jalali_ref.json'); let bad = 0;
  for (const [iso, jy, jm, jd] of ref) { const p = C.isoToParts(iso); if (p.jy !== jy || p.jm !== jm || p.jd !== jd) { if (bad++ < 3) console.error('  mismatch', iso, p, [jy, jm, jd]); } const back = C.partsToIso(jy, jm, jd); if (back !== iso) { if (bad++ < 3) console.error('  roundtrip', iso, back); } }
  assert.strictEqual(bad, 0);
});
t('known dates', () => { assert.strictEqual(C.isoToJalali('2026-10-05'), '1405/07/13'); assert.strictEqual(C.isoToJalali('2025-03-21'), '1404/01/01'); assert.strictEqual(C.isoToJalali('2025-03-20'), '1403/12/30'); assert.ok(C.isLeapJ(1403)); assert.ok(!C.isLeapJ(1404)); assert.strictEqual(C.weekdayIdx('2026-10-03'), 0 /* Saturday */); });
t('jalaliToIso', () => { assert.strictEqual(C.jalaliToIso('۱۴۰۵/۰۷/۱۳'), '2026-10-05'); assert.strictEqual(C.jalaliToIso('1404-1-1'), '2025-03-21'); assert.strictEqual(C.jalaliToIso('1404/12/30'), null); assert.strictEqual(C.jalaliToIso('1403/12/30'), '2025-03-20'); assert.strictEqual(C.jalaliToIso('1405/07/31'), null); assert.strictEqual(C.jalaliToIso('abc'), null); });
t('periods', () => { const m = C.periodRange('month', '2026-10-05'); assert.deepStrictEqual(m, { from: '2026-10-23'.replace('10-23', '09-23'), to: '2026-10-22' }); const w = C.periodRange('week', '2026-10-05'); assert.strictEqual(w.from, '2026-10-03'); assert.strictEqual(w.to, '2026-10-09'); });
t('numbers', () => { assert.strictEqual(C.parseMoney('۱,۲۳۴,۵۶۷'), 1234567); assert.ok(isNaN(C.parseMoney('abc'))); assert.ok(isNaN(C.parseMoney('-5'))); assert.ok(isNaN(C.parseMoney('1e30'))); assert.strictEqual(C.parseQty('۲٫۵'), 2.5); assert.ok(isNaN(C.parseQty('0'))); assert.strictEqual(C.fmt(1234567), '۱,۲۳۴,۵۶۷'); assert.strictEqual(C.fmtQty(1234.5), '۱,۲۳۴.۵'); });

function world() { const s = C.emptyState(); const a = C.addPerson(s, { name: 'علی' }).person, b = C.addPerson(s, { name: 'رضا' }).person; const p = C.addProduct(s, { name: 'گوشی' }).product; return { s, a, b, p }; }
const D = '2026-10-01';

t('weighted average + sale cogs + profit', () => {
  const { s, a, b, p } = world();
  assert.ok(C.addInvoice(s, { type: 'purchase', personId: b.id, date: D, items: [{ productId: p.id, qty: 10, price: 100 }] }).ok);   // 10 @100
  assert.ok(C.addInvoice(s, { type: 'purchase', personId: b.id, date: '2026-10-02', items: [{ productId: p.id, qty: 10, price: 200 }] }).ok); // avg 150
  const r = C.addInvoice(s, { type: 'sale', personId: a.id, date: '2026-10-03', items: [{ productId: p.id, qty: 4, price: 300 }], discount: 100, paid: 500, method: 'cash' });
  assert.ok(r.ok, r.error);
  const rp = C.replay(s); assert.strictEqual(rp.stock[p.id].stock, 16); assert.strictEqual(Math.round(rp.stock[p.id].avg), 150);
  assert.strictEqual(rp.cogs[r.invoice.id], 600);
  const rep = C.report(s); assert.strictEqual(rep.sales, 1100); assert.strictEqual(rep.cogs, 600); assert.strictEqual(rep.gross, 500); assert.strictEqual(rep.net, 500);
  assert.strictEqual(C.balanceOf(s, a.id), 600);          // 1100 - 500 paid
  assert.strictEqual(C.balanceOf(s, b.id), -3000);        // we owe supplier 1000+2000
  assert.strictEqual(C.cashBalance(s), 500);
  assert.strictEqual(C.inventoryValue(s), 2400);
  assert.deepStrictEqual(C.audit(s), []);
});
t('oversell blocked incl. same product on two lines, state untouched', () => {
  const { s, a, b, p } = world(); C.addInvoice(s, { type: 'purchase', personId: b.id, date: D, items: [{ productId: p.id, qty: 10, price: 100 }] });
  const before = JSON.stringify(s);
  const r = C.addInvoice(s, { type: 'sale', personId: a.id, date: D, items: [{ productId: p.id, qty: 8, price: 5 }, { productId: p.id, qty: 8, price: 5 }] });
  assert.ok(!r.ok); assert.ok(/کافی نیست/.test(r.error)); assert.strictEqual(JSON.stringify(s), before);
});
t('back-dated sale before purchase is rejected', () => {
  const { s, a, b, p } = world(); C.addInvoice(s, { type: 'purchase', personId: b.id, date: '2026-10-05', items: [{ productId: p.id, qty: 10, price: 100 }] });
  assert.ok(!C.addInvoice(s, { type: 'sale', personId: a.id, date: '2026-10-01', items: [{ productId: p.id, qty: 1, price: 5 }] }).ok);
});
t('delete purchase that would make stock negative is blocked; delete sale ok', () => {
  const { s, a, b, p } = world(); const pu = C.addInvoice(s, { type: 'purchase', personId: b.id, date: D, items: [{ productId: p.id, qty: 5, price: 100 }] }).invoice;
  const sa = C.addInvoice(s, { type: 'sale', personId: a.id, date: D, items: [{ productId: p.id, qty: 5, price: 150 }], paid: 100 }).invoice;
  const x = C.deleteInvoice(s, pu.id); assert.ok(!x.ok); assert.ok(C.byId(s.invoices, pu.id));
  assert.ok(C.deleteInvoice(s, sa.id).ok); assert.strictEqual(C.balanceOf(s, a.id), 0); assert.strictEqual(s.tx.filter(t => t.ref === sa.id).length, 0);
  assert.ok(C.deleteInvoice(s, pu.id).ok); assert.deepStrictEqual(C.audit(s), []);
});
t('returns: sale return restores stock & reverses cogs; purchase return', () => {
  const { s, a, b, p } = world(); C.addInvoice(s, { type: 'purchase', personId: b.id, date: D, items: [{ productId: p.id, qty: 10, price: 100 }] });
  C.addInvoice(s, { type: 'sale', personId: a.id, date: '2026-10-02', items: [{ productId: p.id, qty: 5, price: 200 }] });
  C.addInvoice(s, { type: 'sale_return', personId: a.id, date: '2026-10-03', items: [{ productId: p.id, qty: 2, price: 200 }] });
  assert.strictEqual(C.replay(s).stock[p.id].stock, 7); assert.strictEqual(C.balanceOf(s, a.id), 600);
  let rep = C.report(s); assert.strictEqual(rep.revenue, 600); assert.strictEqual(rep.cogs, 300); assert.strictEqual(rep.gross, 300);
  const pr = C.addInvoice(s, { type: 'purchase_return', personId: b.id, date: '2026-10-04', items: [{ productId: p.id, qty: 3, price: 100 }], paid: 100, method: 'bank' });
  assert.ok(pr.ok, pr.error); assert.strictEqual(C.replay(s).stock[p.id].stock, 4);
  assert.strictEqual(C.balanceOf(s, b.id), -800);   // -1000 credit, +300 return debit, -100 refund received
  rep = C.report(s); assert.strictEqual(rep.cogs, 300 + (300 - 300)); // purchase return at cost => no P&L effect
  assert.deepStrictEqual(C.audit(s), []);
});
t('purchase return above/below cost hits P&L', () => {
  const { s, b, p } = world(); C.addInvoice(s, { type: 'purchase', personId: b.id, date: D, items: [{ productId: p.id, qty: 10, price: 100 }] });
  C.addInvoice(s, { type: 'purchase_return', personId: b.id, date: D, items: [{ productId: p.id, qty: 2, price: 80 }] }); // refund 160 vs cost 200 => 40 loss
  assert.strictEqual(C.report(s).cogs, 40); assert.strictEqual(C.report(s).net, -40);
});
t('discount allocation sums exactly, no negative lines', () => {
  const inv = { items: [{ productId: 1, qty: 3, price: 333 }, { productId: 2, qty: 1, price: 1 }, { productId: 3, qty: 7, price: 17 }], discount: 77 };
  const t2 = C.invoiceTotals(inv); assert.strictEqual(t2.lines.reduce((a, l) => a + l.net, 0), t2.total); assert.strictEqual(t2.total, 999 + 1 + 119 - 77); t2.lines.forEach(l => assert.ok(l.net >= 0));
});
t('validation', () => {
  const { s, a, b, p } = world(); const base = { type: 'purchase', personId: b.id, date: D, items: [{ productId: p.id, qty: 1, price: 10 }] };
  assert.ok(!C.addInvoice(s, Object.assign({}, base, { date: '2026-13-01' })).ok);
  assert.ok(!C.addInvoice(s, Object.assign({}, base, { items: [] })).ok);
  assert.ok(!C.addInvoice(s, Object.assign({}, base, { items: [{ productId: 999, qty: 1, price: 1 }] })).ok);
  assert.ok(!C.addInvoice(s, Object.assign({}, base, { items: [{ productId: p.id, qty: 0, price: 1 }] })).ok);
  assert.ok(!C.addInvoice(s, Object.assign({}, base, { paid: 11 })).ok);
  assert.ok(!C.addInvoice(s, Object.assign({}, base, { discount: 11 })).ok);
  assert.ok(!C.addInvoice(s, Object.assign({}, base, { personId: 999 })).ok);
  assert.ok(C.addInvoice(s, Object.assign({}, base, { no: '7' })).ok); assert.ok(!C.addInvoice(s, Object.assign({}, base, { no: '7' })).ok);
  assert.ok(!C.addTx(s, { personId: a.id, kind: 'debit', amount: 0, date: D }).ok); assert.ok(!C.addTx(s, { personId: a.id, kind: 'debit', amount: 1.5, date: D }).ok); assert.ok(!C.addTx(s, { personId: a.id, kind: 'x', amount: 5, date: D }).ok);
  assert.ok(!C.addPerson(s, { name: '  ' }).ok); assert.ok(!C.addPerson(s, { name: 'علی' }).ok);
  assert.strictEqual(s.tx.filter(t => t.personId === a.id).length, 0); assert.deepStrictEqual(C.audit(s), []);
});
t('ledger running balance, opening, receipts/payments, period carry', () => {
  const s = C.emptyState(); const a = C.addPerson(s, { name: 'الف', opening: 1000, date: '2026-09-01' }).person;
  C.addTx(s, { personId: a.id, type: 'manual', kind: 'debit', amount: 500, date: '2026-09-10', desc: 'x' });
  C.addTx(s, { personId: a.id, type: 'receipt', amount: 300, date: '2026-09-20', method: 'bank' });
  C.addTx(s, { personId: a.id, type: 'payment', amount: 50, date: '2026-10-01', method: 'cash' });
  const L = C.ledger(s, a.id); assert.deepStrictEqual(L.rows.map(r => r.balance), [1000, 1500, 1200, 1250]); assert.strictEqual(L.closing, 1250);
  const L2 = C.ledger(s, a.id, '2026-09-15'); assert.strictEqual(L2.carry, 1500); assert.deepStrictEqual(L2.rows.map(r => r.balance), [1200, 1250]);
  const cs = C.cashSummary(s); assert.strictEqual(cs.byMethod.bank, 300); assert.strictEqual(cs.byMethod.cash, -50); assert.strictEqual(cs.net, 250);
  const rp = C.receivablePayable(s); assert.strictEqual(rp.receivable, 1250);
});
t('transfer pair and deletion', () => {
  const { s, a, b } = world(); assert.ok(C.addTransfer(s, { fromId: a.id, toId: b.id, amount: 700, date: D, desc: 'بابت کرایه' }).ok);
  assert.strictEqual(C.balanceOf(s, a.id), -700); assert.strictEqual(C.balanceOf(s, b.id), 700);
  assert.ok(!C.addTransfer(s, { fromId: a.id, toId: a.id, amount: 1, date: D }).ok);
  const id = s.tx[0].id; assert.ok(C.deleteTx(s, id).ok); assert.strictEqual(s.tx.length, 0);
});
t('invoice-linked ledger rows protected; receipt deletable', () => {
  const { s, a, b, p } = world(); C.addInvoice(s, { type: 'purchase', personId: b.id, date: D, items: [{ productId: p.id, qty: 1, price: 50 }], paid: 20 });
  const main = s.tx.find(t => t.type === 'invoice'); assert.ok(!C.deleteTx(s, main.id).ok); assert.ok(!C.editTx(s, main.id, { amount: 1, date: D }).ok);
  const pay = s.tx.find(t => t.type === 'payment'); assert.ok(C.editTx(s, pay.id, { amount: 25, date: D, desc: 'x', method: 'cheque' }).ok); assert.strictEqual(C.balanceOf(s, b.id), -25);
  assert.strictEqual(C.invoiceInfo(s, s.invoices[0]).paid, 25);
});
t('person delete/archive rules', () => {
  const { s, a } = world(); C.addTx(s, { personId: a.id, kind: 'debit', amount: 5, date: D });
  assert.ok(!C.deletePerson(s, a.id).ok); assert.ok(C.setArchived(s, a.id, true).ok);
  const c = C.addPerson(s, { name: 'تازه' }).person; assert.ok(C.deletePerson(s, c.id).ok);
});
t('inventory adjustments', () => {
  const { s, b, p } = world(); C.addInvoice(s, { type: 'purchase', personId: b.id, date: D, items: [{ productId: p.id, qty: 10, price: 100 }] });
  assert.ok(!C.addAdjust(s, { productId: p.id, qty: -11, date: D }).ok);
  const loss = C.addAdjust(s, { productId: p.id, qty: -2, date: '2026-10-02', note: 'شکسته' }).adjust; assert.strictEqual(C.report(s).adjLoss, 200); assert.strictEqual(C.replay(s).stock[p.id].stock, 8);
  assert.ok(C.addAdjust(s, { productId: p.id, qty: 5, cost: 160, date: '2026-10-03' }).ok); const st = C.replay(s).stock[p.id]; assert.strictEqual(st.stock, 13); assert.strictEqual(Math.round(st.avg), Math.round((8 * 100 + 5 * 160) / 13));
  assert.ok(!C.deleteProduct(s, p.id).ok);
});
t('cheques & installments', () => {
  const { s, a } = world(); const c = C.addCheque(s, { kind: 'cheque', direction: 'receive', personId: a.id, title: 'چک ۱۲۳', amount: 900, dueDate: '2026-10-10' }).cheque;
  assert.strictEqual(C.chequeStatus(c, '2026-10-05'), 'soon'); assert.strictEqual(C.chequeStatus(c, '2026-10-11'), 'overdue'); assert.strictEqual(C.chequeStatus(c, '2026-09-01'), 'later');
  assert.ok(C.completeCheque(s, c.id, true, '2026-10-10').ok); assert.strictEqual(C.balanceOf(s, a.id), -900); assert.strictEqual(C.cashSummary(s).byMethod.bank, 900); // a cashed cheque lands in the bank
  assert.ok(!C.completeCheque(s, c.id, true).ok); assert.ok(C.reopenCheque(s, c.id).ok); assert.strictEqual(C.balanceOf(s, a.id), 0);
});
t('expenses & net profit & cash', () => {
  const { s, a, b, p } = world(); s.settings.openingCash = 1000; C.addInvoice(s, { type: 'purchase', personId: b.id, date: D, items: [{ productId: p.id, qty: 10, price: 100 }], paid: 1000 });
  C.addInvoice(s, { type: 'sale', personId: a.id, date: D, items: [{ productId: p.id, qty: 10, price: 150 }], paid: 1500 });
  C.addExpense(s, { title: 'اجاره', amount: 200, date: D }); const r = C.report(s, D, D);
  assert.strictEqual(r.net, 1500 - 1000 - 200); assert.strictEqual(C.cashBalance(s), 1000 - 1000 + 1500 - 200);
  assert.strictEqual(C.report(s, '2026-11-01', '2026-11-30').net, 0);
  assert.strictEqual(C.topPeople(s, 'sale', null, null)[0].total, 1500); assert.strictEqual(C.topProducts(s, null, null)[0].qty, 10);
});
t('backup roundtrip & corrupt files', () => {
  const { s, a, b, p } = world(); C.addInvoice(s, { type: 'purchase', personId: b.id, date: D, items: [{ productId: p.id, qty: 3, price: 7 }], paid: 5 });
  const r = C.parseBackup(C.exportJSON(s)); assert.ok(r.ok, r.error); assert.deepStrictEqual(r.state, JSON.parse(JSON.stringify(s)));
  assert.ok(!C.parseBackup('{bad').ok); assert.ok(!C.parseBackup('{"app":"other"}').ok);
  const o = JSON.parse(C.exportJSON(s)); o.data.tx[0].personId = 9999; assert.ok(!C.parseBackup(JSON.stringify(o)).ok);
  const o2 = JSON.parse(C.exportJSON(s)); o2.data.seq = 1; assert.ok(C.parseBackup(JSON.stringify(o2)).ok); // seq repaired
});
t('csv & statement text', () => { assert.strictEqual(C.csv([['a,b', 'c"d'], [1, null]]), '"a,b","c""d"\r\n1,'); const { s, a } = world(); C.addTx(s, { personId: a.id, kind: 'debit', amount: 5, date: D, desc: 'x' }); assert.ok(/مانده نهایی: ۵/.test(C.statementText(s, a.id))); });

// randomized invariants: any sequence of ops keeps audit clean and ledger == sum of invoices/payments
t('fuzz invariants', () => {
  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const s = C.emptyState(); const ppl = [1, 2, 3].map(i => C.addPerson(s, { name: 'p' + i }).person); const prods = [1, 2].map(i => C.addProduct(s, { name: 'k' + i }).product);
  const types = ['purchase', 'sale', 'sale_return', 'purchase_return']; let okc = 0;
  for (let i = 0; i < 400; i++) {
    const r = rnd();
    if (r < 0.6) { const items = [...Array(1 + Math.floor(rnd() * 3))].map(() => ({ productId: prods[Math.floor(rnd() * 2)].id, qty: Math.ceil(rnd() * 5), price: Math.floor(rnd() * 500) })); const res = C.addInvoice(s, { type: types[Math.floor(rnd() * 4)], personId: ppl[Math.floor(rnd() * 3)].id, date: C.addDays('2026-09-01', Math.floor(rnd() * 40)), items, discount: Math.floor(rnd() * 50), paid: Math.floor(rnd() * 20) }); if (res.ok) okc++; }
    else if (r < 0.75 && s.invoices.length) C.deleteInvoice(s, s.invoices[Math.floor(rnd() * s.invoices.length)].id);
    else if (r < 0.9) C.addTx(s, { personId: ppl[Math.floor(rnd() * 3)].id, type: ['manual', 'receipt', 'payment'][Math.floor(rnd() * 3)], kind: 'debit', amount: 1 + Math.floor(rnd() * 300), date: '2026-09-15' });
    else C.addAdjust(s, { productId: prods[Math.floor(rnd() * 2)].id, qty: Math.floor(rnd() * 11) - 5 || 1, date: C.addDays('2026-09-01', Math.floor(rnd() * 40)) });
    const a = C.audit(s); if (a.length) throw new Error('audit failed at step ' + i + ': ' + a[0]);
  }
  assert.ok(okc > 50);
  const rp = C.replay(s); for (const id in rp.stock) assert.ok(rp.stock[id].stock >= 0);
  // sum of balances == total debits - total credits
  const tot = s.tx.reduce((a, t) => a + (t.kind === 'debit' ? t.amount : -t.amount), 0); assert.strictEqual(Object.values(C.balances(s)).reduce((a, b) => a + b, 0), tot);
});
/* ── v1.1 additions: serial notes, opening stock, plain wording, rial ── */
t('invoice line note (serial) is stored, reported, and survives backup/restore', () => {
  const { s, a, b, p } = world();
  const r = C.addInvoice(s, { type: 'purchase', personId: b.id, date: D, note: 'از نمایشگاه', items: [{ productId: p.id, qty: 2, price: 100, note: ' SN-12345 ' }, { productId: p.id, qty: 1, price: 100 }] });
  assert.ok(r.ok, r.error);
  assert.strictEqual(r.invoice.items[0].note, 'SN-12345'); assert.strictEqual(r.invoice.items[1].note, '');
  assert.strictEqual(C.invoiceTotals(r.invoice).lines[0].note, 'SN-12345');
  const back = C.parseBackup(C.exportJSON(s)); assert.ok(back.ok, back.error);
  assert.strictEqual(back.state.invoices[0].items[0].note, 'SN-12345');
});
t('old invoices without a note field still work', () => {
  const { s, a, b, p } = world();
  const r = C.addInvoice(s, { type: 'purchase', personId: b.id, date: D, items: [{ productId: p.id, qty: 2, price: 100 }] }); assert.ok(r.ok);
  delete r.invoice.items[0].note;
  assert.strictEqual(C.invoiceTotals(r.invoice).lines[0].note, ''); assert.deepStrictEqual(C.audit(s), []);
});
t('opening stock: counts in inventory, sells at correct cost, NOT counted as profit', () => {
  const { s, a, p } = world();
  assert.ok(C.addAdjust(s, { productId: p.id, qty: 10, cost: 500, date: D, note: 'موجودی اولیه', opening: true }).ok);
  let rp = C.replay(s); assert.strictEqual(rp.stock[p.id].stock, 10); assert.strictEqual(Math.round(rp.stock[p.id].avg), 500);
  assert.strictEqual(C.inventoryValue(s), 5000);
  assert.strictEqual(C.report(s).net, 0); assert.strictEqual(C.report(s).adjLoss, 0);
  const r = C.addInvoice(s, { type: 'sale', personId: a.id, date: '2026-10-02', items: [{ productId: p.id, qty: 4, price: 800 }] }); assert.ok(r.ok, r.error);
  const rep = C.report(s); assert.strictEqual(rep.cogs, 2000); assert.strictEqual(rep.net, 1200);
  assert.deepStrictEqual(C.audit(s), []);
});
t('ordinary positive adjustment still counts as gain; opening flag ignored for negative qty', () => {
  const { s, p } = world();
  assert.ok(C.addAdjust(s, { productId: p.id, qty: 3, cost: 100, date: D }).ok); assert.strictEqual(C.report(s).adjLoss, -300);
  const r = C.addAdjust(s, { productId: p.id, qty: -1, date: D, opening: true }); assert.ok(r.ok); assert.ok(!r.adjust.opening);
});
t('statement text uses plain wording and rial', () => {
  const { s, a, p } = world();
  C.addInvoice(s, { type: 'purchase', personId: C.addPerson(s, { name: 'تامین' }).person.id, date: D, items: [{ productId: p.id, qty: 1, price: 50 }] });
  C.addAdjust(s, { productId: p.id, qty: 5, cost: 10, date: D });
  C.addTx(s, { personId: a.id, type: 'manual', kind: 'debit', amount: 700, date: D, desc: 'x' });
  const txt = C.statementText(s, a.id); assert.ok(txt.includes('ریال')); assert.ok(!txt.includes('تومان')); assert.ok(txt.includes('(شما بدهکارید)')); assert.ok(!/بستانکار/.test(txt));
});

t('replay cache stays correct after a rejected invoice', () => {
  const st = C.emptyState(); const p = C.addPerson(st, { name: 'a' }).person; const g = C.addProduct(st, { name: 'x' }).product;
  C.addInvoice(st, { type: 'purchase', personId: p.id, date: '2026-01-01', items: [{ productId: g.id, qty: 2, price: 100 }] });
  assert.ok(!C.addInvoice(st, { type: 'sale', personId: p.id, date: '2026-01-02', items: [{ productId: g.id, qty: 5, price: 100 }] }).ok);
  const r = C.addInvoice(st, { type: 'sale', personId: p.id, date: '2026-01-02', items: [{ productId: g.id, qty: 1, price: 100 }] });
  assert.ok(r.ok); assert.strictEqual(C.replay(st).stock[g.id].stock, 1);
  assert.ok(C.deleteInvoice(st, r.invoice.id).ok); assert.strictEqual(C.replay(st).stock[g.id].stock, 2);
});
t('indexed lookups follow adds and deletes', () => {
  const st = C.emptyState(); const a = C.addPerson(st, { name: 'a' }).person; const b = C.addPerson(st, { name: 'b' }).person;
  assert.ok(C.byId(st.people, b.id) === b); C.deletePerson(st, b.id); assert.strictEqual(C.byId(st.people, b.id), undefined); assert.ok(C.byId(st.people, a.id) === a);
});
t('large backup parses without stack overflow', () => {
  const st = C.emptyState(); const p = C.addPerson(st, { name: 'a' }).person;
  for (let i = 0; i < 200000; i++) st.tx.push({ id: st.seq++, personId: p.id, kind: 'debit', amount: 1, type: 'manual', desc: '', date: '2026-01-01', ref: null, group: null, method: null });
  const r = C.parseBackup(C.exportJSON(st)); assert.ok(r.ok, r.error);
});
t('free-limit document count', () => {
  const L = require('../www/license.js'); const s = C.emptyState(); const a = C.addPerson(s, { name: 'a' }).person, b = C.addPerson(s, { name: 'b' }).person; const g = C.addProduct(s, { name: 'x' }).product;
  C.addInvoice(s, { type: 'purchase', personId: a.id, date: '2026-01-01', items: [{ productId: g.id, qty: 1, price: 10 }], paid: 10 });
  C.addTx(s, { personId: a.id, type: 'receipt', amount: 5, date: '2026-01-01' }); C.addTransfer(s, { fromId: a.id, toId: b.id, amount: 3, date: '2026-01-01' });
  C.addExpense(s, { title: 'e', amount: 2, date: '2026-01-01' });
  assert.strictEqual(L.countDocs(s), 4);
});
t('VAT: added to the person, not counted as income or cost', () => {
  const s = C.emptyState(); const sup = C.addPerson(s, { name: 's' }).person, cu = C.addPerson(s, { name: 'c' }).person, g = C.addProduct(s, { name: 'x' }).product;
  assert.ok(C.addInvoice(s, { type: 'purchase', personId: sup.id, date: D, items: [{ productId: g.id, qty: 2, price: 1000 }], vatRate: 10 }).ok);
  const r = C.addInvoice(s, { type: 'sale', personId: cu.id, date: D, items: [{ productId: g.id, qty: 1, price: 1500 }], vatRate: 10, paid: 1650 }); assert.ok(r.ok);
  assert.strictEqual(C.invoiceTotals(r.invoice).total, 1650); assert.strictEqual(C.balanceOf(s, sup.id), -2200); assert.strictEqual(C.balanceOf(s, cu.id), 0);
  const rep = C.report(s); assert.strictEqual(rep.sales, 1500); assert.strictEqual(rep.cogs, 1000); assert.strictEqual(rep.gross, 500); assert.strictEqual(rep.vatOut, 150); assert.strictEqual(rep.vatIn, 200);
  assert.strictEqual(Math.round(C.replay(s).stock[g.id].avg), 1000);
});
t('edit invoice updates stock, balance, payment and profit', () => {
  const s = C.emptyState(); const sup = C.addPerson(s, { name: 's' }).person, cu = C.addPerson(s, { name: 'c' }).person, c2 = C.addPerson(s, { name: 'c2' }).person, g = C.addProduct(s, { name: 'x' }).product;
  C.addInvoice(s, { type: 'purchase', personId: sup.id, date: D, items: [{ productId: g.id, qty: 5, price: 100 }] });
  const inv = C.addInvoice(s, { type: 'sale', personId: cu.id, date: D, items: [{ productId: g.id, qty: 2, price: 150 }], paid: 100 }).invoice;
  assert.strictEqual(C.balanceOf(s, cu.id), 200);
  assert.ok(!C.editInvoice(s, inv.id, { personId: cu.id, date: D, items: [{ productId: g.id, qty: 9, price: 150 }], paid: 100 }).ok); // more than stock
  assert.strictEqual(C.replay(s).stock[g.id].stock, 3);
  const e = C.editInvoice(s, inv.id, { personId: c2.id, date: D, items: [{ productId: g.id, qty: 4, price: 150 }], paid: 600 }); assert.ok(e.ok, e.error);
  assert.strictEqual(C.replay(s).stock[g.id].stock, 1); assert.strictEqual(C.balanceOf(s, cu.id), 0); assert.strictEqual(C.balanceOf(s, c2.id), 0);
  assert.strictEqual(C.invoiceInfo(s, C.byId(s.invoices, inv.id)).remaining, 0); assert.strictEqual(C.report(s).gross, 200);
  assert.ok(C.editInvoice(s, inv.id, { personId: c2.id, date: D, items: [{ productId: g.id, qty: 4, price: 150 }], paid: 0 }).ok);
  assert.strictEqual(C.balanceOf(s, c2.id), 600); assert.deepStrictEqual(C.audit(s), []);
});
t('edit transfer and cheque', () => {
  const s = C.emptyState(); const a = C.addPerson(s, { name: 'a' }).person, b = C.addPerson(s, { name: 'b' }).person, c = C.addPerson(s, { name: 'c' }).person;
  C.addTransfer(s, { fromId: a.id, toId: b.id, amount: 50, date: D, desc: 'x' }); const g = s.tx[0].group;
  assert.ok(C.editTransfer(s, g, { fromId: a.id, toId: c.id, amount: 70, date: D, desc: 'y' }).ok);
  assert.strictEqual(C.balanceOf(s, b.id), 0); assert.strictEqual(C.balanceOf(s, c.id), 70); assert.strictEqual(C.balanceOf(s, a.id), -70); assert.strictEqual(C.transferInfo(s, g).desc, 'y');
  const ch = C.addCheque(s, { title: 'چک', amount: 100, dueDate: D, personId: a.id, direction: 'receive' }).cheque; C.completeCheque(s, ch.id, true, D);
  assert.ok(C.editCheque(s, ch.id, { title: 'چک', amount: 300, dueDate: D, personId: b.id, direction: 'receive' }).ok);
  assert.strictEqual(C.balanceOf(s, b.id), -300);
});
t('fiscal year and day periods', () => {
  assert.deepStrictEqual(C.periodRange('fytd', '2026-10-08', 1), { from: C.partsToIso(1405, 1, 1), to: '2026-10-08' });
  assert.deepStrictEqual(C.periodRange('fytd', '2026-10-08', 10), { from: C.partsToIso(1404, 10, 1), to: '2026-10-08' });
  assert.deepStrictEqual(C.periodRange('yesterday', '2026-10-08'), { from: '2026-10-07', to: '2026-10-07' });
  assert.deepStrictEqual(C.periodRange('mtd', '2026-10-08'), { from: C.partsToIso(1405, 7, 1), to: '2026-10-08' });
});
t('toman display unit (stored values stay in Rial)', () => {
  try {
    C.setUnit('toman'); assert.strictEqual(C.unitName(), 'تومان');
    assert.strictEqual(C.parseMoney('۱,۲۵۰'), 12500); assert.strictEqual(C.fmt(12500), '۱,۲۵۰'); assert.strictEqual(C.fmt(12345), '۱,۲۳۵');
    assert.ok(isNaN(C.parseMoney('9e12')));
  } finally { C.setUnit('rial'); }
  assert.strictEqual(C.parseMoney('۱,۲۵۰'), 1250); assert.strictEqual(C.fmt(12500), '۱۲,۵۰۰'); assert.strictEqual(C.unitName(), 'ریال');
  assert.strictEqual(C.longDate('2026-10-10').wd, 'شنبه'); assert.strictEqual(C.longDate('2026-10-10').date, '۱۸ مهر ۱۴۰۵');
});
t('reset data keeps people and products', () => {
  const { s, a, b, p } = world();
  C.addAdjust(s, { productId: p.id, qty: 5, cost: 100, date: D, note: 'اول', opening: true });
  C.addInvoice(s, { type: 'purchase', personId: b.id, date: D, items: [{ productId: p.id, qty: 10, price: 100 }], paid: 300, method: 'cash' });
  C.addInvoice(s, { type: 'sale', personId: a.id, date: D, items: [{ productId: p.id, qty: 12, price: 300 }] });
  C.addTx(s, { personId: a.id, type: 'receipt', amount: 1000, date: D, method: 'cash' }); C.addExpense(s, { title: 'اجاره', amount: 50, date: D, method: 'cash' });
  const ch = C.addCheque(s, { title: 'چک', amount: 100, dueDate: D, personId: a.id, direction: 'receive' }).cheque; C.completeCheque(s, ch.id, true, D);
  const before = JSON.stringify(s);
  const bad = C.resetData(s, { adjusts: true }); assert.ok(!bad.ok); // sales would be left without stock
  const r1 = C.resetData(s, { invoices: true }); assert.ok(r1.ok, r1.error);
  assert.strictEqual(r1.state.invoices.length, 0); assert.strictEqual(r1.state.adjusts.length, 1); assert.strictEqual(r1.state.people.length, 2); assert.strictEqual(r1.state.products.length, 1);
  assert.ok(r1.state.tx.every(t => t.ref == null)); assert.strictEqual(C.balanceOf(r1.state, a.id), -1100);
  const r2 = C.resetData(s, { invoices: true, adjusts: true, people: true, expenses: true, cheques: true }); assert.ok(r2.ok, r2.error);
  ['invoices', 'tx', 'adjusts', 'expenses', 'cheques'].forEach(k => assert.strictEqual(r2.state[k].length, 0, k));
  assert.strictEqual(r2.state.people.length, 2); assert.strictEqual(r2.state.products.length, 1); assert.deepStrictEqual(C.audit(r2.state), []);
  const r3 = C.resetData(s, { people: true }); assert.ok(r3.ok, r3.error); assert.ok(!r3.state.cheques[0].txId); assert.ok(r3.state.cheques[0].done);
  assert.strictEqual(JSON.stringify(s), before); // original untouched
});
t('smart categories', () => {
  const cases = { 'آیفون ۱۳ پرو ۲۵۶ گیگ': 'آیفون', 'قاب آیفون ۱۳': 'قاب و کاور', 'گلس آیفون ۱۴': 'گلس و محافظ صفحه', 'کابل اپل ۱ متر C _ Li': 'کابل شارژ و داده', 'آداپتور شارژ ۲۰ وات اپل C': 'آداپتور و شارژر', 'آداپتور شارژ مگ سیف اپل ۱ متر': 'شارژر وایرلس و مگ‌سیف', 'شارژر فندکی مک دودو ۳۳ وات': 'شارژر فندکی', 'پاوربانک مگ سیف مک دودو': 'پاوربانک', 'گوشی سامسونگ A55': 'گوشی سامسونگ', 'ایرپاد پرو ۲': 'هندزفری و هدفون', 'نگهدارنده گوشی مک دودو': 'هولدر و پایه', 'باتری آیفون ۷': 'قطعات و تعمیرات', 'چیز ناشناخته': 'سایر لوازم جانبی' };
  for (const [nm, c] of Object.entries(cases)) assert.strictEqual(C.guessCategory(nm), c, nm);
  const s = C.emptyState(); const p = C.addProduct(s, { name: 'کابل تست' }).product; assert.ok(!p.category); assert.strictEqual(C.catOf(p), 'کابل شارژ و داده');
  C.editProduct(s, p.id, { name: 'کابل تست', category: 'ویژه' }); assert.strictEqual(C.catOf(p), 'ویژه');
  C.editProduct(s, p.id, { name: 'کابل تست', category: '' }); assert.strictEqual(C.catOf(p), 'کابل شارژ و داده');
});
t('products export / import / clear warehouse', () => {
  const { s, a, b, p } = world();
  C.addAdjust(s, { productId: p.id, qty: 5, cost: 100, date: D, note: '', opening: true });
  C.addInvoice(s, { type: 'purchase', personId: b.id, date: D, items: [{ productId: p.id, qty: 5, price: 200 }] });
  C.addProduct(s, { name: 'قاب ویژه', category: 'دسته من', salePrice: 50 });
  const file = C.exportProducts(s), r = C.parseProducts(file); assert.ok(r.ok);
  assert.deepStrictEqual(r.items.map(x => [x.name, x.stock, x.avg, x.category]), [['گوشی', 10, 150, ''], ['قاب ویژه', 0, 0, 'دسته من']]);
  const c1 = C.clearWarehouse(s, {}); assert.ok(c1.ok); assert.strictEqual(c1.state.products.length, 2); assert.strictEqual(c1.state.invoices.length, 0); assert.strictEqual((C.replay(c1.state).stock[p.id] || { stock: 0 }).stock, 0);
  const c2 = C.clearWarehouse(s, { products: true }); assert.ok(c2.ok); assert.strictEqual(c2.state.products.length, 0); assert.strictEqual(c2.state.people.length, 2); assert.deepStrictEqual(C.audit(c2.state), []);
  const st = c2.state; const im = C.importProducts(st, r.items, { stock: true, date: D }); assert.deepStrictEqual([im.added, im.dup, im.withStock], [2, 0, 1]);
  const np = st.products.find(x => x.name === 'گوشی'); assert.strictEqual(C.replay(st).stock[np.id].stock, 10); assert.strictEqual(C.replay(st).stock[np.id].avg, 150);
  assert.strictEqual(C.catOf(st.products.find(x => x.name === 'قاب ویژه')), 'دسته من'); assert.deepStrictEqual(C.audit(st), []);
  assert.strictEqual(C.importProducts(st, r.items, { stock: true }).dup, 2);
  const txt = C.parseProducts('کابل یک\nکابل یک\n\nقاب دو'); assert.deepStrictEqual(txt.items.map(x => x.name), ['کابل یک', 'قاب دو']);
  assert.ok(!C.parseProducts('{"app":"x"}').ok);
  const full = C.parseProducts(C.exportJSON(s)); assert.ok(full.ok); assert.strictEqual(full.items.find(x => x.name === 'گوشی').stock, 10);
});
t('insights: last price, frequent, serials, stock, category profit, search', () => {
  const { s, a, b, p } = world(); const T = '2026-10-10', d = k => C.addDays(T, -k);
  const c = C.addProduct(s, { name: 'کابل تست' }).product, old = C.addProduct(s, { name: 'قاب قدیمی' }).product;
  C.addAdjust(s, { productId: old.id, qty: 2, cost: 10, date: d(100), note: '' });
  C.addInvoice(s, { type: 'purchase', personId: b.id, date: d(50), items: [{ productId: p.id, qty: 2, price: 1000, note: 'IMEI 490154203237518' }, { productId: c.id, qty: 22, price: 10 }] });
  C.addInvoice(s, { type: 'sale', personId: a.id, date: d(40), items: [{ productId: p.id, qty: 1, price: 1300, note: 'IMEI 490154203237518' }] });
  for (let k = 0; k < 10; k++) C.addInvoice(s, { type: 'sale', personId: a.id, date: d(30 - k * 2), items: [{ productId: c.id, qty: 2, price: k === 9 ? 25 : 20 }] });
  assert.strictEqual(C.lastPrice(s, 'sale', a.id, c.id).price, 25); assert.strictEqual(C.lastPrice(s, 'purchase', b.id, p.id).price, 1000); assert.strictEqual(C.lastPrice(s, 'sale', b.id, c.id), null);
  assert.deepStrictEqual(C.frequentProducts(s, 'sale', a.id), [c.id, p.id]);
  assert.ok(C.luhnOk('490154203237518')); assert.ok(!C.luhnOk('490154203237519'));
  const h = C.serialHistory(s, '7518'); assert.strictEqual(h.length, 1); assert.strictEqual(h[0].state, 'فروخته شده'); assert.strictEqual(h[0].profit, 300); assert.strictEqual(h[0].events.length, 2);
  assert.ok(C.serialWarning(s, '490154203237518', 'sale')); assert.strictEqual(C.serialWarning(s, '490154203237518', 'sale_return'), null); assert.strictEqual(C.serialWarning(s, 'NOPE123456', 'sale'), null);
  const ins = C.stockInsights(s, T); assert.ok(ins.reorder.some(x => x.product.id === c.id)); assert.ok(ins.stale.some(x => x.product.id === old.id)); assert.ok(!ins.stale.some(x => x.product.id === c.id));
  const cp = C.categoryProfit(s, null, null); const cab = cp.find(x => x.cat === 'کابل شارژ و داده'); assert.strictEqual(cab.rev, 9 * 40 + 50); assert.strictEqual(cab.cost, 200);
  assert.ok(C.fuzzyScore('آیفون ۱۳ پرو', C.searchWords('iphone13'))); assert.ok(C.fuzzyScore('علی رضایی', C.searchWords('رضائي'))); assert.ok(C.fuzzyScore('سامسونگ گلکسی', C.searchWords('سامسنگ'))); assert.ok(!C.fuzzyScore('قاب', C.searchWords('کابل')));
  assert.deepStrictEqual(C.prevRange('2026-10-01', '2026-10-10'), { from: '2026-09-21', to: '2026-09-30' }); assert.strictEqual(C.pctChange(120, 100), 20); assert.strictEqual(C.pctChange(5, 0), null);
});
t('words, price hints, duplicates, serial-required', () => {
  assert.strictEqual(C.numToWords(12500000), 'دوازده میلیون و پانصد هزار'); assert.strictEqual(C.numToWords(1000), 'هزار'); assert.strictEqual(C.numToWords(2016000), 'دو میلیون و شانزده هزار'); assert.strictEqual(C.numToWords(105), 'صد و پنج'); assert.strictEqual(C.numToWords(0), 'صفر');
  try { C.setUnit('toman'); assert.strictEqual(C.moneyWords(125000000), 'دوازده میلیون و پانصد هزار تومان'); } finally { C.setUnit('rial'); }
  assert.strictEqual(C.moneyWords(125000000), 'صد و بیست و پنج میلیون ریال');
  const { s, a, b, p } = world(); C.addInvoice(s, { type: 'purchase', personId: b.id, date: D, items: [{ productId: p.id, qty: 5, price: 1000, note: 'S11111111 S22222222 S33333333 S44444444 S55555555' }] });
  [1100, 1200, 1150].forEach(pr => C.addInvoice(s, { type: 'sale', personId: a.id, date: D, items: [{ productId: p.id, qty: 1, price: pr, note: 'S1111111' + pr }] }));
  assert.strictEqual(C.typicalPrice(s, 'sale', p.id), 1150); assert.ok(C.priceOdd(11500, 1150)); assert.ok(C.priceOdd(250, 1150)); assert.ok(!C.priceOdd(1500, 1150));
  assert.ok(C.findDuplicateInvoice(s, { type: 'sale', personId: a.id, date: D, items: [{ productId: p.id, qty: 1, price: 1200 }] })); assert.ok(!C.findDuplicateInvoice(s, { type: 'sale', personId: a.id, date: D, items: [{ productId: p.id, qty: 2, price: 1200 }] }));
  const ph = C.addProduct(s, { name: 'آیفون ۱۵ ۱۲۸ گیگ' }).product, cab = C.addProduct(s, { name: 'کابل تست' }).product;
  assert.ok(C.serialRequired(s, ph)); assert.ok(!C.serialRequired(s, cab));
  assert.strictEqual(C.serialProblems(s, [{ productId: ph.id, qty: 2, note: 'IMEI 490154203237518' }]).length, 1); assert.strictEqual(C.serialProblems(s, [{ productId: ph.id, qty: 2, note: '490154203237518 356789012345670' }]).length, 0);
  C.editProduct(s, ph.id, { name: ph.name, serialReq: false }); assert.ok(!C.serialRequired(s, ph)); C.editProduct(s, ph.id, { name: ph.name, serialReq: null }); assert.ok(C.serialRequired(s, ph));
  s.settings.serialAuto = false; assert.ok(!C.serialRequired(s, ph));
});
t('serials in stock for picking', () => {
  const { s, a, b, p } = world();
  C.addInvoice(s, { type: 'purchase', personId: b.id, date: D, items: [{ productId: p.id, qty: 3, price: 1000, note: '490154203237518 356789012345670 SN0000111' }] });
  assert.deepStrictEqual(C.serialsInStock(s, p.id).map(x => x.serial).sort(), ['356789012345670', '490154203237518', 'SN0000111']);
  const sale = C.addInvoice(s, { type: 'sale', personId: a.id, date: '2026-10-02', items: [{ productId: p.id, qty: 1, price: 1500, note: '490154203237518' }] }).invoice;
  assert.deepStrictEqual(C.serialsInStock(s, p.id).map(x => x.serial).sort(), ['356789012345670', 'SN0000111']);
  assert.strictEqual(C.serialsInStock(s, p.id, sale.id).length, 3); // while editing that sale, its device is available again
  C.addInvoice(s, { type: 'sale_return', personId: a.id, date: '2026-10-03', items: [{ productId: p.id, qty: 1, price: 1500, note: '490154203237518' }] });
  const back = C.serialsInStock(s, p.id).find(x => x.serial === '490154203237518'); assert.ok(back && back.type === 'sale_return' && back.personId === a.id && back.buyFrom === b.id);
});
t('opening stock set later on an existing product', () => {
  const { s, a, b, p } = world();
  assert.ok(C.addInvoice(s, { type: 'purchase', personId: b.id, date: D, items: [{ productId: p.id, qty: 1, price: 1000 }] }).ok); // books start on D
  const q = C.addProduct(s, { name: 'قاب ژله ای تست' }).product;
  assert.ok(C.setOpeningStock(s, q.id, 5, 200).ok); assert.strictEqual(C.replay(s).stock[q.id].stock, 5);
  assert.strictEqual(C.openingOf(s, q.id).qty, 5);
  assert.ok(C.addInvoice(s, { type: 'sale', personId: a.id, date: D, items: [{ productId: q.id, qty: 3, price: 400 }] }).ok); // same day as the opening
  assert.ok(!C.setOpeningStock(s, q.id, 2, 200).ok); // would make stock negative after the sale
  assert.strictEqual(C.openingOf(s, q.id).qty, 5);
  assert.ok(C.setOpeningStock(s, q.id, 8, 0).ok); assert.strictEqual(C.replay(s).stock[q.id].stock, 5); assert.strictEqual(C.openingOf(s, q.id).cost, 200);
  const r = C.report(s, D, D); assert.ok(r.adjLoss === 0);
  assert.ok(!C.setOpeningStock(s, C.addProduct(s, { name: 'بی قیمت' }).product.id, 3, 0).ok);
});
t('accounts: cash box, banks, opening balances, transfers, migration', () => {
  const { s, a } = world();
  const bank = C.addAccount(s, { kind: 'bank', bank: 'ملت', accNo: '۱۲۳-۴۵۶۷', card: '6104337712345678', sheba: '120120000000001234567890', opening: 5000 }).account;
  assert.strictEqual(bank.sheba, 'IR120120000000001234567890');
  assert.ok(!C.addAccount(s, { kind: 'bank', bank: 'ملی', card: '123' }).ok);
  const cash = s.accounts.find(x => x.kind === 'cash'); assert.ok(C.editAccount(s, cash.id, { name: 'صندوق اصلی', opening: 1000 }).ok);
  C.addTx(s, { personId: a.id, type: 'receipt', amount: 300, date: D, acct: bank.id });
  C.addTx(s, { personId: a.id, type: 'receipt', amount: 200, date: D });          // no account → main cash box
  C.addExpense(s, { title: 'کارمزد', amount: 20, date: D, acct: bank.id });
  assert.ok(C.addAcctTx(s, { from: cash.id, to: bank.id, amount: 700, fee: 5, date: '2026-10-02' }).ok);
  const b = C.accountBalances(s); assert.strictEqual(b[cash.id], 1000 + 200 - 700 - 5); // fee from the source assert.strictEqual(b[bank.id], 5000 + 300 - 20 + 700);
  const cs = C.cashSummary(s); assert.strictEqual(cs.in, 500); assert.strictEqual(cs.out, 25); // 20 expense + 5 fee // the transfer itself is not income or cost
  assert.strictEqual(C.cashBalance(s), 1000 + 5000 + 500 - 25);
  const L = C.accountLedger(s, bank.id); assert.strictEqual(L.rows[L.rows.length - 1].bal, L.balance);
  assert.ok(!C.deleteAccount(s, bank.id).ok);
  // old data: one opening cash figure and payment methods
  const old = { v: 1, seq: 50, people: [{ id: 1, name: 'x' }], products: [], invoices: [], tx: [{ id: 2, personId: 1, kind: 'credit', amount: 100, type: 'receipt', date: D, method: 'cash' }, { id: 3, personId: 1, kind: 'credit', amount: 40, type: 'receipt', date: D, method: 'bank' }], expenses: [{ id: 4, title: 'e', amount: 10, date: D, method: 'cheque' }], cheques: [], adjusts: [], settings: { openingCash: 77 } };
  const r = C.parseBackup(JSON.stringify({ app: 'fixquick-accounting', version: 1, data: old })); assert.ok(r.ok, r.error);
  const st2 = r.state; assert.strictEqual(st2.accounts.length, 2); assert.strictEqual(C.cashBalance(st2), 77 + 100 + 40 - 10);
  assert.strictEqual(st2.settings.openingCash, 0); assert.deepStrictEqual(C.audit(st2), []);
});
t('invoice numbers are separate per type', () => {
  const s = C.emptyState(); const p = C.addPerson(s, { name: 'a' }).person, q = C.addProduct(s, { name: 'k' }).product, D = '2026-10-01';
  const mk = type => C.addInvoice(s, { type, personId: p.id, date: D, items: [{ productId: q.id, qty: type === 'purchase' ? 5 : 1, price: 100 }] }).invoice.no;
  assert.strictEqual(mk('purchase'), '1'); assert.strictEqual(mk('sale'), '1'); assert.strictEqual(mk('sale'), '2'); assert.strictEqual(mk('purchase'), '2');
  assert.strictEqual(C.nextInvoiceNo(s, 'sale'), '3'); assert.strictEqual(C.nextInvoiceNo(s, 'sale_return'), '1');
  assert.ok(!C.addInvoice(s, { type: 'sale', no: '2', personId: p.id, date: D, items: [{ productId: q.id, qty: 1, price: 100 }] }).ok);
});
console.log(n + ' tests passed');
