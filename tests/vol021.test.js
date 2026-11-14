'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const F=require('../www/ai-addon.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
for (const status of ['ready','downloading','paused','verifying','notInstalled','failed','unavailable']) {
 const v=F.installView({status,runtime:true,compatible:true});
 assert.equal(v.showDownload,['notInstalled','failed','unavailable'].includes(status),status);
 assert.equal(v.showSetup,v.showDownload,status);assert.equal(v.canEnter,status==='ready',status);
 assert.equal(v.canRemove,['ready','downloading','paused','verifying','failed'].includes(status),status);
}
assert.equal(F.installView({status:'ready',runtime:false,compatible:true}).canEnter,false);
assert.equal(F.installView({status:'ready',runtime:true,compatible:false}).showDownload,false);
const java=read('native-ai/LocalAIPlugin.java'),cpp=read('native-ai/bridge.cpp'),setup=read('tools/install_local_ai.py'),ui=read('www/ai-addon.js');
assert.ok(!java.includes('m.availMem<2800000000L'));
for(const token of ['AiMemoryPolicy.canGenerate','m.threshold','m.lowMemory','"availableRam"','"memoryReady"','"minAvailableRam"','"contextLimit"','contextLimit);','catch(OutOfMemoryError','fq_ai_model_v1','Qwen3-4B-Q4_K_M.gguf','!SHA.equals(hex.toString())','if("ready".equals(s)||'])assert.ok(java.includes(token),token);
for(const token of ['mp.use_mmap=true','mp.use_mlock=false','cp.n_ctx=needed','cp.n_batch=128','cp.n_ubatch=64','i+=128','n+limit>=cap'])assert.ok(cpp.includes(token),token);
assert.ok(setup.includes('prefetch = 0; // Fix Quick: demand-page weights on mobile'));assert.ok(setup.includes('AiMemoryPolicy.java'));
assert.ok(ui.includes("q('#ai-download').hidden=!view.showDownload"));assert.ok(ui.includes('مدل سالم است اما فعلاً حافظه'));
assert.ok(read('www/smart-ui.js').includes('FQOrchestrator.run'));assert.ok(read('www/sw.js').match(/vol02[123]/));assert.ok(read('www/diag.js').match(/APP_VER = '1\.5[234]'/));assert.ok(read('.github/workflows/build-apk.yml').includes('tests/AiMemoryPolicyTest.java'));
console.log('v021: installed/active/download state visibility, memory-policy wiring, pinned model and read-only assistant retained');
