const assert = require('node:assert/strict');
const fs = require('node:fs');
const C = require('../www/receipt-intelligence.js');
const pages = fs.readFileSync(require.resolve('../www/pages.js'),'utf8');
for (const id of ['tf-ocr-amount','tf-ocr-date','tf-ocr-code','tf-ocr-settled']) assert.ok(pages.includes('id="'+id+'"'), 'Missing form field '+id);
assert.ok(pages.includes("UNIT() === 'تومان' ? enteredAmount / 10"), 'Unit conversion missing');
assert.ok(pages.includes('موتور سریع لاتین نتوانست فیش فارسی را کامل بخواند'), 'Incomplete OCR warning missing');
const images = [
  ['صادرات', `رسید انتقال وجه\nنام بانک مبدا بانک صادرات ایران\nمبلغ\n۱۸۳,۰۰۰,۰۰۰ ریال\nشماره پیگیری\n۰۵۰۸۲۱۱۴۱۵HOMA۱۳۹۶\nزمان\n۱۴۰۵/۰۸/۲۱ ۱۴:۱۱:۴۶`, 183000000, '1405/08/21'],
  ['blu', `رسید\nبلوبانک\nمبلغ انتقال\nریال\n۱۰,۰۰۰,۰۰۰\nچهارشنبه ۲۰ آبان ۱۴۰۵\nشماره مرجع ۴۴۶۲۶۳۰۱۷۵۱۵۱`, 10000000,'1405/08/20'],
];
for (const [name, txt, amount,date] of images) {const r=C.analyzeBankReceipt(txt,{tx:[]}); assert.equal(r.amountRial,amount,name+' amount'); assert.equal(r.date,date,name+' date');}
console.log('vol010: image parser regression + form fields passed');
