'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const ctx=vm.createContext({URL,console,location:{hash:'#/home'},localStorage:{getItem:()=> 'yes',setItem(){}},smartCurrentUser:()=> 'owner',Capacitor:{Plugins:{}},goHash(){},render(){}});
vm.runInContext(read('www/ai-addon.js'),ctx);
const run=s=>vm.runInContext(s,ctx);
run(`Capacitor.Plugins.FixQuickAI={status:async()=>({status:'ready',runtime:true,compatible:true})};aiChatOwner='owner';`);
for(const status of ['notInstalled','downloading','paused','verifying','failed','unavailable']){run(`aiStatus={status:'${status}',runtime:true,compatible:true}`);assert.equal(run('!!aiChatAllowed()'),false,status);}
run(`aiStatus={status:'ready',runtime:true,compatible:true}`);assert.equal(run('aiChatAllowed()'),true);
for(const s of [`aiStatus.runtime=false`,`aiStatus.compatible=false`,`aiChatOwner='other'`,`Capacitor.Plugins={}`]){run(`aiStatus={status:'ready',runtime:true,compatible:true};aiChatOwner='owner';Capacitor.Plugins={FixQuickAI:{}};${s}`);assert.equal(run('!!aiChatAllowed()'),false,s);}
const pages=read('www/pages.js'),ui=read('www/smart-ui.js'),css=read('www/ui2.css');assert.equal((pages.match(/data-act="aiLaunch"/g)||[]).length,1);assert.ok(!pages.includes("row('chat', 'دستیار هوشمند', '#/assistant')"));assert.ok(ui.includes('if(!aiChatAllowed())return'));assert.ok(ui.includes('await aiReadStatus()'));assert.ok(ui.includes('ui20-scroll'));assert.ok(css.includes('grid-template-rows:minmax(0,1fr) auto'));assert.ok(css.includes('.ui20-chat .ui2-chat-compose{position:static'));
assert.match(read('www/sw.js'),/vol02[0123]/);assert.match(read('www/diag.js'),/APP_VER = '1\.5[1234]'/);assert.ok(read('.github/workflows/build-apk.yml').includes('node tests/vol020.test.js'));
console.log('v020: readiness gate, stale opt-in, user isolation, home-only entry, bounded chat layout and build wiring passed');

// Stock toolbar: expanding the disclosure must not squeeze the five actions into its closed width.
const stockUi=read('www/ui2.js');
assert.ok(stockUi.includes("bar.classList.add('ui2-stock-toolbar')"));
assert.ok(stockUi.includes("label.className='ui2-tool-label'"));
assert.ok(css.includes('.ui2-stock-toolbar>.ui2-stock-menu[open]{flex:1 0 100%;width:100%}'));
assert.ok(css.includes('.ui2-stock-menu>.ui2-menu-items{grid-template-columns:minmax(0,1fr)'));
console.log('v020 final: full-width stock disclosure and wrapping rules retained');
