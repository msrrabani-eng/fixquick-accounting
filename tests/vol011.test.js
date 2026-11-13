'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f),'utf8');
const pages = read('www/pages.js'), html = read('www/index.html'), sw=read('www/sw.js');
const workflow=read('.github/workflows/build-apk.yml');
assert.ok(pages.includes("function txForm(type, personId, tx, pre)"));
for(const part of ["moneyField('amount'", "acctSel(tx ? tx.acct", "dateField('date'", "Core.addTx(S", "Core.editTx(S", "cashGuard(", "تسویه کامل مانده"])
  assert.ok(pages.includes(part), 'Missing original accounting operation: '+part);
for(const text of ['فیش بانکی هوشمند','tf-ocr','ReceiptOCR','verifiedReceipt','Core.analyzeBankReceipt'])
  assert.ok(!pages.includes(text), 'Obsolete receipt integration: '+text);
for(const text of ['receipt-ocr.js','receipt-intelligence.js','ocr/tesseract.min.js'])
  assert.ok(!html.includes(text) && !sw.includes(text), 'Obsolete browser load: '+text);
for(const text of ['prepare_ocr.sh','install_native_ocr.py','vol010.test.js'])
  assert.ok(!workflow.includes(text), 'Obsolete build dependency: '+text);
for(const file of ['www/receipt-ocr.js','www/receipt-intelligence.js','tools/prepare_ocr.sh','tools/install_native_ocr.py','www/fixquick-update-v1.37.zip','native-android/FastReceiptOCR.java'])
  assert.ok(!fs.existsSync(path.join(root,file)),'Dead payload retained: '+file);
assert.ok(fs.existsSync(path.join(root,'www/jsqr.js')),'QR/IMEI scanning must remain');
assert.ok(fs.existsSync(path.join(root,'www/smartsearch.js')),'Smart search must remain');
console.log('v011: bank OCR completely removed, financial forms / scanner / search retained');
