'use strict';
const assert = require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
let currentUser='admin';
global.curName=()=>currentUser;
const store=new Map();
global.localStorage={
  getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)),
  removeItem:k=>store.delete(k),
  key:i=>Array.from(store.keys())[i] || null,
  get length(){return store.size;}
};
global.document={createElement:()=>({textContent:'',className:''})};
const D=require('../www/drafts.js');
function fakeForm(init) {
  const e=Object.entries(init).map(([name,val])=>({name,value:String(val),type:'text',tagName:'INPUT'}));
  const f={els:e,listeners:{},
    querySelectorAll(sel){return sel === 'input[data-money]' ? [] : e;},
    addEventListener(event,fn){(this.listeners[event]??=[]).push(fn);},
    insertBefore(){},firstChild:null,
    closest(){return null;}
  };
  return f;
}
function field(f,k){return f.els.find(e=>e.name===k);}
let f=fakeForm({amount:'',note:'',pid:'12'});
let c=D.bind(f,'invoice:sale',{getExtra:()=>({rows:[{pid:'1',qty:'2',price:'100',note:'IMEI1'},{pid:'2',qty:'3',price:'200',note:'IMEI2'}]})});
c.save();assert.equal(D.get('invoice:sale'),null,'Untouched empty form should not create draft');
field(f,'amount').value='250000';field(f,'note').value='important';c.save();
let saved=D.get('invoice:sale');assert.equal(saved.fields.amount[0].value,'250000');assert.equal(saved.extra.rows.length,2);
c.detach();assert.ok(D.get('invoice:sale'));
let newForm=fakeForm({amount:'',note:'',pid:''});let restoredExtra=null;
let ctl=D.bind(newForm,'invoice:sale',{getExtra:()=>({rows:saved.extra.rows}),setExtra:x=>{restoredExtra=x.rows;}});
assert.equal(field(newForm,'amount').value,'250000');assert.equal(field(newForm,'note').value,'important');assert.equal(restoredExtra[1].note,'IMEI2');
assert.ok(D.list().some(x=>x.kind==='invoice:sale'));
ctl.clear();assert.equal(D.get('invoice:sale'),null,'Successful commit must clear only that draft');
const f2=fakeForm({amount:'1'}), c2=D.bind(f2,'tx:receipt:new');field(f2,'amount').value='555';c2.save();
const f3=fakeForm({amount:'1'}), c3=D.bind(f3,'tx:payment:new');field(f3,'amount').value='666';c3.save();
assert.equal(D.get('tx:receipt:new').fields.amount[0].value,'555');
assert.equal(D.get('tx:payment:new').fields.amount[0].value,'666');
currentUser='employee';assert.equal(D.get('tx:payment:new'),null,'drafts must be scoped per logged-in user');
currentUser='admin';c2.clear();assert.equal(D.get('tx:receipt:new'),null);assert.ok(D.get('tx:payment:new'));
c3.clear();
const pages=read('www/pages.js'),ledger=read('www/ledger.js'),accounts=read('www/accounts.js'),html=read('www/index.html'),sw=read('www/sw.js');
for(const x of ['invoiceDraftKey','Drafts.flushPage','invStockPause','invDraftDiscard','resumeDraft','Drafts.clear(f)','Drafts.bind(f,dk','beforeRestore: ex','getExtra: () => ({rows:'])assert.ok(pages.includes(x),'Invoice draft wiring missing: '+x);
for(const x of ['tx:','transfer:','expense:','person:','product:'])assert.ok(pages.includes("Drafts.attachSheet(sh,'"+x),'Missing sheet autosave for '+x);
for(const x of ['cheque:','cheque:legacy:','voucher:','warehouse-transfer:','warehouse:'])assert.ok(ledger.includes("Drafts.attachSheet(sh,'"+x),'Missing cheque draft '+x);
assert.ok(accounts.includes('Drafts.attachSheet(sh,\'bank-transfer:'));
assert.ok(accounts.includes('Drafts.attachSheet(sh,\'account:'));
assert.ok(pages.indexOf('Drafts.flushPage();') < pages.indexOf('const hash = (location.hash', pages.indexOf('function render(opt)')), 'must flush before rendering the next screen');
assert.ok(html.includes('<script src="drafts.js"></script>') && sw.includes('drafts.js'));
assert.ok(!html.includes('receipt-ocr.js'));
assert.ok(read('.github/workflows/build-apk.yml').includes('node tests/vol012.test.js'));
console.log('v012: 24 draft/recovery/financial-safety checks passed');
