const assert=require('node:assert/strict');
const C=require('../www/receipt-intelligence.js');
const samples=[
{type:'blu SMS Persian date',text:`بلو\nانتقال بین بانکی (پایا) سیده ساغر امامی قهفرخی\nسپرده: ‎IR - ۸۸ ۰۵۶۰ ۶۱۱۸ ۲۸۰۰ ۵۶۱۷ ۷۲۸۱ ۰۱\nمبلغ: ۸۰۰٬۰۰۰٬۰۰۰ ریال\nتاریخ: ۱۴:۲۲ پنجشنبه، ۲۱ آبان ۱۴۰۵\nواریز به: ‎IR۹۱۰۱۲۰۰۲۰۰۰۰۰۰۹۲۳۷۴۳۰۳۶۰\nبه نام علی فرمانی\nشماره پیگیری: ۱۴۰۵۷۰۷۱۶۲۰۵۰۴`,amount:800000000,date:'1405/08/21',time:'14:22',method:'پایا'},
{type:'blu card',text:`رسید\nمسعود کلاته آقامحمدی\n10,000,000 ریال\nانتقال موفق\nچهارشنبه، 20 آبان 1405 23:15\nانتقال دهنده\nمحمدصادق ربانی\nروش انتقال کارت به کارت\nشماره مرجع 4462630175151`,amount:10000000,date:'1405/08/20',time:'23:15',method:'کارت به کارت'},
{type:'insurance web',text:`شناسه پرداخت 31060002110891326\nمبلغ 9,750,000 ریال\nتاریخ سررسید قسط 1405/08/21\nزمان تراکنش 1405/08/20 14:32:44\nرسید بانکی 74901542429\nپرداخت شده`,amount:9750000,date:'1405/08/20',time:'14:32:44'},
{type:'payment pending',text:`درخواست حواله پایا\nتاریخ تراکنش 1405/08/07\nمبلغ: 540,000,000 ریال\nشماره پیگیری: 140508071233509737\nاین رسید تا زمان وصول وجه در حساب مقصد فاقد اعتبار است`,amount:540000000,date:'1405/08/07',status:'pending'},
{type:'amount RTL',text:'انتقال موفق\nمبلغ انتقال\nریال 913,000,000\nزمان 12:12 چهارشنبه 20 آبان 1405\nشماره سند 140507031677143',amount:913000000,date:'1405/08/20',time:'12:12'},
{type:'statusbar',text:'12:12\nرسید\nمبلغ 1,070,000,000 ریال\nزمان\n21:36 دوشنبه 18 آبان 1405',amount:1070000000,date:'1405/08/18',time:'21:36'}
];
for(const s of samples){const r=C.analyzeBankReceipt(s.text,{tx:[]});assert.equal(r.amountRial,s.amount,s.type+' amount');assert.equal(r.date,s.date,s.type+' date');if('time' in s)assert.equal(r.time,s.time,s.type+' time');if(s.method)assert.equal(r.method,s.method,s.type+' method');if(s.status)assert.equal(r.status,s.status,s.type+' status');}
const d=C.analyzeBankReceipt('مبلغ: 800,000,000 ریال\nشماره پیگیری: 14057071620504',{tx:[{id:1,desc:'کد رهگیری ۱۴۰۵۷۰۷۱۶۲۰۵۰۴'}]});assert.equal(d.duplicateCandidates.length,1);
console.log('vol009 parser: 7 scenarios passed');
