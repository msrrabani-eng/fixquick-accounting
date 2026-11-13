'use strict';
const assert = require('assert');
const C = require('../www/core.js');
let passed = 0;
function t(name, fn) { try { fn(); passed++; } catch (e) { console.error('FAIL',name,'\n',e.stack); process.exitCode = 1; } }
const DATE='2026-10-05';
const basic = () => {
  const st=C.emptyState(); st.settings.serialCoreStrict=true;
  const customer=C.addPerson(st,{name:'خریدار'}).person;
  const supplier=C.addPerson(st,{name:'فروشنده'}).person;
  const product=C.addProduct(st,{name:'کابل معمولی',serialReq:false}).product;
  return {st,customer,supplier,product};
};
t('manual adjustments do not become new P&L income or expense',()=>{
  const {st,customer}=basic();
  const r=C.addTx(st,{personId:customer.id,kind:'debit',amount:100000000,date:DATE,type:'manual'});
  assert.ok(r.ok,r.error); assert.strictEqual(r.tx.manualPosting,'suspense');
  assert.strictEqual(C.report(st).net,0); assert.strictEqual(C.ledgerPL(st).net,0);
  assert.strictEqual(C.balanceOf(st,customer.id),100000000);
  assert.deepStrictEqual(C.audit(st),[]);
});
t('old manual entries preserve historical accounting, both P&L reports agree',()=>{
  const {st,customer}=basic();
  const r=C.addTx(st,{personId:customer.id,kind:'debit',amount:100000,date:DATE,type:'manual'});
  delete r.tx.manualPosting;
  assert.strictEqual(C.report(st).net,100000);
  assert.strictEqual(C.ledgerPL(st).net,100000);
});
t('new invoices with required IMEI cannot silently skip serial',()=>{
  const {st,supplier}=basic();
  const product=C.addProduct(st,{name:'iPhone 16 Pro Max',serialReq:true}).product;
  const before=JSON.stringify(st);
  const r=C.addInvoice(st,{type:'purchase',personId:supplier.id,date:DATE,items:[{productId:product.id,qty:1,price:250000000,note:''}]});
  assert.ok(!r.ok); assert.strictEqual(JSON.stringify(st),before);
});
t('legacy cleared cheque deletion removes its financial transaction',()=>{
  const {st,customer}=basic();
  const c=C.addCheque(st,{kind:'cheque',direction:'receive',personId:customer.id,title:'چک قدیمی',amount:1000,dueDate:DATE}).cheque;
  const r=C.completeCheque(st,c.id,true,DATE); assert.ok(r.ok,r.error);
  assert.strictEqual(st.tx.filter(t=>t.id===c.txId).length,1);
  assert.ok(C.deleteCheque(st,c.id).ok);
  assert.ok(!st.tx.some(t=>t.id===c.txId));
  assert.ok(!st.cheques.some(x=>x.id===c.id));
  assert.deepStrictEqual(C.audit(st),[]);
});
t('invoice settlements through receivable cheque, spent cheque, then bounced cheque reverse correctly',()=>{
  const {st,customer,supplier,product}=basic();
  const buy=C.addInvoice(st,{type:'purchase',personId:supplier.id,date:DATE,items:[{productId:product.id,qty:1,price:1000}]});
  const sale=C.addInvoice(st,{type:'sale',personId:customer.id,date:DATE,items:[{productId:product.id,qty:1,price:1000}]});
  assert.ok(buy.ok && sale.ok);
  const r=C.addCheque(st,{cycle:true,direction:'receive',personId:customer.id,invoiceId:sale.invoice.id,title:'چک',amount:1000,date:DATE,dueDate:'2026-10-10'});
  assert.ok(r.ok,r.error); assert.strictEqual(C.invoiceInfo(st,sale.invoice).remaining,0);
  assert.strictEqual(C.balanceOf(st,customer.id),0);
  let a=C.chequeAct(st,r.cheque.id,'spent',{to:supplier.id,invoiceId:buy.invoice.id,date:'2026-10-06'});
  assert.ok(a.ok,a.error); assert.strictEqual(C.invoiceInfo(st,buy.invoice).remaining,0);
  assert.strictEqual(C.balanceOf(st,supplier.id),0);
  a=C.chequeAct(st,r.cheque.id,'bounced',{date:'2026-10-07'});
  assert.ok(a.ok,a.error);
  assert.strictEqual(C.invoiceInfo(st,sale.invoice).remaining,1000);
  assert.strictEqual(C.invoiceInfo(st,buy.invoice).remaining,1000);
  assert.deepStrictEqual(C.audit(st),[]);
});
t('editing linked cheque does not lose its existing invoice credit',()=>{
  const {st,customer,supplier,product}=basic();
  assert.ok(C.addInvoice(st,{type:'purchase',personId:supplier.id,date:DATE,items:[{productId:product.id,qty:1,price:1000}]}).ok);
  const sale=C.addInvoice(st,{type:'sale',personId:customer.id,date:DATE,items:[{productId:product.id,qty:1,price:1000}]});
  const ch=C.addCheque(st,{cycle:true,direction:'receive',personId:customer.id,invoiceId:sale.invoice.id,amount:1000,date:DATE,dueDate:'2026-10-10'});
  assert.ok(ch.ok,ch.error);
  const r=C.editCheque(st,ch.cheque.id,{cycle:true,direction:'receive',personId:customer.id,invoiceId:sale.invoice.id,amount:900,date:DATE,dueDate:'2026-10-10'});
  assert.ok(r.ok,r.error);
  assert.strictEqual(C.invoiceInfo(st,sale.invoice).remaining,100);
  assert.deepStrictEqual(C.audit(st),[]);
});
t('fiscal locks refuse backdated edits, deletes, transfers, expenses without mutating financial data',()=>{
  const {st,customer,supplier,product}=basic();
  const r=C.addTx(st,{personId:customer.id,kind:'debit',type:'manual',amount:100,date:DATE});
  const e=C.addExpense(st,{title:'هزینه',amount:200,date:DATE,method:'cash'}).expense;
  const a=C.addAccount(st,{kind:'bank',name:'بانک',bank:'ملی',opening:25}).account;
  st.fyClosed=[{to:'2026-10-10'}];
  const before=JSON.stringify(st);
  const block=[C.editTx(st,r.tx.id,{amount:10,date:DATE}),C.deleteTx(st,r.tx.id),C.addTransfer(st,{fromId:customer.id,toId:supplier.id,amount:2,date:DATE}),C.addAcctTx(st,{from:a.id,to:st.accounts[0].id,amount:100,date:DATE}),C.deleteExpense(st,e.id),C.editAccount(st,a.id,{kind:'bank',name:'بانک',bank:'ملی',opening:30}),C.addAccount(st,{kind:'cash',name:'جدید',opening:100})];
  assert.ok(block.every(x=>!x.ok),block.map(x=>x.error).join(' / '));
  assert.strictEqual(JSON.stringify(st),before);
});
t('editing invoice cannot leave attached cheques exceeding its new amount',()=>{
  const {st,customer,supplier,product}=basic();
  assert.ok(C.addInvoice(st,{type:'purchase',personId:supplier.id,date:DATE,items:[{productId:product.id,qty:1,price:1000}]}).ok);
  const r=C.addInvoice(st,{type:'sale',personId:customer.id,date:DATE,items:[{productId:product.id,qty:1,price:1000}]});
  const c=C.addCheque(st,{cycle:true,direction:'receive',personId:customer.id,invoiceId:r.invoice.id,amount:1000,date:DATE,dueDate:'2026-10-10'});
  assert.ok(c.ok,c.error);
  const before=JSON.stringify(st);
  const edit=C.editInvoice(st,r.invoice.id,{personId:customer.id,date:DATE,items:[{productId:product.id,qty:1,price:900}]});
  assert.ok(!edit.ok); assert.strictEqual(JSON.stringify(st),before);
  assert.ok(!C.deleteInvoice(st,r.invoice.id).ok);
});
console.log(`${passed} vol002 regression tests passed`);
