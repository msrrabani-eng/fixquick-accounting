'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const pages=read('www/pages.js'),css=read('www/ui2.css');assert.ok(pages.includes('safety: pageSafety'));
assert.match(read('www/sw.js'),/vol(?:02[0123456789]|030|031|032|033|034|035|036|037|038|039|040|041|042|043|044|045|046)/);assert.match(read('www/diag.js'),/APP_VER = '1\.(?:5[123456789]|60|61|62|63|64|65|66|67|68|69|70|71|72|73|74|75|76|77)'/);
// Stock toolbar: expanding the disclosure must not squeeze the five actions into its closed width.
const stockUi=read('www/ui2.js');
assert.ok(stockUi.includes("bar.classList.add('ui2-stock-toolbar')"));
assert.ok(stockUi.includes("label.className='ui2-tool-label'"));
assert.ok(css.includes('.ui2-stock-toolbar>.ui2-stock-menu[open]{flex:1 0 100%;width:100%}'));
assert.ok(css.includes('.ui2-stock-menu>.ui2-menu-items{grid-template-columns:minmax(0,1fr)'));
console.log('v020 final: full-width stock disclosure and wrapping rules retained');
