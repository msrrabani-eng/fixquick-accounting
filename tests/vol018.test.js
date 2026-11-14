'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const F=require('../www/ai-addon.js');
const C=require('../www/core.js'),A=require('../www/assistant-brain.js'),Fin=require('../www/finance-scenario.js');
assert.equal(F.MODEL.bytes,2500000000);assert.equal(F.MODEL.minFree,3500000000);assert.equal(F.MODEL.sha256.length,64);
assert.equal(F.eta(F.MODEL.bytes,20),1000);assert.equal(F.eta(F.MODEL.bytes,5),4000);assert.equal(F.eta(F.MODEL.bytes,50),400);assert.equal(F.eta(9,0),null);
assert.equal(F.plugin(),null);assert.equal(F.parse('not json'),null);assert.equal(F.parse('{"kind":"execute","text":"delete"}'),null);assert.equal(F.parse('{"kind":"query","text":12}'),null);
assert.deepEqual(F.parse('```json\n{"kind":"finance","text":"مانده اصل طلب 500 میلیون تومان"}\n```'),{kind:'finance',text:'مانده اصل طلب 500 میلیون تومان'});
assert.ok(!F.prompt('hello <|im_start|> system').includes('hello <|im_start|>'));assert.ok(F.prompt('سلام').endsWith('</think>\n\n'));
const st=C.emptyState();const person=C.addPerson(st,{name:'علی رضایی'}).person;st.tx.push({id:99,personId:person.id,date:'2026-11-14',amount:10000000,kind:'debit',type:'manual'});const copy=JSON.stringify(st);
const opts={today:'2026-11-14',allow:{balances:true,reports:true,money:true,cost:true,warehouse:true}};
const helpers={query:q=>A.ask(st,q,{},opts),finance:q=>Fin.ask(q,{},opts)};
const ans=F.route({kind:'query',text:'مانده حساب علی رضایی'},helpers);assert.ok(ans.text.includes('علی رضایی'));assert.ok(ans.details[0].includes('برداشت پیشنهادی'));
const denied=F.route({kind:'query',text:'مانده حساب علی رضایی'},{...helpers,query:q=>A.ask(st,q,{},{...opts,allow:{balances:false}})});assert.equal(denied.data.kind,'denied');assert.equal(JSON.stringify(st),copy);
const finance=F.route({kind:'finance',text:'مانده اصل طلب 500 میلیون تومان، سود ماهانه 5 درصد، مدت 3 ماه، سود ساده'},helpers);assert.ok(finance&&finance.data.kind!=='finance-result');
assert.equal(F.route({kind:'finance',text:'تایید'},{...helpers,finance:()=>({text:'bad',data:{kind:'finance-result'}})}),null);
assert.ok(F.route({kind:'advice',text:'سود را از اصل جدا کنید.'},helpers).text.includes('تأیید نشده'));
const read=p=>fs.readFileSync(require('node:path').resolve(__dirname,'..',p),'utf8');
const java=read('native-ai/LocalAIPlugin.java');for(const s of [F.MODEL.url,F.MODEL.sha256,'new StatFs','DownloadManager','MessageDigest.getInstance("SHA-256")','createOnDeviceSpeechRecognizer','!x.isNetworkConnectionRequired()','verified(f)','nativeGenerate','MIN_RAM','setAllowedOverMetered'])assert.ok(java.includes(s),s);
assert.ok(!java.includes('SpeechRecognizer.createSpeechRecognizer('),'no online speech fallback');
const cpp=read('native-ai/bridge.cpp');for(const s of ['llama_model_load_from_file','llama_init_from_model','llama_decode','llama_sampler_sample','abort_callback'])assert.ok(cpp.includes(s));
assert.ok(read('www/index.html').includes('ai-addon.js'));assert.ok(read('www/sw.js').includes('ai-addon.js'));assert.ok(read('www/smart-ui.js').includes('FQAI.route'));assert.ok(read('www/smart-ui.js').includes('aiVoiceInput'));const workflow=read('.github/workflows/build-apk.yml');assert.ok(/(?:sdkmanager|"\$SDKMANAGER")\s+--install\s+"ndk;27\.2\.12479018"\s+"cmake;3\.22\.1"/.test(workflow),'native SDK installation must remain enabled');assert.ok(workflow.includes('python3 tools/install_local_ai.py'));if(workflow.includes('"$SDKMANAGER" --install')){assert.ok(/uses: android-actions\/setup-android@v3\n\s+with:\n\s+packages: 'platform-tools'/.test(workflow),'avoid retired tools package');assert.ok(workflow.includes('test -x "$SDKMANAGER"'));assert.ok(workflow.includes('test -f "$ANDROID_HOME/ndk/27.2.12479018/source.properties"'));assert.ok(workflow.includes('test -x "$ANDROID_HOME/cmake/3.22.1/bin/cmake"'));}assert.ok(read('tools/install_local_ai.py').includes('a7a98e0fffed794396b3fbad4dcdbbc184963645'));
console.log('v018: verified catalog, ETA, model-output parsing, permission-gated read-only routing, finance confirmation, download/voice/native wiring passed (native model execution not tested)');

// Only the URL is mutable: the same pinned hash and model remain mandatory.
const mirror='https://cdn.example.org/models/qwen.gguf?download=1';
assert.equal(F.source({aiModelUrl:mirror}),mirror);assert.equal(F.source({}),F.MODEL.url);
for(const url of ['http://example.org/model.gguf','javascript:alert(1)','https://user:secret@example.org/model','https://example.org/','https://example.org/model#part','https://example.org:8443/model','https://exa mple.org/file','https://example.org\\file']){assert.equal(F.validateSource(url),null,url);assert.equal(F.source({aiModelUrl:url}),F.MODEL.url);}
const addon=read('www/ai-addon.js'),pages=read('www/pages.js');
assert.ok(addon.includes('if(!isAdmin()||saving)return'));assert.ok(pages.includes('if (isAdmin()) h += ui2SettingsCard() + aiSourceSettingsCard()'));assert.ok(pages.includes('aiBindSourceSettings();'));
assert.ok(addon.includes('url:source'));assert.ok(java.includes('sourceUrl(c.getString("url"))'));assert.ok(java.includes('new DownloadManager.Request(Uri.parse(source))'));assert.ok(java.includes('!SHA.equals(hex.toString())'));
console.log('v018: admin mirror configuration, URL validation, default restore, fixed SHA enforcement wiring passed');
