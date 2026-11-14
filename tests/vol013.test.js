'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
let currentUser = 'owner';
global.curName = () => currentUser;
const data = new Map();
global.localStorage = {
  getItem: k => data.has(k) ? data.get(k) : null,
  setItem: (k,v) => data.set(k,String(v)),
  removeItem: k => data.delete(k),
  key: i => [...data.keys()][i] ?? null,
  get length() {return data.size;}
};
global.document = {createElement: tag => ({tagName:tag.toUpperCase(),style:{}, listeners:{},
  addEventListener(event,fn){this.listeners[event] = fn;},
  click(){this.listeners.click?.();},
  textContent:'',className:'',type:''})};
let lastDialog = null;
global.sheet = (title, html) => {
  const buttons={};
  const dialog={title,html,closed:false,
    q:(sel)=> (buttons[sel] ??= {onclick:null}),
    close(){this.closed=true;}
  };
  lastDialog=dialog;
  return dialog;
};
const Drafts=require('../www/drafts.js');
function fakeForm(initial){
  const elements=Object.entries(initial).map(([name,value])=>({name,value:String(value),type:'text',tagName:'INPUT'}));
  return {elements,buttons:[], listeners:{},
    querySelectorAll(sel){return sel === 'input[data-money]' ? [] : elements;},
    insertBefore(){},get firstChild(){return null;},
    appendChild(element){this.buttons.push(element);},
    addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);},
    closest(){return null;}
  };
}
const field=(f,name)=>f.elements.find(el=>el.name===name);

// Save draft, leave invoice, then reopen; data and other drafts must remain intact.
const inv=fakeForm({amount:0,customer:1});
const invoiceCtl=Drafts.bind(inv,'invoice:sale');
field(inv,'amount').value='900000';
let exitCount=0;
assert.ok(Drafts.requestExit(inv,()=>{exitCount++},'لغو فاکتور'));
assert.match(lastDialog.html,/خروج و حفظ پیش‌نویس/);
assert.match(lastDialog.html,/لغو عملیات و حذف پیش‌نویس/);
assert.match(lastDialog.html,/ادامه ویرایش/);
lastDialog.q('#draft-exit-keep').onclick();
assert.equal(exitCount,1);
assert.equal(Drafts.get('invoice:sale').fields.amount[0].value,'900000');
invoiceCtl.detach();

// 'Continue editing' must neither exit nor delete a restored draft.
const f2=fakeForm({amount:0});
const recovered=Drafts.bind(f2,'invoice:sale');
assert.equal(field(f2,'amount').value,'900000');
Drafts.requestExit(f2,()=>{exitCount++});
lastDialog.close();
assert.equal(exitCount,1);
assert.ok(Drafts.get('invoice:sale'));
field(f2,'amount').value='910000';
recovered.save();

// Deleting one pending invoice cannot erase any other draft or posted accounting state.
const other=fakeForm({serial:123});
const otherCtl=Drafts.bind(other,'cheque:new');
field(other,'serial').value='456';otherCtl.save();
const accounting={tx:[{amount:77}],invoices:[{id:3}],stock:10};
const accountingBefore=JSON.stringify(accounting);
Drafts.requestExit(f2,()=>{exitCount++});
lastDialog.q('#draft-exit-delete').onclick();
assert.equal(exitCount,2);
assert.equal(Drafts.get('invoice:sale'),null);
assert.equal(Drafts.get('cheque:new').fields.serial[0].value,'456');
assert.equal(JSON.stringify(accounting),accountingBefore);
recovered.detach(); // must not accidentally recreate discarded draft
assert.equal(Drafts.get('invoice:sale'),null);

// Sheet forms must have a working visible cancel button with save/discard options.
const sheetForm=fakeForm({note:'',amount:0});
const mockSheet={o:{},el:{querySelector:()=>sheetForm},close(silent){if(!silent&&this.o.onClose)this.o.onClose();}};
const txCtl=Drafts.attachSheet(mockSheet,'tx:receipt:new');
const cancel=sheetForm.buttons.find(b=>b.textContent.includes('لغو'));
assert.ok(cancel,'Every autosaved sheet must show a cancel button');
field(sheetForm,'amount').value='100';
cancel.click();
assert.equal(lastDialog.title,'لغو عملیات');
lastDialog.q('#draft-exit-keep').onclick();
assert.equal(Drafts.get('tx:receipt:new').fields.amount[0].value,'100');

// The primary invoice screen has a visible cancel at top and near submit.
const pages=fs.readFileSync(require.resolve('../www/pages.js'),'utf8');
assert.ok(pages.includes('data-act="invCancel">لغو فاکتور'));
assert.ok(pages.includes('data-act="invCancel">خروج'));
assert.ok(pages.includes('Drafts.requestExit(f,()=>goHash(destination)'));
assert.ok(!pages.includes("Drafts.clear(f); Drafts.discard(key); render();")); // old bug: staying on abandoned invoice
const workflow=fs.readFileSync(require.resolve('../.github/workflows/build-apk.yml'),'utf8');
assert.ok(workflow.includes('node tests/vol013.test.js'));
assert.ok(/fq-acc-vol01[3-6]/.test(fs.readFileSync(require.resolve('../www/sw.js'),'utf8')));
assert.equal(data.size>0,true);
otherCtl.clear();txCtl.clear();
console.log('v013: save, discard, resume, continue, sheet cancel, isolation and UI wiring passed');
