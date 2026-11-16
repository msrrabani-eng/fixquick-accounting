'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const pages=read('www/pages.js'),ui=read('www/smart-ui.js'),css=read('www/ui2.css');assert.equal((pages.match(/data-h="#\/assistant"/g)||[]).length,1);assert.ok(ui.includes('ui20-scroll'));assert.ok(css.includes('grid-template-rows:minmax(0,1fr) auto'));assert.ok(css.includes('.ui20-chat .ui2-chat-compose{position:static'));
assert.match(read('www/sw.js'),/vol(?:02[0123456789]|030)/);assert.match(read('www/diag.js'),/APP_VER = '1\.(?:5[123456789]|60|61)'/);
// Stock toolbar: expanding the disclosure must not squeeze the five actions into its closed width.
const stockUi=read('www/ui2.js');
assert.ok(stockUi.includes("bar.classList.add('ui2-stock-toolbar')"));
assert.ok(stockUi.includes("label.className='ui2-tool-label'"));
assert.ok(css.includes('.ui2-stock-toolbar>.ui2-stock-menu[open]{flex:1 0 100%;width:100%}'));
assert.ok(css.includes('.ui2-stock-menu>.ui2-menu-items{grid-template-columns:minmax(0,1fr)'));
console.log('v020 final: full-width stock disclosure and wrapping rules retained');
