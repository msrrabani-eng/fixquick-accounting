'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('../www/core.js'),G=require('../www/entity-guard.js');
const st=C.emptyState();
st.people.push({id:101,name:'محمدصادق ربانی',phone:'۰۹۱۲۱۲۳۴۵۶۷',code:'1010'},
 {id:102,name:'علی رضایی',phone:'۰۲۱۱۲۳۴۵۶۷۸',archived:true},
 {id:103,name:'حسن براتی',phone:'09121234568'});
st.products.push({id:201,name:'آیفون ۱۶ پرو ۲۵۶ گیگ'},{id:202,name:'کابل شارژ مک دودو'},{id:203,name:'آیفون ۱۶ پرو ۱۲۸ گیگ'});
const before=JSON.stringify(st);
const person=(d,id)=>G.find(st,'person',d,id),product=(name,id)=>G.find(st,'product',{name},id);
assert.ok(person({name:'محمد صادق رباني'}).some(x=>x.id===101&&x.score===100));
assert.ok(person({name:'محمدصادق ربانب'}).some(x=>x.id===101&&x.score>0));
assert.ok(person({name:'رضایی علی'}).some(x=>x.id===102&&x.archived));
for(const phone of ['+989121234567','0098 912 123 4567','۰۹۱۲-۱۲۳-۴۵۶۷','9121234567','۹۸۹۱۲۱۲۳۴۵۶۷']){
  assert.ok(person({name:'فروشگاه نمونه',phone}).some(x=>x.id===101&&x.phone),phone);
}
assert.ok(person({phone:'0098 21 12345678'}).some(x=>x.id===102&&x.archived));
assert.ok(!person({name:'محمدصادق ربانی',phone:'09121234567'},101).some(x=>x.id===101));
assert.ok(!person({phone:'09121234569'}).length);
assert.ok(!person({name:'حسن',phone:''}).length);
assert.ok(!person({phone:'123'}).length);
assert.ok(person({phone:'09350000000 / +989121234567'}).some(x=>x.id===101&&x.phone));
assert.ok(product('iPhone 16 Pro 256 GB').some(x=>x.id===201));
assert.ok(!product('آیفون ۱۷ پرو ۲۵۶ گیگ').length);
assert.ok(!product('آیفون ۱۶ پرو مکس ۲۵۶ گیگ').length);
assert.ok(!product('آیفون ۱۶ پرو ۲۵۶ گیگ',201).length);
assert.ok(product('کابل شارژ مک‌دودو').some(x=>x.id===202));
assert.ok(G.batch(st,'person',[{name:'فروشگاه الف',phone:'09351234567'},{name:'فروشگاه ب',phone:'+989351234567'}]).some(r=>r.matches.some(x=>x.phone&&String(x.id).startsWith('batch:'))));
assert.equal(JSON.stringify(st),before,'read-only check must not alter any records');
const pages=fs.readFileSync(require.resolve('../www/pages.js'),'utf8'),ui=fs.readFileSync(require.resolve('../www/smart-ui.js'),'utf8');
const html=fs.readFileSync(require.resolve('../www/index.html'),'utf8'),sw=fs.readFileSync(require.resolve('../www/sw.js'),'utf8');
for(const s of ["entityLive(sh.q('#pf'),'person',p&&p.id)","entityConfirm(f,'person',d,p&&p.id)","entityLive(f,'product',p&&p.id)","entityConfirm(f,'product',d,p&&p.id)","entityLive(sh.q('#pq'),'person',null)","entityConfirm(f,'person',d,null)","entityBatchConfirm('person',candidates)","entityBatchConfirm('product',fresh)"])assert.ok(pages.includes(s),s);
assert.ok(ui.includes('box.textContent=')&&ui.includes('entityPending'));
assert.ok(html.includes('<script src="entity-guard.js"></script>')&&sw.includes("'entity-guard.js'"));
assert.ok(fs.readFileSync(require.resolve('../.github/workflows/build-apk.yml'),'utf8').includes('node tests/vol015.test.js'));
console.log('v015: name similarity, phone normalization, archive/self exclusion, product variants, batch and UI wiring passed');
