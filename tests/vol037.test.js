'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),M=require('../www/local-math.js');
(async()=>{
let done,calls=0,stops=0;
global.Capacitor={Plugins:{FqLocalMath:{status:async()=>({ready:true,running:false}),test:()=>{calls++;return new Promise(r=>done=r);},solve:async()=>{calls++;return {text:'42'};},stop:async()=>{stops++;done({passed:false});}}}};
const first=M.action('test');assert.equal((await M.status()).running,true);
await assert.rejects(M.action('test'));await assert.rejects(M.solve('1+1',[],'1405/08/25'));assert.equal(calls,1);
await M.action('stop');await first;assert.equal(stops,1);assert.equal((await M.status()).running,false);
assert.equal((await M.solve('17+25',[],'1405/08/25')).text,'۴۲');
const read=p=>fs.readFileSync(p,'utf8'),j=read('local-math/FqMathPlugin.java'),s=read('local-math/FqMathService.java'),n=read('local-math/engine.cpp');
assert.match(j,/DIR="local-math-v041"/);assert.match(j,/fq_local_math_v041/);assert.match(j,/b7508d8b4a652bc020a439aafdd4ce1527d49774865ce3334a43b16dbeaa90ca/);
assert.doesNotMatch(j,/target\.delete\(|model\(\)\.delete\(/);assert.match(j,/if\(input\.equals\(model\(\)\)\)recheckFailed=true;else input\.delete\(\)/);
assert.match(j,/j\.put\("running",active!=null\)/);assert.match(j,/requestStop/);assert.match(j,/msg\.what==4/);assert.match(s,/nativePercent/);assert.match(n,/generated=i\+1/);
assert.match(s,/getExternalFilesDir\("local-math-v041"\)/);assert.doesNotMatch(s,/\.delete\(|deleteDatabase|clearApplicationUserData/);
assert.doesNotMatch(read('.github/workflows/build-apk.yml'),/install_storage_cleanup\.py/);
assert.match(read('www/smart-ui.js'),/data-model="stop"/);
console.log('v037 model lifecycle and preservation checks passed; native runtime still requires real device validation');
})().catch(e=>{console.error(e);process.exitCode=1;});
