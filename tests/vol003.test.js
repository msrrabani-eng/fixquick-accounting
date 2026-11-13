'use strict';
const assert = require('assert');
const Core = require('../www/core.js');
let count = 0;
const check = (label, fn) => { try { fn(); count++; } catch (e) { console.error('FAIL:', label, e.stack); process.exitCode = 1; } };
const ch = (id, amount, extra={}) => ({ id, amount, cyc: 1, direction: 'receive', state: 'box', dueDate: '2026-12-01', ...extra });
check('single exact cheque suggested without changing input', () => {
  const a = [ch(1,1000),ch(2,2500),ch(3,4000)]; const before = JSON.stringify(a);
  const r=Core.suggestCheques(a,2500);
  assert.strictEqual(r[0].total,2500); assert.strictEqual(r[0].count,1); assert.deepStrictEqual(r[0].ids,[2]);
  assert.strictEqual(JSON.stringify(a),before);
});
check('two-cheque exact settlement recommended', () => {
  const r = Core.suggestCheques([ch(1,100),ch(2,150),ch(3,230)],250);
  assert.deepStrictEqual(r[0].ids,[1,2]); assert.strictEqual(r[0].difference,0);
});
check('three-cheque exact settlement recommended', () => {
  const r = Core.suggestCheques([ch(1,30),ch(2,70),ch(3,80),ch(4,220)],180);
  assert.deepStrictEqual(r[0].ids,[1,2,3]); assert.strictEqual(r[0].count,3);
});
check('never recommend totals larger than creditor balance', () => {
  const r=Core.suggestCheques([ch(1,90),ch(2,60),ch(3,80),ch(4,200)],100);
  assert.ok(r.every(x=>x.total <= 100 && x.difference >= 0));
  assert.ok(r.every(x=>x.ids.every(id=>id !== 4)));
});
check('invalid, spent, issued and legacy cheques are excluded', () => {
  const a=[ch(1,75),ch(2,100,{state:'spent'}),ch(3,90,{direction:'pay'}),ch(4,80,{cyc:0}),ch(5,-10),ch(6,NaN)];
  const r=Core.suggestCheques(a,100);
  assert.deepStrictEqual(r.map(x=>x.ids),[[1]]);
});
check('invalid target amount yields no recommendation', () => {
  assert.deepStrictEqual(Core.suggestCheques([ch(1,100)],-20),[]);
  assert.deepStrictEqual(Core.suggestCheques([ch(1,100)],0),[]);
  assert.deepStrictEqual(Core.suggestCheques([ch(1,100)],'hello'),[]);
});
check('Persian digits / Arabic characters remain searchable using shared engine', () => {
  assert.ok(Core.matchScore('بانک ملی علی ۱۲۳۴', 'بانك ملي') > 0);
  assert.ok(Core.matchScore('iPhone 16 Pro Max', 'آیفون ۱۶') > 0);
});
check('large cheque pool has bounded runtime and leaves inputs untouched', () => {
  const a=Array.from({length:450},(_,i)=>ch(i+1, (i+1)*1000)); const before=JSON.stringify(a);
  const start=Date.now(); const r=Core.suggestCheques(a,120000,{limit:5});
  assert.ok(Date.now()-start < 2000); assert.ok(r.length<=5); assert.ok(r.every(x=>x.total<=120000));
  assert.strictEqual(JSON.stringify(a),before);
});
console.log(`${count} vol003 regression tests passed`);
