'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=f=>fs.readFileSync(require('node:path').resolve(__dirname,'..',f),'utf8');
const ctx=vm.createContext({DEV:'گوشی',document:{addEventListener(){}}});
vm.runInContext(read('www/help.js'),ctx);
const coverage=vm.runInContext('JSON.stringify({help:HELP,examples:HELP_EXAMPLES,groups:HELP_GROUPS})',ctx);
const {help,examples,groups}=JSON.parse(coverage),keys=groups.flatMap(x=>x[1]);
assert.equal(new Set(keys).size,keys.length);assert.deepEqual([...keys].sort(),Object.keys(help).sort());
for(const k of keys){assert.ok(help[k][0]&&help[k][1].length>20,k);assert.ok(examples[k].length>20,k);}
assert.ok(keys.length>=65);assert.ok(examples.interestSimple.includes('۵۷۵'));assert.ok(examples.interestCompound.includes('۵۷۸٬۸۱۲٬۵۰۰'));assert.ok(examples.margin.includes('۲۰٪')&&examples.margin.includes('۲۵٪'));
const pages=read('www/pages.js');for(const token of ['#/settings/backup','menu019Group','data-settings-group','aiBindSourceSettings();','if (isAdmin()) h += ui2SettingsCard() + aiSourceSettingsCard()','if ($(\'#restore-file\')) $(\'#restore-file\').onchange = restoreFile','if (can(\'backup\')) h += autoBackupCard()'])assert.ok(pages.includes(token),token);
assert.match(read('www/sw.js'),/vol(?:019|02[01])/);assert.match(read('www/diag.js'),/APP_VER = '1\.5[012]'/);
console.log('v019: '+keys.length+' unique help topics and examples, numeric examples, old settings actions / permissions retained, cache version passed');
